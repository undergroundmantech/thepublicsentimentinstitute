// Live returns: an append-only log of raw readings, point-in-time reconciliation, and totals that never count the
// same ballot twice.
//
// Rules
//  - The log is never rewritten. A revision is a new reading; the raw payload of every reading is kept.
//  - Readings are ordered by the source's own timestamp, not by arrival, so an out-of-order delivery cannot roll the
//    count back. Readings with no source timestamp fall back to retrieval time, and that is flagged.
//  - A race total is the topline when there is one. Jurisdiction figures are only summed when there is no topline,
//    and a jurisdiction's method breakdown is never added to that jurisdiction's own total.
//  - Precincts reporting is carried as metadata. Nothing here reads it as a share of votes counted.

import { sides as liveSides, type CDetail, type XRace } from "../../results/2026/live";
import type { Issue, JurisdictionLevel, LoggedObservation, ReconciledReturns, Sides, VoteObservation, VotingMethod } from "./types";

const tsOf = (o: VoteObservation) => Date.parse(o.sourceTimestamp ?? o.retrievedAt);
const totalOf = (s: Sides) => s.a + s.b + s.o;
const keyOf = (o: VoteObservation) => `${o.jurisdictionId}|${o.method}|${o.scope}`;

function checkObservation(o: VoteObservation): Issue | null {
  for (const k of ["a", "b", "o"] as const) {
    const v = o.sides[k];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return { code: "INVALID_VOTES", severity: "ERROR", message: `${o.raceId} ${o.jurisdictionId}: side ${k} is ${String(v)}` };
  }
  if (!Number.isFinite(Date.parse(o.retrievedAt))) return { code: "INVALID_DATE", severity: "ERROR", message: `${o.raceId} ${o.jurisdictionId}: retrievedAt is not a date` };
  if (o.sourceTimestamp !== null && !Number.isFinite(Date.parse(o.sourceTimestamp))) return { code: "INVALID_DATE", severity: "ERROR", message: `${o.raceId} ${o.jurisdictionId}: sourceTimestamp is not a date` };
  return null;
}

/** Append a batch to the log. Returns a new array; the readings already logged are untouched. */
export function appendObservations(log: readonly LoggedObservation[], batch: { observation: VoteObservation; raw: unknown }[]): { log: LoggedObservation[]; issues: Issue[] } {
  const out = [...log];
  const issues: Issue[] = [];
  let seq = log.length ? log[log.length - 1].seq + 1 : 1;
  for (const { observation, raw } of batch) {
    const bad = checkObservation(observation);
    if (bad) { issues.push(bad); continue; }
    const dup = out.some((e) => keyOf(e.observation) === keyOf(observation) && e.observation.raceId === observation.raceId && e.observation.sourceTimestamp !== null && e.observation.sourceTimestamp === observation.sourceTimestamp && totalOf(e.observation.sides) === totalOf(observation.sides) && e.observation.sides.a === observation.sides.a && e.observation.sides.b === observation.sides.b);
    if (dup) { issues.push({ code: "DUPLICATE_READING", severity: "INFO", message: `${observation.raceId} ${observation.jurisdictionId} ${observation.sourceTimestamp}: identical reading already logged` }); continue; }
    out.push({ seq: seq++, observation, raw });
  }
  return { log: out, issues };
}

export interface Reading {
  observation: VoteObservation;
  seq: number;
  t: number;
}

/** The latest reading per jurisdiction, method and scope, as known at `asOf`. */
export function latestReadings(log: readonly LoggedObservation[], raceId: string, asOf: string, opts: { includeTest?: boolean } = {}): { readings: Reading[]; issues: Issue[]; ignored: number } {
  const cutoff = Date.parse(asOf);
  const issues: Issue[] = [];
  const groups = new Map<string, LoggedObservation[]>();
  let ignored = 0, noTs = 0;
  for (const e of log) {
    const o = e.observation;
    if (o.raceId !== raceId) continue;
    if (o.test && !opts.includeTest) { ignored++; continue; }
    if (tsOf(o) > cutoff) { ignored++; continue; }
    if (o.sourceTimestamp === null) noTs++;
    const k = keyOf(o);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  if (noTs) issues.push({ code: "NO_SOURCE_TIMESTAMP", severity: "WARNING", message: `${noTs} reading(s) carry no source timestamp; ordered by retrieval time instead` });
  const readings: Reading[] = [];
  for (const [k, es] of groups) {
    const bySeq = [...es].sort((x, y) => x.seq - y.seq);
    const byTime = [...es].sort((x, y) => tsOf(x.observation) - tsOf(y.observation) || x.seq - y.seq);
    if (bySeq.some((e, i) => e !== byTime[i])) issues.push({ code: "OUT_OF_ORDER", severity: "WARNING", message: `${k}: readings arrived out of order; ordered by source timestamp` });
    for (let i = 1; i < byTime.length; i++) {
      const p = byTime[i - 1].observation, c = byTime[i].observation;
      const sameTime = tsOf(p) === tsOf(c);
      if (sameTime && totalOf(p.sides) !== totalOf(c.sides)) issues.push({ code: "CONTRADICTORY_READINGS", severity: "WARNING", message: `${k}: two readings stamped ${c.sourceTimestamp ?? c.retrievedAt} disagree (${totalOf(p.sides)} vs ${totalOf(c.sides)}); the later retrieval is used` });
      else if (totalOf(c.sides) < totalOf(p.sides)) issues.push({ code: "REVISION_DOWN", severity: "WARNING", message: `${k}: count revised down by ${totalOf(p.sides) - totalOf(c.sides)} at ${c.sourceTimestamp ?? c.retrievedAt}` });
    }
    const last = byTime[byTime.length - 1];
    readings.push({ observation: last.observation, seq: last.seq, t: tsOf(last.observation) });
    ignored += es.length - 1;
  }
  readings.sort((x, y) => x.observation.jurisdictionId.localeCompare(y.observation.jurisdictionId) || x.observation.method.localeCompare(y.observation.method));
  return { readings, issues, ignored };
}

const isTopline = (lvl: JurisdictionLevel) => lvl === "STATE" || lvl === "DISTRICT";
const add = (x: Sides, y: Sides): Sides => ({ a: x.a + y.a, b: x.b + y.b, o: x.o + y.o });
const ZERO: Sides = { a: 0, b: 0, o: 0 };

/**
 * One figure per jurisdiction: the UNKNOWN-method total and the sum of the method breakdown describe the same
 * ballots, so the newer of the two is used, never both.
 */
function collapseMethods(rs: Reading[], issues: Issue[], label: string): { sides: Sides; t: number; latest: number; methods: Partial<Record<VotingMethod, Sides>> } {
  const total = rs.find((r) => r.observation.method === "UNKNOWN");
  const parts = rs.filter((r) => r.observation.method !== "UNKNOWN");
  const methods: Partial<Record<VotingMethod, Sides>> = {};
  for (const p of parts) methods[p.observation.method] = add(methods[p.observation.method] ?? ZERO, p.observation.sides);
  const partSum = parts.reduce((s, p) => add(s, p.observation.sides), ZERO);
  const partLatest = parts.reduce((m, p) => Math.max(m, p.t), -Infinity);
  if (total && parts.length) {
    const tt = totalOf(total.observation.sides), ps = totalOf(partSum);
    if (tt !== ps) issues.push({ code: "METHOD_SUM_MISMATCH", severity: "WARNING", message: `${label}: method breakdown sums to ${ps} but the total reads ${tt}; the newer figure is used` });
    if (partLatest > total.t) return { sides: partSum, t: ps, latest: partLatest, methods };
    return { sides: total.observation.sides, t: tt, latest: total.t, methods };
  }
  if (total) return { sides: total.observation.sides, t: totalOf(total.observation.sides), latest: total.t, methods };
  return { sides: partSum, t: totalOf(partSum), latest: partLatest, methods };
}

/** Race totals from admissible readings. */
export function totalsFrom(readings: Reading[], asOf: string, ignored: number): { returns: ReconciledReturns; issues: Issue[] } {
  const issues: Issue[] = [];
  const top = readings.filter((r) => isTopline(r.observation.jurisdictionLevel));
  const sub = readings.filter((r) => !isTopline(r.observation.jurisdictionLevel));
  const byJ = new Map<string, Reading[]>();
  for (const r of sub) byJ.set(r.observation.jurisdictionId, [...(byJ.get(r.observation.jurisdictionId) ?? []), r]);

  const byJurisdiction: ReconciledReturns["byJurisdiction"] = {};
  let subSum = ZERO;
  const subMethods: Partial<Record<VotingMethod, Sides>> = {};
  for (const [j, rs] of byJ) {
    const c = collapseMethods(rs, issues, j);
    const o = rs[0].observation;
    const newest = rs.reduce((m, r) => (r.t > m.t ? r : m), rs[0]).observation;
    byJurisdiction[j] = { sides: c.sides, t: c.t, scope: o.scope, level: o.jurisdictionLevel, sourceTimestamp: newest.sourceTimestamp, precinctsReportingPct: newest.precinctsReportingPct };
    subSum = add(subSum, c.sides);
    for (const [m, s] of Object.entries(c.methods)) subMethods[m as VotingMethod] = add(subMethods[m as VotingMethod] ?? ZERO, s);
  }

  let reported: Sides, basis: ReconciledReturns["basis"], methods: Partial<Record<VotingMethod, Sides>>;
  if (top.length) {
    const ids = new Set(top.map((r) => r.observation.jurisdictionId));
    if (ids.size > 1) issues.push({ code: "CONTRADICTORY_METADATA", severity: "WARNING", message: `more than one topline jurisdiction (${[...ids].join(", ")}); the newest is used` });
    const newestId = top.reduce((m, r) => (r.t > m.t ? r : m), top[0]).observation.jurisdictionId;
    const c = collapseMethods(top.filter((r) => r.observation.jurisdictionId === newestId), issues, "topline");
    reported = c.sides; basis = "TOPLINE";
    methods = Object.keys(c.methods).length ? c.methods : subMethods;
    if (totalOf(subSum) > c.t) issues.push({ code: "JURISDICTION_SUM_EXCEEDS_TOPLINE", severity: "WARNING", message: `jurisdictions add to ${totalOf(subSum)} but the topline reads ${c.t}; the topline is used` });
  } else if (sub.length) {
    reported = subSum; basis = "JURISDICTION_SUM"; methods = subMethods;
  } else {
    reported = ZERO; basis = "NONE"; methods = {};
  }

  const t = totalOf(reported);
  const byMethod: ReconciledReturns["byMethod"] = {};
  let known = 0;
  for (const [m, s] of Object.entries(methods)) { byMethod[m as VotingMethod] = { t: totalOf(s), sides: s }; known += totalOf(s); }
  if (known > t) issues.push({ code: "METHOD_SUM_EXCEEDS_TOTAL", severity: "WARNING", message: `method figures add to ${known}, more than the ${t} reported` });
  else if (t > known) byMethod.UNKNOWN = { t: t - known, sides: null };

  const latest = readings.reduce((m, r) => Math.max(m, r.t), -Infinity);
  return {
    returns: {
      asOf, reported: { ...reported, t }, basis, byJurisdiction, byMethod,
      latestSourceTimestamp: Number.isFinite(latest) ? new Date(latest).toISOString() : null,
      observationsUsed: readings.length, observationsIgnored: ignored,
    },
    issues,
  };
}

// ---- adapters -----------------------------------------------------------------------------------------------------

/**
 * Read a civicAPI race (as /api/civic/race/[id] trims it) into observations. civicAPI gives no method breakdown, so
 * every reading is method UNKNOWN. For a House race its county regions are the district's portion of each county.
 */
export function fromCivicDetail(race: XRace, d: CDetail, retrievedAt: string, sourceUrl: string | null): { observation: VoteObservation; raw: unknown }[] {
  const house = race.k === "house";
  const ts = d.updated && Number.isFinite(Date.parse(d.updated)) ? new Date(d.updated).toISOString() : null;
  const mk = (jurisdictionId: string, level: JurisdictionLevel, scope: VoteObservation["scope"], c: CDetail["c"], pr: number | null, raw: unknown) => {
    const s = liveSides(race, c);
    return {
      observation: { raceId: race.id, jurisdictionId, jurisdictionLevel: level, scope, method: "UNKNOWN" as const, sides: { a: s.a, b: s.b, o: s.o }, precinctsReportingPct: pr, sourceTimestamp: ts, retrievedAt, source: "civicAPI", sourceUrl, test: d.test },
      raw,
    };
  };
  const out = [mk(house ? (race.civ.d ?? "DISTRICT") : "STATE", house ? "DISTRICT" : "STATE", "WHOLE", d.c, d.pr ?? null, { ...d, regions: undefined })];
  for (const [k, g] of Object.entries(d.regions ?? {})) {
    const county = /^\d{5}$/.test(k);
    out.push(mk(county ? k : `TOWN:${g.n}`, county ? "COUNTY" : "TOWN", house ? "DISTRICT_PORTION" : "WHOLE", g.c, g.pr ?? null, g));
  }
  return out;
}
