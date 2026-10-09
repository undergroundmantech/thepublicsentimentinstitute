"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getRaceUrl } from "../_data/raceRegistry";

const CIVIC_BASE = "https://civicapi.org";
const POLL_MS = 30_000;

// ── SPOTLIGHT RACES ──────────────────────────────────────────────────────────
const SPOTLIGHT: Array<{
  id: number;
  shortLabel: string;
  fullLabel: string;
  party: "R" | "D" | "I";
  state: string;
  pollLeader: string;
  pollShare: number;
  note?: string;
}> = [
  { id: 82664, shortLabel: "SC US Senate",   fullLabel: "South Carolina US Senate Republican Primary", party: "R", state: "SC", pollLeader: "Graham",  pollShare: 51, note: "Majority (50%+1) or runoff June 23" },
  { id: 82596, shortLabel: "SC Governor",     fullLabel: "South Carolina Governor Republican Primary",  party: "R", state: "SC", pollLeader: "Evette",   pollShare: 35, note: "Majority (50%+1) or runoff June 23" },
  { id: 83063, shortLabel: "ME US Senate",    fullLabel: "Maine US Senate Democratic Primary",           party: "D", state: "ME", pollLeader: "Platner",  pollShare: 66 },
  { id: 82693, shortLabel: "ME Governor",     fullLabel: "Maine Governor Democratic Primary",            party: "D", state: "ME", pollLeader: "Pingree",  pollShare: 32, note: "Ranked-choice · full tally days later" },
];

// ── ALL RACES TONIGHT ─────────────────────────────────────────────────────────
const STATE_GROUPS: Array<{
  state: string;
  label: string;
  races: Array<{ id: number; label: string; party: "R" | "D" | "I" }>;
}> = [
  { state: "SC", label: "South Carolina", races: [
    { id: 82664, label: "US Senate",          party: "R" },
    { id: 82596, label: "Governor",            party: "R" },
    { id: 82592, label: "Attorney General",    party: "R" },
    { id: 82655, label: "US House 1",          party: "R" },
    { id: 82657, label: "US House 2",          party: "R" },
    { id: 82662, label: "US House 6",          party: "R" },
    { id: 82663, label: "US Senate",           party: "D" },
    { id: 82595, label: "Governor",            party: "D" },
    { id: 82654, label: "US House 1",          party: "D" },
    { id: 82594, label: "Comptroller General", party: "D" },
    { id: 82597, label: "Secretary of State",  party: "D" },
  ]},
  { state: "ME", label: "Maine", races: [
    { id: 83063, label: "US Senate",   party: "D" },
    { id: 82693, label: "Governor",    party: "D" },
    { id: 83061, label: "US House 2",  party: "D" },
    { id: 82694, label: "Governor",    party: "R" },
  ]},
  { state: "NV", label: "Nevada", races: [
    { id: 83111, label: "Governor",           party: "R" },
    { id: 83081, label: "Attorney General",    party: "R" },
    { id: 83113, label: "Secretary of State",  party: "R" },
    { id: 83150, label: "US House 1",          party: "R" },
    { id: 83110, label: "Governor",            party: "D" },
    { id: 83080, label: "Attorney General",    party: "D" },
    { id: 83112, label: "Lt. Governor",        party: "D" },
    { id: 83149, label: "US House 1",          party: "D" },
  ]},
  { state: "ND", label: "North Dakota", races: [
    { id: 82403, label: "US House At-Large",           party: "R" },
    { id: 82384, label: "Public Service Commissioner", party: "R" },
  ]},
];

type CivicCandidate = { name: string; percent?: number; votes?: number };
type CivicData = {
  percent_reporting?: number;
  polls_close?: string | null;
  polls_open?: string | null;
  candidates?: CivicCandidate[];
};

function lastName(full: string) {
  return full.trim().split(/\s+/).slice(-1)[0];
}

function getLeaderStat(
  data: CivicData | undefined,
  pollLeader: string,
  pollShare: number
): { label: string; live: boolean } {
  const pct = data?.percent_reporting ?? 0;
  if (pct > 0.05 && data?.candidates?.length) {
    const sorted = [...data.candidates].sort((a, b) => (b.percent ?? 0) - (a.percent ?? 0));
    const top = sorted[0];
    return {
      label: `${lastName(top.name)} ${(top.percent ?? 0).toFixed(1)}%  ·  ${pct.toFixed(1)}% rep.`,
      live: true,
    };
  }
  return { label: `${pollLeader} ${pollShare}% polling`, live: false };
}

interface Props {
  onRaceSelect: (id: number) => void;
}

export default function ResultsLanding({ onRaceSelect }: Props) {
  const [liveData, setLiveData] = useState<Record<number, CivicData>>({});

  useEffect(() => {
    const allIds = [
      ...SPOTLIGHT.map(r => r.id),
      ...STATE_GROUPS.flatMap(g => g.races.map(r => r.id)),
    ];
    const uniqueIds = [...new Set(allIds)];

    async function fetchAll() {
      await Promise.all(uniqueIds.map(async id => {
        try {
          const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
          if (!res.ok) return;
          const d: CivicData = await res.json();
          setLiveData(prev => ({ ...prev, [id]: d }));
        } catch {}
      }));
    }

    fetchAll();
    const t = setInterval(fetchAll, POLL_MS);
    return () => clearInterval(t);
  }, []);

  function getReporting(id: number) {
    return liveData[id]?.percent_reporting ?? 0;
  }

  const anyLive = Object.values(liveData).some(d => (d.percent_reporting ?? 0) > 0.05);

  return (
    <>
      <style>{`
        @keyframes rl-pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes rl-fadein { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:none} }

        .rl-root {
          min-height: 100%;
          padding: 32px 24px 64px;
          max-width: 900px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: 28px;
          animation: rl-fadein 0.45s var(--ease-soft) both;
        }

        /* ── HERO HEADER ── */
        .rl-hero {
          display: flex;
          flex-direction: column;
          gap: 6px;
          padding-bottom: 20px;
          border-bottom: 1px solid var(--border);
        }
        .rl-hero-eyebrow {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--purple-soft);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .rl-live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--win);
          animation: rl-pulse 1.6s ease-in-out infinite;
          flex-shrink: 0;
        }
        .rl-live-badge {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 1px 8px;
          background: rgba(22,163,74,0.10);
          border: 1px solid rgba(22,163,74,0.28);
          border-radius: var(--r-pill);
          font-family: var(--font-body);
          font-size: 9px; font-weight: 700; letter-spacing: 0.14em;
          color: var(--win);
          text-transform: uppercase;
        }
        .rl-hero-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 700;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--foreground);
          line-height: 1.1;
          margin: 0;
        }
        .rl-hero-title em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .rl-hero-sub {
          font-family: var(--font-body);
          font-size: 12px;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin-top: 2px;
        }

        /* ── SECTION LABEL ── */
        .rl-section-label {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--purple-soft);
          margin-bottom: 12px;
        }

        /* ── SPOTLIGHT GRID ── */
        .rl-spotlight-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        @media (max-width: 540px) {
          .rl-spotlight-grid { grid-template-columns: 1fr; }
        }
        .rl-spotlight-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 16px 18px;
          cursor: pointer;
          transition: border-color 140ms, box-shadow 140ms, transform 140ms;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .rl-spotlight-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 3px;
          height: 100%;
          border-radius: var(--r-lg) 0 0 var(--r-lg);
        }
        .rl-spotlight-card.party-r::before { background: var(--rep); }
        .rl-spotlight-card.party-d::before { background: var(--dem); }
        .rl-spotlight-card:hover {
          border-color: var(--border2);
          box-shadow: var(--shadow-md);
          transform: translateY(-1px);
        }
        .rl-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 8px;
        }
        .rl-card-state-badge {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          padding: 2px 7px;
          border-radius: var(--r-pill);
          flex-shrink: 0;
        }
        .party-r .rl-card-state-badge { background: rgba(230,57,70,0.10); border: 1px solid rgba(230,57,70,0.25); color: var(--rep); }
        .party-d .rl-card-state-badge { background: rgba(37,99,235,0.10); border: 1px solid rgba(37,99,235,0.25); color: var(--dem); }
        .rl-card-reporting {
          font-family: var(--font-numeric);
          font-size: 9px;
          color: var(--muted2);
          letter-spacing: 0.06em;
          flex-shrink: 0;
        }
        .rl-card-reporting.live { color: var(--win); }
        .rl-card-label {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--foreground);
          line-height: 1.3;
        }
        .rl-card-leader {
          font-family: var(--font-numeric);
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.04em;
          color: var(--foreground2);
        }
        .rl-card-leader.live { color: var(--win); }
        .rl-card-note {
          font-family: var(--font-body);
          font-size: 9.5px;
          color: var(--muted2);
          letter-spacing: 0.02em;
          border-top: 1px solid var(--border);
          padding-top: 8px;
          margin-top: 2px;
        }
        .rl-card-cta {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--purple-soft);
          display: flex;
          align-items: center;
          gap: 4px;
          margin-top: auto;
        }

        /* ── ALL RACES PANEL ── */
        .rl-all-panel {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          overflow: hidden;
          position: relative;
        }
        .rl-all-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 20px;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          border-radius: var(--r-lg) var(--r-lg) 0 0;
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          padding: 2.5px 2.5px 0 2.5px;
          pointer-events: none;
          z-index: 2;
        }
        .rl-all-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--border);
          background: var(--panel2);
        }
        .rl-all-header-tag {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }
        .rl-all-body {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .rl-state-group {}
        .rl-state-label {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 8px;
          padding-bottom: 5px;
          border-bottom: 1px solid var(--border);
        }
        .rl-race-rows {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rl-race-row {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 10px;
          border-radius: var(--r-sm);
          cursor: pointer;
          transition: background 100ms;
          text-decoration: none;
        }
        .rl-race-row:hover { background: var(--panel2); }
        .rl-race-dot {
          width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
        }
        .rl-race-dot.party-r { background: var(--rep); }
        .rl-race-dot.party-d { background: var(--dem); }
        .rl-race-row-label {
          font-family: var(--font-body);
          font-size: 11px;
          color: var(--foreground2);
          flex: 1;
        }
        .rl-race-row-pct {
          font-family: var(--font-numeric);
          font-size: 10px;
          color: var(--muted2);
          flex-shrink: 0;
        }
        .rl-race-row-pct.live { color: var(--win); }
        .rl-race-party-tag {
          font-family: var(--font-body);
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          padding: 1px 5px;
          border-radius: 3px;
          flex-shrink: 0;
        }
        .rl-race-party-tag.party-r { background: rgba(230,57,70,0.10); color: var(--rep); }
        .rl-race-party-tag.party-d { background: rgba(37,99,235,0.10); color: var(--dem); }

        /* ── ARCHIVE BANNER ── */
        .rl-archive-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 18px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          text-decoration: none;
          transition: border-color 140ms;
        }
        .rl-archive-bar:hover { border-color: var(--border2); }
        .rl-archive-bar-left {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .rl-archive-bar-label {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted2);
        }
        .rl-archive-bar-dates {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--foreground2);
        }
        .rl-archive-bar-arrow {
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }

        /* ── DASHBOARD BUTTON ── */
        .rl-dashboard-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 11px 24px;
          background: var(--gradient-purple);
          border: 1px solid rgba(124,58,237,0.65);
          color: #fff;
          font-family: var(--font-numeric);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          border-radius: var(--r-pill);
          box-shadow: var(--shadow-purple);
          cursor: pointer;
          transition: opacity 140ms, transform 140ms;
          text-decoration: none;
        }
        .rl-dashboard-btn:hover { opacity: 0.88; transform: translateY(-1px); color: #fff; text-decoration: none; }
      `}</style>

      <div className="rl-root">

        {/* ── HERO ── */}
        <div className="rl-hero">
          <div className="rl-hero-eyebrow">
            <span className="rl-live-dot" />
            <span>The Public Sentiment Institute</span>
            {anyLive && <span className="rl-live-badge"><span className="rl-live-dot" />Live</span>}
          </div>
          <h1 className="rl-hero-title">
            June 9, 2026<br />
            <em>Primary Results</em>
          </h1>
          <p className="rl-hero-sub">
            South Carolina · Maine · Nevada · North Dakota — Polls close 7–8 PM ET
          </p>
        </div>

        {/* ── SPOTLIGHT RACES ── */}
        <div>
          <div className="rl-section-label">Spotlight Races</div>
          <div className="rl-spotlight-grid">
            {SPOTLIGHT.map(race => {
              const { label: leaderLabel, live } = getLeaderStat(liveData[race.id], race.pollLeader, race.pollShare);
              const rep = getReporting(race.id);
              const url = getRaceUrl(race.id) ?? `/results?race=${race.id}`;
              return (
                <div
                  key={race.id}
                  className={`rl-spotlight-card party-${race.party.toLowerCase()}`}
                  onClick={() => onRaceSelect(race.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => e.key === "Enter" && onRaceSelect(race.id)}
                >
                  <div className="rl-card-top">
                    <span className="rl-card-state-badge">{race.party === "R" ? "Republican" : "Democratic"} · {race.state}</span>
                    {rep > 0.05 ? (
                      <span className="rl-card-reporting live">{rep.toFixed(1)}% rep.</span>
                    ) : (
                      <span className="rl-card-reporting">Pre-results</span>
                    )}
                  </div>
                  <div className="rl-card-label">{race.shortLabel}</div>
                  <div className={`rl-card-leader${live ? " live" : ""}`}>{leaderLabel}</div>
                  {race.note && <div className="rl-card-note">{race.note}</div>}
                  <div className="rl-card-cta">Open Dashboard →</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── ALL RACES TONIGHT ── */}
        <div className="rl-all-panel">
          <div className="rl-all-header">
            <span className="rl-all-header-tag">All Races Tonight</span>
            <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--muted2)", letterSpacing: "0.06em" }}>
              {STATE_GROUPS.reduce((n, g) => n + g.races.length, 0)} races across 4 states
            </span>
          </div>
          <div className="rl-all-body">
            {STATE_GROUPS.map(group => (
              <div key={group.state} className="rl-state-group">
                <div className="rl-state-label">{group.label}</div>
                <div className="rl-race-rows">
                  {group.races.map(race => {
                    const rep = getReporting(race.id);
                    return (
                      <div
                        key={race.id}
                        className="rl-race-row"
                        onClick={() => onRaceSelect(race.id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={e => e.key === "Enter" && onRaceSelect(race.id)}
                      >
                        <span className={`rl-race-dot party-${race.party.toLowerCase()}`} />
                        <span className="rl-race-row-label">{race.label}</span>
                        <span className={`rl-race-party-tag party-${race.party.toLowerCase()}`}>{race.party}</span>
                        {rep > 0.05 && (
                          <span className="rl-race-row-pct live">{rep.toFixed(1)}%</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── ARCHIVE BANNER ── */}
        <Link href="/results/archive" className="rl-archive-bar">
          <div className="rl-archive-bar-left">
            <span className="rl-archive-bar-label">Past Elections</span>
            <span className="rl-archive-bar-dates">Texas May 26  ·  CA / IA / MT / NJ / NM / SD June 2</span>
          </div>
          <span className="rl-archive-bar-arrow">View Archive →</span>
        </Link>

      </div>
    </>
  );
}
