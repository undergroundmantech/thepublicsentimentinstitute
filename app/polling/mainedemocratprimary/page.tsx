"use client";

import React, { useState, useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

// ─── Polls data ───────────────────────────────────────────────────────────────
const RAW_POLLS: Poll[] = [
  // March 2026
  { pollster: "Quantus Insights**",          endDate: "2026-03-05", sampleSize: 450, sampleType: "LV", results: { Costello: 0,  Mills: 38, Platner: 43, Wood: 0 } },

  // February / March 2026
  { pollster: "Pan Atlantic Research",        endDate: "2026-03-02", sampleSize: 367, sampleType: "LV", results: { Costello: 4,  Mills: 39, Platner: 46, Wood: 0 } },

  // February 2026
  { pollster: "University of New Hampshire",  endDate: "2026-02-16", sampleSize: 462, sampleType: "LV", results: { Costello: 1,  Mills: 26, Platner: 64, Wood: 0 } },

  // December 2025
  { pollster: "Workbench Strategy**",         endDate: "2025-12-16", sampleSize: 500, sampleType: "LV", results: { Costello: 0,  Mills: 40, Platner: 55, Wood: 0 } },

  // November / December 2025
  { pollster: "Pan Atlantic Research",        endDate: "2025-12-07", sampleSize: 318, sampleType: "LV", results: { Costello: 1,  Mills: 47, Platner: 37, Wood: 0 } },

  // November 2025
  { pollster: "Z to A Research**",            endDate: "2025-11-18", sampleSize: 845, sampleType: "LV", results: { Costello: 0,  Mills: 38, Platner: 58, Wood: 0 } },

  // October 2025
  { pollster: "Maine People's Resource Center", endDate: "2025-10-29", sampleSize: 783, sampleType: "LV", results: { Costello: 0,  Mills: 39, Platner: 41, Wood: 5 } },
  { pollster: "SoCal Strategies",             endDate: "2025-10-25", sampleSize: 500, sampleType: "LV", results: { Costello: 1,  Mills: 41, Platner: 36, Wood: 2 } },
  { pollster: "NRSC**",                       endDate: "2025-10-23", sampleSize: 647, sampleType: "LV", results: { Costello: 0,  Mills: 25, Platner: 46, Wood: 3 } },
  { pollster: "University of New Hampshire",  endDate: "2025-10-21", sampleSize: 510, sampleType: "LV", results: { Costello: 1,  Mills: 24, Platner: 58, Wood: 1 } },
];

const COLORS: Record<string, string> = {
  Platner:  "#3b82f6",
  Mills:    "#06b6d4",
  Costello: "#818cf8",
  Wood:     "#34d399",
};

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MaineGovDemocraticPrimaryPage() {
  const { daily, latestValues, seriesForChart } = useMemo(() => {
    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const daily = buildDailyWeightedSeries(RAW_POLLS as any, keys, range.start, range.end) as any[];
    const latest = daily[daily.length - 1] ?? null;
    const latestValues: Record<string, number> = {};
    for (const k of keys) latestValues[k] = latest ? round1(Number(latest[k] ?? 0)) : 0;
    const seriesForChart = keys.map((k) => ({ key: k, label: k, color: COLORS[k] ?? "#aaa" }));
    return { daily, latestValues, seriesForChart };
  }, []);

  const candidates = Object.entries(latestValues).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <style>{CSS}</style>
      <div className="map-root">
        <div className="map-stripe" />

        {/* ── HERO ── */}
        <div className="map-hero">
          <div className="map-stripe" />
          <div className="map-hero-inner">
            <div>
              <div className="map-eyebrow">Maine · 2026 Governor · Democratic Primary</div>
              <h1 className="map-hero-title">
                Maine Governor<br />
                <em className="map-em-dem">Democratic</em><br />
                Primary
              </h1>
              <p className="map-hero-desc">
                Polling average across all included polls — recency decay,
                √n sample adjustment, and LV/RV screen weighting.
              </p>
              <div className="map-hero-badge-row">
                <span className="map-badge map-badge-live"><span className="map-live-dot" />LIVE TRACKING</span>
                <span className="map-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="map-badge map-badge-blue">RECENCY · √N · LV/RV</span>
              </div>
            </div>
            <div className="map-hero-read">
              {candidates.map(([name, val]) => (
                <div key={name} className="map-hero-read-row">
                  <span className="map-hero-read-label">{name.toUpperCase()}</span>
                  <span className="map-hero-read-val" style={{ color: COLORS[name] ?? "#fff" }}>{val.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="map-section-label">CURRENT AVERAGES</div>
        <div className="map-kpi-grid" style={{ gridTemplateColumns: `repeat(${candidates.length + 1}, 1fr)` }}>
          {candidates.map(([name, val]) => (
            <div key={name} className="map-kpi">
              <div className="map-kpi-accent" style={{ background: COLORS[name] ?? "#aaa" }} />
              <div className="map-kpi-label">{name}</div>
              <div className="map-kpi-val" style={{ color: COLORS[name] ?? "#fff" }}>{val.toFixed(1)}%</div>
              <div className="map-kpi-sub">Daily weighted avg</div>
              <div className="map-kpi-bar">
                <div className="map-kpi-bar-fill" style={{ width: `${val}%`, background: COLORS[name] ?? "#aaa" }} />
              </div>
            </div>
          ))}
          <div className="map-kpi">
            <div className="map-kpi-label">Polls</div>
            <div className="map-kpi-val">{RAW_POLLS.length}</div>
            <div className="map-kpi-sub">Included in model</div>
            <div className="map-kpi-bar">
              <div className="map-kpi-bar-fill" style={{ width: `${Math.min(100, RAW_POLLS.length * 7)}%`, background: "var(--blue)" }} />
            </div>
          </div>
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[0, 75]}
          title="Maine Democratic Governor Primary polling average"
          subtitle="Platner, Mills, Costello & Wood trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="map-table-panel">
          <div className="map-stripe" />
          <div className="map-table-head">
            <span className="map-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="map-badge map-badge-blue">** INTERNAL / PARTISAN POLL</span>
              <span className="map-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>
          <div className="map-table-scroll">
            <table className="map-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r" style={{ color: COLORS.Platner }}>PLATNER</th>
                  <th className="r" style={{ color: COLORS.Mills }}>MILLS</th>
                  <th className="r" style={{ color: COLORS.Costello }}>COSTELLO</th>
                  <th className="r" style={{ color: COLORS.Wood }}>WOOD</th>
                  <th className="r">SPREAD</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p, i) => {
                    const pl = Number((p.results as any).Platner  ?? 0);
                    const mi = Number((p.results as any).Mills    ?? 0);
                    const co = Number((p.results as any).Costello ?? 0);
                    const wo = Number((p.results as any).Wood     ?? 0);
                    const vals = [pl, mi, co, wo];
                    const top = Math.max(...vals);
                    const second = [...vals].sort((a, b) => b - a)[1];
                    const spread = round1(top - second);
                    const topName =
                      pl === top ? "Platner"
                      : mi === top ? "Mills"
                      : co === top ? "Costello"
                      : "Wood";
                    const isPartisan = p.pollster.includes("**");
                    const displayName = p.pollster.replace(/\*\*/g, "");
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${i}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{displayName}</span>
                            {isPartisan && <span className="map-partisan-badge">INTERNAL</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}</td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: COLORS.Platner,  fontWeight: pl === top ? 700 : 400 }}>{pl > 0 ? `${pl}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Mills,    fontWeight: mi === top ? 700 : 400 }}>{mi > 0 ? `${mi}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Costello, fontWeight: co === top ? 700 : 400 }}>{co > 0 ? `${co}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Wood,     fontWeight: wo === top ? 700 : 400 }}>{wo > 0 ? `${wo}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS[topName], fontWeight: 700 }}>
                          {topName} +{spread.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── EVENTS TIMELINE ── */}
        <div className="map-table-panel" style={{ borderTop: "none" }}>
          <div className="map-table-head">
            <span className="map-table-head-title">KEY RACE EVENTS</span>
          </div>
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { date: "2025-11-12", label: "Jordan Wood withdraws from race" },
              { date: "2026-01-31", label: "Jared Golden (Favreau) withdraws from race" },
            ].map((ev) => (
              <div key={ev.date} className="map-event-row">
                <span className="map-event-date">{ev.date}</span>
                <div className="map-event-line" />
                <span className="map-event-label">{ev.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── METHODOLOGY ── */}
        <div className="map-table-panel" style={{ borderTop: "none" }}>
          <div style={{ padding: "12px 18px" }}>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blue-soft)", marginBottom: 6 }}>
              METHODOLOGY
            </div>
            <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(240,240,245,0.22)", margin: 0 }}>
              Polling averages are computed using a daily weighted model incorporating recency decay,
              square-root sample size adjustment, and screen type (LV/RV/A) weighting. Polls marked
              ** are internal or partisan and may carry reduced weight. All candidates with 0% in a
              given poll are excluded from that poll's spread calculation. Wood and Favreau/Golden
              withdrawals are noted; their poll results prior to withdrawal are included in the model.
            </p>
          </div>
        </div>

      </div>
    </>
  );
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  .map-root {
    --bg:          #060709;
    --bg2:         #09090f;
    --panel:       #0d0d14;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.15);
    --muted:       rgba(220,230,255,0.62);
    --muted2:      rgba(220,230,255,0.40);
    --muted3:      rgba(220,230,255,0.22);
    --blue:        #3b82f6;
    --blue2:       #60a5fa;
    --blue-soft:   #93c5fd;
  }

  @keyframes map-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes map-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes map-bar-in {
    from { width:0; }
  }

  .map-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: map-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  .map-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      #1e3a8a 0%, #1e3a8a 33.33%,
      #1d4ed8 33.33%, #1d4ed8 66.66%,
      #3b82f6 66.66%, #3b82f6 100%
    );
  }

  .map-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 8px rgba(59,130,246,0.7);
    animation: map-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  .map-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-family: ui-monospace, monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--blue-soft); margin-bottom: 12px;
  }
  .map-eyebrow::before {
    content: '';
    display: block; width: 16px; height: 1px;
    background: var(--blue-soft); opacity: 0.5;
  }

  .map-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative; overflow: hidden;
  }
  .map-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%, rgba(59,130,246,0.07) 0%, transparent 65%),
      radial-gradient(ellipse 30% 60% at 50% 0%, rgba(59,130,246,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .map-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.005) 3px, rgba(255,255,255,0.005) 4px
    );
    pointer-events: none;
  }
  .map-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end; gap: 20px;
  }
  @media (max-width: 640px) { .map-hero-inner { grid-template-columns: 1fr; } }

  .map-hero-title {
    font-family: "Quantico", system-ui, -apple-system, BlinkMacSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92;
    color: #fff; margin: 0 0 14px;
  }
  .map-em-dem {
    font-style: normal;
    background: linear-gradient(110deg,#1e3a8a,#93c5fd);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .map-hero-desc {
    font-family: ui-monospace, monospace;
    font-size: 9.5px; letter-spacing: 0.12em; line-height: 1.75;
    color: var(--muted2); text-transform: uppercase; max-width: 520px;
  }
  .map-hero-badge-row {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px;
  }

  .map-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace, monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .map-badge-live { border-color:rgba(59,130,246,0.35); background:rgba(59,130,246,0.07); color:var(--blue-soft); }
  .map-badge-blue { border-color:rgba(59,130,246,0.35); background:rgba(59,130,246,0.07); color:var(--blue-soft); }

  .map-hero-read {
    display: flex; flex-direction: column; gap: 6px; min-width: 220px;
  }
  .map-hero-read-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    position: relative; overflow: hidden;
  }
  .map-hero-read-label {
    font-family: ui-monospace, monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .map-hero-read-val {
    font-family: ui-monospace, monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .map-section-label {
    font-family: ui-monospace, monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .map-section-label::before { content:''; width:20px; height:1px; background:var(--blue-soft); opacity:0.5; }
  .map-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  .map-kpi-grid {
    display: grid; gap: 8px;
  }
  @media (max-width: 860px) { .map-kpi-grid { grid-template-columns: repeat(2,1fr) !important; } }
  @media (max-width: 480px) { .map-kpi-grid { grid-template-columns: 1fr !important; } }

  .map-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative; overflow: hidden;
    transition: border-color 150ms ease;
  }
  .map-kpi:hover { border-color: var(--border2); }
  .map-kpi-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
  }
  .map-kpi-label {
    font-family: ui-monospace, monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .map-kpi-val {
    font-family: ui-monospace, monospace;
    font-size: clamp(22px,2.5vw,30px); font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .map-kpi-sub {
    font-family: ui-monospace, monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3); margin-top: 6px;
  }
  .map-kpi-bar { height: 2px; margin-top: 10px; background: rgba(255,255,255,0.07); }
  .map-kpi-bar-fill {
    height: 100%;
    animation: map-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  .map-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .map-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .map-table-head-title {
    font-family: ui-monospace, monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--blue-soft);
  }
  .map-table-head-note {
    font-family: ui-monospace, monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .map-table-scroll { overflow-x: auto; max-height: 520px; overflow-y: auto; }

  table.map-table {
    width: 100%; border-collapse: collapse; min-width: 820px;
  }
  table.map-table thead {
    position: sticky; top: 0; background: var(--bg2); z-index: 2;
  }
  table.map-table th {
    font-family: ui-monospace, monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
    padding: 10px 16px; text-align: left;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  table.map-table th.r { text-align: right; }
  table.map-table td {
    font-family: ui-monospace, monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.map-table td.r { text-align: right; }
  table.map-table tbody tr:hover { background: rgba(255,255,255,0.014); }
  table.map-table tbody tr:last-child td { border-bottom: none; }

  .map-partisan-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(245,158,11,0.28);
    background: rgba(245,158,11,0.07);
    font-family: ui-monospace, monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(245,158,11,0.8);
  }

  .map-event-row {
    display: flex; align-items: center; gap: 12px;
  }
  .map-event-date {
    font-family: ui-monospace, monospace;
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.16em;
    color: var(--blue-soft); white-space: nowrap;
  }
  .map-event-line {
    flex: 0 0 20px; height: 1px;
    background: var(--border2);
  }
  .map-event-label {
    font-family: ui-monospace, monospace;
    font-size: 9px; letter-spacing: 0.10em;
    color: var(--muted2);
  }

  @media (prefers-reduced-motion: reduce) {
    .map-root { animation: none !important; }
    .map-live-dot { animation: none !important; }
    .map-kpi-bar-fill { animation: none !important; }
  }
`;