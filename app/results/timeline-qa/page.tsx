"use client";

// QA / storybook route for CO-04 §4c Zone 6 (Live Timeline). Renders the
// component against synthetic flight-recorder-shaped fixture data so it can
// be visually reviewed while TIMELINE_PUBLIC_FLAG stays off for the public
// race page (per §8 Phase C: "built behind the flag with a fixture-data
// storybook/test route for QA"). Not linked from any nav — visit directly
// at /results/timeline-qa.

import React, { useMemo } from "react";
import DarkNav from "@/app/components/DarkNav";
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
      <div className="tlqa-page">
        <style>{OPA_GLOBAL_CSS}</style>
        <style>{TLQA_CSS}</style>
        <DarkNav />
        <div className="tlqa-shell">
          <span className="tlqa-badge">QA fixture — not real data, not linked from any public nav</span>
          <h1>Zone 6 Live Timeline — storybook</h1>
          <p>
            Synthetic flight-recorder-shaped snapshots exercising the hover-synced charts, gate-region shading,
            and TPSI-call marker while <code>TIMELINE_PUBLIC_FLAG</code> is off. See CHANGE-ORDER-04 §4c / §8 Phase C.
          </p>
          <div className="tlqa-frame">
            <LiveTimeline snapshots={snapshots} needle={NEEDLE} />
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

const TLQA_CSS = `
.tlqa-page { min-height: 100svh; background: var(--page); color: var(--ink); }
.tlqa-shell { max-width: 720px; margin: 0 auto; padding: 40px 24px 100px; font-family: "Instrument Sans", system-ui, sans-serif; }
.tlqa-badge { display: inline-block; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-dim); border: 1px solid var(--rule); border-radius: 99px; padding: 4px 12px; margin-bottom: 18px; }
.tlqa-shell h1 { font-family: "Manrope", sans-serif; font-size: 28px; margin: 0 0 10px; color: var(--ink-strong); }
.tlqa-shell p { color: var(--ink-mute); line-height: 1.6; font-size: 14px; max-width: 62ch; }
.tlqa-shell code { font-family: "JetBrains Mono", ui-monospace, monospace; background: var(--wash); padding: 1px 6px; border-radius: 4px; }
.tlqa-frame { margin-top: 30px; }
`;
