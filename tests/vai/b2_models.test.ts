// B2 model changes: the shared selection gap, the marginalised shift, and the progress likelihood. Synthetic inputs, plus the committed prior for the shift-mode agreement.
import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateInventory, type InventoryUnit } from "../../app/results/_vai/inventory";
import { LOG_PROGRESS_V2, type ProgressModel } from "../../app/results/_vai/hyper";
import type { CountyRows } from "../../app/results/_vai/prior";
import type { Scenario } from "../../app/results/_vai/preference";
import { anchoredRaces, anchoredSetup, ELECTION_NIGHT, HYPER_V1, mean, quantile, sd, simulate, withHyper } from "./_support";

const LEDGER_C: Scenario[] = [{ id: "LEDGER", weight: 1, column: "C" }];
const synth = (n = 40): CountyRows => {
  const rows: CountyRows = {};
  for (let i = 0; i < n; i++) {
    const t = 20000 + 1500 * (i % 7), s = 0.3 + (0.4 * i) / (n - 1);
    rows[`c${String(i).padStart(2, "0")}`] = [Math.round(t * (1 - s)), Math.round(t * s), 0, t];
  }
  return rows;
};
const countedAt = (rows: CountyRows, f: number, tilt: number): Record<string, [number, number, number]> => {
  const out: Record<string, [number, number, number]> = {};
  for (const [k, [a, b, , t]] of Object.entries(rows)) {
    const s = 1 / (1 + Math.exp(-(Math.log(b / a) + tilt)));
    out[k] = [Math.round(f * t * (1 - s)), Math.round(f * t * s), 0];
  }
  return out;
};
const base = (rows: CountyRows, hyper = HYPER_V1, counted = countedAt(rows, 0.6, 0.15)) => ({ raceId: "synthetic", rows, hyper, J: 4000, seed: 5, shift: { kind: "GAUSSIAN" as const, mean: 0, sd: 0.08 }, scenarios: LEDGER_C, counted });

// ---- the shared selection gap (rhoGap) --------------------------------------------------------------------------------

test("rhoGap = 0 and an absent rhoGap are the same model, draw for draw", () => {
  const rows = synth();
  const a = simulate(base(rows)), b = simulate(base(rows, withHyper(HYPER_V1, { preference: { rhoGap: 0 } })));
  assert.deepEqual(a.margin, b.margin);
});

test("a gap shared by every county cannot be averaged away: with rhoGap high the same count leaves a wider margin", () => {
  const rows = synth();
  const sdFor = (rho: number) => sd(simulate(base(rows, withHyper(HYPER_V1, { preference: { rhoGap: rho } }))).margin);
  const [s0, s5, s9] = [0, 0.5, 0.9].map(sdFor);
  assert.ok(s5 > s0 && s9 > s5, `sd by rho: ${s0.toFixed(3)} ${s5.toFixed(3)} ${s9.toFixed(3)}`);
});

test("rhoGap moves spread, not the centre: the mean margin stays within Monte Carlo error", () => {
  const rows = synth();
  const m = (rho: number) => mean(simulate(base(rows, withHyper(HYPER_V1, { preference: { rhoGap: rho } }), countedAt(rows, 0.5, 0))).margin);
  assert.ok(Math.abs(m(0) - m(0.9)) < 0.25, `${m(0)} vs ${m(0.9)}`);
});

// ---- the marginalised shift ------------------------------------------------------------------------------------------

test("MARGINALISED and WEIGHTED agree on the margin's centre, and on P(B) within Monte Carlo error, where both are well conditioned", (t) => {
  const a = anchoredRaces();
  const r = a?.races.find((x) => x.race.liveUse === "ELIGIBLE" && Object.keys(x.rows).length >= 20);
  if (!a || !r) { t.skip("no anchored race on disk"); return; }
  const setup = anchoredSetup(r, 6000, 21);
  const counted: Record<string, [number, number, number]> = {};
  for (const [k, row] of Object.entries(r.rows)) counted[k] = [Math.round(row[0] * 0.3), Math.round(row[1] * 0.3), 0];
  const w = simulate({ ...setup, counted, shiftMode: "WEIGHTED" }), m = simulate({ ...setup, counted, shiftMode: "MARGINALISED" });
  assert.ok(Math.abs(mean(w.margin) - mean(m.margin)) < 0.4 * sd(m.margin) + 0.1, `${mean(w.margin)} vs ${mean(m.margin)}`);
  assert.ok(Math.abs(w.pB - m.pB) < 0.08, `${w.pB} vs ${m.pB}`);
  assert.ok(m.result.essFraction >= w.result.essFraction - 0.02, `marginalised ESS ${m.result.essFraction} < weighted ${w.result.essFraction}`);
});

// ---- the progress likelihood ------------------------------------------------------------------------------------------

const LOG: ProgressModel = LOG_PROGRESS_V2;
const POWER: ProgressModel = { model: "POWER_PROGRESS", components: [0.5, 1, 2, 4, 8, 16].map((alpha) => ({ alpha, weight: 1 / 6 })) };
const unitsAt = (n: number, share: number): InventoryUnit[] => Array.from({ length: n }, (_, c) => {
  const e = 8000 + 900 * (c % 9);
  return { id: `u${c}`, expected: e, reported: Math.round(share * e), region: `r${c % 4}` };
});
const inv = (units: InventoryUnit[], progress?: ProgressModel) => estimateInventory({ raceId: "t", asOf: "2026-11-04T05:00:00Z", units, receipt: ELECTION_NIGHT, statewideOfficial: null, hyper: progress ? withHyper(HYPER_V1, { inventory: { progress } }) : HYPER_V1, seed: 9, draws: 1500 });

test("every progress model keeps remaining >= 0 and total >= counted, from nothing counted to everything", () => {
  for (const progress of [undefined, POWER, LOG]) for (const share of [0, 0.3, 0.8, 0.97, 1, 1.15]) {
    const units = unitsAt(24, share), p = inv(units, progress);
    for (let j = 0; j < 1500; j++) assert.ok(p.remainingTotal[j] >= 0, `${progress?.model ?? "TOBIT"} share ${share}`);
    for (let c = 0; c < units.length; c++) for (let j = 0; j < 1500; j += 50) assert.ok(p.total[c][j] >= p.reported[c] - 1e-9);
  }
});

test("near completion the censored (Tobit) likelihood leaves far more votes outstanding than a progress likelihood does", () => {
  const units = unitsAt(40, 0.98);
  const truth = units.reduce((s, u) => s + u.expected * 0.02 / 0.98, 0);
  const rem = (p?: ProgressModel) => mean(inv(units, p).remainingTotal);
  const [tobit, log] = [rem(), rem(LOG)];
  assert.ok(Math.abs(log - truth) < Math.abs(tobit - truth), `truth ${truth.toFixed(0)}, tobit ${tobit.toFixed(0)}, log ${log.toFixed(0)}`);
});

// POWER_PROGRESS is deliberately not in this list: at 80% to 95% counted its median remainder rose in the B2 study (documented in the backtest report), one reason LOG is the v2 candidate.
test("more counted never means more outstanding under the Tobit and log-progress models", () => {
  for (const progress of [undefined, LOG]) {
    const r = [0.2, 0.5, 0.8, 0.95].map((s) => quantile(inv(unitsAt(30, s), progress).remainingTotal, 0.5));
    for (let i = 1; i < r.length; i++) assert.ok(r[i] < r[i - 1], `${progress?.model ?? "TOBIT"}: ${r}`);
  }
});
