// Research package import and validation.
//
// A research package is the evidence the intelligence layer is allowed to use: poll closing times, historical
// reporting windows, method history, turnout expectations, official outstanding-ballot statements, deadlines and
// county-to-district splits. Packages arrive as JSON or CSV from analysts or AI research tools. Every record must
// carry its provenance; a record that does not is rejected, never repaired with a guessed value.

import Papa from "papaparse";
import { STN } from "../../results/2026/live";
import {
  CONFIDENCE_LEVELS,
  EVIDENCE_CLASSES,
  BALLOT_CATEGORIES,
  JURISDICTION_LEVELS,
  MEASURE_KINDS,
  SEQUENCE_FACTS,
  TIME_ZONE_RULES,
  OUTSTANDING_STATUSES,
  PRACTICE_KINDS,
  RECORD_TYPES,
  SOURCE_TIERS,
  TIMING_KINDS,
  VALUE_KINDS,
  VOTING_METHODS,
  type BallotCategory,
  type CandidateByMethodRecord,
  type Confidence,
  type SequenceFact,
  type TimeZoneRule,
  type EvidenceClass,
  type Issue,
  type JurisdictionLevel,
  type MeasureKind,
  type Office,
  type OutstandingStatus,
  type PracticeKind,
  type Provenance,
  type RecordType,
  type ReportingWindow,
  type ResearchPackageMeta,
  type ResearchRecord,
  type ResearchValidationResult,
  type SourceTier,
  type TimingKind,
  type ValueKind,
  type VotingMethod,
} from "./types";

/** The election these packages describe. A HISTORICAL record must be from an earlier year. */
export const ELECTION_YEAR = 2026;
/** Clock skew allowed on retrieval timestamps before one counts as "in the future". */
const FUTURE_TOLERANCE_MS = 10 * 60 * 1000;
/** Rounding tolerance when weights for one county are summed across districts. */
const WEIGHT_SUM_TOLERANCE = 0.005;

export interface ValidateOptions {
  /** Race ids the records may refer to. A record naming any other id is rejected as unmatched. */
  knownRaceIds: ReadonlySet<string>;
  /** Clock for "retrieved in the future" checks. Defaults to now. */
  now?: Date;
  /** Refuse synthetic packages. The production loader sets this. */
  rejectSynthetic?: boolean;
}

/** Column names for CSV packages. One row per record; columns that do not apply to a record type stay empty. */
export const CSV_COLUMNS = [
  "record_id", "record_type", "race_id", "state", "jurisdiction_id", "jurisdiction_level", "method",
  "evidence_class", "value_kind", "source_url", "source_name", "published_at", "retrieved_at", "historical_year",
  "confidence", "window_label", "window_start_min", "window_end_min", "limitations", "notes",
  "closes_at_utc", "sequence_rank", "share_reported", "votes", "share_of_total",
  "expected_low", "expected_central", "expected_high", "outstanding", "outstanding_status", "as_of",
  "deadline_kind", "deadline_utc", "county_fips", "district_id", "weight", "weight_basis",
  "source_tier", "timing_kind", "local_text", "at_utc", "time_zone", "statute_cite", "practice_kind", "summary",
  "measure_kind", "contest_year", "office", "contest_district", "mode_label", "votes_a", "votes_b", "votes_other",
  "methodology", "uncertainty", "coverage",
  "closes_local", "time_zone_rule", "ballot_category", "sequence_fact",
] as const;

type Row = Record<string, unknown>;

// ---- field readers: each returns the parsed value or pushes an issue ---------------------------------------------

const blank = (v: unknown) => v === undefined || v === null || (typeof v === "string" && v.trim() === "");
const str = (v: unknown): string | null => (blank(v) ? null : String(v).trim());

class RowReader {
  issues: Issue[] = [];
  private row: Row;
  private rowNo: number | null;
  private recordId: string | null;
  constructor(row: Row, rowNo: number | null, recordId: string | null) {
    this.row = row; this.rowNo = rowNo; this.recordId = recordId;
  }
  private err(field: string, code: string, message: string) {
    this.issues.push({ code, severity: "ERROR", message, field, row: this.rowNo, recordId: this.recordId });
  }
  warn(field: string | null, code: string, message: string) {
    this.issues.push({ code, severity: "WARNING", message, field, row: this.rowNo, recordId: this.recordId });
  }
  error(field: string | null, code: string, message: string) {
    this.issues.push({ code, severity: "ERROR", message, field, row: this.rowNo, recordId: this.recordId });
  }
  get(field: string) { return this.row[field]; }
  text(field: string, required = false): string | null {
    const s = str(this.row[field]);
    if (required && s === null) this.err(field, "MISSING_FIELD", `${field} is required`);
    return s;
  }
  oneOf<T extends string>(field: string, allowed: readonly T[], required = true): T | null {
    const s = str(this.row[field]);
    if (s === null) { if (required) this.err(field, "MISSING_FIELD", `${field} is required`); return null; }
    const up = s.toUpperCase();
    if (!(allowed as readonly string[]).includes(up)) { this.err(field, "INVALID_ENUM", `${field} "${s}" is not one of ${allowed.join(", ")}`); return null; }
    return up as T;
  }
  num(field: string, opts: { min?: number; max?: number; integer?: boolean } = {}): number | null {
    const v = this.row[field];
    if (blank(v)) return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(/,/g, "").trim());
    if (!Number.isFinite(n)) { this.err(field, "INVALID_NUMBER", `${field} "${String(v)}" is not a finite number`); return null; }
    if (opts.integer && !Number.isInteger(n)) { this.err(field, "INVALID_NUMBER", `${field} must be a whole number`); return null; }
    if (opts.min !== undefined && n < opts.min) { this.err(field, "OUT_OF_RANGE", `${field} ${n} is below ${opts.min}`); return null; }
    if (opts.max !== undefined && n > opts.max) { this.err(field, "OUT_OF_RANGE", `${field} ${n} is above ${opts.max}`); return null; }
    return n;
  }
  date(field: string, required = false): string | null {
    const s = str(this.row[field]);
    if (s === null) { if (required) this.err(field, "MISSING_FIELD", `${field} is required`); return null; }
    if (!/^\d{4}-\d{2}-\d{2}/.test(s) || !Number.isFinite(Date.parse(s))) { this.err(field, "INVALID_DATE", `${field} "${s}" is not an ISO 8601 date`); return null; }
    return s;
  }
  list(field: string): string[] {
    const v = this.row[field];
    if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
    const s = str(v);
    return s ? s.split(";").map((x) => x.trim()).filter(Boolean) : [];
  }
}

/** Accept camelCase JSON keys as well as the snake_case CSV columns. */
function normalizeKeys(o: Row): Row {
  const out: Row = {};
  for (const [k, v] of Object.entries(o)) out[k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase())] = v;
  // nested JSON forms
  const prov = o.provenance as Row | undefined;
  if (prov && typeof prov === "object") for (const [k, v] of Object.entries(normalizeKeys(prov))) if (!(k in out) || blank(out[k])) out[k] = v;
  const win = o.reportingWindow as Row | undefined;
  if (win && typeof win === "object") {
    out.window_label ??= win.label;
    out.window_start_min ??= win.startMinAfterClose;
    out.window_end_min ??= win.endMinAfterClose;
  }
  return out;
}

const isHttpUrl = (s: string) => { try { const u = new URL(s); return u.protocol === "https:" || u.protocol === "http:"; } catch { return false; } };

// ---- one record ---------------------------------------------------------------------------------------------------

function readRecord(input: Row, rowNo: number | null, meta: ResearchPackageMeta, opts: ValidateOptions): { record: ResearchRecord | null; issues: Issue[]; raceIdUnmatched: string | null } {
  const row = normalizeKeys(input);
  const recordId = str(row.record_id);
  const r = new RowReader(row, rowNo, recordId);
  if (!recordId) r.error("record_id", "MISSING_FIELD", "record_id is required");
  const now = (opts.now ?? new Date()).getTime();

  const recordType = r.oneOf<RecordType>("record_type", RECORD_TYPES);
  const raceId = r.text("race_id");
  let raceIdUnmatched: string | null = null;
  if (raceId && !opts.knownRaceIds.has(raceId)) {
    r.error("race_id", "UNMATCHED_RACE_ID", `race_id "${raceId}" is not a race in the forecast baseline`);
    raceIdUnmatched = raceId;
  }
  const state = r.text("state", true)?.toUpperCase() ?? null;
  if (state && !STN[state]) r.error("state", "INVALID_STATE", `state "${state}" is not a US state code`);
  if (state && raceId && /^(sen|gov|house)-/.test(raceId) && raceId.split("-")[1] !== state) r.error("state", "CONTRADICTORY_METADATA", `race_id ${raceId} is not in state ${state}`);
  const jurisdictionId = r.text("jurisdiction_id", true);
  const jurisdictionLevel = r.oneOf<JurisdictionLevel>("jurisdiction_level", JURISDICTION_LEVELS);
  if (jurisdictionLevel === "COUNTY" && jurisdictionId && !/^\d{5}$/.test(jurisdictionId)) r.error("jurisdiction_id", "INVALID_FIPS", `county jurisdiction_id "${jurisdictionId}" is not a five digit FIPS code`);
  if (jurisdictionLevel === "STATE" && jurisdictionId && jurisdictionId !== "STATE") r.error("jurisdiction_id", "CONTRADICTORY_METADATA", `a STATE level record must use jurisdiction_id "STATE"`);
  const method = r.oneOf<VotingMethod>("method", VOTING_METHODS, false);

  // provenance
  const evidenceClass = r.oneOf<EvidenceClass>("evidence_class", EVIDENCE_CLASSES);
  const valueKind = r.oneOf<ValueKind>("value_kind", VALUE_KINDS);
  const confidence = r.oneOf<Confidence>("confidence", CONFIDENCE_LEVELS);
  const sourceUrl = r.text("source_url");
  if (sourceUrl && !isHttpUrl(sourceUrl)) r.error("source_url", "INVALID_URL", `source_url "${sourceUrl}" is not an http(s) URL`);
  const sourceName = r.text("source_name");
  const sourceTier = r.oneOf<SourceTier>("source_tier", SOURCE_TIERS, false);
  const publishedAt = r.date("published_at");
  const retrievedAt = r.date("retrieved_at");
  const historicalYear = r.num("historical_year", { integer: true, min: 1900, max: ELECTION_YEAR });
  const limitations = r.list("limitations");
  const notes = r.text("notes");

  if (retrievedAt && Date.parse(retrievedAt) > now + FUTURE_TOLERANCE_MS) r.error("retrieved_at", "FUTURE_TIMESTAMP", `retrieved_at ${retrievedAt} is in the future`);
  if (publishedAt && retrievedAt && Date.parse(publishedAt) > Date.parse(retrievedAt) + FUTURE_TOLERANCE_MS) r.error("published_at", "CONTRADICTORY_METADATA", "published_at is after retrieved_at");

  if (evidenceClass === "VERIFIED" || evidenceClass === "HISTORICAL") {
    if (!sourceUrl) r.error("source_url", "MISSING_PROVENANCE", `${evidenceClass} records need a source_url`);
    if (!retrievedAt) r.error("retrieved_at", "MISSING_PROVENANCE", `${evidenceClass} records need a retrieved_at timestamp`);
    if (!publishedAt) r.warn("published_at", "MISSING_PUBLICATION_DATE", "no publication date; the source's currency cannot be checked");
  }
  if (evidenceClass === "HISTORICAL") {
    if (historicalYear === null) r.error("historical_year", "MISSING_PROVENANCE", "HISTORICAL records need historical_year");
    else if (historicalYear >= ELECTION_YEAR) r.error("historical_year", "CONTRADICTORY_METADATA", `HISTORICAL records must describe an election before ${ELECTION_YEAR}`);
    if (valueKind === "ESTIMATE") r.error("value_kind", "CONTRADICTORY_METADATA", "HISTORICAL records are observations of a past election; an estimate is INFERRED");
  }
  if (evidenceClass === "VERIFIED" && historicalYear !== null && historicalYear !== ELECTION_YEAR) {
    r.error("historical_year", "CONTRADICTORY_METADATA", `VERIFIED means current-election evidence; a ${historicalYear} value is HISTORICAL`);
  }
  if (evidenceClass === "INFERRED") {
    if (valueKind === "OBSERVATION") r.error("value_kind", "CONTRADICTORY_METADATA", "INFERRED values are estimates, not observations");
    if (!limitations.length && !notes) r.error("limitations", "MISSING_BASIS", "INFERRED records must state their basis in notes or limitations");
  }
  if (evidenceClass === "UNKNOWN" && confidence && confidence !== "NONE") r.error("confidence", "CONTRADICTORY_METADATA", "UNKNOWN records carry confidence NONE");

  const windowLabel = r.text("window_label");
  const ws = r.num("window_start_min"), we = r.num("window_end_min");
  if (ws !== null && we !== null && we < ws) r.error("window_end_min", "OUT_OF_RANGE", "window_end_min is before window_start_min");
  const reportingWindow: ReportingWindow | null = windowLabel || ws !== null || we !== null ? { label: windowLabel, startMinAfterClose: ws, endMinAfterClose: we } : null;

  // A secondary summary or a research compilation can be VERIFIED or HISTORICAL but never better than MEDIUM.
  let cappedConfidence = confidence;
  if (sourceTier && sourceTier !== "PRIMARY_OFFICIAL" && confidence === "HIGH") {
    cappedConfidence = "MEDIUM";
    r.warn("confidence", "CONFIDENCE_CAPPED", `${sourceTier} sources are capped at MEDIUM confidence`);
  }
  const provenance: Provenance | null = evidenceClass && valueKind && cappedConfidence
    ? { sourceTier, evidenceClass, valueKind, sourceUrl, sourceName, publishedAt, retrievedAt, historicalYear, confidence: cappedConfidence, limitations }
    : null;
  const isPhase2 = recordType === "RELEASE_TIMING" || recordType === "REPORTING_PRACTICE" || recordType === "CANDIDATE_BY_METHOD";
  if (isPhase2 && !sourceTier) r.error("source_tier", "MISSING_PROVENANCE", `${recordType} records need a source_tier`);

  // type specific payloads
  const base = { recordId: recordId ?? "", raceId, state: state ?? "", jurisdictionId: jurisdictionId ?? "", jurisdictionLevel: jurisdictionLevel ?? "STATE", method, reportingWindow, notes, packageId: meta.packageId, synthetic: meta.synthetic };
  let record: ResearchRecord | null = null;
  const values: (number | string | null)[] = [];
  switch (recordType) {
    case "POLL_CLOSE": {
      const closesAtUtc = r.date("closes_at_utc");
      const closesLocal = r.text("closes_local");
      const timeZoneRule = r.oneOf<TimeZoneRule>("time_zone_rule", TIME_ZONE_RULES, false);
      values.push(closesAtUtc, closesLocal);
      if (closesLocal && !/^([01]\d|2[0-3]):[0-5]\d$/.test(closesLocal)) r.error("closes_local", "INVALID_FIELD", `closes_local "${closesLocal}" must be a 24-hour HH:MM clock time`);
      if (timeZoneRule === "PER_COUNTY_LOCAL") {
        // The law gives a local clock time and the instant differs by county time zone. One statewide instant would be wrong for some counties.
        if (closesAtUtc) r.error("closes_at_utc", "NO_STATEWIDE_INSTANT", "a per-county local closing time has no single statewide UTC instant; closes_at_utc must be empty");
        if (evidenceClass !== "UNKNOWN" && !closesLocal) r.error("closes_local", "MISSING_FIELD", "a per-county local closing time needs closes_local");
      } else if (evidenceClass !== "UNKNOWN" && !closesAtUtc) r.error("closes_at_utc", "MISSING_FIELD", "closes_at_utc is required");
      if (closesLocal && timeZoneRule !== "PER_COUNTY_LOCAL" && !closesAtUtc) r.error("closes_at_utc", "MISSING_FIELD", "closes_local without time_zone_rule PER_COUNTY_LOCAL needs closes_at_utc");
      if (closesAtUtc && !closesAtUtc.startsWith(`${ELECTION_YEAR}-`)) r.warn("closes_at_utc", "NOT_APPLICABLE_2026", `poll close ${closesAtUtc} is not in ${ELECTION_YEAR}; it will not be used as a ${ELECTION_YEAR} closing time`);
      if (evidenceClass === "HISTORICAL") r.warn("evidence_class", "NOT_APPLICABLE_2026", "a historical poll closing time is not evidence of the 2026 closing time");
      if (provenance) record = { ...base, recordType, provenance, closesAtUtc, closesLocal, timeZoneRule };
      break;
    }
    case "REPORTING_WINDOW": {
      const sequenceRank = r.num("sequence_rank", { integer: true, min: 1 });
      const shareReported = r.num("share_reported", { min: 0, max: 1 });
      values.push(sequenceRank, shareReported, ws, we);
      if (!reportingWindow && evidenceClass !== "UNKNOWN") r.error("window_label", "MISSING_FIELD", "REPORTING_WINDOW records need a window label or start and end minutes");
      if (evidenceClass === "INFERRED") r.warn("evidence_class", "NOT_A_SCHEDULE", "an inferred reporting window is a hypothesis; it is shown as context and never as a 2026 schedule");
      if (provenance) record = { ...base, recordType, provenance, sequenceRank, shareReported };
      break;
    }
    case "METHOD_HISTORY": {
      const votes = r.num("votes", { integer: true, min: 0 });
      const shareOfTotal = r.num("share_of_total", { min: 0, max: 1 });
      values.push(votes, shareOfTotal);
      if (!method) r.error("method", "MISSING_FIELD", "METHOD_HISTORY records need a method");
      if (evidenceClass !== "UNKNOWN" && votes === null && shareOfTotal === null) r.error("votes", "MISSING_FIELD", "METHOD_HISTORY needs votes or share_of_total");
      if (provenance) record = { ...base, recordType, provenance, votes, shareOfTotal };
      break;
    }
    case "TURNOUT_EXPECTATION": {
      const expectedLow = r.num("expected_low", { min: 0 }), expectedCentral = r.num("expected_central", { min: 0 }), expectedHigh = r.num("expected_high", { min: 0 });
      values.push(expectedLow, expectedCentral, expectedHigh);
      if (evidenceClass !== "UNKNOWN" && (expectedLow === null || expectedHigh === null)) r.error("expected_low", "MISSING_FIELD", "TURNOUT_EXPECTATION needs expected_low and expected_high; a single number has no stated uncertainty");
      if (expectedLow !== null && expectedHigh !== null && expectedLow > expectedHigh) r.error("expected_high", "OUT_OF_RANGE", "expected_low is above expected_high");
      if (expectedCentral !== null && ((expectedLow !== null && expectedCentral < expectedLow) || (expectedHigh !== null && expectedCentral > expectedHigh))) r.error("expected_central", "OUT_OF_RANGE", "expected_central is outside expected_low..expected_high");
      if (evidenceClass === "HISTORICAL") r.error("evidence_class", "CONTRADICTORY_METADATA", "a past election's turnout is METHOD_HISTORY, not a 2026 expectation");
      if (provenance) record = { ...base, recordType, provenance, expectedLow, expectedCentral, expectedHigh };
      break;
    }
    case "OUTSTANDING_REPORT": {
      const outstanding = r.num("outstanding", { integer: true, min: 0 });
      const outstandingStatus = r.oneOf<OutstandingStatus>("outstanding_status", OUTSTANDING_STATUSES);
      const asOf = r.date("as_of", evidenceClass !== "UNKNOWN");
      values.push(outstanding);
      if (evidenceClass !== "UNKNOWN" && evidenceClass !== "VERIFIED") r.error("evidence_class", "CONTRADICTORY_METADATA", "an outstanding-ballot report is an official statement; it must be VERIFIED (or UNKNOWN)");
      if (evidenceClass === "VERIFIED" && outstanding === null) r.error("outstanding", "MISSING_FIELD", "outstanding is required");
      if (provenance && outstandingStatus) record = { ...base, recordType, provenance, outstanding, outstandingStatus, asOf };
      break;
    }
    case "BALLOT_DEADLINE": {
      const deadlineKind = r.text("deadline_kind", true);
      const deadlineUtc = r.date("deadline_utc");
      values.push(deadlineUtc);
      if (evidenceClass === "VERIFIED" && !deadlineUtc) r.error("deadline_utc", "MISSING_FIELD", "deadline_utc is required");
      if (provenance) record = { ...base, recordType, provenance, deadlineKind, deadlineUtc };
      break;
    }
    case "RELEASE_TIMING": {
      const timingKind = r.oneOf<TimingKind>("timing_kind", TIMING_KINDS);
      const localText = r.text("local_text");
      const atUtc = r.date("at_utc");
      const timeZone = r.text("time_zone");
      const statuteCite = r.text("statute_cite");
      values.push(localText, atUtc);
      if (evidenceClass === "INFERRED") r.error("evidence_class", "TIMING_NOT_INFERRED", "a timing is documented or unknown; it is never inferred from another timing or from practice");
      if (timingKind === "HISTORICAL_OBSERVED_RELEASE_TIME") {
        if (evidenceClass && evidenceClass !== "HISTORICAL" && evidenceClass !== "UNKNOWN") r.error("evidence_class", "TIMING_KIND_MISMATCH", "an observed past release is HISTORICAL; a 2026 statement is a different timing kind");
      } else if (timingKind && evidenceClass === "HISTORICAL") {
        r.error("evidence_class", "TIMING_KIND_MISMATCH", `${timingKind} describes 2026; a past election's timing is HISTORICAL_OBSERVED_RELEASE_TIME`);
      }
      if (evidenceClass !== "UNKNOWN" && !localText && !atUtc) r.error("local_text", "MISSING_FIELD", "a timing needs local_text or at_utc");
      if (atUtc && !timeZone) r.error("time_zone", "MISSING_FIELD", "an exact timing needs the source's time zone");
      if (timingKind === "ACTUAL_2026_RELEASE_TIME") {
        if (evidenceClass !== "UNKNOWN" && !atUtc) r.error("at_utc", "MISSING_FIELD", "an actual 2026 release needs the observed instant (at_utc)");
        if (atUtc && !atUtc.startsWith(`${ELECTION_YEAR}-`)) r.error("at_utc", "CONTRADICTORY_METADATA", `an actual ${ELECTION_YEAR} release must be in ${ELECTION_YEAR}`);
        if (atUtc && Date.parse(atUtc) > now + FUTURE_TOLERANCE_MS) r.error("at_utc", "FUTURE_TIMESTAMP", "an actual release cannot be in the future");
      }
      if (timingKind === "OFFICIAL_EXPECTED_RELEASE_TIME" && atUtc && sourceTier !== "PRIMARY_OFFICIAL") r.error("source_tier", "NOT_AN_AUTHORITY", "an exact expected release time must come from the election authority itself");
      if (timingKind === "HISTORICAL_OBSERVED_RELEASE_TIME" && evidenceClass === "HISTORICAL" && !atUtc && !localText) r.error("at_utc", "MISSING_FIELD", "a historical observation needs a timestamp or description");
      if (provenance && timingKind) record = { ...base, recordType, provenance, timingKind, localText, atUtc, timeZone, statuteCite };
      break;
    }
    case "REPORTING_PRACTICE": {
      const practiceKind = r.oneOf<PracticeKind>("practice_kind", PRACTICE_KINDS);
      const summary = r.text("summary");
      const statuteCite = r.text("statute_cite");
      const ballotCategory = r.oneOf<BallotCategory>("ballot_category", BALLOT_CATEGORIES, false);
      const sequenceFact = r.oneOf<SequenceFact>("sequence_fact", SEQUENCE_FACTS, false);
      values.push(summary);
      if (practiceKind === "SEQUENCE_FINDING") {
        if (!ballotCategory) r.error("ballot_category", "MISSING_FIELD", "a sequence finding names the ballot category it describes (MIXED_OR_UNKNOWN when the source does not separate them)");
        if (!sequenceFact) r.error("sequence_fact", "MISSING_FIELD", "a sequence finding names the kind of fact it states");
        if (!limitations.length) r.error("limitations", "MISSING_LIMITATION", "a sequence finding must state at least one limitation");
        if (evidenceClass === "VERIFIED" && !sourceUrl) r.error("source_url", "MISSING_PROVENANCE", "a verified sequence finding links its source");
        if (evidenceClass === "VERIFIED" && !retrievedAt && !publishedAt) r.error("retrieved_at", "MISSING_PROVENANCE", "a verified sequence finding carries a date");
      } else if (ballotCategory || sequenceFact) {
        r.error("ballot_category", "CONTRADICTORY_METADATA", "ballot_category and sequence_fact belong to SEQUENCE_FINDING records only");
      }
      if (evidenceClass && evidenceClass !== "VERIFIED" && evidenceClass !== "UNKNOWN") r.error("evidence_class", "CONTRADICTORY_METADATA", "a reporting practice is a rule or procedure: VERIFIED or UNKNOWN");
      if (evidenceClass !== "UNKNOWN" && !summary) r.error("summary", "MISSING_FIELD", "summary is required");
      if (practiceKind === "OUTSTANDING_INVENTORY_SOURCE" && evidenceClass === "VERIFIED" && !sourceUrl) r.error("source_url", "MISSING_PROVENANCE", "an inventory source must link to the inventory");
      if (provenance && practiceKind) record = { ...base, recordType, provenance, practiceKind, summary, statuteCite, ballotCategory, sequenceFact };
      break;
    }
    case "CANDIDATE_BY_METHOD": {
      const measureKind = r.oneOf<MeasureKind>("measure_kind", MEASURE_KINDS);
      const contestYear = r.num("contest_year", { integer: true, min: 1900, max: ELECTION_YEAR });
      const officeUp = r.oneOf<"SENATE" | "GOVERNOR" | "HOUSE">("office", ["SENATE", "GOVERNOR", "HOUSE"] as const, false);
      const office: Office | null = officeUp ? (officeUp.toLowerCase() as Office) : null;
      const contestDistrict = r.text("contest_district");
      const modeLabel = r.text("mode_label");
      const votesA = r.num("votes_a", { integer: true, min: 0 }), votesB = r.num("votes_b", { integer: true, min: 0 }), votesOther = r.num("votes_other", { integer: true, min: 0 });
      const methodology = r.text("methodology");
      const uncertainty = r.text("uncertainty");
      const coverage = r.oneOf<NonNullable<CandidateByMethodRecord["coverage"]>>("coverage", ["RECONCILED", "AMBIGUOUS", "NO_TOTAL"] as const, false);
      values.push(votesA, votesB, votesOther);
      const anyVotes = votesA !== null || votesB !== null || votesOther !== null;
      if (measureKind === "C") r.error("measure_kind", "REGISTRATION_IS_NOT_VOTE_SHARE", "party registration is not vote share and cannot be recorded as candidate votes by method");
      if (measureKind === "B") r.error("measure_kind", "USE_METHOD_HISTORY", "official ballot counts by method with no candidate split belong in METHOD_HISTORY");
      if (measureKind === "A") {
        if (evidenceClass !== "HISTORICAL") r.error("evidence_class", "CONTRADICTORY_METADATA", "actual candidate votes by method from a past election are HISTORICAL");
        if (contestYear === null) r.error("contest_year", "MISSING_FIELD", "contest_year is required");
        else if (historicalYear !== null && historicalYear !== contestYear) r.error("contest_year", "CONTRADICTORY_METADATA", "contest_year and historical_year disagree");
        if (!office) r.error("office", "MISSING_FIELD", "office is required");
        if (!modeLabel) r.error("mode_label", "MISSING_FIELD", "mode_label is required: the source's own label for the method");
        if (votesA === null || votesB === null || votesOther === null) r.error("votes_a", "MISSING_FIELD", "class A needs votes_a, votes_b and votes_other: actual candidate votes");
        if (!coverage) r.error("coverage", "MISSING_FIELD", "coverage is required: whether the method rows cover the contest");
        if (office === "house" && !contestDistrict) r.error("contest_district", "MISSING_FIELD", "a House contest needs contest_district");
      }
      if (measureKind === "D") {
        if (evidenceClass !== "INFERRED") r.error("evidence_class", "CONTRADICTORY_METADATA", "a statistical estimate is INFERRED");
        if (!methodology) r.error("methodology", "MISSING_BASIS", "a class D estimate needs its methodology");
        if (!uncertainty) r.error("uncertainty", "MISSING_BASIS", "a class D estimate needs its stated uncertainty");
      }
      if (measureKind === "E" && (evidenceClass !== "UNKNOWN" || anyVotes)) r.error("measure_kind", "CONTRADICTORY_METADATA", "class E is UNKNOWN and carries no values");
      if (provenance && measureKind) record = { ...base, recordType, provenance, measureKind, contestYear, office, contestDistrict, modeLabel, votesA, votesB, votesOther, methodology, uncertainty, coverage };
      break;
    }
    case "GEO_SPLIT": {
      const countyFips = r.text("county_fips", true);
      const districtId = r.text("district_id", true)?.toUpperCase() ?? null;
      const weight = r.num("weight", { min: 0, max: 1 });
      const weightBasis = r.text("weight_basis");
      values.push(weight);
      if (countyFips && !/^\d{5}$/.test(countyFips)) r.error("county_fips", "INVALID_FIPS", `county_fips "${countyFips}" is not a five digit FIPS code`);
      if (districtId && !/^[A-Z]{2}-\d{2}$/.test(districtId)) r.error("district_id", "INVALID_DISTRICT", `district_id "${districtId}" should look like PA-07 (an at-large seat is 01, e.g. WY-01)`);
      if (evidenceClass !== "UNKNOWN" && weight === null) r.error("weight", "MISSING_FIELD", "weight is required");
      if (weight !== null && !weightBasis) r.error("weight_basis", "MISSING_BASIS", "a split weight must say what it measures (weight_basis)");
      if (weight === 0) r.warn("weight", "ZERO_WEIGHT", "a zero weight says the county is not in the district; omit the row instead");
      if (provenance && countyFips && districtId) record = { ...base, recordType, provenance, countyFips, districtId, weight, weightBasis };
      break;
    }
  }
  if (evidenceClass === "UNKNOWN" && values.some((v) => v !== null)) r.error(null, "UNKNOWN_HAS_VALUE", "an UNKNOWN record must not carry a value");
  if (meta.synthetic) r.issues.push({ code: "SYNTHETIC", severity: "INFO", message: "synthetic fixture, not research", recordId, row: rowNo });

  const hasError = r.issues.some((i) => i.severity === "ERROR");
  return { record: hasError ? null : record, issues: r.issues, raceIdUnmatched };
}

// ---- packages -----------------------------------------------------------------------------------------------------

export function validateMeta(m: unknown): { meta: ResearchPackageMeta | null; issues: Issue[] } {
  const issues: Issue[] = [];
  const o = (m && typeof m === "object" ? m : {}) as Row;
  const packageId = str(o.packageId ?? o.package_id);
  const producer = str(o.producer);
  const createdAt = str(o.createdAt ?? o.created_at);
  if (!packageId) issues.push({ code: "MISSING_FIELD", severity: "ERROR", message: "package meta needs packageId", field: "packageId" });
  if (!producer) issues.push({ code: "MISSING_FIELD", severity: "ERROR", message: "package meta needs producer", field: "producer" });
  if (!createdAt || !Number.isFinite(Date.parse(createdAt))) issues.push({ code: "INVALID_DATE", severity: "ERROR", message: "package meta needs an ISO createdAt", field: "createdAt" });
  const synthetic = o.synthetic === true || String(o.synthetic).toLowerCase() === "true";
  const baselineSnapshot = str(o.baselineSnapshot ?? o.baseline_snapshot);
  if (issues.length) return { meta: null, issues };
  return { meta: { packageId: packageId!, producer: producer!, createdAt: createdAt!, synthetic, baselineSnapshot }, issues };
}

function finish(meta: ResearchPackageMeta, rows: Row[], opts: ValidateOptions, firstRow: number | null, extra: Issue[] = []): ResearchValidationResult {
  const issues: Issue[] = [...extra];
  if (opts.rejectSynthetic && meta.synthetic) {
    issues.push({ code: "SYNTHETIC_REFUSED", severity: "ERROR", message: `package ${meta.packageId} is synthetic and cannot be loaded as research` });
    return { meta, accepted: [], rejected: [], issues, unmatchedRaceIds: [] };
  }
  if (meta.baselineSnapshot && meta.baselineSnapshot !== "2026-10-25") {
    issues.push({ code: "BASELINE_MISMATCH", severity: "WARNING", message: `package was researched against the ${meta.baselineSnapshot} snapshot, not 2026-10-25` });
  }
  const accepted: ResearchRecord[] = [];
  const rejected: ResearchValidationResult["rejected"] = [];
  const unmatched = new Set<string>();
  const seen = new Set<string>();
  rows.forEach((row, i) => {
    const rowNo = firstRow === null ? null : firstRow + i;
    const { record, issues: ri, raceIdUnmatched } = readRecord(row, rowNo, meta, opts);
    if (raceIdUnmatched) unmatched.add(raceIdUnmatched);
    if (record && seen.has(record.recordId)) {
      rejected.push({ row: rowNo, recordId: record.recordId, issues: [...ri, { code: "DUPLICATE_RECORD_ID", severity: "ERROR", message: `record_id ${record.recordId} appears more than once`, row: rowNo, recordId: record.recordId }] });
      return;
    }
    if (record) { seen.add(record.recordId); accepted.push(record); issues.push(...ri.filter((x) => x.severity !== "ERROR")); }
    else rejected.push({ row: rowNo, recordId: str(normalizeKeys(row).record_id), issues: ri });
  });
  issues.push(...checkGeoSplitSums(accepted));
  return { meta, accepted, rejected, issues, unmatchedRaceIds: [...unmatched].sort() };
}

/** Weights for one county must not add to more than the whole county. */
export function checkGeoSplitSums(records: ResearchRecord[]): Issue[] {
  const byCounty = new Map<string, { sum: number; ids: string[] }>();
  for (const r of records) {
    if (r.recordType !== "GEO_SPLIT" || r.weight === null) continue;
    const key = `${r.countyFips}|${r.provenance.historicalYear ?? ""}|${r.weightBasis ?? ""}`;
    const e = byCounty.get(key) ?? { sum: 0, ids: [] };
    e.sum += r.weight; e.ids.push(r.recordId); byCounty.set(key, e);
  }
  const out: Issue[] = [];
  for (const [key, e] of byCounty) if (e.sum > 1 + WEIGHT_SUM_TOLERANCE) {
    out.push({ code: "GEO_SPLIT_OVERALLOCATED", severity: "ERROR", message: `district weights for county ${key.split("|")[0]} add to ${e.sum.toFixed(3)}, more than the whole county (records ${e.ids.join(", ")}); the splits are excluded`, recordId: e.ids[0] });
  }
  return out;
}

/** A contradictory county split is excluded wholesale: no record of that county is trusted. */
export function excludeContradictorySplits(result: ResearchValidationResult): ResearchValidationResult {
  const bad = new Set(result.issues.filter((i) => i.code === "GEO_SPLIT_OVERALLOCATED" && i.recordId).map((i) => i.recordId as string));
  if (!bad.size) return result;
  const badCounties = new Set(result.accepted.filter((r) => r.recordType === "GEO_SPLIT" && bad.has(r.recordId)).map((r) => (r.recordType === "GEO_SPLIT" ? r.countyFips : "")));
  const keep: ResearchRecord[] = [], drop: ResearchRecord[] = [];
  for (const r of result.accepted) (r.recordType === "GEO_SPLIT" && badCounties.has(r.countyFips) ? drop : keep).push(r);
  return {
    ...result,
    accepted: keep,
    rejected: [...result.rejected, ...drop.map((r) => ({ row: null, recordId: r.recordId, issues: [{ code: "GEO_SPLIT_OVERALLOCATED", severity: "ERROR" as const, message: `county ${r.recordType === "GEO_SPLIT" ? r.countyFips : ""} splits contradict each other`, recordId: r.recordId }] }))],
  };
}

/** A JSON package: { meta: {...}, records: [...] } or { packageId, producer, createdAt, synthetic, records }. */
export function importJsonPackage(text: string, opts: ValidateOptions): ResearchValidationResult {
  let j: unknown;
  try { j = JSON.parse(text); } catch (e) {
    return { meta: null, accepted: [], rejected: [], issues: [{ code: "PARSE_ERROR", severity: "ERROR", message: `not valid JSON: ${(e as Error).message}` }], unmatchedRaceIds: [] };
  }
  const o = (j && typeof j === "object" ? j : {}) as Row;
  const { meta, issues } = validateMeta(o.meta ?? o);
  if (!meta) return { meta: null, accepted: [], rejected: [], issues, unmatchedRaceIds: [] };
  if (!Array.isArray(o.records)) return { meta, accepted: [], rejected: [], issues: [{ code: "MISSING_FIELD", severity: "ERROR", message: "package has no records array" }], unmatchedRaceIds: [] };
  return excludeContradictorySplits(finish(meta, o.records as Row[], opts, 0));
}

/** A CSV package: one record per row, with package metadata supplied separately (a sidecar .meta.json). */
export function importCsvPackage(text: string, metaInput: unknown, opts: ValidateOptions): ResearchValidationResult {
  const { meta, issues } = validateMeta(metaInput);
  if (!meta) return { meta: null, accepted: [], rejected: [], issues, unmatchedRaceIds: [] };
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: "greedy", transformHeader: (h) => h.trim().toLowerCase() });
  const extra: Issue[] = parsed.errors.map((e) => ({ code: "PARSE_ERROR", severity: "ERROR" as const, message: e.message, row: e.row === undefined ? null : e.row + 2 }));
  const cols = new Set(parsed.meta.fields ?? []);
  for (const need of ["record_id", "record_type", "state", "jurisdiction_id", "jurisdiction_level", "evidence_class", "value_kind", "confidence"]) {
    if (!cols.has(need)) extra.push({ code: "MISSING_COLUMN", severity: "ERROR", message: `CSV has no ${need} column`, field: need });
  }
  const unknownCols = [...cols].filter((c) => !(CSV_COLUMNS as readonly string[]).includes(c));
  if (unknownCols.length) extra.push({ code: "UNKNOWN_COLUMN", severity: "WARNING", message: `columns ignored: ${unknownCols.join(", ")}` });
  if (extra.some((i) => i.code === "MISSING_COLUMN")) return { meta, accepted: [], rejected: [], issues: extra, unmatchedRaceIds: [] };
  // row numbers are spreadsheet rows: the header is row 1
  return excludeContradictorySplits(finish(meta, parsed.data, opts, 2, extra));
}

/** Merge validated packages into one evidence set. A record id repeated across packages keeps the first and reports the rest. */
export function mergePackages(results: ResearchValidationResult[]): { records: ResearchRecord[]; issues: Issue[]; synthetic: boolean } {
  const records: ResearchRecord[] = [], issues: Issue[] = [];
  const seen = new Map<string, string>();
  for (const res of results) for (const r of res.accepted) {
    const prev = seen.get(r.recordId);
    if (prev) { issues.push({ code: "DUPLICATE_RECORD_ID", severity: "WARNING", message: `record ${r.recordId} in ${r.packageId} repeats one from ${prev}; the first is kept`, recordId: r.recordId }); continue; }
    seen.set(r.recordId, r.packageId); records.push(r);
  }
  return { records, issues, synthetic: records.some((r) => r.synthetic) };
}

/** Records that apply to a race: those naming it, plus jurisdiction-wide records for its state. */
export function recordsForRace(records: ResearchRecord[], raceId: string, state: string): ResearchRecord[] {
  return records.filter((r) => r.raceId === raceId || (r.raceId === null && r.state === state));
}
