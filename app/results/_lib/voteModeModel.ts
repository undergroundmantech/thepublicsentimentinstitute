// Zone 7 — Remaining Ballot Landscape (CHANGE-ORDER-04 §4b, modeData:true
// races only).
//
// CivicAPI does not publish an Early / VBM / Election Day vote-mode
// breakdown for any race this app consumes (confirmed 2026-07-19 via grep
// across onpoint/ — see /memories/repo/co04-status.md). Per owner decision
// (2026-07-21): ship the section now on a MODELED PLACEHOLDER so it's
// exercised end-to-end ahead of the Nov 3 general, built so a real feed can
// replace only `buildVoteModeRows` below later — the UI component consumes
// `VoteModeRow[]` and doesn't care where the rows came from.
//
// The placeholder deliberately does NOT assert any mode-specific candidate
// lean (that would be fabricated data): every mode is given the race's
// OVERALL projected split (a uniform-behavior assumption). Only the
// remaining-count weighting and the "percent counted so far" curve are
// modeled, using the general real-world pattern that early/mail ballots are
// processed first and Election Day ballots last in most states — that shape
// is a generic property of how vote-counting mechanics work, not a claim
// about this specific race's actual mode mix.

import type { NeedleProjection } from "../components/needleModel";
import { VOTE_MODE_LABELS, type VoteMode } from "./raceState";

export interface VoteModeRow {
  mode: VoteMode;
  estRemaining: number;
  /** 0-100, illustrative — NOT this race's real per-mode reporting figure. */
  pctCounted: number;
  leaderSharePct: number;
  runnerSharePct: number;
}

export const VOTE_MODE_DATA_SOURCE = "modeled-placeholder" as const;

// Illustrative, non-race-specific weights/curve — swap for real per-mode
// remaining-vote counts and reporting percentages once a data source exists.
const MODE_REMAINING_WEIGHT: Record<VoteMode, number> = { EARLY: 0.15, VBM: 0.3, "ELECTION DAY": 0.55 };
const MODE_PCT_COUNTED: Record<VoteMode, number> = { EARLY: 92, VBM: 64, "ELECTION DAY": 28 };

export function buildVoteModeRows(needle: NeedleProjection): VoteModeRow[] {
  return VOTE_MODE_LABELS.map((mode) => ({
    mode,
    estRemaining: Math.round(needle.modeledVoteRemaining * MODE_REMAINING_WEIGHT[mode]),
    pctCounted: MODE_PCT_COUNTED[mode],
    leaderSharePct: needle.leaderProjSharePct,
    runnerSharePct: needle.runnerProjSharePct,
  }));
}

/** The "Why it matters" sentence (§4b) — for a placeholder breakdown, this
 *  IS the honest reading: say plainly that TPSI has no mode-level signal and
 *  is not extrapolating one mode's behavior onto another. */
export function voteModeWhyItMatters(needle: NeedleProjection): string {
  const gapPp = Math.abs(needle.leaderProjSharePct - needle.runnerProjSharePct);
  const closeCall = gapPp < 5;
  const watchNote = closeCall
    ? " Worth watching once a real mode breakdown is available — the race is close enough that a mode-specific swing could matter."
    : "";
  return `CivicAPI does not publish an Early / VBM / Election Day breakdown for this race, so the splits above assume every remaining mode behaves like the race overall.${watchNote} Do not read a surge in one mode as evidence of a swing in another.`;
}
