"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";

const POLL_MS = 30_000;

// ─── Types ───────────────────────────────────────────────────────────────────

interface CivicCandidate {
  name: string; party: string; color: string;
  votes: number; percent: number; winner: boolean;
}
interface SearchRace {
  id: number; election_name: string; election_date: string;
  country: string; province: string | null; district: string | null;
  percent_reporting: number; candidates: CivicCandidate[];
}
interface HistoryTimestamp { timestamp: string; }
interface HistoryList { id: number; count: number; timestamps: HistoryTimestamp[]; }
interface ForecastResponse {
  forecast: ForecastOutput;
  race: { election_name: string; election_date: string; percent_reporting: number; candidates: CivicCandidate[]; };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, decimals = 1) { return (n * 100).toFixed(decimals) + "%"; }
function fmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function shortDate(ts: string) {
  return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type CKey = (typeof CANDIDATE_KEYS)[number];

// ─── Swing-O-Meter ────────────────────────────────────────────────────────────

function SwingOMeter({
  c1Name, c2Name, c1Color, c2Color,
  c1Prob, c2Prob, reportingPct,
}: {
  c1Name: string; c2Name: string;
  c1Color: string; c2Color: string;
  c1Prob: number; c2Prob: number;
  reportingPct: number;
}) {
  const needleRef = useRef<SVGGElement>(null);

  const total = c1Prob + c2Prob;
  const c1Share = total > 0 ? c1Prob / total : 0.5;
  // angle: -90° = full c1, 0° = tied, +90° = full c2
  const svgRot = (c1Share - 0.5) * 180; // -90 to +90 mapped from 1→0
  // remap: c1Share=1 → -90, c1Share=0 → +90
  const needleRot = 90 - c1Share * 180;

  useEffect(() => {
    const el = needleRef.current;
    if (!el) return;
    el.style.transition = "transform 1.4s cubic-bezier(0.34,1.56,0.64,1)";
    el.style.transform = `rotate(${needleRot}deg)`;
  }, [needleRot]);

  const W = 300, H = 170, CX = W / 2, CY = H - 18;
  const RO = 118, RI = 70;

  function arc(startDeg: number, endDeg: number, ro: number, ri: number) {
    const toRad = (d: number) => (d - 180) * (Math.PI / 180);
    const sx = CX + ro * Math.cos(toRad(startDeg)), sy = CY + ro * Math.sin(toRad(startDeg));
    const ex = CX + ro * Math.cos(toRad(endDeg)),   ey = CY + ro * Math.sin(toRad(endDeg));
    const six = CX + ri * Math.cos(toRad(endDeg)),  siy = CY + ri * Math.sin(toRad(endDeg));
    const eix = CX + ri * Math.cos(toRad(startDeg)), eiy = CY + ri * Math.sin(toRad(startDeg));
    const lg = endDeg - startDeg > 180 ? 1 : 0;
    return `M${sx} ${sy} A${ro} ${ro} 0 ${lg} 1 ${ex} ${ey} L${six} ${siy} A${ri} ${ri} 0 ${lg} 0 ${eix} ${eiy}Z`;
  }

  function pt(deg: number, r: number) {
    const rad = (deg - 180) * (Math.PI / 180);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  const zones = [
    { s: 0,   e: 30,  color: c1Color, alpha: 0.95 },
    { s: 30,  e: 60,  color: c1Color, alpha: 0.65 },
    { s: 60,  e: 80,  color: c1Color, alpha: 0.40 },
    { s: 80,  e: 90,  color: c1Color, alpha: 0.22 },
    { s: 90,  e: 100, color: c2Color, alpha: 0.22 },
    { s: 100, e: 120, color: c2Color, alpha: 0.40 },
    { s: 120, e: 150, color: c2Color, alpha: 0.65 },
    { s: 150, e: 180, color: c2Color, alpha: 0.95 },
  ];

  const ticks = [0, 30, 60, 90, 120, 150, 180];

  const leader = c1Share >= 0.5 ? c1Name : c2Name;
  const leaderColor = c1Share >= 0.5 ? c1Color : c2Color;
  const leaderProb = Math.max(c1Prob, c2Prob);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Name row */}
      <div style={{ display: "flex", justifyContent: "space-between", padding: "0 4px", marginBottom: 4 }}>
        <div style={{ maxWidth: "44%", textAlign: "left" }}>
          <div style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: c1Color + "99", marginBottom: 2 }}>C1</div>
          <div style={{ fontSize: 11, fontFamily: "var(--fcast-mono)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: c1Color, lineHeight: 1.15, wordBreak: "break-word" }}>{c1Name}</div>
        </div>
        <div style={{ maxWidth: "44%", textAlign: "right" }}>
          <div style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: c2Color + "99", marginBottom: 2 }}>C2</div>
          <div style={{ fontSize: 11, fontFamily: "var(--fcast-mono)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.05em", color: c2Color, lineHeight: 1.15, wordBreak: "break-word" }}>{c2Name}</div>
        </div>
      </div>

      {/* SVG meter */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {/* Base arc */}
        <path d={arc(0, 180, RO, RI)} fill="rgba(255,255,255,0.03)" />

        {/* Colored zones */}
        {zones.map((z, i) => (
          <path key={i} d={arc(z.s, z.e, RO, RI)} fill={z.color} opacity={z.alpha * 0.9} />
        ))}

        {/* Center line */}
        <line x1={CX} y1={CY - RO + 4} x2={CX} y2={CY - RI - 4}
          stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

        {/* Tick marks */}
        {ticks.map((deg) => {
          const o = pt(deg, RO + 6), i2 = pt(deg, RO + 1);
          const lp = pt(deg, RO + 14);
          return (
            <g key={deg}>
              <line x1={i2.x} y1={i2.y} x2={o.x} y2={o.y} stroke="rgba(255,255,255,0.20)" strokeWidth="1" />
              <text x={lp.x} y={lp.y + 3} textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.20)" fontFamily="monospace">
                {deg === 90 ? "50" : deg < 90 ? String(100 - Math.round(deg / 90 * 50)) : String(Math.round((deg - 90) / 90 * 50) + 50)}
              </text>
            </g>
          );
        })}

        {/* Pivot shadow */}
        <circle cx={CX} cy={CY} r={15} fill="rgba(0,0,0,0.7)" />
        <circle cx={CX} cy={CY} r={15} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />

        {/* Needle */}
        <g ref={needleRef} style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${needleRot}deg)` }}>
          <line x1={CX} y1={CY + 7} x2={CX} y2={CY - 108} stroke="rgba(0,0,0,0.5)" strokeWidth="4.5" strokeLinecap="round" />
          <line x1={CX} y1={CY + 7} x2={CX} y2={CY - 108} stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" />
          <line x1={CX} y1={CY + 7} x2={CX} y2={CY + 13} stroke="rgba(255,255,255,0.25)" strokeWidth="2" strokeLinecap="round" />
        </g>

        {/* Pivot dot */}
        <circle cx={CX} cy={CY} r={5.5} fill="#fff" />
        <circle cx={CX} cy={CY} r={3}   fill="rgba(0,0,0,0.8)" />

        {/* Central readout */}
        <text x={CX} y={CY - 24} textAnchor="middle" fontSize="20" fontWeight="900" fill={leaderColor} fontFamily="monospace" letterSpacing="-0.5">
          {(leaderProb * 100).toFixed(0)}%
        </text>
        <text x={CX} y={CY - 10} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.35)" fontFamily="monospace" letterSpacing="0.5">
          {leader.split(" ")[0].toUpperCase().slice(0, 8)}
        </text>
      </svg>

      {/* Prob row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", marginTop: 2 }}>
        <div style={{ textAlign: "center", padding: "7px 4px" }}>
          <div style={{ fontSize: 17, fontFamily: "var(--fcast-mono)", fontWeight: 900, color: c1Color, lineHeight: 1 }}>{(c1Prob * 100).toFixed(1)}%</div>
          <div style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginTop: 3 }}>WIN PROB</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.07)" }} />
        <div style={{ textAlign: "center", padding: "7px 4px" }}>
          <div style={{ fontSize: 17, fontFamily: "var(--fcast-mono)", fontWeight: 900, color: c2Color, lineHeight: 1 }}>{(c2Prob * 100).toFixed(1)}%</div>
          <div style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginTop: 3 }}>WIN PROB</div>
        </div>
      </div>

      {/* Reporting bar */}
      <div style={{ marginTop: 8, padding: "0 2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.22)" }}>REPORTING</span>
          <span style={{ fontSize: 7, fontFamily: "var(--fcast-mono)", fontWeight: 700, color: "rgba(255,255,255,0.40)" }}>{reportingPct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.06)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${reportingPct}%`, background: "rgba(255,255,255,0.28)", transition: "width 0.8s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ─── TimelineSlider ────────────────────────────────────────────────────────────

function TimelineSlider({ timestamps, index, onChange }: { timestamps: string[]; index: number; onChange: (i: number) => void; }) {
  if (!timestamps.length) return null;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span className="fcast-note">{shortDate(timestamps[0])}</span>
        <span className="fcast-note">{shortDate(timestamps[timestamps.length - 1])}</span>
      </div>
      <input type="range" min={0} max={timestamps.length - 1} value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "var(--fcast-purple)", height: 4, cursor: "pointer" }} />
      <div style={{ textAlign: "center", marginTop: 5 }} className="fcast-note">
        Snapshot: <strong style={{ color: "rgba(255,255,255,0.75)" }}>{shortDate(timestamps[index])}</strong>
        &nbsp;({index + 1} / {timestamps.length})
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRace[]>([]);
  const [searching, setSearching] = useState(false);

  const [selectedRace, setSelectedRace] = useState<SearchRace | null>(null);
  const [raceRule, setRaceRule] = useState<RaceRule>("PLURALITY");
  const [expectedTurnoverOverride, setExpectedTurnoverOverride] = useState("");

  const [historyList, setHistoryList] = useState<HistoryList | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedRaceRef = useRef<SearchRace | null>(null);
  const historyListRef  = useRef<HistoryList | null>(null);
  const historyIndexRef = useRef(0);
  const raceRuleRef     = useRef<RaceRule>("PLURALITY");
  const turnoutRef      = useRef("");
  const playingRef      = useRef(false);

  useEffect(() => { selectedRaceRef.current = selectedRace; }, [selectedRace]);
  useEffect(() => { historyListRef.current  = historyList;  }, [historyList]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  useEffect(() => { raceRuleRef.current     = raceRule;     }, [raceRule]);
  useEffect(() => { turnoutRef.current      = expectedTurnoverOverride; }, [expectedTurnoverOverride]);
  useEffect(() => { playingRef.current      = playing; }, [playing]);

  const timestamps = useMemo(() => historyList?.timestamps.map((t) => t.timestamp) ?? [], [historyList]);

  // ── Forecast helpers ──────────────────────────────────────────────────────

  async function runForecastLive(raceId: number, rule?: RaceRule, turnout?: string) {
    setLoadingForecast(true); setError(null);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "civic", raceId: String(raceId), race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingForecast(false); }
  }

  async function runForecastAtIndex(raceId: number, tsList: HistoryTimestamp[], idx: number, rule?: RaceRule, turnout?: string) {
    setLoadingForecast(true); setError(null);
    try {
      const timestamp = tsList[idx].timestamp;
      const priorTimestamp = idx > 0 ? tsList[0].timestamp : undefined;
      const res = await fetch("/api/forecast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "civic_history", raceId: String(raceId), timestamp, priorTimestamp, race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingForecast(false); }
  }

  // ── Search ────────────────────────────────────────────────────────────────

  async function doSearch() {
    if (!query && !country) return;
    setSearching(true); setError(null);
    try {
      const params = new URLSearchParams({ action: "search" });
      if (query) params.set("query", query);
      if (country) params.set("country", country);
      params.set("limit", "20");
      const res = await fetch(`/api/forecast?${params}`);
      const data = await res.json();
      setSearchResults(data.races ?? []);
    } catch (e: any) { setError(e.message); }
    finally { setSearching(false); }
  }

  // ── Select race ───────────────────────────────────────────────────────────

  async function selectRace(race: SearchRace) {
    setSelectedRace(race); setForecast(null); setHistoryList(null);
    setHistoryIndex(0); setPlaying(false); setLoadingHistory(true); setError(null);
    try {
      const res = await fetch(`/api/forecast?action=timestamps&raceId=${race.id}`);
      const data: HistoryList = await res.json();
      setHistoryList(data); historyListRef.current = data;
      if (data.timestamps.length > 0) {
        const last = data.timestamps.length - 1;
        setHistoryIndex(last); historyIndexRef.current = last;
        await runForecastAtIndex(race.id, data.timestamps, last);
      } else { await runForecastLive(race.id); }
    } catch (e: any) { setError(e.message); }
    finally { setLoadingHistory(false); }
  }

  // ── Auto-refresh ──────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      const race = selectedRaceRef.current;
      if (!race || playingRef.current) return;
      runForecastLive(race.id);
    }, POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── History scrub ─────────────────────────────────────────────────────────

  async function handleHistoryChange(idx: number) {
    setHistoryIndex(idx); historyIndexRef.current = idx;
    const race = selectedRaceRef.current, hl = historyListRef.current;
    if (!race || !hl) return;
    await runForecastAtIndex(race.id, hl.timestamps, idx);
  }

  // ── Autoplay ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (playing && timestamps.length > 1) {
      playRef.current = setInterval(() => {
        setHistoryIndex((prev) => {
          const next = prev + 1;
          if (next >= timestamps.length) { setPlaying(false); return prev; }
          const race = selectedRaceRef.current, hl = historyListRef.current;
          if (race && hl) runForecastAtIndex(race.id, hl.timestamps, next);
          return next;
        });
      }, 1800);
    } else { if (playRef.current) clearInterval(playRef.current); }
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timestamps.length]);

  // ── Derived display ───────────────────────────────────────────────────────

  const candidateLabels: Record<CKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: names[3] };
  }, [forecast]);

  const candidateColors: Record<CKey, string> = useMemo(() => {
    const colors = forecast?.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"];
    return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: colors[3] };
  }, [forecast]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fcast-root">
      <style>{`
        .fcast-root {
          --fcast-bg:      #07080d;
          --fcast-panel:   #0c0e16;
          --fcast-border:  rgba(255,255,255,0.08);
          --fcast-border2: rgba(255,255,255,0.14);
          --fcast-muted:   rgba(255,255,255,0.35);
          --fcast-muted2:  rgba(255,255,255,0.20);
          --fcast-purple:  #7c3aed;
          --fcast-purple2: #a78bfa;
          --fcast-amber:   #f59e0b;
          --fcast-green:   #10b981;
          --fcast-mono:    'DM Mono', 'Fira Code', 'Courier New', monospace;
          min-height: 100vh;
          background: var(--fcast-bg);
          color: rgba(255,255,255,0.88);
          font-family: var(--fcast-mono);
          padding-bottom: 60px;
        }
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@300;400;500&display=swap');
        .fcast-note { font-size: 8px; letter-spacing: 0.16em; text-transform: uppercase; color: var(--fcast-muted2); font-family: var(--fcast-mono); }
        .fcast-label { font-size: 7.5px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--fcast-muted); font-family: var(--fcast-mono); }
        .fcast-section-title { font-size: 7px; font-weight: 700; letter-spacing: 0.28em; text-transform: uppercase; color: var(--fcast-muted2); margin-bottom: 12px; font-family: var(--fcast-mono); }
        .fcast-stripe { height: 2px; background: linear-gradient(90deg,#e63946 0%,#7c3aed 50%,#2563eb 100%); }

        /* Header */
        .fcast-header {
          background: linear-gradient(135deg, #09091a 0%, #0f0d1f 60%, #0a1020 100%);
          border-bottom: 1px solid var(--fcast-border);
          padding: 18px 28px;
          display: flex; align-items: center; gap: 14px;
        }
        .fcast-logo {
          width: 36px; height: 36px;
          background: linear-gradient(135deg, #7c3aed, #a78bfa);
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; flex-shrink: 0;
        }
        .fcast-header-title { font-size: 17px; font-weight: 800; letter-spacing: -0.3px; color: #fff; }
        .fcast-header-sub { font-size: 9px; color: var(--fcast-muted2); margin-top: 3px; letter-spacing: 0.14em; text-transform: uppercase; }

        /* Layout */
        .fcast-body {
          display: grid;
          grid-template-columns: 320px 1fr;
          gap: 0;
          max-width: 1240px;
          margin: 0 auto;
          padding: 24px 28px;
        }
        @media (max-width: 860px) { .fcast-body { grid-template-columns: 1fr; padding: 16px; } }

        /* Sidebar */
        .fcast-sidebar { padding-right: 20px; display: flex; flex-direction: column; gap: 16px; }

        /* Panel */
        .fcast-panel {
          background: var(--fcast-panel);
          border: 1px solid var(--fcast-border);
          overflow: hidden;
        }
        .fcast-panel-header {
          padding: 10px 14px;
          border-bottom: 1px solid var(--fcast-border);
          background: rgba(255,255,255,0.02);
          display: flex; align-items: center; justify-content: space-between;
        }
        .fcast-panel-tag { font-size: 7.5px; font-weight: 700; letter-spacing: 0.26em; text-transform: uppercase; color: var(--fcast-purple2); }
        .fcast-panel-body { padding: 14px; }

        /* Inputs */
        .fcast-input {
          width: 100%; background: rgba(255,255,255,0.03); border: 1px solid var(--fcast-border);
          color: rgba(255,255,255,0.85); padding: 9px 11px; font-size: 10px;
          font-family: var(--fcast-mono); outline: none; letter-spacing: 0.08em;
          transition: border-color 120ms ease; box-sizing: border-box;
        }
        .fcast-input:focus { border-color: rgba(124,58,237,0.45); }
        .fcast-input::placeholder { color: var(--fcast-muted2); }

        /* Buttons */
        .fcast-btn {
          padding: 9px 16px; border: none;
          font-family: var(--fcast-mono); font-size: 9px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase; cursor: pointer;
          transition: all 130ms ease;
        }
        .fcast-btn-primary { background: var(--fcast-purple); color: #fff; }
        .fcast-btn-primary:hover { background: #6d28d9; }
        .fcast-btn-green { background: var(--fcast-green); color: #fff; }
        .fcast-btn-green:hover { background: #059669; }
        .fcast-btn-ghost {
          background: transparent; border: 1px solid var(--fcast-border); color: var(--fcast-muted);
        }
        .fcast-btn-ghost:hover { border-color: var(--fcast-border2); color: rgba(255,255,255,0.75); }
        .fcast-btn-stop { background: #dc2626; color: #fff; }
        .fcast-btn-stop:hover { background: #b91c1c; }

        /* Race list items */
        .fcast-race-item {
          padding: 10px 12px; border: 1px solid var(--fcast-border);
          background: transparent; cursor: pointer; margin-bottom: 5px;
          transition: all 130ms ease; width: 100%; text-align: left;
          position: relative; overflow: hidden;
        }
        .fcast-race-item::before {
          content: ''; position: absolute; top: 0; left: 0; bottom: 0; width: 2px;
          background: var(--fcast-purple); transform: scaleY(0); transform-origin: top; transition: transform 180ms ease;
        }
        .fcast-race-item:hover { background: rgba(255,255,255,0.02); border-color: var(--fcast-border2); }
        .fcast-race-item:hover::before, .fcast-race-item.active::before { transform: scaleY(1); }
        .fcast-race-item.active { background: rgba(124,58,237,0.07); border-color: rgba(124,58,237,0.35); }

        /* Badge */
        .fcast-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 2px 7px; font-size: 7px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          border: 1px solid var(--fcast-border); background: rgba(255,255,255,0.03); color: var(--fcast-muted);
          font-family: var(--fcast-mono);
        }
        .fcast-badge-purple { border-color: rgba(124,58,237,0.40); background: rgba(124,58,237,0.08); color: var(--fcast-purple2); }
        .fcast-badge-amber  { border-color: rgba(245,158,11,0.35);  background: rgba(245,158,11,0.07);  color: #fbbf24; }
        .fcast-badge-green  { border-color: rgba(16,185,129,0.35);  background: rgba(16,185,129,0.07);  color: #34d399; }

        /* Divider */
        .fcast-divider { height: 1px; background: var(--fcast-border); margin: 12px 0; }

        /* Stat row */
        .fcast-stat-row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; border-bottom: 1px solid rgba(255,255,255,0.04); }
        .fcast-stat-val { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.80); font-family: var(--fcast-mono); }

        /* Candidate vote share card */
        .fcast-cand-card {
          padding: 10px 12px; border: 1px solid var(--fcast-border);
          background: rgba(255,255,255,0.02); position: relative;
          display: flex; flex-direction: column; gap: 3px;
        }
        .fcast-cand-card.leader { border-color: var(--leader-color, rgba(255,255,255,0.2)) !important; }
        .fcast-cand-share { font-size: clamp(20px,2vw,26px); font-weight: 900; line-height: 1; font-family: var(--fcast-mono); }
        .fcast-cand-votes { font-size: 9px; letter-spacing: 0.10em; color: var(--fcast-muted2); font-family: var(--fcast-mono); }

        /* Prob bar */
        .fcast-prob-bar { margin-bottom: 8px; }
        .fcast-prob-bar-track { height: 3px; background: rgba(255,255,255,0.06); overflow: hidden; margin-top: 3px; }
        .fcast-prob-bar-fill { height: 100%; transition: width 0.6s cubic-bezier(.4,0,.2,1); }

        /* Error */
        .fcast-error { background: rgba(220,38,38,0.08); border: 1px solid rgba(220,38,38,0.25); color: #fca5a5; padding: 10px 14px; font-size: 10px; letter-spacing: 0.10em; margin-bottom: 14px; }

        /* Scrollbar */
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
        *::-webkit-scrollbar { width: 3px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        select option { background: #0c0e16; }
        input[type=range] { height: 4px; cursor: pointer; }
      `}</style>

      <div className="fcast-stripe" />

      {/* Header */}
      <div className="fcast-header">
        <div className="fcast-logo">📊</div>
        <div>
          <div className="fcast-header-title">Election Forecast Engine</div>
          <div className="fcast-header-sub">
            CivicAPI · Live Results · Historical Playback · Bayesian Model
            {selectedRace && <span style={{ color: "var(--fcast-purple2)", marginLeft: 10 }}>· AUTO-REFRESH / 30s</span>}
          </div>
        </div>
      </div>

      <div className="fcast-body">

        {/* ── SIDEBAR ── */}
        <div className="fcast-sidebar">

          {/* Search */}
          <div className="fcast-panel">
            <div className="fcast-panel-header">
              <span className="fcast-panel-tag">Search Races</span>
            </div>
            <div className="fcast-panel-body" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <input className="fcast-input" placeholder="Election name…" value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()} />
              <input className="fcast-input" placeholder="Country (e.g. US, FR)" value={country}
                onChange={(e) => setCountry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && doSearch()} />
              <button className="fcast-btn fcast-btn-primary" onClick={doSearch} disabled={searching} style={{ width: "100%" }}>
                {searching ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div className="fcast-panel">
              <div className="fcast-panel-header">
                <span className="fcast-panel-tag">Results</span>
                <span className="fcast-note">{searchResults.length}</span>
              </div>
              <div className="fcast-panel-body" style={{ maxHeight: 320, overflowY: "auto", padding: "8px" }}>
                {searchResults.map((r) => (
                  <button key={r.id} className={`fcast-race-item ${selectedRace?.id === r.id ? "active" : ""}`} onClick={() => selectRace(r)}>
                    <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 3, color: "rgba(255,255,255,0.9)" }}>{r.election_name}</div>
                    <div className="fcast-note">{r.country}{r.province ? ` · ${r.province}` : ""} · {new Date(r.election_date).toLocaleDateString()}</div>
                    <div className="fcast-note" style={{ marginTop: 2, color: "rgba(255,255,255,0.35)" }}>{r.percent_reporting}% reporting</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Model options */}
          {selectedRace && (
            <div className="fcast-panel">
              <div className="fcast-panel-header">
                <span className="fcast-panel-tag">Model Options</span>
              </div>
              <div className="fcast-panel-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div>
                  <div className="fcast-note" style={{ marginBottom: 5 }}>Race Rule</div>
                  <select value={raceRule} onChange={(e) => setRaceRule(e.target.value as RaceRule)}
                    className="fcast-input" style={{ padding: "8px 10px" }}>
                    <option value="PLURALITY">Plurality</option>
                    <option value="MAJORITY">Majority / Runoff</option>
                  </select>
                </div>
                <div>
                  <div className="fcast-note" style={{ marginBottom: 5 }}>Expected Turnout Override</div>
                  <input type="number" placeholder="e.g. 5000000" value={expectedTurnoverOverride}
                    onChange={(e) => setExpectedTurnoverOverride(e.target.value)} className="fcast-input" />
                </div>
                <button
                  className="fcast-btn fcast-btn-green"
                  style={{ width: "100%" }}
                  disabled={loadingForecast}
                  onClick={() => {
                    if (!selectedRace) return;
                    if (timestamps.length > 0 && historyList) runForecastAtIndex(selectedRace.id, historyList.timestamps, historyIndex);
                    else runForecastLive(selectedRace.id);
                  }}
                >
                  {loadingForecast ? "Running…" : "Rerun Forecast"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── MAIN ── */}
        <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

          {error && <div className="fcast-error">⚠ {error}</div>}

          {!selectedRace && !searchResults.length && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "rgba(255,255,255,0.15)" }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>🗳️</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "rgba(255,255,255,0.30)" }}>Search for an election to get started</div>
              <div className="fcast-note" style={{ marginTop: 8 }}>Use the search panel on the left</div>
            </div>
          )}

          {(loadingHistory || loadingForecast) && !forecast && (
            <div className="fcast-panel">
              <div style={{ padding: "52px 0", textAlign: "center" }}>
                <div className="fcast-note" style={{ color: "var(--fcast-purple2)", marginBottom: 10 }}>
                  {loadingHistory ? "Loading race history…" : "Running forecast model…"}
                </div>
                <div style={{ height: 3, background: "rgba(255,255,255,0.06)", width: "60%", margin: "0 auto", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "55%", background: "var(--fcast-purple)", animation: "fcast-pulse 1.2s ease-in-out infinite" }} />
                </div>
              </div>
            </div>
          )}

          {forecast && selectedRace && (
            <>
              {/* Race info + playback */}
              <div className="fcast-panel">
                <div className="fcast-stripe" style={{ height: 2 }} />
                <div style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginBottom: 5, lineHeight: 1.2 }}>{forecast.race.election_name}</div>
                      <div className="fcast-note">
                        {new Date(forecast.race.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                        &nbsp;·&nbsp;{forecast.race.percent_reporting}% reporting
                        {loadingForecast && <span style={{ color: "var(--fcast-purple2)", marginLeft: 8 }}>↻ updating…</span>}
                      </div>
                    </div>
                    <span className={`fcast-badge ${forecast.forecast.mode_trigger === "RUNOFF" ? "fcast-badge-amber" : "fcast-badge-purple"}`}>
                      {forecast.forecast.mode_trigger}
                    </span>
                  </div>

                  {timestamps.length > 1 && (
                    <>
                      <div className="fcast-divider" />
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <span className="fcast-label">Historical Playback</span>
                        <button
                          className={`fcast-btn ${playing ? "fcast-btn-stop" : "fcast-btn-ghost"}`}
                          style={{ padding: "6px 14px", fontSize: "8px" }}
                          onClick={() => {
                            if (playing) { setPlaying(false); return; }
                            if (historyIndex >= timestamps.length - 1) setHistoryIndex(0);
                            setPlaying(true);
                          }}
                        >
                          {playing ? "⏹ Stop" : "▶ Play"}
                        </button>
                      </div>
                      <TimelineSlider timestamps={timestamps} index={historyIndex} onChange={handleHistoryChange} />
                    </>
                  )}

                  {timestamps.length === 0 && (
                    <div className="fcast-note" style={{ marginTop: 10, fontStyle: "italic" }}>
                      No history snapshots — live forecast auto-refreshes every 30s
                    </div>
                  )}
                </div>
              </div>

              {/* Vote share grid */}
              <div className="fcast-panel">
                <div className="fcast-panel-header">
                  <span className="fcast-panel-tag">Projected Vote Share</span>
                  <span className="fcast-note">{forecast.race.percent_reporting}% reporting</span>
                </div>
                <div style={{ padding: "12px", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  {(["Candidate1", "Candidate2", "Candidate3"] as const).map((key) => {
                    const color = candidateColors[key];
                    const share = forecast.forecast.modeled_share[key];
                    const votes = forecast.forecast.modeled_votes[key];
                    const isLeader = forecast.forecast.leader === key;
                    return (
                      <div key={key} className={`fcast-cand-card ${isLeader ? "leader" : ""}`}
                        style={{ "--leader-color": color + "55" } as any}>
                        {isLeader && (
                          <div style={{ position: "absolute", top: 6, right: 8, fontSize: 7, color, fontWeight: 700, fontFamily: "var(--fcast-mono)", letterSpacing: "0.14em" }}>LEADER</div>
                        )}
                        <div className="fcast-note" style={{ marginBottom: 2 }}>{candidateLabels[key]}</div>
                        <div className="fcast-cand-share" style={{ color }}>{pct(share)}</div>
                        <div className="fcast-cand-votes">{fmt(votes)} proj.</div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── SWING-O-METER ── */}
              <div className="fcast-panel">
                <div className="fcast-panel-header">
                  <span className="fcast-panel-tag">
                    {raceRule === "PLURALITY" ? "Win Probability · Most Votes" : "Majority Win Probability · ≥50%"}
                  </span>
                </div>
                <div style={{ padding: "14px 16px" }}>
                  <SwingOMeter
                    c1Name={candidateLabels["Candidate1"]}
                    c2Name={candidateLabels["Candidate2"]}
                    c1Color={candidateColors["Candidate1"]}
                    c2Color={candidateColors["Candidate2"]}
                    c1Prob={raceRule === "PLURALITY"
                      ? forecast.forecast.plurality_odds_to_win["Candidate1"]
                      : forecast.forecast.majority_win_prob["Candidate1"]}
                    c2Prob={raceRule === "PLURALITY"
                      ? forecast.forecast.plurality_odds_to_win["Candidate2"]
                      : forecast.forecast.majority_win_prob["Candidate2"]}
                    reportingPct={forecast.race.percent_reporting}
                  />

                  {/* Third candidate if significant */}
                  {(() => {
                    const c3Prob = raceRule === "PLURALITY"
                      ? forecast.forecast.plurality_odds_to_win["Candidate3"]
                      : forecast.forecast.majority_win_prob["Candidate3"];
                    if (c3Prob < 0.005) return null;
                    return (
                      <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid var(--fcast-border)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 7, height: 7, borderRadius: "50%", background: candidateColors["Candidate3"], display: "inline-block" }} />
                          <span className="fcast-note" style={{ color: "rgba(255,255,255,0.55)" }}>{candidateLabels["Candidate3"]}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: candidateColors["Candidate3"], fontFamily: "var(--fcast-mono)" }}>{pct(c3Prob)}</span>
                      </div>
                    );
                  })()}

                  {raceRule === "MAJORITY" && (
                    <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid rgba(245,158,11,0.2)", background: "rgba(245,158,11,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span className="fcast-note" style={{ color: "rgba(245,158,11,0.6)" }}>Runoff needed</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fbbf24", fontFamily: "var(--fcast-mono)" }}>{pct(forecast.forecast.runoff_needed_prob)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Runoff advance + stats */}
              <div style={{ display: "grid", gridTemplateColumns: forecast.forecast.race_rule === "MAJORITY" ? "1fr 1fr" : "1fr", gap: 12 }}>
                {forecast.forecast.race_rule === "MAJORITY" && (
                  <div className="fcast-panel">
                    <div className="fcast-panel-header">
                      <span className="fcast-panel-tag">Runoff Advance Probability</span>
                    </div>
                    <div className="fcast-panel-body" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                      {CANDIDATE_KEYS.map((k) => (
                        <div key={k} className="fcast-prob-bar">
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span className="fcast-note">{candidateLabels[k]}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: candidateColors[k], fontFamily: "var(--fcast-mono)" }}>{pct(forecast.forecast.runoff_prob[k])}</span>
                          </div>
                          <div className="fcast-prob-bar-track">
                            <div className="fcast-prob-bar-fill" style={{ width: pct(Math.min(forecast.forecast.runoff_prob[k], 1)), background: candidateColors[k] }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="fcast-panel">
                  <div className="fcast-panel-header">
                    <span className="fcast-panel-tag">Model Statistics</span>
                  </div>
                  <div className="fcast-panel-body" style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                    {[
                      ["Modeled total vote",    fmt(forecast.forecast.modeled_total_vote)],
                      ["Votes remaining",       fmt(forecast.forecast.modeled_vote_remaining)],
                      ["% Reporting (modeled)", pct(forecast.forecast.modeled_percent_reporting)],
                      ["Std dev (race)",        fmt(forecast.forecast.sd_race)],
                      ["Leader",                candidateLabels[forecast.forecast.leader]],
                      ["Runner-up",             candidateLabels[forecast.forecast.runner_up]],
                      ["Projected margin",      `${fmt(forecast.forecast.projected_margin_votes)} (${pct(forecast.forecast.projected_margin_pct)})`],
                    ].map(([label, value]) => (
                      <div key={label} className="fcast-stat-row">
                        <span className="fcast-note">{label}</span>
                        <span className="fcast-stat-val">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes fcast-pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }
      `}</style>
    </div>
  );
}