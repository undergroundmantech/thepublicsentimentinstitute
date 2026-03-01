// app/polling/2028-general/page.tsx
"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { feature } from "topojson-client";
import { geoAlbersUsa, geoPath } from "d3-geo";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";
import {
  STATE_PROJECTIONS,
  NATIONAL_TOTAL,
  DISTRICT_RESULTS,
} from "@/app/polling/2028polling/electionProjection2028";

const GOLD_STANDARD_MULTIPLIER = 2;

const GOLD_STANDARD_NAMES = [
  "Big Data Poll", "Rasmussen Reports", "AtlasIntel", "SoCalStrategies",
  "Emerson", "Trafalgar", "InsiderAdvantage", "Patriot Polling",
];

function normalizeName(s: string) {
  return s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
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

const RAW_POLLS: Poll[] = [
  { pollster: "Big Data Poll",          endDate: "2026-02-18", sampleSize: 1805, sampleType: "LV", results: { Vance: 46.8, Newsom: 53.2 } },
  { pollster: "YouGov / Yahoo",         endDate: "2026-02-12", sampleSize: 511,  sampleType: "LV", results: { Vance: 43.0, Newsom: 49.0 } },
  { pollster: "Zogby",                  endDate: "2026-01-07", sampleSize: 891,  sampleType: "LV", results: { Vance: 44.6, Newsom: 41.0 } },
  { pollster: "The Argument/Verasight", endDate: "2025-11-17", sampleSize: 1508, sampleType: "RV", results: { Vance: 46.4, Newsom: 53.6 } },
  { pollster: "Morning Consult",        endDate: "2025-11-16", sampleSize: 2201, sampleType: "RV", results: { Vance: 42.0, Newsom: 41.0 } },
  { pollster: "Overton Insights",       endDate: "2025-10-29", sampleSize: 1200, sampleType: "RV", results: { Vance: 43.0, Newsom: 46.0 } },
  { pollster: "Echelon Insights",       endDate: "2025-10-20", sampleSize: 1010, sampleType: "LV", results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "YouGov / UMass Lowell",  endDate: "2025-10-20", sampleSize: 1000, sampleType: "A",  results: { Vance: 32.0, Newsom: 36.0 } },
  { pollster: "Emerson",                endDate: "2025-10-14", sampleSize: 1000, sampleType: "RV", results: { Vance: 45.5, Newsom: 44.9 } },
  { pollster: "YouGov / Yahoo",         endDate: "2025-09-02", sampleSize: 1690, sampleType: "A",  results: { Vance: 41.0, Newsom: 49.0 } },
  { pollster: "Leger360",               endDate: "2025-08-31", sampleSize: 849,  sampleType: "A",  results: { Vance: 46.0, Newsom: 47.0 } },
  { pollster: "Emerson",                endDate: "2025-08-26", sampleSize: 1000, sampleType: "LV", results: { Vance: 44.4, Newsom: 43.5 } },
  { pollster: "SoCal Strategies",       endDate: "2025-08-18", sampleSize: 700,  sampleType: "A",  results: { Vance: 37.0, Newsom: 39.0 } },
  { pollster: "Emerson",                endDate: "2025-07-22", sampleSize: 1400, sampleType: "RV", results: { Vance: 45.3, Newsom: 42.1 } },
  { pollster: "SoCal Strategies",       endDate: "2024-12-23", sampleSize: 656,  sampleType: "A",  results: { Vance: 37.0, Newsom: 34.0 } },
];

const COLORS: Record<string, string> = { Vance: "#ff1717", Newsom: "#184dfc" };
function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Electoral votes per state ────────────────────────────────────────────────
const EV: Record<string, number> = {
  Alabama: 9, Alaska: 3, Arizona: 11, Arkansas: 6, California: 54,
  Colorado: 10, Connecticut: 7, Delaware: 3, Florida: 30, Georgia: 16,
  Hawaii: 4, Idaho: 4, Illinois: 19, Indiana: 11, Iowa: 6, Kansas: 6,
  Kentucky: 8, Louisiana: 8, Maine: 2, Maryland: 10, Massachusetts: 11,
  Michigan: 15, Minnesota: 10, Mississippi: 6, Missouri: 10, Montana: 4,
  Nebraska: 2, Nevada: 6, "New Hampshire": 4, "New Jersey": 14,
  "New Mexico": 5, "New York": 28, "North Carolina": 16, "North Dakota": 3,
  Ohio: 17, Oklahoma: 7, Oregon: 8, Pennsylvania: 19, "Rhode Island": 4,
  "South Carolina": 9, "South Dakota": 3, Tennessee: 11, Texas: 40,
  Utah: 6, Vermont: 3, Virginia: 13, Washington: 12, "West Virginia": 4,
  Wisconsin: 10, Wyoming: 3,
};

// FIPS code → state name mapping (for topojson)
const FIPS_TO_STATE: Record<string, string> = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas",
  "06": "California", "08": "Colorado", "09": "Connecticut", "10": "Delaware",
  "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho",
  "17": "Illinois", "18": "Indiana", "19": "Iowa", "20": "Kansas",
  "21": "Kentucky", "22": "Louisiana", "23": "Maine", "24": "Maryland",
  "25": "Massachusetts", "26": "Michigan", "27": "Minnesota", "28": "Mississippi",
  "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
  "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
  "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma",
  "41": "Oregon", "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina",
  "46": "South Dakota", "47": "Tennessee", "48": "Texas", "49": "Utah",
  "50": "Vermont", "51": "Virginia", "53": "Washington", "54": "West Virginia",
  "55": "Wisconsin", "56": "Wyoming",
};

// ─── Color scale for map fill ─────────────────────────────────────────────────
function marginToColor(margin: number): string {
  // margin > 0 = Vance (R), margin < 0 = Newsom (D)
  const abs = Math.abs(margin);
  if (margin > 0) {
    // Republican
    if (abs >= 12) return "#b91c1c";      // Safe R
    if (abs >= 6) return "#dc2626";      // Likely R
    if (abs >= 2)  return "#ef4444";      // Lean R
    return "#fca5a5";                      // Toss-up R
  } else {
    // Democrat
    if (abs >= 12) return "#1d4ed8";      // Safe D
    if (abs >= 6) return "#2563eb";      // Likely D
    if (abs >= 2)  return "#3b82f6";      // Lean D
    return "#93c5fd";                      // Toss-up D
  }
}

function marginToCategory(margin: number): string {
  const abs = Math.abs(margin);
  if (margin > 0) {
    if (abs >= 12) return "SAFE R";
    if (abs >= 6) return "LIKELY R";
    if (abs >= 2)  return "LEAN R";
    return "TOSS-UP R";
  } else {
    if (abs >= 12) return "SAFE D";
    if (abs >= 6) return "LIKELY D";
    if (abs >= 2)  return "LEAN D";
    return "TOSS-UP D";
  }
}

// Build projection lookup by state name
const projByState = Object.fromEntries(
  STATE_PROJECTIONS.map((p) => [p.state, p])
);

// ─── CSS ──────────────────────────────────────────────────────────────────────
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
  @keyframes p28-bar-in { from { width:0; } }

  .p28-root {
    display: flex; flex-direction: column; gap: 20px;
    animation: p28-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  .p28-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      var(--rep) 0%, var(--rep) 33.33%,
      var(--purple) 33.33%, var(--purple) 66.66%,
      var(--dem) 66.66%, var(--dem) 100%
    );
  }

  .p28-live-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--purple); box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: p28-pulse 1.8s ease-in-out infinite; flex-shrink: 0;
  }

  .p28-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; font-weight: 700; letter-spacing: 0.32em;
    text-transform: uppercase; color: var(--purple-soft); margin-bottom: 12px;
  }
  .p28-eyebrow::before {
    content: ''; display: block; width: 16px; height: 1px;
    background: var(--purple-soft); opacity: 0.5;
  }

  .p28-hero {
    border: 1px solid var(--border); background: var(--panel);
    position: relative; overflow: hidden;
  }
  .p28-hero::before {
    content: ''; position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 55% 100% at 0% 60%, rgba(255,23,23,0.08) 0%, transparent 65%),
      radial-gradient(ellipse 55% 100% at 100% 60%, rgba(24,77,252,0.09) 0%, transparent 65%),
      radial-gradient(ellipse 30% 60% at 50% 0%, rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .p28-hero::after {
    content: ''; position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }

  .p28-portrait-strip {
    position: relative; display: grid;
    grid-template-columns: 1fr auto 1fr; align-items: end;
    min-height: 360px; overflow: hidden; border-bottom: 1px solid var(--border);
  }
  .p28-portrait-strip::after {
    content: ''; position: absolute; top: 0; left: 50%;
    transform: translateX(-50%); width: 1px; height: 100%;
    background: linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.35) 15%,
      rgba(124,58,237,0.35) 85%, transparent 100%);
    pointer-events: none;
  }

  .p28-candidate-panel { display:flex; flex-direction:column; position:relative; }
  .p28-candidate-panel.left  { align-items:flex-end;   padding-right:52px; }
  .p28-candidate-panel.right { align-items:flex-start; padding-left: 52px; }

  .p28-candidate-img {
    height: 340px; width: auto; object-fit: contain; object-position: bottom;
    position: relative; z-index: 2;
    transition: transform 0.45s cubic-bezier(0.22,1,0.36,1);
  }
  .p28-candidate-img:hover { transform: scale(1.025) translateY(-4px); }
  .p28-candidate-panel.left .p28-candidate-img {
    filter: drop-shadow(-6px 0 22px rgba(255,23,23,0.28)) drop-shadow(0 8px 28px rgba(0,0,0,0.7));
  }
  .p28-candidate-panel.right .p28-candidate-img {
    filter: drop-shadow(6px 0 22px rgba(24,77,252,0.30)) drop-shadow(0 8px 28px rgba(0,0,0,0.7));
  }

  .p28-name-tag {
    position: absolute; bottom: 0; z-index: 5;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: clamp(18px,2.8vw,32px); font-weight: 900;
    text-transform: uppercase; letter-spacing: 0.06em; line-height: 1;
  }
  .p28-name-tag.left  { left:0; padding-left:20px; color:var(--rep); text-shadow:0 0 36px rgba(255,23,23,0.55); }
  .p28-name-tag.right { right:0; padding-right:20px; color:var(--dem); text-shadow:0 0 36px rgba(24,77,252,0.55); text-align:right; }
  .p28-name-sub {
    display: block; font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; font-weight: 700; letter-spacing: 0.26em;
    text-transform: uppercase; opacity: 0.55; margin-top: 3px;
  }

  .p28-vs-center {
    display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
    padding-bottom: 40px; position: relative; z-index: 10; gap: 4px;
  }
  .p28-election-label {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 8px; font-weight: 700;
    letter-spacing: 0.36em; text-transform: uppercase; color: var(--gold);
    margin-bottom: 8px; display: flex; align-items: center; gap: 7px;
  }
  .p28-vs-text {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: clamp(48px,6vw,72px); font-weight: 900; line-height: 1;
    background: linear-gradient(135deg, var(--rep) 0%, #fff 50%, var(--dem) 100%);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
    background-clip: text; filter: drop-shadow(0 2px 10px rgba(0,0,0,0.6));
    text-transform: uppercase; letter-spacing: 0.02em;
  }
  .p28-vs-sub {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 8px; letter-spacing: 0.24em;
    text-transform: uppercase; color: var(--muted3); margin-top: 4px;
  }

  .p28-hero-inner {
    position: relative; padding: 26px 28px 24px;
    display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 20px;
  }
  @media (max-width:640px) { .p28-hero-inner { grid-template-columns:1fr; } }

  .p28-hero-title {
    font-family: "Quantico", system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px); font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92; color: #fff; margin: 0 0 14px;
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
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 9.5px; letter-spacing: 0.12em;
    line-height: 1.75; color: var(--muted2); text-transform: uppercase; max-width: 520px;
  }
  .p28-hero-badge-row { display:flex; flex-wrap:wrap; gap:6px; margin-top:16px; }

  .p28-badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px;
    border: 1px solid var(--border); background: rgba(255,255,255,0.03);
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
  }
  .p28-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .p28-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .p28-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  .p28-hero-read { display:flex; flex-direction:column; gap:6px; min-width:170px; }
  .p28-hero-read-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px; border: 1px solid var(--border);
    background: rgba(255,255,255,0.03); position: relative; overflow: hidden;
  }
  .p28-hero-read-label {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .p28-hero-read-val {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .p28-section-label {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .p28-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .p28-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

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
    font-family: var(--font-body); font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted3); margin-bottom: 8px;
  }
  .p28-kpi-val {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums;
  }
  .p28-kpi-sub {
    font-family: var(--font-body), "Geist Mono", monospace;
    text-transform: uppercase; color: var(--muted3); margin-top: 6px;
  }
  .p28-kpi-bar { height:2px; margin-top:10px; background:rgba(255,255,255,0.07); }
  .p28-kpi-bar-fill { height:100%; animation: p28-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both; }

  /* ── ELECTORAL MAP ── */
  .p28-map-panel {
    background: var(--panel); border: 1px solid var(--border); overflow: hidden;
    position: relative;
  }
  .p28-map-head {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 14px 20px; display:flex; align-items:center;
    justify-content:space-between; gap:12px; flex-wrap:wrap;
  }
  .p28-map-title {
    font-family: var(--font-body); font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--purple-soft);
  }
  .p28-map-ev-row {
    display: flex; align-items: stretch; gap: 0;
    border: 1px solid var(--border); overflow: hidden;
    font-family: var(--font-body), "Geist Mono", monospace; font-weight: 500;
  }
  .p28-map-ev-block {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 8px 20px; gap: 2px;
  }
  .p28-map-ev-num {
    font-size: 28px; font-weight: 900; line-height: 1; font-variant-numeric: tabular-nums;
  }
  .p28-map-ev-label {
    font-size: 7px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; opacity: 0.55;
  }
  .p28-map-ev-divider {
    width: 1px; background: var(--border); align-self: stretch;
  }
  .p28-map-ev-needed {
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; padding: 8px 16px; gap: 2px;
    background: rgba(124,58,237,0.07);
  }
  .p28-map-ev-needed-num {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 14px; font-weight: 900;
    color: var(--purple-soft); font-variant-numeric: tabular-nums;
  }
  .p28-map-ev-needed-label {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted3);
  }

  /* EVbar under map header */
  .p28-ev-bar-wrap { padding: 12px 20px 0; }
  .p28-ev-bar {
    height: 18px; display: flex; overflow: hidden;
    border: 1px solid var(--border); position: relative;
  }
  .p28-ev-bar-rep { height: 100%; background: #dc2626; transition: width 600ms ease; }
  .p28-ev-bar-dem { height: 100%; background: #2563eb; transition: width 600ms ease; }
  .p28-ev-bar-toss { height: 100%; background: rgba(255,255,255,0.1); }
  .p28-ev-bar-line {
    position: absolute; top: 0; bottom: 0; width: 2px;
    background: var(--purple-soft); opacity: 0.8;
    left: 50%; transform: translateX(-50%);
  }
  .p28-ev-bar-labels {
    display: flex; justify-content: space-between;
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase;
    color: var(--muted3); margin-top: 6px; padding: 0 2px;
  }

  /* SVG map */
  .p28-map-svg-wrap {
    padding: 16px 20px 8px; position: relative;
  }
  .p28-map-svg { width: 100%; height: auto; display: block; }
  .p28-map-state {
    stroke: #0f0f15; stroke-width: 0.5;
    cursor: pointer; transition: opacity 120ms ease, stroke-width 120ms ease;
  }
  .p28-map-state:hover { opacity: 0.82; stroke-width: 1.5; stroke: rgba(255,255,255,0.5); }

  /* Tooltip */
  .p28-map-tooltip {
    position: absolute; pointer-events: none; z-index: 9999;
    background: #0f0f15; border: 1px solid rgba(255,255,255,0.15);
    padding: 10px 14px; min-width: 200px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.7);
    font-family: var(--font-body), "Geist Mono", monospace;
    transition: opacity 100ms ease;
  }
  .p28-tt-state {
    font-size: 11px; font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.1em; color: #fff; margin-bottom: 6px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .p28-tt-ev {
    font-size: 8px; font-weight: 700; letter-spacing: 0.18em;
    color: var(--purple-soft); padding: 1px 6px;
    border: 1px solid rgba(124,58,237,0.35); background: rgba(124,58,237,0.1);
  }
  .p28-tt-category {
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; margin-bottom: 8px;
  }
  .p28-tt-divider { height: 1px; background: rgba(255,255,255,0.08); margin: 6px 0; }
  .p28-tt-row {
    display: flex; justify-content: space-between; align-items: center;
    gap: 16px; margin-bottom: 3px;
  }
  .p28-tt-label {
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--muted3);
  }
  .p28-tt-val { font-size: 11px; font-weight: 900; font-variant-numeric: tabular-nums; }
  .p28-tt-margin-row {
    display: flex; justify-content: space-between; align-items: center;
    margin-top: 6px; padding-top: 6px; border-top: 1px solid rgba(255,255,255,0.08);
  }
  .p28-tt-margin-label {
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--muted3);
  }
  .p28-tt-margin-val { font-size: 14px; font-weight: 900; font-variant-numeric: tabular-nums; }
  .p28-tt-votes {
    display: block; font-size: 8px; font-weight: 700; letter-spacing: 0.12em;
    color: rgba(240,240,245,0.35); font-variant-numeric: tabular-nums; margin-top: 1px;
  }

  /* Legend */
  .p28-map-legend {
    display: flex; flex-wrap: wrap; gap: 8px; padding: 8px 20px 16px;
    align-items: center;
  }
  .p28-legend-item {
    display: flex; align-items: center; gap: 5px;
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted3);
  }
  .p28-legend-swatch { width: 12px; height: 12px; flex-shrink: 0; }

  /* ── TABLE PANEL ── */
  .p28-table-panel { background:var(--panel); border:1px solid var(--border); overflow:hidden; }
  .p28-table-head {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 14px 20px; display:flex; align-items:center;
    justify-content:space-between; gap:12px; flex-wrap:wrap;
  }
  .p28-table-head-title {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--purple-soft);
  }
  .p28-table-head-note {
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7.5px;
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
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 10.5px;
    padding: 10px 16px; border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle; font-variant-numeric: tabular-nums;
  }
  table.p28-table td.r { text-align:right; }
  table.p28-table tbody tr:hover { background:rgba(255,255,255,0.014); }
  table.p28-table tbody tr:last-child td { border-bottom:none; }

  .p28-gold-badge {
    display: inline-flex; align-items: center; padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28); background: rgba(124,58,237,0.07);
    font-family: var(--font-body), "Geist Mono", monospace; font-size: 7px; font-weight: 700;
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
    .p28-map-ev-block   { padding: 8px 12px; }
    .p28-map-ev-num     { font-size: 22px; }
  }
  @media (prefers-reduced-motion:reduce) {
    .p28-root, .p28-live-dot, .p28-kpi-bar-fill { animation:none !important; }
  }
`;

// ─── KpiCard ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, accentColor, barPct }: {
  label: string; value: string; sub?: string; accentColor?: string; barPct?: number;
}) {
  return (
    <div className="p28-kpi">
      {accentColor && <div className="p28-kpi-accent" style={{ background: accentColor }} />}
      <div className="p28-kpi-label">{label}</div>
      <div className="p28-kpi-val" style={accentColor ? { color: accentColor } : {}}>{value}</div>
      {sub && <div className="p28-kpi-sub">{sub}</div>}
      {barPct !== undefined && (
        <div className="p28-kpi-bar">
          <div className="p28-kpi-bar-fill" style={{ width: `${barPct}%`, background: accentColor ?? "var(--purple)" }} />
        </div>
      )}
    </div>
  );
}

// ─── ElectoralMap ─────────────────────────────────────────────────────────────
type StatePath = {
  fips: string;
  stateName: string;
  d: string;
  fill: string;
  margin: number;
  ev: number;
  proj: (typeof STATE_PROJECTIONS)[number] | undefined;
};

function ElectoralMap() {
  const [topoData, setTopoData] = useState<any>(null);
  const [tooltip, setTooltip] = useState<{
    visible: boolean; x: number; y: number; state: string;
  }>({ visible: false, x: 0, y: 0, state: "" });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json")
      .then((r) => r.json())
      .then(setTopoData)
      .catch(console.error);
  }, []);

  const { paths, vanceEV, newsomEV, tossupEV } = useMemo(() => {
    if (!topoData) return { paths: [], vanceEV: 0, newsomEV: 0, tossupEV: 0 };

    const WIDTH = 960;
    const HEIGHT = 600;
    const projection = geoAlbersUsa().scale(1280).translate([WIDTH / 2, HEIGHT / 2]);
    const pathGen = geoPath().projection(projection);

    const statesGeo = (feature(topoData, topoData.objects.states) as any).features;

    let vEV = 0, nEV = 0, tEV = 0;
    const result: StatePath[] = statesGeo.map((f: any) => {
      const fips = String(f.id).padStart(2, "0");
      const stateName = FIPS_TO_STATE[fips] ?? "";
      const proj = projByState[stateName];
      const ev = EV[stateName] ?? 0;
      const margin = proj?.margin ?? 0;
      const fill = proj ? marginToColor(margin) : "#1a1a2e";
      const d = pathGen(f) ?? "";

      if (proj) {
        if (margin > 0) vEV += ev;
        else if (margin < 0) nEV += ev;
        else tEV += ev;
      }

      return { fips, stateName, d, fill, margin, ev, proj };
    });

    return { paths: result, vanceEV: vEV, newsomEV: nEV, tossupEV: tEV };
  }, [topoData]);

  const totalEV = 538;
  const repPct  = (vanceEV  / totalEV) * 100;
  const demPct  = (newsomEV / totalEV) * 100;

  const activeProj = tooltip.visible ? projByState[tooltip.state] : null;
  const activeEV   = tooltip.visible ? (EV[tooltip.state] ?? 0) : 0;
  const activeMargin = activeProj?.margin ?? 0;
  const activeMarginStr = activeMargin === 0
    ? "EVEN"
    : activeMargin > 0
    ? `R+${Math.abs(activeMargin).toFixed(1)}`
    : `D+${Math.abs(activeMargin).toFixed(1)}`;
  const activeMarginColor = activeMargin > 0
    ? "rgba(255,80,80,0.95)"
    : activeMargin < 0
    ? "rgba(100,140,255,0.95)"
    : "rgba(167,139,250,0.85)";

  return (
    <div className="p28-map-panel">
      <div className="p28-stripe" />
      <div className="p28-map-head">
        <span className="p28-map-title">2028 ELECTORAL COLLEGE PROJECTION</span>
        <div className="p28-map-ev-row">
          <div className="p28-map-ev-block" style={{ background: "rgba(220,38,38,0.12)" }}>
            <span className="p28-map-ev-num" style={{ color: "#ef4444" }}>{vanceEV}</span>
            <span className="p28-map-ev-label" style={{ color: "rgba(255,80,80,0.7)" }}>VANCE EV</span>
          </div>
          <div className="p28-map-ev-divider" />
          <div className="p28-map-ev-needed">
            <span className="p28-map-ev-needed-num">270</span>
            <span className="p28-map-ev-needed-label">TO WIN</span>
          </div>
          <div className="p28-map-ev-divider" />
          <div className="p28-map-ev-block" style={{ background: "rgba(37,99,235,0.12)" }}>
            <span className="p28-map-ev-num" style={{ color: "#60a5fa" }}>{newsomEV}</span>
            <span className="p28-map-ev-label" style={{ color: "rgba(100,140,255,0.7)" }}>NEWSOM EV</span>
          </div>
        </div>
      </div>

      {/* EV progress bar */}
      <div className="p28-ev-bar-wrap">
        <div className="p28-ev-bar">
          <div className="p28-ev-bar-rep" style={{ width: `${repPct}%` }} />
          <div className="p28-ev-bar-toss" style={{ width: `${(tossupEV / totalEV) * 100}%` }} />
          <div className="p28-ev-bar-dem" style={{ width: `${demPct}%` }} />
          <div className="p28-ev-bar-line" />
        </div>
        <div className="p28-ev-bar-labels">
          <span style={{ color: "#ef4444" }}>VANCE {vanceEV} EV</span>
          <span>270 TO WIN</span>
          <span style={{ color: "#60a5fa" }}>NEWSOM {newsomEV} EV</span>
        </div>
      </div>

      {/* SVG map */}
      <div className="p28-map-svg-wrap" ref={containerRef} style={{ position: "relative" }}>
        {!topoData ? (
          <div style={{
            height: 400, display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "ui-monospace,monospace", fontSize: "9px", letterSpacing: "0.24em",
            textTransform: "uppercase", color: "rgba(240,240,245,0.22)",
          }}>
            LOADING MAP…
          </div>
        ) : (
          <svg
            ref={svgRef}
            viewBox="0 0 960 600"
            className="p28-map-svg"
            onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
          >
            {paths.map(({ fips, stateName, d, fill }: StatePath) => (
              <path
                key={fips}
                d={d}
                fill={fill}
                className="p28-map-state"
                onMouseMove={(e) => {
                  const rect = containerRef.current?.getBoundingClientRect();
                  if (!rect) return;
                  const x = e.clientX - rect.left;
                  const y = e.clientY - rect.top;
                  setTooltip({ visible: true, x, y, state: stateName });
                }}
                onMouseLeave={() => setTooltip((t) => ({ ...t, visible: false }))}
              />
            ))}
          </svg>
        )}
      </div>

      {/* Legend */}
      <div className="p28-map-legend">
        {[
          { color: "#b91c1c", label: "SAFE R (20+)" },
          { color: "#dc2626", label: "LIKELY R (10–20)" },
          { color: "#ef4444", label: "LEAN R (5–10)" },
          { color: "#fca5a5", label: "TOSS-UP R (<5)" },
          { color: "#93c5fd", label: "TOSS-UP D (<5)" },
          { color: "#3b82f6", label: "LEAN D (5–10)" },
          { color: "#2563eb", label: "LIKELY D (10–20)" },
          { color: "#1d4ed8", label: "SAFE D (20+)" },
        ].map(({ color, label }) => (
          <div key={label} className="p28-legend-item">
            <div className="p28-legend-swatch" style={{ background: color }} />
            {label}
          </div>
        ))}
      </div>

      {/* Tooltip — rendered in a portal-like fixed position */}
      {tooltip.visible && activeProj && (
        <div
          className="p28-map-tooltip"
          style={{
            left: tooltip.x + 16,
            top: Math.max(8, tooltip.y - 60),
            opacity: 1,
            transform: tooltip.x > 700 ? "translateX(calc(-100% - 32px))" : "none",
          }}
        >
          <div className="p28-tt-state">
            <span>{tooltip.state}</span>
            <span className="p28-tt-ev">{activeEV} EV</span>
          </div>
          <div
            className="p28-tt-category"
            style={{ color: activeMargin > 0 ? "#ef4444" : "#60a5fa" }}
          >
            {marginToCategory(activeMargin)}
          </div>
          <div className="p28-tt-divider" />
          <div className="p28-tt-row">
            <span className="p28-tt-label">VANCE (R)</span>
            <div style={{ textAlign: "right" }}>
              <span className="p28-tt-val" style={{ color: "#ef4444" }}>
                {activeProj.vancePct.toFixed(1)}%
              </span>
              <span className="p28-tt-votes">{activeProj.vanceVotes.toLocaleString()}</span>
            </div>
          </div>
          <div className="p28-tt-row">
            <span className="p28-tt-label">NEWSOM (D)</span>
            <div style={{ textAlign: "right" }}>
              <span className="p28-tt-val" style={{ color: "#60a5fa" }}>
                {activeProj.newsomPct.toFixed(1)}%
              </span>
              <span className="p28-tt-votes">{activeProj.newsomVotes.toLocaleString()}</span>
            </div>
          </div>
          {activeProj.otherPct > 0 && (
            <div className="p28-tt-row">
              <span className="p28-tt-label">OTHER</span>
              <div style={{ textAlign: "right" }}>
                <span className="p28-tt-val" style={{ color: "rgba(240,240,245,0.45)" }}>
                  {activeProj.otherPct.toFixed(1)}%
                </span>
                <span className="p28-tt-votes">{activeProj.otherVotes.toLocaleString()}</span>
              </div>
            </div>
          )}
          <div className="p28-tt-divider" />
          <div className="p28-tt-row" style={{ marginBottom: 0 }}>
            <span className="p28-tt-label">TOTAL VOTES</span>
            <span className="p28-tt-val" style={{ color: "rgba(240,240,245,0.55)", fontSize: "10px" }}>
              {activeProj.totalVotes.toLocaleString()}
            </span>
          </div>
          <div className="p28-tt-margin-row">
            <span className="p28-tt-margin-label">MARGIN</span>
            <span className="p28-tt-margin-val" style={{ color: activeMarginColor }}>
              {activeMarginStr}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Election2028Page() {
  const { daily, latestVance, latestNewsom, latestNet, seriesForChart } = useMemo(() => {
    const pollsAdjusted = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));

    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdjusted as any, keys, range.start, range.end);

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

  const netText =
    latestNet === 0 ? "EVEN"
    : latestNet > 0 ? `D+${round1(latestNet).toFixed(1)}`
    : `R+${Math.abs(round1(latestNet)).toFixed(1)}`;

  const netColor =
    latestNet > 0 ? "rgba(100,140,255,0.9)"
    : latestNet < 0 ? "rgba(255,80,80,0.9)"
    : "rgba(167,139,250,0.85)";

  return (
    <>
      <style>{CSS}</style>
      <div className="p28-root">

        <div className="p28-stripe" />

        {/* ── HERO ── */}
        <div className="p28-hero">
          <div className="p28-stripe" />
          <div className="p28-portrait-strip">
            <div className="p28-candidate-panel left" style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/vance.png" alt="JD Vance" className="p28-candidate-img" />
              <div className="p28-name-tag left">
                JD Vance
                <span className="p28-name-sub">Republican · 47th Vice President</span>
              </div>
            </div>
            <div className="p28-vs-center">
              <span className="p28-election-label">
                <span className="p28-live-dot" />
                2028 Presidential Race
              </span>
              <span className="p28-vs-text">VS</span>
              <span className="p28-vs-sub">General Election · Nationwide</span>
            </div>
            <div className="p28-candidate-panel right" style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/newsom.png" alt="Gavin Newsom" className="p28-candidate-img" />
              <div className="p28-name-tag right">
                Gavin Newsom
                <span className="p28-name-sub">Democrat · Governor of California</span>
              </div>
            </div>
          </div>

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
            <div className="p28-hero-read">
              {[
                { label: "VANCE (R)",  val: `${round1(latestVance).toFixed(1)}%`,  color: "rgba(255,80,80,0.95)" },
                { label: "NEWSOM (D)", val: `${round1(latestNewsom).toFixed(1)}%`, color: "rgba(100,140,255,0.95)" },
                { label: "MARGIN",     val: netText,                                color: netColor },
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
          <KpiCard label="Vance (R)"  value={`${round1(latestVance).toFixed(1)}%`}  sub="Daily weighted avg" accentColor="rgba(255,80,80,0.8)"   barPct={latestVance} />
          <KpiCard label="Newsom (D)" value={`${round1(latestNewsom).toFixed(1)}%`} sub="Daily weighted avg" accentColor="rgba(100,140,255,0.8)" barPct={latestNewsom} />
          <KpiCard label="Margin"     value={netText}  sub="Newsom − Vance" accentColor={netColor} />
          <KpiCard label="Polls"      value={`${RAW_POLLS.length}`} sub="Included in model" barPct={Math.min(100, RAW_POLLS.length / 2)} />
        </div>

        {/* ── ELECTORAL MAP ── */}
        <div className="p28-section-label">ELECTORAL COLLEGE FORECAST</div>
        <ElectoralMap />

        {/* ── CHART ── */}
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
              <span className="p28-badge p28-badge-gold">★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
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
                    const v   = Number((p.results as any).Vance  ?? 0);
                    const n   = Number((p.results as any).Newsom ?? 0);
                    const net = round1(n - v);
                    const netStr = net === 0 ? "EVEN" : net > 0 ? `D+${net.toFixed(1)}` : `R+${Math.abs(net).toFixed(1)}`;
                    const nc  = net > 0 ? "p28-net-dem" : net < 0 ? "p28-net-rep" : "p28-net-even";
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