// Replay: run the shadow pipeline over a timestamped sequence of readings, as it would have run on the night.
//
// This is the harness historical backtests will use once timestamped returns from past elections are collected
// (Phase 2). A replay over a synthetic source is a software test, never a backtest, and its reports say so.

import { appendObservations } from "./observations";
import { runPipeline, type PipelineInput } from "./pipeline";
import type { DiagnosticReport, Issue, LoggedObservation, VoteObservation } from "./types";

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
