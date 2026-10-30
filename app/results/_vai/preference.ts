// T6: preference. How the votes still to be counted will split (math §3 to §5).
//
// For candidate k against the reference candidate (side A), unit c, the unit's final log-ratio is
//
//   θ_c = η⁰_c + α + δ_s + ζ_g(c) + γ·z_c + ε_c
//
// η⁰ is the forecast's county baseline, δ_s the state-level shift (the published forecast's own distribution of the
// margin, so a race with nothing counted reproduces it), ζ regional, γ·z a lean-dependent slope, ε a county residual.
// The counted and the remaining electorates differ by a gap g that depends on count order: the counted votes sit at
// θ_c − (1−π_c)·g_c and the remaining votes at θ_c + π_c·g_c, which average back to θ_c. π_c = N_c / T_c is a *vote*
// share (counted votes over the unit's final total), drawn from the inventory. Precincts reporting never appears.
//
// Why there is no deterministic partisan adjustment. g has mean zero (math §3.3, μ_g = 0 in v1) under every scenario.
// The ledger's count order changes how wide the gap's uncertainty is (σ_g, by stage and column), never which side it favours.
//
// Computation. For each inventory draw and scenario the observed log-ratios are Gaussian given the latent structure; the
// latent part is low rank (regions + lean slope + state shift + the centring of ε), so the marginal likelihood and the
// posterior of every latent term come from an m×m system (Woodbury) rather than an n×n one, and the posterior is sampled
// by Matheron's rule (a prior draw, corrected by the data). The published state-shift draws are carried through
// importance weights; the scenarios are summed out analytically and drawn afterwards from their posterior given the draw.
//
// Approximations stated, not hidden: the importance weights treat the observed log-ratio's mean as unaffected by the
// turnout draw except through π_c; the sampling variance of an observed log-ratio is the binomial one at the observed counts.

import type { GapColumn, Stage, VaiHyper } from "./hyper";
import type { InventoryPosterior, ReceiptClass } from "./inventory";
import { logSumExp, normalQuantile } from "./normal";
import { stratifiedDraws, type Calibration, type CountyRows } from "./prior";
import { Rng } from "./rng";
import type { PublishedHistogram } from "./types";

export const PREFERENCE_MODEL_VERSION = "vai-preference/1";

// ---- inputs -------------------------------------------------------------------------------------------------------

export interface PrefUnit {
  id: string;
  region: string;
  /** The forecast's expected total votes, the weight of the unit in the state's mean. */
  expected: number;
  /** η⁰ for candidates 1..K−1 against candidate 0: the forecast baseline log-ratios. */
  eta0: number[];
  /** Votes counted so far for each of the K candidates (index 0 is the reference). */
  votes: number[];
  /** A recent downward revision of this county's forecast (math §3.1): its baseline variance is multiplied by κ. */
  revised?: boolean;
}

export type StateShift = { kind: "GAUSSIAN"; mean: number; sd: number } | { kind: "DRAWS"; values: Float64Array };

export type ScenarioId = "LEDGER" | "MIXED" | "VARYING";

export interface Scenario {
  id: ScenarioId;
  /** Prior weight. */
  weight: number;
  /** The count-order column whose σ_g the scenario uses; "MAX" takes the largest of the three. */
  column: GapColumn | "MAX";
}

export type CountOrderCategory = "A" | "B" | "C" | "D";

export interface CountOrderProfile {
  category: CountOrderCategory | null;
  /** The state's ledger entry carries an unresolved caveat (the evidence register's LEDGER_CAVEAT, status UNRESOLVED). */
  unresolved: boolean;
  countSpeed: number | null;
  receiptClass: ReceiptClass | null;
}

/** Reads one `data/vai/count_order_2026.json` jurisdiction record. */
export function profileFromJurisdiction(j: { firstRelease?: { category?: string | null } | null; countSpeed?: { code?: number | null } | null; confidence?: { level?: string } | null; lateCounting?: { receiptClassFromLedger?: string | null } | null } | null): CountOrderProfile {
  const c = j?.firstRelease?.category;
  const r = j?.lateCounting?.receiptClassFromLedger;
  return {
    category: c === "A" || c === "B" || c === "C" || c === "D" ? c : null,
    unresolved: j?.confidence?.level === "LEDGER_CAVEATED",
    countSpeed: typeof j?.countSpeed?.code === "number" ? j.countSpeed.code : null,
    receiptClass: r === "ELECTION_DAY_OR_EARLIER" || r === "POSTMARK_GRACE" ? r : r ? "UNCLASSIFIED" : null,
  };
}

/** The three scenarios of math §5 and their prior weights. A race with no ledger entry uses the widest column, flagged by the caller. */
export function scenariosFor(profile: CountOrderProfile, hyper: VaiHyper): Scenario[] {
  const w = hyper.preference.scenarioWeights;
  const wl = profile.unresolved || profile.category === null ? w.ledgerWhenUnresolved : w.ledger;
  const rest = 1 - wl;
  const wm = (rest * w.mixed) / (w.mixed + w.varying);
  const wv = rest - wm;
  const col: GapColumn | "MAX" = profile.category === null ? "MAX" : profile.category === "C" ? "C" : profile.category === "D" ? "D" : "AB";
  // A category-C state reports a mixed batch already, so its ledger and mixed scenarios coincide.
  if (col === "C") return [{ id: "LEDGER", weight: wl + wm, column: "C" }, { id: "VARYING", weight: wv, column: "D" }];
  return [{ id: "LEDGER", weight: wl, column: col }, { id: "MIXED", weight: wm, column: "C" }, { id: "VARYING", weight: wv, column: "D" }];
}

/** The count stage, from reported votes as a share of the forecast's expected total. */
export function stageOf(reportedShare: number, hyper: VaiHyper): Stage {
  const s = hyper.preference.stage;
  return reportedShare < s.firstBelow ? "FIRST" : reportedShare < s.mixedBelow ? "MIXED" : "TAIL";
}

export function gapSigma(stage: Stage, column: GapColumn | "MAX", hyper: VaiHyper): number {
  const g = hyper.preference.sigmaGap[stage];
  return column === "MAX" ? Math.max(g.AB, g.C, g.D) : g[column];
}

export interface PreferenceInput {
  raceId: string;
  units: PrefUnit[];
  inventory: InventoryPosterior;
  /** Length K−1: the state-level shift of candidate k=1..K−1 against candidate 0. */
  stateShift: StateShift[];
  scenarios: Scenario[];
  /** Added to every unit's baseline log-ratio so that a race with nothing counted reproduces the published anchor. */
  anchorOffset?: number[];
  /**
   * How published state-shift draws meet the count. WEIGHTED (B1): each draw is one importance-weighted particle, with a Gaussian
   * fallback when the weights degenerate. MARGINALISED (B2): the shift is integrated out analytically given the other latent terms
   * (its likelihood is Gaussian in δ), so only the turnout draws are weighted and the published shape is kept. Default WEIGHTED.
   */
  shiftMode?: "WEIGHTED" | "MARGINALISED";
  hyper: VaiHyper;
  seed: number;
}

export interface PreferenceDraw {
  /** 0..J−1: the position of this draw in the output. */
  index: number;
  /** The inventory draw it was paired with. */
  inventoryDraw: number;
  scenario: number;
  /** Final log-ratios of the remaining votes, [contrast][unit]. Buffers are reused between calls: copy to keep. */
  q: Float64Array[];
  /** Remaining votes per unit in this draw: T_c − N_c. */
  remaining: Float64Array;
}

export interface PreferenceResult {
  model: typeof PREFERENCE_MODEL_VERSION;
  raceId: string;
  draws: number;
  stage: Stage;
  reportedShare: number;
  reportingUnits: number;
  candidates: number;
  scenarios: { id: ScenarioId; column: GapColumn | "MAX"; sigmaGap: number; prior: number; posterior: number }[];
  /** Kish effective sample size of the importance weights, as a fraction of J. */
  essFraction: number;
  shiftMode: "WEIGHTED" | "MARGINALISED" | "GAUSSIAN" | "NONE";
  flags: string[];
  hyperId: string;
  seed: number;
}

// ---- small dense linear algebra ----------------------------------------------------------------------------------

/** LU with partial pivoting, in place. Returns log|det|, or NaN when singular. */
function luDecompose(a: Float64Array, m: number, piv: Int32Array): number {
  let logdet = 0;
  for (let i = 0; i < m; i++) piv[i] = i;
  for (let k = 0; k < m; k++) {
    let p = k, best = Math.abs(a[k * m + k]);
    for (let i = k + 1; i < m; i++) {
      const v = Math.abs(a[i * m + k]);
      if (v > best) { best = v; p = i; }
    }
    if (!(best > 1e-300)) return NaN;
    if (p !== k) {
      for (let j = 0; j < m; j++) { const t = a[k * m + j]; a[k * m + j] = a[p * m + j]; a[p * m + j] = t; }
      const t = piv[k]; piv[k] = piv[p]; piv[p] = t;
    }
    const d = a[k * m + k];
    logdet += Math.log(Math.abs(d));
    for (let i = k + 1; i < m; i++) {
      const f = (a[i * m + k] /= d);
      if (f !== 0) for (let j = k + 1; j < m; j++) a[i * m + j] -= f * a[k * m + j];
    }
  }
  return logdet;
}

/** Solves A x = b in place in `b` given the LU factors. */
function luSolve(a: Float64Array, m: number, piv: Int32Array, b: Float64Array, tmp: Float64Array): void {
  for (let i = 0; i < m; i++) tmp[i] = b[piv[i]];
  for (let i = 0; i < m; i++) { let s = tmp[i]; for (let j = 0; j < i; j++) s -= a[i * m + j] * tmp[j]; tmp[i] = s; }
  for (let i = m - 1; i >= 0; i--) { let s = tmp[i]; for (let j = i + 1; j < m; j++) s -= a[i * m + j] * tmp[j]; tmp[i] = s / a[i * m + i]; }
  for (let i = 0; i < m; i++) b[i] = tmp[i];
}

// ---- one contrast ------------------------------------------------------------------------------------------------

/** What one contrast needs that does not depend on the draw. */
interface Contrast {
  k: number;
  n: number;
  eta0: Float64Array;
  z: Float64Array;
  w: Float64Array;
  wSum2: number;
  region: Int32Array;
  regionW: Float64Array;
  G: number;
  rep: Int32Array;
  nS: number;
  y: Float64Array;
  ve: Float64Array;
  m: number;
  /** nS × m loadings of the latent block, row-major. */
  B: Float64Array;
  /** m × m prior covariance of the latent block. */
  K: Float64Array;
  sdZeta: number;
  sdGamma: number;
  sdDelta: number;
  hasZeta: boolean;
  hasGamma: boolean;
  hasDelta: boolean;
  /** Column of the shared selection gap in B and K (−1 when the shared component is off), and its variance share ρ. */
  gapCol: number;
  rho: number;
  deltaMean: number;
  deltaValues: Float64Array | null;
  alpha: number;
  sdEps: number;
  scratch: {
    dInv: Float64Array; Gm: Float64Array; A: Float64Array; piv: Int32Array; tmp: Float64Array; t: Float64Array; s: Float64Array; r: Float64Array; u: Float64Array; ys: Float64Array;
  };
}

function buildContrast(units: PrefUnit[], k: number, shift: StateShift, alpha: number, reported: Float64Array, hyper: VaiHyper): Contrast {
  const hp = hyper.preference;
  const n = units.length;
  const eta0 = Float64Array.from(units.map((u) => u.eta0[k - 1]));
  const E = units.reduce((s, u) => s + u.expected, 0);
  const w = Float64Array.from(units.map((u) => (E > 0 ? u.expected / E : 1 / n)));
  let wSum2 = 0;
  for (let c = 0; c < n; c++) wSum2 += w[c] * w[c];

  const labels = [...new Set(units.map((u) => u.region))].sort();
  const G = labels.length;
  const region = Int32Array.from(units.map((u) => labels.indexOf(u.region)));
  const regionW = new Float64Array(G);
  for (let c = 0; c < n; c++) regionW[region[c]] += w[c];

  let mean = 0;
  for (let c = 0; c < n; c++) mean += w[c] * eta0[c];
  let v = 0;
  for (let c = 0; c < n; c++) v += w[c] * (eta0[c] - mean) ** 2;
  const sd = Math.sqrt(v);
  const z = new Float64Array(n);
  if (sd > 1e-9) for (let c = 0; c < n; c++) z[c] = (eta0[c] - mean) / sd;

  const rep: number[] = [];
  for (let c = 0; c < n; c++) if (reported[c] > 0 && units[c].votes[0] + units[c].votes[k] > 0) rep.push(c);
  const nS = rep.length;
  const y = new Float64Array(nS), ve = new Float64Array(nS);
  rep.forEach((c, s) => {
    const a = units[c].votes[0] + hp.pseudoCount, b = units[c].votes[k] + hp.pseudoCount;
    y[s] = Math.log(b / a);
    ve[s] = 1 / a + 1 / b;
  });

  const hasZeta = G > 1 && hp.sigmaRegion > 0, hasGamma = hp.sigmaGamma > 0 && sd > 1e-9;
  const sdDelta = shift.kind === "GAUSSIAN" ? shift.sd : 0;
  const hasDelta = shift.kind === "GAUSSIAN" && shift.sd > 0;
  const rho = Math.min(0.999, Math.max(0, hp.rhoGap ?? 0));
  const hasGap = rho > 0;
  const m = (hasZeta ? G : 0) + (hasGamma ? 1 : 0) + (hasDelta ? 1 : 0) + (hasGap ? 1 : 0) + 2;
  const B = new Float64Array(nS * m), K = new Float64Array(m * m);
  let col = 0;
  if (hasZeta) {
    for (let g = 0; g < G; g++) K[(col + g) * m + col + g] = hp.sigmaRegion ** 2;
    rep.forEach((c, s) => { for (let g = 0; g < G; g++) B[s * m + col + g] = (region[c] === g ? 1 : 0) - regionW[g]; });
    col += G;
  }
  if (hasGamma) {
    K[col * m + col] = hp.sigmaGamma ** 2;
    rep.forEach((c, s) => { B[s * m + col] = z[c]; });
    col++;
  }
  if (hasDelta) {
    K[col * m + col] = sdDelta ** 2;
    for (let s = 0; s < nS; s++) B[s * m + col] = 1;
    col++;
  }
  // the shared selection gap: loadings −(1−π) and variance ρσ_g² are set per (draw, scenario) in `factorize`
  const gapCol = hasGap ? col : -1;
  if (hasGap) col++;
  // the centring of ε: columns [1, w_S] with covariance σ_ε²·[[W, −1], [−1, 0]]
  const e2 = hp.sigmaEps ** 2;
  K[col * m + col] = e2 * wSum2;
  K[col * m + col + 1] = -e2;
  K[(col + 1) * m + col] = -e2;
  rep.forEach((c, s) => { B[s * m + col] = 1; B[s * m + col + 1] = w[c]; });

  return {
    k, n, eta0, z, w, wSum2, region, regionW, G, rep: Int32Array.from(rep), nS, y, ve, m, B, K,
    sdZeta: hp.sigmaRegion, sdGamma: hp.sigmaGamma, sdDelta, hasZeta, hasGamma, hasDelta, gapCol, rho,
    deltaMean: shift.kind === "GAUSSIAN" ? shift.mean : 0,
    deltaValues: shift.kind === "DRAWS" ? shift.values : null,
    alpha, sdEps: hp.sigmaEps,
    scratch: {
      dInv: new Float64Array(nS), Gm: new Float64Array(m * m), A: new Float64Array(m * m), piv: new Int32Array(m), tmp: new Float64Array(m),
      t: new Float64Array(m), s: new Float64Array(m), r: new Float64Array(nS), u: new Float64Array(nS), ys: new Float64Array(nS),
    },
  };
}

/** Builds D⁻¹ and the LU of A = I + (BᵀD⁻¹B)K for one (draw, scenario). Returns log|Σ_y|, with Σ_y = D + B K Bᵀ. */
function factorize(cx: Contrast, pi: Float64Array, sigmaG: number, kappa: Float64Array): number {
  const { nS, m, B, K } = cx;
  const { dInv, Gm, A, piv } = cx.scratch;
  const e2 = cx.sdEps * cx.sdEps, g2 = sigmaG * sigmaG * (1 - cx.rho);
  let logD = 0;
  Gm.fill(0);
  if (cx.gapCol >= 0) {
    K[cx.gapCol * m + cx.gapCol] = cx.rho * sigmaG * sigmaG;
    for (let s = 0; s < nS; s++) B[s * m + cx.gapCol] = -(1 - pi[s]);
  }
  for (let s = 0; s < nS; s++) {
    const d = e2 + (1 - pi[s]) ** 2 * g2 + kappa[s] * cx.ve[s];
    logD += Math.log(d);
    const di = 1 / d;
    dInv[s] = di;
    for (let a = 0; a < m; a++) {
      const f = di * B[s * m + a];
      if (f !== 0) for (let b = a; b < m; b++) Gm[a * m + b] += f * B[s * m + b];
    }
  }
  for (let a = 0; a < m; a++) for (let b = 0; b < a; b++) Gm[a * m + b] = Gm[b * m + a];
  for (let a = 0; a < m; a++) {
    for (let b = 0; b < m; b++) {
      let sum = a === b ? 1 : 0;
      for (let c = 0; c < m; c++) sum += Gm[a * m + c] * K[c * m + b];
      A[a * m + b] = sum;
    }
  }
  const ld = luDecompose(A, m, piv);
  return Number.isNaN(ld) ? NaN : logD + ld;
}

/** u = Σ_y⁻¹ v, for the current factorisation; written to `out`. */
function applyInverse(cx: Contrast, v: Float64Array, out: Float64Array): void {
  const { nS, m, B, K } = cx;
  const { dInv, A, piv, tmp, t, s } = cx.scratch;
  t.fill(0);
  for (let i = 0; i < nS; i++) {
    const f = dInv[i] * v[i];
    for (let a = 0; a < m; a++) t[a] += B[i * m + a] * f;
  }
  luSolve(A, m, piv, t, tmp);
  for (let a = 0; a < m; a++) {
    let sum = 0;
    for (let b = 0; b < m; b++) sum += K[a * m + b] * t[b];
    s[a] = sum;
  }
  for (let i = 0; i < nS; i++) {
    let bs = 0;
    for (let a = 0; a < m; a++) bs += B[i * m + a] * s[a];
    out[i] = dInv[i] * (v[i] - bs);
  }
}

/** The log marginal likelihood of the observed log-ratios (up to a constant that does not depend on the draw), ½-scaled. */
function logLik(cx: Contrast, pi: Float64Array, sigmaG: number, kappa: Float64Array, deltaFixed: number): number {
  const { nS } = cx;
  if (nS === 0) return 0;
  const logdet = factorize(cx, pi, sigmaG, kappa);
  if (Number.isNaN(logdet)) return -Infinity;
  const { r, u } = cx.scratch;
  for (let s = 0; s < nS; s++) r[s] = cx.y[s] - cx.eta0[cx.rep[s]] - cx.alpha - deltaFixed;
  applyInverse(cx, r, u);
  let quad = 0;
  for (let s = 0; s < nS; s++) quad += r[s] * u[s];
  return -0.5 * (quad + logdet);
}

// ---- the state shift integrated out ---------------------------------------------------------------------------------

/** The published shift draws as equal-mass Gaussian bins: weight 1/NB, mean and variance each. Keeps skew and multimodality. */
interface ShiftBins { mean: Float64Array; vari: Float64Array; nb: number }

function makeBins(values: Float64Array, target = 500): ShiftBins {
  const s = Float64Array.from(values).sort();
  const nb = Math.max(1, Math.min(target, Math.floor(s.length / 8)));
  const mean = new Float64Array(nb), vari = new Float64Array(nb);
  for (let b = 0; b < nb; b++) {
    const lo = Math.floor((b * s.length) / nb), hi = Math.floor(((b + 1) * s.length) / nb);
    let m = 0;
    for (let i = lo; i < hi; i++) m += s[i];
    m /= hi - lo;
    let v = 0;
    for (let i = lo; i < hi; i++) v += (s[i] - m) ** 2;
    mean[b] = m;
    vari[b] = Math.max(v / Math.max(hi - lo, 1), 1e-12);
  }
  return { mean, vari, nb };
}

interface ShiftStats { logdet: number; q0: number; lin: number; cur: number }

/**
 * For one (draw, scenario): with r₀ the observed log-ratio minus its baseline, the log-likelihood of a fixed shift δ is
 * −½(log|Σ| + q₀ − 2·lin·δ + cur·δ²), q₀ = r₀ᵀΣ⁻¹r₀, lin = 1ᵀΣ⁻¹r₀, cur = 1ᵀΣ⁻¹1. Leaves the factorisation in place.
 */
function shiftStats(cx: Contrast, pi: Float64Array, sigmaG: number, kappa: Float64Array): ShiftStats {
  const logdet = factorize(cx, pi, sigmaG, kappa);
  if (Number.isNaN(logdet)) return { logdet: NaN, q0: 0, lin: 0, cur: 0 };
  const { r, u, ys } = cx.scratch;
  for (let s = 0; s < cx.nS; s++) r[s] = cx.y[s] - cx.eta0[cx.rep[s]] - cx.alpha;
  applyInverse(cx, r, u);
  let q0 = 0, lin = 0;
  for (let s = 0; s < cx.nS; s++) { q0 += r[s] * u[s]; lin += u[s]; }
  ys.fill(1);
  applyInverse(cx, ys, ys);
  let cur = 0;
  for (let s = 0; s < cx.nS; s++) cur += ys[s];
  return { logdet, q0, lin, cur };
}

/** log of each bin's integral of exp(lin·δ − ½ cur·δ²) against N(mean, vari): exact for a Gaussian bin. */
function binLogs(st: ShiftStats, bins: ShiftBins, out: Float64Array): void {
  for (let b = 0; b < bins.nb; b++) {
    const m = bins.mean[b], v = bins.vari[b], d = 1 + st.cur * v;
    out[b] = -0.5 * Math.log(d) + (st.lin * m - 0.5 * st.cur * m * m + 0.5 * st.lin * st.lin * v) / d;
  }
}

/** The marginal log-likelihood of (draw, scenario) with the shift integrated against the published distribution. */
function logLikMarginal(cx: Contrast, pi: Float64Array, sigmaG: number, kappa: Float64Array, bins: ShiftBins, tmp: Float64Array): number {
  const st = shiftStats(cx, pi, sigmaG, kappa);
  if (Number.isNaN(st.logdet)) return -Infinity;
  binLogs(st, bins, tmp);
  return -0.5 * (st.logdet + st.q0) + logSumExp(tmp, bins.nb) - Math.log(bins.nb);
}

/** One draw of the shift given the data: pick a bin by its marginal weight, then draw from that bin's tilted Gaussian. */
function sampleShift(st: ShiftStats, bins: ShiftBins, tmp: Float64Array, rng: Rng): number {
  binLogs(st, bins, tmp);
  const l = logSumExp(tmp, bins.nb);
  const u = rng.uniform();
  let run = 0, pickB = bins.nb - 1;
  for (let b = 0; b < bins.nb; b++) { run += Math.exp(tmp[b] - l); if (u <= run) { pickB = b; break; } }
  const m = bins.mean[pickB], v = bins.vari[pickB], d = 1 + st.cur * v;
  return (m + v * st.lin) / d + Math.sqrt(v / d) * rng.normal();
}

/**
 * One posterior draw of the final log-ratio of the remaining votes in every unit, by Matheron's rule. `out` receives q_c.
 * Must follow `factorize` for the same (draw, scenario).
 */
function samplePosterior(cx: Contrast, pi: Float64Array, sigmaG: number, kappa: Float64Array, deltaFixed: number | null, rng: Rng, out: Float64Array): void {
  const { n, nS, G, w, rep, region, regionW } = cx;
  const zeta = new Float64Array(G);
  if (cx.hasZeta) for (let g = 0; g < G; g++) zeta[g] = cx.sdZeta * rng.normal();
  const gammaStar = cx.hasGamma ? cx.sdGamma * rng.normal() : 0;
  const deltaStar = cx.hasDelta ? cx.sdDelta * rng.normal() : 0;
  const gapStar = cx.gapCol >= 0 ? Math.sqrt(cx.rho) * sigmaG * rng.normal() : 0;
  const sigmaInd = sigmaG * Math.sqrt(1 - cx.rho);
  const zt = new Float64Array(n);
  let zbar = 0;
  for (let c = 0; c < n; c++) { zt[c] = cx.sdEps * rng.normal(); zbar += w[c] * zt[c]; }
  const eps = new Float64Array(n);
  for (let c = 0; c < n; c++) eps[c] = zt[c] - zbar;
  let zeta0 = 0;
  for (let g = 0; g < G; g++) zeta0 += regionW[g] * zeta[g];
  const gStar = new Float64Array(nS);

  const deltaConst = deltaFixed === null ? cx.deltaMean : deltaFixed;
  const gammaPost = { value: gammaStar }, deltaPost = { value: deltaStar }, zetaPost = Float64Array.from(zeta);
  let gapPost = gapStar;
  let epsU1 = 0, epsU2 = 0;
  if (nS > 0) {
    const { r, u, ys } = cx.scratch;
    for (let s = 0; s < nS; s++) {
      const c = rep[s];
      gStar[s] = sigmaInd * rng.normal();
      const noise = Math.sqrt(kappa[s] * cx.ve[s]) * rng.normal();
      const zetaTerm = cx.hasZeta ? zeta[region[c]] - zeta0 : 0;
      ys[s] = zetaTerm + gammaStar * cx.z[c] + deltaStar + eps[c] - (1 - pi[s]) * (gStar[s] + gapStar) + noise;
      r[s] = cx.y[s] - cx.eta0[c] - cx.alpha - deltaConst - ys[s];
    }
    applyInverse(cx, r, u);
    let sumU = 0, sumZU = 0;
    const regionU = new Float64Array(G);
    for (let s = 0; s < nS; s++) {
      const c = rep[s];
      sumU += u[s];
      sumZU += cx.z[c] * u[s];
      epsU2 += w[c] * u[s];
      regionU[region[c]] += u[s];
    }
    epsU1 = sumU;
    if (cx.hasZeta) for (let g = 0; g < G; g++) zetaPost[g] = zeta[g] + cx.sdZeta ** 2 * (regionU[g] - regionW[g] * sumU);
    if (cx.hasGamma) gammaPost.value = gammaStar + cx.sdGamma ** 2 * sumZU;
    if (cx.hasDelta) deltaPost.value = deltaStar + cx.sdDelta ** 2 * sumU;
    if (cx.gapCol >= 0) {
      let bu = 0;
      for (let s = 0; s < nS; s++) bu += -(1 - pi[s]) * u[s];
      gapPost = gapStar + cx.rho * sigmaG * sigmaG * bu;
    }
    // ε and g at the reporting units
    const e22 = cx.sdEps * cx.sdEps;
    for (let c = 0; c < n; c++) eps[c] += e22 * (-w[c] * epsU1 - epsU2 + cx.wSum2 * epsU1);
    for (let s = 0; s < nS; s++) {
      const c = rep[s];
      eps[c] += e22 * u[s];
      // Cov(g, y) = −(1−π)σ_g²: the counted votes sit at θ − (1−π)g
      gStar[s] -= (1 - pi[s]) * sigmaInd * sigmaInd * u[s];
    }
  }
  let zetaPost0 = 0;
  for (let g = 0; g < G; g++) zetaPost0 += regionW[g] * zetaPost[g];
  const gAt = new Float64Array(n), piAt = new Float64Array(n);
  for (let s = 0; s < nS; s++) { gAt[rep[s]] = gStar[s]; piAt[rep[s]] = pi[s]; }
  for (let c = 0; c < n; c++) {
    const zetaTerm = cx.hasZeta ? zetaPost[region[c]] - zetaPost0 : 0;
    const theta = cx.eta0[c] + cx.alpha + deltaConst + deltaPost.value + zetaTerm + gammaPost.value * cx.z[c] + eps[c];
    // the remaining votes sit at θ + π·g; a unit that has reported nothing has π = 0
    out[c] = theta + piAt[c] * (gAt[c] + gapPost);
  }
}

// ---- the run ------------------------------------------------------------------------------------------------------

const GAUSS_TAIL = 1e-9;

function gaussianOf(values: Float64Array): { kind: "GAUSSIAN"; mean: number; sd: number } {
  let mean = 0;
  for (const x of values) mean += x;
  mean /= values.length;
  let v = 0;
  for (const x of values) v += (x - mean) ** 2;
  return { kind: "GAUSSIAN", mean, sd: Math.sqrt(v / Math.max(values.length - 1, 1)) };
}

/**
 * Runs the preference model and calls `visit` once per output draw. The importance weights over the inventory draws
 * select which inventory/state-shift draw each output draw is built on; the scenario is drawn from its posterior given
 * that draw. Deterministic for the seed. Nothing here reads precincts reporting.
 */
export function runPreference(input: PreferenceInput, visit: (d: PreferenceDraw) => void): PreferenceResult {
  const { units, inventory: inv, hyper } = input;
  const hp = hyper.preference;
  const n = units.length;
  const J = inv.draws;
  const K = input.stateShift.length + 1;
  const flags: string[] = [];
  if (inv.ids.length !== n || units.some((u, c) => u.id !== inv.ids[c])) throw new Error("preference units must match the inventory's units in order");
  if (input.scenarios.length === 0) throw new Error("at least one scenario is required");
  const wsum = input.scenarios.reduce((s, x) => s + x.weight, 0);
  const prior = input.scenarios.map((s) => s.weight / wsum);

  const expectedTotal = units.reduce((s, u) => s + u.expected, 0);
  const reportedTotal = inv.reported.reduce((s, x) => s + x, 0);
  const reportedShare = expectedTotal > 0 ? reportedTotal / expectedTotal : 0;
  const stage = stageOf(reportedShare, hyper);
  const sigmaG = input.scenarios.map((s) => gapSigma(stage, s.column, hyper));

  const kappa = (cx: Contrast) => Float64Array.from(Array.from(cx.rep, (c) => (units[c].revised ? hp.kappaRevision : 1)));
  const shifts = input.stateShift.slice();
  for (const sh of shifts) if (sh.kind === "DRAWS" && sh.values.length < J) throw new Error("state-shift draws are fewer than the inventory draws");

  const build = () => shifts.map((sh, i) => buildContrast(units, i + 1, sh, input.anchorOffset?.[i] ?? 0, inv.reported, hyper));
  let contrasts = build();
  const nS = contrasts[0].nS;
  const Omega = input.scenarios.length;
  const marg = (input.shiftMode ?? "WEIGHTED") === "MARGINALISED" && shifts[0].kind === "DRAWS";
  const bins = marg ? makeBins((shifts[0] as { values: Float64Array }).values.subarray(0, J)) : null;
  const binTmp = new Float64Array(bins ? bins.nb : 1);
  const piAt = (cx: Contrast, j: number, out: Float64Array) => { for (let s = 0; s < cx.nS; s++) { const c = cx.rep[s]; const t = inv.total[c][j]; out[s] = t > 0 ? Math.min(1, inv.reported[c] / t) : 1; } };

  // pass 1: per inventory draw, the log marginal likelihood under each scenario
  const ll = new Float64Array(J * Omega);
  const logw = new Float64Array(J);
  let ess = J;
  const pass1 = () => {
    ll.fill(0);
    const pis = contrasts.map((cx) => new Float64Array(cx.nS));
    const ks = contrasts.map(kappa);
    if (nS > 0) {
      for (let j = 0; j < J; j++) {
        contrasts.forEach((cx, i) => piAt(cx, j, pis[i]));
        for (let o = 0; o < Omega; o++) {
          let sum = 0;
          contrasts.forEach((cx, i) => { sum += marg && i === 0 ? logLikMarginal(cx, pis[i], sigmaG[o], ks[i], bins as ShiftBins, binTmp) : logLik(cx, pis[i], sigmaG[o], ks[i], cx.deltaValues ? cx.deltaValues[j] : cx.deltaMean); });
          ll[j * Omega + o] = sum;
        }
      }
    }
    const terms = new Float64Array(Omega);
    for (let j = 0; j < J; j++) {
      for (let o = 0; o < Omega; o++) terms[o] = Math.log(prior[o]) + ll[j * Omega + o];
      logw[j] = logSumExp(terms);
    }
    const lz = logSumExp(logw);
    let s1 = 0, s2 = 0;
    for (let j = 0; j < J; j++) { const p = Math.exp(logw[j] - lz); s1 += p; s2 += p * p; }
    ess = (s1 * s1) / s2;
    return lz;
  };
  pass1();
  const essFraction0 = ess / J;
  // Only a draws-based shift can lose its weights; a Gaussian shift is already marginalised exactly.
  if (nS > 0 && shifts[0].kind === "DRAWS" && !marg && essFraction0 < hp.essFloor) {
    shifts[0] = gaussianOf((shifts[0] as { values: Float64Array }).values);
    flags.push("STATE_SHIFT_DRAWS_REPLACED_BY_GAUSSIAN");
    contrasts = build();
    pass1();
  }
  const essFraction = ess / J;
  if (nS > 0 && essFraction < hp.essFloor) flags.push("LOW_EFFECTIVE_SAMPLE_SIZE");

  // normalised weights and scenario posteriors
  const lz = logSumExp(logw);
  const wt = new Float64Array(J);
  for (let j = 0; j < J; j++) wt[j] = nS > 0 ? Math.exp(logw[j] - lz) : 1 / J;
  const scenPost = new Float64Array(Omega);
  const pj = new Float64Array(Omega), terms = new Float64Array(Omega);
  const omegaProbs = (j: number, out: Float64Array) => {
    for (let o = 0; o < Omega; o++) terms[o] = Math.log(prior[o]) + ll[j * Omega + o];
    const l = logSumExp(terms);
    for (let o = 0; o < Omega; o++) out[o] = Math.exp(terms[o] - l);
  };
  for (let j = 0; j < J; j++) {
    omegaProbs(j, pj);
    for (let o = 0; o < Omega; o++) scenPost[o] += wt[j] * pj[o];
  }

  // systematic resampling
  const rng = Rng.fork(input.seed, `${PREFERENCE_MODEL_VERSION}|${input.raceId}`);
  const pick = new Int32Array(J);
  if (nS > 0) {
    const u0 = rng.uniform();
    let cum = 0, j = 0;
    for (let jj = 0; jj < J; jj++) {
      const target = (u0 + jj) / J;
      while (j < J - 1 && cum + wt[j] < target) { cum += wt[j]; j++; }
      pick[jj] = j;
    }
  } else for (let jj = 0; jj < J; jj++) pick[jj] = jj;

  // pass 2
  const q = contrasts.map(() => new Float64Array(n));
  const remaining = new Float64Array(n);
  const pis = contrasts.map((cx) => new Float64Array(cx.nS));
  const ks = contrasts.map(kappa);
  for (let jj = 0; jj < J; jj++) {
    const j = pick[jj];
    omegaProbs(j, pj);
    let o = Omega - 1;
    const u = rng.uniform();
    let run = 0;
    for (let a = 0; a < Omega; a++) { run += pj[a]; if (u <= run) { o = a; break; } }
    contrasts.forEach((cx, i) => {
      piAt(cx, j, pis[i]);
      if (marg && i === 0 && cx.nS > 0) {
        const st = shiftStats(cx, pis[i], sigmaG[o], ks[i]);
        samplePosterior(cx, pis[i], sigmaG[o], ks[i], sampleShift(st, bins as ShiftBins, binTmp, rng), rng, q[i]);
        return;
      }
      if (cx.nS > 0) factorize(cx, pis[i], sigmaG[o], ks[i]);
      samplePosterior(cx, pis[i], sigmaG[o], ks[i], cx.deltaValues ? cx.deltaValues[j] : null, rng, q[i]);
    });
    for (let c = 0; c < n; c++) remaining[c] = Math.max(0, inv.total[c][j] - inv.reported[c]);
    visit({ index: jj, inventoryDraw: j, scenario: o, q, remaining });
  }

  return {
    model: PREFERENCE_MODEL_VERSION, raceId: input.raceId, draws: J, stage, reportedShare, reportingUnits: nS, candidates: K,
    scenarios: input.scenarios.map((s, o) => ({ id: s.id, column: s.column, sigmaGap: sigmaG[o], prior: prior[o], posterior: scenPost[o] })),
    essFraction, flags, hyperId: hyper.hyperId, seed: input.seed,
    shiftMode: marg ? "MARGINALISED" : shifts[0].kind === "GAUSSIAN" ? "GAUSSIAN" : nS > 0 ? "WEIGHTED" : "NONE",
  };
}

// ---- helpers ------------------------------------------------------------------------------------------------------

/** Two-party share of side B from a log-ratio. */
export const shareB = (logRatio: number) => 1 / (1 + Math.exp(-logRatio));

/** Shares of all K candidates from the K−1 log-ratios against candidate 0: a softmax with the reference fixed at 0. */
export function softmaxShares(logRatios: ArrayLike<number>): number[] {
  const k = logRatios.length + 1;
  const mx = Math.max(0, ...Array.from(logRatios));
  const e = new Array<number>(k);
  e[0] = Math.exp(-mx);
  let s = e[0];
  for (let i = 1; i < k; i++) { e[i] = Math.exp(logRatios[i - 1] - mx); s += e[i]; }
  return e.map((x) => x / s);
}

const SMOOTH_POINTS = 24;

/**
 * A forecast county row with negative votes clamped to zero. The forecast's own sen-MT county file carries three counties
 * with a negative Democratic baseline (30011, 30033, 30069); the VAI layer never edits the forecast, so it clamps and reports.
 */
export function cleanRow(r: readonly number[]): { row: [number, number, number, number]; clamped: boolean } {
  const row = [Math.max(0, r[0]), Math.max(0, r[1]), Math.max(0, r[2]), Math.max(0, r[3])] as [number, number, number, number];
  return { row, clamped: row.some((x, i) => x !== r[i]) };
}

/** η⁰ for a two-candidate county row: log((b + ½) / (a + ½)) on the clamped row. */
export const baselineLogRatio = (r: readonly number[], pseudoCount: number) => {
  const c = cleanRow(r).row;
  return Math.log((c[1] + pseudoCount) / (c[0] + pseudoCount));
};

interface Latent {
  /** Per-county variance of everything that moves a log-ratio around its baseline before the state shift (regional, lean slope, centred residual). */
  v: Float64Array;
  w: Float64Array;
  z: Float64Array;
  gi: Int32Array;
  labels: string[];
  regionW: Float64Array;
}

function latentStructure(units: PrefUnit[], hyper: VaiHyper): Latent {
  const hp = hyper.preference;
  const n = units.length;
  const E = units.reduce((s, u) => s + u.expected, 0);
  const w = Float64Array.from(units.map((u) => (E > 0 ? u.expected / E : 1 / n)));
  const W = w.reduce((s, x) => s + x * x, 0);
  const labels = [...new Set(units.map((u) => u.region))].sort();
  const gi = Int32Array.from(units.map((u) => labels.indexOf(u.region)));
  const regionW = new Float64Array(labels.length);
  for (let c = 0; c < n; c++) regionW[gi[c]] += w[c];
  const rw2 = regionW.reduce((s, x) => s + x * x, 0);
  const eta = units.map((u) => u.eta0[0]);
  const m = eta.reduce((s, x, c) => s + w[c] * x, 0);
  const sdLean = Math.sqrt(eta.reduce((s, x, c) => s + w[c] * (x - m) ** 2, 0));
  const z = Float64Array.from(eta.map((x) => (sdLean > 1e-9 ? (x - m) / sdLean : 0)));
  const v = Float64Array.from(units.map((_, c) => hp.sigmaEps ** 2 * (1 - 2 * w[c] + W) + (labels.length > 1 ? hp.sigmaRegion ** 2 * (1 - 2 * regionW[gi[c]] + rw2) : 0) + (sdLean > 1e-9 ? (hp.sigmaGamma * z[c]) ** 2 : 0)));
  return { v, w, z, gi, labels, regionW };
}

/**
 * The published forecast's margin distribution carried to a distribution of the county-level state shift δ_s.
 *
 * Each draw of the (calibrated) published margin m is mapped to the δ at which the counties' *expected* margin equals m,
 * where the expectation is over the model's county-level noise (regional term, lean slope, residual) and over turnout.
 * Without that smoothing the model's own noise, passing through the logistic and through the turnout ratio, would move
 * the prior-predictive margin off the published one by up to a few hundredths of a point; with it, a race with nothing
 * counted reproduces the anchor (the second-order turnout correction below uses the baseline σ_u and σ_τg).
 *
 * Draws are shuffled by a seeded permutation, so they pair with inventory draws independently. `outside` counts draws
 * beyond the range the counties can express: they are clamped, and the caller must flag them.
 */
export function anchoredStateShifts(hist: PublishedHistogram, cal: Calibration, rows: CountyRows, J: number, seed: number, hyper: VaiHyper, region: (fips: string) => string = () => "ALL"): { values: Float64Array; outside: number; clampedCounties: string[]; contraction: number } {
  const keys = Object.keys(rows).sort();
  const ps = hyper.preference.pseudoCount;
  const units: PrefUnit[] = keys.map((k) => ({ id: k, region: region(k), expected: cleanRow(rows[k]).row[3], eta0: [baselineLogRatio(rows[k], ps)], votes: [0, 0] }));
  const lat = latentStructure(units, hyper);
  const v = lat.v;
  const nodes = Array.from({ length: SMOOTH_POINTS }, (_, i) => normalQuantile((i + 0.5) / SMOOTH_POINTS));
  const tp = keys.map((k) => cleanRow(rows[k]).row[0] + cleanRow(rows[k]).row[1]);
  const den = keys.reduce((s, k) => s + cleanRow(rows[k]).row[3], 0);
  const lo = -8, hi = 8, step = 0.01;
  const grid = Math.round((hi - lo) / step) + 1;
  const margins = new Float64Array(grid);
  // Turnout is random too, and the margin is a ratio, Σ T_c·m_c / Σ T_c. To second order its mean is
  // M − Σ_c Σ_c' w_c w_c' Cov(x_c, x_c')·(m_c − M), x the relative turnout shocks: a unit term (σ_u) and a regional term
  // (σ_τg). The statewide shock drops out because Σ w_c (m_c − M) = 0.
  const { labels, gi } = lat;
  const w = keys.map((k) => (den > 0 ? cleanRow(rows[k]).row[3] / den : 0));
  const su2 = hyper.inventory.sigmaUnit ** 2, sg2 = hyper.inventory.sigmaTauRegion ** 2;
  const m = new Float64Array(keys.length);
  for (let i = 0; i < grid; i++) {
    const delta = lo + i * step;
    let M = 0;
    for (let c = 0; c < keys.length; c++) {
      const sdc = Math.sqrt(v[c]);
      let e = 0;
      for (const z of nodes) e += 1 / (1 + Math.exp(-(units[c].eta0[0] + delta + sdc * z)));
      m[c] = den > 0 ? (tp[c] * (2 * (e / SMOOTH_POINTS) - 1)) / Math.max(cleanRow(rows[keys[c]]).row[3], 1e-9) : 0;
      M += w[c] * m[c];
    }
    let corr = 0;
    const regionSum = new Float64Array(labels.length);
    for (let c = 0; c < keys.length; c++) {
      corr += su2 * w[c] * w[c] * (m[c] - M);
      regionSum[gi[c]] += w[c] * (m[c] - M);
    }
    const regionW = new Float64Array(labels.length);
    for (let c = 0; c < keys.length; c++) regionW[gi[c]] += w[c];
    for (let g = 0; g < labels.length; g++) corr += sg2 * regionW[g] * regionSum[g];
    margins[i] = 100 * (M - corr);
  }
  const lookup = (m: number): { delta: number; outside: boolean } => {
    if (m <= margins[0]) return { delta: lo, outside: true };
    if (m >= margins[grid - 1]) return { delta: hi, outside: true };
    let a = 0, b = grid - 1;
    while (b - a > 1) { const mid = (a + b) >> 1; if (margins[mid] <= m) a = mid; else b = mid; }
    const f = (m - margins[a]) / Math.max(margins[b] - margins[a], GAUSS_TAIL);
    return { delta: lo + (a + f) * step, outside: false };
  };

  const draws = stratifiedDraws(hist, cal, J);
  // The published distribution already contains every source of noise. The model adds county-level and turnout noise on top
  // of the shift, so the shifted draws are contracted about their mean until anchor-plus-noise has the published variance
  // (delta method, at the median shift). This keeps the mean exactly and the variance to first order; shape is untouched.
  let mu = 0;
  for (const x of draws) mu += x;
  mu /= J;
  let pubVar = 0;
  for (const x of draws) pubVar += (x - mu) ** 2;
  pubVar /= Math.max(J - 1, 1);
  const dBar = lookup(mu).delta;
  const a = new Float64Array(keys.length), mc = new Float64Array(keys.length);
  let A = 0, Mbar = 0;
  for (let c = 0; c < keys.length; c++) {
    const sb = 1 / (1 + Math.exp(-(units[c].eta0[0] + dBar)));
    const t = Math.max(cleanRow(rows[keys[c]]).row[3], 1e-9);
    a[c] = (100 * tp[c] / Math.max(den, 1e-9)) * 2 * sb * (1 - sb);
    mc[c] = (tp[c] / t) * (2 * sb - 1);
    A += a[c];
    Mbar += w[c] * mc[c];
  }
  let noiseVar = 0, gam = 0;
  const regionA = new Float64Array(labels.length);
  for (let c = 0; c < keys.length; c++) {
    noiseVar += hyper.preference.sigmaEps ** 2 * (a[c] - A * w[c]) ** 2;
    noiseVar += su2 * (100 * w[c] * (mc[c] - Mbar)) ** 2;
    gam += a[c] * lat.z[c];
    regionA[gi[c]] += a[c];
  }
  noiseVar += (hyper.preference.sigmaGamma * gam) ** 2;
  const regionT = new Float64Array(labels.length);
  for (let c = 0; c < keys.length; c++) regionT[gi[c]] += 100 * w[c] * (mc[c] - Mbar);
  for (let g = 0; g < labels.length; g++) {
    if (labels.length > 1) noiseVar += hyper.preference.sigmaRegion ** 2 * (regionA[g] - A * lat.regionW[g]) ** 2;
    noiseVar += sg2 * regionT[g] ** 2;
  }
  const contraction = pubVar > 0 ? Math.sqrt(Math.max(0.5, 1 - noiseVar / pubVar)) : 1;
  const values = new Float64Array(J);
  let outside = 0;
  for (let j = 0; j < J; j++) {
    const r = lookup(mu + contraction * (draws[j] - mu));
    values[j] = r.delta;
    if (r.outside) outside++;
  }
  const rng = Rng.fork(seed, `${PREFERENCE_MODEL_VERSION}|shift-order`);
  for (let j = J - 1; j > 0; j--) {
    const i = Math.floor(rng.uniform() * (j + 1));
    const t = values[j]; values[j] = values[i]; values[i] = t;
  }
  return { values, outside, clampedCounties: keys.filter((k) => cleanRow(rows[k]).clamped), contraction };
}

/** Builds PrefUnits for a two-candidate race from the county file (fips → [a, b, other, total]) and counted votes. */
export function prefUnitsFromRows(rows: CountyRows, region: (fips: string) => string, counted: (fips: string) => { a: number; b: number } | null, pseudoCount: number): PrefUnit[] {
  return Object.keys(rows).sort().map((k) => {
    const v = counted(k);
    return { id: k, region: region(k), expected: cleanRow(rows[k]).row[3], eta0: [baselineLogRatio(rows[k], pseudoCount)], votes: [v?.a ?? 0, v?.b ?? 0] };
  });
}
