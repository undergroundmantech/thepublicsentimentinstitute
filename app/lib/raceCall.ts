/**
 * RACE CALL RULE — three-sigma decision gate. (CO-07 addendum §2)
 *
 * `forecastRace()` computes `sd_race` (the shrinking uncertainty on the
 * remaining vote) and `projected_margin_votes` but never turns them into a
 * verdict. This module does.
 *
 * `pBeats(A, B, sd)` in electoralModel.ts computes phi((A−B) / (sd·√2)); the
 * √2 is there because the difference of two independent normals with the same
 * sigma has variance 2σ². So the z-score of the current margin is:
 *
 *     z = margin_votes / (sd_race · √2)
 *
 * At z ≥ 3 the leader is outside the 99.73% interval on the remaining vote and
 * the race is callable. sd_race shrinks as ballots are counted, so z rises on
 * two tracks: the margin grows, and the uncertainty about what is left
 * collapses.
 *
 * This never overrides an AP call. AP's call and a TPSI call are separate
 * claims (Design System §5.7); this produces the TPSI claim only.
 */

import type { ForecastOutput, CandidateKey } from "./electoralModel";

/** z ≥ 3.0 → 99.73%. The decision gate. */
export const CALL_SIGMA = 3.0;

/** z ≥ 2.0 → 95.45%. Not a call. Lets the desk say "leaning" honestly. */
export const LEAN_SIGMA = 2.0;

/**
 * Never call before this much of the expected vote is in, regardless of z.
 * Early returns are compositionally unrepresentative: whichever counties report
 * first are not a random sample. A 40-point lead on 3% of the vote out of one
 * county is not evidence, and the math cannot see that it isn't.
 */
export const MIN_REPORTING_TO_CALL = 0.35;

export type CallVerdict = "TOO_EARLY" | "LEANING" | "CALLABLE";

export interface RaceCall {
  verdict: CallVerdict;
  /** Standard deviations the current margin sits beyond even. */
  z: number;
  /** Two-candidate margin in votes, leader minus runner-up. */
  marginVotes: number;
  /** Margin needed right now to reach z = 3. */
  marginToCall: number;
  /** Additional votes of margin still needed. 0 once callable. */
  marginGap: number;
  leader: CandidateKey;
  /** Present only when the gate blocks a call the math would otherwise allow. */
  blockedBy?: "MIN_REPORTING" | "NO_REMAINING_VOTE";
  /** Ready-to-render sentence for the desk. */
  line: string;
}

/**
 * Evaluate whether the model can call the race.
 *
 * @param f            output of forecastRace()
 * @param names        display names keyed to Candidate1..3, optional
 * @param minReporting override the reporting gate for a race with a known
 *                     reporting pattern, e.g. an all-mail state
 */
export function evaluateCall(
  f: ForecastOutput,
  names?: Partial<Record<CandidateKey, string>>,
  minReporting: number = MIN_REPORTING_TO_CALL
): RaceCall {
  const marginVotes = Math.abs(f.projected_margin_votes);
  const sd = f.sd_race;
  const leaderName = names?.[f.leader] ?? String(f.leader);

  // sd_race can legitimately reach 0 once every ballot is counted.
  if (sd <= 0) {
    return {
      verdict: f.modeled_vote_remaining <= 0 ? "CALLABLE" : "TOO_EARLY",
      z: Infinity,
      marginVotes,
      marginToCall: 0,
      marginGap: 0,
      leader: f.leader,
      blockedBy: f.modeled_vote_remaining > 0 ? "NO_REMAINING_VOTE" : undefined,
      line:
        f.modeled_vote_remaining <= 0
          ? `${leaderName} wins. All expected vote counted.`
          : `Uncertainty collapsed with ballots outstanding. Holding.`,
    };
  }

  const denom = sd * Math.SQRT2;
  const z = marginVotes / denom;
  const marginToCall = CALL_SIGMA * denom;
  const marginGap = Math.max(0, marginToCall - marginVotes);

  const reportingOk = f.modeled_percent_reporting >= minReporting;
  const mathSaysCall = z >= CALL_SIGMA;

  let verdict: CallVerdict;
  let blockedBy: RaceCall["blockedBy"];

  if (mathSaysCall && reportingOk) {
    verdict = "CALLABLE";
  } else if (mathSaysCall && !reportingOk) {
    verdict = "TOO_EARLY";
    blockedBy = "MIN_REPORTING";
  } else if (z >= LEAN_SIGMA) {
    verdict = "LEANING";
  } else {
    verdict = "TOO_EARLY";
  }

  const pct = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

  let line: string;
  if (verdict === "CALLABLE") {
    line = `${leaderName} leads by ${pct(marginVotes)} votes, ${z.toFixed(1)} standard deviations beyond the remaining vote. Callable.`;
  } else if (blockedBy === "MIN_REPORTING") {
    line = `${leaderName}'s lead clears three standard deviations, but only ${(f.modeled_percent_reporting * 100).toFixed(1)}% of the expected vote is in. Holding until ${(minReporting * 100).toFixed(0)}%.`;
  } else if (verdict === "LEANING") {
    line = `${leaderName} leads by ${pct(marginVotes)} votes, ${z.toFixed(1)} standard deviations. Needs ${pct(marginGap)} more to be callable.`;
  } else {
    line = `${leaderName} leads by ${pct(marginVotes)} votes. The remaining ${pct(f.modeled_vote_remaining)} ballots could still move this. Too early.`;
  }

  return { verdict, z, marginVotes, marginToCall, marginGap, leader: f.leader, blockedBy, line };
}
