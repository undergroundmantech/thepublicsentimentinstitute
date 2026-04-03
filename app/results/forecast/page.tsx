"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";

const POLL_MS = 30_000;

// ─── Types ───────────────────────────────────────────────────────────────────
interface CivicCandidate { name: string; party: string; color: string; votes: number; percent: number; winner: boolean; }
interface SearchRace { id: number; election_name: string; election_date: string; country: string; province: string | null; district: string | null; percent_reporting: number; candidates: CivicCandidate[]; }
interface HistoryTimestamp { timestamp: string; }
interface HistoryList { id: number; count: number; timestamps: HistoryTimestamp[]; }
interface ForecastResponse {
  forecast: ForecastOutput;
  race: { election_name: string; election_date: string; percent_reporting: number; candidates: CivicCandidate[]; };
}

function pct(n: number, decimals = 1) { return (n * 100).toFixed(decimals) + "%"; }
function fmt(n: number) { return n.toLocaleString("en-US", { maximumFractionDigits: 0 }); }
function shortDate(ts: string) { return new Date(ts).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }

const CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type CKey = (typeof CANDIDATE_KEYS)[number];

// ─── Swing-O-Meter ────────────────────────────────────────────────────────────
function SwingOMeter({ c1Name, c2Name, c1Color, c2Color, c1Prob, c2Prob, reportingPct }: {
  c1Name: string; c2Name: string; c1Color: string; c2Color: string;
  c1Prob: number; c2Prob: number; reportingPct: number;
}) {
  const needleRef = useRef<SVGGElement>(null);
  const total = c1Prob + c2Prob;
  const c1Share = total > 0 ? c1Prob / total : 0.5;
  const needleRot = 90 - c1Share * 180;

  useEffect(() => {
    const el = needleRef.current; if (!el) return;
    el.style.transition = "transform 1.4s cubic-bezier(0.34,1.56,0.64,1)";
    el.style.transform = `rotate(${needleRot}deg)`;
  }, [needleRot]);

  const W = 300, H = 164, CX = W / 2, CY = H - 18;
  const RO = 114, RI = 66;

  function arc(startDeg: number, endDeg: number, ro: number, ri: number) {
    const toRad = (d: number) => (d - 180) * (Math.PI / 180);
    const sx = CX + ro * Math.cos(toRad(startDeg)), sy = CY + ro * Math.sin(toRad(startDeg));
    const ex = CX + ro * Math.cos(toRad(endDeg)), ey = CY + ro * Math.sin(toRad(endDeg));
    const six = CX + ri * Math.cos(toRad(endDeg)), siy = CY + ri * Math.sin(toRad(endDeg));
    const eix = CX + ri * Math.cos(toRad(startDeg)), eiy = CY + ri * Math.sin(toRad(startDeg));
    const lg = endDeg - startDeg > 180 ? 1 : 0;
    return `M${sx} ${sy} A${ro} ${ro} 0 ${lg} 1 ${ex} ${ey} L${six} ${siy} A${ri} ${ri} 0 ${lg} 0 ${eix} ${eiy}Z`;
  }

  function pt(deg: number, r: number) {
    const rad = (deg - 180) * (Math.PI / 180);
    return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
  }

  const zones = [
    { s: 0, e: 30, color: c1Color, alpha: 0.9 }, { s: 30, e: 60, color: c1Color, alpha: 0.6 },
    { s: 60, e: 80, color: c1Color, alpha: 0.35 }, { s: 80, e: 90, color: c1Color, alpha: 0.18 },
    { s: 90, e: 100, color: c2Color, alpha: 0.18 }, { s: 100, e: 120, color: c2Color, alpha: 0.35 },
    { s: 120, e: 150, color: c2Color, alpha: 0.6 }, { s: 150, e: 180, color: c2Color, alpha: 0.9 },
  ];

  const leader = c1Share >= 0.5 ? c1Name : c2Name;
  const leaderColor = c1Share >= 0.5 ? c1Color : c2Color;
  const leaderProb = Math.max(c1Prob, c2Prob);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: `${c1Color}80`, marginBottom: 2 }}>C1</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: c1Color, letterSpacing: "0.04em", maxWidth: 100, wordBreak: "break-word" }}>{c1Name}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: `${c2Color}80`, marginBottom: 2 }}>C2</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: c2Color, letterSpacing: "0.04em", maxWidth: 100, wordBreak: "break-word", textAlign: "right" }}>{c2Name}</div>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        <path d={arc(0, 180, RO, RI)} fill="rgba(255,255,255,0.03)" />
        {zones.map((z, i) => <path key={i} d={arc(z.s, z.e, RO, RI)} fill={z.color} opacity={z.alpha} />)}
        <line x1={CX} y1={CY - RO + 5} x2={CX} y2={CY - RI - 5} stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
        {[0, 45, 90, 135, 180].map((deg) => {
          const o = pt(deg, RO + 5), i2 = pt(deg, RO + 1);
          return <line key={deg} x1={i2.x} y1={i2.y} x2={o.x} y2={o.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />;
        })}
        <circle cx={CX} cy={CY} r={14} fill="#0a0a08" />
        <circle cx={CX} cy={CY} r={14} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
        <g ref={needleRef} style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${needleRot}deg)` }}>
          <line x1={CX} y1={CY + 6} x2={CX} y2={CY - 104} stroke="rgba(0,0,0,0.6)" strokeWidth="4" strokeLinecap="round" />
          <line x1={CX} y1={CY + 6} x2={CX} y2={CY - 104} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx={CX} cy={CY} r={5} fill="#c5a55a" />
        <circle cx={CX} cy={CY} r={2.5} fill="#0a0a08" />
        <text x={CX} y={CY - 22} textAnchor="middle" fontSize="19" fontWeight="900" fill={leaderColor} fontFamily="'Bebas Neue', sans-serif" letterSpacing="1">
          {(leaderProb * 100).toFixed(0)}%
        </text>
        <text x={CX} y={CY - 9} textAnchor="middle" fontSize="6" fill="rgba(255,255,255,0.3)" fontFamily="'DM Mono', monospace" letterSpacing="0.5">
          {leader.split(" ")[0].toUpperCase().slice(0, 10)}
        </text>
      </svg>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1px 1fr", marginTop: 4 }}>
        {[{ prob: c1Prob, color: c1Color }, null, { prob: c2Prob, color: c2Color }].map((item, i) => (
          item === null
            ? <div key={i} style={{ background: "rgba(255,255,255,0.06)" }} />
            : <div key={i} style={{ textAlign: i === 0 ? "center" : "center", padding: "8px 4px" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: item.color, lineHeight: 1 }}>{(item.prob * 100).toFixed(1)}%</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginTop: 2 }}>Win Prob</div>
              </div>
        ))}
      </div>

      <div style={{ marginTop: 10, padding: "0 2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>Reporting</span>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, color: "rgba(255,255,255,0.35)" }}>{reportingPct.toFixed(1)}%</span>
        </div>
        <div style={{ height: 2, background: "rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${reportingPct}%`, background: "rgba(197,165,90,0.5)", transition: "width 0.8s ease" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ForecastEnginePage() {
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
  const historyListRef = useRef<HistoryList | null>(null);
  const historyIndexRef = useRef(0);
  const raceRuleRef = useRef<RaceRule>("PLURALITY");
  const turnoutRef = useRef("");
  const playingRef = useRef(false);

  useEffect(() => { selectedRaceRef.current = selectedRace; }, [selectedRace]);
  useEffect(() => { historyListRef.current = historyList; }, [historyList]);
  useEffect(() => { historyIndexRef.current = historyIndex; }, [historyIndex]);
  useEffect(() => { raceRuleRef.current = raceRule; }, [raceRule]);
  useEffect(() => { turnoutRef.current = expectedTurnoverOverride; }, [expectedTurnoverOverride]);
  useEffect(() => { playingRef.current = playing; }, [playing]);

  const timestamps = useMemo(() => historyList?.timestamps.map((t) => t.timestamp) ?? [], [historyList]);

  async function runForecastLive(raceId: number, rule?: RaceRule, turnout?: string) {
    setLoadingForecast(true); setError(null);
    try {
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "civic", raceId: String(raceId), race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined }) });
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
      const res = await fetch("/api/forecast", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "civic_history", raceId: String(raceId), timestamp, priorTimestamp, race_rule: rule ?? raceRuleRef.current, expected_turnout: (turnout ?? turnoutRef.current) ? Number(turnout ?? turnoutRef.current) : undefined }) });
      const data = await res.json();
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) { setError(e.message); }
    finally { setLoadingForecast(false); }
  }

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

  useEffect(() => {
    const interval = setInterval(() => { const race = selectedRaceRef.current; if (!race || playingRef.current) return; runForecastLive(race.id); }, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  async function handleHistoryChange(idx: number) {
    setHistoryIndex(idx); historyIndexRef.current = idx;
    const race = selectedRaceRef.current, hl = historyListRef.current;
    if (!race || !hl) return;
    await runForecastAtIndex(race.id, hl.timestamps, idx);
  }

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
  }, [playing, timestamps.length]);

  const candidateLabels: Record<CKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: names[3] };
  }, [forecast]);

  const candidateColors: Record<CKey, string> = useMemo(() => {
    const colors = forecast?.forecast.candidate_colors ?? ["#5b8fd4", "#d45b5b", "#c5a55a", "rgba(255,255,255,0.3)"];
    return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: colors[3] };
  }, [forecast]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        body { background: #0a0a08 !important; }
        @keyframes fcast-load { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes fcast-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
        * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.08) transparent; }
        *::-webkit-scrollbar { width: 3px; }
        *::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); }
        .fcast-input {
          width: 100%; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.75); padding: 9px 11px; font-size: 10px;
          font-family: 'DM Mono', monospace; outline: none; letter-spacing: 0.06em;
          transition: border-color 120ms ease; box-sizing: border-box;
        }
        .fcast-input:focus { border-color: rgba(197,165,90,0.4); }
        .fcast-input::placeholder { color: rgba(255,255,255,0.2); }
        .fcast-race-item {
          display: flex; align-items: flex-start; width: 100%;
          padding: 10px 14px; background: transparent;
          border: none; border-bottom: 1px solid rgba(255,255,255,0.04);
          cursor: pointer; text-align: left; transition: background 80ms ease;
        }
        .fcast-race-item:hover { background: rgba(255,255,255,0.03); }
        .fcast-race-item.active { background: rgba(197,165,90,0.06); border-left: 2px solid #c5a55a; }
        input[type=range] { height: 3px; cursor: pointer; accent-color: #c5a55a; }
      `}</style>

      <div style={{ background: "#0a0a08", minHeight: "100vh", fontFamily: "'DM Mono', monospace" }}>

        {/* ── HERO HEADER ── */}
        <div style={{ background: "#0f0f0d", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ maxWidth: 1280, margin: "0 auto", padding: "28px 32px 24px" }}>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "#c5a55a", marginBottom: 10 }}>National Polling Index · Forecast Engine</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: "clamp(36px, 5vw, 64px)", letterSpacing: "0.04em", color: "#fff", lineHeight: 0.95, marginBottom: 14 }}>
              Election<br />
              <span style={{ color: "#5b8fd4" }}>Forecast</span>{" "}
              <span style={{ color: "#d45b5b" }}>Engine</span>
            </div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 1.8, maxWidth: 480, letterSpacing: "0.03em" }}>
              Live results · Historical playback · Bayesian modeling.
              Search any CivicAPI race globally and run probabilistic forecasts.
            </div>
            {selectedRace && (
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#c5a55a", animation: "fcast-pulse 1.8s ease-in-out infinite", display: "inline-block" }} />
                Auto-refresh · 30s
              </div>
            )}
          </div>
        </div>

        {/* ── BODY ── */}
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "20px 32px", display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>

          {/* ── SIDEBAR ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Search panel */}
            <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)" }}>
              <div style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Search Races</span>
              </div>
              <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 8 }}>
                <input className="fcast-input" placeholder="Election name…" value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()} />
                <input className="fcast-input" placeholder="Country (e.g. US, FR)" value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && doSearch()} />
                <button onClick={doSearch} disabled={searching}
                  style={{ padding: "9px 16px", background: searching ? "rgba(255,255,255,0.05)" : "#c5a55a", color: searching ? "rgba(255,255,255,0.3)" : "#0a0a08", border: "none", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", cursor: "pointer", width: "100%", transition: "background 120ms" }}>
                  {searching ? "Searching…" : "Search →"}
                </button>
              </div>
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Results</span>
                  <span style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.08em" }}>{searchResults.length}</span>
                </div>
                <div style={{ maxHeight: 300, overflowY: "auto" }}>
                  {searchResults.map((r) => (
                    <button key={r.id} className={`fcast-race-item ${selectedRace?.id === r.id ? "active" : ""}`} onClick={() => selectRace(r)}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: selectedRace?.id === r.id ? 700 : 400, color: selectedRace?.id === r.id ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.5)", marginBottom: 4, lineHeight: 1.4, letterSpacing: "0.02em" }}>{r.election_name}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em" }}>{r.country}{r.province ? ` · ${r.province}` : ""} · {new Date(r.election_date).toLocaleDateString()}</div>
                        <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em", marginTop: 2 }}>{r.percent_reporting}% reporting</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Model options */}
            {selectedRace && (
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ padding: "11px 14px", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)" }}>Model Options</span>
                </div>
                <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Race Rule</div>
                    <select value={raceRule} onChange={(e) => setRaceRule(e.target.value as RaceRule)} className="fcast-input" style={{ padding: "8px 10px" }}>
                      <option value="PLURALITY">Plurality</option>
                      <option value="MAJORITY">Majority / Runoff</option>
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>Expected Turnout</div>
                    <input type="number" placeholder="e.g. 5000000" value={expectedTurnoverOverride} onChange={(e) => setExpectedTurnoverOverride(e.target.value)} className="fcast-input" />
                  </div>
                  <button disabled={loadingForecast}
                    onClick={() => {
                      if (!selectedRace) return;
                      if (timestamps.length > 0 && historyList) runForecastAtIndex(selectedRace.id, historyList.timestamps, historyIndex);
                      else runForecastLive(selectedRace.id);
                    }}
                    style={{ padding: "9px 16px", background: loadingForecast ? "rgba(255,255,255,0.04)" : "rgba(91,143,212,0.15)", color: loadingForecast ? "rgba(255,255,255,0.2)" : "#5b8fd4", border: "1px solid rgba(91,143,212,0.25)", fontFamily: "'DM Mono', monospace", fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer", width: "100%" }}>
                    {loadingForecast ? "Running…" : "Rerun Forecast →"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── MAIN ── */}
          <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>

            {error && (
              <div style={{ background: "rgba(212,91,91,0.06)", border: "1px solid rgba(212,91,91,0.2)", padding: "10px 14px", fontSize: 10, color: "#d45b5b", letterSpacing: "0.06em", fontFamily: "'DM Mono', monospace" }}>
                ⚠ {error}
              </div>
            )}

            {!selectedRace && !searchResults.length && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, textAlign: "center" }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 80, color: "rgba(255,255,255,0.04)", letterSpacing: "0.1em", lineHeight: 1, marginBottom: 20 }}>FORECAST</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "rgba(255,255,255,0.2)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Search for an election to begin</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.12)", letterSpacing: "0.1em" }}>Use the search panel on the left</div>
              </div>
            )}

            {(loadingHistory || loadingForecast) && !forecast && (
              <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
                  {loadingHistory ? "Loading race history…" : "Running forecast model…"}
                </div>
                <div style={{ height: 2, background: "rgba(255,255,255,0.05)", width: 120, margin: "0 auto", overflow: "hidden" }}>
                  <div style={{ height: "100%", width: "60%", background: "#c5a55a", animation: "fcast-load 1.4s ease-in-out infinite" }} />
                </div>
              </div>
            )}

            {forecast && selectedRace && (
              <>
                {/* Race info + playback */}
                <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: 2, background: "linear-gradient(90deg, #5b8fd4 50%, #d45b5b 50%)" }} />
                  <div style={{ padding: "18px 20px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                      <div>
                        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "0.04em", color: "#fff", lineHeight: 1, marginBottom: 6 }}>{forecast.race.election_name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.08em" }}>{new Date(forecast.race.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>{forecast.race.percent_reporting}% reporting</span>
                          {loadingForecast && <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "#c5a55a", letterSpacing: "0.1em" }}>↻ updating…</span>}
                        </div>
                      </div>
                      <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", padding: "4px 10px", background: forecast.forecast.mode_trigger === "RUNOFF" ? "rgba(212,91,91,0.12)" : "rgba(91,143,212,0.12)", border: `1px solid ${forecast.forecast.mode_trigger === "RUNOFF" ? "rgba(212,91,91,0.3)" : "rgba(91,143,212,0.3)"}`, color: forecast.forecast.mode_trigger === "RUNOFF" ? "#d45b5b" : "#5b8fd4", flexShrink: 0 }}>
                        {forecast.forecast.mode_trigger}
                      </span>
                    </div>

                    {timestamps.length > 1 && (
                      <>
                        <div style={{ height: 1, background: "rgba(255,255,255,0.05)", marginBottom: 14 }} />
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)" }}>Historical Playback</span>
                          <button onClick={() => { if (playing) { setPlaying(false); return; } if (historyIndex >= timestamps.length - 1) setHistoryIndex(0); setPlaying(true); }}
                            style={{ padding: "5px 14px", background: playing ? "rgba(212,91,91,0.12)" : "rgba(197,165,90,0.1)", color: playing ? "#d45b5b" : "#c5a55a", border: `1px solid ${playing ? "rgba(212,91,91,0.25)" : "rgba(197,165,90,0.25)"}`, fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: "pointer" }}>
                            {playing ? "⏹ Stop" : "▶ Play"}
                          </button>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{shortDate(timestamps[0])}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)" }}>{shortDate(timestamps[timestamps.length - 1])}</span>
                        </div>
                        <input type="range" min={0} max={timestamps.length - 1} value={historyIndex}
                          onChange={(e) => handleHistoryChange(Number(e.target.value))}
                          style={{ width: "100%", marginBottom: 6 }} />
                        <div style={{ textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)" }}>
                          {shortDate(timestamps[historyIndex])} · {historyIndex + 1}/{timestamps.length}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Main forecast grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>

                  {/* Swing-o-meter */}
                  <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>
                      {raceRule === "PLURALITY" ? "Win Probability" : "Majority Win Probability"}
                    </div>
                    <SwingOMeter
                      c1Name={candidateLabels["Candidate1"]}
                      c2Name={candidateLabels["Candidate2"]}
                      c1Color={candidateColors["Candidate1"]}
                      c2Color={candidateColors["Candidate2"]}
                      c1Prob={raceRule === "PLURALITY" ? forecast.forecast.plurality_odds_to_win["Candidate1"] : forecast.forecast.majority_win_prob["Candidate1"]}
                      c2Prob={raceRule === "PLURALITY" ? forecast.forecast.plurality_odds_to_win["Candidate2"] : forecast.forecast.majority_win_prob["Candidate2"]}
                      reportingPct={forecast.race.percent_reporting}
                    />
                    {(() => {
                      const c3Prob = raceRule === "PLURALITY" ? forecast.forecast.plurality_odds_to_win["Candidate3"] : forecast.forecast.majority_win_prob["Candidate3"];
                      if (c3Prob < 0.005) return null;
                      return (
                        <div style={{ marginTop: 10, padding: "8px 10px", border: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: candidateColors["Candidate3"], display: "inline-block" }} />
                            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.4)" }}>{candidateLabels["Candidate3"]}</span>
                          </div>
                          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: candidateColors["Candidate3"] }}>{pct(c3Prob)}</span>
                        </div>
                      );
                    })()}
                    {raceRule === "MAJORITY" && (
                      <div style={{ marginTop: 8, padding: "8px 10px", border: "1px solid rgba(212,91,91,0.15)", background: "rgba(212,91,91,0.04)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(212,91,91,0.6)" }}>Runoff needed</span>
                        <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: "#d45b5b" }}>{pct(forecast.forecast.runoff_needed_prob)}</span>
                      </div>
                    )}
                  </div>

                  {/* Vote share */}
                  <div style={{ background: "#0f0f0d", border: "1px solid rgba(255,255,255,0.07)", padding: "16px" }}>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>Projected Vote Share</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 16 }}>
                      {(["Candidate1", "Candidate2", "Candidate3"] as const).map((key) => {
                        const color = candidateColors[key];
                        const share = forecast.forecast.modeled_share[key];
                        const votes = forecast.forecast.modeled_votes[key];
                        const isLeader = forecast.forecast.leader === key;
                        return (
                          <div key={key} style={{ padding: "10px 12px", border: `1px solid ${isLeader ? `${color}44` : "rgba(255,255,255,0.06)"}`, background: isLeader ? `${color}08` : "rgba(255,255,255,0.02)" }}>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.3)", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", letterSpacing: "0.04em" }}>{candidateLabels[key]}</div>
                            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color, lineHeight: 1, marginBottom: 2 }}>{pct(share)}</div>
                            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.06em" }}>{fmt(votes)} proj.</div>
                            {isLeader && <div style={{ marginTop: 4, fontFamily: "'DM Mono', monospace", fontSize: 7, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "#c5a55a" }}>Leader</div>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Runoff probs if majority */}
                    {raceRule === "MAJORITY" && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>Runoff Advance Probability</div>
                        {CANDIDATE_KEYS.map((k) => (
                          <div key={k} style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                              <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.35)" }}>{candidateLabels[k]}</span>
                              <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: candidateColors[k] }}>{pct(forecast.forecast.runoff_prob[k])}</span>
                            </div>
                            <div style={{ height: 2, background: "rgba(255,255,255,0.05)" }}>
                              <div style={{ height: "100%", width: pct(Math.min(forecast.forecast.runoff_prob[k], 1)), background: candidateColors[k], transition: "width 600ms ease" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Model stats */}
                    <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: 14 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.2)", marginBottom: 10 }}>Model Statistics</div>
                      {[
                        ["Total proj.", fmt(forecast.forecast.modeled_total_vote)],
                        ["Remaining", fmt(forecast.forecast.modeled_vote_remaining)],
                        ["Std dev", fmt(forecast.forecast.sd_race)],
                        ["Margin", `${fmt(forecast.forecast.projected_margin_votes)} (${pct(forecast.forecast.projected_margin_pct)})`],
                        ["Leader", candidateLabels[forecast.forecast.leader]],
                        ["Runner-up", candidateLabels[forecast.forecast.runner_up]],
                      ].map(([label, val]) => (
                        <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
                          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)" }}>{val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}