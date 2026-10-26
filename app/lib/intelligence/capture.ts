// Evidence capture ("flight recorder v2") for the intelligence layer.
//
// Purpose: keep what the source actually said, and when we saw it, so a post-election replay can reconstruct what was
// knowable on the night. It is separate from the public timeline recorder (app/results/_lib/flightRecorder.ts), whose
// shape and behaviour are unchanged. Nothing here feeds a published number.
//
// Storage (INTELLIGENCE_CAPTURE_DIR, default data/intelligence-capture, gitignored):
//   <raceId>.ndjson        append-only ledger, one JSON object per line: CAPTURE and SEEN records
//   payloads/<sha>.json    the raw payload and the observations read from it, named by the sha256 of the raw payload
//
// Guarantees
//  - Idempotent: a capture's id is the hash of race, source, source timestamp and payload hash. Seeing the same payload
//    again appends at most one SEEN line per observation time; running the same capture twice changes nothing.
//  - Interruption-resilient: the payload file is written to a temporary name and renamed before the ledger line that
//    refers to it, so a ledger line never points at a missing or half-written payload. Every ledger line carries its own
//    checksum; a torn or edited line is skipped and counted, never trusted. A file that does not end in a newline is
//    repaired before the next append, so a torn tail cannot swallow the next record.
//  - Order-independent: the ledger is in arrival order. Readers order by observation time and derive, never store, the
//    out-of-order and corrected flags, so a late or repeated arrival cannot corrupt earlier entries.
//  - Nothing is invented: a missing source timestamp stays null.
//
// Server-only: uses node:fs. Never import from a client component.

import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoadedCaptures } from "./replay";
import type { Sides, VoteObservation } from "./types";

export const CAPTURE_SCHEMA = "TPSI_CAPTURE/1" as const;
export const CAPTURE_KINDS = ["LIVE", "TEST"] as const;
export type CaptureKind = (typeof CAPTURE_KINDS)[number];
/** What a reader should treat a capture as. TEST outranks CORRECTED outranks LIVE. */
export type CaptureFlag = "LIVE" | "TEST" | "CORRECTED";

export type CapturedObservation = Omit<VoteObservation, "retrievedAt">;

export interface CaptureInput {
  raceId: string;
  state: string | null;
  source: { name: string; url: string | null };
  /** The time the source says its figures were current. Null when it says none; never filled in. */
  sourceTimestamp: string | null;
  /** When this process read the source. */
  observedAt: string;
  observations: CapturedObservation[];
  /** The payload as received, or the nearest form the reader had. */
  raw: unknown;
  /** Describes `raw` honestly, for example "CIVICAPI_RACE_JSON". */
  payloadForm: string;
}

export interface CaptureDiff {
  previousCaptureId: string;
  dA: number;
  dB: number;
  dO: number;
  dTotal: number;
  dPrecinctsPct: number | null;
  dSourceSeconds: number | null;
}

export interface CaptureRecord {
  type: "CAPTURE";
  schemaVersion: typeof CAPTURE_SCHEMA;
  captureId: string;
  payloadSha256: string;
  payloadForm: string;
  raceId: string;
  state: string | null;
  kind: CaptureKind;
  source: { name: string; url: string | null };
  sourceTimestamp: string | null;
  firstObservedAt: string;
  toplineSides: Sides | null;
  /** The source's own precinct figure, carried as metadata. Never read as a share of votes. */
  precinctsReportingPct: number | null;
  jurisdictionCount: number;
  diffFromPrevious: CaptureDiff | null;
  lineSha256: string;
}

export interface SeenRecord {
  type: "SEEN";
  captureId: string;
  at: string;
  lineSha256: string;
}

export interface CaptureView {
  captureId: string;
  raceId: string;
  state: string | null;
  kind: CaptureKind;
  flag: CaptureFlag;
  source: { name: string; url: string | null };
  sourceTimestamp: string | null;
  firstObservedAt: string;
  lastObservedAt: string;
  /** Distinct times this exact payload was observed. */
  observationCount: number;
  toplineSides: Sides | null;
  precinctsReportingPct: number | null;
  jurisdictionCount: number;
  diffFromPrevious: CaptureDiff | null;
  payloadSha256: string;
  payloadForm: string;
  payloadRef: string;
  /** A later payload for the same source timestamp, so this one was corrected by it. */
  supersededBy: string | null;
  /** The earlier payload this one corrects. */
  correctsCaptureId: string | null;
  /** The source timestamp is older than one already observed before this capture. */
  outOfOrder: boolean;
}

export class CaptureError extends Error {
  readonly code: string;
  constructor(code: string, message: string) { super(message); this.code = code; }
}

// ---- hashing ---------------------------------------------------------------------------------------------------------

/** JSON with keys in sorted order, so equal values hash equally. */
export function canonicalJson(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v) ?? "null";
  if (Array.isArray(v)) return `[${v.map((x) => canonicalJson(x === undefined ? null : x)).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(o[k])}`).join(",")}}`;
}
export const sha256Hex = (s: string | Buffer) => createHash("sha256").update(s).digest("hex");

const withLineHash = <T extends { type: string }>(rec: T): T & { lineSha256: string } => ({ ...rec, lineSha256: sha256Hex(canonicalJson(rec)) });
const lineIntact = (rec: { lineSha256?: unknown } & Record<string, unknown>) => {
  const { lineSha256, ...rest } = rec;
  return typeof lineSha256 === "string" && lineSha256 === sha256Hex(canonicalJson(rest));
};

// ---- storage ---------------------------------------------------------------------------------------------------------

export const captureDir = () => path.resolve(process.env.INTELLIGENCE_CAPTURE_DIR ?? path.join(process.cwd(), "data", "intelligence-capture"));

const SAFE_ID = /^[A-Za-z0-9._-]{1,80}$/;
const ledgerPath = (dir: string, raceId: string) => {
  if (!SAFE_ID.test(raceId) || raceId.startsWith(".")) throw new CaptureError("INVALID_RACE_ID", `race id "${raceId}" is not a safe file name`);
  return path.join(dir, `${raceId}.ndjson`);
};
const payloadRelPath = (sha: string) => path.posix.join("payloads", `${sha}.json`);

async function writeAtomic(file: string, text: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, text, "utf8");
  await rename(tmp, file);
}

async function exists(file: string): Promise<boolean> {
  try { await stat(file); return true; } catch { return false; }
}

export interface LedgerRead {
  captures: CaptureRecord[];
  seen: SeenRecord[];
  /** Lines that were not valid JSON, failed their checksum or had an unknown shape. They are skipped. */
  corruptLines: number;
  /** The file did not end in a newline: a write was interrupted. */
  tornTail: boolean;
}

export async function readLedger(dir: string, raceId: string): Promise<LedgerRead> {
  const out: LedgerRead = { captures: [], seen: [], corruptLines: 0, tornTail: false };
  let text: string;
  try { text = await readFile(ledgerPath(dir, raceId), "utf8"); } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return out;
    throw e;
  }
  out.tornTail = text.length > 0 && !text.endsWith("\n");
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    let rec: Record<string, unknown>;
    try { rec = JSON.parse(line) as Record<string, unknown>; } catch { out.corruptLines++; continue; }
    if (!rec || typeof rec !== "object" || !lineIntact(rec)) { out.corruptLines++; continue; }
    if (rec.type === "CAPTURE" && rec.schemaVersion === CAPTURE_SCHEMA && typeof rec.captureId === "string") out.captures.push(rec as unknown as CaptureRecord);
    else if (rec.type === "SEEN" && typeof rec.captureId === "string" && typeof rec.at === "string") out.seen.push(rec as unknown as SeenRecord);
    else out.corruptLines++;
  }
  return out;
}

// ---- folding the ledger into one view per capture -----------------------------------------------------------------------

const ms = (s: string | null) => (s === null ? NaN : Date.parse(s));

/** One view per distinct payload, in the order the payloads were first observed. Corrections and order are derived here. */
export function foldLedger(ledger: Pick<LedgerRead, "captures" | "seen">): CaptureView[] {
  const times = new Map<string, Set<string>>();
  const first = new Map<string, CaptureRecord>();
  for (const c of ledger.captures) {
    const prev = first.get(c.captureId);
    times.set(c.captureId, (times.get(c.captureId) ?? new Set()).add(c.firstObservedAt));
    // a duplicate CAPTURE line (overlapping runs) counts as a sighting; the earliest stands as the capture
    if (!prev || ms(c.firstObservedAt) < ms(prev.firstObservedAt)) first.set(c.captureId, c);
  }
  for (const s of ledger.seen) if (times.has(s.captureId)) times.get(s.captureId)!.add(s.at);

  const views: CaptureView[] = [...first.values()].map((c) => {
    const ts = [...(times.get(c.captureId) ?? [])].sort((a, b) => ms(a) - ms(b));
    return {
      captureId: c.captureId, raceId: c.raceId, state: c.state, kind: c.kind, flag: c.kind === "TEST" ? "TEST" : "LIVE", source: c.source, sourceTimestamp: c.sourceTimestamp,
      firstObservedAt: ts[0] ?? c.firstObservedAt, lastObservedAt: ts[ts.length - 1] ?? c.firstObservedAt, observationCount: ts.length,
      toplineSides: c.toplineSides, precinctsReportingPct: c.precinctsReportingPct, jurisdictionCount: c.jurisdictionCount, diffFromPrevious: c.diffFromPrevious,
      payloadSha256: c.payloadSha256, payloadForm: c.payloadForm, payloadRef: payloadRelPath(c.payloadSha256),
      supersededBy: null, correctsCaptureId: null, outOfOrder: false,
    } satisfies CaptureView;
  }).sort((a, b) => ms(a.firstObservedAt) - ms(b.firstObservedAt) || a.captureId.localeCompare(b.captureId));

  // corrections: the same source timestamp carrying a different payload
  const bySourceTime = new Map<string, CaptureView[]>();
  for (const v of views) if (v.sourceTimestamp !== null) { const k = `${v.kind}|${v.sourceTimestamp}`; bySourceTime.set(k, [...(bySourceTime.get(k) ?? []), v]); }
  for (const group of bySourceTime.values()) {
    for (let i = 1; i < group.length; i++) {
      group[i].correctsCaptureId = group[i - 1].captureId;
      group[i - 1].supersededBy = group[i].captureId;
      if (group[i].kind === "LIVE") group[i].flag = "CORRECTED";
    }
  }
  // out of order: a source timestamp older than one already observed before this capture
  let maxSeen = -Infinity;
  for (const v of views) {
    const t = ms(v.sourceTimestamp);
    if (Number.isFinite(t)) { if (t < maxSeen) v.outOfOrder = true; maxSeen = Math.max(maxSeen, t); }
  }
  return views;
}

/** What had been observed by `at`. Corrections that arrived later are not visible yet. */
export const knownAt = (views: CaptureView[], at: string): CaptureView[] => views.filter((v) => ms(v.firstObservedAt) <= Date.parse(at));

// ---- writing ---------------------------------------------------------------------------------------------------------

export type RecordOutcome = "NEW" | "SEEN_AGAIN" | "ALREADY_RECORDED";

function validate(input: CaptureInput): void {
  if (!input.observations.length) throw new CaptureError("NO_OBSERVATIONS", "a capture needs at least one observation");
  if (!Number.isFinite(Date.parse(input.observedAt))) throw new CaptureError("INVALID_DATE", "observedAt is not a date");
  if (input.sourceTimestamp !== null && !Number.isFinite(Date.parse(input.sourceTimestamp))) throw new CaptureError("INVALID_DATE", "sourceTimestamp is not a date");
  for (const o of input.observations) for (const k of ["a", "b", "o"] as const) if (!Number.isFinite(o.sides[k]) || o.sides[k] < 0) throw new CaptureError("INVALID_VOTES", `${o.jurisdictionId}: side ${k} is ${String(o.sides[k])}`);
}

const isTop = (o: CapturedObservation) => o.jurisdictionLevel === "STATE" || o.jurisdictionLevel === "DISTRICT";

function diffOf(prev: CaptureView | undefined, sides: Sides | null, pct: number | null, sourceTimestamp: string | null): CaptureDiff | null {
  if (!prev || !prev.toplineSides || !sides) return null;
  const dA = sides.a - prev.toplineSides.a, dB = sides.b - prev.toplineSides.b, dO = sides.o - prev.toplineSides.o;
  const dt = ms(sourceTimestamp) - ms(prev.sourceTimestamp);
  return { previousCaptureId: prev.captureId, dA, dB, dO, dTotal: dA + dB + dO, dPrecinctsPct: pct !== null && prev.precinctsReportingPct !== null ? pct - prev.precinctsReportingPct : null, dSourceSeconds: Number.isFinite(dt) ? dt / 1000 : null };
}

/**
 * Record one observation. Safe to call twice with the same input, to interrupt, and to run from overlapping processes:
 * the outcome is NEW the first time, SEEN_AGAIN for the same payload at a new observation time, and ALREADY_RECORDED
 * when nothing would change.
 */
export async function recordCapture(dir: string, input: CaptureInput): Promise<{ outcome: RecordOutcome; captureId: string }> {
  validate(input);
  const ledgerFile = ledgerPath(dir, input.raceId);
  const payloadSha256 = sha256Hex(canonicalJson(input.raw));
  const captureId = sha256Hex(canonicalJson({ raceId: input.raceId, source: input.source.name, sourceTimestamp: input.sourceTimestamp, payloadSha256 }));
  const ledger = await readLedger(dir, input.raceId);
  const views = foldLedger(ledger);
  const existing = views.find((v) => v.captureId === captureId);

  const lines: string[] = [];
  let outcome: RecordOutcome;
  if (existing) {
    const known = ledger.seen.some((s) => s.captureId === captureId && s.at === input.observedAt) || ledger.captures.some((c) => c.captureId === captureId && c.firstObservedAt === input.observedAt);
    if (known) return { outcome: "ALREADY_RECORDED", captureId };
    lines.push(JSON.stringify(withLineHash<Omit<SeenRecord, "lineSha256">>({ type: "SEEN", captureId, at: input.observedAt })));
    outcome = "SEEN_AGAIN";
  } else {
    const payloadFile = path.join(dir, payloadRelPath(payloadSha256));
    if (!(await exists(payloadFile))) await writeAtomic(payloadFile, JSON.stringify({ schemaVersion: CAPTURE_SCHEMA, payloadSha256, payloadForm: input.payloadForm, raw: input.raw, observations: input.observations }));
    const top = input.observations.find(isTop) ?? null;
    const toplineSides = top ? { a: top.sides.a, b: top.sides.b, o: top.sides.o } : null;
    const pct = top?.precinctsReportingPct ?? null;
    // the previous observation is the latest one already in the ledger, whatever its source timestamp
    const previous = views[views.length - 1];
    lines.push(JSON.stringify(withLineHash<Omit<CaptureRecord, "lineSha256">>({
      type: "CAPTURE", schemaVersion: CAPTURE_SCHEMA, captureId, payloadSha256, payloadForm: input.payloadForm, raceId: input.raceId, state: input.state,
      kind: input.observations.some((o) => o.test) ? "TEST" : "LIVE", source: input.source, sourceTimestamp: input.sourceTimestamp, firstObservedAt: input.observedAt,
      toplineSides, precinctsReportingPct: pct, jurisdictionCount: input.observations.length, diffFromPrevious: diffOf(previous, toplineSides, pct, input.sourceTimestamp),
    })));
    outcome = "NEW";
  }
  await mkdir(dir, { recursive: true });
  // a torn tail is closed off so it cannot merge with the new line
  await appendFile(ledgerFile, `${ledger.tornTail ? "\n" : ""}${lines.join("\n")}\n`, "utf8");
  return { outcome, captureId };
}

// ---- reading back for replay ---------------------------------------------------------------------------------------------

export interface LoadOptions {
  /** Include captures the source marked as test data. Default false. */
  includeTest?: boolean;
  /** Only captures first observed at or before this time. */
  knownAt?: string;
}

export async function loadCapturesForReplay(dir: string, raceId: string, opts: LoadOptions = {}): Promise<LoadedCaptures> {
  const ledger = await readLedger(dir, raceId);
  let views = foldLedger(ledger);
  if (opts.knownAt) views = knownAt(views, opts.knownAt);
  const excluded: LoadedCaptures["excluded"] = [];
  const steps: LoadedCaptures["steps"] = [];
  for (const v of views) {
    if (v.kind === "TEST" && !opts.includeTest) { excluded.push({ captureId: v.captureId, reason: "TEST_DATA" }); continue; }
    let body: { raw?: unknown; observations?: CapturedObservation[] };
    try { body = JSON.parse(await readFile(path.join(dir, v.payloadRef), "utf8")); } catch { excluded.push({ captureId: v.captureId, reason: "PAYLOAD_MISSING" }); continue; }
    if (sha256Hex(canonicalJson(body.raw)) !== v.payloadSha256 || !Array.isArray(body.observations)) { excluded.push({ captureId: v.captureId, reason: "PAYLOAD_HASH_MISMATCH" }); continue; }
    steps.push({
      captureId: v.captureId, at: v.firstObservedAt, flag: v.flag, outOfOrder: v.outOfOrder,
      batch: body.observations.map((o) => ({ observation: { ...o, retrievedAt: v.firstObservedAt }, raw: body.raw })),
    });
  }
  const archive = steps.length
    ? { sourceUrl: `capture-ledger:${raceId}`, retrievedAt: steps[0].at, sha256: sha256Hex(views.map((v) => `${v.captureId}:${v.payloadSha256}`).join("\n")) }
    : null;
  return { raceId, steps, excluded, archive, corruptLines: ledger.corruptLines, tornTail: ledger.tornTail };
}

/** Summary for the diagnostics page: what has been captured for a race, and whether the ledger is healthy. */
export async function captureStatus(dir: string, raceId: string): Promise<{ captures: number; firstObservedAt: string | null; lastObservedAt: string | null; test: number; corrected: number; outOfOrder: number; withoutSourceTimestamp: number; corruptLines: number; tornTail: boolean }> {
  const ledger = await readLedger(dir, raceId);
  const v = foldLedger(ledger);
  return {
    captures: v.length, firstObservedAt: v[0]?.firstObservedAt ?? null, lastObservedAt: v.reduce<string | null>((m, x) => (m === null || ms(x.lastObservedAt) > ms(m) ? x.lastObservedAt : m), null),
    test: v.filter((x) => x.kind === "TEST").length, corrected: v.filter((x) => x.flag === "CORRECTED").length, outOfOrder: v.filter((x) => x.outOfOrder).length,
    withoutSourceTimestamp: v.filter((x) => x.sourceTimestamp === null).length, corruptLines: ledger.corruptLines, tornTail: ledger.tornTail,
  };
}
