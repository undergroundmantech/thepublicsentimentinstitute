// app/polling/archive/pa2024president/page.tsx
"use client";

import React, { useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

// =============================================================================
// RAW POLL DATA
// =============================================================================

export const RAW_POLLS: Poll[] = [
 // --- Final Pre-Election Polls ---
  { pollster: "Research Co.", endDate: "2024-11-03", sampleSize: 450, sampleType: "LV", results: { Harris: 57, Trump: 40 } },
  { pollster: "ActiVote", endDate: "2024-10-28", sampleSize: 400, sampleType: "LV", results: { Harris: 57, Trump: 43 } },
  { pollster: "Cygnal (R)", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 52, Trump: 40 } },
  
  // --- Mid-October ---
  { pollster: "Rutgers-Eagleton", endDate: "2024-10-22", sampleSize: 929, sampleType: "RV", results: { Harris: 55, Trump: 35 } },
  { pollster: "Rutgers-Eagleton", endDate: "2024-10-22", sampleSize: 478, sampleType: "RV", results: { Harris: 51, Trump: 37 } },
  
  // --- September ---
  { pollster: "ActiVote", endDate: "2024-10-02", sampleSize: 400, sampleType: "LV", results: { Harris: 56, Trump: 44 } }
];


export const ACTUAL_TRUMP  = 46.1;
export const ACTUAL_HARRIS = 52.0;

const COLORS: Record<string, string> = {
  Trump:  "#ff1717",
  Harris: "#4d7fd4",
};

const GOLD_STANDARD_NAMES = [
  "AtlasIntel", "Rasmussen Reports", "Emerson",
  "Washington Post", "Fabrizio Ward", "Susquehanna",
];

function normalizeName(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function isGoldStandard(pollster: string) {
  const p = normalizeName(pollster);
  return GOLD_STANDARD_NAMES.some((n) => p.includes(normalizeName(n)));
}
function effectiveSampleSize(pollster: string, n: number) {
  if (!Number.isFinite(n) || n <= 0) return n;
  return isGoldStandard(pollster) ? Math.round(n * 4) : n;
}
function round1(n: number) { return Math.round(n * 10) / 10; }

// =============================================================================
// CSS
// =============================================================================
const CSS = `
  .pa24-root {
    --bg:          #070709;
    --bg2:         #0b0b0f;
    --panel:       #0f0f15;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.15);
    --muted:       rgba(240,240,245,0.62);
    --muted2:      rgba(240,240,245,0.40);
    --muted3:      rgba(240,240,245,0.22);
    --purple:      #7c3aed;
    --purple-soft: #a78bfa;
    --dem:         #4d7fd4;
    --rep:         #ff1717;
    --win:         #4ade80;
    --gold:        #f59e0b;
  }

  @keyframes pa24-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pa24-bar-in { from { width:0; } }

  .pa24-root {
    display:flex; flex-direction:column; gap:20px;
    animation: pa24-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  .pa24-stripe {
    height:3px;
    background:linear-gradient(90deg,
      var(--rep)    0%,    var(--rep)    33.33%,
      var(--purple) 33.33%,var(--purple) 66.66%,
      var(--dem)    66.66%,var(--dem)    100%
    );
  }

  /* ARCHIVE BANNER */
  .pa24-archive-banner {
    display:flex; align-items:center; gap:12px;
    padding:10px 18px;
    background:rgba(74,222,128,0.05);
    border:1px solid rgba(74,222,128,0.20);
    border-left:3px solid rgba(74,222,128,0.6);
  }
  .pa24-archive-banner-text {
    font-family:ui-monospace,monospace; font-size:8.5px; font-weight:700;
    letter-spacing:0.22em; text-transform:uppercase; color:#4ade80; line-height:1.6;
  }
  .pa24-archive-banner-result {
    margin-left:auto; display:flex; flex-direction:column; align-items:flex-end;
    gap:3px; flex-shrink:0;
  }
  .pa24-archive-banner-winner {
    font-family:ui-monospace,monospace; font-size:11px; font-weight:900;
    letter-spacing:0.16em; text-transform:uppercase; color:var(--rep);
  }
  .pa24-archive-banner-margin {
    font-family:ui-monospace,monospace; font-size:8px;
    letter-spacing:0.18em; text-transform:uppercase; color:var(--muted3);
  }

  /* EYEBROW */
  .pa24-eyebrow {
    display:flex; align-items:center; gap:8px;
    font-family:ui-monospace,monospace; font-size:8px; font-weight:700;
    letter-spacing:0.32em; text-transform:uppercase; color:var(--purple-soft);
    margin-bottom:12px;
  }
  .pa24-eyebrow::before { content:''; display:block; width:16px; height:1px; background:var(--purple-soft); opacity:0.5; }

  /* HERO */
  .pa24-hero {
    border:1px solid var(--border); background:var(--panel);
    position:relative; overflow:hidden;
  }
  .pa24-hero::before {
    content:''; position:absolute; inset:0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(77,127,212,0.05) 0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(255,23,23,0.06)  0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events:none;
  }
  .pa24-hero::after {
    content:''; position:absolute; inset:0;
    background-image:repeating-linear-gradient(
      0deg,transparent,transparent 3px,rgba(255,255,255,0.005) 3px,rgba(255,255,255,0.005) 4px
    );
    pointer-events:none;
  }
  .pa24-hero-inner {
    position:relative; padding:26px 28px 24px;
    display:grid; grid-template-columns:1fr auto; align-items:end; gap:20px;
  }
  @media (max-width:640px) { .pa24-hero-inner { grid-template-columns:1fr; } }

  .pa24-hero-title {
    font-family:"Quantico",system-ui,-apple-system,"Helvetica Neue",Arial,sans-serif;
    font-size:clamp(22px,3.5vw,46px); font-weight:900; text-transform:uppercase;
    letter-spacing:0.02em; line-height:0.92; color:#fff; margin:0 0 14px;
  }
  .pa24-hero-title .rep {
    font-style:normal;
    background:linear-gradient(110deg,rgba(255,23,23,1) 0%,rgba(255,100,100,0.85) 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .pa24-hero-title .gold {
    font-style:normal;
    background:linear-gradient(110deg,#f59e0b 0%,#fcd34d 100%);
    -webkit-background-clip:text; -webkit-text-fill-color:transparent; background-clip:text;
  }
  .pa24-hero-desc {
    font-family:ui-monospace,monospace; font-size:9.5px; letter-spacing:0.12em;
    line-height:1.75; color:var(--muted2); text-transform:uppercase; max-width:520px;
  }
  .pa24-hero-badge-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:16px; }

  /* BADGES */
  .pa24-badge {
    display:inline-flex; align-items:center; gap:5px; padding:3px 8px;
    border:1px solid var(--border); background:rgba(255,255,255,0.03);
    font-family:ui-monospace,monospace; font-size:7.5px; font-weight:700;
    letter-spacing:0.22em; text-transform:uppercase; color:var(--muted3);
  }
  .pa24-badge-archive { border-color:rgba(74,222,128,0.28); background:rgba(74,222,128,0.06); color:#4ade80; }
  .pa24-badge-gold    { border-color:rgba(245,158,11,0.30); background:rgba(245,158,11,0.06); color:var(--gold); }
  .pa24-badge-purple  { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  /* HERO READOUT */
  .pa24-hero-read { display:flex; flex-direction:column; gap:6px; min-width:200px; }
  .pa24-hero-read-row {
    display:flex; align-items:center; justify-content:space-between; gap:12px;
    padding:10px 14px; border:1px solid var(--border); background:rgba(255,255,255,0.03);
  }
  .pa24-hero-read-row.final { border-color:rgba(74,222,128,0.22); background:rgba(74,222,128,0.04); }
  .pa24-hero-read-label {
    font-family:ui-monospace,monospace; font-size:7px; font-weight:700;
    letter-spacing:0.24em; text-transform:uppercase; color:var(--muted3);
  }
  .pa24-hero-read-val {
    font-family:ui-monospace,monospace; font-size:18px; font-weight:900;
    font-variant-numeric:tabular-nums;
  }

  /* SECTION LABEL */
  .pa24-section-label {
    font-family:ui-monospace,monospace; font-size:7.5px; font-weight:700;
    letter-spacing:0.32em; text-transform:uppercase; color:var(--muted3);
    display:flex; align-items:center; gap:10px; margin-bottom:12px;
  }
  .pa24-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pa24-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* KPI GRID */
  .pa24-kpi-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; }
  @media (max-width:860px) { .pa24-kpi-grid { grid-template-columns:repeat(2,1fr); } }
  @media (max-width:480px) { .pa24-kpi-grid { grid-template-columns:1fr; } }

  .pa24-kpi {
    background:var(--panel); border:1px solid var(--border);
    padding:16px 18px; position:relative; overflow:hidden;
    transition:border-color 150ms ease;
  }
  .pa24-kpi:hover { border-color:var(--border2); }
  .pa24-kpi-accent { position:absolute; top:0; left:0; right:0; height:2px; }
  .pa24-kpi-label {
    font-family:ui-monospace,monospace; font-size:7.5px; font-weight:700;
    letter-spacing:0.28em; text-transform:uppercase; color:var(--muted3); margin-bottom:8px;
  }
  .pa24-kpi-val {
    font-family:ui-monospace,monospace; font-size:clamp(22px,2.5vw,30px); font-weight:900;
    color:#fff; line-height:1; font-variant-numeric:tabular-nums;
  }
  .pa24-kpi-sub {
    font-family:ui-monospace,monospace; font-size:8px; letter-spacing:0.16em;
    text-transform:uppercase; color:var(--muted3); margin-top:6px;
  }
  .pa24-kpi-bar { height:2px; margin-top:10px; background:rgba(255,255,255,0.07); }
  .pa24-kpi-bar-fill { height:100%; animation:pa24-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both; }

  /* ACCURACY PANEL */
  .pa24-accuracy-panel {
    background:var(--panel); border:1px solid rgba(74,222,128,0.18); overflow:hidden;
  }
  .pa24-accuracy-head {
    background:rgba(74,222,128,0.05); border-bottom:1px solid rgba(74,222,128,0.15);
    padding:14px 20px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
  }
  .pa24-accuracy-head-title {
    font-family:ui-monospace,monospace; font-size:9px; font-weight:700;
    letter-spacing:0.26em; text-transform:uppercase; color:#4ade80;
  }
  .pa24-accuracy-inner {
    padding:20px; display:grid; grid-template-columns:repeat(3,1fr); gap:14px;
  }
  @media (max-width:640px) { .pa24-accuracy-inner { grid-template-columns:1fr; } }
  .pa24-acc-item {
    border:1px solid var(--border); padding:14px 16px; background:rgba(255,255,255,0.02);
  }
  .pa24-acc-item-label {
    font-family:ui-monospace,monospace; font-size:7px; font-weight:700;
    letter-spacing:0.26em; text-transform:uppercase; color:var(--muted3); margin-bottom:8px;
  }
  .pa24-acc-item-val {
    font-family:ui-monospace,monospace; font-size:22px; font-weight:900;
    font-variant-numeric:tabular-nums; color:#fff;
  }
  .pa24-acc-item-sub {
    font-family:ui-monospace,monospace; font-size:8px; letter-spacing:0.14em;
    text-transform:uppercase; color:var(--muted3); margin-top:5px;
  }

  /* TABLE */
  .pa24-table-panel { background:var(--panel); border:1px solid var(--border); overflow:hidden; }
  .pa24-table-head {
    background:var(--bg2); border-bottom:1px solid var(--border);
    padding:14px 20px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;
  }
  .pa24-table-head-title {
    font-family:ui-monospace,monospace; font-size:9px; font-weight:700;
    letter-spacing:0.26em; text-transform:uppercase; color:var(--purple-soft);
  }
  .pa24-table-scroll { overflow-x:auto; max-height:540px; overflow-y:auto; }
  table.pa24-table { width:100%; border-collapse:collapse; min-width:820px; }
  table.pa24-table thead { position:sticky; top:0; background:var(--bg2); z-index:2; }
  table.pa24-table th {
    font-family:ui-monospace,monospace; font-size:7.5px; font-weight:700;
    letter-spacing:0.22em; text-transform:uppercase; color:var(--muted3);
    padding:10px 16px; text-align:left; border-bottom:1px solid var(--border); white-space:nowrap;
  }
  table.pa24-table th.r { text-align:right; }
  table.pa24-table td {
    font-family:ui-monospace,monospace; font-size:10.5px; padding:10px 16px;
    border-bottom:1px solid rgba(255,255,255,0.04); color:var(--muted);
    vertical-align:middle; font-variant-numeric:tabular-nums;
  }
  table.pa24-table td.r { text-align:right; }
  table.pa24-table tbody tr:hover { background:rgba(255,255,255,0.013); }
  table.pa24-table tbody tr:last-child td { border-bottom:none; }

  .pa24-gold-badge {
    display:inline-flex; align-items:center; padding:1px 6px;
    border:1px solid rgba(245,158,11,0.30); background:rgba(245,158,11,0.07);
    font-family:ui-monospace,monospace; font-size:7px; font-weight:700;
    letter-spacing:0.18em; text-transform:uppercase; color:var(--gold);
  }
  .pa24-partisan-badge {
    display:inline-flex; align-items:center; padding:1px 6px;
    border:1px solid rgba(255,80,80,0.22); background:rgba(255,80,80,0.07);
    font-family:ui-monospace,monospace; font-size:7px; font-weight:700;
    letter-spacing:0.16em; text-transform:uppercase; color:rgba(255,80,80,0.8);
  }
  .pa24-dem-col  { color:rgba(77,127,212,1)     !important; font-weight:700; }
  .pa24-rep-col  { color:rgba(255,80,80,0.95)   !important; font-weight:700; }
  .pa24-net-dem  { color:rgba(77,127,212,1)     !important; font-weight:700; }
  .pa24-net-rep  { color:rgba(255,80,80,0.9)    !important; font-weight:700; }
  .pa24-net-even { color:rgba(167,139,250,0.85) !important; font-weight:700; }

  .pa24-footnote {
    border-top:1px solid var(--border); padding:18px 0 4px;
    display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;
  }
  .pa24-footnote-text {
    font-family:ui-monospace,monospace; font-size:8px; letter-spacing:0.18em;
    text-transform:uppercase; color:var(--muted3);
  }

  @media (prefers-reduced-motion:reduce) {
    .pa24-root { animation:none !important; }
    .pa24-kpi-bar-fill { animation:none !important; }
  }
`;

// =============================================================================
// HELPERS
// =============================================================================
function KpiCard({ label, value, sub, accentColor, barPct }: {
  label: string; value: string; sub?: string; accentColor?: string; barPct?: number;
}) {
  return (
    <div className="pa24-kpi">
      {accentColor && <div className="pa24-kpi-accent" style={{ background: accentColor }} />}
      <div className="pa24-kpi-label">{label}</div>
      <div className="pa24-kpi-val" style={accentColor ? { color: accentColor } : {}}>{value}</div>
      {sub && <div className="pa24-kpi-sub">{sub}</div>}
      {barPct !== undefined && (
        <div className="pa24-kpi-bar">
          <div className="pa24-kpi-bar-fill" style={{ width: `${barPct}%`, background: accentColor ?? "var(--purple)" }} />
        </div>
      )}
    </div>
  );
}

// =============================================================================
// PAGE
// =============================================================================
export default function PA2024PresidentPage() {
  const { daily, finalHarris, finalTrump, finalNet, seriesForChart } = useMemo(() => {
    const pollsAdj = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));
    const keys = ["Harris", "Trump"];
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdj as any, keys, range.start, range.end);
    const latest = dailyBase[dailyBase.length - 1] ?? null;
    const finalHarris = latest ? round1(Number((latest as any).Harris ?? 0)) : 0;
    const finalTrump  = latest ? round1(Number((latest as any).Trump  ?? 0)) : 0;
    const finalNet    = round1(finalHarris - finalTrump);
    const seriesForChart = [
      { key: "Trump",  label: "Trump",  color: COLORS.Trump  },
      { key: "Harris", label: "Harris", color: COLORS.Harris },
    ];
    return { daily: dailyBase, finalHarris, finalTrump, finalNet, seriesForChart };
  }, []);

  const harrisMissBy  = round1(Math.abs(finalHarris - ACTUAL_HARRIS));
  const trumpMissBy   = round1(Math.abs(finalTrump  - ACTUAL_TRUMP));
  const avgMiss       = round1((harrisMissBy + trumpMissBy) / 2);
  const actualMargin  = round1(ACTUAL_HARRIS - ACTUAL_TRUMP);
  const marginMiss    = round1(Math.abs(finalNet - actualMargin));

  const netText = (n: number) =>
    n === 0 ? "EVEN" : n > 0 ? `Harris+${Math.abs(n).toFixed(1)}` : `Trump+${Math.abs(n).toFixed(1)}`;
  const netColor = (n: number) =>
    n > 0 ? "rgba(77,127,212,1)" : n < 0 ? "rgba(255,80,80,0.9)" : "rgba(167,139,250,0.85)";

  return (
    <>
      <style>{CSS}</style>
      <div className="pa24-root">
        <div className="pa24-stripe" />

        {/* ARCHIVE BANNER */}
        <div className="pa24-archive-banner">
          <div style={{ fontSize: 14, flexShrink: 0 }}>✓</div>
          <div className="pa24-archive-banner-text">
            RACE CALLED — NOVEMBER 5, 2024<br />
            This average is frozen as of Election Day. Results and accuracy scores are on file.
          </div>
          <div className="pa24-archive-banner-result">
            <span className="pa24-archive-banner-winner">TRUMP WINS PA</span>
            <span className="pa24-archive-banner-margin">
              {ACTUAL_TRUMP.toFixed(1)}% – {ACTUAL_HARRIS.toFixed(1)}% · Trump+{round1(ACTUAL_TRUMP - ACTUAL_HARRIS).toFixed(1)}
            </span>
          </div>
        </div>

        {/* HERO */}
        <div className="pa24-hero">
          <div className="pa24-stripe" />
          <div className="pa24-hero-inner">
            <div>
              <div className="pa24-eyebrow">2024 Presidential Election · New Jersey · Archive</div>
              <h1 className="pa24-hero-title">
                <span className="gold">New Jersey</span><br />
                <span className="rep">2024</span> Presidential<br />
                Polling Average
              </h1>
              <p className="pa24-hero-desc">
                Weighted daily average — Trump vs. Harris — from July through Election Day.
                Recency decay, √n sample adjustment, LV/RV/A screen, Gold Standard upweighting.
                Frozen at close of polls November 5, 2024.
              </p>
              <div className="pa24-hero-badge-row">
                <span className="pa24-badge pa24-badge-archive">✓ RACE CALLED</span>
                <span className="pa24-badge pa24-badge-archive">NOV 5, 2024</span>
                <span className="pa24-badge pa24-badge-gold">★ GOLD STANDARD ×2</span>
                <span className="pa24-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pa24-badge pa24-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>

            <div className="pa24-hero-read">
              {[
                { label: "MODEL — HARRIS",  val: `${finalHarris.toFixed(1)}%`, color: "rgba(77,127,212,1)" },
                { label: "MODEL — TRUMP",   val: `${finalTrump.toFixed(1)}%`,  color: "rgba(255,80,80,0.95)" },
                { label: "MODEL MARGIN",    val: netText(finalNet),            color: netColor(finalNet) },
              ].map(({ label, val, color }) => (
                <div key={label} className="pa24-hero-read-row">
                  <span className="pa24-hero-read-label">{label}</span>
                  <span className="pa24-hero-read-val" style={{ color }}>{val}</span>
                </div>
              ))}
              <div className="pa24-hero-read-row final">
                <span className="pa24-hero-read-label" style={{ color: "#4ade80" }}>ACTUAL RESULT</span>
                <span className="pa24-hero-read-val" style={{ color: "rgba(255,80,80,0.95)" }}>
                  Trump+{round1(ACTUAL_TRUMP - ACTUAL_HARRIS).toFixed(1)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs */}
        <div className="pa24-section-label">FINAL MODEL AVERAGES</div>
        <div className="pa24-kpi-grid">
          <KpiCard
            label="Harris (Model)"
            value={`${finalHarris.toFixed(1)}%`}
            sub={`Actual: ${ACTUAL_HARRIS.toFixed(1)}% · Off by ${harrisMissBy.toFixed(1)}pts`}
            accentColor="rgba(77,127,212,1)"
            barPct={finalHarris}
          />
          <KpiCard
            label="Trump (Model)"
            value={`${finalTrump.toFixed(1)}%`}
            sub={`Actual: ${ACTUAL_TRUMP.toFixed(1)}% · Off by ${trumpMissBy.toFixed(1)}pts`}
            accentColor="rgba(255,80,80,0.8)"
            barPct={finalTrump}
          />
          <KpiCard
            label="Model Margin"
            value={netText(finalNet)}
            sub={`Actual: ${netText(actualMargin)} · Miss: ${marginMiss.toFixed(1)}pts`}
            accentColor={netColor(finalNet)}
          />
          <KpiCard
            label="Polls Included"
            value={`${RAW_POLLS.length}`}
            sub="In final model"
            barPct={Math.min(100, RAW_POLLS.length * 2.5)}
          />
        </div>

        {/* CHART */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[40, 56]}
          title="2024 New Jersey Presidential polling average"
          subtitle="Trump & Harris trendlines — hover to view daily values"
        />

        {/* ACCURACY PANEL */}
        <div className="pa24-accuracy-panel">
          <div className="pa24-stripe" style={{ background: "linear-gradient(90deg,rgba(74,222,128,0.5) 0%,rgba(74,222,128,0.15) 100%)" }} />
          <div className="pa24-accuracy-head">
            <span className="pa24-accuracy-head-title">MODEL ACCURACY REPORT</span>
            <span className="pa24-badge pa24-badge-archive">NOV 5, 2024 RESULT ON FILE</span>
          </div>
          <div className="pa24-accuracy-inner">
            <div className="pa24-acc-item">
              <div className="pa24-acc-item-label">Harris — Model vs. Actual</div>
              <div className="pa24-acc-item-val" style={{ color: "rgba(77,127,212,1)" }}>
                {finalHarris.toFixed(1)}% → {ACTUAL_HARRIS.toFixed(1)}%
              </div>
              <div className="pa24-acc-item-sub">Off by {harrisMissBy.toFixed(1)} points</div>
            </div>
            <div className="pa24-acc-item">
              <div className="pa24-acc-item-label">Trump — Model vs. Actual</div>
              <div className="pa24-acc-item-val" style={{ color: "rgba(255,80,80,0.9)" }}>
                {finalTrump.toFixed(1)}% → {ACTUAL_TRUMP.toFixed(1)}%
              </div>
              <div className="pa24-acc-item-sub">Off by {trumpMissBy.toFixed(1)} points</div>
            </div>
            <div className="pa24-acc-item">
              <div className="pa24-acc-item-label">Margin — Model vs. Actual</div>
              <div className="pa24-acc-item-val" style={{ color: netColor(finalNet) }}>
                {netText(finalNet)} → {netText(actualMargin)}
              </div>
              <div className="pa24-acc-item-sub">
                Avg candidate miss: {avgMiss.toFixed(1)}pts · Margin miss: {marginMiss.toFixed(1)}pts
              </div>
            </div>
          </div>
        </div>

        {/* POLL TABLE */}
        <div className="pa24-table-panel">
          <div className="pa24-stripe" />
          <div className="pa24-table-head">
            <span className="pa24-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pa24-badge pa24-badge-gold">★ GOLD STANDARD = ×2 WEIGHT</span>
              <span style={{ fontFamily:"ui-monospace,monospace", fontSize:"7.5px", letterSpacing:"0.20em", textTransform:"uppercase", color:"var(--muted3)" }}>
                SORTED BY END DATE ↓
              </span>
            </div>
          </div>
          <div className="pa24-table-scroll">
            <table className="pa24-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r">WEIGHT</th>
                  <th className="r">HARRIS</th>
                  <th className="r">TRUMP</th>
                  <th className="r">MARGIN</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p, i) => {
                    const h   = Number((p.results as any).Harris ?? 0);
                    const t   = Number((p.results as any).Trump  ?? 0);
                    const net = round1(h - t);
                    const netStr =
                      net === 0 ? "EVEN" :
                      net > 0   ? `Harris+${net.toFixed(1)}` :
                                  `Trump+${Math.abs(net).toFixed(1)}`;
                    const netClass = net > 0 ? "pa24-net-dem" : net < 0 ? "pa24-net-rep" : "pa24-net-even";
                    const gold = isGoldStandard(p.pollster);
                    const isD  = p.pollster.toLowerCase().includes("(d)") ||
                                 p.pollster.toLowerCase().includes("progress");
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${i}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display:"flex", alignItems:"center", gap:"7px", flexWrap:"wrap" }}>
                            <span>{p.pollster.replace(/\s*\(D\)/gi,"").replace(/\*\*/g,"")}</span>
                            {gold && <span className="pa24-gold-badge">GOLD</span>}
                            {isD  && <span className="pa24-partisan-badge">D</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}</td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color:"rgba(255,255,255,0.6)" }}>
                          {gold ? "×2.00" : "×1.00"}
                        </td>
                        <td className="r pa24-dem-col">{h.toFixed(0)}%</td>
                        <td className="r pa24-rep-col">{t.toFixed(0)}%</td>
                        <td className={`r ${netClass}`}>{netStr}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="pa24-footnote">
          <span className="pa24-footnote-text">
            Frozen Nov 5, 2024 · Recency decay · √n · LV/RV/A screen · Gold Standard ×2
          </span>
          <span className="pa24-badge pa24-badge-archive">PSI · ACCURACY ON FILE</span>
        </div>
      </div>
    </>
  );
}