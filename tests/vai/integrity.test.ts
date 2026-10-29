// T3 integrity: SYNTHETIC fixtures only. Every case runs through the intelligence layer's real append/reconcile code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ingest, reconcile, flagsOf } from "../../app/results/_vai/integrity";
import type { LoggedObservation, VaiReturnsFrame, VoteObservationV2 } from "../../app/results/_vai/types";

const RACE = "sen-ZZ";
const UNIVERSE = new Set(["99001", "99003", "99005"]);

function obs(p: Partial<VoteObservationV2> & { j: string; a: number; b: number; o?: number; ts: string | null; got?: string }): { observation: VoteObservationV2; raw: unknown } {
  const { j, a, b, o = 0, ts, got, ...rest } = p;
  const level = j === "STATE" ? "STATE" : /^\d{5}$/.test(j) ? "COUNTY" : "TOWN";
  return {
    observation: {
      raceId: RACE, jurisdictionId: j, jurisdictionLevel: level, scope: "WHOLE", method: "UNKNOWN",
      sides: { a, b, o }, precinctsReportingPct: null, sourceTimestamp: ts, retrievedAt: got ?? ts ?? "2026-11-04T03:00:00Z",
      source: "fixture", sourceUrl: null, test: false, ...rest,
    },
    raw: { fixture: true },
  };
}

function build(batches: ReturnType<typeof obs>[][]) {
  let log: LoggedObservation[] = [];
  const findings = [];
  for (const b of batches) {
    const r = ingest(log, b);
    log = r.log;
    findings.push(...r.findings);
  }
  return { log, findings };
}

const T = (h: number, m = 0) => `2026-11-04T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00Z`;
const opts = { countyUniverse: UNIVERSE };
const sum = (f: VaiReturnsFrame) => Object.values(f.counties).reduce((s, c) => s + c.t, 0) + f.unmatched.t + f.residual.t;

function assertConserved(f: VaiReturnsFrame) {
  assert.equal(sum(f), f.reported.t, "reported = counties + unmatched + residual");
  for (const s of ["a", "b", "o"] as const) {
    const parts = Object.values(f.counties).reduce((x, c) => x + c.sides[s], 0) + f.unmatched.sides[s] + f.residual.sides[s];
    assert.equal(parts, f.reported[s], `side ${s} conserved`);
  }
}

test("duplicate reading: refused by the log, flagged, nothing changes", () => {
  const r = obs({ j: "99001", a: 100, b: 80, ts: T(1) });
  const { log, findings } = build([[r], [r]]);
  assert.equal(log.length, 1);
  assert.deepEqual(findings.map((f) => f.flag), ["DUPLICATE_READING"]);
  const f = reconcile(log, RACE, T(2), opts);
  assert.equal(f.reported.t, 180);
});

test("out-of-order delivery: the state is the latest by source time, and the late arrival stays in the log", () => {
  const { log } = build([[obs({ j: "99001", a: 300, b: 200, ts: T(2), got: T(2, 1) })], [obs({ j: "99001", a: 100, b: 80, ts: T(1), got: T(2, 5) })]]);
  assert.equal(log.length, 2);
  const f = reconcile(log, RACE, T(3), opts);
  assert.equal(f.reported.t, 500);
  assert.deepEqual(f.counties["99001"].sides, { a: 300, b: 200, o: 0 });
  assert.ok(flagsOf(f).includes("OUT_OF_ORDER"));
  assert.equal(f.counts.superseded, 1);
  assertConserved(f);
});

test("downward revision of one candidate (total still rising): flagged, newer value used, older kept", () => {
  const { log } = build([[obs({ j: "99001", a: 100, b: 100, ts: T(1) })], [obs({ j: "99001", a: 90, b: 130, ts: T(2) })]]);
  const f = reconcile(log, RACE, T(3), opts);
  assert.deepEqual(f.counties["99001"].sides, { a: 90, b: 130, o: 0 });
  const rev = f.findings.filter((x) => x.flag === "DOWNWARD_REVISION");
  assert.equal(rev.length, 1);
  assert.match(rev[0].message, /a 100→90/);
  assert.equal(log.length, 2, "never silently dropped");
});

test("downward revision of the total is flagged too", () => {
  const { log } = build([[obs({ j: "99003", a: 500, b: 500, ts: T(1) })], [obs({ j: "99003", a: 450, b: 480, ts: T(2) })]]);
  const f = reconcile(log, RACE, T(3), opts);
  assert.equal(f.reported.t, 930);
  assert.ok(flagsOf(f).includes("DOWNWARD_REVISION"));
});

test("missing source time: ordered by retrieval time and flagged; freshness says so", () => {
  const { log } = build([[obs({ j: "99001", a: 10, b: 10, ts: null, got: T(1) })], [obs({ j: "99001", a: 20, b: 25, ts: null, got: T(2) })]]);
  const f = reconcile(log, RACE, T(3), opts);
  assert.equal(f.reported.t, 45);
  assert.ok(flagsOf(f).includes("NO_SOURCE_TIME"));
  assert.equal(f.freshness.status, "NO_SOURCE_TIME");
  assert.equal(f.freshness.latestSourceTimestamp, null, "retrieval time is never reported as a source time");
});

test("test data is excluded from every figure", () => {
  const { log } = build([[obs({ j: "99001", a: 100, b: 100, ts: T(1) }), obs({ j: "99003", a: 999, b: 1, ts: T(1), test: true }), obs({ j: "STATE", a: 5000, b: 5000, ts: T(1, 30), test: true })]]);
  const f = reconcile(log, RACE, T(2), opts);
  assert.equal(f.reported.t, 200);
  assert.equal(f.basis, "JURISDICTION_SUM");
  assert.equal(f.counts.testExcluded, 2);
  assert.ok(flagsOf(f).includes("TEST_DATA"));
  assert.equal(f.counties["99003"], undefined);
});

test("unmatched region: kept in a pseudo-county, topline equals the sum, coverage flagged", () => {
  const { log } = build([[
    obs({ j: "STATE", a: 1000, b: 900, o: 100, ts: T(2) }),
    obs({ j: "99001", a: 400, b: 300, ts: T(2) }),
    obs({ j: "99003", a: 300, b: 400, o: 50, ts: T(2) }),
    obs({ j: "TOWN:Nowhere", a: 200, b: 100, o: 50, ts: T(2) }),
  ]]);
  const f = reconcile(log, RACE, T(2, 10), opts);
  assert.equal(f.basis, "TOPLINE");
  assert.equal(f.reported.t, 2000);
  assert.deepEqual(f.unmatched.jurisdictionIds, ["TOWN:Nowhere"]);
  assert.equal(f.unmatched.t, 350);
  assert.deepEqual(f.residual.sides, { a: 100, b: 100, o: 0 }, "topline votes not yet in any county");
  assertConserved(f);
  assert.equal(f.coverage, 1450 / 2000);
  assert.ok(flagsOf(f).includes("UNMATCHED_REGION"));
  assert.ok(flagsOf(f).includes("LOW_COVERAGE"));
});

test("no topline: the race total is the sum of counties and unmatched units, residual zero", () => {
  const { log } = build([[obs({ j: "99001", a: 10, b: 20, ts: T(1) }), obs({ j: "TOWN:X", a: 5, b: 5, ts: T(1) })]]);
  const f = reconcile(log, RACE, T(2), opts);
  assert.equal(f.reported.t, 40);
  assert.equal(f.residual.t, 0);
  assertConserved(f);
});

test("counties ahead of a stale topline: topline still governs, residual goes negative, flagged, nothing lost", () => {
  const { log } = build([[obs({ j: "STATE", a: 100, b: 100, ts: T(1) }), obs({ j: "99001", a: 150, b: 120, ts: T(2) })]]);
  const f = reconcile(log, RACE, T(3), { ...opts, staleAfterMinutes: 600 });
  assert.equal(f.reported.t, 200);
  assert.equal(f.residual.t, -70);
  assert.ok(flagsOf(f).includes("JURISDICTION_SUM_EXCEEDS_TOPLINE"));
  assertConserved(f);
});

test("point in time: readings stamped after asOf are not used", () => {
  const { log } = build([[obs({ j: "99001", a: 10, b: 10, ts: T(1) }), obs({ j: "99001", a: 50, b: 50, ts: T(5) })]]);
  const f = reconcile(log, RACE, T(2), opts);
  assert.equal(f.reported.t, 20);
  assert.equal(f.counts.afterAsOf, 1);
});

test("freshness: stale by age, not stale when the whole provider is quiet, stale on a fetch error", () => {
  const { log } = build([[obs({ j: "99001", a: 10, b: 10, ts: T(1) })]]);
  assert.equal(reconcile(log, RACE, T(1, 20), opts).freshness.status, "FRESH");
  const old = reconcile(log, RACE, T(2), opts);
  assert.equal(old.freshness.status, "STALE");
  assert.equal(old.freshness.ageMinutes, 60);
  assert.ok(flagsOf(old).includes("STALE_FEED"));
  assert.equal(reconcile(log, RACE, T(2), { ...opts, providerLatestSourceTimestamp: T(1, 5) }).freshness.status, "FRESH");
  assert.equal(reconcile(log, RACE, T(2), { ...opts, providerLatestSourceTimestamp: T(1, 50) }).freshness.status, "STALE");
  assert.equal(reconcile(log, RACE, T(1, 10), { ...opts, fetchError: true }).freshness.status, "STALE");
  assert.equal(reconcile([], RACE, T(1), opts).freshness.status, "NO_DATA");
});

test("a county above its expected maximum is flagged", () => {
  const { log } = build([[obs({ j: "99005", a: 600, b: 600, ts: T(1) })]]);
  const f = reconcile(log, RACE, T(1, 5), { ...opts, expectedMax: { "99005": 1000 } });
  assert.ok(flagsOf(f).includes("TOTAL_EXCEEDS_EXPECTED"));
});

test("precincts reporting is metadata only: it changes nothing but itself", () => {
  const at = (pr: number | null) => reconcile(build([[obs({ j: "99001", a: 10, b: 30, ts: T(1), precinctsReportingPct: pr })]]).log, RACE, T(1, 5), opts);
  const zero = at(0), full = at(100);
  assert.equal(full.counties["99001"].precinctsReportingPct, 100);
  assert.deepEqual({ ...full, counties: {} }, { ...zero, counties: {} });
  assert.deepEqual(full.counties["99001"].sides, zero.counties["99001"].sides);
});

test("V2 observations (K candidates, provider batch) pass through the intelligence log unchanged", () => {
  const r = obs({ j: "99001", a: 10, b: 20, o: 3, ts: T(1), candidates: [{ id: "x", name: "X", party: "D", votes: 10 }, { id: "y", name: "Y", party: "R", votes: 20 }, { id: "z", name: "Z", party: null, votes: 3 }], providerBatchId: "b-1" });
  const { log } = build([[r]]);
  assert.deepEqual(log[0].observation, r.observation);
  assert.equal(reconcile(log, RACE, T(2), opts).reported.t, 33);
});

test("conservation holds for any sequence of readings (seeded generator, 300 logs)", () => {
  let s = 20261103;
  const rnd = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const units = ["STATE", "99001", "99003", "99005", "TOWN:A", "TOWN:B"];
  for (let n = 0; n < 300; n++) {
    const batches: ReturnType<typeof obs>[][] = [];
    for (let k = 0; k < 1 + Math.floor(rnd() * 12); k++) {
      const j = units[Math.floor(rnd() * units.length)];
      const ts = rnd() < 0.15 ? null : T(1 + Math.floor(rnd() * 4), Math.floor(rnd() * 60));
      batches.push([obs({ j, a: Math.floor(rnd() * 1000), b: Math.floor(rnd() * 1000), o: Math.floor(rnd() * 50), ts, got: T(5, k), test: rnd() < 0.1 })]);
    }
    const f = reconcile(build(batches).log, RACE, T(4, 30), opts);
    assertConserved(f);
    assert.ok(f.reported.t >= 0);
  }
});
