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
  // February 2026
  { pollster: "The Public Sentiment Institute", endDate: "2026-02-20", sampleSize: 0, sampleType: "LV", results: { Collins: 12, Donalds: 30, Fishback: 8, Renner: 2 } },
  { pollster: "The Public Sentiment Institute", endDate: "2026-02-20", sampleSize: 0, sampleType: "RV", results: { Collins: 7, Donalds: 29, Fishback: 5, Renner: 1 } },
  { pollster: "University of North Florida", endDate: "2026-02-20", sampleSize: 657, sampleType: "LV", results: { Collins: 4, Donalds: 31, Fishback: 6, Renner: 1 } },
  { pollster: "Targoz Market Research**", endDate: "2026-02-16", sampleSize: 401, sampleType: "RV", results: { Collins: 15, Donalds: 33, Fishback: 3, Renner: 9 } },

  // January 2026
  { pollster: "Patriot Polling**", endDate: "2026-01-29", sampleSize: 827, sampleType: "LV", results: { Collins: 0, Donalds: 37, Fishback: 23, Renner: 0 } },
  { pollster: "Mason-Dixon Polling & Strategy", endDate: "2026-01-13", sampleSize: 400, sampleType: "RV", results: { Collins: 7, Donalds: 37, Fishback: 3, Renner: 4 } },
  { pollster: "Fabrizio, Lee & Associates**", endDate: "2026-01-06", sampleSize: 600, sampleType: "LV", results: { Collins: 6, Donalds: 45, Fishback: 4, Renner: 3 } },

  // December 2025
  { pollster: "Public Opinion Strategies**", endDate: "2025-12-11", sampleSize: 700, sampleType: "RV", results: { Collins: 13, Donalds: 40, Fishback: 0, Renner: 0 } },
  { pollster: "The Tyson Group**", endDate: "2025-12-09", sampleSize: 800, sampleType: "LV", results: { Collins: 9, Donalds: 38, Fishback: 2, Renner: 1 } },

  // November 2025
  { pollster: "The American Promise", endDate: "2025-11-19", sampleSize: 800, sampleType: "LV", results: { Collins: 1, Donalds: 43, Fishback: 0, Renner: 2 } },
  { pollster: "Victory Insights**", endDate: "2025-11-13", sampleSize: 600, sampleType: "LV", results: { Collins: 1, Donalds: 45, Fishback: 1, Renner: 3 } },

  // October 2025
  { pollster: "St. Pete Polls", endDate: "2025-10-15", sampleSize: 1034, sampleType: "LV", results: { Collins: 4, Donalds: 39, Fishback: 0, Renner: 3 } },

  // September 2025
  { pollster: "Targoz Market Research**", endDate: "2025-09-18", sampleSize: 506, sampleType: "RV", results: { Collins: 0, Donalds: 29, Fishback: 0, Renner: 9 } },
  { pollster: "The American Promise", endDate: "2025-09-05", sampleSize: 800, sampleType: "LV", results: { Collins: 2, Donalds: 40, Fishback: 0, Renner: 2 } },
];

const COLORS: Record<string, string> = {
  Donalds:  "#ef4444",
  Collins:  "#f97316",
  Fishback: "#facc15",
  Renner:   "#a78bfa",
};

function round1(n: number) { return Math.round(n * 10) / 10; }

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function FloridaGovRepublicanPrimaryPage() {
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
      <div className="pap-root">
        <div className="pap-stripe" />

        {/* ── HERO ── */}
        <div className="pap-hero">
          <div className="pap-stripe" />
          <div className="pap-hero-inner">
            <div>
              <div className="pap-eyebrow">Florida · 2026 Governor · Republican Primary</div>
              <h1 className="pap-hero-title">
                Florida Governor<br />
                <em className="pap-em-rep">Republican</em><br />
                Primary
              </h1>
              <p className="pap-hero-desc">
                Polling average across all included polls — recency decay,
                √n sample adjustment, and LV/RV screen weighting.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-red">RECENCY · √N · LV/RV</span>
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
              <div className="pap-kpi-bar-fill" style={{ width: `${Math.min(100, RAW_POLLS.length * 7)}%`, background: "var(--red)" }} />
            </div>
          </div>
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[0, 60]}
          title="Florida Republican Governor Primary polling average"
          subtitle="Donalds, Collins, Fishback & Renner trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pap-badge pap-badge-red">** INTERNAL / PARTISAN POLL</span>
              <span className="pap-table-head-note">SORTED BY END DATE ↓</span>
            </div>
          </div>
          <div className="pap-table-scroll">
            <table className="pap-table">
              <thead>
                <tr>
                  <th>POLLSTER</th>
                  <th className="r">END DATE</th>
                  <th className="r">N</th>
                  <th className="r">TYPE</th>
                  <th className="r" style={{ color: COLORS.Donalds }}>DONALDS</th>
                  <th className="r" style={{ color: COLORS.Collins }}>COLLINS</th>
                  <th className="r" style={{ color: COLORS.Fishback }}>FISHBACK</th>
                  <th className="r" style={{ color: COLORS.Renner }}>RENNER</th>
                  <th className="r">SPREAD</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p, i) => {
                    const d = Number((p.results as any).Donalds ?? 0);
                    const c = Number((p.results as any).Collins ?? 0);
                    const f = Number((p.results as any).Fishback ?? 0);
                    const r = Number((p.results as any).Renner ?? 0);
                    const vals = [d, c, f, r];
                    const top = Math.max(...vals);
                    const second = [...vals].sort((a, b) => b - a)[1];
                    const spread = round1(top - second);
                    const topName = d === top ? "Donalds" : c === top ? "Collins" : f === top ? "Fishback" : "Renner";
                    const isPartisan = p.pollster.includes("**");
                    const displayName = p.pollster.replace(/\*\*/g, "");
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${i}`}>
                        <td style={{ color: "rgba(255,255,255,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{displayName}</span>
                            {isPartisan && <span className="pap-partisan-badge">INTERNAL</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}</td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: COLORS.Donalds, fontWeight: d === top ? 700 : 400 }}>{d > 0 ? `${d}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Collins, fontWeight: c === top ? 700 : 400 }}>{c > 0 ? `${c}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Fishback, fontWeight: f === top ? 700 : 400 }}>{f > 0 ? `${f}%` : "—"}</td>
                        <td className="r" style={{ color: COLORS.Renner, fontWeight: r === top ? 700 : 400 }}>{r > 0 ? `${r}%` : "—"}</td>
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
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--red-soft)", marginBottom: 6 }}>
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
    --red:         #ef4444;
    --red2:        #f87171;
    --red-soft:    #fca5a5;
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
      #991b1b 0%, #991b1b 33.33%,
      #b91c1c 33.33%, #b91c1c 66.66%,
      #ef4444 66.66%, #ef4444 100%
    );
  }

  .pap-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: #ef4444;
    box-shadow: 0 0 8px rgba(239,68,68,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  .pap-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-family: ui-monospace,'Courier New',monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--red-soft); margin-bottom: 12px;
  }
  .pap-eyebrow::before {
    content: '';
    display: block; width: 16px; height: 1px;
    background: var(--red-soft); opacity: 0.5;
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
      radial-gradient(ellipse 45% 100% at 0% 60%, rgba(239,68,68,0.06) 0%, transparent 65%),
      radial-gradient(ellipse 30% 60% at 50% 0%, rgba(239,68,68,0.04) 0%, transparent 70%);
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
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92;
    color: #fff; margin: 0 0 14px;
  }
  .pap-em-rep {
    font-style: normal;
    background: linear-gradient(110deg,#991b1b,#fca5a5);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pap-hero-desc {
    font-family: ui-monospace,monospace;
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
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live { border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.07); color:var(--red-soft); }
  .pap-badge-red  { border-color:rgba(239,68,68,0.35); background:rgba(239,68,68,0.07); color:var(--red-soft); }

  .pap-hero-read {
    display: flex; flex-direction: column; gap: 6px; min-width: 220px;
  }
  .pap-hero-read-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    position: relative; overflow: hidden;
  }
  .pap-hero-read-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: ui-monospace,monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  .pap-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--red-soft); opacity:0.5; }
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
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.28em; text-transform: uppercase;
    color: var(--muted3); margin-bottom: 8px;
  }
  .pap-kpi-val {
    font-family: ui-monospace,monospace;
    font-size: clamp(22px,2.5vw,30px); font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pap-kpi-sub {
    font-family: ui-monospace,monospace;
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
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase; color: var(--red-soft);
  }
  .pap-table-head-note {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-table-scroll { overflow-x: auto; max-height: 520px; overflow-y: auto; }

  table.pap-table {
    width: 100%; border-collapse: collapse; min-width: 820px;
  }
  table.pap-table thead {
    position: sticky; top: 0; background: var(--bg2); z-index: 2;
  }
  table.pap-table th {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
    padding: 10px 16px; text-align: left;
    border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: ui-monospace,monospace;
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
    font-family: ui-monospace,monospace;
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