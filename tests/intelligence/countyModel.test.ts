// The county model of November 13, 2026 (engine 2.4.0): Senate and governor's races read county by county, a county
// taken as finished from how long its count has been quiet and where it sits against its state, turnout shared across
// states, and a spread on the ballots still out. Hand-built states, so each rule is tested apart from the night.
import test from "node:test";
import assert from "node:assert/strict";
import { regionsAt, prepare, type CompactRace } from "../../app/lib/engine/civicHistory";
import { DEFAULT_CONFIG, type EngineConfig } from "../../app/lib/engine/config";
import { countyContext } from "../../app/lib/engine/countyBaselines";
import { forecastRace, prepareRace, shareNationalTurnout, type UnitBaseline } from "../../app/lib/engine/raceModel";
import { countyUnits, observe, type CivicRawRace } from "../../app/lib/engine/snapshot";
import type { RaceObservation } from "../../app/lib/engine/types";
import type { XIndex, XRace } from "../../app/results/2026/live";

const T0 = "2026-11-04T05:00:00.000Z";
const ago = (min: number) => new Date(Date.parse(T0) - min * 60_000).toISOString();
const race = (st = "ZZ", id = `sen-${st}`): XRace => ({ id, k: "sen", st, nm: `${st} Senate`, off: "", c: [["Dana Dem", "D", 150_000], ["Ray Rep", "R", 150_000]], tot: 300_000, m: 0, pR: 0.5, civ: { t: ["US Senate"] } }) as XRace;
// three counties of 100,000 forecast votes: one Democratic, one even, one Republican
const BASE: UnitBaseline = { "99001": [60_000, 40_000, 0, 100_000], "99003": [50_000, 50_000, 0, 100_000], "99005": [40_000, 60_000, 0, 100_000] };
const NAMES = { "99001": "Alder", "99003": "Birch city", "99005": "Cedar" };
type Row = { fips?: string; name: string; type?: string; d: number; r: number; quiet?: number | null };
const raw = (rows: Row[], top?: [number, number]): CivicRawRace => {
  const c = (d: number, r: number) => [{ name: "Dana Dem", party: "Democratic", votes: d }, { name: "Ray Rep", party: "Republican", votes: r }];
  const sum = rows.filter((x) => x.type !== "Town").reduce((a, x) => [a[0] + x.d, a[1] + x.r], [0, 0]);
  return { id: 1, type: "US Senate", province: "ZZ", percent_reporting: 50, candidates: c(...(top ?? (sum as [number, number]))),
    region_results: Object.fromEntries(rows.map((x, i) => [`k${i}`, { name: x.name, fips: x.fips, type: x.type ?? "County", percent_reporting: 50, candidates: c(x.d, x.r), last_changed: x.quiet === null ? null : ago(x.quiet ?? 5) }])) };
};
const obsOf = (r: XRace, rows: Row[]): RaceObservation => observe(r.id, raw(rows), T0, false, { baselines: { [r.id]: BASE }, names: NAMES });
const FULL: Row[] = [{ fips: "99001", name: "Alder", d: 30_000, r: 20_000 }, { fips: "99003", name: "Birch City", d: 25_000, r: 25_000 }, { fips: "99005", name: "Cedar", d: 20_000, r: 30_000 }];

test("county rows become units by FIPS code, or by name where the provider sends none; towns and totals are left out", () => {
  const rows: Row[] = [FULL[0], { name: "Birch City", type: "City", d: 25_000, r: 25_000 }, FULL[2], { name: "Alderville", type: "Town", d: 9_000, r: 1_000 }];
  const u = obsOf(race(), rows).units!;
  assert.deepEqual(u.map((x) => x.unitId), ["99001", "99003", "99005"]);
  assert.equal(u[1].quietSince, ago(5));
});

test("a race stays on its total when the county rows do not add up to it, do not cover the forecast's counties, or carry no change times", () => {
  const cands = observe("sen-ZZ", raw(FULL), T0).candidates;
  assert.equal(countyUnits("sen-ZZ", raw(FULL, [80_000, 80_000]), cands.map((c, i) => ({ ...c, votes: 80_000 + 0 * i })), BASE, NAMES), null, "rows sum to 150,000 against a total of 160,000");
  assert.equal(obsOf(race(), FULL.slice(0, 2)).units, null, "two of three counties");
  assert.equal(obsOf(race(), FULL.map((x) => ({ ...x, quiet: null }))).units, null, "no change times: a single live read");
  assert.ok(obsOf(race(), FULL).units, "the same rows with change times are used");
  // and such a race is modeled from its total, exactly as before the county model existed
  const o = obsOf(race(), FULL.map((x) => ({ ...x, quiet: null })));
  assert.equal(prepareRace(race(), o, BASE).mode, "topline");
});

test("county forecasts are used only when they add up to the race's own forecast", () => {
  const file = { _n: NAMES, "sen-ZZ": { "99001": [-20, 60_000, 40_000, 100_000], "99003": [0, 50_000, 50_000, 100_000], "99005": [20, 40_000, 60_000, 100_000] }, "sen-YY": { "98001": [0, 10, 10, 20] } };
  const ctx = countyContext(file, { races: [race("ZZ"), race("YY")] } as unknown as XIndex);
  assert.deepEqual(Object.keys(ctx.baselines), ["sen-ZZ"]);
  assert.deepEqual(ctx.baselines["sen-ZZ"]["99001"], [60_000, 40_000, 0, 100_000]);
});

const doneOf = (r: XRace, rows: Row[], cfg: EngineConfig = DEFAULT_CONFIG) => Object.fromEntries(prepareRace(r, obsOf(r, rows), BASE, cfg).units.map((u) => [u.id, u.done]));

test("a county is taken as finished from quiet time and from where it sits against its state, never from the provider's percent", () => {
  // all three counties hold 90% of their forecast vote
  const at = (q: number[]): Row[] => FULL.map((x, i) => ({ ...x, d: x.d * 1.8, r: x.r * 1.8, quiet: q[i] }));
  const fresh = doneOf(race(), at([2, 2, 2])), quiet = doneOf(race(), at([240, 240, 240]));
  assert.ok(quiet["99001"]! > 0.85 && quiet["99001"]! <= DEFAULT_CONFIG.turnout.quiet.maxLong, `quiet for four hours at its state's level: ${quiet["99001"]}`);
  assert.ok(fresh["99001"]! < quiet["99001"]!, "a county that has only just moved is less sure");
  // a county at half its forecast vote is not finished, however quiet (an early-vote count that then stops for hours)
  const half = doneOf(race(), [{ ...FULL[0], d: 30_000, r: 20_000, quiet: 400 }, ...at([240, 240, 240]).slice(1)]);
  assert.equal(half["99001"], 0);
  // a state known to count for days: quiet time proves nothing
  const slow = doneOf(race("CA"), at([400, 400, 400]));
  assert.deepEqual(Object.values(slow), [0, 0, 0]);
});

test("finished counties end the count: the projected total stops near what is counted", () => {
  const r = race(), rows = (q: number): Row[] => FULL.map((x) => ({ ...x, d: x.d * 1.7, r: x.r * 1.7, quiet: q }));
  const O = { seed: "t", computedAt: T0, snapshotId: "s", draws: 2000 };
  const open = forecastRace(r, obsOf(r, rows(1)), BASE, O), shut = forecastRace(r, obsOf(r, rows(300)), BASE, O);
  assert.equal(open.turnout.counted, 255_000);
  assert.ok(open.turnout.outstanding!.mean > 2 * shut.turnout.outstanding!.mean, `${open.turnout.outstanding!.mean} v ${shut.turnout.outstanding!.mean}`);
  assert.ok(shut.turnout.outstanding!.mean < 0.05 * 255_000, "quiet for five hours at 85% of the forecast: little is left");
});

test("turnout is shared across states: a state with nothing finished takes the level the other states' finished counties show", () => {
  const mk = (st: string, scale: number, q: number) => { const r = race(st); return prepareRace(r, obsOf(r, FULL.map((x) => ({ ...x, d: x.d * scale, r: x.r * scale, quiet: q }))), BASE); };
  // four states finished at 80% of their forecast turnout; a fifth has only its first returns
  const done = ["AA", "BB", "DD", "EE"].map((st) => mk(st, 1.6, 300)), early = mk("FF", 0.4, 1);
  assert.equal(early.turnoutPost.M, 0, "alone, the state's shift is the forecast's");
  shareNationalTurnout([...done, early]);
  assert.ok(early.turnoutPost.M < -0.08 && early.turnoutPost.M > Math.log(0.8), `shared: ${early.turnoutPost.M}`);
  // a state's own finished counties still count for more than the other states do
  assert.ok(Math.abs(done[0].turnoutPost.M - Math.log(0.8)) < 0.03);
});

test("the ballots still out carry their own spread, widest for the last few", () => {
  const r = race(), o = obsOf(r, FULL.map((x) => ({ ...x, d: x.d * 1.7, r: x.r * 1.7 })));
  const O = { seed: "t", computedAt: T0, snapshotId: "s", draws: 4000 };
  const cfg0: EngineConfig = { ...DEFAULT_CONFIG, margin: { ...DEFAULT_CONFIG.margin, sdOutstanding: 0, sdOutstandingLate: 0 } };
  const w = (c: EngineConfig) => { const i = forecastRace(r, o, BASE, { ...O, cfg: c }).principalMargin!.projected.i95; return i.hi - i.lo; };
  assert.ok(w(DEFAULT_CONFIG) > 1.25 * w(cfg0), `${w(DEFAULT_CONFIG)} v ${w(cfg0)}`);
  assert.ok(DEFAULT_CONFIG.margin.sdOutstandingLate > DEFAULT_CONFIG.margin.sdOutstanding);
});

test("a recorded history says when each county last changed its votes", () => {
  const snap = (t: string, votes: number) => ({ t, pr: 0, ca: null, lu: null, pc: null, v: [[0, votes], [1, votes]] as [number, number][], w: [], r: { alder: [10, [0, votes], [1, votes]] as [number, [number, number], [number, number]] } });
  const c: CompactRace = { id: 7, name: "ZZ Senate", state: "ZZ", category: "federal", type: "US Senate", cands: [["Dana Dem", "Democratic", 1], ["Ray Rep", "Republican", 2]], regions: { alder: ["99001", "Alder", "County"] }, final: null,
    snaps: [snap("2026-11-04T01:00:00Z", 0), snap("2026-11-04T02:00:00Z", 500), { ...snap("2026-11-04T03:00:00Z", 500), r: { alder: [12, [0, 500], [1, 500]] } }] };
  const [h] = prepare([c]);
  assert.equal(regionsAt(h, 1).alder.last_changed, "2026-11-04T02:00:00Z");
  assert.equal(regionsAt(h, 2).alder.last_changed, "2026-11-04T02:00:00Z", "a new percent on the same votes is not a change");
});

test("one small county far from everything else does not move its state", () => {
  // 4,250 votes from a county of 5,000, quiet for hours, 60 points more Democratic than its forecast; nothing else counted
  const base: UnitBaseline = { ...BASE, "99007": [2_500, 2_500, 0, 5_000] };
  const r = { ...race(), c: [["Dana Dem", "D", 152_500], ["Ray Rep", "R", 152_500]], tot: 305_000 } as XRace;
  const rows: Row[] = [...FULL.map((x) => ({ ...x, d: 0, r: 0 })), { fips: "99007", name: "Dogwood", d: 3_400, r: 850, quiet: 300 }];
  const o = observe(r.id, raw(rows), T0, false, { baselines: { [r.id]: base }, names: { ...NAMES, "99007": "Dogwood" } });
  assert.equal(o.units?.length, 4);
  const f = forecastRace(r, o, base, { seed: "t", computedAt: T0, snapshotId: "s", draws: 4000 });
  assert.ok(Math.abs(f.principalMargin!.projected.mean) < 8, `projected ${f.principalMargin!.projected.mean}`);
  const p = Math.max(...f.candidates.map((c) => c.winProbability ?? 0)); assert.ok(p < 0.9, `chance ${p}`);
});

test("a correction of a few votes does not restart a county's quiet clock", () => {
  const snap = (t: string, votes: number) => ({ t, pr: 0, ca: null, lu: null, pc: null, v: [[0, votes], [1, votes]] as [number, number][], w: [], r: { alder: [10, [0, votes], [1, votes]] as [number, [number, number], [number, number]] } });
  const c: CompactRace = { id: 7, name: "ZZ Senate", state: "ZZ", category: "federal", type: "US Senate", cands: [["Dana Dem", "Democratic", 1], ["Ray Rep", "Republican", 2]], regions: { alder: ["99001", "Alder", "County"] }, final: null,
    snaps: [snap("2026-11-04T01:00:00Z", 0), snap("2026-11-04T02:00:00Z", 5000), snap("2026-11-04T05:00:00Z", 5010), snap("2026-11-04T06:00:00Z", 5200)] };
  const [h] = prepare([c]);
  assert.equal(regionsAt(h, 2).alder.last_changed, "2026-11-04T02:00:00Z", "20 votes on 10,000");
  assert.equal(regionsAt(h, 3).alder.last_changed, "2026-11-04T06:00:00Z", "400 votes on 10,000 is a move");
});
