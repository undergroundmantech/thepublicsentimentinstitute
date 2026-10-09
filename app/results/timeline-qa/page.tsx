"use client";

// QA / storybook route for CO-04 §4c Zone 6 (Live Timeline). Renders the
// component against synthetic flight-recorder-shaped fixture data so it can
// be visually reviewed while TIMELINE_PUBLIC_FLAG stays off for the public
// race page (per §8 Phase C: "built behind the flag with a fixture-data
// storybook/test route for QA"). Not linked from any nav — visit directly
// at /results/timeline-qa.

import React, { useMemo } from "react";
import { ThemeProvider } from "../onpoint/lib/theme.jsx";
import { OPA_GLOBAL_CSS } from "../onpoint/OpaResultsPage.jsx";
import LiveTimeline from "../race/[id]/deck/LiveTimeline";
import type { FlightRecorderSnapshot } from "../_lib/flightRecorder";

const FIXTURE_LEADER = "A. Rivera";
const FIXTURE_RUNNER = "J. Castillo";
const NEEDLE = {
  leaderName: FIXTURE_LEADER,
  runnerName: FIXTURE_RUNNER,
  leaderColor: "#dc2626",
  runnerColor: "#2563eb",
};

/** Synthetic ~45-minute election-night arc: reporting climbs 0→100, win
 *  probability starts near a toss-up and converges as the leader's margin
 *  holds, projected shares narrow toward a "final" outcome, and the race is
 *  called (PROJECTED) once reporting clears ~70%. Not real data — QA
 *  fixture only. */
function buildFixtureSnapshots(n = 45): FlightRecorderSnapshot[] {
  const start = Date.now() - n * 60_000;
  const finalLeaderShare = 54.2;
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const percentReporting = Math.min(100, Math.round(100 * Math.pow(t, 0.6)));
    const convergence = Math.min(1, percentReporting / 60);
    const leaderShare = 50 + (finalLeaderShare - 50) * convergence;
    const runnerShare = 100 - leaderShare;
    const leaderWinProb = 50 + (99 - 50) * Math.pow(convergence, 1.6);
    const runnerWinProb = 100 - leaderWinProb;
    const raceState: FlightRecorderSnapshot["raceState"] =
      percentReporting <= 0 ? "SCHEDULED" : percentReporting < 10 ? "LIVE_GATED" : percentReporting < 70 ? "LIVE_FORECAST" : "PROJECTED";
    return {
      ts: new Date(start + i * 60_000).toISOString(),
      raceState,
      percentReporting,
      candidates: [
        { name: FIXTURE_LEADER, votes: Math.round(percentReporting * 1200), winProbPct: leaderWinProb },
        { name: FIXTURE_RUNNER, votes: Math.round(percentReporting * 1010), winProbPct: runnerWinProb },
      ],
      projectedMarginPp: leaderShare - runnerShare,
      projectedLeaderSharePct: leaderShare,
      projectedRunnerSharePct: runnerShare,
      remainingVoteEst: Math.round((100 - percentReporting) * 900),
    };
  });
}

export default function TimelineQAPage() {
  const snapshots = useMemo(() => buildFixtureSnapshots(), []);
  return (
    <ThemeProvider>
      <div className="opp tlqa-page">
        <style>{OPA_GLOBAL_CSS}</style>
        <style>{TLQA_CSS}</style>
        <div className="tlqa-shell">
          <nav className="crumbs" aria-label="Breadcrumb">
            <a href="/">Home</a><span className="sep">/</span>
            <a href="/results">Results</a><span className="sep">/</span>
            <span>Timeline QA</span>
          </nav>
          <header className="ph">
            <div className="eye">QA fixture · not real data · not linked from any public nav</div>
            <h1>Live timeline <em>storybook</em></h1>
            <p className="lede">
              Synthetic flight recorder snapshots exercising the hover synced charts, gate region shading
              and projection marker while <code>TIMELINE_PUBLIC_FLAG</code> is off. See CHANGE-ORDER-04 §4c and §8 Phase C.
            </p>
          </header>
          <div className="tlqa-frame">
            <LiveTimeline snapshots={snapshots} needle={NEEDLE} />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

const TLQA_CSS = `
.opp .tlqa-shell { max-width: 760px; }
.opp .tlqa-shell code { font-family: var(--font-m); background: var(--glass2); padding: 1px 6px; border-radius: 4px; }
.opp .tlqa-frame { margin-top: 24px; }
`;
