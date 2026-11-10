// 2028 forecast: shared types, number formats, colors and the in browser matchup simulation.
// Margins are Republican minus Democrat, so negative is a Democratic lead, the same as the 2026 forecast.
import fs from "node:fs";
import path from "node:path";

export type Cand = [number, Record<string, number>, number?];
export interface StateRow {
  m: number; p10: number; p90: number; pD: number; D: number; R: number; O: number; ev: number | null; tip: number;
  hist: number[]; reg: string | null; gen: number | null; mig: number | null; a24: number | null; a20: number | null;
  ph?: Record<string, number> | null; lr?: number | null; rt?: number | null;
}
export interface PrimField {
  party: "D" | "R"; names: string[]; nomination: Record<string, number>; votes: Record<string, number>; full: Record<string, number>;
  dropout: Record<string, number[]>; calendar: string[][];
  states: Record<string, { w: string; pw: number; sh: number; tot: number; tu?: boolean }>;
}
export interface Hub {
  coal: Coal;
  built: string; sims: { general: number; primary: number }; env: { nat28: number };
  general: {
    N: number; p_D_win: number; p_tie: number; mean_D_EV: number; p10_EV: number; p90_EV: number; ev_hist: number[];
    nat_margin: number; nat_p10: number; nat_p90: number; votes: { D: number; R: number; total: number };
    p_split_D_pop_R_ec: number; p_split_R_pop_D_ec: number;
    generation: { national_gen_shift: number; national_mig_shift: number; applied_national_part: number };
  };
  states: Record<string, StateRow>; dcand: Record<string, Cand>; rcand: Record<string, Cand>; pal: Record<string, string>; hypo: string[];
  gen: {
    national: { gen_shift: number; gen_deaths_aging: number; gen_new_voters: number; gen_drift: number; mig_shift: number };
    curve: Record<string, number>; genz: Record<string, number>; newShare: number; deathShare: number; moverPool: number; n: { r24: number; v28: number };
    age: [number, number, number][];
  };
  elect: { D: Record<string, number>; R: Record<string, number>; totals: { D: number; R: number }; rules: Record<string, unknown>; anchors: Record<string, { race: number[]; age: number[] }> };
  primMae: { D: number; R: number };
  prim: Record<"dem" | "dem_noharris" | "gop" | "gop_novance", PrimField>;
}
export interface County28 {
  id: string; n: string; m: number; p10: number; p90: number; pD: number; D: number; R: number; O: number; m24: number;
  gen: number; mig: number; newv: number; dV: number; rV: number;
}
export interface PrimState {
  share: Record<string, number>; win: Record<string, number>; votes: Record<string, number>; total: number; full: Record<string, number>;
  counties: Record<string, [number, number][]>;
  electorate: { black?: number; hisp?: number; asian: number; young: number; old: number; college: number; female: number; seg: Record<string, number> };
  hist: { year: string; votes: number | null; type: string; caucus: boolean; basis: string } | null; window: number; proxy?: string[] | null;
  field?: number | null; avg_share?: Record<string, number>;
}
export interface StateFile {
  st: string;
  path: { a24: number; base: number; gen: number; mig: number; final: number; deaths: number; newv: number; drift: number; newShare: number; tot24: number; tot28: number } | null;
  general: StateRow | null; districts: Record<string, StateRow>; counties: County28[];
  cds?: [string, number, number, number, number, number, string, string][];
  prim: Partial<Record<"dem" | "dem_noharris" | "gop" | "gop_novance", PrimState>>;
  gen: { gen_shift: number; mig_shift: number } | null;
  elect28?: [string, number, number][] | null;
}

const P = (...p: string[]) => path.join(process.cwd(), "public", "forecast", ...p);
let HUB: Hub | null = null;
export function getHub(): Hub { if (!HUB) HUB = JSON.parse(fs.readFileSync(P("2028", "hub.json"), "utf8")) as Hub; return HUB; }
export function getState(st: string): StateFile | null {
  try { return JSON.parse(fs.readFileSync(P("2028", "states", `${st.toUpperCase()}.json`), "utf8")) as StateFile; } catch { return null; }
}
export function stateCodes(): string[] {
  return fs.readdirSync(P("2028", "states")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, 2)).sort();
}

export const RACES = ["president", "democratic-primary", "republican-primary"] as const;
export type Race28 = (typeof RACES)[number];
export const RACE_LABEL: Record<Race28, string> = { president: "President", "democratic-primary": "Democratic primary", "republican-primary": "Republican primary" };
export const href28 = (st: string, race: Race28 = "president") => `/forecast/2028/${st.toLowerCase()}/${race}`;

export const fmtPct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
export const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtShift = (x: number) => (Math.abs(x) < 0.05 ? "No change" : `${Math.abs(x).toFixed(1)} toward ${x < 0 ? "D" : "R"}`);
export const fmtMg = (m: number, d = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(d)}`);
export type Coal = { D: Record<string, Record<string, number>>; R: Record<string, Record<string, number>> };
export const shiftFor = (dc: Record<string, Cand>, rc: Record<string, Cand>, d: string, r: string, st: string, coal?: Coal) => {
  const a = dc[d] ?? [0, {}], b = rc[r] ?? [0, {}], v = rc["Vance"] ?? [0, {}];
  // the published means are the generic Democrat against Vance, so Vance's own edge comes out first
  const cd = coal?.D[d]?.[st] ?? 0, cr = coal?.R[r]?.[st] ?? 0, cv = coal?.R["Vance"]?.[st] ?? 0;
  return a[0] + (a[1][st] ?? 0) + b[0] + (b[1][st] ?? 0) - v[0] - (v[1][st] ?? 0) + cd + cr - cv;
};
