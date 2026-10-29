// SYNTHETIC test data only. These tests check the software, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateOutstanding, type OutstandingInput } from "../../app/lib/intelligence/outstanding";
import type { ResearchRecord } from "../../app/lib/intelligence/types";
import { methodHistory, outstanding, turnout } from "./fixtures";

const AS_OF = "2026-11-04T06:00:00Z";
const RET = "2026-11-04T04:00:00Z";
const input = (p: Partial<OutstandingInput> = {}): OutstandingInput => ({
  raceId: "sen-GA", office: "senate", asOf: AS_OF, reported: 1_000_000, latestByJurisdiction: { TOPLINE: RET }, records: [],
  forecastExpectedTotal: null, forecastSource: null, ...p,
});
const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

test("expected final = reported + estimated outstanding, with the research range", () => {
  const { inventory: v } = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, 4_300_000, 4_600_000)] }));
  assert.deepEqual(v.estimatedOutstanding, { low: 3_000_000, central: 3_300_000, high: 3_600_000 });
  assert.deepEqual(v.expectedFinal, { low: 4_000_000, central: 4_300_000, high: 4_600_000 });
  for (const k of ["low", "high"] as const) assert.equal(v.expectedFinal![k], v.reported + v.estimatedOutstanding![k]);
  assert.equal(v.uncertainty, "QUANTIFIED");
  assert.equal(v.turnoutBasis.evidenceClass, "INFERRED");
  assert.equal(v.unknownInventory, true, "no official statement: the inventory is unknown");
  assert.equal(v.officiallyConfirmedOutstanding.value, null);
});

test("a bad turnout estimate is discarded, not stretched", () => {
  const bad = estimateOutstanding(input({ reported: 5_000_000, records: [turnout("sen-GA", 4_000_000, null, 4_600_000)] }));
  assert.ok(codes(bad.issues).includes("BAD_TURNOUT_ESTIMATE"));
  assert.equal(bad.inventory.estimatedOutstanding, null);
  assert.ok(codes(bad.issues).includes("OUTSTANDING_UNAVAILABLE"));
  const fallback = estimateOutstanding(input({ reported: 5_000_000, records: [turnout("sen-GA", 4_000_000, null, 4_600_000)], forecastExpectedTotal: 5_500_000, forecastSource: "forecast" }));
  assert.equal(fallback.inventory.uncertainty, "UNQUANTIFIED");
  assert.deepEqual(fallback.inventory.estimatedOutstanding, { low: 500_000, central: 500_000, high: 500_000 });
});

test("the forecast's expected total is a point with no invented range", () => {
  const r = estimateOutstanding(input({ forecastExpectedTotal: 4_200_000, forecastSource: "results/2026/index.json tot" }));
  assert.equal(r.inventory.uncertainty, "UNQUANTIFIED");
  assert.equal(r.inventory.turnoutBasis.kind, "FORECAST_EXPECTED_TOTAL");
  assert.deepEqual(r.inventory.expectedFinal, { low: 4_200_000, central: 4_200_000, high: 4_200_000 });
  assert.ok(codes(r.issues).includes("UNQUANTIFIED_UNCERTAINTY"));
  const over = estimateOutstanding(input({ reported: 4_300_000, forecastExpectedTotal: 4_200_000, forecastSource: "x" }));
  assert.equal(over.inventory.expectedFinal, null);
  assert.ok(codes(over.issues).includes("BAD_TURNOUT_ESTIMATE"));
});

test("an official count of ballots to count is a floor, and is kept apart from the estimate", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, 4_300_000, 4_600_000), outstanding({ id: "o1", n: 3_200_000, asOf: "2026-11-04T05:00:00Z" })] }));
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, 3_200_000);
  assert.equal(r.inventory.officiallyConfirmedOutstanding.evidenceClass, "VERIFIED");
  assert.deepEqual(r.inventory.estimatedOutstanding, { low: 3_200_000, central: 3_300_000, high: 3_600_000 });
  assert.equal(r.inventory.unknownInventory, false);
});

test("an official count above the estimate's high contradicts it", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, null, 4_600_000), outstanding({ id: "o1", n: 4_000_000, asOf: "2026-11-04T05:00:00Z" })] }));
  assert.equal(r.inventory.estimatedOutstanding, null);
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, 4_000_000);
  assert.ok(codes(r.issues).includes("BAD_TURNOUT_ESTIMATE"));
});

test("a statement older than the returns is stale; one after the evaluation time is not yet known", () => {
  const stale = estimateOutstanding(input({ records: [outstanding({ id: "o1", n: 100, asOf: "2026-11-04T03:00:00Z" })] }));
  assert.equal(stale.inventory.officiallyConfirmedOutstanding.value, null);
  assert.ok(codes(stale.issues).includes("STALE_STATEMENT"));
  const future = estimateOutstanding(input({ records: [outstanding({ id: "o1", n: 100, asOf: "2026-11-04T07:00:00Z" })] }));
  assert.equal(future.inventory.officiallyConfirmedOutstanding.value, null);
});

test("statewide and county statements are not added together", () => {
  const r = estimateOutstanding(input({ records: [
    outstanding({ id: "s", n: 1000, asOf: "2026-11-04T05:00:00Z" }),
    outstanding({ id: "c1", n: 600, asOf: "2026-11-04T05:00:00Z", jurisdictionId: "13001", level: "COUNTY" }),
  ] }));
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, 1000);
  assert.ok(codes(r.issues).includes("OVERLAPPING_STATEMENTS"));
});

test("a House race ignores county statements that cover the whole county", () => {
  const r = estimateOutstanding(input({ raceId: "house-PA-07", office: "house", latestByJurisdiction: {}, records: [
    outstanding({ id: "c", n: 5000, state: "PA", asOf: "2026-11-04T05:00:00Z", jurisdictionId: "42095", level: "COUNTY" }),
  ] }));
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, null);
});

test("ballots not yet eligible are reported separately and not counted as outstanding", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, null, 4_600_000), outstanding({ id: "n", n: 50_000, status: "NOT_YET_ELIGIBLE", asOf: "2026-11-04T05:00:00Z" })] }));
  assert.equal(r.inventory.notYetEligible.value, 50_000);
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, null);
  assert.deepEqual(r.inventory.estimatedOutstanding, { low: 3_000_000, central: null, high: 3_600_000 });
});

test("non-overlapping turnout expectations are flagged and the envelope used", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 3_000_000, null, 3_500_000, "INFERRED", "a"), turnout("sen-GA", 4_000_000, null, 4_500_000, "INFERRED", "b")] }));
  assert.ok(codes(r.issues).includes("CONTRADICTORY_METADATA"));
  assert.deepEqual(r.inventory.expectedFinal, { low: 3_000_000, central: null, high: 4_500_000 });
});

// ---- estimator hierarchy -------------------------------------------------------------------------------------------

const rungs = (r: ReturnType<typeof estimateOutstanding>) => Object.fromEntries(r.inventory.ladder.map((x) => [x.tier, x.status]));

test("tier 1: an official statement of ballots to count is the top rung, and a statewide statement is labelled so", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, 4_300_000, 4_600_000), outstanding({ id: "o1", n: 3_200_000, asOf: "2026-11-04T05:00:00Z" })] }));
  assert.equal(r.inventory.tier, "OFFICIAL_JURISDICTION_COUNT");
  assert.equal(r.inventory.officialScope, "STATEWIDE_OR_DISTRICT");
  assert.deepEqual(rungs(r), { OFFICIAL_JURISDICTION_COUNT: "USED", VERIFIED_METHOD_INVENTORY: "ABSENT", HISTORICAL_ESTIMATE_WITH_RANGE: "PRESENT_NOT_USED", FORECAST_POINT_NO_RANGE: "ABSENT", UNKNOWN: "ABSENT" });
});

test("tier 1 from county statements is flagged as possibly partial coverage", () => {
  const r = estimateOutstanding(input({ records: [outstanding({ id: "c1", n: 10_000, level: "COUNTY", jurisdictionId: "13121", asOf: "2026-11-04T05:00:00Z" })], latestByJurisdiction: { TOPLINE: RET, "13121": RET } }));
  assert.equal(r.inventory.tier, "OFFICIAL_JURISDICTION_COUNT");
  assert.equal(r.inventory.officialScope, "COUNTIES");
  assert.ok(codes(r.issues).includes("OFFICIAL_SCOPE_PARTIAL"));
});

test("tier 3: a stated-range turnout expectation, never described as calibrated", () => {
  const r = estimateOutstanding(input({ records: [turnout("sen-GA", 4_000_000, 4_300_000, 4_600_000)] }));
  assert.equal(r.inventory.tier, "HISTORICAL_ESTIMATE_WITH_RANGE");
  const used = r.inventory.ladder.find((x) => x.status === "USED");
  assert.match(used!.detail, /not backtested/);
});

test("tier 4: the forecast point is its own rung, with no range invented", () => {
  const r = estimateOutstanding(input({ forecastExpectedTotal: 4_200_000, forecastSource: "x" }));
  assert.equal(r.inventory.tier, "FORECAST_POINT_NO_RANGE");
  assert.equal(r.inventory.uncertainty, "UNQUANTIFIED");
});

test("tier 5: with no basis the tier is UNKNOWN and no figure is produced", () => {
  const r = estimateOutstanding(input());
  assert.equal(r.inventory.tier, "UNKNOWN");
  assert.equal(r.inventory.estimatedOutstanding, null);
  assert.equal(r.inventory.expectedFinal, null);
  assert.equal(r.inventory.unknownInventory, true);
});

test("a verified method inventory is shown as present but is not netted against counted votes", () => {
  const mh = methodHistory("m1", "MAIL_ABSENTEE", 2026, 0.3);
  const verified = { ...mh, provenance: { ...mh.provenance, evidenceClass: "VERIFIED", historicalYear: null } } as ResearchRecord;
  const r = estimateOutstanding(input({ state: "GA", forecastExpectedTotal: 4_200_000, forecastSource: "x", records: [verified] }));
  assert.equal(rungs(r).VERIFIED_METHOD_INVENTORY, "PRESENT_NOT_USED");
  assert.equal(r.inventory.tier, "FORECAST_POINT_NO_RANGE", "the figure still rests on the forecast point");
  assert.deepEqual(r.inventory.expectedFinal, { low: 4_200_000, central: 4_200_000, high: 4_200_000 });
  const other = estimateOutstanding(input({ state: "PA", records: [verified] }));
  assert.equal(rungs(other).VERIFIED_METHOD_INVENTORY, "ABSENT", "another state's inventory is not used");
});

test("precincts reporting never enters the estimate: the estimator takes no precinct input", () => {
  const a = estimateOutstanding(input({ forecastExpectedTotal: 4_200_000, forecastSource: "x" }));
  const b = estimateOutstanding({ ...input({ forecastExpectedTotal: 4_200_000, forecastSource: "x" }), precinctsReportingPct: 100 } as OutstandingInput);
  assert.deepEqual(a.inventory, b.inventory);
});

test("a district race ignores a county statement that was not made for the race", () => {
  const r = estimateOutstanding(input({ raceId: "house-PA-07", office: "house", records: [outstanding({ id: "c1", n: 50_000, level: "COUNTY", jurisdictionId: "42077", asOf: "2026-11-04T05:00:00Z" })], latestByJurisdiction: { TOPLINE: RET, "42077": RET } }));
  assert.equal(r.inventory.tier, "UNKNOWN");
  assert.equal(r.inventory.officiallyConfirmedOutstanding.value, null);
});
