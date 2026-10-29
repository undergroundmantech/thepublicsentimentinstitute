// SYNTHETIC test data only. These tests check the software, not any election.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appendObservations, fromCivicDetail, latestReadings, totalsFrom } from "../../app/lib/intelligence/observations";
import type { CDetail, XRace } from "../../app/results/2026/live";
import { log, obs } from "./fixtures";

const AS_OF = "2026-11-04T06:00:00Z";
const totals = (l: ReturnType<typeof log>, asOf = AS_OF, includeTest = false) => {
  const r = latestReadings(l, "sen-GA", asOf, { includeTest });
  const t = totalsFrom(r.readings, asOf, r.ignored);
  return { ...t, readingIssues: r.issues };
};
const codes = (xs: { code: string }[]) => xs.map((x) => x.code);

test("out-of-order delivery cannot roll the count back", () => {
  const l = log(obs({ a: 200, b: 200, sourceTimestamp: "2026-11-04T02:00:00Z" }), obs({ a: 100, b: 100, sourceTimestamp: "2026-11-04T01:00:00Z" }));
  const t = totals(l);
  assert.equal(t.returns.reported.t, 400);
  assert.ok(codes(t.readingIssues).includes("OUT_OF_ORDER"));
});

test("a downward revision is used and flagged", () => {
  const l = log(obs({ a: 200, b: 200, sourceTimestamp: "2026-11-04T01:00:00Z" }), obs({ a: 190, b: 200, sourceTimestamp: "2026-11-04T02:00:00Z" }));
  const t = totals(l);
  assert.equal(t.returns.reported.t, 390);
  assert.ok(codes(t.readingIssues).includes("REVISION_DOWN"));
});

test("two different readings with the same source timestamp are flagged; the later retrieval wins", () => {
  const l = log(obs({ a: 100, b: 100 }), obs({ a: 120, b: 100 }));
  const t = totals(l);
  assert.equal(t.returns.reported.t, 220);
  assert.ok(codes(t.readingIssues).includes("CONTRADICTORY_READINGS"));
});

test("identical readings are logged once; invalid votes are refused", () => {
  const o = obs({ a: 100, b: 100 });
  const first = appendObservations([], [{ observation: o, raw: {} }]);
  const again = appendObservations(first.log, [{ observation: { ...o }, raw: {} }, { observation: obs({ a: -1 }), raw: {} }, { observation: obs({ a: Number.NaN }), raw: {} }]);
  assert.equal(again.log.length, 1);
  assert.deepEqual(codes(again.issues), ["DUPLICATE_READING", "INVALID_VOTES", "INVALID_VOTES"]);
  assert.equal(first.log.length, 1, "the earlier log is not mutated");
});

test("the topline is the total; county figures are never added to it", () => {
  const l = log(
    obs({ a: 500, b: 400, o: 100 }),
    obs({ jurisdictionId: "13001", jurisdictionLevel: "COUNTY", a: 150, b: 150 }),
    obs({ jurisdictionId: "13003", jurisdictionLevel: "COUNTY", a: 200, b: 200 }),
  );
  const t = totals(l);
  assert.equal(t.returns.basis, "TOPLINE");
  assert.equal(t.returns.reported.t, 1000);
  const over = totals(log(obs({ a: 100, b: 100 }), obs({ jurisdictionId: "13001", jurisdictionLevel: "COUNTY", a: 300, b: 300 })));
  assert.equal(over.returns.reported.t, 200);
  assert.ok(codes(over.issues).includes("JURISDICTION_SUM_EXCEEDS_TOPLINE"));
});

test("without a topline, counties are summed", () => {
  const t = totals(log(obs({ jurisdictionId: "13001", jurisdictionLevel: "COUNTY", a: 150, b: 150 }), obs({ jurisdictionId: "13003", jurisdictionLevel: "COUNTY", a: 200, b: 100 })));
  assert.equal(t.returns.basis, "JURISDICTION_SUM");
  assert.equal(t.returns.reported.t, 600);
});

test("a method breakdown and the same county's total are not double counted", () => {
  const c = { jurisdictionId: "13001", jurisdictionLevel: "COUNTY" as const };
  const t = totals(log(obs({ ...c, a: 150, b: 150 }), obs({ ...c, method: "ELECTION_DAY", a: 50, b: 50 }), obs({ ...c, method: "MAIL_ABSENTEE", a: 100, b: 100 })));
  assert.equal(t.returns.reported.t, 300);
  assert.equal(t.returns.byMethod.ELECTION_DAY?.t, 100);
  assert.equal(t.returns.byMethod.MAIL_ABSENTEE?.t, 200);
  assert.equal(t.returns.byMethod.UNKNOWN, undefined);
  const mismatch = totals(log(obs({ ...c, a: 150, b: 150 }), obs({ ...c, method: "ELECTION_DAY", a: 50, b: 50, sourceTimestamp: "2026-11-04T02:00:00Z" })));
  assert.ok(codes(mismatch.issues).includes("METHOD_SUM_MISMATCH"));
  assert.equal(mismatch.returns.reported.t, 100, "the newer figure is used, not the sum");
});

test("missing method data stays UNKNOWN with no side split invented", () => {
  const t = totals(log(obs({ a: 500, b: 400 })));
  assert.deepEqual(t.returns.byMethod, { UNKNOWN: { t: 900, sides: null } });
});

test("zero votes and no readings", () => {
  const none = totals([]);
  assert.equal(none.returns.basis, "NONE");
  assert.equal(none.returns.reported.t, 0);
  const zero = totals(log(obs({ a: 0, b: 0 })));
  assert.equal(zero.returns.reported.t, 0);
  assert.equal(zero.returns.basis, "TOPLINE");
});

test("test data and readings after the evaluation time are excluded", () => {
  const l = log(obs({ a: 100, b: 100 }), obs({ a: 999, b: 999, test: true, sourceTimestamp: "2026-11-04T02:00:00Z" }), obs({ a: 300, b: 300, sourceTimestamp: "2026-11-04T07:00:00Z" }));
  assert.equal(totals(l).returns.reported.t, 200);
  assert.equal(totals(l, "2026-11-04T08:00:00Z").returns.reported.t, 600);
  assert.equal(totals(l, "2026-11-04T03:00:00Z", true).returns.reported.t, 1998);
});

test("a reading without a source timestamp is ordered by retrieval and flagged", () => {
  const t = totals(log(obs({ a: 1, b: 1, sourceTimestamp: null })));
  assert.ok(codes(t.readingIssues).includes("NO_SOURCE_TIMESTAMP"));
});

test("civicAPI adapter: method UNKNOWN, House counties are district portions, precincts kept as metadata", () => {
  const race = { id: "house-PA-07", k: "house", st: "PA", nm: "", off: "", c: [["Synthetic A", "D", 0], ["Synthetic B", "R", 0]], civ: { d: "PA-07" } } as XRace;
  const d: CDetail = {
    id: 1, name: "SYNTHETIC", type: "House of Representatives", province: "PA", district: "PA-07", pr: 40, close: null, updated: "2026-11-04T02:00:00Z", test: false,
    c: [["Synthetic A", "Democratic", 600, 0, 0, null], ["Synthetic B", "Republican", 400, 0, 0, null]],
    regions: { "42077": { n: "Synthetic County", pr: 100, c: [["Synthetic A", "Democratic", 600, 0, 0, null], ["Synthetic B", "Republican", 400, 0, 0, null]] } },
  };
  const out = fromCivicDetail(race, d, "2026-11-04T02:01:00Z", "https://example.org/SYNTHETIC");
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((x) => [x.observation.jurisdictionId, x.observation.jurisdictionLevel, x.observation.scope, x.observation.method]), [["PA-07", "DISTRICT", "WHOLE", "UNKNOWN"], ["42077", "COUNTY", "DISTRICT_PORTION", "UNKNOWN"]]);
  assert.equal(out[1].observation.precinctsReportingPct, 100);
  assert.deepEqual(out[0].observation.sides, { a: 600, b: 400, o: 0 });
});
