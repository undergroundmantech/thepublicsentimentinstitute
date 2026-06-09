"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getRaceUrl } from "@/app/results/_data/raceRegistry";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;
const CYCLE_MS = 5_000;

type RaceConfig = {
  id: number;
  label: string;
  location: string;
  dateShort: string;
  raceRule: "MAJORITY" | "PLURALITY";
  expectedTurnout?: number;
  pollAvg?: Record<string, number>;
};

const RACES: RaceConfig[] = [
  { id: 82664, label: "SC US Senate Republican Primary",  location: "South Carolina", dateShort: "06/09/26", raceRule: "MAJORITY",  expectedTurnout: 400_000, pollAvg: { "Graham": 51.0, "Lynch": 26.4, "Dismukes": 6.6, "Herrmann": 5.4 } },
  { id: 82596, label: "SC Governor Republican Primary",    location: "South Carolina", dateShort: "06/09/26", raceRule: "MAJORITY",  expectedTurnout: 380_000, pollAvg: { "Mace": 30.0, "Evette": 24.9, "Norman": 15.2, "Reddy": 13.4, "Wilson": 12.0 } },
  { id: 83063, label: "ME US Senate Democratic Primary",   location: "Maine",          dateShort: "06/09/26", raceRule: "PLURALITY", expectedTurnout: 200_000, pollAvg: { "Platner": 66.0, "Mills": 20.0 } },
  { id: 82693, label: "ME Governor Democratic Primary",    location: "Maine",          dateShort: "06/09/26", raceRule: "PLURALITY", expectedTurnout: 210_000, pollAvg: { "Shah": 29.0, "Jackson": 28.0, "King": 14.0, "Pingree": 12.0 } },
  { id: 83111, label: "NV Governor Republican Primary",    location: "Nevada",         dateShort: "06/09/26", raceRule: "PLURALITY", expectedTurnout: 165_000, pollAvg: { "Lombardo": 78.0, "Hansen": 12.0 } },
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
  const [visible, setVisible] = useState(true);
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

  // Auto-cycle with fade
  useEffect(() => {
    cycleRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setActiveIdx(i => (i + 1) % RACES.length);
        setVisible(true);
      }, 320);
    }, CYCLE_MS);
    return () => { if (cycleRef.current) clearInterval(cycleRef.current); };
  }, []);

  function goTo(idx: number) {
    setVisible(false);
    setTimeout(() => { setActiveIdx(idx); setVisible(true); }, 200);
  }

  const race = RACES[activeIdx];
  const data = raceData[race.id] ?? null;
  const fc = forecastData[race.id] ?? null;
  const reporting = typeof data?.percent_reporting === "number" ? data.percent_reporting : null;
  const status = getStatus(data, race.dateShort);

  // Derive leader name + probability for ticker
  const leaderKey = fc?.leader;
  const leaderIdx = leaderKey === "Candidate1" ? 0 : leaderKey === "Candidate2" ? 1 : leaderKey === "Candidate3" ? 2 : -1;
  const leaderFullName = leaderIdx >= 0 ? (fc?.candidate_names?.[leaderIdx] ?? null) : null;
  const leaderLast = leaderFullName ? leaderFullName.split(" ").pop()! : null;
  const isMajority = race.raceRule === "MAJORITY";
  const prob = fc && leaderKey
    ? isMajority
      ? fc.runoff_needed_prob
      : (fc.plurality_odds_to_win[leaderKey] ?? null)
    : null;
  const probPct = prob !== null ? Math.round(prob * 100) : null;
  const probLabel = isMajority ? "runoff" : "win";

  return (
    <>
      <style>{`
        @keyframes erc-pulse { 0%,100%{opacity:1;} 50%{opacity:0.35;} }
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
        /* gradient border that hugs the top rounded corners */
        .erc-root::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 28px;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          border-radius: var(--r-xl) var(--r-xl) 0 0;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 2.5px 2.5px 0 2.5px;
          pointer-events: none;
          z-index: 2;
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
        .erc-ticker-race {
          font-family: var(--font-numeric);
          font-size: 10.5px;
          letter-spacing: 0.04em;
          font-weight: 600;
          color: var(--foreground);
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          transition: opacity 300ms ease;
          text-decoration: none;
        }
        .erc-ticker-race:hover { color: var(--purple); text-decoration: none; }
        .erc-ticker-stat {
          font-family: var(--font-numeric);
          font-size: 10px;
          letter-spacing: 0.06em;
          color: var(--muted);
          flex-shrink: 0;
          transition: opacity 300ms ease;
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
        .erc-body { padding: 22px 24px 20px; display: flex; flex-direction: column; flex: 1; }
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
          <Link
            href={getRaceUrl(race.id) ?? `/results?race=${race.id}`}
            className="erc-ticker-race"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {race.label}
          </Link>
          <span className="erc-ticker-stat" style={{ opacity: visible ? 1 : 0 }}>
            {leaderLast && probPct !== null
              ? `${leaderLast} · ${probPct}% ${probLabel}`
              : reporting !== null
              ? `${reporting.toFixed(1)}% rep.`
              : status}
          </span>
          {reporting !== null && leaderLast && probPct !== null && (
            <span className="erc-ticker-stat" style={{ opacity: visible ? 1 : 0, marginLeft: -4, color: "var(--muted)", opacity: 0.6 }}>
              {` · ${reporting.toFixed(1)}% rep.`}
            </span>
          )}
          <div className="erc-dots">
            {RACES.map((_, i) => (
              <button key={i} className={`erc-dot-btn${i === activeIdx ? " active" : ""}`} onClick={() => goTo(i)} aria-label={`Race ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* Original content */}
        <div className="erc-body">
          <div className="hp-hero-side-head">Election Results</div>
          <div className="hp-hero-side-sub">Forecasts, projections &amp; live night-of results.</div>
          <div className="hp-cap-headline">
            We <em>forecast</em>,<br />project &amp; model<br />every major race.
          </div>
          <div className="hp-cap-tiles">
            {[
              "Pre-Election Forecast",
              "Live Night-of Projection",
              "County-Level Results",
              "Electoral Modeling",
            ].map((t) => (
              <div key={t} className="hp-cap-tile">
                <span className="hp-cap-tile-dot" />
                <span>{t}</span>
              </div>
            ))}
          </div>
          <Link href="/results" className="erc-cta">
            Explore Live Results &amp; Forecasts →
          </Link>
        </div>
      </div>
    </>
  );
}


