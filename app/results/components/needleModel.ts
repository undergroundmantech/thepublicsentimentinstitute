"use client";

// The needle's numbers come from THE site forecast engine
// (app/lib/electoralModel.ts — Dustin's model, same file main ships and the
// same methodology the /results/forecast page and the precinct app's
// ForecastNeedle run). This adapter mirrors the precinct app's
// projectFromCivic: sort by votes, tonePalette the colors, run
// civicToForecastInput + forecastRace, and read the two-way win odds +
// projected margin off the output. No hand-rolled math.

import { civicToForecastInput, forecastRace, type CivicRace } from "@/app/lib/electoralModel";
import { tonePalette } from "../onpoint/electionLib.js";

const KEY_IDX: Record<string, number> = { Candidate1: 0, Candidate2: 1, Candidate3: 2 };

export interface NeedleProjection {
  leaderName: string;
  runnerName: string;
  leaderColor: string;
  runnerColor: string;
  /** P(leader wins the two-way), 0..1 — from plurality_odds_to_win. */
  pLeader: number;
  pRunner: number;
  /** PROJECTED margin (pp) from the engine — not the raw current margin. */
  marginPp: number;
  /** Raw current-reported margin (pp), for the "±N.N vs current" chip. */
  currentMarginPp: number;
  /** PROJECTED FINAL SHARE (0-100), same scale as the reported bars. */
  leaderProjSharePct: number;
  runnerProjSharePct: number;
  /** Current reported share (0-100), for the "±N.N vs current" delta chips. */
  leaderCurrentSharePct: number;
  runnerCurrentSharePct: number;
  reporting: number;
  /**
   * Share of the REMAINING (uncounted) vote the runner-up needs to catch the
   * leader, 0-100. null when reporting is ~complete (no remaining vote left
   * to compute against) or when the runner-up cannot mathematically catch up
   * even by winning 100% of what's left (leader has clinched).
   */
  flipThresholdPct: number | null;
  /** Model statistics grid (CO-04 §3 Zone 2 OPTIONS drawer). */
  modeledTotalVote: number;
  modeledVoteRemaining: number;
  /**
   * Standard deviation of the PROJECTED MARGIN (leader minus runner-up),
   * in percentage points. Derived from the engine's sd_race (a single
   * candidate's vote-count sd): pBeats() in electoralModel.ts treats the
   * margin as Normal(mean, (sd_race*sqrt(2))^2), so marginSd = sd_race*sqrt(2)
   * converted from votes to a share of modeledTotalVote.
   */
  marginSdPp: number;
  modeTrigger: "PLURALITY" | "MAJORITY" | "RUNOFF";
  /** Only meaningful for MAJORITY_RUNOFF / THRESHOLD_* race rules. */
  runoffNeededProb: number;
}

export function needleFromRace(race: any): NeedleProjection | null {
  if (!race || !Array.isArray(race.candidates)) return null;
  const cands = race.candidates.filter((c: any) => c && c.name);
  if (cands.length < 2) return null;

  const sorted = [...cands].sort((a: any, b: any) => (Number(b.votes) || 0) - (Number(a.votes) || 0));
  const colors = tonePalette(sorted as any) as string[];
  const pctReporting = Number(race.percent_reporting) || 0;

  const cr: CivicRace = {
    election_name: String(race.election_name || ""),
    election_type: String(race.election_type || ""),
    election_date: String(race.election_date || ""),
    country: String(race.country || "US"),
    province: race.province ?? null,
    district: race.district ?? null,
    municipality: race.municipality ?? null,
    percent_reporting: pctReporting,
    registered_voters: Number(race.registered_voters) || 0,
    last_updated: String(race.last_updated || ""),
    candidates: sorted.map((c: any) => ({
      name: String(c.name),
      party: String(c.party || ""),
      color: String(c.color || ""),
      votes: Number(c.votes) || 0,
      percent: Number(c.percent) || 0,
      winner: !!c.winner,
    })),
  };

  try {
    const names = sorted.slice(0, 3).map((c: any) => String(c.name));
    const out = forecastRace(civicToForecastInput(cr), names, colors.slice(0, 3));
    const li = KEY_IDX[out.leader] ?? 0;
    const ri = KEY_IDX[out.runner_up] ?? 1;
    const oddsL = out.plurality_odds_to_win[out.leader] ?? 0;
    const oddsR = out.plurality_odds_to_win[out.runner_up] ?? 0;
    const twoWay = oddsL + oddsR;
    const pLeader = twoWay > 0 ? oddsL / twoWay : 0.5;
    return {
      leaderName: String(cr.candidates[li]?.name || "Leader"),
      runnerName: String(cr.candidates[ri]?.name || "Runner-up"),
      leaderColor: colors[li] || "#dc2626",
      runnerColor: colors[ri] || "#8e6df0",
      pLeader,
      pRunner: 1 - pLeader,
      marginPp: Math.abs(out.projected_margin_pct) * 100,
      currentMarginPp: Math.abs((cr.candidates[li]?.percent ?? 0) - (cr.candidates[ri]?.percent ?? 0)),
      leaderProjSharePct: (out.modeled_share[out.leader] ?? 0) * 100,
      runnerProjSharePct: (out.modeled_share[out.runner_up] ?? 0) * 100,
      leaderCurrentSharePct: Number(cr.candidates[li]?.percent) || 0,
      runnerCurrentSharePct: Number(cr.candidates[ri]?.percent) || 0,
      reporting: pctReporting,
      flipThresholdPct: flipThreshold(cr.candidates[li]?.votes ?? 0, cr.candidates[ri]?.votes ?? 0, pctReporting),
      modeledTotalVote: out.modeled_total_vote,
      modeledVoteRemaining: out.modeled_vote_remaining,
      marginSdPp: out.modeled_total_vote > 0 ? ((out.sd_race * Math.SQRT2) / out.modeled_total_vote) * 100 : 0,
      modeTrigger: out.mode_trigger,
      runoffNeededProb: out.runoff_needed_prob,
    };
  } catch {
    return null;
  }
}

/**
 * The share of the REMAINING vote a trailing candidate needs to tie the
 * leader. Derived from: remaining = estimatedTotal - currentTotal (via the
 * same percent-reporting extrapolation as calculateWinProbability in
 * app/results/_lib/raceState.ts); solving leaderVotes + (1-f)*remaining ==
 * runnerVotes + f*remaining for f gives f = 0.5 + gap / (2*remaining).
 */
function flipThreshold(leaderVotes: number, runnerVotes: number, percentReporting: number): number | null {
  if (percentReporting >= 99 || percentReporting <= 0) return null;
  const currentTotal = leaderVotes + runnerVotes;
  if (currentTotal <= 0) return null;
  const estimatedTotal = currentTotal / (percentReporting / 100);
  const remaining = estimatedTotal - currentTotal;
  if (remaining <= 0) return null;
  const gap = leaderVotes - runnerVotes;
  const f = 0.5 + gap / (2 * remaining);
  if (f >= 1) return null; // leader has clinched — no path exists even at 100% of remainder
  return Math.max(0, Math.min(100, f * 100));
}
