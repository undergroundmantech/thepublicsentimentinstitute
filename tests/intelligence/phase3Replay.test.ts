// Phase 3: the model-call ledger, the replay clock and sources, the simulated-data firewall and the recorder.
// Bracketed numbers are docs/05 acceptance tests; "A" numbers are the addendum's section 6 checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { MemoryStore } from "../../app/lib/intelligence/captureStore";
import { withConfig } from "../../app/lib/engine/config";
import { namespaceOf, servable, simulatedAllowed } from "../../app/lib/engine/gate";
import { DEFAULT_CALL_CONFIG, emptyLedger, ledgerSummary, observationKey, recordEditorialCall, stepLedger, type Ledger } from "../../app/lib/engine/modelCalls";
import { preElectionFrom } from "../../app/lib/engine/national";
import { forecastRace } from "../../app/lib/engine/raceModel";
import { checkNamespace, nationalHistory, openArchive, raceHistory, recordFrame, recorderHealth, stateAt, verifyArchive, RecorderError } from "../../app/lib/engine/recorder";
import { evaluationBlockers, frameIndexAt, newClock, observedCheckpoints, pause, play, REPLAY_SPEEDS, seek, setSpeed, simulatedFixture, step, tick, type FixtureFrame } from "../../app/lib/engine/replay";
import type { ElectionSnapshot, RaceForecast, RaceObservation } from "../../app/lib/engine/types";
import { candidateId } from "../../app/results/2026/candidates";
import type { XIndex, XRace } from "../../app/results/2026/live";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;

// ---- a hand-built forecast, so the ledger's rule is tested apart from the model ----
const D = (m: number, lo = m, hi = m) => ({ mean: m, p50: m, i80: { lo, hi }, i95: { lo, hi } });
function fc(pA: number, o: { counted?: [number, number]; expected?: number; outHi?: number; flags?: RaceForecast["flags"]; call?: "A" | "B"; marginLo?: number; draws?: number } = {}): RaceForecast {
  const [a, b] = o.counted ?? [70_000, 30_000], exp = o.expected ?? 110_000, counted = a + b, out = exp - counted;
  const cand = (id: string, votes: number, p: number) => ({ candidateId: id, name: id === "A" ? "Ann Able" : "Bo Baker", partyRaw: id === "A" ? "Independent" : "Republican", side: (id === "A" ? "a" : "b") as "a" | "b", reportedVotes: votes, projectedVotes: D(votes), projectedShare: D(50), winProbability: p });
  const lead = pA >= 0.5 ? "A" : "B";
  return { raceId: "r1", rule: "plurality", computedAt: "", snapshotId: "", modelVersion: "t", dataState: "LIMITED", forecastAvailable: true, calibration: "UNCALIBRATED", settled: null,
    call: o.call ? { origin: "provider", source: "civicAPI", winnerId: o.call, name: o.call === "A" ? "Ann Able" : "Bo Baker" } : null,
    candidates: [cand("A", a, pA), cand("B", b, 1 - pA)], principalMargin: null,
    projectedTopTwo: { leaderId: lead, runnerUpId: lead === "A" ? "B" : "A", marginPp: D(20, o.marginLo ?? 5, 30), marginVotes: D(1) },
    turnout: { counted, expectedFinal: D(exp), outstanding: D(out, 0, o.outHi ?? out * 1.5), byUnit: [] }, display: { leaderId: lead, probability: Math.min(0.995, Math.max(pA, 1 - pA)), capped: false }, draws: o.draws ?? 20_000, mcStdErr: 0, flags: o.flags ?? ["METHOD_UNKNOWN"], notes: [] };
}
const ob = (votes: [number, number], pr = 80): RaceObservation => ({ raceId: "r1", providerRaceId: 1, providerPctReporting: pr, units: null, sourceAsOf: null, receivedAt: "", test: false, candidates: [{ candidateId: "A", name: "Ann Able", partyRaw: "Independent", votes: votes[0], providerWinner: false }, { candidateId: "B", name: "Bo Baker", partyRaw: "Republican", votes: votes[1], providerWinner: false }] });
let n = 0;
const go = (l: Ledger, f: RaceForecast, o: RaceObservation, at: string, snapshotId = `s${++n}`, stale = false) => stepLedger(l, { snapshotId, at, forecasts: { r1: f }, observations: { r1: o }, stale });
const T = (m: number) => `2026-11-04T02:${String(m).padStart(2, "0")}:00Z`;
const kinds = (l: Ledger) => l.events.map((e) => e.kind);

// These tests are about the consecutive-update rule on its own, so the first-report quarantine (three updates with
// votes before any call; tested in callRules.test.ts) is switched off for them.
const RULE = { ...DEFAULT_CALL_CONFIG, minUpdates: 0 };
test("[A6] a model call needs two consecutive DISTINCT qualifying updates; a re-read of the same data is not an update", () => {
  let l = emptyLedger("LIVE", RULE);
  assert.equal(l.config.threshold, 0.993); assert.equal(l.config.consecutive, 2);
  l = go(l, fc(0.999), ob([70_000, 30_000]), T(0));
  assert.equal(l.races.r1.status, "FIRST_QUALIFIED"); assert.equal(l.races.r1.firstQualifiedAt, T(0)); assert.equal(l.races.r1.modelCall, null);
  // the same observation again, three times, under new snapshot ids and later clocks: nothing advances
  for (const m of [1, 2, 3]) l = go(l, fc(0.999), ob([70_000, 30_000]), T(m));
  assert.equal(l.races.r1.status, "FIRST_QUALIFIED"); assert.equal(l.races.r1.qualifying, 1); assert.deepEqual(kinds(l), ["FIRST_QUALIFIED"]);
  // new data, same candidate still above the threshold: the call registers, with both times
  l = go(l, fc(0.999, { counted: [72_000, 31_000] }), ob([72_000, 31_000]), T(5));
  const c = l.races.r1.modelCall!; assert.equal(l.races.r1.status, "MODEL_CALLED"); assert.equal(c.calledAt, T(5)); assert.equal(l.races.r1.firstQualifiedAt, T(0)); assert.equal(c.name, "Ann Able"); assert.equal(c.partyRaw, "Independent", "an independent leader is called as herself");
  assert.deepEqual(kinds(l), ["FIRST_QUALIFIED", "MODEL_CALLED"]); assert.match(l.events[1].detail, /not an official call/);
  assert.equal(l.races.r1.official, null, "a model call never creates an official call");
  assert.notEqual(observationKey(ob([70_000, 30_000])), observationKey(ob([72_000, 31_000]))); assert.equal(observationKey(ob([1, 2])), observationKey({ ...ob([1, 2]), receivedAt: "later" }), "a clock is not data");
});

test("[A7] a drop below the threshold before confirmation resets the sequence; so does a different leader", () => {
  let l = go(emptyLedger("LIVE", RULE), fc(0.999), ob([70_000, 30_000]), T(0));
  l = go(l, fc(0.98, { counted: [71_000, 33_000] }), ob([71_000, 33_000]), T(5));
  assert.equal(l.races.r1.status, "APPROACHING"); assert.equal(l.races.r1.qualifying, 0); assert.equal(l.races.r1.firstQualifiedAt, null); assert.deepEqual(kinds(l), ["FIRST_QUALIFIED", "RESET"]);
  l = go(l, fc(0.999, { counted: [75_000, 33_000] }), ob([75_000, 33_000]), T(10));
  assert.equal(l.races.r1.status, "FIRST_QUALIFIED", "one qualifying update after a reset is only the first again"); assert.equal(l.races.r1.firstQualifiedAt, T(10));
  l = go(l, fc(0.999, { counted: [78_000, 33_000] }), ob([78_000, 33_000]), T(15)); assert.equal(l.races.r1.modelCall?.calledAt, T(15));
  // a different candidate at the second update is a first qualification for THAT candidate, not a call
  let m = go(emptyLedger("LIVE", RULE), fc(0.999), ob([70_000, 30_000]), T(0));
  m = go(m, fc(0.001, { counted: [30_000, 71_000] }), ob([30_000, 71_000]), T(5));
  assert.equal(m.races.r1.status, "FIRST_QUALIFIED"); assert.equal(m.races.r1.qualifyingCandidateId, "B"); assert.equal(m.races.r1.modelCall, null);
});

test("safeguards: a high probability alone does not qualify", () => {
  const blocked = (f: RaceForecast, o = ob([70_000, 30_000]), stale = false) => { const l = go(emptyLedger("LIVE", RULE), f, o, T(0), undefined, stale); assert.notEqual(l.races.r1.status, "FIRST_QUALIFIED"); return l.races.r1.blockers.join(" | "); };
  assert.match(blocked(fc(0.999, { flags: ["COUNT_EXCEEDS_FORECAST"] })), /COUNT_EXCEEDS_FORECAST/);
  assert.match(blocked(fc(0.999, { flags: ["TURNOUT_WEAK_EVIDENCE"] })), /TURNOUT_WEAK_EVIDENCE/);
  assert.match(blocked(fc(0.999, { flags: ["RULE_RANKED_CHOICE"] })), /RULE_RANKED_CHOICE/);
  assert.match(blocked(fc(0.999, { counted: [28_000, 12_000], expected: 110_000 })), /under 50% of the expected vote/);
  assert.match(blocked(fc(0.999, { counted: [52_000, 48_000], outHi: 60_000 })), /runner-up needs under 60%/, "an unsupported, narrow estimate of what is out cannot carry a call");
  assert.match(blocked(fc(0.999, { marginLo: -1 })), /95% range of the projected margin includes a loss/);
  assert.match(blocked(fc(0.999, { counted: [30_000, 70_000] })), /does not lead the count/);
  assert.match(blocked(fc(0.9935, { draws: 2_000 })), /simulation error/, "99.35% from 2,000 draws is not distinguishable from 99.3%");
  assert.match(blocked(fc(0.999), ob([70_000, 30_000]), true), /stale/);
});

test("the threshold is configurable, so 99.0%, 99.3% and 99.5% can be compared on the same data", () => {
  const at = (threshold: number) => go(emptyLedger("LIVE", { ...RULE, threshold }), fc(0.9945), ob([70_000, 30_000]), T(0)).races.r1.status;
  assert.equal(at(0.99), "FIRST_QUALIFIED"); assert.equal(at(0.993), "FIRST_QUALIFIED"); assert.equal(at(0.995), "APPROACHING");
  const three = { ...RULE, consecutive: 3 }; let l = emptyLedger("LIVE", three);
  for (const [i, v] of [[70_000, 30_000], [71_000, 30_000]].entries()) l = go(l, fc(0.999, { counted: v as [number, number] }), ob(v as [number, number]), T(i));
  assert.equal(l.races.r1.modelCall, null); l = go(l, fc(0.999, { counted: [72_000, 30_000] }), ob([72_000, 30_000]), T(3)); assert.ok(l.races.r1.modelCall);
});

test("after a model call nothing is erased: contradictions, lost confidence and official disagreement are added as alerts", () => {
  let l = go(emptyLedger("LIVE", RULE), fc(0.999), ob([70_000, 30_000]), T(0)); l = go(l, fc(0.999, { counted: [72_000, 30_000] }), ob([72_000, 30_000]), T(5));
  const call = l.races.r1.modelCall;
  l = go(l, fc(0.85, { counted: [73_000, 40_000] }), ob([73_000, 40_000]), T(10));
  assert.deepEqual(l.races.r1.modelCall, call, "the call is untouched"); assert.equal(kinds(l).at(-1), "ALERT_CONFIDENCE_DETERIORATED");
  l = go(l, fc(0.3, { counted: [73_000, 80_000] }), ob([73_000, 80_000]), T(15));
  assert.equal(kinds(l).at(-1), "ALERT_MODEL_CONTRADICTS_CALL"); assert.deepEqual(l.races.r1.modelCall, call); assert.equal(l.races.r1.status, "MODEL_CALLED"); assert.equal(l.races.r1.alerts, 2);
  // the provider calls the other candidate: recorded as official, separately, with a discrepancy alert
  l = go(l, fc(0.3, { counted: [73_000, 81_000], call: "B" }), ob([73_000, 81_000]), T(20));
  assert.equal(l.races.r1.official?.candidateId, "B"); assert.equal(l.races.r1.official?.firstSeenAt, T(20)); assert.ok(kinds(l).includes("OFFICIAL_CALL") && kinds(l).includes("ALERT_OFFICIAL_DISAGREES"));
  assert.deepEqual(l.races.r1.modelCall, call); assert.deepEqual(l.events.map((e) => e.seq), l.events.map((_, i) => i + 1), "the event log only grows");
  // an editorial call is a third, attributed thing
  assert.throws(() => recordEditorialCall(l, { raceId: "r1", candidateId: "B", name: "Bo Baker", decidedBy: "", decidedAt: T(25), reason: "x" }), /named person and a reason/);
  const e = recordEditorialCall(l, { raceId: "r1", candidateId: "B", name: "Bo Baker", decidedBy: "L. Editor", decidedAt: T(25), reason: "certified county canvass" });
  assert.equal(e.races.r1.editorial?.decidedBy, "L. Editor"); assert.deepEqual(e.races.r1.modelCall, call); assert.equal(kinds(e).at(-1), "EDITORIAL_CALL");
  assert.deepEqual(ledgerSummary(e), { monitored: 1, approaching: 0, firstQualified: 0, modelCalled: 1, official: 1, editorial: 1, alerts: 3, uncontested: 0 });
});

test("[A8] with the real engine: Nebraska's independent-v-Republican race reaches a model call for the candidate who leads, by name", () => {
  const r = race("sen-NE"); const mk = (rk: number, os: number): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: 100, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [["Pete Ricketts", "Republican", rk], ["Dan Osborn", "Independent", os]].map(([nm, p, v]) => ({ candidateId: candidateId(r.id, nm as string), name: nm as string, partyRaw: p as string, votes: v as number, providerWinner: false })) });
  let l = emptyLedger("HISTORICAL", RULE);
  for (const [i, [rk, os]] of [[300_000, 420_000], [301_000, 421_500]].entries()) {
    const o = mk(rk, os); const f = forecastRace(r, o, null, { seed: `s${i}`, computedAt: T(i), snapshotId: `s${i}`, draws: 4000 });
    l = stepLedger(l, { snapshotId: `s${i}`, at: T(i), forecasts: { [r.id]: f }, observations: { [r.id]: o } });
  }
  assert.equal(l.races[r.id].modelCall?.name, "Dan Osborn"); assert.equal(l.races[r.id].modelCall?.partyRaw, "Independent");
});

// ---- replay clock and sources ----
test("[A4] the replay clock runs on timestamps at 1x, 10x, 60x, 360x and 3600x", () => {
  assert.deepEqual([...REPLAY_SPEEDS], [1, 10, 60, 360, 3600]);
  const s = Date.parse("2026-11-03T23:00:00Z"), e = Date.parse("2026-11-04T13:00:00Z");
  let c = play(newClock(s, e, Date.parse("2026-11-04T01:30:00Z"))); assert.equal(c.tMs, Date.parse("2026-11-04T01:30:00Z"), "any start time in the window");
  for (const sp of REPLAY_SPEEDS) { const k = tick(setSpeed(c, sp), 1000); assert.equal(k.tMs - c.tMs, sp * 1000, `${sp}x: one second of watching is ${sp} seconds of election night`); }
  assert.equal(tick(setSpeed(c, 3600), 1000).tMs - c.tMs, 3_600_000, "3600x: one second is one hour");
  assert.equal(setSpeed(c, 7).speed, c.speed, "only the listed speeds");
  assert.equal(tick(pause(c), 5000).tMs, c.tMs, "paused means stopped");
  c = tick(setSpeed(c, 3600), 60_000); assert.equal(c.tMs, e); assert.equal(c.playing, false, "stops at the end");
  assert.equal(seek(c, s - 5).tMs, s); assert.equal(seek(c, e + 5).tMs, e);
  const times = [s + 1000, s + 5000, s + 9000];
  assert.equal(frameIndexAt(times, s), -1, "before the first observation there is nothing"); assert.equal(frameIndexAt(times, s + 5000), 1); assert.equal(frameIndexAt(times, s + 8999), 1); assert.equal(frameIndexAt(times, e), 2);
  const mid = seek(newClock(s, e), s + 6000);
  assert.equal(step(mid, times, 1).tMs, s + 9000); assert.equal(step(mid, times, -1).tMs, s + 5000); assert.equal(step(seek(mid, s + 5000), times, -1).tMs, s + 1000); assert.equal(step(seek(mid, s + 9000), times, 1).tMs, s + 9000);
});

const fx = (t: string, kind: string, future: boolean, votes: [number, number] | null, prev = t): FixtureFrame => ({ timestamp_utc: t, snapshot_kind: kind, source_provenance: { previous_capture_utc: prev, checkpoint_gap_minutes: 12, uses_future_observation: future },
  races: [{ race_id: "sen-NE", source_percent_reporting: votes ? 40 : null, candidates: votes ? [{ name: "Pete  Ricketts", party: "Republican", votes: votes[0] }, { name: "Dan  Osborn", party: "Independent", votes: votes[1] }] : [] }, { race_id: "sen-GA", source_percent_reporting: null, candidates: null }] });

test("[25][26][A10] fixture streams are SIMULATED and can never be used to score the model; authentic exports refuse simulated frames", () => {
  const hold = simulatedFixture([fx("2026-11-04T01:00:00.000Z", "OBSERVED_FORWARD_HOLD", false, [10, 12], "2026-11-04T00:58:00.000Z"), fx("2026-11-04T01:05:00.000Z", "OBSERVED_FORWARD_HOLD", false, [10, 12], "2026-11-04T00:58:00.000Z")], "forward_hold");
  assert.equal(hold.mode, "SIMULATED"); assert.match(hold.label, /^SIMULATED/); assert.ok(hold.frames.every((f) => f.snapshot.provenance.mode === "SIMULATED" && f.snapshot.provenance.synthetic));
  assert.equal(hold.frames[0].snapshot.snapshotId, hold.frames[1].snapshot.snapshotId, "a held export is the same observation, not a new one");
  assert.equal(hold.frames[0].snapshot.provenance.receivedAt, "2026-11-04T00:58:00.000Z", "the real observation time is kept");
  assert.equal(hold.frames[0].snapshot.races["sen-GA"], undefined, "a race the export did not include is absent, not zero");
  assert.ok(evaluationBlockers(hold).includes("the source is SIMULATED"));
  const lin = simulatedFixture([fx("2026-11-04T01:00:00.000Z", "LINEAR_SIMULATION", true, [10, 12])], "linear");
  assert.ok(lin.frames[0].snapshot.provenance.usesFutureObservation); assert.ok(evaluationBlockers(lin).some((b) => /later observations/.test(b)));
  assert.throws(() => simulatedFixture([fx("2026-11-04T01:00:00.000Z", "LINEAR_SIMULATION", true, [1, 2])], "forward_hold"), /expected OBSERVED_FORWARD_HOLD/);
  assert.throws(() => observedCheckpoints([fx("2026-11-04T01:00:00.000Z", "LINEAR_SIMULATION", true, [1, 2])]), /not a genuine observation/);
  const real = observedCheckpoints([fx("2026-11-04T01:00:00.000Z", "OBSERVED_FORWARD_HOLD", false, [10, 12]), fx("2026-11-04T03:00:00.000Z", "OBSERVED_FORWARD_HOLD", false, [9, 20])]);
  assert.equal(real.mode, "HISTORICAL"); assert.deepEqual(evaluationBlockers(real), []); assert.equal(real.frames[1].gapMinutes, 120);
  assert.equal(real.frames[1].snapshot.races["sen-NE"].candidates[0].votes, 9, "a count corrected downward is kept as observed");
  // the firewall: simulated data leaves the server only when the operator asks AND the deployment is not production
  assert.equal(simulatedAllowed({}), false); assert.equal(simulatedAllowed({ ONPOINT_ALLOW_SIMULATED: "on", VERCEL_ENV: "production" }), false); assert.equal(simulatedAllowed({ ONPOINT_ALLOW_SIMULATED: "on", VERCEL_ENV: "preview" }), true);
  assert.deepEqual(servable("SIMULATED", {}), { ok: false, status: 403, reason: "Simulated data is not available in this environment." });
  assert.equal(servable("SIMULATED", { ONPOINT_ALLOW_SIMULATED: "on", VERCEL_ENV: "production" }).ok, false);
  assert.equal(servable("HISTORICAL", {}).ok, false); assert.equal(servable("HISTORICAL", { ONPOINT_REPLAY: "on" }).ok, true); assert.equal(servable("LIVE", {}).ok, true);
  assert.deepEqual([namespaceOf("LIVE"), namespaceOf("HISTORICAL"), namespaceOf("SIMULATED")], ["live", "historical", "simulated"]);
});

// ---- the recorder ----
const cfg = withConfig({ draws: 250 });
const snap = (mode: "LIVE" | "HISTORICAL" | "SIMULATED", t: string, votes: [number, number], pr: number, synthetic = false): ElectionSnapshot => {
  const r = race("sen-NE"); const races: Record<string, RaceObservation> = { [r.id]: { raceId: r.id, providerRaceId: 7, providerPctReporting: pr, units: null, sourceAsOf: null, receivedAt: t, test: false,
    candidates: [["Pete Ricketts", "Republican", votes[0]], ["Dan Osborn", "Independent", votes[1]]].map(([nm, p, v]) => ({ candidateId: candidateId(r.id, nm as string), name: nm as string, partyRaw: p as string, votes: v as number, providerWinner: false })) } };
  return { snapshotId: `${mode.toLowerCase()}-${votes.join("-")}`, provenance: { mode, source: "test", sourceAsOf: null, receivedAt: t, usesFutureObservation: false, synthetic }, races, unmatchedProviderRaces: 0 };
};
const ctx = { index: ix, pre, cfg };
const H = (h: number, m = 0) => `2026-11-04T0${h}:${String(m).padStart(2, "0")}:00.000Z`;

test("[29][A5][A12] the recorder stores raw, canonical, computed and published layers; replays exactly; and a look back sees nothing later", async () => {
  const store = new MemoryStore();
  const f1 = await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1), [100_000, 120_000], 30), t: H(1), raw: Buffer.from("raw-1") });
  assert.equal(f1.status, "RECORDED");
  // the next poll finds the same data: no new state, only proof that the slot ran
  const same = await recordFrame(store, "civicapi", { ...ctx, snapshot: { ...snap("LIVE", H(1, 5), [100_000, 120_000], 30) }, t: H(1, 5) });
  assert.equal(same.status, "UNCHANGED"); assert.equal(same.state.stateId, f1.state.stateId);
  // a correction: Osborn's count goes DOWN. Stored as observed.
  const f2 = await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1, 10), [180_000, 110_000], 55), t: H(1, 10), raw: Buffer.from("raw-2") });
  const f3 = await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(2), [400_000, 300_000], 100), t: H(2), raw: Buffer.from("raw-3") });
  assert.equal(f2.state.races["sen-NE"].c.find((c) => c[1] === "Dan Osborn")![3], 110_000);
  // running the same frame again changes nothing; an older frame cannot be slipped in behind newer ones
  assert.equal((await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(2), [400_000, 300_000], 100), t: H(2) })).status, "EXISTS");
  await assert.rejects(recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1, 30), [1, 2], 1), t: H(1, 30) }), (e: RecorderError) => e.code === "OUT_OF_ORDER");
  const keys = [...store.objects.keys()];
  for (const layer of ["raw", "snapshot", "state", "published", "manifest"]) assert.equal(keys.filter((k) => k.startsWith(`engine/v1/live/civicapi/${layer}/`)).length, 3, `${layer}: one per observation`);
  assert.equal(keys.filter((k) => k.includes("/beat/")).length, 1);

  const a = await openArchive(store, "live", "civicapi"); assert.deepEqual(a.problems, []); assert.equal(a.manifests.length, 3);
  assert.ok(a.manifests.every((m) => /^[0-9a-f]{64}$/.test(m.layers.state.sha256) && m.layers.raw)); assert.equal(a.manifests[0].prev, null); assert.ok(a.manifests[2].prev);
  // seek backward: the state in force at 1:20 is the 1:10 frame, with no trace of 2:00
  const back = (await stateAt(store, a, Date.parse(H(1, 20))))!;
  assert.equal(back.stateId, f2.state.stateId); assert.equal(back.t, H(1, 10)); assert.ok(back.ledger.events.every((e) => e.at <= H(1, 10)));
  assert.equal(back.races["sen-NE"].counted, 290_000); assert.equal(await stateAt(store, a, Date.parse(H(0, 30))), null, "before the first observation there is nothing to show");
  assert.equal((await stateAt(store, a, Infinity))!.stateId, f3.state.stateId);
  // the dashboard's numbers moved with the data
  assert.notEqual(f1.state.national.senate.pD, f3.state.national.senate.pD); assert.notDeepEqual(f1.state.races["sen-NE"].pm, f3.state.races["sen-NE"].pm);
  // history for the charts, cut at the replay clock
  const nh = await nationalHistory(store, a); assert.equal(nh.length, 3); assert.equal(nh[1].gapMin, 10); assert.equal((await nationalHistory(store, a, Date.parse(H(1, 20)))).length, 2);
  const rh = await raceHistory(store, a, "sen-NE", Date.parse(H(1, 20))); assert.deepEqual(rh.map((p) => p.counted), [220_000, 290_000]); assert.ok(rh[1].margin && rh[1].probability != null);
  // recomputing every stored snapshot reproduces every stored state
  assert.deepEqual(await verifyArchive(store, a, ctx), { frames: 3, ok: 3, problems: [] });
  // tampering and loss are visible
  const sk = a.manifests[1].layers.state.key; const orig = store.objects.get(sk)!; store.objects.set(sk, Buffer.from("altered"));
  assert.ok((await verifyArchive(store, a, ctx)).problems.some((p) => /does not match its recorded SHA-256/.test(p))); store.objects.set(sk, orig);
  const mk = keys.find((k) => k.includes("/manifest/") && k.includes("T011000"))!; store.objects.delete(mk);
  assert.ok((await openArchive(store, "live", "civicapi")).problems.some((p) => /chain is broken/.test(p)));
});

test("[25] simulated data cannot enter an authentic archive, and lives in its own namespace", async () => {
  const store = new MemoryStore();
  const sim = await recordFrame(store, "sim-test", { ...ctx, snapshot: snap("SIMULATED", H(1), [5, 6], 10, true), t: H(1) });
  assert.equal(sim.state.mode, "SIMULATED"); assert.ok([...store.objects.keys()].every((k) => k.startsWith("engine/v1/simulated/")));
  assert.ok(Object.values(sim.state.races).every((r) => r.dataState === "SIMULATED" || r.dataState === "MISSING"), "every race row says SIMULATED");
  assert.throws(() => checkNamespace("live", snap("SIMULATED", H(1), [5, 6], 10, true)), (e: RecorderError) => e.code === "WRONG_NAMESPACE");
  assert.throws(() => checkNamespace("historical", snap("SIMULATED", H(1), [5, 6], 10, true)), (e: RecorderError) => e.code === "WRONG_NAMESPACE");
  await assert.rejects(recordFrame(store, "x", { ...ctx, snapshot: snap("HISTORICAL", H(1), [5, 6], 10, true), t: H(1) }), (e: RecorderError) => e.code === "SYNTHETIC_REFUSED");
  await assert.rejects(recordFrame(store, "x", { ...ctx, snapshot: { ...snap("LIVE", H(1), [5, 6], 10), provenance: { ...snap("LIVE", H(1), [5, 6], 10).provenance, usesFutureObservation: true } }, t: H(1) }), (e: RecorderError) => e.code === "SYNTHETIC_REFUSED");
  assert.equal((await openArchive(store, "live", "sim-test")).manifests.length, 0); assert.equal((await openArchive(store, "historical", "sim-test")).manifests.length, 0);
});

test("recorder health: a missed slot is reported, a beat covers a slot, and a non-durable store is never healthy", async () => {
  const store = new MemoryStore(); const every = 5 * 60_000;
  await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1), [10, 12], 5), t: H(1) });
  await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1, 5), [10, 12], 5), t: H(1, 5) });        // unchanged: a beat
  await recordFrame(store, "civicapi", { ...ctx, snapshot: snap("LIVE", H(1, 15), [20, 22], 9), t: H(1, 15) });      // 1:10 was missed
  const h = await recorderHealth(store, "live", "civicapi", { fromMs: Date.parse(H(1)), toMs: Date.parse(H(1, 20)), everyMs: every });
  assert.equal(h.expectedSlots, 4); assert.equal(h.coveredSlots, 3); assert.deepEqual(h.missingSlots, [H(1, 10)]); assert.equal(h.frames, 2); assert.equal(h.beats, 1);
  assert.equal(h.durable, false); assert.equal(h.healthy, false, "memory or a serverless disk is not a recording");
  const full = await recorderHealth(Object.assign(store, { durable: true }), "live", "civicapi", { fromMs: Date.parse(H(1)), toMs: Date.parse(H(1, 10)), everyMs: every });
  assert.equal(full.healthy, true);
});

test("the recorder route is off by default, needs the cron secret and a durable store, and the replay builder refuses public/", () => {
  const src = fs.readFileSync(path.join(root, "app/api/results/engine-capture/route.ts"), "utf8");
  assert.match(src, /if \(!engineRecorderEnabled\(\)\) return NextResponse\.json\(.*status: 404/); assert.match(src, /authorization"\) !== `Bearer \$\{secret\}`/); assert.match(src, /if \(!store\.durable\) return/);
  assert.match(fs.readFileSync(path.join(root, "scripts/engine/build_replay.ts"), "utf8"), /Refusing to write a replay archive under public\//);
  const vercel = JSON.parse(fs.readFileSync(path.join(root, "vercel.json"), "utf8"));
  assert.ok(!JSON.stringify(vercel).includes("engine-capture"), "no schedule is switched on by this update: that is the operator's step");
});

test("the engine's civicAPI reader asks for every federal, statewide, ballot and legislative race type, and rejects an unknown group", async () => {
  const { ALL_SETS, typesFor } = await import("../../app/lib/engine/civicFetch");
  const t = typesFor(ALL_SETS);
  for (const want of ["US Senate", "Governor", "House of Representatives", "Attorney General", "Proposition", "State House"]) assert.ok(t.includes(want), want);
  assert.throws(() => typesFor(["sen" as never]), /unknown race-type group "sen"/);
  assert.deepEqual(typesFor(["fed"]), ["US Senate", "Governor", "House of Representatives"]);
});
