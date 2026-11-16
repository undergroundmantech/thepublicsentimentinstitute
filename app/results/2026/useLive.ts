"use client";
// Loads the expected results index once and polls civicAPI (through the caching proxy) for the race types asked for,
// every LIVE_POLL_MS, matching each civicAPI race to its forecast race. Keeps the previous read so the monitor can show
// what changed between reads.
import { useEffect, useMemo, useRef, useState } from "react";
import { beforeClose, civicRead, matchCivic, showTest, TYPE_SETS, type CRace, type XIndex } from "./live";
import { LIVE_POLL_MS, STALE_MS, mergeReads, type GoodReads, type TypeRead } from "./liveFeed";
import { useEngine } from "./engineClient";
import type { View } from "@/app/lib/engine/serve";
import { applyCalls, callsFromLedger, callsFromRecorded, withoutProviderCall, type CallBook, type RecordedCalls } from "./onpointCalls";

/**
 * The engine's state as the pages' LiveState: the same snapshot the forecasts were computed from, so the reported
 * votes and every model number on a page belong to one moment. In a replay this is how every existing component
 * (maps, seat arcs, race lists, the monitor) follows the replay clock with no code of its own.
 */
// one derived LiveState per engine state, and the previous one kept so the monitor can show what changed
const derived = new Map<string, LiveState>(); let lastDerived: string | null = null;
function derive(ix: XIndex, v: View, nowMs: number, rec: CallBook | null): LiveState {
  const k = `${v.stateId}|${rec ? 1 : 0}`, hit = derived.get(k); if (hit) return hit;
  const s = liveFromView(ix, v, lastDerived ? derived.get(lastDerived)?.byId ?? {} : {}, nowMs, rec);
  derived.set(k, s); lastDerived = k; if (derived.size > 8) derived.delete(derived.keys().next().value as string);
  return s;
}
/**
 * Winner flags are On Point's own calls and nothing else: the ledger's model calls. `recorded` (the calls the engine
 * made on the recorded night) fills in for a live view only, where an engine computed on request keeps no ledger;
 * it is never used in a replay, which must not know its own future.
 */
export function liveFromView(ix: XIndex, v: View, prev: Record<string, CRace>, now: number, recorded: CallBook | null = null): LiveState {
  const byId: Record<string, CRace> = {};
  const book = callsFromLedger(v.ledger.races);
  for (const r of ix.races) {
    const row = v.races[r.id]; if (!row || row.dataState === "MISSING") continue;
    const tot = row.c.reduce((s, c) => s + (c[3] ?? 0), 0);
    const call = book[r.id], rec = !call && v.live ? recorded?.[r.id] : undefined;
    byId[r.id] = { id: typeof row.pid === "number" ? row.pid : -1, type: r.civ.t?.[0] ?? "", province: r.st, district: r.civ.d ?? null, name: r.nm, pr: row.providerPct ?? 0,
      c: row.c.map(([id, name, party, rep]) => [name, party ?? "", rep ?? 0, tot ? Math.round((10000 * (rep ?? 0)) / tot) / 100 : 0, (call ? call.id === id : rec ? rec.name === name : false) ? 1 : 0, null]) };
  }
  const at = new Date(v.t);
  return { at, byId, prev, raw: Object.values(byId), error: v.live && now - at.getTime() > STALE_MS ? "The live forecast has not updated recently; figures may be behind." : null, loading: false, hidden: 0, test: false, stale: v.live && now - at.getTime() > STALE_MS };
}

// The calls the engine made on the recorded night, for live pages with no ledger of their own. A small static file
// that ships inside the replay data pack: without the pack installed, a live page with no engine shows no calls.
let RECORDED: Promise<CallBook> | null = null;
export function loadRecordedCalls() { RECORDED ??= fetch("/replay/2026/onpoint-calls.json").then((r) => (r.ok ? r.json() : null)).then((f: RecordedCalls | null) => callsFromRecorded(f)).catch(() => ({})); return RECORDED; }
export function useRecordedCalls() {
  const [b, setB] = useState<CallBook | null>(null);
  useEffect(() => { loadRecordedCalls().then(setB); }, []);
  return b;
}

let INDEX: Promise<XIndex> | null = null;
export function loadIndex() { INDEX ??= fetch("/results/2026/index.json").then((r) => r.json()); return INDEX; }

export function useIndex() {
  const [ix, setIx] = useState<XIndex | null>(null);
  useEffect(() => { loadIndex().then(setIx).catch(() => {}); }, []);
  return ix;
}

// `at` is when civicAPI was last read for the oldest data on the page (the proxy's read time), a new Date every poll.
// `stale` means a read failed or that data is older than STALE_MS; `error` then says so in words.
export type LiveState = { at: Date | null; byId: Record<string, CRace>; prev: Record<string, CRace>; raw: CRace[]; error: string | null; loading: boolean; hidden: number; test: boolean; stale: boolean };

export function useLive(ix: XIndex | null, sets: (keyof typeof TYPE_SETS)[], everyMs = LIVE_POLL_MS): LiveState {
  const [st, setSt] = useState<LiveState>({ at: null, byId: {}, prev: {}, raw: [], error: null, loading: true, hidden: 0, test: false, stale: false });
  const key = sets.join(",");
  const last = useRef<Record<string, CRace>>({});
  const good = useRef<GoodReads>({});
  const eng = useEngine();
  const engineOn = eng.available && !!eng.view;
  const rec = useRecordedCalls();
  useEffect(() => {
    if (!ix || engineOn) return;   // the engine serves this page: no separate reads
    good.current = {};
    let dead = false; const ac = new AbortController();
    const types = [...new Set(sets.flatMap((s) => TYPE_SETS[s]))];
    const tick = async () => {
      const res: Record<string, TypeRead | Error> = {};
      for (const t of types) {             // one type at a time, so the proxy never bursts civicAPI
        try { res[t] = await civicRead(t, ac.signal); } catch (e) { if ((e as Error).name === "AbortError") return; res[t] = e as Error; }
      }
      if (dead) return;
      // a type that fails keeps its last good read instead of dropping its races to "no votes"
      const m = mergeReads(good.current, res, Date.now()); good.current = m.good; const got = m.races;
      // before polls close civicAPI publishes test returns; they are blanked unless the page asks for them
      let hidden = 0; const test = beforeClose();
      const clean = test && !showTest() ? got.map((c) => { const has = c.pr > 0 || c.c.some((x) => x[2] > 0 || x[4]); if (has) hidden++; return has ? { ...c, pr: 0, c: c.c.map((x) => [x[0], x[1], 0, 0, 0, null] as typeof x) } : c; }) : got;
      // civicAPI's winner flags are not shown: a race is marked called only by On Point's own call
      const book = await loadRecordedCalls(); if (dead) return;
      const plain = clean.map(withoutProviderCall);
      const byId = applyCalls(matchCivic(ix.races, plain), book);
      setSt({ at: m.oldest != null ? new Date(m.oldest) : null, byId, prev: last.current, raw: plain, error: m.warning, loading: false, hidden, test, stale: m.stale || m.failed.length > 0 });
      last.current = byId;
    };
    tick();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") tick(); }, everyMs);
    return () => { dead = true; ac.abort(); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, key, everyMs, engineOn]);
  const fromEngine = useMemo(() => (ix && engineOn && eng.view ? derive(ix, eng.view, eng.view.live ? eng.receivedMs : Date.parse(eng.view.t), rec) : null), [ix, engineOn, eng.view, eng.receivedMs, rec]);
  return fromEngine ?? st;
}

export function useStateFile(st: string | null) {
  const [f, setF] = useState<import("./live").StFile | null>(null);
  useEffect(() => { if (!st) return; setF(null); fetch(`/results/2026/st/${st}.json`).then((r) => (r.ok ? r.json() : null)).then(setF).catch(() => setF(null)); }, [st]);
  return f;
}

export function useReporting(live: LiveState) {
  return useMemo(() => {
    const v = Object.values(live.byId); const rep = v.filter((r) => r.pr > 0 || r.c.some((c) => c[2] > 0));
    return { matched: v.length, reporting: rep.length, called: v.filter((r) => r.c.some((c) => c[4])).length };
  }, [live.byId]);
}
