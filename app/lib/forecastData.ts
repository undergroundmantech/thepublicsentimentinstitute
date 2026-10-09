// Server side access to the forecast build in public/forecast. Read once per server process.
import fs from "node:fs";
import path from "node:path";

export type Cand = { name: string; party: string; pct: number; votes?: number };
export type FRace = {
  id: string; office: "senate" | "governor" | "house"; st: string; state: string; district: number; name: string;
  dem: string; gop: string; inc: number; open: boolean; marquee: boolean; pvi: number;
  stages: { anchor: number; fund: number; poll: number; rate: number; market: number };
  pollAvg: number | null; pollLevel?: string | null; pollPsi?: number | null; enop: number;
  est: { margin: number; prob: number; p10: number; p90: number; dist?: { lo: number; w: number; c: number[] } };
  votes?: { dem: number; rep: number; other: number; total: number };
  cands: Cand[]; rcv: unknown;
  polls?: { pollster: string; kind: string; age: number; n: number; margin: number }[];
  trend?: { m: number; p: number }[];
};
export type Chamber = {
  office: string; seatsTotal: number; gopControl: number; demControl: number; gopSeats: number; demSeats: number;
  hist: [number, number][]; demP10?: number; demP90?: number; median?: number;
};
export type Model = {
  meta: { updated: string; election: string; daysOut: number; npe: number; sims: number; senNotUpR: number; senNotUpD: number; govNotUpR: number; govNotUpD: number; genericBallot?: { avg: number; netApproval: number } };
  chambers: Record<"senate" | "governor" | "house", Chamber>;
  races: FRace[];
};

let cache: Model | null = null;
export function getModel(): Model {
  if (!cache) {
    const f = path.join(process.cwd(), "public", "forecast", "model.json");
    cache = JSON.parse(fs.readFileSync(f, "utf8")) as Model;
  }
  return cache;
}

/** The first candidate is an independent running in the Democratic slot. */
export const isInd = (r: Pick<FRace, "cands" | "stages">) =>
  !!r.cands?.[0] && r.cands[0].party === "IND" && r.stages.rate < 0;

/** Compact race summary the client map and lists need, keyed by state. */
export type MiniRace = { id: string; st: string; name: string; dem: string; gop: string; m: number; poll: number | null; open: boolean; ind: boolean; cands: Cand[]; prob: number };
export function miniRaces(office: "senate" | "governor"): Record<string, MiniRace> {
  const out: Record<string, MiniRace> = {};
  for (const r of getModel().races) {
    if (r.office !== office || out[r.st]) continue;
    out[r.st] = {
      id: r.id, st: r.st, name: r.name, dem: r.dem, gop: r.gop, m: r.stages.rate, poll: r.pollAvg,
      open: r.open, ind: isInd(r), cands: r.cands.slice(0, 4).map(({ name, party, pct }) => ({ name, party, pct })), prob: r.est?.prob ?? 0,
    };
  }
  return out;
}
