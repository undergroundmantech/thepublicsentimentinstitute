// SYNTHETIC test data only. These tests check the software, not any election. The replay test runs the harness
// over a fabricated sequence and asserts that it is never reported as a backtest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { runPipeline, type PipelineInput } from "../../app/lib/intelligence/pipeline";
import { runReplay } from "../../app/lib/intelligence/replay";
import type { PublishedInput } from "../../app/lib/intelligence/published";
import type { CDetail, XRace } from "../../app/results/2026/live";
import { BASE_HOUSE, BASE_SEN, log, methodHistory, obs, outstanding, pollClose, turnout } from "./fixtures";

const AS_OF = "2026-11-04T06:00:00Z";
const base = (p: Partial<PipelineInput> = {}): PipelineInput => ({
  raceId: "sen-GA", asOf: AS_OF, generatedAt: "2026-11-04T06:00:01Z", baseline: BASE_SEN, log: [], research: [],
  expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null, synthetic: true, ...p,
});
const stage = (r: ReturnType<typeof runPipeline>, name: string) => r.stages.find((s) => s.stage === name)!;
const issueCodes = (r: ReturnType<typeof runPipeline>) => r.stages.flatMap((s) => s.issues.map((i) => i.code));

test("an unmatched race id fails safe: no throw, nothing downstream, confidence NONE", () => {
  const r = runPipeline(base({ raceId: "sen-ZZ", baseline: null }));
  assert.equal(stage(r, "baseline").status, "FAILED");
  for (const s of r.stages.filter((s) => s.stage !== "baseline")) assert.equal(s.status, "UNAVAILABLE", s.stage);
  assert.equal(r.confidence, "NONE");
  assert.equal(r.shadow, null);
});

test("a baseline for a different race is contradictory", () => {
  const r = runPipeline(base({ baseline: BASE_HOUSE }));
  assert.equal(stage(r, "baseline").status, "FAILED");
});

test("no returns and no research: every gap is listed, nothing is made up", () => {
  const r = runPipeline(base());
  assert.equal(r.returns?.reported.t, 0);
  assert.equal(r.outstanding?.estimatedOutstanding, null);
  assert.equal(r.shadow?.status, "UNAVAILABLE");
  assert.equal(r.shadow?.winProbability.status, "UNAVAILABLE");
  assert.equal(r.confidence, "NONE");
  assert.deepEqual(r.missingResearch.map((m) => m.component), ["reporting", "outstanding", "methods"]);
  assert.equal(r.synthetic, true);
});

test("missing method data: everything reported is UNKNOWN, nothing remaining is estimated by method", () => {
  const r = runPipeline(base({ log: log(obs({ a: 500_000, b: 600_000 })), research: [turnout("sen-GA", 4_000_000, null, 4_600_000)] }));
  assert.equal(r.methods?.knownMethodShare, 0);
  assert.equal(stage(r, "methods").status, "DEGRADED");
  assert.ok(r.methods!.methods.every((m) => m.estimatedRemaining === null && m.estimatedRemainingStatus === "UNAVAILABLE"));
  assert.equal(r.methods!.methods.find((m) => m.method === "UNKNOWN")?.reported, 1_100_000);
});

test("partial county reporting: precincts at 100% in one county do not end the count", () => {
  const r = runPipeline(base({
    expectedJurisdictions: ["13001", "13003", "13005"],
    log: log(obs({ jurisdictionId: "13001", jurisdictionLevel: "COUNTY", a: 300_000, b: 200_000, precinctsReportingPct: 100 })),
    research: [turnout("sen-GA", 4_000_000, null, 4_600_000)],
  }));
  assert.equal(r.geography?.jurisdictionsReporting, 1);
  assert.equal(r.geography?.jurisdictionsExpected, 3);
  assert.equal(r.returns?.reported.t, 500_000);
  assert.deepEqual(r.outstanding?.estimatedOutstanding, { low: 3_500_000, central: null, high: 4_100_000 });
  assert.ok(r.shadow!.shareOfExpectedCounted!.high < 15);
  assert.equal(r.shadow?.status, "AVAILABLE");
  assert.equal(r.confidence, "LOW");
});

test("historical data that does not apply to 2026 is context only", () => {
  const r = runPipeline(base({
    log: log(obs({ a: 1, b: 1 })),
    research: [pollClose("pc22", "2022-11-09T00:00:00Z", "HISTORICAL", 2022), methodHistory("mh22", "MAIL_ABSENTEE", 2022, 0.25)],
  }));
  assert.equal(r.reporting?.pollsClosed, "UNKNOWN");
  assert.equal(r.reporting?.pollClose.length, 0);
  assert.ok(issueCodes(r).includes("NOT_APPLICABLE_2026"));
  const mail = r.methods!.methods.find((m) => m.method === "MAIL_ABSENTEE")!;
  assert.deepEqual(mail.historical.map((h) => h.year), [2022]);
  assert.equal(mail.reported, null);
  assert.equal(mail.estimatedRemaining, null);
});

test("best case is MEDIUM: HIGH needs a backtest", () => {
  const r = runPipeline(base({
    log: log(obs({ a: 2_000_000, b: 1_900_000, sourceTimestamp: "2026-11-04T04:00:00Z" })),
    research: [turnout("sen-GA", 4_000_000, null, 4_600_000, "VERIFIED"), outstanding({ id: "o", n: 300_000, asOf: "2026-11-04T05:00:00Z" }), pollClose("pc", "2026-11-04T00:00:00Z")],
  }));
  assert.equal(r.confidence, "MEDIUM");
  assert.equal(r.reporting?.pollsClosed, "ALL");
  assert.ok(r.confidenceReasons[0].includes("backtest"));
});

const xrace = { id: "sen-GA", k: "sen", st: "GA", nm: "SYNTHETIC", off: "Senate", c: [["Synthetic A", "D", 2_150_000], ["Synthetic B", "R", 2_100_000]], tot: 4_300_000, m: -2, civ: {} } as XRace;
const detail: CDetail = { id: 1, name: "SYNTHETIC", type: "US Senate", province: "GA", district: null, pr: 50, close: null, updated: "2026-11-04T04:00:00Z", test: false, c: [["Synthetic A", "Democratic", 1_000_000, 0, 0, null], ["Synthetic B", "Republican", 1_100_000, 0, 0, null]], regions: {} };

test("the published engine is compared read-only", () => {
  const r = runPipeline(base({ log: log(obs({ a: 1_000_000, b: 1_100_000 })), research: [turnout("sen-GA", 4_000_000, 4_300_000, 4_600_000)], published: { race: xrace, exp: null, detail } }));
  assert.equal(r.published?.available, true);
  assert.ok(Number.isFinite(r.published!.published!.expectedFinal));
  assert.ok(Number.isFinite(r.published!.diff!.expectedFinalVsShadowCentral as number));
  assert.ok(Number.isFinite(r.published!.diff!.marginVsForecastScenario as number));
});

test("a stage that throws is isolated", () => {
  const throwing = { get race(): XRace { throw new Error("SYNTHETIC failure"); }, exp: null, detail: null } as PublishedInput;
  const r = runPipeline(base({ log: log(obs({ a: 1, b: 2 })), research: [turnout("sen-GA", 10, null, 20)], published: throwing }));
  assert.equal(stage(r, "published").status, "FAILED");
  assert.equal(stage(r, "shadow").status, "OK");
  assert.ok(r.shadow);
  assert.equal(r.confidence, "NONE");
});

test("House without a crosswalk: county figures are left out and geography is listed as missing", () => {
  const r = runPipeline(base({
    raceId: "house-PA-07", baseline: BASE_HOUSE,
    log: log(obs({ raceId: "house-PA-07", jurisdictionId: "42095", jurisdictionLevel: "COUNTY", a: 10, b: 10 })),
  }));
  assert.equal(r.returns?.reported.t, 0);
  assert.equal(r.geography?.votesUnallocated, 20);
  assert.ok(r.missingResearch.some((m) => m.component === "geography" && m.need.includes("PA-07")));
});

test("replay over a synthetic sequence is a software test, never a backtest", () => {
  const res = runReplay({
    label: "SYNTHETIC three-step night",
    synthetic: true,
    steps: [
      { at: "2026-11-04T01:00:00Z", batch: [{ observation: obs({ a: 100, b: 120, sourceTimestamp: "2026-11-04T00:59:00Z" }), raw: {} }] },
      { at: "2026-11-04T02:00:00Z", batch: [{ observation: obs({ a: 300, b: 280, sourceTimestamp: "2026-11-04T01:59:00Z" }), raw: {} }] },
      // arrives late, stamped before the previous reading
      { at: "2026-11-04T03:00:00Z", batch: [{ observation: obs({ a: 200, b: 200, sourceTimestamp: "2026-11-04T01:30:00Z" }), raw: {} }] },
    ],
  }, { raceId: "sen-GA", baseline: BASE_SEN, research: [turnout("sen-GA", 1000, null, 1200)], expectedJurisdictions: null, forecastExpectedTotal: null, forecastSource: null });
  assert.equal(res.synthetic, true);
  assert.equal(res.backtestEligible, false);
  assert.ok(res.reports.every((r) => r.synthetic));
  assert.deepEqual(res.reports.map((r) => r.returns?.reported.t), [220, 580, 580]);
  assert.ok(res.reports[2].stages.some((s) => s.issues.some((i) => i.code === "OUT_OF_ORDER")));
});
