"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  usePlotArea,
} from "recharts";

/* =============================================================================
   PollingTimeSeriesChart — editorial redesign
   Aesthetic: data-journalism, dark. Lines are the hero; direct end-of-line
   labels replace the legend; a calm, spacious tooltip; generous negative space.
   Props API is unchanged so every existing poll page keeps working.
============================================================================= */

type Row = { date: string; [key: string]: string | number };
type Series = { key: string; label: string; color: string };

type Props = {
  data: Row[];
  series: Series[];
  yDomain?: [number, number];
  title?: string;
  subtitle?: string;
  /** small tracked label above the title */
  eyebrow?: string;
  /** caption shown in the footer line */
  note?: string;
};

/* ----------------------------- math helpers ----------------------------- */

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function niceDomain(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 60];
  if (min === max) return [min - 2, max + 2];
  const pad = Math.max(1.5, (max - min) * 0.14);
  return [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2];
}

function parseISO(iso: string): Date {
  return new Date(iso + "T00:00:00");
}

function fmtAxisDate(iso: string): string {
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function fmtLongDate(iso: string): string {
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "long", day: "numeric", year: "numeric" });
}

function fmtRangeEdge(iso: string): string {
  const d = parseISO(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function fmtPct(v: number): string {
  return Number.isFinite(v) ? `${v.toFixed(1)}%` : "–";
}

/* ----------------------------- tooltip ----------------------------- */

function PollTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((it: any) => it?.value != null && it.dataKey !== "date")
    .map((it: any) => ({
      key: it.dataKey,
      name: it.name,
      value: Number(it.value),
      color: it.color || it.stroke || "#fff",
    }))
    .sort((a: any, b: any) => b.value - a.value);

  const lead =
    rows.length >= 2 ? rows[0].value - rows[1].value : null;

  return (
    <div className="psts-tip">
      <div className="psts-tip-date">{fmtLongDate(label ?? "")}</div>
      <div className="psts-tip-rows">
        {rows.map((r: any) => (
          <div key={r.key} className="psts-tip-row">
            <span className="psts-tip-name">
              <span className="psts-tip-swatch" style={{ background: r.color }} />
              {r.name}
            </span>
            <span className="psts-tip-val" style={{ color: r.color }}>
              {fmtPct(r.value)}
            </span>
          </div>
        ))}
      </div>
      {lead != null && (
        <div className="psts-tip-lead">
          <span className="psts-tip-lead-label">Margin</span>
          <span className="psts-tip-lead-val" style={{ color: rows[0].color }}>
            {rows[0].name} +{lead.toFixed(1)}
          </span>
        </div>
      )}
    </div>
  );
}

/* ----------------- direct end-of-line labels (v3 hook layer) ----------------- */

function EndLabels({
  data,
  series,
  domain,
}: {
  data: Row[];
  series: Series[];
  domain: [number, number];
}) {
  const plot = usePlotArea();
  if (!plot || !data.length) return null;

  const [dMin, dMax] = domain;
  const span = dMax - dMin || 1;
  const last = data[data.length - 1];
  const toY = (v: number) =>
    clamp(plot.y + plot.height * (1 - (v - dMin) / span), plot.y + 7, plot.y + plot.height - 7);

  type Item = Series & { value: number; y: number };
  const items: Item[] = series
    .map((s) => {
      const v = Number(last[s.key]);
      if (!Number.isFinite(v)) return null;
      return { ...s, value: v, y: toY(v) };
    })
    .filter(Boolean) as Item[];

  if (!items.length) return null;

  // De-collide vertically so close values stay legible.
  items.sort((a, b) => a.y - b.y);
  const gap = 21;
  for (let i = 1; i < items.length; i++) {
    if (items[i].y - items[i - 1].y < gap) items[i].y = items[i - 1].y + gap;
  }
  const bottom = plot.y + plot.height - 5;
  const overflow = items[items.length - 1].y - bottom;
  if (overflow > 0) items.forEach((it) => (it.y -= overflow));

  const x = plot.x + plot.width;

  return (
    <g className="psts-endlabels">
      {items.map((it) => (
        <g key={it.key} transform={`translate(${x},${it.y})`}>
          <line x1={2} y1={0} x2={11} y2={0} stroke={it.color} strokeWidth={1.25} opacity={0.45} />
          <circle cx={14} cy={0} r={3} fill={it.color} />
          <text
            x={22}
            y={0}
            dominantBaseline="middle"
            fill={it.color}
            style={{ fontFamily: "var(--font-body), monospace", fontSize: 12.5, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
          >
            {it.value.toFixed(1)}
          </text>
          <text
            x={22}
            y={13}
            dominantBaseline="middle"
            fill="rgba(255,255,255,0.5)"
            style={{ fontFamily: "var(--font-body), monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.06em" }}
          >
            {it.label.length > 11 ? it.label.slice(0, 10) + "…" : it.label}
          </text>
        </g>
      ))}
    </g>
  );
}

/* ----------------------------- component ----------------------------- */

export default function PollingTimeSeriesChart({
  data,
  series,
  yDomain,
  title = "Polling average",
  subtitle = "Daily weighted average across all surveys in the dataset.",
  eyebrow = "Polling Average",
  note = "Daily weighted averages — not raw poll points.",
}: Props) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(900);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width;
      if (w) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = width < 560;

  const computedDomain = useMemo<[number, number]>(() => {
    if (yDomain) return yDomain;
    let min = Infinity,
      max = -Infinity;
    for (const row of data) {
      for (const s of series) {
        const v = Number(row[s.key]);
        if (!isFinite(v)) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    return isFinite(min) && isFinite(max) ? niceDomain(min, max) : [0, 60];
  }, [data, series, yDomain]);

  const tickDates = useMemo(() => {
    const n = data.length;
    if (n <= 1) return undefined;
    const step = clamp(Math.round(n / (narrow ? 4 : 7)), 6, 120);
    return data.map((d) => d.date).filter((_, i) => i % step === 0 || i === n - 1);
  }, [data, narrow]);

  // Current standing — derived from the latest row, for the header readout.
  const standing = useMemo(() => {
    const last = data[data.length - 1];
    if (!last) return null;
    const vals = series
      .map((s) => ({ ...s, value: Number(last[s.key]) }))
      .filter((s) => Number.isFinite(s.value))
      .sort((a, b) => b.value - a.value);
    if (!vals.length) return null;
    const leadVal = vals.length >= 2 ? vals[0].value - vals[1].value : null;
    return { leader: vals[0], lead: leadVal, date: last.date };
  }, [data, series]);

  const range = useMemo(() => {
    if (!data.length) return null;
    return { start: data[0].date, end: data[data.length - 1].date };
  }, [data]);

  const rightMargin = narrow ? 14 : 116;

  return (
    <div className="psts" ref={wrapRef}>
      <style>{CSS}</style>

      {/* ---------- header ---------- */}
      <header className="psts-head">
        <div className="psts-head-main">
          <div className="psts-eyebrow">
            <span className="psts-eyebrow-tick" />
            {eyebrow}
          </div>
          <h3 className="psts-title">{title}</h3>
          <p className="psts-subtitle">{subtitle}</p>
        </div>

        {standing && (
          <div className="psts-standing">
            <div className="psts-standing-label">Current leader</div>
            <div className="psts-standing-name" style={{ color: standing.leader.color }}>
              {standing.leader.label}
            </div>
            {standing.lead != null && (
              <div className="psts-standing-lead">
                <span className="psts-standing-lead-val" style={{ color: standing.leader.color }}>
                  +{standing.lead.toFixed(1)}
                </span>
                <span className="psts-standing-lead-unit">pts</span>
              </div>
            )}
          </div>
        )}
      </header>

      {/* ---------- chart ---------- */}
      <div className="psts-plot">
        <div style={{ height: "clamp(280px, 40vh, 480px)" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 16, right: rightMargin, left: 2, bottom: 6 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.045)" strokeDasharray="0" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: "rgba(255,255,255,0.08)" }}
                tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.38)" }}
                ticks={tickDates}
                tickFormatter={fmtAxisDate}
                tickMargin={12}
                minTickGap={24}
              />
              <YAxis
                domain={computedDomain}
                tickLine={false}
                axisLine={false}
                tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.38)" }}
                tickFormatter={(v) => `${v}%`}
                width={38}
                tickMargin={6}
              />
              <ReferenceLine
                y={50}
                stroke="rgba(255,255,255,0.16)"
                strokeDasharray="2 5"
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.22)", strokeWidth: 1, strokeDasharray: "3 4" }}
                content={<PollTooltip />}
                wrapperStyle={{ zIndex: 20, outline: "none" }}
                animationDuration={140}
              />
              {series.map((s, i) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label}
                  stroke={s.color}
                  strokeWidth={2.25}
                  dot={false}
                  connectNulls
                  isAnimationActive
                  animationBegin={i * 120}
                  animationDuration={900}
                  animationEasing="ease-out"
                  activeDot={{ r: 4.5, stroke: "var(--psts-surface)", strokeWidth: 2.5, fill: s.color }}
                />
              ))}
              {!narrow && <EndLabels data={data} series={series} domain={computedDomain} />}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* compact legend on narrow screens (end-labels are hidden there) */}
        {narrow && (
          <div className="psts-legend">
            {series.map((s) => {
              const last = data[data.length - 1];
              const v = last ? Number(last[s.key]) : NaN;
              return (
                <span key={s.key} className="psts-legend-item">
                  <span className="psts-legend-dot" style={{ background: s.color }} />
                  <span className="psts-legend-name">{s.label}</span>
                  {Number.isFinite(v) && (
                    <span className="psts-legend-val" style={{ color: s.color }}>
                      {v.toFixed(1)}
                    </span>
                  )}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ---------- footer ---------- */}
      <footer className="psts-foot">
        <span className="psts-foot-note">{note}</span>
        {range && (
          <span className="psts-foot-range">
            {fmtRangeEdge(range.start)} <span className="psts-foot-dash">—</span> {fmtRangeEdge(range.end)}
          </span>
        )}
      </footer>
    </div>
  );
}

/* ----------------------------- styles ----------------------------- */

const CSS = `
  .psts {
    --psts-surface: #0c0d12;
    position: relative;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 18px;
    background:
      radial-gradient(130% 120% at 50% -10%, rgba(255,255,255,0.035) 0%, transparent 42%),
      linear-gradient(180deg, #101117 0%, #0b0c10 100%);
    box-shadow:
      0 1px 0 0 rgba(255,255,255,0.05) inset,
      0 30px 70px -34px rgba(0,0,0,0.85);
    overflow: hidden;
    animation: psts-rise 560ms cubic-bezier(0.16,1,0.3,1) both;
  }

  @keyframes psts-rise {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ---- header ---- */
  .psts-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 28px;
    padding: 26px 30px 18px;
  }
  .psts-head-main { min-width: 0; }

  .psts-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: var(--font-body), monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.42);
    margin-bottom: 13px;
  }
  .psts-eyebrow-tick {
    width: 18px; height: 1px;
    background: rgba(255,255,255,0.3);
    display: inline-block;
  }

  .psts-title {
    font-family: var(--font-serif), Georgia, serif;
    font-weight: 460;
    font-size: clamp(21px, 2.4vw, 30px);
    line-height: 1.1;
    letter-spacing: -0.01em;
    color: #f4f4f7;
    text-transform: none;
    margin: 0 0 8px;
    max-width: 36ch;
  }

  .psts-subtitle {
    font-family: var(--font-body), monospace;
    font-size: 12.5px;
    line-height: 1.6;
    color: rgba(255,255,255,0.46);
    margin: 0;
    max-width: 56ch;
  }

  /* ---- current-leader readout ---- */
  .psts-standing {
    flex-shrink: 0;
    text-align: right;
    padding: 12px 16px 13px;
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 12px;
    background: rgba(255,255,255,0.018);
    min-width: 132px;
  }
  .psts-standing-label {
    font-family: var(--font-body), monospace;
    font-size: 8.5px;
    font-weight: 600;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.36);
    margin-bottom: 7px;
  }
  .psts-standing-name {
    font-family: var(--font-serif), Georgia, serif;
    font-size: 20px;
    font-weight: 500;
    line-height: 1;
    margin-bottom: 6px;
  }
  .psts-standing-lead {
    display: flex;
    align-items: baseline;
    justify-content: flex-end;
    gap: 4px;
  }
  .psts-standing-lead-val {
    font-family: var(--font-body), monospace;
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .psts-standing-lead-unit {
    font-family: var(--font-body), monospace;
    font-size: 9px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.34);
  }

  /* ---- plot ---- */
  .psts-plot {
    padding: 6px 18px 6px;
  }
  .psts .recharts-cartesian-axis-tick-value { fill: rgba(255,255,255,0.38) !important; }
  .psts .recharts-surface { overflow: visible; }

  /* ---- legend (narrow only) ---- */
  .psts-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 16px;
    padding: 10px 4px 4px;
  }
  .psts-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--font-body), monospace;
    font-size: 12px;
  }
  .psts-legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .psts-legend-name { color: rgba(255,255,255,0.6); }
  .psts-legend-val { font-weight: 700; font-variant-numeric: tabular-nums; }

  /* ---- footer ---- */
  .psts-foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 10px;
    padding: 14px 30px 20px;
    margin-top: 6px;
    border-top: 1px solid rgba(255,255,255,0.05);
  }
  .psts-foot-note,
  .psts-foot-range {
    font-family: var(--font-body), monospace;
    font-size: 11px;
    letter-spacing: 0.03em;
    color: rgba(255,255,255,0.34);
  }
  .psts-foot-range { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .psts-foot-dash { color: rgba(255,255,255,0.22); padding: 0 2px; }

  /* ---- tooltip ---- */
  .psts-tip {
    min-width: 214px;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    background: rgba(16,17,22,0.92);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    box-shadow: 0 18px 44px -16px rgba(0,0,0,0.9);
    overflow: hidden;
    animation: psts-tip-in 120ms ease-out both;
  }
  @keyframes psts-tip-in {
    from { opacity: 0; transform: translateY(3px) scale(0.99); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  .psts-tip-date {
    padding: 11px 15px 9px;
    font-family: var(--font-body), monospace;
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: rgba(255,255,255,0.5);
    border-bottom: 1px solid rgba(255,255,255,0.07);
  }
  .psts-tip-rows {
    padding: 11px 15px;
    display: flex;
    flex-direction: column;
    gap: 9px;
  }
  .psts-tip-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 22px;
  }
  .psts-tip-name {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    font-family: var(--font-body), monospace;
    font-size: 13px;
    color: rgba(255,255,255,0.74);
  }
  .psts-tip-swatch { width: 9px; height: 9px; border-radius: 3px; flex-shrink: 0; }
  .psts-tip-val {
    font-family: var(--font-body), monospace;
    font-size: 15px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }
  .psts-tip-lead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 9px 15px 11px;
    border-top: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.02);
    font-family: var(--font-body), monospace;
    font-size: 11px;
    letter-spacing: 0.02em;
    color: rgba(255,255,255,0.46);
  }
  .psts-tip-lead-label {
    font-size: 10px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.38);
  }
  .psts-tip-lead-val { font-weight: 700; font-variant-numeric: tabular-nums; }

  @media (max-width: 560px) {
    .psts-head { flex-direction: column; gap: 16px; padding: 22px 18px 12px; }
    .psts-standing { align-self: flex-start; text-align: left; }
    .psts-standing-lead { justify-content: flex-start; }
    .psts-plot { padding: 4px 8px; }
    .psts-foot { padding: 14px 18px 18px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .psts, .psts-tip { animation: none !important; }
  }
`;
