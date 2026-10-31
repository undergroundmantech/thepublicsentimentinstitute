// State reporting order: what the evidence says about when and how a state's votes appear, kept descriptive.
//
// Five timing kinds are listed separately and never derived from one another. Nothing here changes a projection:
// the profile reports which evidence exists, what is missing, and how precinct progress compares with ballots
// counted. A method adjustment to the shadow projection is not implemented, because the evidence it would need
// (a backtested model over timestamped history) does not exist in the repository.

import { BALLOT_CATEGORIES, TIMING_KINDS } from "./types";
import type {
  BallotCategory, CandidateByMethodRecord, Interval, MeasureKind, MethodEvidenceEntry, OutstandingInventory, PollCloseEntry, PollCloseRecord, PracticeEntry, PrecinctVsBallots,
  PublishedComparison, ReconciledReturns, ReportingOrderProfile, ReportingPracticeRecord, ReleaseTimingRecord, ResearchRecord,
  SequenceCoverage, ShadowProjection, TimingEntry, TimingKind,
} from "./types";

const PHASE2_TYPES = new Set(["RELEASE_TIMING", "REPORTING_PRACTICE", "CANDIDATE_BY_METHOD"]);
/** The category a Phase 2 rule kind describes. These are secondary-summary rules unless the entry says otherwise. */
const KIND_CATEGORY: Partial<Record<string, BallotCategory>> = {
  LATE_BALLOT_RULE: "LATE_ARRIVING_ELIGIBLE", UOCAVA_RULE: "MILITARY_OVERSEAS", PROVISIONAL_RULE: "PROVISIONAL", CANVASS_CERTIFICATION: "CURE_ADJUDICATION_CANVASS",
};

export interface ReportingOrderInput {
  raceId: string;
  state: string;
  office: "senate" | "governor" | "house" | null;
  /** House district number, or null. */
  district: number | null;
  research: ResearchRecord[];
  returns: ReconciledReturns | null;
  outstanding: OutstandingInventory | null;
  shadow: ShadowProjection | null;
  published: PublishedComparison | null;
}

/** A House contest in a source is matched on its district number, however the source pads it. */
const sameDistrict = (a: string | null, b: number | null) => a !== null && b !== null && Number(a) === b;

export function precinctVsBallots(returns: ReconciledReturns | null, shadow: ShadowProjection | null, outstanding: OutstandingInventory | null, published: PublishedComparison | null): PrecinctVsBallots | null {
  if (!returns) return null;
  let withPct = 0, atFull = 0, wSum = 0, wVotes = 0;
  for (const j of Object.values(returns.byJurisdiction)) {
    if (j.precinctsReportingPct === null || !Number.isFinite(j.precinctsReportingPct)) continue;
    withPct++;
    if (j.precinctsReportingPct >= 100) atFull++;
    wSum += j.precinctsReportingPct * j.t; wVotes += j.t;
  }
  const precinctPctWeighted = wVotes > 0 ? wSum / wVotes : null;
  const share = shadow?.shareOfExpectedCounted ?? null;
  const central = share?.central ?? null;
  const gapPoints = precinctPctWeighted !== null && central !== null ? precinctPctWeighted - central : null;
  let flag: PrecinctVsBallots["flag"] = "UNAVAILABLE";
  let explanation = "no precinct percentage or no expected total is available, so the two measures cannot be compared";
  if (precinctPctWeighted !== null && central !== null) {
    if (precinctPctWeighted >= 99 && central < 95) {
      flag = "PRECINCTS_COMPLETE_BALLOTS_INCOMPLETE";
      explanation = `precincts read ${precinctPctWeighted.toFixed(1)}% complete while the reported votes are ${central.toFixed(1)}% of the forecast's expected total. A precinct count measures places reporting, not ballots counted: ballots still to be counted or added to precincts that already reported are not visible in it.`;
    } else {
      flag = "PRECINCTS_AND_BALLOTS_CONSISTENT";
      explanation = `precincts read ${precinctPctWeighted.toFixed(1)}% and reported votes are ${central.toFixed(1)}% of the expected total; the two do not disagree by enough to flag.`;
    }
  }
  return {
    jurisdictionsWithPrecinctPct: withPct,
    jurisdictionsAtFullPrecincts: atFull,
    precinctPctWeighted,
    reportedVotes: returns.reported.t,
    publishedPctIn: published?.published?.pctIn ?? null,
    estimatedBallotShareCounted: share as Interval | null,
    officialOutstanding: outstanding?.officiallyConfirmedOutstanding.value ?? null,
    modelOutstanding: outstanding?.estimatedOutstanding ?? null,
    gapPoints,
    flag,
    explanation,
  };
}

export function buildReportingProfile(i: ReportingOrderInput): ReportingOrderProfile {
  const stateRecords = i.research.filter((r) => r.state === i.state && PHASE2_TYPES.has(r.recordType));
  const usable = stateRecords.filter((r) => r.provenance.evidenceClass !== "UNKNOWN");

  const timings = Object.fromEntries(TIMING_KINDS.map((k) => [k, [] as TimingEntry[]])) as Record<TimingKind, TimingEntry[]>;
  for (const r of usable) {
    if (r.recordType !== "RELEASE_TIMING") continue;
    const t = r as ReleaseTimingRecord;
    timings[t.timingKind].push({
      kind: t.timingKind, evidenceClass: t.provenance.evidenceClass, localText: t.localText, atUtc: t.atUtc, timeZone: t.timeZone, statuteCite: t.statuteCite,
      sourceUrl: t.provenance.sourceUrl, sourceTier: t.provenance.sourceTier ?? null, recordId: t.recordId, confidence: t.provenance.confidence,
    });
  }

  const practices: PracticeEntry[] = usable
    .filter((r): r is ReportingPracticeRecord => r.recordType === "REPORTING_PRACTICE")
    .map((p) => ({
      kind: p.practiceKind, evidenceClass: p.provenance.evidenceClass, summary: p.summary, statuteCite: p.statuteCite, sourceUrl: p.provenance.sourceUrl,
      sourceTier: p.provenance.sourceTier ?? null, recordId: p.recordId, confidence: p.provenance.confidence,
      ballotCategory: p.ballotCategory, sequenceFact: p.sequenceFact, jurisdictionId: p.jurisdictionId, publishedAt: p.provenance.publishedAt, retrievedAt: p.provenance.retrievedAt, limitations: p.provenance.limitations,
    }));

  // Sequence findings by ballot category. A category with no VERIFIED finding is undocumented, never assumed.
  const byCategory = Object.fromEntries(BALLOT_CATEGORIES.map((c) => [c, [] as PracticeEntry[]])) as Record<BallotCategory, PracticeEntry[]>;
  // The Phase 2 rule kinds each describe one category; a SEQUENCE_FINDING names its own.
  for (const p of practices) {
    const cat = p.kind === "SEQUENCE_FINDING" ? p.ballotCategory : (KIND_CATEGORY[p.kind] ?? null);
    if (cat && p.evidenceClass === "VERIFIED" && p.sequenceFact !== "NOT_STATED_BY_SOURCE") byCategory[cat].push(p);
  }
  const sequence: SequenceCoverage = { byCategory, undocumented: BALLOT_CATEGORIES.filter((c) => c !== "MIXED_OR_UNKNOWN" && !byCategory[c].length) };

  const pollClose: PollCloseEntry[] = i.research
    .filter((r): r is PollCloseRecord => r.state === i.state && r.recordType === "POLL_CLOSE")
    .map((p) => ({ jurisdictionId: p.jurisdictionId, closesAtUtc: p.closesAtUtc, closesLocal: p.closesLocal, timeZoneRule: p.timeZoneRule, evidenceClass: p.provenance.evidenceClass, sourceUrl: p.provenance.sourceUrl, sourceTier: p.provenance.sourceTier ?? null, recordId: p.recordId, notes: p.notes }));

  const relevant = usable.filter((r): r is CandidateByMethodRecord => r.recordType === "CANDIDATE_BY_METHOD" && r.measureKind === "A"
    && r.office === i.office && (i.office === "house" ? sameDistrict(r.contestDistrict, i.district) : r.contestDistrict === null));
  const groups = new Map<string, CandidateByMethodRecord[]>();
  for (const r of relevant) { const k = `${r.contestYear}|${r.office}|${r.contestDistrict ?? ""}`; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const methodEvidence: MethodEvidenceEntry[] = [...groups.values()].map((g) => ({
    year: g[0].contestYear, office: g[0].office, district: g[0].contestDistrict, coverage: g[0].coverage,
    modes: g.map((r) => ({ modeLabel: r.modeLabel, method: r.method, votes: (r.votesA ?? 0) + (r.votesB ?? 0) + (r.votesOther ?? 0), recordId: r.recordId })),
    sourceUrl: g[0].provenance.sourceUrl, confidence: g.some((r) => r.provenance.confidence === "LOW") ? "LOW" : g[0].provenance.confidence,
    limitations: g[0].provenance.limitations,
  })).sort((a, b) => (b.year ?? 0) - (a.year ?? 0));

  const evidenceClasses = { A: methodEvidence.length ? "PRESENT" : "ABSENT", B: i.research.some((r) => r.state === i.state && r.recordType === "METHOD_HISTORY" && r.provenance.evidenceClass === "HISTORICAL") ? "PRESENT" : "ABSENT", C: "ABSENT", D: "ABSENT", E: "ABSENT" } as Record<MeasureKind, "PRESENT" | "ABSENT">;
  evidenceClasses.D = usable.some((r) => r.recordType === "CANDIDATE_BY_METHOD" && r.measureKind === "D") ? "PRESENT" : "ABSENT";

  const missing: string[] = [];
  for (const k of ["OFFICIAL_EXPECTED_RELEASE_TIME", "HISTORICAL_OBSERVED_RELEASE_TIME", "ACTUAL_2026_RELEASE_TIME"] as TimingKind[]) {
    if (!timings[k].length) missing.push(`${k}: no documented value`);
  }
  if (!timings.LEGAL_PROCESSING_TIME.length) missing.push("LEGAL_PROCESSING_TIME: not researched");
  if (!timings.LEGAL_SCANNING_TIME.length) missing.push("LEGAL_SCANNING_TIME: not researched");
  for (const k of ["OUTSTANDING_INVENTORY_SOURCE", "CANVASS_CERTIFICATION", "METHOD_SEPARATION"] as const) if (!practices.some((p) => p.kind === k)) missing.push(`${k}: not verified`);
  for (const c of sequence.undocumented) missing.push(`sequence ${c}: no verified finding for this state`);
  if (!methodEvidence.length) missing.push("candidate votes by method (class A) for this contest: none obtained");
  missing.push("method-adjusted projection: a backtested model over timestamped returns does not exist, so no partisan method adjustment is applied");

  const hasA = methodEvidence.length > 0;
  return {
    state: i.state,
    stateInDataset: stateRecords.length > 0,
    pollClose,
    timings,
    practices,
    sequence,
    methodEvidence,
    evidenceClasses,
    partisanComposition: {
      status: "NOT_APPLIED",
      appliedToProjection: false,
      reason: hasA
        ? "historical candidate votes by method exist as context, but no method model has been backtested against timestamped returns (replay is blocked), so no method adjustment is applied and no method is assumed to favor a party"
        : "no candidate-by-method evidence for this contest; party registration is not vote share and is not used",
    },
    methodOutstanding: {
      status: "UNAVAILABLE",
      reason: hasA
        ? "Outstanding(method, jurisdiction) needs an official count of ballots still to process by method, or a validated model; neither exists for this race"
        : "no method evidence and no official inventory by method",
    },
    precinctVsBallots: precinctVsBallots(i.returns, i.shadow, i.outstanding, i.published),
    missing,
  };
}
