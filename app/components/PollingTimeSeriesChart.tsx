"use client";

import React, { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

type Row = { date: string; [key: string]: string | number };

type Props = {
  data: Row[];
  series: Array<{ key: string; label: string; color: string }>;
  yDomain?: [number, number];
  title?: string;
  subtitle?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function niceDomain(min: number, max: number): [number, number] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 60];
  if (min === max) return [min - 2, max + 2];
  const pad = Math.max(1.5, (max - min) * 0.12);
  const lo = Math.floor((min - pad) * 2) / 2;
  const hi = Math.ceil((max + pad) * 2) / 2;
  return [lo, hi];
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTooltip(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "2-digit" });
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "–";
  return `${v.toFixed(1)}%`;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: any[]; label?: string; }) {
  if (!active || !payload || payload.length === 0) return null;

  const rows = payload
    .filter((it: any) => it?.value != null && it.dataKey !== "date")
    .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div
      style={{
        width: "300px",
        background: "rgba(7,7,9,0.97)",
        border: "1px solid rgba(124,58,237,0.45)",
        boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
        fontFamily: "ui-monospace,'Courier New',monospace",
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      {/* Tri stripe */}
      <div style={{
        height: "2px",
        width: "100%",
        background: "linear-gradient(90deg, #e63946 0%, #e63946 33.33%, #7c3aed 33.33%, #7c3aed 66.66%, #2563eb 66.66%, #2563eb 100%)",
      }} />

      <div style={{ padding: "10px 12px" }}>
        {/* Date header */}
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "8px" }}>
          <div style={{ fontSize: "8.5px", fontWeight: 700, letterSpacing: "0.26em", textTransform: "uppercase", color: "rgba(255,255,255,0.35)" }}>
            {formatDateTooltip(label ?? "")}
          </div>
          <div style={{ fontSize: "7.5px", fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(124,58,237,0.85)" }}>
            DAILY AVG
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "rgba(255,255,255,0.08)", marginBottom: "8px" }} />

        {/* Candidates */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {rows.map((item: any, i: number) => (
            <div
              key={item.dataKey}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                alignItems: "center",
                gap: "12px",
                paddingBottom: i < rows.length - 1 ? "6px" : 0,
                borderBottom: i < rows.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                <span style={{
                  width: "8px", height: "8px",
                  borderRadius: "50%",
                  background: item.color,
                  boxShadow: `0 0 10px ${item.color}60`,
                  flexShrink: 0,
                }} />
                <span style={{ fontSize: "10.5px", color: "rgba(255,255,255,0.80)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.08em" }}>
                  {item.name}
                </span>
              </div>
              <span style={{ fontSize: "14px", fontWeight: 900, color: "#fff", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}>
                {fmtPct(Number(item.value))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegendPills({ series }: { series: Array<{ key: string; label: string; color: string }>; }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "14px" }}>
      {series.map((s) => (
        <span
          key={s.key}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "7px",
            padding: "4px 10px",
            border: "1px solid rgba(255,255,255,0.09)",
            background: "rgba(255,255,255,0.025)",
            fontFamily: "ui-monospace,'Courier New',monospace",
            fontSize: "8.5px",
            fontWeight: 700,
            letterSpacing: "0.20em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.55)",
          }}
        >
          <span style={{
            width: "8px", height: "8px",
            borderRadius: "50%",
            background: s.color,
            boxShadow: `0 0 10px ${s.color}55`,
            flexShrink: 0,
          }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export default function PollingTimeSeriesChart({
  data,
  series,
  yDomain,
  title = "Polling trend over time",
  subtitle = "Daily weighted averages across the dataset (recency + √n + LV/RV/A).",
}: Props) {
  const computedDomain = useMemo<[number, number]>(() => {
    if (yDomain) return yDomain;
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const row of data) {
      for (const s of series) {
        const v = Number(row[s.key]);
        if (!Number.isFinite(v)) continue;
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
    }
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 60];
    return niceDomain(min, max);
  }, [data, series, yDomain]);

  const tickDates = useMemo(() => {
    const n = data.length;
    if (n <= 1) return undefined;
    const step = clamp(Math.round(n / 7), 6, 90);
    return data.map((d) => d.date).filter((_, i) => i % step === 0 || i === n - 1);
  }, [data]);

  return (
    <>
      <style>{`
        .pst-root {
          --background2: #0b0b0f;
          --panel:       #0f0f15;
          --border:      rgba(255,255,255,0.09);
          --border2:     rgba(255,255,255,0.15);
          --muted3:      rgba(240,240,245,0.22);
          --purple:      #7c3aed;
          --purple-soft: #a78bfa;
          --red:         #e63946;
          --blue:        #2563eb;
          --blue2:       #3b82f6;
        }

        @keyframes pst-hover-in {
          from { opacity:0.6; transform:scaleX(0); }
          to   { opacity:1; transform:scaleX(1); }
        }

        .pst-root {
          background: var(--panel);
          border: 1px solid var(--border);
          overflow: hidden;
          position: relative;
        }

        /* Scanline texture */
        .pst-root::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
          );
          pointer-events: none;
          z-index: 0;
        }

        .pst-tri-stripe {
          height: 3px;
          width: 100%;
          background: linear-gradient(
            90deg,
            #e63946 0%, #e63946 33.33%,
            #7c3aed 33.33%, #7c3aed 66.66%,
            #2563eb 66.66%, #2563eb 100%
          );
          position: relative;
          z-index: 1;
        }

        .pst-header {
          padding: 16px 20px 14px;
          border-bottom: 1px solid var(--border);
          background: var(--background2);
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          position: relative;
          z-index: 1;
        }

        .pst-eyebrow {
          font-family: ui-monospace,'Courier New',monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--purple-soft);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .pst-eyebrow::before {
          content: '';
          display: block;
          width: 14px;
          height: 1px;
          background: var(--purple-soft);
          opacity: 0.55;
        }

        .pst-title {
          font-family: ui-monospace,'Courier New',monospace;
          font-size: clamp(15px, 2vw, 20px);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #fff;
          line-height: 1;
        }

        .pst-subtitle {
          font-family: ui-monospace,monospace;
          font-size: 8.5px;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted3);
          margin-top: 5px;
          line-height: 1.6;
        }

        .pst-hover-hint {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.025);
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted3);
          flex-shrink: 0;
        }
        .pst-hover-dot {
          width: 6px; height: 6px;
          border-radius: 50%;
          background: var(--purple-soft);
          box-shadow: 0 0 8px rgba(167,139,250,0.6);
        }

        .pst-chart-area {
          padding: 16px 12px 8px;
          position: relative;
          z-index: 1;
        }

        .pst-footer {
          padding: 0 20px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
          position: relative;
          z-index: 1;
        }
        .pst-footer-note {
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted3);
        }
        .pst-data-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border: 1px solid rgba(124,58,237,0.28);
          background: rgba(124,58,237,0.06);
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }

        /* Recharts overrides */
        .pst-root .recharts-cartesian-axis-tick-value {
          font-family: ui-monospace,monospace !important;
          font-size: 9px !important;
          fill: rgba(255,255,255,0.28) !important;
          letter-spacing: 0.06em !important;
        }
        .pst-root .recharts-cartesian-grid line {
          stroke: rgba(255,255,255,0.055) !important;
        }
      `}</style>

      <div className="pst-root">
        <div className="pst-tri-stripe" />

        {/* Header */}
        <div className="pst-header">
          <div>
            <div className="pst-eyebrow">TRENDLINE</div>
            <div className="pst-title">{title}</div>
            <div className="pst-subtitle">{subtitle}</div>
          </div>
          <div className="pst-hover-hint">
            <div className="pst-hover-dot" />
            HOVER FOR VALUES
          </div>
        </div>

        {/* Divider — full-width split bar between header and chart */}
        <div style={{
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10) 20%, rgba(255,255,255,0.10) 80%, transparent)",
        }} />

        {/* Chart */}
        <div className="pst-chart-area">
          <div style={{ height: "clamp(280px, 40vh, 480px)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 16, right: 20, left: 4, bottom: 8 }}>
                <defs>
                  {/* Per-series glow filters */}
                  {series.map((s) => (
                    <filter key={s.key} id={`glow-${s.key}`} x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="blur" />
                      <feColorMatrix in="blur" type="matrix"
                        values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" result="glow" />
                      <feMerge>
                        <feMergeNode in="glow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  ))}
                  {/* Vertical cursor gradient */}
                  <linearGradient id="cursorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgba(124,58,237,0.4)" />
                    <stop offset="100%" stopColor="rgba(124,58,237,0)" />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.055)"
                  strokeDasharray="2 12"
                  vertical={false}
                />

                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.10)" }}
                  tick={{ fontFamily: "ui-monospace,monospace", fontSize: 9, fill: "rgba(255,255,255,0.28)" }}
                  ticks={tickDates}
                  tickFormatter={formatDateLabel}
                  minTickGap={20}
                />

                <YAxis
                  domain={computedDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "ui-monospace,monospace", fontSize: 9, fill: "rgba(255,255,255,0.28)" }}
                  tickFormatter={(v) => `${v}%`}
                  width={42}
                />

                <ReferenceLine y={0} stroke="rgba(255,255,255,0.08)" />

                <Tooltip
                  cursor={{
                    stroke: "rgba(124,58,237,0.30)",
                    strokeWidth: 1,
                    strokeDasharray: "3 4",
                  }}
                  content={<CustomTooltip />}
                  wrapperStyle={{ zIndex: 10 }}
                />

                {series.map((s) => (
                  <Line
                    key={s.key}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color}
                    strokeWidth={2.5}
                    dot={false}
                    connectNulls
                    filter={`url(#glow-${s.key})`}
                    activeDot={{
                      r: 5,
                      stroke: "rgba(255,255,255,0.9)",
                      strokeWidth: 1.5,
                      fill: s.color,
                    }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          <LegendPills series={series} />
        </div>

        {/* Footer */}
        <div style={{ height: "1px", background: "var(--border)", margin: "0 0 0" }} />
        <div className="pst-footer">
          <span className="pst-footer-note">DAILY WEIGHTED AVERAGES · NOT RAW POLL POINTS</span>
          <span className="pst-data-badge">PSI · METHODOLOGY DOCUMENTED</span>
        </div>
      </div>
    </>
  );
}