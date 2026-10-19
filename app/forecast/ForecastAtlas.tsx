"use client";

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  type CountiesPayload, type CountyRow, type Model, type Office, type Race, type StateDetail,
  fmtMargin, fmtPct, marginColor, surname, fmtRaceMargin, sideColor,
} from "./lib";
import { VoteTip } from "./Tips";

// ─────────────────────────────────────────────────────────────────────────────
// The county atlas. Every county in the country on a black stage, colored by
// whichever layer the reader picks: the forecast itself, the swing from 2024,
// gas prices, data centers, jobs, growth, migration, faith, news deserts and the
// On Point Polling low propensity voter segments. Click a state, or let the tour run, and the
// map flies into that state's own county geometry.
// Data: /forecast/atlas/us.json from scripts/forecast/build_atlas.py, plus the
// county forecasts the desk already loads from /forecast/counties.json.
// ─────────────────────────────────────────────────────────────────────────────

type Num = number | null;
type Row = (string | number | null)[];
interface LayerDef { key: string; label: string; unit: string; kind: "div" | "seq"; pal: string; note: string }
interface AtlasData {
  built: string;
  layers: LayerDef[];
  cols: string[];
  counties: Row[];
  centers: [string, string, number, number, number, number, string, string][];
  states: Record<string, Num[]>;
  xf: Record<string, [number, number, number]>;
}
interface County {
  f: string; st: string; name: string; pop: number; d: string; cx: number;
  v: Record<string, Num>;
}
type FcOffice = "senate" | "governor" | "house";

const W = 975, H = 610, SW = 900, SH = 620;

const STATE_NAME: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
  IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
  NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
  NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
  RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
  VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

// The states a viewer is most likely to want first, in tour order.
const TOUR = ["GA", "MI", "NC", "ME", "IA", "TX", "OH", "AZ", "WI", "PA", "NV", "NH", "AK", "NE", "VA"];

// Layer groups for the rail. "fc" and "shift" are computed here from the county forecast.
const GROUPS: { name: string; keys: string[] }[] = [
  { name: "Forecast", keys: ["fc", "shift", "turn", "loc"] },
  { name: "Voters", keys: ["p24", "lpT", "lpH"] },
  { name: "Economy", keys: ["gas", "gasr", "gasx", "emp", "wage", "tariff"] },
  { name: "Data centers", keys: ["dc", "dcx"] },
  { name: "Places", keys: ["popg", "mig", "rural", "evang", "news"] },
];
const SHORT: Record<string, string> = {
  fc: "Forecast", shift: "Swing from 2024", turn: "Turnout", loc: "Local conditions", p24: "2024 result",
  lpT: "Low prop. Trump", lpH: "Low prop. Harris", gas: "Gas price", emp: "Job growth", wage: "Wage growth",
  tariff: "Tariff exposure", dc: "Data centers", dcx: "Data center pull", gasr: "Gas price rise", gasx: "Gas price rise pull", popg: "Population growth", mig: "Immigration", rural: "Rurality",
  evang: "Evangelical", news: "Local news",
};

// Sequential palettes on black: dark at the low end so the high end glows.
const PAL: Record<string, string[]> = {
  fuel: ["#1c1405", "#5e3b06", "#b86f08", "#ffa51f", "#ffe3a1"],
  grid: ["#06171d", "#07465a", "#0b93b8", "#4fe0ff", "#e4fcff"],
  heat: ["#1d0b05", "#5c1e07", "#c2470f", "#ff8a3d", "#ffd9bd"],
  cool: ["#05171b", "#0b4549", "#118781", "#3fd3be", "#d2fff4"],
  earth: ["#17110a", "#4a361b", "#8e6a37", "#c9a56d", "#f2e2c2"],
  red: ["#1d060b", "#5c0f21", "#b0163a", "#ff3b5c", "#ffc6d0"],
  blue: ["#060c22", "#11276a", "#2152d6", "#6497ff", "#d2dfff"],
};
const GROW_NEG = ["#ffb057", "#b8641c", "#3a2a1e"], GROW_POS = ["#2c3a37", "#1f9d8b", "#62f0d6"];
const ACCENT: Record<string, string> = {
  fuel: "#ffa51f", grid: "#4fe0ff", heat: "#ff8a3d", cool: "#3fd3be", earth: "#c9a56d", red: "#ff3b5c", blue: "#6497ff",
  party: "#b9a7ff", growth: "#3fd3be",
};
const IDLE = "#121019";

function hex(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function lerpStops(stops: string[], t: number) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i;
  const a = hex(stops[i]), b = hex(stops[i + 1]);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

function quantile(sorted: number[], q: number) {
  if (!sorted.length) return 0;
  const i = (sorted.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
}

const countyLabel = (nm: string) =>
  /\b(county|city|parish|borough|census area|municipality|municipio|planning region)\b/i.test(nm) ? nm : `${nm} County`;

const commas = (n: number) => Math.round(n).toLocaleString("en-US");

// ── formatting by layer ──────────────────────────────────────────────────────
function fmtVal(key: string, v: Num): string {
  if (v == null || !Number.isFinite(v)) return "No data";
  switch (key) {
    case "fc": case "p24": case "loc": case "dcx": case "gasx": return fmtMargin(v);
    case "shift": return Math.abs(v) < 0.05 ? "No swing" : `${v > 0 ? "R" : "D"}+${Math.abs(v).toFixed(1)} swing`;
    case "gas": return `$${v.toFixed(2)}`;
    case "gasr": return `+$${v.toFixed(2)}`;
    case "dc": return v === 1 ? "1 site" : `${commas(v)} sites`;
    case "emp": case "wage": case "popg": return `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
    case "tariff": return v.toFixed(2);
    case "rural": return v <= 3 ? `Metro, code ${v}` : `Nonmetro, code ${v}`;
    case "news": return `${v.toFixed(1)} per 100k`;
    default: return `${v.toFixed(1)}%`;
  }
}

interface Scale { color: (v: Num) => string; ramp: string; lo: string; hi: string; accent: string; dom: [number, number] }

function buildScale(def: LayerDef, vals: number[]): Scale {
  const s = [...vals].sort((a, b) => a - b);
  if (def.pal === "party") {
    const m = Math.max(4, quantile(s.map(Math.abs).sort((a, b) => a - b), 0.95));
    const k = def.key === "p24" || def.key === "fc" ? 40 / Math.max(m, 40) : 40 / m;
    const ramp = `linear-gradient(90deg,${marginColor(-40)} 0%,${marginColor(-12)} 30%,${marginColor(-0.5)} 49%,${marginColor(0.5)} 51%,${marginColor(12)} 70%,${marginColor(40)} 100%)`;
    const span = def.key === "p24" || def.key === "fc" ? Math.max(m, 40) : m;
    return {
      color: (v) => (v == null ? IDLE : marginColor(v * k)), ramp, accent: ACCENT.party,
      lo: `D+${span.toFixed(0)}`, hi: `R+${span.toFixed(0)}`, dom: [-span, span],
    };
  }
  if (def.pal === "growth") {
    const m = Math.max(0.5, quantile(s.map(Math.abs).sort((a, b) => a - b), 0.95));
    const ramp = `linear-gradient(90deg,${GROW_NEG[0]} 0%,${GROW_NEG[1]} 28%,${GROW_NEG[2]} 50%,${GROW_POS[1]} 72%,${GROW_POS[2]} 100%)`;
    return {
      color: (v) => (v == null ? IDLE : v < 0 ? lerpStops([GROW_NEG[2], GROW_NEG[1], GROW_NEG[0]], -v / m) : lerpStops(GROW_POS, v / m)),
      ramp, accent: ACCENT.growth, lo: fmtVal(def.key, -m), hi: fmtVal(def.key, m), dom: [-m, m],
    };
  }
  const stops = PAL[def.pal] ?? PAL.cool;
  const ramp = `linear-gradient(90deg,${stops.join(",")})`;
  if (def.key === "dc") {
    const mx = Math.max(2, s[s.length - 1] ?? 2);
    return {
      color: (v) => (v == null || v <= 0 ? IDLE : lerpStops(stops, 0.25 + 0.75 * Math.log1p(v) / Math.log1p(mx))),
      ramp, accent: ACCENT.grid, lo: "1 site", hi: `${commas(mx)} sites`, dom: [0, mx],
    };
  }
  const lo = quantile(s, 0.02), hi = quantile(s, 0.98);
  const span = hi - lo || 1;
  return {
    color: (v) => (v == null ? IDLE : lerpStops(stops, (v - lo) / span)),
    ramp, accent: ACCENT[def.pal] ?? "#3fd3be", lo: fmtVal(def.key, lo), hi: fmtVal(def.key, hi), dom: [lo, hi],
  };
}

// ── data ─────────────────────────────────────────────────────────────────────
const cache = new Map<string, unknown>();
function useFetch<T>(url: string | null): T | null {
  const [d, setD] = useState<T | null>(() => (url && cache.has(url) ? (cache.get(url) as T) : null));
  useEffect(() => {
    if (!url) { setD(null); return; }
    if (cache.has(url)) { setD(cache.get(url) as T); return; }
    let live = true;
    setD(null);
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) cache.set(url, j); if (live) setD(j); }).catch(() => { if (live) setD(null); });
    return () => { live = false; };
  }, [url]);
  return d;
}

function prefetch(url: string) {
  if (cache.has(url)) return;
  fetch(url).then((r) => (r.ok ? r.json() : null)).then((j) => { if (j) cache.set(url, j); }).catch(() => undefined);
}

function useCountUp(target: number, ms = 1100) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setV(target); return; }
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - p, 3);
      setV(target * e); if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

function TipPortal({ children }: { children: React.ReactNode }) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  useEffect(() => { setHost(document.body); return () => setHost(null); }, []);
  return host ? createPortal(children, host) : null;
}

// ── the county layer, memoized so hover never repaints 3,000 paths ───────────
const CountyPaths = memo(function CountyPaths({ rows, fill, sweep, frameW, dim }: {
  rows: { f: string; d: string; cx: number }[]; fill: Map<string, string>; sweep: number; frameW: number; dim?: (f: string) => boolean;
}) {
  return (
    <>
      {rows.map((c) => (
        <path
          key={c.f} d={c.d} data-f={c.f}
          className={`atl-c${dim && dim(c.f) ? " dim" : ""}`}
          style={{ fill: fill.get(c.f) ?? IDLE, transitionDelay: `${Math.round((c.cx / frameW) * sweep)}ms` }}
        />
      ))}
    </>
  );
});

// ── main component ───────────────────────────────────────────────────────────
export default function ForecastAtlas({ model, counties, office, onPickRace, statePaths, embedded = false }: {
  model: Model; counties: CountiesPayload | null; office: Office; onPickRace: (id: string) => void;
  statePaths: Record<string, string>;
  // inside the desk's map card the office comes from the card's own switch
  embedded?: boolean;
}) {
  const atlas = useFetch<AtlasData>("/forecast/atlas/us.json");
  const [layer, setLayer] = useState<string>("fc");
  // the forecast layer follows the desk's office until the reader picks one here
  const [fcPick, setFcOffice] = useState<FcOffice | null>(null);
  const deskOffice: FcOffice = office === "governor" ? "governor" : office === "house" ? "house" : "senate";
  const fcOffice: FcOffice = embedded ? deskOffice : fcPick ?? deskOffice;
  const [dots, setDots] = useState(true);
  const [lines, setLines] = useState(true);
  const [scope, setScope] = useState<string | null>(null);   // state on screen, null for the nation
  const [zoom, setZoom] = useState<string | null>(null);     // state the national map is flying toward
  const [leaving, setLeaving] = useState<string | null>(null); // state the map is flying back out of
  const [touring, setTouring] = useState(false);
  const [tourIx, setTourIx] = useState(0);
  const [hover, setHover] = useState<{ f: string; x: number; y: number } | null>(null);
  const [dcHover, setDcHover] = useState<{ i: number; x: number; y: number } | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef<SVGGElement | null>(null);
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => { timers.current.forEach(clearTimeout); }, []);

  const detail = useFetch<StateDetail>(scope ? `/forecast/states/${scope}.json` : null);

  // ── unpack the atlas ──
  const parsed = useMemo(() => {
    if (!atlas) return null;
    const ix = (k: string) => atlas.cols.indexOf(k);
    const iF = ix("fips"), iS = ix("st"), iN = ix("name"), iP = ix("pop"), iD = ix("d");
    const keys = atlas.layers.map((l) => l.key);
    const rows: County[] = atlas.counties.map((r) => {
      const d = String(r[iD]);
      const m = /M(-?\d+(?:\.\d+)?)/.exec(d);
      const v: Record<string, Num> = {};
      keys.forEach((k) => { const x = r[ix(k)]; v[k] = typeof x === "number" ? x : null; });
      return { f: String(r[iF]), st: String(r[iS]), name: String(r[iN]), pop: Number(r[iP]) || 0, d, cx: m ? parseFloat(m[1]) : 0, v };
    });
    const byF = new Map(rows.map((c) => [c.f, c]));
    const defs = new Map(atlas.layers.map((l) => [l.key, l]));
    return { rows, byF, defs };
  }, [atlas]);

  // county forecast for the chosen office, GOP positive
  const fcRows = useMemo(() => {
    const out = new Map<string, CountyRow>();
    if (!counties) return out;
    const pre = fcOffice === "senate" ? "sen-" : fcOffice === "governor" ? "gov-" : "house-";
    for (const [k, v] of Object.entries(counties)) {
      if (!k.startsWith(pre) || !v || Array.isArray(v)) continue;
      // Nebraska's and other special Senate seats carry a suffix; the first race found in a state wins
      for (const [f, row] of Object.entries(v as Record<string, CountyRow>)) if (Array.isArray(row) && !out.has(f)) out.set(f, row);
    }
    return out;
  }, [counties, fcOffice]);

  const raceByState = useMemo(() => {
    const m = new Map<string, Race[]>();
    for (const r of model.races) {
      const arr = m.get(r.st) ?? []; arr.push(r); m.set(r.st, arr);
    }
    return m;
  }, [model]);

  const def: LayerDef | null = useMemo(() => {
    if (!parsed) return null;
    if (layer === "fc") {
      const o = fcOffice === "senate" ? "Senate" : fcOffice === "governor" ? "governor" : "House vote";
      return { key: "fc", label: `2026 ${o} forecast`, unit: "pts", kind: "div", pal: "party", note: `The projected ${fcOffice === "house" ? "statewide House" : o} margin in every county with a race on the ballot` };
    }
    if (layer === "shift") return { key: "shift", label: "Swing from 2024", unit: "pts", kind: "div", pal: "party", note: `How far the 2026 ${fcOffice === "house" ? "House vote" : fcOffice === "senate" ? "Senate" : "governor"} forecast moves from the Trump against Harris margin` };
    const d = parsed.defs.get(layer);
    if (!d) return null;
    const pal = d.pal === "growth" || d.pal === "party" ? d.pal : d.pal;
    return { ...d, pal: d.kind === "div" && d.pal !== "party" ? "growth" : pal };
  }, [parsed, layer, fcOffice]);

  const valueOf = useCallback((c: County): Num => {
    if (layer === "fc") { const r = fcRows.get(c.f); return r ? r[0] : null; }
    if (layer === "shift") { const r = fcRows.get(c.f); return r && c.v.p24 != null ? r[0] - c.v.p24 : null; }
    return c.v[layer] ?? null;
  }, [layer, fcRows]);

  const scopeRows = useMemo(() => (parsed ? (scope ? parsed.rows.filter((c) => c.st === scope) : parsed.rows) : []), [parsed, scope]);

  // Margins keep the national scale so a state's reds and blues mean what they mean nationally.
  // Every other layer stretches to the state on screen, so a narrow range inside one state still reads.
  const localScale = !!scope && def?.pal !== "party";
  const scale = useMemo(() => {
    if (!parsed || !def) return null;
    const src = localScale ? scopeRows : parsed.rows;
    const vals = src.map(valueOf).filter((v): v is number => v != null && Number.isFinite(v));
    return buildScale(def, vals.length ? vals : [0, 1]);
  }, [parsed, def, valueOf, localScale, scopeRows]);

  const fill = useMemo(() => {
    const m = new Map<string, string>();
    if (!parsed || !scale) return m;
    for (const c of parsed.rows) m.set(c.f, scale.color(valueOf(c)));
    return m;
  }, [parsed, scale, valueOf]);

  // ── scope stats ──
  const stats = useMemo(() => {
    if (!scale || !def) return null;
    const vals: { c: County; v: number }[] = [];
    let wsum = 0, vsum = 0;
    for (const c of scopeRows) {
      const v = valueOf(c);
      if (v == null || !Number.isFinite(v)) continue;
      vals.push({ c, v });
      const w = layer === "fc" || layer === "shift" ? (fcRows.get(c.f)?.[3] ?? c.pop) : c.pop || 1;
      wsum += w; vsum += w * v;
    }
    const total = layer === "dc" ? vals.reduce((a, b) => a + b.v, 0) : null;
    const avg = wsum > 0 ? vsum / wsum : null;
    const sorted = [...vals].sort((a, b) => b.v - a.v);
    const top = (layer === "dc" ? sorted.filter((x) => x.v > 0) : sorted).slice(0, 5);
    const bottom = layer === "dc" ? [] : sorted.slice(-5).reverse();
    // histogram on the national domain
    const [lo, hi] = scale.dom;
    const N = 30, bins = new Array(N).fill(0);
    for (const { v } of vals) {
      const t = (v - lo) / (hi - lo || 1);
      bins[Math.max(0, Math.min(N - 1, Math.floor(t * N)))] += 1;
    }
    return { n: vals.length, avg, total, top, bottom, bins, lo, hi };
  }, [scopeRows, valueOf, scale, def, layer, fcRows]);

  const centers = useMemo(() => {
    if (!atlas) return [];
    return scope ? atlas.centers.map((c, i) => ({ c, i })).filter(({ c }) => c[1] === scope) : atlas.centers.map((c, i) => ({ c, i }));
  }, [atlas, scope]);

  // ── navigation: fly into a state, fly back out ──
  const geoBox = (st: string): [number, number, number, number] | null => {
    if (!parsed) return null;
    const rows = parsed.rows.filter((c) => c.st === st);
    if (!rows.length) return null;
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const c of rows) {
      const nums = c.d.match(/-?\d+(?:\.\d+)?/g);
      if (!nums) continue;
      for (let i = 0; i + 1 < nums.length; i += 2) {
        const x = +nums[i], y = +nums[i + 1];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
    return [x0, y0, x1 - x0, y1 - y0];
  };
  const zoomXf = (st: string | null) => {
    if (!st) return "translate(0px,0px) scale(1)";
    const b = geoBox(st);
    if (!b) return "translate(0px,0px) scale(1)";
    const s = Math.min(W / b[2], H / b[3]) * 0.86;
    const tx = W / 2 - s * (b[0] + b[2] / 2), ty = H / 2 - s * (b[1] + b[3] / 2);
    return `translate(${tx.toFixed(1)}px,${ty.toFixed(1)}px) scale(${s.toFixed(3)})`;
  };
  const goState = useCallback((st: string) => {
    setHover(null); setDcHover(null); setPin(null);
    if (scope === st) return;
    if (scope) { prefetch(`/forecast/states/${st}.json`); setScope(st); return; }
    prefetch(`/forecast/states/${st}.json`);
    setZoom(st);
    later(() => { setScope(st); setZoom(null); }, 640);
  }, [scope]);
  const goNation = useCallback(() => {
    setHover(null); setDcHover(null); setPin(null);
    const was = scope;
    setScope(null); setTouring(false);
    if (was) setLeaving(was);
  }, [scope]);

  // the tour flies state to state on its own until the reader takes over
  useEffect(() => {
    if (!touring) return;
    const st = TOUR[tourIx % TOUR.length];
    goState(st);
    const t = window.setTimeout(() => setTourIx((i) => i + 1), 6500);
    return () => clearTimeout(t);
  }, [touring, tourIx]); // eslint-disable-line react-hooks/exhaustive-deps
  const stopTour = () => setTouring(false);

  // The flight in and out runs on the Web Animations API: the national county layer
  // scales toward the state's box, then the state's own geometry takes over.
  const flyTarget = zoom ?? (scope && !(detail && detail.st === scope) ? scope : null);
  useEffect(() => {
    const g = zoomRef.current;
    if (!g || !flyTarget || typeof g.animate !== "function") return;
    const a = g.animate([{ transform: "translate(0px,0px) scale(1)" }, { transform: zoomXf(flyTarget) }],
      { duration: 640, easing: "cubic-bezier(.65,0,.35,1)", fill: "forwards" });
    return () => a.cancel();
  }, [flyTarget]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const g = zoomRef.current;
    if (!leaving) return;
    if (!g || typeof g.animate !== "function") { setLeaving(null); return; }
    const a = g.animate([{ transform: zoomXf(leaving) }, { transform: "translate(0px,0px) scale(1)" }],
      { duration: 720, easing: "cubic-bezier(.65,0,.35,1)" });
    a.onfinish = () => setLeaving(null);
    return () => a.cancel();
  }, [leaving]); // eslint-disable-line react-hooks/exhaustive-deps

  // gentle parallax: the floating map leans toward the cursor
  const onStageMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = stageRef.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
    el.style.setProperty("--ry", `${(px * 5).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${(-py * 4).toFixed(2)}deg`);
  };
  const onStageLeave = () => {
    const el = stageRef.current; if (!el) return;
    el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg");
    setHover(null); setDcHover(null);
  };

  const onPathMove = (e: React.MouseEvent<SVGGElement>) => {
    const t = e.target as Element;
    const f = t.getAttribute?.("data-f");
    if (f) setHover({ f, x: e.clientX, y: e.clientY }); else setHover(null);
  };
  const onPathClick = (e: React.MouseEvent<SVGGElement>) => {
    const f = (e.target as Element).getAttribute?.("data-f");
    if (!f || !parsed) return;
    stopTour();
    const c = parsed.byF.get(f);
    if (!c) return;
    if (!scope) goState(c.st); else setPin((p) => (p === f ? null : f));
  };

  // KPIs for the strip above the stage
  const kpi = useMemo(() => {
    if (!parsed || !atlas) return null;
    let gw = 0, gs = 0, lw = 0, ls = 0, hw = 0, hs = 0;
    for (const c of parsed.rows) {
      if (c.v.gas != null && c.pop) { gw += c.pop; gs += c.pop * c.v.gas; }
      if (c.v.lpT != null && c.pop) { lw += c.pop; ls += c.pop * c.v.lpT; }
      if (c.v.lpH != null && c.pop) { hw += c.pop; hs += c.pop * c.v.lpH; }
    }
    return { gas: gw ? gs / gw : 0, dc: atlas.centers.length, n: parsed.rows.length, lpT: lw ? ls / lw : 0, lpH: hw ? hs / hw : 0 };
  }, [parsed, atlas]);
  const kGas = useCountUp(kpi?.gas ?? 0), kDc = useCountUp(kpi?.dc ?? 0), kN = useCountUp(kpi?.n ?? 0), kLp = useCountUp(kpi?.lpT ?? 0);

  if (!parsed || !def || !scale || !stats || !atlas) {
    return (
      <section className="atl" aria-label="County atlas">
        <div className="atl-head"><span className="atl-eye">County atlas</span><h2>Every county, every layer</h2></div>
        <div className="atl-stage atl-loading"><div className="atl-spin" /><span>Loading 3,141 counties</span></div>
      </section>
    );
  }

  const stateRows = scope && detail && detail.st === scope
    ? detail.counties.map((c) => {
        const id = c.id.startsWith("DC-") ? "11001" : c.id;
        const m = /M(-?\d+(?:\.\d+)?)/.exec(c.d);
        return { f: id, d: c.d, cx: m ? parseFloat(m[1]) : 0 };
      })
    : null;

  const hovered = hover ? parsed.byF.get(hover.f) ?? null : null;
  const pinned = pin ? parsed.byF.get(pin) ?? null : null;
  const focus = hovered ?? pinned;
  const scopeRaces = scope ? (raceByState.get(scope) ?? []).filter((r) => r.office !== "house").sort((a, b) => a.office.localeCompare(b.office)) : [];
  const houseCount = scope ? (raceByState.get(scope) ?? []).filter((r) => r.office === "house").length : 0;
  const layerTitle = def.label;
  const sweep = 520;
  const flyTo = zoom ?? (scope && !stateRows ? scope : null);
  const dimTo = flyTo ?? leaving;
  const statePathFor = (f: string) => stateRows?.find((r) => r.f === f)?.d ?? null;
  const highlightD = focus ? (scope ? statePathFor(focus.f) : focus.d) : null;

  return (
    <section className={`atl${embedded ? " embedded" : ""}`} aria-label="County atlas">
      <div className="atl-head">
        <div>
          <span className="atl-eye">County atlas · {commas(parsed.rows.length)} counties · {commas(atlas.centers.length)} data centers</span>
          {embedded ? null : <h2>Every county, <span className="atl-grad">every layer</span></h2>}
          <p>{embedded ? "Every county under the forecast, or the conditions underneath it. " : "Switch the map between the forecast and the conditions underneath it. "}Click any state to fly in, or let the tour run through the battlegrounds.</p>
        </div>
        <div className="atl-kpis">
          <div className="atl-kpi" style={{ animationDelay: "60ms" }}><b>${kGas.toFixed(2)}</b><span>Average gallon of regular</span></div>
          <div className="atl-kpi" style={{ animationDelay: "140ms" }}><b>{commas(kDc)}</b><span>Data centers mapped</span></div>
          <div className="atl-kpi" style={{ animationDelay: "220ms" }}><b>{kLp.toFixed(1)}%</b><span>Adults who are low propensity Trump voters</span></div>
          <div className="atl-kpi" style={{ animationDelay: "300ms" }}><b>{commas(kN)}</b><span>Counties on the map</span></div>
        </div>
      </div>

      {/* ── layer rail ── */}
      <div className="atl-rail" role="toolbar" aria-label="Map layer">
        {GROUPS.map((g) => (
          <div key={g.name} className="atl-group">
            <span className="atl-gname">{g.name}</span>
            <div className="atl-chips">
              {g.keys.filter((k) => k === "fc" || k === "shift" || parsed.defs.has(k)).map((k) => (
                <button key={k} type="button" className={`atl-chip${layer === k ? " on" : ""}`} aria-pressed={layer === k}
                  onClick={() => { setLayer(k); if (k === "dc") setDots(true); }}>
                  {SHORT[k] ?? k}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="atl-bar">
        {(layer === "fc" || layer === "shift") && embedded ? (
          <span className="atl-note">{def.note}. The office switch above picks the race.</span>
        ) : layer === "fc" || layer === "shift" ? (
          <div className="atl-seg" role="group" aria-label="Forecast race">
            {(["senate", "governor", "house"] as FcOffice[]).map((o) => (
              <button key={o} type="button" className={fcOffice === o ? "on" : ""} aria-pressed={fcOffice === o} onClick={() => setFcOffice(o)}>
                {o === "senate" ? "Senate" : o === "governor" ? "Governor" : "House vote"}
              </button>
            ))}
          </div>
        ) : <span className="atl-note">{def.note}</span>}
        <div className="atl-toggles">
          <label className="atl-tog"><input id="atl-dots" type="checkbox" checked={dots} onChange={(e) => setDots(e.target.checked)} /><i />Data center sites</label>
          <label className="atl-tog"><input id="atl-lines" type="checkbox" checked={lines} onChange={(e) => setLines(e.target.checked)} /><i />State lines</label>
          <button type="button" className={`atl-tour${touring ? " on" : ""}`} onClick={() => { if (touring) stopTour(); else { setTourIx(0); setTouring(true); } }}>
            {touring ? "Stop the tour" : "Tour the battlegrounds"}
          </button>
        </div>
      </div>

      {/* ── the stage ── */}
      <div className="atl-grid">
        <div className="atl-stage" ref={stageRef} onMouseMove={onStageMove} onMouseLeave={onStageLeave} style={{ ["--acc"]: scale.accent } as React.CSSProperties}>
          <div className="atl-crumbs">
            <button type="button" className={scope ? "" : "on"} onClick={goNation}>United States</button>
            {scope ? <><em>/</em><button type="button" className="on">{STATE_NAME[scope] ?? scope}</button></> : null}
            {touring ? <span className="atl-tourbar" key={tourIx}><i /></span> : null}
          </div>
          <div className="atl-floor" />
          <div className="atl-float"><div className="atl-bob">
            {!scope || !stateRows ? (
              <svg key="nation" className={`atl-map nation${dimTo ? " flying" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layerTitle}, every county`}>
                <defs>
                  <filter id="atl-glow" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="1.6" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <g
                  ref={zoomRef}
                  className={`atl-zoomg${flyTo ? " flying" : ""}`}
                  onMouseMove={onPathMove} onClick={onPathClick}
                >
                  <CountyPaths rows={parsed.rows} fill={fill} sweep={sweep} frameW={W} dim={dimTo ? (f) => parsed.byF.get(f)?.st !== dimTo : undefined} />
                  {lines ? <StateLines paths={statePaths} /> : null}
                </g>
                {dots && !flyTo ? (
                  <g className="atl-dots" filter="url(#atl-glow)">
                    {centers.map(({ c, i }) => (
                      <circle key={i} cx={c[2]} cy={c[3]} r={layer === "dc" ? 1.6 : 1.25} className="atl-dot"
                        style={{ animationDelay: `${300 + Math.round((c[2] / W) * 700)}ms` }}
                        onMouseMove={(e) => setDcHover({ i, x: e.clientX, y: e.clientY })} onMouseLeave={() => setDcHover(null)} />
                    ))}
                  </g>
                ) : null}
                {highlightD && !flyTo ? <path d={highlightD} className="atl-halo" /> : null}
              </svg>
            ) : (
              <svg key={`st-${scope}`} className="atl-map state" viewBox={`0 0 ${SW} ${SH}`} role="img" aria-label={`${layerTitle}, ${STATE_NAME[scope] ?? scope} counties`}>
                <defs>
                  <filter id="atl-glow2" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="3" result="b" />
                    <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>
                <g onMouseMove={onPathMove} onClick={onPathClick} className="atl-stateg">
                  <CountyPaths rows={stateRows} fill={fill} sweep={sweep} frameW={SW} />
                </g>
                {dots ? (
                  <g filter="url(#atl-glow2)">
                    {centers.map(({ c, i }, k) => (
                      <g key={i} transform={`translate(${c[4]},${c[5]})`}>
                        <circle r="9" className="atl-ring" style={{ animationDelay: `${500 + k * 25}ms` }} />
                        <circle r={layer === "dc" ? 4.6 : 3.6} className="atl-dot big" style={{ animationDelay: `${450 + k * 25}ms` }}
                          onMouseMove={(e) => setDcHover({ i, x: e.clientX, y: e.clientY })} onMouseLeave={() => setDcHover(null)} />
                      </g>
                    ))}
                  </g>
                ) : null}
                {highlightD ? <path d={highlightD} className="atl-halo st" /> : null}
              </svg>
            )}
          </div></div>

          <div className="atl-legend">
            <span className="atl-ltitle">{layerTitle}</span>
            <div className="atl-lrow">
              <span>{scale.lo}</span>
              <i style={{ background: scale.ramp }} />
              <span>{scale.hi}</span>
            </div>
            {layer === "fc" || layer === "shift" ? <span className="atl-lnote">Gray counties have no {fcOffice === "house" ? "House" : fcOffice} race on the 2026 ballot</span>
              : localScale && scope ? <span className="atl-lnote">Shading stretched to the range inside {STATE_NAME[scope] ?? scope}</span> : null}
          </div>
        </div>

        {/* ── readout ── */}
        <aside className="atl-side" key={`${scope ?? "us"}-${layer}-${fcOffice}`}>
          <span className="atl-eye">{scope ? STATE_NAME[scope] : "United States"}</span>
          <h3>{layerTitle}</h3>
          <div className="atl-big">
            <b>{stats.total != null ? commas(stats.total) : fmtVal(def.key, stats.avg)}</b>
            <span>{stats.total != null ? `data center sites ${scope ? "in the state" : "nationwide"}` : layer === "fc" || layer === "shift" ? "weighted by projected votes" : "population weighted average"}</span>
          </div>
          <div className="atl-hist" aria-hidden>
            {stats.bins.map((n, i) => {
              const mx = Math.max(...stats.bins, 1);
              const v = stats.lo + ((i + 0.5) / stats.bins.length) * (stats.hi - stats.lo);
              return <i key={i} style={{ height: `${Math.max(2, (n / mx) * 100)}%`, background: scale.color(v), animationDelay: `${i * 18}ms` }} />;
            })}
            {focus && valueOf(focus) != null ? (
              <u style={{ left: `${Math.max(0, Math.min(100, ((valueOf(focus)! - stats.lo) / (stats.hi - stats.lo || 1)) * 100))}%` }} />
            ) : null}
          </div>
          <p className="atl-sidenote">{def.note}.</p>

          {focus ? (
            <FocusCard c={focus} fc={fcRows.get(focus.f) ?? null} fcOffice={fcOffice} layer={layer} value={valueOf(focus)} pinned={!!pinned && !hovered} />
          ) : null}

          {stats.top.length ? (
            <div className="atl-list">
              <span className="atl-lh">{layer === "dc" ? "Most data center sites" : layer === "shift" ? "Swinging most Republican" : layer === "fc" || layer === "p24" || layer === "loc" || layer === "dcx" || layer === "gasx" ? "Most Republican" : "Highest"}</span>
              {stats.top.map(({ c, v }, i) => (
                <button type="button" key={c.f} className="atl-li" style={{ animationDelay: `${i * 45}ms` }}
                  onMouseEnter={() => setPin(c.f)} onClick={() => { stopTour(); if (!scope) goState(c.st); setPin(c.f); }}>
                  <i style={{ background: scale.color(v) }} />
                  <b>{countyLabel(c.name)}{scope ? "" : `, ${c.st}`}</b>
                  <span>{fmtVal(def.key, v)}</span>
                </button>
              ))}
            </div>
          ) : null}
          {stats.bottom.length ? (
            <div className="atl-list">
              <span className="atl-lh">{layer === "shift" ? "Swinging most Democratic" : layer === "fc" || layer === "p24" || layer === "loc" || layer === "dcx" || layer === "gasx" ? "Most Democratic" : "Lowest"}</span>
              {stats.bottom.map(({ c, v }, i) => (
                <button type="button" key={c.f} className="atl-li" style={{ animationDelay: `${200 + i * 45}ms` }}
                  onMouseEnter={() => setPin(c.f)} onClick={() => { stopTour(); if (!scope) goState(c.st); setPin(c.f); }}>
                  <i style={{ background: scale.color(v) }} />
                  <b>{countyLabel(c.name)}{scope ? "" : `, ${c.st}`}</b>
                  <span>{fmtVal(def.key, v)}</span>
                </button>
              ))}
            </div>
          ) : null}

          {scope ? (
            <div className="atl-races">
              <span className="atl-lh">On the ballot in {STATE_NAME[scope]}</span>
              {scopeRaces.map((r) => (
                <button type="button" key={r.id} className="atl-race" onClick={() => onPickRace(r.id)}>
                  <b>{r.office === "senate" ? "Senate" : "Governor"}</b>
                  <span>{surname(r.dem)} against {surname(r.gop)}</span>
                  <em style={{ color: sideColor(r, r.est.margin > 0 ? "gop" : "dem") }}>{fmtRaceMargin(r, r.est.margin)} · {fmtPct(r.est.margin > 0 ? r.est.prob : 1 - r.est.prob)}</em>
                </button>
              ))}
              {houseCount ? <span className="atl-hc">{houseCount} House {houseCount === 1 ? "seat" : "seats"} on the national map above</span> : null}
              <button type="button" className="atl-back" onClick={goNation}>Back to the whole country</button>
            </div>
          ) : (
            <div className="atl-jump">
              <span className="atl-lh">Fly into a state</span>
              <div className="atl-jchips">
                {TOUR.slice(0, 10).map((st) => (
                  <button type="button" key={st} onClick={() => { stopTour(); goState(st); }}>{st}</button>
                ))}
              </div>
              <select id="atl-state" aria-label="Choose a state" value="" onChange={(e) => { if (e.target.value) { stopTour(); goState(e.target.value); } }}>
                <option value="">Any state</option>
                {Object.keys(atlas.xf).sort((a, b) => (STATE_NAME[a] ?? a).localeCompare(STATE_NAME[b] ?? b)).map((st) => (
                  <option key={st} value={st}>{STATE_NAME[st] ?? st}</option>
                ))}
              </select>
            </div>
          )}
        </aside>
      </div>

      {hover && hovered ? (
        <CountyTip c={hovered} x={hover.x} y={hover.y} layer={layer} def={def} value={valueOf(hovered)} fc={fcRows.get(hovered.f) ?? null} fcOffice={fcOffice}
          race={(raceByState.get(hovered.st) ?? []).find((r) => r.office === fcOffice) ?? null} />
      ) : null}
      {dcHover && atlas.centers[dcHover.i] ? (
        <DcTip c={atlas.centers[dcHover.i]} county={parsed.byF.get(atlas.centers[dcHover.i][0]) ?? null} x={dcHover.x} y={dcHover.y} />
      ) : null}
      <p className="atl-foot">
        Gas prices from AAA county averages on {atlas.built}. Data center sites from OpenStreetMap. Jobs and wages from the BLS QCEW, growth and migration from Census estimates,
        rurality from USDA, faith from the 2020 Religion Census. Low propensity segments from On Point Polling respondents placed through the census. Local conditions are the model&apos;s own county term.
      </p>
    </section>
  );
}

const StateLines = memo(function StateLines({ paths }: { paths: Record<string, string> }) {
  return <g className="atl-lines" aria-hidden>{Object.entries(paths).map(([st, d]) => <path key={st} d={d} />)}</g>;
});

function FocusCard({ c, fc, fcOffice, layer, value, pinned }: { c: County; fc: CountyRow | null; fcOffice: FcOffice; layer: string; value: Num; pinned: boolean }) {
  const o = fcOffice === "senate" ? "Senate" : fcOffice === "governor" ? "Governor" : "House vote";
  return (
    <div className="atl-focus">
      <div className="atl-fh"><b>{countyLabel(c.name)}</b><span>{c.st}{pinned ? " · pinned" : ""}</span></div>
      <div className="atl-fgrid">
        {layer !== "fc" ? <><span>{SHORT[layer] ?? layer}</span><b>{fmtVal(layer, value)}</b></> : null}
        <span>2026 {o}</span><b style={{ color: fc ? (fc[0] > 0 ? "var(--gop2)" : "var(--dem2)") : undefined }}>{fc ? fmtMargin(fc[0]) : "No race"}</b>
        {layer !== "p24" ? <><span>2024 result</span><b>{fmtVal("p24", c.v.p24)}</b></> : null}
        {layer !== "gas" ? <><span>Gas</span><b>{fmtVal("gas", c.v.gas)}</b></> : null}
        {layer !== "dc" ? <><span>Data centers</span><b>{c.v.dc ? fmtVal("dc", c.v.dc) : "None mapped"}</b></> : null}
        <span>Low prop. Trump</span><b>{fmtVal("lpT", c.v.lpT)}</b>
        <span>Job growth</span><b>{fmtVal("emp", c.v.emp)}</b>
        <span>Residents</span><b>{c.pop ? commas(c.pop) : "No data"}</b>
      </div>
    </div>
  );
}

function CountyTip({ c, x, y, layer, def, value, fc, fcOffice, race }: {
  c: County; x: number; y: number; layer: string; def: LayerDef; value: Num; fc: CountyRow | null; fcOffice: FcOffice; race: Race | null;
}) {
  const o = fcOffice === "senate" ? "Senate" : fcOffice === "governor" ? "Governor" : "House vote";
  const rows: [string, string][] = [];
  if (layer !== "fc") rows.push([def.label, fmtVal(layer, value)]);
  if (layer !== "p24") rows.push(["2024 result", fmtVal("p24", c.v.p24)]);
  if (layer !== "gas") rows.push(["Gas", fmtVal("gas", c.v.gas)]);
  if (layer !== "dc") rows.push(["Data centers", c.v.dc ? fmtVal("dc", c.v.dc) : "None mapped"]);
  if (layer !== "emp") rows.push(["Job growth", fmtVal("emp", c.v.emp)]);
  // the same card as the desk's county tooltip: who, projected votes, share, margin
  if (fc && fc[3] > 0) {
    const house = fcOffice === "house";
    const shares = fc[4];
    return (
      <VoteTip
        title={countyLabel(c.name)}
        sub={`${STATE_NAME[c.st] ?? c.st} · 2026 ${o}`}
        demName={house || !race ? "Democratic" : surname(race.dem)}
        gopName={house || !race ? "Republican" : surname(race.gop)}
        demColor={race && !house ? sideColor(race, "dem") : undefined}
        dem={fc[1]} rep={fc[2]} total={fc[3]} margin={fc[0]}
        cands={!house && race && shares && race.cands ? race.cands.map((k, i) => ({ name: k.name, party: k.party, pct: shares[i] ?? 0 })) : undefined}
        rows={rows}
        foot="Projected county vote · click to fly in or pin"
        x={x} y={y}
      />
    );
  }
  const flip = typeof window !== "undefined" && x > window.innerWidth - 320;
  const yc = typeof window !== "undefined" ? Math.min(y, window.innerHeight - 230) : y;
  return (
    <TipPortal>
      <div className="atl-tip" style={{ left: x + (flip ? -290 : 18), top: yc - 12 }}>
        <div className="atl-tn">{countyLabel(c.name)}</div>
        <div className="atl-ts">{STATE_NAME[c.st] ?? c.st} · no {o === "House vote" ? "House" : o} race on the 2026 ballot</div>
        <div className="atl-tv"><span>{def.label}</span><b>{fmtVal(layer, value)}</b></div>
        {rows.filter(([k]) => k !== def.label).map(([k, v]) => <div key={k} className="atl-tr"><span>{k}</span><b>{v}</b></div>)}
        <div className="atl-tf">Click to fly in or pin</div>
      </div>
    </TipPortal>
  );
}

function DcTip({ c, county, x, y }: { c: AtlasData["centers"][number]; county: County | null; x: number; y: number }) {
  const flip = typeof window !== "undefined" && x > window.innerWidth - 300;
  return (
    <TipPortal>
      <div className="atl-tip dc" style={{ left: x + (flip ? -270 : 16), top: y - 12 }}>
        <div className="atl-ts">Data center</div>
        <div className="atl-tn">{c[6] || "Unnamed site"}</div>
        {c[7] ? <div className="atl-tr"><span>Operator</span><b>{c[7]}</b></div> : null}
        <div className="atl-tr"><span>County</span><b>{county ? `${countyLabel(county.name)}, ${county.st}` : c[1]}</b></div>
        {county ? <div className="atl-tr"><span>Sites in county</span><b>{fmtVal("dc", county.v.dc)}</b></div> : null}
        {county ? <div className="atl-tr"><span>Gas there</span><b>{fmtVal("gas", county.v.gas)}</b></div> : null}
      </div>
    </TipPortal>
  );
}

export const ATLAS_CSS = `
:root { --atl-floor: #000; --atl-shadow: rgba(0,0,0,.85); --atl-shadow2: rgba(0,0,0,.6); }
:root[data-theme="light"] { --atl-floor: #eef0f7; --atl-shadow: rgba(40,18,80,.22); --atl-shadow2: rgba(40,18,80,.12); }

.atl.embedded { margin-top: 0; animation: none; }
.atl.embedded .atl-head p { margin-top: 6px; }
.atl { position: relative; display: grid; gap: 18px; margin-top: 8px; animation: atlBoard .9s cubic-bezier(.16,1,.3,1) both; }
@keyframes atlBoard { 0% { transform: perspective(2400px) translateY(46px) rotateX(10deg) scale(.95); opacity: 0; filter: blur(10px); } 55% { filter: blur(0); } 100% { transform: none; opacity: 1; filter: none; } }
.atl-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 18px 28px; }
.atl-head h2 { margin: 6px 0 0; font-family: var(--font-d); font-weight: 800; font-size: clamp(28px, 4vw, 44px); letter-spacing: -.035em; line-height: 1.02; color: var(--hi); text-wrap: balance; }
.atl-head p { margin: 10px 0 0; max-width: 58ch; font-size: 14.5px; line-height: 1.55; color: #a9a2b8; }
.atl-grad { background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
.atl-eye { font-family: var(--font-m); font-size: 10.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: var(--mute); }
.atl-kpis { display: grid; grid-template-columns: repeat(4, minmax(120px, 1fr)); gap: 10px; }
.atl-kpi { padding: 12px 14px; border-radius: 12px; background: rgba(var(--line-rgb),.035); border: 1px solid rgba(var(--line-rgb),.08); animation: atlK .7s cubic-bezier(.16,1,.3,1) both; }
.atl-kpi b { display: block; font-family: var(--font-d); font-weight: 800; font-size: 26px; letter-spacing: -.03em; color: var(--hi); font-variant-numeric: tabular-nums; }
.atl-kpi span { display: block; margin-top: 2px; font-size: 11.5px; line-height: 1.35; color: var(--mute); }
@keyframes atlK { from { opacity: 0; transform: translateY(14px) scale(.97); } }

.atl-rail { display: flex; gap: 10px 22px; flex-wrap: wrap; padding: 12px 14px; border-radius: 16px; background: linear-gradient(180deg, rgba(var(--line-rgb),.045), rgba(var(--line-rgb),.015)); border: 1px solid rgba(var(--line-rgb),.08); }
.atl-group { display: grid; gap: 6px; }
.atl-gname { font-family: var(--font-m); font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6f6884; }
.atl-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.atl-chip { position: relative; overflow: hidden; padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--ink2); background: rgba(var(--line-rgb),.04); border: 1px solid rgba(var(--line-rgb),.09); cursor: pointer; transition: color .2s, background .2s, border-color .2s, transform .2s; }
.atl-chip:hover { color: var(--hi); border-color: rgba(var(--line-rgb),.22); transform: translateY(-1px); }
.atl-chip.on { color: #0a0711; background: var(--ink); border-color: var(--ink); }
.atl-chip.on::after { content: ""; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(var(--line-rgb),.75) 50%, transparent 70%); transform: translateX(-120%); animation: atlGlint .9s ease-out; }
@keyframes atlGlint { to { transform: translateX(120%); } }
.atl-chip:focus-visible, .atl-seg button:focus-visible, .atl-tour:focus-visible, .atl-li:focus-visible, .atl-race:focus-visible, .atl-jchips button:focus-visible, .atl-crumbs button:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }

.atl-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; }
.atl-note { font-size: 13px; color: #a9a2b8; }
.atl-seg { display: inline-flex; padding: 3px; border-radius: 999px; background: rgba(var(--line-rgb),.05); border: 1px solid rgba(var(--line-rgb),.09); }
.atl-seg button { padding: 6px 13px; border: 0; border-radius: 999px; background: transparent; color: #a9a2b8; font-size: 12.5px; font-weight: 600; cursor: pointer; transition: background .2s, color .2s; }
.atl-seg button.on { background: rgba(var(--line-rgb),.14); color: var(--hi); }
.atl-toggles { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; }
.atl-tog { display: inline-flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--ink2); cursor: pointer; user-select: none; }
.atl-tog input { position: absolute; opacity: 0; pointer-events: none; }
.atl-tog i { position: relative; width: 30px; height: 17px; border-radius: 99px; background: rgba(var(--line-rgb),.12); transition: background .2s; }
.atl-tog i::after { content: ""; position: absolute; left: 2px; top: 2px; width: 13px; height: 13px; border-radius: 50%; background: var(--ink2); transition: transform .25s cubic-bezier(.16,1,.3,1), background .2s; }
.atl-tog input:checked + i { background: rgba(79,224,255,.35); }
.atl-tog input:checked + i::after { transform: translateX(13px); background: #4fe0ff; box-shadow: 0 0 10px #4fe0ff; }
.atl-tog input:focus-visible + i { outline: 2px solid var(--gold); outline-offset: 2px; }
.atl-tour { padding: 7px 14px; border-radius: 999px; font-size: 12.5px; font-weight: 700; color: #fff; background: var(--grad); border: 0; cursor: pointer; box-shadow: var(--shadow-grad); }
.atl-tour.on { background: rgba(var(--line-rgb),.12); box-shadow: none; }

.atl-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 18px; align-items: start; }
.atl-stage { position: relative; min-height: 420px; padding: 44px 8px 64px; border-radius: 22px; overflow: hidden; perspective: 1600px;
  background: radial-gradient(90% 70% at 50% 46%, color-mix(in srgb, var(--acc, #4fe0ff) 9%, var(--atl-floor)) 0%, var(--atl-floor) 62%), var(--atl-floor);
  box-shadow: inset 0 0 0 1px rgba(var(--line-rgb),.06), 0 40px 120px var(--atl-shadow2); transition: background .6s; }
.atl-stage::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: radial-gradient(rgba(var(--line-rgb),.07) 1px, transparent 1px); background-size: 22px 22px;
  mask-image: radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 100%); -webkit-mask-image: radial-gradient(70% 60% at 50% 50%, #000 0%, transparent 100%); }
.atl-floor { position: absolute; left: 12%; right: 12%; bottom: 26px; height: 60px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acc, #4fe0ff) 30%, transparent), transparent); filter: blur(18px); opacity: .55;
  animation: atlFloor 9s ease-in-out infinite alternate; }
@keyframes atlFloor { from { transform: scaleX(.92); opacity: .45; } to { transform: scaleX(1.04); opacity: .65; } }
.atl-float { position: relative; transform-style: preserve-3d; transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg)); transition: transform .5s cubic-bezier(.16,1,.3,1); }
.atl-bob { will-change: transform; animation: atlBob 10s ease-in-out 1s infinite alternate; }
.atl-map { display: block; width: 100%; height: auto; overflow: visible;
  filter: drop-shadow(0 26px 34px var(--atl-shadow)) drop-shadow(0 0 26px color-mix(in srgb, var(--acc, #4fe0ff) 22%, transparent)); }
.atl-map.nation { animation: atlMapIn .8s cubic-bezier(.16,1,.3,1) both; }
.atl-map.flying { filter: none; }
.atl-map.flying .atl-c { transition: none; }
.atl-map.state { max-width: 760px; margin: 0 auto; animation: atlDeep .7s cubic-bezier(.16,1,.3,1) both; }
@keyframes atlMapIn { from { opacity: 0; transform: translateY(18px) scale(.97); } }
@keyframes atlDeep { from { opacity: 0; transform: scale(1.06); filter: blur(8px); } }
@keyframes atlBob { from { transform: translateY(-5px); } to { transform: translateY(5px); } }
.atl-c { stroke: var(--atl-floor); stroke-width: .25; transition: fill .55s ease, opacity .5s ease; cursor: pointer; }
.atl-map.state .atl-c { stroke-width: .9; }
.atl-c:hover { opacity: .82; }
.atl-c.dim { opacity: .08; }
.atl-zoomg { transform-origin: 0 0; }
.atl-zoomg.flying .atl-c { stroke-width: .08; }
.atl-lines path { fill: none; stroke: rgba(var(--line-rgb),.55); stroke-width: .6; pointer-events: none; vector-effect: non-scaling-stroke; }
.atl-dots { pointer-events: auto; }
.atl-dot { fill: #8ff0ff; stroke: rgba(0,0,0,.5); stroke-width: .3; cursor: pointer; transform-box: fill-box; transform-origin: center; animation: atlDot .5s cubic-bezier(.34,1.56,.64,1) both; }
.atl-dot.big { stroke-width: 1; }
.atl-dot:hover { fill: var(--hi); }
@keyframes atlDot { from { opacity: 0; transform: scale(0); } }
.atl-ring { fill: none; stroke: #4fe0ff; stroke-width: 1.4; opacity: 0; transform-box: fill-box; transform-origin: center; animation: atlRing 1.6s ease-out both; pointer-events: none; }
@keyframes atlRing { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(2.4); } }
.atl-halo { fill: none; stroke: var(--hi); stroke-width: 1.1; pointer-events: none; filter: drop-shadow(0 0 4px rgba(var(--hi-rgb),.7)); }
.atl-halo.st { stroke-width: 2.4; }

.atl-crumbs { position: absolute; left: 16px; top: 14px; z-index: 2; display: flex; align-items: center; gap: 8px; }
.atl-crumbs button { padding: 5px 11px; border-radius: 999px; font-family: var(--font-m); font-size: 10.5px; font-weight: 700; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); background: rgba(var(--line-rgb),.04); border: 1px solid rgba(var(--line-rgb),.08); cursor: pointer; }
.atl-crumbs button.on { color: var(--hi); border-color: rgba(var(--line-rgb),.22); }
.atl-crumbs em { font-style: normal; color: var(--mute2); }
.atl-tourbar { width: 90px; height: 3px; border-radius: 9px; overflow: hidden; background: rgba(var(--line-rgb),.1); }
.atl-tourbar i { display: block; height: 100%; background: var(--grad); animation: atlTour 6.5s linear both; transform-origin: 0 50%; }
@keyframes atlTour { from { transform: scaleX(0); } to { transform: scaleX(1); } }

.atl-legend { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 2; display: grid; justify-items: center; gap: 5px; width: min(420px, calc(100% - 32px)); text-align: center; }
.atl-ltitle { font-family: var(--font-m); font-size: 10px; font-weight: 700; letter-spacing: .14em; text-transform: uppercase; color: var(--ink2); }
.atl-lrow { display: flex; align-items: center; gap: 10px; width: 100%; font-family: var(--font-m); font-size: 11px; color: #a9a2b8; font-variant-numeric: tabular-nums; }
.atl-lrow i { flex: 1; height: 7px; border-radius: 99px; box-shadow: 0 0 18px color-mix(in srgb, var(--acc, #4fe0ff) 35%, transparent); }
.atl-lnote { font-size: 11px; color: #6f6884; }

.atl-side { display: grid; gap: 12px; padding: 18px; border-radius: 18px; background: linear-gradient(180deg, rgba(var(--line-rgb),.05), rgba(var(--line-rgb),.015)); border: 1px solid rgba(var(--line-rgb),.08); animation: atlDrill .5s cubic-bezier(.16,1,.3,1) both; }
@keyframes atlDrill { from { opacity: 0; transform: translateX(28px); } }
.atl-side h3 { margin: -4px 0 0; font-family: var(--font-d); font-weight: 700; font-size: 19px; letter-spacing: -.02em; color: var(--hi); }
.atl-big b { display: block; font-family: var(--font-d); font-weight: 800; font-size: 40px; line-height: 1; letter-spacing: -.04em; color: var(--hi); font-variant-numeric: tabular-nums; }
.atl-big span { display: block; margin-top: 4px; font-size: 12px; color: var(--mute); }
.atl-hist { position: relative; display: flex; align-items: flex-end; gap: 2px; height: 64px; padding-bottom: 1px; border-bottom: 1px solid rgba(var(--line-rgb),.1); }
.atl-hist i { flex: 1; border-radius: 2px 2px 0 0; transform-origin: 50% 100%; animation: atlBar .6s cubic-bezier(.16,1,.3,1) both; }
@keyframes atlBar { from { transform: scaleY(0); } }
.atl-hist u { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--hi); box-shadow: 0 0 8px rgba(var(--hi-rgb),.6); transition: left .25s ease; }
.atl-sidenote { margin: 0; font-size: 12.5px; line-height: 1.5; color: #a9a2b8; }
.atl-lh { display: block; margin-bottom: 4px; font-family: var(--font-m); font-size: 9.5px; font-weight: 700; letter-spacing: .16em; text-transform: uppercase; color: #6f6884; }
.atl-list { display: grid; gap: 2px; }
.atl-li { display: grid; grid-template-columns: 8px minmax(0,1fr) auto; align-items: center; gap: 9px; padding: 6px 8px; margin: 0 -8px; border: 0; border-radius: 8px; background: transparent; color: var(--ink2); text-align: left; cursor: pointer; animation: atlRow .45s cubic-bezier(.16,1,.3,1) both; }
.atl-li:hover { background: rgba(var(--line-rgb),.06); color: var(--hi); }
.atl-li i { width: 8px; height: 8px; border-radius: 2px; }
.atl-li b { font-size: 13px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.atl-li span { font-family: var(--font-m); font-size: 12px; font-weight: 700; color: var(--hi); font-variant-numeric: tabular-nums; }
@keyframes atlRow { from { opacity: 0; transform: translateX(14px); } }
.atl-focus { padding: 12px; border-radius: 12px; background: rgba(var(--canvas-rgb),.45); border: 1px solid rgba(var(--line-rgb),.1); animation: atlK .35s cubic-bezier(.16,1,.3,1) both; }
.atl-fh { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.atl-fh b { font-family: var(--font-d); font-size: 15px; color: var(--hi); }
.atl-fh span { font-family: var(--font-m); font-size: 10px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.atl-fgrid { display: grid; grid-template-columns: 1fr auto; gap: 5px 10px; margin-top: 8px; font-size: 12.5px; }
.atl-fgrid span { color: var(--mute); }
.atl-fgrid b { font-family: var(--font-m); font-size: 12px; color: var(--ink); text-align: right; font-variant-numeric: tabular-nums; }
.atl-races { display: grid; gap: 6px; }
.atl-race { display: grid; gap: 1px; padding: 10px 12px; border-radius: 12px; text-align: left; background: rgba(var(--line-rgb),.04); border: 1px solid rgba(var(--line-rgb),.08); color: var(--ink2); cursor: pointer; transition: border-color .2s, transform .2s; }
.atl-race:hover { border-color: rgba(var(--line-rgb),.25); transform: translateY(-1px); }
.atl-race b { font-family: var(--font-m); font-size: 9.5px; letter-spacing: .14em; text-transform: uppercase; color: var(--mute); }
.atl-race span { font-size: 13.5px; font-weight: 600; color: var(--hi); }
.atl-race em { font-style: normal; font-family: var(--font-m); font-size: 12px; font-weight: 700; }
.atl-hc { font-size: 12px; color: var(--mute); }
.atl-back { justify-self: start; padding: 7px 12px; border-radius: 999px; font-size: 12.5px; font-weight: 600; color: var(--hi); background: rgba(var(--line-rgb),.08); border: 1px solid rgba(var(--line-rgb),.14); cursor: pointer; }
.atl-jump { display: grid; gap: 8px; }
.atl-jchips { display: flex; flex-wrap: wrap; gap: 6px; }
.atl-jchips button { width: 40px; padding: 6px 0; border-radius: 8px; font-family: var(--font-m); font-size: 11.5px; font-weight: 700; color: var(--ink2); background: rgba(var(--line-rgb),.04); border: 1px solid rgba(var(--line-rgb),.09); cursor: pointer; transition: color .2s, border-color .2s, transform .2s; }
.atl-jchips button:hover { color: var(--hi); border-color: rgba(var(--line-rgb),.25); transform: translateY(-1px); }
.atl-jump select { width: 100%; padding: 8px 10px; border-radius: 10px; color: var(--ink); background: var(--bg2); border: 1px solid rgba(var(--line-rgb),.12); font-size: 13px; }
.atl-foot { margin: 0; font-size: 11.5px; line-height: 1.55; color: #6f6884; max-width: 110ch; }

.atl-loading { min-height: 360px; display: grid; place-items: center; align-content: center; gap: 14px; color: var(--mute); font-size: 13px; }
.atl-spin { width: 34px; height: 34px; border-radius: 50%; border: 2px solid rgba(var(--line-rgb),.1); border-top-color: #4fe0ff; animation: atlSpin .9s linear infinite; }
@keyframes atlSpin { to { transform: rotate(360deg); } }

.atl-tip { position: fixed; z-index: 90; width: 260px; padding: 12px 14px; border-radius: 12px; pointer-events: none; font-family: var(--font-b); color: var(--ink2);
  background: rgba(var(--bg2-rgb),.96); border: 1px solid rgba(var(--line-rgb),.14); box-shadow: var(--shadow-md), 0 0 0 1px rgba(0,0,0,.4); backdrop-filter: blur(10px); animation: atlTip .16s ease-out; }
@keyframes atlTip { from { opacity: 0; transform: translateY(4px); } }
.atl-tn { font-family: var(--font-d); font-weight: 700; font-size: 14.5px; color: var(--hi); }
.atl-ts { margin-top: 2px; font-family: var(--font-m); font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute); }
.atl-tip.dc .atl-ts { color: #4fe0ff; margin: 0 0 3px; }
.atl-tv { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin: 9px 0 6px; padding-bottom: 8px; border-bottom: 1px solid rgba(var(--line-rgb),.08); }
.atl-tv span { font-size: 12px; color: #a9a2b8; }
.atl-tv b { font-family: var(--font-m); font-size: 16px; font-weight: 800; color: var(--hi); font-variant-numeric: tabular-nums; }
.atl-tr { display: flex; justify-content: space-between; gap: 10px; margin-top: 4px; font-size: 12px; }
.atl-tr span { color: var(--mute); }
.atl-tr b { font-family: var(--font-m); font-size: 11.5px; font-weight: 700; color: var(--ink); text-align: right; }
.atl-tf { margin-top: 8px; font-family: var(--font-m); font-size: 9px; letter-spacing: .12em; text-transform: uppercase; color: var(--mute2); }

@media (max-width: 1080px) { .atl-grid { grid-template-columns: 1fr; } .atl-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); width: 100%; } }
@media (max-width: 640px) {
  .atl-stage { padding: 46px 0 78px; border-radius: 16px; min-height: 300px; }
  .atl-rail { flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .atl-group { flex-shrink: 0; }
  .atl-chips { flex-wrap: nowrap; }
  .atl-kpi b { font-size: 21px; }
}
@media (prefers-reduced-motion: reduce) {
  .atl, .atl *, .atl-tip { animation: none !important; transition: none !important; }
}
`;
