// Shared fixtures for the Phase B1 tests. Not a test file (the runner globs *.test.ts).
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, readInput } from "../../scripts/vai/io";
import { HYPER_V1, withHyper, type VaiHyper } from "../../app/results/_vai/hyper";
import { estimateInventory, type InventoryInput, type InventoryPosterior, type InventoryUnit } from "../../app/results/_vai/inventory";
import { anchoredStateShifts, cleanRow, prefUnitsFromRows, runPreference, scenariosFor, type PreferenceResult, type PrefUnit, type Scenario, type StateShift } from "../../app/results/_vai/preference";
import type { CountyRows } from "../../app/results/_vai/prior";
import type { PriorFile, PriorRace } from "../../app/results/_vai/types";

export { HYPER_V1, withHyper };
export type { VaiHyper };

export const mean = (x: ArrayLike<number>) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i]; return s / x.length; };
export const sd = (x: ArrayLike<number>) => { const m = mean(x); let s = 0; for (let i = 0; i < x.length; i++) s += (x[i] - m) ** 2; return Math.sqrt(s / (x.length - 1)); };
export const quantile = (x: ArrayLike<number>, p: number) => { const s = Float64Array.from(x as ArrayLike<number>).sort(); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
export const width = (x: ArrayLike<number>) => quantile(x, 0.9) - quantile(x, 0.1);

/** Hyperparameters with every optional source of variation removed except the ones a test names. */
export const flat = (patch: Parameters<typeof withHyper>[1] = {}) =>
  withHyper(HYPER_V1, { inventory: { sigmaTauState: 0, sigmaTauRegion: 0 }, preference: { sigmaGamma: 0, sigmaRegion: 0 }, ...patch } as Parameters<typeof withHyper>[1]);

export const ELECTION_NIGHT = { class: "ELECTION_DAY_OR_EARLIER" as const, deadlineUtc: null, countSpeed: 0 };

export interface Toy {
  ids: string[];
  expected: Record<string, [number, number, number, number]>;
}

/** The hypothetical three-county race of docs/VAI_V1_MATHEMATICAL_DESIGN.md §12. Slot A is the toy's Republican, slot B its Democrat. */
export const TOY: Toy = { ids: ["A", "B", "C"], expected: { A: [200000, 300000, 0, 500000], B: [150000, 150000, 0, 300000], C: [140000, 60000, 0, 200000] } };

export interface RaceSetup {
  raceId: string;
  rows: CountyRows;
  /** Counted votes by county: [a, b, other]. Missing counties have counted nothing. */
  counted?: Record<string, [number, number, number]>;
  region?: (fips: string) => string;
  hyper: VaiHyper;
  J: number;
  seed: number;
  shift: StateShift;
  scenarios: Scenario[];
  receipt?: InventoryInput["receipt"];
  anchorOffset?: number[];
  inventoryUnits?: (u: InventoryUnit) => InventoryUnit;
  statewideOfficial?: InventoryInput["statewideOfficial"];
}

export interface Simulated {
  margin: Float64Array;
  inventory: InventoryPosterior;
  result: PreferenceResult;
  /** Probability that side B leads in the final count. */
  pB: number;
  /** Every draw's final log-ratio for the first unit, to compare runs for reproducibility. */
  fingerprint: Float64Array;
}

export function simulate(s: RaceSetup): Simulated {
  const keys = Object.keys(s.rows).sort();
  const reg = s.region ?? (() => "ALL");
  const units: InventoryUnit[] = keys.map((k) => {
    const c = s.counted?.[k] ?? [0, 0, 0];
    const u: InventoryUnit = { id: k, expected: cleanRow(s.rows[k]).row[3], reported: c[0] + c[1] + c[2], region: reg(k) };
    return s.inventoryUnits ? s.inventoryUnits(u) : u;
  });
  const inventory = estimateInventory({ raceId: s.raceId, asOf: "2026-11-04T03:00:00Z", units, receipt: s.receipt ?? ELECTION_NIGHT, statewideOfficial: s.statewideOfficial ?? null, hyper: s.hyper, seed: s.seed, draws: s.J });
  const ps = s.hyper.preference.pseudoCount;
  const pref: PrefUnit[] = prefUnitsFromRows(s.rows, reg, (k) => (s.counted?.[k] ? { a: s.counted[k][0], b: s.counted[k][1] } : null), ps);
  const margin = new Float64Array(s.J);
  const fingerprint = new Float64Array(s.J);
  const countedA = keys.reduce((t, k) => t + (s.counted?.[k]?.[0] ?? 0), 0);
  const countedB = keys.reduce((t, k) => t + (s.counted?.[k]?.[1] ?? 0), 0);
  const countedAll = inventory.summary.reported;
  const result = runPreference({ raceId: s.raceId, units: pref, inventory, stateShift: [s.shift], scenarios: s.scenarios, anchorOffset: s.anchorOffset, hyper: s.hyper, seed: s.seed }, (d) => {
    let vb = countedB, va = countedA, tot = countedAll;
    for (let c = 0; c < keys.length; c++) {
      const r = d.remaining[c];
      const row = cleanRow(s.rows[keys[c]]).row;
      const other = row[3] > 0 ? row[2] / row[3] : 0;
      const sb = 1 / (1 + Math.exp(-d.q[0][c]));
      vb += r * (1 - other) * sb;
      va += r * (1 - other) * (1 - sb);
      tot += r;
    }
    margin[d.index] = (100 * (vb - va)) / tot;
    fingerprint[d.index] = d.q[0][0];
  });
  let pos = 0;
  for (const m of margin) if (m > 0) pos++;
  return { margin, inventory, result, pB: pos / s.J, fingerprint };
}

// ---- the committed artefacts --------------------------------------------------------------------------------------

export interface AnchoredRace {
  race: PriorRace;
  rows: CountyRows;
}

/** ANCHORED races of the newest committed prior whose inputs still match the files on disk. Empty when none does. */
export function anchoredRaces(): { priorId: string; races: AnchoredRace[] } | null {
  const dir = path.join(REPO_ROOT, "data/vai");
  const files = fs.readdirSync(dir).filter((f) => /^prior_[0-9a-f]{12}\.json$/.test(f)).sort();
  for (const f of files) {
    const prior = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as PriorFile;
    if (!prior.inputs.every((i) => fs.existsSync(path.join(REPO_ROOT, i.path)) && readInput(REPO_ROOT, i.path).sha256 === i.sha256)) continue;
    const cache = new Map<string, Record<string, CountyRows>>();
    const races: AnchoredRace[] = [];
    for (const race of prior.races) {
      if (race.status !== "ANCHORED" || !race.geography || !race.published.dist || !race.calibration) continue;
      const file = race.geography.countyFile;
      if (!cache.has(file)) cache.set(file, (JSON.parse(fs.readFileSync(path.join(REPO_ROOT, file), "utf8")) as { counties: Record<string, CountyRows> }).counties);
      const rows = cache.get(file)![race.raceId];
      if (rows && Object.keys(rows).length) races.push({ race, rows });
    }
    return { priorId: prior.priorId, races };
  }
  return null;
}

export const publishedOf = (r: PriorRace) => ({ margin: r.published.margin!, probB: r.published.probB!, p10: r.published.p10!, p90: r.published.p90! });

export function anchoredSetup(a: AnchoredRace, J: number, seed: number, hyper: VaiHyper = HYPER_V1, profile = { category: "A" as const, unresolved: false, countSpeed: 0, receiptClass: "ELECTION_DAY_OR_EARLIER" as const }): RaceSetup {
  const shifts = anchoredStateShifts(a.race.published.dist!, a.race.calibration!, a.rows, J, seed, hyper);
  return { raceId: a.race.raceId, rows: a.rows, hyper, J, seed, shift: { kind: "DRAWS", values: shifts.values }, scenarios: scenariosFor(profile, hyper) };
}
