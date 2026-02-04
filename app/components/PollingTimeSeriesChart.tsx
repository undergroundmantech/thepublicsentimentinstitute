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
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function fmtPct(v: number): string {
  if (!Number.isFinite(v)) return "–";
  return `${v.toFixed(1)}%`;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: any[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  const dateStr = formatDateTooltip(label ?? "");

  const rows = payload
    .filter((it: any) => it?.value != null && it.dataKey !== "date")
    .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));

  return (
    <div className="psi-tooltip px-3 py-2">
      <div className="text-[11px] uppercase tracking-[0.18em] text-white/60">
        {dateStr}
      </div>

      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map((item: any) => (
          <div key={item.dataKey} className="flex items-center justify-between gap-8">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-sm text-white/80">{item.name}</span>
            </div>
            <span className="psi-mono text-sm font-semibold text-white/95">
              {fmtPct(Number(item.value))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendPills({
  series,
}: {
  series: Array<{ key: string; label: string; color: string }>;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {series.map((s) => (
        <span
          key={s.key}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: s.color }} />
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
    <div className="psi-card p-6 psi-animate-in">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-white/90">{title}</div>
          <div className="mt-1 text-sm text-white/60">{subtitle}</div>
        </div>
        <div className="psi-mono text-xs text-white/55">Hover for daily values</div>
      </div>

      <div className="my-4 psi-divider" />

      <div className="w-full h-[360px] md:h-[520px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 18, left: 8, bottom: 10 }}>
            {/* defs for glow */}
            <defs>
              <filter id="psiGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="
                    1 0 0 0 0
                    0 1 0 0 0
                    0 0 1 0 0
                    0 0 0 0.45 0"
                  result="glow"
                />
                <feMerge>
                  <feMergeNode in="glow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* light, clean grid (like polling dashboards) */}
            <CartesianGrid
              stroke="rgba(255,255,255,0.10)"
              strokeDasharray="2 10"
              vertical={false}
            />

            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tick={{ fontSize: 11, fill: "rgba(234,240,255,0.60)" }}
              ticks={tickDates}
              tickFormatter={formatDateLabel}
              minTickGap={18}
            />

            <YAxis
              domain={computedDomain}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
              tick={{ fontSize: 11, fill: "rgba(234,240,255,0.60)" }}
              tickFormatter={(v) => `${v}%`}
              width={46}
            />

            <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />

            <Tooltip
              cursor={{ stroke: "rgba(234,240,255,0.18)", strokeWidth: 1 }}
              content={<CustomTooltip />}
            />

            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color}
                strokeWidth={3}
                dot={false}
                connectNulls
                filter="url(#psiGlow)"
                activeDot={{
                  r: 5,
                  stroke: "rgba(255,255,255,0.95)",
                  strokeWidth: 2,
                }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* nicer legend */}
      <LegendPills series={series} />

      <div className="mt-3 text-xs text-white/55">
        This chart displays <span className="font-semibold text-white/80">daily weighted averages</span>, not raw poll points.
      </div>
    </div>
  );
}
