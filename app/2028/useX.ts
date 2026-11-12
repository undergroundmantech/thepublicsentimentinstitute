"use client";
// Browser side data for the 2028 pages: one fetch per file, shared by every component, and the county engine, loaded
// only when someone picks a matchup the page did not ship with.
import { useEffect, useState } from "react";
import { X, fromEngine, type CountiesGeo, type Res } from "./lib";

const cache = new Map<string, Promise<unknown>>();
const done = new Map<string, unknown>();
export function getJSON<T>(url: string): Promise<T> {
  if (!cache.has(url)) cache.set(url, fetch(url).then((r) => (r.ok ? r.json() : Promise.reject(new Error(url)))).then((j) => { done.set(url, j); return j; }));
  return cache.get(url) as Promise<T>;
}
export function useJSON<T>(url: string | null): T | null {
  const [, tick] = useState(0);
  useEffect(() => {
    if (!url || done.has(url)) return;
    let live = true;
    getJSON(url).then(() => { if (live) tick((t) => t + 1); }).catch(() => undefined);
    return () => { live = false; };
  }, [url]);
  return url && done.has(url) ? (done.get(url) as T) : null;
}

type Engine = { ticket: (p: Record<string, unknown>) => Parameters<typeof fromEngine>[0] };
let ENG: Promise<Engine> | null = null;
export function getEngine(): Promise<Engine> {
  if (!ENG) ENG = Promise.all([getJSON<Record<string, { cols: string[]; rows: unknown[][] }>>(`${X}/engine.json`), getJSON<CountiesGeo>(`${X}/counties.json`), import("./engine28.js")])
    .then(([E, C, m]) => (m as unknown as { createEngine: (d: unknown, a: unknown) => Engine; expand: (e: unknown) => unknown }).createEngine((m as unknown as { expand: (e: unknown) => unknown }).expand(E), C.akct));
  return ENG;
}
export interface Ticket { dp: string; rp: string; dvp?: string; rvp?: string; tp?: string; tps?: number | null }
const memo = new Map<string, Res>();
/** runs the county engine for a ticket; null while it loads or runs. `base` is shown for the default ticket. */
export function useTicket(t: Ticket, base: Res | null, isBase: boolean): { res: Res | null; busy: boolean } {
  const key = JSON.stringify(t);
  const [res, setRes] = useState<Res | null>(isBase ? base : memo.get(key) ?? null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isBase) { setRes(base); setBusy(false); return; }
    if (memo.has(key)) { setRes(memo.get(key)!); setBusy(false); return; }
    let live = true; setBusy(true);
    getEngine().then((e) => new Promise<Res>((ok) => setTimeout(() => ok(fromEngine(e.ticket({ ...t, tps: t.tps ?? null }))), 30)))
      .then((r) => { memo.set(key, r); if (live) { setRes(r); setBusy(false); } }).catch(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, isBase, base]);
  return { res, busy };
}
