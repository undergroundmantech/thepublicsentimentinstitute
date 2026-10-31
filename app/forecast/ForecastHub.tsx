"use client";
// The forecast hub: every 2026 forecast on one board. The Senate, the House, the governors, the statewide
// offices and every state legislative seat are drawn together as one hemicycle of the whole ballot, one
// spectrum of every margin, a control strip and a legislature map, with the race desk below for drill down.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/Link";
import DaysOut from "@/app/components/DaysOut";
import { useRouter } from "next/navigation";
import { useJson } from "./ForecastDesk";
import { type DBJson, type Model, dbRaces, indSide } from "./lib";
import { RATE, raceHref } from "@/app/lib/opp";
import USLegisMap from "@/app/components/opp/USLegisMap";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { useSiteMode } from "@/app/lib/useSiteTheme";
import "./hub.css";

type Lvl = "sen" | "gov" | "db" | "house" | "sl";
type Item = { lvl: Lvl; p: number; m: number | null; name: string; sub: string; href: string; ind?: boolean };
type HubChamber = {
  id: string; st: string; state: string; chamber: "house" | "senate"; name: string; seats: number; up: number; majority: number;
  hold: Record<"D" | "R" | "O", number>; current: Record<"D" | "R" | "O", number>;
  demControl: number; gopControl: number; tie: number; demSeats: number; gopSeats: number; p10: number; p90: number; median: number;
  d: [string, number, number | null, number | null, (string | null)?, number?][]; holdD?: [string, string][];
};
type HubSL = { meta: { updated: string; chambers: number; districts: number; seatsUp: number }; chambers: HubChamber[] };

const LEVELS: { k: Lvl; label: string; one: string }[] = [
  { k: "sen", label: "Senate", one: "Senate seat" },
  { k: "gov", label: "Governors", one: "governorship" },
  { k: "db", label: "Statewide offices", one: "statewide office" },
  { k: "house", label: "House", one: "House seat" },
  { k: "sl", label: "State legislatures", one: "legislative seat" },
];
const LVL_LABEL = Object.fromEntries(LEVELS.map((l) => [l.k, l.label])) as Record<Lvl, string>;

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const fmtM = (m: number) => `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`;
function probFill(p: number, ind = false) {
  if (ind && p > 0.5) return RATE.ind;
  if (p >= 0.95) return RATE.safeD;
  if (p >= 0.8) return RATE.likelyD;
  if (p >= 0.6) return RATE.leanD;
  if (p > 0.4) return RATE.toss;
  if (p > 0.2) return RATE.leanR;
  if (p > 0.05) return RATE.likelyR;
  return RATE.safeR;
}
const slHref = (c: { st: string; chamber: string }) => `/forecast/legislatures/${c.st.toLowerCase()}/${c.chamber}`;
const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const cssVar = (el: Element, v: string, fb: string) => getComputedStyle(el).getPropertyValue(v).trim() || fb;

// ── data ──────────────────────────────────────────────────────────────────────
function useHub() {
  const model = useJson<Model>("/forecast/model.json");
  const db = useJson<DBJson>("/forecast/downballot.json");
  const sl = useJson<HubSL>("/forecast/statehouse_hub.json");
  const bm = useJson<{ updated: string; measures: [string, string, string, number, number, number, string][] }>("/forecast/measures_hub.json");
  const items = useMemo<Item[]>(() => {
    if (!model || !db || !sl) return [];
    const out: Item[] = [];
    for (const r of model.races) {
      const lvl: Lvl = r.office === "senate" ? "sen" : r.office === "governor" ? "gov" : "house";
      const unc = Math.abs(r.est.margin) >= 99.9;
      out.push({ lvl, p: 1 - r.est.prob, m: unc ? null : r.est.margin, name: r.name, href: raceHref(r.id), ind: indSide(r),
        sub: unc ? "Uncontested" : `${(r.dem || "").split(" ").pop()} vs ${(r.gop || "").split(" ").pop()}` });
    }
    for (const r of dbRaces(db, model.meta.sims)) {
      const unc = Math.abs(r.est.margin) >= 99.9;
      out.push({ lvl: "db", p: 1 - r.est.prob, m: unc ? null : r.est.margin, name: r.name, href: raceHref(r.id), sub: unc ? "Uncontested" : `${(r.dem || "").split(" ").pop()} vs ${(r.gop || "").split(" ").pop()}` });
    }
    for (const c of sl.chambers) {
      for (const [d, seats, p, m, , ind] of c.d) {
        const unc = m == null || Math.abs(m) >= 99;
        for (let i = 0; i < seats; i++) out.push({ lvl: "sl", p: p ?? 0.5, m: unc ? null : m, ind: !!ind, name: `${c.name}, District ${d}`, href: slHref(c), sub: unc ? "Uncontested or unopposed" : ind ? `${c.name}, independent challenger` : c.name });
      }
    }
    return out;
  }, [model, db, sl]);
  return { model, db, sl, items, bm };
}

// ── tooltip ───────────────────────────────────────────────────────────────────
type Tip = { x: number; y: number; it: Item } | null;
function HubTip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  const { it } = tip;
  const left = typeof window !== "undefined" ? Math.min(tip.x + 14, window.innerWidth - 250) : tip.x;
  return (
    <div className="hub-tip" style={{ left, top: tip.y + 14 }} role="status">
      <div className="eye">{LVL_LABEL[it.lvl]}</div>
      <b>{it.name}</b>
      <div className="hub-tip-row"><span style={{ color: "var(--mute)" }}>{it.sub}</span></div>
      <div className="hub-tip-row">
        <span className="d mono">D {pct(it.p)}</span>
        {it.m != null ? <span className={`mono ${it.m < 0 ? "d" : "r"}`}>{fmtM(it.m)}</span> : null}
        <span className="r mono">R {pct(1 - it.p)}</span>
      </div>
      <i className="hub-tip-bar"><s style={{ width: `${it.p * 100}%` }} /></i>
    </div>
  );
}

// ── the grand hemicycle ───────────────────────────────────────────────────────
type Dot = { x: number; y: number; r: number; a: number; rad: number; c: string; it: Item; band: number };
function layoutGrand(items: Item[], W: number) {
  const R = W / 2 - 4, cx = W / 2, cy = R + 4;
  const bands = LEVELS.map((l) => items.filter((i) => i.lvl === l.k).sort((a, b) => b.p - a.p || (a.m ?? 0) - (b.m ?? 0)));
  const w = bands.map((b) => Math.pow(Math.max(1, b.length), 0.6));
  const ws = w.reduce((a, b) => a + b, 0);
  const r0 = 0.2, gap = 0.016;
  const usable = 1 - r0 * r0 - gap * 2 * bands.length;
  let rin = r0;
  const dots: Dot[] = [];
  const rings: { rin: number; rout: number }[] = [];
  bands.forEach((band, bi) => {
    const rout = Math.sqrt(rin * rin + (usable * w[bi]) / ws);
    rings.push({ rin, rout });
    const n = band.length;
    if (n) {
      const t = rout - rin;
      const s = Math.sqrt(((Math.PI / 2) * (rout * rout - rin * rin)) / n);
      const rows = Math.max(1, Math.round(t / s));
      const radii = Array.from({ length: rows }, (_, i) => rin + ((i + 0.5) * t) / rows);
      const tot = radii.reduce((a, b) => a + b, 0);
      const counts = radii.map((r) => Math.max(1, Math.floor((n * r) / tot)));
      let left = n - counts.reduce((a, b) => a + b, 0);
      for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows) { counts[i]++; left--; }
      while (left < 0) { const i = counts.indexOf(Math.max(...counts)); counts[i]--; left++; }
      const pos: { a: number; r: number }[] = [];
      radii.forEach((r, i) => { for (let j = 0; j < counts[i]; j++) pos.push({ a: Math.PI - (Math.PI * (j + 0.5)) / counts[i], r }); });
      pos.sort((p, q) => q.a - p.a || p.r - q.r);
      const dotR = 0.44 * Math.min(t / rows, ...radii.map((r, i) => (Math.PI * r) / counts[i])) * R;
      band.forEach((it, k) => {
        const p = pos[k];
        dots.push({ x: cx + Math.cos(p.a) * p.r * R, y: cy - Math.sin(p.a) * p.r * R, r: Math.max(0.7, dotR), a: p.a, rad: p.r * R, c: probFill(it.p, it.ind), it, band: bi });
      });
    }
    rin = rout + gap * 2;
  });
  return { dots, rings, R, cx, cy, H: cy + 6 };
}

function GrandHemicycle({ items }: { items: Item[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const [tip, setTip] = useState<Tip>(null);
  const prog = useRef(0);
  const router = useRouter();
  // the canvas reads CSS tokens when it draws, so a mode change redraws it (statically, the fly-out plays once)
  const siteMode = useSiteMode();

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const L = useMemo(() => (W ? layoutGrand(items, W) : null), [items, W]);

  // draw, with one fly out from the center the first time the board appears
  useEffect(() => {
    const c = cv.current;
    if (!c || !L) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = L.H * dpr; c.style.height = `${L.H}px`;
    const ctx = c.getContext("2d")!;
    const byColor = new Map<string, Dot[]>();
    for (const d of L.dots) { const k = d.c; if (!byColor.has(k)) byColor.set(k, []); byColor.get(k)!.push(d); }
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, L.H);
      ctx.strokeStyle = cssVar(c, "--line", "rgba(255,255,255,.09)"); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(4, L.cy + 0.5); ctx.lineTo(W - 4, L.cy + 0.5); ctx.stroke();
      ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(L.cx, L.cy); ctx.lineTo(L.cx, L.cy - L.R); ctx.stroke(); ctx.setLineDash([]);
      for (const [col, ds] of byColor) {
        for (const pass of [0, 1]) {
          ctx.fillStyle = col;
          ctx.globalAlpha = pass === 0 ? 0.16 : 1;
          ctx.beginPath();
          for (const d of ds) {
            const dim = focus != null && d.band !== focus;
            if ((pass === 0) !== dim) continue;
            const delay = d.band * 0.07 + (1 - d.a / Math.PI) * 0.12;
            const e = Math.max(0, Math.min(1, (t - delay) / 0.62));
            const k = 1 - Math.pow(1 - e, 3);
            if (k <= 0) continue;
            const rr = d.rad * k;
            const x = L.cx + Math.cos(d.a) * rr, y = L.cy - Math.sin(d.a) * rr;
            ctx.moveTo(x + d.r, y); ctx.arc(x, y, d.r * (0.4 + 0.6 * k), 0, Math.PI * 2);
          }
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };
    if (prog.current >= 1 || reduced()) { prog.current = 1; draw(1); return; }
    let raf = 0; const t0 = performance.now();
    const step = (now: number) => {
      prog.current = Math.min(1, (now - t0) / 1900);
      draw(prog.current);
      if (prog.current < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [L, W, focus, siteMode]);

  const hit = (e: React.MouseEvent) => {
    if (!L || !cv.current) return null;
    const b = cv.current.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    let best: Dot | null = null, bd = Infinity;
    for (const d of L.dots) {
      if (focus != null && d.band !== focus) continue;
      const dd = (d.x - x) ** 2 + (d.y - y) ** 2;
      if (dd < bd) { bd = dd; best = d; }
    }
    return best && bd <= Math.max(36, (best.r * 2.2) ** 2) ? best : null;
  };

  const counts = LEVELS.map((l) => {
    const xs = items.filter((i) => i.lvl === l.k);
    return { n: xs.length, d: xs.filter((i) => i.p > 0.5).length, exp: xs.reduce((a, i) => a + i.p, 0) };
  });
  const all = { n: items.length, d: items.filter((i) => i.p > 0.5).length };
  const sel = focus == null ? null : { ...counts[focus], label: LEVELS[focus].label };

  return (
    <div className="hub-grand">
      <div className="hub-grand-stage" ref={wrap}>
        <canvas ref={cv} style={{ width: "100%", display: "block" }} aria-label={`Every seat on the 2026 ballot, ${all.n.toLocaleString()} dots, colored by who is favored`} role="img"
          onMouseMove={(e) => { const d = hit(e); setTip(d ? { x: e.clientX, y: e.clientY, it: d.it } : null); if (cv.current) cv.current.style.cursor = d ? "pointer" : "default"; }}
          onMouseLeave={() => setTip(null)}
          onClick={(e) => { const d = hit(e); if (d) router.push(d.it.href); }} />
        {L ? (
          <div className="hub-grand-mid" style={{ bottom: 8, width: L.R * 0.4 }}>
            <div className="hub-grand-n mono" style={{ fontSize: Math.max(13, L.R * 0.085) }}>{(sel ? sel.n : all.n).toLocaleString()}</div>
            {W >= 560 ? <div className="eye">{sel ? sel.label : "Seats on the ballot"}</div> : null}
            <div className="hub-grand-split" style={{ fontSize: Math.max(9, L.R * 0.028) }}>
              <span className="d mono">{(sel ? sel.d : all.d).toLocaleString()}</span>
              <i />
              <span className="r mono">{((sel ? sel.n - sel.d : all.n - all.d)).toLocaleString()}</span>
            </div>
          </div>
        ) : null}
      </div>
      <div className="hub-chips" role="group" aria-label="Show one level">
        <button className={focus == null ? "on" : ""} onClick={() => setFocus(null)}>Everything <span className="mono">{all.n.toLocaleString()}</span></button>
        {LEVELS.map((l, i) => (
          <button key={l.k} className={focus === i ? "on" : ""} onClick={() => setFocus(focus === i ? null : i)}>
            <span className="hub-ring" data-band={i} />{l.label} <span className="mono">{counts[i].n.toLocaleString()}</span>
          </button>
        ))}
      </div>
      <div className="hub-legend">
        <span>Ring order from the center: Senate, governors, statewide offices, House, state legislatures</span>
        <span className="hub-ramp"><b>Democrats favored</b><i style={{ background: RATE.safeD }} /><i style={{ background: RATE.likelyD }} /><i style={{ background: RATE.leanD }} /><i style={{ background: RATE.toss }} /><i style={{ background: RATE.leanR }} /><i style={{ background: RATE.likelyR }} /><i style={{ background: RATE.safeR }} /><b>Republicans favored</b></span>
      </div>
      <HubTip tip={tip} />
    </div>
  );
}

// ── the spectrum: every margin on one axis ────────────────────────────────────
function Spectrum({ items }: { items: Item[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(0);
  const [tip, setTip] = useState<Tip>(null);
  const router = useRouter();
  const siteMode = useSiteMode(); // tokens are read at draw time; redraw on a mode change
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);
  const LANE_H: Record<Lvl, number> = { sen: 54, gov: 54, db: 78, house: 128, sl: 210 };
  const L = useMemo(() => {
    if (!W) return null;
    const padL = W < 560 ? 8 : 150, padR = 12, M = 50;
    const X = (m: number) => padL + ((Math.max(-M, Math.min(M, m)) + M) / (2 * M)) * (W - padL - padR);
    const lanes: { lvl: Lvl; y0: number; h: number; unc: number; n: number }[] = [];
    const dots: { x: number; y: number; r: number; c: string; it: Item }[] = [];
    let y = 26;
    for (const l of LEVELS) {
      const h = W < 560 ? LANE_H[l.k] * 0.8 : LANE_H[l.k];
      const xs = items.filter((i) => i.lvl === l.k && i.m != null);
      const unc = items.filter((i) => i.lvl === l.k && i.m == null).length;
      const r = l.k === "sl" ? 1.5 : l.k === "house" ? 2.3 : 3.6;
      const bw = r * 2;
      const bins = new Map<number, number>();
      const edge = X(M) - 1, edge0 = X(-M) + 1;
      const placed = xs.sort((a, b) => Math.abs(a.m!) - Math.abs(b.m!)).map((it) => {
        const x = X(it.m!); const k = Math.round(x / bw); const c = bins.get(k) ?? 0; bins.set(k, c + 1);
        return { it, x: k * bw, c };
      });
      // the stack height comes from the busiest bins inside the axis, not the pile of landslides at either end
      const inner = Array.from(bins.entries()).filter(([k]) => k * bw < edge - bw && k * bw > edge0 + bw).map(([, v]) => Math.ceil(v / 2)).sort((a, b) => a - b);
      const ref = Math.max(1, inner.length ? inner[Math.floor(inner.length * 0.97)] : 1);
      const half = h / 2 - r;
      const step = Math.min(bw * 0.95, half / ref);
      const mid = y + h / 2;
      for (const p of placed) {
        const s = p.c === 0 ? 0 : (p.c % 2 ? -1 : 1) * Math.ceil(p.c / 2);
        const off = Math.max(-half, Math.min(half, s * step));
        dots.push({ x: p.x, y: mid + off, r, c: probFill(p.it.p, p.it.ind), it: p.it });
      }
      lanes.push({ lvl: l.k, y0: y, h, unc, n: xs.length });
      y += h + 10;
    }
    return { X, lanes, dots, H: y + 14, padL };
  }, [items, W]);

  useEffect(() => {
    const c = cv.current;
    if (!c || !L) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = L.H * dpr; c.style.height = `${L.H}px`;
    const ctx = c.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, L.H);
    const mute = cssVar(c, "--mute", "#8e86a3"), line = cssVar(c, "--line", "rgba(255,255,255,.09)"), ink = cssVar(c, "--ink", "#f3eff8");
    ctx.font = `600 11px ${cssVar(c, "--font-m", "monospace")}`;
    ctx.textAlign = "center"; ctx.fillStyle = mute;
    for (const t of [-40, -20, 0, 20, 40]) {
      const x = L.X(t);
      ctx.strokeStyle = t === 0 ? cssVar(c, "--gold", "#e7b341") : line; ctx.lineWidth = t === 0 ? 1.2 : 1;
      ctx.setLineDash(t === 0 ? [3, 3] : []);
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, L.H - 14); ctx.stroke();
      ctx.fillText(t === 0 ? "Even" : `${t < 0 ? "D" : "R"} +${Math.abs(t)}`, x, 13);
    }
    ctx.setLineDash([]);
    for (const ln of L.lanes) {
      ctx.strokeStyle = line; ctx.beginPath(); ctx.moveTo(L.padL, ln.y0 + ln.h + 5); ctx.lineTo(W - 12, ln.y0 + ln.h + 5); ctx.stroke();
      if (L.padL > 40) {
        ctx.textAlign = "left"; ctx.fillStyle = ink; ctx.font = `700 13px ${cssVar(c, "--font-b", "sans-serif")}`;
        ctx.fillText(LVL_LABEL[ln.lvl], 4, ln.y0 + ln.h / 2 - 2);
        ctx.fillStyle = mute; ctx.font = `500 11px ${cssVar(c, "--font-m", "monospace")}`;
        ctx.fillText(`${ln.n.toLocaleString()} races${ln.unc ? ` · ${ln.unc.toLocaleString()} unopposed` : ""}`, 4, ln.y0 + ln.h / 2 + 14);
      }
    }
    const byC = new Map<string, typeof L.dots>();
    for (const d of L.dots) { if (!byC.has(d.c)) byC.set(d.c, []); byC.get(d.c)!.push(d); }
    for (const [col, ds] of byC) {
      ctx.fillStyle = col; ctx.globalAlpha = 0.92; ctx.beginPath();
      for (const d of ds) { ctx.moveTo(d.x + d.r, d.y); ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }, [L, W, siteMode]);

  const hit = (e: React.MouseEvent) => {
    if (!L || !cv.current) return null;
    const b = cv.current.getBoundingClientRect();
    const x = e.clientX - b.left, y = e.clientY - b.top;
    let best = null as (typeof L.dots)[number] | null, bd = Infinity;
    for (const d of L.dots) { const dd = (d.x - x) ** 2 + (d.y - y) ** 2; if (dd < bd) { bd = dd; best = d; } }
    return best && bd < 49 ? best : null;
  };
  return (
    <div className="hub-spec" ref={wrap}>
      {W && W < 560 ? <div className="hub-spec-key">{LEVELS.map((l) => <span key={l.k}>{l.label}</span>)}</div> : null}
      <canvas ref={cv} style={{ width: "100%", display: "block" }} role="img" aria-label="Every forecast margin on one axis, one lane per level"
        onMouseMove={(e) => { const d = hit(e); setTip(d ? { x: e.clientX, y: e.clientY, it: d.it } : null); if (cv.current) cv.current.style.cursor = d ? "pointer" : "default"; }}
        onMouseLeave={() => setTip(null)} onClick={(e) => { const d = hit(e); if (d) router.push(d.it.href); }} />
      <HubTip tip={tip} />
    </div>
  );
}

// ── control strip ─────────────────────────────────────────────────────────────
function Meter({ label, big, unit, p, sub, href, onClick, neutral }: { label: string; big: string; unit: string; p: number; sub: React.ReactNode; href?: string; onClick?: () => void; neutral?: boolean }) {
  const inner = (
    <>
      <div className="hub-m-lab">{label}</div>
      <div className="hub-m-big"><span className={neutral ? "" : p >= 0.5 ? "d" : "r"} style={neutral ? { color: "#2fbf9b" } : undefined}>{big}</span><small>{unit}</small></div>
      {neutral ? null : <div className="hub-m-bar" aria-hidden><i style={{ width: `${p * 100}%` }} /><b /></div>}
      <div className="hub-m-sub">{sub}</div>
    </>
  );
  return href ? <Link href={href} className="card hub-m">{inner}</Link> : <button type="button" className="card hub-m" onClick={onClick}>{inner}</button>;
}

// ── the page ──────────────────────────────────────────────────────────────────
export default function ForecastHub() {
  const { model, sl, items, bm } = useHub();
  const router = useRouter();
  const goDesk = (office: string) => {
    router.replace(`/forecast?office=${office}`, { scroll: false });
    setTimeout(() => document.getElementById("desk")?.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "start" }), 60);
  };
  const ready = !!(model && sl && items.length);
  const by = (k: Lvl) => items.filter((i) => i.lvl === k);
  const dbLive = by("db").filter((i) => i.m != null);
  const govs = by("gov");
  const chambersD = sl ? sl.chambers.reduce((a, c) => a + c.demControl, 0) : 0;
  const favD = sl ? sl.chambers.filter((c) => c.demControl > c.gopControl).length : 0;
  const closest = items.filter((i) => i.lvl !== "sl" && i.m != null).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 14);
  const edge = sl ? [...sl.chambers].sort((a, b) => Math.abs(a.demControl - 0.5) - Math.abs(b.demControl - 0.5)).slice(0, 10) : [];
  const gb = model?.meta.genericBallot;

  return (
    <section className="hub fc-wide" aria-labelledby="hub-h">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Forecast</span></nav>
      <ForecastNav />
      <div className="hub-top">
        <div className="card hub-stagecard">
          {ready ? <GrandHemicycle items={items} /> : <div className="hub-loading"><span />Drawing every seat on the ballot</div>}
        </div>
        <aside className="hub-side">
          <header className="hub-hero">
            <div className="eye g">2026 forecast{model ? <> · <DaysOut initial={model.meta.daysOut} suffix=" days out" /></> : ""}</div>
            <h1 id="hub-h">Every race on the ballot. <em>One board.</em></h1>
            <p className="lede">
              The Senate, the House, {govs.length || 36} governors, {by("db").length || 114} statewide offices and {sl?.chambers.length ?? 87} state legislative chambers,
              forecast on one national environment, plus {bm ? bm.measures.length : 145} statewide ballot measures. Each dot is one seat on the 2026 ballot, colored by who is favored. Hover for the odds, click for the race.
            </p>
            <div className="hub-ribbon">
              <span><b className="mono">{ready ? items.length.toLocaleString() : "6,700"}</b>seats</span>
              <span><b className="mono">2,000</b>simulations</span>
              {gb ? <span><b className={`mono ${gb.avg > 0 ? "r" : "d"}`}>{fmtM(gb.avg)}</b>generic ballot</span> : null}
            </div>
            <Link href="/swingometer" className="hub-swing">
              <span className="eye g">New</span>
              <b>Swingometer</b>
              <span>Move any group of voters and watch every race and chamber move with them</span>
            </Link>
          </header>
          {ready && model && sl ? (
            <div className="hub-meters">
              <Meter label="Senate" big={pct(model.chambers.senate.demControl)} unit="Democratic control" p={model.chambers.senate.demControl}
                sub={<>Average <b className="d">{model.chambers.senate.demSeats.toFixed(1)}</b> D seats of 100</>} onClick={() => goDesk("senate")} />
              <Meter label="House" big={pct(model.chambers.house.demControl)} unit="Democratic control" p={model.chambers.house.demControl}
                sub={<>Average <b className="d">{model.chambers.house.demSeats.toFixed(0)}</b> D seats of 435</>} onClick={() => goDesk("house")} />
              <Meter label="Governors" big={`${govs.filter((g) => g.p > 0.5).length} of ${govs.length}`} unit="favor Democrats" p={model.chambers.governor.demControl}
                sub={<>Democrats lead most governorships in <b className="d">{pct(model.chambers.governor.demControl)}</b></>} onClick={() => goDesk("governor")} />
              <Meter label="Statewide offices" big={`${dbLive.filter((r) => r.p > 0.5).length} of ${dbLive.length}`} unit="favor Democrats" p={dbLive.length ? dbLive.filter((r) => r.p > 0.5).length / dbLive.length : 0.5}
                sub={<>Expected Democratic wins <b className="d">{dbLive.reduce((a, r) => a + r.p, 0).toFixed(1)}</b></>} onClick={() => goDesk("attorney-general")} />
              <Meter label="State legislatures" big={`${favD} of ${sl.chambers.length}`} unit="favor Democrats" p={favD / sl.chambers.length}
                sub={<>Expected Democratic chambers <b className="d">{chambersD.toFixed(1)}</b></>} href="/forecast/legislatures" />
              {bm ? (() => {
                const n = bm.measures.length, pass = bm.measures.filter((x) => x[4] > 0.5).length, close = bm.measures.filter((x) => x[4] > 0.35 && x[4] < 0.65).length;
                return <Meter label="Ballot measures" big={`${pass} of ${n}`} unit="favored to pass" p={0.5} neutral
                  sub={<>{close} close calls across {new Set(bm.measures.map((x) => x[0])).size} states</>} href="/forecast/measures" />;
              })() : null}
            </div>
          ) : null}
        </aside>
      </div>

      {ready && model && sl ? (
        <>
          <div className="hub-two">
            <div className="card">
              <div className="card-h"><h3>Every state legislative district</h3><Link className="btn sm" href="/forecast/legislatures" style={{ marginLeft: "auto" }}>All {sl.chambers.length} chambers</Link></div>
              <div className="card-b"><USLegisMap chambers={sl.chambers} /></div>
            </div>
            <div className="card">
              <div className="card-h"><h3>On the knife&apos;s edge</h3><span className="eye" style={{ marginLeft: "auto" }}>Closest odds</span></div>
              <div className="card-b hub-edge">
                {closest.map((it) => (
                  <Link key={it.href + it.name} href={it.href} className="hub-edge-row">
                    <span className="hub-tag">{LVL_LABEL[it.lvl]}</span>
                    <span className="hub-edge-name">{it.name}</span>
                    <span className="hub-edge-bar"><i style={{ width: `${it.p * 100}%` }} /></span>
                    <span className={`mono ${it.p >= 0.5 ? "d" : "r"}`}>{it.p >= 0.5 ? `D ${pct(it.p)}` : `R ${pct(1 - it.p)}`}</span>
                  </Link>
                ))}
                <div className="hub-edge-h eye">Legislative chambers</div>
                {edge.map((c) => (
                  <Link key={c.id} href={slHref(c)} className="hub-edge-row">
                    <span className="hub-tag sl">{c.st}</span>
                    <span className="hub-edge-name">{c.name}</span>
                    <span className="hub-edge-bar"><i style={{ width: `${c.demControl * 100}%` }} /></span>
                    <span className={`mono ${c.demControl >= 0.5 ? "d" : "r"}`}>{c.demControl >= 0.5 ? `D ${pct(c.demControl)}` : `R ${pct(c.gopControl)}`}</span>
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {bm ? (
            <div className="card hub-bm">
              <div className="card-h"><h3>Ballot measures</h3><span className="eye" style={{ marginLeft: "auto" }}>{bm.measures.length} statewide questions · closest first</span><Link className="btn sm" href="/forecast/measures">All measures</Link></div>
              <div className="card-b hub-bm-grid">
                {[...bm.measures].sort((a, b) => Math.abs(a[4] - 0.5) - Math.abs(b[4] - 0.5)).slice(0, 12).map(([st, label, title, yes, prob, thr, href]) => (
                  <Link key={href} href={href} className="hub-bm-row">
                    <span className="hub-tag sl">{st}</span>
                    <span className="hub-bm-name"><b>{label}</b><small>{title}</small></span>
                    <span className="hub-bm-bar" title={`Yes ${yes.toFixed(1)}%, needs ${Math.round(thr * 1000) / 10}%`}><i style={{ width: `${Math.max(0, Math.min(100, ((yes - 20) / 60) * 100))}%` }} /><s style={{ left: `${((thr * 100 - 20) / 60) * 100}%` }} /></span>
                    <span className="mono hub-bm-p" style={{ color: prob >= 0.6 ? "#2fbf9b" : prob <= 0.4 ? "#e8794a" : "var(--gold)" }}>{pct(prob)}</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}

          <div className="card hub-speccard">
            <div className="card-h"><h3>Every margin on one line</h3><span className="eye" style={{ marginLeft: "auto" }}>{items.filter((i) => i.m != null).length.toLocaleString()} contested races</span></div>
            <div className="card-b"><Spectrum items={items} /></div>
          </div>
        </>
      ) : null}
    </section>
  );
}
