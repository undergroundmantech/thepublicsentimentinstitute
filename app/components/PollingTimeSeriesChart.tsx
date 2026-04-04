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
  return [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2];
}

function formatDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatDateTooltip(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function fmtPct(v: number): string {
  return Number.isFinite(v) ? `${v.toFixed(1)}%` : "–";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((it: any) => it?.value != null && it.dataKey !== "date")
    .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div style={{
      background: "#141418",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 2,
      boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
      fontFamily: "var(--font-body), monospace",
      minWidth: 200,
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px",
        background: "rgba(255,255,255,0.04)",
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        fontSize: 11,
        fontWeight: 600,
        color: "rgba(255,255,255,0.4)",
        letterSpacing: "0.04em",
      }}>
        {formatDateTooltip(label ?? "")}
      </div>

      {/* Rows */}
      <div style={{ padding: "8px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((item: any) => (
          <div key={item.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <span style={{
                width: 10, height: 10,
                borderRadius: "50%",
                background: item.color,
                flexShrink: 0,
              }} />
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.7)" }}>{item.name}</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: 700, color: item.color, fontVariantNumeric: "tabular-nums" }}>
              {fmtPct(Number(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ series }: { series: Array<{ key: string; label: string; color: string }> }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
      {series.map((s) => (
        <span key={s.key} style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 10px",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 100,
          background: "rgba(255,255,255,0.04)",
          fontSize: 12,
          fontWeight: 600,
          color: "rgba(255,255,255,0.7)",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, flexShrink: 0 }} />
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
  title = "Polling Trend",
  subtitle = "Daily weighted averages across the dataset.",
}: Props) {
  const computedDomain = useMemo<[number, number]>(() => {
    if (yDomain) return yDomain;
    let min = Infinity, max = -Infinity;
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
    const step = clamp(Math.round(n / 7), 6, 90);
    return data.map((d) => d.date).filter((_, i) => i % step === 0 || i === n - 1);
  }, [data]);

  return (
    <>
      <style>{`
        .psc {
          background: #0f0f15;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
        }

        .psc-stripe {
          height: 3px;
          background: linear-gradient(90deg, #e63946 33%, #7c3aed 66%, #2563eb 100%);
        }

        .psc-header {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: #0f0f15;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .psc-title {
          font-family: var(--font-display), sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: rgba(255,255,255,0.9);
          margin-bottom: 3px;
          text-transform: uppercase;
        }

        .psc-subtitle {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          line-height: 1.5;
        }

        .psc-hint {
          font-size: 11px;
          color: rgba(255,255,255,0.3);
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          flex-shrink: 0;
          padding-top: 2px;
        }

        .psc-chart-area {
          padding: 16px 12px 8px;
          background: #0f0f15;
        }

        .psc-footer {
          padding: 10px 20px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 8px;
          border-top: 1px solid rgba(255,255,255,0.08);
          background: rgba(255,255,255,0.02);
        }
        .psc-footer-note { font-size: 11px; color: rgba(255,255,255,0.3); }
        .psc-footer-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border: 1px solid rgba(124,58,237,0.3);
          background: rgba(124,58,237,0.1);
          border-radius: 100px;
          font-size: 11px;
          font-weight: 600;
          color: #9d5cf0;
        }

        /* Recharts overrides inside chart */
        .psc .recharts-cartesian-axis-tick-value { fill: rgba(255,255,255,0.3) !important; font-size: 11px !important; }
        .psc .recharts-cartesian-grid line { stroke: rgba(255,255,255,0.06) !important; }
      `}</style>

      <div className="psc">
        <div className="psc-stripe" />

        <div className="psc-header">
          <div>
            <div className="psc-title">{title}</div>
            <div className="psc-subtitle">{subtitle}</div>
          </div>
          <div className="psc-hint">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="5.5" stroke="#ccc" />
              <path d="M6 5v4M6 4h.01" stroke="#aaa" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Hover for values
          </div>
        </div>

        <div className="psc-chart-area">
          <div style={{ height: "clamp(260px, 38vh, 460px)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" strokeDasharray="3 8" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                  tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
                  ticks={tickDates}
                  tickFormatter={formatDateLabel}
                  minTickGap={20}
                />
                <YAxis
                  domain={computedDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "var(--font-body),monospace", fontSize: 11, fill: "rgba(255,255,255,0.3)" }}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
                />
                <ReferenceLine y={50} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 4" />
                <Tooltip
                  cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
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
                    activeDot={{ r: 5, stroke: "#fff", strokeWidth: 2, fill: s.color }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend series={series} />
        </div>

        <div className="psc-footer">
          <span className="psc-footer-note">Daily weighted averages · not raw poll points</span>
          <span className="psc-footer-badge">PSI · Methodology documented</span>
        </div>
      </div>
    </>
  );
}