// Canonical snapshots: provider responses turned into the engine's observation contract, with provenance.
// Pure. The server route does the fetching; nothing here reads a clock or the network.
import { matchCivic, type CRace, type XIndex } from "../../results/2026/live";
import { candidateId } from "../../results/2026/candidates";
import { canonicalJson, fnv64 } from "./rng";
import type { DataMode, ElectionSnapshot, ObservedCandidate, ObservedUnit, RaceObservation } from "./types";

/** civicAPI's raw race (search entry or /race/{id}), as far as the engine reads it. Unknown fields are ignored. */
export type CivicRawCandidate = { name?: string; party?: string | null; votes?: number | null; winner?: boolean; id?: string | number | null; candidate_id?: string | number | null };
export type CivicRawRace = {
  id: number; type?: string; election_type?: string; province?: string; district?: string | null; election_name?: string;
  percent_reporting?: number | null; candidates?: CivicRawCandidate[]; test_data?: boolean; last_updated?: string | null;
  called_at?: string | null;
  region_results?: Record<string, { name?: string; fips?: string; type?: string | null; percent_reporting?: number | null; candidates?: CivicRawCandidate[];
    /** when this row's figures last changed, where the source knows it */ last_changed?: string | null }>;
};
/** One race's county forecast: FIPS -> [side A votes, side B votes, other votes, total] (raceModel's UnitBaseline). */
export type CountyBaseline = Record<string, readonly [number, number, number, number]>;
export type CountyContext = { baselines: Record<string, CountyBaseline>; /** FIPS -> county name, for rows the provider sends without a FIPS code */ names?: Record<string, string> };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
const upId = (c: CivicRawCandidate) => c.id ?? c.candidate_id ?? null;

function candidates(raceId: string, cs: CivicRawCandidate[] | undefined): ObservedCandidate[] {
  return (cs ?? []).map((c) => ({ candidateId: candidateId(raceId, c.name ?? "", upId(c)), name: c.name ?? "", partyRaw: c.party == null || String(c.party).trim() === "" ? null : String(c.party), votes: num(c.votes), providerWinner: !!c.winner }));
}
function units(raceId: string, raw: CivicRawRace, cands: ObservedCandidate[]): ObservedUnit[] | null {
  if (!raw.region_results || !Object.keys(raw.region_results).length) return null;
  return Object.entries(raw.region_results).map(([k, v]) => {
    const cs = candidates(raceId, v.candidates); const votes: Record<string, number | null> = {};
    // a county's candidate is the race's candidate with the same id (provider id, else race + name)
    for (const c of cs) votes[cands.find((x) => x.candidateId === c.candidateId)?.candidateId ?? c.candidateId] = c.votes;
    return { unitId: String(v.fips ?? k), name: v.name ?? null, providerPctReporting: num(v.percent_reporting), votes, methodSource: "UNKNOWN" as const };
  });
}

const nk = (x: string) => x.toLowerCase().replace(/[^a-z0-9]/g, "");
const nkShort = (x: string) => nk(x.replace(/\b(county|parish|borough|census area|municipality|city and borough)\b/gi, ""));
/** Share of the race total that the county rows must account for before the race is modeled county by county. */
export const COUNTY_RECONCILE = 0.005;
/** Share of the forecast's counties that must appear as county rows. */
export const COUNTY_COVERAGE = 0.9;
/**
 * The provider's county rows as the engine's units, for a race that has a county forecast. A row is a county when its
 * FIPS code is in the forecast, or, where the provider sends none (Virginia's cities, a few counties), when its name
 * is the name of exactly one forecast county not already taken. Town, precinct, district and statewide rows match
 * nothing and are left out. The rows are used only when together they account for the race total (within
 * COUNTY_RECONCILE): New Hampshire and Vermont report by town, Alaska by its own districts, and those races stay on
 * the race total. So does any race whose rows do not say when they last changed: the county model reads how long a
 * county has been quiet, and a single live read of the provider does not carry that. Returns null in each of these
 * cases, and the race is modeled from its total exactly as before.
 */
export function countyUnits(raceId: string, raw: CivicRawRace, cands: ObservedCandidate[], base: CountyBaseline, names: Record<string, string> = {}): ObservedUnit[] | null {
  const rows = Object.entries(raw.region_results ?? {}); if (!rows.length) return null;
  const byName = new Map<string, string | null>();
  for (const f of Object.keys(base)) { const n = names[f]; if (!n) continue; for (const k of new Set([nk(n), nkShort(n)])) byName.set(k, byName.has(k) ? null : f); }
  const taken = new Set<string>(); const pick: [string, (typeof rows)[number][1]][] = [];
  for (const [, v] of rows) if (v.fips && v.fips in base && !taken.has(v.fips)) { taken.add(v.fips); pick.push([v.fips, v]); }
  for (const [k, v] of rows) {
    if (v.fips && v.fips in base) continue;
    if (v.type && !/^(county|city|parish|borough)$/i.test(v.type)) continue;
    const n = v.name ?? k; const f = byName.get(nk(n)) ?? byName.get(nkShort(n));
    if (f && !taken.has(f)) { taken.add(f); pick.push([f, v]); }
  }
  // most of the forecast's counties must be there as county rows, each with the time it last changed (county mode reads quiet time)
  if (pick.length < COUNTY_COVERAGE * Object.keys(base).length || pick.some(([, v]) => !v.last_changed)) return null;
  const out = pick.map(([fips, v]) => {
    const cs = candidates(raceId, v.candidates); const votes: Record<string, number | null> = {};
    for (const c of cs) votes[cands.find((x) => x.candidateId === c.candidateId)?.candidateId ?? c.candidateId] = c.votes;
    return { unitId: fips, name: v.name ?? names[fips] ?? null, providerPctReporting: num(v.percent_reporting), votes, methodSource: "UNKNOWN" as const, ...(v.last_changed ? { quietSince: v.last_changed } : {}) };
  });
  const top = cands.reduce((a, c) => a + (c.votes ?? 0), 0), sum = out.reduce((a, u) => a + Object.values(u.votes).reduce((t: number, x) => t + (x ?? 0), 0), 0);
  if (Math.abs(sum - top) > Math.max(10, COUNTY_RECONCILE * top)) return null;
  // every vote in a county row must belong to a candidate of the race
  const ids = new Set(cands.map((c) => c.candidateId)); if (out.some((u) => Object.keys(u.votes).some((id) => !ids.has(id) && (u.votes[id] ?? 0) > 0))) return null;
  return out.sort((a, b) => (a.unitId < b.unitId ? -1 : 1));
}

/** One observation for one forecast race. `receivedAt` is when the server read the provider. */
/** A row that is a total of other rows, not a county: "All Counties", "Statewide", "Total". */
const AGGREGATE_ROW = /^(all\b|total\b|statewide\b|state ?wide total|entire state)/i;
/**
 * Does the provider's race total agree with its own county rows? Two faults are looked for, both seen on November 3,
 * 2026, when New York's feed listed an "All Counties" row beside the counties and the race totals added both, so a
 * race read twice its real count from its first report:
 *   a total row listed among the county rows, and the race total above the counties' sum;
 *   a race total far above the sum of its county rows (TOPLINE_OVER_ROWS times or more).
 * The opposite (rows summing to more than the total) is normal where a state lists towns and counties, and is ignored.
 * Returns the faults in words; empty when there are none or the provider sent no rows.
 */
export const TOPLINE_OVER_ROWS = 1.25;
export function rowIntegrity(raw: CivicRawRace): string[] {
  const rows = Object.values(raw.region_results ?? {}); if (rows.length < 1) return [];
  const sum = (cs: CivicRawRace["candidates"]) => (cs ?? []).reduce((a, c) => a + (num(c.votes) ?? 0), 0);
  const top = sum(raw.candidates); if (top <= 0) return [];
  const agg = rows.filter((r) => AGGREGATE_ROW.test((r.name ?? "").trim())), plain = rows.filter((r) => !AGGREGATE_ROW.test((r.name ?? "").trim()));
  const plainSum = plain.reduce((a, r) => a + sum(r.candidates), 0); const out: string[] = [];
  if (agg.length && plain.length && plainSum > 0 && top > 1.05 * plainSum) out.push(`the provider lists a total row ("${(agg[0].name ?? "").trim()}") among the county rows, and its race total (${top.toLocaleString("en-US")}) is above the counties' sum (${plainSum.toLocaleString("en-US")})`);
  else if (plain.length && plainSum > 0 && top > TOPLINE_OVER_ROWS * plainSum) out.push(`the provider's race total (${top.toLocaleString("en-US")}) is ${(top / plainSum).toFixed(2)} times the sum of its county rows (${plainSum.toLocaleString("en-US")})`);
  return out;
}

export function observe(raceId: string, raw: CivicRawRace, receivedAt: string, withUnits = false, county?: CountyContext): RaceObservation {
  const cands = candidates(raceId, raw.candidates); const integrity = rowIntegrity(raw);
  const base = county?.baselines[raceId];
  return { raceId, providerRaceId: raw.id, candidates: cands, providerPctReporting: num(raw.percent_reporting), units: base && !integrity.length ? countyUnits(raceId, raw, cands, base, county?.names) : withUnits ? units(raceId, raw, cands) : null,
    sourceAsOf: raw.last_updated ?? null, receivedAt, test: !!raw.test_data, ...(raw.called_at ? { providerCalledAt: raw.called_at } : {}), ...(integrity.length ? { integrity } : {}) };
}

/** Before polls close the provider publishes test returns: their counts are blanked, never shown or modeled as votes. */
export function blankTestCounts(o: RaceObservation): RaceObservation {
  return { ...o, test: true, providerPctReporting: 0, candidates: o.candidates.map((c) => ({ ...c, votes: 0, providerWinner: false })), units: null };
}

/**
 * A snapshot of the provider's race search. Races are matched to the forecast exactly as the pages match them
 * (matchCivic), so the engine and the pages agree on which provider race is which. The id is a hash of the
 * observations only, so two reads with the same data have the same id, and a different read time changes nothing.
 */
export function snapshotFromCivic(index: XIndex, raws: CivicRawRace[], o: { receivedAt: string; mode: Exclude<DataMode, "SIMULATED">; source: string; blankTest?: boolean;
  /** county forecasts: a race that has one, and whose county rows the provider sent with this read, is observed county by county */ county?: CountyContext }): ElectionSnapshot {
  const trimmed: CRace[] = raws.map((x) => ({ id: x.id, type: x.type ?? x.election_type ?? "", province: x.province ?? "", district: x.district ?? null, name: x.election_name ?? "", pr: x.percent_reporting ?? 0,
    c: (x.candidates ?? []).map((c) => [c.name ?? "", c.party ?? "", c.votes ?? 0, 0, c.winner ? 1 : 0, null]) }));
  const m = matchCivic(index.races, trimmed); const byId = new Map(raws.map((x) => [x.id, x]));
  const races: Record<string, RaceObservation> = {}; const used = new Set<number>();
  for (const [rid, cr] of Object.entries(m)) { const raw = byId.get(cr.id)!; used.add(cr.id); let ob = observe(rid, raw, o.receivedAt, false, o.county); if (o.blankTest && ob.test) ob = blankTestCounts(ob); races[rid] = ob; }
  const content = Object.keys(races).sort().map((k) => ({ k, c: races[k].candidates.map((c) => [c.candidateId, c.votes, c.providerWinner]), pr: races[k].providerPctReporting, t: races[k].test,
    ...(races[k].units ? { u: races[k].units!.map((u) => [u.unitId, u.providerPctReporting, u.quietSince ?? null, Object.keys(u.votes).sort().map((id) => [id, u.votes[id]])]) } : {}) }));
  return { snapshotId: `${o.mode.toLowerCase()}-${fnv64(canonicalJson(content))}`, provenance: { mode: o.mode, source: o.source, sourceAsOf: null, receivedAt: o.receivedAt, usesFutureObservation: false, synthetic: false },
    races, unmatchedProviderRaces: raws.filter((x) => !used.has(x.id)).length };
}
