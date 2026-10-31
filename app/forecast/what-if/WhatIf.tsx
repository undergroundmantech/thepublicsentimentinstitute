"use client";
// What if: pick winners, or winning margins, in any Senate, governor or House race and every other race moves with
// them. It reads the model's own 2,000 joint simulations, where every race in a simulation shares the same national
// environment, regional and demographic group shocks, so a pick moves the other races by exactly as much as the
// model ties them together. A win pick keeps only the simulations where that side wins; a margin pick shifts each
// simulation to that margin and moves every other race by its simulated relationship with it.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { Pointy } from "@/app/components/home/Mascot";
import { RATE, RATING_LABEL, rating, raceHref, STATE_NAME, type Rating } from "@/app/lib/opp";
import { ev, evSettled } from "@/app/lib/ev";
import "./whatif.css";

type Race = { id: string; k: string; office: string; st: string; state: string; name: string; dem: string; gop: string; m: number; p: number; ind: boolean };
type HRace = { id: string; st: string; d: number; name: string; dem: string; gop: string; m: number; p: number };
export type Data = { meta: { updated: string; sims: number; senNotUpD: number; senNotUpR: number; govNotUpD: number; govNotUpR: number }; chambers: Record<"senate" | "governor" | "house", { demControl: number; demSeats: number }>;
  races: Race[]; dev: string; house: HRace[]; hwin: string; hbytes: number };
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string } | string> };
export type Pin = { side: "D" | "R"; by: number | null };
type Office = "senate" | "governor" | "house";

const lg = (p: number) => { const q = Math.min(0.999, Math.max(0.001, p)); return Math.log(q / (1 - q)); };
const ex = (x: number) => 1 / (1 + Math.exp(-x));
const calib = (pub: number, now: number, base: number) => ex(lg(pub) + lg(now) - lg(base));
const pc = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const fm = (m: number, ind = false) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);
function probFill(pD: number) {
  if (pD >= 0.95) return RATE.safeD; if (pD >= 0.8) return RATE.likelyD; if (pD >= 0.6) return RATE.leanD; if (pD > 0.4) return RATE.toss;
  if (pD > 0.2) return RATE.leanR; if (pD > 0.05) return RATE.likelyR; return RATE.safeR;
}
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
function solve(A: number[][], b: number[]): number[] {   // small dense system, Gaussian elimination with pivoting
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const v = M[c][c] || 1e-9;
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / v; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / (r[i] || 1e-9));
}

export type Model = { R: Race[]; H: HRace[]; N: number; dev: Float32Array[]; hw: Uint8Array; hb: number; z: Float32Array; beta: number[]; data: Data };
export function prep(d: Data): Model {
  const N = d.meta.sims, raw = Uint8Array.from(atob(d.dev), (c) => c.charCodeAt(0));
  const i16 = new Int16Array(raw.buffer);
  const dev = d.races.map((_, r) => { const a = new Float32Array(N); for (let i = 0; i < N; i++) a[i] = i16[r * N + i] / 10; return a; });
  const z = new Float32Array(N);
  for (const a of dev) for (let i = 0; i < N; i++) z[i] += a[i] / dev.length;
  let vz = 0; for (let i = 0; i < N; i++) vz += z[i] * z[i]; vz /= N;
  const beta = dev.map((a) => { let c = 0; for (let i = 0; i < N; i++) c += a[i] * z[i]; return c / N / vz; });
  const hw = Uint8Array.from(atob(d.hwin), (c) => c.charCodeAt(0));
  return { R: d.races, H: d.house, N, dev, hw, hb: d.hbytes, z, beta, data: d };
}
const hbit = (M: Model, j: number, i: number) => (M.hw[j * M.hb + (i >> 3)] >> (7 - (i & 7))) & 1;

type Out = { m: number[]; p: number[]; hp: number[]; ch: Record<Office, { now: number; seats: number; base: number }>; n: number; mode: "filter" | "shift" | "none"; note: string | null };

export function compute(M: Model, pins: Record<string, Pin>, swing: number): Out {
  const { R, N, dev } = M;
  const idx: Record<string, number> = {}; R.forEach((r, i) => { idx[r.id] = i; });
  const X = R.map((r, k) => { const a = new Float32Array(N); const sh = -swing * M.beta[k]; for (let i = 0; i < N; i++) a[i] = r.m + dev[k][i] + sh; return a; });
  const base = R.map((r, k) => { let c = 0; for (let i = 0; i < N; i++) if (r.m + dev[k][i] < 0) c++; return c / N; });
  const shiftTo = (S: number[], t: number[]) => {
    if (!S.length) return;
    const C = S.map((a) => S.map((b) => { let c = 0; for (let i = 0; i < N; i++) c += dev[a][i] * dev[b][i]; return c / N + (a === b ? 1e-6 : 0); }));
    const resid = S.map((s, j) => { const r = new Float32Array(N); for (let i = 0; i < N; i++) r[i] = t[j] - X[s][i]; return r; });
    for (let k = 0; k < R.length; k++) {
      const ck = S.map((s) => { let c = 0; for (let i = 0; i < N; i++) c += dev[k][i] * dev[s][i]; return c / N; });
      const B = solve(C, ck);
      for (let i = 0; i < N; i++) { let d = 0; for (let j = 0; j < S.length; j++) d += B[j] * resid[j][i]; X[k][i] += d; }
    }
  };
  const statePins = Object.entries(pins).filter(([id]) => idx[id] != null);
  const housePins = Object.entries(pins).filter(([id]) => idx[id] == null);
  const mS = statePins.filter(([, p]) => p.by != null).map(([id, p]) => ({ s: idx[id], t: p.side === "D" ? -(p.by as number) : (p.by as number) }));
  shiftTo(mS.map((x) => x.s), mS.map((x) => x.t));
  const wS = statePins.filter(([, p]) => p.by == null).map(([id, p]) => ({ s: idx[id], side: p.side }));
  const hIdx: Record<string, number> = {}; M.H.forEach((h, j) => { hIdx[h.id] = j; });
  const wH = housePins.map(([id, p]) => ({ j: hIdx[id], side: p.side })).filter((x) => x.j != null);
  let w = new Float32Array(N).fill(1), n = N, note: string | null = null;
  let mode: Out["mode"] = mS.length || swing ? "shift" : "none";
  const filt = () => { const f = new Float32Array(N); let c = 0; for (let i = 0; i < N; i++) {
    let ok = true;
    for (const x of wS) { const v = X[x.s][i]; if ((x.side === "D") !== (v < 0)) { ok = false; break; } }
    if (ok) for (const h of wH) { if ((hbit(M, h.j, i) === 1) !== (h.side === "D")) { ok = false; break; } }
    if (ok) { f[i] = 1; c++; }
  } return { f, c }; };
  if (wS.length || wH.length) {
    const { f, c } = filt();
    if (c >= 120 || (!wS.length && c >= 25)) { w = f; n = c; mode = "filter"; }
    else {
      // too few simulations match every pick at once: hold each statewide pick at that side's typical winning margin instead
      const t = wS.map((x) => { let s = 0, c2 = 0; for (let i = 0; i < N; i++) { const v = X[x.s][i]; if ((x.side === "D") === (v < 0)) { s += v; c2++; } } return c2 >= 20 ? s / c2 : x.side === "D" ? -1.5 : 1.5; });
      shiftTo(wS.map((x) => x.s), t); mode = "shift";
      if (wH.length) { const g = filt(); if (g.c >= 25) { w = g.f; n = g.c; } else note = "Too few simulations have every House pick at once, so the House picks are left out."; }
      note = note ?? "So few simulations had every pick at once that each statewide pick is held at that side's typical winning margin.";
    }
  }
  let W = 0; for (let i = 0; i < N; i++) W += w[i];
  const mOut: number[] = [], pOut: number[] = [];
  R.forEach((r, k) => {
    let s = 0, c = 0; for (let i = 0; i < N; i++) { if (!w[i]) continue; s += w[i] * X[k][i]; if (X[k][i] < 0) c += w[i]; }
    const mean = s / W, pd = c / W;
    let s0 = 0; for (let i = 0; i < N; i++) s0 += r.m + dev[k][i]; s0 /= N;
    mOut.push(r.m + (mean - s0)); pOut.push(pins[r.id] && pins[r.id].by == null ? (pins[r.id].side === "D" ? 1 : 0) : calib(r.p, pd, base[k]));
  });
  // chambers from the same simulations
  const meta = M.data.meta, sen: number[] = [], gov: number[] = [];
  R.forEach((r, k) => (r.office === "senate" ? sen : gov).push(k));
  const seat = (ks: number[], nu: number, maj: number, useX: boolean) => { let ctl = 0, sum = 0, W2 = 0; for (let i = 0; i < N; i++) { const ww = useX ? w[i] : 1; if (!ww) continue; let d = nu; for (const k of ks) if ((useX ? X[k][i] : R[k].m + dev[k][i]) < 0) d++; W2 += ww; sum += ww * d; if (d >= maj) ctl += ww; } return { ctl: ctl / W2, seats: sum / W2 }; };
  const sB = seat(sen, meta.senNotUpD, 51, false), sN = seat(sen, meta.senNotUpD, 51, true);
  const gB = seat(gov, meta.govNotUpD, 26, false), gN = seat(gov, meta.govNotUpD, 26, true);
  // House: the same simulation weights, tilted so the national environment matches the statewide picks
  let zc = 0; for (let i = 0; i < N; i++) { if (!w[i]) continue; let a = 0; for (let k = 0; k < R.length; k++) a += X[k][i] - R[k].m; zc += w[i] * (a / R.length); } zc /= W;
  let zw = 0; for (let i = 0; i < N; i++) zw += w[i] * M.z[i]; zw /= W;
  let lo = -4, hi = 4, lam = 0;
  const tilt = (l: number) => { let a = 0, b = 0; for (let i = 0; i < N; i++) { if (!w[i]) continue; const u = w[i] * Math.exp(l * M.z[i]); a += u * M.z[i]; b += u; } return a / b; };
  if (Math.abs(zc - zw) > 0.02) { for (let it = 0; it < 40; it++) { lam = (lo + hi) / 2; if (tilt(lam) < zc) lo = lam; else hi = lam; } }
  const u = new Float32Array(N); let U = 0; for (let i = 0; i < N; i++) { u[i] = w[i] ? w[i] * Math.exp(lam * M.z[i]) : 0; U += u[i]; }
  const hp: number[] = [], hseat = new Float32Array(N);
  M.H.forEach((h, j) => {
    let c = 0, c0 = 0; for (let i = 0; i < N; i++) { const b = hbit(M, j, i); if (b) { c += u[i]; c0++; hseat[i] += 1; } }
    const pin = pins[h.id];
    hp.push(pin ? (pin.side === "D" ? 1 : 0) : calib(h.p, c / U, c0 / N));
  });
  let hc = 0, hc0 = 0, hs = 0; for (let i = 0; i < N; i++) { if (hseat[i] >= 218) { hc += u[i]; hc0++; } hs += u[i] * hseat[i]; }
  let hs0 = 0; for (let i = 0; i < N; i++) hs0 += hseat[i]; hs0 /= N;
  const C = M.data.chambers;
  return { m: mOut, p: pOut, hp, n, mode, note, ch: {
    senate: { now: calib(C.senate.demControl, sN.ctl, sB.ctl), seats: C.senate.demSeats + (sN.seats - sB.seats), base: C.senate.demControl },
    governor: { now: calib(C.governor.demControl, gN.ctl, gB.ctl), seats: C.governor.demSeats + (gN.seats - gB.seats), base: C.governor.demControl },
    house: { now: calib(C.house.demControl, hc / U, hc0 / N), seats: C.house.demSeats + (hs / U - hs0), base: C.house.demControl } } };
}

const PRESETS: { label: string; pins: Record<string, Pin>; swing?: number }[] = [
  { label: "Turek wins Iowa by 10", pins: { "sen-IA": { side: "D", by: 10 } } },
  { label: "Paxton holds Texas", pins: { "sen-TX": { side: "R", by: null } } },
  { label: "Democrats sweep the toss ups", pins: { "sen-IA": { side: "D", by: null }, "sen-KS": { side: "D", by: null }, "sen-SC": { side: "D", by: null }, "sen-AK": { side: "D", by: null } } },
  { label: "Republicans hold the Senate map", pins: { "sen-TX": { side: "R", by: null }, "sen-IA": { side: "R", by: null }, "sen-ME": { side: "R", by: null }, "sen-OH": { side: "R", by: null } } },
  { label: "A 3 point Republican wave", pins: {}, swing: -3 },
  { label: "A 3 point Democratic wave", pins: {}, swing: 3 },
];

function encode(pins: Record<string, Pin>, swing: number) {
  const p = Object.entries(pins).map(([id, x]) => `${id}:${x.side}${x.by != null ? x.by : ""}`).join(",");
  return [p ? `p=${encodeURIComponent(p)}` : "", swing ? `s=${swing}` : ""].filter(Boolean).join("&");
}

// keep a tooltip on screen: open it to the left of the pointer near the right edge, and above it near the bottom
const tipFlip = (t: { x: number; y: number; w?: number; h?: number }): React.CSSProperties => ({ transform: `translate(${t.w && t.x > t.w - 290 ? "calc(-100% - 16px)" : "16px"}, ${t.h && t.y > t.h - 230 ? "calc(-100% - 12px)" : "12px"})` });

export default function WhatIf() {
  const [M, setM] = useState<Model | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("senate");
  const [pins, setPins] = useState<Record<string, Pin>>({});
  const [swing, setSwing] = useState(0);
  const [tip, setTip] = useState<{ k: string; x: number; y: number; w?: number; h?: number } | null>(null);
  const [tab, setTab] = useState<"moved" | "flips" | "all">("moved");
  useEffect(() => {
    fetch("/forecast/whatif.json").then((r) => r.json()).then((d: Data) => setM(prep(d))).catch(() => {});
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
    try {
      const q = new URLSearchParams(window.location.search), p = q.get("p"), s = q.get("s");
      if (p) { const o: Record<string, Pin> = {}; for (const t of p.split(",")) { const mm = /^(.+):([DR])(\d+(?:\.\d+)?)?$/.exec(t); if (mm) o[mm[1]] = { side: mm[2] as "D" | "R", by: mm[3] ? +mm[3] : null }; } setPins(o); }
      if (s) setSwing(Math.max(-10, Math.min(10, +s || 0)));
    } catch { /* no window */ }
  }, []);
  useEffect(() => { try { const q = encode(pins, swing); window.history.replaceState(null, "", `/what-if${q ? `?${q}` : ""}`); } catch { /* history unavailable */ } }, [pins, swing]);

  const out = useMemo(() => (M ? compute(M, pins, swing) : null), [M, pins, swing]);
  const byId = useMemo(() => { const o: Record<string, number> = {}; M?.R.forEach((r, i) => { o[r.id] = i; }); return o; }, [M]);
  const hById = useMemo(() => { const o: Record<string, number> = {}; M?.H.forEach((h, i) => { o[h.id] = i; }); return o; }, [M]);

  const cycle = (id: string, ind = false) => (ev("What if race called", { race: id, how: "map" }), setPins((o) => {
    const c = o[id], n = { ...o };
    if (!c) n[id] = { side: "D", by: null }; else if (c.side === "D") n[id] = { side: "R", by: null }; else delete n[id];
    void ind; return n;
  }));
  const setBy = (id: string, by: number | null) => (evSettled(`by${id}`, "What if margin set", { race: id, by: by ?? "any" }), setPins((o) => (o[id] ? { ...o, [id]: { ...o[id], by } } : o)));
  const raceOfState = (st: string) => M?.R.findIndex((r) => r.st === st && r.office === office) ?? -1;

  const shapes = useMemo(() => {
    if (!geo) return [] as { key: string; d: string; x: number }[];
    if (office === "house") return Object.entries(geo.districts).map(([id, v]) => { const d = typeof v === "string" ? v : v.d; return { key: id, d, x: bboxOf(d)[0] }; });
    return Object.entries(geo.states).map(([st, d]) => ({ key: st, d, x: bboxOf(d)[0] }));
  }, [geo, office]);
  const labels = useMemo(() => (geo && office !== "house" ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d), lb = geo.labels?.[st]; return { st, x: lb ? lb[0] : (b[0] + b[2]) / 2, y: lb ? lb[1] : (b[1] + b[3]) / 2, w: lb ? lb[2] : b[2] - b[0] }; }).filter((l) => l.w > 36) : []), [geo, office]);
  const [W, H] = geo?.frame ?? [975, 610];

  if (!M || !out) return <div className="wif"><div className="wif-load sx-skel" /></div>;
  const keyOf = (s: { key: string }) => (office === "house" ? s.key : (() => { const k = raceOfState(s.key); return k >= 0 ? M.R[k].id : null; })());
  const fillOf = (id: string | null): string | null => {
    if (!id) return null;
    if (office === "house") { const j = hById[id]; return j == null ? null : probFill(out.hp[j]); }
    const k = byId[id]; if (k == null) return null;
    const r = M.R[k], m = out.m[k];
    return RATE[rating(m, r.ind)];
  };
  const pinList = Object.entries(pins);
  const raceName = (id: string) => (byId[id] != null ? M.R[byId[id]].name : hById[id] != null ? M.H[hById[id]].name : id);
  const sideName = (id: string, side: "D" | "R") => {
    const r = byId[id] != null ? M.R[byId[id]] : M.H[hById[id]];
    if (!r) return side;
    return last(side === "D" ? r.dem : r.gop);
  };
  const isInd = (id: string) => byId[id] != null && M.R[byId[id]].ind;

  // the movement table
  type Row = { id: string; name: string; office: string; before: number; after: number; pb: number; pa: number; mb: number | null; ma: number | null; ind: boolean; href: string; pinned: boolean };
  const rows: Row[] = [
    ...M.R.map((r, k) => ({ id: r.id, name: r.name, office: r.office, before: 1 - 0, after: 0, pb: r.p, pa: out.p[k], mb: r.m, ma: out.m[k], ind: r.ind, href: raceHref(r.id), pinned: !!pins[r.id] })),
    ...M.H.map((h, j) => ({ id: h.id, name: h.name, office: "house", before: 0, after: 0, pb: h.p, pa: out.hp[j], mb: h.m, ma: null, ind: false, href: raceHref(h.id), pinned: !!pins[h.id] })),
  ];
  const flips = rows.filter((r) => !r.pinned && (r.pb >= 0.5) !== (r.pa >= 0.5));
  const shown = (tab === "flips" ? flips : tab === "all" ? rows : rows.filter((r) => !r.pinned)).filter((r) => tab === "all" ? true : Math.abs(r.pa - r.pb) >= 0.01)
    .sort((a, b) => Math.abs(b.pa - b.pb) - Math.abs(a.pa - a.pb)).slice(0, tab === "all" ? 600 : 40);
  const tipRow = tip ? (office === "house" ? (hById[tip.k] != null ? { name: M.H[hById[tip.k]].name, d: M.H[hById[tip.k]].dem, r: M.H[hById[tip.k]].gop, pb: M.H[hById[tip.k]].p, pa: out.hp[hById[tip.k]], m: null as number | null, ind: false } : null)
    : (byId[tip.k] != null ? { name: M.R[byId[tip.k]].name, d: M.R[byId[tip.k]].dem, r: M.R[byId[tip.k]].gop, pb: M.R[byId[tip.k]].p, pa: out.p[byId[tip.k]], m: out.m[byId[tip.k]], ind: M.R[byId[tip.k]].ind } : null)) : null;
  const closest = M.R.map((r, k) => ({ r, k })).filter(({ r }) => r.office === (office === "house" ? "senate" : office)).sort((a, b) => Math.abs(a.r.p - 0.5) - Math.abs(b.r.p - 0.5)).slice(0, 10);

  const Ch = ({ k, label, of }: { k: Office; label: string; of: string }) => {
    const c = out.ch[k], d = c.now - c.base;
    return (
      <div className={`wif-ch ${c.now >= 0.5 ? "d" : "r"}`}>
        <span className="lb">{label}</span>
        <b>{pc(c.now >= 0.5 ? c.now : 1 - c.now)} <small>{c.now >= 0.5 ? "D control" : "R control"}</small></b>
        <span className={`dl ${Math.abs(d) < 0.005 ? "" : d > 0 ? "up" : "dn"}`}>{Math.abs(d) < 0.005 ? "No change from the forecast" : `${d > 0 ? "+" : "-"}${Math.abs(d * 100).toFixed(0)} pts for Democrats, from ${pc(c.base)}`}</span>
        <span className="sb">{c.seats.toFixed(1)} D {of} on average</span>
        <i className="bar"><s style={{ width: `${c.now * 100}%` }} /><em style={{ left: `${c.base * 100}%` }} /></i>
      </div>
    );
  };

  return (
    <section className="wif" aria-labelledby="wif-h">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>What if</span></nav>
      <header className="wif-head">
        <Pointy className="cam-hero cam-top pty-side" size={96} pose={Object.keys(pins).length ? "cheer" : "think"} prop={Object.keys(pins).length ? "flag" : "ballot"} look={-1} flip say={Object.keys(pins).length ? <>Every other race just moved with your picks.</> : <>Pick a winner anywhere and watch the rest follow.</>} />
        <div>
          <div className="eye g">Scenario builder · {M.N.toLocaleString()} joint simulations</div>
          <h1 id="wif-h">What if <em>this race goes this way?</em></h1>
          <p className="lede">Pick a winner, or a winning margin, in any Senate, governor or House race. Every other race moves the way the model ties them together: the same national environment, the same regional swing and the same shifts among groups of voters run through every race in each simulation.</p>
        </div>
        <div className="wif-presets" role="group" aria-label="Scenarios">
          {PRESETS.map((p) => <button key={p.label} onClick={() => { setPins(p.pins); setSwing(p.swing ?? 0); ev("Scenario preset", { preset: p.label, race: "what if" }); }}>{p.label}</button>)}
          <button className="reset" onClick={() => { setPins({}); setSwing(0); ev("Scenario reset", { race: "what if", tool: "races" }); }}>Reset to the forecast</button>
        </div>
      </header>

      <div className="wif-chs"><Ch k="senate" label="Senate" of="seats" /><Ch k="house" label="House" of="seats" /><Ch k="governor" label="Governors" of="governors" /></div>

      <div className="wif-stage">
        <div className="wif-mapcard">
          <div className="wif-maphead">
            <div className="wif-tabs" role="tablist" aria-label="Map">
              {(["senate", "governor", "house"] as Office[]).map((o) => <button key={o} role="tab" aria-selected={office === o} className={office === o ? "on" : ""} onClick={() => { setOffice(o); setTip(null); }}>{o === "senate" ? "Senate" : o === "governor" ? "Governors" : "House"}</button>)}
            </div>
            <span className="wif-hint">Click a {office === "house" ? "district" : "state"} once for a Democratic win, twice for a Republican win, three times to clear it</span>
          </div>
          <div className="wif-mapwrap" onMouseLeave={() => setTip(null)}>
            {geo ? (
              <svg className={`wif-map${office === "house" ? " hs" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${office} scenario map`}>
                <defs><pattern id="wif-pin" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(255,255,255,.55)" strokeWidth="2" /></pattern></defs>
                {shapes.map((s) => {
                  const id = keyOf(s), f = fillOf(id), pin = id ? pins[id] : undefined;
                  return (
                    <g key={s.key}>
                      <path d={s.d} className={`${f ? "live" : "off"}${pin ? " pin" : ""}`} style={{ fill: f ?? undefined }}
                        tabIndex={f ? 0 : -1} role={f ? "button" : undefined} aria-label={id ? raceName(id) : undefined}
                        onMouseMove={f && id ? (e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); } : undefined}
                        onClick={f && id ? () => cycle(id) : undefined} onKeyDown={f && id ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cycle(id); } } : undefined} />
                      {pin ? <path d={s.d} className="pinov" style={{ fill: "url(#wif-pin)" }} /> : null}
                    </g>
                  );
                })}
                {labels.map((l) => { const k = raceOfState(l.st), id = k >= 0 ? M.R[k].id : null, pin = id ? pins[id] : null; return <text key={l.st} x={l.x} y={l.y + 4} className={id ? (pin ? "pin" : "") : "off"}>{pin ? `${l.st} ${pin.side === "D" && isInd(id!) ? "I" : pin.side}` : l.st}</text>; })}
              </svg>
            ) : <div className="wif-load sx-skel" />}
            {tipRow ? (
              <div className="wif-tip" style={{ left: tip!.x, top: tip!.y , ...tipFlip(tip!) }}>
                <h4>{tipRow.name}</h4>
                <div className="r"><span style={{ color: tipRow.ind ? "#b78cff" : "#8fb0ff" }}>{tipRow.d}</span><b>{pc(tipRow.pa)}</b></div>
                <div className="r"><span style={{ color: "#ff8399" }}>{tipRow.r}</span><b>{pc(1 - tipRow.pa)}</b></div>
                {tipRow.m != null ? <div className="r"><span>Scenario margin</span><b>{fm(tipRow.m, tipRow.ind)}</b></div> : null}
                <div className="r"><span>Forecast</span><b>{pc(tipRow.pb)} {tipRow.ind ? "I" : "D"}</b></div>
                <div className="cta">Click to pick a winner</div>
              </div>
            ) : null}
          </div>
          <div className="wif-legend">{(["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR"] as Rating[]).map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)}<span><i className="pin" />Your pick</span></div>
        </div>

        <aside className="wif-side">
          <div className="wif-box">
            <h3>Your picks</h3>
            {pinList.length ? pinList.map(([id, p]) => {
              const statewide = byId[id] != null;
              return (
                <div key={id} className="wif-pin">
                  <div className="row1"><b>{raceName(id)}</b><button className="x" aria-label={`Clear ${raceName(id)}`} onClick={() => setPins((o) => { const n = { ...o }; delete n[id]; return n; })}>Clear</button></div>
                  <div className="row2">
                    <button className={p.side === "D" ? "on d" : ""} onClick={() => setPins((o) => ({ ...o, [id]: { ...o[id], side: "D" } }))}>{sideName(id, "D")} wins</button>
                    <button className={p.side === "R" ? "on r" : ""} onClick={() => setPins((o) => ({ ...o, [id]: { ...o[id], side: "R" } }))}>{sideName(id, "R")} wins</button>
                  </div>
                  {statewide ? (
                    <div className="row3">
                      <label><input type="checkbox" checked={p.by != null} onChange={(e) => setBy(id, e.target.checked ? 5 : null)} /> Set the margin</label>
                      {p.by != null ? <><input type="range" min={0.5} max={25} step={0.5} value={Math.min(25, p.by)} onChange={(e) => setBy(id, +e.target.value)} aria-label="Winning margin" /><label className="wif-by">by <input type="number" inputMode="decimal" min={0.1} max={60} step={0.1} value={p.by} aria-label="Type the winning margin" onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v > 0) setBy(id, Math.min(60, v)); }} /></label></> : <span className="mute">by any margin</span>}
                    </div>
                  ) : <div className="row3 mute">House picks keep only the simulations where that side wins</div>}
                </div>
              );
            }) : <p className="mute">No picks yet. Click a state or district on the map, use a scenario above, or pick from the closest races below.</p>}
            <div className="wif-swing">
              <label htmlFor="wif-swing"><b>National environment</b><span className="mono">{swing === 0 ? "As forecast" : `${swing > 0 ? "D" : "R"} +${Math.abs(swing).toFixed(1)} from the forecast`}</span></label>
              <input id="wif-swing" type="range" min={-10} max={10} step={0.5} value={swing} onChange={(e) => setSwing(+e.target.value)} />
              <div className="ends"><span>Toward Republicans</span><span>Toward Democrats</span></div>
            </div>
            <p className="wif-basis">{out.mode === "filter" ? `Based on the ${out.n.toLocaleString()} of ${M.N.toLocaleString()} simulations where every win pick happens.` : out.mode === "shift" ? `Every simulation, shifted to your margins and environment.` : "The forecast as published."}{out.note ? ` ${out.note}` : ""}</p>
          </div>
          <div className="wif-box">
            <h3>Closest {office === "governor" ? "governor" : "Senate"} races</h3>
            {closest.map(({ r, k }) => {
              const pin = pins[r.id];
              return (
                <div key={r.id} className="wif-cl">
                  <span className="nm"><b>{r.state}</b><small>{last(r.dem)} vs {last(r.gop)} · now {fm(out.m[k], r.ind)}</small></span>
                  <span className="bt">
                    <button className={pin?.side === "D" ? "on d" : ""} onClick={() => (ev("What if race called", { race: r.id, how: "list" }), setPins((o) => (o[r.id]?.side === "D" ? (() => { const n = { ...o }; delete n[r.id]; return n; })() : { ...o, [r.id]: { side: "D", by: null } })))}>{r.ind ? "I" : "D"}</button>
                    <button className={pin?.side === "R" ? "on r" : ""} onClick={() => (ev("What if race called", { race: r.id, how: "list" }), setPins((o) => (o[r.id]?.side === "R" ? (() => { const n = { ...o }; delete n[r.id]; return n; })() : { ...o, [r.id]: { side: "R", by: null } })))}>R</button>
                  </span>
                </div>
              );
            })}
          </div>
        </aside>
      </div>

      <div className="wif-table card">
        <div className="card-h"><h3>How every race moves</h3>
          <div className="wif-tabs sm" role="tablist" aria-label="Rows">
            {([["moved", "Biggest moves"], ["flips", `Flips (${flips.length})`], ["all", "Every race"]] as [typeof tab, string][]).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
        </div>
        <div className="wif-tw">
          <table>
            <thead><tr><th>Race</th><th className="n">Forecast</th><th className="n">Scenario</th><th className="n">Change</th><th>Odds now</th></tr></thead>
            <tbody>
              {shown.length ? shown.map((r) => {
                const d = r.pa - r.pb, flip = !r.pinned && (r.pb >= 0.5) !== (r.pa >= 0.5);
                return (
                  <tr key={r.id} className={flip ? "flip" : ""}>
                    <td><Link href={r.href}><b>{r.name}</b></Link>{flip ? <span className="fl">Flips</span> : null}{r.pinned ? <span className="pn">Your pick</span> : null}</td>
                    <td className="n mono">{pc(r.pb)} {r.ind ? "I" : "D"}{r.mb != null && Math.abs(r.mb) < 99 ? <small>{fm(r.mb, r.ind)}</small> : null}</td>
                    <td className="n mono">{pc(r.pa)} {r.ind ? "I" : "D"}{r.ma != null ? <small>{fm(r.ma, r.ind)}</small> : null}</td>
                    <td className={`n mono ${d > 0 ? "d" : d < 0 ? "r" : ""}`}>{d > 0 ? "+" : ""}{(d * 100).toFixed(0)} pts</td>
                    <td><span className="wif-cb"><i style={{ width: `${r.pa * 100}%`, background: r.ind ? "#b78cff" : "#3d7bff" }} /><s style={{ width: `${(1 - r.pa) * 100}%` }} /></span></td>
                  </tr>
                );
              }) : <tr><td colSpan={5} className="mute">Pick a race or move the national environment to see how the rest of the map moves.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="wif-how">
        <h2>How the scenarios work</h2>
        <p>The forecast is {M.N.toLocaleString()} simulated elections. In each one, every Senate, governor and House race draws from the same national environment, the same regional swing and the same shifts among groups of voters, such as college graduates, Latino voters or seniors, plus its own state and candidate error. That is why races move together: a simulation where Democrats overperform in Iowa is usually one where they overperform in Kansas and Nebraska too, though by less than in a presidential year, because each midterm race carries more of its own error.</p>
        <p>Picking a winner keeps only the simulations where that side wins and reads every other race from them. Setting a margin moves each simulation to that margin and moves every other race by its simulated relationship with the pick. The national environment slider shifts every race by how much it follows the national vote. House districts follow the same simulations, tilted to match the national environment your picks imply. Each race still starts from its published forecast, so with no picks the page shows the forecast exactly.</p>
      </div>
    </section>
  );
}
