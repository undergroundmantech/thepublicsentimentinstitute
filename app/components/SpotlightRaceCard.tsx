"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;
const CYCLE_MS = 5_000;

const RACES = [
  { id: 79938, label: "LA Mayor Open Primary",          location: "Los Angeles, CA",  dateShort: "06/02/26" },
  { id: 79777, label: "California Governor Primary",    location: "California",        dateShort: "06/02/26" },
  { id: 79945, label: "Iowa Governor Republican Primary", location: "Iowa",            dateShort: "06/02/26" },
  { id: 80461, label: "South Dakota Governor Primary",  location: "South Dakota",      dateShort: "06/02/26" },
] as const;

type RaceData = { percent_reporting?: number; polls_open?: string | null; polls_close?: string | null; };

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
  const cycleRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef  = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch race data for current race
  useEffect(() => {
    const id = RACES[activeIdx].id;
    async function fetch_() {
      try {
        const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
        if (!res.ok) return;
        const d: RaceData = await res.json();
        setRaceData(prev => ({ ...prev, [id]: d }));
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
  const reporting = typeof data?.percent_reporting === "number" ? data.percent_reporting : null;
  const status = getStatus(data, race.dateShort);

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
            href={`/results?race=${race.id}`}
            className="erc-ticker-race"
            style={{ opacity: visible ? 1 : 0 }}
          >
            {race.label}
          </Link>
          <span className="erc-ticker-stat" style={{ opacity: visible ? 1 : 0 }}>
            {reporting !== null ? `${reporting.toFixed(1)}% rep.` : status}
          </span>
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


