"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  usePlotArea,
} from "recharts";
import type { AggDaily, AggPollPoint, Series } from "@/app/polling/lib/aggregates";

/* =============================================================================
   AggregatePollChart — poll cloud + PSI aggregate line + RCP-style spread.
   Hover is a lightweight HTML overlay on an rAF loop (the SVG renders once and
   never re-renders on mouse move), so it stays smooth with 500+ dots. Hovering
   fades everything to the right of the readout line.
============================================================================= */

type Props = {
  daily: AggDaily[];
  polls: AggPollPoint[];
  seriesA: Series;
  seriesB: Series;
  fmtMargin: (n: number) => string;
  marginLabel: string;
  unit?: string;
  animKey?: string;
};

type View = "share" | "margin";
type Range = "3M" | "6M" | "All";
type Plot = { x: number; y: number; width: number; height: number };

const DAY = 86400000;
const LINE_ANIM = true; // set false to verify static geometry in headless capture
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function fmtTick(t: number) {
  const d = new Date(t);
  return d.toLocaleDateString(undefined, { month: "short" }) + (d.getMonth() === 0 ? ` ’${String(d.getFullYear()).slice(2)}` : "");
}
function fmtHoverDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
function monthTicks(minT: number, maxT: number): number[] {
  const out: number[] = [];
  const d = new Date(minT);
  d.setDate(1);
  if (d.getTime() < minT) d.setMonth(d.getMonth() + 1);
  while (d.getTime() <= maxT) { out.push(d.getTime()); d.setMonth(d.getMonth() + 1); }
  if (out.length <= 7) return out;
  const step = Math.ceil(out.length / 7);
  return out.filter((_, i) => i % step === 0);
}
function dotRadius(n: number) {
  const s = Math.sqrt(Math.max(0, n)) / Math.sqrt(3000);
  return clamp(1.5 + s * 3.1, 1.5, 4.6);
}
function nearestIndex(rows: AggDaily[], t: number) {
  let lo = 0, hi = rows.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].t < t) lo = mid + 1; else hi = mid; }
  if (lo > 0 && Math.abs(rows[lo - 1].t - t) <= Math.abs(rows[lo].t - t)) return lo - 1;
  return lo;
}

/* report the recharts plot rect upward (fires only when geometry changes) */
function PlotAreaReporter({ onChange }: { onChange: (p: Plot) => void }) {
  const plot = usePlotArea();
  const key = plot ? `${Math.round(plot.x)},${Math.round(plot.y)},${Math.round(plot.width)},${Math.round(plot.height)}` : "";
  useEffect(() => { if (plot) onChange({ x: plot.x, y: plot.y, width: plot.width, height: plot.height }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/* direct end-of-line labels */
function EndLabels({ items, domain, small = false }: { items: { color: string; value: number; big: string; small: string }[]; domain: [number, number]; small?: boolean }) {
  const plot = usePlotArea();
  if (!plot || !items.length) return null;
  const [dMin, dMax] = domain;
  const span = dMax - dMin || 1;
  const toY = (v: number) => clamp(plot.y + plot.height * (1 - (v - dMin) / span), plot.y + 8, plot.y + plot.height - 8);
  const placed = items.map((it) => ({ ...it, y: toY(it.value) })).sort((a, b) => a.y - b.y);
  const gap = small ? 16 : 26;
  for (let i = 1; i < placed.length; i++) if (placed[i].y - placed[i - 1].y < gap) placed[i].y = placed[i - 1].y + gap;
  const over = placed.length ? placed[placed.length - 1].y - (plot.y + plot.height - 6) : 0;
  if (over > 0) placed.forEach((p) => (p.y -= over));
  const x = plot.x + plot.width;
  return (
    <g>
      {placed.map((it, i) => (
        <g key={i} transform={`translate(${x},${it.y})`}>
          <line x1={2} y1={0} x2={11} y2={0} stroke={it.color} strokeWidth={1.25} opacity={0.5} />
          <circle cx={14} cy={0} r={3} fill={it.color} />
          <text x={22} y={small ? 0 : -1} dominantBaseline="middle" style={{ fontFamily: "var(--font-body),monospace", fontSize: small ? 11.5 : 13, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} fill={it.color}>{it.big}</text>
          {!small && <text x={22} y={12} dominantBaseline="middle" style={{ fontFamily: "var(--font-body),monospace", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.08em" }} fill="rgba(255,255,255,0.42)">{it.small}</text>}
        </g>
      ))}
    </g>
  );
}

/* HTML hover overlay — owns its own state so the chart never re-renders on hover */
function HoverLayer({ plot, rows, xDomain, yDomain, view, seriesA, seriesB, fmtMargin, marginLabel, unit }: {
  plot: Plot; rows: AggDaily[]; xDomain: [number, number]; yDomain: [number, number];
  view: View; seriesA: Series; seriesB: Series; fmtMargin: (n: number) => string; marginLabel: string; unit: string;
}) {
  const [idx, setIdx] = useState(-1);
  const raf = useRef(0);
  const pend = useRef<number | null>(null);

  const xspan = (xDomain[1] - xDomain[0]) || 1;
  const [dMin, dMax] = yDomain;
  const yspan = (dMax - dMin) || 1;
  const xOf = (t: number) => ((t - xDomain[0]) / xspan) * plot.width;
  const yOf = (v: number) => clamp((1 - (v - dMin) / yspan) * plot.height, 6, plot.height - 6);

  const scrub = (clientX: number, el: Element) => {
    const r = el.getBoundingClientRect();
    pend.current = clientX - r.left;
    if (!raf.current) raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      if (pend.current == null) return;
      const frac = clamp(pend.current / plot.width, 0, 1);
      setIdx(nearestIndex(rows, xDomain[0] + frac * xspan));
    });
  };
  const onMove = (e: React.MouseEvent) => scrub(e.clientX, e.currentTarget);
  const onTouch = (e: React.TouchEvent) => { const t = e.touches[0]; if (t) scrub(t.clientX, e.currentTarget); };
  const onLeave = () => { if (raf.current) { cancelAnimationFrame(raf.current); raf.current = 0; } setIdx(-1); };
  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);

  const row = idx >= 0 && idx < rows.length ? rows[idx] : null;
  const sx = row ? xOf(row.t) : 0;
  const net = row ? row.net : 0;
  const leader = net >= 0 ? seriesA.color : seriesB.color;
  const placeLeft = sx > plot.width - 150;

  type Chip = { color: string; label: string; value: string; vy: number; ly: number };
  let chips: Chip[] = [];
  if (row) {
    const base = view === "share"
      ? [
          { color: seriesA.color, label: seriesA.label, value: `${row.a.toFixed(1)}${unit}`, vy: yOf(row.a) },
          { color: seriesB.color, label: seriesB.label, value: `${row.b.toFixed(1)}${unit}`, vy: yOf(row.b) },
        ]
      : [{ color: leader, label: marginLabel, value: fmtMargin(net), vy: yOf(net) }];
    chips = base.map((c) => ({ ...c, ly: c.vy })).sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < chips.length; i++) if (chips[i].ly - chips[i - 1].ly < 28) chips[i].ly = chips[i - 1].ly + 28;
    const over = chips[chips.length - 1].ly - (plot.height - 10);
    if (over > 0) chips.forEach((c) => (c.ly -= over));
  }

  return (
    <div
      className="apc-hit"
      style={{ left: plot.x, top: plot.y, width: plot.width, height: plot.height }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onTouchStart={onTouch}
      onTouchMove={onTouch}
    >
      {row && (
        <>
          {/* fade everything to the right of the line */}
          <div className="apc-dim" style={{ left: sx, width: Math.max(0, plot.width - sx) }} />
          {/* readout line */}
          <div className="apc-slider" style={{ left: sx }} />
          {/* date + net pinned at top */}
          <div className="apc-net" style={{ left: clamp(sx, 52, plot.width - 52) }}>
            <span className="apc-net-date">{fmtHoverDate(row.t)}</span>
            <span className="apc-net-val">
              <span className="apc-net-k">{marginLabel}</span>
              <b style={{ color: leader }}>{fmtMargin(net)}</b>
            </span>
          </div>
          {/* single marker on the line + a borderless label riding it */}
          {chips.map((c, i) => (
            <React.Fragment key={i}>
              <span className="apc-adot" style={{ left: sx, top: c.vy, background: c.color, color: c.color }} />
              <div className={`apc-chip ${placeLeft ? "is-left" : ""}`} style={{ left: sx, top: c.ly }}>
                <span className="apc-chip-label">{c.label}</span>
                <span className="apc-chip-val" style={{ color: c.color }}>{c.value}</span>
              </div>
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
}

/* ----------------------------- component ----------------------------- */

export default function AggregatePollChart({ daily, polls, seriesA, seriesB, fmtMargin, marginLabel, unit = "%", animKey = "" }: Props) {
  const [view, setView] = useState<View>("share");
  const [range, setRange] = useState<Range>("All");
  const [showPolls, setShowPolls] = useState(true);
  const [plot, setPlot] = useState<Plot | null>(null);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((e) => { const w = e[0]?.contentRect?.width; if (w) setWidth(w); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const narrow = width < 600;

  const maxT = daily.length ? daily[daily.length - 1].t : 0;
  const cutoff = range === "All" ? -Infinity : maxT - (range === "3M" ? 92 : 183) * DAY;
  const fDaily = useMemo(() => daily.filter((d) => d.t >= cutoff), [daily, cutoff]);
  const fPolls = useMemo(() => polls.filter((p) => p.t >= cutoff), [polls, cutoff]);

  // 95% confidence band — per day, the dispersion of poll residuals around the
  // average inside a ±45-day window: ci = 1.96 · sd/√n, floored at half a point.
  // Sparse stretches inherit the nearest computed band so the ribbon never gaps.
  const banded = useMemo(() => {
    type BandRow = AggDaily & { aBand?: [number, number]; bBand?: [number, number]; netBand?: [number, number] };
    if (!fDaily.length) return fDaily as BandRow[];
    const WIN = 45 * DAY;
    const ps = [...fPolls].sort((x, y) => x.t - y.t);
    const cis = fDaily.map((d) => {
      let n = 0, sa = 0, sa2 = 0, sb = 0, sb2 = 0, sn = 0, sn2 = 0;
      for (const p of ps) {
        if (p.t < d.t - WIN) continue;
        if (p.t > d.t + WIN) break;
        const ra = p.a - d.a, rb = p.b - d.b, rn = p.margin - d.net;
        n++; sa += ra; sa2 += ra * ra; sb += rb; sb2 += rb * rb; sn += rn; sn2 += rn * rn;
      }
      const ci = (s: number, s2: number) => {
        if (n < 3) return null;
        const mean = s / n;
        const sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
        return Math.min(8, Math.max(0.5, (1.96 * sd) / Math.sqrt(n)));
      };
      return { a: ci(sa, sa2), b: ci(sb, sb2), net: ci(sn, sn2) };
    });
    // forward-fill then back-fill so thin weeks inherit a neighbor's band
    for (let i = 1; i < cis.length; i++) { cis[i].a = cis[i].a ?? cis[i - 1].a; cis[i].b = cis[i].b ?? cis[i - 1].b; cis[i].net = cis[i].net ?? cis[i - 1].net; }
    for (let i = cis.length - 2; i >= 0; i--) { cis[i].a = cis[i].a ?? cis[i + 1].a; cis[i].b = cis[i].b ?? cis[i + 1].b; cis[i].net = cis[i].net ?? cis[i + 1].net; }
    return fDaily.map((d, i): BandRow => ({
      ...d,
      aBand: cis[i].a != null ? [d.a - cis[i].a!, d.a + cis[i].a!] : undefined,
      bBand: cis[i].b != null ? [d.b - cis[i].b!, d.b + cis[i].b!] : undefined,
      netBand: cis[i].net != null ? [d.net - cis[i].net!, d.net + cis[i].net!] : undefined,
    }));
  }, [fDaily, fPolls]);

  const dots = useMemo(() => {
    if (view === "share") {
      return fPolls.flatMap((p) => [
        { t: p.t, y: p.a, color: seriesA.color, r: dotRadius(p.sampleSize), p },
        { t: p.t, y: p.b, color: seriesB.color, r: dotRadius(p.sampleSize), p },
      ]);
    }
    return fPolls.map((p) => ({ t: p.t, y: p.margin, color: p.margin >= 0 ? seriesA.color : seriesB.color, r: dotRadius(p.sampleSize), p }));
  }, [fPolls, view, seriesA.color, seriesB.color]);

  const yDomain = useMemo<[number, number]>(() => {
    let lo = Infinity, hi = -Infinity;
    const push = (v: number) => { if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } };
    if (view === "share") { banded.forEach((d) => { push(d.a); push(d.b); if (d.aBand) { push(d.aBand[0]); push(d.aBand[1]); } if (d.bBand) { push(d.bBand[0]); push(d.bBand[1]); } }); fPolls.forEach((p) => { push(p.a); push(p.b); }); }
    else { banded.forEach((d) => { push(d.net); if (d.netBand) { push(d.netBand[0]); push(d.netBand[1]); } }); fPolls.forEach((p) => push(p.margin)); push(0); }
    if (!Number.isFinite(lo)) return view === "share" ? [35, 55] : [-10, 15];
    const pad = Math.max(1.5, (hi - lo) * 0.12);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [banded, fPolls, view]);

  const spreadDomain = useMemo<[number, number]>(() => {
    let lo = Infinity, hi = -Infinity;
    fDaily.forEach((d) => { lo = Math.min(lo, d.net); hi = Math.max(hi, d.net); });
    if (!Number.isFinite(lo)) return [-5, 5];
    const pad = Math.max(1, (hi - lo) * 0.18);
    return [Math.floor(lo - pad), Math.ceil(hi + pad)];
  }, [fDaily]);
  const spreadOffset = useMemo(() => { const [lo, hi] = spreadDomain; return clamp(hi / (hi - lo || 1), 0, 1); }, [spreadDomain]);

  const xDomain = useMemo<[number, number]>(() => (fDaily.length ? [fDaily[0].t, fDaily[fDaily.length - 1].t] : [0, 1]), [fDaily]);
  const ticks = useMemo(() => monthTicks(xDomain[0], xDomain[1]), [xDomain]);

  const last = fDaily[fDaily.length - 1];
  const endItems = useMemo(() => {
    if (!last) return [];
    if (view === "share") return [
      { color: seriesA.color, value: last.a, big: last.a.toFixed(1), small: seriesA.label },
      { color: seriesB.color, value: last.b, big: last.b.toFixed(1), small: seriesB.label },
    ];
    return [{ color: last.net >= 0 ? seriesA.color : seriesB.color, value: last.net, big: fmtMargin(last.net), small: marginLabel }];
  }, [last, view, seriesA, seriesB, fmtMargin, marginLabel]);
  const spreadEnd = useMemo(() => (last ? [{ color: last.net >= 0 ? seriesA.color : seriesB.color, value: last.net, big: fmtMargin(last.net), small: marginLabel }] : []), [last, seriesA, seriesB, fmtMargin, marginLabel]);

  const rightMargin = narrow ? 14 : 110;

  const renderDot = (props: { cx?: number; cy?: number; payload?: { r: number; color: string } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return <g />;
    return <circle cx={cx} cy={cy} r={payload.r} fill={payload.color} fillOpacity={0.2} />;
  };

  return (
    <div className="apc" ref={wrapRef}>
      <style>{CSS}</style>

      <div className="apc-controls">
        <div className="apc-seg" role="tablist" aria-label="View">
          {(["share", "margin"] as View[]).map((v) => (
            <button key={v} role="tab" aria-selected={view === v} className={`apc-seg-btn ${view === v ? "is-active" : ""}`} onClick={() => setView(v)}>
              {v === "share" ? "Share" : "Margin"}
            </button>
          ))}
        </div>
        <div className="apc-controls-right">
          <button className={`apc-toggle ${showPolls ? "is-on" : ""}`} aria-pressed={showPolls} onClick={() => setShowPolls((s) => !s)}>
            <span className="apc-toggle-dots" aria-hidden><i style={{ background: seriesA.color }} /><i style={{ background: seriesB.color }} /></span>
            {fPolls.length} polls
          </button>
          <div className="apc-seg apc-seg-sm" role="tablist" aria-label="Time range">
            {(["3M", "6M", "All"] as Range[]).map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={`apc-seg-btn ${range === r ? "is-active" : ""}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      {/* main */}
      <div className="apc-plot" style={{ height: "clamp(280px, 40vh, 440px)" }}>
        <div className="apc-flag" aria-hidden>
          <div className="apc-flag-stripes" />
          <div className="apc-flag-canton"><div className="apc-flag-stars" /></div>
        </div>
        <div className="apc-plot-svg">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={animKey} data={banded} margin={{ top: 22, right: rightMargin, left: 4, bottom: 2 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={xDomain} ticks={ticks} tick={false} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} height={6} />
            <YAxis domain={yDomain} tickLine={false} axisLine={false} width={44} tickMargin={6}
              tickFormatter={(v) => (view === "share" ? `${v}${unit}` : fmtMargin(Number(v)))}
              tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
            {view === "margin" && <ReferenceLine y={0} stroke="rgba(255,255,255,0.22)" strokeDasharray="2 4" />}
            {showPolls && <Scatter data={dots} dataKey="y" shape={renderDot} isAnimationActive={false} />}
            {view === "share" ? (
              <>
                <Area type="monotone" dataKey="aBand" stroke="none" fill={seriesA.color} fillOpacity={0.09} isAnimationActive={false} activeDot={false} connectNulls />
                <Area type="monotone" dataKey="bBand" stroke="none" fill={seriesB.color} fillOpacity={0.09} isAnimationActive={false} activeDot={false} connectNulls />
                <Line type="monotone" dataKey="a" stroke={seriesA.color} strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={LINE_ANIM} animationDuration={850} />
                <Line type="monotone" dataKey="b" stroke={seriesB.color} strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={LINE_ANIM} animationDuration={850} animationBegin={120} />
              </>
            ) : (
              <>
                <Area type="monotone" dataKey="netBand" stroke="none" fill="#ffffff" fillOpacity={0.06} isAnimationActive={false} activeDot={false} connectNulls />
                <Line type="monotone" dataKey="net" stroke="rgba(255,255,255,0.92)" strokeWidth={2.5} dot={false} activeDot={false} isAnimationActive={LINE_ANIM} animationDuration={850} />
              </>
            )}
            {!narrow && <EndLabels items={endItems} domain={yDomain} />}
            <PlotAreaReporter onChange={setPlot} />
          </ComposedChart>
        </ResponsiveContainer>
        </div>
        {plot && (
          <HoverLayer plot={plot} rows={fDaily} xDomain={xDomain} yDomain={yDomain} view={view}
            seriesA={seriesA} seriesB={seriesB} fmtMargin={fmtMargin} marginLabel={marginLabel} unit={unit} />
        )}
      </div>

      {/* RCP-style spread */}
      <div className="apc-spread-cap"><span>Spread</span><span className="apc-spread-sub">{marginLabel} over time</span></div>
      <div className="apc-spread" style={{ height: 116 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart key={animKey} data={fDaily} margin={{ top: 6, right: rightMargin, left: 4, bottom: 4 }}>
            <defs>
              <linearGradient id="apc-spread-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={seriesA.color} stopOpacity={0.55} />
                <stop offset={`${spreadOffset * 100}%`} stopColor={seriesA.color} stopOpacity={0.06} />
                <stop offset={`${spreadOffset * 100}%`} stopColor={seriesB.color} stopOpacity={0.06} />
                <stop offset="100%" stopColor={seriesB.color} stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <XAxis dataKey="t" type="number" scale="time" domain={xDomain} ticks={ticks} tickFormatter={fmtTick} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickMargin={10}
              tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
            <YAxis domain={spreadDomain} width={44} tick={false} tickLine={false} axisLine={false} />
            <ReferenceLine y={0} stroke="rgba(255,255,255,0.28)" />
            <Area type="monotone" dataKey="net" stroke="rgba(255,255,255,0.5)" strokeWidth={1.25} fill="url(#apc-spread-grad)" isAnimationActive={false} />
            {!narrow && <EndLabels items={spreadEnd} domain={spreadDomain} small />}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {narrow && (
        <div className="apc-legend">
          {endItems.map((it, i) => (
            <span key={i} className="apc-legend-item"><span className="apc-legend-dot" style={{ background: it.color }} />{it.small}<b style={{ color: it.color }}>{it.big}</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

const CSS = `
  .apc { position: relative; }
  .apc-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
  .apc-controls-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }

  .apc-seg { display: inline-flex; padding: 3px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; }
  .apc-seg-btn { appearance: none; border: 0; background: transparent; cursor: pointer; font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); padding: 7px 16px; border-radius: 7px; line-height: 1; transition: color 160ms ease, background 160ms ease; }
  .apc-seg-sm .apc-seg-btn { padding: 6px 11px; font-size: 11px; }
  .apc-seg-btn:hover { color: rgba(255,255,255,0.82); }
  .apc-seg-btn.is-active { color: #000; background: #fafafa; box-shadow: 0 1px 2px rgba(0,0,0,0.5); }

  .apc-toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); padding: 7px 13px; border-radius: 9px; line-height: 1; border: 1px solid rgba(255,255,255,0.09); background: transparent; transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease; }
  .apc-toggle:hover { color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.18); }
  .apc-toggle:not(.is-on) { opacity: 0.5; }
  .apc-toggle.is-on { color: rgba(255,255,255,0.85); }
  .apc-toggle-dots { display: inline-flex; gap: 3px; }
  .apc-toggle-dots i { width: 7px; height: 7px; border-radius: 50%; display: block; }

  .apc-plot { width: 100%; position: relative; }
  .apc-plot-svg { position: relative; z-index: 1; height: 100%; }
  .apc .recharts-surface { overflow: visible; }

  /* faint American-flag motif behind the chart */
  .apc-flag { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; border-radius: 8px; }
  .apc-flag-stripes { position: absolute; inset: 0; background: repeating-linear-gradient(180deg,
    rgba(229,72,77,0.038) 0, rgba(229,72,77,0.038) 7.6923%,
    rgba(255,255,255,0.015) 7.6923%, rgba(255,255,255,0.015) 15.3846%); }
  .apc-flag-canton { position: absolute; left: 0; top: 0; width: 38%; height: 53.84%; background: rgba(70,116,206,0.055); }
  .apc-flag-stars { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.11) 0.6px, transparent 0.7px); background-size: 9.5% 18%; background-position: 4% 9%; }

  /* hover overlay */
  .apc-hit { position: absolute; pointer-events: auto; cursor: crosshair; z-index: 3; touch-action: pan-y; }
  .apc-hit > * { pointer-events: none; }
  .apc-dim { position: absolute; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(0,0,0,0) 0, rgba(0,0,0,0.62) 30px); }
  .apc-slider { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.5); }
  /* borderless readout — text floats with a dark halo, no boxes */
  .apc-net { position: absolute; top: -4px; transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; gap: 3px; white-space: nowrap; text-shadow: 0 0 5px #000, 0 0 8px #000, 0 1px 2px #000; }
  .apc-net-date { font-family: var(--font-body), monospace; font-size: 9.5px; font-weight: 600; letter-spacing: 0.06em; color: rgba(255,255,255,0.55); }
  .apc-net-val { display: inline-flex; align-items: baseline; gap: 7px; }
  .apc-net-k { font-family: var(--font-body), monospace; font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .apc-net-val b { font-family: var(--font-body), monospace; font-size: 16px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }

  .apc-adot { position: absolute; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #000; transform: translate(-50%, -50%); box-shadow: 0 0 10px -1px currentColor; }
  .apc-chip { position: absolute; transform: translate(15px, -50%); display: inline-flex; align-items: baseline; gap: 7px; white-space: nowrap; text-shadow: 0 0 5px #000, 0 0 9px #000, 0 0 9px #000, 0 1px 2px #000; }
  .apc-chip.is-left { transform: translate(calc(-100% - 15px), -50%); }
  .apc-chip-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; align-self: center; }
  .apc-chip-label { font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; color: #fff; }
  .apc-chip-val { font-family: var(--font-body), monospace; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }

  .apc-spread-cap { display: flex; align-items: baseline; gap: 10px; margin: 14px 0 2px; padding-left: 4px; }
  .apc-spread-cap > span:first-child { font-family: var(--font-body), monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(255,255,255,0.5); }
  .apc-spread-sub { font-family: var(--font-body), monospace; font-size: 10px; color: rgba(255,255,255,0.3); letter-spacing: 0.04em; }
  .apc-spread { width: 100%; }

  .apc-legend { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 12px 4px 2px; justify-content: center; }
  .apc-legend-item { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-body), monospace; font-size: 12px; color: rgba(255,255,255,0.55); }
  .apc-legend-item b { font-variant-numeric: tabular-nums; margin-left: 2px; }
  .apc-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
`;
