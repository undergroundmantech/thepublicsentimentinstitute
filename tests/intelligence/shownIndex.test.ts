// Patch 5: races with no data are left off the results pages once the night is over, and come back with their votes.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { CRace, XIndex, XRace } from "../../app/results/2026/live";
import { CIVIC_PINS, matchCivic } from "../../app/results/2026/live";
import { hasReturnsOrCall, shownIndex } from "../../app/results/2026/shownIndex";

const race = (id: string, k: XRace["k"], st = "TX"): XRace => ({ id, k, st, nm: id, off: "", civ: {} });
const cr = (votes: number[], winner = -1): CRace => ({ id: 1, type: "", province: "TX", district: null, name: "", pr: 0, c: votes.map((v, i) => [`C${i}`, "", v, 0, i === winner ? 1 : 0, null]) });
const ix: XIndex = { asOf: "", election: "", races: [race("sen-TX", "sen"), race("mayor-x", "other"), race("bm-x", "measure"), race("uncontested", "house"), race("chamber", "leg"), race("missing", "state")] };
const byId = { "sen-TX": cr([10, 5]), "mayor-x": cr([0, 0]), "bm-x": cr([0, 0]), uncontested: cr([0], 0), chamber: cr([0]) };
const ALL = ["fed", "state", "ballot", "leg"] as const;

test("live: only races with votes counted (or an On Point call) are shown; chambers stay; nothing is cut before the first read", () => {
  // while the first read is out: nothing yet (the page shows its loading state), or the recorded list where there is one
  assert.equal(shownIndex(ix, { loading: true, byId: {} }, [...ALL]), null);
  assert.equal(shownIndex(ix, { loading: true, byId: {} }, [...ALL], false, new Set()), null);
  assert.deepEqual(shownIndex(ix, { loading: true, byId: {} }, [...ALL], false, new Set(["sen-TX"]))!.races.map((r) => r.id), ["sen-TX", "chamber"]);
  assert.equal(shownIndex(null, { loading: false, byId }, [...ALL]), null);
  const s = shownIndex(ix, { loading: false, byId }, [...ALL])!;
  assert.deepEqual(s.races.map((r) => r.id), ["sen-TX", "uncontested", "chamber"]);
  // a race comes back the moment civicAPI has votes for it
  assert.ok(shownIndex(ix, { loading: false, byId: { ...byId, "mayor-x": cr([3, 0]) } }, [...ALL])!.races.some((r) => r.id === "mayor-x"));
  // only races of the type sets the page reads are judged
  assert.deepEqual(shownIndex(ix, { loading: false, byId }, ["fed"])!.races.map((r) => r.id), ["sen-TX", "mayor-x", "bm-x", "uncontested", "chamber", "missing"]);
  assert.equal(hasReturnsOrCall(undefined), false);
});

test("replay: a race the recording never counts is left off the whole time; the others are shown from the start", () => {
  const counted = new Set(["sen-TX", "bm-x", "uncontested"]);
  // at 7 p.m., before any votes: Texas Senate and the measure are shown, with no votes yet; the mayor never is
  const early = shownIndex(ix, { loading: false, byId: {} }, [...ALL], true, counted)!;
  assert.deepEqual(early.races.map((r) => r.id), ["sen-TX", "bm-x", "uncontested", "chamber"]);
  assert.equal(shownIndex(ix, { loading: false, byId: {} }, [...ALL], true, null), null, "until the list has loaded, the page waits");
  assert.equal(shownIndex(ix, { loading: false, byId: {} }, [...ALL], true, new Set()), ix, "a pack without the list shows every race");
});

test("the replay pack lists the races the recording counts, and only those", () => {
  const f = JSON.parse(fs.readFileSync("public/replay/2026/onpoint-calls.json", "utf8")) as { counted?: string[]; calls: Record<string, unknown> };
  assert.ok(Array.isArray(f.counted) && f.counted.length > 700);
  for (const id of Object.keys(f.calls)) assert.ok(f.counted!.includes(id), `${id} is called but not listed`);
  for (const id of ["mayor-ca-los-angeles-mayor", "court-mo-missouri-supreme-court-judge-paul-c-wilson", "agri-AL"]) assert.ok(!f.counted!.includes(id), id);
});

test("races matched on a shared surname alone are pinned to 'not found' until civicAPI has them", () => {
  for (const id of ["court-mo-missouri-supreme-court-judge-paul-c-wilson", "court-nm-new-mexico-supreme-court-justice-david-thomson", "board-dc-district-of-columbia-state-board-of-education-ward-1"]) assert.equal(CIVIC_PINS[id], 0, id);
  const thomson = { id: "court-nm-new-mexico-supreme-court-justice-david-thomson", k: "other", st: "NM", nm: "New Mexico Supreme Court Justice David Thomson", off: "Supreme Court", c: [["David Thomson", "O", 0]], civ: { names: ["Thomson"] } } as unknown as XRace;
  const house24: CRace = { id: 157329, type: "State House", province: "NM", district: "24", name: "New Mexico State House 24", pr: 100, c: [["Elizabeth L Thomson", "D", 8776, 100, 0, null]] };
  assert.equal(matchCivic([thomson], [house24])[thomson.id], undefined);
  const court = { id: "court-mo-missouri-supreme-court-judge-paul-c-wilson", k: "other", st: "MO", nm: "Missouri Supreme Court Judge Paul C. Wilson", off: "Supreme Court", c: [["Paul C. Wilson", "O", 0]], civ: { t: ["Supreme Court", "State Auditor"] } } as unknown as XRace;
  const auditor: CRace = { id: 87242, type: "State Auditor", province: "MO", district: null, name: "Missouri State Auditor", pr: 50, c: [["Quentin Wilson", "D", 10, 50, 0, null]] };
  assert.equal(matchCivic([court], [auditor])[court.id], undefined);
});

test("every results page that lists races reads them through the rule", () => {
  for (const f of ["app/results/2026/LiveProvider.tsx", "app/results/2026/RacesHub.tsx", "app/results/2026/[id]/StateLive.tsx", "app/results/monitor/Monitor.tsx"]) assert.match(fs.readFileSync(f, "utf8"), /useShownIndex\(/, f);
});
