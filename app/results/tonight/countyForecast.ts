/**
 * County-level live forecast for the Michigan Senate primary.
 *
 * Mirrors the statewide engine (app/lib/electoralModel.ts §1) at county scale:
 * turnout blends the DSMeridian prior toward what the county's own returns
 * imply, and the two-way share migrates from the modelled prior toward the
 * live count as ballots land. With no returns in, every output equals the
 * static seed data, so nothing regresses before polls close.
 */

import { COUNTY_FORECASTS } from "../_data/miCountyForecast";
import type { Region } from "../_data/miCountyForecast";

export interface LiveCounty {
  elSayedVotes: number;
  stevensVotes: number;
  reporting: number;
}

export interface CountyProjection {
  fips: string;
  name: string;
  region: Region;
  /** Blended prior + live projection of total ballots cast. */
  projectedTurnout: number;
  /** Two-candidate votes actually counted so far. */
  reportedVotes: number;
  /** 0–100. */
  reporting: number;
  /** Percent of all ballots cast in the county. */
  elSayed: number;
  stevens: number;
  /** elSayed − stevens, percentage points. */
  margin: number;
  twoWayElSayed: number;
  ci90: [number, number];
  tooCloseToCall: boolean;
  elSayedVotes: number;
  stevensVotes: number;
}

/** Same default as ForecastInput.turnout_blend_k, so county and state agree. */
const BLEND_K = 1;
/** Matches the engine's guard against a bad precinct update. */
const IMPLIED_CAP = 10;

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/**
 * @param live                county returns keyed by UPPERCASE county name
 * @param modeledStatewideTotal  forecastRace().modeled_total_vote, when known,
 *                               so the county board reconciles with the desk
 */
export function projectCounties(
  live?: Record<string, LiveCounty>,
  modeledStatewideTotal?: number
): {
  list: CountyProjection[];
  byName: Record<string, CountyProjection>;
  statewide: CountyProjection;
} {
  const raw = COUNTY_FORECASTS.map((c) => {
    const lc = live?.[c.name.toUpperCase()];
    const el = lc?.elSayedVotes ?? 0;
    const st = lc?.stevensVotes ?? 0;
    const reported = el + st;

    // A county can report votes before it reports a precinct percentage.
    let pct = clamp((lc?.reporting ?? 0) / 100, 0, 1);
    if (pct === 0 && reported > 0) pct = clamp(reported / c.projectedTurnout, 0, 1);

    const implied =
      pct > 0
        ? Math.min(reported / pct, c.projectedTurnout * IMPLIED_CAP)
        : c.projectedTurnout;
    const w = Math.pow(pct, BLEND_K);

    const turnout = Math.max((1 - w) * c.projectedTurnout + w * implied, reported);

    const liveTwoWay = reported > 0 ? (el / reported) * 100 : c.twoWayElSayed;
    const twoWay = clamp(liveTwoWay * w + c.twoWayElSayed * (1 - w), 0, 100);

    // Minor candidates never appear in the two-way feed, so their prior share
    // of the ballot rides along unchanged.
    const twoWayShareOfBallot = clamp((c.elSayed + c.stevens) / 100, 0, 1);

    // The interval collapses with the outstanding pool, which is what retires
    // the "too close to call" hatching as counties finish.
    const hw = ((c.ci90[1] - c.ci90[0]) / 2) * Math.sqrt(Math.max(0, 1 - pct));

    return { c, turnout, twoWay, twoWayShareOfBallot, hw, reported, pct };
  });

  const priorSum = raw.reduce((s, r) => s + r.turnout, 0);
  const scale =
    modeledStatewideTotal && priorSum > 0 ? modeledStatewideTotal / priorSum : 1;

  const list: CountyProjection[] = raw.map((r) => {
    const turnout = Math.max(r.turnout * scale, r.reported);
    const elPct = (r.twoWay / 100) * r.twoWayShareOfBallot * 100;
    const stPct = ((100 - r.twoWay) / 100) * r.twoWayShareOfBallot * 100;
    const ci90: [number, number] = [
      clamp(r.twoWay - r.hw, 0, 100),
      clamp(r.twoWay + r.hw, 0, 100),
    ];

    return {
      fips: r.c.fips,
      name: r.c.name,
      region: r.c.region,
      projectedTurnout: turnout,
      reportedVotes: r.reported,
      reporting: r.pct * 100,
      elSayed: elPct,
      stevens: stPct,
      margin: elPct - stPct,
      twoWayElSayed: r.twoWay,
      ci90,
      tooCloseToCall: ci90[0] < 50 && ci90[1] > 50,
      elSayedVotes: (turnout * elPct) / 100,
      stevensVotes: (turnout * stPct) / 100,
    };
  });

  const byName: Record<string, CountyProjection> = {};
  for (const p of list) byName[p.name.toUpperCase()] = p;

  const turnout = list.reduce((s, p) => s + p.projectedTurnout, 0);
  const elVotes = list.reduce((s, p) => s + p.elSayedVotes, 0);
  const stVotes = list.reduce((s, p) => s + p.stevensVotes, 0);
  const twoWay = elVotes + stVotes > 0 ? (elVotes / (elVotes + stVotes)) * 100 : 50;
  const elPct = turnout > 0 ? (elVotes / turnout) * 100 : 0;
  const stPct = turnout > 0 ? (stVotes / turnout) * 100 : 0;

  const statewide: CountyProjection = {
    fips: "26",
    name: "STATEWIDE",
    region: "Wayne",
    projectedTurnout: turnout,
    reportedVotes: list.reduce((s, p) => s + p.reportedVotes, 0),
    reporting: turnout > 0 ? (list.reduce((s, p) => s + p.reportedVotes, 0) / turnout) * 100 : 0,
    elSayed: elPct,
    stevens: stPct,
    margin: elPct - stPct,
    twoWayElSayed: twoWay,
    ci90: [twoWay, twoWay],
    tooCloseToCall: false,
    elSayedVotes: elVotes,
    stevensVotes: stVotes,
  };

  return { list, byName, statewide };
}
