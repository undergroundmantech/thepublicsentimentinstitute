// Server side reads for the 2028 pages. The files are static (public/forecast/2028/x), so every page builds once.
import fs from "node:fs";
import path from "node:path";
import { genRes, type DefaultFile, type GenFile, type PrimFile, type Res } from "./lib";
import type { Grid } from "./Matchup";
import type { CandOpt } from "./Matchup";
import type { PrimSummary } from "./PrimView";

const P = (f: string) => path.join(process.cwd(), "public", "forecast", "2028", "x", f);
let DEF: DefaultFile | null = null, PS: PrimSummary | null = null, CO: CandOpt[] | null = null, PV: { D: number; R: number } | null = null;
export function getDefault(): DefaultFile { if (!DEF) DEF = JSON.parse(fs.readFileSync(P("default.json"), "utf8")) as DefaultFile; return DEF; }
export function getPrimSummary(): PrimSummary {
  if (!PS) {
    const p = JSON.parse(fs.readFileSync(P("prim.json"), "utf8")) as PrimFile;
    PS = Object.fromEntries((["dem", "dem_noharris", "gop", "gop_novance"] as const).map((k) => [k, { names: p[k].names, colors: p[k].colors, nomination: p[k].nomination }])) as PrimSummary;
    PV = { D: p.dem.votes.reduce((a, b) => a + b, 0) + p.dem.other, R: p.gop.votes.reduce((a, b) => a + b, 0) + p.gop.other };
  }
  return PS;
}
export function getPrimVotes() { getPrimSummary(); return PV!; }
export function getCands(): CandOpt[] {
  if (!CO) {
    const e = JSON.parse(fs.readFileSync(P("engine.json"), "utf8")) as { cands: { cols: string[]; rows: (string | number | null)[][] } };
    const c = e.cands.cols; const i = (k: string) => c.indexOf(k);
    CO = e.cands.rows.map((r) => ({ name: String(r[i("name")]), party: String(r[i("party")]) as CandOpt["party"], third: r[i("third_default")] == null || r[i("third_default")] === "" ? null : Number(r[i("third_default")]), hyp: Number(r[i("hypothetical")]) === 1 }))
      .filter((x) => x.name !== "Generic Republican");
  }
  return CO;
}
export const top = (s: PrimSummary["dem"], n = 3) => s.names.map((nm, j) => ({ name: nm, p: s.nomination[j], color: s.colors[j] })).sort((a, b) => b.p - a.p).slice(0, n);

let GEN: GenFile | null = null;
export function getGen(): GenFile { if (!GEN) GEN = JSON.parse(fs.readFileSync(P("gen.json"), "utf8")) as GenFile; return GEN; }
/** the artifact's headline pairing, the generic Democrat against Vance, with every county */
export function getGenBase(): Res { return genRes(getGen(), "Generic Democrat", "Vance")!; }
export function getGenNames() { const g = getGen(); return { D: [...new Set(g.pairs.map((p) => p[0]))], R: [...new Set(g.pairs.map((p) => p[1]))] }; }
/** every pairing's artifact numbers, with how likely it is from the artifact's nomination odds */
export function getGrid(): Grid[] {
  const ps = getPrimSummary(); const nom = (k: "dem" | "gop", n: string) => { const i = ps[k].names.indexOf(n); return i < 0 ? 0 : ps[k].nomination[i]; };
  return getGen().pairs.map((p) => ({ d: p[0], r: p[1], pD: p[2], evD: p[3], nat: p[6], odds: p[0] === "Generic Democrat" ? null : nom("dem", p[0]) * nom("gop", p[1]) }));
}
