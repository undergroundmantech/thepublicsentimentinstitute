"use client";
// Loads the expected results index once and polls civicAPI (through the caching proxy) for the race types asked for,
// every minute, matching each civicAPI race to its forecast race. Keeps the previous read so the monitor can show
// what changed between reads.
import { useEffect, useMemo, useRef, useState } from "react";
import { beforeClose, civicRead, matchCivic, showTest, TYPE_SETS, type CRace, type XIndex } from "./live";
import { mergeReads, type GoodReads, type TypeRead } from "./liveFeed";

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

export function useLive(ix: XIndex | null, sets: (keyof typeof TYPE_SETS)[], everyMs = 300_000): LiveState {
  const [st, setSt] = useState<LiveState>({ at: null, byId: {}, prev: {}, raw: [], error: null, loading: true, hidden: 0, test: false, stale: false });
  const key = sets.join(",");
  const last = useRef<Record<string, CRace>>({});
  const good = useRef<GoodReads>({});
  useEffect(() => {
    if (!ix) return;
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
      const byId = matchCivic(ix.races, clean);
      setSt({ at: m.oldest != null ? new Date(m.oldest) : null, byId, prev: last.current, raw: clean, error: m.warning, loading: false, hidden, test, stale: m.stale || m.failed.length > 0 });
      last.current = byId;
    };
    tick();
    const t = window.setInterval(() => { if (document.visibilityState === "visible") tick(); }, everyMs);
    return () => { dead = true; ac.abort(); window.clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ix, key, everyMs]);
  return st;
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
