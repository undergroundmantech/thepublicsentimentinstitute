// app/polling/2028-general/page.tsx
"use client";

import React, { useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

/**
 * Gold Standard upweighting (matching site-wide methodology):
 * Implemented by inflating sampleSize: n' = n * (m^2) so √n' = m * √n.
 */
const GOLD_STANDARD_MULTIPLIER = 2;

const GOLD_STANDARD_NAMES = [
  "Big Data Poll",
  "Rasmussen Reports",
  "AtlasIntel",
  "SoCalStrategies",
  "Emerson",
  "Trafalgar",
  "InsiderAdvantage",
  "Patriot Polling",
];

function normalizeName(s: string) {
  return s
    .toLowerCase()
    .replace(/\(r\)/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isGoldStandard(pollster: string) {
  const p = normalizeName(pollster);
  return GOLD_STANDARD_NAMES.some((n) => p.includes(normalizeName(n)));
}

function effectiveSampleSize(pollster: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  if (!isGoldStandard(pollster)) return n;
  return Math.round(n * GOLD_STANDARD_MULTIPLIER * GOLD_STANDARD_MULTIPLIER);
}

// ─── Poll data — Vance vs. Newsom, 2028 general election ─────────────────────
// Results keyed as "Vance" and "Newsom" to match Poll["results"] shape

const RAW_POLLS: Poll[] = [
  { pollster: "Big Data Poll",           endDate: "2026-02-18", sampleSize: 1805, sampleType: "LV", results: { Vance: 46.8, Newsom: 53.2 } },
  { pollster: "YouGov / Yahoo",          endDate: "2026-02-12", sampleSize: 511,  sampleType: "LV", results: { Vance: 43.0, Newsom: 49.0 } },
  { pollster: "Zogby",                   endDate: "2026-01-07", sampleSize: 891,  sampleType: "LV", results: { Vance: 44.6, Newsom: 41.0 } },
  { pollster: "The Argument/Verasight",  endDate: "2025-11-17", sampleSize: 1508, sampleType: "RV", results: { Vance: 46.4, Newsom: 53.6 } },
  { pollster: "Morning Consult",         endDate: "2025-11-16", sampleSize: 2201, sampleType: "RV", results: { Vance: 42.0, Newsom: 41.0 } },
  { pollster: "Overton Insights",        endDate: "2025-10-29", sampleSize: 1200, sampleType: "RV", results: { Vance: 43.0, Newsom: 46.0 } },
  { pollster: "Echelon Insights",        endDate: "2025-10-20", sampleSize: 1010, sampleType: "LV", results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "YouGov / UMass Lowell",   endDate: "2025-10-20", sampleSize: 1000, sampleType: "A",  results: { Vance: 32.0, Newsom: 36.0 } },
  { pollster: "Emerson",                 endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Vance: 45.5, Newsom: 44.9 } },
  { pollster: "YouGov / Yahoo",          endDate: "2025-09-02", sampleSize: 1690, sampleType: "A",  results: { Vance: 41.0, Newsom: 49.0 } },
  { pollster: "Leger360",                endDate: "2025-08-31", sampleSize: 849,  sampleType: "A",  results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "Emerson",                 endDate: "2025-08-26", sampleSize: 1000, sampleType: "LV", results: { Vance: 44.4, Newsom: 43.5 } },
  { pollster: "SoCal Strategies",        endDate: "2025-08-18", sampleSize: 700,  sampleType: "A",  results: { Vance: 37.0, Newsom: 39.0 } },
  { pollster: "Emerson",                 endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Vance: 45.3, Newsom: 42.1 } },
  { pollster: "SoCal Strategies",        endDate: "2024-12-23", sampleSize: 656,  sampleType: "A",  results: { Vance: 37.0, Newsom: 34.0 } },
];

const COLORS: Record<string, string> = {
  Vance:  "#ff1717",
  Newsom: "#184dfc",
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

// ─── CSS — identical design system to generic ballot (pgb-* prefix) ───────────
const CSS = `
  .p28-root {
    --bg:          #070709;
    --bg2:         #0b0b0f;
    --panel:       #0f0f15;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.15);
    --muted:       rgba(240,240,245,0.62);
    --muted2:      rgba(240,240,245,0.40);
    --muted3:      rgba(240,240,245,0.22);
    --purple:      #7c3aed;
    --purple2:     #9d5cf0;
    --purple-soft: #a78bfa;
    --rep:         #ff1717;
    --dem:         #184dfc;
    --gold:        #c9a84c;
  }

  @keyframes p28-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes p28-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes p28-bar-in {
    from { width:0; }
  }

  .p28-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: p28-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  /* ── TRI STRIPE ── */
  .p28-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      var(--rep)    0%,    var(--rep)    33.33%,
      var(--purple) 33.33%,var(--purple) 66.66%,
      var(--dem)    66.66%,var(--dem)    100%
    );
  }

  /* ── LIVE DOT ── */
  .p28-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--purple);
    box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: p28-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* ── EYEBROW ── */
  .p28-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: ui-monospace,'Courier New',monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--purple-soft);
    margin-bottom: 12px;
  }
  .p28-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: var(--purple-soft);
    opacity: 0.5;
  }

  /* ── HERO ── */
  .p28-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative;
    overflow: hidden;
  }
  .p28-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 55% 100% at 0%   60%, rgba(255,23,23,0.08)   0%, transparent 65%),
      radial-gradient(ellipse 55% 100% at 100% 60%, rgba(24,77,252,0.09)   0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50%  0%,  rgba(124,58,237,0.04)  0%, transparent 70%);
    pointer-events: none;
  }
  .p28-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }

  /* ── CANDIDATE PORTRAIT STRIP ── */
  .p28-portrait-strip {
    position: relative;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: end;
    min-height: 360px;
    overflow: hidden;
    border-bottom: 1px solid var(--border);
  }
  /* Vertical centre divider */
  .p28-portrait-strip::after {
    content: '';
    position: absolute;
    top: 0; left: 50%;
    transform: translateX(-50%);
    width: 1px; height: 100%;
    background: linear-gradient(180deg,
      transparent 0%,
      rgba(124,58,237,0.35) 15%,
      rgba(124,58,237,0.35) 85%,
      transparent 100%
    );
    pointer-events: none;
  }

  .p28-candidate-panel { display:flex; flex-direction:column; position:relative; }
  .p28-candidate-panel.left  { align-items:flex-end;   padding-right:52px; }
  .p28-candidate-panel.right { align-items:flex-start; padding-left: 52px; }

  .p28-candidate-img {
    height: 340px;
    width: auto;
    object-fit: contain;
    object-position: bottom;
    position: relative; z-index: 2;
    transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
  }
  .p28-candidate-img:hover { transform: scale(1.025) translateY(-4px); }
  .p28-candidate-panel.left  .p28-candidate-img {
    filter: drop-shadow(-6px 0 22px rgba(255,23,23,0.28)) drop-shadow(0 8px 28px rgba(0,0,0,0.7));
  }
  .p28-candidate-panel.right .p28-candidate-img {
    filter: drop-shadow( 6px 0 22px rgba(24,77,252,0.30)) drop-shadow(0 8px 28px rgba(0,0,0,0.7));
  }

  .p28-name-tag {
    position: absolute; bottom: 0; z-index: 5;
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(18px,2.8vw,32px);
    font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.06em; line-height: 1;
  }
  .p28-name-tag.left  { left:0;  padding-left:20px;  color:var(--rep); text-shadow:0 0 36px rgba(255,23,23,0.55);  }
  .p28-name-tag.right { right:0; padding-right:20px; color:var(--dem); text-shadow:0 0 36px rgba(24,77,252,0.55); text-align:right; }
  .p28-name-sub {
    display: block;
    font-family: ui-monospace,monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase;
    opacity: 0.55; margin-top: 3px;
  }

  /* ── VS CENTRE ── */
  .p28-vs-center {
    display: flex; flex-direction: column;
    align-items: center; justify-content: flex-end;
    padding-bottom: 40px;
    position: relative; z-index: 10; gap: 4px;
  }
  .p28-election-label {
    font-family: ui-monospace,monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.36em; text-transform: uppercase;
    color: var(--gold); margin-bottom: 8px;
    display: flex; align-items: center; gap: 7px;
  }
  .p28-vs-text {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(48px,6vw,72px);
    font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, var(--rep) 0%, #fff 50%, var(--dem) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text;
    filter: drop-shadow(0 2px 10px rgba(0,0,0,0.6));
    text-transform: uppercase; letter-spacing: 0.02em;
  }
  .p28-vs-sub {
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.24em;
    text-transform: uppercase; color: var(--muted3); margin-top: 4px;
  }

  /* ── HERO INNER (text + readings, below portraits) ── */
  .p28-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 20px;
  }
  @media (max-width:640px) { .p28-hero-inner { grid-template-columns:1fr; } }

  .p28-hero-title {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92;
    color: #fff; margin: 0 0 14px;
  }
  .p28-hero-title .rep {
    font-style: normal;
    background: linear-gradient(110deg, rgba(255,23,23,1) 0%, rgba(255,100,100,0.85) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .p28-hero-title .dem {
    font-style: normal;
    background: linear-gradient(110deg, rgba(24,77,252,1) 0%, rgba(100,140,255,0.85) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .p28-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px; letter-spacing: 0.12em; line-height: 1.75;
    color: var(--muted2); text-transform: uppercase; max-width: 520px;
  }
  .p28-hero-badge-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:16px; }

  /* ── BADGES ── */
  .p28-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .p28-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .p28-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .p28-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  /* ── HERO RIGHT (readings panel) ── */
  .p28-hero-read { display:flex; flex-direction:column; gap:6px; min-width:170px; }
  .p28-hero-read-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    position: relative; overflow: hidden;
  }
  .p28-hero-read-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .p28-hero-read-val {
    font-family: ui-monospace,monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  /* ── SECTION LABEL ── */
  .p28-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .p28-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .p28-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* ── KPI GRID ── */
  .p28-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  @media (max-width:860px) { .p28-kpi-grid { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:480px) { .p28-kpi-grid { grid-template-columns:1fr; } }

  .p28-kpi {
    background: var(--panel); border: 1px solid var(--border);
    padding: 16px 18px; position: relative; overflow: hidden;
    transition: border-color 150ms ease;
  }
  .p28-kpi:hover { border-color: var(--border2); }
  .p28-kpi-accent { position:absolute; top:0; left:0; right:0; height:2px; }
  .p28-kpi-label {
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted3); margin-bottom: 8px;
  }
  .p28-kpi-val {
    font-family: ui-monospace,monospace; font-size: clamp(22px,2.5vw,30px);
    font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums;
  }
  .p28-kpi-sub {
    font-family: ui-monospace,monospace; font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3); margin-top: 6px;
  }
  .p28-kpi-bar { height:2px; margin-top:10px; background:rgba(255,255,255,0.07); }
  .p28-kpi-bar-fill { height:100%; animation: p28-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both; }

  /* ── TABLE PANEL ── */
  .p28-table-panel { background:var(--panel); border:1px solid var(--border); overflow:hidden; }
  .p28-table-head {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 14px 20px; display:flex; align-items:center;
    justify-content:space-between; gap:12px; flex-wrap:wrap;
  }
  .p28-table-head-title {
    font-family: ui-monospace,monospace; font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--purple-soft);
  }
  .p28-table-head-note {
    font-family: ui-monospace,monospace; font-size: 7.5px;
    letter-spacing: 0.20em; text-transform: uppercase; color: var(--muted3);
  }
  .p28-table-scroll { overflow-x:auto; max-height:520px; overflow-y:auto; }
  table.p28-table { width:100%; border-collapse:collapse; min-width:820px; }
  table.p28-table thead { position:sticky; top:0; background:var(--bg2); z-index:2; }
  table.p28-table th {
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
    padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  table.p28-table th.r { text-align:right; }
  table.p28-table td {
    font-family: ui-monospace,monospace; font-size: 10.5px;
    padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle; font-variant-numeric: tabular-nums;
  }
  table.p28-table td.r { text-align:right; }
  table.p28-table tbody tr:hover { background:rgba(255,255,255,0.014); }
  table.p28-table tbody tr:last-child td { border-bottom:none; }

  .p28-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28);
    background: rgba(124,58,237,0.07);
    font-family: ui-monospace,monospace; font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--purple-soft);
  }

  .p28-rep-col  { color: rgba(255,80,80,0.95)   !important; font-weight: 700; }
  .p28-dem-col  { color: rgba(100,140,255,0.95)  !important; font-weight: 700; }
  .p28-net-rep  { color: rgba(255,80,80,0.9)     !important; font-weight: 700; }
  .p28-net-dem  { color: rgba(100,140,255,0.9)   !important; font-weight: 700; }
  .p28-net-even { color: rgba(167,139,250,0.85)  !important; font-weight: 700; }

  @media (max-width:640px) {
    .p28-portrait-strip { min-height:240px; }
    .p28-candidate-img  { height:200px; }
    .p28-name-tag       { font-size:16px !important; }
    .p28-candidate-panel.left  { padding-right:32px; }
    .p28-candidate-panel.right { padding-left: 32px; }
  }
  @media (prefers-reduced-motion:reduce) {
    .p28-root         { animation:none !important; }
    .p28-live-dot     { animation:none !important; }
    .p28-kpi-bar-fill { animation:none !important; }
  }

  
`;

// ─── KpiCard — identical shape to pgb / pap pages ────────────────────────────
function KpiCard({
  label,
  value,
  sub,
  accentColor,
  barPct,
}: {
  label: string;
  value: string;
  sub?: string;
  accentColor?: string;
  barPct?: number;
}) {
  return (
    <div className="p28-kpi">
      {accentColor && <div className="p28-kpi-accent" style={{ background: accentColor }} />}
      <div className="p28-kpi-label">{label}</div>
      <div className="p28-kpi-val" style={accentColor ? { color: accentColor } : {}}>
        {value}
      </div>
      {sub && <div className="p28-kpi-sub">{sub}</div>}
      {barPct !== undefined && (
        <div className="p28-kpi-bar">
          <div
            className="p28-kpi-bar-fill"
            style={{ width: `${barPct}%`, background: accentColor ?? "var(--purple)" }}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Election2028Page() {
  const { daily, latestVance, latestNewsom, latestNet, seriesForChart } = useMemo(() => {
    // Apply Gold Standard multiplier by inflating sampleSize
    const pollsAdjusted = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));

    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(
      pollsAdjusted as any,
      keys,
      range.start,
      range.end
    );

    // Add derived Newsom margin column (matches pattern in generic ballot)
    const dailyWithNet = dailyBase.map((row) => {
      const v = Number((row as any).Vance  ?? 0);
      const n = Number((row as any).Newsom ?? 0);
      return { ...row, Net: round1(n - v) } as any;
    });

    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;
    const latestVance  = latest ? Number((latest as any).Vance  ?? 0) : 0;
    const latestNewsom = latest ? Number((latest as any).Newsom ?? 0) : 0;
    const latestNet    = latest ? Number((latest as any).Net    ?? 0) : 0;

    const seriesForChart = [
      { key: "Vance",  label: "JD Vance (R)",    color: COLORS.Vance  },
      { key: "Newsom", label: "Gavin Newsom (D)", color: COLORS.Newsom },
    ];

    return { daily: dailyWithNet, latestVance, latestNewsom, latestNet, seriesForChart };
  }, []);

  // Margin display — mirrors pgb D+/R+ pattern
  const netText =
    latestNet === 0
      ? "EVEN"
      : latestNet > 0
      ? `D+${round1(latestNet).toFixed(1)}`
      : `R+${Math.abs(round1(latestNet)).toFixed(1)}`;

  const netColor =
    latestNet > 0
      ? "rgba(100,140,255,0.9)"
      : latestNet < 0
      ? "rgba(255,80,80,0.9)"
      : "rgba(167,139,250,0.85)";

  const netClass =
    latestNet > 0 ? "p28-net-dem" : latestNet < 0 ? "p28-net-rep" : "p28-net-even";

  return (
    <>
      <style>{CSS}</style>
      <div className="p28-root">

        {/* Top tri-stripe */}
        <div className="p28-stripe" />

        {/* ── HERO ── */}
        <div className="p28-hero">
          <div className="p28-stripe" />

            {/* ✅ ADD THIS */}
  <div className="p28-hero-gradient" />

          {/* Portrait strip */}
          <div className="p28-portrait-strip">

            {/* Vance — left */}
            <div className="p28-candidate-panel left" style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vance.png" alt="JD Vance" className="p28-candidate-img" />
              <div className="p28-name-tag left">
                JD Vance
                <span className="p28-name-sub">Republican · 47th Vice President</span>
              </div>
            </div>

            {/* VS centre */}
            <div className="p28-vs-center">
              <span className="p28-election-label">
                <span className="p28-live-dot" />
                2028 Presidential Race
              </span>
              <span className="p28-vs-text">VS</span>
              <span className="p28-vs-sub">General Election · Nationwide</span>
            </div>

            {/* Newsom — right */}
            <div className="p28-candidate-panel right" style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/newsom.png" alt="Gavin Newsom" className="p28-candidate-img" />
              <div className="p28-name-tag right">
                Gavin Newsom
                <span className="p28-name-sub">Democrat · Governor of California</span>
              </div>
            </div>
          </div>

          {/* Hero text + current readings */}
          <div className="p28-hero-inner">
            <div>
              <div className="p28-eyebrow">2028 Presidential Election · General Election Polling</div>
              <h1 className="p28-hero-title">
                <span className="rep">Vance</span> vs.{" "}
                <span className="dem">Newsom</span><br />
                Poll Average
              </h1>
              <p className="p28-hero-desc">
                Daily weighted average across all included polls — recency decay,
                √n sample adjustment, LV/RV/A screen, and PSI Gold Standard upweighting.
              </p>
              <div className="p28-hero-badge-row">
                <span className="p28-badge p28-badge-live">
                  <span className="p28-live-dot" />LIVE TRACKING
                </span>
                <span className="p28-badge p28-badge-gold">
                  ★ GOLD STANDARD ×{GOLD_STANDARD_MULTIPLIER} WEIGHT
                </span>
                <span className="p28-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="p28-badge p28-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>

            {/* Current readings panel — same structure as pgb */}
            <div className="p28-hero-read">
              {[
                {
                  label: "VANCE (R)",
                  val: `${round1(latestVance).toFixed(1)}%`,
                  color: "rgba(255,80,80,0.95)",
                },
                {
                  label: "NEWSOM (D)",
                  val: `${round1(latestNewsom).toFixed(1)}%`,
                  color: "rgba(100,140,255,0.95)",
                },
                { label: "MARGIN", val: netText, color: netColor },
              ].map(({ label, val, color }) => (
                <div key={label} className="p28-hero-read-row">
                  <span className="p28-hero-read-label">{label}</span>
                  <span className="p28-hero-read-val" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="p28-section-label">CURRENT AVERAGES</div>
        <div className="p28-kpi-grid">
          <KpiCard
            label="Vance (R)"
            value={`${round1(latestVance).toFixed(1)}%`}
            sub="Daily weighted avg"
            accentColor="rgba(255,80,80,0.8)"
            barPct={latestVance}
          />
          <KpiCard
            label="Newsom (D)"
            value={`${round1(latestNewsom).toFixed(1)}%`}
            sub="Daily weighted avg"
            accentColor="rgba(100,140,255,0.8)"
            barPct={latestNewsom}
          />
          <KpiCard
            label="Margin"
            value={netText}
            sub="Newsom − Vance"
            accentColor={netColor}
          />
          <KpiCard
            label="Polls"
            value={`${RAW_POLLS.length}`}
            sub="Included in model"
            barPct={Math.min(100, RAW_POLLS.length / 2)}
          />
        </div>

        {/* ── CHART — shared PollingTimeSeriesChart component ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[28, 62]}
          title="2028 Vance vs. Newsom polling average"
          subtitle="JD Vance & Gavin Newsom trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="p28-table-panel">
          <div className="p28-stripe" />
          <div className="p28-table-head">
            <span className="p28-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="p28-badge p28-badge-gold">
                ★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT
              </span>
              <span className="p28-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>

          <div className="p28-table-scroll">
            <table className="p28-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r">WEIGHT</th>
                  <th className="r">VANCE (R)</th>
                  <th className="r">NEWSOM (D)</th>
                  <th className="r">MARGIN</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p, idx) => {
                    const v = Number((p.results as any).Vance  ?? 0);
                    const n = Number((p.results as any).Newsom ?? 0);
                    const net = round1(n - v);
                    const netStr =
                      net === 0
                        ? "EVEN"
                        : net > 0
                        ? `D+${net.toFixed(1)}`
                        : `R+${Math.abs(net).toFixed(1)}`;
                    const nc =
                      net > 0 ? "p28-net-dem" : net < 0 ? "p28-net-rep" : "p28-net-even";

                    const gold = isGoldStandard(p.pollster);
                    const effN = effectiveSampleSize(p.pollster, p.sampleSize);

                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${idx}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="p28-gold-badge">GOLD</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">
                          {p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}
                          {gold && p.sampleSize > 0 && (
                            <span style={{ marginLeft: "6px", fontSize: "9px", color: "var(--muted3)" }}>
                              (eff {effN.toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: "rgba(255,255,255,0.7)" }}>
                          {gold ? `×${GOLD_STANDARD_MULTIPLIER}.00` : "×1.00"}
                        </td>
                        <td className="r p28-rep-col">{v.toFixed(1)}%</td>
                        <td className="r p28-dem-col">{n.toFixed(1)}%</td>
                        <td className={`r ${nc}`}>{netStr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}