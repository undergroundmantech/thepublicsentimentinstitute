"use client";
// Browser side data for the 2028 pages: one fetch per file, shared by every component, and the county engine, loaded
// only when someone picks a matchup the page did not ship with.
import { useEffect, useState } from "react";
import { X, fromEngine, type CountiesGeo, type PrimField, type Res } from "./lib";

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

type PrimOut = { party: "D" | "R"; names: string[]; nom: Record<string, number>; votes: Record<string, number>; colors: Record<string, string>; csh: Float64Array; cvotes: Float64Array;
  states: Record<string, { share: Record<string, number>; win: Record<string, number>; total: number; window: number; region?: string }> };
type Engine = { ticket: (p: Record<string, unknown>) => Parameters<typeof fromEngine>[0]; prim: (p: Record<string, unknown>) => PrimOut; rows: (id: string) => Record<string, string | number>[] };
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

/** The official primary run for a field the reader picked, with each state's counties fitted to add up exactly to it */
export function primField(r: PrimOut, pm: Record<string, string | number>[]): PrimField {
  const names = r.names, K = names.length, OTH = r.party === "D" ? 0.11 : 0.09; const V = r.cvotes, C = r.csh;
  const by: Record<string, number[]> = {}; pm.forEach((x, i) => { (by[String(x.st)] ||= []).push(i); });
  const states: PrimField["states"] = {}, counties: PrimField["counties"] = {};
  for (const [st, idx] of Object.entries(by)) {
    const S = r.states[st]; if (!S) continue; const t = names.map((n) => S.share[n] / (1 - OTH));
    const x = idx.map((i) => { const row = names.map((_, j) => (t[j] > 0 ? C[i * K + j] : 0)); const z = row.reduce((a, b) => a + b, 0) || 1; return row.map((v) => v / z); });
    const vv = idx.map((i) => V[i]); const vs = vv.reduce((a, b) => a + b, 0) || 1;
    for (let it = 0; it < 200; it++) {
      const nat = names.map((_, j) => x.reduce((a, row, k) => a + row[j] * vv[k], 0) / vs); let mx = 0;
      for (const row of x) { for (let j = 0; j < K; j++) row[j] *= nat[j] > 1e-12 ? t[j] / nat[j] : 0; const z = row.reduce((a, b) => a + b, 0) || 1; for (let j = 0; j < K; j++) row[j] /= z; }
      for (let j = 0; j < K; j++) mx = Math.max(mx, Math.abs(nat[j] - t[j])); if (mx < 1e-7) break;
    }
    const sv = new Array(K).fill(0); let oth = 0;
    idx.forEach((i, k) => {
      const cv = x[k].map((s) => s * vv[k] * (1 - OTH)); const keep = cv.map((v, j) => [j, v] as [number, number]).filter((q) => q[1] >= 0.5).sort((a, b) => b[1] - a[1]);
      const rest = cv.reduce((a, b) => a + b, 0) - keep.reduce((a, q) => a + q[1], 0);
      const row: (number | [number, number])[] = [Math.round(vv[k] * OTH + rest), ...keep.map(([j, v]) => [j, Math.round(v)] as [number, number])];
      counties[String(pm[i].fips)] = row; oth += row[0] as number; for (const [j, v] of keep) sv[j] += Math.round(v);
    });
    states[st] = { votes: sv, other: oth, total: oth + sv.reduce((a, b) => a + b, 0), win: names.map((n) => S.win[n]), window: S.window, proxy: st === "AK" ? ["MT", "WY", "ID"] : st === "CT" ? ["MA", "RI", "NJ"] : null, hist: null };
  }
  const votes = names.map((_, j) => Object.values(states).reduce((a, s) => a + s.votes[j], 0));
  return { party: r.party, names, colors: names.map((n) => r.colors[n] ?? "#8f8a99"), nomination: names.map((n) => r.nom[n] ?? 0), votes, other: Object.values(states).reduce((a, s) => a + s.other, 0),
    expected: names.map((n) => r.votes[n] ?? 0), calendar: null, states, counties };
}
const pmemo = new Map<string, PrimField>();
/** null while the engine loads or runs; nothing to do when the whole field is in */
export function usePrim(party: "D" | "R", out: string[]): { field: PrimField | null; busy: boolean } {
  const key = party + "|" + [...out].sort().join(",");
  const [f, setF] = useState<PrimField | null>(null); const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!out.length) { setF(null); setBusy(false); return; }
    if (pmemo.has(key)) { setF(pmemo.get(key)!); setBusy(false); return; }
    let live = true; setBusy(true);
    getEngine().then((e) => new Promise<PrimField>((ok) => setTimeout(() => ok(primField(e.prim({ pparty: party, pout: out }), e.rows("prim_model"))), 30)))
      .then((r) => { pmemo.set(key, r); if (live) { setF(r); setBusy(false); } }).catch(() => { if (live) setBusy(false); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { field: out.length ? (pmemo.get(key) ?? f) : null, busy };
}
