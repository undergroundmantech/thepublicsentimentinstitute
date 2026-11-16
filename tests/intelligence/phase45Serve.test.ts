// Phases 4-5: what the pages receive (serve.ts, useLive's engine mapping), the replay firewall at the HTTP layer,
// and the evaluation harness's refusals. "A" numbers are the addendum's section 6 checks.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { FsStore } from "../../app/lib/intelligence/captureStore";
import { withConfig } from "../../app/lib/engine/config";
import { evaluateArchive, forecastFromRow, half, outcomesFromFinalState, type Frame } from "../../app/lib/engine/evaluate";
import { probe, DEFAULT_CALL_CONFIG } from "../../app/lib/engine/modelCalls";
import { preElectionFrom } from "../../app/lib/engine/national";
import { describeSource, openArchive, readState, recordFrame, snapshotOf } from "../../app/lib/engine/recorder";
import { history, sources, stateView } from "../../app/lib/engine/serve";
import type { ElectionSnapshot, RaceObservation } from "../../app/lib/engine/types";
import { candidateId } from "../../app/results/2026/candidates";
import type { XIndex } from "../../app/results/2026/live";
import { liveFromView } from "../../app/results/2026/useLive";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const cfg = withConfig({ draws: 200 });
const H = (h: number, m = 0) => `2026-11-04T0${h}:${String(m).padStart(2, "0")}:00.000Z`;
const snap = (mode: "HISTORICAL" | "SIMULATED", votes: [number, number], pr: number, called = false): ElectionSnapshot => {
  const r = ix.races.find((x) => x.id === "sen-NE")!;
  const o: RaceObservation = { raceId: r.id, providerRaceId: 77, providerPctReporting: pr, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [["Pete Ricketts", "Republican", votes[0]], ["Dan Osborn", "Independent", votes[1]]].map(([n, p, v], i) => ({ candidateId: candidateId(r.id, n as string), name: n as string, partyRaw: p as string, votes: v as number, providerWinner: called && i === 0 })) };
  return { snapshotId: `${mode}-${votes.join("-")}-${called}`, provenance: { mode, source: "test", sourceAsOf: null, receivedAt: "", usesFutureObservation: mode === "SIMULATED", synthetic: mode === "SIMULATED" }, races: { [r.id]: o }, unmatchedProviderRaces: 0 };
};

async function fixtureStore() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "eng-")); const store = new FsStore(dir, { durable: true });
  const ctx = { index: ix, pre, cfg };
  await describeSource(store, "historical", "night", { label: "test night", election: "2026-11-03", notes: [] });
  await recordFrame(store, "night", { ...ctx, snapshot: snap("HISTORICAL", [100_000, 120_000], 30), t: H(1) });
  await recordFrame(store, "night", { ...ctx, snapshot: snap("HISTORICAL", [380_000, 330_000], 98, true), t: H(3) });
  await recordFrame(store, "sim", { ...ctx, snapshot: snap("SIMULATED", [5, 6], 2), t: H(1) });
  return { dir, store, env: { INTELLIGENCE_CAPTURE_STORE: "fs", INTELLIGENCE_CAPTURE_DIR: dir } as Record<string, string> };
}

test("[A5][A10] served states: nothing after the requested time, and modes gated on the server", async () => {
  const { env } = await fixtureStore();
  const on = { ...env, ONPOINT_REPLAY: "on" };
  assert.equal((await stateView("historical/night", H(2), env)).ok, false, "replay is off unless switched on");
  const early = await stateView("historical/night", H(2), on); assert.ok(early.ok);
  if (early.ok) { assert.equal(early.view.t, H(1)); assert.equal(early.view.races["sen-NE"].counted, 220_000); assert.ok(early.view.ledger.events.every((e) => e.at <= H(1))); assert.deepEqual(early.info.times, [H(1), H(3)]); }
  const before = await stateView("historical/night", H(0, 30), on); assert.equal(before.ok, false);
  const h = await history("historical/night", H(2), null, on); assert.ok(h.ok && h.points.length === 1, "chart history is cut on the server");
  const rh = await history("historical/night", H(4), "sen-NE", on); assert.ok(rh.ok && rh.points.length === 2);
  // simulated: refused unless the operator allows it AND the deployment is not production
  const s1 = await stateView("simulated/sim", null, on); assert.ok(!s1.ok && s1.status === 403);
  const s2 = await stateView("simulated/sim", null, { ...on, ONPOINT_ALLOW_SIMULATED: "on", VERCEL_ENV: "production" }); assert.ok(!s2.ok && s2.status === 403);
  const s3 = await stateView("simulated/sim", null, { ...on, ONPOINT_ALLOW_SIMULATED: "on" }); assert.ok(s3.ok && s3.view.mode === "SIMULATED");
  const list = await sources(on); assert.deepEqual(list.sources.map((s) => s.id), ["historical/night"], "the picker does not list what may not be served");
  assert.equal((await stateView("../../etc/passwd", null, on)).ok, false);
});

test("[A1][A10] the pages' LiveState is the engine's snapshot: On Point's calls as winners (never the provider's), unobserved races absent, nothing modeled in the counts", async () => {
  const { env } = await fixtureStore(); const r = await stateView("historical/night", null, { ...env, ONPOINT_REPLAY: "on" }); assert.ok(r.ok); if (!r.ok) return;
  const s = liveFromView(ix, r.view, {}, Date.parse(r.view.t));
  assert.deepEqual(Object.keys(s.byId), ["sen-NE"], "races with no observation are absent, as with no provider match");
  const ne = s.byId["sen-NE"]; assert.equal(ne.id, 77); assert.equal(ne.pr, 98); assert.equal(s.at?.toISOString(), H(3));
  // the fixture's provider has called it for Ricketts; the engine's ledger has made no call of its own
  assert.ok(r.view.ledger.races["sen-NE"]?.official && !r.view.ledger.races["sen-NE"]?.modelCall, "the fixture: a provider call on the ledger, no On Point call");
  assert.deepEqual(ne.c.map((c) => [c[0], c[2], c[4]]), [["Pete Ricketts", 380_000, 0], ["Dan Osborn", 330_000, 0]], "reported votes, never projected votes; the provider's call is not a winner flag");
  // with an On Point call on the ledger, that candidate is the winner
  const called = { ...r.view, ledger: { ...r.view.ledger, races: { ...r.view.ledger.races, "sen-NE": { ...r.view.ledger.races["sen-NE"], modelCall: { candidateId: r.view.races["sen-NE"].c.find((c) => c[1] === "Dan Osborn")![0], name: "Dan Osborn", partyRaw: "Independent", calledAt: r.view.t, snapshotId: "x", probability: 0.999, threshold: 0.993 } } } } };
  assert.deepEqual(liveFromView(ix, called, {}, Date.parse(r.view.t)).byId["sen-NE"].c.map((c) => [c[0], c[4]]), [["Pete Ricketts", 0], ["Dan Osborn", 1]], "On Point's call, whoever the provider flagged");
  // the recorded calls file fills in for a LIVE view only, never in a replay
  const rec = { "sen-NE": { name: "Pete Ricketts", party: "Republican", at: null, lane: "standard" as const } };
  assert.equal(liveFromView(ix, r.view, {}, Date.parse(r.view.t), rec).byId["sen-NE"].c[0][4], 0, "a replay never reads the recorded calls: it must not know its own future");
  assert.equal(liveFromView(ix, { ...r.view, live: true }, {}, Date.parse(r.view.t), rec).byId["sen-NE"].c[0][4], 1, "a live view with no ledger call takes the recorded call");
  assert.equal(s.stale, false, "a replay is never 'stale'");
  // the dashboard's numbers move when the data moves
  const e = await stateView("historical/night", H(2), { ...env, ONPOINT_REPLAY: "on" }); assert.ok(e.ok);
  if (e.ok) assert.notEqual(e.view.national.senate.pD, r.view.national.senate.pD);
});

test("[A2] the House popular vote is House races only, and its projection moves with House returns", async () => {
  const { env } = await fixtureStore(); const a = await stateView("historical/night", H(1), { ...env, ONPOINT_REPLAY: "on" });
  assert.ok(a.ok); if (!a.ok) return;
  assert.equal(a.view.national.houseVote.observed.total, 0, "a Senate race adds nothing to the House vote");
  assert.ok(a.view.national.houseVote.projected.outstanding.mean > 1e7);
});

test("Phase 5: the harness refuses simulated sources and uncertified outcomes; a pipeline test is labelled as such", async () => {
  const { store } = await fixtureStore();
  const load = async (ns: "historical" | "simulated", id: string): Promise<Frame[]> => { const a = await openArchive(store, ns, id); const out: Frame[] = []; for (const m of a.manifests) out.push({ state: await readState(store, m), snapshot: await snapshotOf(store, m) }); return out; };
  const hist = await load("historical", "night"), sim = await load("simulated", "sim");
  assert.throws(() => evaluateArchive(sim, {}, { sourceLabel: "sim", blockers: ["the source is SIMULATED"], pipelineTest: false }), /cannot be used to score the model/);
  const stand = outcomesFromFinalState(hist[hist.length - 1].state, 95);
  assert.deepEqual(Object.keys(stand), ["sen-NE"]); assert.equal(stand["sen-NE"].certified, false);
  assert.throws(() => evaluateArchive(hist, stand, { sourceLabel: "h", blockers: [], pipelineTest: false }), /certified outcomes/);
  const rep = evaluateArchive(hist, stand, { sourceLabel: "h", blockers: [], pipelineTest: true });
  assert.equal(rep.kind, "PIPELINE TEST - NOT CALIBRATION"); assert.equal(rep.gate.applicable, false);
  const ok = evaluateArchive(hist, { "sen-NE": { ...stand["sen-NE"], certified: true } }, { sourceLabel: "h", blockers: [], pipelineTest: false });
  assert.equal(ok.kind, "CALIBRATION"); assert.equal(ok.gate.applicable, true);
  assert.deepEqual(ok.sweep.map((s) => s.threshold), [0.99, 0.993, 0.995, 0.999]);
  assert.equal(half("sen-NE"), half("sen-NE")); assert.ok(["A", "B"].includes(half("house-PA-07")));
  // the stored row carries what the call rule needs: probing it again gives the recorded safeguards
  const row = hist[1].state.races["sen-NE"]; const p = probe(forecastFromRow(row, 200), DEFAULT_CALL_CONFIG, false);
  assert.equal(p.leader?.name, "Pete Ricketts"); assert.equal(p.p, row.c.find((c) => c[0] === p.leader?.candidateId)?.[6]);
});

test("[A3][A11] the Situation Monitor is served again (not redirected), opens LIVE, and its desk closes on Back and Escape", () => {
  const red = fs.readFileSync(path.join(root, "next.redirects.ts"), "utf8");
  assert.doesNotMatch(red, /p\("\/results\/monitor"/);
  const ec = fs.readFileSync(path.join(root, "app/results/2026/engineClient.ts"), "utf8");
  assert.match(ec, /const INIT: EngineState = \{ mode: "LIVE"/, "LIVE unless a replay was chosen in this tab or by link");
  const mon = fs.readFileSync(path.join(root, "app/results/monitor/Monitor.tsx"), "utf8");
  assert.match(mon, /window\.addEventListener\("popstate", onPop\)/); assert.match(mon, /if \(desk\) closeDesk\(\)/); assert.match(mon, /deskRef\.current\?\.focus\(\)/);
});
