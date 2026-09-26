// Shapes returned by civicAPI's early vote feed, written from the live
// responses rather than from documentation.
//
//   /{ST}/capabilities                     which breakdowns exist, per category
//   /{ST}/{category}                       regions + statewide_total, {votes,color}
//   /{ST}/{category}/demographics?by={dim} flat {group: count} plus a total
//
// ST is a state abbreviation or "US", and on "US" the regions ARE the states,
// which is what the national view reads.

export type Category = "requested" | "returned" | "inperson";
export type Dimension = "party" | "gender" | "race" | "ethnicity" | "age";

export const CATEGORIES: { key: Category; label: string; blurb: string }[] = [
  { key: "requested", label: "Requested", blurb: "mail ballots requested" },
  { key: "returned",  label: "Returned",  blurb: "mail ballots returned" },
  { key: "inperson",  label: "In person", blurb: "ballots cast in person" },
];

export const DIMENSIONS: { key: Dimension; label: string }[] = [
  { key: "party", label: "Party" },
  { key: "gender", label: "Gender" },
  { key: "race", label: "Race" },
  { key: "ethnicity", label: "Ethnicity" },
  { key: "age", label: "Age" },
];

export type Capabilities = {
  state: string;
  provides: Record<Dimension, boolean>;
  categories: Record<string, Record<Dimension, boolean>>;
};

export type Bucket = { votes: number; color: string };
export type RegionRow = Record<string, Bucket>;

export type CategoryPayload = {
  state: string;
  category: string;
  election_name: string;
  snapshot_date: string;
  regions: Record<string, RegionRow>;
  statewide_total: RegionRow;
};

export type DemographicPayload = {
  state: string;
  category: string;
  snapshot_date: string;
  region: string | null;
  breakdown_by: string;
  values: Record<string, number>;
  total: number;
};

const API = "/api/earlyvote";

async function get<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API}/${path}`, { cache: "no-store" });
    if (!r.ok) return null;          // 400 means "not published", not an error
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export const getCapabilities = (st: string) => get<Capabilities>(`${st}/capabilities`);
export const getCategory = (st: string, c: Category) => get<CategoryPayload>(`${st}/${c}`);
export const getDemographics = (st: string, c: Category, by: Dimension) =>
  get<DemographicPayload>(`${st}/${c}/demographics?by=${by}`);

export const sumRow = (row: RegionRow | undefined) =>
  row ? Object.values(row).reduce((n, b) => n + (b?.votes ?? 0), 0) : 0;

export const commas = (n: number) => Math.round(n).toLocaleString("en-US");
export const pct = (v: number, t: number) => (t > 0 ? `${((v / t) * 100).toFixed(1)}%` : "—");

// The feed ships a colour with every bucket, but its party blues and reds are
// not the desk's. Party groups take the site palette so early vote reads like
// the rest of the site; anything else keeps the colour the feed sent.
const PARTY_TONE: Record<string, string> = {
  Democratic: "var(--dem)",
  Republican: "var(--gop)",
  "No Party Affiliation": "var(--muted2)",
  Independent: "var(--muted2)",
  "Other/Independent": "var(--muted2)",
  Libertarian: "var(--gold)",
  Green: "var(--win)",
  Other: "var(--muted3)",
  Unspecified: "var(--muted3)",
};
export const toneFor = (group: string, fallback?: string) =>
  PARTY_TONE[group] ?? fallback ?? "var(--muted2)";

export const STATE_NAME: Record<string, string> = {
  AL:"Alabama",AK:"Alaska",AZ:"Arizona",AR:"Arkansas",CA:"California",CO:"Colorado",CT:"Connecticut",
  DE:"Delaware",DC:"District of Columbia",FL:"Florida",GA:"Georgia",HI:"Hawaii",ID:"Idaho",IL:"Illinois",
  IN:"Indiana",IA:"Iowa",KS:"Kansas",KY:"Kentucky",LA:"Louisiana",ME:"Maine",MD:"Maryland",
  MA:"Massachusetts",MI:"Michigan",MN:"Minnesota",MS:"Mississippi",MO:"Missouri",MT:"Montana",
  NE:"Nebraska",NV:"Nevada",NH:"New Hampshire",NJ:"New Jersey",NM:"New Mexico",NY:"New York",
  NC:"North Carolina",ND:"North Dakota",OH:"Ohio",OK:"Oklahoma",OR:"Oregon",PA:"Pennsylvania",
  RI:"Rhode Island",SC:"South Carolina",SD:"South Dakota",TN:"Tennessee",TX:"Texas",UT:"Utah",
  VT:"Vermont",VA:"Virginia",WA:"Washington",WV:"West Virginia",WI:"Wisconsin",WY:"Wyoming",
};

/* ── geography ───────────────────────────────────────────────────────────── */

export type Geo = { frame: [number, number]; states: Record<string, string> };
export type StateGeo = { st: string; counties: { id: string; d: string }[] };

const FIPS_ST: Record<string, string> = {
  "01":"AL","02":"AK","04":"AZ","05":"AR","06":"CA","08":"CO","09":"CT","10":"DE","11":"DC","12":"FL",
  "13":"GA","15":"HI","16":"ID","17":"IL","18":"IN","19":"IA","20":"KS","21":"KY","22":"LA","23":"ME",
  "24":"MD","25":"MA","26":"MI","27":"MN","28":"MS","29":"MO","30":"MT","31":"NE","32":"NV","33":"NH",
  "34":"NJ","35":"NM","36":"NY","37":"NC","38":"ND","39":"OH","40":"OK","41":"OR","42":"PA","44":"RI",
  "45":"SC","46":"SD","47":"TN","48":"TX","49":"UT","50":"VT","51":"VA","53":"WA","54":"WV","55":"WI","56":"WY",
};
export const stateOfFips = (f: string) => FIPS_ST[f.slice(0, 2)] ?? "";

/**
 * Match a county name as the early vote feed writes it to a county in the
 * forecast's geography, which carries the full legal name.
 *
 * The county reading is tried before the city reading on purpose. Virginia has
 * both Charles City County and a set of independent cities, so "Charles City"
 * must land on the county while "Alexandria City" lands on the city, and
 * Fairfax and Richmond each exist as both.
 */
export function matchCounty(apiName: string, geoNames: Record<string, string>): string | null {
  const a = apiName.trim();
  const cands = [`${a} County`, a, `${a} Parish`, `${a} Borough`, `${a} Census Area`, `${a} Municipality`, `${a} city`];
  const m = /\s+city$/i.exec(a);
  if (m) {
    const base = a.replace(/\s+city$/i, "");
    cands.unshift(`${base} city`, `${base} City`);
  }
  for (const k of cands) if (geoNames[k]) return geoNames[k];
  const lower: Record<string, string> = {};
  for (const [k, v] of Object.entries(geoNames)) lower[k.toLowerCase()] = v;
  for (const k of cands) { const hit = lower[k.toLowerCase()]; if (hit) return hit; }
  return null;
}

/** Two-party margin of a row, Republican positive, or null where the state
 *  reports no party at all. */
export function marginOf(row: RegionRow | undefined): number | null {
  if (!row) return null;
  const d = row["Democratic"]?.votes ?? 0;
  const r = row["Republican"]?.votes ?? 0;
  if (d + r <= 0) return null;
  return ((r - d) / (d + r)) * 100;
}

/**
 * Turnout intensity, for places that report ballots with no party attached.
 *
 * Twelve states send every ballot as Unspecified, so the two-party margin has
 * nothing to work with and the whole map used to go flat grey. Those places
 * are shaded green by their raw ballot count instead. Counts inside one state
 * run from a few dozen to tens of thousands, so the scale is logarithmic: on a
 * linear scale the largest county would be the only dark shape on the map.
 */
export type VolumeScale = { min: number; max: number; t: (v: number) => number };

export function volumeScale(values: number[]): VolumeScale | null {
  const v = values.filter((x) => x > 0);
  if (!v.length) return null;
  const min = Math.min(...v), max = Math.max(...v);
  const lo = Math.log10(min), hi = Math.log10(max);
  const span = hi - lo;
  return {
    min, max,
    t: (x: number) => (x <= 0 ? 0 : span <= 0 ? 1 : Math.max(0, Math.min(1, (Math.log10(x) - lo) / span))),
  };
}

/** Green sequential fill, 14% to 90% of the turnout tone over the map ground. */
export function turnoutFill(t: number): string {
  const pct = (14 + t * 76).toFixed(0);
  return `color-mix(in srgb, var(--ev-turnout) ${pct}%, var(--ev-mid))`;
}

/** 75205 reads as 75K, 1150 as 1.2K, 50 as 50. */
export function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(n >= 1e7 ? 0 : 1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(n >= 1e4 ? 0 : 1)}K`;
  return String(Math.round(n));
}

/** A diverging fill for that margin, drawn from the site's party tokens so it
 *  moves with the theme. Null margins get the neutral "no party data" tone. */
export function fillFor(margin: number | null): string {
  if (margin === null) return "var(--ev-nodata)";
  const t = Math.min(1, Math.abs(margin) / 40);          // saturate at 40 points
  const pct = (12 + t * 76).toFixed(0);                  // 12%..88% mix
  return margin > 0
    ? `color-mix(in srgb, var(--gop) ${pct}%, var(--ev-mid))`
    : `color-mix(in srgb, var(--dem) ${pct}%, var(--ev-mid))`;
}

/* ── TPSI party estimate for states that report no party ─────────────────────
 *
 * Built by scripts/earlyvote/build_party_model.py from the TPSI national
 * respondent database. Each draw is fourteen numbers refit on one bootstrap
 * resample of TPSI likely voters; the page runs every draw against the live
 * county counts, so the ranges below are simulation ranges, not decoration.
 */

export type PartyModel = {
  meta: {
    built: string; respondents: number; draws: number; paramKeys: string[];
    check: { st: string; modelMargin: number; lo: number; hi: number; reportedMargin: number }[];
  };
  point: number[];
  draws: number[][];
  counties: Record<string, [number, number]>;   // fips: [2024 Trump two party share, adults]
};

export const getPartyModel = () =>
  fetch("/earlyvote-party-model.json").then((r) => (r.ok ? (r.json() as Promise<PartyModel>) : null)).catch(() => null);

/** requested and returned are mail ballots; in person uses the early skew */
export const modeOf = (c: Category): "mail" | "early" => (c === "inperson" ? "early" : "mail");

/** Democratic, Republican and Independent shares for one county under one draw. */
export function partyShares(t: number, v: number[], mode: "mail" | "early"): [number, number, number] {
  const [swing, I, rD, rR, rI, mR, mRs, mI, mIs, eR, eRs, eI, eIs, xm] = v;
  // the early vote skew narrows as a county gets redder
  const x = Math.log(t / (1 - t)) - xm;
  const tt = Math.min(0.98, Math.max(0.02, t + swing));
  const R = Math.min(1 - I - 0.01, Math.max(0.01, (tt - rD * (1 - I) - rI * I) / (rR - rD)));
  const D = 1 - I - R;
  const sR = mode === "mail" ? mR + mRs * x : eR + eRs * x;
  const sI = mode === "mail" ? mI + mIs * x : eI + eIs * x;
  const eRr = (R / D) * Math.exp(sR), eIi = (I / D) * Math.exp(sI);
  const z = 1 + eRr + eIi;
  return [1 / z, eRr / z, eIi / z];
}

export type Estimate = {
  d: number; r: number; i: number;            // mean shares, 0..1
  margin: number;                              // R minus D, points, Republican positive
  lo: number; hi: number;                      // 80% range of that margin
  votes: number;
};

const q = (a: number[], p: number) => {
  const s = [...a].sort((x, y) => x - y);
  const k = (s.length - 1) * p, f = Math.floor(k);
  return s[f] + (s[Math.min(f + 1, s.length - 1)] - s[f]) * (k - f);
};

/**
 * Simulate a set of places, each a list of [county share, ballots] parts, and
 * return one estimate per place plus the total. A county is one part; a state
 * on the national map is its counties weighted by adults, then scaled to the
 * state's reported ballots.
 */
export function simulate(
  places: { key: string; parts: [number, number][]; votes: number }[],
  model: PartyModel, mode: "mail" | "early",
): { byKey: Record<string, Estimate>; total: Estimate | null } {
  const nD = model.draws.length;
  const byKey: Record<string, Estimate> = {};
  const totD = new Array(nD).fill(0), totR = new Array(nD).fill(0), totI = new Array(nD).fill(0);
  let totV = 0;
  for (const pl of places) {
    const w = pl.parts.reduce((s, p) => s + p[1], 0);
    if (w <= 0 || pl.votes <= 0) continue;
    const ms: number[] = []; let sd = 0, sr = 0, si = 0;
    model.draws.forEach((v, k) => {
      let d = 0, r = 0, i = 0;
      for (const [t, n] of pl.parts) { const s = partyShares(t, v, mode); d += s[0] * n; r += s[1] * n; i += s[2] * n; }
      d /= w; r /= w; i /= w;
      sd += d; sr += r; si += i; ms.push((r - d) * 100);
      totD[k] += d * pl.votes; totR[k] += r * pl.votes; totI[k] += i * pl.votes;
    });
    totV += pl.votes;
    byKey[pl.key] = { d: sd / nD, r: sr / nD, i: si / nD, margin: ((sr - sd) / nD) * 100,
      lo: q(ms, 0.1), hi: q(ms, 0.9), votes: pl.votes };
  }
  if (totV <= 0) return { byKey, total: null };
  const tm = totR.map((r, k) => ((r - totD[k]) / totV) * 100);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length / totV;
  return { byKey, total: { d: mean(totD), r: mean(totR), i: mean(totI),
    margin: tm.reduce((s, x) => s + x, 0) / nD, lo: q(tm, 0.1), hi: q(tm, 0.9), votes: totV } };
}

export const fmtMargin = (m: number) => (Math.abs(m) < 0.05 ? "EVEN" : m > 0 ? `R+${m.toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`);
