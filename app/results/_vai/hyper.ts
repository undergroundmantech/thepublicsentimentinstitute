// VAI v1 hyperparameters (math §10). Every value is an INITIAL, UNFITTED setting: chosen wide on purpose, not estimated
// from data, and it must be replaced by backtest estimates (backtest plan §4) before any output is published.
// `provenance` says, per value, whether the specification fixed it or Phase B1 had to choose one.

export const HYPER_SCHEMA = "vai-hyper/1";

export type Stage = "FIRST" | "MIXED" | "TAIL";
export type GapColumn = "AB" | "C" | "D";
export type ParamStatus = "INITIAL_UNFITTED" | "SPEC_FIXED" | "ASSUMED_UNFITTED" | "DERIVED_FROM_FINALS" | "SYNTHETIC_STUDY_ONLY";

/**
 * How a unit's counted votes N relate to its final total T (B2). Never reads a precinct share.
 *  - TOBIT: the B1 model. N only truncates T ≥ N, so a unit near its expectation pushes the shared turnout shocks up.
 *  - POWER_PROGRESS: N is an observation with density α (N/T)^(α−1)/T on N ≤ T. α = 1 is uniform progress; large α is mostly done.
 *  - LOG_PROGRESS: log(N/T) = −v with v ~ N(m, s²) truncated to v ≥ 0: a typical log shortfall m of counted from final votes, and a spread s
 *    across units. Counties that progress roughly in step (small s) are representable, unlike with the power form.
 * The statewide component (α, or (m, s)) is shared by every unit and learned from the cross-section over a grid with prior weights.
 */
export interface ProgressComponent { alpha?: number; m?: number; s?: number; weight: number }
export interface ProgressModel {
  model: "TOBIT" | "POWER_PROGRESS" | "LOG_PROGRESS";
  components: ProgressComponent[];
}

export interface VaiHyper {
  schema: typeof HYPER_SCHEMA;
  hyperId: string;
  status: "INITIAL_UNFITTED" | "RESEARCH_CANDIDATE";
  inventory: {
    /** σ_τs: statewide turnout shock (log scale). */
    sigmaTauState: number;
    /** σ_τg: regional turnout shock. */
    sigmaTauRegion: number;
    /** σ_u: county residual before the state multipliers. */
    sigmaUnit: number;
    /** Multiplies σ_u in postmark-grace jurisdictions. */
    graceMultiplier: number;
    /** Multiplies σ_u where the ledger codes the count "days to weeks". */
    slowCountMultiplier: number;
    /** σ_u is multiplied by this for a county whose reported total beat its expectation's upper quantile (math §2.3). */
    exceedMultiplier: number;
    /** The upper quantile of the turnout prior that defines "exceeds expected". */
    exceedQuantile: number;
    /** Rejected or uncured share of officially outstanding ballots: Beta(1, rejectionBeta). */
    rejectionBeta: number;
    /** Eligible ballots not yet received, as a share of expected votes, before the receipt deadline in postmark-grace states. Exponential; the register holds no volume. */
    lateArrivalMeanShare: number;
    /** Provisional and cure residual after an official election-night completion, as a share of counted votes. Exponential. */
    provisionalShareElectionNight: number;
    /** The same after every known ballot is counted. */
    provisionalShareAllKnown: number;
    /** B2. Absent in v1, which means TOBIT. */
    progress?: ProgressModel;
  };
  preference: {
    sigmaEps: number;
    /** σ_γ per standard deviation of forecast lean. */
    sigmaGamma: number;
    sigmaRegion: number;
    /** Variance multiplier on Var(e_c) for a county with a recent downward revision. */
    kappaRevision: number;
    /** σ_g on the log-ratio scale by stage and count-order column (math §3.3). μ_g is 0 in v1 and is not a parameter. */
    sigmaGap: Record<Stage, Record<GapColumn, number>>;
    /** Prior scenario weights (math §5). */
    scenarioWeights: { ledger: number; mixed: number; varying: number; ledgerWhenUnresolved: number };
    /** Stage cut-offs on reported votes as a share of the forecast's expected total. Never precincts reporting. */
    stage: { firstBelow: number; mixedBelow: number };
    /** Prior standard deviation of the statewide shift of a minor-candidate log-ratio (math §3.5; no polling spread is available). */
    minorShiftSd: number;
    /** Candidates below this forecast share are pooled into OTHER. */
    pooledShare: number;
    /** Below this effective-sample-size fraction, the published state-shift draws are replaced by a Gaussian with their mean and sd. */
    essFloor: number;
    /** Pseudo-count added to each candidate's votes before taking a log-ratio, so a zero never produces an infinity. */
    pseudoCount: number;
    /** B2. Share of the selection-gap variance common to every county in the race (a statewide early-vs-late difference). Absent or 0 in v1: gaps are independent. */
    rhoGap?: number;
  };
  provenance: Record<string, { status: ParamStatus; source: string }>;
}

const MATH10 = "VAI_V1_MATHEMATICAL_DESIGN.md §10";
const MATH33 = "VAI_V1_MATHEMATICAL_DESIGN.md §3.3";
const B1 = "Phase B1 choice; not in the specification";

export const HYPER_V1: VaiHyper = {
  schema: HYPER_SCHEMA,
  hyperId: "vai-hyper-v1-initial",
  status: "INITIAL_UNFITTED",
  inventory: {
    sigmaTauState: 0.06,
    sigmaTauRegion: 0.05,
    sigmaUnit: 0.1,
    graceMultiplier: 1.5,
    slowCountMultiplier: 1.25,
    exceedMultiplier: 2,
    exceedQuantile: 0.99,
    rejectionBeta: 30,
    lateArrivalMeanShare: 0.01,
    provisionalShareElectionNight: 0.01,
    provisionalShareAllKnown: 0.002,
  },
  preference: {
    sigmaEps: 0.1,
    sigmaGamma: 0.05,
    sigmaRegion: 0.05,
    kappaRevision: 4,
    sigmaGap: {
      FIRST: { AB: 0.3, C: 0.1, D: 0.25 },
      MIXED: { AB: 0.2, C: 0.08, D: 0.2 },
      TAIL: { AB: 0.15, C: 0.1, D: 0.15 },
    },
    scenarioWeights: { ledger: 0.6, mixed: 0.25, varying: 0.15, ledgerWhenUnresolved: 0.45 },
    stage: { firstBelow: 0.25, mixedBelow: 0.7 },
    minorShiftSd: 0.25,
    pooledShare: 0.005,
    essFloor: 0.1,
    pseudoCount: 0.5,
  },
  provenance: {
    "inventory.sigmaTauState": { status: "INITIAL_UNFITTED", source: MATH10 },
    "inventory.sigmaTauRegion": { status: "INITIAL_UNFITTED", source: MATH10 },
    "inventory.sigmaUnit": { status: "INITIAL_UNFITTED", source: MATH10 },
    "inventory.graceMultiplier": { status: "ASSUMED_UNFITTED", source: `${B1}; math §2.1 says only that σ_u is larger in grace jurisdictions` },
    "inventory.slowCountMultiplier": { status: "ASSUMED_UNFITTED", source: `${B1}; math §2.1 says only that σ_u is larger where the ledger codes days to weeks` },
    "inventory.exceedMultiplier": { status: "SPEC_FIXED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §2.3 (doubled)" },
    "inventory.exceedQuantile": { status: "SPEC_FIXED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §2.3 (99th percentile)" },
    "inventory.rejectionBeta": { status: "INITIAL_UNFITTED", source: `${MATH10}: ρ_c ~ Beta(1, 30), labelled UNKNOWN` },
    "inventory.lateArrivalMeanShare": { status: "ASSUMED_UNFITTED", source: `${B1}; the register stores no late-arrival volume (math §2.4), so this is a wide placeholder labelled UNKNOWN` },
    "inventory.provisionalShareElectionNight": { status: "ASSUMED_UNFITTED", source: `${B1}; math §2.2 says only "later-counted ballots stay in R_c"` },
    "inventory.provisionalShareAllKnown": { status: "ASSUMED_UNFITTED", source: `${B1}; math §2.2 says only "a small provisional and cure residual"` },
    "preference.sigmaEps": { status: "INITIAL_UNFITTED", source: MATH10 },
    "preference.sigmaGamma": { status: "INITIAL_UNFITTED", source: MATH10 },
    "preference.sigmaRegion": { status: "INITIAL_UNFITTED", source: MATH10 },
    "preference.kappaRevision": { status: "INITIAL_UNFITTED", source: MATH10 },
    "preference.sigmaGap": { status: "INITIAL_UNFITTED", source: MATH33 },
    "preference.scenarioWeights": { status: "INITIAL_UNFITTED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §5 (0.60 / 0.25 / 0.15; 0.45 when the ledger is UNRESOLVED)" },
    "preference.stage": { status: "ASSUMED_UNFITTED", source: `${B1}; math §3.3 defines the stages but gives no cut-offs` },
    "preference.minorShiftSd": { status: "ASSUMED_UNFITTED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §3.5 asks for a wide default labelled PRIOR when no polling spread exists" },
    "preference.pooledShare": { status: "SPEC_FIXED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §3.5 (0.5%)" },
    "preference.essFloor": { status: "ASSUMED_UNFITTED", source: "VAI_V1_MATHEMATICAL_DESIGN.md §8.3 uses J/10 for chambers; reused here" },
    "preference.pseudoCount": { status: "ASSUMED_UNFITTED", source: B1 },
  },
};

type Patch<T> = { [K in keyof T]?: T[K] extends Record<string, unknown> ? Patch<T[K]> : T[K] };

/** A copy of `base` with the given nested values replaced. Used by tests and sensitivity runs; never mutates `base`. */
export function withHyper(base: VaiHyper, patch: Patch<Omit<VaiHyper, "provenance">>): VaiHyper {
  const merge = (a: unknown, b: unknown): unknown => {
    if (b === undefined) return a;
    if (a && b && typeof a === "object" && typeof b === "object" && !Array.isArray(a)) {
      const out: Record<string, unknown> = { ...(a as Record<string, unknown>) };
      for (const [k, v] of Object.entries(b as Record<string, unknown>)) out[k] = merge(out[k], v);
      return out;
    }
    return b;
  };
  return merge(base, patch) as VaiHyper;
}

// ---- v2 research candidate (B2) ------------------------------------------------------------------------------------------
// Changes from v1: the progress likelihood (LOG_PROGRESS replaces the censored Tobit likelihood that overstated votes outstanding near
// completion). Nothing is fitted to point-in-time returns, because none exist for the races VAI targets. Every number v1 carried keeps its
// v1 provenance. rhoGap stays unset (independent gaps): the shared-gap model is implemented and evaluated, not adopted.

const LOG_M = [0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5];
const LOG_S = [0.03, 0.1, 0.3, 0.8];
export const LOG_PROGRESS_V2: ProgressModel = {
  model: "LOG_PROGRESS",
  components: LOG_M.flatMap((m) => LOG_S.map((s) => ({ m, s, weight: 1 / (LOG_M.length * LOG_S.length) }))),
};

export const HYPER_V2: VaiHyper = {
  ...withHyper(HYPER_V1, { inventory: { progress: LOG_PROGRESS_V2 } }),
  hyperId: "vai-hyper-v2-research",
  status: "RESEARCH_CANDIDATE",
  provenance: {
    ...HYPER_V1.provenance,
    "inventory.progress": { status: "SYNTHETIC_STUDY_ONLY", source: "B2 near-completion study (data/vai/experiments/near_completion_study.json): the likelihood family was chosen on synthetic regimes; the (m, s) grid and its uniform weights are ASSUMED, not fitted" },
  },
};
