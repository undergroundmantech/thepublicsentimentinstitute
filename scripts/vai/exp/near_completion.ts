// B2 study 1: near-completion bias of the inventory model. SYNTHETIC: every truth below is drawn from a generator written here, so this
// measures how each likelihood behaves when its assumptions hold and when they do not. It is not evidence about real counts.
//
//   run: node --import ./scripts/intelligence/ts-resolve.mjs scripts/vai/exp/near_completion.ts [--reps 120] [--out file]
//
// For each count-progress regime the generator draws unit totals T from the VAI turnout prior (optionally with a wider true spread),
// then counted votes N = f·T, f from the regime. Each method sees only (E, N), never T or f. It estimates the remaining vote R = ΣT − ΣN.
import path from "node:path";
import { HYPER_V1, withHyper, type VaiHyper } from "../../../app/results/_vai/hyper";
import { estimateInventory } from "../../../app/results/_vai/inventory";
import { Rng } from "../../../app/results/_vai/rng";
import { arg, isMain, REPO_ROOT, sha256, stableJson, writeOutput } from "../io";

export type Regime = "UNIFORM" | "LATE" | "EARLY" | "SYNC_STATEWIDE" | "NEAR_DONE" | "COMPLETE" | "UNIFORM_WIDE_TURNOUT" | "NEAR_DONE_HIGH_TURNOUT";

export const REGIMES: Regime[] = ["UNIFORM", "LATE", "EARLY", "SYNC_STATEWIDE", "NEAR_DONE", "COMPLETE", "UNIFORM_WIDE_TURNOUT", "NEAR_DONE_HIGH_TURNOUT"];

export interface Truth { ids: string[]; E: number[]; T: number[]; N: number[]; regions: string[] }

/** One synthetic race of `n` counties. `spread` scales the true turnout spread against the prior; `tilt` shifts the true statewide turnout. */
export function drawTruth(rng: Rng, regime: Regime, n = 60): Truth {
  const h = HYPER_V1.inventory;
  const spread = regime === "UNIFORM_WIDE_TURNOUT" ? 1.8 : 1;
  const tilt = regime === "NEAR_DONE_HIGH_TURNOUT" ? 0.15 : 0;
  const ts = h.sigmaTauState * spread * rng.normal() + tilt;
  const G = 4;
  const tg = Array.from({ length: G }, () => h.sigmaTauRegion * spread * rng.normal());
  const level = 0.05 + 0.95 * rng.uniform();
  const nearDone = 0.9 + 0.1 * rng.uniform();
  const E: number[] = [], T: number[] = [], N: number[] = [], ids: string[] = [], regions: string[] = [];
  for (let c = 0; c < n; c++) {
    const e = Math.round(2000 * Math.exp(2.2 * rng.normal()));
    const g = c % G;
    const t = Math.max(1, Math.round(e * Math.exp(ts + tg[g] + h.sigmaUnit * spread * rng.normal())));
    let f: number;
    switch (regime) {
      case "UNIFORM": case "UNIFORM_WIDE_TURNOUT": f = rng.uniform(); break;
      case "LATE": f = Math.pow(rng.uniform(), 1 / 8); break;
      case "EARLY": f = 1 - Math.pow(rng.uniform(), 1 / 3); break;
      case "SYNC_STATEWIDE": f = Math.min(1, Math.max(0.01, level + 0.1 * rng.normal())); break;
      case "NEAR_DONE": case "NEAR_DONE_HIGH_TURNOUT": f = Math.min(1, nearDone + 0.04 * rng.normal()); break;
      default: f = 1;
    }
    E.push(e); T.push(t); N.push(Math.min(t, Math.round(f * t))); ids.push(`u${c}`); regions.push(`r${g}`);
  }
  return { ids, E, T, N, regions };
}

export interface MethodSpec { id: string; hyper: VaiHyper }

const GRID = [0.5, 1, 2, 4, 8, 16, 32];
const LOG_M = [0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.5], LOG_S = [0.03, 0.1, 0.3, 0.8];
const powerComps = (alphas: number[]) => alphas.map((alpha) => ({ alpha, weight: 1 / alphas.length }));
const logComps = LOG_M.flatMap((m) => LOG_S.map((s) => ({ m, s, weight: 1 / (LOG_M.length * LOG_S.length) })));
export const METHODS: MethodSpec[] = [
  { id: "B1_TOBIT", hyper: HYPER_V1 },
  { id: "POWER_UNIFORM", hyper: withHyper(HYPER_V1, { inventory: { progress: { model: "POWER_PROGRESS", components: powerComps([1]) } } }) },
  { id: "POWER_LEARNED", hyper: withHyper(HYPER_V1, { inventory: { progress: { model: "POWER_PROGRESS", components: powerComps(GRID) } } }) },
  { id: "LOG_LEARNED", hyper: withHyper(HYPER_V1, { inventory: { progress: { model: "LOG_PROGRESS", components: logComps } } }) },
];

export interface Cell { regime: Regime; method: string; band: string; n: number; relErrMedian: number; relErrIqr: [number, number]; coverage80: number; coverage50: number; widthShare: number }

const bandOf = (share: number) => (share < 0.25 ? "<25%" : share < 0.6 ? "25-60%" : share < 0.9 ? "60-90%" : share < 0.97 ? "90-97%" : "97%+");
const BANDS = ["<25%", "25-60%", "60-90%", "90-97%", "97%+"];
const med = (x: number[]) => { const s = [...x].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const qq = (x: number[], p: number) => { const s = [...x].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };

export function runStudy(reps: number, J = 400, seed = 20261030) {
  const rows: Record<string, { err: number[]; in80: number[]; in50: number[]; wid: number[] }> = {};
  const alphaPost: Record<string, number[]> = {};
  const t0 = process.hrtime.bigint();
  for (const regime of REGIMES) {
    for (let r = 0; r < reps; r++) {
      const rng = Rng.fork(seed, `${regime}|${r}`);
      const truth = drawTruth(rng, regime);
      const expectedTotal = truth.E.reduce((a, b) => a + b, 0);
      const sumN = truth.N.reduce((a, b) => a + b, 0);
      const sumT = truth.T.reduce((a, b) => a + b, 0);
      const R = sumT - sumN;
      const band = bandOf(sumN / expectedTotal);
      for (const m of METHODS) {
        const inv = estimateInventory({
          raceId: `${regime}-${r}`, asOf: "2026-11-03T03:00:00Z",
          units: truth.ids.map((id, c) => ({ id, expected: truth.E[c], reported: truth.N[c], region: truth.regions[c] })),
          receipt: { class: "ELECTION_DAY_OR_EARLIER", deadlineUtc: null, countSpeed: 0 }, hyper: m.hyper, seed: seed + r, draws: J,
        });
        const rem = Float64Array.from(inv.remainingTotal).sort();
        const at = (p: number) => rem[Math.min(J - 1, Math.floor(p * J))];
        const key = `${regime}|${m.id}|${band}`;
        const cell = (rows[key] ??= { err: [], in80: [], in50: [], wid: [] });
        cell.err.push((at(0.5) - R) / sumT);
        cell.in80.push(R >= at(0.1) && R <= at(0.9) ? 1 : 0);
        cell.in50.push(R >= at(0.25) && R <= at(0.75) ? 1 : 0);
        cell.wid.push((at(0.9) - at(0.1)) / sumT);
        if (m.id === "LOG_LEARNED") (alphaPost[`${regime}|${band}`] ??= inv.diagnostics.progress.posterior.map(() => 0)).forEach((_, k, a) => { a[k] += inv.diagnostics.progress.posterior[k]; });
      }
    }
  }
  const cells: Cell[] = [];
  for (const regime of REGIMES) for (const m of METHODS) for (const band of BANDS) {
    const c = rows[`${regime}|${m.id}|${band}`];
    if (!c || c.err.length < 5) continue;
    cells.push({ regime, method: m.id, band, n: c.err.length, relErrMedian: med(c.err), relErrIqr: [qq(c.err, 0.25), qq(c.err, 0.75)], coverage80: c.in80.reduce((a, b) => a + b, 0) / c.in80.length, coverage50: c.in50.reduce((a, b) => a + b, 0) / c.in50.length, widthShare: med(c.wid) });
  }
  return { cells, alphaPost, seconds: Number(process.hrtime.bigint() - t0) / 1e9 };
}

if (isMain(import.meta.url)) {
  const reps = Number(arg("reps") ?? 120);
  const study = runStudy(reps);
  const out = path.resolve(arg("out") ?? path.join(REPO_ROOT, "data/vai/experiments/near_completion_study.json"));
  const body = {
    banner: "SYNTHETIC - not a backtest. Truth is drawn from generators in scripts/vai/exp/near_completion.ts.",
    reps, draws: 400, nUnits: 60, seed: 20261030, powerGrid: GRID, logGrid: { m: LOG_M, s: LOG_S }, methods: METHODS.map((m) => m.id), regimes: REGIMES,
    metric: "relErr = (median estimated remaining - true remaining) / true final total; coverage = share of races whose true remaining sits inside the interval",
    cells: study.cells,
    alphaPosteriorMean: Object.fromEntries(Object.entries(study.alphaPost).map(([k, v]) => [k, v.map((x) => +(x / reps).toFixed(3))])),
  };
  const text = stableJson(body, ["cells"]);
  writeOutput(out, text);
  console.log(`${path.relative(REPO_ROOT, out)} sha256 ${sha256(text).slice(0, 12)} in ${study.seconds}s`);
  const show = study.cells.filter((c) => c.band === "90-97%" || c.band === "97%+" || c.band === "60-90%");
  for (const c of show) console.log(c.regime.padEnd(24), c.method.padEnd(17), c.band.padEnd(7), `n=${String(c.n).padStart(3)}`, `err ${(c.relErrMedian * 100).toFixed(1).padStart(6)}%`, `cov80 ${c.coverage80.toFixed(2)}`, `w ${(c.widthShare * 100).toFixed(1)}%`);
}
