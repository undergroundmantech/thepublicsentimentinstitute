// Shapes returned by civicAPI's early vote feed, written from the live
// responses rather than from documentation.
//
//   /{ST}/capabilities                     which breakdowns exist, per category
//   /{ST}/{category}                       regions + statewide_total, {votes,color}
//   /{ST}/{category}/demographics?by={dim} flat {group: count} plus a total
//
// ST is a state abbreviation or "US", and on "US" the regions ARE the states,
// which is what the national view reads.

export type Category = "requested" | "returned" | "inperson" | "voted";
/** the three categories the feed publishes; "voted" is built from two of them */
export type FeedCategory = Exclude<Category, "voted">;
export const FEED_CATEGORIES: FeedCategory[] = ["requested", "returned", "inperson"];
export type Dimension = "party" | "gender" | "race" | "ethnicity" | "age";

export const CATEGORIES: { key: Category; label: string; blurb: string }[] = [
  { key: "requested", label: "Requested", blurb: "mail ballots requested" },
  { key: "returned",  label: "Returned",  blurb: "mail ballots returned" },
  { key: "inperson",  label: "In person", blurb: "ballots cast in person" },
  { key: "voted",     label: "Fully voted", blurb: "returned mail plus in person, every ballot already cast" },
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
  /** only on "voted": the two feed payloads it was summed from */
  parts?: { returned: CategoryPayload | null; inperson: CategoryPayload | null };
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

/* ── "voted": returned mail ballots plus ballots cast in person ─────────────
 * Every ballot already cast. Built on the client by summing the two feed
 * categories bucket by bucket, so no new endpoint is needed. */
function addRow(into: RegionRow, row: RegionRow | undefined) {
  for (const [g, b] of Object.entries(row ?? {})) {
    const cur = into[g];
    into[g] = { votes: (cur?.votes ?? 0) + (b?.votes ?? 0), color: cur?.color ?? b?.color };
  }
}
export function mergeVoted(ret: CategoryPayload | null, inp: CategoryPayload | null): CategoryPayload | null {
  const base = ret ?? inp;
  if (!base) return null;
  const regions: Record<string, RegionRow> = {};
  for (const src of [ret, inp]) for (const [name, row] of Object.entries(src?.regions ?? {})) addRow(regions[name] ??= {}, row);
  const statewide_total: RegionRow = {};
  addRow(statewide_total, ret?.statewide_total); addRow(statewide_total, inp?.statewide_total);
  const snap = [ret?.snapshot_date, inp?.snapshot_date].filter(Boolean).sort().at(-1) ?? base.snapshot_date;
  return { ...base, category: "voted", snapshot_date: snap, regions, statewide_total, parts: { returned: ret, inperson: inp } };
}

export const getCapabilities = (st: string) => get<Capabilities>(`${st}/capabilities`).then((c) => {
  if (!c?.categories) return c;
  const r = c.categories.returned, i = c.categories.inperson;
  if (r || i) {
    const v = {} as Record<Dimension, boolean>;
    // a breakdown of "voted" needs both halves, unless the state only publishes one
    for (const d of DIMENSIONS.map((x) => x.key)) v[d] = r && i ? !!(r[d] && i[d]) : !!(r ?? i)?.[d];
    c.categories.voted = v;
  }
  return c;
});
export const getCategory = (st: string, c: Category): Promise<CategoryPayload | null> =>
  c === "voted"
    ? Promise.all([getCategory(st, "returned"), getCategory(st, "inperson")]).then(([r, i]) => mergeVoted(r, i))
    : get<CategoryPayload>(`${st}/${c}`);
export const getDemographics = (st: string, c: Category, by: Dimension): Promise<DemographicPayload | null> => {
  if (c !== "voted") return get<DemographicPayload>(`${st}/${c}/demographics?by=${by}`);
  return Promise.all([getDemographics(st, "returned", by), getDemographics(st, "inperson", by)]).then(([r, i]) => {
    if (!r || !i) return r ?? i;
    const values: Record<string, number> = { ...r.values };
    for (const [g, n] of Object.entries(i.values)) values[g] = (values[g] ?? 0) + n;
    return { ...r, category: "voted", values, total: r.total + i.total,
      snapshot_date: [r.snapshot_date, i.snapshot_date].sort().at(-1) ?? r.snapshot_date };
  });
};

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

/* ── ratings ──────────────────────────────────────────────────────────────────
 *
 * The map reads like the electoral map: every place gets a rating band, not a
 * continuous tint. Early vote margins run much wider than race margins, since a
 * mail electorate in a blue county can be sixty points Democratic, so the cut
 * points sit wider than the forecast's: Tilt under 5, Lean under 15, Likely
 * under 30, Safe from 30. Under a point is a toss-up.
 *
 * The colours step dark to light, Safe deepest and Tilt palest, and hold in
 * both themes, so a Safe county reads as the strongest shape whether the page
 * is light or dark. Neighbouring bands are far apart in lightness so the four
 * steps can be told apart at a glance.
 */
export type Rating = "SAFE" | "LIKELY" | "LEAN" | "TILT";
export const RATINGS: Rating[] = ["SAFE", "LIKELY", "LEAN", "TILT"];
export const RATING_WORD: Record<Rating, string> = { SAFE: "Safe", LIKELY: "Likely", LEAN: "Lean", TILT: "Tilt" };
export const EV_DEM: Record<Rating, string> = { SAFE: "#12348a", LIKELY: "#2f62d6", LEAN: "#6f9bf0", TILT: "#bdd1fa" };
export const EV_REP: Record<Rating, string> = { SAFE: "#8c1424", LIKELY: "#d0364a", LEAN: "#ef8089", TILT: "#fac6cb" };
export const EV_TOSS = "#a4a9b5";
export const EV_CUTS: [Rating, number][] = [["SAFE", 30], ["LIKELY", 15], ["LEAN", 5], ["TILT", 1]];

export type RatingInfo = { side: "D" | "R" | "T"; rating: Rating | null; label: string; color: string };
export function ratingOf(margin: number): RatingInfo {
  const a = Math.abs(margin);
  if (a < 1) return { side: "T", rating: null, label: "Toss-up", color: EV_TOSS };
  const side = margin > 0 ? "R" : "D";
  const rating = (EV_CUTS.find(([, lo]) => a >= lo) ?? EV_CUTS[3])[0];
  return { side, rating, label: `${RATING_WORD[rating]} ${side}`, color: (side === "R" ? EV_REP : EV_DEM)[rating] };
}

/** The rating colour for a margin, Republican positive. Null margins get the
 *  neutral "no party data" tone. */
export function fillFor(margin: number | null): string {
  if (margin === null) return "var(--ev-nodata)";
  return ratingOf(margin).color;
}

/* ── TPSI party estimate for states that report no party, version 2 ───────────
 *
 * Built by scripts/earlyvote/build_party_model.py from the forecast's simulated
 * 2026 electorate and the TPSI respondent file. Every county carries three party
 * mixes, Democratic, Republican and Independent: its mail voters, its early in
 * person voters, and the ballots it mails out, which in a universal mail state is
 * the voter file and elsewhere is its mail voters. Every simulation draw moves a
 * state's mixes by its own offsets in log odds, so the ranges are simulation
 * ranges.
 */

export type Regime = "universal" | "permanent" | "request" | "excuse";
export type DemoTable = { share: number[]; mix: number[][] };

export type PartyModel = {
  meta: {
    version: number; built: string; respondents: number; draws: number; forecast: string;
    modes: string[]; mailSkewScale: number; mailSkewScaleSd: number;
    calibration: { st: string; observed: number; uncalibrated: number; held_out: number; k_without: number }[];
    fileReturn: Record<string, number>; fallbackStates: string[];
    lv: Record<string, number[]>; registration: Record<string, number[]>;
    check: { st: string; modelMargin: number; lo: number; hi: number; reportedMargin: number; modelTilt: number; reportedTilt: number }[];
  };
  regime: Record<string, Regime>;
  point: number[];                                  // survey return prior: [Republican, Independent] vs Democratic
  draws: number[][];                                // the same, one pair per draw
  mix: Record<string, number[][]>;                  // fips: [mail, early, file] x [D, R, I]
  offsets: Record<string, number[][][]>;            // st: draw x [mail, early, file] x [R/D, I/D]
  demo: Record<string, Record<string, { age: DemoTable; race: DemoTable }>>;
  counties: Record<string, [number, number]>;       // fips: [2024 Trump two party share, adults]
};

export const getPartyModel = () =>
  fetch("/earlyvote-party-model.json")
    .then((r) => (r.ok ? (r.json() as Promise<PartyModel>) : null))
    .then((m) => (m && m.meta?.version === 2 ? m : null))
    .catch(() => null);

/** requested ballots read the mailed out mix; returned ballots the mail mix and
 *  then the party return rates; in person ballots the early mix */
export type Mode = "mail" | "returned" | "early";
// "voted" is estimated as its two halves (see mergeSims, mergeCombined); where a
// single mode is needed for display it reads as cast ballots, the early mix.
export const modeOf = (c: Category): Mode => (c === "inperson" || c === "voted" ? "early" : c === "returned" ? "returned" : "mail");
const MIX_INDEX: Record<Mode, number> = { mail: 2, returned: 0, early: 1 };

export const regimeOf = (model: PartyModel, st: string): Regime => model.regime[st] ?? "request";
export const REGIME_WORD: Record<Regime, string> = {
  universal: "every voter is mailed a ballot",
  permanent: "voters can join a permanent mail ballot list",
  request: "any voter can request a mail ballot",
  excuse: "a mail ballot needs an excuse, most often age",
};

/* demographic raking: the feed's own age or race counts reweight the estimate */
export type DemoAdjust = { dims: string[]; off: [number, number]; note: string } | null;

const AGE_EDGES = [18, 30, 45, 65, 120];
/** Spread one feed age band across the model's four bands by the years they share. */
function ageSplit(label: string): number[] | null {
  const nums = (label.match(/\d+/g) ?? []).map(Number);
  if (!nums.length) return null;
  let lo = nums[0], hi = nums.length > 1 ? nums[1] : NaN;
  if (/under|less than|</i.test(label)) { hi = lo - 1; lo = 18; }
  else if (/\+|over|older|and up/i.test(label) || !isFinite(hi)) hi = 99;
  lo = Math.max(18, lo); hi = Math.max(lo, hi);
  const w = [0, 0, 0, 0];
  for (let b = 0; b < 4; b++) {
    const a = Math.max(lo, AGE_EDGES[b]), z = Math.min(hi + 1, AGE_EDGES[b + 1]);
    w[b] = Math.max(0, z - a);
  }
  const s = w.reduce((x, y) => x + y, 0);
  return s > 0 ? w.map((x) => x / s) : null;
}
function raceBand(label: string): number | null {
  if (/unknown|not reported|undesignated|declined|unspecified/i.test(label)) return null;
  if (/hispanic|latin/i.test(label)) return 2;
  if (/black|african/i.test(label)) return 1;
  if (/^\s*white/i.test(label) || /caucasian/i.test(label)) return 0;
  return 3;
}

/** Reported shares in the model's four bands, or null when the labels cannot be read. */
export function bandShares(values: Record<string, number>, dim: "age" | "race"): number[] | null {
  const out = [0, 0, 0, 0]; let tot = 0, used = 0;
  for (const [k, v] of Object.entries(values)) {
    if (!(v > 0)) continue;
    tot += v;
    if (dim === "age") { const s = ageSplit(k); if (!s) continue; s.forEach((x, b) => (out[b] += x * v)); used += v; }
    else { const b = raceBand(k); if (b === null) continue; out[b] += v; used += v; }
  }
  if (used < 500 || used < 0.85 * tot) return null;
  return out.map((x) => x / used);
}

const lrOf = (m: number[]): [number, number] => [Math.log(m[1] / m[0]), Math.log(m[2] / m[0])];

/** Log odds offset that moves a state's estimate from the ages, or races, the model
 *  expects among these voters to the ones the feed reports. */
export function demoAdjust(model: PartyModel, st: string, mode: Mode,
  payloads: Partial<Record<"age" | "race", DemographicPayload | null>>): DemoAdjust {
  const tab = model.demo[st]?.[["mail", "early", "file"][MIX_INDEX[mode]]];
  if (!tab) return null;
  let off: [number, number] = [0, 0]; const dims: string[] = []; const notes: string[] = [];
  for (const dim of ["age", "race"] as const) {
    const p = payloads[dim]; if (!p) continue;
    const rep = bandShares(p.values, dim); if (!rep) continue;
    const t = tab[dim];
    const mixAt = (w: number[]) => [0, 1, 2].map((j) => w.reduce((s, x, b) => s + x * t.mix[b][j], 0));
    const a = lrOf(mixAt(rep)), b = lrOf(mixAt(t.share));
    off = [off[0] + a[0] - b[0], off[1] + a[1] - b[1]];
    dims.push(dim);
    const old = rep[3] * 100, exp = t.share[3] * 100;
    notes.push(dim === "age"
      ? `voters 65 and older are ${old.toFixed(1)}% of these ballots against ${exp.toFixed(1)}% expected`
      : `white voters are ${(rep[0] * 100).toFixed(1)}% of these ballots against ${(t.share[0] * 100).toFixed(1)}% expected`);
  }
  return dims.length ? { dims, off, note: notes.join("; ") } : null;
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

/** A county is one part: its fips, its ballots and, for returns, its return rate. */
export type Part = [fips: string, n: number, rho?: number];

/** A state's counties weighted by adults, for places the feed does not break down. */
export function stateParts(model: PartyModel, st: string, rho?: number): Part[] {
  const out: Part[] = [];
  for (const [f, [, a]] of Object.entries(model.counties)) if (stateOfFips(f) === st && model.mix[f]) out.push([f, a, rho]);
  return out;
}

const shift = (m: number[], o: [number, number]): [number, number, number] => {
  const d0 = Math.max(m[0], 1e-3);
  const a = (Math.max(m[1], 1e-3) / d0) * Math.exp(o[0]), b = (Math.max(m[2], 1e-3) / d0) * Math.exp(o[1]); const z = 1 + a + b;
  return [1 / z, a / z, b / z];
};

/** Democratic, Republican and Independent shares for one county under one draw. */
export function countyShares(model: PartyModel, fips: string, st: string, mode: Mode, k: number,
  extra: [number, number] = [0, 0]): [number, number, number] | null {
  const m = model.mix[fips]; if (!m) return null;
  const mi = MIX_INDEX[mode];
  const o = model.offsets[st]?.[k]?.[mi] ?? [0, 0];
  return shift(m[mi], [o[0] + extra[0], o[1] + extra[1]]);
}

export type Place = { key: string; st: string; parts: Part[]; votes: number };

/**
 * Simulate a set of places and return one estimate per place plus the total.
 * Returned ballots start from the county's eventual mail voters and are then
 * tilted by party return rates. In a universal mail state a county's returns are
 * read against the share of mailed ballots that will ever come back, not against
 * every ballot mailed, so the tilt fades as returns approach turnout.
 */
export function simulate(
  places: Place[], model: PartyModel, mode: Mode, tilt?: ReturnTilt | null,
  adjust?: Record<string, DemoAdjust>,
): { byKey: Record<string, Estimate>; total: Estimate | null; draws: { d: number[]; r: number[]; i: number[] } } {
  const nD = model.draws.length;
  const byKey: Record<string, Estimate> = {};
  const totD = new Array(nD).fill(0), totR = new Array(nD).fill(0), totI = new Array(nD).fill(0);
  let totV = 0;
  for (const pl of places) {
    const w = pl.parts.reduce((s, p) => s + (model.mix[p[0]] ? p[1] : 0), 0);
    if (w <= 0 || pl.votes <= 0) continue;
    const uni = regimeOf(model, pl.st) === "universal";
    const fr = uni ? model.meta.fileReturn[pl.st] ?? 0.65 : 1;
    const ex = adjust?.[pl.st]?.off ?? [0, 0];
    const ms: number[] = []; let sd = 0, sr = 0, si = 0;
    for (let k = 0; k < nD; k++) {
      let d = 0, r = 0, i = 0;
      const b = mode === "returned" ? tiltDraw(tilt, model, k, uni) : null;
      for (const [f, n, rho] of pl.parts) {
        let s = countyShares(model, f, pl.st, mode, k, ex); if (!s) continue;
        if (b) s = returnedMix(s, rho === undefined ? undefined : rho / fr, b);
        d += s[0] * n; r += s[1] * n; i += s[2] * n;
      }
      d /= w; r /= w; i /= w;
      sd += d; sr += r; si += i; ms.push((r - d) * 100);
      totD[k] += d * pl.votes; totR[k] += r * pl.votes; totI[k] += i * pl.votes;
    }
    totV += pl.votes;
    byKey[pl.key] = { d: sd / nD, r: sr / nD, i: si / nD, margin: ((sr - sd) / nD) * 100,
      lo: q(ms, 0.1), hi: q(ms, 0.9), votes: pl.votes };
  }
  const draws = { d: totD, r: totR, i: totI };      // estimated ballots by party, per draw
  if (totV <= 0) return { byKey, total: null, draws };
  const tm = totR.map((r, k) => ((r - totD[k]) / totV) * 100);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length / totV;
  return { byKey, total: { d: mean(totD), r: mean(totR), i: mean(totI),
    margin: tm.reduce((s, x) => s + x, 0) / nD, lo: q(tm, 0.1), hi: q(tm, 0.9), votes: totV }, draws };
}

export const fmtMargin = (m: number) => (Math.abs(m) < 0.05 ? "EVEN" : m > 0 ? `R+${m.toFixed(1)}` : `D+${Math.abs(m).toFixed(1)}`);

/* ── nationwide: reported party plus the TPSI estimate ──────────────────────
 *
 * One number per category for the whole country. Ballots a state reports with
 * a party are counted as reported: Democratic, Republican, and every other
 * label as Independent or other. Ballots reported as Unspecified are estimated.
 * A state with no party at all is estimated from its own county counts when
 * those have loaded, the same way the state page does, so the two agree; until
 * then, and for the Unspecified remainder inside a party state, its counties
 * are weighted by adults.
 */

export type Combined = {
  total: number;
  reported: { d: number; r: number; o: number; votes: number; states: number };
  estimated: { votes: number; states: number; countyWeighted: number };
  d: number; r: number; o: number;          // final ballots, reported plus mean estimate
  margin: number; lo: number; hi: number;   // R minus D, points, 80% range from the estimate
  dk: number[]; rk: number[];               // Democratic and Republican ballots per draw, reported plus estimated
};

export function combineNational(
  us: CategoryPayload, counties: Record<string, CategoryPayload | null | undefined>,
  model: PartyModel, countyNames: Record<string, string> | null, mode: Mode,
  // for returned ballots: the same places' requests, and the party return offsets
  req?: { us: CategoryPayload | null | undefined; counties: Record<string, CategoryPayload | null | undefined> },
  tilt?: ReturnTilt | null,
): Combined | null {
  let rd = 0, rr = 0, ro = 0, repStates = 0, estStates = 0, countyWeighted = 0;
  const places: Place[] = [];
  for (const [st, row] of Object.entries(us.regions)) {
    let d = 0, r = 0, o = 0, u = 0;
    for (const [g, b] of Object.entries(row)) {
      const v = b?.votes ?? 0;
      if (g === "Democratic") d += v; else if (g === "Republican") r += v;
      else if (g === "Unspecified") u += v; else o += v;
    }
    if (d + r + o > 0) { rd += d; rr += r; ro += o; repStates++; }
    if (u <= 0) continue;
    estStates += d + r + o > 0 ? 0 : 1;
    const cp = d + r + o > 0 ? null : counties[st];
    // a returned ballot's place return rate: its returns over its requests
    const reqU = req ? splitRow(req.us?.regions[st]).u : 0;
    const stateRho = mode === "returned" && reqU > 0 ? u / reqU : undefined;
    if (cp && countyNames && Object.keys(cp.regions).length) {
      const local: Record<string, string> = {};
      for (const [f, nm] of Object.entries(countyNames)) if (stateOfFips(f) === st) local[nm] = f;
      const reqC = req?.counties[st]?.regions;
      const parts: Part[] = [];
      for (const [name, crow] of Object.entries(cp.regions)) {
        const n = sumRow(crow); if (n <= 0) continue;
        const f = matchCounty(name, local);
        const qq = reqC ? sumRow(reqC[name]) : 0;
        const rho = mode === "returned" ? (qq > 0 ? n / qq : stateRho) : undefined;
        if (f && model.mix[f]) parts.push([f, n, rho]);
        else for (const [ff, a] of stateParts(model, st, rho)) parts.push([ff, (n * a) / Math.max(1, stateAdults(model, st)), rho]);
      }
      if (parts.length) { places.push({ key: st, st, parts, votes: u }); countyWeighted++; continue; }
    }
    places.push({ key: st, st, parts: stateParts(model, st, stateRho), votes: u });
  }

  const sim = simulate(places, model, mode, tilt);
  const estVotes = sim.total?.votes ?? 0;
  const total = rd + rr + ro + estVotes;
  if (total <= 0) return null;
  const nD = model.draws.length;
  const mg = sim.draws.d.map((ed, k) => ((rr + sim.draws.r[k] - rd - ed) / total) * 100);
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / nD;
  const ed = estVotes ? mean(sim.draws.d) : 0, er = estVotes ? mean(sim.draws.r) : 0, ei = estVotes ? mean(sim.draws.i) : 0;
  return {
    total,
    reported: { d: rd, r: rr, o: ro, votes: rd + rr + ro, states: repStates },
    estimated: { votes: estVotes, states: estStates, countyWeighted },
    d: rd + ed, r: rr + er, o: ro + ei,
    margin: mean(mg), lo: q(mg, 0.1), hi: q(mg, 0.9),
    dk: sim.draws.d.map((x) => rd + (estVotes ? x : 0)), rk: sim.draws.r.map((x) => rr + (estVotes ? x : 0)),
  };
}

/** nationwide "voted": returned plus in person, summed draw by draw so the range stays exact */
export function mergeCombined(a: Combined | null | undefined, b: Combined | null | undefined): Combined | null {
  if (!a || !b) return a ?? b ?? null;
  const total = a.total + b.total;
  const mg = a.dk.map((d, k) => ((a.rk[k] + b.rk[k] - d - b.dk[k]) / total) * 100);
  return {
    total,
    reported: { d: a.reported.d + b.reported.d, r: a.reported.r + b.reported.r, o: a.reported.o + b.reported.o,
      votes: a.reported.votes + b.reported.votes, states: Math.max(a.reported.states, b.reported.states) },
    estimated: { votes: a.estimated.votes + b.estimated.votes, states: Math.max(a.estimated.states, b.estimated.states),
      countyWeighted: Math.max(a.estimated.countyWeighted, b.estimated.countyWeighted) },
    d: a.d + b.d, r: a.r + b.r, o: a.o + b.o,
    margin: mg.reduce((s, x) => s + x, 0) / mg.length, lo: q(mg, 0.1), hi: q(mg, 0.9),
    dk: a.dk.map((d, k) => d + b.dk[k]), rk: a.rk.map((r, k) => r + b.rk[k]),
  };
}

type Sim = ReturnType<typeof simulate>;
/** a place's "voted" estimate: its returned and in person estimates, ballot weighted;
 *  the total is summed draw by draw */
export function mergeSims(a: Sim, b: Sim): Sim {
  const byKey: Record<string, Estimate> = { ...a.byKey };
  for (const [k, e] of Object.entries(b.byKey)) {
    const o = byKey[k];
    if (!o) { byKey[k] = e; continue; }
    const v = o.votes + e.votes, w = (x: number, y: number) => (x * o.votes + y * e.votes) / v;
    byKey[k] = { d: w(o.d, e.d), r: w(o.r, e.r), i: w(o.i, e.i), margin: w(o.margin, e.margin),
      lo: w(o.lo, e.lo), hi: w(o.hi, e.hi), votes: v };
  }
  const draws = { d: a.draws.d.map((x, k) => x + b.draws.d[k]), r: a.draws.r.map((x, k) => x + b.draws.r[k]),
    i: a.draws.i.map((x, k) => x + b.draws.i[k]) };
  const totV = (a.total?.votes ?? 0) + (b.total?.votes ?? 0);
  if (totV <= 0) return { byKey, total: null, draws };
  const tm = draws.r.map((r, k) => ((r - draws.d[k]) / totV) * 100);
  const mean = (x: number[]) => x.reduce((s, y) => s + y, 0) / x.length / totV;
  return { byKey, total: { d: mean(draws.d), r: mean(draws.r), i: mean(draws.i),
    margin: tm.reduce((s, x) => s + x, 0) / tm.length, lo: q(tm, 0.1), hi: q(tm, 0.9), votes: totV }, draws };
}

const _adults: Record<string, number> = {};
function stateAdults(model: PartyModel, st: string) {
  if (_adults[st] === undefined) _adults[st] = stateParts(model, st).reduce((s, p) => s + p[1], 0);
  return _adults[st];
}

/* ── returned ballots: party drop off ─────────────────────────────────────────
 *
 * Returned ballots are not a copy of requested ones. Parties send ballots back
 * at different rates, and the gap is widest early, when only the keenest
 * voters have returned. Each party's return probability is modelled in log
 * odds as a place level plus a party offset:
 *
 *     P(return | party) = logistic(a + b_party),   b_Democratic = 0
 *
 * The offsets come from states that publish party for both requests and
 * returns, measured live from the feed, so they move as returns come in.
 * Universal mail states are measured apart from the rest, because there the
 * request pool is the whole voter file. The level a is solved per county so the
 * county's estimated requesters return exactly as many ballots as it reports.
 */

export type ReturnTilt = {
  source: "live" | "prior";
  states: string[];                 // party states the offsets were measured in
  bR: number; bO: number;           // median offsets, Republican and Independent or other vs Democratic
  draws: [number, number][];        // one pair per simulation draw, calibration included
  returned: number;                 // party returned ballots behind the live figure
  // the same, measured only in universal mail states, when enough have reported
  universal: { states: string[]; bR: number; bO: number; draws: [number, number][]; returned: number } | null;
  // States that publish party for returns but not for requests. Their returns
  // are the one direct check on an estimated return mix, so the estimate is
  // shifted toward what they show, shrunk by how many ballots they hold.
  calib: { states: string[]; shift: number; returned: number; gaps: number[];
    before: { st: string; actual: number; model: number; regShare: number | null; lvShare: number | null }[] } | null;
};

function tiltDraw(t: ReturnTilt | null | undefined, model: PartyModel, k: number, uni: boolean): [number, number] {
  if (t) return (uni && t.universal ? t.universal.draws[k] : t.draws[k]) ?? [0, 0];
  const v = model.draws[k] ?? model.point; return [v[0] ?? 0, v[1] ?? 0];
}

const logit = (p: number) => Math.log(p / (1 - p));
const sigm = (x: number) => 1 / (1 + Math.exp(-x));

/** Move a requested mix [d, r, i] onto returned ballots, given the place's
 *  overall return rate rho and party offsets [bR, bI]. With no rho, the early
 *  season limit applies: odds scale by exp(b). */
export function returnedMix(m: [number, number, number], rho: number | undefined, b: [number, number]): [number, number, number] {
  const off = [0, b[0], b[1]];
  if (rho === undefined || !isFinite(rho)) {
    const w = m.map((x, j) => x * Math.exp(off[j])); const z = w[0] + w[1] + w[2];
    return [w[0] / z, w[1] / z, w[2] / z];
  }
  const target = Math.min(0.995, Math.max(0.0005, rho));
  let lo = -20, hi = 20;
  for (let it = 0; it < 48; it++) {
    const a = (lo + hi) / 2;
    const got = m[0] * sigm(a) + m[1] * sigm(a + off[1]) + m[2] * sigm(a + off[2]);
    if (got > target) hi = a; else lo = a;
  }
  const a = (lo + hi) / 2;
  const w = [m[0] * sigm(a), m[1] * sigm(a + off[1]), m[2] * sigm(a + off[2])]; const z = w[0] + w[1] + w[2];
  return [w[0] / z, w[1] / z, w[2] / z];
}

const splitRow = (row: RegionRow | undefined) => {
  let d = 0, r = 0, o = 0, u = 0;
  for (const [g, b] of Object.entries(row ?? {})) {
    const v = b?.votes ?? 0;
    if (g === "Democratic") d += v; else if (g === "Republican") r += v; else if (g === "Unspecified") u += v; else o += v;
  }
  return { d, r, o, u };
};

type TiltRow = { st: string; w: number; bR: number; bO: number; n: number };
function tiltRows(req: CategoryPayload | null | undefined, ret: CategoryPayload | null | undefined, keep: (st: string) => boolean): TiltRow[] {
  const rows: TiltRow[] = [];
  for (const [st, rrow] of Object.entries(ret?.regions ?? {})) {
    if (!keep(st)) continue;
    const Q = splitRow(req?.regions[st]), T = splitRow(rrow);
    if (Q.d <= 0 || Q.r <= 0 || T.d + T.r + T.o < 50) continue;
    const rate = (x: number, y: number) => Math.min(0.995, Math.max(0.0005, (x + 0.5) / (y + 1)));
    const rD = rate(T.d, Q.d), rR = rate(T.r, Q.r), rO = Q.o > 0 ? rate(T.o, Q.o) : NaN;
    rows.push({ st, w: Q.d + Q.r + Q.o, bR: logit(rR) - logit(rD), bO: isFinite(rO) ? logit(rO) - logit(rD) : NaN,
      n: T.d + T.r + T.o });
  }
  return rows;
}

/** Party return offsets measured today from the feed, one pair per draw from a
 *  bootstrap over the reporting states. Falls back to the TPSI survey prior
 *  when fewer than two states, or under 2,000 party ballots, have come back. */
export function returnTilt(req: CategoryPayload | null | undefined, ret: CategoryPayload | null | undefined,
  model: PartyModel): ReturnTilt {
  const uni = (st: string) => regimeOf(model, st) === "universal";
  const rows = tiltRows(req, ret, (st) => !uni(st));
  const uRows = tiltRows(req, ret, uni);
  const n = rows.reduce((s, x) => s + x.n, 0), nU = uRows.reduce((s, x) => s + x.n, 0);
  let seed = 20261103;                     // deterministic, so every load shows the same numbers
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const med = (a: number[]) => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] + (s.length % 2 ? 0 : (s[s.length / 2] - s[(s.length - 1) >> 1]) / 2) : 0; };
  // An unmeasured state's offset is treated as one more draw from the spread of
  // measured states, each state counted once. Pooling by volume would let
  // Pennsylvania, whose Republicans return far slower than anyone's, decide the
  // answer for every other state.
  const sample = (rs: TiltRow[]) => {
    const bOs = rs.map((x) => x.bO).filter(isFinite);
    return model.draws.map(() => {
      const a = rs[Math.floor(rnd() * rs.length)];
      const o = isFinite(a.bO) ? a.bO : bOs.length ? bOs[Math.floor(rnd() * bOs.length)] : 0;
      return [a.bR, o] as [number, number];
    });
  };

  let draws: [number, number][], source: "live" | "prior", bR: number, bO: number;
  if (rows.length < 2 || n < 2000) {
    draws = model.draws.map((v) => [v[0] ?? 0, v[1] ?? 0] as [number, number]);
    source = "prior";
    bR = draws.reduce((s, x) => s + x[0], 0) / draws.length; bO = draws.reduce((s, x) => s + x[1], 0) / draws.length;
  } else {
    draws = sample(rows);
    source = "live"; bR = med(rows.map((x) => x.bR)); bO = med(rows.map((x) => x.bO));
  }
  const universal = uRows.length >= 1 && nU >= 2000
    ? { states: uRows.map((x) => x.st).sort(), bR: med(uRows.map((x) => x.bR)), bO: med(uRows.map((x) => x.bO)),
        draws: sample(uRows), returned: nU }
    : null;

  // live calibration against states with party on returns but not requests
  const cal: { st: string; ret: number; rho: number; actual: number }[] = [];
  for (const [st, rrow] of Object.entries(ret?.regions ?? {})) {
    const Q = splitRow(req?.regions[st]), T = splitRow(rrow);
    if (Q.d + Q.r + Q.o > 0 || Q.u <= 0 || T.d <= 0 || T.r <= 0 || T.d + T.r < 200 || uni(st)) continue;
    if (!stateParts(model, st).length) continue;
    cal.push({ st, ret: T.d + T.r + T.o, rho: (T.d + T.r + T.o + T.u) / Q.u, actual: T.r / (T.d + T.r) });
  }
  let calib: ReturnTilt["calib"] = null;
  if (cal.length) {
    const twoParty = (st: string, rho: number, k: number, b: [number, number]) => {
      let d = 0, r = 0;
      for (const [f, a] of stateParts(model, st)) {
        const s0 = countyShares(model, f, st, "returned", k); if (!s0) continue;
        const s = returnedMix(s0, rho, b); d += s[0] * a; r += s[1] * a;
      }
      return r / (d + r);
    };
    const N = cal.reduce((s, c) => s + c.ret, 0);
    const shrink = N / (N + 2000);
    // The model is party identification and the feed is registration, which in Idaho
    // runs far more Republican than identification does. Where the state's
    // registration is known the check compares tilts: the reported returns against
    // registered voters, and the estimated returns against the model's electorate.
    // The shift is measured on the model's point draw, so each draw keeps its spread.
    const gap = cal.map((c) => {
      const est = logit(twoParty(c.st, c.rho, -1, [bR, bO]));
      const reg = model.meta.registration?.[c.st], lv = model.meta.lv?.[c.st];
      if (reg && lv) return (logit(c.actual) - logit(reg[0] / (reg[0] + reg[1]))) - (est - logit(lv[1] / (lv[0] + lv[1])));
      return logit(c.actual) - est;
    });
    const meanGap = gap.reduce((s, x) => s + x, 0) / gap.length;
    // States disagree: on the first returns Maryland's requesters lean further from
    // its file than the model expects and Idaho's less. So the shift is the common
    // part only, pulled toward zero by how much the check states disagree with each
    // other, as well as by how few ballots they hold.
    const TAU2 = 0.0625, kk = gap.length;
    const v = kk > 1 ? Math.max(0.0025, gap.reduce((s, x) => s + (x - meanGap) ** 2, 0) / (kk - 1)) : 0.1225;
    const rel = TAU2 / (TAU2 + v / kk);
    draws = draws.map((b) => {
      const pick = cal.map(() => gap[Math.floor(rnd() * gap.length)]);
      return [b[0] + shrink * rel * (pick.reduce((s, x) => s + x, 0) / pick.length), b[1]] as [number, number];
    });
    calib = { states: cal.map((c) => c.st).sort(), shift: shrink * rel * meanGap, returned: N, gaps: gap,
      before: cal.map((c) => ({ st: c.st, actual: c.actual * 100, model: twoParty(c.st, c.rho, -1, [bR, bO]) * 100,
        regShare: model.meta.registration?.[c.st] ? (model.meta.registration[c.st][0] / (model.meta.registration[c.st][0] + model.meta.registration[c.st][1])) * 100 : null,
        lvShare: model.meta.lv?.[c.st] ? (model.meta.lv[c.st][1] / (model.meta.lv[c.st][0] + model.meta.lv[c.st][1])) * 100 : null })) };
  }
  return { source, states: rows.map((x) => x.st).sort(), bR, bO, draws, returned: n, universal, calib };
}
