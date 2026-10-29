// Geographic reconciliation: which readings belong to the race's geography, and how sure we are of it.
//
// A statewide race contains every county of its state whole. A congressional district does not: a county split
// between districts contributes only its district portion. Without a county-to-district crosswalk, a whole-county
// figure is never allocated to a district; it is left unallocated and reported as such. A crosswalk weight measures
// population or registration, not votes, so a weight-based allocation is shown as an estimate and is never added to
// the reported count.

import { AT_LARGE_STATES, districtIdOf } from "./baseline";
import type { Reading } from "./observations";
import type { GeoCoverage, GeoSplitRecord, Issue, Office } from "./types";

/** A county whose weight is at least this is treated as wholly inside the district (rounding in published crosswalks). */
const WHOLE_COUNTY_WEIGHT = 0.999;

export interface GeoInput {
  raceId: string;
  office: Office;
  state: string;
  /** Jurisdictions the race is expected to report from, e.g. the county keys of the forecast's state file. Null if not known. */
  expectedJurisdictions: string[] | null;
  splits: GeoSplitRecord[];
}

const sum = (r: Reading) => r.observation.sides.a + r.observation.sides.b + r.observation.sides.o;
/** One jurisdiction's votes: its total reading, or its method parts, whichever is larger; never both added. */
function jurisdictionVotes(rs: Reading[]): number {
  const total = rs.filter((r) => r.observation.method === "UNKNOWN").reduce((s, r) => s + sum(r), 0);
  const parts = rs.filter((r) => r.observation.method !== "UNKNOWN").reduce((s, r) => s + sum(r), 0);
  return Math.max(total, parts);
}

export function reconcileGeography(input: GeoInput, readings: Reading[]): { admissible: Reading[]; coverage: GeoCoverage; issues: Issue[] } {
  const issues: Issue[] = [];
  const isSub = (r: Reading) => r.observation.jurisdictionLevel === "COUNTY" || r.observation.jurisdictionLevel === "TOWN";
  const top = readings.filter((r) => !isSub(r));
  const byJ = new Map<string, Reading[]>();
  for (const r of readings) if (isSub(r)) byJ.set(r.observation.jurisdictionId, [...(byJ.get(r.observation.jurisdictionId) ?? []), r]);
  const reportingIds = [...byJ.keys()];

  // a statewide race, or an at-large seat, contains every county of the state whole
  if (input.office !== "house" || AT_LARGE_STATES.has(input.state)) {
    const expected = input.expectedJurisdictions ? new Set(input.expectedJurisdictions) : null;
    const unknown = expected ? reportingIds.filter((j) => !expected.has(j)) : [];
    if (unknown.length) issues.push({ code: "UNMATCHED_JURISDICTION", severity: "WARNING", message: `${unknown.length} reporting jurisdiction(s) are not in the expected list: ${unknown.slice(0, 8).join(", ")}${unknown.length > 8 ? " ..." : ""}` });
    if (!expected) issues.push({ code: "NO_EXPECTED_JURISDICTIONS", severity: "INFO", message: "no expected jurisdiction list; county coverage cannot be measured" });
    let votesObserved = 0;
    for (const rs of byJ.values()) votesObserved += jurisdictionVotes(rs);
    return {
      admissible: readings,
      coverage: {
        raceScope: "STATEWIDE", jurisdictionsExpected: expected ? expected.size : null, jurisdictionsReporting: reportingIds.length,
        wholeJurisdictions: reportingIds.filter((j) => !expected || expected.has(j)), partialJurisdictions: [], unknownMembership: unknown,
        votesObserved, votesEstimatedByWeight: 0, votesUnallocated: 0, crosswalkAvailable: true,
      },
      issues,
    };
  }

  const did = districtIdOf(input.raceId);
  const splits = input.splits.filter((s) => s.districtId === did && s.weight !== null && s.provenance.evidenceClass !== "UNKNOWN");
  const weightOf = new Map(splits.map((s) => [s.countyFips, s.weight as number]));
  const crosswalkAvailable = splits.length > 0;
  if (!crosswalkAvailable) issues.push({ code: "CROSSWALK_UNAVAILABLE", severity: "WARNING", message: `no county-to-district crosswalk for ${did}; whole-county figures cannot be placed in the district` });

  const admissible: Reading[] = [...top];
  const whole: string[] = [], unknown: string[] = [];
  const partial: GeoCoverage["partialJurisdictions"] = [];
  let votesObserved = 0, votesEstimatedByWeight = 0, votesUnallocated = 0;
  for (const [j, all] of byJ) {
    const w = weightOf.get(j);
    const portion = all.filter((r) => r.observation.scope === "DISTRICT_PORTION");
    const wholeCounty = all.filter((r) => r.observation.scope === "WHOLE");
    if (portion.length) {
      // the source already reports only the district's part of this county
      admissible.push(...portion); votesObserved += jurisdictionVotes(portion);
      if (w !== undefined && w >= WHOLE_COUNTY_WEIGHT) whole.push(j);
      else partial.push({ fips: j, weight: w ?? null, allocation: "SOURCE_REPORTS_PORTION" });
    }
    if (!wholeCounty.length) continue;
    const t = jurisdictionVotes(wholeCounty);
    if (portion.length) {
      issues.push({ code: "DUPLICATE_SCOPE", severity: "WARNING", message: `${j} reports both a district portion and a whole-county figure; only the district portion is used` });
      continue;
    }
    if (w !== undefined && w >= WHOLE_COUNTY_WEIGHT) { admissible.push(...wholeCounty); whole.push(j); votesObserved += t; continue; }
    if (w !== undefined) {
      partial.push({ fips: j, weight: w, allocation: "ESTIMATED_BY_WEIGHT" });
      votesEstimatedByWeight += t * w; votesUnallocated += t;
      issues.push({ code: "PARTIAL_COUNTY_NOT_ALLOCATED", severity: "WARNING", message: `${j} is split (${(w * 100).toFixed(1)}% in ${did}) and reports a whole-county figure; it is excluded from the reported count` });
      continue;
    }
    unknown.push(j); votesUnallocated += t;
    issues.push({ code: "UNKNOWN_MEMBERSHIP", severity: "WARNING", message: `${j} reports a whole-county figure and its share of ${did} is not known; it is excluded from the reported count` });
  }
  const expectedCount = input.expectedJurisdictions?.length ?? (crosswalkAvailable ? splits.length : null);
  const status = { raceScope: "DISTRICT" as const, jurisdictionsExpected: expectedCount, jurisdictionsReporting: reportingIds.length };
  return {
    admissible,
    coverage: { ...status, wholeJurisdictions: whole, partialJurisdictions: partial, unknownMembership: unknown, votesObserved, votesEstimatedByWeight, votesUnallocated, crosswalkAvailable },
    issues,
  };
}
