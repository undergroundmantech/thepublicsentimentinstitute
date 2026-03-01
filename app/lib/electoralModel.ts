// lib/electoralModel.ts

export type RaceRule = "PLURALITY" | "MAJORITY";

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
  poll_avg?: Record<string, number>
): ForecastInput {
  const pct = Math.min(1, (current.percent_reporting ?? 0) / 100);
  const totalReported = current.candidates.reduce((s, c) => s + c.votes, 0);

  const topCandidates = poll_avg
    ? sortByPollAvg(current.candidates, poll_avg).slice(0, 3)
    : [...current.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3);

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
      const pollWeight = Math.max(0, 1 - (pct / 0.5));
      expected_share = {
        Candidate1: pollWeight * pollShares.Candidate1 + (1 - pollWeight) * reported_share.Candidate1,
        Candidate2: pollWeight * pollShares.Candidate2 + (1 - pollWeight) * reported_share.Candidate2,
        Candidate3: pollWeight * pollShares.Candidate3 + (1 - pollWeight) * reported_share.Candidate3,
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

  const est_turnout =
    expected_turnout ??
    (current.registered_voters > 0
      ? Math.round(current.registered_voters * 0.65)
      : Math.max(totalReported * 4, 100_000));

  return {
    race_rule,
    percent_reporting: pct,
    reported_vote_total: totalReported,
    reported_share,
    expected_turnout: est_turnout,
    expected_share,
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
    // Normalize to pollTotal so shares sum to < 1, leaving room for Others
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
  plurality_odds_to_win: Shares4;       // P(highest vote share) — use in PLURALITY
  majority_win_prob: Shares4;           // P(>50%) — use in MAJORITY
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

// Normal CDF approximation (Abramowitz & Stegun 7.1.26)
function phi(z: number): number {
  const sign = z < 0 ? -1 : 1;
  const absZ = Math.abs(z) / Math.SQRT2;
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const t = 1 / (1 + p * absZ);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-absZ * absZ);
  return 0.5 * (1 + sign * y);
}

// P(A > B) under normal uncertainty (margin ~ N(diff, sd * √2))
function pBeats(meanA: number, meanB: number, sdRace: number): number {
  const denom = sdRace * Math.SQRT2;
  if (denom === 0) {
    if (meanA > meanB) return 1;
    if (meanA < meanB) return 0;
    return 0.5; // exact tie
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

function calcMajorityWinProb(mean_vote: Votes4, sd_race: number, modeled_total_vote: number): Shares4 {
  const threshold = 0.5 * modeled_total_vote;
  const TOP3: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3"];
  const result: Shares4 = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };

  for (const c of TOP3) {
    if (sd_race === 0) {
      result[c] = mean_vote[c] >= threshold ? 1 : 0;
    } else {
      result[c] = 1 - phi((threshold - mean_vote[c]) / sd_race);
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

  const reported_share4 = addOthersShare(input.reported_share);
  const expected_share4 = addOthersShare(input.expected_share);
  const reported_votes = votesFromShare(reported_share4, reported_vote_total);

  // Step 1: Model total vote
  let modeled_total_vote: number;
  if (percent_reporting === 0) {
    modeled_total_vote = expected_turnout;
  } else {
    const implied_total = safeDiv(reported_vote_total, percent_reporting);
    const blended_total = (1 - percent_reporting) * expected_turnout + percent_reporting * implied_total;
    modeled_total_vote = Math.max(reported_vote_total, blended_total);
  }

  const modeled_vote_remaining = modeled_total_vote - reported_vote_total;
  const modeled_percent_reporting = safeDiv(reported_vote_total, modeled_total_vote);

  // Step 2: Uncertainty (sd_race) with early-reporting protection
  const sd_pre_election = roundToNearest100(expected_turnout / 6.5);

  let sd_race: number;
  if (percent_reporting < 0.05) {
    sd_race = sd_pre_election;
  } else {
    const implied_total = safeDiv(reported_vote_total, percent_reporting);
    const scale = safeDiv(modeled_vote_remaining, implied_total);
    sd_race = sd_pre_election * Math.max(0.1, Math.min(1, scale));
  }

  // Emergency floor when lots of votes still out
  if (modeled_vote_remaining > 100000) {
    sd_race = Math.max(sd_race, modeled_vote_remaining / 20);
  }

  // Step 3: Projected votes (proportional allocation of remaining)
  const modeled_votes: Votes4 = {
    Candidate1: reported_votes.Candidate1 + modeled_vote_remaining * expected_share4.Candidate1,
    Candidate2: reported_votes.Candidate2 + modeled_vote_remaining * expected_share4.Candidate2,
    Candidate3: reported_votes.Candidate3 + modeled_vote_remaining * expected_share4.Candidate3,
    Others: 0,
  };

  const tmpC1 = safeDiv(modeled_votes.Candidate1, modeled_total_vote);
  const tmpC2 = safeDiv(modeled_votes.Candidate2, modeled_total_vote);
  const tmpC3 = safeDiv(modeled_votes.Candidate3, modeled_total_vote);
  modeled_votes.Others = modeled_total_vote * Math.max(0, 1 - tmpC1 - tmpC2 - tmpC3);

  const modeled_share = sharesFromVotes(modeled_votes, modeled_total_vote);

  // Mean vote = modeled_votes (already includes expected allocation)
  const mean_vote: Votes4 = { ...modeled_votes };

  // Step 4: Probabilities
  const plurality_odds_to_win = calcPluralityOdds(mean_vote, sd_race);
  const majority_win_prob = calcMajorityWinProb(mean_vote, sd_race, modeled_total_vote);
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
    race_rule === "PLURALITY"
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
      colors[0] ?? "#3b82f6",
      colors[1] ?? "#ef4444",
      colors[2] ?? "#22c55e",
      "#94a3b8",
    ] as [string, string, string, string],
  };
}