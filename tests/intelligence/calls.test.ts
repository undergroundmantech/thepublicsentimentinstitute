import test from "node:test";
import assert from "node:assert/strict";
import { callRow, passes, partyOf, sortRows, isStale } from "../../app/results/2026/calls/calls";

const race = (id: string, k = "sen", st = "FL") => ({ id, k, st, nm: id, off: "", civ: {} }) as never;
const civ = (pr: number, c: [string, string, number, number, number, number | null][]) => ({ id: 1, type: "x", province: "FL", district: null, name: "x", pr, c }) as never;

test("an official call needs civicAPI's winner flag", () => {
  const row = callRow(race("a"), civ(99, [["A", "Democratic", 60, 60, 1, null], ["B", "Republican", 40, 40, 0, null]]), null);
  assert.equal(row.state, "official"); assert.equal(row.winner?.name, "A"); assert.equal(row.source, "civicAPI");
});
test("a projection is labelled as ours and never official", () => {
  const row = callRow(race("a"), civ(80, [["A", "Democratic", 60, 60, 0, null], ["B", "Republican", 40, 40, 0, null]]), { name: "A", party: "D", side: "A" });
  assert.equal(row.state, "projected"); assert.match(row.source, /not an official call/);
});
test("civicAPI winner beats a projection for the same race", () => {
  const row = callRow(race("a"), civ(99, [["B", "Republican", 60, 60, 1, null]]), { name: "A", party: "D", side: "A" });
  assert.equal(row.state, "official"); assert.equal(row.winner?.name, "B");
});
test("no votes and no match is uncalled with blank reporting", () => {
  const none = callRow(race("a"), undefined, null); assert.equal(none.state, "uncalled"); assert.equal(none.reporting, null);
  const pre = callRow(race("a"), civ(0, [["A", "D", 0, 0, 0, null]]), null); assert.equal(pre.state, "uncalled"); assert.equal(pre.reporting, null);
});
test("filters and party buckets", () => {
  const row = callRow(race("a", "gov", "OH"), civ(99, [["A", "Democratic", 60, 60, 1, null]]), null);
  assert.equal(partyOf("Republican"), "R"); assert.equal(partyOf("Independent"), "O"); assert.equal(partyOf("Yes"), null);
  assert.ok(passes(row, { chamber: "gov", st: "OH", party: "D", state: "official" }));
  assert.ok(!passes(row, { chamber: "sen", st: "all", party: "all", state: "all" }));
  assert.ok(!passes(row, { chamber: "all", st: "all", party: "R", state: "all" }));
  const un = callRow(race("b"), undefined, null); assert.ok(!passes(un, { chamber: "all", st: "all", party: "D", state: "all" }));
});
test("sorting puts calls first, then most reported", () => {
  const a = callRow(race("a"), civ(10, [["A", "D", 1, 1, 0, null]]), null), b = callRow(race("b"), civ(90, [["A", "D", 1, 1, 0, null]]), null), c = callRow(race("c"), civ(99, [["A", "D", 1, 1, 1, null]]), null);
  assert.deepEqual(sortRows([a, b, c]).map((x) => x.r.id), ["c", "b", "a"]);
});
test("staleness", () => {
  const now = Date.now();
  assert.ok(isStale(true, new Date(now), now)); assert.ok(isStale(false, new Date(now - 6 * 60_000), now)); assert.ok(!isStale(false, new Date(now - 60_000), now));
});
