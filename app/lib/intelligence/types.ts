// Election night intelligence engine, Phase 1: data contracts.
//
// Everything here is a SHADOW layer. Nothing in app/lib/intelligence feeds the published results desk, the race
// call rule or the forecast. See docs/ELECTION_NIGHT_INTELLIGENCE_PHASE1.md.
//
// Conventions shared with the published engine (app/results/2026/live.ts):
//   side A = Democrat, or the main non-Republican challenger where an independent carries that slot (sen-NE)
//   side B = Republican
//   side O = everyone else
//   margins are B minus A in percentage points, so positive is Republican, as everywhere on the site.

// ---- evidence and provenance ---------------------------------------------------------------------------------------

export const EVIDENCE_CLASSES = ["VERIFIED", "HISTORICAL", "INFERRED", "UNKNOWN"] as const;
/**
 * VERIFIED   an official or primary source for the 2026 election (secretary of state, county clerk, statute)
 * HISTORICAL measured in a past election; describes what happened then, never a prediction for 2026
 * INFERRED   derived by an analyst or model from other evidence; always an estimate
 * UNKNOWN    the value is not known; carries no number
 */
export type EvidenceClass = (typeof EVIDENCE_CLASSES)[number];

export const VALUE_KINDS = ["OBSERVATION", "ESTIMATE"] as const;
export type ValueKind = (typeof VALUE_KINDS)[number];

export const CONFIDENCE_LEVELS = ["HIGH", "MEDIUM", "LOW", "NONE"] as const;
export type Confidence = (typeof CONFIDENCE_LEVELS)[number];

export const VOTING_METHODS = ["ELECTION_DAY", "EARLY_IN_PERSON", "MAIL_ABSENTEE", "PROVISIONAL", "OTHER", "UNKNOWN"] as const;
export type VotingMethod = (typeof VOTING_METHODS)[number];

export const JURISDICTION_LEVELS = ["STATE", "COUNTY", "TOWN", "DISTRICT"] as const;
export type JurisdictionLevel = (typeof JURISDICTION_LEVELS)[number];

/** Minutes after the jurisdiction's poll close. A label alone is allowed when the source gives no times. */
export interface ReportingWindow {
  label: string | null;
  startMinAfterClose: number | null;
  endMinAfterClose: number | null;
}

/**
 * How close the source is to the primary record.
 * PRIMARY_OFFICIAL    the statute, the election authority's own page or its data file
 * SECONDARY_SUMMARY   a summary of the primary record by a third party that cites it (for example NCSL tables)
 * RESEARCH_COMPILATION a research group's compilation of official returns (for example MEDSL)
 * A VERIFIED value that rests on a secondary tier is capped at MEDIUM confidence.
 */
export const SOURCE_TIERS = ["PRIMARY_OFFICIAL", "SECONDARY_SUMMARY", "RESEARCH_COMPILATION"] as const;
export type SourceTier = (typeof SOURCE_TIERS)[number];

export interface Provenance {
  /** Optional: records written before Phase 2 do not carry it. */
  sourceTier?: SourceTier | null;
  evidenceClass: EvidenceClass;
  valueKind: ValueKind;
  sourceUrl: string | null;
  sourceName: string | null;
  /** When the source published the information. ISO 8601. */
  publishedAt: string | null;
  /** When the researcher or the system retrieved it. ISO 8601. */
  retrievedAt: string | null;
  /** The election year the value describes. Required for HISTORICAL. */
  historicalYear: number | null;
  confidence: Confidence;
  limitations: string[];
}

// ---- research package records ---------------------------------------------------------------------------------------

export const RECORD_TYPES = [
  "POLL_CLOSE",
  "REPORTING_WINDOW",
  "METHOD_HISTORY",
  "TURNOUT_EXPECTATION",
  "OUTSTANDING_REPORT",
  "BALLOT_DEADLINE",
  "GEO_SPLIT",
  "RELEASE_TIMING",
  "REPORTING_PRACTICE",
  "CANDIDATE_BY_METHOD",
] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

interface RecordBase {
  recordId: string;
  recordType: RecordType;
  /** Forecast race id (sen-GA, gov-AZ, house-PA-7). Null when the record describes a jurisdiction for every race. */
  raceId: string | null;
  state: string;
  /** "STATE", a five digit county FIPS, a town code, or a district id such as "PA-07". */
  jurisdictionId: string;
  jurisdictionLevel: JurisdictionLevel;
  method: VotingMethod | null;
  reportingWindow: ReportingWindow | null;
  provenance: Provenance;
  notes: string | null;
  /** Set by the importer from the package, never by the record. */
  packageId: string;
  synthetic: boolean;
}

export const TIME_ZONE_RULES = ["STATEWIDE", "PER_COUNTY_LOCAL"] as const;
export type TimeZoneRule = (typeof TIME_ZONE_RULES)[number];

/**
 * Official 2026 poll closing time for a jurisdiction. This is when voting ends, not when results are released.
 * STATEWIDE: `closesAtUtc` is the instant. PER_COUNTY_LOCAL: the law gives a local clock time (`closesLocal`, "19:00") and
 * the instant differs by county time zone, so no single statewide instant exists and `closesAtUtc` must be null.
 */
export interface PollCloseRecord extends RecordBase {
  recordType: "POLL_CLOSE";
  closesAtUtc: string | null;
  closesLocal: string | null;
  timeZoneRule: TimeZoneRule | null;
}

/** When a method's ballots were reported in a past election, relative to poll close. Describes the past only. */
export interface ReportingWindowRecord extends RecordBase {
  recordType: "REPORTING_WINDOW";
  sequenceRank: number | null;
  /** Share of that method's final count that was reported by the end of the window, 0..1. */
  shareReported: number | null;
}

/** Votes cast by method in a jurisdiction in a past (HISTORICAL) or the current (VERIFIED) election. */
export interface MethodHistoryRecord extends RecordBase {
  recordType: "METHOD_HISTORY";
  votes: number | null;
  shareOfTotal: number | null;
}

/** An expected final total for a race or jurisdiction, with its own interval. */
export interface TurnoutExpectationRecord extends RecordBase {
  recordType: "TURNOUT_EXPECTATION";
  expectedLow: number | null;
  expectedCentral: number | null;
  expectedHigh: number | null;
}

export const OUTSTANDING_STATUSES = ["CONFIRMED", "NOT_YET_ELIGIBLE"] as const;
export type OutstandingStatus = (typeof OUTSTANDING_STATUSES)[number];

/** An official statement of ballots still to count (CONFIRMED) or still able to arrive or be cured (NOT_YET_ELIGIBLE). */
export interface OutstandingReportRecord extends RecordBase {
  recordType: "OUTSTANDING_REPORT";
  outstanding: number | null;
  outstandingStatus: OutstandingStatus;
  asOf: string | null;
}

/** Statutory receipt, cure or canvass deadline. */
export interface BallotDeadlineRecord extends RecordBase {
  recordType: "BALLOT_DEADLINE";
  deadlineKind: string | null;
  deadlineUtc: string | null;
}

/**
 * Share of a county that lies in a congressional district. `weightBasis` names what was measured (for example
 * "2020 census population, block assignment file"). A weight is not a vote share: allocating a county's votes by it
 * is an estimate, never an observation.
 */
export interface GeoSplitRecord extends RecordBase {
  recordType: "GEO_SPLIT";
  countyFips: string;
  districtId: string;
  weight: number | null;
  weightBasis: string | null;
}

/**
 * The five timing questions. They are separate facts and are never derived from one another: a legal right to scan
 * says nothing about when a county publishes, and a past release says nothing about 2026.
 */
export const TIMING_KINDS = [
  "LEGAL_PROCESSING_TIME",
  "LEGAL_SCANNING_TIME",
  "OFFICIAL_EXPECTED_RELEASE_TIME",
  "HISTORICAL_OBSERVED_RELEASE_TIME",
  "ACTUAL_2026_RELEASE_TIME",
] as const;
export type TimingKind = (typeof TIMING_KINDS)[number];

export interface ReleaseTimingRecord extends RecordBase {
  recordType: "RELEASE_TIMING";
  timingKind: TimingKind;
  /** What the source says, in words: "7 days before Election Day", "after 8:00 p.m. on election night". */
  localText: string | null;
  /** Set only when the source states an exact instant. A rule such as "7 days before" stays text. */
  atUtc: string | null;
  timeZone: string | null;
  statuteCite: string | null;
}

export const PRACTICE_KINDS = [
  "REPORTING_UNIT",
  "METHOD_SEPARATION",
  "LATE_BALLOT_RULE",
  "UOCAVA_RULE",
  "PROVISIONAL_RULE",
  "CANVASS_CERTIFICATION",
  "RANKED_CHOICE",
  "OUTSTANDING_INVENTORY_SOURCE",
  "SEQUENCE_FINDING",
] as const;
export type PracticeKind = (typeof PRACTICE_KINDS)[number];

/**
 * The kinds of ballot whose order of arrival matters. A combined batch whose methods the source does not separate is
 * MIXED_OR_UNKNOWN; it is never assigned to one of the others.
 */
export const BALLOT_CATEGORIES = [
  "EARLY_IN_PERSON",
  "MAIL_ABSENTEE",
  "ELECTION_DAY_IN_PERSON",
  "PROVISIONAL",
  "MILITARY_OVERSEAS",
  "LATE_ARRIVING_ELIGIBLE",
  "CURE_ADJUDICATION_CANVASS",
  "MIXED_OR_UNKNOWN",
] as const;
export type BallotCategory = (typeof BALLOT_CATEGORIES)[number];

/** What a sequence finding states about its category. A rule is not a schedule; none of these is a release time. */
export const SEQUENCE_FACTS = [
  "PROCESSING_WINDOW",
  "TABULATION_WINDOW",
  "RELEASE_RESTRICTION",
  "REPORTING_REQUIREMENT",
  "RECEIPT_DEADLINE",
  "CURE_OR_REVIEW_WINDOW",
  "REPORTING_UNIT_NOTE",
  "NOT_STATED_BY_SOURCE",
] as const;
export type SequenceFact = (typeof SEQUENCE_FACTS)[number];

/**
 * How a state reports and finishes counting. Qualitative: it carries words and a citation, never a number the model uses.
 * A SEQUENCE_FINDING also names the ballot category and the kind of fact, and must state at least one limitation.
 */
export interface ReportingPracticeRecord extends RecordBase {
  recordType: "REPORTING_PRACTICE";
  practiceKind: PracticeKind;
  summary: string | null;
  statuteCite: string | null;
  ballotCategory: BallotCategory | null;
  sequenceFact: SequenceFact | null;
}

/**
 * A = actual candidate votes by method
 * B = official ballot counts by method (no candidate split)
 * C = party registration composition. NEVER a vote share.
 * D = statistical estimate (needs a stated methodology and uncertainty)
 * E = unknown
 */
export const MEASURE_KINDS = ["A", "B", "C", "D", "E"] as const;
export type MeasureKind = (typeof MEASURE_KINDS)[number];

/** Votes for each side in one contest in one past election, for one method, as the source labels it. */
export interface CandidateByMethodRecord extends RecordBase {
  recordType: "CANDIDATE_BY_METHOD";
  measureKind: MeasureKind;
  contestYear: number | null;
  office: Office | null;
  /** House district number as the source gives it, or null for a statewide contest. */
  contestDistrict: string | null;
  /** The source's own mode label, kept verbatim. `method` is set only where the label is unambiguous. */
  modeLabel: string | null;
  votesA: number | null;
  votesB: number | null;
  votesOther: number | null;
  /** Class D only: how the estimate was made and its stated uncertainty. */
  methodology: string | null;
  uncertainty: string | null;
  /**
   * Whether the source's method rows cover the whole contest. RECONCILED: method labels are complete and the candidate
   * totals match a retrieved certified total within tolerance. NO_TOTAL: no certified total was retrieved to check
   * against. AMBIGUOUS: the contest failed a check (label completeness, certified difference or overlap); the record's
   * limitations say which.
   */
  coverage: "RECONCILED" | "AMBIGUOUS" | "NO_TOTAL" | null;
}

export type ResearchRecord =
  | ReleaseTimingRecord
  | ReportingPracticeRecord
  | CandidateByMethodRecord
  | PollCloseRecord
  | ReportingWindowRecord
  | MethodHistoryRecord
  | TurnoutExpectationRecord
  | OutstandingReportRecord
  | BallotDeadlineRecord
  | GeoSplitRecord;

export interface ResearchPackageMeta {
  packageId: string;
  /** Who produced it: an analyst, ChatGPT, Gemini. Free text, recorded for audit. */
  producer: string;
  createdAt: string;
  /** Fixtures for tests. A synthetic package is refused by the production loader. */
  synthetic: boolean;
  /** The forecast snapshot the package was researched against. Phase 1 expects "2026-10-25". */
  baselineSnapshot: string | null;
}

export type IssueSeverity = "ERROR" | "WARNING" | "INFO";
export interface Issue {
  code: string;
  severity: IssueSeverity;
  message: string;
  recordId?: string | null;
  row?: number | null;
  field?: string | null;
}

export interface ResearchValidationResult {
  meta: ResearchPackageMeta | null;
  accepted: ResearchRecord[];
  rejected: { row: number | null; recordId: string | null; issues: Issue[] }[];
  issues: Issue[];
  unmatchedRaceIds: string[];
}

// ---- forecast baseline and the register ----------------------------------------------------------------------------

export type Office = "senate" | "governor" | "house";

export interface BaselineRace {
  raceId: string;
  office: Office;
  state: string;
  district: number | null;
  name: string;
  sideA: string | null;
  sideB: string | null;
  /** Forecast margin, B minus A, percentage points. */
  margin: number;
  /** Forecast chance side B wins, 0..1. */
  probB: number | null;
  p10: number | null;
  p90: number | null;
}

export interface BaselineSource {
  snapshotDate: string;
  files: { path: string; gitRef: string | null; sha256: string | null }[];
  notes: string[];
}

export type ComponentKey = "reporting" | "outstanding" | "geography" | "methods";
export type ResearchCoverage = "MISSING" | "PARTIAL" | "PRESENT" | "NOT_REQUIRED";

export interface RegisterEntry {
  rank: number;
  raceId: string;
  office: Office;
  state: string;
  district: number | null;
  name: string;
  baseline: Pick<BaselineRace, "margin" | "probB" | "p10" | "p90" | "sideA" | "sideB">;
}

export interface Register {
  kind: "TOP_N_CLOSEST";
  n: number;
  offices: Office[];
  rankedBy: string;
  generatedAt: string;
  source: BaselineSource;
  entries: RegisterEntry[];
  /** Races considered and left out, with why. */
  excluded: { raceId: string; reason: string }[];
}

// ---- live observations ----------------------------------------------------------------------------------------------

export interface Sides {
  a: number;
  b: number;
  o: number;
}

/**
 * One reading of returns for one race in one jurisdiction for one method, exactly as a source published it.
 * `precinctsReportingPct` is kept as metadata only; nothing in the intelligence layer treats it as a share of votes.
 */
export interface VoteObservation {
  raceId: string;
  jurisdictionId: string;
  jurisdictionLevel: JurisdictionLevel;
  /**
   * WHOLE: the figure covers the whole jurisdiction.
   * DISTRICT_PORTION: the figure covers only the part of a county inside the race's district (how civicAPI reports a
   * House race by county).
   */
  scope: "WHOLE" | "DISTRICT_PORTION";
  method: VotingMethod;
  sides: Sides;
  precinctsReportingPct: number | null;
  /** The time the source says the figure was current. Null when the source gives none. */
  sourceTimestamp: string | null;
  retrievedAt: string;
  source: string;
  sourceUrl: string | null;
  test: boolean;
}

export interface LoggedObservation {
  seq: number;
  observation: VoteObservation;
  /** The untouched payload this observation was read from, for audit. */
  raw: unknown;
}

// ---- stage results --------------------------------------------------------------------------------------------------

export type StageStatus = "OK" | "DEGRADED" | "UNAVAILABLE" | "FAILED";
export interface StageResult<T> {
  stage: string;
  status: StageStatus;
  value: T | null;
  issues: Issue[];
}

export interface Interval {
  low: number;
  central: number | null;
  high: number;
}

export interface Quantity {
  value: number | null;
  evidenceClass: EvidenceClass;
  sources: string[];
}

export interface ReconciledReturns {
  asOf: string;
  /** Race total used everywhere downstream. Never the sum of a topline and its own parts. */
  reported: Sides & { t: number };
  basis: "TOPLINE" | "JURISDICTION_SUM" | "NONE";
  byJurisdiction: Record<string, { sides: Sides; t: number; scope: VoteObservation["scope"]; level: JurisdictionLevel; sourceTimestamp: string | null; precinctsReportingPct: number | null }>;
  /** Votes by method. `sides` is null where the side split of those votes is not measured (the UNKNOWN remainder). */
  byMethod: Partial<Record<VotingMethod, { t: number; sides: Sides | null }>>;
  latestSourceTimestamp: string | null;
  observationsUsed: number;
  observationsIgnored: number;
}

export interface GeoCoverage {
  raceScope: "STATEWIDE" | "DISTRICT";
  jurisdictionsExpected: number | null;
  jurisdictionsReporting: number;
  wholeJurisdictions: string[];
  partialJurisdictions: { fips: string; weight: number | null; allocation: "SOURCE_REPORTS_PORTION" | "ESTIMATED_BY_WEIGHT" | "UNAVAILABLE" }[];
  unknownMembership: string[];
  /** Votes the reported total rests on, by how they were placed in the race's geography. */
  votesObserved: number;
  votesEstimatedByWeight: number;
  votesUnallocated: number;
  crosswalkAvailable: boolean;
}

export interface MethodComposition {
  methods: {
    method: VotingMethod;
    /** Votes the live source attributes to this method. Null when the source does not break this method out. */
    reported: number | null;
    historical: { year: number; share: number | null; votes: number | null; recordId: string; sourceUrl: string | null }[];
    officialOutstanding: number | null;
    estimatedRemaining: null;
    estimatedRemainingStatus: "UNAVAILABLE";
  }[];
  /** Share of the reported votes whose method is known, 0..1. Null with no votes. */
  knownMethodShare: number | null;
}

/**
 * What an outstanding-vote figure rests on, best first. A lower rung is used only when every rung above it is absent;
 * the estimator never blends rungs and never states more precision than the rung it uses carries.
 *  1 OFFICIAL_JURISDICTION_COUNT   an official statement of ballots still to count
 *  2 VERIFIED_METHOD_INVENTORY     an official count of ballots by method, used only if it can be netted against counted votes
 *  3 HISTORICAL_ESTIMATE_WITH_RANGE a turnout expectation that states its own low and high; not backtested
 *  4 FORECAST_POINT_NO_RANGE       the forecast's expected total, a point with no stated range
 *  5 UNKNOWN                       no usable basis: no number is produced
 */
export const ESTIMATOR_TIERS = ["OFFICIAL_JURISDICTION_COUNT", "VERIFIED_METHOD_INVENTORY", "HISTORICAL_ESTIMATE_WITH_RANGE", "FORECAST_POINT_NO_RANGE", "UNKNOWN"] as const;
export type EstimatorTier = (typeof ESTIMATOR_TIERS)[number];

export interface EstimatorRung {
  tier: EstimatorTier;
  status: "USED" | "PRESENT_NOT_USED" | "ABSENT";
  detail: string;
}

export interface OutstandingInventory {
  reported: number;
  officiallyConfirmedOutstanding: Quantity;
  notYetEligible: Quantity;
  estimatedOutstanding: Interval | null;
  expectedFinal: Interval | null;
  /** The best rung the figure rests on. */
  tier: EstimatorTier;
  /** Every rung and whether it was used, present but unusable, or absent. */
  ladder: EstimatorRung[];
  /** For rung 1: whether the official statement is statewide/district-wide or from counties that may not cover the race. */
  officialScope: "STATEWIDE_OR_DISTRICT" | "COUNTIES" | null;
  /** QUANTIFIED: the turnout input carried its own interval. UNQUANTIFIED: a point with no stated range. */
  uncertainty: "QUANTIFIED" | "UNQUANTIFIED" | "UNAVAILABLE";
  turnoutBasis: { kind: "RESEARCH" | "FORECAST_EXPECTED_TOTAL" | "NONE"; recordIds: string[]; evidenceClass: EvidenceClass };
  unknownInventory: boolean;
}

export interface ReportingContext {
  /** Whether polls have closed in the race's jurisdictions at the evaluation time, from VERIFIED 2026 closing times only. */
  pollsClosed: "ALL" | "SOME" | "NONE" | "UNKNOWN";
  pollClose: { jurisdictionId: string; closesAtUtc: string; recordId: string; sourceUrl: string | null }[];
  historicalWindows: {
    jurisdictionId: string;
    method: VotingMethod | null;
    year: number;
    window: ReportingWindow | null;
    shareReported: number | null;
    sequenceRank: number | null;
    recordId: string;
    sourceUrl: string | null;
    confidence: Confidence;
  }[];
  deadlines: { kind: string | null; deadlineUtc: string | null; recordId: string; sourceUrl: string | null }[];
  /** Always true in Phase 1: historical windows are context, never a schedule for 2026. */
  windowsAreHistoricalContextOnly: true;
}

export interface ShadowScenario {
  id: "OUTSTANDING_SPLITS_LIKE_REPORTED" | "OUTSTANDING_SPLITS_LIKE_FORECAST";
  description: string;
  finalMargin: Interval | null;
}

export interface ShadowProjection {
  status: "AVAILABLE" | "PARTIAL" | "UNAVAILABLE";
  reasons: string[];
  reportedMargin: number | null;
  expectedFinal: Interval | null;
  /** Reported votes as a share of the expected final, 0..100. low uses the high expected final. */
  shareOfExpectedCounted: Interval | null;
  arithmetic: {
    leader: "A" | "B" | null;
    votesAhead: number;
    /** Two-party share of the outstanding vote the trailing side needs to draw level, assuming every outstanding vote goes to A or B. */
    trailingNeedsShare: Interval | null;
    /** True only when the lead exceeds the HIGH estimate of outstanding plus anything not yet eligible. Not a race call. */
    leadExceedsOutstandingHigh: boolean | null;
  };
  scenarios: ShadowScenario[];
  winProbability: { status: "UNAVAILABLE"; reason: string };
}

export interface PublishedComparison {
  available: boolean;
  reason: string | null;
  published: { expectedFinal: number; pctIn: number; margin: number; pB: number; sd: number } | null;
  diff: {
    expectedFinalVsShadowCentral: number | null;
    pctInVsShadowCentral: number | null;
    /** Published margin minus the shadow's forecast-split scenario central margin. */
    marginVsForecastScenario: number | null;
  } | null;
}

// ---- Phase 2: state reporting order --------------------------------------------------------------------------------

export interface TimingEntry {
  kind: TimingKind;
  /** VERIFIED: a 2026 rule or statement from an authority. HISTORICAL: observed in a past election. */
  evidenceClass: EvidenceClass;
  localText: string | null;
  atUtc: string | null;
  timeZone: string | null;
  statuteCite: string | null;
  sourceUrl: string | null;
  sourceTier: SourceTier | null;
  recordId: string;
  confidence: Confidence;
}

export interface PracticeEntry {
  kind: PracticeKind;
  evidenceClass: EvidenceClass;
  summary: string | null;
  statuteCite: string | null;
  sourceUrl: string | null;
  sourceTier: SourceTier | null;
  recordId: string;
  confidence: Confidence;
  ballotCategory: BallotCategory | null;
  sequenceFact: SequenceFact | null;
  jurisdictionId: string;
  publishedAt: string | null;
  retrievedAt: string | null;
  limitations: string[];
}

/** Poll closing facts for a state: an instant when the law gives one statewide, a local rule when it does not. */
export interface PollCloseEntry {
  jurisdictionId: string;
  closesAtUtc: string | null;
  closesLocal: string | null;
  timeZoneRule: TimeZoneRule | null;
  evidenceClass: EvidenceClass;
  sourceUrl: string | null;
  sourceTier: SourceTier | null;
  recordId: string;
  notes: string | null;
}

/** Which ballot categories have a documented sequence finding for a state, and which do not. */
export interface SequenceCoverage {
  byCategory: Record<BallotCategory, PracticeEntry[]>;
  /** Categories with no VERIFIED finding. They are unknown for this state, not assumed. */
  undocumented: BallotCategory[];
}

export interface MethodEvidenceEntry {
  year: number | null;
  office: Office | null;
  district: string | null;
  coverage: CandidateByMethodRecord["coverage"];
  /** One row per source mode label, with total votes. Candidate shares are in the records, not computed here. */
  modes: { modeLabel: string | null; method: VotingMethod | null; votes: number; recordId: string }[];
  sourceUrl: string | null;
  confidence: Confidence;
  /** Why the evidence is or is not reconciled: label completeness, difference from the official total, caveats. */
  limitations: string[];
}

export interface PrecinctVsBallots {
  jurisdictionsWithPrecinctPct: number;
  jurisdictionsAtFullPrecincts: number;
  /** Mean of the sources' precinct percentages, weighted by votes. A share of precincts, not of votes. */
  precinctPctWeighted: number | null;
  reportedVotes: number;
  /** The published engine's own "percent in", 0..100, when a comparison was run. */
  publishedPctIn: number | null;
  /** Reported votes over the forecast's expected final total, 0..100. */
  estimatedBallotShareCounted: Interval | null;
  officialOutstanding: number | null;
  modelOutstanding: Interval | null;
  /** Precinct percentage minus the estimated share of ballots counted, in points. */
  gapPoints: number | null;
  flag: "PRECINCTS_COMPLETE_BALLOTS_INCOMPLETE" | "PRECINCTS_AND_BALLOTS_CONSISTENT" | "UNAVAILABLE";
  explanation: string;
}

export interface ReportingOrderProfile {
  state: string;
  stateInDataset: boolean;
  pollClose: PollCloseEntry[];
  /** Each timing kind is listed on its own. An empty list is UNKNOWN; nothing is carried across kinds. */
  timings: Record<TimingKind, TimingEntry[]>;
  practices: PracticeEntry[];
  sequence: SequenceCoverage;
  methodEvidence: MethodEvidenceEntry[];
  /** Which evidence classes exist for this race's state, so a reader can see what a composition adjustment would rest on. */
  evidenceClasses: Record<MeasureKind, "PRESENT" | "ABSENT">;
  partisanComposition: { status: "NOT_APPLIED"; appliedToProjection: false; reason: string };
  methodOutstanding: { status: "UNAVAILABLE"; reason: string };
  precinctVsBallots: PrecinctVsBallots | null;
  missing: string[];
}

export interface DiagnosticReport {
  raceId: string;
  generatedAt: string;
  asOf: string;
  synthetic: boolean;
  baseline: BaselineRace | null;
  stages: { stage: string; status: StageStatus; issues: Issue[] }[];
  returns: ReconciledReturns | null;
  geography: GeoCoverage | null;
  methods: MethodComposition | null;
  reporting: ReportingContext | null;
  outstanding: OutstandingInventory | null;
  shadow: ShadowProjection | null;
  published: PublishedComparison | null;
  /** State-specific reporting order and partisan-composition availability. Descriptive only. */
  reportingOrder: ReportingOrderProfile | null;
  confidence: Confidence;
  confidenceReasons: string[];
  missingResearch: { component: ComponentKey; need: string }[];
}
