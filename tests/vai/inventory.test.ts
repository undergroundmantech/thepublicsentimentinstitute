// T5 inventory: how many votes are left, per county and for the race, under synthetic reporting sequences.
// Everything here is synthetic or read from committed files.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateInventory, quantilesOf, statewideOfficialFrom, toVaiInventory, unitsFromFrame, type InventoryInput, type InventoryUnit } from "../../app/results/_vai/inventory";
import { HYPER_V1, HYPER_V1 as H, mean, quantile, width, withHyper } from "./_support";
import type { VaiReturnsFrame } from "../../app/results/_vai/types";
import type { OutstandingInventory } from "../../app/lib/intelligence/types";

const J = 4000;
const NIGHT = { class: "ELECTION_DAY_OR_EARLIER" as const, deadlineUtc: null, countSpeed: 0 };
const GRACE = { class: "POSTMARK_GRACE" as const, deadlineUtc: "2026-11-10T05:00:00Z", countSpeed: 1 };
const AS_OF = "2026-11-04T03:00:00Z";

const units = (n: number, f: number, over: (u: InventoryUnit, i: number) => Partial<InventoryUnit> = () => ({})): InventoryUnit[] =>
  Array.from({ length: n }, (_, i) => {
    const E = 10000 * (1 + (i % 5) * 0.3);
    const u: InventoryUnit = { id: `c${String(i).padStart(2, "0")}`, expected: E, reported: Math.round(f * E), region: `R${i % 4}` };
    return { ...u, ...over(u, i) };
  });
const run = (us: InventoryUnit[], extra: Partial<InventoryInput> = {}) =>
  estimateInventory({ raceId: "t", asOf: AS_OF, units: us, receipt: NIGHT, hyper: HYPER_V1, seed: 5, draws: J, ...extra });
const sumE = (us: InventoryUnit[]) => us.reduce((s, u) => s + u.expected, 0);
const sumN = (us: InventoryUnit[]) => us.reduce((s, u) => s + u.reported, 0);

test("every draw keeps total >= counted; draws are reproducible and the seed matters", () => {
  const us = units(40, 0.5);
  const a = run(us), b = run(us), c = run(us, { seed: 6 });
  for (let k = 0; k < us.length; k++) for (let j = 0; j < J; j++) {
    assert.ok(a.total[k][j] >= a.reported[k]);
    assert.ok(Number.isFinite(a.total[k][j]));
  }
  assert.deepEqual(a.remainingTotal, b.remainingTotal);
  assert.deepEqual(a.tauState, b.tauState);
  assert.notDeepEqual(a.remainingTotal, c.remainingTotal);
  assert.equal(a.flags.length, 0);
});

test("nothing counted: remaining is centred on the forecast's expected total, with a stated interval", () => {
  const us = units(60, 0);
  const p = run(us);
  const E = sumE(us);
  assert.ok(Math.abs(p.summary.remaining.median / E - 1) < 0.02, `median ${p.summary.remaining.median / E}`);
  const rel = (p.summary.remaining.q90 - p.summary.remaining.q10) / E;
  assert.ok(rel > 0.04 && rel < 0.4, `interval ${rel}`);
  assert.equal(p.summary.reported, 0);
});

test("a partial count is not a completion: counted votes at expectation still leave votes outstanding, and more counted means fewer", () => {
  const E = sumE(units(40, 0));
  const med = [0.3, 0.6, 0.9, 1.0].map((f) => run(units(40, f)).summary.remaining.median);
  for (let i = 1; i < med.length; i++) assert.ok(med[i] < med[i - 1], `median remaining falls: ${med}`);
  assert.ok(med[3] > 0.03 * E, "counted = expected is not done");
  const w0 = width(run(units(40, 0)).remainingTotal), w1 = width(run(units(40, 1.0)).remainingTotal);
  assert.ok(w1 < w0, "truncation at the counted total narrows the interval");
});

test("precincts reporting changes nothing: frames that differ only in it give identical units and identical draws", () => {
  const mk = (pct: number): VaiReturnsFrame => {
    const counties: VaiReturnsFrame["counties"] = {};
    for (let i = 0; i < 20; i++) counties[`f${i}`] = { sides: { a: 1000 + i, b: 1200, o: 50 }, t: 2250 + i, level: "COUNTY", sourceTimestamp: null, precinctsReportingPct: pct * (i % 3) } as VaiReturnsFrame["counties"][string];
    return { raceId: "r", asOf: AS_OF, reported: { a: 0, b: 0, o: 0, t: 0, label: "VERIFIED" }, basis: "JURISDICTION_SUM", counties, unmatched: { jurisdictionIds: [], sides: { a: 0, b: 0, o: 0 }, t: 0 }, residual: { sides: { a: 0, b: 0, o: 0 }, t: 0 }, coverage: 1, freshness: { status: "FRESH", latestSourceTimestamp: null, ageMinutes: 0, staleAfterMinutes: 30 }, findings: [], counts: { used: 0, superseded: 0, testExcluded: 0, afterAsOf: 0 }, intelIssues: [] } as VaiReturnsFrame;
  };
  const expected = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`f${i}`, { total: 5000 + 100 * i }]));
  const a = unitsFromFrame(mk(1), expected), b = unitsFromFrame(mk(40), expected);
  assert.deepEqual(a, b);
  assert.deepEqual(run(a.units).total, run(b.units).total);
  assert.ok(a.units.every((u) => u.reported > 2000), "votes, not precincts, are what is read");
});

test("votes outside every known county stay in the race total instead of disappearing", () => {
  const frame = { counties: { x: { t: 100 } }, unmatched: { t: 40 }, residual: { t: -5 } } as unknown as VaiReturnsFrame;
  assert.equal(unitsFromFrame(frame, { x: { total: 500 } }).unmatchedReported, 35);
});

test("a county far above its expectation is flagged and its residual doubles", () => {
  const us = units(20, 0.5, (u, i) => (i === 3 ? { reported: Math.round(1.5 * u.expected) } : {}));
  const p = run(us);
  assert.equal(p.perUnit[3].exceeded, true);
  assert.equal(p.perUnit[3].sigma, 2 * HYPER_V1.inventory.sigmaUnit);
  assert.equal(p.perUnit[2].exceeded, false);
  assert.ok(p.flags.includes("TOTAL_EXCEEDS_EXPECTED"));
  for (let j = 0; j < J; j++) assert.ok(p.total[3][j] >= p.reported[3]);
  assert.equal(run(units(20, 0.5, (u, i) => (i === 3 ? { reported: Math.round(1.5 * u.expected), exceededBefore: true } : {}))).perUnit[3].sigma, 0.2);
});

test("an official statement of outstanding ballots sets the remainder, less a rejected share, and the model adds nothing in an election-day state", () => {
  const us = units(30, 0.7);
  const p = run(us, { statewideOfficial: { outstanding: 50000, scope: "STATEWIDE_OR_DISTRICT", recordIds: ["r1"] } });
  const q = quantilesOf(p.remainingTotal);
  assert.ok(q.q90 <= 50000 + 1e-6, `q90 ${q.q90}`);
  assert.ok(q.median > 47000 && q.median < 50000, `median ${q.median}`);
  assert.equal(p.summary.officialOutstanding, 50000);
  assert.equal(p.summary.officialScope, "STATEWIDE_OR_DISTRICT");
  assert.ok(p.flags.includes("OFFICIAL_OUTSTANDING_USED"));
});

test("a county-level official floor binds only when the counties' own estimate falls short", () => {
  const us = units(30, 0.97);
  const own = run(us).summary.remaining.median;
  const p = run(us, { statewideOfficial: { outstanding: 150000, scope: "COUNTIES", recordIds: [] } });
  assert.ok(own < 0.8 * 150000, `the counties alone say less is left: ${own}`);
  assert.ok(p.summary.remaining.median > 140000 && p.summary.remaining.median < 150500, `${p.summary.remaining.median}`);
  const big = run(units(30, 0.2), { statewideOfficial: { outstanding: 1000, scope: "COUNTIES", recordIds: [] } });
  assert.ok(big.summary.remaining.median > 0.5 * sumE(units(30, 0)), "a small floor does not shrink an estimate above it");
});

test("a postmark-grace state keeps late ballots possible until its deadline, and not after", () => {
  const us = units(30, 0.7);
  const stmt = { outstanding: 50000, scope: "STATEWIDE_OR_DISTRICT" as const, recordIds: [] };
  const before = run(us, { receipt: GRACE, statewideOfficial: stmt });
  const after = run(us, { receipt: GRACE, asOf: "2026-11-11T00:00:00Z", statewideOfficial: stmt });
  const day = run(us, { statewideOfficial: stmt });
  assert.equal(before.late.applies, true);
  assert.equal(after.late.applies, false);
  assert.ok(before.summary.remaining.median > day.summary.remaining.median + 0.003 * sumE(us));
  assert.ok(Math.abs(after.summary.remaining.median - day.summary.remaining.median) < 600);
  assert.ok(before.perUnit[0].sigma > day.perUnit[0].sigma, "grace widens the county residual");
  assert.ok(run(us, { receipt: { ...NIGHT, countSpeed: 2 } }).perUnit[0].sigma > day.perUnit[0].sigma, "a slow count widens it too");
});

test("the completion ladder: only explicit evidence closes a county, and precincts-all-in is not completion", () => {
  const all = (level: InventoryUnit["completion"], f = 1, receipt: InventoryInput["receipt"] = NIGHT) => run(units(20, f, () => ({ completion: level })), { receipt });
  const N = sumN(units(20, 1));
  assert.ok(all("ALL_KNOWN_BALLOTS_COUNTED").summary.remaining.median < 0.005 * N);
  assert.ok(all("CERTIFIED").summary.remaining.median === 0);
  const night = all("OFFICIAL_ELECTION_NIGHT_COMPLETE").summary.remaining.median;
  assert.ok(night > 0.004 * N && night < 0.03 * N, `night ${night / N}`);
  const pre = all("PRECINCTS_ALL_IN", 0.6);
  assert.ok(pre.summary.remaining.median > 0.25 * sumE(units(20, 0)));
  assert.ok(pre.flags.includes("PRECINCTS_ALL_IN_NOT_COMPLETE"));
  const early = all("ALL_KNOWN_BALLOTS_COUNTED", 1, GRACE);
  assert.ok(early.flags.includes("COMPLETION_BEFORE_DEADLINE"));
  assert.ok(early.summary.remaining.median > all("ALL_KNOWN_BALLOTS_COUNTED", 1, { ...GRACE, deadlineUtc: "2026-11-01T00:00:00Z" }).summary.remaining.median);
});

test("finished counties teach the shared turnout shocks, and a region learns most from its own counties", () => {
  const us = units(60, 0, (u, i) => (i < 30 && i % 4 === 0 ? {} : {}));
  const learn: InventoryUnit[] = us.map((u, i) => (i % 2 === 0 ? { ...u, reported: Math.round(1.15 * u.expected), completion: "CERTIFIED" as const, region: "R0" } : { ...u, region: i % 4 === 1 ? "R0" : "R1" }));
  const p = run(learn);
  const ratio = (k: number) => mean(p.total[k]) / learn[k].expected;
  const sameRegion = learn.map((u, i) => (i % 2 === 1 && u.region === "R0" ? ratio(i) : null)).filter((x): x is number => x !== null);
  const otherRegion = learn.map((u, i) => (i % 2 === 1 && u.region === "R1" ? ratio(i) : null)).filter((x): x is number => x !== null);
  assert.ok(mean(sameRegion) > 1.1, `same region ${mean(sameRegion)}`);
  assert.ok(mean(otherRegion) > 1.03 && mean(otherRegion) < mean(sameRegion), `other region ${mean(otherRegion)}`);
  assert.ok(mean(p.tauState) > 0.04);
  const naive = run(us.map((u) => ({ ...u, reported: 0 })));
  assert.ok(Math.abs(mean(naive.tauState)) < 0.01, "with nothing counted the shocks stay at their prior mean");
});

test("completed counties are not stretched: a certified unit contributes exactly its counted votes", () => {
  const us = units(6, 0.9, () => ({ completion: "CERTIFIED" as const }));
  const p = run(us);
  assert.equal(p.summary.remaining.q90, 0);
  assert.deepEqual(p.total[2], new Float64Array(J).fill(us[2].reported));
});

test("an empty or unexpected county cannot break the draw", () => {
  const us: InventoryUnit[] = [{ id: "z", expected: 0, reported: 0 }, { id: "y", expected: 0, reported: 500 }, { id: "x", expected: 1000, reported: 0 }];
  const p = run(us);
  assert.ok(p.perUnit[1].flags.includes("NO_EXPECTATION"));
  assert.ok(Number.isFinite(p.summary.remaining.median));
  assert.equal(p.perUnit[0].mode, "INERT");
});

test("official and evidence labels reach the contract: late ballots stay UNKNOWN, estimates are intervals", () => {
  const p = run(units(10, 0.5));
  const v = toVaiInventory(p);
  assert.equal(v.lateEligible.label, "UNKNOWN");
  assert.equal(v.officialOutstanding.label, "UNKNOWN");
  assert.equal(v.estimatedRemaining.label, "ESTIMATED");
  const { low, central, high } = v.estimatedRemaining.interval as { low: number; central: number; high: number };
  assert.ok(low < central && central < high);
  assert.equal(v.tier, "FORECAST_POINT_NO_RANGE");
  const o = toVaiInventory(run(units(10, 0.5), { statewideOfficial: { outstanding: 9000, scope: "STATEWIDE_OR_DISTRICT", recordIds: ["x"] } }));
  assert.equal(o.officialOutstanding.label, "OFFICIAL_STATEMENT");
  assert.equal(o.tier, "OFFICIAL_JURISDICTION_COUNT");
});

test("only a verified statement of outstanding ballots is used", () => {
  const inv = (cls: string, scope: string | null) => ({ officiallyConfirmedOutstanding: { value: 1234, evidenceClass: cls, sources: ["s1"] }, officialScope: scope }) as unknown as OutstandingInventory;
  assert.equal(statewideOfficialFrom(null), null);
  assert.equal(statewideOfficialFrom(inv("ESTIMATED", "STATEWIDE_OR_DISTRICT")), null);
  assert.equal(statewideOfficialFrom(inv("VERIFIED", null)), null);
  assert.deepEqual(statewideOfficialFrom(inv("VERIFIED", "STATEWIDE_OR_DISTRICT")), { outstanding: 1234, scope: "STATEWIDE_OR_DISTRICT", recordIds: ["s1"] });
});

test("hyperparameters are an input, not a constant: a wider county residual widens the interval", () => {
  const us = units(40, 0.5);
  const wide = run(us, { hyper: withHyper(H, { inventory: { sigmaUnit: 0.25 } }) });
  assert.ok(width(wide.remainingTotal) > width(run(us).remainingTotal));
  assert.equal(wide.hyperId, H.hyperId);
  assert.ok(quantile(wide.remainingTotal, 0.5) > 0);
});
