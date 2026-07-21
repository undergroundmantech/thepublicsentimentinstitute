"use client";

// Gauge family for the Election Desk — restyled from spec-command-deck.html's
// wheel/ring SVGs into TPSI tokens. Component-style reference only; this is
// NOT that file's bento layout.

import React from "react";

/** Half-donut win-probability wheel (Panel B). probs sums to ~1 across up to
 *  3 candidates; residual renders as OTHER_OUTCOMES in the caller's legend. */
export function WinProbabilityWheel({
  probs,
  colors,
  size = 172,
  trackColor = "var(--border)",
}: {
  probs: number[]; // leader-first, 0-1, length 1-3
  colors: string[];
  size?: number;
  /** Background arc color — pass the host page's own rule/border var (this
   *  file was authored against the main-site TPSI tokens; onpoint pages
   *  should pass "var(--rule)" instead since they don't define --border). */
  trackColor?: string;
}) {
  const cx = size / 2;
  const cy = size * 0.62;
  const r = size * 0.42;
  const stroke = size * 0.115;
  const total = Math.PI * r; // half-circumference

  // Build stacked arc segments left→right along the half circle.
  let acc = 0;
  const segs = probs.map((p, i) => {
    const start = acc;
    acc += Math.max(0, p);
    return { start, end: acc, color: colors[i] ?? "var(--muted2)" };
  });

  const pointOnArc = (frac: number) => {
    const angle = Math.PI - frac * Math.PI; // PI (left) -> 0 (right)
    return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
  };

  return (
    <svg width={size} height={size * 0.66} viewBox={`0 0 ${size} ${size * 0.66}`} role="img" aria-label="Win probability">
      <path
        d={`M ${cx - r},${cy} A ${r},${r} 0 0 1 ${cx + r},${cy}`}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
      {segs.map((s, i) => {
        const p0 = pointOnArc(s.start / (acc || 1));
        const p1 = pointOnArc(s.end / (acc || 1));
        const large = s.end / (acc || 1) - s.start / (acc || 1) > 0.5 ? 1 : 0;
        if (s.end <= s.start) return null;
        return (
          <path
            key={i}
            d={`M ${p0.x},${p0.y} A ${r},${r} 0 ${large} 1 ${p1.x},${p1.y}`}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeLinecap={i === 0 || i === segs.length - 1 ? "round" : "butt"}
          />
        );
      })}
    </svg>
  );
}

/** Full-circle race clock ring (Panel C) — countdown / reporting fill / called state. */
export function RaceClockRing({
  size = 118,
  fillFrac, // 0-1: reporting progress; ignored when state is SCHEDULED
  color,
  state,
}: {
  size?: number;
  fillFrac: number;
  color: string;
  state: "SCHEDULED" | "LIVE_GATED" | "LIVE_FORECAST" | "PROJECTED" | "OFFICIAL";
}) {
  const r = size * 0.42;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const frac = state === "SCHEDULED" ? 0 : Math.max(0, Math.min(1, fillFrac));
  const dash = `${circumference * frac} ${circumference}`;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Race clock">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--border)" strokeWidth={size * 0.075} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={size * 0.075}
        strokeLinecap="round"
        strokeDasharray={dash}
        transform={`rotate(-90 ${cx} ${cy})`}
      />
    </svg>
  );
}

/**
 * Margin box-and-whisker (OPTIONS drawer) — where the PROJECTED MARGIN could
 * land, modeled as Normal(meanPp, sdPp). Box = interquartile range
 * (mean ± 0.6745*sd); whiskers = ~95% interval (mean ± 1.96*sd). Axis is
 * centered on 0 (tie); values right of 0 favor the leader, left of 0 means
 * the runner-up would actually be ahead in that scenario — that crossover
 * region is shaded to read as "the flip zone" at a glance.
 */
export function MarginWhisker({
  meanPp,
  sdPp,
  leaderColor,
  width = 320,
  height = 64,
}: {
  meanPp: number; // projected margin, leader-positive
  sdPp: number;
  leaderColor: string;
  width?: number;
  height?: number;
}) {
  const span = Math.max(meanPp + sdPp * 2.2, sdPp * 2.2, 5); // half-axis extent, pp
  const cy = height * 0.5;
  const x = (pp: number) => width / 2 + (pp / span) * (width / 2 - 10);

  const lo95 = meanPp - sdPp * 1.96;
  const hi95 = meanPp + sdPp * 1.96;
  const loIqr = meanPp - sdPp * 0.6745;
  const hiIqr = meanPp + sdPp * 0.6745;
  const zeroX = x(0);
  const boxH = height * 0.34;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Projected margin range">
      {/* flip zone: left of the tie line */}
      <rect x={0} y={0} width={Math.max(0, zeroX)} height={height} fill="var(--wash)" opacity={0.6} />
      <line x1={zeroX} y1={4} x2={zeroX} y2={height - 4} stroke="var(--rule-strong, var(--rule))" strokeWidth={1.5} strokeDasharray="2 3" />
      {/* 95% whisker */}
      <line x1={x(lo95)} y1={cy} x2={x(hi95)} y2={cy} stroke={leaderColor} strokeWidth={1.5} opacity={0.5} />
      <line x1={x(lo95)} y1={cy - 6} x2={x(lo95)} y2={cy + 6} stroke={leaderColor} strokeWidth={1.5} opacity={0.5} />
      <line x1={x(hi95)} y1={cy - 6} x2={x(hi95)} y2={cy + 6} stroke={leaderColor} strokeWidth={1.5} opacity={0.5} />
      {/* IQR box */}
      <rect
        x={Math.min(x(loIqr), x(hiIqr))}
        y={cy - boxH / 2}
        width={Math.abs(x(hiIqr) - x(loIqr))}
        height={boxH}
        rx={3}
        fill={leaderColor}
        opacity={0.28}
        stroke={leaderColor}
        strokeWidth={1}
      />
      {/* median/mean tick */}
      <line x1={x(meanPp)} y1={cy - boxH / 2 - 3} x2={x(meanPp)} y2={cy + boxH / 2 + 3} stroke={leaderColor} strokeWidth={2} />
    </svg>
  );
}
