// Evidence capture ("flight recorder v2") for the intelligence layer.
//
// Purpose: keep what the source actually said, and when we saw it, so a post-election replay can reconstruct what was
// knowable on the night. Separate from the public timeline recorder (app/results/_lib/flightRecorder.ts), whose shape
// and behaviour are unchanged. Nothing here feeds a published number.
//
// Two layers on one ObjectStore (see captureStore.ts):
//   RAW         raw/<sha256>.gz                          the response exactly as received, gzipped, named by its sha256
//   NORMALIZED  obs/<raceId>/<observedAt>_<id>.json      one record per observed change, pointing at its raw object
//               feed/<type>/<observedAt>_<id>.json       the rows of a whole-feed response that changed
//               runs/<date>/<startedAt>_<runId>.json     heartbeat and failure record of each poll, apart from results
//               heads/...                                rebuildable pointers and counters (the only overwritten objects)
//
// Guarantees
//  - Idempotent: an observation's key is its race, observation time and content. A retried write finds its own object.
//    A poll that reads what is already recorded writes nothing.
//  - Append-only: material differences are both kept, including corrections that lower a total. Corrected, out-of-order
//    and revised-down are derived when reading, never stored, so a late arrival cannot alter an earlier record.
//  - Order: records are read in observed order (observation time, then key). Observation times are never rewritten.
//  - Nothing is invented: a missing source timestamp stays null. The observation time is when this process read the
//    source and is never presented as a publication time.
//  - Evidence before reference: the raw object is written before the record that names it.
//  - Tamper evident: every record carries a checksum over its own content; a record that fails it is skipped and counted.
//
// Server-only: uses node:crypto and node:zlib.

import { createHash } from "node:crypto";
import { gunzipSync, gzipSync } from "node:zlib";
import { appendObservations, latestReadings, totalsFrom } from "./observations";
import type { LoadedCaptures } from "./replay";
import { checkKey, type ObjectStore } from "./captureStore";
import type { Issue, ReconciledReturns, Sides, VoteObservation } from "./types";

export const CAPTURE_SCHEMA = "TPSI_CAPTURE/2" as const;

export type CapturedObservation = Omit<VoteObservation, "retrievedAt">;
/** What the source says about test data. The search feed carries no such flag, so a feed row is NOT_PROVIDED. */
export type TestStatus = "LIVE" | "TEST" | "NOT_PROVIDED";
export type CaptureFlag = "LIVE" | "TEST" | "CORRECTED";

export class CaptureError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

// ---- hashing and encoding ----------------------------------------------------------------------------------------------

/** JSON with keys in sorted order, so equal values hash equally. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => canonicalJson(x === undefined ? null : x)).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
export const sha256Hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

const withChecksum = <T extends object>(rec: T): T & { checksum: string } => ({ ...rec, checksum: sha256Hex(canonicalJson(rec)) });
export function intact(rec: unknown): boolean {
  if (!rec || typeof rec !== "object") return false;
  const { checksum, ...rest } = rec as Record<string, unknown>;
  return typeof checksum === "string" && checksum === sha256Hex(canonicalJson(rest));
}
export const jsonBytes = (v: unknown) => Buffer.from(JSON.stringify(v), "utf8");
export const parseJson = (b: Buffer | null): unknown => { if (!b) return null; try { return JSON.parse(b.toString("utf8")); } catch { return null; } };

/** `2026-11-04T01:30:05.123Z` as `20261104T013005.123Z`, which sorts like the time it names. */
export const compactTime = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "");
const ms = (s: string | null | undefined) => (s ? Date.parse(s) : NaN);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "feed";
export { withChecksum };

// ---- raw layer ---------------------------------------------------------------------------------------------------------

export interface RawRef { rawSha256: string; rawRef: string; rawBytes: number }

/** Keep the response as received. Returns where it lives; storing the same bytes twice is one object. */
export async function storeRaw(store: ObjectStore, text: string): Promise<RawRef> {
  const rawSha256 = sha256Hex(text);
  const rawRef = `raw/${rawSha256}.gz`;
  await store.putIfAbsent(rawRef, gzipSync(Buffer.from(text, "utf8")), "application/gzip");
  return { rawSha256, rawRef, rawBytes: Buffer.byteLength(text, "utf8") };
}

/** The raw response, or null when the object is missing or no longer matches its hash. */
export async function readRaw(store: ObjectStore, ref: { rawSha256: string; rawRef: string }): Promise<string | null> {
  const b = await store.get(ref.rawRef);
  if (!b) return null;
  try {
    const text = gunzipSync(b).toString("utf8");
    return sha256Hex(text) === ref.rawSha256 ? text : null;
  } catch { return null; }
}

// ---- observation records -----------------------------------------------------------------------------------------------

export interface CandidateLine { name: string; party: string; votes: number; percent: number; winner: boolean }

export interface ObservationRecord {
  type: "OBSERVATION";
  schemaVersion: typeof CAPTURE_SCHEMA;
  observationId: string;
  /** Same race, source, source timestamp and figures: two records with one contentId say the same thing. */
  contentId: string;
  /** The figures alone, without any timestamp. Two records with one valuesSha256 are not a material update of each other. */
  valuesSha256: string;
  electionId: string;
  raceId: string;
  state: string | null;
  reportingJurisdiction: { level: "STATE" | "DISTRICT" | null; id: string | null };
  provider: { name: string; endpoint: string | null };
  testStatus: TestStatus;
  /** The time the source says its figures were current. Null when it says none; never filled in. */
  sourceTimestamp: string | null;
  /** When this process read the source. Never a publication time. */
  firstObservedAt: string;
  ingestedAt: string;
  candidates: CandidateLine[];
  toplineSides: Sides | null;
  /** Counts of precincts, only when the provider gives counts. civicAPI does not. */
  precinctsReporting: { reported: number | null; total: number | null };
  /** The provider's own reporting percentage. Its basis is not stated by the provider and is not assumed. */
  reportingPct: number | null;
  reportingPctBasis: "PROVIDER_UNSPECIFIED" | null;
  /** An official statement of ballots still to count, only when the provider gives one. civicAPI does not. */
  officialOutstandingBallots: number | null;
  /** Voting methods the source names explicitly. Empty when it names none. */
  votingMethods: string[];
  jurisdictionCount: number;
  observations: CapturedObservation[];
  rawSha256: string;
  rawRef: string;
  rawBytes: number;
  payloadForm: string;
  runId: string | null;
  checksum: string;
}

export interface ObservationInput {
  electionId: string;
  raceId: string;
  state: string | null;
  provider: { name: string; endpoint: string | null };
  testStatus: TestStatus;
  sourceTimestamp: string | null;
  observedAt: string;
  ingestedAt?: string;
  candidates: CandidateLine[];
  observations: CapturedObservation[];
  reportingPct: number | null;
  /** The response exactly as received. */
  rawText: string;
  payloadForm: string;
  runId?: string | null;
}

export interface RaceHead {
  raceId: string;
  contentId: string;
  valuesSha256: string;
  key: string;
  firstObservedAt: string;
  sourceTimestamp: string | null;
  testStatus: TestStatus;
  jurisdictionCount: number;
  reportingPct: number | null;
  toplineTotal: number | null;
  events: number;
  materialEvents: number;
  withSourceTimestamp: number;
  lastMaterialAt: string | null;
  checksum: string;
}

const obsPrefix = (raceId: string) => `obs/${checkKey(raceId)}/`;
const headKey = (raceId: string) => `heads/race/${checkKey(raceId)}.json`;
const SAFE_RACE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export async function readRaceHead(store: ObjectStore, raceId: string): Promise<RaceHead | null> {
  const h = parseJson(await store.get(headKey(raceId)));
  return intact(h) ? (h as RaceHead) : null;
}

function validate(input: ObservationInput): void {
  if (!SAFE_RACE.test(input.raceId)) throw new CaptureError("INVALID_RACE_ID", `race id "${input.raceId.slice(0, 40)}" is not a safe key`);
  if (!input.observations.length) throw new CaptureError("NO_OBSERVATIONS", "a capture needs at least one observation");
  if (!Number.isFinite(ms(input.observedAt))) throw new CaptureError("INVALID_DATE", "observedAt is not a date");
  if (input.ingestedAt !== undefined && !Number.isFinite(ms(input.ingestedAt))) throw new CaptureError("INVALID_DATE", "ingestedAt is not a date");
  if (input.sourceTimestamp !== null && !Number.isFinite(ms(input.sourceTimestamp))) throw new CaptureError("INVALID_DATE", "sourceTimestamp is not a date");
  for (const o of input.observations) for (const k of ["a", "b", "o"] as const) if (!Number.isFinite(o.sides[k]) || o.sides[k] < 0) throw new CaptureError("INVALID_VOTES", `${o.jurisdictionId}: side ${k} is ${String(o.sides[k])}`);
}

const isTop = (o: CapturedObservation) => o.jurisdictionLevel === "STATE" || o.jurisdictionLevel === "DISTRICT";

export type RecordOutcome = "NEW" | "UNCHANGED" | "ALREADY_RECORDED";
export interface RecordResult { outcome: RecordOutcome; observationId: string; contentId: string; key: string; material: boolean }

/**
 * Record one reading. Safe to call twice with the same input, to interrupt, and to run from overlapping processes.
 * UNCHANGED: the latest record already says this, so nothing was written.
 */
export async function recordObservation(store: ObjectStore, input: ObservationInput): Promise<RecordResult> {
  validate(input);
  const valuesSha256 = sha256Hex(canonicalJson({
    reportingPct: input.reportingPct,
    candidates: input.candidates,
    observations: [...input.observations].map((o) => ({ j: o.jurisdictionId, l: o.jurisdictionLevel, s: o.scope, m: o.method, v: o.sides, p: o.precinctsReportingPct })).sort((x, y) => canonicalJson(x).localeCompare(canonicalJson(y))),
  }));
  const contentId = sha256Hex(canonicalJson({ raceId: input.raceId, provider: input.provider.name, sourceTimestamp: input.sourceTimestamp, testStatus: input.testStatus, valuesSha256 }));
  const key = `${obsPrefix(input.raceId)}${compactTime(input.observedAt)}_${contentId.slice(0, 12)}.json`;
  const observationId = sha256Hex(`${input.raceId}|${input.observedAt}|${contentId}`);

  const head = await readRaceHead(store, input.raceId);
  const material = !head || head.valuesSha256 !== valuesSha256;
  if (head && head.contentId === contentId) return { outcome: "UNCHANGED", observationId, contentId, key: head.key, material: false };

  const raw = await storeRaw(store, input.rawText);
  const top = input.observations.find(isTop) ?? null;
  const methods = [...new Set(input.observations.map((o) => o.method).filter((m) => m !== "UNKNOWN"))].sort();
  const record = withChecksum<Omit<ObservationRecord, "checksum">>({
    type: "OBSERVATION", schemaVersion: CAPTURE_SCHEMA, observationId, contentId, valuesSha256, electionId: input.electionId, raceId: input.raceId, state: input.state,
    reportingJurisdiction: { level: top ? (top.jurisdictionLevel as "STATE" | "DISTRICT") : null, id: top?.jurisdictionId ?? null },
    provider: input.provider, testStatus: input.testStatus, sourceTimestamp: input.sourceTimestamp, firstObservedAt: input.observedAt, ingestedAt: input.ingestedAt ?? input.observedAt,
    candidates: input.candidates, toplineSides: top ? { a: top.sides.a, b: top.sides.b, o: top.sides.o } : null,
    precinctsReporting: { reported: null, total: null }, reportingPct: input.reportingPct, reportingPctBasis: input.reportingPct === null ? null : "PROVIDER_UNSPECIFIED",
    officialOutstandingBallots: null, votingMethods: methods, jurisdictionCount: input.observations.length, observations: input.observations,
    ...raw, payloadForm: input.payloadForm, runId: input.runId ?? null,
  });
  const created = await store.putIfAbsent(key, jsonBytes(record), "application/json");

  // the head is a hint; an older write never replaces a newer head
  if (!head || ms(head.firstObservedAt) <= ms(input.observedAt)) {
    const total = record.toplineSides ? record.toplineSides.a + record.toplineSides.b + record.toplineSides.o : null;
    const next = withChecksum<Omit<RaceHead, "checksum">>({
      raceId: input.raceId, contentId, valuesSha256, key, firstObservedAt: input.observedAt, sourceTimestamp: input.sourceTimestamp, testStatus: input.testStatus,
      jurisdictionCount: input.observations.length, reportingPct: input.reportingPct, toplineTotal: total,
      events: (head?.events ?? 0) + (created === "CREATED" ? 1 : 0), materialEvents: (head?.materialEvents ?? 0) + (created === "CREATED" && material ? 1 : 0),
      withSourceTimestamp: (head?.withSourceTimestamp ?? 0) + (created === "CREATED" && input.sourceTimestamp ? 1 : 0),
      lastMaterialAt: material ? input.observedAt : head?.lastMaterialAt ?? null,
    });
    await store.put(headKey(input.raceId), jsonBytes(next), "application/json");
  }
  return { outcome: created === "CREATED" ? "NEW" : "ALREADY_RECORDED", observationId, contentId, key, material };
}

// ---- reading and folding -----------------------------------------------------------------------------------------------

export interface LoadedRecords { records: { key: string; record: ObservationRecord }[]; corrupt: number }

export async function readObservationRecords(store: ObjectStore, raceId: string): Promise<LoadedRecords> {
  const keys = await store.list(obsPrefix(raceId));
  const out: LoadedRecords = { records: [], corrupt: 0 };
  const read = async (key: string) => {
    const rec = parseJson(await store.get(key)) as ObservationRecord | null;
    if (!rec || rec.type !== "OBSERVATION" || rec.schemaVersion !== CAPTURE_SCHEMA || !intact(rec)) { out.corrupt++; return; }
    out.records.push({ key, record: rec });
  };
  for (let i = 0; i < keys.length; i += 8) await Promise.all(keys.slice(i, i + 8).map(read));
  out.records.sort((a, b) => ms(a.record.firstObservedAt) - ms(b.record.firstObservedAt) || a.key.localeCompare(b.key));
  return out;
}

export interface Diff { dA: number; dB: number; dO: number; dTotal: number; dReportingPct: number | null; dSourceSeconds: number | null }

export interface ObservationView {
  observationId: string;
  key: string;
  raceId: string;
  state: string | null;
  testStatus: TestStatus;
  flag: CaptureFlag;
  sourceTimestamp: string | null;
  firstObservedAt: string;
  ingestedAt: string;
  lastObservedAt: string;
  /** Observed this many times in a row, with nothing else in between (overlapping runs write duplicates). */
  sightings: number;
  toplineSides: Sides | null;
  reportingPct: number | null;
  jurisdictionCount: number;
  rawRef: string;
  rawSha256: string;
  /** The figures differ from the observation before it. The first observation is material. */
  material: boolean;
  diffFromPrevious: Diff | null;
  /** The topline total is lower than in the observation before it. */
  totalsDecreased: boolean;
  revisionStatus: "ORIGINAL" | "CORRECTION";
  supersededBy: string | null;
  correctsObservationId: string | null;
  outOfOrder: boolean;
  record: ObservationRecord;
}

const total = (s: Sides | null) => (s ? s.a + s.b + s.o : null);

/** One view per distinct observation in observed order. Corrections, revisions and ordering are derived here. */
export function foldObservations(loaded: Pick<LoadedRecords, "records">): ObservationView[] {
  const views: ObservationView[] = [];
  let prev: ObservationView | null = null;
  for (const { key, record: r } of loaded.records) {
    if (prev && prev.record.contentId === r.contentId) { prev.sightings++; prev.lastObservedAt = r.firstObservedAt; continue; }
    const t = total(r.toplineSides), pt = prev ? total(prev.toplineSides) : null;
    const dSource = prev ? ms(r.sourceTimestamp) - ms(prev.sourceTimestamp) : NaN;
    const v: ObservationView = {
      observationId: r.observationId, key, raceId: r.raceId, state: r.state, testStatus: r.testStatus, flag: r.testStatus === "TEST" ? "TEST" : "LIVE",
      sourceTimestamp: r.sourceTimestamp, firstObservedAt: r.firstObservedAt, ingestedAt: r.ingestedAt, lastObservedAt: r.firstObservedAt, sightings: 1,
      toplineSides: r.toplineSides, reportingPct: r.reportingPct, jurisdictionCount: r.jurisdictionCount, rawRef: r.rawRef, rawSha256: r.rawSha256,
      material: !prev || prev.record.valuesSha256 !== r.valuesSha256,
      diffFromPrevious: prev && prev.toplineSides && r.toplineSides ? {
        dA: r.toplineSides.a - prev.toplineSides.a, dB: r.toplineSides.b - prev.toplineSides.b, dO: r.toplineSides.o - prev.toplineSides.o, dTotal: (t ?? 0) - (pt ?? 0),
        dReportingPct: r.reportingPct !== null && prev.reportingPct !== null ? r.reportingPct - prev.reportingPct : null, dSourceSeconds: Number.isFinite(dSource) ? dSource / 1000 : null,
      } : null,
      totalsDecreased: t !== null && pt !== null && t < pt, revisionStatus: "ORIGINAL", supersededBy: null, correctsObservationId: null, outOfOrder: false, record: r,
    };
    views.push(v); prev = v;
  }
  // a correction is the same source timestamp carrying different figures, kept beside the original
  const groups = new Map<string, ObservationView[]>();
  for (const v of views) if (v.sourceTimestamp !== null) { const k = `${v.testStatus}|${v.sourceTimestamp}`; groups.set(k, [...(groups.get(k) ?? []), v]); }
  for (const g of groups.values()) {
    for (let i = 1; i < g.length; i++) {
      if (g[i].record.valuesSha256 === g[i - 1].record.valuesSha256) continue;
      g[i].revisionStatus = "CORRECTION"; g[i].correctsObservationId = g[i - 1].observationId; g[i - 1].supersededBy = g[i].observationId;
      if (g[i].testStatus !== "TEST") g[i].flag = "CORRECTED";
    }
  }
  let maxSeen = -Infinity;
  for (const v of views) { const t = ms(v.sourceTimestamp); if (Number.isFinite(t)) { if (t < maxSeen) v.outOfOrder = true; maxSeen = Math.max(maxSeen, t); } }
  return views;
}

/** What had been observed by `at`. Observations that arrived later are not visible. */
export const knownAt = (views: ObservationView[], at: string): ObservationView[] => views.filter((v) => ms(v.firstObservedAt) <= ms(at));

// ---- replay input -------------------------------------------------------------------------------------------------------

export interface LoadOptions {
  /** Include observations the source marked as test data. Default false. */
  includeTest?: boolean;
  /** Only observations first observed at or before this time. */
  knownAt?: string;
  /** Read each raw object back and compare its hash. */
  verifyRaw?: boolean;
}

export async function loadCapturesForReplay(store: ObjectStore, raceId: string, opts: LoadOptions = {}): Promise<LoadedCaptures> {
  const loaded = await readObservationRecords(store, raceId);
  let views = foldObservations(loaded);
  if (opts.knownAt) views = knownAt(views, opts.knownAt);
  const excluded: LoadedCaptures["excluded"] = [];
  const steps: LoadedCaptures["steps"] = [];
  for (const v of views) {
    if (v.testStatus === "TEST" && !opts.includeTest) { excluded.push({ captureId: v.observationId, reason: "TEST_DATA" }); continue; }
    if (opts.verifyRaw && (await readRaw(store, v.record)) === null) { excluded.push({ captureId: v.observationId, reason: "RAW_MISSING_OR_MISMATCHED" }); continue; }
    steps.push({
      captureId: v.observationId, at: v.firstObservedAt, flag: v.flag, outOfOrder: v.outOfOrder,
      batch: v.record.observations.map((o) => ({ observation: { ...o, retrievedAt: v.firstObservedAt }, raw: { rawSha256: v.rawSha256, rawRef: v.rawRef } })),
    });
  }
  const archive = steps.length
    ? { sourceUrl: `capture-ledger:${raceId}`, retrievedAt: steps[0].at, sha256: sha256Hex(views.map((v) => `${v.observationId}:${v.rawSha256}`).join("\n")) }
    : null;
  return { raceId, steps, excluded, archive, corruptRecords: loaded.corrupt };
}

// ---- reconstructing a moment --------------------------------------------------------------------------------------------

export interface ReconstructedState {
  at: string;
  /** Observations first observed by `at`, which is everything this reconstruction may use. */
  observationsKnown: number;
  lastObservedAt: string | null;
  /** Seconds between the newest observation used and `at`. */
  ageSeconds: number | null;
  returns: ReconciledReturns | null;
  issues: Issue[];
}

/** The race as it could have been read at `at`: only observations made by then, with later corrections not yet visible. */
export function reconstructAt(loaded: LoadedCaptures, at: string): ReconstructedState {
  const known = loaded.steps.filter((s) => ms(s.at) <= ms(at));
  if (!known.length) return { at, observationsKnown: 0, lastObservedAt: null, ageSeconds: null, returns: null, issues: [] };
  const logged = appendObservations([], known.flatMap((s) => s.batch));
  const { readings, issues, ignored } = latestReadings(logged.log, loaded.raceId, at, { includeTest: true });
  const { returns, issues: more } = totalsFrom(readings, at, ignored);
  const last = known[known.length - 1].at;
  return { at, observationsKnown: known.length, lastObservedAt: last, ageSeconds: Math.round((ms(at) - ms(last)) / 1000), returns, issues: [...logged.issues, ...issues, ...more] };
}

export interface ReportingGap { from: string; to: string; minutes: number; kind: "OBSERVATION" | "SOURCE_TIMESTAMP" }

/**
 * Stretches with no new distinct observation, or where the source's own timestamp did not move, longer than `minMinutes`.
 * A quiet stretch is not evidence the recorder was down: an unchanged reading writes nothing. When the recorder could not
 * reach the provider is in the run history (see pollingGaps in captureRunner.ts).
 */
export function reportingGaps(loaded: LoadedCaptures, minMinutes: number): ReportingGap[] {
  const out: ReportingGap[] = [];
  const steps = loaded.steps;
  for (let i = 1; i < steps.length; i++) {
    const m = (ms(steps[i].at) - ms(steps[i - 1].at)) / 60000;
    if (m > minMinutes) out.push({ from: steps[i - 1].at, to: steps[i].at, minutes: Math.round(m * 10) / 10, kind: "OBSERVATION" });
  }
  const stamped = steps.map((s) => s.batch[0]?.observation.sourceTimestamp ?? null).filter((t): t is string => t !== null);
  for (let i = 1; i < stamped.length; i++) {
    const m = (ms(stamped[i]) - ms(stamped[i - 1])) / 60000;
    if (m > minMinutes) out.push({ from: stamped[i - 1], to: stamped[i], minutes: Math.round(m * 10) / 10, kind: "SOURCE_TIMESTAMP" });
  }
  return out;
}

export interface CheckpointComparison {
  at: string;
  provisionalReportedVotes: { a: number; b: number; o: number } | null;
  /** (B - A) / (A + B + O) in points, from provisional returns. */
  provisionalMargin: number | null;
  certifiedMargin: number;
  errorPoints: number | null;
  label: "PROVISIONAL_NOT_CERTIFIED";
}

/** Election-night readings set beside the certified result. Provisional totals are never called certified. */
export function compareCheckpoints(loaded: LoadedCaptures, certified: { margin: number }, checkpoints: string[]): CheckpointComparison[] {
  return checkpoints.map((at) => {
    const r = reconstructAt(loaded, at).returns;
    const t = r ? r.reported.a + r.reported.b + r.reported.o : 0;
    const margin = r && t > 0 ? ((r.reported.b - r.reported.a) / t) * 100 : null;
    return { at, provisionalReportedVotes: r ? { a: r.reported.a, b: r.reported.b, o: r.reported.o } : null, provisionalMargin: margin, certifiedMargin: certified.margin, errorPoints: margin === null ? null : margin - certified.margin, label: "PROVISIONAL_NOT_CERTIFIED" as const };
  });
}

// ---- whole-feed capture ------------------------------------------------------------------------------------------------

/** A race row as the search feed trims it. The feed carries no source timestamp and no test flag. */
export interface FeedRow { id: number; type: string; province: string; district: string | null; name: string; pr: number; seats?: number; c: unknown[] }

export interface FeedDelta {
  type: "FEED_DELTA";
  schemaVersion: typeof CAPTURE_SCHEMA;
  feed: string;
  provider: { name: string; endpoint: string | null };
  testStatus: "NOT_PROVIDED";
  sourceTimestamp: null;
  observedAt: string;
  ingestedAt: string;
  rowCount: number;
  changed: FeedRow[];
  removedIds: number[];
  rawSha256: string;
  rawRef: string;
  rawBytes: number;
  runId: string | null;
  checksum: string;
}
interface FeedHead { feed: string; observedAt: string; rows: Record<string, string> }

const feedHeadKey = (feed: string) => `heads/feed/${slug(feed)}.json`;

export interface FeedInput {
  feed: string;
  provider: { name: string; endpoint: string | null };
  observedAt: string;
  ingestedAt?: string;
  rows: FeedRow[];
  rawText: string;
  runId?: string | null;
}

/** Record only the rows of a whole-feed response that differ from the last one recorded. Nothing changed writes nothing. */
export async function recordFeedDelta(store: ObjectStore, input: FeedInput): Promise<{ outcome: "NEW" | "UNCHANGED" | "ALREADY_RECORDED"; changed: number; removed: number; rowCount: number; key: string | null }> {
  if (!Number.isFinite(ms(input.observedAt))) throw new CaptureError("INVALID_DATE", "observedAt is not a date");
  const hash = (r: FeedRow) => sha256Hex(canonicalJson(r));
  const headRaw = parseJson(await store.get(feedHeadKey(input.feed))) as FeedHead | null;
  const prev = headRaw && typeof headRaw.rows === "object" ? headRaw.rows : {};
  const now: Record<string, string> = {};
  const changed: FeedRow[] = [];
  for (const r of input.rows) { const h = hash(r); now[String(r.id)] = h; if (prev[String(r.id)] !== h) changed.push(r); }
  const removedIds = Object.keys(prev).filter((id) => !(id in now)).map(Number).sort((a, b) => a - b);
  if (!changed.length && !removedIds.length) return { outcome: "UNCHANGED", changed: 0, removed: 0, rowCount: input.rows.length, key: null };

  const raw = await storeRaw(store, input.rawText);
  const delta = withChecksum<Omit<FeedDelta, "checksum">>({
    type: "FEED_DELTA", schemaVersion: CAPTURE_SCHEMA, feed: input.feed, provider: input.provider, testStatus: "NOT_PROVIDED", sourceTimestamp: null,
    observedAt: input.observedAt, ingestedAt: input.ingestedAt ?? input.observedAt, rowCount: input.rows.length, changed, removedIds, ...raw, runId: input.runId ?? null,
  });
  const key = `feed/${slug(input.feed)}/${compactTime(input.observedAt)}_${sha256Hex(canonicalJson({ changed, removedIds })).slice(0, 12)}.json`;
  const created = await store.putIfAbsent(key, jsonBytes(delta), "application/json");
  await store.put(feedHeadKey(input.feed), jsonBytes({ feed: input.feed, observedAt: input.observedAt, rows: now } satisfies FeedHead), "application/json");
  return { outcome: created === "CREATED" ? "NEW" : "ALREADY_RECORDED", changed: changed.length, removed: removedIds.length, rowCount: input.rows.length, key };
}

/** The feed as it stood at `at`, rebuilt by applying the recorded deltas in observed order. */
export async function reconstructFeedAt(store: ObjectStore, feed: string, at: string): Promise<{ rows: Map<number, FeedRow>; deltasApplied: number; corrupt: number }> {
  const keys = await store.list(`feed/${slug(feed)}/`);
  const rows = new Map<number, FeedRow>();
  let applied = 0, corrupt = 0;
  for (const key of keys) {
    const d = parseJson(await store.get(key)) as FeedDelta | null;
    if (!d || d.type !== "FEED_DELTA" || !intact(d)) { corrupt++; continue; }
    if (ms(d.observedAt) > ms(at)) continue;
    for (const id of d.removedIds) rows.delete(id);
    for (const r of d.changed) rows.set(r.id, r);
    applied++;
  }
  return { rows, deltasApplied: applied, corrupt };
}
