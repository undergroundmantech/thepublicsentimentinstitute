"use client";

// CO-04 §4c Zone 6 — Live Timeline ("How the race is evolving"). Three
// charts on one shared time axis — WIN PROBABILITY · EST. REPORTING ·
// PROJECTED FINAL SHARE — hover-synced (one moment highlights across all
// three) with a click-to-expand toggle per chart. Marks: the gate region
// (<GATE_THRESHOLD_PCT reporting), the TPSI call line (first snapshot whose
// raceState reaches PROJECTED/OFFICIAL), and a now-point (last snapshot).
//
// Data source: flight-recorder snapshots (§6, app/results/_lib/
// flightRecorder.ts) — read via GET /api/flightrecorder/[raceId] when
// caps.telemetry is true, or fed fixture data on the QA route
// (app/results/timeline-qa/page.tsx) regardless of the public flag.
// BUILT NOW, FLAG OFF (§0.2) — TIMELINE_PUBLIC_FLAG in raceCapabilities.ts
// keeps this off the public race page until the Nov 3 general.

import React, { useState } from "react";
import type { FlightRecorderSnapshot } from "../../../_lib/flightRecorder";
import type { NeedleProjection } from "../../../components/needleModel";
import { GATE_THRESHOLD_PCT } from "../../../_lib/raceState";

interface Series {
  label: string;
  color: string;
  values: number[]; // 0-100, aligned 1:1 with the snapshot array
}

function frac(i: number, n: number): number {
  return n <= 1 ? 0 : i / (n - 1);
}

function MiniChart({
  title,
  series,
  height,
  hoverFrac,
  onHover,
  gateEndFrac,
  callFrac,
  valueSuffix = "%",
  expanded,
  onToggleExpand,
}: {
  title: string;
  series: Series[];
  height: number;
  hoverFrac: number | null;
  onHover: (f: number | null) => void;
  gateEndFrac: number | null;
  callFrac: number | null;
  valueSuffix?: string;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const width = 600;
  const pad = 6;
  const x = (f: number) => pad + f * (width - pad * 2);
  const y = (v: number) => height - pad - (Math.max(0, Math.min(100, v)) / 100) * (height - pad * 2);
  const n = series[0]?.values.length ?? 0;

  const paths = series.map((s) => ({
    ...s,
    d: s.values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(frac(i, n)).toFixed(2)},${y(v).toFixed(2)}`).join(" "),
  }));

  const hoverIdx = hoverFrac == null || n === 0 ? null : Math.max(0, Math.min(n - 1, Math.round(hoverFrac * (n - 1))));

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0) return;
    onHover(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
  }

  return (
    <div className={`rd-tl-chart ${expanded ? "expanded" : ""}`}>
      <div className="rd-tl-chart-h">
        <span>{title}</span>
        <button type="button" className="rd-tl-expand" onClick={onToggleExpand} aria-expanded={expanded}>
          {expanded ? "collapse" : "expand"}
        </button>
      </div>
      <svg
        className="rd-tl-svg"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        onPointerMove={handleMove}
        onPointerLeave={() => onHover(null)}
        role="img"
        aria-label={title}
      >
        {gateEndFrac != null && gateEndFrac > 0 ? (
          <rect x={x(0)} y={0} width={Math.max(0, x(gateEndFrac) - x(0))} height={height} fill="var(--wash)" opacity={0.55} />
        ) : null}
        {callFrac != null ? (
          <line x1={x(callFrac)} y1={0} x2={x(callFrac)} y2={height} stroke="var(--ink-dim)" strokeWidth={1.5} strokeDasharray="3 3" />
        ) : null}
        {paths.map((p, i) => (
          <path key={i} d={p.d} fill="none" stroke={p.color} strokeWidth={2} />
        ))}
        {n > 0
          ? series.map((s, i) => <circle key={`now-${i}`} cx={x(1)} cy={y(s.values[s.values.length - 1])} r={3.5} fill={s.color} />)
          : null}
        {hoverIdx != null ? (
          <line x1={x(frac(hoverIdx, n))} y1={0} x2={x(frac(hoverIdx, n))} y2={height} stroke="var(--ink-dim)" strokeWidth={1} />
        ) : null}
      </svg>
      {hoverIdx != null ? (
        <div className="rd-tl-tip">
          {series.map((s, i) => (
            <span key={i} style={{ color: s.color }}>
              {s.label} {s.values[hoverIdx].toFixed(1)}
              {valueSuffix}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function LiveTimeline({
  snapshots,
  needle,
}: {
  snapshots: FlightRecorderSnapshot[];
  needle: Pick<NeedleProjection, "leaderName" | "runnerName" | "leaderColor" | "runnerColor">;
}) {
  const [hoverFrac, setHoverFrac] = useState<number | null>(null);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const n = snapshots.length;
  const gateEndIdx = snapshots.findIndex((s) => s.percentReporting >= GATE_THRESHOLD_PCT);
  const gateEndFrac = n > 1 ? (gateEndIdx >= 0 ? frac(gateEndIdx, n) : 1) : null;
  const callIdx = snapshots.findIndex((s) => s.raceState === "PROJECTED" || s.raceState === "OFFICIAL");
  const callFrac = n > 1 && callIdx >= 0 ? frac(callIdx, n) : null;

  const leaderWinProb = snapshots.map((s) => s.candidates.find((c) => c.name === needle.leaderName)?.winProbPct ?? 50);
  const runnerWinProb = snapshots.map((s) => s.candidates.find((c) => c.name === needle.runnerName)?.winProbPct ?? 50);
  const reporting = snapshots.map((s) => s.percentReporting);
  const leaderShare = snapshots.map((s) => s.projectedLeaderSharePct ?? 0);
  const runnerShare = snapshots.map((s) => s.projectedRunnerSharePct ?? 0);

  const charts: { key: string; title: string; series: Series[] }[] = [
    {
      key: "winprob",
      title: "win probability",
      series: [
        { label: needle.leaderName, color: needle.leaderColor, values: leaderWinProb },
        { label: needle.runnerName, color: needle.runnerColor, values: runnerWinProb },
      ],
    },
    {
      key: "reporting",
      title: "est. reporting",
      series: [{ label: "reporting", color: "#b7ff00", values: reporting }],
    },
    {
      key: "share",
      title: "projected final share",
      series: [
        { label: needle.leaderName, color: needle.leaderColor, values: leaderShare },
        { label: needle.runnerName, color: needle.runnerColor, values: runnerShare },
      ],
    },
  ];

  const firstTs = snapshots[0]?.ts;
  const lastTs = snapshots[n - 1]?.ts;
  const fmtClock = (iso?: string) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "—");

  return (
    <div className="rd-timeline">
      <span className="rd-timeline-h">how the race is evolving</span>
      <div className="rd-timeline-charts">
        {charts.map((c, i) => (
          <MiniChart
            key={c.key}
            title={c.title}
            series={c.series}
            height={expandedIdx === i ? 180 : 84}
            hoverFrac={hoverFrac}
            onHover={setHoverFrac}
            gateEndFrac={gateEndFrac}
            callFrac={callFrac}
            expanded={expandedIdx === i}
            onToggleExpand={() => setExpandedIdx((v) => (v === i ? null : i))}
          />
        ))}
      </div>
      <div className="rd-timeline-axis">
        <span>{fmtClock(firstTs)}</span>
        <span>{fmtClock(lastTs)} · now</span>
      </div>
    </div>
  );
}
