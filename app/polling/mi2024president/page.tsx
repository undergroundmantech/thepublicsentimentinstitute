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
  { pollster: "Big Data Poll", endDate: "2024-10-14", sampleSize: 904, sampleType: "LV", results: { Harris: 49.5, Trump: 50.5 } },
  // ── AtlasIntel ────────────────────────────────────────────────────────────
  { pollster: "AtlasIntel", endDate: "2024-11-04", sampleSize: 1113, sampleType: "LV", results: { Harris: 48, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-11-02", sampleSize: 1198, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-31", sampleSize: 1136, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-29", sampleSize: 938,  sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "AtlasIntel", endDate: "2024-10-17", sampleSize: 1529, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "AtlasIntel", endDate: "2024-09-25", sampleSize: 918,  sampleType: "LV", results: { Harris: 47, Trump: 50 } },

  // ── NY Times / Siena ──────────────────────────────────────────────────────
  { pollster: "NY Times/Siena", endDate: "2024-11-02", sampleSize: 998, sampleType: "LV", results: { Harris: 45, Trump: 45 } },
  { pollster: "NY Times/Siena", endDate: "2024-09-26", sampleSize: 688, sampleType: "LV", results: { Harris: 46, Trump: 46 } },
  { pollster: "NY Times/Siena", endDate: "2024-08-08", sampleSize: 619, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── MNS / Mitchell Research ───────────────────────────────────────────────
  { pollster: "Mitchell Research", endDate: "2024-11-02", sampleSize: 585, sampleType: "LV", results: { Harris: 48, Trump: 49 } },
  { pollster: "Mitchell Research", endDate: "2024-10-14", sampleSize: 589, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── FOX News ──────────────────────────────────────────────────────────────
  { pollster: "FOX News", endDate: "2024-10-28", sampleSize: 988,  sampleType: "LV", results: { Harris: 46, Trump: 48 } },
  { pollster: "FOX News", endDate: "2024-07-24", sampleSize: 1012, sampleType: "RV", results: { Harris: 43, Trump: 45 } },

  // ── Detroit Free Press ────────────────────────────────────────────────────
  { pollster: "Detroit Free Press", endDate: "2024-10-27", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 48 } },

  // ── CNN/SSRS ──────────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-10-28", sampleSize: 726, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── Echelon Insights ──────────────────────────────────────────────────────
  { pollster: "Echelon Insights", endDate: "2024-10-30", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 47 } },

  // ── Detroit News / WDIV-TV ────────────────────────────────────────────────
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 44 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-10-04", sampleSize: 600, sampleType: "LV", results: { Harris: 47, Trump: 44 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-08-29", sampleSize: 600, sampleType: "LV", results: { Harris: 44, Trump: 45 } },
  { pollster: "Detroit News/WDIV-TV", endDate: "2024-07-24", sampleSize: 600, sampleType: "LV", results: { Harris: 42, Trump: 41 } },

  // ── UMass Lowell ──────────────────────────────────────────────────────────
  { pollster: "UMass Lowell", endDate: "2024-10-24", sampleSize: 600, sampleType: "LV", results: { Harris: 49, Trump: 45 } },
  { pollster: "UMass Lowell", endDate: "2024-09-19", sampleSize: 650, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── Quinnipiac ────────────────────────────────────────────────────────────
  { pollster: "Quinnipiac", endDate: "2024-10-21", sampleSize: 1136, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Quinnipiac", endDate: "2024-10-07", sampleSize: 1007, sampleType: "LV", results: { Harris: 47, Trump: 50 } },
  { pollster: "Quinnipiac", endDate: "2024-09-16", sampleSize: 905,  sampleType: "LV", results: { Harris: 50, Trump: 45 } },

  // ── Bloomberg / Morning Consult ───────────────────────────────────────────
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-10-20", sampleSize: 705,  sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-09-25", sampleSize: 800,  sampleType: "LV", results: { Harris: 50, Trump: 46 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-08-26", sampleSize: 651,  sampleType: "LV", results: { Harris: 49, Trump: 47 } },
  { pollster: "Bloomberg/Morning Consult", endDate: "2024-07-28", sampleSize: 706,  sampleType: "RV", results: { Harris: 51, Trump: 39 } },

  // ── MRG ───────────────────────────────────────────────────────────────────
  { pollster: "MRG", endDate: "2024-10-11", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 44 } },

  // ── Fabrizio / Anzalone ───────────────────────────────────────────────────
  { pollster: "Fabrizio/Anzalone", endDate: "2024-10-08", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 46 } },
  { pollster: "Fabrizio/Anzalone", endDate: "2024-08-11", sampleSize: 600, sampleType: "LV", results: { Harris: 45, Trump: 43 } },

  // ── Wall Street Journal ───────────────────────────────────────────────────
  { pollster: "Wall Street Journal", endDate: "2024-10-08", sampleSize: 600, sampleType: "RV", results: { Harris: 47, Trump: 45 } },

  // ── MIRS / MI News Source ─────────────────────────────────────────────────
  { pollster: "MIRS/MI News Source", endDate: "2024-09-30", sampleSize: 709, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "MIRS/MI News Source", endDate: "2024-09-11", sampleSize: 580, sampleType: "LV", results: { Harris: 47, Trump: 46 } },

  // ── GSG / NSOR ────────────────────────────────────────────────────────────
  { pollster: "GSG/NSOR", endDate: "2024-09-29", sampleSize: 404, sampleType: "LV", results: { Harris: 48, Trump: 46 } },

  // ── Cook Political Report ─────────────────────────────────────────────────
  { pollster: "Cook Political Report", endDate: "2024-09-25", sampleSize: 416, sampleType: "LV", results: { Harris: 49, Trump: 46 } },
  { pollster: "Cook Political Report", endDate: "2024-08-02", sampleSize: 406, sampleType: "LV", results: { Harris: 46, Trump: 44 } },

  // ── USA Today / Suffolk ───────────────────────────────────────────────────
  { pollster: "USA Today/Suffolk", endDate: "2024-09-19", sampleSize: 500, sampleType: "LV", results: { Harris: 48, Trump: 45 } },

  // ── Remington Research (R) ────────────────────────────────────────────────
  { pollster: "Remington Research", endDate: "2024-09-20", sampleSize: 800, sampleType: "LV", results: { Harris: 49, Trump: 47 } },

  // ── Redfield & Wilton Strategies ─────────────────────────────────────────
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-31", sampleSize: 1731, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-27", sampleSize: 728,  sampleType: "LV", results: { Harris: 49, Trump: 48 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-22", sampleSize: 1115, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-18", sampleSize: 1008, sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-14", sampleSize: 682,  sampleType: "LV", results: { Harris: 47, Trump: 47 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-10-02", sampleSize: 839,  sampleType: "LV", results: { Harris: 48, Trump: 46 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-19", sampleSize: 993,  sampleType: "LV", results: { Harris: 46, Trump: 45 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-09-09", sampleSize: 556,  sampleType: "LV", results: { Harris: 48, Trump: 45 } },
  { pollster: "Redfield & Wilton Strategies", endDate: "2024-08-28", sampleSize: 1071, sampleType: "LV", results: { Harris: 47, Trump: 44 } },

  // ── YouGov ────────────────────────────────────────────────────────────────
  { pollster: "YouGov", endDate: "2024-10-31", sampleSize: 942, sampleType: "LV", results: { Harris: 48, Trump: 45 } },

  // ── CNN/SSRS (Aug) ────────────────────────────────────────────────────────
  { pollster: "CNN/SSRS", endDate: "2024-08-29", sampleSize: 708, sampleType: "LV", results: { Harris: 48, Trump: 43 } },

  // ── EPIC-MRA ──────────────────────────────────────────────────────────────
  { pollster: "EPIC/MRA", endDate: "2024-08-26", sampleSize: 600, sampleType: "LV", results: { Harris: 46, Trump: 45 } },

  // ── AmGreatness / TIPP ────────────────────────────────────────────────────
  { pollster: "AmGreatness/TIPP", endDate: "2024-08-22", sampleSize: 741, sampleType: "LV", results: { Harris: 46, Trump: 45 } },

  // ── Rasmussen Reports ─────────────────────────────────────────────────────
  { pollster: "Rasmussen Reports", endDate: "2024-08-17", sampleSize: 1093, sampleType: "LV", results: { Harris: 47, Trump: 44 } },

  // ── The Hill / Emerson ────────────────────────────────────────────────────
  { pollster: "The Hill/Emerson", endDate: "2024-07-23", sampleSize: 800, sampleType: "RV", results: { Harris: 44, Trump: 44 } },
];

export const ACTUAL_TRUMP  = 49.7;
export const ACTUAL_HARRIS = 48.3;

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
              <div className="pa24-eyebrow">2024 Presidential Election · Michigan · Archive</div>
              <h1 className="pa24-hero-title">
                <span className="gold">Michigan</span><br />
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
          title="2024 Michigan Presidential polling average"
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