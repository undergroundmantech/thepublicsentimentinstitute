// SYNTHETIC election night for the protected Race History preview and for tests. Every name, vote and probability is invented.
//
// Nothing here is a forecast or a result. Every point carries status SYNTHETIC, which no public surface admits (see prepareHistory),
// and the preview labels it. It exists so the design and the data semantics can be reviewed before a real night exists:
// three candidates, a frozen forecast history, a live projection that starts without a valid probability, a model-version change, a
// revision, a downward vote correction, a feed outage, an out-of-order reading, and a shadow stream that must stay apart.

import { HISTORY_SCHEMA, type HistoryCandidate, type HistoryPoint, type ModelOutputPoint, type ResultPoint, type SourceOutage } from "./raceHistory";

export const DEMO_RACE_ID = "demo-three-way";
export const DEMO_NIGHT_START = Date.parse("2026-11-04T00:00:00Z"); // 7 PM ET

export const DEMO_CANDIDATES: HistoryCandidate[] = [
  { id: "alvarez", name: "SYNTHETIC Rosa Alvarez", party: "D", side: "A" },
  { id: "brandt", name: "SYNTHETIC Tom Brandt", party: "R", side: "B" },
  { id: "chen", name: "SYNTHETIC Wei Chen", party: "I", side: null },
];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const erf = (x: number) => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const iso = (t: number) => new Date(t).toISOString();
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

const REF = { plus: "brandt", minus: "alvarez" };
const FINAL = { alvarez: 0.488, brandt: 0.476, chen: 0.036 };
const TOTAL = 1_240_000;

export interface DemoOptions {
  /** Result observations on election night. Default 96 (every 5 minutes for 8 hours). */
  results?: number;
  /** Seed for the invented noise. */
  seed?: number;
  /** Frozen forecasts in the nine days before. */
  frozen?: number;
}

/** The synthetic night's 40-minute feed outage, declared as a recorder would declare it. Without a declaration a quiet feed simply holds. */
export function syntheticOutages(opts: DemoOptions = {}): SourceOutage[] {
  const n = opts.results ?? 96;
  if (n !== 96) return [];
  const at = (i: number) => iso(DEMO_NIGHT_START + 5 * 60_000 + i * (8 * 3_600_000 / n));
  return [{ provider: "*", from: at(40), to: at(48), reason: "the results feed returned errors" }];
}

export function syntheticNight(opts: DemoOptions = {}): HistoryPoint[] {
  const n = opts.results ?? 96, nf = opts.frozen ?? 9, rand = rng(opts.seed ?? 7);
  const pts: HistoryPoint[] = [];
  const base = { schema: HISTORY_SCHEMA, raceId: DEMO_RACE_ID, status: "SYNTHETIC" as const, candidates: DEMO_CANDIDATES, revision: { status: "ORIGINAL" as const, supersedes: null, note: null } };

  // frozen pre-election forecasts, one a day, ending the afternoon before
  for (let i = 0; i < nf; i++) {
    const t = DEMO_NIGHT_START - (nf - i) * 86_400_000 + 12 * 3_600_000;
    const margin = -1.2 + Math.sin(i / 2) * 0.9 + (rand() - 0.5) * 0.4;
    const pR = Phi(margin / 4.2);
    pts.push({
      ...base, kind: "MODEL_OUTPUT", pointId: `demo-frozen-${i}`, observedAt: iso(t), sourceTimestamp: null, sourceClass: "FROZEN_FORECAST", reporting: null,
      model: { id: "demo-forecast", version: "UNVERSIONED", snapshot: `F${i + 1}`, asOf: iso(t).slice(0, 10) },
      winProbability: { alvarez: r4((1 - pR) * 0.985), brandt: r4(pR * 0.985), chen: r4(0.015) }, winProbabilityBasis: "MULTI_CANDIDATE",
      margin: { pp: r4(margin), reference: REF, low: r4(margin - 6.1), high: r4(margin + 6.1), intervalBasis: "10th to 90th percentile of simulated margins" },
      projectedFinalVotes: { alvarez: Math.round(TOTAL * (FINAL.alvarez - margin / 200)), brandt: Math.round(TOTAL * (FINAL.brandt + margin / 200)), chen: Math.round(TOTAL * FINAL.chen) },
      provenance: { origin: "synthetic", ref: null },
    } satisfies ModelOutputPoint);
  }

  const stepMs = 8 * 3_600_000 / Math.max(n, 1);
  const prev = { alvarez: 0, brandt: 0, chen: 0 };
  let lastTotal = 0;
  for (let i = 0; i < n; i++) {
    const t = DEMO_NIGHT_START + 5 * 60_000 + i * stepMs;
    if (n === 96 && i >= 40 && i < 48) continue; // a 40-minute feed outage: no observation
    const f = 1 / (1 + Math.exp(-(i / n - 0.42) * 9)) * 0.97 + 0.015;
    const lean = 0.055 * (1 - f); // early returns lean R, later returns lean D
    const sh = { alvarez: FINAL.alvarez - lean + (rand() - 0.5) * 0.002, brandt: FINAL.brandt + lean + (rand() - 0.5) * 0.002, chen: FINAL.chen };
    const v: Record<string, number> = {};
    for (const c of Object.keys(sh) as (keyof typeof sh)[]) { v[c] = Math.max(prev[c], Math.round(TOTAL * f * sh[c])); }
    let totalsDecreased = false, revision: ResultPoint["revision"] = { status: "ORIGINAL", supersedes: null, note: null };
    if (n === 96 && i === 70) { v.brandt = prev.brandt - 2400; totalsDecreased = true; revision = { status: "CORRECTION", supersedes: `demo-res-${i - 1}`, note: "provider lowered a county total" }; }
    const total = v.alvarez + v.brandt + v.chen;
    if (total < lastTotal) totalsDecreased = true;
    Object.assign(prev, v); lastTotal = total;
    const source = n === 96 && i === 20 ? DEMO_NIGHT_START - 600_000 : t - 90_000; // one reading older than the ones before it
    pts.push({
      ...base, kind: "RESULT_OBSERVATION", pointId: `demo-res-${i}`, observedAt: iso(t), sourceTimestamp: n === 96 && i === 30 ? null : iso(source), sourceClass: "RESULT_FEED", revision,
      reporting: { pct: Math.round(f * 1000) / 10, definition: "The provider's own reporting percentage. Its basis is not stated." }, provider: "SYNTHETIC feed",
      reportedVotes: v, countedMargin: { pp: r4(((v.brandt - v.alvarez) / total) * 100), reference: REF }, totalsDecreased, outOfOrder: n === 96 && i === 20,
      confirmedThrough: null, provenance: { origin: "synthetic", ref: null },
    } satisfies ResultPoint);
  }

  // live projections every 10 minutes from 30 minutes after the first close: the first three have no valid probability or margin
  const nLive = Math.floor((8 * 3_600_000 - 30 * 60_000) / 600_000);
  for (let k = 0; k < nLive; k++) {
    const t = DEMO_NIGHT_START + 30 * 60_000 + k * 600_000;
    const f = 1 / (1 + Math.exp(-(k / nLive - 0.42) * 9)) * 0.97 + 0.015;
    const sd = 0.8 + 6 * (1 - f);
    const margin = -2.1 + 3.2 * (1 - f) + (rand() - 0.5) * 0.5 * (1 - f);
    const pR = Phi(margin / sd), pI = 0.012 * (1 - f);
    const late = k >= Math.floor(nLive / 2); // the model is versioned halfway through the night
    const valid = k >= 3;
    pts.push({
      ...base, kind: "MODEL_OUTPUT", pointId: `demo-live-${k}`, observedAt: iso(t), sourceTimestamp: iso(t - 30_000), sourceClass: "LIVE_PROJECTION",
      revision: k === Math.floor(nLive / 2) ? { status: "REVISION", supersedes: `demo-live-${k - 1}`, note: "model v2 recalibrated county turnout" } : base.revision,
      reporting: { pct: Math.round(f * 1000) / 10, definition: "Share of expected votes counted, as estimated by the model" },
      model: { id: "demo-live", version: late ? "2.0" : "1.0", snapshot: `L${k + 1}`, asOf: null },
      winProbability: valid ? { alvarez: r4(Math.max(0, 1 - pR - pI)), brandt: r4(pR), chen: r4(pI) } : null, winProbabilityBasis: valid ? "MULTI_CANDIDATE" : null,
      margin: valid ? { pp: r4(margin), reference: REF, low: r4(margin - 1.28 * sd), high: r4(margin + 1.28 * sd), intervalBasis: "10th to 90th percentile of simulated margins" } : null,
      projectedFinalVotes: valid ? { alvarez: Math.round(TOTAL * (FINAL.alvarez - margin / 200)), brandt: Math.round(TOTAL * (FINAL.brandt + margin / 200)), chen: Math.round(TOTAL * FINAL.chen) } : null,
      provenance: { origin: "synthetic", ref: null },
    } satisfies ModelOutputPoint);
    // a shadow model that disagrees; it must never reach the public charts
    pts.push({
      ...base, kind: "MODEL_OUTPUT", pointId: `demo-shadow-${k}`, observedAt: iso(t + 5_000), sourceTimestamp: null, sourceClass: "SHADOW_MODEL", reporting: null,
      model: { id: "demo-shadow", version: "0.1-research", snapshot: `S${k + 1}`, asOf: null },
      winProbability: valid ? { alvarez: r4(Math.min(1, 1 - Phi((margin + 1.4) / (sd * 1.4)))), brandt: r4(Phi((margin + 1.4) / (sd * 1.4))), chen: null } : null, winProbabilityBasis: valid ? "TWO_SIDE" : null,
      margin: valid ? { pp: r4(margin + 1.4), reference: REF, low: null, high: null, intervalBasis: null } : null, projectedFinalVotes: null, provenance: { origin: "synthetic", ref: null },
    } satisfies ModelOutputPoint);
  }
  return pts;
}
