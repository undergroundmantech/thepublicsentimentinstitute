// The Calls Desk table: statuses come from On Point's call and the count alone, and the desk never makes a call.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import type { CRace, XRace } from "../../app/results/2026/live";
import { CLOSE_DONE_PCT, CLOSE_MARGIN, CLOSE_MIN_PCT, officeOf, trackCounts, trackPasses, trackRow, trackSort, trackStatus, type ModelRead } from "../../app/results/2026/calls/tracker";

const race = (id: string, k: XRace["k"], st: string, nm: string): XRace => ({ id, k, st, nm, off: "", civ: {} });
const count = (pr: number, c: [string, string, number, number?][]): CRace => { const t = c.reduce((s, x) => s + x[2], 0) || 1; return { id: 1, type: "", province: "", district: null, name: "", pr, c: c.map((x) => [x[0], x[1], x[2], (100 * x[2]) / t, x[3] ?? 0, null]) }; };

test("calls desk: a status is the call, or a plain reading of the count", () => {
  assert.equal(trackStatus({ called: true, votes: 0, pct: null, margin: null }), "called");
  assert.equal(trackStatus({ called: false, votes: 0, pct: 0, margin: null }), "waiting");
  assert.equal(trackStatus({ called: false, votes: 100, pct: 10, margin: 0.5 }), "early", "a tight margin on a thin count is too early, not too close");
  assert.equal(trackStatus({ called: false, votes: 100, pct: CLOSE_MIN_PCT, margin: CLOSE_MARGIN - 0.1 }), "close");
  assert.equal(trackStatus({ called: false, votes: 100, pct: 60, margin: CLOSE_MARGIN }), "early");
  assert.equal(trackStatus({ called: false, votes: 100, pct: CLOSE_DONE_PCT, margin: 30 }), "close", "counted and still not callable");
  assert.equal(trackStatus({ called: false, votes: 100, pct: null, margin: 1 }), "early");
});

test("calls desk: a row carries the winner only on On Point's flag, and the count as it stands", () => {
  const r = race("sen-GA", "sen", "GA", "Georgia Senate");
  const open = trackRow(r, count(50, [["A One", "D", 600], ["B Two", "R", 400]]), "2026-11-04T01:00:00Z", null);
  assert.equal(open.status, "early"); assert.equal(open.winner, null); assert.equal(open.calledAt, null, "no call, no call time");
  assert.equal(open.leader?.name, "A One"); assert.equal(open.second?.name, "B Two"); assert.equal(open.margin, 20); assert.equal(open.leadShare, 60); assert.equal(open.votes, 1000); assert.equal(open.pct, 50);
  const called = trackRow(r, count(50, [["A One", "D", 600, 1], ["B Two", "R", 400]]), "2026-11-04T01:00:00Z", null);
  assert.equal(called.status, "called"); assert.equal(called.winner?.name, "A One"); assert.equal(called.calledAt, "2026-11-04T01:00:00Z");
  // the called winner need not be the current leader
  const behind = trackRow(r, count(50, [["A One", "D", 400, 1], ["B Two", "R", 600]]), null, null);
  assert.equal(behind.winner?.name, "A One"); assert.equal(behind.leader?.name, "B Two");
  const none = trackRow(r, undefined, null, null);
  assert.equal(none.status, "waiting"); assert.equal(none.leader, null); assert.equal(none.margin, null); assert.equal(none.pct, null);
  const zero = trackRow(r, count(0, [["A One", "D", 0], ["B Two", "R", 0]]), null, null);
  assert.equal(zero.status, "waiting"); assert.equal(zero.leader, null);
  const alone = trackRow(r, count(100, [["A One", "D", 500]]), null, null);
  assert.equal(alone.margin, 100); assert.equal(alone.second, null);
});

test("calls desk: filters by office, status, state and search; counts; sorting keeps empty values last", () => {
  const m = (prob: number): ModelRead => ({ prob, probOf: null, proj: null, pre: false });
  const rows = [
    trackRow(race("sen-GA", "sen", "GA", "Georgia Senate"), count(80, [["Jon Ossoff", "D", 600, 1], ["Mike Collins", "R", 400]]), "2026-11-04T01:14:00Z", m(0.99)),
    trackRow(race("house-TX-2", "house", "TX", "Texas 2"), count(82, [["Steve Toth", "R", 501], ["Shaun Finnie", "D", 499]]), null, m(0.69)),
    trackRow(race("house-TX-11", "house", "TX", "Texas 11"), count(20, [["August Pfluger", "R", 70], ["Claire Reynolds", "D", 30]]), null, m(0.97)),
    trackRow(race("gov-AK", "gov", "AK", "Alaska Governor"), undefined, null, null),
    trackRow(race("court-OH", "other", "OH", "Ohio supreme court"), count(96, [["X Y", "", 60], ["Z W", "", 40]]), null, null),
  ];
  assert.deepEqual(trackCounts(rows), { all: 5, called: 1, close: 2, early: 1, waiting: 1 });
  const f = { office: "all" as const, status: "all" as const, st: "all", q: "" };
  assert.deepEqual(rows.filter((x) => trackPasses(x, { ...f, office: "house" })).map((x) => x.r.id), ["house-TX-2", "house-TX-11"]);
  assert.deepEqual(rows.filter((x) => trackPasses(x, { ...f, status: "close" })).map((x) => x.r.id), ["house-TX-2", "court-OH"]);
  assert.deepEqual(rows.filter((x) => trackPasses(x, { ...f, st: "TX", status: "early" })).map((x) => x.r.id), ["house-TX-11"]);
  assert.deepEqual(rows.filter((x) => trackPasses(x, { ...f, q: " finnie " })).map((x) => x.r.id), ["house-TX-2"]);
  assert.equal(officeOf("leg"), "other"); assert.equal(officeOf("sen"), "sen");
  // office order, then name with numbers in order (Texas 2 before Texas 11)
  assert.deepEqual(trackSort(rows, "race", 1).map((x) => x.r.id), ["sen-GA", "gov-AK", "house-TX-2", "house-TX-11", "court-OH"]);
  assert.deepEqual(trackSort(rows, "margin", 1).map((x) => x.r.id), ["house-TX-2", "sen-GA", "court-OH", "house-TX-11", "gov-AK"]);
  assert.equal(trackSort(rows, "margin", -1).at(-1)!.r.id, "gov-AK", "no count sorts last both ways");
  assert.deepEqual(trackSort(rows, "prob", -1).slice(0, 3).map((x) => x.r.id), ["sen-GA", "house-TX-11", "house-TX-2"]);
  assert.equal(trackSort(rows, "called", -1)[0].r.id, "sen-GA");
  assert.equal(trackSort(rows, "status", 1)[0].status, "called");
});

test("calls desk: the page is the table, linked from the site, and reads only On Point's calls", () => {
  const page = fs.readFileSync("app/results/2026/calls/page.tsx", "utf8");
  assert.match(page, /CallsTracker/); assert.doesNotMatch(page, /robots/, "the desk is a page of the site now");
  const desk = fs.readFileSync("app/results/2026/calls/CallsTracker.tsx", "utf8");
  assert.match(desk, /callsFromLedger/); assert.match(desk, /useRecordedCalls/);
  assert.doesNotMatch(desk, /providerCall|row\.call\b|OFFICIAL_|\.official\b/, "civicAPI's own calls are never read here");
  assert.match(desk, /href="\/results\/2026"/); assert.match(desk, /href="\/results\/monitor"/);
  assert.match(desk, /unofficial until results are certified/i); assert.match(desk, /uncalibrated/);
  assert.match(fs.readFileSync("app/components/navMenu.ts", "utf8"), /\/results\/2026\/calls/);
  assert.match(fs.readFileSync("app/results/monitor/Monitor.tsx", "utf8"), /\/results\/2026\/calls/);
  assert.match(fs.readFileSync("app/results/2026/NationalDesk.tsx", "utf8"), /\/results\/2026\/calls/);
});
