"use client";
// County explorer for every statewide forecast: a large map with four ways to read it, a county inspector that
// follows the cursor, step through and search, ranked county lists, and a tug of war bar of where the margin is won.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { marginColor, marginColorInd, RAMP_CSS, RAMP_IND_CSS } from "@/app/lib/opp";
import { pathsBox, type CountyPath } from "../home/countyGeo";

export type XRow = { id: string; name: string; a: number; b: number; other: number; total: number };
export type XSide = { name: string; short: string; color: string; letter: string };
type Mode = "margin" | "p24" | "shift" | "bubbles" | "turnout";

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `${(n / 1e3).toFixed(0)}K` : fmt(n));
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
const yesFill = (y: number) => {
  const a = Math.min(30, Math.abs(y - 50)) / 30;
  return y >= 50 ? mix([214, 242, 234], [14, 110, 88], a) : mix([252, 226, 214], [150, 58, 20], a);
};
const shiftFill = (s: number, ind = false, cap = 15) => { const a = Math.min(cap, Math.abs(s)) / cap; return s < 0 ? (ind ? mix([236, 228, 255], [110, 60, 220], a) : mix([226, 233, 255], [30, 70, 200], a)) : mix([255, 228, 233], [190, 20, 60], a); };
const turnFill = (t: number) => mix([40, 30, 60], [196, 160, 255], Math.max(0, Math.min(1, t)));
const YES_RAMP = "linear-gradient(90deg,#963a14 0%,#e8794a 30%,#fce2d6 49%,#d6f2ea 51%,#2fbf9b 70%,#0e6e58 100%)";
const SHIFT_RAMP = "linear-gradient(90deg,#1e46c8 0%,#e2e9ff 48%,#ffe4e9 52%,#be143c 100%)";
const SHIFT_IND_RAMP = "linear-gradient(90deg,#6e3cdc 0%,#ece4ff 48%,#ffe4e9 52%,#be143c 100%)";
const TURN_RAMP = "linear-gradient(90deg,#281e3c 0%,#c4a0ff 100%)";

function bbox(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
/** signed margin in points, the right side minus the left side, R minus D for a race, No minus Yes for a measure */
const mOf = (r: { a: number; b: number; total: number }) => (r.total > 0 ? ((r.b - r.a) / r.total) * 100 : 0);

export const CX_CSS = `
:root:has(.fc-xl){--wrap:2400px}
.cx{display:grid;grid-template-columns:minmax(0,1fr) clamp(360px,23vw,480px);gap:16px;align-items:start}
@media (max-width:1100px){.cx{grid-template-columns:1fr}}
.cx-map{position:relative;overflow:hidden;padding:0}
.cx-bar{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line)}
.cx-bar h3{margin:0;font:700 16px var(--font-d);letter-spacing:-.01em}
.cx-seg{display:inline-flex;gap:2px;padding:3px;border:1px solid var(--line2);border-radius:999px;background:rgba(var(--line-rgb),.03)}
.cx-seg button{font:700 12px var(--font-b);color:var(--mute);background:none;border:0;border-radius:999px;padding:6px 12px;cursor:pointer;white-space:nowrap}
.cx-seg button[aria-pressed="true"]{color:var(--ink);background:rgba(var(--line-rgb),.12)}
.cx-seg button:focus-visible,.cx-zoom button:focus-visible,.cx-list button:focus-visible,.cx-step button:focus-visible{outline:2px solid var(--hi);outline-offset:2px}
.cx-search{margin-left:auto;min-width:190px;font:600 13px var(--font-b);color:var(--ink);background:rgba(var(--line-rgb),.04);border:1px solid var(--line2);border-radius:10px;padding:8px 11px}
.cx-stage{position:relative;background:radial-gradient(ellipse at 50% 40%,rgba(var(--line-rgb),.05),transparent 70%)}
.cx-svg{display:block;width:100%;height:max(600px,calc(100vh - 190px));touch-action:manipulation}
.cx-svg path{stroke:rgba(var(--canvas-rgb),.85);stroke-width:.8;vector-effect:non-scaling-stroke;cursor:pointer;transition:fill .45s ease,opacity .25s}
.cx-svg path.dim{opacity:.35}
.cx-svg .cx-out{fill:none;stroke:var(--hi);stroke-width:2.6;vector-effect:non-scaling-stroke;pointer-events:none}
.cx-svg .cx-hov{fill:none;stroke:var(--hi);stroke-width:1.6;vector-effect:non-scaling-stroke;pointer-events:none;opacity:.8}
.cx-svg circle{stroke:rgba(var(--canvas-rgb),.9);vector-effect:non-scaling-stroke;stroke-width:1;pointer-events:none;transition:r .45s ease,opacity .3s}
.cx-svg .cx-sub{font-family:var(--font-m);font-weight:700;fill:rgba(255,255,255,.88)}
.cx-svg text{pointer-events:none;font-family:var(--font-b);font-weight:700;fill:#fff;paint-order:stroke;stroke:rgba(var(--canvas-rgb),.85);stroke-linejoin:round}
.cx-zoom{position:absolute;right:14px;top:14px;display:grid;gap:6px}
.cx-zoom button{width:34px;height:34px;border-radius:10px;border:1px solid var(--line2);background:rgba(var(--canvas-rgb),.7);color:var(--ink);font:700 16px var(--font-m);cursor:pointer;backdrop-filter:blur(8px)}
.cx-legend{display:flex;align-items:center;gap:10px;padding:10px 14px 14px;font-size:12px;color:var(--mute);flex-wrap:wrap}
.cx-legend i{display:block;height:8px;border-radius:4px;flex:1;max-width:300px;min-width:120px}
.cx-rail{display:grid;gap:16px;position:sticky;top:calc(env(safe-area-inset-top,0px) + 84px)}
@media (max-width:1100px){.cx-rail{position:static}}
.cx-insp{padding:16px 18px}
.cx-insp .eye{display:block}
.cx-insp h4{margin:4px 0 2px;font:800 24px/1.15 var(--font-d);letter-spacing:-.02em}
.cx-big{font:800 40px/1 var(--font-d);letter-spacing:-.03em;margin:10px 0 4px;font-variant-numeric:tabular-nums}
.cx-row{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;margin-top:10px;font-size:13px}
.cx-row .nm{font-weight:700;color:var(--ink);white-space:nowrap}
.cx-row .tr{height:8px;border-radius:4px;background:rgba(var(--line-rgb),.08);overflow:hidden}
.cx-row .tr i{display:block;height:100%;border-radius:4px;transition:width .45s ease}
.cx-row .vv{font-family:var(--font-m);font-variant-numeric:tabular-nums;color:var(--ink2);text-align:right;min-width:92px}
.cx-facts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}
.cx-facts div{border:1px solid var(--line);border-radius:10px;padding:8px 10px}
.cx-facts span{display:block;font:700 10px var(--font-m);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
.cx-facts b{display:block;font:800 16px var(--font-d);margin-top:3px;font-variant-numeric:tabular-nums}
.cx-step{display:flex;gap:8px;margin-top:14px}
.cx-step button{flex:1;font:700 12.5px var(--font-b);color:var(--ink2);background:rgba(var(--line-rgb),.04);border:1px solid var(--line2);border-radius:10px;padding:8px;cursor:pointer}
.cx-tabs{display:flex;gap:4px;padding:10px 12px 0;flex-wrap:wrap}
.cx-tabs button{font:700 11.5px var(--font-b);color:var(--mute);background:none;border:1px solid transparent;border-radius:999px;padding:5px 10px;cursor:pointer}
.cx-tabs button[aria-pressed="true"]{color:var(--ink);border-color:var(--line2);background:rgba(var(--line-rgb),.06)}
.cx-list{list-style:none;margin:0;padding:6px 6px 10px}
.cx-list button{display:grid;grid-template-columns:22px 1fr auto;gap:8px;align-items:center;width:100%;text-align:left;background:none;border:0;border-radius:8px;padding:7px 8px;color:var(--ink2);cursor:pointer;font:600 13px var(--font-b)}
.cx-list button:hover,.cx-list button[aria-current="true"]{background:rgba(var(--line-rgb),.07);color:var(--ink)}
.cx-list .rk{font:700 11px var(--font-m);color:var(--mute)}
.cx-list .mv{font:700 12px var(--font-m);font-variant-numeric:tabular-nums}
.cx-tug{padding:14px 16px 16px}
.cx-tug svg{display:block;width:100%;height:46px}
.cx-tug rect{cursor:pointer;transition:opacity .2s}
.cx-tug .lab{display:flex;justify-content:space-between;gap:12px;font-size:12.5px;color:var(--ink2);margin-top:8px;flex-wrap:wrap}
.cx-tug .lab b{font-family:var(--font-m);font-variant-numeric:tabular-nums}
@media (prefers-reduced-motion:reduce){.cx-svg path,.cx-svg circle,.cx-row .tr i{transition:none}}
`;

export default function CountyExplorer({ paths, rows, sides, unit = "counties", stateName, kind = "race", title }: {
  paths: CountyPath[]; rows: XRow[]; sides: [XSide, XSide]; unit?: string; stateName: string; kind?: "race" | "measure"; title?: string;
}) {
  const R = useMemo(() => Object.fromEntries(rows.map((r) => [r.id, r])), [rows]);
  const P = useMemo(() => paths.filter((p) => R[p.id]), [paths, R]);
  const boxes = useMemo(() => Object.fromEntries(P.map((p) => [p.id, bbox(p.d)])), [P]);
  const full = useMemo(() => { const [x0, y0, x1, y1] = pathsBox(P); const px = (x1 - x0) * 0.03, py = (y1 - y0) * 0.03; return [x0 - px, y0 - py, x1 - x0 + 2 * px, y1 - y0 + 2 * py] as [number, number, number, number]; }, [P]);
  const [vb, setVb] = useState(full);
  useEffect(() => setVb(full), [full]);
  const anim = useRef<number | null>(null);
  const animateTo = (to: [number, number, number, number]) => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (anim.current) cancelAnimationFrame(anim.current);
    if (reduce) { setVb(to); return; }
    const from = vb, t0 = performance.now(), D = 480;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      setVb(from.map((v, i) => v + (to[i] - v) * e) as [number, number, number, number]);
      if (k < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };

  const indRace = kind === "race" && sides[0].letter === "I";
  const [mode, setMode] = useState<Mode>("margin");
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<"big" | "a" | "b" | "close" | "shift">("big");
  const [p24, setP24] = useState<Record<string, [number, number, number]> | null>(null);
  useEffect(() => {
    if (kind !== "race") return;
    fetch("/forecast/pres24_counties.json").then((r) => r.json()).then((j) => setP24(j.c)).catch(() => setP24(null));
  }, [kind]);

  const T = useMemo(() => rows.reduce((s, r) => ({ a: s.a + r.a, b: s.b + r.b, other: s.other + r.other, total: s.total + r.total }), { a: 0, b: 0, other: 0, total: 0 }), [rows]);
  const byVotes = useMemo(() => [...rows].sort((x, y) => y.total - x.total), [rows]);
  const rank = useMemo(() => Object.fromEntries(byVotes.map((r, i) => [r.id, i + 1])), [byVotes]);
  const maxTotal = byVotes[0]?.total || 1, minTotal = byVotes[byVotes.length - 1]?.total || 1;
  const shift = (id: string) => { const r = R[id], o = p24?.[id]; if (!r || !o) return null; const t24 = o[0] + o[1] + o[2]; if (!t24) return null; return mOf(r) - ((o[1] - o[0]) / t24) * 100; };
  // the shift scale follows the race: 15 points, or wider when a candidate runs far from the 2024 ticket everywhere
  const shiftCap = useMemo(() => {
    if (!p24) return 15;
    const v = rows.map((r) => shift(r.id)).filter((x): x is number => x != null).map(Math.abs).sort((a, b) => a - b);
    return v.length ? Math.max(15, Math.ceil(v[Math.floor(v.length * 0.9)] / 5) * 5) : 15;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p24, rows]);
  const m24 = (id: string) => { const o = p24?.[id]; if (!o) return null; const t = o[0] + o[1] + o[2]; return t ? ((o[1] - o[0]) / t) * 100 : null; };

  const fillOf = (id: string) => {
    const r = R[id];
    if (mode === "turnout") return turnFill((Math.log(r.total) - Math.log(minTotal)) / Math.max(0.01, Math.log(maxTotal) - Math.log(minTotal)));
    if (mode === "shift") { const s = shift(id); return s == null ? "rgba(var(--line-rgb),.1)" : shiftFill(s, indRace, shiftCap); }
    if (mode === "bubbles") return "rgba(var(--line-rgb),.07)";
    if (mode === "p24") { const m = m24(id); return m == null ? "rgba(var(--line-rgb),.1)" : marginColor(m); }
    return kind === "measure" ? yesFill(r.total ? (100 * r.a) / (r.a + r.b) : 50) : (indRace ? marginColorInd(mOf(r)) : marginColor(mOf(r)));
  };

  // bubbles: radius by net votes, the biggest net vote county gets about a twelfth of the map's width
  const maxNet = useMemo(() => Math.max(1, ...rows.map((r) => Math.abs(r.b - r.a))), [rows]);
  const rMax = full[2] / 12;

  const focus = sel ?? hov;
  const cur = focus ? R[focus] : null;
  const pick = (id: string, zoom = false) => {
    setSel(id);
    if (zoom && boxes[id]) {
      const [x0, y0, x1, y1] = boxes[id]; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const ar = full[2] / full[3]; let w = Math.max((x1 - x0) * 4, full[2] / 6), h = w / ar;
      if (h < (y1 - y0) * 4) { h = (y1 - y0) * 4; w = h * ar; }
      animateTo([cx - w / 2, cy - h / 2, w, h]);
    }
  };
  const stepBy = (d: number) => {
    const i = sel ? byVotes.findIndex((r) => r.id === sel) : -1;
    const n = byVotes[(i + d + byVotes.length) % byVotes.length]; if (n) pick(n.id, true);
  };
  const zoom = (k: number) => { const [x, y, w, h] = vb; const cx = x + w / 2, cy = y + h / 2, nw = Math.min(full[2], w / k), nh = Math.min(full[3], h / k); animateTo([cx - nw / 2, cy - nh / 2, nw, nh]); };
  const reset = () => { setSel(null); animateTo(full); };

  const lists = useMemo(() => {
    const L = {
      big: byVotes,
      a: [...rows].sort((x, y) => (y.a - y.b) - (x.a - x.b)),
      b: [...rows].sort((x, y) => (y.b - y.a) - (x.b - x.a)),
      close: [...rows].filter((r) => r.total > 0).sort((x, y) => Math.abs(mOf(x)) - Math.abs(mOf(y))),
      shift: p24 ? [...rows].filter((r) => shift(r.id) != null).sort((x, y) => Math.abs(shift(y.id)!) - Math.abs(shift(x.id)!)) : [],
    };
    return L;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, byVotes, p24]);

  const mLabel = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? sides[0].letter : sides[1].letter} +${Math.abs(m).toFixed(1)}`);
  const sMLabel = (m: number) => (Math.abs(m) < 0.05 ? "No shift" : `${m < 0 ? sides[0].letter : sides[1].letter} +${Math.abs(m).toFixed(1)}`);
  const one = ({ counties: "county", parishes: "parish", boroughs: "borough" } as Record<string, string>)[unit] ?? "county";
  const curM = cur ? mOf(cur) : mOf(T);
  const show = cur ?? { id: "", name: stateName, ...T };
  const sh = cur ? shift(cur.id) : null;
  const m24v = cur ? m24(cur.id) : null;

  // labels: the ten biggest counties, sized to the current view so they read the same at any zoom
  const fs = vb[2] / 70;
  // labels: the biggest counties in view, skipping any that would overlap a bigger one
  const labels: XRow[] = [];
  {
    const kept: [number, number, number, number][] = [];
    for (const r of byVotes.slice(0, 80)) {
      const b = boxes[r.id]; if (!b) continue;
      const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2;
      if (cx < vb[0] || cx > vb[0] + vb[2] || cy < vb[1] || cy > vb[1] + vb[3]) continue;
      const w = Math.max(r.name.replace(/ (County|Parish|Borough|city)$/i, "").length, 6) * fs * 0.56, h = fs * 2.3;
      const box: [number, number, number, number] = [cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2];
      if (kept.some((k) => box[0] < k[2] && box[2] > k[0] && box[1] < k[3] && box[3] > k[1])) continue;
      kept.push(box); labels.push(r);
      if (labels.length >= 28) break;
    }
  }

  // tug of war: net votes per county, left side counties from the center out to the left, right side to the right
  const aNet = rows.filter((r) => r.a > r.b).map((r) => ({ id: r.id, v: r.a - r.b })).sort((x, y) => y.v - x.v);
  const bNet = rows.filter((r) => r.b > r.a).map((r) => ({ id: r.id, v: r.b - r.a })).sort((x, y) => y.v - x.v);
  const aSum = aNet.reduce((s, x) => s + x.v, 0), bSum = bNet.reduce((s, x) => s + x.v, 0), span = Math.max(aSum, bSum) * 2 || 1;

  const legend = mode === "p24" ? { ramp: RAMP_CSS, l: "Harris +40", r: "Trump +40" } : mode === "turnout" ? { ramp: TURN_RAMP, l: "Fewest votes", r: "Most votes" }
    : mode === "shift" ? { ramp: indRace ? SHIFT_IND_RAMP : SHIFT_RAMP, l: `${sides[0].letter} +${shiftCap} from 2024`, r: `${sides[1].letter} +${shiftCap} from 2024` }
    : mode === "bubbles" ? null
    : kind === "measure" ? { ramp: YES_RAMP, l: "No +30", r: "Yes +30" } : { ramp: indRace ? RAMP_IND_CSS : RAMP_CSS, l: `${sides[0].letter} +40`, r: `${sides[1].letter} +40` };

  const modes: [Mode, string][] = kind === "race"
    ? [["margin", "2026 margin"], ...(p24 ? [["p24", "2024 president"] as [Mode, string]] : []), ["shift", "Shift from 2024"], ["bubbles", "Vote bubbles"], ["turnout", "Turnout"]]
    : [["margin", "Yes share"], ["bubbles", "Vote bubbles"], ["turnout", "Turnout"]];
  const tabs: [typeof tab, string][] = [["big", "Most votes"], ["a", kind === "measure" ? "Most Yes" : `Best for ${sides[0].short}`], ["b", kind === "measure" ? "Most No" : `Best for ${sides[1].short}`], ["close", "Closest"], ...(p24 ? [["shift", "Biggest shift"] as [typeof tab, string]] : [])];

  return (
    <div className="cx" onKeyDown={(e) => { if ((e.target as HTMLElement).tagName === "INPUT") return; if (e.key === "ArrowRight") { e.preventDefault(); stepBy(1); } if (e.key === "ArrowLeft") { e.preventDefault(); stepBy(-1); } if (e.key === "Escape") reset(); }}>
      <style>{CX_CSS}</style>
      <div>
        <div className="card cx-map">
          <div className="cx-bar">
            <h3>{title ?? `${stateName} by ${one}`}</h3>
            <div className="cx-seg" role="group" aria-label="Map view">
              {modes.map(([k, l]) => <button key={k} aria-pressed={mode === k} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <input className="cx-search" list="cx-names" placeholder={`Find a ${one}`} aria-label={`Find a ${one}`} id={`cx-find-${kind}`}
              onChange={(e) => { const hit = rows.find((r) => r.name.toLowerCase() === e.target.value.toLowerCase()); if (hit) { pick(hit.id, true); e.target.value = ""; e.target.blur(); } }} />
            <datalist id="cx-names">{byVotes.map((r) => <option key={r.id} value={r.name} />)}</datalist>
          </div>
          <div className="cx-stage">
            <svg className="cx-svg" viewBox={vb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${stateName} ${one} map`} onMouseLeave={() => setHov(null)}>
              {P.map((p) => (
                <path key={p.id} d={p.d} fill={fillOf(p.id)}
                  onMouseEnter={() => setHov(p.id)} onClick={() => pick(p.id, sel === p.id ? false : true)}>
                  <title>{R[p.id].name}</title>
                </path>
              ))}
              {mode === "bubbles" ? [...P].sort((x, y) => Math.abs(R[y.id].b - R[y.id].a) - Math.abs(R[x.id].b - R[x.id].a)).map((p) => {
                const r = R[p.id], b = boxes[p.id], net = r.b - r.a;
                return <circle key={p.id} cx={(b[0] + b[2]) / 2} cy={(b[1] + b[3]) / 2} r={Math.max(full[2] / 400, rMax * Math.sqrt(Math.abs(net) / maxNet))}
                  fill={net < 0 ? sides[0].color : sides[1].color} opacity={focus && focus !== p.id ? 0.55 : 0.85} />;
              }) : null}
              {hov && hov !== sel && boxes[hov] ? <path className="cx-hov" d={P.find((p) => p.id === hov)?.d} /> : null}
              {sel && boxes[sel] ? <path className="cx-out" d={P.find((p) => p.id === sel)?.d} /> : null}
              {mode !== "bubbles" ? labels.map((r) => { const b = boxes[r.id], x = (b[0] + b[2]) / 2, y = (b[1] + b[3]) / 2; const v = mode === "p24" ? m24(r.id) : mode === "shift" ? shift(r.id) : mode === "turnout" ? null : mOf(r); const sub = mode === "turnout" ? short(r.total) : v == null ? "" : mode === "shift" ? sMLabel(v) : mode === "p24" ? (Math.abs(v) < 0.05 ? "Even" : `${v < 0 ? "D" : "R"} +${Math.abs(v).toFixed(1)}`) : kind === "measure" ? `Yes ${(r.total ? (100 * r.a) / (r.a + r.b) : 50).toFixed(0)}%` : mLabel(v); return <text key={r.id} x={x} y={y - fs * 0.55} fontSize={fs} strokeWidth={fs / 4} textAnchor="middle" dominantBaseline="middle">{r.name.replace(/ (County|Parish|Borough|city)$/i, "")}{sub ? <tspan x={x} dy={fs * 1.1} fontSize={fs * 0.86} className="cx-sub">{sub}</tspan> : null}</text>; }) : null}
            </svg>
            <div className="cx-zoom">
              <button aria-label="Zoom in" onClick={() => zoom(1.6)}>+</button>
              <button aria-label="Zoom out" onClick={() => zoom(1 / 1.6)}>−</button>
              <button aria-label="Show the whole state" onClick={reset} style={{ fontSize: 12 }}>⤢</button>
            </div>
          </div>
          <div className="cx-legend">
            {legend ? <><span>{legend.l}</span><i style={{ background: legend.ramp }} /><span>{legend.r}</span></>
              : <><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill={sides[0].color} /></svg>{sides[0].short} net votes</span><span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><svg width="14" height="14" aria-hidden="true"><circle cx="7" cy="7" r="6" fill={sides[1].color} /></svg>{sides[1].short} net votes</span><span>Circle area is the vote margin</span></>}
            <span style={{ marginLeft: "auto" }}>Click a {one} to zoom · arrow keys step through {unit} by size</span>
          </div>
        </div>

        <div className="card cx-tug" style={{ marginTop: 16 }}>
          <div className="eye">Where the margin is won</div>
          <svg viewBox="0 0 1000 46" preserveAspectRatio="none" role="img" aria-label={`${sides[0].short} net ${fmt(aSum)} votes from ${aNet.length} ${unit}, ${sides[1].short} net ${fmt(bSum)} from ${bNet.length}`}>
            <rect x={0} y={8} width={1000} height={30} rx={6} fill="rgba(255,255,255,.04)" />
            {(() => { let x = 500; return aNet.map((s) => { const w = (s.v / span) * 1000; x -= w; return <rect key={s.id} x={x} y={8} width={Math.max(0.4, w - 0.6)} height={30} fill={sides[0].color} opacity={focus && focus !== s.id ? 0.55 : 1} onMouseEnter={() => setHov(s.id)} onClick={() => pick(s.id, true)}><title>{`${R[s.id].name}: ${sides[0].short} +${fmt(s.v)}`}</title></rect>; }); })()}
            {(() => { let x = 500; return bNet.map((s) => { const w = (s.v / span) * 1000; const el = <rect key={s.id} x={x} y={8} width={Math.max(0.4, w - 0.6)} height={30} fill={sides[1].color} opacity={focus && focus !== s.id ? 0.55 : 1} onMouseEnter={() => setHov(s.id)} onClick={() => pick(s.id, true)}><title>{`${R[s.id].name}: ${sides[1].short} +${fmt(s.v)}`}</title></rect>; x += w; return el; }); })()}
            <line x1={500} x2={500} y1={2} y2={44} stroke="var(--hi)" strokeWidth={2} />
          </svg>
          <div className="lab">
            <span><b style={{ color: sides[0].color }}>{sides[0].short} +{fmt(aSum)}</b> net votes from {aNet.length} {unit}</span>
            <span>Statewide <b>{mLabel(mOf(T))}</b>, a {fmt(Math.abs(aSum - bSum))} vote margin</span>
            <span><b style={{ color: sides[1].color }}>{sides[1].short} +{fmt(bSum)}</b> net votes from {bNet.length} {unit}</span>
          </div>
        </div>
      </div>

      <aside className="cx-rail">
        <div className="card cx-insp" aria-live="polite">
          <span className="eye">{cur ? `#${rank[cur.id]} of ${rows.length} by votes · ${((100 * cur.total) / (T.total || 1)).toFixed(1)}% of the state` : `Statewide · ${rows.length} ${unit}`}</span>
          <h4>{show.name}</h4>
          <div className="cx-big" style={{ color: curM < 0 ? sides[0].color : sides[1].color }}>{kind === "measure" ? `${((100 * show.a) / ((show.a + show.b) || 1)).toFixed(1)}% Yes` : mLabel(curM)}</div>
          {[0, 1].map((i) => { const v = i === 0 ? show.a : show.b; return (
            <div className="cx-row" key={i}><span className="nm">{sides[i].name}</span><span className="tr"><i style={{ width: `${(100 * v) / (show.total || 1)}%`, background: sides[i].color }} /></span><span className="vv">{fmt(v)} · {((100 * v) / (show.total || 1)).toFixed(1)}%</span></div>
          ); })}
          {show.other > 0 ? <div className="cx-row"><span className="nm" style={{ color: "var(--mute)" }}>Other</span><span className="tr"><i style={{ width: `${(100 * show.other) / (show.total || 1)}%`, background: "var(--mute)" }} /></span><span className="vv">{fmt(show.other)}</span></div> : null}
          <div className="cx-facts">
            <div><span>Projected votes</span><b>{short(show.total)}</b></div>
            <div><span>Net votes</span><b style={{ color: show.a > show.b ? sides[0].color : sides[1].color }}>{show.a > show.b ? sides[0].letter : sides[1].letter} +{short(Math.abs(show.a - show.b))}</b></div>
            {kind === "race" && cur && m24v != null ? <div><span>2024 president</span><b>{m24v < 0 ? "Harris" : "Trump"} +{Math.abs(m24v).toFixed(1)}</b></div> : null}
            {kind === "race" && cur && sh != null ? <div><span>Shift since 2024</span><b style={{ color: sh < 0 ? sides[0].color : "var(--gop2)" }}>{sMLabel(sh)}</b></div> : null}
          </div>
          <div className="cx-step">
            <button onClick={() => stepBy(-1)} aria-label={`Previous ${one} by size`}>Previous</button>
            <button onClick={reset} aria-label="Back to the statewide view">Statewide</button>
            <button onClick={() => stepBy(1)} aria-label={`Next ${one} by size`}>Next</button>
          </div>
        </div>

        <div className="card">
          <div className="cx-tabs" role="group" aria-label={`Rank the ${unit}`}>
            {tabs.map(([k, l]) => <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <ol className="cx-list">
            {(lists[tab] ?? []).slice(0, 9).map((r, i) => {
              const v = tab === "shift" ? shift(r.id)! : mOf(r);
              const col = tab === "shift" ? (v < 0 ? sides[0].color : "var(--gop2)") : v < 0 ? sides[0].color : sides[1].color;
              return (
                <li key={r.id}><button aria-current={sel === r.id} onMouseEnter={() => setHov(r.id)} onClick={() => pick(r.id, true)}>
                  <span className="rk">{i + 1}</span><span>{r.name}</span>
                  <span className="mv" style={{ color: col }}>{tab === "big" ? short(r.total) : tab === "shift" ? sMLabel(v) : kind === "measure" ? `${((100 * r.a) / ((r.a + r.b) || 1)).toFixed(0)}% Yes` : mLabel(v)}</span>
                </button></li>
              );
            })}
          </ol>
        </div>
      </aside>
    </div>
  );
}
