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
  return Number.isFinite(v) ? `${v.toFixed(1)}%` : "n/a";
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const rows = payload
    .filter((it: any) => it?.value != null && it.dataKey !== "date")
    .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div style={{
      background: "rgba(var(--bg2-rgb),.94)",
      border: "1px solid var(--line2)",
      borderRadius: 10,
      boxShadow: "0 12px 40px rgba(0,0,0,.5)",
      backdropFilter: "blur(10px)",
      fontFamily: "var(--font-b)",
      minWidth: 200,
      overflow: "hidden",
      pointerEvents: "none",
    }}>
      {/* Header */}
      <div style={{
        padding: "8px 12px 4px",
        fontFamily: "var(--font-d)",
        fontSize: 13,
        fontWeight: 700,
        color: "var(--hi)",
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
              <span style={{ fontSize: 12.5, color: "var(--ink2)" }}>{item.name}</span>
            </div>
            <span style={{ fontFamily: "var(--font-m)", fontSize: 13, fontWeight: 600, color: item.color, fontVariantNumeric: "tabular-nums" }}>
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
          border: "1px solid var(--line)",
          borderRadius: 100,
          background: "var(--glass2)",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink2)",
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
        .psc { background: var(--glass); border: 1px solid var(--line); border-radius: var(--r); overflow: hidden; color: var(--ink); }
        .psc-header { padding: 14px 18px; border-bottom: 1px solid var(--line); display: flex; align-items: flex-start; justify-content: space-between; gap: 12px 16px; flex-wrap: wrap; }
        .psc-title { font: 700 16px/1.25 var(--font-d); letter-spacing: -.02em; color: var(--ink); margin-bottom: 3px; }
        .psc-subtitle { font-size: 12.5px; color: var(--mute); line-height: 1.5; }
        .psc-hint { font: 700 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); white-space: nowrap; flex-shrink: 0; padding-top: 3px; }
        .psc-chart-area { padding: 16px 12px 10px; }
        .psc-footer { padding: 10px 18px 12px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; border-top: 1px solid var(--line); }
        .psc-footer-note { font-size: 12px; color: var(--mute); }
        .psc-footer-badge { font: 700 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
        .psc .recharts-cartesian-axis-tick-value { fill: var(--mute) !important; font-family: var(--font-m) !important; font-size: 10px !important; }
        .psc .recharts-cartesian-grid line { stroke: var(--line) !important; }
      `}</style>

      <div className="psc">
        <div className="psc-header">
          <div>
            <div className="psc-title">{title}</div>
            <div className="psc-subtitle">{subtitle}</div>
          </div>
          <div className="psc-hint">Hover for values</div>
        </div>

        <div className="psc-chart-area">
          <div style={{ height: "clamp(260px, 38vh, 460px)" }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: "var(--line)" }}
                  tick={{ fontFamily: "var(--font-m)", fontSize: 10, fill: "var(--mute)" }}
                  ticks={tickDates}
                  tickFormatter={formatDateLabel}
                  minTickGap={20}
                />
                <YAxis
                  domain={computedDomain}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontFamily: "var(--font-m)", fontSize: 10, fill: "var(--mute)" }}
                  tickFormatter={(v) => `${v}%`}
                  width={40}
                />
                <ReferenceLine y={50} stroke="rgba(var(--line-rgb),.3)" strokeDasharray="3 4" />
                <Tooltip
                  cursor={{ stroke: "rgba(var(--line-rgb),.45)", strokeWidth: 1 }}
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
                    activeDot={{ r: 4.5, stroke: "var(--bg)", strokeWidth: 2, fill: s.color }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <Legend series={series} />
        </div>

        <div className="psc-footer">
          <span className="psc-footer-note">Daily weighted averages, not raw poll points</span>
          <a className="psc-footer-badge" href="/tpsi/methodology">OnPoint average methodology</a>
        </div>
      </div>
    </>
  );
}