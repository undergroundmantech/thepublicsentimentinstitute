// Shared types + scales for the forecast desk.

export type Office = "governor" | "senate" | "house";
export type ViewMode = "margin" | "odds" | "rating";

export interface RaceSide {
  margin: number; // GOP-positive margin, pts
  prob: number;   // GOP win probability
  p10: number;
  p90: number;
  dist?: { lo: number; w: number; c: number[] }; // simulated margin histogram: first bin at lo, bin width w
}

// Every candidate the model prices, not just the two major party names. 233 of the
// 506 races run a third candidate, and in Rhode Island the independent is projected
// ahead of the Republican, so a two name view of that race is simply wrong.
export interface Cand {
  name: string;
  party: string;
  pct: number;
  votes: number;
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
  cands?: Cand[];
  inc: number;
  open: boolean;
  marquee: boolean;
  pvi: number;
  elast: number;
  fundamentals: number;
  stages: { anchor: number; fund: number; poll: number; rate: number; market: number };
  pollAvg: number | null;
  /** "lowess": the LOWESS Election Day polling average fed the race; "psi": the PSI weighted average */
  pollLevel?: "lowess" | "psi" | null;
  /** the PSI weighted average, GOP positive, kept beside a LOWESS level */
  pollPsi?: number | null;
  enop: number;
  wPoll: number;
  wMkt: number;
  market: { q: number; liquidity: number } | null;
  ratings: { outlet: string; cat: string }[];
  // one estimate per race: the complete model, all six stages
  est: RaceSide;
  // projected vote for the race as a whole, so a tooltip can show counts, not just shares
  votes?: { dem: number; rep: number; other: number; total: number };
  // ranked choice races carry their final round as well as their first choice
  rcv?: { dem: number; rep: number; demPct: number; repPct: number; exhausted: number; firstChoice: number } | null;
  polls: { pollster: string; kind: string; age: number; n: number; margin: number; grade?: string }[];
  similar: { id: string; corr: number }[];
  trend: { m: number; p: number }[];
}

export interface Chamber {
  office: Office;
  seatsTotal: number;
  gopControl: number;
  demControl: number;
  gopSeats: number;   // simulation average
  demSeats: number;   // simulation average
  // the seat by seat call: every race given to its projected winner, which is
  // what the OnPoint pages print and is not the same as the average above
  projD: number;
  projR: number;
  hist: [number, number][];
  demP10: number;
  demP90: number;
  // the median of the published OnPoint run, stamped by the build so the desk
  // prints the same figure the artifact pages do rather than re-deriving it
  median?: number;
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

// counties.json: fips -> [GOP-positive margin, Democratic votes, Republican votes, total votes].
// County names sit once under _n; a state's House counties sit under house-<ST>,
// shared by every district in that state.
// A fifth slot appears only where a race runs more than two named candidates:
// that county's share for each of them, in the same order as Race.cands.
export type CountyRow = [number, number, number, number, number[]?];
export interface CountiesPayload {
  _n?: Record<string, string>;
  _reg?: string[];
  [key: string]: Record<string, CountyRow> | Record<string, string> | string[] | undefined;
}

// The estimated exit poll each statewide page carries, read off the simulated
// voter file rather than asked of anyone: [category, group, share of projected
// voters, Democrat, Republican, everyone else], all percentages. Keyed by race id.
export type CrosstabRow = [string, string, number, number, number, number];
export type Crosstabs = Record<string, CrosstabRow[]>;

export interface StateDetail {
  st: string;
  counties: { id: string; d: string }[];
  districts: { id: string; d: string }[];
}

export interface Model {
  meta: {
    updated: string; election: string; daysOut: number; npe: number; genericBallot: GenericBallot; sims: number;
    senNotUpR: number; senNotUpD: number;
    // governorships not on the 2026 ballot, counted into the chamber like the Senate's
    govNotUpR: number; govNotUpD: number; govOnBallot: number;
  };
  chambers: Record<Office, Chamber>;
  races: Race[];
}

// Brand tokens, mirrored from app/globals.css so values computed in JS (map
// fills, chart strokes) match the CSS custom properties exactly. Dark only.
export const INK = "#f3eff8";
// No brand accent survives here: UI state is white and ink, and colour is data.
export const LIME = INK;
export const DEM = "#3d7bff";   // --dem
export const GOP = "#ff3b5c";   // --gop
// Independents take the brand lavender, which is reserved for them.
export const IND = "#b78cff";   // --ind
// Minor party tones, kept outside the red, blue, lavender and gold ranges so a
// Libertarian or Green never reads as a major party or as a toss up.
export const LIB = "#c98a5a";
export const GRN = "#4fb58a";
export const OTH = "#8e86a3";   // --mute

export function partyColor(p: string): string {
  switch ((p || "").toUpperCase()) {
    case "D": case "DFL": return DEM;
    case "R": return GOP;
    case "I": case "IP": case "NPA": case "UC": case "IND": return IND;
    case "L": return LIB;
    case "G": case "PG": return GRN;
    default: return OTH;
  }
}

const PARTY_NAMES: Record<string, string> = {
  D: "Democrat", DFL: "Democratic-Farmer-Labor", R: "Republican", I: "Independent",
  IND: "Independent", IP: "Independence", NPA: "No party affiliation", L: "Libertarian",
  G: "Green", PG: "Pacific Green", C: "Constitution", UC: "United Citizens",
  SWP: "Socialist Workers", WP: "Working Families", FWD: "Forward", AP: "Alliance",
  NL: "No Labels", ACN: "Approval Voting", O: "Other",
};
export function partyLabel(p: string): string {
  const k = (p || "").toUpperCase();
  return PARTY_NAMES[k] || (k === "" ? "Other" : k);
}

// ── rating bands (the brand ramp, app/lib/opp.ts) ───────────────────────────
// Under 2 points is a toss up, 2 to 6 lean, 6 to 12 likely, 12 or more safe.
// Pale for close, deep for solid. The toss up band is split at zero into two
// entries so code that walks the scale can still tell which side of even a
// race sits on; both carry the same label and the same gold.
// Margins are GOP-positive throughout.
export const RATING_BANDS = [
  { cat: "Safe R", lo: 12, hi: 999, color: "#b0163a" },
  { cat: "Likely R", lo: 6, hi: 12, color: "#ff3b5c" },
  { cat: "Lean R", lo: 2, hi: 6, color: "#ffb3c0" },
  { cat: "Toss up", lo: 0, hi: 2, color: "#e7b341" },
  { cat: "Toss up", lo: -2, hi: 0, color: "#e7b341" },
  { cat: "Lean D", lo: -6, hi: -2, color: "#a6c2ff" },
  { cat: "Likely D", lo: -12, hi: -6, color: "#3d7bff" },
  { cat: "Safe D", lo: -999, hi: -12, color: "#1a3fb0" },
] as const;
const TOSS_R = 3, TOSS_D = 4;
/** One entry per rating, Safe D through Safe R, for legends. */
export const RATING_LEGEND: [string, string][] = [...RATING_BANDS].reverse()
  .filter((b, i, a) => a.findIndex((x) => x.cat === b.cat) === i)
  .map((b) => [b.cat, b.color]);

export function ratingFor(margin: number, ind = false) {
  const m = Number.isFinite(margin) ? margin : 0;
  const band = RATING_BANDS.find((b) => m >= b.lo && m < b.hi) ?? RATING_BANDS[m > 0 ? TOSS_R : TOSS_D];
  // Where the non-Republican side is an independent, a band that says "Lean D" names the
  // wrong party. Same cut points, same strength word, the independent lavender.
  if (!ind || m >= 0) return band;
  return { ...band, cat: band.cat.replace(/ D$/, " I"), color: IND };
}

/** Colour for an outside rating as the outlet prints it: "Toss-up", "Tilt D", "Lean R". */
export function outletColor(cat: string): string | null {
  const c = cat.trim().toLowerCase().replace(/[-\s]+/g, " ");
  if (/^(toss ?up|tilt [dri])$/.test(c)) return RATING_BANDS[TOSS_R].color;
  const hit = RATING_BANDS.find((b) => b.cat.toLowerCase() === c);
  if (hit) return hit.color;
  if (/ i$/.test(c)) return IND;
  return null;
}

function hexLerp(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

// ── margin scale: the brand county ramp (opp-ui maps.md) ────────────────────
// Pale for close, deep for solid, interpolated by |margin| / 40, changing party
// at zero rather than passing through a neutral colour.
export const D_PALE = "#d6e2ff", D_DEEP = "#10288c";   // --county-d-pale, --county-d-deep
export const R_PALE = "#ffdce4", R_DEEP = "#8c0a28";   // --county-r-pale, --county-r-deep
export const I_PALE = "#ebe0ff", I_DEEP = "#4b2a86";   // the same ramp on the independent lavender
export const MARGIN_RAMP_CSS = "linear-gradient(90deg,#10288c 0%,#3d7bff 25%,#d6e2ff 48%,#ffdce4 52%,#ff3b5c 75%,#8c0a28 100%)";
export function marginColor(m: number) {
  const a = Math.min(40, Math.abs(Number.isFinite(m) ? m : 0)) / 40;
  return m < 0 ? hexLerp(D_PALE, D_DEEP, a) : hexLerp(R_PALE, R_DEEP, a);
}

// ── odds scale: certainty of the favorite, on the same endpoints ────────────
export const TILT_D_TONE = D_PALE;
export const TILT_R_TONE = R_PALE;
export const ODDS_RAMP_CSS = `linear-gradient(90deg,${D_DEEP} 0%,${D_PALE} 49%,${R_PALE} 51%,${R_DEEP} 100%)`;
export function oddsColor(gopProb: number) {
  const p = Math.max(0.001, Math.min(0.999, gopProb));
  if (p > 0.5) return hexLerp(R_PALE, R_DEEP, Math.min(1, (p - 0.5) / 0.48));
  return hexLerp(D_PALE, D_DEEP, Math.min(1, (0.5 - p) / 0.48));
}

// Text laid on one of these fills has to flip with the fill: the pale shades are
// light enough that white on them is unreadable, so they take the dark label ink.
export function inkOn(hex: string) {
  const c = hex.trim().replace("#", "");
  if (c.length < 6) return INK;
  const lin = (v: number) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
  const [r, g, b] = [0, 2, 4].map((i) => lin(parseInt(c.slice(i, i + 2), 16) / 255));
  const L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return (L + 0.05) / 0.05 >= 1.05 / (L + 0.05) ? "#1a1030" : INK;
}

// ── who is actually on each side of a race ──────────────────────────────────
// The build puts whoever is not the Republican into the `dem` slot, so Dan Osborn,
// Brian Bengs, Todd Achilles and Seth Bodnar were all drawn in Democratic blue and
// labelled "Democrat". Read the party off the candidate list instead of trusting the
// slot, and fall back to the slot only where a race carries no candidate list.
const IND_CODES = new Set(["I", "IND", "IP", "NPA", "UC"]);

export function sideParty(r: Race, side: "dem" | "gop"): string {
  const nm = side === "dem" ? r.dem : r.gop;
  const hit = r.cands?.find((c) => c.name === nm);
  return hit ? (hit.party || "").toUpperCase() : side === "dem" ? "D" : "R";
}
/** True where the non-Republican side of the race is an independent, not a Democrat. */
export const indSide = (r: Race) => IND_CODES.has(sideParty(r, "dem"));
export const sideColor = (r: Race, side: "dem" | "gop") => partyColor(sideParty(r, side));
export const sideLabel = (r: Race, side: "dem" | "gop") => partyLabel(sideParty(r, side));
/** One letter for the margin string: D+4.1, R+2.0, I+1.3. */
export const sideInitial = (r: Race, side: "dem" | "gop") =>
  indSide(r) && side === "dem" ? "I" : side === "dem" ? "D" : "R";

/** fmtMargin, but naming the side that is actually there. */
export const fmtRaceMargin = (r: Race, m: number) =>
  Math.abs(m) < 0.05 ? "Even"
    : m > 0 ? `${sideInitial(r, "gop")}+${Math.abs(m).toFixed(1)}`
            : `${sideInitial(r, "dem")}+${Math.abs(m).toFixed(1)}`;

/** The margin ramp, with the left-hand end swung to the independent lavender where the
 *  left-hand candidate is an independent. The right-hand half is untouched. */
export function raceMarginColor(r: Race, m: number) {
  const base = marginColor(m);
  if (!indSide(r) || m >= 0) return base;
  // Depth of the blue end, 0 at the midline to 1 at 40 points, applied to lavender.
  return hexLerp(I_PALE, I_DEEP, Math.min(40, Math.abs(m)) / 40);
}

export function raceColor(r: Race, view: ViewMode) {
  const side = r.est;
  if (view === "margin") return raceMarginColor(r, side.margin);
  if (view === "odds") return indSide(r) && side.prob < 0.5
    ? hexLerp(I_PALE, I_DEEP, Math.min(1, (0.5 - side.prob) / 0.48))
    : oddsColor(side.prob);
  return ratingFor(side.margin, indSide(r)).color;
}

// Never print certainty — a 10,000-sim forecast rounds to 100%/0% long before
// the tails are actually empty, so extremes are pinned to >99% / <1%.
export const fmtPct = (p: number, dp = 0) => {
  const hi = 1 - 0.005 * 10 ** -dp;
  // >= rather than >: 0.995 exactly otherwise printed as "100%", the one figure this
  // guard exists to keep off the page (Alaska Governor, Sept 25).
  if (p >= hi) return ">99%";
  if (p <= 1 - hi) return "<1%";
  return `${(p * 100).toFixed(dp)}%`;
};
export const fmtMargin = (m: number) =>
  Math.abs(m) < 0.05 ? "Even" : m > 0 ? `R+${Math.abs(m).toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`;
// Last name for the compact labels. A generational suffix is not a surname, and
// neither is the tail of a particle name, so "Ashley Moody Jr." reads Moody and
// "Sandra Van Scotter" reads Van Scotter.
const SUFFIX = /^(jr|sr|ii|iii|iv|v)\.?$/i;
const PARTICLE = /^(van|von|de|del|della|di|da|du|la|le|st|st\.|saint|mac|el|al|bin|ibn)$/i;
/** Not a person: the build puts a sentence in the empty slot of an unopposed race.
 *  Taking a "surname" off it produced an opponent called "ballot". */
export const isPlaceholderName = (n: string) => /\bon the ballot\s*$/i.test(n.trim());

/** A race the model never actually simulated: one slot is empty or both finalists
 *  come from the same party, so the build parks it at a full 100-point margin with
 *  no candidate list. It is a statement about the ballot, not a forecast, and the
 *  desk must not dress it up as one. */
export const isUncontested = (r: { cands?: { name: string }[]; est: { margin: number } }) =>
  !r.cands?.length && Math.abs(r.est.margin) >= 100;

export const surname = (n: string) => {
  if (isPlaceholderName(n)) return n.trim();
  const parts = n.trim().split(/\s+/).filter(Boolean);
  while (parts.length > 1 && SUFFIX.test(parts[parts.length - 1])) parts.pop();
  if (!parts.length) return n;
  let i = parts.length - 1;
  while (i > 0 && PARTICLE.test(parts[i - 1])) i--;
  return parts.slice(i).join(" ");
};
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
