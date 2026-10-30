// Aggregation of a synthetic replay run: per-cell metrics with race-clustered bootstrap intervals, paired model differences, calibration and numerical diagnostics.
import { CHECKPOINTS, clusterBootstrap, reliability, type Estimate } from "./lib";
import type { Row } from "./run_synthetic";

type Part = "TRAIN" | "HELD_OUT" | "ALL";
const r4 = (x: number | null) => (x === null ? null : Math.round(x * 1e4) / 1e4);
const est = (e: Estimate) => ({ n: e.n, races: e.clusters, mean: r4(e.mean), lo95: r4(e.lo), hi95: r4(e.hi) });

const metric: Record<string, (r: Row) => number | null> = {
  marginAbsErr: (r) => (r.marginMedian === null ? null : Math.abs(r.marginMedian - r.y)),
  marginBias: (r) => (r.marginMedian === null ? null : r.marginMedian - r.y),
  cover80: (r) => (r.q10 === null ? null : r.y >= r.q10! && r.y <= r.q90! ? 1 : 0),
  cover95: (r) => (r.q025 === null ? null : r.y >= r.q025! && r.y <= r.q975! ? 1 : 0),
  intervalWidth80: (r) => (r.q10 === null ? null : r.q90! - r.q10!),
  crps: (r) => r.crps,
  brier: (r) => r.brier,
  logLoss: (r) => r.logLoss,
  remainingRelErr: (r) => (r.remMedian === null ? null : (r.remMedian - r.remTrue) / r.totalTrue),
  remainingCover80: (r) => (r.remQ10 === null ? null : r.remTrue >= r.remQ10! && r.remTrue <= r.remQ90! ? 1 : 0),
  essFraction: (r) => r.ess,
  withheld: (r) => (r.quality === null && r.marginMedian === null ? null : r.withheld ? 1 : 0),
  milliseconds: (r) => r.ms,
};

const pick = (rows: Row[], model: string, part: Part, cp: string, order: string) =>
  rows.filter((r) => r.model === model && (part === "ALL" || r.partition === part) && (cp === "ALL" || r.checkpoint === cp) && (order === "ALL" || r.order === order));

export function summarize(rows: Row[], seed: number) {
  const models = [...new Set(rows.map((r) => r.model))];
  const cells: { model: string; partition: Part; checkpoint: string; order: string; n: number; metrics: Record<string, ReturnType<typeof est>> }[] = [];
  for (const model of models) for (const part of ["TRAIN", "HELD_OUT", "ALL"] as Part[]) for (const cp of [...CHECKPOINTS, "ALL"]) for (const order of ["NEUTRAL", "EARLY_A", "EARLY_B", "ALL"]) {
    const sel = pick(rows, model, part, cp, order);
    if (!sel.length) continue;
    const m: Record<string, ReturnType<typeof est>> = {};
    for (const [name, f] of Object.entries(metric)) {
      const vals = sel.flatMap((r) => { const v = f(r); return v === null || !Number.isFinite(v) ? [] : [{ cluster: r.race, value: v }]; });
      if (vals.length) m[name] = est(clusterBootstrap(vals, 400, seed));
    }
    cells.push({ model, partition: part, checkpoint: cp, order, n: sel.length, metrics: m });
  }
  return cells;
}

/** Paired differences in a score between two models on identical snapshots (race-clustered). Negative = the first model is better for crps, brier, marginAbsErr. */
export function pairedDifference(rows: Row[], a: string, b: string, name: "crps" | "brier" | "marginAbsErr", part: Part, cp: string, order: string, seed: number) {
  const key = (r: Row) => `${r.race}|${r.rep}|${r.order}|${r.checkpoint}`;
  const base = new Map(pick(rows, b, part, cp, order).map((r) => [key(r), r]));
  const diffs: { cluster: string; value: number }[] = [];
  for (const r of pick(rows, a, part, cp, order)) {
    const o = base.get(key(r));
    const x = metric[name](r), y = o ? metric[name](o) : null;
    if (x !== null && y !== null) diffs.push({ cluster: r.race, value: x - y });
  }
  return est(clusterBootstrap(diffs, 400, seed));
}

export function ablationComparisons(rows: Row[], seed: number) {
  const pairs: [string, string][] = [["C", "B"], ["D", "C"], ["E", "D"], ["D", "A_PUBLISHED"], ["D", "REPORTED_LEAD"], ["D", "UNIFORM_SWING"], ["B", "A_PUBLISHED"], ["D", "D_V1"], ["D_RHO50", "D"], ["D_GAP50", "D"], ["D_GAP200", "D"]];
  const out: { a: string; b: string; partition: Part; checkpoint: string; order: string; metric: string; diff: ReturnType<typeof est>; verdict: string }[] = [];
  for (const [a, b] of pairs) for (const part of ["TRAIN", "HELD_OUT"] as Part[]) for (const cp of [...CHECKPOINTS, "ALL"]) for (const order of ["ALL", "NEUTRAL", "EARLY_A", "EARLY_B"]) for (const name of ["crps", "marginAbsErr"] as const) {
    if (cp !== "ALL" && order !== "ALL") continue;
    const diff = pairedDifference(rows, a, b, name, part, cp, order, seed);
    if (!diff.n) continue;
    const verdict = diff.lo95 === null || diff.hi95 === null ? "NO_INTERVAL" : diff.hi95 < 0 ? `${a}_BETTER` : diff.lo95 > 0 ? `${a}_WORSE` : "NO_CLEAR_DIFFERENCE";
    out.push({ a, b, partition: part, checkpoint: cp, order, metric: name, diff, verdict });
  }
  return out;
}

export function calibration(rows: Row[], model: string, part: Part) {
  const sel = pick(rows, model, part, "ALL", "ALL").filter((r) => r.pB !== null && r.checkpoint !== "NONE" && r.checkpoint !== "COMPLETE");
  return { model, partition: part, n: sel.length, reliability: reliability(sel.map((r) => ({ p: r.pB!, hit: r.yB }))).map((b) => ({ ...b, meanP: r4(b.meanP), freq: r4(b.freq) })) };
}

export function numerical(rows: Row[]) {
  const sims = rows.filter((r) => r.ms !== null);
  const finite = (v: number | null) => v === null || Number.isFinite(v);
  const bad = rows.filter((r) => ![r.marginMedian, r.pB, r.crps, r.remMedian].every(finite));
  const flagCounts: Record<string, number> = {};
  for (const r of sims) for (const f of r.flags) flagCounts[f] = (flagCounts[f] ?? 0) + 1;
  return {
    simulations: sims.length, nonFiniteRows: bad.length,
    unsupportedOrFailed: sims.filter((r) => r.marginMedian === null).length,
    lowEss: sims.filter((r) => r.ess !== null && r.ess < 0.1).length,
    minEss: r4(Math.min(...sims.filter((r) => r.ess !== null).map((r) => r.ess!))),
    qualityCounts: sims.reduce<Record<string, number>>((a, r) => ((a[r.quality ?? "NONE"] = (a[r.quality ?? "NONE"] ?? 0) + 1), a), {}),
    flagCounts,
  };
}
