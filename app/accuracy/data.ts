// The 2026 accuracy report, read at build time from public/accuracy/2026.json.
// Built by scripts/accuracy/build_accuracy.py: the frozen November 3 forecast scored against the count.
// Margins are Republican minus Democratic points; error is result minus forecast, so a negative error means
// Democrats ran ahead of the forecast.
import fs from "node:fs";
import path from "node:path";

export type Office = "senate" | "governor" | "house";
export type Blk = { n: number; right: number; share: number; bias: number; mae: number; rmse: number; median_miss: number; in80: number; brier: number; logloss: number; mean_fav: number; fav_won: number; d_ahead: number; counting: number };
export type Head = { races: number; called_right: number; counting: number; scored: Blk | null; scored_final: Blk | null; competitive: Blk | null };
export type Chamber = { seats: number; majority: number; projD: number; projR: number; projI: number; seat_err: number; demControl: number; demSeats: number; median: number | null; p10: number; p90: number; actualD: number; actualR: number; control: "D" | "R" | "none"; favorite: "D" | "R"; right: boolean; inside80: boolean; counting: number; hist: [number, number][] | null };
export type Cal = { lo: number; hi: number; n: number; expected: number; won: number; upsets: number };
export type Race = { id: string; ind: boolean; o: Office; st: string; d: number; name: string; dem: string | null; gop: string | null; fm: number; p: number; p10: number | null; p90: number | null; act: number | null; err: number | null; pct: number; fin: boolean; side: "D" | "R"; fav: "D" | "R"; right: boolean; in80: boolean; dn: string | null; rn: string | null; excl: string | null };
export type CBlk = { counties: number; votes: number; mae: number; wmae: number; bias: number; shape_mae: number; within5: number };
export type LBlk = { n: number; right: number; share: number; bias: number; mae: number; brier: number };
export type LChamber = { id: string; st: string; name: string; seats: number; up: number; majority: number; fD: number; cD: number; cR: number; p10: number; p90: number; pD: number; fav: "D" | "R"; favp: number; aD: number; aR: number; aO: number; missing: number; ctrl: "D" | "R" | "none"; settled: boolean; right: boolean; in80: boolean | null; seat_err: number | null; districts: LBlk | null };
export type LWrong = { ch: string; st: string; house: string; dist: string; fm: number; pD: number; am: number; err: number; winner: "D" | "R"; pct: number; wp: number };
export type Acc = {
  built: string; results_asof: { federal: string; legislatures: string }; forecast: { frozen: string; source: string; sims: number };
  headline: Record<Office | "all", Head>; chambers: Record<Office, Chamber>; calib: Cal[];
  err_hist: { edges: number[]; counts: Record<Office, number[]> }; bands: (Blk & { lo: number; hi: number })[];
  states: Record<string, { n: number; bias: number; races: { id: string; err: number }[] }>;
  counties: { all: CBlk; races: number; area: (CBlk & { k: string })[]; region: (CBlk & { k: string })[]; by_race: (CBlk & { id: string })[];
    worst: { race: string; county: string; st: string; fm: number; act: number; err: number; votes: number }[]; hist: { edges: number[]; counts: number[] } };
  legislatures: { scored: LBlk; scored_final: LBlk; called: number; called_right: number; uncontested: number; one_party: number;
    chambers: { n: number; complete: number; settled: number; right: number; in80: number; seat_mae: number; seat_bias: number };
    calib: Cal[]; bands: (LBlk & { lo: number; hi: number })[]; lean: (LBlk & { lo: number; hi: number })[]; states: (LBlk & { st: string })[];
    chamber_rows: LChamber[]; wrong: LWrong[] };
  excluded: { id: string; name: string; why: string }[]; one_party: number; races: Race[];
};

let cache: Acc | null = null;
export function getAcc(): Acc {
  if (!cache) cache = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/accuracy/2026.json"), "utf8")) as Acc;
  return cache;
}

export * from "./fmt";

// The frozen forecast and where anyone can check it.
export const FROZEN_DIR = "/forecast/archive/final-2026-11-03";
/** The public repository whose history shows each file's commit time. Set to null to hide the history links. */
export const PROOF_REPO: string | null = "https://github.com/undergroundmantech/thepublicsentimentinstitute";
export const historyHref = (livePath: string) => (PROOF_REPO ? `${PROOF_REPO}/commits/main/public${livePath}` : null);
export const WAYBACK = "https://web.archive.org/web/20261101000000*/onpointpolitics.com/forecast*";

export type Manifest = { title: string; frozen: string; forecast_updated: string; election: string; polls_first_close_utc: string; last_written_utc: string; bundle_sha256: string; bundle_rule: string;
  files: { file: string; live_path: string; what: string; bytes: number; sha256: string; written_utc: string }[] };
export function getManifest(): Manifest {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", FROZEN_DIR, "manifest.json"), "utf8")) as Manifest;
}
