// 2026 state legislative forecast: every partisan chamber on the 2026 ballot, district by district.
// Built by scripts/forecast/statehouse/build_statehouse.py into public/forecast/statehouse.json
// (and the compact statehouse_hub.json the forecast hub reads in the browser).
import fs from "node:fs";
import path from "node:path";

export type SLPoll = { pollster: string; end: string; D: number; R: number; n?: number | null };
export type SLDistrict = {
  d: string; seats: number; margin: number | null; probD: number | null; lean: number | null; leanSrc: string | null;
  last: { year: number | null; d2: number | null; won: string[] | null } | null;
  status: string; prim: number | null; polls: SLPoll[] | null; dem?: string | null; gop?: string | null; winner?: string | null;
};
export type SLChamber = {
  id: string; st: string; state: string; chamber: "house" | "senate"; name: string; seats: number; up: number; majority: number;
  hold: Record<"D" | "R" | "O", number>; missing: number; filled: number; current: Record<"D" | "R" | "O", number>;
  demControl: number; gopControl: number; tie: number; demSeats: number; gopSeats: number; p10: number; p90: number; median: number;
  hist: [number, number][];
  env: { pres24: number; house26: number; shift: number; genericPolls: { source: string; end: string; D: number; R: number }[]; genericWeight: number };
  districts: SLDistrict[];
};
export type SLData = { meta: { updated: string; chambers: number; sims: number; districts: number; seatsUp: number; method: string }; chambers: SLChamber[] };

let cache: SLData | null = null;
export const getStatehouse = (): SLData =>
  (cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "statehouse.json"), "utf8")) as SLData);

export const slHref = (c: Pick<SLChamber, "st" | "chamber">) => `/forecast/legislatures/${c.st.toLowerCase()}/${c.chamber}`;

/** Party that holds a majority after 2024, or null when nobody does. */
export function currentMajority(c: Pick<SLChamber, "current" | "majority">): "D" | "R" | null {
  return c.current.D >= c.majority ? "D" : c.current.R >= c.majority ? "R" : null;
}

/** Control odds band, the same seven step scale the race ratings use. */
export function controlBand(pD: number): "safeD" | "likelyD" | "leanD" | "toss" | "leanR" | "likelyR" | "safeR" {
  if (pD >= 0.95) return "safeD";
  if (pD >= 0.8) return "likelyD";
  if (pD >= 0.6) return "leanD";
  if (pD > 0.4) return "toss";
  if (pD > 0.2) return "leanR";
  if (pD > 0.05) return "likelyR";
  return "safeR";
}
export const BAND_LABEL = { safeD: "Safe D", likelyD: "Likely D", leanD: "Lean D", toss: "Toss up", leanR: "Lean R", likelyR: "Likely R", safeR: "Safe R" } as const;

/** Chambers with no partisan election in 2026, shown so the map has no holes. */
export const NOT_UP: Record<string, string> = {
  "NE-house": "Nebraska has one nonpartisan chamber", "NE-senate": "Nebraska has one nonpartisan chamber",
  "LA-house": "Louisiana elects its legislature in odd years", "LA-senate": "Louisiana elects its legislature in odd years",
  "MS-house": "Mississippi elects its legislature in odd years", "MS-senate": "Mississippi elects its legislature in odd years",
  "NJ-house": "New Jersey elects its legislature in odd years", "NJ-senate": "New Jersey elects its legislature in odd years",
  "VA-house": "Virginia elects its legislature in odd years", "VA-senate": "Virginia elects its legislature in odd years",
  "KS-senate": "The Kansas Senate is next elected in 2028", "NM-senate": "The New Mexico Senate is next elected in 2028",
  "SC-senate": "The South Carolina Senate is next elected in 2028",
};
