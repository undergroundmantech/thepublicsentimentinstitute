"use client";
// The swingometer: move any group of voters, in vote margin or in turnout, and every Senate, governor and
// House race moves with it. Every slider starts at zero, which is the published forecast to the decimal.
import Link from "next/link";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Hemicycle, { probFill, type HemiSeat } from "@/app/components/opp/Hemicycle";
import type { SwingData, SwingRace } from "./data";
import { ev, evSettled } from "@/app/lib/ev";
import "./swing.css";

type Office = "s" | "g" | "h";
type Shift = { m: number[]; t: number[] };
type Shifts = Record<string, Shift>;
type Scenario = { overall: number; shifts: Shifts };

// ---------- math ----------
const Phi = (z: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};
function PhiInv(p: number) {
  // Acklam's rational approximation
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

type Moved = { r: SwingRace; d: number; f: number; pD: number; parts: number[] };

function move(r: SwingRace, sc: Scenario, keys: string[]): Moved {
  if (!r.x) return { r, d: 0, f: 1, pD: r.pD, parts: [] };
  let d = sc.overall, f = 1;
  const parts: number[] = [];
  r.x.forEach((p, di) => {
    const sh = sc.shifts[keys[di]];
    if (!sh || (sh.m.every((v) => !v) && sh.t.every((v) => !v))) { parts.push(0); return; }
    let w = 0, base = 0, num = 0, den = 0;
    p.forEach(([s, m], gi) => {
      const k = 1 + (sh.t[gi] || 0) / 100;
      w += s; base += s * m; num += s * k * clamp(m + (sh.m[gi] || 0), -100, 100); den += s * k;
    });
    if (!w || !den) { parts.push(0); return; }
    const nd = num / den - base / w;
    parts.push(nd); d += nd; f *= den / w;
  });
  if (!d) return { r, d: 0, f, pD: r.pD, parts };
  const p0 = clamp(r.pD, 0.0005, 0.9995);
  const pD = clamp(Phi(PhiInv(p0) + d / r.sd), 0.0005, 0.9995);
  return { r, d, f, pD: r.pD <= 0.0005 || r.pD >= 0.9995 ? (Math.abs(d) < 0.01 ? r.pD : pD) : pD, parts };
}

// ---------- formatting ----------
const pct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
const fm = (mR: number, ind = false) => (Math.abs(mR) < 0.05 ? "Even" : `${mR < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(mR).toFixed(1)}`);
const sgn = (x: number, dig = 1) => (Math.abs(x) < 0.05 ? "0.0" : `${x > 0 ? "+" : "−"}${Math.abs(x).toFixed(dig)}`);
const shiftLabel = (v: number) => (Math.abs(v) < 0.05 ? "Forecast" : `${v > 0 ? "D" : "R"} +${Math.abs(v).toFixed(1)}`);
const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
const OFFICE: Record<Office, string> = { s: "Senate", g: "Governor", h: "House" };
const DIM_GROUPS: [string, string[]][] = [
  ["Will they vote", ["voteprop", "partyprop", "prop", "history"]],
  ["How they lean", ["party", "vote24", "approval"]],
  ["Who they are", ["race", "age", "edu", "raceedu", "gender", "income"]],
];

// ---------- typed numbers ----------
/** "D +12", "R 5", "-12" or "12" to an R minus D margin; plain numbers read as Republican positive */
function parseM(s: string): number | null {
  const t = s.trim().toUpperCase().replace(/\s+/g, "");
  if (t === "EVEN") return 0;
  const m = /^([DRI])?\+?(-?\d+(?:\.\d+)?)$/.exec(t); if (!m) return null;
  const v = Number(m[2]); if (!Number.isFinite(v)) return null;
  return m[1] === "R" ? Math.abs(v) : m[1] ? -Math.abs(v) : v;
}
function TypeNum({ id, label, value, show, parse, onCommit, hint }: { id: string; label: string; value: number; show: (v: number) => string; parse: (s: string) => number | null; onCommit: (v: number) => void; hint?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft == null) return; const v = parse(draft); setDraft(null); if (v != null && draft.trim() !== show(value)) { onCommit(v); ev("Exact number typed", { field: label, race: "national" }); } };
  return (
    <label className="sw-num" htmlFor={id}><span>{label}</span>
      <input id={id} inputMode="decimal" value={draft ?? show(value)} onFocus={(e) => { const el = e.currentTarget; setDraft((d) => d ?? show(value)); requestAnimationFrame(() => { if (document.activeElement === el) el.select(); }); }} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } }} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

// ---------- scenario helpers ----------
function emptyShifts(data: SwingData): Shifts {
  const o: Shifts = {};
  for (const d of data.dims) o[d.key] = { m: d.groups.map(() => 0), t: d.groups.map(() => 0) };
  return o;
}
const isZero = (sc: Scenario) => !sc.overall && Object.values(sc.shifts).every((s) => s.m.every((v) => !v) && s.t.every((v) => !v));

type Preset = { key: string; cat: "Turnout" | "Persuasion" | "Environment"; label: string; note: string; overall?: number; moves?: [string, number, "m" | "t", number][] };
// group indexes follow DIMS in data.ts
const PRESETS: Preset[] = [
  // turnout
  { key: "lowsurge", cat: "Turnout", label: "Low propensity voters surge", note: "Medium propensity voters turn out 15% more and low propensity voters 30% more.", moves: [["prop", 1, "t", 15], ["prop", 2, "t", 30]] },
  { key: "lowhome", cat: "Turnout", label: "Low propensity voters stay home", note: "Medium propensity voters turn out 15% less and low propensity voters 30% less.", moves: [["prop", 1, "t", -15], ["prop", 2, "t", -30]] },
  { key: "reliable", cat: "Turnout", label: "Only reliable voters show up", note: "A low turnout midterm: medium propensity voters down a quarter, low propensity voters down 45%.", moves: [["prop", 1, "t", -25], ["prop", 2, "t", -45]] },
  { key: "lptrumpup", cat: "Turnout", label: "Low propensity Trump voters show up", note: "Lower propensity Trump 2024 voters turn out 30% more than the forecast expects.", moves: [["voteprop", 1, "t", 30]] },
  { key: "lptrumpdown", cat: "Turnout", label: "Low propensity Trump voters stay home", note: "Lower propensity Trump 2024 voters turn out 30% less, the classic midterm drop off without Trump on the ballot.", moves: [["voteprop", 1, "t", -30]] },
  { key: "lpharrisup", cat: "Turnout", label: "Low propensity Harris voters show up", note: "Lower propensity Harris 2024 voters turn out 30% more.", moves: [["voteprop", 3, "t", 30]] },
  { key: "lpharrisdown", cat: "Turnout", label: "Low propensity Harris voters stay home", note: "Lower propensity Harris 2024 voters turn out 30% less.", moves: [["voteprop", 3, "t", -30]] },
  { key: "maga", cat: "Turnout", label: "The MAGA base turns out", note: "Trump voters turn out more at every propensity, low propensity Trump voters most of all.", moves: [["voteprop", 0, "t", 6], ["voteprop", 1, "t", 25], ["approval", 0, "t", 5]] },
  { key: "enthusiasm", cat: "Turnout", label: "Enthusiasm gap favors Democrats", note: "Trump disapprovers turn out 10% more and approvers 5% less.", moves: [["approval", 2, "t", 10], ["approval", 0, "t", -5]] },
  { key: "nonvoters", cat: "Turnout", label: "2024 nonvoters show up", note: "People who skipped 2024 turn out 40% more than the forecast expects.", moves: [["voteprop", 5, "t", 40]] },
  { key: "young", cat: "Turnout", label: "Young voters stay home", note: "Turnout under 30 falls a quarter and new voters a fifth.", moves: [["age", 0, "t", -25], ["history", 3, "t", -20]] },
  { key: "youngup", cat: "Turnout", label: "Young voters surge", note: "Voters under 30 turn out 25% more.", moves: [["age", 0, "t", 25]] },
  { key: "seniors", cat: "Turnout", label: "Seniors flood the polls", note: "Voters 65 and older turn out 10% more.", moves: [["age", 3, "t", 10]] },
  { key: "black", cat: "Turnout", label: "Black turnout drops", note: "Black voters turn out 12% less than the forecast expects.", moves: [["race", 1, "t", -12]] },
  { key: "blackup", cat: "Turnout", label: "Black turnout surges", note: "Black voters turn out 12% more than the forecast expects.", moves: [["race", 1, "t", 12]] },
  { key: "latinot", cat: "Turnout", label: "Latino turnout drops", note: "Latino voters turn out 15% less.", moves: [["race", 2, "t", -15]] },
  { key: "skipped22", cat: "Turnout", label: "Midterm surge voters show up", note: "Voters who skipped 2022 turn out 20% more, new voters 25% more.", moves: [["history", 1, "t", 20], ["history", 3, "t", 25]] },
  // persuasion
  { key: "latino", cat: "Persuasion", label: "Latino voters swing right", note: "Latino voters move 8 points toward Republicans.", moves: [["race", 2, "m", -8]] },
  { key: "latinoleft", cat: "Persuasion", label: "Latino voters swing back left", note: "Latino voters move 8 points toward Democrats.", moves: [["race", 2, "m", 8]] },
  { key: "blackright", cat: "Persuasion", label: "Black voters drift right", note: "Black voters move 6 points toward Republicans.", moves: [["race", 1, "m", -6]] },
  { key: "indep", cat: "Persuasion", label: "Independents break right", note: "Independents move 10 points toward Republicans.", moves: [["party", 2, "m", -10]] },
  { key: "indepleft", cat: "Persuasion", label: "Independents break left", note: "Independents move 10 points toward Democrats.", moves: [["party", 2, "m", 10]] },
  { key: "diploma", cat: "Persuasion", label: "The diploma divide widens", note: "College graduates move 4 points left, everyone else 4 points right.", moves: [["edu", 0, "m", 4], ["edu", 1, "m", -4]] },
  { key: "diplomanarrow", cat: "Persuasion", label: "The diploma divide narrows", note: "College graduates move 3 points right, everyone else 3 points left.", moves: [["edu", 0, "m", -3], ["edu", 1, "m", 3]] },
  { key: "workingright", cat: "Persuasion", label: "Working class whites shift right", note: "White voters without a degree move 4 points toward Republicans.", moves: [["raceedu", 1, "m", -4]] },
  { key: "suburbleft", cat: "Persuasion", label: "College whites shift left", note: "White college graduates move 5 points toward Democrats.", moves: [["raceedu", 0, "m", 5]] },
  { key: "gendergap", cat: "Persuasion", label: "The gender gap widens", note: "Men move 4 points right and women 4 points left.", moves: [["gender", 0, "m", -4], ["gender", 1, "m", 4]] },
  { key: "youngmen", cat: "Persuasion", label: "Young voters swing right", note: "Voters under 30 move 6 points toward Republicans.", moves: [["age", 0, "m", -6]] },
  { key: "seniorsleft", cat: "Persuasion", label: "Seniors swing left", note: "Voters 65 and older move 5 points toward Democrats.", moves: [["age", 3, "m", 5]] },
  { key: "trumpsour", cat: "Persuasion", label: "Trump voters sour", note: "Trump 2024 voters cross over: high propensity 4 points, low propensity 8 points toward Democrats.", moves: [["voteprop", 0, "m", 4], ["voteprop", 1, "m", 8]] },
  { key: "harrissour", cat: "Persuasion", label: "Harris voters sour", note: "Harris 2024 voters cross over: high propensity 3 points, low propensity 7 points toward Republicans.", moves: [["voteprop", 2, "m", -3], ["voteprop", 3, "m", -7]] },
  { key: "workingclass", cat: "Persuasion", label: "Lower income voters swing right", note: "Voters earning under $50K move 5 points toward Republicans.", moves: [["income", 0, "m", -5]] },
  // environments
  { key: "blue18", cat: "Environment", label: "A 2018 style blue wave", note: "Everyone moves 3 points left and low propensity Harris voters turn out 15% more.", overall: 3, moves: [["voteprop", 3, "t", 15], ["prop", 2, "t", 10]] },
  { key: "red10", cat: "Environment", label: "A 2010 style red wave", note: "Everyone moves 6 points right, young voters stay home and low propensity Trump voters show up.", overall: -6, moves: [["age", 0, "t", -20], ["voteprop", 1, "t", 15]] },
  { key: "miss20", cat: "Environment", label: "Polls miss Republicans like 2020", note: "Everyone moves 4 points right and low propensity Trump voters turn out 20% more than polls expect.", overall: -4, moves: [["voteprop", 1, "t", 20]] },
  { key: "miss22", cat: "Environment", label: "Polls miss Democrats like 2022", note: "Everyone moves 3 points left and low propensity Trump voters turn out 15% less.", overall: 3, moves: [["voteprop", 1, "t", -15]] },
  { key: "tied", cat: "Environment", label: "A tied national vote", note: "Everyone moves 12 points right, which erases the Democrats' lead in the generic ballot average.", overall: -12 },
  { key: "back24", cat: "Environment", label: "Back to the 2024 national vote", note: "Everyone moves 13.5 points right, back to Trump's 2024 national margin.", overall: -13.5 },
];

function encode(sc: Scenario, keys: string[]) {
  const o: Record<string, [number[], number[]]> = {};
  keys.forEach((k) => { const s = sc.shifts[k]; if (s && (s.m.some((v) => v) || s.t.some((v) => v))) o[k] = [s.m, s.t]; });
  const raw = JSON.stringify({ o: sc.overall, s: o });
  return btoa(raw).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function decode(h: string, data: SwingData): Scenario | null {
  try {
    const raw = JSON.parse(atob(h.replace(/-/g, "+").replace(/_/g, "/")));
    const shifts = emptyShifts(data);
    for (const [k, [m, t]] of Object.entries(raw.s ?? {}) as [string, [number[], number[]]][]) {
      if (!shifts[k]) continue;
      shifts[k].m = shifts[k].m.map((_, i) => clamp(Number(m[i]) || 0, -100, 100));
      shifts[k].t = shifts[k].t.map((_, i) => clamp(Number(t[i]) || 0, -95, 400));
    }
    return { overall: clamp(Number(raw.o) || 0, -15, 15), shifts };
  } catch { return null; }
}

// ---------- animated numbers ----------
function useTween(v: number, ms = 450) {
  const [x, setX] = useState(v);
  const from = useRef(v), raf = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) { setX(v); from.current = v; return; }
    const a = from.current, t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      const cur = a + (v - a) * e; setX(cur); from.current = cur;
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [v, ms]);
  return x;
}
function Num({ v, f = n0 }: { v: number; f?: (x: number) => string }) { const x = useTween(v); return <>{f(x)}</>; }

// ---------- component ----------
export default function SwingClient() {
  const [data, setData] = useState<SwingData | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    fetch("/forecast/swingometer/data.json").then((r) => (r.ok ? r.json() : Promise.reject())).then(setData).catch(() => setErr(true));
  }, []);
  if (err) return <div className="card sw-load">The swingometer could not load the forecast. Refresh to try again.</div>;
  if (!data) return <div className="card sw-load"><span />Loading every race in the forecast</div>;
  return <Swing data={data} />;
}

function Swing({ data }: { data: SwingData }) {
  const keys = useMemo(() => data.dims.map((d) => d.key), [data]);
  const [sc, setSc] = useState<Scenario>(() => ({ overall: 0, shifts: emptyShifts(data) }));
  const [dim, setDim] = useState(data.dims.some((d) => d.key === "voteprop") ? "voteprop" : data.dims[0].key);
  const [exact, setExact] = useState(false);
  const [office, setOffice] = useState<Office>("s");
  const [focus, setFocus] = useState<string>("");
  const [mapO, setMapO] = useState<Office>("s");
  const [toast, setToast] = useState("");
  const [preset, setPreset] = useState("");
  const [pcat, setPcat] = useState<"Turnout" | "Persuasion" | "Environment">("Turnout");
  const booted = useRef(false);

  // a shared link opens on its scenario
  useEffect(() => {
    const h = window.location.hash.replace(/^#s=/, "");
    if (h && window.location.hash.startsWith("#s=")) { const d = decode(h, data); if (d) setSc(d); }
    const q = new URLSearchParams(window.location.search).get("race");
    if (q && data.races.some((r) => r.id === q && r.x)) { setFocus(q); setOffice(q.startsWith("sen") ? "s" : q.startsWith("gov") ? "g" : "h"); }
    booted.current = true;
  }, [data]);
  useEffect(() => {
    if (!booted.current) return;
    const t = setTimeout(() => {
      const u = new URL(window.location.href);
      u.hash = isZero(sc) ? "" : `s=${encode(sc, keys)}`;
      window.history.replaceState(null, "", u.toString());
    }, 250);
    return () => clearTimeout(t);
  }, [sc, keys]);

  const live = useDeferredValue(sc);
  const moved = useMemo(() => data.races.map((r) => move(r, live, keys)), [data, live, keys]);
  const byId = useMemo(() => new Map(moved.map((m) => [m.r.id, m])), [moved]);

  const chamber = useCallback((k: "senate" | "governor" | "house", o: Office) => {
    const c = data.chambers[k];
    const rs = moved.filter((m) => m.r.o === o);
    const shift = rs.reduce((a, m) => a + (m.pD - m.r.pD), 0);
    const T = c.total;
    const ctrl = clamp(c.hist.reduce((a, [s, p]) => a + p * clamp(T - s + shift - (c.thr - 1), 0, 1), 0) + c.offset, 0, 1);
    const flipsD = rs.filter((m) => m.r.pD < 0.5 && m.pD >= 0.5).length;
    const flipsR = rs.filter((m) => m.r.pD >= 0.5 && m.pD < 0.5).length;
    const seats: HemiSeat[] = rs.map((m) => ({ p: m.pD, label: `${m.r.name}${m.r.o === "h" ? "" : m.r.o === "s" ? " Senate" : " governor"}: Democrats ${pct(m.pD)}` }));
    for (let i = 0; i < c.notUpD; i++) seats.push({ p: null, hold: "D" });
    for (let i = 0; i < c.notUpR; i++) seats.push({ p: null, hold: "R" });
    return { hold: c.notUpD + c.notUpR, ctrl, base: c.demControl, seats: c.demSeats + shift, baseSeats: c.demSeats, thr: c.thr, total: T, flipsD, flipsR, hemi: seats };
  }, [data, moved]);
  const sen = chamber("senate", "s"), hou = chamber("house", "h"), gov = chamber("governor", "g");

  const pool = useMemo(() => data.races.filter((r) => r.o === office && r.x).sort((a, b) => Math.abs(a.pD - 0.5) - Math.abs(b.pD - 0.5)), [data, office]);
  const fid = focus && pool.some((r) => r.id === focus) ? focus : pool[0]?.id;
  const fm0 = fid ? byId.get(fid)! : null;

  const movers = useMemo(() => moved.filter((m) => Math.abs(m.pD - m.r.pD) >= 0.005).sort((a, b) => Math.abs(b.pD - b.r.pD) - Math.abs(a.pD - a.r.pD)).slice(0, 14), [moved]);
  const avgD = useMemo(() => { const c = moved.filter((m) => m.r.x && m.r.o !== "h"); return c.reduce((a, m) => a + m.d, 0) / (c.length || 1); }, [moved]);

  const setGroup = (k: string, gi: number, field: "m" | "t", v: number) => (evSettled(`g${k}${gi}${field}`, "Swingometer edit", { what: `${k} group ${gi + 1} ${field === "m" ? "margin" : "turnout"}`, race: "national" }), setScM((s) => ({ ...s, shifts: { ...s.shifts, [k]: { ...s.shifts[k], [field]: s.shifts[k][field].map((x, i) => (i === gi ? v : x)) } } })));
  const resetDim = (k: string) => setScM((s) => ({ ...s, shifts: { ...s.shifts, [k]: { m: s.shifts[k].m.map(() => 0), t: s.shifts[k].t.map(() => 0) } } }));
  const resetAll = () => { setSc({ overall: 0, shifts: emptyShifts(data) }); setPreset(""); ev("Scenario reset", { race: "national", tool: "groups" }); };
  const setScM: typeof setSc = (v) => { setPreset(""); setSc(v); };
  const applyPreset = (p: Preset) => {
    const sh = emptyShifts(data);
    for (const [k, gi, f, v] of p.moves ?? []) if (sh[k]) sh[k][f][gi] = v;
    setSc({ overall: p.overall ?? 0, shifts: sh }); setPreset(p.key); setToast(p.note); ev("Scenario preset", { preset: p.label, race: "national" });
    const first = p.moves?.[0]?.[0]; if (first) setDim(first);
  };
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3200); return () => clearTimeout(t); }, [toast]);
  const copy = async () => { ev("Scenario shared", { race: "national", tool: "groups" }); try { await navigator.clipboard.writeText(window.location.href); setToast("Link copied. It opens on this scenario."); } catch { setToast("Copy the address bar to share this scenario."); } };

  const di = keys.indexOf(dim);
  const dimDef = data.dims[di];
  const active = keys.filter((k) => sc.shifts[k].m.some((v) => v) || sc.shifts[k].t.some((v) => v));
  const zero = isZero(sc);

  return (
    <div className="sw">
      {/* chambers */}
      <section className="sw-ch" aria-label="Chamber control in your scenario">
        <ChamberCard name="Senate" c={sen} unit="seats" note="51 for control" />
        <ChamberCard name="House" c={hou} unit="seats" note="218 for a majority" />
        <ChamberCard name="Governors" c={gov} unit="governorships" note="26 for a majority" />
      </section>

      <section className="card sw-scen" aria-label="Ready made scenarios">
        <div className="card-h">
          <h3>Try a scenario</h3>
          <div className="seg" role="tablist" aria-label="Scenario type">
            {(["Turnout", "Persuasion", "Environment"] as const).map((c) => <button key={c} role="tab" aria-selected={pcat === c} className={pcat === c ? "on" : undefined} onClick={() => setPcat(c)}>{c}</button>)}
          </div>
        </div>
        <div className="card-b">
          <div className="sw-scen-chips">
            {PRESETS.filter((p) => p.cat === pcat).map((p) => <button key={p.key} className={`sw-chip${preset === p.key ? " on" : ""}`} aria-pressed={preset === p.key} onClick={() => applyPreset(p)}>{p.label}</button>)}
          </div>
          <p className="sw-scen-note">{preset ? PRESETS.find((p) => p.key === preset)?.note : pcat === "Turnout" ? "Who shows up: high and low propensity voters, 2024 Trump and Harris voters by how likely they are to vote, age and race." : pcat === "Persuasion" ? "Who changes their mind: groups moving toward one party while turnout stays at the forecast." : "Whole elections: a wave, a polling miss, or the 2024 national vote again."}{preset ? " Every slider it set is open on the left to adjust." : ""}</p>
        </div>
      </section>

      <div className="sw-grid">
        {/* controls */}
        <aside className="card sw-ctl" aria-label="Swing controls">
          <div className="card-h">
            <h3>Move the voters</h3>
            <span className={`pill ${zero ? "t" : "d"}`} style={{ marginLeft: "auto" }}>{zero ? "Forecast" : "Your scenario"}</span>
          </div>
          <div className="card-b sw-ctl-b">
            <div className="sw-overall">
              <label htmlFor="sw-overall">Every voter</label>
              <output className={`mono ${sc.overall > 0 ? "d" : sc.overall < 0 ? "r" : ""}`}>{shiftLabel(sc.overall)}</output>
              <input id="sw-overall" type="range" className="sw-range m" min={-15} max={15} step={0.5} value={sc.overall}
                aria-valuetext={shiftLabel(sc.overall)} onChange={(e) => { const v = Number(e.target.value); evSettled("overall", "Swingometer edit", { what: "every voter", race: "national" }); setScM((s) => ({ ...s, overall: v })); }} />
              <div className="sw-scale"><span>Republican</span><span>Democratic</span></div>
            </div>

            <div className="sw-dimgroups">
              {DIM_GROUPS.map(([lab, ks]) => (
                <div key={lab} className="sw-dimrow">
                  <span className="eye">{lab}</span>
                  <div className="sw-dims" role="tablist" aria-label={lab}>
                    {ks.map((k) => data.dims.find((d) => d.key === k)).filter(Boolean).map((d) => (
                      <button key={d!.key} role="tab" aria-selected={dim === d!.key} className={dim === d!.key ? "on" : undefined} onClick={() => setDim(d!.key)}>
                        {d!.label}{active.includes(d!.key) ? <i aria-label="has changes" /> : null}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="sw-mode" role="group" aria-label="How to change the groups">
              <button type="button" className={!exact ? "on" : undefined} aria-pressed={!exact} onClick={() => { setExact(false); ev("Exact entry mode", { on: false, race: "national" }); }}>Shift with sliders</button>
              <button type="button" className={exact ? "on" : undefined} aria-pressed={exact} onClick={() => { setExact(true); ev("Exact entry mode", { on: true, race: "national" }); }}>Type exact numbers</button>
            </div>
            {exact ? (() => {
              // the group's national share and margin with the scenario's moves, and the moves that land typed numbers
              const base = data.nat[di], sh = sc.shifts[dim];
              const k = base.map((_, gi) => 1 + (sh.t[gi] || 0) / 100);
              const W = base.reduce((a, [s0], gi) => a + s0 * k[gi], 0) || 1;
              const cur = base.map(([s0, mg], gi) => ({ share: (100 * s0 * k[gi]) / W, mR: -(mg + (sh.m[gi] || 0)), share0: s0, mR0: -mg }));
              const setShare = (gi: number, v: number) => {
                const tg = clamp(v / 100, 0.001, 0.98), others = base.reduce((a, [s0], j) => (j === gi ? a : a + s0 * k[j]), 0);
                const kk = (tg * others) / ((1 - tg) * Math.max(1e-6, base[gi][0]));
                setGroup(dim, gi, "t", clamp(Math.round((kk - 1) * 1000) / 10, -95, 400));
              };
              const setMargin = (gi: number, mR: number) => setGroup(dim, gi, "m", clamp(Math.round((-mR - base[gi][1]) * 10) / 10, -100, 100));
              return (
                <div className="sw-groups sw-exact">
                  <p className="sw-fine">Type each group&apos;s share of voters nationwide and how it votes, like 35 and D +12, then press Enter. The other groups keep their own turnout, so their shares make up the rest.</p>
                  {dimDef.groups.map((g, gi) => (
                    <div key={g} className="sw-g">
                      <div className="sw-g-h"><b>{g}</b></div>
                      <div className="sw-nums">
                        <TypeNum id={`swx-${dim}-${gi}-s`} label="Share of voters" value={cur[gi].share} show={(v) => `${v.toFixed(1)}%`} parse={(t) => { const v = Number(t.replace(/[%,\s]/g, "")); return Number.isFinite(v) ? v : null; }} hint={`Forecast ${cur[gi].share0.toFixed(1)}%`} onCommit={(v) => setShare(gi, v)} />
                        <TypeNum id={`swx-${dim}-${gi}-m`} label="Margin" value={cur[gi].mR} show={(v) => fm(v)} parse={parseM} hint={`Forecast ${fm(cur[gi].mR0)}`} onCommit={(v) => setMargin(gi, v)} />
                      </div>
                    </div>
                  ))}
                </div>
              );
            })() : null}
            <div className="sw-groups" hidden={exact}>
              {dimDef.groups.map((g, gi) => {
                const [share, mg] = data.nat[di][gi];
                const sm = sc.shifts[dim].m[gi], st = sc.shifts[dim].t[gi];
                const id = `sw-${dim}-${gi}`;
                return (
                  <div key={g} className="sw-g">
                    <div className="sw-g-h">
                      <b>{g}</b>
                      <span className="mono">{share.toFixed(0)}% of voters</span>
                      <span className={`mono ${mg >= 0 ? "d" : "r"}`}>{fm(-mg)}</span>
                    </div>
                    <div className="sw-sl">
                      <label htmlFor={`${id}-m`}>Vote margin</label>
                      <output className={`mono ${sm > 0 ? "d" : sm < 0 ? "r" : ""}`}>{shiftLabel(sm)}</output>
                      <input id={`${id}-m`} type="range" className="sw-range m" min={-20} max={20} step={0.5} value={sm}
                        aria-valuetext={shiftLabel(sm)} onChange={(e) => setGroup(dim, gi, "m", Number(e.target.value))} />
                    </div>
                    <div className="sw-sl">
                      <label htmlFor={`${id}-t`}>Turnout</label>
                      <output className="mono">{st ? `${st > 0 ? "+" : "−"}${Math.abs(st)}%` : "Forecast"}</output>
                      <input id={`${id}-t`} type="range" className="sw-range t" min={-40} max={40} step={1} value={st}
                        aria-valuetext={st ? `${st} percent` : "Forecast turnout"} onChange={(e) => setGroup(dim, gi, "t", Number(e.target.value))} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="sw-acts">
              <button className="btn sm" onClick={() => resetDim(dim)} disabled={!active.includes(dim)}>Reset {dimDef.label.toLowerCase()}</button>
              <button className="btn sm" onClick={resetAll} disabled={zero}>Back to the forecast</button>
              <button className="btn sm g" onClick={copy} disabled={zero}>Share this scenario</button>
            </div>

            <p className="sw-fine">Shares and margins shown are the forecast electorate across the states with a Senate or governor race. High propensity means the model gives that kind of voter at least an 80% chance of voting; low propensity covers everyone below. Changes in different breakdowns add together, and the same voter can sit in more than one.</p>
          </div>
        </aside>

        {/* race focus and map */}
        <div className="sw-main">
          <section className="card sw-mapcard" aria-label="Map of your scenario">
            <div className="card-h">
              <h3>The map</h3>
              <div className="seg" role="tablist" aria-label="Map">
                {(["s", "g", "h"] as Office[]).map((o) => <button key={o} role="tab" aria-selected={mapO === o} className={mapO === o ? "on" : undefined} onClick={() => setMapO(o)}>{o === "g" ? "Governors" : OFFICE[o]}</button>)}
              </div>
            </div>
            <div className="card-b">
              <USMap moved={moved} office={mapO} onPick={(id) => { setOffice(mapO); setFocus(id); document.querySelector(".sw-focus")?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }} />
              <div className="sw-legend">
                {[0.97, 0.85, 0.7, 0.5, 0.3, 0.15, 0.03].map((p, i) => <span key={i}><i style={{ background: probFill(p) }} />{["Safe D", "Likely D", "Lean D", "Toss up", "Lean R", "Likely R", "Safe R"][i]}</span>)}
                <span><i className="flip" />Favorite changed</span>
                {mapO !== "h" ? <span><i className="hatch" />No race</span> : null}
              </div>
            </div>
          </section>
          <section className="card sw-focus" aria-label="One race in your scenario">
            <div className="card-h">
              <h3>Watch a race</h3>
              <div className="seg" role="tablist" aria-label="Office">
                {(["s", "g", "h"] as Office[]).map((o) => <button key={o} role="tab" aria-selected={office === o} className={office === o ? "on" : undefined} onClick={() => { setOffice(o); setFocus(""); }}>{OFFICE[o]}</button>)}
              </div>
            </div>
            <div className="card-b">
              <label className="sw-pick">
                <span className="eye">Race</span>
                <select value={fid} onChange={(e) => setFocus(e.target.value)}>
                  {pool.map((r) => <option key={r.id} value={r.id}>{r.o === "h" ? r.name : `${r.name} ${r.o === "s" ? "Senate" : "governor"}`} · {fm(r.m, r.ind)}</option>)}
                </select>
              </label>
              {fm0 ? <Focus m={fm0} dims={data.dims} /> : null}
            </div>
          </section>

        </div>
      </div>

      <section className="card sw-movers" aria-label="Races that moved most">
        <div className="card-h">
          <h3>What changed</h3>
          <span className="eye" style={{ marginLeft: "auto" }}>{zero ? "Move a slider to see races move" : `Senate and governor races moved ${Math.abs(avgD).toFixed(1)} points toward ${avgD >= 0 ? "Democrats" : "Republicans"} on average`}</span>
        </div>
        {movers.length ? (
          <div className="tblwrap">
            <table className="tbl">
              <thead><tr><th>Race</th><th>Office</th><th style={{ textAlign: "right" }}>Forecast</th><th style={{ textAlign: "right" }}>Your scenario</th><th style={{ textAlign: "right" }}>Margin change</th><th>Favorite</th></tr></thead>
              <tbody>
                {movers.map((m) => {
                  const flip = (m.r.pD >= 0.5) !== (m.pD >= 0.5);
                  return (
                    <tr key={m.r.id}>
                      <td><button className="sw-link" onClick={() => { setOffice(m.r.o); setFocus(m.r.id); document.querySelector(".sw-focus")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>{m.r.o === "h" ? m.r.name : m.r.name}</button></td>
                      <td>{OFFICE[m.r.o]}</td>
                      <td className="n">{fm(m.r.m, m.r.ind)} · D {pct(m.r.pD)}</td>
                      <td className="n"><b>{fm(m.r.m - m.d, m.r.ind)} · D {pct(m.pD)}</b></td>
                      <td className={`n ${m.d > 0 ? "d" : "r"}`}>{fm(-m.d).replace("Even", "0.0")}</td>
                      <td>{flip ? <span className={`pill ${m.pD >= 0.5 ? "d" : "r"}`}>Flips to {m.pD >= 0.5 ? (m.r.ind ? "independent" : "Democrats") : "Republicans"}</span> : <span className="sw-mute">No change</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="card-b sw-empty">Every race is at its forecast. Pick a group on the left, or try a scenario, and the races that move most will appear here.</div>}
      </section>

      {toast ? <div className="sw-toast" role="status">{toast}</div> : null}
    </div>
  );
}

function ChamberCard({ name, c, unit, note }: { name: string; c: { ctrl: number; base: number; seats: number; baseSeats: number; thr: number; total: number; flipsD: number; flipsR: number; hemi: HemiSeat[]; hold: number }; unit: string; note: string }) {
  const dc = c.ctrl - c.base, ds = c.seats - c.baseSeats;
  const fav = c.ctrl >= 0.5;
  return (
    <div className="card sw-chc">
      <div className="card-h"><h3>{name}</h3><span className="eye" style={{ marginLeft: "auto" }}>{note}</span></div>
      <div className="card-b">
        <div className="sw-chc-top">
          <div>
            <div className="sw-big"><b className={`mono ${fav ? "d" : "r"}`}><Num v={(fav ? c.ctrl : 1 - c.ctrl) * 100} f={(x) => `${x > 99.5 ? ">99" : x < 0.5 ? "<1" : Math.round(x)}%`} /></b><span>{fav ? "Democratic" : "Republican"} control</span></div>
            <div className="sw-sub">
              Forecast {pct(c.base)} D
              {Math.abs(dc) >= 0.005 ? <span className={`sw-chg ${dc > 0 ? "d" : "r"}`}>{dc > 0 ? "+" : "−"}{Math.abs(Math.round(dc * 100))} pts</span> : null}
            </div>
          </div>
          <div className="sw-seats">
            <b className="mono d"><Num v={c.seats} f={(x) => x.toFixed(1)} /></b>
            <span>Democratic {unit} on average</span>
            <small className={`mono ${ds > 0.05 ? "d" : ds < -0.05 ? "r" : ""}`}>{Math.abs(ds) >= 0.05 ? `${sgn(ds)} from forecast` : "Forecast"}</small>
          </div>
        </div>
        <div className="sw-ctrlbar" aria-hidden="true"><i style={{ width: `${c.ctrl * 100}%` }} /><s style={{ left: `${c.base * 100}%` }} /></div>
        <Hemicycle seats={c.hemi} majority={c.thr} size={420} />
        {c.hold ? <div className="sw-hold">Hollow seats are not on the ballot this year</div> : null}
        <div className="sw-flips">
          {c.flipsD || c.flipsR ? <>{c.flipsD ? <span className="d">{c.flipsD} {c.flipsD === 1 ? "seat flips" : "seats flip"} to Democrats</span> : null}{c.flipsR ? <span className="r">{c.flipsR} {c.flipsR === 1 ? "seat flips" : "seats flip"} to Republicans</span> : null}</> : <span>No favorite changes from the forecast</span>}
        </div>
      </div>
    </div>
  );
}

function Focus({ m, dims }: { m: Moved; dims: SwingData["dims"] }) {
  const r = m.r;
  const v = r.v;
  const total = v ? v[3] * m.f : 0;
  const dS = v ? v[0] / v[3] + m.d / 200 : 0, rS = v ? v[1] / v[3] - m.d / 200 : 0;
  const oS = v ? Math.max(0, 1 - dS - rS) : 0;
  const mR = r.m - m.d;
  const parts = m.parts.map((p, i) => [dims[i].label, p] as [string, number]).filter(([, p]) => Math.abs(p) >= 0.05);
  if (m.d - m.parts.reduce((a, b) => a + b, 0) !== 0 && Math.abs(m.d - m.parts.reduce((a, b) => a + b, 0)) >= 0.05) parts.unshift(["Every voter", m.d - m.parts.reduce((a, b) => a + b, 0)]);
  const maxP = Math.max(1, ...parts.map(([, p]) => Math.abs(p)));
  const dc = r.ind ? "var(--ind)" : "var(--dem)";
  return (
    <div className="sw-f">
      <div className="sw-f-head">
        <div>
          <Link href={r.href} className="sw-f-name">{r.o === "h" ? r.name : `${r.name} ${OFFICE[r.o]}`}</Link>
          <div className="sw-sub">Forecast {fm(r.m, r.ind)}, Democratic side {pct(r.pD)}{r.est ? " · electorate estimated from the state" : ""}</div>
        </div>
        <div className="sw-f-odds">
          <b className={`mono ${m.pD >= 0.5 ? "d" : "r"}`}><Num v={(m.pD >= 0.5 ? m.pD : 1 - m.pD) * 100} f={(x) => `${x > 99.5 ? ">99" : x < 0.5 ? "<1" : Math.round(x)}%`} /></b>
          <span>{m.pD >= 0.5 ? (r.ind ? "Independent" : "Democrat") : "Republican"} wins</span>
        </div>
      </div>
      <div className="sw-cands">
        {[[r.dem, dS, v ? total * dS : 0, dc, r.ind ? "Independent" : "Democrat"], [r.gop, rS, v ? total * rS : 0, "var(--gop)", "Republican"]].map(([nm, s, vv, col, tag]) => (
          <div key={String(tag)} className="sw-cand">
            <div className="sw-cand-n"><b>{String(nm)}</b><small>{String(tag)}</small></div>
            <div className="sw-cand-bar"><i style={{ width: `${clamp(Number(s), 0, 1) * 100}%`, background: String(col) }} /></div>
            <div className="sw-cand-v mono"><b><Num v={Number(s) * 100} f={(x) => `${x.toFixed(1)}%`} /></b><small>{v ? <><Num v={Number(vv)} /> votes</> : "Votes not published"}</small></div>
          </div>
        ))}
        {v && oS > 0.002 ? <div className="sw-other mono">Other candidates {(oS * 100).toFixed(1)}%</div> : null}
      </div>
      <div className="sw-f-stats">
        <div><span>Margin</span><b className={`mono ${mR < 0 ? "d" : "r"}`}><Num v={mR} f={(x) => fm(x, r.ind)} /></b></div>
        <div><span>Change</span><b className={`mono ${m.d > 0 ? "d" : m.d < 0 ? "r" : ""}`}>{Math.abs(m.d) < 0.05 ? "None" : fm(-m.d)}</b></div>
        <div><span>Total votes</span><b className="mono">{v ? <Num v={total} /> : "None"}</b></div>
      </div>
      {parts.length ? (
        <div className="sw-parts">
          <div className="eye">What moved this race</div>
          {parts.map(([k, p]) => (
            <div key={k} className="sw-part"><span>{k}</span><span className="sw-part-bar"><i className={p > 0 ? "d" : "r"} style={{ width: `${(Math.abs(p) / maxP) * 50}%`, [p > 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span><b className={`mono ${p > 0 ? "d" : "r"}`}>{fm(-p)}</b></div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

type Geo = { frame: [number, number]; states: Record<string, string>; districts: Record<string, { d: string }> };
let geoCache: Promise<Geo> | null = null;
const loadGeo = () => (geoCache ??= fetch("/forecast/geo.json").then((r) => r.json()));
const STATE_NAMES: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };

function USMap({ moved, office, onPick }: { moved: Moved[]; office: Office; onPick: (id: string) => void }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hover, setHover] = useState<string>("");
  useEffect(() => { let on = true; loadGeo().then((g) => { if (on) setGeo(g); }).catch(() => {}); return () => { on = false; }; }, []);
  const by = useMemo(() => new Map(moved.map((m) => [m.r.id, m])), [moved]);
  if (!geo) return <div className="sw-mapload">Loading the map</div>;
  const [W, H] = geo.frame;
  const pre = office === "s" ? "sen" : "gov";
  const label = (m: Moved | undefined, fallback: string) => {
    if (!m) return fallback;
    const nm = m.r.o === "h" ? m.r.name : `${m.r.name} ${m.r.o === "s" ? "Senate" : "governor"}`;
    if (!m.r.x) return `${nm}: uncontested`;
    const side = m.r.ind ? "Independent" : "Democrat";
    return `${nm}: ${side} ${pct(m.pD)}, Republican ${pct(1 - m.pD)} · the forecast had the ${side.toLowerCase()} at ${pct(m.r.pD)}`;
  };
  const hm = hover ? by.get(hover) : undefined;
  const flipped = (m: Moved | undefined) => !!m && (m.r.pD >= 0.5) !== (m.pD >= 0.5);
  const fill = (m: Moved | undefined) => (m ? (m.r.ind && m.pD >= 0.5 ? "#b78cff" : probFill(m.pD)) : "url(#sw-hatch)");
  return (
    <div className="sw-map">
      <div className="sw-maphover" aria-live="polite">{hover ? label(hm, hover.startsWith("st-") ? `${STATE_NAMES[hover.slice(3)] ?? hover.slice(3)}: no ${office === "s" ? "Senate" : "governor"} race in 2026` : hover) : `Hover or tap a ${office === "h" ? "district" : "state"} for its odds · click to watch the race`}</div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${office === "h" ? "House districts" : office === "s" ? "Senate races" : "Governor races"} in your scenario`} onMouseLeave={() => setHover("")}>
        <defs>
          <pattern id="sw-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="rgba(var(--line-rgb),.05)" /><line x1="0" y1="0" x2="0" y2="6" stroke="rgba(var(--line-rgb),.16)" strokeWidth="2" />
          </pattern>
        </defs>
        {office === "h" ? (
          <>
            {Object.entries(geo.districts).map(([id, g]) => {
              const m = by.get(id);
              return <path key={id} d={g.d} fill={fill(m)} stroke="var(--bg)" strokeWidth={0.3} className="sw-shape"
                onMouseEnter={() => setHover(id)} onClick={() => m?.r.x && onPick(id)} style={{ cursor: m?.r.x ? "pointer" : "default" }} />;
            })}
            {Object.entries(geo.states).map(([st, d]) => <path key={st} d={d} fill="none" stroke="var(--bg)" strokeWidth={1.1} pointerEvents="none" />)}
            {Object.entries(geo.districts).filter(([id]) => flipped(by.get(id))).map(([id, g]) => <path key={`f${id}`} d={g.d} fill="none" stroke="var(--gold)" strokeWidth={1.4} pointerEvents="none" />)}
          </>
        ) : (
          <>
            {Object.entries(geo.states).map(([st, d]) => {
              const id = `${pre}-${st}`, m = by.get(id);
              return <path key={st} d={d} fill={fill(m)} stroke="var(--bg)" strokeWidth={0.9} className="sw-shape"
                onMouseEnter={() => setHover(m ? id : `st-${st}`)} onClick={() => m?.r.x && onPick(id)} style={{ cursor: m?.r.x ? "pointer" : "default" }} />;
            })}
            {Object.entries(geo.states).filter(([st]) => flipped(by.get(`${pre}-${st}`))).map(([st, d]) => <path key={`f${st}`} d={d} fill="none" stroke="var(--gold)" strokeWidth={2.4} pointerEvents="none" />)}
          </>
        )}
      </svg>
    </div>
  );
}
