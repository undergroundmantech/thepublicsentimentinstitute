// T6 preference: how the votes still to come split, under synthetic reporting sequences and the real zero-reporting anchor.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { estimateInventory } from "../../app/results/_vai/inventory";
import { baselineLogRatio, profileFromJurisdiction, runPreference, scenariosFor, softmaxShares, stageOf, type PrefUnit, type Scenario, type StateShift } from "../../app/results/_vai/preference";
import { aggregateMargin, TOLERANCE, type CountyRows } from "../../app/results/_vai/prior";
import { normalQuantile } from "../../app/results/_vai/normal";
import { REPO_ROOT } from "../../scripts/vai/io";
import { anchoredRaces, anchoredSetup, ELECTION_NIGHT, flat, HYPER_V1, mean, publishedOf, sd, simulate, TOY, width, withHyper, type RaceSetup } from "./_support";

const LEDGER_AB: Scenario[] = [{ id: "LEDGER", weight: 1, column: "AB" }];
const GAUSS = (sdv = 0.08, m = 0): StateShift => ({ kind: "GAUSSIAN", mean: m, sd: sdv });

/** A synthetic 40-county race, Democratic slot a, Republican slot b, leaning from 30% to 70% B. */
const synth = (n = 40): CountyRows => {
  const rows: CountyRows = {};
  for (let i = 0; i < n; i++) {
    const t = 20000 + 1500 * (i % 7), s = 0.3 + (0.4 * i) / (n - 1);
    rows[`c${String(i).padStart(2, "0")}`] = [Math.round(t * (1 - s)), Math.round(t * s), 0, t];
  }
  return rows;
};

/** Counted votes: every county has counted `f` of its expected total, at its baseline log-ratio plus `tilt`. */
const countedAt = (rows: CountyRows, f: number, tilt: number): Record<string, [number, number, number]> => {
  const out: Record<string, [number, number, number]> = {};
  for (const [k, [a, b, , t]] of Object.entries(rows)) {
    const s = 1 / (1 + Math.exp(-(Math.log(b / a) + tilt)));
    out[k] = [Math.round(f * t * (1 - s)), Math.round(f * t * s), 0];
  }
  return out;
};

const setup = (rows: CountyRows, over: Partial<RaceSetup> = {}): RaceSetup => ({ raceId: "synthetic", rows, hyper: HYPER_V1, J: 4000, seed: 3, shift: GAUSS(), scenarios: LEDGER_AB, ...over });

// ---- parity with the Python reference ------------------------------------------------------------------------------

test("toy parity: the three-county example matches the exact-posterior reference of scripts/vai/toy_example.py", () => {
  // Reference: the toy's sampler weighted by its own marginal likelihood p(y | π), 40 000 draws, numpy 2.5.4
  // (margin mean 4.408, sd 3.694, P(D) 0.882, remaining in county A 307 675, ESS 0.991). The toy script itself omits that weight.
  const hyper = flat({ preference: { sigmaGap: { FIRST: { AB: 0.3, C: 0.3, D: 0.3 }, MIXED: { AB: 0.3, C: 0.3, D: 0.3 }, TAIL: { AB: 0.3, C: 0.3, D: 0.3 } } } });
  const rows: CountyRows = { A: TOY.expected.A, B: TOY.expected.B, C: TOY.expected.C };
  const s = simulate(setup(rows, { raceId: "toy", J: 20000, seed: 3, hyper, counted: { A: [64000, 136000, 0] } }));
  const remA = new Float64Array(20000);
  for (let j = 0; j < 20000; j++) remA[j] = s.inventory.total[0][j] - s.inventory.reported[0];
  assert.ok(Math.abs(mean(s.margin) - 4.408) < 0.12, `margin mean ${mean(s.margin)}`);
  assert.ok(Math.abs(sd(s.margin) - 3.694) < 0.12, `margin sd ${sd(s.margin)}`);
  assert.ok(Math.abs(s.pB - 0.882) < 0.012, `P ${s.pB}`);
  assert.ok(s.result.essFraction > 0.95 && s.result.essFraction < 1, `ess ${s.result.essFraction}`);
  assert.equal(s.result.stage, "FIRST");
  assert.equal(s.result.reportingUnits, 1);
});

// ---- the zero-reporting anchor on real races ---------------------------------------------------------------------

test("nothing counted: every anchored race reproduces its published mean and P(R) through inventory and preference", (t) => {
  const a = anchoredRaces();
  if (!a) { t.skip("the forecast inputs have moved since the last prior; run `npm run vai:prior`"); return; }
  const J = 12000;
  let worstM = 0, worstP = 0, worstId = "";
  const failures: string[] = [];
  for (const r of a.races) {
    const s = simulate(anchoredSetup(r, J, 11));
    const pub = publishedOf(r.race);
    const gm = mean(s.margin) - pub.margin, gp = s.pB - pub.probB;
    // P(R) is a count of draws, so it carries Monte Carlo error that the stratified Phase A draws did not.
    const pTol = TOLERANCE.prob + 3.5 * Math.sqrt(0.25 / J);
    if (Math.abs(gm) > worstM) { worstM = Math.abs(gm); worstId = r.race.raceId; }
    worstP = Math.max(worstP, Math.abs(gp));
    if (Math.abs(gm) > TOLERANCE.margin || Math.abs(gp) > pTol) failures.push(`${r.race.raceId} mean ${gm.toFixed(3)} P ${gp.toFixed(4)}`);
    assert.equal(s.result.reportingUnits, 0, r.race.raceId);
    assert.deepEqual(s.result.flags, [], r.race.raceId);
  }
  console.log(`# ${a.races.length} anchored races, J=${J}: worst |mean gap| ${worstM.toFixed(4)} (${worstId}), worst |P gap| ${worstP.toFixed(4)}, prior ${a.priorId}`);
  assert.deepEqual(failures, []);
});

// ---- reproducibility -----------------------------------------------------------------------------------------------

test("reproducible: the same seed gives byte-identical draws; another seed does not", () => {
  const rows = synth(), counted = countedAt(rows, 0.4, 0.1);
  const a = simulate(setup(rows, { counted })), b = simulate(setup(rows, { counted })), c = simulate(setup(rows, { counted, seed: 4 }));
  assert.deepEqual(a.margin, b.margin);
  assert.deepEqual(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.result, b.result);
  assert.notDeepEqual(a.margin, c.margin);
});

// ---- no deterministic partisan adjustment from the count order ------------------------------------------------------

test("count order widens or narrows uncertainty and never shifts the mean: scenarios differ in spread, not in centre", () => {
  const rows: CountyRows = { A: TOY.expected.A, B: TOY.expected.B, C: TOY.expected.C };
  const counted: Record<string, [number, number, number]> = { A: [Math.round(200000 * 0.4), Math.round(200000 * 0.6), 0] };
  const one = (column: "AB" | "C" | "D") => simulate(setup(rows, { raceId: "toy", J: 20000, counted, scenarios: [{ id: "LEDGER", weight: 1, column }] }));
  const ab = one("AB"), c = one("C"), d = one("D");
  assert.equal(ab.result.stage, "FIRST");
  assert.ok(Math.abs(mean(ab.margin) - mean(c.margin)) < 0.15 + 0.0, `${mean(ab.margin)} vs ${mean(c.margin)}`);
  assert.ok(Math.abs(mean(ab.margin) - mean(d.margin)) < 0.15);
  assert.ok(width(ab.margin) > width(d.margin) && width(d.margin) > width(c.margin), `widths ${width(ab.margin)} ${width(d.margin)} ${width(c.margin)}`);
  assert.equal(Object.keys(HYPER_V1.preference).filter((k) => /^mu/i.test(k)).length, 0, "there is no gap-mean hyperparameter in v1");
});

test("mirror symmetry: swapping the two sides negates the margin", () => {
  const rows: CountyRows = synth(12);
  const mirror: CountyRows = Object.fromEntries(Object.entries(rows).map(([k, [a, b, o, t]]) => [k, [b, a, o, t]]));
  const c1 = countedAt(rows, 0.5, 0.2);
  const c2 = Object.fromEntries(Object.entries(c1).map(([k, [a, b, o]]) => [k, [b, a, o]])) as Record<string, [number, number, number]>;
  const m1 = simulate(setup(rows, { counted: c1 })), m2 = simulate(setup(mirror, { counted: c2 }));
  assert.ok(Math.abs(mean(m1.margin) + mean(m2.margin)) < 0.05, `${mean(m1.margin)} ${mean(m2.margin)}`);
  assert.ok(Math.abs(sd(m1.margin) - sd(m2.margin)) < 0.05);
});

// ---- synthetic reporting sequences -----------------------------------------------------------------------------------

test("a reporting sequence: a lean seen in the count moves the final margin part of the way, and uncertainty falls", () => {
  const rows = synth();
  const keys = Object.keys(rows);
  const none = simulate(setup(rows));
  const naive = aggregateMargin(keys.map((k) => rows[k]), 0.15);
  const runs = [0.1, 0.3, 0.6, 0.85].map((f) => simulate(setup(rows, { J: 4000, counted: countedAt(rows, f, 0.15) })));
  const prior = mean(none.margin);
  for (const r of runs) {
    assert.ok(mean(r.margin) > prior + 0.05, "a pro-B count moves the projection toward B");
    assert.ok(mean(r.margin) < naive + 0.3, `not beyond the naive extrapolation: ${mean(r.margin)} vs ${naive}`);
  }
  const w = runs.map((r) => width(r.margin));
  for (let i = 1; i < w.length; i++) assert.ok(w[i] < w[i - 1] + 0.05, `interval narrows as more counts: ${w}`);
  assert.ok(w[0] < width(none.margin) + 0.05);
  const rem = runs.map((r) => mean(r.inventory.remainingTotal));
  for (let i = 1; i < rem.length; i++) assert.ok(rem[i] < rem[i - 1]);
  for (const r of runs) {
    const p = r.result.scenarios.reduce((s, x) => s + x.posterior, 0);
    assert.ok(Math.abs(p - 1) < 1e-9, "scenario posterior sums to one");
  }
});

test("a wider early-count gap absorbs more of the lean: the projection moves less", () => {
  const rows = synth(), counted = countedAt(rows, 0.3, 0.3);
  const gap = (g: number) => withHyper(HYPER_V1, { preference: { sigmaGap: { FIRST: { AB: g, C: g, D: g }, MIXED: { AB: g, C: g, D: g }, TAIL: { AB: g, C: g, D: g } } } });
  const m = [0.05, 0.3, 0.8].map((g) => mean(simulate(setup(rows, { counted, hyper: gap(g) })).margin));
  assert.ok(m[0] > m[1] && m[1] > m[2], `pull falls as σ_g grows: ${m}`);
});

test("stages come from reported votes over expected votes, never from precincts", () => {
  assert.equal(stageOf(0.1, HYPER_V1), "FIRST");
  assert.equal(stageOf(0.5, HYPER_V1), "MIXED");
  assert.equal(stageOf(0.9, HYPER_V1), "TAIL");
  const rows = synth();
  const r = (f: number) => simulate(setup(rows, { counted: countedAt(rows, f, 0) })).result;
  assert.deepEqual([r(0.1).stage, r(0.5).stage, r(0.9).stage], ["FIRST", "MIXED", "TAIL"]);
});

// ---- constraints and structure -------------------------------------------------------------------------------------

test("turnout and share constraints: remaining votes are non-negative, add to the inventory, and three candidates sum to one", () => {
  const rows = synth(10);
  const keys = Object.keys(rows);
  const counted = countedAt(rows, 0.5, 0.1);
  const units: PrefUnit[] = keys.map((k) => {
    const [, , , t] = rows[k];
    const eta = baselineLogRatio(rows[k], 0.5);
    return { id: k, region: "ALL", expected: t, eta0: [eta, eta - 1.5], votes: [counted[k][0], counted[k][1], Math.round(0.05 * (counted[k][0] + counted[k][1]))] };
  });
  const inventory = estimateInventory({ raceId: "k3", asOf: "2026-11-04T03:00:00Z", units: keys.map((k, c) => ({ id: k, expected: rows[k][3], reported: units[c].votes.reduce((s, x) => s + x, 0) })), receipt: ELECTION_NIGHT, hyper: HYPER_V1, seed: 2, draws: 1500 });
  let seen = 0;
  const result = runPreference({ raceId: "k3", units, inventory, stateShift: [GAUSS(), GAUSS(0.25)], scenarios: LEDGER_AB, hyper: HYPER_V1, seed: 2 }, (d) => {
    seen++;
    let r = 0;
    for (let c = 0; c < keys.length; c++) {
      assert.ok(d.remaining[c] >= 0 && Number.isFinite(d.remaining[c]));
      r += d.remaining[c];
      const sh = softmaxShares([d.q[0][c], d.q[1][c]]);
      assert.ok(sh.every((x) => x > 0 && x < 1) && Math.abs(sh[0] + sh[1] + sh[2] - 1) < 1e-12);
    }
    assert.ok(Math.abs(r - inventory.remainingTotal[d.inventoryDraw]) < 1e-6 * Math.max(1, r));
  });
  assert.equal(seen, 1500);
  assert.equal(result.candidates, 3);
});

test("a published shift that the count contradicts loses its weights and falls back to its own mean and spread", () => {
  const rows = synth(30), J = 2000;
  const values = Float64Array.from({ length: J }, (_, j) => 0.01 * normalQuantile((j + 0.5) / J));
  const s = simulate(setup(rows, { J, counted: countedAt(rows, 0.5, 1.2), shift: { kind: "DRAWS", values } }));
  assert.ok(s.result.flags.includes("STATE_SHIFT_DRAWS_REPLACED_BY_GAUSSIAN"), JSON.stringify(s.result.flags));
  assert.ok(mean(s.margin) > 0);
  const ok = simulate(setup(rows, { J, counted: countedAt(rows, 0.5, 0), shift: { kind: "DRAWS", values: Float64Array.from({ length: J }, (_, j) => 0.08 * normalQuantile((j + 0.5) / J)) } }));
  assert.deepEqual(ok.result.flags, []);
});

test("nothing counted leaves the scenario weights at their prior", () => {
  const rows = synth(12);
  const s = simulate(setup(rows, { scenarios: scenariosFor({ category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" }, HYPER_V1) }));
  for (const x of s.result.scenarios) assert.ok(Math.abs(x.posterior - x.prior) < 1e-9);
});

test("scenario weights: 0.60 / 0.25 / 0.15 by default, 0.45 for a ledger caveat, merged for category C, widest column without a ledger entry", () => {
  const prof = (category: "A" | "B" | "C" | "D" | null, unresolved = false) => ({ category, unresolved, countSpeed: 0, receiptClass: null });
  const w = (p: ReturnType<typeof prof>) => scenariosFor(p, HYPER_V1).map((s) => [s.id, s.column, Number(s.weight.toFixed(6))]);
  assert.deepEqual(w(prof("A")), [["LEDGER", "AB", 0.6], ["MIXED", "C", 0.25], ["VARYING", "D", 0.15]]);
  assert.deepEqual(w(prof("D")), [["LEDGER", "D", 0.6], ["MIXED", "C", 0.25], ["VARYING", "D", 0.15]]);
  assert.deepEqual(w(prof("A", true)), [["LEDGER", "AB", 0.45], ["MIXED", "C", 0.34375], ["VARYING", "D", 0.20625]]);
  assert.deepEqual(w(prof("C")), [["LEDGER", "C", 0.85], ["VARYING", "D", 0.15]]);
  assert.equal(scenariosFor(prof(null), HYPER_V1)[0].column, "MAX");
  for (const p of [prof("A"), prof("C"), prof(null, true)]) assert.ok(Math.abs(scenariosFor(p, HYPER_V1).reduce((s, x) => s + x.weight, 0) - 1) < 1e-12);
});

test("the count-order ledger maps to profiles: category, caveat, count speed and receipt class", () => {
  const file = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "data/vai/count_order_2026.json"), "utf8")) as { jurisdictions: { jurisdiction: { state: string } }[] };
  const by = (st: string) => profileFromJurisdiction(file.jurisdictions.find((j) => j.jurisdiction.state === st) as never);
  assert.deepEqual(by("GA"), { category: "A", unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" });
  assert.equal(by("AL").unresolved, true);
  assert.deepEqual(profileFromJurisdiction(null), { category: null, unresolved: false, countSpeed: null, receiptClass: null });
});
