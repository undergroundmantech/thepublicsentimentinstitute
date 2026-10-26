// The shadow pipeline:
//   live returns -> geographic reconciliation -> totals -> outstanding estimate -> reporting composition
//   -> shadow projection -> comparison with the published engine -> diagnostics
//
// Every stage is isolated. A stage that throws is recorded as FAILED and everything that depends on it is
// UNAVAILABLE; the pipeline itself never throws, and it never writes anywhere. Its output is a diagnostic report for
// the protected portal page, not a published number.

import { districtIdOf, researchCoverage } from "./baseline";
import { composeMethods, reportingContext } from "./composition";
import { reconcileGeography } from "./geography";
import { latestReadings, totalsFrom, type Reading } from "./observations";
import { estimateOutstanding } from "./outstanding";
import { comparePublished, type PublishedInput } from "./published";
import { buildReportingProfile } from "./reportingOrder";
import { recordsForRace } from "./research";
import { shadowProject } from "./shadow";
import type {
  BaselineRace, ComponentKey, Confidence, DiagnosticReport, GeoCoverage, GeoSplitRecord, Issue, LoggedObservation, MethodComposition,
  Office, OutstandingInventory, PublishedComparison, ReconciledReturns, ReportingContext, ReportingOrderProfile, ResearchRecord, ShadowProjection, StageStatus,
} from "./types";

export interface PipelineInput {
  raceId: string;
  asOf: string;
  generatedAt?: string;
  baseline: BaselineRace | null;
  log: readonly LoggedObservation[];
  research: ResearchRecord[];
  expectedJurisdictions: string[] | null;
  forecastExpectedTotal: number | null;
  forecastSource: string | null;
  published?: PublishedInput | null;
  includeTest?: boolean;
  /** Set when any input is a synthetic fixture; carried onto the report. */
  synthetic?: boolean;
}

type Stage = { stage: string; status: StageStatus; issues: Issue[] };

function run<T>(stages: Stage[], name: string, ready: boolean, fn: (issues: Issue[]) => T, statusOf?: (v: T, issues: Issue[]) => StageStatus): T | null {
  if (!ready) { stages.push({ stage: name, status: "UNAVAILABLE", issues: [{ code: "UPSTREAM_UNAVAILABLE", severity: "WARNING", message: "an earlier stage did not produce its output" }] }); return null; }
  const issues: Issue[] = [];
  try {
    const v = fn(issues);
    const status = statusOf ? statusOf(v, issues) : issues.some((i) => i.severity !== "INFO") ? "DEGRADED" : "OK";
    stages.push({ stage: name, status, issues });
    return v;
  } catch (e) {
    stages.push({ stage: name, status: "FAILED", issues: [...issues, { code: "STAGE_FAILED", severity: "ERROR", message: (e as Error)?.message ?? String(e) }] });
    return null;
  }
}

const officeOf = (raceId: string): Office | null => (raceId.startsWith("sen-") ? "senate" : raceId.startsWith("gov-") ? "governor" : raceId.startsWith("house-") ? "house" : null);

export function runPipeline(input: PipelineInput): DiagnosticReport {
  const stages: Stage[] = [];
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const b = input.baseline;
  const office = b?.office ?? officeOf(input.raceId);
  const state = b?.state ?? input.raceId.split("-")[1] ?? "";

  run(stages, "baseline", true, (issues) => {
    if (!b) issues.push({ code: "UNMATCHED_RACE_ID", severity: "ERROR", message: `${input.raceId} is not in the forecast baseline` });
    else if (b.raceId !== input.raceId) issues.push({ code: "CONTRADICTORY_METADATA", severity: "ERROR", message: `baseline is for ${b.raceId}, not ${input.raceId}` });
    return b;
  }, (_v, issues) => (issues.some((i) => i.severity === "ERROR") ? "FAILED" : "OK"));
  const matched = !!b && b.raceId === input.raceId && !!office;

  const research = matched ? recordsForRace(input.research, input.raceId, state) : [];

  const ingest = run(stages, "ingest", matched, (issues) => {
    const r = latestReadings(input.log, input.raceId, input.asOf, { includeTest: input.includeTest });
    issues.push(...r.issues);
    if (!r.readings.length) issues.push({ code: "NO_RETURNS", severity: "INFO", message: "no readings for this race as of the evaluation time" });
    return r;
  }, (_v, issues) => (issues.some((i) => i.severity === "WARNING") ? "DEGRADED" : "OK"));

  const geo = run(stages, "geography", !!ingest, (issues) => {
    const splits = research.filter((r): r is GeoSplitRecord => r.recordType === "GEO_SPLIT");
    const g = reconcileGeography({ raceId: input.raceId, office: office as Office, state, expectedJurisdictions: input.expectedJurisdictions, splits }, ingest!.readings);
    issues.push(...g.issues);
    return g;
  });

  const returns: ReconciledReturns | null = run(stages, "returns", !!geo, (issues) => {
    const r = totalsFrom(geo!.admissible as Reading[], input.asOf, ingest!.ignored);
    issues.push(...r.issues);
    return r.returns;
  });

  const outstanding = run(stages, "outstanding", !!returns, (issues) => {
    const latest: Record<string, string | null> = {};
    for (const [j, v] of Object.entries(returns!.byJurisdiction)) latest[j] = v.sourceTimestamp;
    latest.TOPLINE = returns!.basis === "TOPLINE" ? returns!.latestSourceTimestamp : null;
    const o = estimateOutstanding({ raceId: input.raceId, office: office as Office, asOf: input.asOf, reported: returns!.reported.t, latestByJurisdiction: latest, records: research, forecastExpectedTotal: input.forecastExpectedTotal, forecastSource: input.forecastSource });
    issues.push(...o.issues);
    return o.inventory;
  }, (v, issues) => (v.estimatedOutstanding === null ? "UNAVAILABLE" : issues.some((i) => i.severity !== "INFO") ? "DEGRADED" : "OK"));

  const methods: MethodComposition | null = run(stages, "methods", !!returns, (issues) => {
    const c = composeMethods(input.raceId, returns!, research, outstanding?.officiallyConfirmedOutstanding.sources ?? []);
    issues.push(...c.issues);
    return c.composition;
  }, (v) => (v.knownMethodShare === null || v.knownMethodShare < 1 ? "DEGRADED" : "OK"));

  const reporting: ReportingContext | null = run(stages, "reporting", matched, (issues) => {
    const c = reportingContext(research, input.asOf);
    issues.push(...c.issues);
    return c.context;
  });

  const shadow: ShadowProjection | null = run(stages, "shadow", !!returns, () => shadowProject(returns!, outstanding, b),
    (v) => (v.status === "AVAILABLE" ? "OK" : v.status === "PARTIAL" ? "DEGRADED" : "UNAVAILABLE"));

  const published: PublishedComparison | null = run(stages, "published", matched, () => comparePublished(input.published ?? null, shadow),
    (v) => (v.available ? "OK" : "UNAVAILABLE"));

  const reportingOrder: ReportingOrderProfile | null = run(stages, "reportingOrder", matched, () => buildReportingProfile({
    raceId: input.raceId, state, office, district: b?.district ?? null, research: input.research, returns, outstanding, shadow, published,
  }), (v) => (v.stateInDataset ? "OK" : "DEGRADED"));

  const missingResearch = matched ? missingInputs({ raceId: input.raceId, office: office as Office, state }, research) : [];
  const { confidence, reasons } = assessConfidence(stages, geo?.coverage ?? null, outstanding, shadow);

  return {
    raceId: input.raceId, generatedAt, asOf: input.asOf,
    synthetic: !!input.synthetic || research.some((r) => r.synthetic),
    baseline: b, stages, returns, geography: geo?.coverage ?? null, methods, reporting, outstanding, shadow, published, reportingOrder,
    confidence, confidenceReasons: reasons, missingResearch,
  };
}

const NEEDS: Record<ComponentKey, string> = {
  reporting: "VERIFIED 2026 poll closing times and historical reporting windows by method",
  outstanding: "a turnout expectation with a low and high for the race, and receipt and cure deadlines",
  geography: "county-to-district crosswalk (GEO_SPLIT) for the district",
  methods: "historical votes by method (METHOD_HISTORY)",
};

export function missingInputs(entry: { raceId: string; office: Office; state: string }, research: ResearchRecord[]): { component: ComponentKey; need: string }[] {
  const cov = researchCoverage(entry, research);
  const out: { component: ComponentKey; need: string }[] = [];
  for (const k of Object.keys(cov) as ComponentKey[]) {
    if (cov[k] === "MISSING" || cov[k] === "PARTIAL") out.push({ component: k, need: `${cov[k] === "PARTIAL" ? "incomplete: " : ""}${k === "geography" ? `${NEEDS.geography.replace("the district", districtIdOf(entry.raceId) ?? "the district")}` : NEEDS[k]}` });
  }
  return out;
}

/**
 * Confidence in the shadow output, by rule. HIGH is not reachable in Phase 1: nothing here has been backtested.
 * MEDIUM needs every input to be measured or officially stated; anything estimated, unquantified or missing is LOW;
 * a failed stage or an unavailable projection is NONE.
 */
export function assessConfidence(stages: Stage[], geo: GeoCoverage | null, inv: OutstandingInventory | null, shadow: ShadowProjection | null): { confidence: Confidence; reasons: string[] } {
  const reasons: string[] = ["HIGH is reserved for a backtested model; Phase 1 is not backtested"];
  if (stages.some((s) => s.status === "FAILED")) return { confidence: "NONE", reasons: [...reasons, "a pipeline stage failed"] };
  if (!shadow || shadow.status === "UNAVAILABLE") return { confidence: "NONE", reasons: [...reasons, "the shadow projection is unavailable"] };
  const low: string[] = [];
  if (!inv || inv.uncertainty !== "QUANTIFIED") low.push("turnout uncertainty is not quantified");
  if (inv && inv.turnoutBasis.evidenceClass !== "VERIFIED") low.push("turnout expectation is an estimate, not an official figure");
  if (inv?.unknownInventory) low.push("no official statement of outstanding ballots");
  if (geo && (geo.unknownMembership.length || geo.votesUnallocated > 0 || !geo.crosswalkAvailable)) low.push("geography is incomplete");
  if (shadow.status !== "AVAILABLE") low.push(`shadow projection is ${shadow.status}`);
  if (low.length) return { confidence: "LOW", reasons: [...reasons, ...low] };
  return { confidence: "MEDIUM", reasons };
}
