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

/** requested ballots use the mail skew; returned ballots use it and then the
 *  party return rates; in person uses the early skew */
export type Mode = "mail" | "returned" | "early";
export const modeOf = (c: Category): Mode => (c === "inperson" ? "early" : c === "returned" ? "returned" : "mail");

/** Democratic, Republican and Independent shares for one county under one draw. */
export function partyShares(t: number, v: number[], mode: Mode): [number, number, number] {
  const [swing, I, rD, rR, rI, mR, mRs, mI, mIs, eR, eRs, eI, eIs, xm] = v;
  // the early vote skew narrows as a county gets redder
  const x = Math.log(t / (1 - t)) - xm;
  const tt = Math.min(0.98, Math.max(0.02, t + swing));
  const R = Math.min(1 - I - 0.01, Math.max(0.01, (tt - rD * (1 - I) - rI * I) / (rR - rD)));
  const D = 1 - I - R;
  const mailish = mode !== "early";
  const sR = mailish ? mR + mRs * x : eR + eRs * x;
  const sI = mailish ? mI + mIs * x : eI + eIs * x;
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
export type Part = [t: number, n: number, rho?: number];

export function simulate(
  places: { key: string; parts: Part[]; votes: number }[],
  model: PartyModel, mode: Mode, tilt?: ReturnTilt | null,
): { byKey: Record<string, Estimate>; total: Estimate | null; draws: { d: number[]; r: number[]; i: number[] } } {
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
      for (const [t, n, rho] of pl.parts) {
        let s = partyShares(t, v, mode);
        if (mode === "returned") s = returnedMix(s, rho, tilt ? tilt.draws[k] : [v[14] ?? 0, v[15] ?? 0]);
        d += s[0] * n; r += s[1] * n; i += s[2] * n;
      }
      d /= w; r /= w; i /= w;
      sd += d; sr += r; si += i; ms.push((r - d) * 100);
      totD[k] += d * pl.votes; totR[k] += r * pl.votes; totI[k] += i * pl.votes;
    });
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
};

export function combineNational(
  us: CategoryPayload, counties: Record<string, CategoryPayload | null | undefined>,
  model: PartyModel, countyNames: Record<string, string> | null, mode: Mode,
  // for returned ballots: the same places' requests, and the party return offsets
  req?: { us: CategoryPayload | null | undefined; counties: Record<string, CategoryPayload | null | undefined> },
  tilt?: ReturnTilt | null,
): Combined | null {
  const byState: Record<string, [number, number][]> = {};
  for (const [f, [t, a]] of Object.entries(model.counties)) (byState[stateOfFips(f)] ??= []).push([t, a]);
  const stateT = (st: string) => {
    const p = byState[st] ?? []; const w = p.reduce((s, x) => s + x[1], 0);
    return w > 0 ? p.reduce((s, x) => s + x[0] * x[1], 0) / w : 0.5;
  };

  let rd = 0, rr = 0, ro = 0, repStates = 0, estStates = 0, countyWeighted = 0;
  const places: { key: string; parts: Part[]; votes: number }[] = [];
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
        const f = matchCounty(name, local); const c = f ? model.counties[f] : undefined;
        const q = reqC ? sumRow(reqC[name]) : 0;
        parts.push([c ? c[0] : stateT(st), n, mode === "returned" ? (q > 0 ? n / q : stateRho) : undefined]);
      }
      if (parts.length) { places.push({ key: st, parts, votes: u }); countyWeighted++; continue; }
    }
    places.push({ key: st, parts: (byState[st] ?? []).map(([t, a]) => [t, a, stateRho] as Part), votes: u });
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
  };
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
 * returns, measured live from the feed, so they move as returns come in. The
 * level a is solved per county so the county's estimated requesters return
 * exactly as many ballots as it reports. Early in the season, when a county
 * has returned 1% of its requests, the offsets bite hard; as returns approach
 * requests the returned mix converges back onto the requested mix.
 */

export type ReturnTilt = {
  source: "live" | "prior";
  states: string[];                 // party states the offsets were measured in
  bR: number; bO: number;           // median offsets, Republican and Independent or other vs Democratic
  draws: [number, number][];        // one pair per simulation draw, calibration included
  returned: number;                 // party returned ballots behind the live figure
  // States that publish party for returns but not for requests. Their returns
  // are the one direct check on an estimated return mix, so the estimate is
  // shifted toward what they show, shrunk by how many ballots they hold.
  calib: { states: string[]; shift: number; returned: number;
    before: { st: string; actual: number; model: number }[] } | null;
};

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

/** Party return offsets measured today from the feed, one pair per draw from a
 *  bootstrap over the reporting states. Falls back to the TPSI survey prior
 *  when fewer than two states, or under 2,000 party ballots, have come back. */
export function returnTilt(req: CategoryPayload | null | undefined, ret: CategoryPayload | null | undefined,
  model: PartyModel): ReturnTilt {
  const rows: { st: string; w: number; bR: number; bO: number; n: number }[] = [];
  for (const [st, rrow] of Object.entries(ret?.regions ?? {})) {
    const Q = splitRow(req?.regions[st]), T = splitRow(rrow);
    if (Q.d <= 0 || Q.r <= 0 || T.d + T.r + T.o < 50) continue;
    const rate = (x: number, y: number) => Math.min(0.995, Math.max(0.0005, (x + 0.5) / (y + 1)));
    const rD = rate(T.d, Q.d), rR = rate(T.r, Q.r), rO = Q.o > 0 ? rate(T.o, Q.o) : NaN;
    rows.push({ st, w: Q.d + Q.r + Q.o, bR: logit(rR) - logit(rD), bO: isFinite(rO) ? logit(rO) - logit(rD) : NaN,
      n: T.d + T.r + T.o });
  }
  const n = rows.reduce((s, x) => s + x.n, 0);
  let seed = 20261103;                     // deterministic, so every load shows the same numbers
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const med = (a: number[]) => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor((s.length - 1) / 2)] + (s.length % 2 ? 0 : (s[s.length / 2] - s[(s.length - 1) >> 1]) / 2) : 0; };

  let draws: [number, number][], source: "live" | "prior", bR: number, bO: number;
  if (rows.length < 2 || n < 2000) {
    draws = model.draws.map((v) => [v[14] ?? 0, v[15] ?? 0] as [number, number]);
    source = "prior";
    bR = draws.reduce((s, x) => s + x[0], 0) / draws.length; bO = draws.reduce((s, x) => s + x[1], 0) / draws.length;
  } else {
    // An unmeasured state's offset is treated as one more draw from the spread
    // of measured states, each state counted once. Pooling by volume would let
    // Pennsylvania, whose Republicans return far slower than anyone's, decide
    // the answer for every other state.
    const bOs = rows.map((x) => x.bO).filter(isFinite);
    draws = model.draws.map(() => {
      const a = rows[Math.floor(rnd() * rows.length)];
      const o = isFinite(a.bO) ? a.bO : bOs.length ? bOs[Math.floor(rnd() * bOs.length)] : 0;
      return [a.bR, o] as [number, number];
    });
    source = "live"; bR = med(rows.map((x) => x.bR)); bO = med(bOs);
  }

  // live calibration against states with party on returns but not requests
  const byState: Record<string, [number, number][]> = {};
  for (const [f, [tt, a]] of Object.entries(model.counties)) (byState[stateOfFips(f)] ??= []).push([tt, a]);
  const cal: { st: string; ret: number; rho: number; actual: number }[] = [];
  for (const [st, rrow] of Object.entries(ret?.regions ?? {})) {
    const Q = splitRow(req?.regions[st]), T = splitRow(rrow);
    if (Q.d + Q.r + Q.o > 0 || Q.u <= 0 || T.d <= 0 || T.r <= 0 || T.d + T.r < 200 || !byState[st]) continue;
    cal.push({ st, ret: T.d + T.r + T.o, rho: (T.d + T.r + T.o + T.u) / Q.u, actual: T.r / (T.d + T.r) });
  }
  let calib: ReturnTilt["calib"] = null;
  if (cal.length) {
    const twoParty = (st: string, rho: number, v: number[], b: [number, number]) => {
      let d = 0, r = 0;
      for (const [tt, a] of byState[st]) { const s = returnedMix(partyShares(tt, v, "returned"), rho, b); d += s[0] * a; r += s[1] * a; }
      return r / (d + r);
    };
    const N = cal.reduce((s, c) => s + c.ret, 0);
    const shrink = N / (N + 2000);
    const gaps = model.draws.map((v, k) => cal.map((c) => logit(c.actual) - logit(twoParty(c.st, c.rho, v, draws[k]))));
    draws = draws.map((b, k) => {
      const g = gaps[k]; const pick = cal.map(() => g[Math.floor(rnd() * g.length)]);
      return [b[0] + shrink * (pick.reduce((s, x) => s + x, 0) / pick.length), b[1]] as [number, number];
    });
    const meanGap = gaps.reduce((s, g) => s + g.reduce((a, x) => a + x, 0) / g.length, 0) / gaps.length;
    const p = model.point;
    calib = { states: cal.map((c) => c.st).sort(), shift: shrink * meanGap, returned: N,
      before: cal.map((c) => ({ st: c.st, actual: c.actual * 100, model: twoParty(c.st, c.rho, p, [bR, bO]) * 100 })) };
  }
  return { source, states: rows.map((x) => x.st).sort(), bR, bO, draws, returned: n, calib };
}
