import assert from "node:assert/strict";
import test from "node:test";
import { HYPER_V1, HYPER_V2 } from "../../app/results/_vai/hyper";
import { anchoredStateShifts, cleanRow } from "../../app/results/_vai/preference";
import { Rng, seedFrom } from "../../app/results/_vai/rng";
import { simulateRace, type SimulationInput } from "../../app/results/_vai/simulate";
import type { RaceRule } from "../../app/results/_vai/types";
import { assertNoFuture, brier, CHECKPOINT_SHARE, checkTimestampIntegrity, clusterBootstrap, crps, logLoss, quantileOf, ReplayStore, Scorer, type Snapshot } from "../../scripts/vai/backtest/lib";
import { countedAtTau, drawTruth, partitionOf, runSynthetic, tauForShare, ORDERS } from "../../scripts/vai/backtest/run_synthetic";
import { anchoredRaces, ELECTION_NIGHT, type AnchoredRace } from "./_support";

const found = anchoredRaces();
const race: AnchoredRace | undefined = found?.races.find((r) => r.race.liveUse === "ELIGIBLE" && Object.keys(r.rows).length >= 10 && Object.keys(r.rows).length <= 80);
const skip = race ? false : "no anchored race with county rows on disk";

const snap = (t: string, n: number, cls: Snapshot["class"] = "SYNTHETIC", id = "R"): Snapshot => ({ class: cls, raceId: id, availableAt: t, counted: { c1: [n, n, 0] }, source: "test" });

// ---- replay store, timestamp integrity, leakage -------------------------------------------------------------------------------

test("replay: a view at asOf holds nothing dated later, and the snapshots it returns are frozen", () => {
  const store = new ReplayStore("R", [snap("2026-11-04T05:00:00Z", 30), snap("2026-11-04T03:00:00Z", 10), snap("2026-11-04T04:00:00Z", 20)]);
  const v = store.view("2026-11-04T04:00:00Z");
  assert.deepEqual(v.history.map((s) => s.availableAt), ["2026-11-04T03:00:00Z", "2026-11-04T04:00:00Z"]);
  assert.equal(v.latest!.counted.c1[0], 20);
  assert.equal(store.view("2026-11-04T02:00:00Z").latest, null);
  assert.throws(() => { "use strict"; (v.history[0] as Snapshot).source = "x"; });
  assertNoFuture(v);
});

test("replay: a future snapshot in a view is refused, and a foreign race in the store is refused", () => {
  assert.throws(() => assertNoFuture({ asOf: "2026-11-04T03:00:00Z", raceId: "R", latest: null, history: [snap("2026-11-04T04:00:00Z", 1)] }), /future snapshot/);
  assert.throws(() => new ReplayStore("R", [snap("2026-11-04T03:00:00Z", 1, "SYNTHETIC", "OTHER")]));
});

test("replay: the scorer is the only holder of the truth; a view has no truth field", () => {
  const store = new ReplayStore("R", [snap("2026-11-04T03:00:00Z", 1)]);
  const keys = Object.keys(store.view("2026-11-05T00:00:00Z"));
  assert.deepEqual(keys.sort(), ["asOf", "history", "latest", "raceId"]);
  assert.equal(new Scorer({ class: "SYNTHETIC", raceId: "R", county: { c1: [1, 1, 0] }, source: "t" }).truthClass, "SYNTHETIC");
});

test("integrity: duplicates, decreasing counts, bad timestamps, mixed classes and final returns in a replay are all caught", () => {
  assert.deepEqual(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 1), snap("2026-11-04T04:00:00Z", 2)]), []);
  assert.ok(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 1), snap("2026-11-04T03:00:00Z", 2)]).some((i) => i.code === "DUPLICATE_TIMESTAMP"));
  assert.ok(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 5), snap("2026-11-04T04:00:00Z", 2)]).some((i) => i.code === "COUNT_DECREASED"));
  assert.ok(checkTimestampIntegrity([snap("not a time", 1)]).some((i) => i.code === "BAD_TIMESTAMP"));
  assert.ok(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 1), snap("2026-11-04T04:00:00Z", 2, "HISTORICAL_OBSERVED")]).some((i) => i.code === "MIXED_SYNTHETIC_AND_REAL"));
  assert.ok(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 1, "FINAL_RETURNS")]).some((i) => i.code === "FINAL_RETURNS_IN_REPLAY_INPUT"));
  // a revised (downward) county record inside the tolerance is accepted, outside it is not
  assert.deepEqual(checkTimestampIntegrity([snap("2026-11-04T03:00:00Z", 5), snap("2026-11-04T04:00:00Z", 4)], { revisionTolerance: 5 }), []);
});

// ---- scores -------------------------------------------------------------------------------------------------------------------

test("scores: CRPS is zero for a point mass at the truth and grows with distance; Brier and log loss are proper", () => {
  assert.equal(crps(Float64Array.from([2, 2, 2]), 2), 0);
  assert.ok(crps(Float64Array.from([2, 2, 2]), 5) > crps(Float64Array.from([2, 2, 2]), 3));
  assert.ok(brier(0.9, true) < brier(0.5, true) && brier(0.5, true) < brier(0.1, true));
  assert.ok(logLoss(0.9, true) < logLoss(0.5, true));
  assert.ok(Number.isFinite(logLoss(0, true)) && Number.isFinite(logLoss(1, false)), "a certain wrong call is bounded, not infinite");
  // truthful forecast beats an overconfident one on expectation: p=0.7 forecast vs outcomes drawn at 0.7
  const r = new Rng(11);
  let honest = 0, bold = 0;
  for (let i = 0; i < 4000; i++) { const hit = r.uniform() < 0.7; honest += brier(0.7, hit); bold += brier(0.99, hit); }
  assert.ok(honest < bold);
  assert.equal(quantileOf(Float64Array.from([1, 2, 3, 4, 5]), 0.5), 3);
});

test("bootstrap: clusters are resampled whole, an empty set gives no interval, and the same seed gives the same interval", () => {
  const rows = ["a", "b", "c", "d"].flatMap((c, i) => [0, 1, 2].map((k) => ({ cluster: c, value: i + k })));
  const x = clusterBootstrap(rows, 200, 5), y = clusterBootstrap(rows, 200, 5);
  assert.deepEqual(x, y);
  assert.equal(x.clusters, 4);
  assert.ok(x.lo! <= x.mean! && x.mean! <= x.hi!);
  assert.equal(clusterBootstrap([], 100, 1).mean, null);
});

// ---- the synthetic generator --------------------------------------------------------------------------------------------------

test("generator: counted never exceeds final, votes are non-negative, shares are monotone in progress, and complete equals final", { skip }, () => {
  for (const order of ORDERS) {
    const t = drawTruth(race!, 0.05, 1, order, 9);
    let last = 0;
    for (const share of [0.03, 0.25, 0.5, 0.75, 0.9, 0.97]) {
      const counted = countedAtTau(t, tauForShare(t, share));
      const total = Object.values(counted).reduce((s, c) => s + c[0] + c[1] + c[2], 0);
      assert.ok(Math.abs(total / t.finalTotal - share) < 0.02, `${order} ${share}: ${total / t.finalTotal}`);
      assert.ok(total >= last);
      last = total;
      for (const c of t.counties) { const v = counted[c.id]; if (v) { assert.ok(v.every((x) => x >= 0)); assert.ok(v[0] + v[1] + v[2] <= c.T + 1); } }
    }
    const done = countedAtTau(t, 10);
    for (const c of t.counties) assert.ok(Math.abs(done[c.id][0] - c.a) <= 1 && Math.abs(done[c.id][1] - c.b) <= 2, `${c.id}`);
  }
});

test("generator: seeds are reproducible, orders differ only in who is counted first (same final truth)", { skip }, () => {
  const a = drawTruth(race!, 0.05, 1, "NEUTRAL", 9), a2 = drawTruth(race!, 0.05, 1, "NEUTRAL", 9), e = drawTruth(race!, 0.05, 1, "EARLY_A", 9);
  assert.deepEqual(a, a2);
  assert.ok(Math.abs(a.finalMargin - e.finalMargin) < 0.5, "the final margin does not depend on the order");
  const early = (t: typeof a) => { const c = countedAtTau(t, tauForShare(t, 0.25)); const A = Object.values(c).reduce((s, v) => s + v[0], 0), B = Object.values(c).reduce((s, v) => s + v[1], 0); return (B - A) / (A + B); };
  assert.ok(early(e) < early(a), "EARLY_A leaves side A ahead of the neutral order at the first quarter");
});

test("partition: assignment depends on the state alone, not on the race, the seed or the order", () => {
  assert.equal(partitionOf("PA"), partitionOf("PA"));
  assert.ok(["TRAIN", "HELD_OUT"].includes(partitionOf("GA")));
  const parts = new Set(["AL", "AK", "AZ", "CA", "CO", "FL", "GA", "IA", "MI", "NV", "OH", "PA", "TX", "WI"].map(partitionOf));
  assert.equal(parts.size, 2, "both partitions are populated");
});

// ---- the simulation under stress (T7 cases not covered by simulate.test.ts) -----------------------------------------------------

const plurality = (r: AnchoredRace): RaceRule => ({ raceId: r.race.raceId, kind: r.race.kind, state: r.race.state, office: "", rule: "PLURALITY", threshold: null, denominator: null, ballotFloor: null, support: "SUPPORTED", outputs: ["P_WIN"], isDefault: false } as RaceRule);
const NO_PROFILE = { category: null, unresolved: false, countSpeed: null, receiptClass: null };

function simInput(patch: Partial<SimulationInput> & { share?: number; counted?: SimulationInput["counted"] } = {}, J = 400, seed = 21): SimulationInput {
  const r = race!;
  const keys = Object.keys(r.rows).sort();
  let counted = patch.counted;
  if (!counted) {
    counted = {};
    const share = patch.share ?? 0.5;
    for (const k of keys) { const row = cleanRow(r.rows[k]).row; counted[k] = [Math.round(row[0] * share), Math.round(row[1] * share), Math.round(row[2] * share)]; }
  }
  const shifts = anchoredStateShifts(r.race.published.dist!, r.race.calibration!, r.rows, J, seed, HYPER_V2);
  const { share: _s, ...rest } = patch;
  void _s;
  return {
    raceId: r.race.raceId, asOf: "2026-11-04T03:00:00Z", rule: plurality(r), priorId: found!.priorId, prior: r.race, rows: r.rows, counted, profile: NO_PROFILE, receipt: ELECTION_NIGHT,
    stateShift: { kind: "DRAWS", values: shifts.values }, hyper: HYPER_V2, shiftMode: "MARGINALISED", seed, draws: J, provenance: {}, ...rest,
  };
}

test("stress: confidence does not rise because time passed: the same counts at a later asOf give the same distribution", { skip }, () => {
  const a = simulateRace(simInput({ asOf: "2026-11-04T03:00:00Z" })), b = simulateRace(simInput({ asOf: "2026-11-04T09:00:00Z" }));
  assert.deepEqual(Array.from(a.joint!.margin), Array.from(b.joint!.margin));
  assert.equal(a.record.quality, b.record.quality);
  assert.equal(a.record.margin!.sd, b.record.margin!.sd);
});

test("stress: a verified official outstanding figure is used and bounds the remaining-vote spread by the rejection prior; without it the flag says so", { skip }, () => {
  const plain = simulateRace(simInput());
  assert.ok(plain.record.guardrails.flags.includes("NO_OFFICIAL_OUTSTANDING_EVIDENCE"));
  const rem = plain.record.outstanding!.estimated!.median;
  const withOff = simulateRace(simInput({ official: { outstanding: rem, scope: "STATEWIDE_OR_DISTRICT", recordIds: ["TEST"] } }));
  assert.ok(withOff.record.guardrails.flags.includes("OFFICIAL_OUTSTANDING_USED"));
  assert.ok(!withOff.record.guardrails.flags.includes("NO_OFFICIAL_OUTSTANDING_EVIDENCE"));
  const w = withOff.record.outstanding!.estimated!;
  // the official figure sets the centre (less a rejected share); its spread is the Beta(1, 30) rejection prior, about 10% of the statement at most
  assert.ok(w.median <= rem && w.median > 0.9 * rem, `median ${w.median} vs statement ${rem}`);
  assert.ok(w.q90 - w.q10 < 0.12 * rem, `official spread ${w.q90 - w.q10} vs statement ${rem}`);
});

test("stress: an official figure far below the model's own estimate (a county/statewide discrepancy) is not silently averaged away", { skip }, () => {
  const plain = simulateRace(simInput());
  const rem = plain.record.outstanding!.estimated!.median;
  const low = simulateRace(simInput({ official: { outstanding: rem * 0.3, scope: "STATEWIDE_OR_DISTRICT", recordIds: ["TEST"] } }));
  const lowMed = low.record.outstanding!.estimated!.median;
  assert.ok(lowMed < rem, "the official statement pulls the estimate down");
  assert.ok(low.record.reported!.total > 0 && lowMed >= 0);
  for (let j = 0; j < low.joint!.draws; j++) assert.ok(low.joint!.remaining[j] >= 0);
});

test("stress: unexpectedly high turnout is flagged and the final total is allowed to exceed the forecast", { skip }, () => {
  const keys = Object.keys(race!.rows).sort();
  const counted: SimulationInput["counted"] = {};
  for (const k of keys) { const row = cleanRow(race!.rows[k]).row; counted[k] = [Math.round(row[0] * 1.6), Math.round(row[1] * 1.6), Math.round(row[2] * 1.6)]; }
  const out = simulateRace(simInput({ counted }));
  assert.ok(out.record.guardrails.flags.includes("TOTAL_EXCEEDS_EXPECTED"));
  assert.ok(out.joint!.remaining.every((v) => v >= 0));
  assert.ok(out.record.finalTotal!.median >= out.record.reported!.total);
});

test("stress: multiple candidates are never hidden: the other-share is carried at the forecast's level and flagged", { skip }, () => {
  const out = simulateRace(simInput());
  assert.ok(out.record.guardrails.flags.includes("OTHER_CANDIDATES_AT_FORECAST_SHARE"));
  assert.ok(out.record.reported!.other >= 0);
});

test("stress: a county that is not in the forecast file is flagged, not dropped silently; a missing county counts as nothing counted", { skip }, () => {
  const keys = Object.keys(race!.rows).sort();
  const base = simInput();
  const counted: SimulationInput["counted"] = { ...base.counted, ZZZZZ: [10, 10, 0] };
  delete counted[keys[0]];
  const out = simulateRace({ ...base, counted });
  assert.ok(out.record.guardrails.flags.includes("COUNTED_COUNTY_NOT_IN_FORECAST_FILE"));
  assert.equal(out.record.quality === "OK", false, "an unmatched county degrades the quality");
  assert.ok(out.joint!.remaining.every((v) => v >= 0));
});

test("stress: a stale feed or low county coverage degrades the output with a named flag; the probability is not made more certain", { skip }, () => {
  const ok = simulateRace(simInput({ profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" } }));
  const stale = simulateRace(simInput({ profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" }, feed: { coverage: 0.4, stale: true, latestSourceTimestamp: "2026-11-04T01:00:00Z", flags: ["FEED_TEST"] } }));
  assert.ok(stale.record.guardrails.flags.includes("STALE_FEED") && stale.record.guardrails.flags.includes("COUNTY_COVERAGE_LOW") && stale.record.guardrails.flags.includes("FEED_TEST"));
  assert.equal(stale.record.quality, "DEGRADED");
  assert.notEqual(ok.record.quality, "INSUFFICIENT");
  assert.equal(stale.record.margin!.sd, ok.record.margin!.sd, "feed trouble changes the label, never the spread");
});

test("stress: a prior that the count flatly contradicts leaves too little effective sample; the probability is withheld, not reported", { skip }, () => {
  const J = 300;
  const r = new Rng(3);
  const values = Float64Array.from({ length: J }, () => 1.6 + 0.02 * r.normal());
  const out = simulateRace(simInput({ share: 0.9, stateShift: { kind: "DRAWS", values }, shiftMode: "WEIGHTED" }, J));
  assert.ok(out.record.guardrails.flags.includes("LOW_EFFECTIVE_SAMPLE_SIZE"), `flags ${out.record.guardrails.flags.join(",")} ess ${out.record.diagnostics.essFraction}`);
  assert.equal(out.record.outcome, null);
  assert.equal(out.record.quality, "INSUFFICIENT");
});

test("stress: an unexpected count order widens, never shifts: a state the ledger calls neutral still gets the same centre when the count turns out early-B", { skip }, () => {
  const t = drawTruth(race!, 0.0, 2, "EARLY_B", 5);
  const counted = countedAtTau(t, tauForShare(t, 0.4));
  const withLedger = simulateRace(simInput({ counted, profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" } }));
  const none = simulateRace(simInput({ counted }));
  assert.ok(Number.isFinite(withLedger.record.margin!.mean) && Number.isFinite(none.record.margin!.mean));
  assert.ok(Math.abs(withLedger.record.margin!.mean - none.record.margin!.mean) < 3 * Math.max(withLedger.record.margin!.sd, none.record.margin!.sd), "centres agree within the stated spread");
});

test("stress: the late-mail profile adds count-order variance on top of the neutral one and does not shift the centre automatically", { skip }, () => {
  const late = simulateRace(simInput({ profile: { category: "C", unresolved: false, countSpeed: 2, receiptClass: "POSTMARK_GRACE" } }));
  const neutral = simulateRace(simInput({ profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" } }));
  assert.ok(late.record.margin!.sd >= neutral.record.margin!.sd * 0.95, `late ${late.record.margin!.sd} vs neutral ${neutral.record.margin!.sd}`);
  assert.ok(Math.abs(late.record.margin!.mean - neutral.record.margin!.mean) < 4 * Math.max(late.record.margin!.sd, 0.5));
});

test("stress: hyperparameters are research-only: every record from v1 or v2 carries the uncalibrated flag", { skip }, () => {
  for (const hyper of [HYPER_V1, HYPER_V2]) assert.ok(simulateRace(simInput({ hyper })).record.guardrails.flags.includes("HYPERPARAMETERS_UNCALIBRATED"));
});

// ---- the harness end to end ----------------------------------------------------------------------------------------------------

test("harness: a tiny synthetic run is reproducible, labelled synthetic, passes timestamp integrity, and never leaks the final margin into a model row", { skip, timeout: 600000 }, () => {
  const small = { races: 1, reps: 1, draws: 60, seed: 4, models: ["B", "C", "D", "E"], checkpoints: ["NONE", "Q1", "COMPLETE"] as const };
  const a = runSynthetic({ ...small, checkpoints: [...small.checkpoints] });
  const b = runSynthetic({ ...small, checkpoints: [...small.checkpoints] });
  const stable = (rows: typeof a.rows) => JSON.stringify(rows.map((r) => ({ ...r, ms: null })));
  assert.equal(stable(a.rows), stable(b.rows), "identical seeds give identical rows (runtime aside)");
  assert.ok(a.integrity.every((i) => i.issues.length === 0), JSON.stringify(a.integrity));
  assert.ok(a.rows.length > 0);
  const models = new Set(a.rows.map((r) => r.model));
  for (const m of ["B", "C", "D", "E"]) assert.ok(models.has(m), `row for ${m}`);
  for (const m of ["A_PUBLISHED", "REPORTED_LEAD", "UNIFORM_SWING"]) assert.ok(models.has(m), `row for ${m}`);
  // no future leakage: the checkpoint-NONE model rows depend on nothing counted, so their margins equal across orders and reps of the same race
  const none = a.rows.filter((r) => r.model === "D" && r.checkpoint === "NONE");
  assert.ok(none.length >= 3);
  assert.ok(new Set(none.map((r) => r.marginMedian)).size === 1, "at the NONE checkpoint the output cannot depend on the truth or the order");
  // the baselines at COMPLETE see the whole count: the reported lead is the final margin (up to rounding)
  for (const r of a.rows.filter((x) => x.model === "REPORTED_LEAD" && x.checkpoint === "COMPLETE")) assert.ok(Math.abs(r.marginMedian! - r.y) < 0.1);
  // invariants and accuracy are separate: every model output is finite and non-negative in remaining votes regardless of error
  for (const r of a.rows.filter((x) => x.ms !== null && x.marginMedian !== null)) assert.ok(Number.isFinite(r.marginMedian!) && r.remMedian! >= 0 && r.pB! >= 0 && r.pB! <= 1);
  void seedFrom;
  void CHECKPOINT_SHARE;
});
