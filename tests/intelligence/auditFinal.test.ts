// The final audit's findings, as tests. Each one failed before its fix.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../app/lib/engine/config";
import { nationalForecast, preElectionFrom } from "../../app/lib/engine/national";
import { rowOf } from "../../app/lib/engine/pipeline";
import { forecastRace, prepareRace } from "../../app/lib/engine/raceModel";
import type { ElectionSnapshot } from "../../app/lib/engine/types";
import { engineOdds } from "../../app/results/2026/engineRow";
import { PROB_CEIL, type XIndex, type XRace } from "../../app/results/2026/live";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const model = JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8"));
const pre = preElectionFrom(model);
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;
const empty = (mode: "LIVE" | "SIMULATED" = "LIVE"): ElectionSnapshot => ({ snapshotId: "pre", provenance: { mode, source: "", sourceAsOf: null, receivedAt: "", usesFutureObservation: false, synthetic: mode === "SIMULATED" }, races: {}, unmatchedProviderRaces: 0 });
const O = { seed: "audit", computedAt: "x", snapshotId: "pre", draws: 3000 };

test("before any vote, EVERY race with a forecast starts at the published forecast's chance (it was 4 races checked, and 14 were off)", () => {
  const off: string[] = []; let n = 0;
  for (const r of ix.races) {
    const p0 = r.k === "measure" ? (r.pPass != null ? 1 - r.pPass : null) : r.pR ?? null; if (p0 == null || r.k === "leg") continue;
    const f = forecastRace(r, null, null, O); if (!f.principalMargin) continue; n++;
    if (Math.abs(f.principalMargin.probB - p0) > 0.05) off.push(`${r.id}: published ${p0}, engine ${f.principalMargin.probB.toFixed(3)}`);
  }
  assert.ok(n > 700, `${n} races`); assert.deepEqual(off, []);
});

test("ranked-choice and measures start from the published margin, not from the index's listed votes", () => {
  for (const id of ["sen-AK", "gov-AK"]) { const r = race(id), f = forecastRace(r, null, null, O); assert.ok(Math.abs(f.principalMargin!.probB - (r.pR as number)) < 0.04, `${id}: ${f.principalMargin!.probB} v ${r.pR}`); assert.ok(Math.abs(f.principalMargin!.projected.mean - (r.m as number)) < 0.6, `${id} margin`); }
});

test("a toss-up does not get a 1.5-point prior spread: an unstable margin/z ratio falls back to the kind's own median spread", () => {
  for (const id of ["ag-TX", "house-FL-09", "house-CO-03"]) { const p = prepareRace(race(id), null, null); assert.ok(p.sdF >= 5, `${id}: ${p.sdF}`); }
  assert.equal(prepareRace(race("house-FL-09"), null, null).sdF, DEFAULT_CONFIG.priorSd.byKind.house);
  // a well-determined race still reads its own spread from the forecast
  const ne = prepareRace(race("sen-NE"), null, null); assert.ok(Math.abs(ne.sdF - 8.7) < 0.5, `${ne.sdF}`);
});

test("before any vote the national picture is the published one: House and governors, chance and 80% range", () => {
  const n = nationalForecast({ index: ix, snapshot: empty(), pre, seed: "audit", computedAt: "x", draws: 4000 }).national;
  const c = model.chambers;
  assert.ok(Math.abs(n.house.pD - c.house.demControl) < 0.03, `House ${n.house.pD} v ${c.house.demControl}`);
  assert.ok(Math.abs(n.house.seats.D.i80.lo - c.house.demP10) <= 5 && Math.abs(n.house.seats.D.i80.hi - c.house.demP90) <= 5, `House range ${n.house.seats.D.i80.lo}-${n.house.seats.D.i80.hi} v ${c.house.demP10}-${c.house.demP90}`);
  assert.ok(Math.abs(n.governors.pD - c.governor.demControl) < 0.03, `governors ${n.governors.pD} v ${c.governor.demControl}`);
  assert.ok(Math.abs(n.governors.seats.D.mean - c.governor.demSeats) < 0.6);
  assert.ok(Math.abs(n.senate.pD + n.senate.pUnresolved - c.senate.demControl) < 0.05, "Senate, counting the outcomes independents would decide");
  // national vote totals keep an honest range: turnout surprises are partly national
  const o = n.houseVote.projected.outstanding; assert.ok((o.i80.hi - o.i80.lo) / o.mean > 0.15, `outstanding House votes 80% range is ${(100 * (o.i80.hi - o.i80.lo) / o.mean).toFixed(0)}% of the mean (it was 2%)`);
});

test("one error structure: the estimate and the draws use the same national and state spreads, and early finishers are discounted", () => {
  const N = DEFAULT_CONFIG.national;
  assert.deepEqual(Object.keys(N).sort(), ["loading", "orderNationalShare", "runoffToFirstRoundSide", "sdNational", "sdState", "selectionShare"], "no separate correlation setting for the draws");
  const n0 = nationalForecast({ index: ix, snapshot: empty(), pre, seed: "a", computedAt: "x", draws: 400 }).national;
  assert.equal(n0.nationalSwing.sd, N.sdNational);
  const none = nationalForecast({ index: ix, snapshot: empty(), pre, seed: "a", computedAt: "x", draws: 600, cfg: { ...DEFAULT_CONFIG, national: { ...N, sdNational: 0.01, sdState: 0 } } }).national;
  const w = (x: typeof n0) => x.house.seats.D.i80.hi - x.house.seats.D.i80.lo;
  assert.ok(w(n0) > 2 * w(none), "shared swings are what make the seat range wide");
});

test("a page never shows an uncalled race at 100%: the engine's odds are capped for display, and a called race is not", () => {
  const r = race("sen-NE");
  const mk = (called: boolean) => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: 99, units: null, sourceAsOf: null, receivedAt: "", test: false,
    candidates: [{ candidateId: "a", name: "Pete Ricketts", partyRaw: "Republican", votes: 600_000, providerWinner: called }, { candidateId: "b", name: "Dan Osborn", partyRaw: "Independent", votes: 100_000, providerWinner: false }] });
  const open = rowOf(forecastRace(r, mk(false), null, O), 99); assert.equal(open.pm!.probB, 1, "the raw draw fraction can be exactly 1");
  const o = engineOdds(open); assert.equal(o.pB, PROB_CEIL); assert.ok(o.pA > 0); assert.equal(o.capped, true);
  // since 2.5.0 the only call a page knows is On Point's own: the provider's winner flag lifts nothing
  assert.equal(engineOdds(rowOf(forecastRace(r, mk(true), null, O), 99)).pB, PROB_CEIL, "a provider call does not lift the cap");
  assert.equal(engineOdds(open, true).pB, 1, "an On Point call does");
  for (const f of ["app/results/2026/NightDesk.tsx", "app/results/monitor/RaceBrief.tsx"]) assert.match(fs.readFileSync(path.join(root, f), "utf8"), /fromEngine \? engineOdds\(eRow!, !!/);
});

test("in a simulated replay a race with no observation is MISSING, not 'simulated': pages treat it as not yet reporting", () => {
  const f = forecastRace(race("sen-NE"), null, null, { ...O, mode: "SIMULATED" }); assert.equal(f.dataState, "MISSING");
});
