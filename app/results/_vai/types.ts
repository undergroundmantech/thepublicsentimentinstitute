// Vote Arrival Intelligence (VAI) v1: contracts (T1). Shadow only: nothing here is rendered or published.
//
// Source of truth: docs/VAI_V1_DATA_SCHEMA.md §3–§7. VAI reuses the election-night intelligence contracts in
// app/lib/intelligence/types.ts and extends them additively; it never redefines an observation.
//
// Conventions shared with the published engine (app/results/2026/live.ts) and the intelligence layer:
//   side A = Democrat (or the main non-Republican), side B = Republican, side O = everyone else;
//   margins are B minus A in percentage points (positive = Republican); probabilities are for side B unless named.

import type {
  Confidence,
  EstimatorTier,
  EvidenceClass,
  Interval,
  Issue,
  JurisdictionLevel,
  LoggedObservation,
  OutstandingInventory,
  Sides,
  SourceTier,
  ValueKind,
  VoteObservation,
} from "../../lib/intelligence/types";

export type { LoggedObservation, Sides, VoteObservation };

// ---- provenance (schema preamble) -----------------------------------------------------------------------------------

export const VAI_LABELS = ["VERIFIED", "OFFICIAL_STATEMENT", "ESTIMATED", "PRIOR", "UNKNOWN"] as const;
/**
 * VERIFIED           observed directly from a primary result source at a stated time
 * OFFICIAL_STATEMENT a number an election official published that is not itself a tabulated count
 * ESTIMATED          produced by the VAI model, always with an interval
 * PRIOR              from the count-order ledger, the frozen forecast or historical data, before any 2026 return
 * UNKNOWN            no defensible value; carries no number
 */
export type VaiLabel = (typeof VAI_LABELS)[number];

/**
 * The one mapping between VAI labels and the intelligence layer's EvidenceClass/ValueKind (schema preamble).
 * The schema's "sourceTier = OFFICIAL" is the intelligence tier PRIMARY_OFFICIAL. PRIOR maps to HISTORICAL when the
 * value was measured in a past election and to INFERRED when it was derived (the forecast).
 */
export const VAI_LABEL_TO_INTEL: Record<VaiLabel, { evidenceClass: EvidenceClass | readonly EvidenceClass[]; valueKind: ValueKind | null; sourceTier: SourceTier | null }> = {
  VERIFIED: { evidenceClass: "VERIFIED", valueKind: "OBSERVATION", sourceTier: null },
  OFFICIAL_STATEMENT: { evidenceClass: "VERIFIED", valueKind: "ESTIMATE", sourceTier: "PRIMARY_OFFICIAL" },
  ESTIMATED: { evidenceClass: "INFERRED", valueKind: "ESTIMATE", sourceTier: null },
  PRIOR: { evidenceClass: ["HISTORICAL", "INFERRED"], valueKind: "ESTIMATE", sourceTier: null },
  UNKNOWN: { evidenceClass: "UNKNOWN", valueKind: null, sourceTier: null },
};

/** A value with its label. UNKNOWN never carries a number. */
export type Labeled<T> =
  | { value: T; label: Exclude<VaiLabel, "UNKNOWN">; source: string | null; asOf: string | null }
  | { value: null; label: "UNKNOWN"; source: string | null; asOf: string | null };

/** Where a non-default fact came from. Required on every rule that is not the declared default. */
export interface VaiProvenance {
  basis: "STATUTE_CITATION" | "CONSTITUTION_CITATION" | "FORECAST_RESEARCH_NOTE" | "FORECAST_MODEL_FIELD" | "EVIDENCE_REGISTER" | "DEFAULT_ASSUMPTION";
  /** Statute or constitution reference, register id, or the forecast field the fact was read from. */
  citation: string;
  /** Repository file the fact was read from, when it came from a file (its sha256 is in the file's `inputs`). */
  file: string | null;
  /** URLs exactly as the source file lists them. Never constructed. */
  urls: string[];
  /** Whether the text was retrieved and checked in this repository's evidence register. */
  verification: "REGISTER_VERIFIED" | "CITED_NOT_RETRIEVED" | "FORECAST_INPUT" | "NONE";
  confidence: Confidence;
  note: string | null;
}

// ---- observations (schema §3) ---------------------------------------------------------------------------------------

export interface CandidateVotes {
  id: string;
  name: string;
  party: string | null;
  votes: number;
}

/**
 * Additive extension of the intelligence VoteObservation. Every V2 is a valid VoteObservation, so it goes through
 * appendObservations / latestReadings / totalsFrom unchanged. `sides` stays authoritative for the two-way margin.
 */
export interface VoteObservationV2 extends VoteObservation {
  /** Full K-candidate vector when the source gives one. */
  candidates?: CandidateVotes[];
  /** The provider's own batch id, if it ever exposes one. */
  providerBatchId?: string | null;
}

/** Feed-quality flags (schema §3.1), derived from the log and never edited into it. */
export const INTEGRITY_FLAGS = [
  "DUPLICATE_READING",
  "OUT_OF_ORDER",
  "DOWNWARD_REVISION",
  "NO_SOURCE_TIME",
  "STALE_FEED",
  "UNMATCHED_REGION",
  "TOTAL_EXCEEDS_EXPECTED",
  "TEST_DATA",
  // additions found while integrating the intelligence layer's reconciliation
  "CONTRADICTORY_READINGS",
  "METHOD_SUM_MISMATCH",
  "JURISDICTION_SUM_EXCEEDS_TOPLINE",
  "LOW_COVERAGE",
  "INVALID_READING",
] as const;
export type IntegrityFlag = (typeof INTEGRITY_FLAGS)[number];

export interface IntegrityFinding {
  flag: IntegrityFlag;
  severity: "ERROR" | "WARNING" | "INFO";
  jurisdictionId: string | null;
  message: string;
}

export type FreshnessStatus = "FRESH" | "STALE" | "NO_SOURCE_TIME" | "NO_DATA";

/**
 * One reconciled view of a race's returns at a point in time, from the append-only log (T3). Votes never disappear:
 * reported.t = Σ counties[].t + unmatched.t + residual.t, always.
 */
export interface VaiReturnsFrame {
  raceId: string;
  asOf: string;
  /** The race total from the intelligence reconciliation (topline when present, else the county sum). */
  reported: Sides & { t: number; label: "VERIFIED" };
  basis: "TOPLINE" | "JURISDICTION_SUM" | "NONE";
  /** Counties present in the forecast county file. */
  counties: Record<string, { sides: Sides; t: number; level: JurisdictionLevel; sourceTimestamp: string | null; precinctsReportingPct: number | null }>;
  /** Reporting units the county file does not know. Kept as one pseudo-county so their votes stay in the total. */
  unmatched: { jurisdictionIds: string[]; sides: Sides; t: number };
  /** Topline votes not attributed to any county or unmatched unit: topline minus both. Negative when they exceed it. */
  residual: { sides: Sides; t: number };
  /** Share of reported votes attributed to a known county, 0..1; null with no votes. */
  coverage: number | null;
  freshness: { status: FreshnessStatus; latestSourceTimestamp: string | null; ageMinutes: number | null; staleAfterMinutes: number };
  findings: IntegrityFinding[];
  /** Readings for this race: the latest per key (used), older ones (superseded), test data, and readings after asOf. */
  counts: { used: number; superseded: number; testExcluded: number; afterAsOf: number };
  /** The intelligence layer's own issues, passed through untouched. */
  intelIssues: Issue[];
}

// ---- election rules (T2) --------------------------------------------------------------------------------------------

export const RULE_KINDS = [
  "PLURALITY",
  "MAJORITY_RUNOFF",
  "MAJORITY_ELSE_LEGISLATURE",
  "RCV",
  "MEASURE_THRESHOLD",
  "MEASURE_THRESHOLD_WITH_BALLOT_FLOOR",
  "MEASURE_ALL_BALLOTS_DENOMINATOR",
  "MULTI_OPTION_ADVISORY",
  "RETENTION",
  "CHAMBER_AGGREGATE",
  "UNKNOWN",
] as const;
export type RuleKind = (typeof RULE_KINDS)[number];

/** What VAI may compute for a race under its rule. Anything not listed stays null. */
export type RuleOutput = "P_WIN" | "P_RUNOFF" | "P_PASS" | "P_MAJORITY" | "FIRST_CHOICE_SHARES" | "REPORTED_ONLY";

export interface RaceRule {
  raceId: string;
  kind: string;
  state: string;
  office: string;
  rule: RuleKind;
  /** The winning share, as a fraction of `denominator`. Null when the rule has no single share (plurality, RCV). */
  threshold: number | null;
  denominator: "VOTES_FOR_OFFICE" | "VOTES_ON_QUESTION" | "ALL_BALLOTS_CAST" | null;
  /** A second condition on all ballots cast (NE 35%, MA 30%). */
  ballotFloor: { side: "YES" | "NO"; shareOfAllBallots: number } | null;
  support: "SUPPORTED" | "PARTIAL" | "UNSUPPORTED";
  outputs: RuleOutput[];
  /** True only for the declared default (plurality, not verified per race). */
  isDefault: boolean;
  provenance: VaiProvenance | null;
  flags: string[];
}

export interface RaceRulesFile {
  schema: "vai-race-rules/1";
  builder: string;
  indexAsOf: string | null;
  inputs: { path: string; sha256: string }[];
  defaultRule: { rule: "PLURALITY"; statement: string };
  counts: { byRule: Record<string, number>; bySupport: Record<string, number>; byFlag: Record<string, number> };
  races: RaceRule[];
}

// ---- inventory (schema §4, math §2) --------------------------------------------------------------------------------

/**
 * What is known and estimated about the votes still to count. Wraps the intelligence OutstandingInventory rather than
 * replacing it; VAI adds the county split and the late-eligible prior. Phase A defines the contract only.
 */
export interface VaiInventory {
  raceId: string;
  asOf: string;
  reported: Labeled<number>;
  officialOutstanding: Labeled<number>;
  lateEligible: Labeled<number> & { rule: "ELECTION_DAY_OR_EARLIER" | "POSTMARK_GRACE" | "UNCLASSIFIED"; deadlineUtc: string | null };
  /** ESTIMATED with an interval, or UNKNOWN. A point estimate alone is never emitted. */
  estimatedRemaining: { interval: Interval | null; label: "ESTIMATED" | "UNKNOWN" };
  expectedFinal: { interval: Interval | null; label: "ESTIMATED" | "PRIOR" | "UNKNOWN" };
  tier: EstimatorTier;
  intel: OutstandingInventory | null;
}

// ---- completion ladder (schema §6) ----------------------------------------------------------------------------------

export const COMPLETION_LEVELS = ["NONE", "PARTIAL", "PRECINCTS_ALL_IN", "OFFICIAL_ELECTION_NIGHT_COMPLETE", "ALL_KNOWN_BALLOTS_COUNTED", "CERTIFIED"] as const;
/** Weakest to strongest. Each rung above PARTIAL needs explicit evidence; PRECINCTS_ALL_IN is never "complete". */
export type CompletionLevel = (typeof COMPLETION_LEVELS)[number];

// ---- county state (schema §4) ---------------------------------------------------------------------------------------

export interface Quantiles {
  median: number;
  q10: number;
  q90: number;
}

export interface VaiCountyState {
  raceId: string;
  countyKey: string;
  reported: { total: number; byCandidate: Record<string, number>; label: "VERIFIED"; asOf: string };
  /** Metadata only. */
  precinctsReportingPct: number | null;
  officialOutstanding: { value: number; asOf: string; registerId: string; label: "OFFICIAL_STATEMENT" } | null;
  lateEligible: { mean: number | null; label: "PRIOR" | "UNKNOWN"; rule: "ELECTION_DAY_OR_EARLIER" | "POSTMARK_GRACE"; deadlineUtc: string | null };
  turnoutPosterior: Quantiles & { label: "ESTIMATED" };
  remainingPosterior: Quantiles & { label: "ESTIMATED" };
  completionEvidence: CompletionLevel;
  flags: string[];
}

// ---- publication states (schema §7) ---------------------------------------------------------------------------------

export interface PublicationStates {
  reportedLead: { leaderId: string | null; votes: number; label: "VERIFIED" };
  preElectionForecast: { pWin: number; margin: number; frozenAt: string; label: "PRIOR" };
  liveProjection: VaiAssessment["projection"] | null;
  providerCall: { provider: string; winnerId: string; calledAt: string } | null;
  certified: { winnerId: string; certifiedAt: string; sourceUrl: string } | null;
}

// ---- race assessment (schema §5) ------------------------------------------------------------------------------------

export interface VaiAssessment {
  raceId: string;
  modelVersion: string;
  computedAt: string;
  /** Latest source time used, never retrieval time alone. */
  asOfSourceTime: string;
  /** sha256 of the observation slice and the frozen prior. */
  inputsHash: string;
  rule: RuleKind;
  publication: PublicationStates;
  reported: { total: number; byCandidate: Record<string, number>; label: "VERIFIED" };
  remaining: {
    officialOutstanding: number | null;
    estimatedTotal: Quantiles;
    lateEligible: { median: number | null; label: "PRIOR" | "UNKNOWN" };
    byScenario: { scenarioId: string; weight: number; label: string }[];
  };
  projection: {
    finalShare: Record<string, Quantiles>;
    margin: Quantiles | null;
    pWin: Record<string, number> | null;
    pRunoff: number | null;
    pPass: number | null;
    requiredShareOfRemaining: Record<string, Quantiles>;
    calibrationStatus: "UNCALIBRATED_SHADOW" | "BACKTESTED";
  };
  anchor: { atZeroReporting: { marginGap: number; pGap: number } };
  diagnostics: { coverage: number; unmatchedVotes: number; ess: number | null; flags: string[] };
}

// ---- frozen forecast prior (T4) -------------------------------------------------------------------------------------

/** Histogram exactly as the forecast publishes it: bin i covers [lo + i·w, lo + (i+1)·w). */
export interface PublishedHistogram {
  lo: number;
  w: number;
  c: number[];
}

export type PriorStatus = "ANCHORED" | "ANCHOR_FAILED" | "UNCONTESTED" | "UNSUPPORTED";

export interface AnchorCheck {
  draws: number;
  mean: number;
  median: number;
  probB: number;
  p10: number;
  p90: number;
  /** Prior mean − published margin. The published margin is the simulation mean (see the Phase A notes). */
  marginGap: number;
  /** Prior P(B) − published P(B). */
  pGap: number;
  p10Gap: number | null;
  p90Gap: number | null;
  /** Largest gap between the prior's CDF and the published histogram's CDF at any bin edge. */
  maxBinCdfGap: number;
  pass: boolean;
}

export interface CalibrationKnot {
  bin: number;
  value: number;
  /** Fraction of the bin's mass placed below `value`. */
  massBelow: number;
  target: "P_B" | "P10" | "P90";
  feasible: boolean;
}

export interface PriorRace {
  raceId: string;
  kind: string;
  state: string;
  status: PriorStatus;
  /** Why the race is not ANCHORED. */
  reason: string | null;
  /** Key into PriorFile.needs: what the forecast would need to export to anchor it. */
  needsFromForecast: string | null;
  /** Whether a live projection may use this prior. RCV races anchor mathematically but are withheld. */
  liveUse: "ELIGIBLE" | "WITHHELD";
  flags: string[];
  published: {
    source: string;
    margin: number | null;
    probB: number | null;
    p10: number | null;
    p90: number | null;
    dist: PublishedHistogram | null;
    pointStatistic: "MEAN" | null;
  };
  /** The within-bin calibration that makes the histogram reproduce every published summary (T4). */
  calibration: { method: "WITHIN_BIN_WARP"; gamma: number; knots: CalibrationKnot[] } | null;
  geography: {
    countyFile: string;
    counties: number;
    expectedTotal: number | null;
    indexTotal: number | null;
    countySumMargin: number | null;
    /** Published margin minus the county file's own margin: what the statewide shift absorbs at the mean. */
    countyBaselineGap: number | null;
    /** The range of statewide margins a two-party shift of the county baseline can reach. */
    reachable: [number, number];
    /** Draws a uniform two-party shift of the county baseline cannot reach, and the worst re-aggregation error on a solved subsample. */
    check: { outsideReachable: number; solvedSample: number; maxAggregateError: number };
  } | null;
  anchor: AnchorCheck | null;
  /** The single-offset constructions the original design proposed, kept as evidence of why they are not used. */
  singleOffset: { medianShift: { marginGap: number; pGap: number; pass: boolean }; meanShift: { marginGap: number; pGap: number; pass: boolean } } | null;
}

export interface PriorFile {
  schema: "vai-prior/1";
  priorId: string;
  forecastUpdated: string | null;
  indexAsOf: string | null;
  builder: string;
  inputs: { path: string; sha256: string }[];
  method: { draws: number; sampling: "STRATIFIED_QUANTILES"; tolerances: { margin: number; prob: number }; notes: string[] };
  counts: { byStatus: Record<string, number>; byLiveUse: Record<string, number>; byFlag: Record<string, number> };
  /** What the forecast would need to export, by the key races cite in needsFromForecast. */
  needs: Record<string, string>;
  /** County files whose own totals disagree with the published race figure by at least 1 point. Read only; never edited. */
  countyAudit: CountyAuditRow[];
  races: PriorRace[];
}

export interface CountyAuditRow {
  raceId: string;
  countyFile: string;
  /** Points of margin. Candidate races: 100·(b − a)/total. Measures: 100·(yes − no)/(yes + no) against 2·yes − 100. */
  measure: "MARGIN" | "YES_MARGIN";
  countyValue: number;
  publishedValue: number;
  gap: number;
  discrepant: boolean;
}
