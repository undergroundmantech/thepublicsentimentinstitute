// SYNTHETIC test data only. These tests check the software, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { reconcileGeography } from "../../app/lib/intelligence/geography";
import { latestReadings, totalsFrom } from "../../app/lib/intelligence/observations";
import type { GeoSplitRecord } from "../../app/lib/intelligence/types";
import { log, obs, split } from "./fixtures";

const AS_OF = "2026-11-04T06:00:00Z";
const H = "house-PA-07";
const county = (fips: string, a: number, b: number, scope: "WHOLE" | "DISTRICT_PORTION" = "WHOLE") => obs({ raceId: H, jurisdictionId: fips, jurisdictionLevel: "COUNTY", scope, a, b });
const readings = (...os: ReturnType<typeof obs>[]) => latestReadings(log(...os), os[0]?.raceId ?? H, AS_OF).readings;
const codes = (xs: { code: string }[]) => xs.map((x) => x.code);
const splits = [split("s1", "42077", "PA-07", 1), split("s2", "42095", "PA-07", 0.6), split("s3", "42095", "PA-08", 0.4)] as GeoSplitRecord[];

test("without a crosswalk, whole-county figures are not placed in a district", () => {
  const g = reconcileGeography({ raceId: H, office: "house", state: "PA", expectedJurisdictions: null, splits: [] }, readings(county("42077", 100, 100)));
  assert.equal(g.admissible.length, 0);
  assert.deepEqual(g.coverage.unknownMembership, ["42077"]);
  assert.equal(g.coverage.votesUnallocated, 200);
  assert.ok(codes(g.issues).includes("CROSSWALK_UNAVAILABLE"));
});

test("a county split between districts is never allocated whole", () => {
  const g = reconcileGeography({ raceId: H, office: "house", state: "PA", expectedJurisdictions: null, splits }, readings(county("42077", 100, 100), county("42095", 300, 200)));
  assert.deepEqual(g.admissible.map((r) => r.observation.jurisdictionId), ["42077"]);
  assert.deepEqual(g.coverage.partialJurisdictions, [{ fips: "42095", weight: 0.6, allocation: "ESTIMATED_BY_WEIGHT" }]);
  assert.equal(g.coverage.votesEstimatedByWeight, 300);
  assert.equal(g.coverage.votesUnallocated, 500);
  assert.ok(codes(g.issues).includes("PARTIAL_COUNTY_NOT_ALLOCATED"));
  // the weight-based figure never reaches the reported count
  assert.equal(totalsFrom(g.admissible, AS_OF, 0).returns.reported.t, 200);
});

test("a district portion reported by the source is admitted", () => {
  const g = reconcileGeography({ raceId: H, office: "house", state: "PA", expectedJurisdictions: null, splits }, readings(county("42095", 120, 80, "DISTRICT_PORTION")));
  assert.equal(g.admissible.length, 1);
  assert.deepEqual(g.coverage.partialJurisdictions, [{ fips: "42095", weight: 0.6, allocation: "SOURCE_REPORTS_PORTION" }]);
  assert.equal(g.coverage.votesObserved, 200);
});

test("a county reported both whole and as a portion uses only the portion", () => {
  const g = reconcileGeography({ raceId: H, office: "house", state: "PA", expectedJurisdictions: null, splits }, readings(county("42095", 120, 80, "DISTRICT_PORTION"), county("42095", 300, 200)));
  assert.deepEqual(g.admissible.map((r) => r.observation.scope), ["DISTRICT_PORTION"]);
  assert.ok(codes(g.issues).includes("DUPLICATE_SCOPE"));
});

test("the district topline is admissible without a crosswalk", () => {
  const g = reconcileGeography({ raceId: H, office: "house", state: "PA", expectedJurisdictions: null, splits: [] }, readings(obs({ raceId: H, jurisdictionId: "PA-07", jurisdictionLevel: "DISTRICT", a: 10, b: 10 })));
  assert.equal(g.admissible.length, 1);
});

test("an at-large seat contains every county whole", () => {
  const W = "house-WY-01";
  const rs = latestReadings(log(obs({ raceId: W, jurisdictionId: "56001", jurisdictionLevel: "COUNTY", a: 5, b: 9 })), W, AS_OF).readings;
  const g = reconcileGeography({ raceId: W, office: "house", state: "WY", expectedJurisdictions: ["56001", "56003"], splits: [] }, rs);
  assert.equal(g.admissible.length, 1);
  assert.equal(g.coverage.raceScope, "STATEWIDE");
  assert.ok(!codes(g.issues).includes("CROSSWALK_UNAVAILABLE"));
  assert.equal(g.coverage.jurisdictionsExpected, 2);
  assert.equal(g.coverage.jurisdictionsReporting, 1);
});

test("statewide: a reporting jurisdiction outside the expected list is flagged", () => {
  const rs = latestReadings(log(obs({ jurisdictionId: "99999", jurisdictionLevel: "COUNTY", a: 1, b: 1 })), "sen-GA", AS_OF).readings;
  const g = reconcileGeography({ raceId: "sen-GA", office: "senate", state: "GA", expectedJurisdictions: ["13001"], splits: [] }, rs);
  assert.deepEqual(g.coverage.unknownMembership, ["99999"]);
  assert.ok(codes(g.issues).includes("UNMATCHED_JURISDICTION"));
});
