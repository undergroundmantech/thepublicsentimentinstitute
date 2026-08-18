/**
 * County-level live projection for the Florida Republican gubernatorial primary.
 *
 * This is NOT the Michigan engine. Michigan blended each county toward its own
 * live number in isolation, which means a county sitting at 0% reported learns
 * nothing from the counties that have finished. Florida needs the opposite,
 * because the whole job of the county layer here is partial-reporting bias
 * correction: the baseline is a demographic decomposition of the statewide
 * model, so it adds no information to the topline on its own, and only earns
 * its keep by telling us how much vote is outstanding and where.
 *
 * SHRUNK SWING
 * From the counties that have reported we estimate a single statewide swing per
 * candidate — turnout-weighted deviation from baseline — and apply it to the
 * counties that have not. That estimate cannot be trusted at face value. The
 * county baselines are over-smoothed (demographic post-stratification cannot
 * produce home-county or media-market effects), so an early county will differ
 * from its baseline by more than any real statewide movement, and a raw swing
 * estimator would read that noise as signal and whipsaw the board. So the swing
 * is shrunk toward zero by
 *
 *     lambda = sigma^2 / (sigma^2 + tau^2 / nEff)
 *
 * where sigma is the plausible statewide swing, tau is the county baseline
 * residual, and nEff is the effective number of independent counties reporting.
 * Because Florida's vote is heavily concentrated — the top 20 counties are 69%
 * of it — nEff stays small even at moderate reporting, which keeps lambda low
 * early. That is the intended behaviour, not a bug: it is what stops a single
 * big early county from throwing the projection.
 *
 * With no returns in, lambda is 0 and every output equals the static baseline.
 */

import {
  COUNTY_FORECASTS,
  CANDIDATE_ORDER,
  type CandidateKey,
  type CountyForecast,
  type Region,
} from "../_data/flCountyForecast";

/** Live county returns, votes by candidate key. */
export type LiveCounty = {
  votes: Record<CandidateKey, number>;
  total: number;
  /** 0–100 */
  reporting: number;
};

export interface CountyProjection {
  fips: string;
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
  /** 90% interval on the leader's margin over the runner-up. */
  ci90: [number, number];
  /** True when ci90 straddles zero — never name a county winner. */
  tooCloseToCall: boolean;
  interviews: number;
}

export interface SwingDiagnostics {
  /** Raw turnout-weighted deviation from baseline, points, per candidate. */
  raw: Record<CandidateKey, number>;
  /** Applied swing after shrinkage. */
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
 * Plausible statewide swing per candidate, points. The published model puts the
 * SD of the Donalds−Fishback margin at 10.3; shares are compositional and
 * negatively correlated, so a per-candidate SD near margin/sqrt(3) follows.
 */
const SWING_SIGMA = 6.0;

/**
 * County baseline residual per candidate, points. Deliberately larger than the
 * 7.0-point between-county dispersion in the baseline, because that dispersion
 * is itself understated — the model's own two variants disagree on county
 * margin by a median of 8.5 points, more than the spread they are describing.
 */
const BASELINE_TAU = 7.5;

/** A county is only allowed into the swing estimate once it is this far in. */
const MIN_COUNTY_REPORTING = 0.25;

/**
 * Per-county deviation is winsorised here before it enters the average, at two
 * plausible statewide swings. Beyond this the county is an outlier about itself.
 */
const DEVIATION_CAP = 2 * SWING_SIGMA;

/**
 * Effective independent counties required before the swing estimate is trusted
 * at its full shrunk weight. Below it the estimate ramps in from zero.
 */
const MIN_NEFF = 3;

/** Guard against a bad precinct update implying an absurd county total. */
const IMPLIED_CAP = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

const zeroSwing = (): Record<CandidateKey, number> => ({
  donalds: 0,
  fishback: 0,
  collins: 0,
  renner: 0,
  other: 0,
});

const baselineShares = (c: CountyForecast): Record<CandidateKey, number> => ({
  donalds: c.donalds,
  fishback: c.fishback,
  collins: c.collins,
  renner: c.renner,
  other: c.other,
});

const ALL_KEYS: CandidateKey[] = [...CANDIDATE_ORDER, "other"];

/** Renormalises to 100 after flooring at zero, so a big swing can't go negative. */
function normalise(s: Record<CandidateKey, number>): Record<CandidateKey, number> {
  const out = { ...s };
  let sum = 0;
  for (const k of ALL_KEYS) {
    out[k] = Math.max(0, out[k]);
    sum += out[k];
  }
  if (sum <= 0) return s;
  for (const k of ALL_KEYS) out[k] = (out[k] / sum) * 100;
  return out;
}

function rank(shares: Record<CandidateKey, number>): {
  leader: CandidateKey;
  runnerUp: CandidateKey;
  margin: number;
} {
  const ordered = CANDIDATE_ORDER.map((k) => [k, shares[k]] as [CandidateKey, number]).sort(
    (a, b) => b[1] - a[1]
  );
  return { leader: ordered[0][0], runnerUp: ordered[1][0], margin: ordered[0][1] - ordered[1][1] };
}

/**
 * Estimates the statewide swing from reporting counties and shrinks it.
 * Exported so the board can show its working.
 */
export function estimateSwing(
  live: Record<string, LiveCounty> | undefined,
  baseline: CountyForecast[] = COUNTY_FORECASTS
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

    // Weight by counted votes: a finished Lafayette must not outvote a
    // half-counted Miami-Dade in the swing estimate.
    const w = lc.total;
    const base = baselineShares(c);
    for (const k of ALL_KEYS) {
      // Winsorised. A county this far off its baseline is telling us about
      // itself — a home county, a media market, a courthouse slate — not about
      // the state. Shrinkage alone is linear and would pass the outlier
      // straight through at reduced size.
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

  for (const k of ALL_KEYS) raw[k] /= sumW;

  const nEff = (sumW * sumW) / sumW2;

  // One county is one observation of a statewide swing, which is no evidence of
  // a statewide swing at all. Ramp the estimate in as independent counties
  // accumulate, so no single early reporter can move the state on its own.
  const ramp = clamp((nEff - 1) / (MIN_NEFF - 1), 0, 1);
  const lambda =
    ramp *
    ((SWING_SIGMA * SWING_SIGMA) /
      (SWING_SIGMA * SWING_SIGMA + (BASELINE_TAU * BASELINE_TAU) / nEff));

  const applied = zeroSwing();
  for (const k of ALL_KEYS) applied[k] = raw[k] * lambda;

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
  modeledStatewideTotal?: number
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
      Object.fromEntries(
        ALL_KEYS.map((k) => [k, base[k] + swing.applied[k]])
      ) as Record<CandidateKey, number>
    );

    let shares = prior;
    if (reported > 0) {
      const obs = Object.fromEntries(
        ALL_KEYS.map((k) => [k, ((lc?.votes[k] ?? 0) / reported) * 100])
      ) as Record<CandidateKey, number>;
      shares = normalise(
        Object.fromEntries(
          ALL_KEYS.map((k) => [k, obs[k] * pct + prior[k] * (1 - pct)])
        ) as Record<CandidateKey, number>
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
      fips: r.c.fips,
      name: r.c.name,
      region: r.c.region,
      projectedTurnout: turnout,
      reportedVotes: r.reported,
      reporting: r.pct * 100,
      shares: r.shares,
      votes: Object.fromEntries(
        ALL_KEYS.map((k) => [k, (turnout * r.shares[k]) / 100])
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
    ALL_KEYS.map((k) => [k, list.reduce((s, p) => s + p.votes[k], 0)])
  ) as Record<CandidateKey, number>;
  const shares = Object.fromEntries(
    ALL_KEYS.map((k) => [k, turnout > 0 ? (votes[k] / turnout) * 100 : 0])
  ) as Record<CandidateKey, number>;
  const reportedVotes = list.reduce((s, p) => s + p.reportedVotes, 0);
  const top = rank(shares);

  const statewide: CountyProjection = {
    fips: "12",
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
    // Statewide uncertainty is not the sum of county intervals — see the
    // header of _data/flCountyForecast.ts. The board reads it off the
    // statewide model instead, so this collapses to a point deliberately.
    ci90: [top.margin, top.margin],
    tooCloseToCall: false,
    interviews: COUNTY_FORECASTS.reduce((s, c) => s + c.interviews, 0),
  };

  return { list, byName, statewide, swing };
}
