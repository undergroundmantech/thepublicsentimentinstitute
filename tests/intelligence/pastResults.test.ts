// Past results by county (2018 to 2024): the arithmetic the pages do with the files, and the files themselves.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { contestKey, contestLabel, counties, defaultBaseline, marginOf, marginText, ordered, shareOf, shiftOf, shiftText, turnoutChange, type Contest, type StateHistory } from "../../app/results/history/pastResults";

const root = path.resolve(import.meta.dirname, "../..");
const dir = path.join(root, "public/results/history");
const load = (st: string) => JSON.parse(fs.readFileSync(path.join(dir, `${st}.json`), "utf8")) as StateHistory;
const C = (y: number, o: Contest["o"], tot: [number, number, number], more: Partial<Contest> = {}): Contest => ({ y, o, sp: false, a: ["Ann Able", "D"], b: ["Bo Baker", "R"], tot, same: false, c: {}, ...more });

test("a margin is side B minus side A in points of all votes, and reads as the pages' margins do", () => {
  assert.equal(marginOf([40, 60, 100]), 20); assert.equal(marginOf([55, 40, 100]), -15); assert.equal(marginOf([0, 0, 0]), null); assert.equal(marginOf(null), null);
  assert.equal(shareOf([55, 40, 100], 0), 55);
  assert.equal(marginText(20, C(2024, "P", [40, 60, 100])), "R+20.0"); assert.equal(marginText(-15, C(2024, "P", [55, 40, 100])), "D+15.0"); assert.equal(marginText(0.01), "Even"); assert.equal(marginText(null), "—");
  // an independent who was one of the two leading candidates stands on side A and is marked as one
  assert.equal(marginText(-8, C(2024, "S", [54, 46, 100], { a: ["Angus King", "O"] })), "I+8.0");
  // two candidates of one party: the leader's name, never a party
  assert.equal(marginText(-8.3, C(2018, "S", [54, 46, 100], { a: ["Dianne Feinstein", "D"], b: ["Kevin De Leon", "D"], same: true })), "Feinstein +8.3");
});

test("the shift is the later margin minus the earlier one: D+ toward the Democrat, R+ toward the Republican", () => {
  assert.equal(shiftOf([45, 55, 100], [52, 48, 100]), 14); assert.equal(shiftText(14), "R+14.0");
  assert.equal(shiftText(shiftOf([52, 46, 100], [45, 55, 100])), "D+16.0");
  assert.equal(shiftOf([45, 55, 100], null), null); assert.equal(shiftText(null), "—"); assert.equal(shiftText(0.02), "No shift");
  assert.equal(shiftOf([45, 55, 100], [52, 48, 100], { same: false }, { same: true }), null, "no party shift from a one-party contest");
  assert.equal(turnoutChange([0, 0, 90], [0, 0, 100]), -10); assert.equal(turnoutChange([0, 0, 90], [0, 0, 0]), null);
});

test("the default comparison is the election before it for the same office", () => {
  const h: StateHistory = { v: 1, st: "ZZ", source: "t", names: { "99001": "Alpha", "99003": "Beta", "99000": "Statewide" }, contests: [
    C(2024, "P", [45, 55, 100], { c: { "99001": [10, 20, 30], "99000": [1, 1, 2] } }), C(2022, "G", [50, 50, 100]), C(2020, "P", [52, 48, 100], { c: { "99003": [5, 5, 10] } }), C(2018, "S", [49, 51, 100], { same: true })] };
  assert.equal(contestKey(defaultBaseline(h, h.contests[0])!), "2020P"); assert.equal(contestKey(defaultBaseline(h, h.contests[1])!), "2020P", "no earlier governor's race: the nearest earlier two-party contest");
  assert.equal(defaultBaseline(h, h.contests[3]), null);
  assert.deepEqual(ordered(h).map(contestKey), ["2024P", "2022G", "2020P", "2018S"]); assert.equal(contestLabel(h.contests[1]), "2022 Governor");
  assert.deepEqual(counties(h).map((c) => c.name), ["Alpha", "Beta", "Statewide"], "counties by name, the statewide stand-in last");
});

test("the files: every state, sane counts, and the results that are a matter of record", () => {
  const ix = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as { states: Record<string, [number, string, number, number][]> };
  assert.equal(Object.keys(ix.states).length, 51, "fifty states and the District");
  let contests = 0;
  for (const st of Object.keys(ix.states)) {
    const h = load(st); assert.equal(h.st, st); assert.match(h.source, /MIT Election Data and Science Lab/);
    for (const c of h.contests) {
      contests++; assert.ok([2018, 2020, 2022, 2024].includes(c.y) && "PSG".includes(c.o), `${st} ${c.y}${c.o}`);
      assert.ok(c.a && c.b && c.tot[2] >= c.tot[0] + c.tot[1] && c.tot[2] > 0, `${st} ${c.y}${c.o}: two sides and a total that holds them`);
      let a = 0, b = 0, t = 0; for (const [f, x] of Object.entries(c.c)) { assert.ok(/^\d{5}$/.test(f), `${st}: a five-digit county code`); assert.ok(x[2] >= x[0] + x[1], `${st} ${c.y}${c.o} ${f}`); a += x[0]; b += x[1]; t += x[2]; }
      // (a contest kept statewide only has no counties at all and says so; every other one adds up to its statewide line)
      if (c.nocty) assert.equal(Object.keys(c.c).length, 0, `${st} ${c.y}${c.o}: statewide only`);
      else assert.deepEqual([a, b, t], c.tot, `${st} ${c.y}${c.o}: the counties add up to the statewide line`);
      for (const f of Object.keys(c.c)) assert.ok(h.names[f], `${st} ${f} has a name`);
    }
  }
  assert.ok(contests > 300);
  const find = (st: string, y: number, o: string) => load(st).contests.find((c) => c.y === y && c.o === o)!;
  // certified results (state election offices): the precinct sums match them, or come within a few hundred votes
  assert.deepEqual(find("GA", 2022, "G").tot.slice(0, 2), [1_813_673, 2_111_572]); assert.deepEqual(find("AZ", 2020, "P").tot.slice(0, 2), [1_672_143, 1_661_686]);
  assert.deepEqual(find("OH", 2020, "P").tot.slice(0, 2), [2_679_165, 3_154_834]); assert.deepEqual(find("WI", 2022, "S").tot.slice(0, 2), [1_310_467, 1_337_185]);
  assert.deepEqual(find("PA", 2024, "S").tot.slice(0, 2), [3_384_180, 3_399_295]);
  const fl = find("FL", 2020, "P"); assert.ok(Math.abs(fl.tot[0] - 5_297_045) < 100 && Math.abs(fl.tot[1] - 5_668_731) < 100); assert.equal(Object.keys(fl.c).length, 67);
  assert.equal(find("CA", 2018, "S").same, true, "two Democrats"); assert.equal(find("ME", 2024, "S").a![0].includes("King"), true);
  // what the source does not cover in full is left out or marked, never passed off as a result
  // (2024 President in Louisiana, Indiana and New Jersey: the precinct files are wrong, so only the statewide line, from the statewide file)
  for (const st of ["LA", "IN", "NJ"]) { const c = find(st, 2024, "P"); assert.equal(c.nocty, true, st); assert.equal(Object.keys(c.c).length, 0, st); }
  assert.deepEqual(find("LA", 2024, "P").tot, [766_870, 1_208_505, 2_006_975]); assert.ok(find("IN", 2022, "S").part);
  assert.equal(load("TX").contests.filter((c) => c.nocty).length, 0);
  // the head of the ticket, by full name: never a running mate or a bare surname
  assert.equal(find("SD", 2018, "G").b![0], "Kristi Noem"); assert.equal(find("TX", 2018, "S").a![0], "Beto O'Rourke"); assert.equal(find("FL", 2022, "G").b![0], "Ron DeSantis");
  for (const st of Object.keys(ix.states)) for (const c of load(st).contests) for (const x of [c.a, c.b]) assert.ok(x && /^\S+ \S+/.test(x[0]) && !/[\/&,"]| And /.test(x[0]), `${st} ${c.y}${c.o}: ${x?.[0]}`);
});

// ---- the map's past-election setting ----
import { contestFor, defaultMapKey, mapContests, nationalContests, shiftTint, turnoutShare, turnoutText, turnoutTint, twoPartySides, type StateContest, type StatesHistory } from "../../app/results/history/pastResults";

const line = (y: number, o: "P" | "S" | "G", tot: [number, number, number], extra: Partial<StateContest> = {}): StateContest => ({ y, o, sp: false, a: ["A One", "D"], b: ["B Two", "R"], tot, same: false, ...extra });

test("past map: turnout is votes now as a share of votes then, and tints by fewer or more", () => {
  assert.equal(turnoutShare([40, 50, 100], [100, 90, 200]), 50);
  assert.equal(turnoutShare(null, [1, 1, 2]), null);
  assert.equal(turnoutShare([1, 1, 2], [0, 0, 0]), null);
  assert.equal(turnoutText(81.4), "81%"); assert.equal(turnoutText(4.26), "4.3%"); assert.equal(turnoutText(null), "—");
  assert.match(turnoutTint(60)!, /^rgba\(231,121,74,/); assert.match(turnoutTint(130)!, /^rgba\(47,191,155,/);
  assert.equal(turnoutTint(null), null);
  // deeper the further from the same number of votes, and capped
  const alpha = (s: string) => Number(s.slice(s.lastIndexOf(",") + 1, -1));
  assert.ok(alpha(turnoutTint(60)!) > alpha(turnoutTint(90)!));
  assert.equal(alpha(turnoutTint(10)!), alpha(turnoutTint(50)!));
});

test("past map: a shift tints blue toward side A and red toward side B, full at 20 points", () => {
  const alpha = (s: string) => Number(s.slice(s.lastIndexOf(",") + 1, -1));
  assert.match(shiftTint(-4)!, /^rgba\(61,123,255,/); assert.match(shiftTint(4)!, /^rgba\(255,59,92,/);
  assert.equal(alpha(shiftTint(20)!), alpha(shiftTint(40)!));
  assert.ok(alpha(shiftTint(2)!) < alpha(shiftTint(8)!));
  assert.equal(shiftTint(null), null);
  assert.match(shiftTint(-3, ["1,2,3", "4,5,6"])!, /^rgba\(1,2,3,/);
});

test("past map: only whole, two-party contests are offered; a state's contest is found by key; the default is the same office last time", () => {
  const list = [line(2024, "P", [45, 50, 100]), line(2022, "S", [48, 49, 100]), line(2022, "G", [60, 30, 100], { same: true }), line(2020, "S", [40, 55, 100], { part: [3, 9] }), line(2018, "G", [50, 47, 100])];
  assert.deepEqual(mapContests(list).map((c) => `${c.y}${c.o}`), ["2024P", "2022S", "2018G"]);
  assert.equal(contestFor(list, "2022S")?.y, 2022);
  assert.equal(contestFor(list, "2022G"), null, "a same-party contest has no partisan colour");
  assert.equal(contestFor(list, "2020S"), null, "a contest that does not cover the state is not mapped");
  assert.equal(contestFor(list, null), null); assert.equal(contestFor(null, "2024P"), null);
  assert.equal(defaultMapKey(list, "sen"), "2022S");
  assert.equal(defaultMapKey(list, "gov"), "2018G");
  assert.equal(defaultMapKey(list, "state"), "2024P");
  assert.equal(defaultMapKey([], "sen"), null);
});

test("past map: the national list counts the states that held each election, newest first", () => {
  const h: StatesHistory = { v: 1, source: "t", states: { AA: [line(2024, "P", [1, 2, 4]), line(2022, "S", [2, 1, 4])], BB: [line(2024, "P", [2, 1, 4]), line(2022, "S", [1, 1, 3], { same: true })], CC: [line(2020, "P", [1, 1, 2])] } };
  assert.deepEqual(nationalContests(h), [{ key: "2024P", label: "2024 President", states: 2 }, { key: "2022S", label: "2022 U.S. Senate", states: 1 }, { key: "2020P", label: "2020 President", states: 1 }]);
});

test("past map: a shift is only drawn for a Democrat or aligned independent against a Republican", () => {
  assert.equal(twoPartySides(["D", "R"]), true); assert.equal(twoPartySides(["IND", "R"]), true);
  assert.equal(twoPartySides(["R", "D"]), false); assert.equal(twoPartySides(["D", "I"]), false);
  assert.equal(twoPartySides(["Y", "N"]), false); assert.equal(twoPartySides(["R"]), false); assert.equal(twoPartySides([]), false);
});

test("past map: states.json holds every state's statewide lines and agrees with the state files", () => {
  const all = JSON.parse(fs.readFileSync(path.join(dir, "states.json"), "utf8")) as StatesHistory;
  assert.equal(Object.keys(all.states).length, 51);
  for (const st of ["GA", "TX", "ME", "AK"]) {
    const one = load(st);
    assert.deepEqual(all.states[st], one.contests.map((x) => { const rest: Partial<Contest> = { ...x }; delete rest.c; return rest; }), st);
  }
  assert.equal(nationalContests(all).find((o) => o.key === "2024P")!.states, 51, "every state and the District has a 2024 presidential line");
  assert.equal(nationalContests(all).find((o) => o.key === "2020P")!.states, 50, "the source has no 2020 precinct returns for Indiana");
});
