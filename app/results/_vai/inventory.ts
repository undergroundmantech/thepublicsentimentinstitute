// T5: inventory. How many votes are still to be counted, per reporting unit and for the race (math §2).
//
//   log T_c = log E_c + τ_s + τ_g(c) + u_c        T_c = final counted total in unit c, E_c = the forecast's expected total
//
// Evidence enters in exactly three ways, and never as a precinct share:
//   1. a lower bound. Votes already counted only truncate T_c ≥ N_c (a Tobit-style censored likelihood). They inform the
//      shared shocks τ_s and τ_g only when a unit is far up its own prior, so a partial count is never read as a final one;
//   2. an official statement of ballots still to count, T_c = N_c + (1 − ρ_c)·O_c + L_c, with a rejected share ρ_c and
//      eligible-but-not-yet-received ballots L_c (zero after the receipt deadline);
//   3. a completion level from the evidence ladder (schema §6). PRECINCTS_ALL_IN is not completion and is ignored.
//
// Method. u_c integrates out of the likelihood, so (τ_s, τ_g) have a closed-form unnormalised posterior over a lattice;
// they are drawn from it exactly (up to the lattice step) with no weights, no rejection and no collapse. Each unit's
// total is then drawn from its own truncated normal given those shocks. Deterministic for a seed.
//
// Not modelled in B1, on purpose: official statements and election-night completions do not update τ (conservative),
// and units with no region label share one regional shock.

import type { Interval, OutstandingInventory } from "../../lib/intelligence/types";
import type { VaiHyper } from "./hyper";
import { logNormalSurvival, logSumExp, normalQuantile, normalSurvival, normalSurvivalInverse } from "./normal";
import { Rng } from "./rng";
import type { CompletionLevel, Labeled, Quantiles, VaiInventory, VaiReturnsFrame } from "./types";

export const INVENTORY_MODEL_VERSION = "vai-inventory/1";

export type ReceiptClass = "ELECTION_DAY_OR_EARLIER" | "POSTMARK_GRACE" | "UNCLASSIFIED";

export interface InventoryUnit {
  id: string;
  /** The forecast's expected total votes, E_c. */
  expected: number;
  /** Votes counted so far in this unit, N_c. */
  reported: number;
  /** Group of counties sharing a regional turnout shock. Units without one share a single region. */
  region?: string;
  /** An official statement of this unit's ballots still to count. */
  official?: { outstanding: number; asOf: string; registerId: string } | null;
  /** Completion evidence for this unit (schema §6). Default PARTIAL. */
  completion?: CompletionLevel;
  /** The unit already beat its expectation on an earlier tick; its σ_u stays doubled for the rest of the night (math §2.3). */
  exceededBefore?: boolean;
}

export interface InventoryInput {
  raceId: string;
  asOf: string;
  units: InventoryUnit[];
  /** The state's receipt rule from the count-order ledger. */
  receipt: { class: ReceiptClass; deadlineUtc: string | null; countSpeed: number | null };
  /** An official statement for the race as a whole (the intelligence layer's confirmed outstanding). */
  statewideOfficial?: { outstanding: number; scope: "STATEWIDE_OR_DISTRICT" | "COUNTIES"; recordIds: string[] } | null;
  hyper: VaiHyper;
  seed: number;
  draws: number;
}

type Mode = "PRIOR" | "OFFICIAL" | "NIGHT_DONE" | "ALL_KNOWN" | "CERTIFIED" | "INERT";

export interface InventoryUnitReport {
  id: string;
  mode: Mode;
  completionApplied: CompletionLevel;
  expectedUsed: number;
  sigma: number;
  exceeded: boolean;
  flags: string[];
}

export interface InventoryPosterior {
  model: typeof INVENTORY_MODEL_VERSION;
  raceId: string;
  asOf: string;
  draws: number;
  ids: string[];
  /** N_c per unit, in the order of `ids`. */
  reported: Float64Array;
  /** T_c draws per unit: total[c][j] ≥ reported[c] for every draw. */
  total: Float64Array[];
  /** Σ_c R_c per draw. */
  remainingTotal: Float64Array;
  tauState: Float64Array;
  summary: {
    reported: number;
    remaining: Quantiles;
    total: Quantiles;
    officialOutstanding: number | null;
    officialScope: "STATEWIDE_OR_DISTRICT" | "COUNTIES" | "UNIT_LEVEL" | null;
  };
  perUnit: InventoryUnitReport[];
  late: { rule: ReceiptClass; applies: boolean; deadlineUtc: string | null };
  flags: string[];
  diagnostics: { latticeStep: number; tauStateNodes: number; tauRegionNodes: number; regions: number; unitsWithLikelihood: number };
  hyperId: string;
  seed: number;
}

const ZERO_Q: Quantiles = { median: 0, q10: 0, q90: 0 };

export function quantilesOf(xs: Float64Array): Quantiles {
  if (!xs.length) return ZERO_Q;
  const s = Float64Array.from(xs).sort();
  const at = (u: number) => {
    const p = u * (s.length - 1), i = Math.floor(p), f = p - i;
    return i + 1 < s.length ? s[i] * (1 - f) + s[i + 1] * f : s[i];
  };
  return { median: at(0.5), q10: at(0.1), q90: at(0.9) };
}

const afterDeadline = (asOf: string, deadlineUtc: string | null) => deadlineUtc !== null && Date.parse(asOf) >= Date.parse(deadlineUtc);

interface Prep {
  idx: number;
  id: string;
  N: number;
  E: number;
  lnE: number;
  lnN: number;
  sigma: number;
  mode: Mode;
  region: number;
  official: number;
  late: boolean;
  /** Which likelihood term the unit contributes to (τ_s, τ_g). */
  term: "CENSORED" | "EXACT" | null;
}

function prepare(input: InventoryInput) {
  const h = input.hyper.inventory;
  const grace = input.receipt.class === "POSTMARK_GRACE";
  const late = grace && !afterDeadline(input.asOf, input.receipt.deadlineUtc);
  const z = normalQuantile(h.exceedQuantile);
  const baseSigma = h.sigmaUnit * (grace ? h.graceMultiplier : 1) * (input.receipt.countSpeed === 2 ? h.slowCountMultiplier : 1);
  const regionIndex = new Map<string, number>();
  const flags = new Set<string>();
  const reports: InventoryUnitReport[] = [];
  const preps: Prep[] = [];

  input.units.forEach((u, idx) => {
    const uf: string[] = [];
    let level: CompletionLevel = u.completion ?? "PARTIAL";
    if (level === "PRECINCTS_ALL_IN") {
      uf.push("PRECINCTS_ALL_IN_NOT_COMPLETE");
      level = "PARTIAL";
    }
    if (level === "ALL_KNOWN_BALLOTS_COUNTED" && late) {
      uf.push("COMPLETION_BEFORE_DEADLINE");
      level = "OFFICIAL_ELECTION_NIGHT_COMPLETE";
    }
    const N = Math.max(0, u.reported);
    let E = u.expected;
    if (!(E > 0)) {
      if (N > 0) uf.push("NO_EXPECTATION");
      E = N;
    }
    let mode: Mode;
    if (E <= 0 && N <= 0) mode = "INERT";
    else if (level === "CERTIFIED") mode = "CERTIFIED";
    else if (level === "ALL_KNOWN_BALLOTS_COUNTED") mode = "ALL_KNOWN";
    else if (u.official) mode = "OFFICIAL";
    else if (level === "OFFICIAL_ELECTION_NIGHT_COMPLETE") mode = "NIGHT_DONE";
    else mode = "PRIOR";

    const spread = Math.sqrt(h.sigmaTauState ** 2 + h.sigmaTauRegion ** 2 + baseSigma ** 2);
    const exceeded = mode === "PRIOR" && N > 0 && E > 0 && Math.log(N) > Math.log(E) + z * spread;
    if (exceeded) uf.push("TOTAL_EXCEEDS_EXPECTED");
    const sigma = baseSigma * (exceeded || u.exceededBefore ? h.exceedMultiplier : 1);

    const needsRegion = mode === "PRIOR" || mode === "NIGHT_DONE" || mode === "ALL_KNOWN" || mode === "CERTIFIED";
    const label = u.region ?? "ALL";
    if (needsRegion && !regionIndex.has(label)) regionIndex.set(label, regionIndex.size);
    const term: Prep["term"] = N <= 0 ? null : mode === "PRIOR" || mode === "NIGHT_DONE" ? "CENSORED" : mode === "ALL_KNOWN" || mode === "CERTIFIED" ? "EXACT" : null;
    preps.push({ idx, id: u.id, N, E, lnE: E > 0 ? Math.log(E) : 0, lnN: N > 0 ? Math.log(N) : 0, sigma, mode, region: needsRegion ? (regionIndex.get(label) as number) : -1, official: u.official?.outstanding ?? 0, late, term });
    reports.push({ id: u.id, mode, completionApplied: mode === "ALL_KNOWN" ? "ALL_KNOWN_BALLOTS_COUNTED" : mode === "CERTIFIED" ? "CERTIFIED" : mode === "NIGHT_DONE" ? "OFFICIAL_ELECTION_NIGHT_COMPLETE" : "PARTIAL", expectedUsed: E, sigma, exceeded, flags: uf });
    for (const f of uf) flags.add(f);
  });
  return { preps, reports, flags, regions: regionIndex.size, late };
}

/** The lattice posterior of (τ_s, τ_g) and a sampler for it. Lattice step h; τ = k·h. */
function shockSampler(preps: Prep[], regions: number, hyper: VaiHyper["inventory"]) {
  const sS = hyper.sigmaTauState, sG = hyper.sigmaTauRegion;
  const pos = [sS, sG].filter((x) => x > 0);
  const step = pos.length ? Math.min(...pos) / 15 : 1;
  const nS = sS > 0 ? Math.ceil(6 * sS / step) : 0, nG = sG > 0 ? Math.ceil(6 * sG / step) : 0;
  const wS = 2 * nS + 1, wG = 2 * nG + 1, span = nS + nG, tN = 2 * span + 1;
  const logPriorS = new Float64Array(wS), logPriorG = new Float64Array(wG);
  for (let i = 0; i < wS; i++) logPriorS[i] = sS > 0 ? -0.5 * (((i - nS) * step) / sS) ** 2 : 0;
  for (let j = 0; j < wG; j++) logPriorG[j] = sG > 0 ? -0.5 * (((j - nG) * step) / sG) ** 2 : 0;

  // Σ over each region's units of the log-likelihood of T_c given x = τ_s + τ_g, tabulated on the lattice of x.
  const acc: Float64Array[] = Array.from({ length: regions }, () => new Float64Array(tN));
  let withTerm = 0;
  for (const p of preps) {
    if (!p.term || p.region < 0) continue;
    withTerm++;
    const a = acc[p.region];
    for (let t = 0; t < tN; t++) {
      const mu = p.lnE + (t - span) * step;
      const zz = (p.lnN - mu) / p.sigma;
      a[t] += p.term === "CENSORED" ? logNormalSurvival(zz) : -0.5 * zz * zz - Math.log(p.sigma);
    }
  }

  // Per region and per τ_s node, the normalised CDF over τ_g nodes, and the log marginal that τ_s sees.
  const logM = Float64Array.from(logPriorS);
  const cdf: Float64Array[][] = [];
  const row = new Float64Array(wG);
  for (let r = 0; r < regions; r++) {
    const rows: Float64Array[] = [];
    for (let i = 0; i < wS; i++) {
      for (let j = 0; j < wG; j++) row[j] = logPriorG[j] + acc[r][i - nS + j - nG + span];
      const lz = logSumExp(row);
      logM[i] += lz;
      const c = new Float64Array(wG);
      let run = 0;
      for (let j = 0; j < wG; j++) {
        run += Math.exp(row[j] - lz);
        c[j] = run;
      }
      for (let j = 0; j < wG; j++) c[j] /= run;
      rows.push(c);
    }
    cdf.push(rows);
  }
  const lm = logSumExp(logM);
  const cS = new Float64Array(wS);
  let run = 0;
  for (let i = 0; i < wS; i++) {
    run += Math.exp(logM[i] - lm);
    cS[i] = run;
  }
  for (let i = 0; i < wS; i++) cS[i] /= run;

  const pick = (c: Float64Array, u: number) => {
    let lo = 0, hi = c.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (c[mid] < u) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return {
    step, nodes: { state: wS, region: wG }, withTerm,
    draw(rng: Rng, tauRegion: Float64Array): number {
      const i = pick(cS, rng.uniform());
      const ts = sS > 0 ? (i - nS + rng.uniform() - 0.5) * step : 0;
      for (let r = 0; r < regions; r++) {
        const j = pick(cdf[r][i], rng.uniform());
        tauRegion[r] = sG > 0 ? (j - nG + rng.uniform() - 0.5) * step : 0;
      }
      return ts;
    },
  };
}

export function estimateInventory(input: InventoryInput): InventoryPosterior {
  const hv = input.hyper.inventory;
  const J = input.draws;
  const { preps, reports, flags, regions, late } = prepare(input);
  const sampler = shockSampler(preps, regions, hv);
  const rng = Rng.fork(input.seed, `${INVENTORY_MODEL_VERSION}|${input.raceId}`);
  const n = preps.length;
  const total = preps.map(() => new Float64Array(J));
  const remainingTotal = new Float64Array(J), tauState = new Float64Array(J);
  const tauRegion = new Float64Array(Math.max(regions, 1));
  const R = new Float64Array(n);
  const exp1 = () => -Math.log(rng.uniform());
  const beta1 = () => 1 - Math.pow(1 - rng.uniform(), 1 / hv.rejectionBeta);
  const sumE = preps.reduce((s, p) => s + p.E, 0);
  const sw = input.statewideOfficial ?? null;
  if (sw) flags.add("OFFICIAL_OUTSTANDING_USED");
  if (preps.some((p) => p.mode === "OFFICIAL")) flags.add("OFFICIAL_OUTSTANDING_USED");

  for (let j = 0; j < J; j++) {
    const ts = sampler.draw(rng, tauRegion);
    tauState[j] = ts;
    let fixedSum = 0, flexSum = 0;
    for (const p of preps) {
      let r = 0;
      switch (p.mode) {
        case "PRIOR": {
          const mu = p.lnE + ts + tauRegion[p.region];
          let zz: number;
          if (p.N > 0) {
            const a = (p.lnN - mu) / p.sigma, q = normalSurvival(a);
            zz = q > 0 ? Math.max(a, normalSurvivalInverse(rng.uniform() * q)) : a + exp1() / Math.max(a, 1);
          } else zz = rng.normal();
          r = Math.max(0, Math.exp(mu + p.sigma * zz) - p.N);
          flexSum += r;
          break;
        }
        case "OFFICIAL":
          r = (1 - beta1()) * p.official + (p.late ? exp1() * hv.lateArrivalMeanShare * p.E : 0);
          fixedSum += r;
          break;
        case "NIGHT_DONE":
          r = exp1() * hv.provisionalShareElectionNight * p.N + (p.late ? exp1() * hv.lateArrivalMeanShare * p.E : 0);
          fixedSum += r;
          break;
        case "ALL_KNOWN":
          r = exp1() * hv.provisionalShareAllKnown * p.N;
          fixedSum += r;
          break;
        default:
          break;
      }
      R[p.idx] = r;
    }
    if (sw) {
      const floorOnly = sw.scope === "COUNTIES";
      const base = (1 - beta1()) * sw.outstanding;
      const target = floorOnly ? base : base + (late ? exp1() * hv.lateArrivalMeanShare * sumE : 0);
      const need = Math.max(0, target - fixedSum);
      if (!floorOnly || flexSum < need) {
        if (flexSum > 0) {
          const k = need / flexSum;
          for (const p of preps) if (p.mode === "PRIOR") R[p.idx] *= k;
        } else if (need > 0) {
          const pe = preps.filter((p) => p.mode === "PRIOR").reduce((s, p) => s + p.E, 0);
          for (const p of preps) if (p.mode === "PRIOR" && pe > 0) R[p.idx] = (need * p.E) / pe;
        }
      }
    }
    let rt = 0;
    for (const p of preps) {
      total[p.idx][j] = p.N + R[p.idx];
      rt += R[p.idx];
    }
    remainingTotal[j] = rt;
  }

  const reported = Float64Array.from(preps.map((p) => p.N));
  const sumN = preps.reduce((s, p) => s + p.N, 0);
  const unitOfficial = preps.filter((p) => p.mode === "OFFICIAL");
  const totalSum = new Float64Array(J);
  for (let j = 0; j < J; j++) totalSum[j] = sumN + remainingTotal[j];
  return {
    model: INVENTORY_MODEL_VERSION, raceId: input.raceId, asOf: input.asOf, draws: J,
    ids: preps.map((p) => p.id), reported, total, remainingTotal, tauState,
    summary: {
      reported: sumN, remaining: quantilesOf(remainingTotal), total: quantilesOf(totalSum),
      officialOutstanding: sw ? sw.outstanding : unitOfficial.length ? unitOfficial.reduce((s, p) => s + p.official, 0) : null,
      officialScope: sw ? sw.scope : unitOfficial.length ? "UNIT_LEVEL" : null,
    },
    perUnit: reports,
    late: { rule: input.receipt.class, applies: late, deadlineUtc: input.receipt.deadlineUtc },
    flags: [...flags].sort(),
    diagnostics: { latticeStep: sampler.step, tauStateNodes: sampler.nodes.state, tauRegionNodes: sampler.nodes.region, regions, unitsWithLikelihood: sampler.withTerm },
    hyperId: input.hyper.hyperId, seed: input.seed,
  };
}

// ---- adapters -----------------------------------------------------------------------------------------------------

/**
 * Units from a reconciled returns frame (T3) and the forecast county file. Only each county's vote total is read: the
 * frame's precinct metadata plays no part. Votes in the unmatched pseudo-county and the topline residual are reported
 * separately because their remainder is zero (math §4); they never disappear from the total.
 */
export function unitsFromFrame(frame: VaiReturnsFrame, expected: Readonly<Record<string, { total: number; region?: string }>>): { units: InventoryUnit[]; unmatchedReported: number } {
  const units = Object.keys(expected).sort().map((k): InventoryUnit => ({ id: k, expected: expected[k].total, reported: frame.counties[k]?.t ?? 0, region: expected[k].region }));
  return { units, unmatchedReported: frame.unmatched.t + frame.residual.t };
}

/** The intelligence layer's confirmed-outstanding figure as this model's statewide statement. Only a VERIFIED value is used. */
export function statewideOfficialFrom(inv: OutstandingInventory | null): InventoryInput["statewideOfficial"] {
  const q = inv?.officiallyConfirmedOutstanding;
  if (!inv || !q || q.value === null || q.evidenceClass !== "VERIFIED" || inv.officialScope === null) return null;
  return { outstanding: q.value, scope: inv.officialScope, recordIds: q.sources };
}

const interval = (q: Quantiles): Interval => ({ low: q.q10, central: q.median, high: q.q90 });

/** The Phase A `VaiInventory` contract, filled. Every estimated figure is an interval with its label; late volume stays UNKNOWN. */
export function toVaiInventory(p: InventoryPosterior, intel: OutstandingInventory | null = null): VaiInventory {
  const official: Labeled<number> = p.summary.officialOutstanding === null
    ? { value: null, label: "UNKNOWN", source: null, asOf: null }
    : { value: p.summary.officialOutstanding, label: "OFFICIAL_STATEMENT", source: intel?.officiallyConfirmedOutstanding.sources.join(",") || "unit-level statements", asOf: p.asOf };
  return {
    raceId: p.raceId, asOf: p.asOf,
    reported: { value: p.summary.reported, label: "VERIFIED", source: "returns frame", asOf: p.asOf },
    officialOutstanding: official,
    lateEligible: { value: null, label: "UNKNOWN", source: "count-order ledger: rule only; the register stores no volume", asOf: null, rule: p.late.rule === "UNCLASSIFIED" ? "UNCLASSIFIED" : p.late.rule, deadlineUtc: p.late.deadlineUtc },
    estimatedRemaining: { interval: interval(p.summary.remaining), label: "ESTIMATED" },
    expectedFinal: { interval: interval(p.summary.total), label: "ESTIMATED" },
    tier: p.summary.officialOutstanding !== null ? "OFFICIAL_JURISDICTION_COUNT" : "FORECAST_POINT_NO_RANGE",
    intel,
  };
}
