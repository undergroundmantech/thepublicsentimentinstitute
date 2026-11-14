// Phase 2: the engine (app/lib/engine). Numbers in brackets are the acceptance tests of docs/05 in the overhaul
// package. These test mathematical invariants and behaviour, never calibration: nothing here says the probabilities
// are right, only that they are finite, consistent, reproducible and honest about what is unknown.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_CONFIG, withConfig } from "../../app/lib/engine/config";
import { engineApiEnabled } from "../../app/lib/engine/gate";
import { methodPriorsEnabled, priorsFromCandidateByMethod, type MethodPriorTable } from "../../app/lib/engine/methodPriors";
import { nationalForecast, preElectionFrom, senateControl } from "../../app/lib/engine/national";
import { fitRace, forecastRace, prepareRace, sharesFromMargin, type UnitBaseline } from "../../app/lib/engine/raceModel";
import { blankTestCounts, snapshotFromCivic, type CivicRawRace } from "../../app/lib/engine/snapshot";
import type { ElectionSnapshot, RaceObservation } from "../../app/lib/engine/types";
import { candidateId } from "../../app/results/2026/candidates";
import type { XIndex, XRace } from "../../app/results/2026/live";

const root = path.join(import.meta.dirname, "../..");
const ix = JSON.parse(fs.readFileSync(path.join(root, "public/results/2026/index.json"), "utf8")) as XIndex;
const pre = preElectionFrom(JSON.parse(fs.readFileSync(path.join(root, "public/forecast/archive/final-2026-11-03/model.json"), "utf8")));
const race = (id: string) => ix.races.find((x) => x.id === id) as XRace;
const O = { seed: "t", computedAt: "2026-11-04T03:00:00Z", snapshotId: "test", draws: 1500 };
type Row = [string, string, number | null];
const obs = (r: XRace, rows: Row[], pr: number | null, extra: Partial<RaceObservation> = {}): RaceObservation => ({ raceId: r.id, providerRaceId: 1, providerPctReporting: pr, units: null, sourceAsOf: null, receivedAt: "2026-11-04T03:00:00Z", test: false,
  candidates: rows.map(([n, p, v]) => ({ candidateId: candidateId(r.id, n), name: n, partyRaw: p, votes: v, providerWinner: false })), ...extra });
// a synthetic even race: forecast 100,000 votes, Dana (D) v Ray (R), margin 0, 50%
const EVEN = { id: "sen-ZZ", k: "sen", st: "ZZ", nm: "ZZ Senate", off: "", c: [["Dana Dem", "D", 50_000], ["Ray Rep", "R", 50_000]], tot: 100_000, m: 0, pR: 0.5, civ: { t: ["US Senate"] } } as XRace;
const winP = (f: ReturnType<typeof forecastRace>, name: string) => f.candidates.find((c) => c.name === name)?.winProbability ?? NaN;

test("deterministic: the same inputs and seed give exactly the same forecast; a different read time changes nothing", () => {
  const r = race("sen-NE"), o = obs(r, [["Pete Ricketts", "Republican", 150_000], ["Dan Osborn", "Independent", 160_000]], 40);
  assert.deepEqual(forecastRace(r, o, null, O), forecastRace(r, o, null, O));
  assert.deepEqual(forecastRace(r, { ...o, receivedAt: "2026-11-04T09:00:00Z" }, null, O).candidates, forecastRace(r, o, null, O).candidates, "a timestamp alone is not evidence");
  assert.notDeepEqual(forecastRace(r, o, null, { ...O, seed: "other" }).candidates, forecastRace(r, o, null, O).candidates);
});

test("before any vote the race is the published forecast: chance and margin, within Monte Carlo error", () => {
  for (const id of ["sen-NE", "sen-GA", "house-PA-07", "gov-AZ"]) {
    const r = race(id), f = forecastRace(r, null, null, { ...O, draws: 4000 });
    const pm = f.principalMargin!; assert.ok(Math.abs(pm.probB - (r.pR as number)) < 4 * Math.sqrt(0.25 / 4000) + 0.005, `${id}: ${pm.probB} v ${r.pR}`);
    assert.ok(Math.abs(pm.projected.mean - pm.prior.margin) < 0.6, `${id} margin`);
    assert.equal(f.dataState, "MISSING"); assert.equal(f.calibration, "UNCALIBRATED");
  }
});

test("[8] precinct percent is not ballots counted, and a tiny denominator cannot project a turnout spike", () => {
  // turnout 25% above the forecast, 80% of precincts in: the old page called this race finished
  const f = forecastRace(EVEN, obs(EVEN, [["Dana Dem", "D", 60_000], ["Ray Rep", "R", 40_000]], 80), null, O);
  assert.ok(f.turnout.outstanding!.mean > 8_000, `still to count: ${f.turnout.outstanding!.mean}`);
  assert.ok(f.turnout.expectedFinal!.i80.hi > 115_000);
  // 10 votes at 0.01% of precincts: no evidence about turnout, so the forecast total stands
  const g = forecastRace(EVEN, obs(EVEN, [["Dana Dem", "D", 6], ["Ray Rep", "R", 4]], 0.01), null, O);
  assert.ok(g.turnout.expectedFinal!.mean < 150_000 && g.turnout.expectedFinal!.mean > 70_000, `${g.turnout.expectedFinal!.mean}`);
  assert.ok(g.flags.includes("TURNOUT_WEAK_EVIDENCE"));
  // a feed whose count is far above the forecast total is flagged for the operator
  assert.ok(forecastRace(EVEN, obs(EVEN, [["Dana Dem", "D", 160_000], ["Ray Rep", "R", 150_000]], 95), null, O).flags.includes("COUNT_EXCEEDS_FORECAST"));
});

// method priors for a synthetic state: early votes 40% of ballots and 20 points bluer than the state; Election Day the rest
const PRIORS: MethodPriorTable = { ZZ: { state: "ZZ", source: "synthetic test config", year: null, office: null, evidence: "CONFIG", methods: [
  { method: "EARLY_IN_PERSON", labels: ["EARLY"], share: { mean: 0.4, sd: 0.01 }, offset: { mean: -20, sd: 1 } },
  { method: "ELECTION_DAY", labels: ["ELECTION DAY"], share: { mean: 0.6, sd: 0.01 }, offset: { mean: 40 / 3, sd: 1 } },
] } };
const methodObs = (early: [number, number], ed: [number, number]): RaceObservation => {
  const ids = ["Dana Dem", "Ray Rep"].map((n) => candidateId(EVEN.id, n));
  return { ...obs(EVEN, [["Dana Dem", "D", early[0] + ed[0]], ["Ray Rep", "R", early[1] + ed[1]]], null),
    units: [{ unitId: "TOPLINE", name: null, providerPctReporting: null, votes: {}, methodSource: "PROVIDER_CONFIRMED", byMethod: { EARLY_IN_PERSON: { [ids[0]]: early[0], [ids[1]]: early[1] }, ELECTION_DAY: { [ids[0]]: ed[0], [ids[1]]: ed[1] } } }] };
};

test("[11] a method-confirmed batch reduces only its own method's outstanding ballots", () => {
  const a = forecastRace(EVEN, methodObs([24_000, 16_000], [0, 0]), null, { ...O, priors: PRIORS });
  const by = (f: typeof a, m: string) => f.turnout.byUnit.find((u) => u.method === m)!;
  assert.equal(by(a, "EARLY_IN_PERSON").counted, 40_000); assert.ok(by(a, "EARLY_IN_PERSON").outstanding.mean < 3_000);
  assert.ok(Math.abs(by(a, "ELECTION_DAY").outstanding.mean - 60_000) < 6_000);
  const b = forecastRace(EVEN, methodObs([24_000, 16_000], [8_000, 12_000]), null, { ...O, priors: PRIORS });
  assert.ok(Math.abs(by(b, "EARLY_IN_PERSON").outstanding.mean - by(a, "EARLY_IN_PERSON").outstanding.mean) < 1_000, "the early stratum did not move");
  assert.ok(by(a, "ELECTION_DAY").outstanding.mean - by(b, "ELECTION_DAY").outstanding.mean > 15_000, "the Election Day stratum fell by the batch");
  assert.ok(a.turnout.byUnit.every((u) => u.methodSource === "PROVIDER_CONFIRMED"));
});

test("[12] a blue first batch of early votes, with Election Day votes known to lean red, is not a confident Democratic win", () => {
  const known = forecastRace(EVEN, methodObs([24_000, 16_000], [0, 0]), null, { ...O, priors: PRIORS });
  const pD = winP(known, "Dana Dem");
  assert.ok(pD > 0.25 && pD < 0.75, `with the method inventory: ${pD}`);
  // the same counted votes with the method unknown: the order-bias term keeps the count from settling the race
  const unknown = forecastRace(EVEN, obs(EVEN, [["Dana Dem", "D", 24_000], ["Ray Rep", "R", 16_000]], 40), null, O);
  const pU = winP(unknown, "Dana Dem");
  assert.ok(pU < 0.95, `method unknown, 40% in at D+20: ${pU}`);
  assert.ok(Math.abs(unknown.principalMargin!.projected.mean) < Math.abs(unknown.principalMargin!.reported!) * 0.75, "the projection does not simply carry the first batch's margin forward");
});

test("[13] method unknown: labelled UNKNOWN, wider than the same count with a known method, priors off by default and never inferred from time", () => {
  assert.equal(methodPriorsEnabled(), false);
  const u = forecastRace(EVEN, obs(EVEN, [["Dana Dem", "D", 24_000], ["Ray Rep", "R", 16_000]], null), null, O);
  assert.ok(u.flags.includes("METHOD_UNKNOWN") && u.flags.includes("METHOD_PRIORS_OFF")); assert.equal(u.dataState, "LIMITED");
  assert.ok(u.turnout.byUnit.every((x) => x.method === "UNKNOWN" && x.methodSource === "UNKNOWN"));
  const k = forecastRace(EVEN, methodObs([24_000, 16_000], [0, 0]), null, { ...O, priors: PRIORS });
  const w = (f: typeof u) => f.principalMargin!.projected.i80.hi - f.principalMargin!.projected.i80.lo;
  assert.ok(w(u) > w(k), `unknown ${w(u)} v known ${w(k)}`);
  // without priors, method labels from the provider are not enough to model by method
  assert.ok(forecastRace(EVEN, methodObs([24_000, 16_000], [0, 0]), null, O).flags.includes("METHOD_UNKNOWN"));
  // the repository's historical method records turn into priors whose shares sum to 1 and whose offsets balance
  const rec = JSON.parse(fs.readFileSync(path.join(root, "data/intelligence/research/priority15-reporting-2026-10-26.json"), "utf8"));
  const t = priorsFromCandidateByMethod(rec.records ?? rec);
  assert.ok(t.GA && t.GA.evidence === "HISTORICAL" && t.GA.year === 2022);
  for (const s of Object.values(t)) {
    const sh = s.methods.reduce((x, m) => x + m.share.mean, 0); assert.ok(Math.abs(sh - 1) < 1e-9, s.state);
    assert.ok(Math.abs(s.methods.reduce((x, m) => x + m.share.mean * m.offset.mean, 0)) < 1e-6, `${s.state} offsets balance`);
    assert.ok(s.methods.every((m) => m.offset.sd >= 5 && m.share.sd >= 0.05), "wide on purpose");
  }
});

test("[14] a D+10 margin adjustment to an R+30 county gives R+20: shares move by 5 points each, not 10", () => {
  const base = sharesFromMargin(30, 0); assert.ok(Math.abs(base.a - 0.35) < 1e-12 && Math.abs(base.b - 0.65) < 1e-12);
  const adj = sharesFromMargin(30 - 10, 0); assert.ok(Math.abs(adj.a - 0.4) < 1e-12 && Math.abs(adj.b - 0.6) < 1e-12);
  assert.ok(Math.abs(100 * (adj.b - adj.a) - 20) < 1e-9);
  const withO = sharesFromMargin(20, 0.1); assert.ok(Math.abs(withO.b - withO.a - 0.2) < 1e-12 && Math.abs(withO.a + withO.b + withO.o - 1) < 1e-12);
  const clipped = sharesFromMargin(150, 0.2); assert.ok(clipped.a === 0 && Math.abs(clipped.b - 0.8) < 1e-12, "shares stay in range");
});

test("[15] no fixed blend: the same 50% counted carries more weight when it is complete counties than when every county is half in", () => {
  const units: UnitBaseline = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`c${i}`, [5_000, 5_000, 0, 10_000] as const]));
  const ids = ["Dana Dem", "Ray Rep"].map((n) => candidateId(EVEN.id, n));
  const mk = (cnt: (i: number) => [number, number, number]): RaceObservation => {
    const us = Array.from({ length: 10 }, (_, i) => { const [d, r, pr] = cnt(i); return { unitId: `c${i}`, name: null, providerPctReporting: pr, votes: { [ids[0]]: d, [ids[1]]: r } }; });
    const D = us.reduce((s, u) => s + u.votes[ids[0]], 0), R = us.reduce((s, u) => s + u.votes[ids[1]], 0);
    return { ...obs(EVEN, [["Dana Dem", "D", D], ["Ray Rep", "R", R]], 50), units: us };
  };
  const complete = forecastRace(EVEN, mk((i) => (i < 5 ? [5_500, 4_500, 100] : [0, 0, 0])), units, O);
  const halfway = forecastRace(EVEN, mk(() => [2_750, 2_250, 50]), units, O);
  const sd = (f: typeof complete) => f.principalMargin!.projected.i80.hi - f.principalMargin!.projected.i80.lo;
  assert.ok(sd(complete) < sd(halfway), `complete counties ${sd(complete)} v half-counted ${sd(halfway)}`);
  // the sqrt(2) rule is an experiment: off by default, and widens the prior only when asked for
  assert.equal(DEFAULT_CONFIG.spreadFactor, 1);
  const a = prepareRace(race("sen-NE"), null, null), b = prepareRace(race("sen-NE"), null, null, withConfig({ spreadFactor: Math.SQRT2 }));
  assert.ok(Math.abs(b.sdF / a.sdF - Math.SQRT2) < 1e-12 && fitRace(b).prior.v0 > fitRace(a).prior.v0);
});

test("[16] finite, non-negative and conserved, on real export figures", () => {
  const cases: [string, Row[], number][] = [
    ["sen-NE", [["Pete  Ricketts", "Republican", 150_000], ["Dan  Osborn", "Independent", 148_867], ["Robin  Richards", "Nebraska Working People", 0]], 39],
    ["sen-MT", [["Kurt Alme", "Republican", 201_399], ["Seth Bodnar", "Independent", 159_468], ["Alani Bankhead", "Democratic", 49_813], ["Kyle Austin", "Libertarian", 7_579]], 70],
    ["house-LA-05", [['Patricia "Pat" Moore', "Democratic", 40_789], ["Gabe Firment", "Republican", 60_000], ["Misti Cordell", "Republican", 50_815], ["Michael Echols", "Republican", 32_902]], 90],
  ];
  for (const [id, rows, pr] of cases) {
    const f = forecastRace(race(id), obs(race(id), rows, pr), null, O);
    let shares = 0, probs = 0;
    for (const c of f.candidates) {
      for (const v of [c.projectedVotes.mean, c.projectedVotes.i95.lo, c.projectedVotes.i95.hi, c.projectedShare.mean]) assert.ok(Number.isFinite(v) && v >= 0, `${id} ${c.name}`);
      assert.ok(c.projectedVotes.i95.lo >= (c.reportedVotes ?? 0) - 1e-6, `${id} ${c.name}: a final count is never below the count so far`);
      assert.ok(c.projectedVotes.i95.lo <= c.projectedVotes.p50 && c.projectedVotes.p50 <= c.projectedVotes.i95.hi);
      shares += c.projectedShare.mean; probs += c.winProbability ?? 0;
    }
    assert.ok(Math.abs(shares - 100) < 1e-6, `${id} shares ${shares}`); if (f.rule !== "majority_runoff") assert.ok(Math.abs(probs - 1) < 1e-9, `${id} probabilities ${probs}`);
    assert.ok(f.turnout.outstanding!.i95.lo >= 0);
  }
  // Louisiana: the reported top two are two Republicans, and the projected top two are candidates, not parties
  const la = forecastRace(race("house-LA-05"), obs(race("house-LA-05"), cases[2][1], 90), null, O);
  assert.ok(la.projectedTopTwo && la.candidates.find((c) => c.candidateId === la.projectedTopTwo!.leaderId)!.partyRaw === "Republican");
});

test("[17] a lopsided count with ballots still out is capped below certainty and is not a call; a provider call is separate", () => {
  const r = race("sen-NE"), rows: Row[] = [["Pete Ricketts", "Republican", 600_000], ["Dan Osborn", "Independent", 120_000]];
  const f = forecastRace(r, obs(r, rows, 95), null, O);
  assert.ok(f.display.capped && f.display.probability === DEFAULT_CONFIG.probCeil); assert.equal(f.settled, null); assert.equal(f.call, null);
  assert.ok((winP(f, "Pete Ricketts") ?? 0) > 0.995, "the raw model probability is kept for the record");
  const o = obs(r, rows, 95); o.candidates[0].providerWinner = true;
  const c = forecastRace(r, o, null, O);
  assert.deepEqual(c.call, { origin: "provider", source: "civicAPI", winnerId: o.candidates[0].candidateId, name: "Pete Ricketts" });
  assert.equal(winP(c, "Pete Ricketts"), winP(f, "Pete Ricketts"), "a call does not change the model");
  // an uncontested seat is settled by logic and may say 100%
  const u = forecastRace(race("house-FL-10"), null, null, O); assert.equal(u.settled?.basis, "UNCONTESTED"); assert.equal(u.display.probability, 1); assert.equal(u.display.capped, false);
});

test("[7] rule handlers: ranked choice, runoff, measures", () => {
  const ak = forecastRace(race("sen-AK"), obs(race("sen-AK"), [["Mary Peltola", "Democratic", 100_000], ["Dan Sullivan", "Republican", 95_000], ["Gerald Heikes", "Republican", 20_000]], 60), null, O);
  assert.equal(ak.rule, "ranked_choice"); assert.ok(ak.flags.includes("RULE_RANKED_CHOICE")); assert.ok(ak.candidates.every((c) => c.firstChoiceLeadProbability != null));
  const ga = forecastRace(race("sen-GA"), obs(race("sen-GA"), [["Jon Ossoff", "Democratic", 1_000_000], ["Derek Dooley", "Republican", 990_000], ["Lib", "Libertarian", 40_000]], 45), null, O);
  assert.equal(ga.rule, "majority_runoff"); assert.ok(ga.candidates.every((c) => c.winProbability === null && c.outrightProbability != null));
  assert.ok(ga.notes.some((n) => /runoff/.test(n)), "a possible runoff is reported");
  const m = ix.races.find((x) => x.k === "measure" && x.pPass != null) as XRace;
  const mf = forecastRace(m, null, null, O); assert.equal(mf.rule, "measure");
  assert.ok(Math.abs(mf.principalMargin!.probB - (1 - (m.pPass as number))) < 0.05, "pre-vote fail chance is the forecast's");
});

const snapOf = (races: Record<string, RaceObservation>, id = "s"): ElectionSnapshot => ({ snapshotId: id, provenance: { mode: "HISTORICAL", source: "test", sourceAsOf: null, receivedAt: "x", usesFutureObservation: false, synthetic: false }, races, unmatchedProviderRaces: 0 });
const NAT = { index: ix, pre, seed: "n", computedAt: "x", draws: 800 };

test("[19][23] every draw conserves seats; control categories are exclusive and sum to 1", () => {
  const { national: n } = nationalForecast({ ...NAT, snapshot: snapOf({}) });
  assert.deepEqual(n.flags.filter((f) => /do not sum/.test(f)), []);
  for (const c of [n.senate, n.house, n.governors]) {
    assert.ok(Math.abs(c.pD + c.pR + c.pUnresolved - 1) < 1e-12, c.label);
    assert.ok(c.seats.D.i95.lo <= c.seats.D.p50 && c.seats.D.p50 <= c.seats.D.i95.hi);
    assert.ok(c.display.probability <= DEFAULT_CONFIG.probCeil || c.display.basis.startsWith("Decided"));
  }
  assert.equal(n.senate.notUp.D + n.senate.notUp.R + n.senate.racesModeled, 100);
  assert.equal(n.governors.notUp.D + n.governors.notUp.R + n.governors.racesModeled, 50);
  assert.equal(n.house.racesModeled, 435);
  for (const c of [n.senate, n.house, n.governors]) assert.ok(Math.abs(c.distD.reduce((a, b) => a + b, 0) - 1) < 1e-9, `${c.label} seat distribution sums to 1`);
  // the pre-vote House matches the published forecast's expected seats (independents are not assigned a party)
  assert.ok(Math.abs(n.house.seats.D.mean - (pre.house.seatsD as number)) < 3, `${n.house.seats.D.mean}`);
});

test("[24] Senate tie-break and caucus rules; governors are a majority of offices, not a chamber", () => {
  assert.equal(senateControl(50, 50, "R"), 1); assert.equal(senateControl(50, 50, "D"), 0);
  assert.equal(senateControl(51, 48, "R"), 0); assert.equal(senateControl(49, 49, "R"), 2, "two unknown-caucus seats decide it");
  assert.equal(senateControl(50, 49, "D"), 0, "with the VP, half is control even if the independent sides with the other party");
  assert.equal(senateControl(50, 49, "R"), 2);
  assert.match(nationalForecast({ ...NAT, snapshot: snapOf({}) }).national.governors.controlRule, /majority of governorships \(26 or more of 50\)/);
  assert.deepEqual(DEFAULT_CONFIG.senate.caucus, {}, "no independent is assigned a caucus by default");
});

test("[20] races move together through shared shocks, and the same seed reproduces the national forecast", () => {
  const a = nationalForecast({ ...NAT, snapshot: snapOf({}) }).national, b = nationalForecast({ ...NAT, snapshot: snapOf({}) }).national;
  assert.deepEqual(a, b);
  const ind = nationalForecast({ ...NAT, snapshot: snapOf({}), cfg: withConfig({ national: { ...DEFAULT_CONFIG.national, sdNational: 0.01, sdState: 0 } }) }).national;
  const w = (n: typeof a) => n.house.seats.D.i80.hi - n.house.seats.D.i80.lo;
  assert.ok(w(a) > 1.5 * w(ind), `correlated ${w(a)} v independent ${w(ind)}`);
});

test("[21] an informative (finished) result moves the nation; the same data at a later time moves nothing; a partial count does not set the swing", () => {
  const base = nationalForecast({ ...NAT, snapshot: snapOf({}) }).national;
  // ten finished House races, each 8 points redder than forecast
  const fin: Record<string, RaceObservation> = {};
  for (const r of ix.races.filter((x) => x.k === "house" && (x.c ?? []).length >= 2 && x.pR != null && x.pR > 0.05 && x.pR < 0.95).slice(0, 10)) {
    const [d, rep] = [r.c!.find((c) => c[1] === "D"), r.c!.find((c) => c[1] === "R")]; if (!d || !rep) continue;
    const t = r.tot as number, m = (r.m as number) + 8;
    fin[r.id] = obs(r, [[d[0], "Democratic", Math.round((t * (100 - m)) / 200)], [rep[0], "Republican", Math.round((t * (100 + m)) / 200)]], 100);
  }
  const moved = nationalForecast({ ...NAT, snapshot: snapOf(fin, "f") }).national;
  assert.ok(moved.nationalSwing.mean > 2, `swing ${moved.nationalSwing.mean}`); assert.ok(moved.house.pD < base.house.pD - 0.05, `${moved.house.pD} v ${base.house.pD}`);
  assert.equal(moved.nationalSwing.racesInforming, Object.keys(fin).length);
  const later = nationalForecast({ ...NAT, snapshot: snapOf(Object.fromEntries(Object.entries(fin).map(([k, o]) => [k, { ...o, receivedAt: "2026-11-05T00:00:00Z" }])), "f") }).national;
  assert.deepEqual(later.house, moved.house);
  const partial = Object.fromEntries(Object.entries(fin).map(([k, o]) => [k, { ...o, providerPctReporting: 60 }]));
  assert.equal(nationalForecast({ ...NAT, snapshot: snapOf(partial, "p") }).national.nationalSwing.racesInforming, 0);
});

test("[22] House popular vote: observed is reported House votes only; projected is modeled; the benchmark is labelled a poll", () => {
  const none = nationalForecast({ ...NAT, snapshot: snapOf({}) }).national.houseVote;
  assert.equal(none.observed.total, 0); assert.equal(none.observed.marginPp, null, "no votes is not a margin of zero");
  assert.equal(none.observed.racesIncluded, 435);
  assert.match(none.benchmark.label, /not counted votes/); assert.equal(none.benchmark.marginPp, pre.genericBallot);
  const h = race("house-PA-07"), s = race("sen-NE");
  const n = nationalForecast({ ...NAT, snapshot: snapOf({ [h.id]: obs(h, [["Bob Brooks", "Democratic", 1_000], ["Ryan Mackenzie", "Republican", 900], ["Ind", "Independent", 100]], 10), [s.id]: obs(s, [["Pete Ricketts", "Republican", 50_000], ["Dan Osborn", "Independent", 40_000]], 10) }) }).national.houseVote;
  assert.deepEqual([n.observed.D, n.observed.R, n.observed.other, n.observed.racesWithVotes], [1_000, 900, 100, 1], "the Senate race is not in the House vote");
  assert.ok(Math.abs((n.observed.marginPp as number) - -5) < 1e-9); assert.ok(Math.abs((n.observed.twoPartyMarginPp as number) - (-100 * 100) / 1900) < 1e-9);
  assert.ok(n.projected.D.mean > 1_000_000, "projected includes the forecast where nothing is counted");
  assert.ok(Math.abs(n.projected.shareD.mean + n.projected.shareR.mean + (100 * n.projected.other.mean) / n.projected.total.mean - 100) < 0.5, "shares add up");
  assert.ok(n.projected.outstanding.mean > 0 && n.projected.outstanding.mean < n.projected.total.mean, "outstanding House votes are estimated");
});

test("snapshots: unknown counts stay null, provider ids pass through, test returns are blanked, unmatched races are counted", () => {
  const raws: CivicRawRace[] = [
    { id: 7, type: "US Senate", province: "NE", percent_reporting: 40, candidates: [{ name: "Pete Ricketts", party: "Republican", votes: 100, id: 11 }, { name: "Dan Osborn", party: "Independent", votes: null }] },
    { id: 8, type: "US Senate", province: "ZZ", percent_reporting: 0, candidates: [] },
  ];
  const s = snapshotFromCivic(ix, raws, { receivedAt: "2026-11-04T01:00:00Z", mode: "LIVE", source: "test" });
  const ne = s.races["sen-NE"]; assert.ok(ne); assert.equal(ne.candidates[0].candidateId, "up:11"); assert.equal(ne.candidates[1].votes, null);
  assert.equal(s.unmatchedProviderRaces, 1); assert.equal(s.provenance.synthetic, false); assert.equal(s.provenance.usesFutureObservation, false);
  const again = snapshotFromCivic(ix, raws, { receivedAt: "2026-11-04T05:00:00Z", mode: "LIVE", source: "test" });
  assert.equal(again.snapshotId, s.snapshotId, "the id is the content, not the read time");
  const b = blankTestCounts({ ...ne, test: true }); assert.ok(b.candidates.every((c) => c.votes === 0 && !c.providerWinner));
  const f = forecastRace(race("sen-NE"), ne, null, O); assert.ok(f.flags.includes("COUNT_UNKNOWN"));
});

test("the engine API is off unless the operator switches it on, and takes no simulated input", () => {
  assert.equal(engineApiEnabled({}), false); assert.equal(engineApiEnabled({ ONPOINT_ENGINE_API: "1" }), false); assert.equal(engineApiEnabled({ ONPOINT_ENGINE_API: "on" }), true);
  const src = fs.readFileSync(path.join(root, "app/api/results/forecast/route.ts"), "utf8");
  assert.match(src, /export async function GET\(req: Request\) \{\n  if \(!engineApiEnabled\(\)\) return NextResponse\.json\(.*\{ status: 404 \}\);/, "the gate is the first thing GET does");
  assert.doesNotMatch(src, /SIMULATED|HISTORICAL/, "LIVE civicAPI data only");
});
