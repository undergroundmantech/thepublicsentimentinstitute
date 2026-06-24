"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getRaceUrl } from "@/app/results/_data/raceRegistry";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;
const CYCLE_MS = 6_000;
const SLIDE_MS = 380; // duration of slide animation

type RaceConfig = {
  id: number;
  label: string;
  location: string;
  dateShort: string;
  raceRule: "MAJORITY" | "PLURALITY" | "RANKED_CHOICE";
  expectedTurnout?: number;
  pollAvg?: Record<string, number>;
};

const RACES: RaceConfig[] = [
  { id: 84105, label: "SC Governor Republican Runoff",         location: "South Carolina",     dateShort: "06/23/26", raceRule: "PLURALITY", expectedTurnout: 380_000 },
  { id: 84104, label: "SC Attorney General Republican Runoff", location: "South Carolina",     dateShort: "06/23/26", raceRule: "PLURALITY", expectedTurnout: 310_000 },
  { id: 83700, label: "MD Governor Republican Primary",        location: "Maryland",           dateShort: "06/23/26", raceRule: "PLURALITY", expectedTurnout: 380_000 },
  { id: 83925, label: "MD US House 6 Democratic Primary",      location: "Maryland",           dateShort: "06/23/26", raceRule: "PLURALITY", expectedTurnout: 110_000, pollAvg: { "Trone": 56.0, "McClain Delaney": 40.0 } },
  { id: 84117, label: "NY US House 17 Democratic Primary",     location: "New York",           dateShort: "06/23/26", raceRule: "PLURALITY", expectedTurnout: 50_000  },
];

type RaceData = { percent_reporting?: number; polls_open?: string | null; polls_close?: string | null; };
type ForecastStat = {
  leader: "Candidate1" | "Candidate2" | "Candidate3" | "Others";
  candidate_names?: [string, string, string, string];
  race_rule: string;
  plurality_odds_to_win: Record<string, number>;
  runoff_needed_prob: number;
};

function getStatus(data: RaceData | null, dateShort: string): string {
  if (!data) return `Scheduled · ${dateShort}`;
  const now = Date.now();
  const close = data.polls_close ? new Date(data.polls_close) : null;
  if (close && now >= close.getTime()) return "Closed";
  let open = data.polls_open ? new Date(data.polls_open) : null;
  if (!open && close) { const d = new Date(close); d.setHours(7, 0, 0, 0); open = d; }
  if (open && now >= open.getTime()) return "Polls Open";
  return `Scheduled · ${dateShort}`;
}

export default function ElectionResultsCard() {
  const [activeIdx, setActiveIdx] = useState(0);
  // slideKey increments on every transition — used as React key to re-trigger the CSS animation
  const [slideKey, setSlideKey] = useState(0);
  const [raceData, setRaceData] = useState<Record<number, RaceData>>({});
  const [forecastData, setForecastData] = useState<Record<number, ForecastStat>>({});
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch race data + forecast for current race
  useEffect(() => {
    const race = RACES[activeIdx];
    const id = race.id;
    async function fetch_() {
      try {
        // Raw race data
        const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const d: RaceData = await res.json();
        setRaceData(prev => ({ ...prev, [id]: d }));
        // Forecast
        const fRes = await fetch("/api/forecast", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "civic_raw",
            raceData: d,
            race_rule: race.raceRule,
            expected_turnout: race.expectedTurnout,
            poll_avg: race.pollAvg,
          }),
        });
        if (!fRes.ok) return;
        const fJson = await fRes.json();
        const fc: ForecastStat = fJson.forecast;
        if (fc) setForecastData(prev => ({ ...prev, [id]: fc }));
      } catch {}
    }
    fetch_();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(fetch_, POLL_MS);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeIdx]);

  // Auto-cycle — just advance index; CSS animation handles the visual transition
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setActiveIdx(i => (i + 1) % RACES.length);
      setSlideKey(k => k + 1);
    }, CYCLE_MS);
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, []);

  function goTo(idx: number) {
    setActiveIdx(idx);
    setSlideKey(k => k + 1);
  }

  const race = RACES[activeIdx % RACES.length];
  const data = raceData[race.id] ?? null;
  const fc = forecastData[race.id] ?? null;
  const reporting = typeof data?.percent_reporting === "number" ? data.percent_reporting : null;
  const status = getStatus(data, race.dateShort);

  // Derive leader name + probability for ticker
  const leaderKey = fc?.leader;
  const leaderIdx = leaderKey === "Candidate1" ? 0 : leaderKey === "Candidate2" ? 1 : leaderKey === "Candidate3" ? 2 : -1;
  const leaderFullName = leaderIdx >= 0 ? ((fc?.candidate_names as string[] | undefined)?.[leaderIdx] ?? null) : null;
  const leaderLast = leaderFullName ? leaderFullName.split(" ").pop()! : null;
  const isMajority = race.raceRule === "MAJORITY" || race.raceRule === "RANKED_CHOICE";
  const prob = fc && leaderKey
    ? isMajority
      ? fc.runoff_needed_prob
      : (fc.plurality_odds_to_win[leaderKey] ?? null)
    : null;
  const probPct = prob !== null ? Math.round(prob * 100) : null;
  const probLabel = race.raceRule === "RANKED_CHOICE" ? "rcv" : isMajority ? "runoff" : "win";

  return (
    <>
      <style>{`
        @keyframes erc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
        @keyframes erc-ticker-slide { 
          0%   { opacity:0; transform:translateY(60%); }
          100% { opacity:1; transform:translateY(0); }
        }
        .erc-root {
          background: var(--panel);
          border: none;
          border-radius: var(--r-xl);
          padding: 0;
          box-shadow: var(--shadow-md), 0 0 0 1px var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          position: relative;
        }
        /* live spotlight ticker */
        .erc-ticker {
          background: linear-gradient(100deg, rgba(232,75,106,0.06) 0%, rgba(139,92,246,0.08) 100%);
          border-bottom: 1px solid var(--border);
          padding: 9px 16px;
          display: flex;
          align-items: center;
          gap: 9px;
          min-height: 40px;
          margin-top: 2px;
        }
        .erc-ticker-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--purple);
          flex-shrink: 0;
          animation: erc-pulse 1.8s ease-in-out infinite;
        }
        .erc-ticker-label {
          font-family: var(--font-numeric);
          font-size: 9.5px;
          letter-spacing: 0.10em;
          font-weight: 700;
          color: var(--purple);
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .erc-ticker-divider { color: var(--border3); font-size: 11px; flex-shrink: 0; }
        /* sliding text area */
        .erc-ticker-slide-wrap {
          flex: 1;
          min-width: 0;
          overflow: hidden;
          display: flex;
          align-items: center;
          gap: 9px;
        }
        .erc-ticker-slide-inner {
          display: flex;
          align-items: center;
          gap: 9px;
          min-width: 0;
          animation: erc-ticker-slide ${SLIDE_MS}ms cubic-bezier(0.16,1,0.3,1) both;
        }
        .erc-ticker-race {
          font-family: var(--font-numeric);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: var(--foreground);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          text-decoration: none;
          min-width: 0;
        }
        .erc-ticker-race:hover { color: var(--purple); text-decoration: none; }
        .erc-ticker-stat {
          font-family: var(--font-numeric);
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--muted);
          flex-shrink: 0;
          white-space: nowrap;
        }
        /* dots nav */
        .erc-dots {
          display: flex; gap: 4px; align-items: center; flex-shrink: 0;
        }
        .erc-dot-btn {
          width: 5px; height: 5px; border-radius: 50%;
          background: var(--border3);
          border: none; cursor: pointer; padding: 0; flex-shrink: 0;
          transition: background 150ms, transform 150ms;
        }
        .erc-dot-btn.active {
          background: var(--purple);
          transform: scale(1.4);
        }
        /* body */
        .erc-body { padding: 0 0 20px; display: flex; flex-direction: column; flex: 1; gap: 0; }
        .erc-header {
          padding: 18px 22px 16px;
          background:
            radial-gradient(ellipse 80% 60% at 0% 0%,   rgba(230,57,70,0.28)  0%, transparent 65%),
            radial-gradient(ellipse 60% 50% at 100% 0%, rgba(37,99,235,0.22)  0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 50% 100%,rgba(124,58,237,0.20) 0%, transparent 60%),
            linear-gradient(160deg, rgba(124,58,237,0.12) 0%, rgba(15,15,30,0) 100%);
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
          position: relative;
        }
        .erc-header::before {
          content: '';
          position: absolute;
          left: 0; top: 0; bottom: 0;
          width: 3px;
          background: linear-gradient(180deg, var(--red) 0%, var(--purple) 100%);
          border-radius: 0 0 0 0;
        }
        .erc-eyebrow {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-body); font-size: 9.5px; font-weight: 700;
          letter-spacing: 0.16em; text-transform: uppercase; color: var(--purple);
          background: rgba(124,58,237,0.10); border: 1px solid rgba(124,58,237,0.22);
          border-radius: 9999px; padding: 3px 9px;
          margin-bottom: 12px;
        }
        .erc-eyebrow-dot {
          width: 5px; height: 5px; border-radius: 50%; background: var(--red); flex-shrink: 0;
        }
        .erc-headline {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 25px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.06;
          color: var(--foreground); margin-bottom: 8px;
        }
        .erc-headline em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .erc-sub {
          font-size: 11px; color: var(--muted); line-height: 1.45;
        }
        .erc-inner { padding: 0 22px; }
        .erc-features {
          display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 18px;
        }
        .erc-feature {
          display: flex; flex-direction: column; gap: 5px;
          padding: 11px 12px;
          background: var(--panel2); border: 1px solid var(--border);
          border-radius: var(--r-md);
        }
        .erc-feature-icon {
          width: 18px; height: 18px; color: var(--purple); flex-shrink: 0;
        }
        .erc-feature-title {
          font-family: var(--font-body); font-size: 10.5px; font-weight: 700;
          letter-spacing: 0.04em; color: var(--foreground); text-transform: uppercase;
        }
        .erc-feature-desc {
          font-size: 10.5px; color: var(--muted); line-height: 1.4;
        }
        /* gradient CTA button */
        .erc-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          padding: 12px 16px;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          color: #fff !important;
          border-radius: 9999px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px; font-weight: 700; letter-spacing: 0.02em; text-decoration: none;
          box-shadow: 0 2px 16px rgba(139,92,246,0.35);
          margin-top: auto;
          transition: opacity 140ms ease, transform 140ms ease;
        }
        .erc-cta:hover { opacity: 0.88; transform: translateY(-1px); text-decoration: none; color: #fff !important; }
      `}</style>

      <div className="erc-root">
        {/* Live spotlight ticker */}
        <div className="erc-ticker">
          <span className="erc-ticker-dot" />
          <span className="erc-ticker-label">Spotlight</span>
          <span className="erc-ticker-divider">·</span>
          <div className="erc-ticker-slide-wrap">
            <div key={slideKey} className="erc-ticker-slide-inner">
              <Link
                href={getRaceUrl(race.id) ?? `/results?race=${race.id}`}
                className="erc-ticker-race"
              >
                {race.label}
              </Link>
              {(leaderLast && probPct !== null) && (
                <span className="erc-ticker-stat">
                  {leaderLast} · {probPct}% {probLabel}
                  {reporting !== null ? ` · ${reporting.toFixed(1)}% rep.` : ""}
                </span>
              )}
              {!(leaderLast && probPct !== null) && reporting !== null && (
                <span className="erc-ticker-stat">{reporting.toFixed(1)}% rep.</span>
              )}
              {!(leaderLast && probPct !== null) && reporting === null && (
                <span className="erc-ticker-stat">{status}</span>
              )}
            </div>
          </div>
          <div className="erc-dots">
            {RACES.map((_, i) => (
              <button key={i} className={`erc-dot-btn${i === activeIdx ? " active" : ""}`} onClick={() => goTo(i)} aria-label={`Race ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* Card body */}
        <div className="erc-body">
          <div className="erc-header">
            <div className="erc-eyebrow"><span className="erc-eyebrow-dot" />Election Results</div>
            <div className="erc-headline">
              We <em>forecast</em>,<br />project &amp; model<br />every major race.
            </div>
            <div className="erc-sub">Live forecasts, projections &amp; night-of results.</div>
          </div>
          <div className="erc-inner">
          <div className="erc-features">
            {[
              {
                title: "Pre-Election Forecast",
                desc: "Poll-based model before votes are cast.",
                icon: <svg className="erc-feature-icon" viewBox="0 0 18 18" fill="none"><rect x="2" y="10" width="3" height="6" rx="1" fill="currentColor" opacity=".4"/><rect x="7.5" y="6" width="3" height="10" rx="1" fill="currentColor" opacity=".7"/><rect x="13" y="2" width="3" height="14" rx="1" fill="currentColor"/></svg>,
              },
              {
                title: "Live Projection",
                desc: "Real-time model as results come in.",
                icon: <svg className="erc-feature-icon" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="3" fill="currentColor"/><circle cx="9" cy="9" r="6" stroke="currentColor" strokeWidth="1.4" opacity=".4"/><circle cx="9" cy="9" r="9" stroke="currentColor" strokeWidth="1" opacity=".2"/></svg>,
              },
              {
                title: "County Map",
                desc: "Interactive geographic breakdown.",
                icon: <svg className="erc-feature-icon" viewBox="0 0 18 18" fill="none"><path d="M2 4l5 2 4-2 5 2v8l-5-2-4 2-5-2V4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" fill="currentColor" opacity=".15"/><path d="M7 6v8M11 4v8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity=".6"/></svg>,
              },
              {
                title: "Electoral Model",
                desc: "Simulated outcomes &amp; probabilities.",
                icon: <svg className="erc-feature-icon" viewBox="0 0 18 18" fill="none"><path d="M2 14 L6 8 L10 11 L14 5 L16 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/><circle cx="16" cy="7" r="1.5" fill="currentColor" opacity=".7"/></svg>,
              },
            ].map(f => (
              <div key={f.title} className="erc-feature">
                {f.icon}
                <div className="erc-feature-title">{f.title}</div>
                <div className="erc-feature-desc" dangerouslySetInnerHTML={{ __html: f.desc }} />
              </div>
            ))}
          </div>
          <Link href="/results" className="erc-cta">
            Explore Live Results &amp; Forecasts →
          </Link>
          </div>
        </div>
      </div>
    </>
  );
}


