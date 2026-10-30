// T8 backtest library: snapshot provenance, a replay view that cannot see the future or the answer, timestamp integrity, proper scores
// and a race-clustered bootstrap. No I/O and no model code: the runner supplies those.
import { Rng } from "../../../app/results/_vai/rng";

/** Where a snapshot's numbers came from. A synthetic snapshot is never labelled as observed, and a replay that mixes classes says so. */
export type SnapshotClass = "HISTORICAL_OBSERVED" | "HISTORICAL_RECONSTRUCTED" | "SYNTHETIC" | "FINAL_RETURNS";

export interface Snapshot {
  class: SnapshotClass;
  raceId: string;
  /** The instant from which a model may read this snapshot (UTC ISO). For archived data this is the archive's capture time: an upper bound on publication. */
  availableAt: string;
  /** Counted votes by county [side A, side B, other]. */
  counted: Record<string, [number, number, number]>;
  source: string;
}

export interface FinalTruth {
  class: "FINAL_RETURNS" | "SYNTHETIC";
  raceId: string;
  /** Final votes by county [A, B, other]. */
  county: Record<string, [number, number, number]>;
  source: string;
}

export interface ReplayView {
  asOf: string;
  raceId: string;
  /** The newest snapshot with availableAt <= asOf, or null. */
  latest: Snapshot | null;
  /** Every snapshot visible at asOf, oldest first. */
  history: readonly Snapshot[];
}

const T = (iso: string) => {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) throw new Error(`not a timestamp: ${iso}`);
  return t;
};

/** Holds the snapshots of one race. `view(asOf)` returns only what was available at asOf. The truth is not reachable from here. */
export class ReplayStore {
  private readonly snaps: Snapshot[];
  readonly raceId: string;
  constructor(raceId: string, snapshots: Snapshot[]) {
    this.raceId = raceId;
    this.snaps = [...snapshots].sort((a, b) => T(a.availableAt) - T(b.availableAt));
    for (const s of this.snaps) if (s.raceId !== raceId) throw new Error(`snapshot for ${s.raceId} in the store of ${raceId}`);
  }
  view(asOf: string): ReplayView {
    const t = T(asOf);
    const history = this.snaps.filter((s) => T(s.availableAt) <= t).map((s) => Object.freeze({ ...s }));
    return { asOf, raceId: this.raceId, latest: history[history.length - 1] ?? null, history };
  }
  get classes(): SnapshotClass[] { return [...new Set(this.snaps.map((s) => s.class))].sort(); }
  get size() { return this.snaps.length; }
}

/** The only holder of the final answer. A model never receives it; the runner calls `score` after the model's output is fixed. */
export class Scorer {
  private readonly truth: FinalTruth;
  constructor(truth: FinalTruth) { this.truth = truth; }
  get truthClass() { return this.truth.class; }
  score<R>(fn: (truth: FinalTruth) => R): R { return fn(this.truth); }
}

export interface IntegrityIssue { code: string; detail: string }

/** Timestamp integrity of one race's snapshots. Returns every issue found; an empty list is a pass. */
export function checkTimestampIntegrity(snaps: readonly Snapshot[], opts: { revisionTolerance?: number } = {}): IntegrityIssue[] {
  const issues: IntegrityIssue[] = [];
  const tol = opts.revisionTolerance ?? 0;
  for (const s of snaps) if (!Number.isFinite(Date.parse(s.availableAt))) issues.push({ code: "BAD_TIMESTAMP", detail: `${s.raceId} ${s.availableAt}` });
  if (issues.length) return issues;
  const ordered = [...snaps].sort((a, b) => T(a.availableAt) - T(b.availableAt));
  for (let i = 1; i < ordered.length; i++) {
    if (T(ordered[i].availableAt) === T(ordered[i - 1].availableAt)) issues.push({ code: "DUPLICATE_TIMESTAMP", detail: ordered[i].availableAt });
    for (const [k, c] of Object.entries(ordered[i].counted)) {
      const p = ordered[i - 1].counted[k];
      if (!p) continue;
      const drop = (p[0] + p[1] + p[2]) - (c[0] + c[1] + c[2]);
      if (drop > tol) issues.push({ code: "COUNT_DECREASED", detail: `${k} ${ordered[i - 1].availableAt} -> ${ordered[i].availableAt} (${drop})` });
    }
  }
  const classes = new Set(snaps.map((s) => s.class));
  if (classes.has("SYNTHETIC") && classes.size > 1) issues.push({ code: "MIXED_SYNTHETIC_AND_REAL", detail: [...classes].join(",") });
  for (const s of snaps) if (s.class === "FINAL_RETURNS") issues.push({ code: "FINAL_RETURNS_IN_REPLAY_INPUT", detail: s.source });
  return issues;
}

/** Throws when a model-visible input carries anything dated after `asOf`. Called by the runner on every model call. */
export function assertNoFuture(view: ReplayView): void {
  const t = T(view.asOf);
  for (const s of view.history) if (T(s.availableAt) > t) throw new Error(`future snapshot ${s.availableAt} visible at ${view.asOf}`);
}

// ---- checkpoints ------------------------------------------------------------------------------------------------------------

export const CHECKPOINTS = ["NONE", "INITIAL", "Q1", "MID", "Q3", "LATE", "NEAR_COMPLETE", "COMPLETE"] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];
/** Reported votes as a share of the final total (known to the harness, never to a model) that defines each checkpoint. */
export const CHECKPOINT_SHARE: Record<Checkpoint, number> = { NONE: 0, INITIAL: 0.03, Q1: 0.25, MID: 0.5, Q3: 0.75, LATE: 0.9, NEAR_COMPLETE: 0.97, COMPLETE: 1 };

// ---- scores -----------------------------------------------------------------------------------------------------------------

export const brier = (p: number, outcome: boolean) => (p - (outcome ? 1 : 0)) ** 2;
/** Log loss with probabilities clipped to [eps, 1-eps]: the clip is stated, not hidden. */
export const logLoss = (p: number, outcome: boolean, eps = 1e-3) => { const q = Math.min(1 - eps, Math.max(eps, p)); return -Math.log(outcome ? q : 1 - q); };

/** Continuous ranked probability score of an equally weighted sample against y: E|X−y| − ½E|X−X'|, the second term by the sorted-sample identity. */
export function crps(sample: ArrayLike<number>, y: number): number {
  const n = sample.length;
  const s = Float64Array.from(sample as ArrayLike<number>).sort();
  let a = 0, b = 0;
  for (let i = 0; i < n; i++) { a += Math.abs(s[i] - y); b += (2 * i - n + 1) * s[i]; }
  return a / n - b / (n * n);
}

export function quantileOf(sample: ArrayLike<number>, p: number): number {
  const s = Float64Array.from(sample as ArrayLike<number>).sort();
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(p * s.length)))];
}

/** Reliability table: probabilities binned, with the observed frequency and the count in each bin. */
export function reliability(pairs: { p: number; hit: boolean }[], bins = 10) {
  const out = Array.from({ length: bins }, (_, i) => ({ lo: i / bins, hi: (i + 1) / bins, n: 0, meanP: 0, freq: 0 }));
  for (const { p, hit } of pairs) {
    const b = out[Math.min(bins - 1, Math.floor(p * bins))];
    b.n++; b.meanP += p; b.freq += hit ? 1 : 0;
  }
  return out.map((b) => ({ ...b, meanP: b.n ? b.meanP / b.n : null, freq: b.n ? b.freq / b.n : null }));
}

export interface Estimate { n: number; clusters: number; mean: number | null; lo: number | null; hi: number | null }

/** Mean with a 95% percentile interval from resampling whole clusters (races), because snapshots of one race are not independent. */
export function clusterBootstrap(rows: { cluster: string; value: number }[], reps = 1000, seed = 1): Estimate {
  const n = rows.length;
  if (!n) return { n: 0, clusters: 0, mean: null, lo: null, hi: null };
  const by = new Map<string, number[]>();
  for (const r of rows) (by.get(r.cluster) ?? by.set(r.cluster, []).get(r.cluster)!).push(r.value);
  const groups = [...by.values()];
  const mean = rows.reduce((s, r) => s + r.value, 0) / n;
  if (groups.length < 2) return { n, clusters: groups.length, mean, lo: null, hi: null };
  const rng = new Rng(seed);
  const draws: number[] = [];
  for (let b = 0; b < reps; b++) {
    let s = 0, c = 0;
    for (let g = 0; g < groups.length; g++) {
      const grp = groups[Math.floor(rng.uniform() * groups.length)];
      for (const v of grp) { s += v; c++; }
    }
    draws.push(s / c);
  }
  draws.sort((a, b) => a - b);
  return { n, clusters: groups.length, mean, lo: draws[Math.floor(0.025 * reps)], hi: draws[Math.min(reps - 1, Math.floor(0.975 * reps))] };
}
