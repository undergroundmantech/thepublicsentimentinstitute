// app/polling/texasdemocratprimary/page.tsx
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
{ pollster: "Public Policy Polling", endDate: "2026-02-25", sampleSize: 599, sampleType: "LV", results: { Crockett: 42, Talarico: 48, Hassan: 0 } },

  { pollster: "Chism/Blueprint", endDate: "2026-02-24", sampleSize: 472, sampleType: "LV", results: { Talarico: 52, Crockett: 40, Hassan: 0 } },

  { pollster: "Impact Research", endDate: "2026-02-12", sampleSize: 800, sampleType: "LV", results: { Crockett: 43, Talarico: 47, Hassan: 0 } },

  { pollster: "University of Texas / Texas Politics Project", endDate: "2026-02-16", sampleSize: 369, sampleType: "RV", results: { Crockett: 56, Talarico: 44, Hassan: 0 } },

  { pollster: "University of Houston", endDate: "2026-01-31", sampleSize: 550, sampleType: "LV", results: { Crockett: 47, Talarico: 39, Hassan: 2 } },

  { pollster: "TPOR", endDate: "2026-01-21", sampleSize: 1290, sampleType: "LV", results: { Crockett: 38, Talarico: 37, Hassan: 0 } },

  { pollster: "HIT Strategies", endDate: "2026-01-15", sampleSize: 1005, sampleType: "LV", results: { Crockett: 46, Talarico: 33, Hassan: 0 } },

  { pollster: "Emerson", endDate: "2026-01-12", sampleSize: 413, sampleType: "LV", results: { Crockett: 38, Talarico: 47, Hassan: 1 } },

  // ===== 2025 =====

  { pollster: "TSU", endDate: "2025-12-11", sampleSize: 1600, sampleType: "LV", results: { Crockett: 51, Talarico: 43, Hassan: 0 } },

  { pollster: "U. of Houston/TSU", endDate: "2025-10-01", sampleSize: 478, sampleType: "RV", results: { Crockett: 52, Talarico: 34, Hassan: 0 } },

  { pollster: "TPOR", endDate: "2025-08-29", sampleSize: 267, sampleType: "RV", results: { Crockett: 26, Talarico: 27, Hassan: 0 } }
];

const COLORS: Record<string, string> = {
  Crockett: "#3b82f6",
  Talarico: "#f59e0b",
  Hassan:   "#8b5cf6",
};

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function TexasDemPrimaryPage() {
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
  const leader = candidates[0];

  return (
    <>
      <style>{CSS}</style>
      <div className="pap-root">
        <div className="pap-stripe" />

        {/* ── HERO ── */}
        <div className="pap-hero">
          <div className="pap-stripe" />
          <div className="pap-hero-inner">
            <div>
              <div className="pap-eyebrow">Texas · 2026 U.S. Senate · Democratic Primary</div>
              <h1 className="pap-hero-title">
                Texas Senate<br />
                <em className="pap-em-dem">Democratic</em><br />
                Primary
              </h1>
              <p className="pap-hero-desc">
                Polling average across all included polls — recency decay,
                √n sample adjustment, and LV/RV screen weighting.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-blue">RECENCY · √N · LV/RV</span>
              </div>
            </div>
            <div className="pap-hero-read">
              {candidates.map(([name, val]) => (
                <div key={name} className="pap-hero-read-row">
                  <span className="pap-hero-read-label">{name.toUpperCase()}</span>
                  <span className="pap-hero-read-val" style={{ color: COLORS[name] ?? "#fff" }}>{val.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="pap-section-label">CURRENT AVERAGES</div>
        <div className="pap-kpi-grid" style={{ gridTemplateColumns: `repeat(${candidates.length + 1}, 1fr)` }}>
          {candidates.map(([name, val]) => (
            <div key={name} className="pap-kpi">
              <div className="pap-kpi-accent" style={{ background: COLORS[name] ?? "#aaa" }} />
              <div className="pap-kpi-label">{name}</div>
              <div className="pap-kpi-val" style={{ color: COLORS[name] ?? "#fff" }}>{val.toFixed(1)}%</div>
              <div className="pap-kpi-sub">Daily weighted avg</div>
              <div className="pap-kpi-bar">
                <div className="pap-kpi-bar-fill" style={{ width: `${val}%`, background: COLORS[name] ?? "#aaa" }} />
              </div>
            </div>
          ))}
          <div className="pap-kpi">
            <div className="pap-kpi-label">Polls</div>
            <div className="pap-kpi-val">{RAW_POLLS.length}</div>
            <div className="pap-kpi-sub">Included in model</div>
            <div className="pap-kpi-bar">
              <div className="pap-kpi-bar-fill" style={{ width: `${Math.min(100, RAW_POLLS.length * 10)}%`, background: "var(--purple)" }} />
            </div>
          </div>
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[0, 70]}
          title="Texas Democratic Senate Primary polling average"
          subtitle="Crockett, Talarico & Hassan trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pap-badge pap-badge-blue">** INTERNAL / PARTISAN POLL</span>
              <span className="pap-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>
          <div className="pap-table-scroll">
            <table className="pap-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">DATE RANGE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r" style={{ color: COLORS.Crockett }}>CROCKETT</th>
                  <th className="r" style={{ color: COLORS.Talarico }}>TALARICO</th>
                  <th className="r" style={{ color: COLORS.Hassan }}>HASSAN</th>
                  <th className="r">SPREAD</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p) => {
                    const c = Number((p.results as any).Crockett ?? 0);
                    const t = Number((p.results as any).Talarico ?? 0);
                    const h = Number((p.results as any).Hassan ?? 0);
                    const top = Math.max(c, t, h);
                    const second = [c, t, h].sort((a, b) => b - a)[1];
                    const spread = round1(top - second);
                    const topName = c === top ? "Crockett" : t === top ? "Talarico" : "Hassan";
                    const isPartisan = p.pollster.includes("**");
                    const displayName = p.pollster.replace(/\*\*/g, "");
                    return (
                      <tr key={`${p.pollster}-${p.endDate}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{displayName}</span>
                            {isPartisan && <span className="pap-partisan-badge">INTERNAL</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}</td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: COLORS.Crockett, fontWeight: c === top ? 700 : 400 }}>{c > 0 ? `${c}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Talarico, fontWeight: t === top ? 700 : 400 }}>{t > 0 ? `${t}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Hassan, fontWeight: h === top ? 700 : 400 }}>{h > 0 ? `${h}%` : "—"}</td>
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

        {/* ── METHODOLOGY ── */}
        <div className="pap-table-panel" style={{ borderTop: "none" }}>
          <div style={{ padding: "12px 18px" }}>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--blue-soft)", marginBottom: 6 }}>
              METHODOLOGY
            </div>
            <p style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(240,240,245,0.22)", margin: 0 }}>
              Polling averages are computed using a daily weighted model incorporating recency decay,
              square-root sample size adjustment, and screen type (LV/RV/A) weighting. Polls marked
              ** are internal or partisan and may carry reduced weight. All candidates with 0% in a
              given poll are excluded from that poll's spread calculation.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS ───────────────────────────────────────────────────────────────────────
const CSS = `
  .pap-root {
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
    --blue-soft:   #60a5fa;
  }

  @keyframes pap-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pap-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes pap-bar-in {
    from { width:0; }
  }

  .pap-root {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: pap-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  .pap-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      #1d4ed8 0%, #1d4ed8 33.33%,
      #2563eb 33.33%, #2563eb 66.66%,
      #3b82f6 66.66%, #3b82f6 100%
    );
  }

  .pap-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 8px rgba(59,130,246,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  .pap-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--blue-soft); margin-bottom: 12px;
  }
  .pap-eyebrow::before {
    content: '';
    display: block; width: 16px; height: 1px;
    background: var(--blue-soft); opacity: 0.5;
  }

  .pap-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative; overflow: hidden;
  }
  .pap-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%, rgba(59,130,246,0.06) 0%, transparent 65%),
      radial-gradient(ellipse 30% 60% at 50% 0%, rgba(59,130,246,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pap-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
    );
    pointer-events: none;
  }
  .pap-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end; gap: 20px;
  }
  @media (max-width: 640px) { .pap-hero-inner { grid-template-columns: 1fr; } }

  .pap-hero-title {
    font-family: "Quantico", system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92;
    color: #fff; margin: 0 0 14px;
  }
  .pap-em-dem {
    font-style: normal;
    background: linear-gradient(110deg,#1d4ed8,#60a5fa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pap-hero-desc {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 9.5px; letter-spacing: 0.12em; line-height: 1.75;
    color: var(--muted2); text-transform: uppercase; max-width: 520px;
  }
  .pap-hero-badge-row {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px;
  }

  .pap-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live { border-color:rgba(59,130,246,0.35); background:rgba(59,130,246,0.07); color:var(--blue-soft); }
  .pap-badge-blue { border-color:rgba(59,130,246,0.35); background:rgba(59,130,246,0.07); color:var(--blue-soft); }

  .pap-hero-read {
    display: flex; flex-direction: column; gap: 6px; min-width: 200px;
  }
  .pap-hero-read-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    position: relative; overflow: hidden;
  }
  .pap-hero-read-label {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .pap-section-label {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--blue-soft); opacity:0.5; }
  .pap-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  .pap-kpi-grid {
    display: grid; gap: 8px;
  }
  @media (max-width: 860px) { .pap-kpi-grid { grid-template-columns: repeat(2,1fr) !important; } }
  @media (max-width: 480px) { .pap-kpi-grid { grid-template-columns: 1fr !important; } }

  .pap-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative; overflow: hidden;
    transition: border-color 150ms ease;
  }
  .pap-kpi:hover { border-color: var(--border2); }
  .pap-kpi-accent {
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
  }
  .pap-kpi-label {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .pap-kpi-val {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: clamp(22px,2.5vw,30px); font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pap-kpi-sub {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3); margin-top: 6px;
  }
  .pap-kpi-bar { height: 2px; margin-top: 10px; background: rgba(255,255,255,0.07); }
  .pap-kpi-bar-fill {
    height: 100%;
    animation: pap-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  .pap-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .pap-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .pap-table-head-title {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--blue-soft);
  }
  .pap-table-head-note {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-table-scroll { overflow-x: auto; max-height: 520px; overflow-y: auto; }

  table.pap-table {
    width: 100%; border-collapse: collapse; min-width: 760px;
  }
  table.pap-table thead {
    position: sticky; top: 0; background: var(--bg2); z-index: 2;
  }
  table.pap-table th {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
    padding: 10px 16px; text-align: left;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.04);
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.pap-table td.r { text-align: right; }
  table.pap-table tbody tr:hover { background: rgba(255,255,255,0.014); }
  table.pap-table tbody tr:last-child td { border-bottom: none; }

  .pap-partisan-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(245,158,11,0.28);
    background: rgba(245,158,11,0.07);
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: rgba(245,158,11,0.8);
  }

  @media (prefers-reduced-motion: reduce) {
    .pap-root { animation: none !important; }
    .pap-live-dot { animation: none !important; }
    .pap-kpi-bar-fill { animation: none !important; }
  }
`;