"use client";
// Loads the expected results index once and polls civicAPI (through the caching proxy) for the race types asked for,
// every minute, matching each civicAPI race to its forecast race. Keeps the previous read so the monitor can show
// what changed between reads.
import { useEffect, useMemo, useRef, useState } from "react";
import { civicSearch, matchCivic, TYPE_SETS, type CRace, type XIndex } from "./live";

let INDEX: Promise<XIndex> | null = null;
export function loadIndex() { INDEX ??= fetch("/results/2026/index.json").then((r) => r.json()); return INDEX; }

export function useIndex() {
  const [ix, setIx] = useState<XIndex | null>(null);
  useEffect(() => { loadIndex().then(setIx).catch(() => {}); }, []);
  return ix;
}

export type LiveState = { at: Date | null; byId: Record<string, CRace>; prev: Record<string, CRace>; raw: CRace[]; error: string | null; loading: boolean };

export function useLive(ix: XIndex | null, sets: (keyof typeof TYPE_SETS)[], everyMs = 60_000): LiveState {
  const [st, setSt] = useState<LiveState>({ at: null, byId: {}, prev: {}, raw: [], error: null, loading: true });
  const key = sets.join(",");
  const last = useRef<Record<string, CRace>>({});
  useEffect(() => {
    if (!ix) return;
    let dead = false; const ac = new AbortController();
    const types = [...new Set(sets.flatMap((s) => TYPE_SETS[s]))];
    const tick = async () => {
      const got: CRace[] = []; let err: string | null = null;
      for (const t of types) {             // one type at a time, so the proxy never bursts civicAPI
        try { got.push(...(await civicSearch(t, ac.signal))); } catch (e) { if ((e as Error).name === "AbortError") return; err = "Live returns are not reachable right now; showing the forecast."; }
      }
      if (dead) return;
      const byId = matchCivic(ix.races, got);
      setSt({ at: new Date(), byId, prev: last.current, raw: got, error: got.length ? null : err, loading: false });
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
