/**
 * County-level live projection for the Oklahoma Republican gubernatorial runoff.
 *
 * Same shrunk-swing design as the August 18 Florida engine, retuned for a
 * two-candidate runoff. The county baseline is a decomposition of the statewide
 * model, so it adds nothing to the topline on its own; it earns its keep by
 * telling us how much vote is outstanding and where, and by correcting for the
 * order counties report in.
 *
 * SHRUNK SWING
 * From the counties that have reported we estimate one statewide swing per
 * candidate — turnout-weighted deviation from baseline — and apply it to the
 * counties that have not. That estimate cannot be taken at face value: the
 * county baselines are over-smoothed, so an early county will differ from its
 * baseline by more than any real statewide movement, and a raw estimator would
 * read that noise as signal. So it is shrunk toward zero by
 *
 *     lambda = sigma^2 / (sigma^2 + tau^2 / nEff)
 *
 * then ramped in from zero until enough independent counties have reported.
 * With no returns in, lambda is 0 and every output equals the static baseline.
 *
 * TWO-CANDIDATE SIMPLIFICATION
 * A runoff has no residual bucket: shares sum to 100 across exactly two names,
 * so margin = 2 * share(leader) - 100 and the two candidates' swings are equal
 * and opposite by construction. That makes the per-candidate sigma and tau half
 * their margin-scale counterparts, which is where the constants below come from.
 */

import {
  COUNTY_FORECASTS,
  CANDIDATE_ORDER,
  STATEWIDE_FORECAST,
  type CandidateKey,
  type CountyForecast,
  type Region,
} from "../_data/okCountyForecast";

/** Live county returns, votes by candidate key. */
export type LiveCounty = {
  votes: Record<CandidateKey, number>;
  total: number;
  /** 0–100 */
  reporting: number;
};

/**
 * At or above this, a county is treated as fully counted. What is left at 95%
 * is provisionals and cured absentees that trickle in over the following days,
 * not election-night vote — leaving those precincts open makes the model hold
 * back outstanding ballots that are never going to arrive.
 */
export const COUNTY_COMPLETE_PCT = 95;

/** Nothing reads as a flat 100% on air before certification. */
export const fmtReporting = (pct: number) =>
  pct >= COUNTY_COMPLETE_PCT ? ">99" : pct.toFixed(0);

export interface CountyProjection {
  key: string;
  name: string;
  region: Region;
  /** Blended prior + live projection of total ballots cast. */
  projectedTurnout: number;
  reportedVotes: number;
  /** 0–100 */
  reporting: number;
  /** Percent of all ballots cast in the county. */
  shares: Record<CandidateKey, number>;
  votes: Record<CandidateKey, number>;
  leader: CandidateKey;
  runnerUp: CandidateKey;
  /** leader − runnerUp, percentage points. Always >= 0. */
  margin: number;
  /** 90% interval on the leader's margin. Straddling zero means no call. */
  ci90: [number, number];
  tooCloseToCall: boolean;
  interviews: number;
}

export interface SwingDiagnostics {
  raw: Record<CandidateKey, number>;
  applied: Record<CandidateKey, number>;
  /** Shrinkage factor actually used, 0–1. */
  lambda: number;
  /** Effective independent counties reporting. */
  nEff: number;
  countiesReporting: number;
  /** Share of the projected statewide electorate already counted, 0–100. */
  voteIn: number;
}

/**
 * Plausible statewide swing per candidate, points. The model puts the SD of the
 * Drummond−Mazzei margin at 7.9; in a two-way race margin = 2*share − 100, so
 * the per-candidate SD is half that.
 */
const SWING_SIGMA = 4.0;

/**
 * County baseline residual per candidate, points. The model's own between-county
 * residual is 7.4 on the margin, so 3.7 per candidate. Set deliberately above
 * that, because demographic post-stratification cannot reproduce home-county or
 * courthouse-slate effects and so understates true county dispersion.
 */
const BASELINE_TAU = 4.5;

/** A county is only allowed into the swing estimate once it is this far in. */
const MIN_COUNTY_REPORTING = 0.25;

/** Per-county deviation is winsorised at two plausible statewide swings. */
const DEVIATION_CAP = 2 * SWING_SIGMA;

/** Effective independent counties required before the swing is trusted fully. */
const MIN_NEFF = 3;

/** Guard against a bad precinct update implying an absurd county total. */
const IMPLIED_CAP = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

const zeroSwing = (): Record<CandidateKey, number> => ({ drummond: 0, mazzei: 0 });

const baselineShares = (c: CountyForecast): Record<CandidateKey, number> => ({ ...c.shares });

/** Renormalises to 100 after flooring at zero, so a big swing can't go negative. */
function normalise(s: Record<CandidateKey, number>): Record<CandidateKey, number> {
  const out = { ...s };
  let sum = 0;
  for (const k of CANDIDATE_ORDER) {
    out[k] = Math.max(0, out[k]);
    sum += out[k];
  }
  if (sum <= 0) return s;
  for (const k of CANDIDATE_ORDER) out[k] = (out[k] / sum) * 100;
  return out;
}

function rank(shares: Record<CandidateKey, number>): {
  leader: CandidateKey;
  runnerUp: CandidateKey;
  margin: number;
} {
  const ordered = CANDIDATE_ORDER.map((k) => [k, shares[k]] as [CandidateKey, number]).sort(
    (a, b) => b[1] - a[1],
  );
  return { leader: ordered[0][0], runnerUp: ordered[1][0], margin: ordered[0][1] - ordered[1][1] };
}

/** Estimates the statewide swing from reporting counties and shrinks it. */
export function estimateSwing(
  live: Record<string, LiveCounty> | undefined,
  baseline: CountyForecast[] = COUNTY_FORECASTS,
): SwingDiagnostics {
  const raw = zeroSwing();
  if (!live) {
    return { raw, applied: zeroSwing(), lambda: 0, nEff: 0, countiesReporting: 0, voteIn: 0 };
  }

  let sumW = 0;
  let sumW2 = 0;
  let counties = 0;
  let counted = 0;
  let projected = 0;

  for (const c of baseline) {
    projected += c.projectedTurnout;
    const lc = live[c.name.toUpperCase()];
    if (!lc) continue;
    counted += lc.total;

    const pct = clamp(lc.reporting / 100, 0, 1);
    if (lc.total <= 0 || pct < MIN_COUNTY_REPORTING) continue;

    // Weight by counted votes, so a finished Cimarron cannot outvote a
    // half-counted Oklahoma County in the swing estimate.
    const w = lc.total;
    const base = baselineShares(c);
    for (const k of CANDIDATE_ORDER) {
      // Winsorised: a county this far off baseline is telling us about itself,
      // not about the state. Shrinkage is linear and would otherwise pass the
      // outlier straight through at reduced size.
      const dev = (lc.votes[k] / lc.total) * 100 - base[k];
      raw[k] += w * clamp(dev, -DEVIATION_CAP, DEVIATION_CAP);
    }
    sumW += w;
    sumW2 += w * w;
    counties += 1;
  }

  if (sumW <= 0) {
    return {
      raw: zeroSwing(),
      applied: zeroSwing(),
      lambda: 0,
      nEff: 0,
      countiesReporting: 0,
      voteIn: projected > 0 ? (counted / projected) * 100 : 0,
    };
  }

  for (const k of CANDIDATE_ORDER) raw[k] /= sumW;

  const nEff = (sumW * sumW) / sumW2;

  // One county is one observation of a statewide swing, which is no evidence of
  // a statewide swing at all. Ramp in as independent counties accumulate.
  const ramp = clamp((nEff - 1) / (MIN_NEFF - 1), 0, 1);
  const lambda =
    ramp *
    ((SWING_SIGMA * SWING_SIGMA) /
      (SWING_SIGMA * SWING_SIGMA + (BASELINE_TAU * BASELINE_TAU) / nEff));

  const applied = zeroSwing();
  for (const k of CANDIDATE_ORDER) applied[k] = raw[k] * lambda;

  return {
    raw,
    applied,
    lambda,
    nEff,
    countiesReporting: counties,
    voteIn: projected > 0 ? (counted / projected) * 100 : 0,
  };
}

/**
 * @param live                   county returns keyed by UPPERCASE county name
 * @param modeledStatewideTotal  forecastRace().modeled_total_vote, so the county
 *                               board reconciles with the statewide desk number
 */
export function projectCounties(
  live?: Record<string, LiveCounty>,
  modeledStatewideTotal?: number,
): {
  list: CountyProjection[];
  byName: Record<string, CountyProjection>;
  statewide: CountyProjection;
  swing: SwingDiagnostics;
} {
  const swing = estimateSwing(live);

  const raw = COUNTY_FORECASTS.map((c) => {
    const lc = live?.[c.name.toUpperCase()];
    const reported = lc?.total ?? 0;

    // A county can report votes before it reports a precinct percentage.
    let pct = clamp((lc?.reporting ?? 0) / 100, 0, 1);
    if (pct === 0 && reported > 0) pct = clamp(reported / c.projectedTurnout, 0, 1);

    const implied =
      pct > 0 ? Math.min(reported / pct, c.projectedTurnout * IMPLIED_CAP) : c.projectedTurnout;
    const turnout = Math.max((1 - pct) * c.projectedTurnout + pct * implied, reported);

    // Every county — reported or not — starts from baseline plus the shrunk
    // statewide swing. Counties with returns then migrate toward what they
    // actually show, in proportion to how much of them is counted.
    const base = baselineShares(c);
    const prior = normalise(
      Object.fromEntries(CANDIDATE_ORDER.map((k) => [k, base[k] + swing.applied[k]])) as Record<
        CandidateKey,
        number
      >,
    );

    let shares = prior;
    if (reported > 0) {
      const obs = Object.fromEntries(
        CANDIDATE_ORDER.map((k) => [k, ((lc?.votes[k] ?? 0) / reported) * 100]),
      ) as Record<CandidateKey, number>;
      shares = normalise(
        Object.fromEntries(
          CANDIDATE_ORDER.map((k) => [k, obs[k] * pct + prior[k] * (1 - pct)]),
        ) as Record<CandidateKey, number>,
      );
    }

    // The interval collapses with the outstanding pool, which retires the
    // "too close to call" hatching as counties finish.
    const halfWidth = ((c.ci90[1] - c.ci90[0]) / 2) * Math.sqrt(Math.max(0, 1 - pct));

    return { c, turnout, shares, halfWidth, reported, pct };
  });

  const priorSum = raw.reduce((s, r) => s + r.turnout, 0);
  const scale = modeledStatewideTotal && priorSum > 0 ? modeledStatewideTotal / priorSum : 1;

  const list: CountyProjection[] = raw.map((r) => {
    const turnout = Math.max(r.turnout * scale, r.reported);
    const { leader, runnerUp, margin } = rank(r.shares);
    const ci90: [number, number] = [margin - r.halfWidth, margin + r.halfWidth];

    return {
      key: r.c.key,
      name: r.c.name,
      region: r.c.region,
      projectedTurnout: turnout,
      reportedVotes: r.reported,
      reporting: r.pct * 100,
      shares: r.shares,
      votes: Object.fromEntries(
        CANDIDATE_ORDER.map((k) => [k, (turnout * r.shares[k]) / 100]),
      ) as Record<CandidateKey, number>,
      leader,
      runnerUp,
      margin,
      ci90,
      tooCloseToCall: ci90[0] < 0,
      interviews: r.c.interviews,
    };
  });

  const byName: Record<string, CountyProjection> = {};
  for (const p of list) byName[p.name.toUpperCase()] = p;

  const turnout = list.reduce((s, p) => s + p.projectedTurnout, 0);
  const votes = Object.fromEntries(
    CANDIDATE_ORDER.map((k) => [k, list.reduce((s, p) => s + p.votes[k], 0)]),
  ) as Record<CandidateKey, number>;
  const shares = Object.fromEntries(
    CANDIDATE_ORDER.map((k) => [k, turnout > 0 ? (votes[k] / turnout) * 100 : 0]),
  ) as Record<CandidateKey, number>;
  const reportedVotes = list.reduce((s, p) => s + p.reportedVotes, 0);
  const top = rank(shares);

  const statewide: CountyProjection = {
    key: "STATEWIDE",
    name: "STATEWIDE",
    region: list[0].region,
    projectedTurnout: turnout,
    reportedVotes,
    reporting: turnout > 0 ? (reportedVotes / turnout) * 100 : 0,
    shares,
    votes,
    leader: top.leader,
    runnerUp: top.runnerUp,
    margin: top.margin,
    // Statewide uncertainty is not the sum of county intervals — see the header
    // of _data/okCountyForecast.ts. The board reads it off the statewide model,
    // so this collapses to a point deliberately.
    ci90: [top.margin, top.margin],
    tooCloseToCall: false,
    interviews: STATEWIDE_FORECAST ? COUNTY_FORECASTS.reduce((s, c) => s + c.interviews, 0) : 0,
  };

  return { list, byName, statewide, swing };
}
