// app/polling/righttrackwrongtrack/page.tsx
"use client";

import React, { useMemo } from "react";
import PollingTimeSeriesChart from "@/app/components/PollingTimeSeriesChart";
import {
  getCandidateList,
  getDateRange,
  buildDailyWeightedSeries,
} from "@/app/polling/lib/buildDailyModel";

const GOLD_STANDARD_MULTIPLIER = 3;
export { GOLD_STANDARD_NAMES, RAW_POLLS } from "./data";
import { GOLD_STANDARD_NAMES, RAW_POLLS } from "./data";

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

const COLORS: Record<string, string> = {
  RightTrack: "#2563eb",
  WrongTrack:  "#ff0040",
};

function round1(n: number) { return Math.round(n * 10) / 10; }

export default function RightTrackWrongTrackPage() {
  const { daily, latestRT, latestWT, latestSpread, seriesForChart } = useMemo(() => {
    const pollsAdj = RAW_POLLS.map((p) => ({
      ...p,
      sampleSize: effectiveSampleSize(p.pollster, p.sampleSize),
    }));
    const keys = ["RightTrack", "WrongTrack"];
    const range = getDateRange(RAW_POLLS);
    const dailyBase = buildDailyWeightedSeries(pollsAdj as any, keys, range.start, range.end) as any[];
    const dailyWithSpread = dailyBase.map((row) => ({
      ...row,
      Spread: round1(Number(row.RightTrack ?? 0) - Number(row.WrongTrack ?? 0)),
    }));
    const latest = dailyWithSpread[dailyWithSpread.length - 1] ?? null;
    return {
      daily: dailyWithSpread,
      latestRT:     latest ? round1(Number(latest.RightTrack ?? 0)) : 0,
      latestWT:     latest ? round1(Number(latest.WrongTrack  ?? 0)) : 0,
      latestSpread: latest ? round1(Number(latest.Spread      ?? 0)) : 0,
      seriesForChart: [
        { key: "RightTrack", label: "Right Track", color: COLORS.RightTrack },
        { key: "WrongTrack", label: "Wrong Track", color: COLORS.WrongTrack },
      ],
    };
  }, []);

  const spreadStr = latestSpread === 0 ? "EVEN"
    : latestSpread > 0 ? `+${latestSpread.toFixed(1)}`
    : `${latestSpread.toFixed(1)}`;
  const spreadColor = latestSpread >= 0 ? "rgba(43,255,0,0.85)" : "rgba(255,0,64,0.85)";

  const rt = latestRT;
  let sentiment: { label: string; color: string; desc: string };
  if (rt >= 45)      sentiment = { label: "OPTIMISTIC",      color: "#4ade80", desc: "Electorate broadly positive — favorable environment for incumbent" };
  else if (rt >= 38) sentiment = { label: "MIXED",           color: "#facc15", desc: "Closely divided — competitive environment for both parties" };
  else if (rt >= 30) sentiment = { label: "PESSIMISTIC",     color: "#fb923c", desc: "Majority on wrong track — structural headwinds for incumbent party" };
  else               sentiment = { label: "DEEPLY NEGATIVE", color: "#f87171", desc: "Historically low right track — significant political liability" };

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
              <div className="pap-eyebrow">National Sentiment · Direction of the Country</div>
              <h1 className="pap-hero-title">
                Right Track /<br />
                <em className="pap-em-wrong">Wrong Track</em>
              </h1>
              <p className="pap-hero-desc">
                Daily weighted average across all included polls — recency decay,
                √n sample adjustment, LV/RV/A screen, and PSI Gold Standard upweighting.
              </p>
              <div className="pap-hero-badge-row">
                <span className="pap-badge pap-badge-live"><span className="pap-live-dot" />LIVE TRACKING</span>
                <span className="pap-badge pap-badge-gold">★ GOLD STANDARD ×{GOLD_STANDARD_MULTIPLIER} WEIGHT</span>
                <span className="pap-badge">{RAW_POLLS.length} POLLS IN MODEL</span>
                <span className="pap-badge pap-badge-purple">RECENCY · √N · LV/RV/A</span>
              </div>
            </div>
            <div className="pap-hero-read">
              {[
                { label: "RIGHT TRACK", val: `${latestRT.toFixed(1)}%`, color: "rgba(77,127,212,1)"  },
                { label: "WRONG TRACK", val: `${latestWT.toFixed(1)}%`, color: "rgba(255,0,64,0.9)"  },
                { label: "SPREAD",      val: spreadStr,                  color: spreadColor            },
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
            { label: "Right Track", value: `${latestRT.toFixed(1)}%`, sub: "Daily weighted avg", color: "#2563eb",             bar: latestRT },
            { label: "Wrong Track", value: `${latestWT.toFixed(1)}%`, sub: "Daily weighted avg", color: "rgba(255,0,64,0.75)", bar: latestWT },
            { label: "Spread",      value: spreadStr,                  sub: "Right − Wrong",      color: spreadColor,           bar: undefined },
            { label: "Polls",       value: `${RAW_POLLS.length}`,     sub: "Included in model",  color: undefined,             bar: Math.min(100, RAW_POLLS.length / 2.5) },
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

        {/* ── SENTIMENT CONTEXT ── */}
        <div className="pap-context-panel">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ fontFamily: "ui-monospace,monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "rgba(240,240,245,0.3)", whiteSpace: "nowrap" }}>
              CURRENT READING
            </div>
            <span style={{
              display: "inline-flex", alignItems: "center", padding: "4px 10px",
              border: `1px solid ${sentiment.color}44`, background: `${sentiment.color}11`,
              fontFamily: "ui-monospace,monospace", fontSize: 8, fontWeight: 700,
              letterSpacing: "0.22em", textTransform: "uppercase", color: sentiment.color,
            }}>
              {sentiment.label}
            </span>
            <span style={{ fontFamily: "ui-monospace,monospace", fontSize: 8.5, letterSpacing: "0.1em", color: "rgba(240,240,245,0.35)", textTransform: "uppercase" }}>
              {sentiment.desc}
            </span>
          </div>
          <div className="pap-context-benchmarks">
            {[
              { label: "OPTIMISM THRESHOLD",  val: "45%+",   color: "#4ade80" },
              { label: "COMPETITIVE ZONE",    val: "38–44%", color: "#facc15" },
              { label: "WRONG TRACK MAJORITY", val: "<38%",  color: "#fb923c" },
              { label: "CURRENT RIGHT TRACK", val: `${latestRT.toFixed(1)}%`, color: sentiment.color },
            ].map(({ label, val, color }) => (
              <div key={label} className="pap-context-item">
                <div className="pap-context-item-label">{label}</div>
                <div className="pap-context-item-val" style={{ color }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── CHART ── */}
        <PollingTimeSeriesChart
          data={daily as any[]}
          series={seriesForChart}
          yDomain={[15, 70]}
          title="Right Track / Wrong Track national polling average"
          subtitle="Right Track & Wrong Track trendlines — hover to view daily values"
        />

        {/* ── POLL TABLE ── */}
        <div className="pap-table-panel">
          <div className="pap-stripe" />
          <div className="pap-table-head">
            <span className="pap-table-head-title">ALL INCLUDED POLLS</span>
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
                  <th className="r">RIGHT TRACK</th>
                  <th className="r">WRONG TRACK</th>
                  <th className="r">SPREAD</th>
                </tr>
              </thead>
              <tbody>
                {[...RAW_POLLS]
                  .sort((a, b) => (a.endDate < b.endDate ? 1 : -1))
                  .map((p, i) => {
                    const rt  = Number((p.results as any).RightTrack ?? 0);
                    const wt  = Number((p.results as any).WrongTrack  ?? 0);
                    const spread = round1(rt - wt);
                    const spreadDisplay = spread === 0 ? "EVEN" : spread > 0 ? `+${spread.toFixed(1)}` : spread.toFixed(1);
                    const gold = isGoldStandard(p.pollster);
                    const effN = effectiveSampleSize(p.pollster, p.sampleSize);
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${i}`}>
                        <td style={{ color: "rgba(15,16,32,0.85)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span>{p.pollster}</span>
                            {gold && <span className="pap-gold-badge">GOLD</span>}
                          </div>
                        </td>
                        <td className="r">{p.endDate}</td>
                        <td className="r">
                          {p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}
                          {gold && p.sampleSize > 0 && (
                            <span style={{ marginLeft: 6, fontSize: 9, color: "var(--muted3)" }}>
                              (eff {effN.toLocaleString()})
                            </span>
                          )}
                        </td>
                        <td className="r">{p.sampleType}</td>
                        <td className="r" style={{ color: "var(--foreground)" }}>
                          {gold ? `×${GOLD_STANDARD_MULTIPLIER}.00` : "×1.00"}
                        </td>
                        <td className="r pap-rt-col">{rt.toFixed(0)}%</td>
                        <td className="r pap-wt-col">{wt.toFixed(0)}%</td>
                        <td className={`r ${spread > 0 ? "pap-spread-pos" : spread < 0 ? "pap-spread-neg" : ""}`}>
                          {spreadDisplay}
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
            <div style={{ fontFamily: "var(--font-body),monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: "var(--purple-soft)", marginBottom: 6 }}>
              METHODOLOGY
            </div>
            <p style={{ fontFamily: "var(--font-body),monospace", fontSize: 8.5, lineHeight: 1.75, letterSpacing: "0.08em", color: "rgba(240,240,245,0.22)", margin: 0 }}>
              Right Track / Wrong Track averages are computed using a daily weighted model incorporating
              recency decay, square-root sample size adjustment, and screen type (LV/RV/A) weighting.
              Gold Standard pollsters ({GOLD_STANDARD_NAMES.join(", ")}) receive ×{GOLD_STANDARD_MULTIPLIER}²
              effective sample size upweighting. The spread is Right Track minus Wrong Track. Context
              benchmarks based on historical Right Track distributions during midterm election cycles
              since 2006. Source data from RCP aggregate.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── CSS — matches Trump approval design system exactly ───────────────────────
const CSS = `
  body { margin: 0; }

  .pap-root {
    --bg: #f6f7fb;
    --bg2: #ffffff;
    --panel: #ffffff;
    --border: rgba(15, 16, 32, 0.08);
    --border2: rgba(15, 16, 32, 0.14);
    --muted: #6b7088;
    --muted2: #9aa0b4;
    --muted3: #b7bccc;
    --purple:      #7c3aed;
    --purple2:     #9d5cf0;
    --purple-soft: #a78bfa;
  }

  @keyframes pap-fade-up {
    from { opacity:0; transform:translateY(12px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pap-pulse {
    0%,100% { opacity:1; transform:scale(1); }
    50%      { opacity:0.35; transform:scale(0.75); }
  }
  @keyframes pap-bar-in { from { width:0; } }

  .pap-root {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 32px 80px;
    display: flex; flex-direction: column; gap: 20px;
    animation: pap-fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both;
  }

  .pap-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      rgba(37,99,235,0.9)  0%,    rgba(37,99,235,0.9)  33.33%,
      var(--purple)        33.33%, var(--purple)        66.66%,
      rgba(255,0,64,0.85)  66.66%, rgba(255,0,64,0.85)  100%
    );
  }

  .pap-live-dot {
    display: inline-block; width: 6px; height: 6px; border-radius: 50%;
    background: var(--purple); box-shadow: 0 0 8px rgba(124,58,237,0.7);
    animation: pap-pulse 1.8s ease-in-out infinite; flex-shrink: 0;
  }

  .pap-eyebrow {
    display: flex; align-items: center; gap: 8px;
    font-family: var(--font-body), "Geist Mono", monospace;
    font-size: 8px; font-weight: 700; letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--purple-soft); margin-bottom: 12px;
  }
  .pap-eyebrow::before { content:''; display:block; width:16px; height:1px; background:var(--purple-soft); opacity:0.5; }

  .pap-hero {
    border: 1px solid var(--border); background: var(--panel);
    position: relative; overflow: hidden;
  }
  .pap-hero::before {
    content:''; position:absolute; inset:0;
    background:
      radial-gradient(ellipse 45% 100% at 0% 60%,   rgba(37,99,235,0.05)  0%, transparent 65%),
      radial-gradient(ellipse 45% 100% at 100% 60%,  rgba(255,0,64,0.05)  0%, transparent 65%),
      radial-gradient(ellipse 30% 60%  at 50% 0%,    rgba(124,58,237,0.04) 0%, transparent 70%);
    pointer-events: none;
  }
  .pap-hero::after {
    content:''; position:absolute; inset:0;
    background-image: repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px);
    pointer-events: none;
  }
  .pap-hero-inner {
    position: relative; padding: 26px 28px 24px;
    display: grid; grid-template-columns: 1fr auto; align-items: end; gap: 20px;
  }
  @media (max-width: 640px) { .pap-hero-inner { grid-template-columns: 1fr; } }

  .pap-hero-title {
    font-family: "Quantico", system-ui, -apple-system, BlinkMacOSystemFont, "Helvetica Neue", Helvetica, Arial, sans-serif;
    font-size: clamp(22px,3.5vw,46px); font-weight: 900; text-transform: uppercase;
    letter-spacing: 0.02em; line-height: 0.92; color: #fff; margin: 0 0 14px;
  }
  .pap-em-wrong {
    font-style: normal;
    background: linear-gradient(110deg,#ff0040,#f87171);
    -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
  }
  .pap-hero-desc {
    font-family: ui-monospace,monospace; font-size: 9.5px; letter-spacing: 0.12em;
    line-height: 1.75; color: var(--muted2); text-transform: uppercase; max-width: 520px;
  }
  .pap-hero-badge-row { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 16px; }

  .pap-badge {
    display: inline-flex; align-items: center; gap: 5px; padding: 3px 8px;
    border: 1px solid var(--border); background: var(--panel2);
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
  }
  .pap-badge-live   { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-purple { border-color:rgba(124,58,237,0.35); background:rgba(124,58,237,0.07); color:var(--purple-soft); }
  .pap-badge-gold   { border-color:rgba(167,139,250,0.30); background:rgba(124,58,237,0.07); color:var(--purple-soft); }

  .pap-hero-read { display: flex; flex-direction: column; gap: 6px; min-width: 170px; }
  .pap-hero-read-row {
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    padding: 10px 14px; border: 1px solid var(--border); background: var(--panel2);
  }
  .pap-hero-read-label {
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.24em; text-transform: uppercase; color: var(--muted3);
  }
  .pap-hero-read-val {
    font-family: ui-monospace,monospace; font-size: 20px; font-weight: 900; font-variant-numeric: tabular-nums;
  }

  .pap-section-label {
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase; color: var(--muted3);
    display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
  }
  .pap-section-label::before { content:''; width:20px; height:1px; background:var(--purple-soft); opacity:0.5; }
  .pap-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  .pap-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; }
  @media (max-width: 860px) { .pap-kpi-grid { grid-template-columns: repeat(2,1fr); } }
  @media (max-width: 480px) { .pap-kpi-grid { grid-template-columns: 1fr; } }

  .pap-kpi {
    background: var(--panel); border: 1px solid var(--border);
    padding: 16px 18px; position: relative; overflow: hidden; transition: border-color 150ms ease;
  }
  .pap-kpi:hover { border-color: var(--border2); }
  .pap-kpi-accent { position: absolute; top: 0; left: 0; right: 0; height: 2px; }
  .pap-kpi-label { font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: var(--muted3); margin-bottom: 8px; }
  .pap-kpi-val   { font-family: ui-monospace,monospace; font-size: clamp(22px,2.5vw,30px); font-weight: 900; color: #fff; line-height: 1; font-variant-numeric: tabular-nums; }
  .pap-kpi-sub   { font-family: ui-monospace,monospace; font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted3); margin-top: 6px; }
  .pap-kpi-bar { height: 2px; margin-top: 10px; background: rgba(15,16,32,0.08); }
  .pap-kpi-bar-fill { height: 100%; animation: pap-bar-in 800ms cubic-bezier(0.22,1,0.36,1) both; }

  .pap-context-panel {
    background: var(--panel); border: 1px solid var(--border);
    padding: 16px 20px; display: flex; flex-direction: column; gap: 14px;
  }
  .pap-context-benchmarks {
    display: grid; grid-template-columns: repeat(4,1fr); gap: 8px;
    border-top: 1px solid var(--border); padding-top: 14px;
  }
  @media (max-width: 700px) { .pap-context-benchmarks { grid-template-columns: repeat(2,1fr); } }
  .pap-context-item { display: flex; flex-direction: column; gap: 4px; }
  .pap-context-item-label { font-family: ui-monospace,monospace; font-size: 7px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted3); }
  .pap-context-item-val   { font-family: ui-monospace,monospace; font-size: 16px; font-weight: 900; font-variant-numeric: tabular-nums; }

  .pap-table-panel { background: var(--panel); border: 1px solid var(--border); overflow: hidden; }
  .pap-table-head {
    background: var(--bg2); border-bottom: 1px solid var(--border);
    padding: 14px 20px; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  .pap-table-head-title { font-family: ui-monospace,monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--purple-soft); }
  .pap-table-head-note  { font-family: ui-monospace,monospace; font-size: 7.5px; letter-spacing: 0.20em; text-transform: uppercase; color: var(--muted3); }
  .pap-table-scroll { overflow-x: auto; max-height: 520px; overflow-y: auto; }

  table.pap-table { width: 100%; border-collapse: collapse; min-width: 820px; }
  table.pap-table thead { position: sticky; top: 0; background: var(--bg2); z-index: 2; }
  table.pap-table th {
    font-family: ui-monospace,monospace; font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.22em; text-transform: uppercase; color: var(--muted3);
    padding: 10px 16px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap;
  }
  table.pap-table th.r { text-align: right; }
  table.pap-table td {
    font-family: ui-monospace,monospace; font-size: 10.5px; padding: 10px 16px;
    border-bottom: 1px solid rgba(15,16,32,0.05); color: var(--muted);
    vertical-align: middle; font-variant-numeric: tabular-nums;
  }
  table.pap-table td.r { text-align: right; }
  table.pap-table tbody tr:hover { background: rgba(124,58,237,0.04); }
  table.pap-table tbody tr:last-child td { border-bottom: none; }

  .pap-gold-badge {
    display: inline-flex; align-items: center; padding: 1px 6px;
    border: 1px solid rgba(167,139,250,0.28); background: rgba(124,58,237,0.07);
    font-family: ui-monospace,monospace; font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase; color: var(--purple-soft);
  }

  .pap-rt-col      { color: rgba(77,127,212,1)   !important; font-weight: 700; }
  .pap-wt-col      { color: rgba(255,0,64,0.85)  !important; font-weight: 700; }
  .pap-spread-pos  { color: rgba(77,127,212,1)   !important; font-weight: 700; }
  .pap-spread-neg  { color: rgba(255,0,64,0.9)   !important; font-weight: 700; }

  @media (prefers-reduced-motion: reduce) {
    .pap-root { animation: none !important; }
    .pap-live-dot { animation: none !important; }
    .pap-kpi-bar-fill { animation: none !important; }
  }
`;
