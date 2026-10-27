// Frozen pre-election forecast history, rebuilt from the published artifact's own git history.
//
//   npm run intelligence:frozen-history
//
// Every commit that changed public/forecast/model.json published a forecast. This reads each of them as it was, keeps the
// figures the model itself printed (margin, GOP win probability, p10/p90, candidate vote estimates) and writes them, with
// the commit that published them, to data/intelligence/history/frozen-forecasts.json.gz.
//
// Nothing is recomputed: a past value is never re-derived with a newer model. A race is written at a snapshot only when its
// figures changed from the snapshot before it. The time of a snapshot is its commit time (the earliest moment the site could
// have shown it), never a time inferred from the file. Commits whose file lacks the published shape are listed and skipped.
//
// Re-run after each forecast publication to extend the history. The output is deterministic for a given git history.

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const MODEL = "public/forecast/model.json";
const OUT = "data/intelligence/history/frozen-forecasts.json.gz";

interface RawCand { name?: string; party?: string; pct?: number; votes?: number }
interface RawRace { id?: string; dem?: string | null; gop?: string | null; cands?: RawCand[]; est?: { margin?: number; prob?: number; p10?: number; p90?: number } | null }
interface RawModel { meta?: { updated?: string; sims?: number }; races?: RawRace[] }

const git = (...args: string[]) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 256 * 1024 * 1024, encoding: "utf8" });

export interface FrozenSnapshot { snapshot: string; commit: string; committedAt: string; modelUpdated: string | null; sims: number | null; races: number }
export type FrozenPoint = [snapshotIndex: number, margin: number | null, probGop: number | null, p10: number | null, p90: number | null, cands: [string, string, number | null][]];
export interface FrozenRace { dem: string | null; gop: string | null; pts: FrozenPoint[] }
export interface FrozenHistoryFile {
  schema: "TPSI_FROZEN_FORECAST_HISTORY/1";
  source: string;
  marginSign: "GOP_MINUS_DEM_PP";
  probabilityOf: "GOP_WIN";
  note: string;
  snapshots: FrozenSnapshot[];
  skipped: { commit: string; reason: string }[];
  races: Record<string, FrozenRace>;
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function main() {
  const log = git("log", "--reverse", "--format=%H %cI", "--", MODEL).trim().split("\n").filter(Boolean).map((l) => { const [h, t] = l.split(" "); return { h, t: new Date(t).toISOString() }; });
  const out: FrozenHistoryFile = {
    schema: "TPSI_FROZEN_FORECAST_HISTORY/1", source: `git log of ${MODEL}`, marginSign: "GOP_MINUS_DEM_PP", probabilityOf: "GOP_WIN",
    note: "Figures exactly as each published model.json printed them. A snapshot's time is its commit time. Races are listed at a snapshot only when their figures changed.",
    snapshots: [], skipped: [], races: {},
  };
  const last = new Map<string, string>();
  for (const { h, t } of log) {
    let model: RawModel;
    try { model = JSON.parse(git("show", `${h}:${MODEL}`)) as RawModel; } catch { out.skipped.push({ commit: h, reason: "unreadable or not JSON" }); continue; }
    const races = (model.races ?? []).filter((r) => typeof r.id === "string" && r.est && num(r.est.margin) !== null);
    if (!races.length) { out.skipped.push({ commit: h, reason: "no races with an est.margin" }); continue; }
    const si = out.snapshots.length;
    out.snapshots.push({ snapshot: h.slice(0, 8), commit: h, committedAt: t, modelUpdated: model.meta?.updated ?? null, sims: num(model.meta?.sims), races: races.length });
    for (const r of races) {
      const id = r.id as string;
      const cands: [string, string, number | null][] = (r.cands ?? []).filter((c) => typeof c.name === "string").map((c) => [c.name as string, c.party ?? "", num(c.votes)]);
      const pt: FrozenPoint = [si, num(r.est?.margin), num(r.est?.prob), num(r.est?.p10), num(r.est?.p90), cands];
      const key = JSON.stringify(pt.slice(1)) + `|${r.dem ?? ""}|${r.gop ?? ""}`;
      if (last.get(id) === key) continue;
      last.set(id, key);
      const row = (out.races[id] ??= { dem: r.dem ?? null, gop: r.gop ?? null, pts: [] });
      row.dem = r.dem ?? row.dem; row.gop = r.gop ?? row.gop;
      row.pts.push(pt);
    }
  }
  mkdirSync(path.join(ROOT, path.dirname(OUT)), { recursive: true });
  const json = JSON.stringify(out);
  writeFileSync(path.join(ROOT, OUT), gzipSync(Buffer.from(json), { level: 9 }));
  const pts = Object.values(out.races).reduce((n, r) => n + r.pts.length, 0);
  console.log(`snapshots ${out.snapshots.length} (skipped ${out.skipped.length}), races ${Object.keys(out.races).length}, points ${pts}, ${(json.length / 1e6).toFixed(2)} MB json, ${(readFileSync(path.join(ROOT, OUT)).length / 1e6).toFixed(2)} MB gz`);
}

main();
