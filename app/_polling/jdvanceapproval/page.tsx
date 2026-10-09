// app/polling/jdvancefavorability/page.tsx
"use client";
import { GOLD_STANDARD_NAMES, RAW_POLLS } from "./data";

import React, { useState, useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  Poll,
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
  TRACKER_PROFILE,
} from "@/app/_polling/lib/buildDailyModel";

const GOLD_STANDARD_MULTIPLIER = 3;


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

// ─── Polls data ───────────────────────────────────────────────────────────────


const COLORS: Record<string, string> = { Favorable: "#4d7fd4", Unfavorable: "#ff0040" };

function round1(n: number) { return Math.round(n * 10) / 10; }

export default function JDVanceFavorabilityPage() {
  const { daily, latestFavorable, latestUnfavorable, latestNet, seriesForChart } = useMemo(() => {
    const pollsAdj = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));
    const keys = getCandidateList(RAW_POLLS).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdj as any, keys, range.start, range.end, TRACKER_PROFILE);
    const dailyWithNet = dailyBase.map((row) => {
      const f = Number((row as any).Favorable ?? 0);
      const u = Number((row as any).Unfavorable ?? 0);
      return { ...row, Net: round1(f - u) };
    }) as any[];
    const latest = dailyWithNet[dailyWithNet.length - 1] ?? null;
    return {
      daily: dailyWithNet,
      latestFavorable:   latest ? Number(latest.Favorable   ?? 0) : 0,
      latestUnfavorable: latest ? Number(latest.Unfavorable ?? 0) : 0,
      latestNet:         latest ? Number(latest.Net         ?? 0) : 0,
      seriesForChart: [
        { key: "Favorable",   label: "Favorable",   color: COLORS.Favorable   },
        { key: "Unfavorable", label: "Unfavorable", color: COLORS.Unfavorable },
      ],
    };
  }, []);

  const netText = latestNet === 0 ? "EVEN"
    : latestNet > 0 ? `+${round1(latestNet).toFixed(1)}`
    : `${round1(latestNet).toFixed(1)}`;
  const netColor = latestNet >= 0 ? "rgba(77,127,212,1)" : "rgba(255,0,64,0.85)";

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
              <div className="pap-eyebrow">JD Vance · 50th Vice President of the United States</div>
              <h1 className="pap-hero-title">
                Favorability<br />
                <em className="pap-em-fav">Rating</em>
              </h1>
              <p className="pap-hero-desc">
                Daily weighted average across all included polls — recency decay,
                sigmoid sample curve, tracker LV/RV/A ladder, PSI Gold Standard upweighting, and a 15% cap on any single poll.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge pap-badge-gold">★ GOLD STANDARD ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-purple">RECENCY · SIGMOID N · 15% CAP</span>
              </div>
            </div>
            <div className="pap-hero-read">
              {[
                { label: "FAVORABLE",   val: `${round1(latestFavorable).toFixed(1)}%`,   color: "rgba(77,127,212,1)"  },
                { label: "UNFAVORABLE", val: `${round1(latestUnfavorable).toFixed(1)}%`, color: "rgba(255,0,64,0.9)" },
                { label: "NET",         val: netText,                                      color: netColor               },
              ].map(({ label, val, color }) => (
                <div key={label} className="pap-hero-read-row">
                  <span className="pap-hero-read-label">{label}</span>
                  <span className="pap-hero-read-val" style={{ color }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="pap-section-label">CURRENT AVERAGES</div>
        <div className="pap-kpi-grid">
          {[
            { label: "Favorable",    value: `${round1(latestFavorable).toFixed(1)}%`,   sub: "Daily weighted avg",    color: "rgba(77,127,212,1)",  bar: latestFavorable },
            { label: "Unfavorable",  value: `${round1(latestUnfavorable).toFixed(1)}%`, sub: "Daily weighted avg",    color: "rgba(255,0,64,0.75)",  bar: latestUnfavorable },
            { label: "Net Rating",   value: netText,                                     sub: "Favorable − Unfavorable", color: netColor,              bar: undefined },
            { label: "Polls",        value: `${RAW_POLLS.length}`,                      sub: "Included in model",     color: undefined,              bar: Math.min(100, RAW_POLLS.length / 2) },
          ].map(({ label, value, sub, color, bar }) => (
            <div key={label} className="pap-kpi">
              {color && <div className="pap-kpi-accent" style={{ background: color }} />}
              <div className="pap-kpi-label">{label}</div>
              <div className="pap-kpi-val" style={color ? { color } : {}}>{value}</div>
              <div className="pap-kpi-sub">{sub}</div>
              {bar !== undefined && (
                <div className="pap-kpi-bar">
                  <div className="pap-kpi-bar-fill" style={{ width: `${bar}%`, background: color ?? "var(--purple)" }} />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[25, 65]}
          title="JD Vance national favorability polling average"
          subtitle="Favorable & Unfavorable trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED NATIONAL POLLS</span>
            <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
              <span className="pap-badge pap-badge-gold">★ GOLD STANDARD = ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
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
                  <th className="r">WEIGHT</th>
                  <th className="r">FAVORABLE</th>
                  <th className="r">UNFAVORABLE</th>
                  <th className="r">NET</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p) => {
                    const f = Number((p.results as any).Favorable   ?? 0);
                    const u = Number((p.results as any).Unfavorable ?? 0);
                    const net = round1(f - u);
                    const netStr = net === 0 ? "0.0" : net > 0 ? `+${net.toFixed(1)}` : net.toFixed(1);
                    const gold = isGoldStandard(p.pollster);
                    const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${p.sampleSize}`}>
                        <td style={{ color: "rgba(var(--ink-rgb),calc(0.85 * var(--mute-k) + var(--floor)))" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="pap-gold-badge">GOLD</span>}
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
                        <td className="r" style={{ color: "rgba(var(--ink-rgb),calc(0.7 * var(--mute-k) + var(--floor)))" }}>
                          {gold ? `×${GOLD_STANDARD_MULTIPLIER}.00` : "×1.00"}
                        </td>
                        <td className="r pap-approve-col">{f.toFixed(0)}%</td>
                        <td className="r pap-disapprove-col">{u.toFixed(0)}%</td>
                        <td className={`r ${net > 0 ? "pap-net-pos" : net < 0 ? "pap-net-neg" : ""}`}>{netStr}</td>
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
            <div style={{ fontFamily: "var(--font-m)", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--purple-soft, #a78bfa)", marginBottom: 6 }}>
              METHODOLOGY
            </div>
            <p style={{ fontFamily: "var(--font-m)", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(var(--ink-rgb),calc(0.22 * var(--struct)))", margin: 0 }}>
              Favorability figures are sourced from public national polls. Each poll is weighted by recency
              (exponential decay), square-root of sample size, and sample type (LV &gt; RV &gt; A). Gold Standard
              pollsters receive a ×{GOLD_STANDARD_MULTIPLIER} weight multiplier applied to their effective sample size
              (×{GOLD_STANDARD_MULTIPLIER * GOLD_STANDARD_MULTIPLIER} effective sample). The daily trendline is a rolling
              weighted average across all polls active within the decay window. Favorable/Unfavorable splits are reported
              as published; net is computed as Favorable minus Unfavorable.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS — unified design system matching Trump approval page ─────────────────
const CSS = `
  .pap-root {
    --bg: var(--canvas);
    --bg2: #ffffff;
    --panel: #ffffff;
    --border: rgba(var(--ink-rgb),calc(0.08 * var(--struct)));
    --border2: rgba(var(--ink-rgb),calc(0.14 * var(--struct)));
    --muted: #6b7088;
    --muted2: #9aa0b4;
    --purple:      #6d3ee9;
    --purple2:     #8a63ef;
    --purple-soft: #a78bfa;
    --approve:     rgba(77,127,212,1);
    --disapprove:  rgba(255,0,64,0.85);
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

  /* TRI STRIPE */
  .pap-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      rgba(255,0,64,0.9)   0%,    rgba(255,0,64,0.9)   33.33%,
      var(--purple)         33.33%,var(--purple)         66.66%,
      rgba(77,127,212,1)   66.66%,rgba(77,127,212,1)   100%
    );
  }

  /* LIVE DOT */
  .pap-live-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--purple);
    box-shadow: 0 0 8px rgba(109, 62, 233,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite;
    flex-shrink: 0;
  }

  /* EYEBROW */
  .pap-eyebrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: var(--purple-soft);
    margin-bottom: 12px;
  }
  .pap-eyebrow::before {
    content: '';
    display: block;
    width: 16px; height: 1px;
    background: var(--purple-soft);
    opacity: 0.5;
  }

  /* HERO */
  .pap-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative;
    overflow: hidden;
  }
  .pap-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(255,0,64,0.05)    0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(77,127,212,0.04) 0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(109, 62, 233,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pap-hero::after {
    content: '';
    position: absolute; inset: 0;
    background-image: repeating-linear-gradient(
      0deg, transparent, transparent 3px,
      rgba(var(--line-rgb),0.006) 3px, rgba(var(--line-rgb),0.006) 4px
    );
    pointer-events: none;
  }
  .pap-hero-inner {
    position: relative;
    padding: 26px 28px 24px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 20px;
  }
  @media (max-width: 640px) { .pap-hero-inner { grid-template-columns: 1fr; } }

  .pap-hero-title {
    font-family: var(--font-display), system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 0.92;
    color: #fff;
    margin: 0 0 14px;
  }
  .pap-em-fav {
    font-style: normal;
    background: linear-gradient(110deg,#6d3ee9,#a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .pap-hero-desc {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 9.5px;
    letter-spacing: 0.12em;
    line-height: 1.75;
    color: var(--muted2);
    text-transform: uppercase;
    max-width: 520px;
  }
  .pap-hero-badge-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 16px;
  }

  /* BADGES */
  .pap-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 8px;
    border: 1px solid var(--border);
    background: rgba(var(--line-rgb),0.03);
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live   { border-color:rgba(109, 62, 233,0.35); background:rgba(109, 62, 233,0.07); color:var(--purple-soft); }
  .pap-badge-purple { border-color:rgba(109, 62, 233,0.35); background:rgba(109, 62, 233,0.07); color:var(--purple-soft); }
  .pap-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(109, 62, 233,0.07); color:var(--purple-soft); }

  /* HERO RIGHT */
  .pap-hero-read {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 190px;
  }
  .pap-hero-read-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(var(--line-rgb),0.03);
    position: relative;
    overflow: hidden;
  }
  .pap-hero-read-label {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase;
    color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 20px; font-weight: 900;
    font-variant-numeric: tabular-nums;
  }

  /* SECTION LABEL */
  .pap-section-label {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pap-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* KPI GRID */
  .pap-kpi-grid {
    display: grid;
    grid-template-columns: repeat(4,1fr);
    gap: 8px;
  }
  @media (max-width: 860px) { .pap-kpi-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 480px) { .pap-kpi-grid { grid-template-columns: 1fr; } }

  .pap-kpi {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 16px 18px;
    position: relative;
    overflow: hidden;
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
    font-size: clamp(22px,2.5vw,30px);
    font-weight: 900;
    color: #fff; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .pap-kpi-sub {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; letter-spacing: 0.16em;
    text-transform: uppercase; color: var(--muted3);
    margin-top: 6px;
  }
  .pap-kpi-bar { height: 2px; margin-top: 10px; background: rgba(var(--ink-rgb),calc(0.08 * var(--struct))); }
  .pap-kpi-bar-fill {
    height: 100%;
    animation: pap-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both;
  }

  /* TABLE PANEL */
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
    letter-spacing: 0.26em; text-transform: uppercase;
    color: var(--purple-soft);
  }
  .pap-table-head-note {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }
  .pap-table-scroll {
    overflow-x: auto;
    max-height: 520px;
    overflow-y: auto;
  }
  table.pap-table {
    width: 100%;
    border-collapse: collapse;
    min-width: 820px;
  }
  table.pap-table thead {
    position: sticky; top: 0;
    background: var(--bg2);
    z-index: 2;
  }
  table.pap-table th {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase;
    color: var(--muted3);
    padding: 10px 16px;
    text-align: left;
    border-bottom: 1px solid var(--border);
    white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 10.5px;
    padding: 10px 16px;
    border-bottom: 1px solid rgba(var(--ink-rgb),calc(0.05 * var(--struct)));
    color: var(--muted); vertical-align: middle;
    font-variant-numeric: tabular-nums;
  }
  table.pap-table td.r { text-align: right; }
  table.pap-table tbody tr:hover { background: rgba(var(--line-rgb),0.014); }
  table.pap-table tbody tr:last-child td { border-bottom: none; }

  .pap-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28);
    background: rgba(109, 62, 233,0.07);
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--purple-soft);
  }

  .pap-approve-col    { color: rgba(77,127,212,1)   !important; font-weight: 700; }
  .pap-disapprove-col { color: rgba(255,0,64,0.85)  !important; font-weight: 700; }
  .pap-net-pos        { color: rgba(77,127,212,1)   !important; font-weight: 700; }
  .pap-net-neg        { color: rgba(255,80,80,0.9)  !important; font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .pap-root { animation: none !important; }
    .pap-live-dot { animation: none !important; }
    .pap-kpi-bar-fill { animation: none !important; }
  }
`;