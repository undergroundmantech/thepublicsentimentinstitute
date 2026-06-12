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
  usePlotArea,
} from "recharts";
import type { MultiDaily, MultiPollPoint, MultiSeries } from "@/app/polling/lib/aggregates";

/* =============================================================================
   MultiCandidateChart — N-candidate primary chart. Same visual language as the
   head-to-head chart (black, mono, faint flag, poll cloud, on-chart hover that
   fades the future), minus the margin/spread which only apply head-to-head.
============================================================================= */

type Props = {
  daily: MultiDaily[];
  polls: MultiPollPoint[];
  series: MultiSeries[];
  unit?: string;
  animKey?: string;
};

type Range = "3M" | "6M" | "All";
type Plot = { x: number; y: number; width: number; height: number };

const DAY = 86400000;
const LINE_ANIM = true;
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
function nearestIndex(rows: MultiDaily[], t: number) {
  let lo = 0, hi = rows.length - 1;
  if (hi < 0) return -1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (rows[mid].t < t) lo = mid + 1; else hi = mid; }
  if (lo > 0 && Math.abs(rows[lo - 1].t - t) <= Math.abs(rows[lo].t - t)) return lo - 1;
  return lo;
}

function PlotAreaReporter({ onChange }: { onChange: (p: Plot) => void }) {
  const plot = usePlotArea();
  const key = plot ? `${Math.round(plot.x)},${Math.round(plot.y)},${Math.round(plot.width)},${Math.round(plot.height)}` : "";
  useEffect(() => { if (plot) onChange({ x: plot.x, y: plot.y, width: plot.width, height: plot.height }); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function EndLabels({ series, last, domain }: { series: MultiSeries[]; last: number[]; domain: [number, number] }) {
  const plot = usePlotArea();
  if (!plot) return null;
  const [dMin, dMax] = domain;
  const span = dMax - dMin || 1;
  const toY = (v: number) => clamp(plot.y + plot.height * (1 - (v - dMin) / span), plot.y + 8, plot.y + plot.height - 8);
  const placed = series
    .map((s, i) => ({ color: s.color, label: s.label, value: last[i], y: toY(last[i]) }))
    .filter((p) => Number.isFinite(p.value))
    .sort((a, b) => a.y - b.y);
  const gap = 24;
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
          <text x={22} y={-1} dominantBaseline="middle" style={{ fontFamily: "var(--font-body),monospace", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }} fill={it.color}>{it.value.toFixed(1)}</text>
          <text x={22} y={11} dominantBaseline="middle" style={{ fontFamily: "var(--font-body),monospace", fontSize: 8.5, fontWeight: 600, letterSpacing: "0.06em" }} fill="rgba(255,255,255,0.45)">{it.label.length > 11 ? it.label.slice(0, 10) + "…" : it.label}</text>
        </g>
      ))}
    </g>
  );
}

function HoverLayer({ plot, rows, series, xDomain, yDomain, unit }: {
  plot: Plot; rows: MultiDaily[]; series: MultiSeries[]; xDomain: [number, number]; yDomain: [number, number]; unit: string;
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
  const placeLeft = sx > plot.width - 150;

  type Chip = { color: string; label: string; value: number; vy: number; ly: number };
  let chips: Chip[] = [];
  if (row) {
    chips = series
      .map((s, i) => ({ color: s.color, label: s.label, value: row.v[i], vy: yOf(row.v[i]) }))
      .filter((c) => Number.isFinite(c.value))
      .map((c) => ({ ...c, ly: c.vy }))
      .sort((a, b) => a.ly - b.ly);
    for (let i = 1; i < chips.length; i++) if (chips[i].ly - chips[i - 1].ly < 24) chips[i].ly = chips[i - 1].ly + 24;
    const over = chips.length ? chips[chips.length - 1].ly - (plot.height - 8) : 0;
    if (over > 0) chips.forEach((c) => (c.ly -= over));
  }

  return (
    <div className="mcc-hit" style={{ left: plot.x, top: plot.y, width: plot.width, height: plot.height }}
      onMouseMove={onMove} onMouseLeave={onLeave} onTouchStart={onTouch} onTouchMove={onTouch}>
      {row && (
        <>
          <div className="mcc-dim" style={{ left: sx, width: Math.max(0, plot.width - sx) }} />
          <div className="mcc-slider" style={{ left: sx }} />
          <div className="mcc-date" style={{ left: clamp(sx, 44, plot.width - 44) }}>{fmtHoverDate(row.t)}</div>
          {chips.map((c, i) => (
            <React.Fragment key={i}>
              <span className="mcc-adot" style={{ left: sx, top: c.vy, background: c.color, color: c.color }} />
              <div className={`mcc-chip ${placeLeft ? "is-left" : ""}`} style={{ left: sx, top: c.ly }}>
                <span className="mcc-chip-label">{c.label}</span>
                <span className="mcc-chip-val" style={{ color: c.color }}>{c.value.toFixed(1)}{unit}</span>
              </div>
            </React.Fragment>
          ))}
        </>
      )}
    </div>
  );
}

export default function MultiCandidateChart({ daily, polls, series, unit = "%", animKey = "" }: Props) {
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

  const dots = useMemo(() =>
    fPolls.flatMap((p) => series.map((s, i) => ({ t: p.t, y: p.v[i], color: s.color, r: dotRadius(p.sampleSize), p }))
      .filter((d) => Number.isFinite(d.y))), [fPolls, series]);

  const yDomain = useMemo<[number, number]>(() => {
    let lo = Infinity, hi = -Infinity;
    const push = (v: number) => { if (Number.isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } };
    fDaily.forEach((d) => d.v.forEach(push));
    fPolls.forEach((p) => p.v.forEach(push));
    if (!Number.isFinite(lo)) return [0, 60];
    const pad = Math.max(2, (hi - lo) * 0.12);
    return [Math.max(0, Math.floor(lo - pad)), Math.ceil(hi + pad)];
  }, [fDaily, fPolls]);

  // recharts-friendly keyed data (c0,c1,…) — avoids function dataKey pitfalls.
  // Each series also carries a 95% band (b0,b1,…): 1.96·sd/√n of poll residuals
  // inside a ±45-day window, floored at half a point, gap-filled from neighbors.
  const chartData = useMemo(() => {
    const WIN = 45 * DAY;
    const ps = [...fPolls].sort((x, y) => x.t - y.t);
    const cis: (number | null)[][] = fDaily.map((d) => series.map((_, i) => {
      let n = 0, s = 0, s2 = 0;
      for (const p of ps) {
        if (p.t < d.t - WIN) continue;
        if (p.t > d.t + WIN) break;
        const v = p.v[i];
        if (!Number.isFinite(v) || !Number.isFinite(d.v[i])) continue;
        const r = v - d.v[i];
        n++; s += r; s2 += r * r;
      }
      if (n < 3) return null;
      const mean = s / n;
      const sd = Math.sqrt(Math.max(0, s2 / n - mean * mean));
      return Math.min(8, Math.max(0.5, (1.96 * sd) / Math.sqrt(n)));
    }));
    for (let i = 1; i < cis.length; i++) for (let k = 0; k < series.length; k++) cis[i][k] = cis[i][k] ?? cis[i - 1][k];
    for (let i = cis.length - 2; i >= 0; i--) for (let k = 0; k < series.length; k++) cis[i][k] = cis[i][k] ?? cis[i + 1][k];
    return fDaily.map((d, di) => {
      const o: Record<string, number | [number, number]> = { t: d.t };
      series.forEach((_, i) => {
        o[`c${i}`] = d.v[i];
        const ci = cis[di][i];
        if (ci != null && Number.isFinite(d.v[i])) o[`b${i}`] = [d.v[i] - ci, d.v[i] + ci];
      });
      return o;
    });
  }, [fDaily, fPolls, series]);

  const xDomain = useMemo<[number, number]>(() => (fDaily.length ? [fDaily[0].t, fDaily[fDaily.length - 1].t] : [0, 1]), [fDaily]);
  const ticks = useMemo(() => monthTicks(xDomain[0], xDomain[1]), [xDomain]);
  const last = fDaily.length ? fDaily[fDaily.length - 1].v : series.map(() => NaN);
  const rightMargin = narrow ? 14 : 116;

  const renderDot = (props: { cx?: number; cy?: number; payload?: { r: number; color: string } }) => {
    const { cx, cy, payload } = props;
    if (cx == null || cy == null || !payload) return <g />;
    return <circle cx={cx} cy={cy} r={payload.r} fill={payload.color} fillOpacity={0.2} />;
  };

  return (
    <div className="mcc" ref={wrapRef}>
      <style>{CSS}</style>

      <div className="mcc-controls">
        <div className="mcc-legend">
          {series.map((s, i) => (
            <span key={s.key} className="mcc-legend-item"><span className="mcc-legend-dot" style={{ background: s.color }} />{s.label}{Number.isFinite(last[i]) ? <b style={{ color: s.color }}>{last[i].toFixed(1)}</b> : null}</span>
          ))}
        </div>
        <div className="mcc-controls-right">
          <button className={`mcc-toggle ${showPolls ? "is-on" : ""}`} aria-pressed={showPolls} onClick={() => setShowPolls((s) => !s)}>{fPolls.length} polls</button>
          <div className="mcc-seg" role="tablist" aria-label="Time range">
            {(["3M", "6M", "All"] as Range[]).map((r) => (
              <button key={r} role="tab" aria-selected={range === r} className={`mcc-seg-btn ${range === r ? "is-active" : ""}`} onClick={() => setRange(r)}>{r}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="mcc-plot" style={{ height: "clamp(300px, 44vh, 480px)" }}>
        <div className="mcc-flag" aria-hidden>
          <div className="mcc-flag-stripes" />
          <div className="mcc-flag-canton"><div className="mcc-flag-stars" /></div>
        </div>
        <div className="mcc-plot-svg">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart key={animKey} data={chartData} margin={{ top: 18, right: rightMargin, left: 4, bottom: 6 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.045)" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={xDomain} ticks={ticks} tickFormatter={fmtTick} tickLine={false} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickMargin={12}
                tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
              <YAxis domain={yDomain} tickLine={false} axisLine={false} width={40} tickMargin={6} tickFormatter={(v) => `${v}${unit}`}
                tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.4)" }} />
              {showPolls && <Scatter data={dots} dataKey="y" shape={renderDot} isAnimationActive={false} />}
              {series.map((s, i) => (
                <Area key={`b-${s.key}`} type="monotone" dataKey={`b${i}`} stroke="none" fill={s.color} fillOpacity={0.08} isAnimationActive={false} activeDot={false} connectNulls />
              ))}
              {series.map((s, i) => (
                <Line key={`c-${s.key}`} type="monotone" dataKey={`c${i}`} name={s.label} stroke={s.color} strokeWidth={2.25} dot={false} activeDot={false} connectNulls isAnimationActive={LINE_ANIM} animationDuration={850} animationBegin={i * 90} />
              ))}
              {!narrow && <EndLabels series={series} last={last} domain={yDomain} />}
              <PlotAreaReporter onChange={setPlot} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {plot && <HoverLayer plot={plot} rows={fDaily} series={series} xDomain={xDomain} yDomain={yDomain} unit={unit} />}
      </div>
    </div>
  );
}

const CSS = `
  .mcc { position: relative; }
  .mcc-controls { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; }
  .mcc-legend { display: flex; flex-wrap: wrap; gap: 7px 16px; }
  .mcc-legend-item { display: inline-flex; align-items: center; gap: 7px; font-family: var(--font-body), monospace; font-size: 12px; color: rgba(255,255,255,0.62); }
  .mcc-legend-item b { font-variant-numeric: tabular-nums; margin-left: 1px; }
  .mcc-legend-dot { width: 8px; height: 8px; border-radius: 50%; }
  .mcc-controls-right { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .mcc-seg { display: inline-flex; padding: 3px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.09); border-radius: 10px; }
  .mcc-seg-btn { appearance: none; border: 0; background: transparent; cursor: pointer; font-family: var(--font-body), monospace; font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); padding: 6px 11px; border-radius: 7px; line-height: 1; transition: color 160ms ease, background 160ms ease; }
  .mcc-seg-btn:hover { color: rgba(255,255,255,0.82); }
  .mcc-seg-btn.is-active { color: #000; background: #fafafa; }
  .mcc-toggle { display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; color: rgba(255,255,255,0.5); padding: 7px 13px; border-radius: 9px; line-height: 1; border: 1px solid rgba(255,255,255,0.09); background: transparent; transition: color 160ms ease, border-color 160ms ease, opacity 160ms ease; }
  .mcc-toggle:hover { color: rgba(255,255,255,0.85); border-color: rgba(255,255,255,0.18); }
  .mcc-toggle:not(.is-on) { opacity: 0.5; }

  .mcc-plot { width: 100%; position: relative; }
  .mcc-plot-svg { position: relative; z-index: 1; height: 100%; }
  .mcc .recharts-surface { overflow: visible; }

  .mcc-flag { position: absolute; inset: 0; z-index: 0; pointer-events: none; overflow: hidden; border-radius: 8px; }
  .mcc-flag-stripes { position: absolute; inset: 0; background: repeating-linear-gradient(180deg, rgba(229,72,77,0.038) 0, rgba(229,72,77,0.038) 7.6923%, rgba(255,255,255,0.015) 7.6923%, rgba(255,255,255,0.015) 15.3846%); }
  .mcc-flag-canton { position: absolute; left: 0; top: 0; width: 38%; height: 53.84%; background: rgba(70,116,206,0.055); }
  .mcc-flag-stars { position: absolute; inset: 0; background-image: radial-gradient(rgba(255,255,255,0.11) 0.6px, transparent 0.7px); background-size: 9.5% 18%; background-position: 4% 9%; }

  .mcc-hit { position: absolute; pointer-events: auto; cursor: crosshair; z-index: 3; touch-action: pan-y; }
  .mcc-hit > * { pointer-events: none; }
  .mcc-dim { position: absolute; top: 0; bottom: 0; background: linear-gradient(90deg, rgba(0,0,0,0) 0, rgba(0,0,0,0.62) 30px); }
  .mcc-slider { position: absolute; top: 0; bottom: 0; width: 1px; background: rgba(255,255,255,0.5); }
  .mcc-date { position: absolute; top: -4px; transform: translate(-50%, -100%); font-family: var(--font-body), monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.06em; color: rgba(255,255,255,0.6); white-space: nowrap; text-shadow: 0 0 5px #000, 0 0 8px #000; }
  .mcc-adot { position: absolute; width: 11px; height: 11px; border-radius: 50%; border: 2.5px solid #000; transform: translate(-50%, -50%); box-shadow: 0 0 10px -1px currentColor; }
  .mcc-chip { position: absolute; transform: translate(15px, -50%); display: inline-flex; align-items: baseline; gap: 7px; white-space: nowrap; text-shadow: 0 0 5px #000, 0 0 9px #000, 0 0 9px #000, 0 1px 2px #000; }
  .mcc-chip.is-left { transform: translate(calc(-100% - 15px), -50%); }
  .mcc-chip-label { font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; color: #fff; }
  .mcc-chip-val { font-family: var(--font-body), monospace; font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; }
`;
