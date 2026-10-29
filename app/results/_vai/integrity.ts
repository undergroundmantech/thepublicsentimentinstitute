// T3: feed integrity on top of the intelligence layer's append-only log. Pure: no I/O, no clock, no scheduler.
//
// The intelligence layer already does the hard part (app/lib/intelligence/observations.ts): readings are appended and
// never rewritten, ordered by the source's own timestamp, the newest reading per jurisdiction/method/scope wins, and
// a topline is never added to its own parts. This module does not repeat any of that. It adds what VAI needs on top:
//   - the schema §3.1 flags, including candidate-level downward revisions (the intelligence check looks at totals);
//   - the split of reported votes into counties the forecast knows, an unmatched pseudo-county and a topline residual,
//     so that no vote ever disappears: reported = counties + unmatched + residual, exactly;
//   - coverage and source freshness.
// Precincts reporting is carried through as metadata and is never read as a number.

import { appendObservations, latestReadings, totalsFrom } from "../../lib/intelligence/observations";
import type { Issue, LoggedObservation, Sides, VoteObservation } from "../../lib/intelligence/types";
import type { IntegrityFinding, IntegrityFlag, VaiReturnsFrame } from "./types";

export const DEFAULT_STALE_AFTER_MINUTES = 30;
export const DEFAULT_COVERAGE_FLOOR = 0.98;

export interface IntegrityOptions {
  /** County keys in the forecast county file for this race. Null when the race has no county file. */
  countyUniverse: ReadonlySet<string> | null;
  staleAfterMinutes?: number;
  coverageFloor?: number;
  /** Latest source time seen anywhere on the provider. With it, a race is stale only if the provider moved on. */
  providerLatestSourceTimestamp?: string | null;
  /** The last fetch for this race failed. */
  fetchError?: boolean;
  /** Upper bound per county (q99 of expected turnout). A county above it is flagged TOTAL_EXCEEDS_EXPECTED. */
  expectedMax?: Readonly<Record<string, number>>;
}

const ZERO: Sides = { a: 0, b: 0, o: 0 };
const add = (x: Sides, y: Sides): Sides => ({ a: x.a + y.a, b: x.b + y.b, o: x.o + y.o });
const sub = (x: Sides, y: Sides): Sides => ({ a: x.a - y.a, b: x.b - y.b, o: x.o - y.o });
const tot = (s: Sides) => s.a + s.b + s.o;
const keyOf = (o: VoteObservation) => `${o.jurisdictionId}|${o.method}|${o.scope}`;
const timeOf = (o: VoteObservation) => Date.parse(o.sourceTimestamp ?? o.retrievedAt);

/** Intelligence issue codes that correspond to a schema §3.1 flag. Codes not listed stay in intelIssues only. */
const INTEL_TO_FLAG: Record<string, IntegrityFlag> = {
  DUPLICATE_READING: "DUPLICATE_READING",
  OUT_OF_ORDER: "OUT_OF_ORDER",
  NO_SOURCE_TIMESTAMP: "NO_SOURCE_TIME",
  CONTRADICTORY_READINGS: "CONTRADICTORY_READINGS",
  CONTRADICTORY_METADATA: "CONTRADICTORY_READINGS",
  METHOD_SUM_MISMATCH: "METHOD_SUM_MISMATCH",
  METHOD_SUM_EXCEEDS_TOTAL: "METHOD_SUM_MISMATCH",
  JURISDICTION_SUM_EXCEEDS_TOPLINE: "JURISDICTION_SUM_EXCEEDS_TOPLINE",
  INVALID_VOTES: "INVALID_READING",
  INVALID_DATE: "INVALID_READING",
};

function fromIntel(i: Issue): IntegrityFinding | null {
  const flag = INTEL_TO_FLAG[i.code];
  if (!flag) return null;
  const head = i.message.split(/[ :]/)[0];
  const jurisdictionId = head.includes("|") ? head.split("|")[0] : null;
  return { flag, severity: i.severity, jurisdictionId, message: i.message };
}

/**
 * Append a batch to the log through the intelligence layer. Duplicates and invalid readings are refused there and
 * reported here as flags; nothing already in the log changes.
 */
export function ingest(log: readonly LoggedObservation[], batch: { observation: VoteObservation; raw: unknown }[]): { log: LoggedObservation[]; findings: IntegrityFinding[] } {
  const r = appendObservations(log, batch);
  return { log: r.log, findings: r.issues.map(fromIntel).filter((f): f is IntegrityFinding => f !== null) };
}

/** Candidate-level downward revisions between consecutive readings of one key, by source time. Same-time pairs are contradictions, not revisions, and the intelligence layer reports them. */
function downwardRevisions(entries: LoggedObservation[]): IntegrityFinding[] {
  const groups = new Map<string, LoggedObservation[]>();
  for (const e of entries) groups.set(keyOf(e.observation), [...(groups.get(keyOf(e.observation)) ?? []), e]);
  const out: IntegrityFinding[] = [];
  for (const [k, es] of groups) {
    const byTime = [...es].sort((x, y) => timeOf(x.observation) - timeOf(y.observation) || x.seq - y.seq);
    for (let i = 1; i < byTime.length; i++) {
      const p = byTime[i - 1].observation, c = byTime[i].observation;
      if (timeOf(p) === timeOf(c)) continue;
      const fell = (["a", "b", "o"] as const).filter((s) => c.sides[s] < p.sides[s]);
      if (fell.length || tot(c.sides) < tot(p.sides)) {
        const what = fell.map((s) => `${s} ${p.sides[s]}→${c.sides[s]}`).join(", ");
        out.push({ flag: "DOWNWARD_REVISION", severity: "WARNING", jurisdictionId: c.jurisdictionId, message: `${k}: revised down at ${c.sourceTimestamp ?? c.retrievedAt} (${what || `total ${tot(p.sides)}→${tot(c.sides)}`}); the newer reading is used and both stay in the log` });
      }
    }
  }
  return out;
}

/** The race's returns at `asOf`, split so that every reported vote is accounted for, with integrity flags. */
export function reconcile(log: readonly LoggedObservation[], raceId: string, asOf: string, opts: IntegrityOptions): VaiReturnsFrame {
  const cutoff = Date.parse(asOf);
  const staleAfterMinutes = opts.staleAfterMinutes ?? DEFAULT_STALE_AFTER_MINUTES;
  const findings: IntegrityFinding[] = [];

  const mine = log.filter((e) => e.observation.raceId === raceId);
  const testExcluded = mine.filter((e) => e.observation.test).length;
  const live = mine.filter((e) => !e.observation.test);
  const afterAsOf = live.filter((e) => timeOf(e.observation) > cutoff).length;
  if (testExcluded) findings.push({ flag: "TEST_DATA", severity: "INFO", jurisdictionId: null, message: `${testExcluded} test reading(s) excluded from every figure` });

  const lr = latestReadings(log, raceId, asOf, { includeTest: false });
  const tr = totalsFrom(lr.readings, asOf, lr.ignored);
  const intelIssues = [...lr.issues, ...tr.issues];
  for (const i of intelIssues) {
    const f = fromIntel(i);
    if (f) findings.push(f);
  }
  findings.push(...downwardRevisions(live.filter((e) => timeOf(e.observation) <= cutoff)));

  const ret = tr.returns;
  const counties: VaiReturnsFrame["counties"] = {};
  const unmatchedIds: string[] = [];
  let countySum = ZERO, unmatched = ZERO;
  for (const [j, v] of Object.entries(ret.byJurisdiction).sort(([x], [y]) => x.localeCompare(y))) {
    const known = opts.countyUniverse === null ? v.level === "COUNTY" : opts.countyUniverse.has(j);
    if (known) {
      counties[j] = { sides: v.sides, t: v.t, level: v.level, sourceTimestamp: v.sourceTimestamp, precinctsReportingPct: v.precinctsReportingPct };
      countySum = add(countySum, v.sides);
      const cap = opts.expectedMax?.[j];
      if (cap !== undefined && v.t > cap) findings.push({ flag: "TOTAL_EXCEEDS_EXPECTED", severity: "WARNING", jurisdictionId: j, message: `${j}: ${v.t} reported, above the expected maximum ${cap}` });
    } else {
      unmatchedIds.push(j);
      unmatched = add(unmatched, v.sides);
      findings.push({ flag: "UNMATCHED_REGION", severity: "WARNING", jurisdictionId: j, message: `${j}: ${v.t} votes from a unit the county file does not list; kept in the unmatched pseudo-county` });
    }
  }
  const reportedSides: Sides = { a: ret.reported.a, b: ret.reported.b, o: ret.reported.o };
  const residual = sub(sub(reportedSides, countySum), unmatched);
  const reportedT = ret.reported.t;
  const coverage = reportedT > 0 ? tot(countySum) / reportedT : null;
  const floor = opts.coverageFloor ?? DEFAULT_COVERAGE_FLOOR;
  if (coverage !== null && coverage < floor) findings.push({ flag: "LOW_COVERAGE", severity: "WARNING", jurisdictionId: null, message: `known counties hold ${(100 * coverage).toFixed(1)}% of reported votes (floor ${(100 * floor).toFixed(0)}%)` });

  // Freshness uses the source's own timestamps only; retrieval time says nothing about when the count moved.
  const stamped = lr.readings.map((r) => r.observation.sourceTimestamp).filter((s): s is string => s !== null).map((s) => Date.parse(s));
  const latest = stamped.length ? Math.max(...stamped) : null;
  const ageMinutes = latest === null ? null : (cutoff - latest) / 60000;
  let status: VaiReturnsFrame["freshness"]["status"] = lr.readings.length === 0 ? "NO_DATA" : latest === null ? "NO_SOURCE_TIME" : "FRESH";
  if (latest !== null && ageMinutes !== null && ageMinutes > staleAfterMinutes) {
    const provider = opts.providerLatestSourceTimestamp ? Date.parse(opts.providerLatestSourceTimestamp) : null;
    if (provider === null || provider - latest > staleAfterMinutes * 60000) status = "STALE";
  }
  if (opts.fetchError && lr.readings.length > 0) status = "STALE";
  if (status === "STALE") findings.push({ flag: "STALE_FEED", severity: "WARNING", jurisdictionId: null, message: opts.fetchError ? "the last fetch failed; figures are frozen as last read" : `no new source time for ${ageMinutes?.toFixed(0)} minutes` });

  return {
    raceId, asOf,
    reported: { ...reportedSides, t: reportedT, label: "VERIFIED" },
    basis: ret.basis,
    counties,
    unmatched: { jurisdictionIds: unmatchedIds, sides: unmatched, t: tot(unmatched) },
    residual: { sides: residual, t: tot(residual) },
    coverage,
    freshness: { status, latestSourceTimestamp: latest === null ? null : new Date(latest).toISOString(), ageMinutes, staleAfterMinutes },
    findings,
    counts: { used: lr.readings.length, superseded: live.length - afterAsOf - lr.readings.length, testExcluded, afterAsOf },
    intelIssues,
  };
}

export const flagsOf = (f: { findings: IntegrityFinding[] }) => [...new Set(f.findings.map((x) => x.flag))].sort();
