// Live feed resilience: a failed or stale civicAPI read never blanks counted returns or passes as current.
// Run: node scripts/test-live-feed.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const { mergeReads, STALE_MS } = await import(path.join(root, "app/results/2026/liveFeed.ts"));

const T0 = Date.parse("2026-11-04T01:30:00Z");
const race = (id, pr, votes, winner = 0) => ({ id, type: "US Senate", province: "Georgia", district: null, name: `R${id}`, pr, c: [["A", "Democratic", votes, 50, winner, null], ["B", "Republican", votes, 50, 0, null]] });
const read = (races, at) => ({ races, at });

test("all types read: races merged, no warning, freshness is the proxy's read time", () => {
  const m = mergeReads({}, { "US Senate": read([race(1, 40, 100)], T0 - 20_000), Governor: read([race(2, 10, 50)], T0 - 5_000) }, T0);
  assert.deepEqual(m.races.map((r) => r.id), [1, 2]);
  assert.equal(m.oldest, T0 - 20_000);
  assert.equal(m.stale, false);
  assert.equal(m.warning, null);
});

test("one type fails after a good read: its races are kept, not dropped to no votes, and a warning names the read time", () => {
  const first = mergeReads({}, { "US Senate": read([race(1, 40, 100)], T0), Governor: read([race(2, 10, 50)], T0) }, T0);
  const m = mergeReads(first.good, { "US Senate": new Error("search 502"), Governor: read([race(2, 20, 90)], T0 + 60_000) }, T0 + 60_000);
  const byId = Object.fromEntries(m.races.map((r) => [r.id, r]));
  assert.equal(byId[1].pr, 40, "the failed type's last good count stays");
  assert.equal(byId[2].pr, 20, "the good type updates");
  assert.deepEqual(m.failed, ["US Senate"]);
  assert.equal(m.oldest, T0);
  assert.match(m.warning, /could not be refreshed.*last good read.*may be behind/);
});

test("every type fails with no earlier read: nothing invented, forecast-only warning", () => {
  const m = mergeReads({}, { "US Senate": new Error("x"), Governor: new Error("y") }, T0);
  assert.deepEqual(m.races, []);
  assert.equal(m.oldest, null);
  assert.match(m.warning, /not reachable.*showing the forecast/);
});

test("every type fails after good reads: last counts kept (no blanking) and flagged", () => {
  const first = mergeReads({}, { "US Senate": read([race(1, 40, 100, 1)], T0) }, T0);
  const m = mergeReads(first.good, { "US Senate": new Error("down") }, T0 + 60_000);
  assert.equal(m.races.length, 1);
  assert.equal(m.races[0].c[0][4], 1, "a provider call already reported is not lost");
  assert.ok(m.warning);
});

test("a type that never loaded while others did: says those races show only the forecast", () => {
  const m = mergeReads({}, { "US Senate": read([race(1, 40, 100)], T0), Governor: new Error("x") }, T0);
  assert.deepEqual(m.missing, ["Governor"]);
  assert.match(m.warning, /could not be loaded.*only the forecast/);
});

test("stale proxy data (reads succeed but the proxy's read time is old) is flagged, fresh data is not", () => {
  const fresh = mergeReads({}, { "US Senate": read([race(1, 40, 100)], T0 - STALE_MS + 1_000) }, T0);
  assert.equal(fresh.stale, false); assert.equal(fresh.warning, null);
  const old = mergeReads({}, { "US Senate": read([race(1, 40, 100)], T0 - STALE_MS - 1_000) }, T0);
  assert.equal(old.stale, true);
  assert.match(old.warning, /have not updated since .* ET/);
});

test("out-of-order and corrected reads: the newest successful read replaces the old one as given, never mixed", () => {
  const a = mergeReads({}, { "US Senate": read([race(1, 60, 500)], T0) }, T0);
  const b = mergeReads(a.good, { "US Senate": read([race(1, 55, 480)], T0 + 60_000) }, T0 + 60_000);
  assert.equal(b.races[0].pr, 55); assert.equal(b.races[0].c[0][2], 480, "a provider correction downward is shown, not held at the higher count");
});

test("zero reporting reads are kept as zero, not filled", () => {
  const m = mergeReads({}, { "US Senate": read([race(1, 0, 0)], T0) }, T0);
  assert.equal(m.races[0].pr, 0); assert.equal(m.races[0].c[0][2], 0);
});

test("missing proxy timestamp falls back to the poll time", () => {
  const m = mergeReads({}, { "US Senate": read([race(1, 1, 1)], null) }, T0);
  assert.equal(m.oldest, T0);
});

test("useLive keeps the last good read per type and surfaces the warning; NightDesk shows it beside counted races", () => {
  const u = fs.readFileSync(path.join(root, "app/results/2026/useLive.ts"), "utf8");
  assert.match(u, /mergeReads\(good\.current, res, Date\.now\(\)\)/);
  assert.match(u, /error: m\.warning/);
  assert.doesNotMatch(u, /at: new Date\(\),/, "the read time is the proxy's, not the browser clock");
  const n = fs.readFileSync(path.join(root, "app/results/2026/NightDesk.tsx"), "utf8");
  assert.match(n, /\{live\.error \? <p className="nd-err"/);
});
