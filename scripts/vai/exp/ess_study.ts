// B2 study 2: effective sample size and tail accuracy of the statewide-shift treatment. SYNTHETIC: truth is drawn from the same family the
// sampler assumes, so this isolates the sampler (weights versus analytic marginalisation), not the model's fit to real counts.
//
//   run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs scripts/vai/exp/ess_study.ts [--truths 24] [--seeds 4] [--draws 300] [--out file]
//
// The published statewide shift distribution (in log-odds) is replaced by one of five shapes. For each shape and each count stage, truths
// are drawn from that same shape (and, for TAIL_97, fixed at its 97.5th percentile), the race is simulated under WEIGHTED and MARGINALISED
// shift handling, and the final margin is scored against the truth.
import path from "node:path";
import { HYPER_V2 } from "../../../app/results/_vai/hyper";
import { Rng, seedFrom } from "../../../app/results/_vai/rng";
import { simulateRace } from "../../../app/results/_vai/simulate";
import type { RaceRule } from "../../../app/results/_vai/types";
import { anchoredRaces, ELECTION_NIGHT } from "../../../tests/vai/_support";
import { countedAtTau, drawTruth, pickRaces, tauForShare } from "../backtest/run_synthetic";
import { CHECKPOINT_SHARE, crps, quantileOf, type Checkpoint } from "../backtest/lib";
import { arg, isMain, REPO_ROOT, sha256, stableJson, writeOutput } from "../io";

export type Shape = "NARROW" | "WIDE" | "BIMODAL" | "SKEWED" | "TAIL_97";
export const SHAPES: Shape[] = ["NARROW", "WIDE", "BIMODAL", "SKEWED", "TAIL_97"];
const STAGES: Checkpoint[] = ["Q1", "MID", "LATE"];

/** J draws of the statewide shift (log-odds) for a shape. */
export function shapeDraws(shape: Shape, J: number, rng: Rng): Float64Array {
  const out = new Float64Array(J);
  for (let i = 0; i < J; i++) {
    const z = rng.normal();
    switch (shape) {
      case "NARROW": case "TAIL_97": out[i] = 0.04 * z; break;
      case "WIDE": out[i] = 0.4 * z; break;
      case "BIMODAL": out[i] = (rng.uniform() < 0.5 ? -0.3 : 0.3) + 0.05 * z; break;
      case "SKEWED": out[i] = -0.1 + 0.25 * (Math.exp(0.7 * z) - 1); break;
    }
  }
  return out;
}

const plurality = (id: string, kind: string, state: string): RaceRule => ({ raceId: id, kind, state, office: "", rule: "PLURALITY", threshold: null, denominator: null, ballotFloor: null, support: "SUPPORTED", outputs: ["P_WIN"], isDefault: false } as unknown as RaceRule);

const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / Math.max(1, x.length);
const sd = (x: number[]) => { const m = mean(x); return Math.sqrt(mean(x.map((v) => (v - m) ** 2))); };

export function runEssStudy(opts: { truths: number; seeds: number; draws: number; seed: number }) {
  const found = anchoredRaces();
  if (!found) throw new Error("no committed prior whose inputs match the files on disk");
  const race = pickRaces(found.races, 3)[0];
  const keys = Object.keys(race.rows).sort();
  const region = (k: string) => `r${keys.indexOf(k) % 4}`;
  const t0 = process.hrtime.bigint();
  const cells: unknown[] = [];
  for (const shape of SHAPES) {
    const prior = shapeDraws(shape, opts.draws, new Rng(seedFrom(opts.seed, `shape|${shape}`)));
    const sorted = [...prior].sort((a, b) => a - b);
    const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
    for (const stage of STAGES) for (const mode of ["WEIGHTED", "MARGINALISED"] as const) {
      const ess: number[] = [], in50: number[] = [], in80: number[] = [], in95: number[] = [], crpsv: number[] = [], err: number[] = [], modeUsed: Record<string, number> = {};
      const seedSpread: number[] = [];
      for (let t = 0; t < opts.truths; t++) {
        const delta = shape === "TAIL_97" ? q(0.975) : prior[Math.floor(new Rng(seedFrom(opts.seed, `truth|${shape}|${t}`)).uniform() * prior.length)];
        const truth = drawTruth(race, delta, t, "NEUTRAL", opts.seed);
        const counted = countedAtTau(truth, tauForShare(truth, CHECKPOINT_SHARE[stage]));
        const medians: number[] = [];
        for (let s = 0; s < opts.seeds; s++) {
          const out = simulateRace({
            raceId: truth.raceId, asOf: "2026-11-04T06:00:00Z", rule: plurality(race.race.raceId, race.race.kind, race.race.state), priorId: found.priorId, prior: race.race, rows: race.rows, counted, region,
            profile: { category: null, unresolved: false, countSpeed: null, receiptClass: null }, receipt: ELECTION_NIGHT, stateShift: { kind: "DRAWS", values: prior }, hyper: HYPER_V2, shiftMode: mode,
            seed: seedFrom(opts.seed, `${truth.raceId}|${t}|${stage}|${mode}|${s}`), draws: opts.draws, provenance: {},
          });
          const j = out.joint;
          if (!j) continue;
          const m = quantileOf(j.margin, 0.5);
          medians.push(m);
          if (s === 0) {
            ess.push(out.record.diagnostics.essFraction ?? NaN);
            const y = truth.finalMargin;
            in50.push(y >= quantileOf(j.margin, 0.25) && y <= quantileOf(j.margin, 0.75) ? 1 : 0);
            in80.push(y >= quantileOf(j.margin, 0.1) && y <= quantileOf(j.margin, 0.9) ? 1 : 0);
            in95.push(y >= quantileOf(j.margin, 0.025) && y <= quantileOf(j.margin, 0.975) ? 1 : 0);
            crpsv.push(crps(j.margin, y)); err.push(m - y);
            const k = out.preference?.shiftMode ?? "NONE"; modeUsed[k] = (modeUsed[k] ?? 0) + 1;
          }
        }
        if (medians.length > 1) seedSpread.push(sd(medians));
      }
      const r3 = (x: number) => Math.round(x * 1e3) / 1e3;
      cells.push({ shape, stage, mode, truths: in80.length, essFractionMean: r3(mean(ess.filter(Number.isFinite))), essFractionMin: r3(Math.min(...ess.filter(Number.isFinite))), cover50: r3(mean(in50)), cover80: r3(mean(in80)), cover95: r3(mean(in95)), crps: r3(mean(crpsv)), marginBias: r3(mean(err)), medianSeedSd: r3(mean(seedSpread)), modeUsed });
    }
  }
  return { cells, race: race.race.raceId, wallSeconds: Number(process.hrtime.bigint() - t0) / 1e9 };
}

if (isMain(import.meta.url)) {
  const truths = Number(arg("truths") ?? 24), seeds = Number(arg("seeds") ?? 4), draws = Number(arg("draws") ?? 300), seed = Number(arg("seed") ?? 20261030);
  const res = runEssStudy({ truths, seeds, draws, seed });
  const out = { schema: "vai-ess-study/1", class: "SYNTHETIC", note: "Truth shares the sampler's family. Coverage here shows the sampler is internally consistent, not that VAI is calibrated on real counts.", truths, seeds, draws, seed, race: res.race, wallSeconds: Math.round(res.wallSeconds), hyperId: HYPER_V2.hyperId, cells: res.cells };
  const file = path.resolve(arg("out") ?? path.join(REPO_ROOT, "data/vai/experiments/ess_study.json"));
  writeOutput(file, stableJson(out));
  console.log(`${path.relative(REPO_ROOT, file)} ${sha256(stableJson(out)).slice(0, 12)} ${Math.round(res.wallSeconds)}s`);
}
