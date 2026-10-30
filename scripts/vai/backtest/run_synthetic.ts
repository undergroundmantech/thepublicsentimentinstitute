// T8: synthetic replay of the VAI shadow model. EVERY snapshot and every truth here is SYNTHETIC.
//
// What it is: a controlled test of the implementation. Truth is drawn from a generator written in this file (a draw from the frozen
// published distribution of a real 2026 race, county turnout and preference noise, and a count order), snapshots are cut from that truth at
// fixed shares of the final vote, and the model sees only the snapshot. It checks that the pieces work together and shows how each ablation
// behaves when the count order is neutral and when it is not.
//
// What it is not: historical validation. The generator shares the model's functional family, so calibration here is flattering by
// construction; a result in this file says nothing about how VAI performs on a real count. No real point-in-time series with a prior and a
// final result was available (docs/VAI_V1_BACKTEST_REPORT.md), so no real backtest is run and none is claimed.
//
//   run: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/intelligence/ts-resolve.mjs scripts/vai/backtest/run_synthetic.ts [--races 10] [--reps 2] [--draws 300] [--out data/vai/backtest/synthetic-<id>]
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HYPER_V1, HYPER_V2, withHyper, type VaiHyper } from "../../../app/results/_vai/hyper";
import { baselineLogRatio, cleanRow, profileFromJurisdiction, anchoredStateShifts, type CountOrderProfile } from "../../../app/results/_vai/preference";
import { Rng, seedFrom } from "../../../app/results/_vai/rng";
import { simulateRace } from "../../../app/results/_vai/simulate";
import type { RaceRule } from "../../../app/results/_vai/types";
import { anchoredRaces, ELECTION_NIGHT, type AnchoredRace } from "../../../tests/vai/_support";
import { arg, isMain, REPO_ROOT, sha256, stableJson, writeOutput } from "../io";
import { assertNoFuture, brier, CHECKPOINT_SHARE, CHECKPOINTS, checkTimestampIntegrity, crps, logLoss, quantileOf, ReplayStore, Scorer, type Checkpoint, type Snapshot } from "./lib";

export const RUN_SCHEMA = "vai-backtest-synthetic/1";
export type OrderKind = "NEUTRAL" | "EARLY_A" | "EARLY_B";
export const ORDERS: OrderKind[] = ["NEUTRAL", "EARLY_A", "EARLY_B"];
/** Log-odds shift of the first batch's side-B share against the county's own final share, with the later batch compensating. Informed in magnitude by the observed PA 2024 early-mail shift; not fitted. */
const EARLY_GAP = 0.6;
const FIRST_BATCH = 0.4;
const T0 = Date.parse("2026-11-04T01:00:00Z");
const HOURS = 12;

const logistic = (x: number) => 1 / (1 + Math.exp(-x));
const logit = (p: number) => Math.log(p / (1 - p));
const REGIONS = 4;

export interface CountyTruth { id: string; E: number; T: number; a: number; b: number; o: number; s1: number; s2: number; other: number; start: number; dur: number }
export interface SyntheticRace { raceId: string; state: string; rep: number; order: OrderKind; counties: CountyTruth[]; finalMargin: number; finalTotal: number }

/** Draws one synthetic truth. `delta` is the statewide shift (a draw from the race's published distribution). */
export function drawTruth(r: AnchoredRace, delta: number, rep: number, order: OrderKind, seed: number): SyntheticRace {
  // the order is not in the seed: the three orders of one rep share every county's final result and differ only in batch timing
  const rng = new Rng(seedFrom(seed, `${r.race.raceId}|${rep}`));
  const h = HYPER_V1;
  const keys = Object.keys(r.rows).sort();
  const tauS = h.inventory.sigmaTauState * rng.normal();
  const tauG = Array.from({ length: REGIONS }, () => h.inventory.sigmaTauRegion * rng.normal());
  const eta0 = keys.map((k) => baselineLogRatio(r.rows[k], h.preference.pseudoCount));
  const E = keys.map((k) => cleanRow(r.rows[k]).row[3]);
  let m = 0, tw = 0;
  keys.forEach((_, c) => { m += E[c] * eta0[c]; tw += E[c]; });
  m /= tw;
  let v = 0;
  keys.forEach((_, c) => { v += E[c] * (eta0[c] - m) ** 2; });
  const sdEta = Math.sqrt(v / tw) || 1;
  const gamma = h.preference.sigmaGamma * rng.normal();
  const regional = Array.from({ length: REGIONS }, () => h.preference.sigmaRegion * rng.normal());
  const counties: CountyTruth[] = keys.map((k, c) => {
    const row = cleanRow(r.rows[k]).row;
    const T = Math.max(1, Math.round(E[c] * Math.exp(tauS + tauG[c % REGIONS] + h.inventory.sigmaUnit * rng.normal())));
    const oFrac = row[3] > 0 ? row[2] / row[3] : 0;
    const eta = eta0[c] + delta + gamma * ((eta0[c] - m) / sdEta) + regional[c % REGIONS] + h.preference.sigmaEps * rng.normal();
    const s = Math.min(0.999, Math.max(0.001, logistic(eta)));
    const sign = order === "EARLY_A" ? -1 : order === "EARLY_B" ? 1 : 0;
    const s1raw = logistic(logit(s) + sign * EARLY_GAP);
    const s2 = Math.min(0.999, Math.max(0.001, (s - FIRST_BATCH * s1raw) / (1 - FIRST_BATCH)));
    const s1 = Math.min(0.999, Math.max(0.001, (s - (1 - FIRST_BATCH) * s2) / FIRST_BATCH));
    const n2 = T * (1 - oFrac);
    const b = Math.round(n2 * s), a = Math.round(n2 * (1 - s)), o = T - a - b;
    return { id: k, E: E[c], T, a, b, o, s1, s2, other: oFrac, start: 0.5 * rng.uniform(), dur: 0.25 + 0.35 * rng.uniform() };
  });
  const A = counties.reduce((t, c) => t + c.a, 0), B = counties.reduce((t, c) => t + c.b, 0), tot = counties.reduce((t, c) => t + c.T, 0);
  return { raceId: r.race.raceId, state: r.race.state, rep, order, counties, finalMargin: (100 * (B - A)) / tot, finalTotal: tot };
}

/** Votes counted in each county at progress time `tau`: batch one first, then batch two. */
export function countedAtTau(t: SyntheticRace, tau: number): Record<string, [number, number, number]> {
  const out: Record<string, [number, number, number]> = {};
  for (const c of t.counties) {
    const f = Math.min(1, Math.max(0, (tau - c.start) / c.dur));
    if (f <= 0) continue;
    const n = f * c.T, n1 = Math.min(n, FIRST_BATCH * c.T), n2 = n - n1;
    const voters = (x: number) => x * (1 - c.other);
    const b = voters(n1) * c.s1 + voters(n2) * c.s2, a = voters(n1) * (1 - c.s1) + voters(n2) * (1 - c.s2);
    out[c.id] = [Math.round(a), Math.round(b), Math.max(0, Math.round(n) - Math.round(a) - Math.round(b))];
  }
  return out;
}
const sumVotes = (x: Record<string, [number, number, number]>) => Object.values(x).reduce((t, c) => t + c[0] + c[1] + c[2], 0);

/** The progress time at which `share` of the final vote is counted (bisection; counted votes rise with tau). */
export function tauForShare(t: SyntheticRace, share: number): number {
  if (share <= 0) return -1;
  if (share >= 1) return 10;
  let lo = 0, hi = 2;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (sumVotes(countedAtTau(t, mid)) / t.finalTotal < share) lo = mid; else hi = mid;
  }
  return hi;
}

const plurality = (r: AnchoredRace): RaceRule => ({ raceId: r.race.raceId, kind: r.race.kind, state: r.race.state, office: "", rule: "PLURALITY", threshold: null, denominator: null, ballotFloor: null, support: "SUPPORTED", outputs: ["P_WIN"], isDefault: false } as RaceRule);

// ---- models -----------------------------------------------------------------------------------------------------------

const scaleGap = (h: VaiHyper, f: number): VaiHyper => {
  const g = h.preference.sigmaGap;
  const sc = (c: { AB: number; C: number; D: number }) => ({ AB: c.AB * f, C: c.C * f, D: c.D * f });
  return withHyper(h, { preference: { sigmaGap: { FIRST: sc(g.FIRST), MIXED: sc(g.MIXED), TAIL: sc(g.TAIL) } } });
};
const NAIVE = withHyper(HYPER_V1, { inventory: { sigmaTauState: 1e-4, sigmaTauRegion: 1e-4, sigmaUnit: 1e-4 } });

export interface ModelSpec { id: string; ablation: string; hyper: VaiHyper; useLedger: boolean; official: boolean }
export const MODELS: ModelSpec[] = [
  { id: "B", ablation: "B: published + counted returns, no count order, no inventory uncertainty", hyper: NAIVE, useLedger: false, official: false },
  { id: "C", ablation: "C: B + inventory model", hyper: HYPER_V2, useLedger: false, official: false },
  { id: "D", ablation: "D: full VAI with the ledger's count-order profile (v2 hyperparameters)", hyper: HYPER_V2, useLedger: true, official: false },
  { id: "E", ablation: "E: D + a verified official statement of votes outstanding (SYNTHETIC, 10% noise)", hyper: HYPER_V2, useLedger: true, official: true },
  { id: "D_V1", ablation: "D with the v1 (Tobit) inventory likelihood", hyper: HYPER_V1, useLedger: true, official: false },
  { id: "D_RHO50", ablation: "D with a shared selection gap, rhoGap = 0.5", hyper: withHyper(HYPER_V2, { preference: { rhoGap: 0.5 } }), useLedger: true, official: false },
  { id: "D_GAP50", ablation: "D with every sigma_g halved", hyper: scaleGap(HYPER_V2, 0.5), useLedger: true, official: false },
  { id: "D_GAP200", ablation: "D with every sigma_g doubled", hyper: scaleGap(HYPER_V2, 2), useLedger: true, official: false },
];
export const BASELINES = ["A_PUBLISHED", "REPORTED_LEAD", "UNIFORM_SWING"] as const;

export interface Row {
  race: string; state: string; partition: "TRAIN" | "HELD_OUT"; rep: number; order: OrderKind; checkpoint: Checkpoint; shareCounted: number; model: string;
  y: number; yB: boolean; marginMedian: number | null; marginMean: number | null; q10: number | null; q90: number | null; q025: number | null; q975: number | null; crps: number | null;
  pB: number | null; brier: number | null; logLoss: number | null; remMedian: number | null; remQ10: number | null; remQ90: number | null; remTrue: number; totalTrue: number;
  ess: number | null; quality: string | null; withheld: boolean; flags: string[]; ms: number | null;
}

export const partitionOf = (state: string): "TRAIN" | "HELD_OUT" => (seedFrom(7, state) % 2 === 0 ? "TRAIN" : "HELD_OUT");

interface Ctx { ledger: Map<string, CountOrderProfile & { raw: unknown }>; hashes: { prior: string; ledger: string }; priorId: string; draws: number; seed: number; swingSd: number }

function loadLedger(): { ledger: Ctx["ledger"]; sha: string } {
  const file = path.join(REPO_ROOT, "data/vai/count_order_2026.json");
  const text = fs.readFileSync(file, "utf8");
  const j = JSON.parse(text) as { jurisdictions: { jurisdiction: { level: string; state: string } }[] };
  const m = new Map<string, CountOrderProfile & { raw: unknown }>();
  for (const x of j.jurisdictions) if (x.jurisdiction.level === "STATE") m.set(x.jurisdiction.state, { ...profileFromJurisdiction(x as never), raw: x });
  return { ledger: m, sha: sha256(text) };
}

export function pickRaces(all: AnchoredRace[], n: number): AnchoredRace[] {
  const ok = all.filter((r) => r.race.liveUse === "ELIGIBLE" && Object.keys(r.rows).length >= 8 && Object.keys(r.rows).length <= 80);
  const seenState = new Set<string>();
  const byHash = [...ok].sort((a, b) => seedFrom(3, a.race.raceId) - seedFrom(3, b.race.raceId));
  const picked: AnchoredRace[] = [];
  for (const r of byHash) { if (picked.length >= n) break; if (seenState.has(r.race.state)) continue; seenState.add(r.race.state); picked.push(r); }
  return picked;
}

// ---- baselines --------------------------------------------------------------------------------------------------------------

function baselineRows(race: AnchoredRace, counted: Record<string, [number, number, number]>) {
  const keys = Object.keys(race.rows).sort();
  const pub = race.race.published;
  const A = keys.reduce((t, k) => t + (counted[k]?.[0] ?? 0), 0), B = keys.reduce((t, k) => t + (counted[k]?.[1] ?? 0), 0), N = sumVotes(counted);
  const reportedMargin = N > 0 ? (100 * (B - A)) / N : 0;
  // uniform swing: the vote-weighted mean log-ratio departure of reported counties from their baseline, applied to every county's unreported expectation
  let swing = 0, w = 0;
  for (const k of keys) {
    const c = counted[k];
    if (!c || c[0] + c[1] === 0) continue;
    const dev = Math.log((c[1] + 0.5) / (c[0] + 0.5)) - baselineLogRatio(race.rows[k], 0.5);
    swing += (c[0] + c[1]) * dev; w += c[0] + c[1];
  }
  swing = w > 0 ? swing / w : 0;
  let eB = B, eA = A, eT = N;
  for (const k of keys) {
    const row = cleanRow(race.rows[k]).row;
    const rem = Math.max(0, row[3] - (counted[k] ? counted[k][0] + counted[k][1] + counted[k][2] : 0));
    const s = logistic(baselineLogRatio(race.rows[k], 0.5) + swing);
    eB += rem * (1 - (row[2] / row[3] || 0)) * s; eA += rem * (1 - (row[2] / row[3] || 0)) * (1 - s); eT += rem;
  }
  const swingMargin = eT > 0 ? (100 * (eB - eA)) / eT : 0;
  return { published: pub.margin ?? 0, publishedP: pub.probB ?? 0.5, p10: pub.p10 ?? (pub.margin ?? 0) - 5, p90: pub.p90 ?? (pub.margin ?? 0) + 5, reportedMargin, swingMargin, N };
}

function baselineRow(id: string, base: object, blank: Record<string, unknown>, draws: Float64Array, y: number, yB: boolean, pOverride: number | null): Row {
  const p = pOverride ?? draws.reduce((t, v) => t + (v > 0 ? 1 : 0), 0) / draws.length;
  return { ...(base as Row), ...(blank as unknown as Row), model: id, marginMedian: quantileOf(draws, 0.5), marginMean: draws.reduce((t, v) => t + v, 0) / draws.length, q10: quantileOf(draws, 0.1), q90: quantileOf(draws, 0.9), q025: quantileOf(draws, 0.025), q975: quantileOf(draws, 0.975), crps: crps(draws, y), pB: p, brier: brier(p, yB), logLoss: logLoss(p, yB) };
}

// ---- the run ------------------------------------------------------------------------------------------------------------------

export function runSynthetic(opts: { races: number; reps: number; draws: number; seed: number; models?: string[]; checkpoints?: Checkpoint[]; log?: (s: string) => void }) {
  const found = anchoredRaces();
  if (!found) throw new Error("no committed prior whose inputs match the files on disk; run `npm run vai:prior`");
  const { ledger, sha } = loadLedger();
  const races = pickRaces(found.races, opts.races);
  const rows: Row[] = [];
  const integrity: { race: string; rep: number; order: string; issues: unknown[] }[] = [];
  const pending: { base: Omit<Row, "model" | "marginMedian" | "marginMean" | "q10" | "q90" | "q025" | "q975" | "crps" | "pB" | "brier" | "logLoss" | "remMedian" | "remQ10" | "remQ90" | "ess" | "quality" | "withheld" | "flags" | "ms">; blank: Record<string, unknown>; margin: number; key: string; train: boolean }[] = [];
  const log = opts.log ?? (() => {});
  const t0 = process.hrtime.bigint();
  for (const race of races) {
    const state = race.race.state, part = partitionOf(state);
    const shifts = anchoredStateShifts(race.race.published.dist!, race.race.calibration!, race.rows, Math.max(opts.draws, 64 * opts.reps), seedFrom(opts.seed, `${race.race.raceId}|shift`), HYPER_V2);
    const keys = Object.keys(race.rows).sort();
    const region = (k: string) => `r${keys.indexOf(k) % REGIONS}`;
    const jur = ledger.get(state);
    const ledgerProfile: CountOrderProfile = jur ?? { category: null, unresolved: false, countSpeed: null, receiptClass: null };
    const noLedger: CountOrderProfile = { category: null, unresolved: false, countSpeed: null, receiptClass: null };
    for (let rep = 0; rep < opts.reps; rep++) {
      for (const order of ORDERS) {
        const delta = shifts.values[rep * 61 % shifts.values.length];
        const truth = drawTruth(race, delta, rep, order, opts.seed);
        const scorer = new Scorer({ class: "SYNTHETIC", raceId: truth.raceId, county: Object.fromEntries(truth.counties.map((c) => [c.id, [c.a, c.b, c.o] as [number, number, number]])), source: "run_synthetic.ts generator" });
        void scorer; // the scorer would hold the truth in a real replay; here the harness scores from `truth` after each output is fixed
        const snaps: Snapshot[] = [];
        const checkpoints: { cp: Checkpoint; tau: number }[] = CHECKPOINTS.map((cp) => ({ cp, tau: tauForShare(truth, CHECKPOINT_SHARE[cp]) }));
        for (const { cp, tau } of checkpoints) {
          if (cp === "NONE") continue;
          snaps.push({ class: "SYNTHETIC", raceId: truth.raceId, availableAt: new Date(T0 + (tau / 1.2) * HOURS * 3600e3 + CHECKPOINTS.indexOf(cp)).toISOString(), counted: countedAtTau(truth, tau), source: `synthetic ${order} rep ${rep} ${cp}` });
        }
        integrity.push({ race: truth.raceId, rep, order, issues: checkTimestampIntegrity(snaps) });
        const store = new ReplayStore(truth.raceId, snaps);
        for (const { cp } of checkpoints) {
          if (opts.checkpoints && !opts.checkpoints.includes(cp)) continue;
          const asOf = cp === "NONE" ? new Date(T0 - 3600e3).toISOString() : snaps[CHECKPOINTS.indexOf(cp) - 1].availableAt;
          const view = store.view(asOf);
          assertNoFuture(view);
          const counted = view.latest?.counted ?? {};
          const share = sumVotes(counted) / truth.finalTotal;
          const remTrue = truth.finalTotal - sumVotes(counted);
          const yB = truth.finalMargin > 0;
          const base = { race: truth.raceId, state, partition: part, rep, order, checkpoint: cp, shareCounted: share, y: truth.finalMargin, yB, remTrue, totalTrue: truth.finalTotal };
          const blank = { marginMedian: null, marginMean: null, q10: null, q90: null, q025: null, q975: null, crps: null, pB: null, brier: null, logLoss: null, remMedian: null, remQ10: null, remQ90: null, ess: null, quality: null, withheld: false, flags: [] as string[], ms: null };
          // baselines
          const bl = baselineRows(race, counted);
          const shiftDraws = (m: number, sd: number) => { const z = new Rng(seedFrom(opts.seed, `bl|${truth.raceId}|${rep}|${order}|${cp}`)); return Float64Array.from({ length: opts.draws }, () => m + sd * z.normal()); };
          const sdPub = (bl.p90 - bl.p10) / 2.5631;
          for (const id of BASELINES) {
            if (id === "UNIFORM_SWING") { pending.push({ base, blank, margin: bl.swingMargin, key: `bl|${truth.raceId}|${rep}|${order}|${cp}`, train: part === "TRAIN" }); continue; }
            const draws = id === "A_PUBLISHED" ? shiftDraws(bl.published, sdPub) : shiftDraws(bl.reportedMargin, 0.01);
            rows.push(baselineRow(id, base, blank, draws, truth.finalMargin, yB, id === "A_PUBLISHED" ? bl.publishedP : null));
          }
          // models
          for (const m of MODELS) {
            if (opts.models && !opts.models.includes(m.id)) continue;
            const profile = m.useLedger ? ledgerProfile : noLedger;
            const complete = cp === "COMPLETE";
            const official = m.official && share >= 0.2 && !complete ? { outstanding: Math.max(0, remTrue * Math.exp(0.1 * new Rng(seedFrom(opts.seed, `off|${truth.raceId}|${rep}|${order}|${cp}`)).normal())), scope: "STATEWIDE_OR_DISTRICT" as const, recordIds: ["SYNTHETIC_OFFICIAL"] } : null;
            const t1 = process.hrtime.bigint();
            const out = simulateRace({
              raceId: truth.raceId, asOf: view.asOf, rule: plurality(race), priorId: found.priorId, prior: race.race, rows: race.rows, counted, region,
              completion: m.official && complete ? Object.fromEntries(keys.map((k) => [k, "ALL_KNOWN_BALLOTS_COUNTED" as const])) : undefined, official, profile, receipt: ELECTION_NIGHT,
              stateShift: { kind: "DRAWS", values: shifts.values.slice(0, opts.draws) }, hyper: m.hyper, shiftMode: "MARGINALISED", seed: seedFrom(opts.seed, `${truth.raceId}|${rep}|${cp}`), draws: opts.draws, provenance: {},
            });
            const ms = Number(process.hrtime.bigint() - t1) / 1e6;
            const rec = out.record, j = out.joint;
            if (!j || !rec.margin) { rows.push({ ...base, ...blank, model: m.id, withheld: true, flags: rec.guardrails.flags, quality: rec.quality, ms }); continue; }
            const pB = j.margin.reduce((t, v) => t + (v > 0 ? 1 : 0), 0) / j.draws;
            rows.push({
              ...base, model: m.id, marginMedian: rec.margin.quantiles.q500, marginMean: rec.margin.mean, q10: rec.margin.quantiles.q100, q90: rec.margin.quantiles.q900, q025: rec.margin.quantiles.q025, q975: rec.margin.quantiles.q975,
              crps: crps(j.margin, truth.finalMargin), pB, brier: brier(pB, yB), logLoss: logLoss(pB, yB), remMedian: rec.outstanding!.estimated!.median, remQ10: rec.outstanding!.estimated!.q10, remQ90: rec.outstanding!.estimated!.q90,
              ess: rec.diagnostics.essFraction, quality: rec.quality, withheld: rec.outcome === null, flags: rec.guardrails.flags, ms,
            });
          }
        }
      }
    }
    log(`${race.race.raceId} (${state}, ${part}, ${keys.length} counties) done, ${rows.length} rows, ${(Number(process.hrtime.bigint() - t0) / 1e9).toFixed(0)}s`);
  }
  // The uniform-swing baseline's spread is fitted on the TRAIN partition only (RMS of its own error), then applied to both partitions.
  const trainErr = pending.filter((x) => x.train).map((x) => x.base.y - x.margin);
  const swingSd = Math.sqrt(trainErr.reduce((t, e) => t + e * e, 0) / Math.max(1, trainErr.length));
  for (const x of pending) {
    const z = new Rng(seedFrom(opts.seed, x.key));
    const draws = Float64Array.from({ length: opts.draws }, () => x.margin + swingSd * z.normal());
    rows.push(baselineRow("UNIFORM_SWING", x.base, x.blank, draws, x.base.y, x.base.yB, null));
  }
  return { rows, races, integrity, priorId: found.priorId, ledgerSha: sha, wallSeconds: Number(process.hrtime.bigint() - t0) / 1e9, swingSd };
}

// ---- CLI ------------------------------------------------------------------------------------------------------------------------

if (isMain(import.meta.url)) {
  const { summarize, ablationComparisons, calibration, numerical } = await import("./summarize");
  const races = Number(arg("races") ?? 10), reps = Number(arg("reps") ?? 2), draws = Number(arg("draws") ?? 300), seed = Number(arg("seed") ?? 20261030);
  const outDir = path.resolve(arg("out") ?? path.join(REPO_ROOT, `data/vai/backtest/synthetic-${seed}`));
  const run = runSynthetic({ races, reps, draws, seed, log: (s) => console.log(s) });
  const rows = run.rows;
  const cols = Object.keys(rows[0]) as (keyof Row)[];
  const csv = [cols.join(","), ...rows.map((r) => cols.map((c) => { const v = r[c]; return typeof v === "number" ? String(Math.round(v * 1e5) / 1e5) : Array.isArray(v) ? `"${v.join("|")}"` : String(v); }).join(","))].join("\n") + "\n";
  const trainSel = (m: string) => rows.filter((r) => r.model === m && r.partition === "TRAIN" && r.crps !== null);
  const selection = ["D", "D_V1", "D_RHO50", "D_GAP50", "D_GAP200"].map((m) => ({ model: m, trainMeanCrps: r4(trainSel(m).reduce((t, r) => t + r.crps!, 0) / Math.max(1, trainSel(m).length)), heldOutMeanCrps: r4(rows.filter((r) => r.model === m && r.partition === "HELD_OUT" && r.crps !== null).reduce((t, r) => t + r.crps!, 0) / Math.max(1, rows.filter((r) => r.model === m && r.partition === "HELD_OUT" && r.crps !== null).length)) }));
  const gitHead = (() => { try { return execSync("git rev-parse HEAD", { cwd: REPO_ROOT }).toString().trim(); } catch { return null; } })();
  const metrics = { schema: RUN_SCHEMA, class: "SYNTHETIC", cells: summarize(rows, seed), comparisons: ablationComparisons(rows, seed), calibration: ["D", "C", "B", "E"].flatMap((m) => (["TRAIN", "HELD_OUT"] as const).map((p) => calibration(rows, m, p))), numerical: numerical(rows), hyperparameterEvaluation: { note: "SYNTHETIC EVALUATION, NOT CALIBRATION. The truth generator shares the model's family, so a variant that wins here is not shown to win on real counts. None of these variants is adopted into hyper_v2 on this evidence.", selection } };
  const manifest = {
    schema: RUN_SCHEMA, class: "SYNTHETIC", validation: "NONE_SYNTHETIC_ONLY", seed, races: run.races.map((r) => ({ raceId: r.race.raceId, state: r.race.state, partition: partitionOf(r.race.state), counties: Object.keys(r.rows).length })), reps, draws, orders: ORDERS, checkpoints: CHECKPOINTS, models: MODELS.map((m) => ({ id: m.id, ablation: m.ablation, hyperId: m.hyper.hyperId })), baselines: BASELINES,
    generator: { earlyGapLogOdds: EARLY_GAP, firstBatchShare: FIRST_BATCH, note: "magnitude informed by the observed PA 2024 early-batch shift; not fitted" },
    inputs: { priorId: run.priorId, countOrderLedgerSha256: run.ledgerSha, hyperV2Sha256: sha256(fs.readFileSync(path.join(REPO_ROOT, "data/vai/hyper_v2_research.json"), "utf8")) },
    swingBaselineSdFittedOnTrain: r4(run.swingSd), codeCommit: gitHead, wallSeconds: Math.round(run.wallSeconds), rowsSha256: sha256(csv), integrityIssues: run.integrity.filter((i) => i.issues.length).length,
  };
  writeOutput(path.join(outDir, "rows.csv"), csv);
  writeOutput(path.join(outDir, "metrics.json"), stableJson(metrics));
  writeOutput(path.join(outDir, "manifest.json"), stableJson(manifest));
  writeOutput(path.join(outDir, "integrity.json"), stableJson(run.integrity));
  console.log(`${path.relative(REPO_ROOT, outDir)}: ${rows.length} rows, ${Math.round(run.wallSeconds)}s, swing sd ${run.swingSd.toFixed(2)}`);
}

function r4(x: number | null) { return x === null ? null : Math.round(x * 1e4) / 1e4; }
