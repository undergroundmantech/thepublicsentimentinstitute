import assert from "node:assert/strict";
import test from "node:test";
import { HYPER_V1 } from "../../app/results/_vai/hyper";
import { anchoredStateShifts, cleanRow } from "../../app/results/_vai/preference";
import { simulateRace, type SimulationInput } from "../../app/results/_vai/simulate";
import type { RaceRule } from "../../app/results/_vai/types";
import { anchoredRaces, ELECTION_NIGHT, type AnchoredRace } from "./_support";

const found = anchoredRaces();
const race: AnchoredRace | undefined = found?.races.find((r) => r.race.liveUse === "ELIGIBLE" && Object.keys(r.rows).length >= 10);
const skip = race ? false : "no anchored race with county rows on disk";

const plurality = (r: AnchoredRace): RaceRule => ({ raceId: r.race.raceId, kind: r.race.kind, state: r.race.state, office: "", rule: "PLURALITY", threshold: null, denominator: null, ballotFloor: null, support: "SUPPORTED", outputs: ["P_WIN"], isDefault: false } as RaceRule);

function input(r: AnchoredRace, share: number, seed: number, J = 600, patch: Partial<SimulationInput> = {}): SimulationInput {
  const counted: Record<string, [number, number, number]> = {};
  const keys = Object.keys(r.rows).sort();
  // Every county has counted `share` of its forecast total, with the forecast's own party split.
  for (const k of keys) {
    const row = cleanRow(r.rows[k]).row;
    counted[k] = [Math.round(row[0] * share), Math.round(row[1] * share), Math.round(row[2] * share)];
  }
  const shifts = anchoredStateShifts(r.race.published.dist!, r.race.calibration!, r.rows, J, seed, HYPER_V1);
  return {
    raceId: r.race.raceId, asOf: "2026-11-04T03:00:00Z", rule: plurality(r), priorId: found!.priorId, prior: r.race, rows: r.rows, counted,
    profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" }, receipt: ELECTION_NIGHT,
    stateShift: { kind: "DRAWS", values: shifts.values }, hyper: HYPER_V1, shiftMode: "MARGINALISED", seed, draws: J, provenance: {}, ...patch,
  };
}

test("T7: identical seeds give identical outputs, a different seed does not", { skip }, () => {
  const a = simulateRace(input(race!, 0.4, 7));
  const b = simulateRace(input(race!, 0.4, 7));
  const c = simulateRace(input(race!, 0.4, 8));
  assert.deepEqual(a.record, b.record);
  assert.deepEqual(Array.from(a.joint!.margin), Array.from(b.joint!.margin));
  assert.notDeepEqual(Array.from(a.joint!.margin), Array.from(c.joint!.margin));
});

test("T7: every record is WITHHELD with reasons, whatever the numbers say", { skip }, () => {
  for (const share of [0, 0.3, 0.95]) {
    const { record } = simulateRace(input(race!, share, 3));
    assert.equal(record.publication.eligible, false);
    assert.equal(record.publication.status, "WITHHELD");
    assert.ok(record.publication.reasons.length >= 3);
  }
});

test("T7: joint draws keep one coherent draw: total >= reported, remaining >= 0, margin from the same draw", { skip }, () => {
  const { record, joint } = simulateRace(input(race!, 0.5, 5));
  assert.ok(joint);
  for (let j = 0; j < joint.draws; j++) {
    assert.ok(joint.remaining[j] >= 0);
    assert.ok(joint.total[j] >= record.reported!.total - 1e-6);
    assert.ok(Math.abs(joint.total[j] - record.reported!.total - joint.remaining[j]) < 1e-3);
  }
  const mean = joint.margin.reduce((s, m) => s + m, 0) / joint.draws;
  assert.ok(Math.abs(mean - record.margin!.mean) < 1e-9);
});

test("T7: nothing counted reproduces the frozen prior within Monte Carlo error", { skip }, () => {
  const { record } = simulateRace(input(race!, 0, 11, 2000));
  assert.equal(record.modelStage, "PRIOR_ONLY");
  assert.ok(Math.abs(record.outcome!.pB - race!.race.published.probB!) < 0.06, `${record.outcome!.pB} vs ${race!.race.published.probB}`);
});

test("T7: unsupported rules and unanchored priors return a reasoned empty record, not numbers", { skip }, () => {
  const rcv = simulateRace(input(race!, 0.3, 1, 100, { rule: { ...plurality(race!), rule: "RCV", support: "UNSUPPORTED", outputs: ["FIRST_CHOICE_SHARES"] } as RaceRule }));
  assert.equal(rcv.record.status, "UNSUPPORTED");
  assert.equal(rcv.record.margin, null);
  assert.equal(rcv.record.outcome, null);
  assert.equal(rcv.joint, null);
  const none = simulateRace(input(race!, 0.3, 1, 100, { rule: null }));
  assert.equal(none.record.unsupportedReason, "NO_RULE");
  const loose = simulateRace(input(race!, 0.3, 1, 100, { prior: { ...race!.race, status: "NOT_ANCHORED_NEEDS_FORECAST_EXPORT" as never, liveUse: "WITHHELD" } }));
  assert.equal(loose.record.status, "NOT_ANCHORED");
});

test("T7: a near-complete count without completion evidence is flagged; more counted means less remaining", { skip }, () => {
  const near = simulateRace(input(race!, 0.97, 2));
  assert.ok(near.record.guardrails.flags.includes("NEAR_COMPLETION_UNVERIFIED") || near.record.modelStage !== "NEAR_COMPLETE");
  const less = simulateRace(input(race!, 0.2, 2));
  assert.ok(near.record.outstanding!.estimated!.median < less.record.outstanding!.estimated!.median);
});

test("T7: count-order evidence changes variance only: no automatic partisan shift", { skip }, () => {
  const a = simulateRace(input(race!, 0.4, 9, 1500, { profile: { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" } }));
  const d = simulateRace(input(race!, 0.4, 9, 1500, { profile: { category: "D", unresolved: true, countSpeed: 2, receiptClass: "POSTMARK_GRACE" } }));
  assert.equal(a.record.countOrder.effect, "VARIANCE_ONLY");
  assert.ok(Math.abs(a.record.margin!.mean - d.record.margin!.mean) < 1.5 * Math.max(a.record.margin!.sd, d.record.margin!.sd));
});
