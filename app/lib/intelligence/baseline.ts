// The forecast baseline the intelligence layer is measured against, and the Top-N register built from it.
//
// Phase 1 pins the baseline to the forecast as published on October 25, 2026:
//   public/forecast/archive/2026-10-25.json  statewide races (Senate, governor), the archived daily snapshot
//   public/forecast/model.json at the pinned git commit  every race including the House (meta.updated 2026-10-25)
// Later forecast revisions are never picked up silently: the register records the git ref and file hashes it read.

import type { BaselineRace, BaselineSource, Office, Register, RegisterEntry, ResearchCoverage, ResearchRecord } from "./types";

export const BASELINE_SNAPSHOT_DATE = "2026-10-25";

/**
 * The forecast archive is written by Python and contains bare NaN where a race has no polls. That is not JSON.
 * Replace NaN and Infinity tokens that sit in value position with null; never touch the inside of strings.
 */
export function parseLenientJson(text: string): unknown {
  return JSON.parse(text.replace(/"(?:[^"\\]|\\.)*"|-?\b(?:NaN|Infinity)\b/g, (m) => (m.startsWith('"') ? m : "null")));
}

type ModelRace = {
  id: string; office: string; st: string; district: number | null; name: string; dem?: string | null; gop?: string | null;
  est?: { margin?: number | null; prob?: number | null; p10?: number | null; p90?: number | null } | null;
};
type ModelFile = { meta?: { updated?: string }; races?: ModelRace[] };
type ArchiveRace = { office?: string; margin?: number | null; win_d?: number | null };
type ArchiveFile = { date?: string; races?: Record<string, ArchiveRace> };

const OFFICES: Record<string, Office> = { senate: "senate", governor: "governor", house: "house" };
const fin = (x: unknown): number | null => (typeof x === "number" && Number.isFinite(x) ? x : null);

/** Every Senate, governor and House race in model.json, margins B minus A as the file stores them. */
export function baselineFromModel(model: unknown): { races: BaselineRace[]; updated: string | null; problems: string[] } {
  const m = model as ModelFile;
  const problems: string[] = [];
  const races: BaselineRace[] = [];
  for (const r of m.races ?? []) {
    const office = OFFICES[r.office];
    if (!office) continue;
    const margin = fin(r.est?.margin);
    if (margin === null) { problems.push(`${r.id}: no finite forecast margin`); continue; }
    races.push({
      raceId: r.id, office, state: r.st, district: office === "house" ? (r.district ?? null) : null, name: r.name,
      sideA: r.dem ?? null, sideB: r.gop ?? null, margin, probB: fin(r.est?.prob), p10: fin(r.est?.p10), p90: fin(r.est?.p90),
    });
  }
  return { races, updated: m.meta?.updated ?? null, problems };
}

/**
 * Check statewide races against the archived snapshot. The archive keys Senate races by state ("IA") and governor
 * races with a G ("IAG"), stores margin as D minus R and the Democratic chance in percent.
 */
export function crossCheckArchive(races: BaselineRace[], archive: unknown, tolerance = 0.01): { checked: number; mismatches: string[]; missing: string[] } {
  const a = archive as ArchiveFile;
  const mismatches: string[] = [], missing: string[] = [];
  let checked = 0;
  for (const r of races) {
    if (r.office === "house") continue;
    const key = r.office === "governor" ? `${r.state}G` : r.state;
    const x = a.races?.[key];
    if (!x || (x.office && OFFICES[x.office] !== r.office)) { missing.push(r.raceId); continue; }
    checked++;
    const am = fin(x.margin);
    if (am === null || Math.abs(-am - r.margin) > tolerance) mismatches.push(`${r.raceId}: model ${r.margin} vs archive ${am === null ? "null" : -am}`);
    const wd = fin(x.win_d);
    if (r.probB !== null && wd !== null && Math.abs(1 - wd / 100 - r.probB) > 0.001 + tolerance / 10) mismatches.push(`${r.raceId}: P(B) model ${r.probB} vs archive ${(1 - wd / 100).toFixed(4)}`);
  }
  return { checked, mismatches, missing };
}

export interface RegisterOptions {
  n: number;
  offices: Office[];
  generatedAt: string;
  source: BaselineSource;
}

/** The N closest races by absolute forecast margin; ties go to the race nearer a coin flip, then by id. */
export function buildRegister(races: BaselineRace[], opts: RegisterOptions): Register {
  const excluded: Register["excluded"] = [];
  const pool = races.filter((r) => {
    if (!opts.offices.includes(r.office)) return false;
    if (!Number.isFinite(r.margin)) { excluded.push({ raceId: r.raceId, reason: "no finite forecast margin" }); return false; }
    return true;
  });
  const coin = (p: number | null) => (p === null ? 1 : Math.abs(p - 0.5));
  pool.sort((x, y) => Math.abs(x.margin) - Math.abs(y.margin) || coin(x.probB) - coin(y.probB) || x.raceId.localeCompare(y.raceId));
  const entries: RegisterEntry[] = pool.slice(0, opts.n).map((r, i) => ({
    rank: i + 1, raceId: r.raceId, office: r.office, state: r.state, district: r.district, name: r.name,
    baseline: { margin: r.margin, probB: r.probB, p10: r.p10, p90: r.p90, sideA: r.sideA, sideB: r.sideB },
  }));
  return {
    kind: "TOP_N_CLOSEST", n: opts.n, offices: opts.offices,
    rankedBy: "absolute forecast margin (B minus A, points), then distance of P(B) from 0.5, then race id",
    generatedAt: opts.generatedAt, source: opts.source, entries, excluded,
  };
}

/** States with one at-large House seat in 2026. The forecast ids them as district 01 (house-WY-01). */
export const AT_LARGE_STATES: ReadonlySet<string> = new Set(["AK", "DE", "ND", "SD", "VT", "WY"]);

/** The district id GEO_SPLIT records use for a House race: house-PA-7 or house-PA-07 -> PA-07. */
export function districtIdOf(raceId: string): string | null {
  const m = raceId.match(/^house-([A-Z]{2})-(\d+)$/);
  return m ? `${m[1]}-${String(Number(m[2])).padStart(2, "0")}` : null;
}

/** What research the register entry has, component by component. */
export function researchCoverage(entry: { raceId: string; office: Office; state: string }, records: ResearchRecord[]): Record<"reporting" | "outstanding" | "geography" | "methods", ResearchCoverage> {
  const forState = records.filter((r) => r.state === entry.state && (r.raceId === null || r.raceId === entry.raceId));
  const usable = forState.filter((r) => r.provenance.evidenceClass !== "UNKNOWN");
  const has = (t: ResearchRecord["recordType"]) => usable.some((r) => r.recordType === t);
  const pollClose = usable.some((r) => r.recordType === "POLL_CLOSE" && r.provenance.evidenceClass === "VERIFIED" && !!r.closesAtUtc?.startsWith("2026-"));
  const windows = has("REPORTING_WINDOW");
  const turnout = usable.some((r) => r.recordType === "TURNOUT_EXPECTATION" && r.raceId === entry.raceId);
  const deadlines = has("BALLOT_DEADLINE") || has("OUTSTANDING_REPORT");
  const did = districtIdOf(entry.raceId);
  const splits = did ? usable.some((r) => r.recordType === "GEO_SPLIT" && r.districtId === did) : false;
  const level = (a: boolean, b: boolean): ResearchCoverage => (a && b ? "PRESENT" : a || b ? "PARTIAL" : "MISSING");
  return {
    reporting: level(pollClose, windows),
    outstanding: level(turnout, deadlines),
    geography: entry.office === "house" && !AT_LARGE_STATES.has(entry.state) ? (splits ? "PRESENT" : "MISSING") : "NOT_REQUIRED",
    methods: has("METHOD_HISTORY") ? "PRESENT" : "MISSING",
  };
}
