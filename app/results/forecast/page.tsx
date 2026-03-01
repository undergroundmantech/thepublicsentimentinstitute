"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForecastOutput, RaceRule } from "@/app/lib/electoralModel";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CivicCandidate {
  name: string;
  party: string;
  color: string;
  votes: number;
  percent: number;
  winner: boolean;
}

interface SearchRace {
  id: number;
  election_name: string;
  election_date: string;
  country: string;
  province: string | null;
  district: string | null;
  percent_reporting: number;
  candidates: CivicCandidate[];
}

interface HistoryTimestamp {
  timestamp: string;
}

interface HistoryList {
  id: number;
  count: number;
  timestamps: HistoryTimestamp[];
}

interface ForecastResponse {
  forecast: ForecastOutput;
  race: {
    election_name: string;
    election_date: string;
    percent_reporting: number;
    candidates: CivicCandidate[];
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pct(n: number, decimals = 1) {
  return (n * 100).toFixed(decimals) + "%";
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function shortDate(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const CANDIDATE_KEYS = ["Candidate1", "Candidate2", "Candidate3", "Others"] as const;
type CKey = (typeof CANDIDATE_KEYS)[number];

// ─── Sub-components ──────────────────────────────────────────────────────────

function ProbBar({
  label,
  value,
  color,
  sub,
}: {
  label: string;
  value: number;
  color: string;
  sub?: string;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>{label}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color }}>
          {pct(value)}
          {sub && <span style={{ fontWeight: 400, color: "#94a3b8", marginLeft: 6 }}>{sub}</span>}
        </span>
      </div>
      <div style={{ height: 6, background: "#1e293b", borderRadius: 99, overflow: "hidden" }}>
        <div
          style={{
            height: "100%",
            width: pct(Math.min(value, 1)),
            background: color,
            borderRadius: 99,
            transition: "width 0.6s cubic-bezier(.4,0,.2,1)",
          }}
        />
      </div>
    </div>
  );
}

function TimelineSlider({
  timestamps,
  index,
  onChange,
}: {
  timestamps: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  if (!timestamps.length) return null;
  return (
    <div style={{ padding: "12px 0" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 11, color: "#64748b" }}>{shortDate(timestamps[0])}</span>
        <span style={{ fontSize: 11, color: "#64748b" }}>
          {shortDate(timestamps[timestamps.length - 1])}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={timestamps.length - 1}
        value={index}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", accentColor: "#6366f1" }}
      />
      <div style={{ textAlign: "center", marginTop: 6, fontSize: 12, color: "#94a3b8" }}>
        Snapshot: <strong style={{ color: "#e2e8f0" }}>{shortDate(timestamps[index])}</strong>
        &nbsp;({index + 1} / {timestamps.length})
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Home() {
  // Search state
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [searchResults, setSearchResults] = useState<SearchRace[]>([]);
  const [searching, setSearching] = useState(false);

  // Selected race + options
  const [selectedRace, setSelectedRace] = useState<SearchRace | null>(null);
  const [raceRule, setRaceRule] = useState<RaceRule>("PLURALITY");
  const [expectedTurnoverOverride, setExpectedTurnoverOverride] = useState("");

  // History
  const [historyList, setHistoryList] = useState<HistoryList | null>(null);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Forecast output
  const [forecast, setForecast] = useState<ForecastResponse | null>(null);
  const [loadingForecast, setLoadingForecast] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-play
  const [playing, setPlaying] = useState(false);
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const timestamps = useMemo(
    () => historyList?.timestamps.map((t) => t.timestamp) ?? [],
    [historyList]
  );

  // ── Search ──────────────────────────────────────────────────────────────────

  async function doSearch() {
    if (!query && !country) return;
    setSearching(true);
    setError(null);
    try {
      const params = new URLSearchParams({ action: "search" });
      if (query) params.set("query", query);
      if (country) params.set("country", country);
      params.set("limit", "20");
      const res = await fetch(`/api/forecast?${params}`);
      const data = await res.json();
      setSearchResults(data.races ?? []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSearching(false);
    }
  }

  // ── Select race: load history ────────────────────────────────────────────────

  async function selectRace(race: SearchRace) {
    setSelectedRace(race);
    setForecast(null);
    setHistoryList(null);
    setHistoryIndex(0);
    setPlaying(false);
    setLoadingHistory(true);
    setError(null);
    try {
      const res = await fetch(`/api/forecast?action=timestamps&raceId=${race.id}`);
      const data: HistoryList = await res.json();
      setHistoryList(data);
      // Start at the latest snapshot
      if (data.timestamps.length > 0) {
        const last = data.timestamps.length - 1;
        setHistoryIndex(last);
        await runForecastAtIndex(race.id, data.timestamps, last);
      } else {
        // No history — run forecast from live race data
        await runForecastLive(race.id);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingHistory(false);
    }
  }

  // ── Forecast helpers ─────────────────────────────────────────────────────────

  async function runForecastLive(raceId: number) {
    setLoadingForecast(true);
    try {
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "civic",
          raceId: String(raceId),
          race_rule: raceRule,
          expected_turnout: expectedTurnoverOverride ? Number(expectedTurnoverOverride) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingForecast(false);
    }
  }

  async function runForecastAtIndex(
    raceId: number,
    tsList: HistoryTimestamp[],
    idx: number
  ) {
    setLoadingForecast(true);
    setError(null);
    try {
      const timestamp = tsList[idx].timestamp;
      const priorTimestamp = idx > 0 ? tsList[0].timestamp : undefined;
      const res = await fetch("/api/forecast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "civic_history",
          raceId: String(raceId),
          timestamp,
          priorTimestamp,
          race_rule: raceRule,
          expected_turnout: expectedTurnoverOverride ? Number(expectedTurnoverOverride) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.details ?? data.error);
      setForecast(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingForecast(false);
    }
  }

  async function handleHistoryChange(idx: number) {
    setHistoryIndex(idx);
    if (!selectedRace || !historyList) return;
    await runForecastAtIndex(selectedRace.id, historyList.timestamps, idx);
  }

  // ── Autoplay ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (playing && timestamps.length > 1) {
      playRef.current = setInterval(() => {
        setHistoryIndex((prev) => {
          const next = prev + 1;
          if (next >= timestamps.length) {
            setPlaying(false);
            return prev;
          }
          if (selectedRace && historyList) {
            runForecastAtIndex(selectedRace.id, historyList.timestamps, next);
          }
          return next;
        });
      }, 1800);
    } else {
      if (playRef.current) clearInterval(playRef.current);
    }
    return () => { if (playRef.current) clearInterval(playRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, timestamps.length, selectedRace, historyList]);

  // ── Derived display data ─────────────────────────────────────────────────────

  const candidateLabels: Record<CKey, string> = useMemo(() => {
    const names = forecast?.forecast.candidate_names ?? ["Candidate 1", "Candidate 2", "Candidate 3", "Others"];
    return { Candidate1: names[0], Candidate2: names[1], Candidate3: names[2], Others: names[3] };
  }, [forecast]);

  const candidateColors: Record<CKey, string> = useMemo(() => {
    const colors = forecast?.forecast.candidate_colors ?? ["#3b82f6", "#ef4444", "#22c55e", "#94a3b8"];
    return { Candidate1: colors[0], Candidate2: colors[1], Candidate3: colors[2], Others: colors[3] };
  }, [forecast]);

  // ── Styles ────────────────────────────────────────────────────────────────────

  const S = {
    page: {
      minHeight: "100vh",
      background: "#0a0f1a",
      color: "#e2e8f0",
      fontFamily: "'DM Mono', 'Fira Code', 'Courier New', monospace",
      padding: "0 0 60px",
    } as React.CSSProperties,
    header: {
      background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)",
      borderBottom: "1px solid #1e293b",
      padding: "20px 32px",
      display: "flex",
      alignItems: "center",
      gap: 14,
    } as React.CSSProperties,
    logo: {
      width: 36,
      height: 36,
      borderRadius: 8,
      background: "linear-gradient(135deg, #6366f1, #818cf8)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: 18,
      flexShrink: 0,
    } as React.CSSProperties,
    title: { fontSize: 20, fontWeight: 800, letterSpacing: "-0.5px", color: "#f1f5f9" } as React.CSSProperties,
    subtitle: { fontSize: 12, color: "#64748b", marginTop: 2 } as React.CSSProperties,
    body: { display: "grid", gridTemplateColumns: "340px 1fr", gap: 0, maxWidth: 1280, margin: "0 auto", padding: "28px 32px" } as React.CSSProperties,
    panel: {
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
    } as React.CSSProperties,
    sectionTitle: { fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#475569", textTransform: "uppercase" as const, marginBottom: 14 },
    input: {
      width: "100%",
      background: "#1e293b",
      border: "1px solid #334155",
      borderRadius: 10,
      color: "#e2e8f0",
      padding: "9px 12px",
      fontSize: 13,
      fontFamily: "inherit",
      outline: "none",
      boxSizing: "border-box" as const,
    },
    btn: (accent = "#6366f1") => ({
      padding: "9px 16px",
      borderRadius: 10,
      border: "none",
      background: accent,
      color: "#fff",
      fontWeight: 700,
      fontSize: 13,
      cursor: "pointer",
      fontFamily: "inherit",
      letterSpacing: "0.02em",
    } as React.CSSProperties),
    raceItem: (selected: boolean) => ({
      padding: "10px 12px",
      borderRadius: 10,
      border: `1px solid ${selected ? "#6366f1" : "#1e293b"}`,
      background: selected ? "#1e1b4b" : "#0f172a",
      cursor: "pointer",
      marginBottom: 8,
      transition: "all 0.15s",
    } as React.CSSProperties),
    badge: (color: string) => ({
      display: "inline-block",
      padding: "2px 8px",
      borderRadius: 99,
      fontSize: 11,
      fontWeight: 700,
      background: color + "22",
      color: color,
      border: `1px solid ${color}44`,
    } as React.CSSProperties),
    card: {
      background: "#0f172a",
      border: "1px solid #1e293b",
      borderRadius: 14,
      padding: 18,
      marginBottom: 14,
    } as React.CSSProperties,
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logo}>📊</div>
        <div>
          <div style={S.title}>Election Forecast Engine</div>
          <div style={S.subtitle}>CivicAPI · Live Results · Historical Playback · Bayesian Model</div>
        </div>
      </div>

      <div style={S.body}>
        {/* Left sidebar */}
        <div style={{ paddingRight: 20 }}>
          {/* Search */}
          <div style={S.panel}>
            <div style={S.sectionTitle}>Search Races</div>
            <input
              placeholder="Election name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              style={{ ...S.input, marginBottom: 8 }}
            />
            <input
              placeholder="Country (e.g. US, FR)"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && doSearch()}
              style={{ ...S.input, marginBottom: 10 }}
            />
            <button onClick={doSearch} disabled={searching} style={{ ...S.btn(), width: "100%" }}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Results */}
          {searchResults.length > 0 && (
            <div style={S.panel}>
              <div style={S.sectionTitle}>{searchResults.length} Results</div>
              <div style={{ maxHeight: 340, overflowY: "auto" }}>
                {searchResults.map((r) => (
                  <div
                    key={r.id}
                    style={S.raceItem(selectedRace?.id === r.id)}
                    onClick={() => selectRace(r)}
                  >
                    <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4, color: "#f1f5f9" }}>
                      {r.election_name}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>
                      {r.country}{r.province ? ` · ${r.province}` : ""} · {new Date(r.election_date).toLocaleDateString()}
                    </div>
                    <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 3 }}>
                      {r.percent_reporting}% reporting
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Model options */}
          {selectedRace && (
            <div style={S.panel}>
              <div style={S.sectionTitle}>Model Options</div>
              <label style={{ display: "block", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>Race Rule</div>
                <select
                  value={raceRule}
                  onChange={(e) => setRaceRule(e.target.value as RaceRule)}
                  style={{ ...S.input }}
                >
                  <option value="PLURALITY">Plurality</option>
                  <option value="MAJORITY">Majority / Runoff</option>
                </select>
              </label>
              <label style={{ display: "block", marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                  Expected Turnout Override (optional)
                </div>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={expectedTurnoverOverride}
                  onChange={(e) => setExpectedTurnoverOverride(e.target.value)}
                  style={S.input}
                />
              </label>
              <button
                onClick={() => {
                  if (!selectedRace) return;
                  if (timestamps.length > 0 && historyList) {
                    runForecastAtIndex(selectedRace.id, historyList.timestamps, historyIndex);
                  } else {
                    runForecastLive(selectedRace.id);
                  }
                }}
                style={{ ...S.btn("#10b981"), width: "100%" }}
                disabled={loadingForecast}
              >
                {loadingForecast ? "Running…" : "Rerun Forecast"}
              </button>
            </div>
          )}
        </div>

        {/* Main panel */}
        <div>
          {error && (
            <div style={{ background: "#450a0a", border: "1px solid #7f1d1d", borderRadius: 12, padding: 14, marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>
              ⚠️ {error}
            </div>
          )}

          {!selectedRace && !searchResults.length && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "#334155" }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🗳️</div>
              <div style={{ fontSize: 18, fontWeight: 700 }}>Search for an election to get started</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Use the panel on the left to find races by name or country</div>
            </div>
          )}

          {(loadingHistory || loadingForecast) && !forecast && (
            <div style={{ textAlign: "center", padding: 60, color: "#6366f1" }}>
              <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>⟳</div>
              <div>{loadingHistory ? "Loading race history…" : "Running forecast model…"}</div>
            </div>
          )}

          {forecast && selectedRace && (
            <>
              {/* Race header */}
              <div style={S.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 6 }}>
                      {forecast.race.election_name}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {new Date(forecast.race.election_date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
                      &nbsp;·&nbsp;{forecast.race.percent_reporting}% reporting
                    </div>
                  </div>
                  <div>
                    <span style={S.badge(forecast.forecast.mode_trigger === "RUNOFF" ? "#f59e0b" : "#6366f1")}>
                      {forecast.forecast.mode_trigger}
                    </span>
                  </div>
                </div>

                {/* History timeline */}
                {timestamps.length > 1 && (
                  <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #1e293b" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <div style={S.sectionTitle}>Historical Playback</div>
                      <button
                        onClick={() => {
                          if (playing) { setPlaying(false); return; }
                          if (historyIndex >= timestamps.length - 1) setHistoryIndex(0);
                          setPlaying(true);
                        }}
                        style={S.btn(playing ? "#ef4444" : "#6366f1")}
                      >
                        {playing ? "⏹ Stop" : "▶ Play"}
                      </button>
                    </div>
                    <TimelineSlider
                      timestamps={timestamps}
                      index={historyIndex}
                      onChange={handleHistoryChange}
                    />
                  </div>
                )}

                {timestamps.length === 0 && (
                  <div style={{ marginTop: 12, fontSize: 11, color: "#475569", fontStyle: "italic" }}>
                    No history snapshots found (available for races tracked after Oct 9, 2025)
                  </div>
                )}
              </div>

              {/* Vote totals */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                {(["Candidate1", "Candidate2", "Candidate3"] as const).map((key) => {
                  const color = candidateColors[key];
                  const name = candidateLabels[key];
                  const votes = forecast.forecast.modeled_votes[key];
                  const share = forecast.forecast.modeled_share[key];
                  const isLeader = forecast.forecast.leader === key;
                  return (
                    <div key={key} style={{ ...S.card, borderColor: isLeader ? color + "55" : "#1e293b", position: "relative" }}>
                      {isLeader && (
                        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 10, color, fontWeight: 700 }}>
                          LEADER
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4 }}>{name}</div>
                      <div style={{ fontSize: 28, fontWeight: 800, color, marginBottom: 2 }}>
                        {pct(share)}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>{fmt(votes)} votes (proj.)</div>
                    </div>
                  );
                })}
              </div>

              {/* Win probabilities – show the appropriate one based on rule */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14, marginBottom: 14 }}>
                <div style={S.card}>
                  <div style={S.sectionTitle}>
                    {raceRule === "PLURALITY"
                      ? "Win Probability (Most Votes)"
                      : "Majority Win Probability (≥50%)"}
                  </div>

                  {CANDIDATE_KEYS.slice(0, 3).map((k) => {   // exclude Others from win probs
                    const probField = raceRule === "PLURALITY"
                      ? forecast.forecast.plurality_odds_to_win[k]
                      : forecast.forecast.majority_win_prob[k];

                    return (
                      <ProbBar
                        key={k}
                        label={candidateLabels[k]}
                        value={probField}
                        color={candidateColors[k]}
                      />
                    );
                  })}

                  {/* Optional: show runoff needed only in majority mode */}
                  {raceRule === "MAJORITY" && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #1e293b" }}>
                      <ProbBar
                        label="Runoff Needed"
                        value={forecast.forecast.runoff_needed_prob}
                        color="#f59e0b"
                        sub="(no one ≥50%)"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Runoff probs + Stats row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                {forecast.forecast.race_rule === "MAJORITY" && (
                  <div style={S.card}>
                    <div style={S.sectionTitle}>Runoff Advance Probability</div>
                    {CANDIDATE_KEYS.map((k) => (
                      <ProbBar
                        key={k}
                        label={candidateLabels[k]}
                        value={forecast.forecast.runoff_prob[k]}
                        color={candidateColors[k]}
                      />
                    ))}
                  </div>
                )}

                <div style={S.card}>
                  <div style={S.sectionTitle}>Model Statistics</div>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                    <tbody>
                      {[
                        ["Modeled total vote", fmt(forecast.forecast.modeled_total_vote)],
                        ["Votes remaining", fmt(forecast.forecast.modeled_vote_remaining)],
                        ["% Reporting (modeled)", pct(forecast.forecast.modeled_percent_reporting)],
                        ["Std dev (race)", fmt(forecast.forecast.sd_race)],
                        ["Leader", candidateLabels[forecast.forecast.leader]],
                        ["Runner-up", candidateLabels[forecast.forecast.runner_up]],
                        ["Projected margin", `${fmt(forecast.forecast.projected_margin_votes)} (${pct(forecast.forecast.projected_margin_pct)})`],
                      ].map(([label, value]) => (
                        <tr key={label}>
                          <td style={{ padding: "5px 0", color: "#64748b", width: "55%" }}>{label}</td>
                          <td style={{ padding: "5px 0", color: "#e2e8f0", fontWeight: 600 }}>{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300&display=swap');
        * { box-sizing: border-box; }
        input[type=range] { height: 4px; cursor: pointer; }
        @keyframes spin { to { transform: rotate(360deg); } }
        ::-webkit-scrollbar { width: 6px; background: #0a0f1a; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 99px; }
        select option { background: #0f172a; }
      `}</style>
    </div>
  );
}

