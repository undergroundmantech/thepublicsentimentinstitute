// Operator decisions of November 11, 2026: independents with the Democratic caucus, the rule registry checked
// against current law (Louisiana's House primaries added), ranked choice simulated, Michigan's boards matched by name.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG } from "../../app/lib/engine/config";
import { nationalForecast, preElectionFrom } from "../../app/lib/engine/national";
import { forecastRace } from "../../app/lib/engine/raceModel";
import type { ElectionSnapshot, RaceObservation } from "../../app/lib/engine/types";
import { candidateId, raceRule } from "../../app/results/2026/candidates";
import { matchCivic, type CRace, type XIndex, type XRace } from "../../app/results/2026/live";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;
const O = { seed: "rules", computedAt: "x", snapshotId: "t", draws: 4000 };
type Row = [string, string, number];
const obs = (r: XRace, rows: Row[], pr: number): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: pr, units: null, sourceAsOf: null, receivedAt: "2026-11-04T12:00:00Z", test: false,
  candidates: rows.map(([n, p, v]) => ({ candidateId: candidateId(r.id, n), name: n, partyRaw: p, votes: v, providerWinner: false })) });
const snap = (races: Record<string, RaceObservation>): ElectionSnapshot => ({ snapshotId: "s", provenance: { mode: "LIVE", source: "", sourceAsOf: null, receivedAt: "", usesFutureObservation: false, synthetic: false }, races, unmatchedProviderRaces: 0 });

test("rule registry: the law in force on November 3, 2026", () => {
  for (const id of ["sen-AK", "house-AK-01", "gov-AK", "sen-ME", "house-ME-02"]) assert.equal(raceRule(race(id)), "ranked_choice", id);
  assert.equal(raceRule(race("gov-ME")), "plurality", "Maine's governor is elected by plurality");
  for (const id of ["sen-GA", "gov-GA", "house-GA-14"]) assert.equal(raceRule(race(id)), "majority_runoff", id);
  for (const r of ix.races.filter((x) => x.st === "LA" && x.k === "house")) assert.equal(raceRule(r), "majority_runoff", r.id);
  assert.equal(raceRule(race("sen-LA")), "plurality", "Louisiana's Senate race had closed primaries: November is a plurality general");
});

test("an independent Senate winner is counted with the Democratic caucus; set to null, with neither", () => {
  const r = race("sen-NE");
  const won = snap({ [r.id]: obs(r, [["Dan Osborn", "IND", 520_000], ["Pete Ricketts", "R", 380_000]], 100) });
  const lost = snap({ [r.id]: obs(r, [["Dan Osborn", "IND", 380_000], ["Pete Ricketts", "R", 520_000]], 100) });
  const seats = (s: ElectionSnapshot, cfg = DEFAULT_CONFIG) => nationalForecast({ index: ix, snapshot: s, pre, seed: "c", computedAt: "x", draws: 600, cfg }).national.senate.seats;
  const a = seats(won), b = seats(lost);
  assert.ok(a.D.mean - b.D.mean > 0.9, `an Osborn win adds a seat to the Democratic caucus: ${a.D.mean} v ${b.D.mean}`);
  const none = seats(won, { ...DEFAULT_CONFIG, senate: { ...DEFAULT_CONFIG.senate, independentsCaucus: null } });
  assert.ok(a.D.mean - none.D.mean > 0.9, "with no assumption the seat is counted for neither party");
});

test("ranked choice: before any vote the engine reproduces the published chance, and the projected margin is the final round's", () => {
  for (const id of ["sen-AK", "gov-AK", "house-AK-01", "sen-ME", "house-ME-02"]) {
    const r = race(id), f = forecastRace(r, null, null, O);
    assert.ok(Math.abs(f.principalMargin!.probB - (r.pR as number)) < 0.035, `${id}: ${f.principalMargin!.probB} v ${r.pR}`);
    assert.ok(Math.abs(f.principalMargin!.projected.mean - (r.m as number)) < 1.2, `${id}: margin ${f.principalMargin!.projected.mean} v ${r.m}`);
  }
});

test("ranked choice: a first-choice lead with every vote counted is not a certain win when other ballots can decide it", () => {
  const r = race("sen-AK");
  // every ballot counted: the Republican leads first choices by 1.0 point; 5.4% of ballots are other candidates'
  const o = obs(r, [["Mary Peltola", "D", 141_000], ["Dan S. Sullivan", "R", 144_000], ["Dan J. Sullivan", "R", 10_800], ["Gerald Heikes", "R", 4_900]], 100);
  const f = forecastRace(r, o, null, O);
  const pB = f.principalMargin!.probB;
  assert.ok(pB > 0.03 && pB < 0.97, `the transfer decides it, so neither side is certain: ${pB}`);
  assert.ok(f.flags.includes("RULE_RANKED_CHOICE"), "and it can never be model-called");
  // a first-choice majority wins whatever the transfers do
  const m = forecastRace(r, obs(r, [["Mary Peltola", "D", 160_000], ["Dan S. Sullivan", "R", 125_000], ["Dan J. Sullivan", "R", 10_000], ["Gerald Heikes", "R", 5_000]], 100), null, O);
  assert.ok(m.principalMargin!.probB < 0.01, `a first-choice majority: ${m.principalMargin!.probB}`);
});

test("a runoff seat is projected for the side ahead in the first round, and is never a decided seat", () => {
  const before = nationalForecast({ index: ix, snapshot: snap({}), pre, seed: "r", computedAt: "x", draws: 600 }).national.house;
  const off = nationalForecast({ index: ix, snapshot: snap({}), pre, seed: "r", computedAt: "x", draws: 600, cfg: { ...DEFAULT_CONFIG, national: { ...DEFAULT_CONFIG.national, runoffToFirstRoundSide: false } } }).national.house;
  assert.ok(before.seats.D.mean + before.seats.R.mean > 434.5, `every House seat is projected for a party: ${before.seats.D.mean + before.seats.R.mean}`);
  assert.ok(before.seats.D.mean + before.seats.R.mean >= off.seats.D.mean + off.seats.R.mean);
});

test("Michigan's four education boards are not all matched to the one provider race", () => {
  const civ: CRace[] = [{ id: 9, type: "State Board of Education", province: "MI", district: null, name: "State Board of Education", pr: 50,
    c: [["Judith Pritchett", "D", 10, 0, 0, null], ["Tiffany Tilley", "D", 9, 0, 0, null], ["Terence Collins", "R", 8, 0, 0, null], ["Bree Moeggenberg", "R", 7, 0, 0, null]] }];
  const m = matchCivic(ix.races, civ), boards = ix.races.filter((x) => x.id.startsWith("edb-MI")).map((x) => x.id);
  assert.equal(boards.length, 4);
  assert.deepEqual(boards.filter((id) => m[id]), ["edb-MI-state-board-of-education"]);
});
