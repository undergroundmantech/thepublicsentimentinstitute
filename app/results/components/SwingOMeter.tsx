"use client";

import React, { useEffect, useRef, useState } from "react";

// The needle — ported 1:1 from the precinct app's ForecastNeedle dial
// (precinct-map/web/components/ForecastNeedle.tsx) so the hub and the ESRI map
// speak one visual language: half dial, tanh margin→angle compression, leader
// on the LEFT, graduated zone wedges, ink outlines, tapered needle with hub,
// side caps, and the "LEADER +M pts · P% to win · BAND" headline. This inline
// version is pure presentation — no polling, no fixed positioning.

const OSWALD = '"Oswald", "Barlow Condensed", system-ui, sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';
const INK = "#f4f4ef";
const PAGE = "#050505";

function marginToAngle(marginPp: number): number {
  return -90 * Math.tanh(marginPp / 15);
}
function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const t0 = ((a0 - 90) * Math.PI) / 180;
  const t1 = ((a1 - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(t0);
  const y0 = cy + r * Math.sin(t0);
  const x1 = cx + r * Math.cos(t1);
  const y1 = cy + r * Math.sin(t1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}
function wedgePath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const t0 = ((a0 - 90) * Math.PI) / 180;
  const t1 = ((a1 - 90) * Math.PI) / 180;
  const x0 = cx + r * Math.cos(t0);
  const y0 = cy + r * Math.sin(t0);
  const x1 = cx + r * Math.cos(t1);
  const y1 = cy + r * Math.sin(t1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 > a0 ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}
const lastName = (full?: string) => (full ? full.trim().split(/\s+/).pop() || full : "—");

export default function SwingOMeter({
  c1Name,
  c2Name,
  c1Color,
  c2Color,
  c1Prob,
  c2Prob,
  reportingPct,
  marginPp,
}: {
  c1Name: string;
  c2Name: string;
  c1Color: string;
  c2Color: string;
  c1Prob: number;
  c2Prob: number;
  reportingPct: number;
  /** Leader-over-runner margin in points; estimated from probability if absent. */
  marginPp?: number;
}) {
  // leader on the LEFT, always
  const flipped = c2Prob > c1Prob;
  const leaderName = lastName(flipped ? c2Name : c1Name);
  const runnerName = lastName(flipped ? c1Name : c2Name);
  const leaderColor = flipped ? c2Color : c1Color;
  const runnerColor = flipped ? c1Color : c2Color;
  const pLeader = Math.max(flipped ? c2Prob : c1Prob, 0.5);
  const M = Math.abs(marginPp != null ? marginPp : Math.atanh(Math.min(0.999, Math.max(0, pLeader * 2 - 1))) * 12);

  const band = pLeader < 0.65 ? "Toss-up" : pLeader < 0.8 ? "Lean" : pLeader < 0.95 ? "Likely" : "Safe";
  const live = reportingPct > 0 && reportingPct < 99.5;
  const called = reportingPct >= 99.5;

  // damped live jitter (reduced-motion: none)
  const [jitterPhase, setJitterPhase] = useState(0);
  const reducedRef = useRef(false);
  useEffect(() => {
    reducedRef.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!live || reducedRef.current) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setJitterPhase((p) => p + dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [live]);

  // dial geometry — same numbers as the precinct app
  const SVG_W = 420;
  const SVG_H = 240;
  const cx = SVG_W / 2;
  const cy = 210;
  const rOuter = 175;
  const rInner = 64;
  const baseExtend = 18;
  const tipOverhang = 10;
  const centerTicLen = 14;

  const aLeadTossup = marginToAngle(3);
  const aLeadLean = marginToAngle(10);
  const aLeadLikely = marginToAngle(25);
  const leadZones = [
    { from: -90, to: aLeadLikely, alpha: 0.85 },
    { from: aLeadLikely, to: aLeadLean, alpha: 0.48 },
    { from: aLeadLean, to: aLeadTossup, alpha: 0.18 },
  ];
  const runZones = [
    { from: -aLeadTossup, to: -aLeadLean, alpha: 0.18 },
    { from: -aLeadLean, to: -aLeadLikely, alpha: 0.48 },
    { from: -aLeadLikely, to: 90, alpha: 0.85 },
  ];

  const jitterAmp = live ? Math.min(1.4, (100 - reportingPct) * 0.03) : 0;
  const jitter = jitterAmp * (0.7 * Math.sin(jitterPhase * 1.7) + 0.3 * Math.sin(jitterPhase * 0.9 + 1.1));
  const angle = Math.max(-90, Math.min(90, marginToAngle(M) + jitter));

  const tipLen = rOuter + tipOverhang;
  const baseHalf = 4.4;
  const shoulderY = -tipLen * 0.18;
  const shoulderHalf = baseHalf * 0.78;
  const needlePoints =
    `0,${-tipLen} ` +
    `${shoulderHalf.toFixed(2)},${shoulderY.toFixed(2)} ` +
    `${baseHalf},0 ` +
    `${-baseHalf},0 ` +
    `${(-shoulderHalf).toFixed(2)},${shoulderY.toFixed(2)}`;

  return (
    <div style={{ width: "100%" }}>
      <style>{`@keyframes smLivePulse{0%,100%{opacity:.42}50%{opacity:1}}`}</style>

      {/* status chip row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span
          aria-hidden
          style={{
            width: 5, height: 5, borderRadius: 99,
            background: called ? leaderColor : "#dc2626",
            animation: live && !reducedRef.current ? "smLivePulse 1.8s ease-in-out infinite" : "none",
          }}
        />
        <span style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: called ? leaderColor : "rgba(244,244,239,0.55)" }}>
          {called ? "Called" : live ? `Live · ${reportingPct.toFixed(reportingPct >= 10 ? 0 : 1)}%` : "Forecast"}
        </span>
      </div>

      {/* headline: LEADER +M pts · P% to win · BAND */}
      <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
        <span style={{ fontFamily: OSWALD, fontWeight: 700, fontSize: 24, letterSpacing: "0.01em", textTransform: "uppercase", color: INK, lineHeight: 1 }}>
          {leaderName}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 25, fontWeight: 700, color: leaderColor, letterSpacing: "-0.02em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
          +{M.toFixed(1)}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: "rgba(244,244,239,0.4)", marginLeft: -3 }}>pts</span>
        <span style={{ color: "rgba(244,244,239,0.3)", fontSize: 13 }}>·</span>
        <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: leaderColor, fontVariantNumeric: "tabular-nums" }}>
          {(pLeader * 100).toFixed(0)}%
        </span>
        <span style={{ fontSize: 12, color: "rgba(244,244,239,0.55)", fontWeight: 500 }}>to win</span>
        <span
          style={{
            fontFamily: OSWALD, fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase",
            color: leaderColor, padding: "4px 8px", marginLeft: 2,
            background: `color-mix(in oklab, ${leaderColor} 18%, transparent)`,
            border: `1px solid color-mix(in oklab, ${leaderColor} 50%, transparent)`,
          }}
        >
          {band}
        </span>
      </div>

      {/* the dial */}
      <svg
        width="100%"
        viewBox={`0 ${-tipOverhang - centerTicLen - 2} ${SVG_W} ${SVG_H + tipOverhang + centerTicLen + 4}`}
        style={{ overflow: "visible", display: "block" }}
      >
        <defs>
          <clipPath id="smDialAbove">
            <rect x={cx - rOuter - baseExtend - 4} y={cy - rOuter - tipOverhang - 4} width={2 * (rOuter + baseExtend) + 8} height={rOuter + tipOverhang + 8} />
          </clipPath>
        </defs>
        <g clipPath="url(#smDialAbove)">
          {leadZones.map((z, i) => (
            <path key={`lz${i}`} d={wedgePath(cx, cy, rOuter, z.from, z.to)} fill={leaderColor} fillOpacity={z.alpha} />
          ))}
          {runZones.map((z, i) => (
            <path key={`rz${i}`} d={wedgePath(cx, cy, rOuter, z.from, z.to)} fill={runnerColor} fillOpacity={z.alpha} />
          ))}
        </g>
        <path d={wedgePath(cx, cy, rInner, -90, 90)} fill={PAGE} />
        <path d={arcPath(cx, cy, rOuter, -90, 90)} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <path d={arcPath(cx, cy, rInner, -90, 90)} fill="none" stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <line x1={cx - rOuter - baseExtend} y1={cy} x2={cx + rOuter + baseExtend} y2={cy} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <line x1={cx} y1={cy - rOuter - centerTicLen} x2={cx} y2={cy - rOuter + 1} stroke={INK} strokeWidth="2.4" strokeLinecap="round" />
        <g transform={`translate(${cx} ${cy}) rotate(${angle.toFixed(3)})`} style={{ transition: reducedRef.current ? "none" : "transform 520ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <polygon points={needlePoints} fill={INK} />
        </g>
        <circle cx={cx} cy={cy} r="14" fill={INK} />
        <circle cx={cx - 0.8} cy={cy - 0.8} r="3.6" fill="rgba(5,5,5,0.35)" />
        <text x={cx - rOuter - baseExtend} y={cy + 16} textAnchor="start" style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fill: leaderColor }}>
          {leaderName}
        </text>
        <text x={cx + rOuter + baseExtend} y={cy + 16} textAnchor="end" style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", fill: runnerColor }}>
          {runnerName}
        </text>
      </svg>
    </div>
  );
}
