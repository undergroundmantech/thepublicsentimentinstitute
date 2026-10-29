// T4: the frozen forecast prior. Pure: callers pass parsed inputs; nothing here reads files or the clock.
//
// The forecast publishes, for each Senate and governor race, a 40-bin histogram of 2,000 simulated margins plus a
// headline margin, P(Republican wins), p10 and p90. The headline margin is the simulation MEAN (build_app_forecast.py),
// and P comes from the full run, so the histogram alone reproduces neither exactly, and no single shift can match two
// constraints at once. The calibration here never moves mass between bins. It only chooses where, inside each bin,
// the bin's mass sits, which the histogram does not say:
//   - knots in the bins holding 0, p10 and p90 put exactly the published mass below each value;
//   - every other bin gets the same power warp x = lo + w·U^γ, with γ solved so the mean equals the headline.
// Draws are stratified quantiles of that distribution, so the prior is deterministic without a random generator.
// Margins are B − A in points, A the Democratic slot and B the Republican slot, as the forecast and county files use.

import type { AnchorCheck, CalibrationKnot, CountyAuditRow, PriorFile, PriorRace, PublishedHistogram, RaceRule, RaceRulesFile } from "./types";

export const PRIOR_SCHEMA = "vai-prior/1";
export const PRIOR_BUILDER_VERSION = "vai-prior-builder/1";
export const PRIOR_DRAWS = 20000;
export const TOLERANCE = { margin: 0.05, prob: 0.005 };
export const DISCREPANCY_POINTS = 2;
const AUDIT_FLOOR = 1;
const GEO_SAMPLE_EVERY = 100;

export type Calibration = NonNullable<PriorRace["calibration"]>;

export interface ForecastRace {
  id: string;
  office: string;
  st: string;
  dem?: string;
  gop?: string;
  est: { margin: number; prob: number; p10: number; p90: number; dist?: PublishedHistogram };
  rcv?: unknown;
}

export interface IndexEntry {
  id: string;
  k: string;
  st: string;
  c?: [string, string, number][];
  tot?: number;
  m?: number;
  yes?: number;
}

/** Counties for one race: fips → [a, b, other, total]. */
export type CountyRows = Record<string, [number, number, number, number]>;

// ---- histogram ----------------------------------------------------------------------------------------------------

const total = (h: PublishedHistogram) => h.c.reduce((s, x) => s + x, 0);

function cumulative(h: PublishedHistogram): number[] {
  const cum = [0];
  for (const x of h.c) cum.push(cum[cum.length - 1] + x);
  return cum;
}

/** CDF of the histogram read as uniform within each bin. */
export function histogramCdf(h: PublishedHistogram, x: number): number {
  const n = total(h), cum = cumulative(h);
  const t = (x - h.lo) / h.w;
  if (t <= 0) return 0;
  if (t >= h.c.length) return 1;
  const i = Math.floor(t);
  return (cum[i] + h.c[i] * (t - i)) / n;
}

// ---- calibration --------------------------------------------------------------------------------------------------

function knotFor(h: PublishedHistogram, target: CalibrationKnot["target"], value: number, cumTarget: number): CalibrationKnot | null {
  const n = total(h), cum = cumulative(h);
  const i = Math.floor((value - h.lo) / h.w);
  if (i < 0 || i >= h.c.length) return { bin: i, value, massBelow: i < 0 ? 0 : 1, target, feasible: false };
  if (h.c[i] === 0) return { bin: i, value, massBelow: 0, target, feasible: false };
  const f = (cumTarget * n - cum[i]) / h.c[i];
  const feasible = f >= 0 && f <= 1;
  return { bin: i, value, massBelow: Math.min(1, Math.max(0, f)), target, feasible };
}

/** Knots in a bin, as (mass fraction, value) points from the bin's lower edge to its upper edge. */
function binPoints(h: PublishedHistogram, i: number, knots: CalibrationKnot[]): [number, number][] {
  const lo = h.lo + i * h.w;
  const inner = knots.filter((k) => k.feasible && k.bin === i).sort((a, b) => a.value - b.value).map((k) => [k.massBelow, k.value] as [number, number]);
  return [[0, lo], ...inner, [1, lo + h.w]];
}

function binMean(h: PublishedHistogram, i: number, knots: CalibrationKnot[], gamma: number): number {
  const pts = binPoints(h, i, knots);
  if (pts.length === 2) return pts[0][1] + h.w / (1 + gamma);
  let m = 0;
  for (let k = 1; k < pts.length; k++) m += (pts[k][0] - pts[k - 1][0]) * (pts[k][1] + pts[k - 1][1]) / 2;
  return m;
}

export function calibratedMean(h: PublishedHistogram, cal: Calibration): number {
  const n = total(h);
  let m = 0;
  for (let i = 0; i < h.c.length; i++) if (h.c[i]) m += (h.c[i] / n) * binMean(h, i, cal.knots, cal.gamma);
  return m;
}

/** Quantile of the calibrated distribution. */
export function calibratedQuantile(h: PublishedHistogram, cal: Calibration, u: number): number {
  const n = total(h), cum = cumulative(h);
  const target = Math.min(Math.max(u, 0), 1) * n;
  let i = 0;
  while (i < h.c.length - 1 && (h.c[i] === 0 || cum[i + 1] <= target)) i++;
  const v = h.c[i] ? Math.min(1, Math.max(0, (target - cum[i]) / h.c[i])) : 0;
  const pts = binPoints(h, i, cal.knots);
  if (pts.length === 2) return pts[0][1] + h.w * Math.pow(v, cal.gamma);
  for (let k = 1; k < pts.length; k++) {
    if (v <= pts[k][0]) {
      const [f0, x0] = pts[k - 1], [f1, x1] = pts[k];
      return f1 > f0 ? x0 + ((v - f0) / (f1 - f0)) * (x1 - x0) : x1;
    }
  }
  return pts[pts.length - 1][1];
}

/**
 * Place knots for P(B), p10 and p90, then solve γ for the mean. A knot is applied only when the bin holds enough mass
 * on both sides of the value and its order agrees with the knots already placed; otherwise it is recorded as
 * infeasible and the anchor check reports what remains.
 */
export function calibrate(h: PublishedHistogram, pub: { margin: number; probB: number; p10: number; p90: number }): { calibration: Calibration; meanReachable: [number, number] } {
  const knots: CalibrationKnot[] = [];
  const wanted: [CalibrationKnot["target"], number, number][] = [["P_B", 0, 1 - pub.probB], ["P10", pub.p10, 0.1], ["P90", pub.p90, 0.9]];
  for (const [target, value, cumTarget] of wanted) {
    const k = knotFor(h, target, value, cumTarget);
    if (!k) continue;
    if (k.feasible) {
      const placed = knots.filter((x) => x.feasible).map((x) => ({ v: x.value, c: wanted.find((w) => w[0] === x.target)![2] }));
      if (placed.some((p) => Math.sign(p.v - value) !== Math.sign(p.c - cumTarget) || (p.v === value) !== (p.c === cumTarget))) k.feasible = false;
    }
    knots.push(k);
  }
  const meanAt = (gamma: number) => calibratedMean(h, { method: "WITHIN_BIN_WARP", gamma, knots });
  let a = Math.log(0.02), b = Math.log(50);
  const meanReachable: [number, number] = [meanAt(Math.exp(b)), meanAt(Math.exp(a))];
  if (pub.margin <= meanReachable[0]) a = b;
  else if (pub.margin >= meanReachable[1]) b = a;
  else {
    for (let it = 0; it < 200 && b - a > 1e-13; it++) {
      const mid = (a + b) / 2;
      if (meanAt(Math.exp(mid)) > pub.margin) a = mid;
      else b = mid;
    }
  }
  const gamma = Number(Math.exp((a + b) / 2).toPrecision(12));
  return { calibration: { method: "WITHIN_BIN_WARP", gamma, knots }, meanReachable };
}

// ---- draws and the anchor check -----------------------------------------------------------------------------------

/** J stratified quantiles u_j = (j + ½)/J, ascending. Deterministic; no generator. */
export function stratifiedDraws(h: PublishedHistogram, cal: Calibration, J = PRIOR_DRAWS): Float64Array {
  const out = new Float64Array(J);
  for (let j = 0; j < J; j++) out[j] = calibratedQuantile(h, cal, (j + 0.5) / J);
  return out;
}

const r6 = (x: number) => Math.round(x * 1e6) / 1e6 + 0;

export function anchorCheck(draws: Float64Array, h: PublishedHistogram, cal: Calibration, pub: { margin: number; probB: number; p10: number; p90: number }): AnchorCheck {
  const J = draws.length;
  let s = 0, above = 0;
  for (const x of draws) {
    s += x;
    if (x > 0) above++;
  }
  const mean = s / J, probB = above / J;
  const n = total(h), cum = cumulative(h);
  let maxBinCdfGap = 0, j = 0;
  for (let k = 0; k <= h.c.length; k++) {
    const edge = h.lo + k * h.w;
    while (j < J && draws[j] < edge) j++;
    maxBinCdfGap = Math.max(maxBinCdfGap, Math.abs(j / J - cum[k] / n));
  }
  const q = (u: number) => calibratedQuantile(h, cal, u);
  const marginGap = mean - pub.margin, pGap = probB - pub.probB;
  return {
    draws: J, mean: r6(mean), median: r6(q(0.5)), probB: r6(probB), p10: r6(q(0.1)), p90: r6(q(0.9)),
    marginGap: r6(marginGap), pGap: r6(pGap), p10Gap: r6(q(0.1) - pub.p10), p90Gap: r6(q(0.9) - pub.p90),
    maxBinCdfGap: r6(maxBinCdfGap),
    pass: Math.abs(marginGap) <= TOLERANCE.margin && Math.abs(pGap) <= TOLERANCE.prob,
  };
}

/** The original design: shift the uniform-within-bin histogram once, to the median or to the mean. */
export function singleOffsets(h: PublishedHistogram, pub: { margin: number; probB: number }): NonNullable<PriorRace["singleOffset"]> {
  const uniform: Calibration = { method: "WITHIN_BIN_WARP", gamma: 1, knots: [] };
  const mean = calibratedMean(h, uniform), median = calibratedQuantile(h, uniform, 0.5);
  const at = (shift: number) => {
    const marginGap = mean + shift - pub.margin, pGap = 1 - histogramCdf(h, -shift) - pub.probB;
    return { marginGap: r6(marginGap), pGap: r6(pGap), pass: Math.abs(marginGap) <= TOLERANCE.margin && Math.abs(pGap) <= TOLERANCE.prob };
  };
  return { medianShift: at(pub.margin - median), meanShift: at(pub.margin - mean) };
}

// ---- geography ----------------------------------------------------------------------------------------------------

/** Statewide margin after shifting every county's two-party log-odds by δ, holding turnout and other votes fixed. */
export function aggregateMargin(rows: [number, number, number, number][], delta: number): number {
  const e = Math.exp(delta);
  let num = 0, den = 0;
  for (const [a, b, , t] of rows) {
    den += t;
    const tp = a + b;
    if (tp > 0) num += tp * (b * e - a) / (a + b * e);
  }
  return den > 0 ? (100 * num) / den : 0;
}

export function solveShift(rows: [number, number, number, number][], margin: number): number | null {
  let a = -40, b = 40;
  if (margin <= aggregateMargin(rows, a) || margin >= aggregateMargin(rows, b)) return null;
  for (let it = 0; it < 200 && b - a > 1e-12; it++) {
    const mid = (a + b) / 2;
    if (aggregateMargin(rows, mid) < margin) a = mid;
    else b = mid;
  }
  return (a + b) / 2;
}

function geography(countyFile: string, counties: CountyRows, draws: Float64Array, pub: { margin: number }, indexTotal: number | null): NonNullable<PriorRace["geography"]> {
  const rows = Object.keys(counties).sort().map((k) => counties[k]);
  const expectedTotal = rows.reduce((s, r) => s + r[3], 0);
  const countySumMargin = aggregateMargin(rows, 0);
  const reachable: [number, number] = [r6(aggregateMargin(rows, -40)), r6(aggregateMargin(rows, 40))];
  let outsideReachable = 0;
  for (const x of draws) if (x <= reachable[0] || x >= reachable[1]) outsideReachable++;
  let solvedSample = 0, maxAggregateError = 0;
  for (let j = GEO_SAMPLE_EVERY / 2; j < draws.length; j += GEO_SAMPLE_EVERY) {
    const d = solveShift(rows, draws[j]);
    if (d === null) continue;
    solvedSample++;
    maxAggregateError = Math.max(maxAggregateError, Math.abs(aggregateMargin(rows, d) - draws[j]));
  }
  return {
    countyFile, counties: rows.length, expectedTotal, indexTotal,
    countySumMargin: r6(countySumMargin), countyBaselineGap: r6(pub.margin - countySumMargin), reachable,
    check: { outsideReachable, solvedSample, maxAggregateError: Number(maxAggregateError.toExponential(3)) },
  };
}

// ---- races --------------------------------------------------------------------------------------------------------

export const NEEDS = {
  HOUSE_DIST: "est.dist for each district ({lo, w, c} like Senate/governor, or the draws) from the per-district `marg` array in scripts/forecast/model/house_dyn.py (note: that array is D − R; publish R − D).",
  MEASURE_DIST: "a Yes-share histogram from the `draws` in scripts/forecast/measures/build_measures.py, plus, for all-ballots and ballot-floor rules, the total-ballots draws the threshold is measured against.",
  DOWNBALLOT_DIST: "est.dist for each statewide down-ballot race from scripts/forecast/downballot/build_downballot.py; downballot.json publishes only margin, prob, p10 and p90.",
  NO_FORECAST: "a forecast; none is published for local, judicial or special races.",
  CHAMBER: "nothing at race level; chamber control is a Phase B aggregation.",
  MODEL_ENTRY: "a model.json entry for this race.",
  RACE_DIST: "est.dist for this race.",
  FINER_DIST: "the simulation draws, or a finer histogram, for this race.",
} as const;

function unsupported(e: IndexEntry, status: "UNSUPPORTED" | "UNCONTESTED", reason: string, needsFromForecast: keyof typeof NEEDS | null, flags: string[], pub?: ForecastRace["est"], source = "none"): PriorRace {
  return {
    raceId: e.id, kind: e.k, state: e.st, status, reason, needsFromForecast, liveUse: "WITHHELD", flags,
    published: { source, margin: pub?.margin ?? null, probB: pub?.prob ?? null, p10: pub?.p10 ?? null, p90: pub?.p90 ?? null, dist: null, pointStatistic: null },
    calibration: null, geography: null, anchor: null, singleOffset: null,
  };
}

function withheldFlags(rule: RaceRule | null, f: ForecastRace, e: IndexEntry): string[] {
  const flags: string[] = [];
  if (!rule) flags.push("NO_RULE");
  else {
    if (rule.rule === "RCV") flags.push("RCV_FINAL_ROUND_MARGIN");
    else if (rule.rule !== "PLURALITY") flags.push("LIVE_RULE_NOT_PLURALITY");
    if (rule.support !== "SUPPORTED") flags.push("RULE_NOT_FULLY_SUPPORTED");
    for (const x of ["THIRD_CANDIDATE_MATERIAL", "NONSTANDARD_SIDES"]) if (rule.flags.includes(x)) flags.push(x);
  }
  const [ca, cb] = e.c ?? [];
  if (f.dem && f.gop && (ca?.[0] !== f.dem || cb?.[0] !== f.gop)) flags.push("SIDES_MISALIGNED_WITH_RESULTS");
  return flags;
}

export interface PriorInputs {
  forecast: { updated: string | null; races: ForecastRace[]; file: string };
  index: { asOf: string | null; races: IndexEntry[] };
  rules: RaceRulesFile;
  counties: (st: string) => { file: string; rows: Record<string, CountyRows> } | null;
  inputs: { path: string; sha256: string }[];
  priorId: string;
  draws?: number;
}

export function priorRace(e: IndexEntry, f: ForecastRace | undefined, rule: RaceRule | null, cty: { file: string; rows: Record<string, CountyRows> } | null, file: string, J: number): PriorRace {
  if (e.k === "leg") return unsupported(e, "UNSUPPORTED", "CHAMBER_LAYER", "CHAMBER", ["CHAMBER_LAYER_PHASE_B"]);
  if (e.k === "other") return unsupported(e, "UNSUPPORTED", "NO_FORECAST", "NO_FORECAST", []);
  if (e.k === "measure") return unsupported(e, "UNSUPPORTED", "NO_PUBLISHED_DISTRIBUTION", "MEASURE_DIST", []);
  if (e.k === "state") return unsupported(e, "UNSUPPORTED", "NO_PUBLISHED_DISTRIBUTION", "DOWNBALLOT_DIST", []);
  if (!f) return unsupported(e, "UNSUPPORTED", "NOT_IN_FORECAST", "MODEL_ENTRY", []);
  if (Math.abs(f.est.margin) >= 100 && (f.est.prob === 0 || f.est.prob === 1)) return unsupported(e, "UNCONTESTED", "ONE_MAJOR_CANDIDATE", null, ["UNCONTESTED"], f.est, file);
  if (!f.est.dist) return unsupported(e, "UNSUPPORTED", "NO_PUBLISHED_DISTRIBUTION", e.k === "house" ? "HOUSE_DIST" : "RACE_DIST", [], f.est, file);

  const h = f.est.dist;
  const pub = { margin: f.est.margin, probB: f.est.prob, p10: f.est.p10, p90: f.est.p90 };
  const { calibration, meanReachable } = calibrate(h, pub);
  const draws = stratifiedDraws(h, calibration, J);
  const anchor = anchorCheck(draws, h, calibration, pub);
  const flags = withheldFlags(rule, f, e);
  for (const k of calibration.knots) if (!k.feasible) flags.push(`KNOT_INFEASIBLE_${k.target}`);
  const rows = cty?.rows[e.id];
  let geo: PriorRace["geography"] = null;
  if (cty && rows && Object.keys(rows).length) {
    geo = geography(cty.file, rows, draws, pub, e.tot ?? null);
    if (Math.abs(geo.countyBaselineGap ?? 0) > DISCREPANCY_POINTS) flags.push("COUNTY_BASELINE_DISCREPANCY");
    if (geo.check.outsideReachable) flags.push("DRAWS_OUTSIDE_REACHABLE");
  } else flags.push("NO_COUNTY_FILE");
  const status = anchor.pass ? "ANCHORED" : "ANCHOR_FAILED";
  const reason = anchor.pass ? null : `mean gap ${anchor.marginGap}, P gap ${anchor.pGap}; mean reachable within bins [${r6(meanReachable[0])}, ${r6(meanReachable[1])}]`;
  const liveBlockers = flags.filter((x) => x !== "KNOT_INFEASIBLE_P10" && x !== "KNOT_INFEASIBLE_P90" && x !== "KNOT_INFEASIBLE_P_B");
  return {
    raceId: e.id, kind: e.k, state: e.st, status, reason,
    needsFromForecast: anchor.pass ? null : "FINER_DIST",
    liveUse: anchor.pass && liveBlockers.length === 0 ? "ELIGIBLE" : "WITHHELD",
    flags: flags.sort(),
    published: { source: file, ...pub, dist: h, pointStatistic: "MEAN" },
    calibration, geography: geo, anchor, singleOffset: singleOffsets(h, pub),
  };
}

export function countyAudit(index: IndexEntry[], counties: PriorInputs["counties"]): CountyAuditRow[] {
  const out: CountyAuditRow[] = [];
  for (const e of index) {
    const cty = counties(e.st);
    const rows = cty?.rows[e.id];
    if (!cty || !rows || !Object.keys(rows).length) continue;
    const rs = Object.values(rows);
    const A = rs.reduce((s, r) => s + r[0], 0), B = rs.reduce((s, r) => s + r[1], 0), T = rs.reduce((s, r) => s + r[3], 0);
    let row: Omit<CountyAuditRow, "gap" | "discrepant"> | null = null;
    if (e.k === "measure" && typeof e.yes === "number" && A + B > 0) row = { raceId: e.id, countyFile: cty.file, measure: "YES_MARGIN", countyValue: (100 * (A - B)) / (A + B), publishedValue: 2 * e.yes - 100 };
    else if (typeof e.m === "number" && T > 0) row = { raceId: e.id, countyFile: cty.file, measure: "MARGIN", countyValue: (100 * (B - A)) / T, publishedValue: e.m };
    if (!row) continue;
    const gap = Math.abs(row.countyValue - row.publishedValue);
    if (gap >= AUDIT_FLOOR) out.push({ ...row, countyValue: Math.round(row.countyValue * 100) / 100, publishedValue: Math.round(row.publishedValue * 100) / 100, gap: Math.round(gap * 100) / 100, discrepant: gap > DISCREPANCY_POINTS });
  }
  return out.sort((a, b) => b.gap - a.gap || a.raceId.localeCompare(b.raceId));
}

const tally = (xs: string[]) => Object.fromEntries([...xs.reduce((m, x) => m.set(x, (m.get(x) ?? 0) + 1), new Map<string, number>())].sort(([a], [b]) => a.localeCompare(b)));

export function buildPrior(p: PriorInputs): PriorFile {
  const J = p.draws ?? PRIOR_DRAWS;
  const fc = new Map(p.forecast.races.map((r) => [r.id, r]));
  const rules = new Map(p.rules.races.map((r) => [r.raceId, r]));
  const races = [...p.index.races].sort((a, b) => a.id.localeCompare(b.id)).map((e) => priorRace(e, fc.get(e.id), rules.get(e.id) ?? null, p.counties(e.st), p.forecast.file, J));
  return {
    schema: PRIOR_SCHEMA,
    priorId: p.priorId,
    forecastUpdated: p.forecast.updated,
    indexAsOf: p.index.asOf,
    builder: PRIOR_BUILDER_VERSION,
    inputs: p.inputs,
    method: {
      draws: J,
      sampling: "STRATIFIED_QUANTILES",
      tolerances: TOLERANCE,
      notes: [
        "Margins are B − A in points (Republican minus Democratic slot); probB is P(margin > 0).",
        "The published margin is the simulation mean, not the median; the anchor matches the mean and P(B) jointly.",
        "Calibration never moves mass between histogram bins: knots place the published mass below 0, p10 and p90 inside their bins, and one power warp inside the other bins sets the mean.",
        "Geography: a uniform two-party log-odds shift of the county file's baseline, solved per draw; turnout and other votes are held at the file's values.",
        "Draws are not stored; prior.ts regenerates them exactly from the histogram and calibration.",
      ],
    },
    counts: { byStatus: tally(races.map((r) => r.status)), byLiveUse: tally(races.map((r) => r.liveUse)), byFlag: tally(races.flatMap((r) => r.flags)) },
    needs: NEEDS,
    countyAudit: countyAudit(p.index.races, p.counties),
    races,
  };
}
