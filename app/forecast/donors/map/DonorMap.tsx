"use client";
// The donor map, version 2: every county across 2022, 2024 and 2026, either all federal money at once, one race at a
// time (a Senate seat, a House district, a governor, the 2024 presidency), or the shift in the Democratic share of donor
// dollars between two cycles, for the whole map or a race against an earlier race.
import React, { useEffect, useMemo, useState } from "react";

type Cell = number[]; // [donations, donations under $200, D $ by band x4, R $ by band x4, all $]; -1 means unknown
type RaceRow = [string, string, string, string, string | null, string, string, number, number, number, number, number];
type GovNom = { name: string; party: string; sep30: number[]; full: number[]; home: number | null };
type CycInfo = { fed: string | null; gov: string[]; windows: string[]; offices: string[]; period?: string; natl: Record<string, Cell>; races: RaceRow[]; gov_summary: Record<string, { nominees: GovNom[] }> };
export type DMIndex = { built: string; cycles: Record<string, CycInfo>; offices: Record<string, string>; fips: string[]; states: Record<string, string>; counties: Record<string, [string, string, number, number, number | null]> };
type CycFile = { cycle: number; cells: Record<string, Record<string, Cell>>; top: Record<string, Record<string, [string, string, string, number][]>> };
type Cand = { name: string; party: string; usd: number; full: number; home: number | null; unitem?: number | null; small?: number | null };
type RaceFile = { id: string; cycle: string; office: string; st: string; dist: string | null; name: string; instate?: boolean; D: Cand; R: Cand; rows: number[][] };
type Geo = [string, string, string][];
type Rec = { D: number; R: number; T: number; n: number | null; ad: number };

const CYC = ["2022", "2024", "2026"];
const SIZES: { k: string; l: string; b: number[] }[] = [
  { k: "all", l: "All", b: [0, 1, 2, 3] },
  { k: "u200", l: "Under $200", b: [0] },
  { k: "200", l: "$200+", b: [1, 2, 3] },
  { k: "1k", l: "$1K+", b: [2, 3] },
  { k: "2500", l: "$2.5K+", b: [3] },
];
const MET: Record<string, { l: string; short: string; kind: "div" | "seq" | "chg" }> = {
  share: { l: "D vs R share of donor dollars", short: "D vs R", kind: "div" },
  total: { l: "Total dollars", short: "total", kind: "seq" },
  adult: { l: "Dollars per adult", short: "per adult", kind: "seq" },
  per1k: { l: "Donations per 1,000 adults", short: "per 1K adults", kind: "seq" },
  dshift: { l: "Shift in the Democratic share", short: "shift", kind: "div" },
  growth: { l: "Change in dollars", short: "change", kind: "chg" },
};
const SHARE_CUTS = [0.18, 0.32, 0.42, 0.47, 0.5, 0.53, 0.58, 0.68, 0.82];
const SHIFT_CUTS = [-0.15, -0.08, -0.04, -0.015, 0, 0.015, 0.04, 0.08, 0.15];
const GROW_CUTS = [-0.6, -0.3, -0.1, 0, 0.25, 0.75, 1.5];
const OFFN: Record<string, string> = { H: "House", S: "Senate", P: "President", G: "Governor" };

const usd = (n: number | null) => (n == null || n < 0 ? "n/a" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `$${Math.round(n / 1e3)}K` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${Math.round(n)}`);
const num = (n: number | null) => (n == null || n < 0 ? "n/a" : n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : Math.round(n).toLocaleString());
const pc = (x: number | null) => (x == null ? "n/a" : `${Math.round(x * 100)}%`);
const lean = (x: number | null) => (x == null ? "n/a" : x >= 0.5 ? `D ${(x * 100).toFixed(x > 0.995 ? 0 : 1)}%` : `R ${((1 - x) * 100).toFixed(x < 0.005 ? 0 : 1)}%`);
const shiftTxt = (v: number | null) => (v == null ? "n/a" : Math.abs(v) < 0.0005 ? "even" : `${v > 0 ? "D" : "R"} +${Math.abs(v * 100).toFixed(1)}`);
const pres = (m: number | null) => (m == null ? "n/a" : m >= 0 ? `Trump +${m.toFixed(1)}` : `Harris +${(-m).toFixed(1)}`);
const sum = (a: number[], idx: number[], off: number) => { let s = 0; for (const b of idx) { const x = a[off + b]; if (x == null || x < 0) return -1; s += x; } return s; };

function recCell(c: Cell | undefined, bands: number[], ad: number): Rec | null {
  if (!c) return null;
  const D = sum(c, bands, 2), R = sum(c, bands, 6);
  const all = bands.length === 4;
  const T = all && c[10] >= 0 ? c[10] : D >= 0 && R >= 0 ? D + R : -1;
  const n = all ? c[0] : bands.length === 1 && bands[0] === 0 ? c[1] : bands.length === 3 && bands[0] === 1 && c[0] >= 0 && c[1] >= 0 ? c[0] - c[1] : null;
  return { D, R, T, n: n != null && n >= 0 ? n : null, ad };
}
function recRow(r: number[], bands: number[], full: boolean, ad: number): Rec {
  const D = full ? r[9] : sum(r, bands, 1), R = full ? r[10] : sum(r, bands, 5);
  return { D, R, T: D + R, n: null, ad };
}
const shareOf = (r: Rec | null | undefined, min: number) => (r && r.D >= 0 && r.R >= 0 && r.D + r.R >= min ? r.D / (r.D + r.R) : null);

function valueOf(m: string, r: Rec | null | undefined, b: Rec | null | undefined, min: number): number | null {
  if (!r) return null;
  switch (m) {
    case "share": return shareOf(r, min);
    case "total": return r.T > 0 ? r.T : null;
    case "adult": return r.T > 0 && r.ad > 0 ? r.T / r.ad : null;
    case "per1k": return r.n != null && r.n > 0 && r.ad > 0 ? (1000 * r.n) / r.ad : null;
    case "dshift": { const a = shareOf(r, min), z = shareOf(b, min); return a != null && z != null ? a - z : null; }
    case "growth": return b && b.T >= min * 2 && r.T >= 0 ? r.T / b.T - 1 : null;
  }
  return null;
}
function fmt(m: string, v: number | null) {
  if (v == null) return "n/a";
  if (m === "share") return lean(v);
  if (m === "total") return usd(v);
  if (m === "adult") return `$${v < 10 ? v.toFixed(2) : Math.round(v).toLocaleString()}`;
  if (m === "per1k") return v.toFixed(v < 10 ? 1 : 0);
  if (m === "dshift") return shiftTxt(v);
  if (m === "growth") return `${v >= 0 ? "+" : ""}${Math.round(v * 100)}%`;
  return String(v);
}
function quantiles(vals: number[], k: number) {
  const s = vals.slice().sort((a, b) => a - b);
  if (!s.length) return [];
  return Array.from({ length: k - 1 }, (_, i) => s[Math.min(s.length - 1, Math.floor(((i + 1) * s.length) / k))]);
}
const bin = (v: number, cuts: number[]) => { let i = 0; while (i < cuts.length && v > cuts[i]) i++; return i; };
function clsOf(kind: string, m: string, v: number | null, q: number[]) {
  if (v == null) return "z";
  if (kind === "div") { const i = bin(v, m === "share" ? SHARE_CUTS : SHIFT_CUTS); return i < 5 ? `r${5 - i}` : `d${i - 4}`; }
  if (kind === "chg") { const i = bin(v, GROW_CUTS); return i < 4 ? `m${4 - i}` : `p${i - 3}`; }
  return `q${bin(v, q)}`;
}

export default function DonorMap({ idx }: { idx: DMIndex }) {
  const avail = CYC.filter((c) => idx.cycles[c]);
  const [cy, setCy] = useState(avail[avail.length - 1] ?? "2026");
  const [view, setView] = useState<"all" | "race" | "shift">("all");
  const [rid, setRid] = useState<string | null>(null);
  const [off, setOff] = useState("all");
  const [size, setSize] = useState("all");
  const [win, setWin] = useState("sep30");
  const [met, setMet] = useState("share");
  const [base, setBase] = useState<string>("2024");
  const [baseRace, setBaseRace] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [hov, setHov] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [files, setFiles] = useState<Record<string, CycFile>>({});
  const [races, setRaces] = useState<Record<string, RaceFile>>({});
  const [err, setErr] = useState<string | null>(null);

  const info = idx.cycles[cy];
  const raceList = useMemo(() => info?.races ?? [], [info]);
  const race = rid ? raceList.find((r) => r[0] === rid) ?? null : null;
  const inRace = (view === "race" || view === "shift") && !!race;
  const offices = info?.offices ?? ["all"];
  const o = offices.includes(off) ? off : "all";
  const bases = CYC.filter((c) => c < cy && idx.cycles[c]);
  const b = view === "shift" ? (bases.includes(base) ? base : bases[bases.length - 1] ?? null) : null;
  const w = view === "shift" ? "sep30" : info?.windows.includes(win) ? win : "sep30";
  const fullRace = inRace && w === "full";
  const sz = SIZES.find((x) => x.k === size) ?? SIZES[0];
  const bands = fullRace ? SIZES[0].b : sz.b;
  const baseOff = b && idx.cycles[b]?.offices.includes(o) ? o : "all";

  // the earlier race a race is compared against: the same seat, else the same state, else the presidency
  const baseList = useMemo(() => (b ? idx.cycles[b]?.races ?? [] : []), [b, idx.cycles]);
  const autoBase = useMemo(() => {
    if (!race || !baseList.length) return null;
    return (baseList.find((r) => r[0] === race[0]) ?? baseList.find((r) => r[3] === race[3] && r[2] === race[2]) ?? baseList.find((r) => r[3] === race[3] && r[2] === "S") ?? baseList.find((r) => r[0] === "P-US") ?? baseList.find((r) => r[3] === race[3]) ?? null)?.[0] ?? null;
  }, [race, baseList]);
  const bRid = view === "shift" && race ? (baseRace && baseList.some((r) => r[0] === baseRace) ? baseRace : autoBase) : null;
  const bRace = bRid ? baseList.find((r) => r[0] === bRid) ?? null : null;

  const tabs = view === "shift" ? ["dshift", "growth"] : inRace ? ["share", "total", "adult"] : ["share", "total", "adult", "per1k"];
  const m = tabs.includes(met) ? met : tabs[0];
  const M = MET[m];
  const per1kOk = !inRace && (sz.k === "all" || sz.k === "u200" || sz.k === "200");

  useEffect(() => { fetch("/watchdog/us_counties.json").then((r) => r.json()).then(setGeo).catch(() => setErr("The county map did not load.")); }, []);
  useEffect(() => {
    const need = [cy, ...(b && !inRace ? [b] : [])].filter((c) => idx.cycles[c] && !files[c]);
    need.forEach((c) => fetch(`/forecast/donormap/${c}.json`).then((r) => r.json()).then((d: CycFile) => setFiles((f) => ({ ...f, [c]: d }))).catch(() => setErr(`The ${c} donor file did not load.`)));
  }, [cy, b, inRace, files, idx.cycles]);
  useEffect(() => {
    const need: string[] = [];
    if (inRace && race) need.push(`${cy}/${race[0]}`);
    if (bRace && b) need.push(`${b}/${bRace[0]}`);
    need.filter((k) => !races[k]).forEach((k) => fetch(`/forecast/donormap/races/${k}.json`).then((r) => r.json()).then((d: RaceFile) => setRaces((x) => ({ ...x, [k]: d }))).catch(() => setErr("That race file did not load.")));
  }, [inRace, race, bRace, b, cy, races]);
  useEffect(() => {
    try {
      const h = new URLSearchParams(window.location.hash.slice(1));
      const c = h.get("c"); if (c && idx.cycles[c]) setCy(c);
      const v = h.get("v"); if (v === "all" || v === "race" || v === "shift") setView(v);
      if (h.get("r")) setRid(h.get("r")); if (h.get("o")) setOff(h.get("o")!); if (h.get("b")) setBase(h.get("b")!);
      if (h.get("m")) setMet(h.get("m")!); if (h.get("g")) setSize(h.get("g")!); if (h.get("rb")) setBaseRace(h.get("rb"));
      if (h.get("z")) setZoom(h.get("z"));
    } catch { /* no hash */ }
  }, [idx.cycles]);
  useEffect(() => {
    try {
      const p = new URLSearchParams({ c: cy, v: view, m });
      if (rid && view !== "all") p.set("r", rid); if (o !== "all") p.set("o", o); if (b) p.set("b", b); if (size !== "all") p.set("g", size);
      if (baseRace && view === "shift") p.set("rb", baseRace); if (zoom) p.set("z", zoom);
      history.replaceState(null, "", `#${p.toString()}`);
    } catch { /* ignore */ }
  }, [cy, view, rid, o, b, m, size, baseRace, zoom]);

  const cnt = idx.counties;
  const F = files[cy], FB = b ? files[b] : undefined;
  const RF = inRace && race ? races[`${cy}/${race[0]}`] : undefined;
  const RB = bRace && b ? races[`${b}/${bRace[0]}`] : undefined;
  const min = inRace ? 200 : 1000;

  const recs = useMemo(() => {
    const cur: Record<string, Rec> = {}, prev: Record<string, Rec> = {};
    if (inRace) {
      if (RF) for (const r of RF.rows) { const f = idx.fips[r[0]]; if (f) cur[f] = recRow(r, bands, fullRace, cnt[f]?.[2] ?? 0); }
      if (RB) for (const r of RB.rows) { const f = idx.fips[r[0]]; if (f) prev[f] = recRow(r, bands, false, cnt[f]?.[2] ?? 0); }
    } else {
      const C = F?.cells[`${w}|${o}`] ?? {};
      for (const f of Object.keys(C)) { const x = recCell(C[f], bands, cnt[f]?.[2] ?? 0); if (x) cur[f] = x; }
      if (FB) { const P = FB.cells[`sep30|${baseOff}`] ?? {}; for (const f of Object.keys(P)) { const x = recCell(P[f], bands, cnt[f]?.[2] ?? 0); if (x) prev[f] = x; } }
    }
    return { cur, prev };
  }, [inRace, RF, RB, F, FB, w, o, baseOff, bands, fullRace, idx.fips, cnt]);

  const vals = useMemo(() => {
    const out: Record<string, number | null> = {};
    const keys = new Set([...Object.keys(recs.cur), ...(view === "shift" ? Object.keys(recs.prev) : [])]);
    for (const f of keys) out[f] = valueOf(m, recs.cur[f], recs.prev[f], min);
    return out;
  }, [recs, m, min, view]);
  const qs = useMemo(() => (M.kind === "seq" ? quantiles(Object.values(vals).filter((x): x is number => x != null && x > 0), 7) : []), [vals, M.kind]);

  // states, from summed county records
  const byState = useMemo(() => {
    const a: Record<string, { c: Rec; p: Rec }> = {};
    const z = (): Rec => ({ D: 0, R: 0, T: 0, n: 0, ad: 0 });
    const add = (t: Rec, r: Rec | undefined) => { if (!r) return; t.D = t.D < 0 || r.D < 0 ? -1 : t.D + r.D; t.R = t.R < 0 || r.R < 0 ? -1 : t.R + r.R; t.T = t.T < 0 || r.T < 0 ? -1 : t.T + r.T; t.n = t.n == null || r.n == null ? null : t.n + r.n; };
    for (const f of Object.keys(cnt)) {
      const s = cnt[f][1]; const e = (a[s] ??= { c: z(), p: z() });
      e.c.ad += cnt[f][2]; e.p.ad += cnt[f][2];
      add(e.c, recs.cur[f]); add(e.p, recs.prev[f]);
    }
    return Object.entries(a).filter(([s]) => idx.states[s]).map(([s, e]) => ({ s, c: e.c, v: valueOf(m, e.c, e.p, min * 5) }));
  }, [recs, cnt, m, min, idx.states]);
  const stRank = useMemo(() => byState.filter((x) => x.v != null).sort((x, y) => (y.v as number) - (x.v as number)), [byState]);
  const moneyStates = useMemo(() => byState.filter((x) => x.c.T > 0).sort((x, y) => y.c.T - x.c.T), [byState]);
  const moneyTot = moneyStates.reduce((s, x) => s + x.c.T, 0);

  // zoom boxes from the projected paths
  const boxes = useMemo(() => {
    const out: Record<string, [number, number, number, number]> = {};
    if (!geo) return out;
    for (const [, s, d] of geo) {
      const n = d.match(/-?\d+(\.\d+)?/g); if (!n) continue;
      const x = (out[s] ??= [1e9, 1e9, -1e9, -1e9]);
      for (let i = 0; i + 1 < n.length; i += 2) { const px = +n[i], py = +n[i + 1]; if (px < x[0]) x[0] = px; if (py < x[1]) x[1] = py; if (px > x[2]) x[2] = px; if (py > x[3]) x[3] = py; }
    }
    return out;
  }, [geo]);
  const zst = zoom && boxes[zoom] ? zoom : null;
  const vb = useMemo(() => {
    if (!zst) return "0 0 960 610";
    const [x0, y0, x1, y1] = boxes[zst]; const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
    return `${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}`;
  }, [zst, boxes]);

  // search over every cycle's races
  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    const out: [string, RaceRow][] = [];
    for (const c of [...avail].reverse()) for (const r of idx.cycles[c].races ?? []) {
      if (`${r[1]} ${r[3]} ${idx.states[r[3]] ?? ""} ${r[5]} ${r[6]}`.toLowerCase().includes(t)) out.push([c, r]);
      if (out.length >= 10) return out;
    }
    return out;
  }, [q, avail, idx.cycles, idx.states]);

  const pick = (c: string, r: RaceRow) => {
    setCy(c); setRid(r[0]); setView((v) => (v === "shift" ? "shift" : "race")); setBaseRace(null); setPin(null); setQ("");
    setZoom(r[2] === "H" || r[2] === "G" ? r[3] : null);
  };
  const topRaces = useMemo(() => {
    const s = w === "full" ? 9 : 7;
    return raceList.filter((r) => view === "all" ? o === "all" || r[2] === o : true).map((r) => ({ r, D: Number(r[s]) || 0, R: Number(r[s + 1]) || 0 })).sort((x, y) => y.D + y.R - (x.D + x.R)).slice(0, 14);
  }, [raceList, w, view, o]);

  const natl = !inRace ? info?.natl?.[`${w}|${o}`] : undefined;
  const nD = natl ? sum(natl, bands, 2) : -1, nR = natl ? sum(natl, bands, 6) : -1;
  const nO = natl && sz.k === "all" && natl[10] >= 0 && nD >= 0 ? Math.max(0, natl[10] - nD - nR) : null;
  const raceD = RF ? RF.rows.reduce((s, r) => s + (fullRace ? r[9] : sum(r, bands, 1)), 0) : 0;
  const raceR = RF ? RF.rows.reduce((s, r) => s + (fullRace ? r[10] : sum(r, bands, 5)), 0) : 0;
  const homeD = RF && RF.D.home != null ? RF.D.home : null, homeR = RF && RF.R.home != null ? RF.R.home : null;

  const focus = pin ?? hov;
  const fr = focus ? recs.cur[focus] : undefined, fp = focus ? recs.prev[focus] : undefined;
  const top = focus && !inRace && o !== "G" ? F?.top?.[w]?.[focus] : undefined;
  const loading = inRace ? !RF || (view === "shift" && !!bRace && !RB) : !F || (view === "shift" && !!b && !FB);
  const showSt = (s: string) => !zst || s === zst;

  const title = view === "shift"
    ? (inRace && race ? `${race[1]}: ${cy} against ${b ?? "no earlier cycle"}${bRace && bRace[0] !== race[0] ? ` ${bRace[1]}` : ""}` : `All ${o === "all" ? "federal races" : OFFN[o] + " races"}: ${cy} against ${b ?? "no earlier cycle"}`)
    : inRace && race ? `${race[1]}, ${cy}` : `${cy} ${o === "all" ? "all federal races" : OFFN[o] + " races"}`;
  const sub = [
    M.l,
    view === "shift" ? "same point in each cycle, Jan 1 of the year before through Sep 30" : w === "sep30" ? `Jan 1 ${+cy - 1} through Sep 30 ${cy}` : "full cycle",
    sz.k !== "all" && !fullRace ? `gifts ${sz.l === "All" ? "" : sz.l}` : "",
    RF?.instate ? "in-state donors from the state filing" : "",
  ].filter(Boolean).join(" · ");

  const legend = M.kind === "div"
    ? (m === "share" ? ["R 82%+", "R 68", "R 58", "R 53", "R 50", "D 50", "D 53", "D 58", "D 68", "D 82%+"] : ["R +15", "R +8", "R +4", "R +1.5", "R", "D", "D +1.5", "D +4", "D +8", "D +15"]).map((l, i) => [i < 5 ? `r${5 - i}` : `d${i - 4}`, l])
    : M.kind === "chg" ? ["-60%", "-30%", "-10%", "down", "up", "+25%", "+75%", "+150%"].map((l, i) => [i < 4 ? `m${4 - i}` : `p${i - 3}`, l])
    : Array.from({ length: 7 }, (_, i) => [`q${i}`, i === 0 ? `< ${fmt(m, qs[0] ?? 0)}` : fmt(m, qs[i - 1] ?? 0)]);

  return (
    <section className="dm2" aria-label="Donor map">
      <aside className="dm2-side glass">
        <div className="dm2-search">
          <label htmlFor="dm2-q" className="dn-k">Find a race or candidate</label>
          <input id="dm2-q" className="dn-in" type="search" placeholder="Ossoff, Texas, NY 14" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {hits.length ? <ul role="listbox" aria-label="Matching races">{hits.map(([c, r]) => (
            <li key={`${c}-${r[0]}`}><button type="button" onClick={() => pick(c, r)}><span>{r[1]}</span><small>{r[5]} · {r[6]}</small><em>{c}</em></button></li>
          ))}</ul> : q.trim().length >= 2 ? <p className="dm2-note">No race matches that.</p> : null}
        </div>

        <div className="dm2-row"><span className="dn-k">Cycle</span>
          <div className="dm2-seg">{CYC.map((c) => <button key={c} type="button" disabled={!idx.cycles[c]} className={c === cy ? "on" : ""} onClick={() => { setCy(c); setPin(null); if (rid && !idx.cycles[c]?.races?.some((r) => r[0] === rid)) setRid(null); }}>{c}</button>)}</div>
        </div>
        <div className="dm2-row"><span className="dn-k">View</span>
          <div className="dm2-seg">
            <button type="button" className={view === "all" ? "on" : ""} onClick={() => { setView("all"); setPin(null); }}>All races</button>
            <button type="button" className={view === "race" ? "on" : ""} onClick={() => { setView("race"); setPin(null); if (!rid && raceList[0]) pick(cy, raceList[0]); }}>One race</button>
            <button type="button" disabled={!bases.length} className={view === "shift" ? "on" : ""} onClick={() => { setView("shift"); setPin(null); }} title={bases.length ? "" : "2022 is the first cycle"}>Shift</button>
          </div>
        </div>
        {view === "shift" ? (
          <div className="dm2-row"><span className="dn-k">Compare {cy} with</span>
            <div className="dm2-seg">{bases.map((c) => <button key={c} type="button" className={c === b ? "on" : ""} onClick={() => { setBase(c); setBaseRace(null); }}>{c}</button>)}</div>
            {race ? (
              <>
                <label className="dm2-note" htmlFor="dm2-br">{race[1]} {cy} against</label>
                <select id="dm2-br" className="dn-in" value={bRid ?? ""} onChange={(e) => setBaseRace(e.target.value)}>
                  {baseList.map((r) => <option key={r[0]} value={r[0]}>{b} {r[1]}: {r[5]} vs {r[6]}</option>)}
                </select>
              </>
            ) : <p className="dm2-note">Shows how the Democratic share of donor dollars moved in each county. Pick a race below to compare one race with an earlier one, like a 2026 Senate seat against the 2024 presidential race.</p>}
          </div>
        ) : null}
        {!inRace ? (
          <div className="dm2-row"><span className="dn-k">Office</span>
            <div className="dm2-seg">{["all", "S", "H", "P", "G"].map((x) => <button key={x} type="button" disabled={!offices.includes(x)} className={x === o ? "on" : ""} onClick={() => setOff(x)}>{x === "all" ? "All federal" : OFFN[x]}</button>)}</div>
          </div>
        ) : null}
        <div className="dm2-row"><span className="dn-k">Gift size</span>
          <div className="dm2-seg">{SIZES.map((x) => <button key={x.k} type="button" disabled={fullRace && x.k !== "all"} className={x.k === sz.k ? "on" : ""} onClick={() => setSize(x.k)}>{x.l}</button>)}</div>
          {fullRace ? <p className="dm2-note">Size bands cover the Sep 30 window only for single races.</p> : null}
        </div>
        {view !== "shift" && (info?.windows.length ?? 0) > 1 ? (
          <div className="dm2-row"><span className="dn-k">Window</span>
            <div className="dm2-seg">{[["sep30", "Through Sep 30"], ["full", "Full cycle"]].map(([k, l]) => <button key={k} type="button" className={k === w ? "on" : ""} onClick={() => setWin(k)}>{l}</button>)}</div>
          </div>
        ) : null}

        {inRace && race ? (
          <div className="dm2-race">
            <div className="dm2-rh"><b>{race[1]}</b><small>{cy}{race[2] !== "P" ? ` · ${idx.states[race[3]] ?? race[3]}` : ""}</small><button type="button" className="dm2-link" onClick={() => { setRid(null); setView(view === "shift" ? "shift" : "all"); setZoom(null); }}>Close</button></div>
            {RF ? (
              <>
                {[RF.D, RF.R].map((c, i) => (
                  <div key={c.name} className={`dm2-cand ${i ? "r" : "d"}`}>
                    <span className="nm">{c.name}</span>
                    <b>{usd(i ? raceR : raceD)}</b>
                    <small>{RF.instate ? "itemized, in-state donors" : `${usd(c.usd)} through Sep 30 · ${usd(c.full)} full cycle`}{race[2] !== "P" && (i ? homeR : homeD) != null ? ` · ${pc(i ? homeR : homeD)} from ${race[3]}` : ""}</small>
                    {c.unitem ? <small className="un">Plus {usd(c.unitem)} in small gifts the campaign reported only as a total, so they cannot be mapped</small> : null}
                  </div>
                ))}
                <div className="dm2-bar" aria-label="Democratic share of the two nominees' donor dollars"><i style={{ width: `${raceD + raceR > 0 ? (100 * raceD) / (raceD + raceR) : 50}%` }} /><span>{lean(raceD + raceR > 0 ? raceD / (raceD + raceR) : null)}</span></div>
                <span className="dn-k">Where the money comes from</span>
                <ol className="dm2-states">{moneyStates.slice(0, 8).map((x) => (
                  <li key={x.s}><button type="button" className={x.s === zst ? "on" : ""} onClick={() => setZoom(x.s === zst ? null : x.s)}>
                    <b>{x.s}</b><span className="sb"><i className="d" style={{ width: `${(100 * Math.max(0, x.c.D)) / (moneyStates[0]?.c.T || 1)}%` }} /><i className="r" style={{ width: `${(100 * Math.max(0, x.c.R)) / (moneyStates[0]?.c.T || 1)}%` }} /></span><em>{pc(moneyTot ? x.c.T / moneyTot : null)}</em>
                  </button></li>
                ))}</ol>
                {race[2] !== "P" ? <button type="button" className="dm2-link" onClick={() => setZoom(zst ? null : race[3])}>{zst ? "Show the whole country" : `Zoom to ${idx.states[race[3]] ?? race[3]}`}</button> : null}
              </>
            ) : <p className="dm2-note">{err ?? "Loading the race"}</p>}
          </div>
        ) : null}

        {!inRace ? (
          <div className="dm2-tot">
            <span className="dn-k">{cy} {o === "all" ? "federal" : OFFN[o]}, {w === "sep30" ? "through Sep 30" : "full cycle"}</span>
            {natl ? (
              <dl>
                <div className="d"><dt>Democrats</dt><dd>{usd(nD)}</dd></div>
                <div className="r"><dt>Republicans</dt><dd>{usd(nR)}</dd></div>
                {nO != null ? <div><dt>Other</dt><dd>{usd(nO)}</dd></div> : null}
                <div><dt>D share</dt><dd>{nD >= 0 && nR >= 0 && nD + nR > 0 ? pc(nD / (nD + nR)) : "n/a"}</dd></div>
              </dl>
            ) : <p className="dm2-note">Not pulled yet.</p>}
          </div>
        ) : null}

        <div className="dm2-top">
          <span className="dn-k">Highest fundraising races, {cy}</span>
          {topRaces.length ? <ol>{topRaces.map(({ r, D, R }) => (
            <li key={r[0]}><button type="button" className={r[0] === rid && inRace ? "on" : ""} onClick={() => pick(cy, r)}>
              <span className="nm">{r[1]}</span>
              <span className="tr"><i className="d" style={{ width: `${D + R > 0 ? (100 * D) / (D + R) : 50}%` }} /></span>
              <small>{r[5]} vs {r[6]}</small><em>{usd(D + R)}</em>
            </button></li>
          ))}</ol> : <p className="dm2-note">No race files in this cycle yet.</p>}
        </div>
      </aside>

      <div className="dm2-main">
        <div className="dm2-tabs glass" role="tablist" aria-label="Measure">
          {tabs.map((k) => <button key={k} type="button" role="tab" aria-selected={k === m} disabled={k === "per1k" && !per1kOk} className={k === m ? "on" : ""} onClick={() => setMet(k)} title={k === "per1k" && !per1kOk ? "Donation counts come in two sizes: under $200 and $200 or more" : ""}>{MET[k].l}</button>)}
        </div>
        <div className="dm2-map glass">
          <div className="dm2-mh">
            <h2>{title}</h2>
            <span>{sub}</span>
            {zst ? <button type="button" className="dm2-link" onClick={() => setZoom(null)}>Whole country</button> : null}
          </div>
          <div className="dm2-svg" onMouseLeave={() => setHov(null)}>
            {geo ? (
              <svg viewBox={vb} role="img" aria-label={`${title}. Each county colored by ${M.l.toLowerCase()}`}>
                <g className={`dm2-g${loading ? " ld" : ""}`} onMouseOver={(e) => { const f = (e.target as SVGElement).getAttribute("data-f"); if (f) setHov(f); }} onClick={(e) => { const f = (e.target as SVGElement).getAttribute("data-f"); if (f) setPin((p) => (p === f ? null : f)); }}>
                  {geo.map(([f, s, d]) => (showSt(s) ? <path key={f} d={d} data-f={f} className={`${clsOf(M.kind, m, vals[f] ?? null, qs)}${f === focus ? " hv" : ""}${race && inRace && race[2] !== "P" && s === race[3] ? " home" : ""}`} /> : null))}
                </g>
              </svg>
            ) : <div className="dm2-load">{err ?? "Drawing 3,100 counties"}</div>}
            {loading && geo ? <div className="dm2-busy">{err ?? "Loading donors"}</div> : null}
            {focus && cnt[focus] ? (
              <div className={`dm2-tip${pin ? " pinned" : ""}`} role="status">
                <div className="h"><b>{cnt[focus][0]}</b><small>{idx.states[cnt[focus][1]] ?? cnt[focus][1]}</small></div>
                <span className="v">{fmt(m, vals[focus] ?? null)} <small>{M.short}</small></span>
                {fr && fr.D >= 0 && fr.R >= 0 && fr.D + fr.R > 0 ? <div className="sp"><i style={{ width: `${(100 * fr.D) / (fr.D + fr.R)}%` }} /></div> : null}
                <dl>
                  <div><dt className="d">{inRace && RF ? RF.D.name : "Democrats"}</dt><dd>{usd(fr?.D ?? null)}</dd></div>
                  <div><dt className="r">{inRace && RF ? RF.R.name : "Republicans"}</dt><dd>{usd(fr?.R ?? null)}</dd></div>
                  {!inRace ? <div><dt>All dollars</dt><dd>{usd(fr?.T ?? null)}</dd></div> : null}
                  {fr?.n != null ? <div><dt>Donations</dt><dd>{num(fr.n)}</dd></div> : null}
                  {view === "shift" ? <div><dt>{b}{bRace && inRace ? ` ${bRace[5].split(" ").slice(-1)[0]} vs ${bRace[6].split(" ").slice(-1)[0]}` : ""}</dt><dd>{lean(shareOf(fp, min))}</dd></div> : null}
                  {view === "shift" ? <div><dt>{cy}</dt><dd>{lean(shareOf(fr, min))}</dd></div> : null}
                  <div><dt>Adults</dt><dd>{num(cnt[focus][2])}</dd></div>
                  <div><dt>2024 vote</dt><dd>{pres(cnt[focus][4])}</dd></div>
                </dl>
                {top?.length ? <ol>{top.slice(0, 4).map(([n, p, of, u]) => <li key={n}><i className={p === "D" ? "d" : p === "R" ? "r" : ""} />{n}<small>{OFFN[of] ?? of}</small><b>{usd(u)}</b></li>)}</ol> : null}
                {pin ? <button type="button" className="dm2-link" onClick={() => setPin(null)}>Unpin</button> : <small className="hint">Click to pin</small>}
              </div>
            ) : null}
          </div>
          <div className={`dm2-leg ${M.kind}`} aria-label="Legend">
            {legend.map(([c, l]) => <span key={c} className="sw"><i className={c} /><small>{l}</small></span>)}
            <span className="sw"><i className="z" /><small>{inRace ? "too little to call" : "no gifts or too few"}</small></span>
          </div>
        </div>

        {!inRace ? (
          <div className="dm2-st glass">
            <div className="dn-sh"><h3>States</h3><span>{M.l}. Click a state to zoom</span></div>
            <ol>{stRank.map((x) => {
              const v = x.v as number; const ctr = M.kind === "seq" ? 0 : m === "share" ? 0.5 : 0;
              const span = M.kind === "seq" ? (stRank[0]?.v as number) || 1 : m === "share" ? 0.5 : Math.max(...stRank.map((y) => Math.abs(y.v as number))) || 1;
              return (
                <li key={x.s}><button type="button" className={x.s === zst ? "on" : ""} onClick={() => setZoom(x.s === zst ? null : x.s)}>
                  <b>{x.s}</b><span className="sb"><i className={M.kind === "seq" ? "n" : M.kind === "chg" ? (v >= 0 ? "n" : "m") : v >= ctr ? "d" : "r"} style={{ width: `${Math.min(100, (100 * Math.abs(v - ctr)) / span)}%` }} /></span><em>{fmt(m, v)}</em>
                </button></li>
              );
            })}</ol>
          </div>
        ) : null}
      </div>
    </section>
  );
}
