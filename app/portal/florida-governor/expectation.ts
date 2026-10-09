/**
 * Expectation grading and path-to-win arithmetic for one candidate.
 *
 * "Expectation" here always means the PRE-ELECTION baseline in
 * _data/flCountyForecast.ts — never the live-blended projection. Grading a
 * candidate against a projection that has already absorbed his own results
 * would mark him against himself and always read close to par.
 *
 * The statewide grade is composition-adjusted: it compares his counted votes
 * with what the baseline expected from *the counties that have actually
 * reported*, not with his statewide topline. Florida's early vote is not a
 * random sample of the state, so an unadjusted comparison mostly measures which
 * counties happen to be counting.
 *
 * Nothing here calls a county. Every output is a comparison to baseline.
 */

import {
  COUNTY_FORECASTS,
  CANDIDATE_ORDER,
  type CandidateKey,
  type NamedCandidateKey,
  type Region,
} from "../../results/_data/flCountyForecast";
import type { CountyProjection, LiveCounty } from "../../results/2026-08-18/countyForecast";

/** The candidate this board is built to track. */
export const TARGET: NamedCandidateKey = "fishback";

const BASELINE_BY_NAME = new Map(COUNTY_FORECASTS.map((c) => [c.name.toUpperCase(), c]));

const shareOf = (votes: number, total: number) => (total > 0 ? (votes / total) * 100 : 0);

export interface CountyGrade {
  fips: string;
  name: string;
  region: Region;
  /** Baseline share for the target, percent of county ballots. */
  expected: number;
  /** Live share for the target, or null where nothing has been counted. */
  actual: number | null;
  /** actual − expected, percentage points. Null until the county reports. */
  delta: number | null;
  /** 0–100. */
  reporting: number;
  reportedVotes: number;
  projectedTurnout: number;
  /** Ballots the projection still expects from this county. */
  outstanding: number;
  /** Baseline net votes the target gains here from the outstanding pool. */
  netAvailable: number;
  /** Votes gained or lost against baseline in what has already counted. */
  votesVsExpected: number | null;
}

export type GradeLetter = "A" | "B" | "C" | "D" | "F";

export interface Grade {
  letter: GradeLetter;
  label: string;
  /** Turnout-weighted actual − expected, percentage points. */
  delta: number;
  /** Net votes above or below baseline in the counted vote. */
  votes: number;
  countedVotes: number;
  countiesReporting: number;
}

/**
 * Cut points are in percentage points of vote share. A county baseline built on
 * 476 statewide interviews cannot resolve much finer than this, so the middle
 * band is deliberately wide: ±1.5 points is "as expected", not a near miss.
 */
const BANDS: { min: number; letter: GradeLetter; label: string }[] = [
  { min: 4, letter: "A", label: "Well ahead of expectation" },
  { min: 1.5, letter: "B", label: "Ahead of expectation" },
  { min: -1.5, letter: "C", label: "Running to expectation" },
  { min: -4, letter: "D", label: "Behind expectation" },
  { min: -Infinity, letter: "F", label: "Well behind expectation" },
];

export const gradeFor = (delta: number) => BANDS.find((b) => delta >= b.min)!;

/** Whoever the target actually has to beat right now, by counted votes. */
export function currentRival(
  statewideVotes: Record<CandidateKey, number>,
  target: NamedCandidateKey = TARGET,
): CandidateKey {
  return (
    CANDIDATE_ORDER.filter((k) => k !== target).sort(
      (a, b) => (statewideVotes[b] ?? 0) - (statewideVotes[a] ?? 0),
    )[0] ?? "donalds"
  );
}

/** Per-county comparison of live share against the pre-election baseline. */
export function gradeCounties(
  projections: CountyProjection[],
  live: Record<string, LiveCounty> | undefined,
  rival: CandidateKey,
  target: NamedCandidateKey = TARGET,
): CountyGrade[] {
  return projections.map((p) => {
    const base = BASELINE_BY_NAME.get(p.name.toUpperCase());
    const expected = base ? base[target] : 0;
    const lc = live?.[p.name.toUpperCase()];
    const counted = lc?.total ?? 0;
    const actual = counted > 0 ? shareOf(lc!.votes[target] ?? 0, counted) : null;
    const outstanding = Math.max(0, p.projectedTurnout - counted);
    const baseNet = base ? base[target] - base[rival] : 0;

    return {
      fips: p.fips,
      name: p.name,
      region: p.region,
      expected,
      actual,
      delta: actual === null ? null : actual - expected,
      reporting: p.reporting,
      reportedVotes: counted,
      projectedTurnout: p.projectedTurnout,
      outstanding,
      netAvailable: (outstanding * baseNet) / 100,
      votesVsExpected: actual === null ? null : (counted * (actual - expected)) / 100,
    };
  });
}

/** Composition-adjusted statewide grade. Null until something has reported. */
export function statewideGrade(
  live: Record<string, LiveCounty> | undefined,
  target: NamedCandidateKey = TARGET,
): Grade | null {
  if (!live) return null;

  let counted = 0;
  let actualVotes = 0;
  let expectedVotes = 0;
  let counties = 0;

  for (const base of COUNTY_FORECASTS) {
    const lc = live[base.name.toUpperCase()];
    if (!lc || lc.total <= 0) continue;
    counted += lc.total;
    actualVotes += lc.votes[target] ?? 0;
    expectedVotes += (lc.total * base[target]) / 100;
    counties += 1;
  }

  if (counted <= 0) return null;

  const delta = shareOf(actualVotes, counted) - shareOf(expectedVotes, counted);
  const band = gradeFor(delta);
  return {
    letter: band.letter,
    label: band.label,
    delta,
    votes: actualVotes - expectedVotes,
    countedVotes: counted,
    countiesReporting: counties,
  };
}

export interface PathToWin {
  /** Whoever the target actually has to beat right now. */
  rival: CandidateKey;
  /** Rival votes minus target votes. Negative means the target leads. */
  deficit: number;
  outstanding: number;
  /** Points the target must win the outstanding vote by to draw level. */
  required: number;
  /** Points the baseline says he wins the outstanding vote by. */
  expected: number;
  /** required − expected. Positive is ground still to make up. */
  gap: number;
  /** Whether the outstanding pool is big enough for the deficit to be closed. */
  reachable: boolean;
}

/**
 * @param statewideVotes counted votes by candidate — prefer the statewide feed
 *                       over summed counties, which lag it early in the night
 */
export function pathToWin(
  grades: CountyGrade[],
  statewideVotes: Record<CandidateKey, number>,
  target: NamedCandidateKey = TARGET,
): PathToWin {
  const rival = currentRival(statewideVotes, target);

  const deficit = (statewideVotes[rival] ?? 0) - (statewideVotes[target] ?? 0);
  const outstanding = grades.reduce((s, g) => s + g.outstanding, 0);
  const netAvailable = grades.reduce((s, g) => s + g.netAvailable, 0);

  // Closing a deficit of D across an outstanding pool of R needs a net margin of
  // D/R in that pool — every point of margin is worth one percent of R.
  const required = outstanding > 0 ? (deficit / outstanding) * 100 : Infinity;
  const expected = outstanding > 0 ? (netAvailable / outstanding) * 100 : 0;

  return {
    rival,
    deficit,
    outstanding,
    required,
    expected,
    gap: required - expected,
    reachable: outstanding > 0 && Math.abs(required) <= 100,
  };
}

/** Counties ranked by the net votes the target can still take out of them. */
export function opportunities(grades: CountyGrade[], limit = 8): CountyGrade[] {
  return [...grades]
    .sort((a, b) => b.netAvailable - a.netAvailable || b.outstanding - a.outstanding)
    .slice(0, limit);
}
