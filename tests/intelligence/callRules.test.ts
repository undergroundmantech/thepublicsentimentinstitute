// The call rule's additions of November 13, 2026: the provider-row checks, the first-report quarantine and the
// safe-seat lane. The rule is tested on hand-built forecasts, apart from the model.
import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_CALL_CONFIG, emptyLedger, probe, stepLedger, type Ledger } from "../../app/lib/engine/modelCalls";
import { observe, rowIntegrity, type CivicRawRace } from "../../app/lib/engine/snapshot";
import type { RaceForecast, RaceObservation } from "../../app/lib/engine/types";

const D = (m: number, lo = m, hi = m) => ({ mean: m, p50: m, i80: { lo, hi }, i95: { lo, hi } });
type Opt = { id?: string; counted?: [number, number]; expected?: number; prior?: number | null; flags?: RaceForecast["flags"]; rule?: RaceForecast["rule"]; marginLo?: number };
/** side a ("Ann Able") at pA; `prior` is the forecast's chance for side b, so 0.02 makes Ann a 98% pre-election favourite */
function fc(pA: number, o: Opt = {}): RaceForecast {
  const [a, b] = o.counted ?? [70_000, 30_000], exp = o.expected ?? 110_000, counted = a + b, out = Math.max(0, exp - counted);
  const cand = (id: string, votes: number, p: number) => ({ candidateId: id, name: id === "A" ? "Ann Able" : "Bo Baker", partyRaw: id === "A" ? "Democratic" : "Republican", side: (id === "A" ? "a" : "b") as "a" | "b", reportedVotes: votes, projectedVotes: D(votes), projectedShare: D(50), winProbability: p });
  const lead = pA >= 0.5 ? "A" : "B";
  return { raceId: o.id ?? "house-ZZ-01", rule: o.rule ?? "plurality", computedAt: "", snapshotId: "", modelVersion: "t", dataState: "LIMITED", forecastAvailable: true, calibration: "UNCALIBRATED", settled: null, call: null,
    candidates: [cand("A", a, pA), cand("B", b, 1 - pA)],
    principalMargin: o.prior === null ? null : { reported: null, projected: D(-20), probB: 1 - pA, prior: { margin: -20, probB: o.prior ?? 0.5 } },
    projectedTopTwo: { leaderId: lead, runnerUpId: lead === "A" ? "B" : "A", marginPp: D(20, o.marginLo ?? 5, 30), marginVotes: D(1) },
    turnout: { counted, expectedFinal: D(exp), outstanding: D(out, 0, out * 1.5), byUnit: [] }, display: { leaderId: lead, probability: 0.995, capped: false }, draws: 20_000, mcStdErr: 0, flags: o.flags ?? ["METHOD_UNKNOWN"], notes: [] };
}
const ob = (votes: [number, number], id = "house-ZZ-01"): RaceObservation => ({ raceId: id, providerRaceId: 1, providerPctReporting: 40, units: null, sourceAsOf: null, receivedAt: "", test: false,
  candidates: [{ candidateId: "A", name: "Ann Able", partyRaw: "Democratic", votes: votes[0], providerWinner: false }, { candidateId: "B", name: "Bo Baker", partyRaw: "Republican", votes: votes[1], providerWinner: false }] });
let n = 0;
const T = (m: number) => `2026-11-04T02:${String(m).padStart(2, "0")}:00Z`;
/** a run of updates, each with a slightly larger count; returns the ledger after each */
function runOf(cfg = DEFAULT_CALL_CONFIG, steps: number, mk: (i: number) => [RaceForecast, RaceObservation]): Ledger[] {
  let l = emptyLedger("LIVE", cfg); const out: Ledger[] = [];
  for (let i = 0; i < steps; i++) { const [f, o] = mk(i); l = stepLedger(l, { snapshotId: `s${++n}`, at: T(2 * i), forecasts: { [f.raceId]: f }, observations: { [f.raceId]: o } }); out.push(l); }
  return out;
}
const id = "house-ZZ-01";

test("quarantine: no model call before three updates with votes, however sure the model reads", () => {
  // a race that qualifies on the standard rule from its very first report (64% of the expected vote, a 40-point lead)
  const ls = runOf(DEFAULT_CALL_CONFIG, 4, (i) => [fc(0.9995, { counted: [70_000 + 1000 * i, 30_000] }), ob([70_000 + 1000 * i, 30_000])]);
  assert.deepEqual(ls.map((l) => l.races[id].status), ["APPROACHING", "APPROACHING", "FIRST_QUALIFIED", "MODEL_CALLED"]);
  assert.match(ls[0].races[id].blockers.join(" "), /fewer than 3 updates since its first returns \(1 so far\)/);
  assert.equal(ls[3].races[id].modelCall?.lane, "standard");
  // the same data read again is not an update
  const again = runOf(DEFAULT_CALL_CONFIG, 6, () => [fc(0.9995), ob([70_000, 30_000])]);
  assert.equal(again[5].races[id].updates, 1); assert.equal(again[5].races[id].modelCall, null);
  // with the quarantine off the old rule calls at the second update: this is the NY-01 timing
  const old = runOf({ ...DEFAULT_CALL_CONFIG, minUpdates: 0 }, 2, (i) => [fc(0.9995, { counted: [70_000 + 1000 * i, 30_000] }), ob([70_000 + 1000 * i, 30_000])]);
  assert.equal(old[1].races[id].status, "MODEL_CALLED");
});

test("safe-seat lane: the forecast's heavy favourite can be called on a thin count; nobody else can", () => {
  // 15% of the expected vote counted: far under the standard 50% floor, and the outstanding-ballots test cannot pass
  const thin = (o: Opt = {}) => (i: number): [RaceForecast, RaceObservation] => [fc(0.9995, { counted: [11_000 + 500 * i, 5_000], expected: 110_000, ...o }), ob([11_000 + 500 * i, 5_000], o.id)];
  const safe = runOf(DEFAULT_CALL_CONFIG, 4, thin({ prior: 0.02 }));
  // a safe seat's own quarantine is one update, so it is called at its second (two qualifying updates in a row)
  assert.deepEqual(safe.map((l) => l.races[id].status), ["FIRST_QUALIFIED", "MODEL_CALLED", "MODEL_CALLED", "MODEL_CALLED"]);
  assert.equal(safe[3].races[id].modelCall?.lane, "safe-seat"); assert.equal(safe[3].races[id].safeSeat, true); assert.equal(safe[3].races[id].modelCall?.calledAt, T(2));
  assert.match(safe[1].events.at(-1)!.detail, /safe-seat lane/);
  // with the lane's quarantine set to the standard three, the same seat waits for its fourth update
  const slow = runOf({ ...DEFAULT_CALL_CONFIG, fast: { ...DEFAULT_CALL_CONFIG.fast, minUpdates: 3 } }, 4, thin({ prior: 0.02 }));
  assert.deepEqual(slow.map((l) => l.races[id].status), ["APPROACHING", "APPROACHING", "FIRST_QUALIFIED", "MODEL_CALLED"]);
  const called = (o: Opt) => runOf(DEFAULT_CALL_CONFIG, 6, thin(o))[5].races[o.id ?? id];
  assert.equal(called({ prior: 0.1 }).modelCall, null, "a 90% favourite is not a safe seat");
  assert.match(called({ prior: 0.1 }).blockers.join(" "), /under 50% of the expected vote/);
  assert.equal(called({ prior: 0.98 }).modelCall, null, "the model's leader is not the forecast's favourite: an upset in the making is never fast-called");
  assert.equal(called({ prior: null }).modelCall, null, "no forecast, no lane");
  assert.equal(called({ prior: 0.02, id: "bm-ZZ-question-1" }).modelCall, null, "a ballot measure is never in the lane");
  assert.equal(called({ prior: 0.02, rule: "ranked_choice" }).modelCall, null, "nor a ranked-choice race");
  assert.equal(called({ prior: 0.02, flags: ["PROVIDER_ROWS_INCONSISTENT"] }).modelCall, null, "a data flag blocks the lane too");
  assert.equal(called({ prior: 0.02, marginLo: -1 }).modelCall, null, "so does a 95% margin range that includes a loss");
  // under the lane's own floor (10% of the expected vote) even a safe seat waits
  const under = runOf(DEFAULT_CALL_CONFIG, 6, (i) => [fc(0.9995, { counted: [6_000 + 100 * i, 2_000], prior: 0.02 }), ob([6_000 + 100 * i, 2_000])]);
  assert.equal(under[5].races[id].modelCall, null); assert.match(under[5].races[id].blockers.join(" "), /safe-seat floor/);
  // a race modeled county by county waits for a quarter of the expected vote: 20,000 of 110,000 is not enough, 30,000 is
  const cty = (a: number) => runOf(DEFAULT_CALL_CONFIG, 6, (i) => [fc(0.9995, { counted: [a + 100 * i, 5_000], prior: 0.02, flags: ["METHOD_UNKNOWN", "COUNTY_MODEL"] }), ob([a + 100 * i, 5_000])]);
  assert.equal(cty(15_000)[5].races[id].modelCall, null); assert.match(cty(15_000)[5].races[id].blockers.join(" "), /under 25% of the expected vote is counted \(safe-seat floor\)/);
  assert.equal(cty(25_000)[5].races[id].modelCall?.lane, "safe-seat");
  // the favourite must lead the count
  const behind = runOf(DEFAULT_CALL_CONFIG, 6, (i) => [fc(0.9995, { counted: [5_000 + 100 * i, 11_000], prior: 0.02 }), ob([5_000 + 100 * i, 11_000])]);
  assert.equal(behind[5].races[id].modelCall, null);
  // switched off, the lane does nothing
  const off = runOf({ ...DEFAULT_CALL_CONFIG, fast: { ...DEFAULT_CALL_CONFIG.fast, on: false } }, 6, thin({ prior: 0.02 }));
  assert.equal(off[5].races[id].modelCall, null);
  // a race that passes the standard rule is a standard call even when it is a safe seat
  const p = probe(fc(0.9995, { prior: 0.02 }), DEFAULT_CALL_CONFIG, false); assert.equal(p.lane, "standard"); assert.equal(p.safeSeat, true);
});

test("the settings of the call rule, as shipped", () => {
  assert.equal(DEFAULT_CALL_CONFIG.threshold, 0.993); assert.equal(DEFAULT_CALL_CONFIG.consecutive, 2); assert.equal(DEFAULT_CALL_CONFIG.minUpdates, 3);
  assert.deepEqual(DEFAULT_CALL_CONFIG.fast, { on: true, minPrior: 0.97, minCountedShare: 0.1, minCountedShareCounty: 0.25, kinds: ["sen", "gov", "house"], minUpdates: 1 });
  assert.ok(DEFAULT_CALL_CONFIG.blockingFlags.includes("PROVIDER_ROWS_INCONSISTENT"));
});

test("provider rows: a total row among the counties, or a total far above them, is caught; towns beside counties are not", () => {
  const c = (a: number, b: number) => [{ name: "Chris Gallant", party: "Democratic", votes: a }, { name: "Nick LaLota", party: "Republican", votes: b }];
  // New York's 1st district as civicAPI published it at 9:50 PM on November 3, 2026: the race total is both rows added
  const ny: CivicRawRace = { id: 1, candidates: c(144_114, 111_072), percent_reporting: 85.6, region_results: {
    all: { name: "All Counties (Active Registered Voters)", percent_reporting: 11.23, candidates: c(72_057, 55_536) }, suffolk: { name: "Suffolk", fips: "36103", percent_reporting: 11.23, candidates: c(72_057, 55_536) } } };
  const why = rowIntegrity(ny); assert.equal(why.length, 1); assert.match(why[0], /total row \("All Counties \(Active Registered Voters\)"\) among the county rows/);
  assert.deepEqual(observe("house-NY-01", ny, "x").integrity, why);
  // the same rows with an honest race total: a total row alone is not a fault
  assert.deepEqual(rowIntegrity({ ...ny, candidates: c(72_057, 55_536) }), []);
  // no total row, but a race total 1.4 times its counties
  assert.match(rowIntegrity({ id: 2, candidates: c(70_000, 70_000), region_results: { a: { name: "Kings", candidates: c(50_000, 50_000) } } })[0], /1\.40 times the sum of its county rows/);
  // a state that lists towns and counties: the rows sum to twice the total, which is normal
  assert.deepEqual(rowIntegrity({ id: 3, candidates: c(100, 80), region_results: { t: { name: "Nantucket", candidates: c(100, 80) }, co: { name: "Nantucket County", candidates: c(100, 80) } } }), []);
  // no rows at all (the live search without county detail), or no votes yet: nothing to check, nothing flagged
  assert.deepEqual(rowIntegrity({ id: 4, candidates: c(10, 5) }), []); assert.deepEqual(rowIntegrity({ ...ny, candidates: c(0, 0) }), []);
  assert.equal(observe("house-NY-01", { id: 4, candidates: c(10, 5) }, "x").integrity, undefined);
});

test("too close to call: a 95% range that reaches inside half a point blocks the call", () => {
  const p = (lo: number) => probe(fc(0.9995, { marginLo: lo }), DEFAULT_CALL_CONFIG, false);
  assert.equal(p(0.6).qualifies, true);
  assert.equal(p(0.3).qualifies, false); assert.match(p(0.3).blockers.join(" "), /recount territory/);
  assert.equal(DEFAULT_CALL_CONFIG.minMarginLo, 0.5);
});

test("a county-modeled race is stress-tested against where its outstanding ballots are", () => {
  // 50,000 counted to 44,000; the high estimate of what is out is 20,000, so the runner-up needs 65% of it
  const mk = (outRunnerShare: number, flags: RaceForecast["flags"]) => { const f = fc(0.9995, { counted: [50_000, 44_000], expected: 110_000, flags });
    f.turnout.outstanding = D(16_000, 0, 20_000); f.candidates[0].projectedVotes = D(50_000 + 16_000 * (1 - outRunnerShare)); f.candidates[1].projectedVotes = D(44_000 + 16_000 * outRunnerShare); return probe(f, DEFAULT_CALL_CONFIG, false); };
  // read from its total: 65% clears the plain 60% test wherever the ballots are
  assert.equal(mk(0.6, ["METHOD_UNKNOWN"]).qualifies, true);
  // county by county: if those counties are expected to give him 60%, needing 65% is only five points more, and the race waits
  assert.equal(mk(0.6, ["METHOD_UNKNOWN", "COUNTY_MODEL"]).qualifies, false);
  // if they are expected to give him 40%, needing 65% is out of reach
  assert.equal(mk(0.4, ["METHOD_UNKNOWN", "COUNTY_MODEL"]).qualifies, true);
});

test("a close race must hold its qualification for half an hour before it is called", () => {
  // updates two minutes apart; the low end of the 95% range is 1 point (close) or 5 (not)
  const run = (lo: number, steps: number) => runOf(DEFAULT_CALL_CONFIG, steps, (i) => [fc(0.9995, { counted: [60_000 + 100 * i, 30_000], marginLo: lo }), ob([60_000 + 100 * i, 30_000])]);
  const wide = run(5, 6); assert.ok(wide[5].races[id].modelCall, "not close: called after the quarantine and two qualifying updates");
  const close = run(1, 22);
  assert.equal(close[12].races[id].modelCall, null, "24 minutes in: still held");
  assert.equal(close[12].races[id].status, "FIRST_QUALIFIED");
  assert.ok(close[21].races[id].modelCall, "held for 30 minutes without a break: called");
  assert.deepEqual(DEFAULT_CALL_CONFIG.close, { belowLo: 2, holdMin: 30 });
});
