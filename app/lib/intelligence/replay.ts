// Replay: run the shadow pipeline over a timestamped sequence of readings, as it would have run on the night.
//
// A replay over a synthetic source is a software test, never a backtest, and its reports say so. A backtest needs
// real returns with the timestamps the source published them under, an archive record, and certified results to
// score against. `runBacktest` refuses to run without all three and says which is missing; it never fills a gap
// with an invented timestamp.

import { appendObservations } from "./observations";
import { runPipeline, type PipelineInput } from "./pipeline";
import type { BaselineRace, DiagnosticReport, Interval, Issue, LoggedObservation, VoteObservation } from "./types";

export interface ReplayStep {
  /** The evaluation time after this batch arrives. */
  at: string;
  batch: { observation: VoteObservation; raw: unknown }[];
}

export interface ReplaySource {
  label: string;
  /** True for fabricated fixtures. Only a source of real, timestamped, archived returns may be called a backtest. */
  synthetic: boolean;
  steps: ReplayStep[];
}

export interface ReplayResult {
  label: string;
  synthetic: boolean;
  /** A synthetic replay can never be scored as a backtest. Scoring against certified results is Phase 2. */
  backtestEligible: boolean;
  reports: DiagnosticReport[];
  ingestIssues: Issue[];
}

export function runReplay(source: ReplaySource, base: Omit<PipelineInput, "log" | "asOf">): ReplayResult {
  let log: LoggedObservation[] = [];
  const reports: DiagnosticReport[] = [];
  const ingestIssues: Issue[] = [];
  for (const step of source.steps) {
    const r = appendObservations(log, step.batch);
    log = r.log; ingestIssues.push(...r.issues);
    reports.push(runPipeline({ ...base, log, asOf: step.at, synthetic: source.synthetic || base.synthetic }));
  }
  return { label: source.label, synthetic: source.synthetic, backtestEligible: !source.synthetic, reports, ingestIssues };
}

// ---- backtest ------------------------------------------------------------------------------------------------------

/** Where an archived return sequence came from. Required for a source to count as a backtest. */
export interface ReplayArchive {
  sourceUrl: string;
  retrievedAt: string;
  sha256: string;
}

export interface CertifiedResult {
  raceId: string;
  /** Certified margin, side B minus side A, percentage points. */
  margin: number;
  votes: { a: number; b: number; o: number };
  certifiedAt: string;
  sourceUrl: string;
}

export interface BacktestSource extends ReplaySource {
  archive: ReplayArchive | null;
}

export interface BacktestCheckpoint {
  at: string;
  /** Shadow "outstanding splits like the reported vote" final margin, B minus A. */
  shadowMargin: Interval | null;
  shadowError: number | null;
  shadowCovered: boolean | null;
  /** The published engine's margin at the same checkpoint, read-only. */
  publishedMargin: number | null;
  publishedError: number | null;
}

export interface BacktestResult {
  status: "BLOCKED" | "COMPLETED";
  reasons: string[];
  checkpoints: BacktestCheckpoint[];
  summary: { checkpoints: number; shadowMeanAbsError: number | null; publishedMeanAbsError: number | null; shadowCoverage: number | null } | null;
}

/** Why a source cannot be used as a backtest, or an empty list when it can. Pure; touches nothing. */
export function backtestBlockers(source: BacktestSource, certified: CertifiedResult | null): string[] {
  const out: string[] = [];
  if (source.synthetic) out.push("the source is synthetic; a synthetic replay is a software test, not a backtest");
  if (!source.archive) out.push("no archive record (source URL, retrieval time and hash) for the returns");
  if (!source.steps.length) out.push("the source has no timestamped returns");
  if (!certified) out.push("no certified result to score against");
  let prev = -Infinity;
  for (const [i, st] of source.steps.entries()) {
    const at = Date.parse(st.at);
    if (!Number.isFinite(at)) { out.push(`step ${i} has no valid evaluation time`); continue; }
    if (at < prev) out.push(`step ${i} is earlier than the step before it; returns must be ingested in their historical order`);
    prev = at;
    for (const b of st.batch) {
      const ts = b.observation.sourceTimestamp;
      if (!ts) { out.push(`step ${i}: an observation has no source timestamp; timestamps are never invented`); break; }
      if (Date.parse(ts) > at) { out.push(`step ${i}: an observation is stamped after the evaluation time (future leakage)`); break; }
    }
  }
  return [...new Set(out)];
}

export function runBacktest(source: BacktestSource, certified: CertifiedResult | null, base: Omit<PipelineInput, "log" | "asOf">, frozenBaseline: BaselineRace | null): BacktestResult {
  const blockers = backtestBlockers(source, certified);
  if (blockers.length || !certified) return { status: "BLOCKED", reasons: blockers, checkpoints: [], summary: null };
  const before = JSON.stringify(frozenBaseline);
  const replay = runReplay(source, { ...base, baseline: frozenBaseline });
  const reasons: string[] = [];
  if (JSON.stringify(frozenBaseline) !== before) reasons.push("the baseline changed during the replay");
  if (reasons.length) return { status: "BLOCKED", reasons, checkpoints: [], summary: null };
  const checkpoints: BacktestCheckpoint[] = replay.reports.map((r) => {
    const sc = r.shadow?.scenarios.find((x) => x.id === "OUTSTANDING_SPLITS_LIKE_REPORTED")?.finalMargin ?? null;
    const central = sc?.central ?? null;
    const pm = r.published?.published?.margin ?? null;
    return {
      at: r.asOf, shadowMargin: sc,
      shadowError: central === null ? null : central - certified.margin,
      shadowCovered: sc ? sc.low <= certified.margin && certified.margin <= sc.high : null,
      publishedMargin: pm, publishedError: pm === null ? null : pm - certified.margin,
    };
  });
  const mean = (xs: (number | null)[]) => { const v = xs.filter((x): x is number => x !== null).map(Math.abs); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const cov = checkpoints.filter((c) => c.shadowCovered !== null);
  return {
    status: "COMPLETED", reasons: [], checkpoints,
    summary: { checkpoints: checkpoints.length, shadowMeanAbsError: mean(checkpoints.map((c) => c.shadowError)), publishedMeanAbsError: mean(checkpoints.map((c) => c.publishedError)), shadowCoverage: cov.length ? cov.filter((c) => c.shadowCovered).length / cov.length : null },
  };
}

// ---- replay from captured snapshots ---------------------------------------------------------------------------------------

/**
 * Snapshots read back from the capture ledger (see capture.ts). Each step is evaluated at the time the capture was
 * first observed, so a later correction cannot leak into an earlier evaluation.
 */
export interface LoadedCaptures {
  raceId: string;
  steps: (ReplayStep & { captureId: string; flag: "LIVE" | "TEST" | "CORRECTED"; outOfOrder: boolean })[];
  /** Captures left out, and why: TEST_DATA, RAW_MISSING_OR_MISMATCHED. */
  excluded: { captureId: string; reason: string }[];
  archive: ReplayArchive | null;
  /** Records that failed their checksum or had an unknown shape. They are skipped, never trusted. */
  corruptRecords: number;
}

export interface CaptureReplayResult extends BacktestResult {
  raceId: string;
  stepsUsed: number;
  excluded: LoadedCaptures["excluded"];
  corrections: number;
  outOfOrder: number;
  ledgerHealth: { corruptRecords: number };
}

/**
 * Replay captured snapshots after the election. With no snapshots, with snapshots that carry no source timestamp, or
 * without a certified result, the result is BLOCKED and says why. No timestamp or sequence is ever supplied by this
 * function.
 */
export function backtestFromCaptures(loaded: LoadedCaptures, certified: CertifiedResult | null, base: Omit<PipelineInput, "log" | "asOf">): CaptureReplayResult {
  const meta = {
    raceId: loaded.raceId, stepsUsed: loaded.steps.length, excluded: loaded.excluded,
    corrections: loaded.steps.filter((s) => s.flag === "CORRECTED").length, outOfOrder: loaded.steps.filter((s) => s.outOfOrder).length,
    ledgerHealth: { corruptRecords: loaded.corruptRecords },
  };
  if (!loaded.steps.length) return { ...meta, status: "BLOCKED", reasons: [`no captured snapshots for ${loaded.raceId}; there is nothing to replay`], checkpoints: [], summary: null };
  const source: BacktestSource = { label: `capture-ledger:${loaded.raceId}`, synthetic: false, archive: loaded.archive, steps: loaded.steps.map((s) => ({ at: s.at, batch: s.batch })) };
  return { ...meta, ...runBacktest(source, certified, base, base.baseline) };
}
