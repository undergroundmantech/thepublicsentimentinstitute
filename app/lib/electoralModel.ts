// lib/electionModel.ts

export type RaceRule = "PLURALITY" | "MAJORITY";

export type CandidateKey = "Candidate1" | "Candidate2" | "Candidate3" | "Others";
export type MainCandidateKey = "Candidate1" | "Candidate2" | "Candidate3";

export type Shares3 = Record<MainCandidateKey, number>;
export type Shares4 = Record<CandidateKey, number>;
export type Votes4 = Record<CandidateKey, number>;

// ---- CivicAPI types ----

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

export interface CivicHistoryList {
  id: number;
  count: number;
  timestamps: { timestamp: string }[];
}

export interface CivicSearchResult {
  count: number;
  races: Array<{
    id: number;
    election_name: string;
    election_type: string;
    election_date: string;
    country: string;
    province: string | null;
    district: string | null;
    municipality: string | null;
    percent_reporting: number;
    candidates: CivicCandidate[];
  }>;
}

// ---- Conversion from CivicAPI → ForecastInput ----

/**
 * Given a CivicAPI race snapshot and an optional "prior" snapshot,
 * build the ForecastInput for our model.
 *
 * expected_share: taken from the *earliest* snapshot (or the current if no prior).
 * expected_turnout: estimated from registered_voters (or fallback).
 */
export function civicToForecastInput(
  current: CivicRace,
  prior?: CivicRace,
  race_rule: RaceRule = "PLURALITY",
  expected_turnout?: number
): ForecastInput {
  const topCandidates = [...current.candidates]
    .sort((a, b) => b.votes - a.votes)
    .slice(0, 3);

  const totalReported = current.candidates.reduce((s, c) => s + c.votes, 0);

  // Infer percent_reporting from API (0-100 → 0-1)
  const pct = Math.min(1, (current.percent_reporting ?? 0) / 100);

  // Build reported share for top 3
  const reported_share: Shares3 = {
    Candidate1: totalReported > 0 ? (topCandidates[0]?.votes ?? 0) / totalReported : 0,
    Candidate2: totalReported > 0 ? (topCandidates[1]?.votes ?? 0) / totalReported : 0,
    Candidate3: totalReported > 0 ? (topCandidates[2]?.votes ?? 0) / totalReported : 0,
  };

  // Prior snapshot used as "expected" shares (pre-election priors)
  const priorSource = prior ?? current;
  const priorTotal = priorSource.candidates.reduce((s, c) => s + c.votes, 0);
  const priorTop3 = [...priorSource.candidates].sort((a, b) => b.votes - a.votes).slice(0, 3);

  const expected_share: Shares3 = {
    Candidate1: priorTop3[0] ? priorTop3[0].percent / 100 : reported_share.Candidate1,
    Candidate2: priorTop3[1] ? priorTop3[1].percent / 100 : reported_share.Candidate2,
    Candidate3: priorTop3[2] ? priorTop3[2].percent / 100 : reported_share.Candidate3,
  };

  // Turnout: registered_voters * estimated participation (65%) or passed override
  const est_turnout =
    expected_turnout ??
    (current.registered_voters > 0
      ? Math.round(current.registered_voters * 0.65)
      : Math.max(totalReported * 4, 100000));

  return {
    race_rule,
    percent_reporting: pct,
    reported_vote_total: totalReported,
    reported_share,
    expected_turnout: est_turnout,
    expected_share,
  };
}

// ---- Original model types + engine (unchanged) ----

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
  plurality_odds_to_win: Shares4;
  majority_win_prob: Shares4;
  prob_someone_majority: number;
  runoff_needed_prob: number;
  runoff_prob: Shares4;
  leader: CandidateKey;
  runner_up: CandidateKey;
  projected_margin_votes: number;
  projected_margin_pct: number;
  // enriched labels from CivicAPI
  candidate_names?: [string, string, string, string];
  candidate_colors?: [string, string, string, string];
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
function roundToNearest100(x: number) {
  return Math.round(x / 100) * 100;
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
function safeDiv(num: number, den: number) { return den === 0 ? 0 : num / den; }
function sum3(s: Shares3) { return s.Candidate1 + s.Candidate2 + s.Candidate3; }
function addOthersShare(sh3: Shares3): Shares4 {
  return { ...sh3, Others: 1 - sum3(sh3) };
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
  const keys: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3", "Others"];
  return keys.sort((a, b) => v[b] - v[a]);
}
function pBeats(meanA: number, meanB: number, sdRace: number): number {
  const denom = sdRace * Math.SQRT2;
  if (denom === 0) return meanA > meanB ? 1 : 0;
  return phi((meanA - meanB) / denom);
}

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

  const sd_pre_election = roundToNearest100(expected_turnout / 6.5);

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

  let sd_race: number;
  if (percent_reporting === 0) {
    sd_race = sd_pre_election;
  } else {
    const implied_total = safeDiv(reported_vote_total, percent_reporting);
    sd_race = sd_pre_election * safeDiv(modeled_vote_remaining, implied_total);
  }

  const modeled_votes: Votes4 = {
    Candidate1: reported_votes.Candidate1 + modeled_vote_remaining * expected_share4.Candidate1,
    Candidate2: reported_votes.Candidate2 + modeled_vote_remaining * expected_share4.Candidate2,
    Candidate3: reported_votes.Candidate3 + modeled_vote_remaining * expected_share4.Candidate3,
    Others: 0,
  };

  const tmpShareC1 = safeDiv(modeled_votes.Candidate1, modeled_total_vote);
  const tmpShareC2 = safeDiv(modeled_votes.Candidate2, modeled_total_vote);
  const tmpShareC3 = safeDiv(modeled_votes.Candidate3, modeled_total_vote);
  modeled_votes.Others = modeled_total_vote * (1 - tmpShareC1 - tmpShareC2 - tmpShareC3);

  const modeled_share = sharesFromVotes(modeled_votes, modeled_total_vote);

  const sorted = sortCandidatesByVotes(modeled_votes);
  const leader = sorted[0];
  const runner_up = sorted[1];
  const projected_margin_votes = modeled_votes[leader] - modeled_votes[runner_up];
  const projected_margin_pct = safeDiv(projected_margin_votes, expected_turnout);

  const total_modeled_votes = modeled_votes.Candidate1 + modeled_votes.Candidate2 + modeled_votes.Candidate3 + modeled_votes.Others;
  const mean_vote: Votes4 = { ...modeled_votes };
  if (total_modeled_votes !== 0) {
    (Object.keys(mean_vote) as CandidateKey[]).forEach((c) => {
      mean_vote[c] = modeled_votes[c] + modeled_vote_remaining * (modeled_votes[c] / total_modeled_votes);
    });
  }

  const ALL: CandidateKey[] = ["Candidate1", "Candidate2", "Candidate3", "Others"];
  const plurality_score: Shares4 = { Candidate1: 1, Candidate2: 1, Candidate3: 1, Others: 1 };
  for (const A of ALL) {
    let s = 1;
    for (const B of ALL) { if (A !== B) s *= pBeats(mean_vote[A], mean_vote[B], sd_race); }
    plurality_score[A] = s;
  }
  const sumPlurality = ALL.reduce((s, c) => s + plurality_score[c], 0);
  const plurality_odds_to_win: Shares4 = {
    Candidate1: safeDiv(plurality_score.Candidate1, sumPlurality),
    Candidate2: safeDiv(plurality_score.Candidate2, sumPlurality),
    Candidate3: safeDiv(plurality_score.Candidate3, sumPlurality),
    Others: safeDiv(plurality_score.Others, sumPlurality),
  };

  const majority_threshold_votes = 0.5 * modeled_total_vote;
  const majority_win_prob: Shares4 = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };
  for (const c of ALL) {
    if (sd_race === 0) {
      majority_win_prob[c] = mean_vote[c] > majority_threshold_votes ? 1 : 0;
    } else {
      majority_win_prob[c] = 1 - phi((majority_threshold_votes - mean_vote[c]) / sd_race);
    }
  }

  const prob_someone_majority = clamp(ALL.reduce((s, c) => s + majority_win_prob[c], 0), 0, 1);
  const runoff_needed_prob = 1 - prob_someone_majority;

  type Pair = [CandidateKey, CandidateKey];
  const pairs: Pair[] = [
    ["Candidate1", "Candidate2"], ["Candidate1", "Candidate3"], ["Candidate1", "Others"],
    ["Candidate2", "Candidate3"], ["Candidate2", "Others"], ["Candidate3", "Others"],
  ];
  const pairScore = new Map<string, number>();
  let pairSum = 0;
  for (const [i, j] of pairs) {
    let ps = 1;
    for (const k of ALL) {
      if (k !== i && k !== j) ps *= pBeats(mean_vote[i], mean_vote[k], sd_race) * pBeats(mean_vote[j], mean_vote[k], sd_race);
    }
    pairScore.set(`${i}|${j}`, ps);
    pairSum += ps;
  }
  const runoff_prob: Shares4 = { Candidate1: 0, Candidate2: 0, Candidate3: 0, Others: 0 };
  if (pairSum !== 0) {
    for (const [i, j] of pairs) {
      const w = (pairScore.get(`${i}|${j}`) ?? 0) / pairSum;
      runoff_prob[i] += w;
      runoff_prob[j] += w;
    }
  }

  const mode_trigger: ForecastOutput["mode_trigger"] =
    race_rule === "PLURALITY" ? "PLURALITY" : prob_someone_majority >= 0.5 ? "MAJORITY" : "RUNOFF";

  const names = candidateNames ?? [];
  const colors = candidateColors ?? [];

  return {
    race_rule, mode_trigger,
    modeled_total_vote, modeled_vote_remaining, modeled_percent_reporting, sd_race,
    modeled_votes, modeled_share,
    plurality_odds_to_win, majority_win_prob, prob_someone_majority, runoff_needed_prob, runoff_prob,
    leader, runner_up, projected_margin_votes, projected_margin_pct,
    candidate_names: [names[0] ?? "Candidate 1", names[1] ?? "Candidate 2", names[2] ?? "Candidate 3", "Others"] as [string, string, string, string],
    candidate_colors: [colors[0] ?? "#3b82f6", colors[1] ?? "#ef4444", colors[2] ?? "#22c55e", "#94a3b8"] as [string, string, string, string],
  };
}