// Phase 1: no model-made calls, no printed certainties, one set of clocks. Numbers in brackets are the acceptance
// tests of docs/05 in the overhaul package.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { AUTO_PROJECTION_RULE, modelSuggestionAllowed, modelSuggestionsEnabled } from "../../app/results/2026/calls/policy";
import { callRow, isStale, STALE_MS as CALLS_STALE } from "../../app/results/2026/calls/calls";
import { FLAGS } from "../../app/results/2026/flags";
import { PROB_CEIL, Phi, liveOdds, project, type CCand, type XIndex, type XRace } from "../../app/results/2026/live";
import { LIVE_POLL_MS, PROXY_CACHE_MS, STALE_MS, CADENCE_TEXT, mergeReads } from "../../app/results/2026/liveFeed";

const root = path.join(import.meta.dirname, "../..");
const src = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
const ix = JSON.parse(src("public/results/2026/index.json")) as XIndex;
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;
const cv = (rows: [string, string, number][]): CCand[] => rows.map(([n, p, v]) => [n, p, v, 0, 0, null]);

test("every flag is off by default", () => {
  assert.deepEqual(FLAGS, { legacySides: false, legacyOdds: false, autoProjection: false });
  assert.equal(modelSuggestionsEnabled(), false);
});

test("[18] the old 50% counted + 99.5% rule no longer makes an OnPoint Projection", () => {
  const sure = { hasForecast: true, providerCalled: false, countedVotes: 900_000, pctIn: 99, leadProbPct: 99.99 };
  assert.equal(modelSuggestionAllowed(sure), false, "off by default, however lopsided the estimate");
  assert.equal(modelSuggestionAllowed({ ...sure, pctIn: AUTO_PROJECTION_RULE.minPctIn, leadProbPct: AUTO_PROJECTION_RULE.minLeadProbPct }), false);
  // with the operator flag the old rule is reproduced exactly, and its guards hold
  assert.equal(modelSuggestionAllowed(sure, true), true);
  assert.equal(modelSuggestionAllowed({ ...sure, pctIn: 49.9 }, true), false);
  assert.equal(modelSuggestionAllowed({ ...sure, leadProbPct: 99.4 }, true), false);
  assert.equal(modelSuggestionAllowed({ ...sure, hasForecast: false }, true), false, "no forecast, no suggestion");
  assert.equal(modelSuggestionAllowed({ ...sure, providerCalled: true }, true), false, "the provider's call stands");
  assert.equal(modelSuggestionAllowed({ ...sure, countedVotes: 0 }, true), false);
  assert.equal(modelSuggestionAllowed({ ...sure, leadProbPct: NaN }, true), false);
});

test("[18] one policy, three pages: no page keeps its own copy of the threshold", () => {
  for (const f of ["app/results/2026/NightDesk.tsx", "app/results/monitor/RaceBrief.tsx", "app/results/2026/calls/CallsBoard.tsx"]) {
    const s = src(f);
    assert.match(s, /modelSuggestionAllowed\(/, `${f} asks the shared policy`);
    assert.doesNotMatch(s, /leadP\s*>=\s*99\.5/, `${f} has no inline 99.5 rule`);
    assert.doesNotMatch(s, /pctIn\s*>=\s*50\s*&&/, `${f} has no inline 50% rule`);
  }
  assert.match(src("app/results/2026/calls/CallsBoard.tsx"), /if \(!modelSuggestionsEnabled\(\)\) return;/, "the calls board does no projection reads while the flag is off");
});

test("a provider call is sourced to the provider; a model estimate is never attributed to it", () => {
  const r = race("sen-NE");
  const won = { id: 1, type: "US Senate", province: "NE", district: null, name: "x", pr: 99, c: [["Pete Ricketts", "Republican", 60, 60, 1, null], ["Dan Osborn", "Independent", 40, 40, 0, null]] as CCand[] };
  const row = callRow(r, won, null); assert.equal(row.state, "official"); assert.equal(row.source, "civicAPI"); assert.equal(row.winner?.name, "Pete Ricketts");
  const open = { ...won, c: won.c.map((x) => [x[0], x[1], x[2], x[3], 0, null] as CCand) };
  assert.equal(callRow(r, open, null).state, "uncalled", "a lead, however large, is not a call");
  assert.match(callRow(r, open, { name: "Pete Ricketts", party: "R", side: "B" }).source, /not an official call/);
  // the race desk passed calledBy="civicAPI" to the band for its own projection
  assert.match(src("app/results/2026/NightDesk.tsx"), /calledBy=\{civWinner \? "civicAPI" : undefined\}/);
});

test("[17] a lopsided, nearly finished count is still not printed as a certainty", () => {
  const r = race("sen-NE");
  const top = cv([["Pete Ricketts", "Republican", 700_000], ["Dan Osborn", "Independent", 60_000]]);
  const P = project(null, null, r, top, r.tot); const o = liveOdds(r, P);
  assert.ok(P.rep.t > 0 && P.m > 50);
  assert.equal(o.capped, true); assert.equal(o.pB, PROB_CEIL); assert.ok(o.pA > 0 && o.pA < 0.01); assert.ok(Math.abs(o.pA + o.pB - 1) < 1e-12);
  assert.ok(o.pB < 1, "never 100% for a race nobody has called");
  // and the mirror image
  const P2 = project(null, null, r, cv([["Pete Ricketts", "Republican", 60_000], ["Dan Osborn", "Independent", 700_000]]), r.tot); const o2 = liveOdds(r, P2);
  assert.equal(o2.pA, PROB_CEIL); assert.ok(o2.pB > 0);
  // a close race is untouched by the cap
  const P3 = project(null, null, r, cv([["Pete Ricketts", "Republican", 150_000], ["Dan Osborn", "Independent", 149_000]]), r.tot); const o3 = liveOdds(r, P3);
  assert.equal(o3.capped, false); assert.ok(o3.pB > 0.05 && o3.pB < 0.95);
});

test("before any vote the chance is the published forecast's own number, untouched", () => {
  const r = race("sen-NE"); const P = project(null, null, r, null, r.tot); const o = liveOdds(r, P);
  assert.equal(o.pB, r.pR); assert.equal(o.capped, false);
});

test("the normal curve no longer rounds its tails to exactly 0", () => {
  assert.equal(Phi(0), 0.5);
  for (const z of [0.5, 1.96, 4, 8]) assert.ok(Math.abs(Phi(z) + Phi(-z) - 1) < 1e-15);
  const ref: [number, number][] = [[-1.96, 0.024997895148220435], [-6, 9.865876450377012e-10], [-8.5, 9.479534822203355e-18], [-12, 1.776482112077702e-33]];   // Python math.erfc
  for (const [z, v] of ref) assert.ok(Math.abs(Phi(z) / v - 1) < 1e-8, `Phi(${z}) = ${Phi(z)}`);
  assert.ok(Phi(-9) > 0 && Phi(-20) > 0, "the old curve returned exactly 0 from about -8.4");
});

test("[9][32] one set of clocks: the stale limit covers a healthy poll plus a full cache window, everywhere", () => {
  assert.equal(CALLS_STALE, STALE_MS, "the calls board and the feed share one limit");
  assert.ok(STALE_MS > LIVE_POLL_MS + PROXY_CACHE_MS, "a healthy read can be one poll plus one cache window old");
  assert.match(CADENCE_TEXT, /every 5 minutes through a 5 minute cache/);
  const now = Date.parse("2026-11-04T02:00:00Z");
  assert.equal(isStale(false, new Date(now - LIVE_POLL_MS - PROXY_CACHE_MS), now), false);
  assert.equal(isStale(false, new Date(now - STALE_MS - 1), now), true);
  for (const f of ["app/api/civic/search/route.ts", "app/api/civic/race/[id]/route.ts"]) assert.match(src(f), new RegExp(`export const revalidate = ${PROXY_CACHE_MS / 1000};`), `${f} caches for PROXY_CACHE_MS`);
  for (const f of ["app/results/2026/NationalDesk.tsx", "app/results/monitor/Monitor.tsx", "app/results/2026/[id]/RaceLive.tsx", "app/api/civic/search/route.ts"]) assert.doesNotMatch(src(f), /30 second cache|for 30 seconds/, `${f} no longer claims a 30 second cache`);
});

test("[9] a read with no provider-side time is stale and unknown, never stamped with the browser clock", () => {
  const now = Date.parse("2026-11-04T02:00:00Z");
  const one = { id: 1, type: "US Senate", province: "NE", district: null, name: "x", pr: 10, c: cv([["A", "D", 5]]) };
  const m = mergeReads({}, { "US Senate": { races: [one], at: null } }, now);
  assert.equal(m.oldest, null); assert.equal(m.stale, true); assert.deepEqual(m.untimed, ["US Senate"]);
  const ok = mergeReads({}, { "US Senate": { races: [one], at: now - 60_000 } }, now);
  assert.equal(ok.stale, false); assert.equal(ok.oldest, now - 60_000); assert.deepEqual(ok.untimed, []);
  const failed = mergeReads(ok.good, { "US Senate": new Error("502") }, now + STALE_MS + 120_000);
  assert.equal(failed.stale, true); assert.equal(failed.races.length, 1, "the last good read is kept, and flagged");
  assert.match(failed.warning ?? "", /could not be refreshed/);
});
