"use client";
// The one engine state every results page reads, in the browser. LIVE: the latest state from /api/results/engine,
// refreshed on the site's poll cadence. REPLAY: the state in force at the replay clock, fetched (and cached) per
// observation frame; the clock runs on timestamps (replay.ts), so speed changes, seeking and stepping never depend on
// rows or rerenders. Every page subscribes to this same store, so they all show the same moment.
import { useEffect, useState, useSyncExternalStore } from "react";
import type { NationalPoint, RacePoint } from "@/app/lib/engine/recorder";
import { frameIndexAt, newClock, pause as pauseC, play as playC, seek as seekC, setSpeed as speedC, step as stepC, tick, type Clock } from "@/app/lib/engine/replay";
import type { ReplayWindow, SourceInfo, View } from "@/app/lib/engine/serve";
import { detailAt, type CompactRace } from "@/app/lib/engine/civicHistory";
import { applyDelta, isDelta, type FrameDelta } from "@/app/lib/engine/frameDelta";
import type { Moment } from "@/app/lib/engine/moments";
import type { CDetail } from "./live";
import { getGz, staticSources } from "./staticReplay";
import { LIVE_POLL_MS } from "./liveFeed";

export type EngineState = {
  mode: "LIVE" | "REPLAY";
  /** false until the server answers; false for good when the engine is switched off (pages then use their own reads) */
  available: boolean; checked: boolean;
  sources: SourceInfo[];
  source: string; info: SourceInfo | null;
  clock: Clock | null; timesMs: number[];
  view: View | null; frame: number;
  /** browser time the live view arrived, for staleness */
  receivedMs: number;
  national: NationalPoint[];
  /** key moments of a recorded night (static packs), and the span of it on the scrubber */
  moments: Moment[]; windows: ReplayWindow[]; window: string | null;
  /** what the visitor is looking at, so the moments list can offer "this race" and "this state" */
  focus: { raceId: string | null; st: string | null };
  error: string | null; loading: boolean;
};
const KEY = "onp-engine-v1";
const INIT: EngineState = { mode: "LIVE", available: false, checked: false, sources: [], source: "live", info: null, clock: null, timesMs: [], view: null, frame: -1, receivedMs: 0, national: [], moments: [], windows: [], window: null, focus: { raceId: null, st: null }, error: null, loading: false };
let S: EngineState = INIT;
const subs = new Set<() => void>();
const emit = (patch: Partial<EngineState>) => { S = { ...S, ...patch }; if (typeof window !== "undefined") { const w = window as { __onpReplay?: boolean; __onpReplayCounty?: (id: number) => Promise<CDetail | null> }; w.__onpReplay = S.mode === "REPLAY"; w.__onpReplayCounty = replayCounty; } subs.forEach((f) => f()); };
const cache = new Map<string, View>();
let started = false, liveTimer: number | null = null, raf: number | null = null, inflight: string | null = null, wanted: string | null = null, lastEmit = 0;
// the clock is anchored to wall time: replay time = anchor time + (now - anchor wall) x speed. A slow frame never loses
// election time; seeking, pausing or changing speed sets a new anchor.
let anchor: { wall: number; t: number; speed: number } | null = null;
const reanchor = () => { anchor = S.clock?.playing ? { wall: performance.now(), t: S.clock.tMs, speed: S.clock.speed } : null; };

async function getJson<T>(url: string): Promise<{ ok: true; body: T } | { ok: false; status: number; error: string }> {
  try { const r = await fetch(url); const j = await r.json(); return r.ok ? { ok: true, body: j as T } : { ok: false, status: r.status, error: (j as { error?: string }).error ?? `HTTP ${r.status}` }; }
  catch (e) { return { ok: false, status: 0, error: (e as Error).message }; }
}
const persist = () => { try { sessionStorage.setItem(KEY, JSON.stringify({ mode: S.mode, source: S.source, t: S.clock?.tMs ?? null, speed: S.clock?.speed ?? 60, window: S.window, playing: !!S.clock?.playing })); } catch { /* private mode */ } };
// static packs: whole-night files are read once and cut at the frame in force here, so nothing later is ever shown
const natCache = new Map<string, NationalPoint[]>(), raceCache = new Map<string, RacePoint[]>(), countyCache = new Map<string, CompactRace | null>();
async function staticNational(base: string): Promise<NationalPoint[]> { let n = natCache.get(base); if (!n) { n = (await getGz<NationalPoint[]>(`${base}/national.json.gz`)) ?? []; if (n.length) natCache.set(base, n); } return n; }
/**
 * Frame i of a static pack. The pack holds a whole state every `every` frames and, between them, what changed since
 * the frame before; a frame is rebuilt from the nearest state already in hand (or its whole frame) plus the deltas up
 * to it, fetched together. Playing forward therefore costs one small file per frame.
 */
async function staticFrame(source: string, base: string, i: number, every: number): Promise<View | null> {
  const k = (n: number) => `${source}|${new Date(S.timesMs[n]).toISOString()}`; const put = (n: number, v: View) => { cache.set(k(n), v); if (cache.size > 40) cache.delete(cache.keys().next().value as string); };
  const k0 = i - (i % Math.max(1, every)); let j = i; while (j > k0 && !cache.has(k(j))) j--;
  const files = await Promise.all(Array.from({ length: i - j + (cache.has(k(j)) ? 0 : 1) }, (_, n) => getGz<View | FrameDelta>(`${base}/f/${(cache.has(k(j)) ? j + 1 : j) + n}.json.gz`)));
  let v = cache.get(k(j)) ?? null, n = cache.has(k(j)) ? j + 1 : j;
  for (const f of files) {
    if (!f) return null;
    if (isDelta(f)) { if (!v) return null; v = applyDelta(v, f); } else v = f;
    put(n++, v);
  }
  return v;
}
/** County returns for a provider race at the frame in force (replay only). */
async function replayCounty(pid: number): Promise<CDetail | null> {
  const base = S.info?.base; if (S.mode !== "REPLAY" || !base || S.frame < 0) return null;
  const k = `${base}|${pid}`; let r = countyCache.get(k);
  if (r === undefined) { r = await getGz<CompactRace>(`${base}/county/${pid}.json.gz`); countyCache.set(k, r); if (countyCache.size > 60) countyCache.delete(countyCache.keys().next().value as string); }
  return r && S.frame >= 0 ? (detailAt(r, S.timesMs[S.frame]) as CDetail | null) : null;
}

async function loadLive() {
  const r = await getJson<{ info: SourceInfo; view: View }>("/api/results/engine?source=live");
  if (S.mode !== "LIVE") return;
  if (!r.ok) { emit({ checked: true, available: false, error: r.status === 404 ? null : r.error }); return; }
  emit({ checked: true, available: true, view: r.body.view, info: r.body.info, error: null, receivedMs: Date.now() });
  const h = await getJson<{ points: NationalPoint[] }>("/api/results/engine/history?source=live");
  if (h.ok && S.mode === "LIVE") emit({ national: h.body.points });
}
function startLive() {
  if (liveTimer != null) window.clearInterval(liveTimer);
  void loadLive();
  liveTimer = window.setInterval(() => { if (document.visibilityState === "visible" && S.mode === "LIVE") void loadLive(); }, Math.min(LIVE_POLL_MS, 60_000));
}

/** Fetch the state for the frame in force at the clock, one request at a time; the latest wanted frame wins. */
async function syncFrame() {
  if (S.mode !== "REPLAY" || !S.clock) return;
  const i = frameIndexAt(S.timesMs, S.clock.tMs);
  if (i === S.frame && S.view) return;
  if (i < 0) { emit({ frame: -1, view: null, national: [] }); return; }
  const at = new Date(S.timesMs[i]).toISOString(); wanted = at;
  if (inflight) return;
  inflight = at;
  const key = `${S.source}|${at}`;
  let v = cache.get(key) ?? null;
  const base = S.info?.base ?? null; let nat: NationalPoint[] | null = null;
  if (base) {
    if (!v) { v = await staticFrame(S.source, base, i, S.info?.keyEvery ?? 1); if (!v) emit({ error: "This frame of the replay could not be read." }); }
    nat = (await staticNational(base)).slice(0, i + 1);
  } else {
    if (!v) { const r = await getJson<{ view: View }>(`/api/results/engine?source=${encodeURIComponent(S.source)}&at=${encodeURIComponent(at)}`); if (r.ok) { v = r.body.view; cache.set(key, v); if (cache.size > 40) cache.delete(cache.keys().next().value as string); } else emit({ error: r.error }); }
    const h = await getJson<{ points: NationalPoint[] }>(`/api/results/engine/history?source=${encodeURIComponent(S.source)}&at=${encodeURIComponent(at)}`); nat = h.ok ? h.body.points : null;
  }
  inflight = null;
  if (S.mode === "REPLAY" && v) emit({ view: v, frame: i, national: nat ?? S.national, loading: false, error: null });
  if (wanted !== at) void syncFrame();
}
function loop(ts: number) {
  raf = null;
  if (S.mode !== "REPLAY" || !S.clock?.playing) return;
  if (!anchor || anchor.speed !== S.clock.speed) reanchor();
  const c = tick({ ...S.clock, tMs: anchor!.t }, performance.now() - anchor!.wall);
  S = { ...S, clock: c };
  if (ts - lastEmit > 100 || !c.playing) { lastEmit = ts; emit({}); persist(); }
  void syncFrame();
  if (c.playing) raf = window.requestAnimationFrame(loop);
}
const run = () => { reanchor(); if (raf == null) raf = window.requestAnimationFrame(loop); };

export const engine = {
  async start() {
    if (started || typeof window === "undefined") return; started = true;
    const q = new URLSearchParams(window.location.search);
    let saved: { mode?: string; source?: string; t?: number | null; speed?: number; window?: string | null; playing?: boolean } = {};
    try { saved = JSON.parse(sessionStorage.getItem(KEY) ?? "{}"); } catch { saved = {}; }
    const [src, stat] = await Promise.all([getJson<{ sources: SourceInfo[] }>("/api/results/engine/sources"), staticSources()]);
    // a static pack and a server archive of the same night are one source: the static pack is read
    const all = [...stat, ...(src.ok ? src.body.sources : []).filter((s) => !stat.some((x) => x.id === s.id))];
    emit({ sources: all });
    const want = q.get("replay") ?? (saved.mode === "REPLAY" ? saved.source : null);
    const at = q.get("at") ? Date.parse(q.get("at") as string) : saved.t ?? null;
    if (want && all.some((s) => s.id === want)) {
      await engine.enterReplay(want, Number.isFinite(at as number) ? (at as number) : undefined, saved.speed, q.get("at") ? undefined : saved.window ?? undefined);
      // a replay that was playing when the page was left goes on playing on the next page, at the same pace
      if (saved.playing && !q.get("at") && saved.mode === "REPLAY") engine.play();
    } else startLive();
  },
  async enterReplay(sourceId: string, atMs?: number, speed?: number, windowId?: string) {
    const info = S.sources.find((s) => s.id === sourceId); if (!info || !info.times.length) return;
    if (liveTimer != null) { window.clearInterval(liveTimer); liveTimer = null; }
    const timesMs = info.times.map((t) => Date.parse(t));
    // the window opens a little before the first observation (polls closing) and ends at the last; a pack with
    // windows opens on election night, or on the whole count when the requested moment falls outside the night
    const wins = info.windows ?? []; const span = (w: ReplayWindow) => [Date.parse(w.from), Date.parse(w.to)] as const;
    let win = wins.find((w) => w.id === windowId) ?? wins[0] ?? null;
    if (win && atMs != null && (atMs < span(win)[0] || atMs > span(win)[1])) win = wins.find((w) => atMs >= span(w)[0] && atMs <= span(w)[1]) ?? wins[wins.length - 1];
    const start = win ? span(win)[0] : Math.min(timesMs[0], Date.parse("2026-11-03T23:00:00Z")), end = win ? Math.min(span(win)[1], Math.max(timesMs[timesMs.length - 1], span(win)[0])) : timesMs[timesMs.length - 1];
    let clock = newClock(start, end, atMs ?? start); if (speed) clock = speedC(clock, speed);
    emit({ mode: "REPLAY", available: true, checked: true, source: sourceId, info, timesMs, clock, view: null, frame: -2, national: [], moments: [], windows: wins, window: win?.id ?? null, error: null, loading: true });
    persist();
    if (info.base) void getGz<Moment[]>(`${info.base}/moments.json.gz`).then((m) => { if (S.mode === "REPLAY" && S.source === sourceId) emit({ moments: m ?? [] }); });
    await syncFrame();
  },
  /** Show another span of the same night on the scrubber; the moment in view is kept when it falls inside it. */
  setWindow(id: string) {
    const w = S.windows.find((x) => x.id === id); if (!w || !S.clock) return;
    const start = Date.parse(w.from), end = Math.min(Date.parse(w.to), Math.max(S.timesMs[S.timesMs.length - 1] ?? 0, start));
    const c = { ...S.clock, startMs: start, endMs: end, tMs: Math.min(end, Math.max(start, S.clock.tMs)), playing: false };
    emit({ clock: c, window: id }); anchor = null; persist(); void syncFrame();
  },
  /** Jump to a moment, widening the span when the moment lies outside it. Pauses. */
  jump(tMs: number) {
    if (!S.clock) return;
    if (tMs < S.clock.startMs || tMs > S.clock.endMs) { const w = S.windows.find((x) => tMs >= Date.parse(x.from) && tMs <= Date.parse(x.to)); if (w) engine.setWindow(w.id); }
    if (S.clock) { emit({ clock: { ...seekC(S.clock, tMs), playing: false } }); anchor = null; persist(); void syncFrame(); }
  },
  focus(raceId: string | null, st: string | null) { if (S.focus.raceId !== raceId || S.focus.st !== st) emit({ focus: { raceId, st } }); },
  exitReplay() {
    if (raf != null) { window.cancelAnimationFrame(raf); raf = null; }
    emit({ ...INIT, sources: S.sources, focus: S.focus, checked: false }); persist(); startLive();
  },
  play() { if (S.clock) { emit({ clock: playC(S.clock) }); run(); persist(); } },
  pause() { if (S.clock) { emit({ clock: pauseC(S.clock) }); anchor = null; persist(); } },
  seek(tMs: number) { if (S.clock) { emit({ clock: seekC(S.clock, tMs) }); reanchor(); persist(); void syncFrame(); } },
  step(dir: 1 | -1) { if (S.clock) { emit({ clock: stepC(S.clock, S.timesMs, dir) }); reanchor(); persist(); void syncFrame(); } },
  speed(x: number) { if (S.clock) { emit({ clock: speedC(S.clock, x) }); reanchor(); persist(); } },
  get: () => S,
};

const subscribe = (f: () => void) => { subs.add(f); void engine.start(); return () => { subs.delete(f); }; };
export const useEngine = () => useSyncExternalStore(subscribe, () => S, () => INIT);

/** One race's chart history at the current moment (cut at the replay frame on the server). */
export function useRaceHistory(raceId: string | null): RacePoint[] {
  const e = useEngine(); const [pts, setPts] = useState<RacePoint[]>([]);
  const at = e.mode === "REPLAY" && e.frame >= 0 ? new Date(e.timesMs[e.frame]).toISOString() : null;
  const src = e.mode === "REPLAY" ? e.source : "live", ready = e.available && !!raceId && (e.mode === "LIVE" || at != null), key = e.view?.stateId;
  const base = e.mode === "REPLAY" ? e.info?.base ?? null : null;
  useEffect(() => {
    if (!ready || !raceId) return; let dead = false;
    if (base && at) {
      // a static pack: the race's whole history is read once; only points at or before the frame are kept, and the
      // last value is carried to the frame's time so a held figure draws as held
      const k = `${base}|${raceId}`, cut = (all: RacePoint[]) => { const p = all.filter((x) => x.t <= at); if (p.length && p[p.length - 1].t < at) p.push({ ...p[p.length - 1], t: at }); return p; };
      const have = raceCache.get(k);
      void (have ? Promise.resolve(have) : getGz<RacePoint[]>(`${base}/race/${encodeURIComponent(raceId)}.json.gz`).then((r) => { const all = r ?? []; raceCache.set(k, all); if (raceCache.size > 80) raceCache.delete(raceCache.keys().next().value as string); return all; }))
        .then((all) => { if (!dead) setPts(cut(all)); });
      return () => { dead = true; };
    }
    void getJson<{ points: RacePoint[] }>(`/api/results/engine/history?source=${encodeURIComponent(src)}&race=${encodeURIComponent(raceId)}${at ? `&at=${encodeURIComponent(at)}` : ""}`).then((r) => { if (!dead) setPts(r.ok ? r.body.points : []); });
    return () => { dead = true; };
  }, [ready, raceId, src, at, key, base]);
  return ready ? pts : [];
}

/** True when the pages are showing a replay rather than the live election. */
export const replayActive = () => S.mode === "REPLAY";
export const engineView = () => S.view;
