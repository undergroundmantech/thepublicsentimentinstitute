// lib/electoralModel.ts

export type RaceRule =
  | "PLURALITY"           // highest vote-getter wins
  | "MAJORITY"            // 50%+ to win; otherwise runoff (TX-style)
  | "RANKED_CHOICE"       // RCV: elimination rounds until 50%+ (same math as MAJORITY, different UX labels)
  | "TOP_TWO"             // CA open primary: top 2 advance regardless of share
  | "MAJORITY_RUNOFF"     // 50%+ wins outright; otherwise top-2 municipal runoff (LA Mayor)
  | "THRESHOLD_35_CONVENTION" // IA: leader must clear 35% or party convention decides
  | "THRESHOLD_35_RUNOFF";    // SD: leader must clear 35% or top-2 runoff 8 weeks later

export type CandidateKey = "Candidate1" | "Candidate2" | "Candidate3" | "Others";
export type MainCandidateKey = "Candidate1" | "Candidate2" | "Candidate3";

export type Shares3 = Record<MainCandidateKey, number>;
export type Shares4 = Record<CandidateKey, number>;
export type Votes4 = Record<CandidateKey, number>;

// ── CivicAPI → ForecastInput conversion ─────────────────────────────────────

export interface CivicCandidate {
  name: string;
  party: string;
  color: string;
  votes: number;
  percent: number;
  winner: boolean;
  incumbent?: boolean;
  major_candidate?: boolean;
}

export interface CivicRace {
  election_name: string;
  election_type: string;
  election_date: string;
  country: string;
  province: string | null;
  district: string | null;
  municipality: string | null;
  percent_reporting: number;
  registered_voters: number;
  last_updated: string;
  candidates: CivicCandidate[];
  is_disputed?: boolean;
}

export function civicToForecastInput(
  current: CivicRace,
  prior?: CivicRace,
  race_rule: RaceRule = "PLURALITY",
  expected_turnout?: number,
  poll_avg?: Record<string, number>,
  turnout_blend_k?: number,
  preSortedTop3?: CivicCandidate[]  // ← caller-sorted top3; eliminates dual-sort divergence
): ForecastInput {
  const pct = Math.min(1, (current.percent_reporting ?? 0) / 100);
  const totalReported = current.candidates.reduce((s, c) => s + c.votes, 0);

  const topCandidates = preSortedTop3 ?? (poll_avg
    ? sortByPollAvg(current.candidates, poll_avg).slice(0, 3)
    : [...current.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3));

  const reported_share: Shares3 = {
    Candidate1: totalReported > 0 ? (topCandidates[0]?.votes ?? 0) / totalReported : 0,
    Candidate2: totalReported > 0 ? (topCandidates[1]?.votes ?? 0) / totalReported : 0,
    Candidate3: totalReported > 0 ? (topCandidates[2]?.votes ?? 0) / totalReported : 0,
  };

  let expected_share: Shares3;

  if (poll_avg && Object.keys(poll_avg).length > 0) {
    const pollShares = buildPollAvgShares(topCandidates, poll_avg);
    if (pct < 0.05) {
      expected_share = pollShares;
    } else {
      // ── Factor 1: Poll prior, calibrated against live results ───────────────
      // As votes come in, measure poll-vs-actual divergence and bend the poll
      // prior toward the observed reality. β grows from 0→0.65 as reporting
      // goes from 10%→100%, so polls are fully trusted early and progressively
      // corrected late. This handles races where polls were systematically off.
      const pollWeight = Math.max(0, 1 - (pct / 0.97));

      let f1: Shares3 = pollShares;
      if (pct >= 0.10) {
        const β = Math.min(0.65, (pct - 0.10) / 1.35);
        const adj = [
          pollShares.Candidate1 > 0.005
            ? pollShares.Candidate1 * Math.pow(safeDiv(reported_share.Candidate1, pollShares.Candidate1), β)
            : reported_share.Candidate1,
          pollShares.Candidate2 > 0.005
            ? pollShares.Candidate2 * Math.pow(safeDiv(reported_share.Candidate2, pollShares.Candidate2), β)
            : reported_share.Candidate2,
          pollShares.Candidate3 > 0.005
            ? pollShares.Candidate3 * Math.pow(safeDiv(reported_share.Candidate3, pollShares.Candidate3), β)
            : reported_share.Candidate3,
        ].map(v => Math.max(0, v));
        const adjSum = adj[0] + adj[1] + adj[2];
        if (adjSum > 0.01) {
          f1 = { Candidate1: adj[0] / adjSum, Candidate2: adj[1] / adjSum, Candidate3: adj[2] / adjSum };
        }
      }

      // ── Factor 2: Current reported results ──────────────────────────────────
      const f2: Shares3 = reported_share;

      // ── Factor 3: Trend signal from prior snapshot ───────────────────────────
      // Weak signal — vote dumps are typically cohesive geographic or method
      // blocks (mail-in, one county), so the trend may not represent remaining
      // voters. A large dump penalty discounts trend when a big chunk arrived
      // at once. Weight is capped at 0.18 and fades above 85% reporting.
      let f3: Shares3 | null = null;
      let trendWeight = 0;

      if (prior && pct >= 0.10) {
        const priorPct = Math.min(1, (prior.percent_reporting ?? 0) / 100);
        const priorTotal = prior.candidates.reduce((s, c) => s + c.votes, 0);

        if (priorTotal > 0 && priorPct < pct) {
          // Match prior candidates to current top3 by name (fuzzy last-name match)
          const priorShareOf = (target: CivicCandidate): number => {
            const targetLast = target.name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
            const match = prior!.candidates.find(pc => {
              const pcLast = pc.name.trim().split(/\s+/).pop()?.toLowerCase() ?? "";
              return pc.name === target.name || pcLast === targetLast;
            });
            return match ? safeDiv(match.votes, priorTotal) : 0;
          };

          const priorShares: Shares3 = {
            Candidate1: priorShareOf(topCandidates[0]!),
            Candidate2: priorShareOf(topCandidates[1]!),
            Candidate3: priorShareOf(topCandidates[2]!),
          };

          const Δ1 = reported_share.Candidate1 - priorShares.Candidate1;
          const Δ2 = reported_share.Candidate2 - priorShares.Candidate2;
          const Δ3 = reported_share.Candidate3 - priorShares.Candidate3;

          // Large single dump → trend is a cohesive block, less predictive of remainder
          const pctDelta = pct - priorPct;
          const dumpConfidence = Math.max(0, 1 - pctDelta / 0.15); // degrades >15% chunk

          // Trend weight peaks near 40% reporting, fades above 85%
          const trendPeak = pct < 0.40 ? pct / 0.40 : Math.max(0, (0.97 - pct) / 0.57);
          trendWeight = 0.18 * dumpConfidence * trendPeak;

          // Momentum: nudge remaining share in direction of recent trend (α=0.4 cap)
          const raw = [
            Math.max(0.001, reported_share.Candidate1 + 0.4 * Δ1),
            Math.max(0.001, reported_share.Candidate2 + 0.4 * Δ2),
            Math.max(0.001, reported_share.Candidate3 + 0.4 * Δ3),
          ];
          const tSum = raw[0] + raw[1] + raw[2];
          f3 = { Candidate1: raw[0] / tSum, Candidate2: raw[1] / tSum, Candidate3: raw[2] / tSum };
        }
      }

      // ── Combine all three factors ───────────────────────────────────────────
      const w1 = pollWeight;
      const w3 = f3 ? trendWeight : 0;
      const w2 = Math.max(0, 1 - w1 - w3);

      expected_share = {
        Candidate1: w1 * f1.Candidate1 + w2 * f2.Candidate1 + w3 * (f3?.Candidate1 ?? f2.Candidate1),
        Candidate2: w1 * f1.Candidate2 + w2 * f2.Candidate2 + w3 * (f3?.Candidate2 ?? f2.Candidate2),
        Candidate3: w1 * f1.Candidate3 + w2 * f2.Candidate3 + w3 * (f3?.Candidate3 ?? f2.Candidate3),
      };
    }
  } else if (prior) {
    const priorTop3 = [...prior.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3);
    expected_share = {
      Candidate1: priorTop3[0] ? priorTop3[0].percent / 100 : reported_share.Candidate1,
      Candidate2: priorTop3[1] ? priorTop3[1].percent / 100 : reported_share.Candidate2,
      Candidate3: priorTop3[2] ? priorTop3[2].percent / 100 : reported_share.Candidate3,
    };
  } else {
    expected_share = { ...reported_share };
  }

  // ── Expected turnout ──────────────────────────────────────────────────────
  // Priority:
  //   1. Explicit override (from RACE_FORECAST_DEFAULTS) — always most accurate.
  //   2. Back-calculate from current votes ÷ percent_reporting.
  //      This works universally for ANY race with no configuration needed.
  //      It guarantees self-consistency: remaining = total * (1 - pct) / pct,
  //      so "votes remaining" always reconciles with "% reporting" in the UI.
  //   3. registered_voters * 0.18 — only used when 0 votes are in yet.
  //      The old code used * 0.65 (general election rate against full registration),
  //      which produced ~20M expected turnout for Texas primaries that draw ~2M.
  //      18% is a reasonable US primary turnout rate and avoids that explosion.
  //   4. Hard floor of 100,000 for completely unknown races.
  const PRIMARY_TURNOUT_RATE = 0.18;

  let est_turnout: number;
  if (expected_turnout && expected_turnout > 0) {
    est_turnout = Math.max(expected_turnout, totalReported);
  } else if (pct > 0.005 && totalReported > 0) {
    est_turnout = Math.max(Math.round(totalReported / pct), totalReported);
  } else if (current.registered_voters > 0) {
    est_turnout = Math.round(current.registered_voters * PRIMARY_TURNOUT_RATE);
  } else {
    est_turnout = 100_000;
  }

  // Pre-compute raw poll prior shares (not pct^k-weighted) for use in step 3
  // of forecastRace when poll_avg is present. These are the poll values ÷ 100,
  // matching the same name-lookup used by buildPollAvgShares.
  const poll_avg_shares: Shares3 | undefined = (poll_avg && Object.keys(poll_avg).length > 0)
    ? buildPollAvgShares(topCandidates, poll_avg)
    : undefined;

  return {
    race_rule,
    percent_reporting: pct,
    reported_vote_total: totalReported,
    reported_share,
    expected_turnout: est_turnout,
    expected_share,
    turnout_blend_k,
    poll_avg_shares,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sortByPollAvg(
  candidates: CivicCandidate[],
  pollAvg: Record<string, number>
): CivicCandidate[] {
  return [...candidates].sort((a, b) => {
    const getScore = (name: string): number => {
      const lower = name.toLowerCase();
      for (const [key, score] of Object.entries(pollAvg)) {
        if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score;
      }
      return -1;
    };
    const sa = getScore(a.name), sb = getScore(b.name);
    if (sa >= 0 && sb >= 0) return sb - sa;
    if (sa >= 0) return -1;
    if (sb >= 0) return 1;
    return (b.votes ?? 0) - (a.votes ?? 0);
  });
}

function buildPollAvgShares(
  top3: CivicCandidate[],
  pollAvg: Record<string, number>
): Shares3 {
  const getScore = (name: string): number => {
    const lower = name.toLowerCase();
    for (const [key, score] of Object.entries(pollAvg)) {
      if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) return score;
    }
    return 0;
  };
  const raw = [
    getScore(top3[0]?.name ?? ""),
    getScore(top3[1]?.name ?? ""),
    getScore(top3[2]?.name ?? ""),
  ];
  const pollTotal = raw.reduce((s, v) => s + v, 0);
  const normalize = pollTotal > 0 ? (v: number) => v / 100 : () => 1 / 4;
  return {
    Candidate1: normalize(raw[0]),
    Candidate2: normalize(raw[1]),
    Candidate3: normalize(raw[2]),
  };
}

// ── Model types ──────────────────────────────────────────────────────────────

export interface ForecastInput {
  race_rule: RaceRule;
  percent_reporting: number;
  reported_vote_total: number;
  reported_share: Shares3;
  expected_turnout: number;
  expected_share: Shares3;
  /** Controls how quickly the blended turnout shifts from the pre-election
   *  prior toward the live extrapolation as votes come in.
   *  liveWeight = pct_reporting ^ k
   *  k=1 (default): linear — 50% in → 50% live weight
   *  k=2: quadratic — 50% in → 25% live weight (slower shift)
   *  k=3: cubic   — 50% in → 12.5% live weight (much slower shift)
   */
  turnout_blend_k?: number;
  /**
   * Raw poll-average prior shares for top 3 (each divided by 100, NOT
   * normalised to sum-to-1). When present, step 3 of forecastRace computes
   * modeled_votes as blendedShare * total instead of live + remaining *
   * expected_share, where blendedShare = liveShare * pct^k + pollPrior *
   * (1-pct^k). This eliminates the live-vote head-start distortion when the
   * remaining ballot pool is compositionally inverse to the live trend.
   */
  poll_avg_shares?: Shares3;
}

export interface ForecastOutput {
  race_rule: RaceRule;
  mode_trigger: "PLURALITY" | "MAJORITY" | "RUNOFF";
  modeled_total_vote: number;
  modeled_vote_remaining: number;
  modeled_percent_reporting: number;
  sd_race: number;
  modeled_votes: Votes4;
  modeled_share: Shares4;
  plurality_odds_to_win: Shares4;
  majority_win_prob: Shares4;
  prob_someone_majority: number;
  runoff_needed_prob: number;
  runoff_prob: Shares4;
  leader: CandidateKey;
  runner_up: CandidateKey;
  projected_margin_votes: number;
  projected_margin_pct: number;
  candidate_names?: [string, string, string, string];
  candidate_colors?: [string, string, string, string];
}

// ── Math helpers ─────────────────────────────────────────────────────────────

function clamp(x: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, x)); }
function roundToNearest100(x: number) { return Math.round(x / 100) * 100; }
function safeDiv(num: number, den: number) { return den === 0 ? 0 : num / den; }
function sum3(s: Shares3) { return s.Candidate1 + s.Candidate2 + s.Candidate3; }
function addOthersShare(sh3: Shares3): Shares4 {
  return { ...sh3, Others: Math.max(0, 1 - sum3(sh3)) };
}
function votesFromShare(share4: Shares4, total: number): Votes4 {
  return {
    Candidate1: share4.Candidate1 * total,
    Candidate2: share4.Candidate2 * total,
    Candidate3: share4.Candidate3 * total,
    Others: share4.Others * total,
  };
}
function sharesFromVotes(v: Votes4, total: number): Shares4 {
  return {
    Candidate1: safeDiv(v.Candidate1, total),
    Candidate2: safeDiv(v.Candidate2, total),
    Candidate3: safeDiv(v.Candidate3, total),
    Others: safeDiv(v.Others, total),
  };
}
function sortCandidatesByVotes(v: Votes4): CandidateKey[] {
  return (["Candidate1", "Candidate2", "Candidate3", "Others"] as CandidateKey[])
    .sort((a, b) => v[b] - v[a]);
}

function phi(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * absZ);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absZ * absZ);
  return 0.5 * (1 + sign * y);
}

function pBeats(meanA: number, meanB: number, sdRace: number): number {
  const denom = sdRace * Math.SQRT2;
  if (denom === 0) {
    if (meanA > meanB) return 1;
    if (meanA < meanB) return 0;
    return 0.5;
  }
  return phi((meanA - meanB) / denom);
}

// ── Probability calculations ─────────────────────────────────────────────────

function calcPluralityOdds(mean_vote: Votes4, sd_race: number): Shares4 {
  const TOP3: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3"];
  const score: Record<CandidateKey, number> = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };
  for (const A of TOP3) {
    let s = 1;
    for (const B of TOP3) {
      if (A !== B) s *= pBeats(mean_vote[A], mean_vote[B], sd_race);
    }
    score[A] = s;
  }
  const total = TOP3.reduce((s, c) => s + score[c], 0);
  if (total === 0) {
    const uniform = 1 / 3;
    return { Candidate1: uniform, Candidate2: uniform, Candidate3: uniform, Others: 0 };
  }
  return {
    Candidate1: score.Candidate1 / total,
    Candidate2: score.Candidate2 / total,
    Candidate3: score.Candidate3 / total,
    Others: 0,
  };
}

function calcMajorityWinProb(mean_vote: Votes4, sd_race: number, modeled_total_vote: number, threshold = 0.5): Shares4 {
  const threshVotes = threshold * modeled_total_vote;
  // eslint-disable-next-line no-param-reassign
  const threshold_ = threshVotes;
  const TOP3: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3"];
  const result: Shares4 = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };
  for (const c of TOP3) {
    if (sd_race === 0) {
      result[c] = mean_vote[c] >= threshold_ ? 1 : 0;
    } else {
      result[c] = 1 - phi((threshold_ - mean_vote[c]) / sd_race);
    }
  }
  return result;
}

function calcRunoffProb(mean_vote: Votes4, sd_race: number): Shares4 {
  const TOP3: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3"];
  type Pair = [CandidateKey, CandidateKey];
  const pairs: Pair[] = [
    ["Candidate1", "Candidate2"],
    ["Candidate1", "Candidate3"],
    ["Candidate2", "Candidate3"],
  ];
  const pairScore = new Map<string, number>();
  let pairSum = 0;
  for (const [i, j] of pairs) {
    let ps = 1;
    for (const k of TOP3) {
      if (k !== i && k !== j) {
        ps *= pBeats(mean_vote[i], mean_vote[k], sd_race)
            * pBeats(mean_vote[j], mean_vote[k], sd_race);
      }
    }
    pairScore.set(`${i}|${j}`, ps);
    pairSum += ps;
  }
  const result: Shares4 = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };
  if (pairSum !== 0) {
    for (const [i, j] of pairs) {
      const w = (pairScore.get(`${i}|${j}`) ?? 0) / pairSum;
      result[i] += w;
      result[j] += w;
    }
  }
  return result;
}

function calcRunoffNeededProb(majority_win_prob: Shares4): number {
  return 1 - clamp(
    majority_win_prob.Candidate1 + majority_win_prob.Candidate2 + majority_win_prob.Candidate3,
    0, 1
  );
}

// ── Main forecast function ───────────────────────────────────────────────────

export function forecastRace(
  input: ForecastInput,
  candidateNames?: string[],
  candidateColors?: string[]
): ForecastOutput {
  const race_rule = input.race_rule;
  const percent_reporting = clamp(input.percent_reporting, 0, 1);
  const reported_vote_total = Math.max(0, input.reported_vote_total);
  const expected_turnout = Math.max(0, input.expected_turnout);
  const blend_k = Math.max(0.5, input.turnout_blend_k ?? 1);

  const reported_share4 = addOthersShare(input.reported_share);
  const expected_share4 = addOthersShare(input.expected_share);
  const reported_votes = votesFromShare(reported_share4, reported_vote_total);

  // Step 1: Model total vote
  // liveWeight = pct^k — higher k = trust the extrapolated total more slowly
  let modeled_total_vote: number;
  if (percent_reporting === 0) {
    modeled_total_vote = expected_turnout;
  } else {
    const raw_implied = safeDiv(reported_vote_total, percent_reporting);
    // Guard: cap implied_total at 10× expected_turnout to prevent API data
    // blips (wrong vote counts during a precinct update) from producing
    // astronomically large projections (e.g. 425M total for a 720K-turnout race).
    const implied_total = expected_turnout > 0
      ? Math.min(raw_implied, 10 * expected_turnout)
      : raw_implied;
    const liveWeight = Math.pow(percent_reporting, blend_k);
    const blended_total = (1 - liveWeight) * expected_turnout + liveWeight * implied_total;
    modeled_total_vote = Math.max(reported_vote_total, blended_total);
  }

  const modeled_vote_remaining = modeled_total_vote - reported_vote_total;
  const modeled_percent_reporting = safeDiv(reported_vote_total, modeled_total_vote);

  // Step 2: Uncertainty (sd_race)
  function getPreElectionDivisor(expectedTurnout: number): number {
    if (expectedTurnout <= 100_000) return 6.5;
    if (expectedTurnout >= 5_000_000) return 14.5;

    const t = (expectedTurnout - 100_000) / (5_000_000 - 100_000);
    return 6.5 + t * (19.5 - 6.5);
  }

  const sd_pre_election = roundToNearest100(
    expected_turnout / getPreElectionDivisor(expected_turnout)
  );

  // For runoff-style races (where margins matter), drop the floor so sd_race can
  // collapse naturally as votes come in. Plurality/general races keep the 0.1 floor.
  const isRunoffStyle = race_rule !== "PLURALITY";
  let sd_race: number;
  if (percent_reporting < 0.05) {
    sd_race = sd_pre_election;
  } else {
    const implied_total = safeDiv(reported_vote_total, percent_reporting);
    const scale = safeDiv(modeled_vote_remaining, implied_total);
    sd_race = sd_pre_election * (isRunoffStyle ? Math.min(1, scale) : Math.max(0.1, Math.min(1, scale)));
  }
  if (modeled_vote_remaining > 100_000) {
    sd_race = Math.max(sd_race, modeled_vote_remaining / 20);
  }

  // Step 3: Projected votes
  // When a poll_avg_shares prior is available, compute modeled_votes as
  //   blendedShare * modeled_total_vote
  // where blendedShare = liveShare * pct^k + pollPrior * (1-pct^k).
  // This prevents a live-vote head-start from overriding the prior when
  // the remaining ballot pool is compositionally different from the live trend
  // (e.g. late unreturned VBM in the LA Mayor race).
  // Without poll_avg_shares, fall back to the standard formula.
  let modeled_votes: Votes4;
  if (input.poll_avg_shares && percent_reporting > 0) {
    const liveWt = Math.pow(percent_reporting, blend_k);
    const priorWt = 1 - liveWt;
    const keys: Array<keyof Shares3> = ["Candidate1", "Candidate2", "Candidate3"];
    const blended = keys.map((k) =>
      Math.max(0, reported_share4[k] * liveWt + input.poll_avg_shares![k] * priorWt)
    );
    modeled_votes = {
      Candidate1: blended[0] * modeled_total_vote,
      Candidate2: blended[1] * modeled_total_vote,
      Candidate3: blended[2] * modeled_total_vote,
      Others: 0,
    };
  } else {
    modeled_votes = {
      Candidate1: reported_votes.Candidate1 + modeled_vote_remaining * expected_share4.Candidate1,
      Candidate2: reported_votes.Candidate2 + modeled_vote_remaining * expected_share4.Candidate2,
      Candidate3: reported_votes.Candidate3 + modeled_vote_remaining * expected_share4.Candidate3,
      Others: 0,
    };
  }
  const tmpC1 = safeDiv(modeled_votes.Candidate1, modeled_total_vote);
  const tmpC2 = safeDiv(modeled_votes.Candidate2, modeled_total_vote);
  const tmpC3 = safeDiv(modeled_votes.Candidate3, modeled_total_vote);
  modeled_votes.Others = modeled_total_vote * Math.max(0, 1 - tmpC1 - tmpC2 - tmpC3);

  const modeled_share = sharesFromVotes(modeled_votes, modeled_total_vote);
  const mean_vote: Votes4 = { ...modeled_votes };

  // Step 4: Probabilities
  const plurality_odds_to_win = calcPluralityOdds(mean_vote, sd_race);
  const winThreshold = (race_rule === "THRESHOLD_35_CONVENTION" || race_rule === "THRESHOLD_35_RUNOFF") ? 0.35 : 0.5;
  const majority_win_prob = calcMajorityWinProb(mean_vote, sd_race, modeled_total_vote, winThreshold);
  const prob_someone_majority = clamp(
    majority_win_prob.Candidate1 + majority_win_prob.Candidate2 + majority_win_prob.Candidate3,
    0, 1
  );
  const runoff_prob = calcRunoffProb(mean_vote, sd_race);
  const runoff_needed_prob = calcRunoffNeededProb(majority_win_prob);

  // Step 5: Leader & margin
  const sorted = sortCandidatesByVotes(modeled_votes);
  const leader = sorted[0];
  const runner_up = sorted[1];
  const projected_margin_votes = modeled_votes[leader] - modeled_votes[runner_up];
  const projected_margin_pct = safeDiv(projected_margin_votes, modeled_total_vote);

  // Step 6: Mode trigger
  const mode_trigger: ForecastOutput["mode_trigger"] =
    (race_rule === "PLURALITY" || race_rule === "TOP_TWO")
      ? "PLURALITY"
      : prob_someone_majority >= 0.5 ? "MAJORITY" : "RUNOFF";

  const names = candidateNames ?? [];
  const colors = candidateColors ?? [];

  return {
    race_rule,
    mode_trigger,
    modeled_total_vote,
    modeled_vote_remaining,
    modeled_percent_reporting,
    sd_race,
    modeled_votes,
    modeled_share,
    plurality_odds_to_win,
    majority_win_prob,
    prob_someone_majority,
    runoff_needed_prob,
    runoff_prob,
    leader,
    runner_up,
    projected_margin_votes,
    projected_margin_pct,
    candidate_names: [
      names[0] ?? "Candidate 1",
      names[1] ?? "Candidate 2",
      names[2] ?? "Candidate 3",
      "Others",
    ] as [string, string, string, string],
    candidate_colors: [
      colors[0] ?? "#3b7bde",
      colors[1] ?? "#ef4444",
      colors[2] ?? "#22c55e",
      "#94a3b8",
    ] as [string, string, string, string],
  };
}