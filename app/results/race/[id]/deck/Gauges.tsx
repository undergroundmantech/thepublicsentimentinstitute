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
}: {
  probs: number[]; // leader-first, 0-1, length 1-3
  colors: string[];
  size?: number;
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
        stroke="var(--border)"
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
