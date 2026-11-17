// Election Night 2.0 engine: the data contracts. Pure types, no code.
//
//   ElectionSnapshot  -> RaceForecast[]  -> NationalForecast
//   (observations)       (per race)         (joint, correlated)
//
// Three kinds of figure are never mixed in one field:
//   REPORTED   what the provider published, as published (candidates.ts `reported()`).
//   MODELED    the engine's estimate: a distribution, never a call, never a certainty while uncalled.
//   CALLED     a provider call or (later) an editorial call, each with its origin.
// Every output carries the snapshot it was computed from, the model version and the time it was computed.

export type DataMode = "SIMULATED" | "HISTORICAL" | "LIVE";

/** docs/03 section 8. LIMITED is the normal state on civicAPI: it publishes no vote-method labels. */
export type DataState = "READY" | "LIMITED" | "STALE" | "MISSING" | "INVALID" | "SIMULATED";

export type VotingMethod = "ELECTION_DAY" | "EARLY_IN_PERSON" | "MAIL_ABSENTEE" | "PROVISIONAL" | "OTHER" | "UNKNOWN";
export type MethodSource = "PROVIDER_CONFIRMED" | "OFFICIAL_INVENTORY" | "HISTORICAL_PRIOR" | "INFERRED" | "UNKNOWN";

export type Provenance = {
  mode: DataMode;
  /** where the observations came from, e.g. "civicAPI race search via /api/civic/search" */
  source: string;
  /** the provider's own time for the data, when it gives one; null when it does not (civicAPI search does not) */
  sourceAsOf: string | null;
  /** when On Point's server read the provider (a receipt time) */
  receivedAt: string;
  /** true when any value was built from an observation later than `receivedAt` (interpolation). Disqualifies evaluation. */
  usesFutureObservation: boolean;
  synthetic: boolean;
};

// ---- observations ------------------------------------------------------------------------------------------------
export type ObservedCandidate = {
  candidateId: string;
  name: string;
  partyRaw: string | null;
  /** null = the provider sent no count. 0 = it sent zero. */
  votes: number | null;
  providerWinner: boolean;
};
export type ObservedUnit = {
  /** county FIPS (matching the forecast's county file) or another stable unit id */
  unitId: string;
  name: string | null;
  /** the provider's percent reporting for the unit. Precinct-style: NOT the share of ballots counted. */
  providerPctReporting: number | null;
  votes: Record<string, number | null>;   // by candidateId
  /** when the unit's counts last changed, where the source knows it (a recorded history does; a single live read does not) */
  quietSince?: string | null;
  /** votes by voting method, only when the provider labels them. Never inferred from the time a batch arrived. */
  byMethod?: Partial<Record<Exclude<VotingMethod, "UNKNOWN">, Record<string, number>>>;
  methodSource?: MethodSource;
};
export type RaceObservation = {
  /** the forecast's race id (index.json) */
  raceId: string;
  providerRaceId: string | number | null;
  candidates: ObservedCandidate[];
  /** race-level percent reporting from the provider. Precinct-style: NOT the share of ballots counted. */
  providerPctReporting: number | null;
  units: ObservedUnit[] | null;
  sourceAsOf: string | null;
  receivedAt: string;
  test: boolean;
  /** when the race's total last moved, where the source knows it (a recorded history does; a single live read does not) */
  quietSince?: string | null;
  /** the provider's own stated time of its call, when it gives one (civicAPI's called_at) */
  providerCalledAt?: string | null;
  /** the provider's listed poll-closing time for this race, when it gives one */
  pollsCloseAt?: string | null;
  /** the highest total the race had shown before this read, where the source knows it */
  peakTotal?: number | null;
  /** what is wrong with the provider's own rows for this race, in words; absent when nothing is, or when it sent no rows */
  integrity?: string[];
};
export type ElectionSnapshot = {
  snapshotId: string;
  provenance: Provenance;
  /** keyed by forecast race id; a race with no provider match is absent, not empty */
  races: Record<string, RaceObservation>;
  /** race ids the provider returned that matched no forecast race, kept so nothing disappears silently */
  unmatchedProviderRaces: number;
};

// ---- outputs -----------------------------------------------------------------------------------------------------
export type Interval = { lo: number; hi: number };
export type Dist = { mean: number; p50: number; i80: Interval; i95: Interval };

export type QualityFlag =
  | "NO_FORECAST" | "NO_OBSERVATION" | "METHOD_UNKNOWN" | "METHOD_PRIORS_OFF" | "UNIT_TOPLINE_MISMATCH" | "COUNT_UNKNOWN"
  | "AMBIGUOUS_CANDIDATE" | "SAME_PARTY_POOLED" | "TEST_DATA" | "TURNOUT_WEAK_EVIDENCE" | "UNIT_NO_BASELINE"
  | "RULE_RANKED_CHOICE" | "RULE_RUNOFF" | "RULE_NOT_MODELED" | "UNCONTESTED" | "COUNT_EXCEEDS_FORECAST" | "COUNT_DECREASED"
  /** the provider's own county rows contradict its race total (a total row among the counties, or a total far above them) */
  | "PROVIDER_ROWS_INCONSISTENT"
  /** not a fault: the race is modeled county by county (engine 2.4.0), not from its total */
  | "COUNTY_MODEL";

export type CandidateForecast = {
  candidateId: string;
  name: string;
  partyRaw: string | null;
  /** the forecast side this candidate is counted with: a, b (the forecast's two principals) or o */
  side: "a" | "b" | "o";
  reportedVotes: number | null;
  projectedVotes: Dist;
  /** percent of all projected votes */
  projectedShare: Dist;
  /** model probability of finishing with the most votes (plurality), or of the measure outcome; null where the rule makes it meaningless */
  winProbability: number | null;
  /** first-choice lead probability, ranked-choice contests only */
  firstChoiceLeadProbability?: number;
  /** runoff states: probability of winning outright (majority) */
  outrightProbability?: number;
};

export type OutstandingUnit = {
  unitId: string;
  name: string | null;
  method: VotingMethod;
  methodSource: MethodSource;
  counted: number;
  expectedFinal: Dist;
  outstanding: Dist;
  /** the provider's precinct-style percent, shown for reference only */
  providerPctReporting: number | null;
};

export type RaceForecast = {
  raceId: string;
  rule: "plurality" | "measure" | "multi_seat" | "ranked_choice" | "majority_runoff";
  /** a measure's passing bar as a share of Yes among Yes and No (0.5 unless the race states more, e.g. Florida's 0.6); absent for candidates */
  passShare?: number;
  computedAt: string;
  snapshotId: string;
  modelVersion: string;
  dataState: DataState;
  /** true when a published forecast stands behind the estimate */
  forecastAvailable: boolean;
  /** never "CALIBRATED" until Gate E: real timestamped history, certified results, held-out evaluation */
  calibration: "UNCALIBRATED";
  /** settled independently of the model: UNCONTESTED is logical; a provider call is reported in `call`, not here */
  settled: null | { basis: "UNCONTESTED"; winnerId: string };
  call: null | { origin: "provider"; source: string; winnerId: string; name: string };
  candidates: CandidateForecast[];
  /** the forecast's two principals, B minus A in points of all votes (the site's sign convention) */
  principalMargin: null | { reported: number | null; projected: Dist; probB: number; prior: { margin: number; probB: number } };
  /** the two candidates with the most projected votes, and the margin between them */
  projectedTopTwo: null | { leaderId: string; runnerUpId: string; marginPp: Dist; marginVotes: Dist };
  turnout: { counted: number; expectedFinal: Dist | null; outstanding: Dist | null; byUnit: OutstandingUnit[];
    /** minutes since the race's total last moved, where the source knows it; and whether the state is one that counts for days */
    quietMin?: number; slowCount?: boolean };
  /** for display: the leading model probability, capped below certainty while uncalled */
  display: { leaderId: string | null; probability: number | null; capped: boolean };
  draws: number;
  /** Monte Carlo standard error of the leading probability */
  mcStdErr: number | null;
  flags: QualityFlag[];
  notes: string[];
};

export type SeatDist = { mean: number; p50: number; i50: Interval; i80: Interval; i95: Interval };
export type ChamberForecast = {
  label: string;
  /** exactly what "control" means here, in words */
  controlRule: string;
  pD: number; pR: number; pUnresolved: number;
  seats: { D: SeatDist; R: SeatDist; other: SeatDist };
  /** NOT probabilistic: seats called (On Point's own calls since 2.5.0; the provider's before), and seats currently led in the count, by party */
  called: { D: number; R: number; other: number };
  leading: { D: number; R: number; other: number };
  notUp: { D: number; R: number };
  /** the frozen pre-election forecast, for comparison only */
  preElection: { pD: number | null; seatsD: number | null };
  racesModeled: number;
  /** P(Democrats hold exactly n seats), for n from 0 to the total: the whole distribution, for charts and party-total outcomes */
  distD: number[];
  /** what a page shows: the leading party's probability, capped below certainty unless calls alone decide control */
  display: { leader: "D" | "R"; probability: number; capped: boolean; basis: string };
};
export type PopularVote = {
  label: string;
  inclusion: string;
  observed: { D: number; R: number; other: number; total: number; marginPp: number | null; twoPartyMarginPp: number | null; racesWithVotes: number; racesIncluded: number };
  projected: { D: Dist; R: Dist; other: Dist; marginPp: Dist; shareD: Dist; shareR: Dist; total: Dist; outstanding: Dist };
  /** a poll average from before the election. NOT counted votes. */
  benchmark: { label: string; marginPp: number | null };
};
export type NationalForecast = {
  snapshotId: string;
  computedAt: string;
  modelVersion: string;
  mode: DataMode;
  calibration: "UNCALIBRATED";
  draws: number;
  seed: string;
  /** pooled from every counted race: the swing from the forecast, and the national part of the reporting-order bias */
  nationalSwing: { mean: number; sd: number; racesInforming: number; orderBias: { mean: number; sd: number } };
  senate: ChamberForecast;
  house: ChamberForecast;
  governors: ChamberForecast;
  houseVote: PopularVote;
  flags: string[];
};
