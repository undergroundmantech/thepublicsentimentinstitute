/**
 * RACE CALL RULE — three-sigma decision gate.
 *
 * Adds the missing piece to app/lib/electoralModel.ts. `forecastRace()` already
 * computes `sd_race` (the shrinking uncertainty on the remaining vote) and
 * `projected_margin_votes`. What it does NOT do is turn those into a call.
 * `ForecastOutput` has no call_status field, so nothing in the desk can say
 * "this race is decided" on the model's own authority.
 *
 * THE RULE
 * `pBeats(A, B, sd)` in electoralModel.ts computes phi((A−B) / (sd·√2)).
 * The √2 is there because the difference of two independent normals with the
 * same sigma has variance 2σ². So the z-score of the current margin is:
 *
 *     z = margin_votes / (sd_race · √2)
 *
 * At z ≥ 3 the leader is outside the 99.73% interval on the remaining vote and
 * the race is callable. Because sd_race shrinks as ballots are counted, z rises
 * on two independent tracks: the margin grows, and the uncertainty around what
 * is left collapses. That is the whole mechanism.
 *
 * WHAT THIS MODULE DOES NOT DO
 * It never overrides an AP call. AP's call and a TPSI call are separate claims
 * (Design System §5.7). This produces the TPSI claim only.
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

/* ═══════════════════════════════════════════════════════════════════════════
   TWO BUGS IN electoralModel.ts THAT THIS RULE EXPOSES
   ═══════════════════════════════════════════════════════════════════════════

   BUG 1 — the 0.1 floor freezes sigma at 90% reporting.

   Line ~511:
     sd_race = sd_pre_election * (isRunoffStyle
       ? Math.min(1, scale)
       : Math.max(0.1, Math.min(1, scale)));

   For PLURALITY races the floor of 0.1 means sd_race stops shrinking once the
   remaining vote drops below 10% of the total. Modeled on a 1.1M-turnout
   Michigan primary:

     reporting   remaining     sd_race    margin needed for z=3
        50%       550,000       60,100      254,983   (23.18 pts)
        75%       275,000       30,050      127,491   (11.59 pts)
        90%       110,000       12,020       50,997    (4.64 pts)
        95%        55,000       12,020       50,997    (4.64 pts)   ← frozen
        99%        11,000       12,020       50,997    (4.64 pts)   ← frozen

   From 90% onward the call threshold never moves. Any race closer than 4.64
   points can never be called by the model, no matter how complete the count.
   At 99% reporting the model claims 12,020 votes of uncertainty about an
   outstanding pool of 11,000 ballots, which is more uncertainty than there are
   votes left to be uncertain about.

   FIX: let the floor scale with what is actually outstanding.

     const floor = Math.min(0.1, safeDiv(modeled_vote_remaining, implied_total));
     sd_race = sd_pre_election * (isRunoffStyle
       ? Math.min(1, scale)
       : Math.max(floor, Math.min(1, scale)));

   This preserves the 0.1 floor through the middle of the count, where it does
   useful work damping noisy extrapolation, and releases it in the last 10%
   where it is the only thing preventing a legitimate call.

   Note the separate floor two lines below is fine and should stay:
     if (modeled_vote_remaining > 100_000) sd_race = max(sd_race, remaining/20);
   That one is keyed to the absolute size of the outstanding pool, not a
   fraction, so it releases on its own.


   BUG 2 — divisor discontinuity at exactly 5,000,000 expected turnout.

   Lines ~490-496:
     if (expectedTurnout >= 5_000_000) return 14.5;
     const t = (expectedTurnout - 100_000) / (5_000_000 - 100_000);
     return 6.5 + t * (19.5 - 6.5);

   The interpolation ramps toward 19.5 but the clamp above it returns 14.5:

     turnout 4,999,999  →  divisor 19.50
     turnout 5,000,000  →  divisor 14.50

   A single additional expected voter widens sd_race by 34%. One of the two
   constants is wrong. If the ceiling is meant to be 14.5, the interpolation
   target must also be 14.5. If the ramp to 19.5 is intended, the clamp must
   return 19.5. Nothing tonight has 5M turnout, so this is not urgent, but it
   will misfire on a general election.

   ═══════════════════════════════════════════════════════════════════════════ */
