// Shared types + scales for the forecast desk.

export type Office = "governor" | "senate" | "house";
export type ModelKey = "legacy" | "complete";
export type ViewMode = "margin" | "odds" | "rating";

export interface RaceSide {
  margin: number; // GOP-positive margin, pts
  prob: number;   // GOP win probability
  p10: number;
  p90: number;
  dist?: { lo: number; w: number; c: number[] }; // simulated margin histogram: first bin at lo, bin width w
}

export interface Race {
  id: string;
  office: Office;
  st: string;
  state: string;
  district: number;
  name: string;
  dem: string;
  gop: string;
  inc: number;
  open: boolean;
  marquee: boolean;
  pvi: number;
  elast: number;
  fundamentals: number;
  stages: { anchor: number; fund: number; poll: number; rate: number; market: number };
  pollAvg: number | null;
  enop: number;
  wPoll: number;
  wMkt: number;
  market: { q: number; liquidity: number } | null;
  ratings: { outlet: string; cat: string }[];
  legacy: RaceSide;
  complete: RaceSide;
  polls: { pollster: string; kind: string; age: number; n: number; margin: number; grade?: string }[];
  similar: { id: string; corr: number }[];
  trend: { legacy: { m: number; p: number }[]; complete: { m: number; p: number }[] };
}

export interface Chamber {
  office: Office;
  seatsTotal: number;
  gopControl: number;
  demControl: number;
  gopSeats: number;
  demSeats: number;
  hist: [number, number][];
  demP10: number;
  demP90: number;
  trend: { t: number; dem: number; demSeats: number }[];
}

export interface GenericBallot {
  avg: number;
  prior: number;
  npe: number;
  netApproval: number;
  polls: { pollster: string; age: number; n: number; margin: number }[];
}

export interface Geo {
  frame: [number, number];
  states: Record<string, string>;
  box: Record<string, [number, number, number, number]>;
  districts: Record<string, { d: string | null; box: [number, number, number, number] | null }>;
  hexHouse: Record<string, [number, number]>;
  hexHouseR: number;
  hexStates: Record<string, [number, number]>;
  hexStatesR: number;
}

export interface StateDetail {
  st: string;
  counties: { id: string; d: string }[];
  districts: { id: string; d: string }[];
}

export interface Model {
  meta: { updated: string; election: string; daysOut: number; npe: number; genericBallot: GenericBallot; sims: number; senNotUpR: number; senNotUpD: number };
  chambers: Record<Office, Record<ModelKey, Chamber>>;
  races: Race[];
}

export const INK = "#f4f4ef";
export const LIME = "#b7ff00";
export const DEM = "#3b6fde";
export const GOP = "#e23950";
export const TOSS = "#8b5cf6";

// ── rating bands (identical to the build) ───────────────────────────────────
export const RATING_BANDS = [
  { cat: "Safe R", lo: 15, hi: 999, color: "#8f1f2b" },
  { cat: "Likely R", lo: 6.5, hi: 15, color: "#c22e3c" },
  { cat: "Lean R", lo: 2.5, hi: 6.5, color: "#e56471" },
  { cat: "Toss-up", lo: -2.5, hi: 2.5, color: TOSS },
  { cat: "Lean D", lo: -6.5, hi: -2.5, color: "#6f92e8" },
  { cat: "Likely D", lo: -15, hi: -6.5, color: "#2f5bc4" },
  { cat: "Safe D", lo: -999, hi: -15, color: "#1d3a85" },
] as const;

export function ratingFor(margin: number) {
  return RATING_BANDS.find((b) => margin >= b.lo && margin < b.hi) ?? RATING_BANDS[3];
}

// ── margin scale: banded diverging, desk tones ──────────────────────────────
const MARGIN_STOPS: [number, string][] = [
  [-30, "#16306f"], [-20, "#1d3f96"], [-10, "#2c56c4"], [-5, "#3b6fde"],
  [-2, "#7b8fe0"], [0, "#8b5cf6"], [2, "#e08a94"], [5, "#e23950"],
  [10, "#c22638"], [20, "#98182a"], [30, "#701020"],
];
function hexLerp(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}
export function marginColor(m: number) {
  const x = Math.max(-30, Math.min(30, m));
  for (let i = 0; i < MARGIN_STOPS.length - 1; i++) {
    const [x0, c0] = MARGIN_STOPS[i];
    const [x1, c1] = MARGIN_STOPS[i + 1];
    if (x >= x0 && x <= x1) return hexLerp(c0, c1, (x - x0) / (x1 - x0));
  }
  return MARGIN_STOPS[x < 0 ? 0 : MARGIN_STOPS.length - 1][1];
}

// ── odds scale: certainty of the favorite ────────────────────────────────────
export function oddsColor(gopProb: number) {
  const p = Math.max(0.001, Math.min(0.999, gopProb));
  if (p > 0.5) return hexLerp("#9b8bd4", "#a01426", Math.min(1, (p - 0.5) / 0.48));
  return hexLerp("#9b8bd4", "#183685", Math.min(1, (0.5 - p) / 0.48));
}

export function raceColor(r: Race, model: ModelKey, view: ViewMode) {
  const side = r[model];
  if (view === "margin") return marginColor(side.margin);
  if (view === "odds") return oddsColor(side.prob);
  return ratingFor(side.margin).color;
}

// Never print certainty — a 10,000-sim forecast rounds to 100%/0% long before
// the tails are actually empty, so extremes are pinned to >99% / <1%.
export const fmtPct = (p: number, dp = 0) => {
  const hi = 1 - 0.005 * 10 ** -dp;
  if (p > hi) return ">99%";
  if (p < 1 - hi) return "<1%";
  return `${(p * 100).toFixed(dp)}%`;
};
export const fmtMargin = (m: number) =>
  Math.abs(m) < 0.05 ? "Even" : m > 0 ? `R+${Math.abs(m).toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`;
export const surname = (n: string) => n.trim().split(/\s+/).pop() || n;
export const favParty = (m: number) => (m > 0 ? "gop" : "dem");

export const OFFICE_LABEL: Record<Office, string> = {
  governor: "Governors",
  senate: "Senate",
  house: "House",
};
export const OFFICE_HEAD: Record<Office, string> = {
  governor: "governors' mansions",
  senate: "the Senate",
  house: "the House",
};
