// November 3, 2026: the forecast's expected results for every race, civicAPI's live returns, the match between the
// two, and the arithmetic that turns partial returns into an estimate of the final count. Client side.

export type Kind = "sen" | "gov" | "house" | "state" | "measure" | "leg" | "other";
export type XRace = {
  id: string; k: Kind; st: string; nm: string; off: string; c?: [string, string, number][]; tot?: number; m?: number | null; pR?: number | null;
  yes?: number | null; pPass?: number | null; thr?: number; cty?: number; up?: number; seats?: number; maj?: number; dS?: number; rS?: number; pD?: number; nd?: number; cat?: string;
  civ: { t?: string[]; d?: string | null; al?: boolean; seat?: string | null; n?: string | null; lab?: string; code?: string; names?: string[] };
};
export type XIndex = { asOf: string; election: string; races: XRace[] };
export type Exp = [number, number, number, number];
export type LegDist = { d: string; s: number; D: string | null; R: string | null; I: string | null; v: [number, number, number, number]; m: number | null; pD: number | null; st?: string | null };
export type StFile = { counties: Record<string, Record<string, Exp>>; leg: Record<string, LegDist[]>; names?: Record<string, string> };
// civicAPI, as the proxy trims it: candidates are [name, party, votes, percent, winner, seats]
export type CCand = [string, string, number, number, number, number | null];
export type CRace = { id: number; type: string; province: string; district: string | null; name: string; pr: number; seats?: number; c: CCand[] };
export type CRegion = { n: string; t?: string; pr: number; c: CCand[] };
export type CDetail = { id: number; name: string; type: string; province: string; district: string | null; pr: number; close: string | null; updated: string | null; test: boolean; c: CCand[]; regions: Record<string, CRegion> };

export const STN: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
export const KIND_LABEL: Record<Kind, string> = { sen: "Senate", gov: "Governor", house: "House", state: "Statewide offices", measure: "Ballot measures", leg: "State legislatures", other: "Courts and local" };

const DB: Record<string, string> = { lg: "lieutenant-governor", ag: "attorney-general", sos: "secretary-of-state", treas: "treasurer", aud: "auditor", agri: "agriculture-commissioner", rrc: "railroad-commissioner",
  comp: "comptroller", land: "land-commissioner", supt: "superintendent", ins: "insurance-commissioner", labor: "labor-commissioner", psc: "public-service-commission", mine: "mine-inspector", edb: "education-board", court: "supreme-court" };
export function forecastHref(r: XRace): string {
  const s = r.st.toLowerCase(), parts = r.id.split("-");
  if (r.k === "sen") return `/forecast/${s}/senate`;
  if (r.k === "gov") return `/forecast/${s}/governor`;
  if (r.k === "house") return `/forecast/${s}/house-${Number(parts[2])}`;
  if (r.k === "measure") return `/forecast/measures/${s}/${parts.slice(2).join("-")}`;
  if (r.k === "leg") return `/forecast/legislatures/${s}/${parts[2]}`;
  if (r.k === "state" && DB[parts[0]]) { const seat = parts.slice(2).join("-"); return `/forecast/statewide/${s}/${DB[parts[0]]}${seat ? `-${seat}` : ""}`; }
  return "/forecast/other";
}
export const resultsHref = (id: string) => `/results/2026/${encodeURIComponent(id)}`;

// ---- civicAPI ------------------------------------------------------------------------------------------------
export const TYPE_SETS: Record<string, string[]> = {
  fed: ["US Senate", "Governor", "House of Representatives"],
  leg: ["State Senate", "State House", "State Assembly", "House of Delegates"],
  ballot: ["Proposition", "Referendum", "Ballot Measure", "Initiative", "Amendment", "Constitutional Amendment", "Question", "Issue"],
  state: ["Lieutenant Governor", "Attorney General", "Secretary of State", "State Treasurer", "Treasurer", "Auditor", "State Auditor", "Comptroller", "Controller",
    "Agriculture Commissioner", "Commissioner of Agriculture and Industries", "Secretary of Agriculture", "Land Commissioner", "Commissioner of State Lands",
    "Superintendent of Public Instruction", "Superintendent", "Insurance Commissioner", "Labor Commissioner", "State Mine Inspector", "Public Service Commissioner",
    "Public Service Commission", "Railroad Commissioner", "State Board of Education", "Supreme Court", "Judicial"],
};
export async function civicSearch(type: string, signal?: AbortSignal): Promise<CRace[]> {
  const r = await fetch(`/api/civic/search?type=${encodeURIComponent(type)}`, { signal, cache: "no-store" });
  if (!r.ok) throw new Error(`search ${r.status}`);
  return ((await r.json()).races || []) as CRace[];
}
export async function civicRace(id: number, signal?: AbortSignal): Promise<CDetail> {
  const r = await fetch(`/api/civic/race/${id}`, { signal, cache: "no-store" });
  if (!r.ok) throw new Error(`race ${r.status}`);
  return (await r.json()) as CDetail;
}

const norm = (s: string | null | undefined) => String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const lastOf = (n: string) => norm(n).replace(/ (jr|sr|ii|iii|iv)$/, "").split(" ").slice(-1)[0];

/** Find each forecast race in civicAPI's list. Returns our race id to the civicAPI race. */
export function matchCivic(races: XRace[], civ: CRace[]): Record<string, CRace> {
  const out: Record<string, CRace> = {};
  const by = new Map<string, CRace[]>();
  for (const c of civ) { if (!c.province || c.province === "US") continue; const k = c.province.toUpperCase(); by.set(k, [...(by.get(k) ?? []), c]); }
  for (const r of races) {
    const pool = by.get(r.st) ?? []; if (!pool.length) continue;
    const types = new Set((r.civ.t ?? []).map(norm));
    let hit: CRace | undefined;
    if (r.k === "sen" || r.k === "gov") hit = pool.find((c) => types.has(norm(c.type)));
    else if (r.k === "house") hit = pool.find((c) => types.has(norm(c.type)) && (c.district === r.civ.d || (r.civ.al && /(-AL|-00|-01|AT LARGE)$/i.test(c.district || ""))));
    else if (r.k === "leg") hit = pool.find((c) => types.has(norm(c.type)) && !c.district);
    else if (r.k === "state") {
      const cand = pool.filter((c) => types.has(norm(c.type)) || [...types].some((t) => norm(c.type).startsWith(t)));
      if (cand.length === 1) hit = cand[0];
      else if (cand.length > 1) {
        const want = new Set((r.c ?? []).map(([n]) => lastOf(n)));
        hit = cand.find((c) => c.c.some(([n]) => want.has(lastOf(n)))) ?? (r.civ.seat ? cand.find((c) => norm(c.name).includes(norm(r.civ.seat))) : undefined);
      }
    } else if (r.k === "measure") {
      const n = r.civ.n ? norm(r.civ.n) : null, lab = norm(r.civ.lab);
      const cand = pool.filter((c) => types.has(norm(c.type)) || /measure|amendment|question|issue|proposition|initiative|referendum/.test(norm(c.type)));
      hit = cand.find((c) => { const nm = norm(c.name); return n ? new RegExp(`(^| )${n}( |$)`).test(nm) && lab.split(" ").some((w) => w.length > 3 && nm.includes(w)) : nm.includes(lab); })
        ?? (n ? cand.find((c) => new RegExp(`(^| )${n}( |$)`).test(norm(c.name))) : undefined);
    } else if (r.k === "other") {
      const want = (r.civ.names ?? []).map(norm).filter((x) => x.length > 2);
      if (want.length) hit = pool.find((c) => want.every((w) => c.c.some(([n]) => lastOf(n) === w)));
    }
    if (hit) out[r.id] = hit;
  }
  return out;
}
/** civicAPI district races of one legislative chamber: district label to the race. */
export function legDistricts(r: XRace, civ: CRace[]): Record<string, CRace> {
  const out: Record<string, CRace> = {}; const code = r.civ.code ?? "HD"; const types = new Set((r.civ.t ?? []).map(norm));
  for (const c of civ) {
    if (c.province?.toUpperCase() !== r.st || !c.district || !types.has(norm(c.type))) continue;
    const m = c.district.match(new RegExp(`-${code}-0*([0-9]+[A-Z]?)$`, "i")) ?? c.district.match(/([0-9]+[A-Z]?)$/);
    if (m) out[m[1].toUpperCase()] = c;
  }
  return out;
}

// ---- reading a civicAPI race against the forecast ---------------------------------------------------------------
const P = (p: string) => { const x = norm(p); return x.startsWith("dem") ? "D" : x.startsWith("rep") ? "R" : x.startsWith("ind") ? "I" : x === "yes" ? "Y" : x === "no" ? "N" : "O"; };
/** Votes for the forecast's two sides (D or Yes, R or No) and everyone else, from a civicAPI candidate list. */
export function sides(r: XRace, c: CCand[]): { a: number; b: number; o: number; t: number } {
  let a = 0, b = 0, o = 0;
  const names = (r.c ?? []).map(([n, p]) => [lastOf(n), p] as const);
  for (const [name, party, votes] of c) {
    let side = P(party);
    if (r.k === "measure") { const n = norm(name); side = n.startsWith("yes") || n === "for" ? "Y" : n.startsWith("no") || n === "against" ? "N" : side; }
    const nm = names.find(([l]) => l && l === lastOf(name));
    if (nm) side = nm[1];
    if (side === "D" || side === "Y" || (side === "I" && names[0]?.[1] === "I")) a += votes; else if (side === "R" || side === "N") b += votes; else o += votes;
  }
  return { a, b, o, t: a + b + o };
}

export type Proj = { rep: { a: number; b: number; o: number; t: number }; fin: { a: number; b: number; o: number; t: number }; pctIn: number; m: number; band: number; expM: number; swing: number | null; counties: number; countiesIn: number };
/**
 * The estimate of the final count. Each county's expected vote comes from the forecast. A county that has reported
 * keeps its own returns and its outstanding vote splits like its returns so far, leaning back to the forecast while
 * little is in; a county with nothing in gets its forecast moved by the average gap between returns and forecast
 * in the counties that have reported, weighted by votes and shrunk while few votes are in. Margins are side B minus
 * side A, so positive is Republican or No, as everywhere on the site.
 *
 * `prior` (margin points, B minus A; 0 = the official estimate) is an opening adjustment to the vote still resting on
 * the forecast. It is exactly `prior` before any votes and fades with counted votes (see openingShift).
 */
export function project(exp: Record<string, Exp> | null, live: Record<string, CRegion> | null, r: XRace, top: CCand[] | null, expTot?: number, prior = 0): Proj {
  const mu = prior / 100;
  const z = { a: 0, b: 0, o: 0, t: 0 };
  const rep = { ...z }, fin = { ...z };
  const expAll = { ...z };
  if (exp) for (const v of Object.values(exp)) { expAll.a += v[0]; expAll.b += v[1]; expAll.o += v[2]; expAll.t += v[3]; }
  const expM = expAll.t ? (100 * (expAll.b - expAll.a)) / expAll.t : (r.m ?? (r.yes != null ? 100 - 2 * r.yes : 0));
  let counties = 0, countiesIn = 0;
  if (exp && live && Object.keys(live).length) {
    // average swing of reporting counties, in share points, weighted by votes in
    let sw = 0, sv = 0;
    const seen: Record<string, { a: number; b: number; o: number; t: number; pr: number }> = {};
    for (const [f, e] of Object.entries(exp)) {
      counties++;
      const g = live[f]; if (!g) continue;
      const s = sides(r, g.c); seen[f] = { ...s, pr: g.pr };
      if (s.t > 0 && e[3] > 0) { countiesIn++; const gap = (s.b - s.a) / s.t - (e[1] - e[0]) / e[3]; sw += gap * s.t; sv += s.t; }
    }
    const swing = sv ? (sw / sv) * (sv / (sv + 0.08 * expAll.t)) : 0;
    let U = 0; // forecast-carried outstanding votes, for the prior
    for (const [f, e] of Object.entries(exp)) {
      const s = seen[f]; const eA = e[3] ? e[0] / e[3] : 0.5, eB = e[3] ? e[1] / e[3] : 0.5, eO = Math.max(0, 1 - eA - eB);
      if (s && s.t > 0) {
        rep.a += s.a; rep.b += s.b; rep.o += s.o; rep.t += s.t;
        const frac = s.pr > 0 ? Math.min(1, s.pr / 100) : Math.min(1, s.t / Math.max(1, e[3]));
        const final = frac >= 0.05 ? Math.max(s.t, s.t / frac) : Math.max(e[3], s.t);
        const left = Math.max(0, final - s.t), w = Math.min(1, frac * 2);
        const oA = s.a / s.t, oB = s.b / s.t, oO = s.o / s.t;
        const rA = w * oA + (1 - w) * (eA - swing / 2), rB = w * oB + (1 - w) * (eB + swing / 2), rO = w * oO + (1 - w) * eO;
        const k = rA + rB + rO || 1;
        fin.a += s.a + (left * rA) / k; fin.b += s.b + (left * rB) / k; fin.o += s.o + (left * rO) / k;
        if (mu) U += Math.min(Math.max(0, e[3] - s.t), left) * (1 - Math.min(1, (2 * s.t) / Math.max(1, e[3])));
      } else {
        const A = Math.max(0, eA - swing / 2), B = Math.max(0, eB + swing / 2), k = A + B + eO || 1;
        fin.a += (e[3] * A) / k; fin.b += (e[3] * B) / k; fin.o += (e[3] * eO) / k;
        if (mu) U += e[3];
      }
    }
    if (mu) openingShift(fin, rep, mu, sv, expAll.t, U);
    fin.t = fin.a + fin.b + fin.o;
    const pctIn = fin.t ? Math.min(100, (100 * rep.t) / fin.t) : 0;
    const m = mu && !rep.t ? expM + prior : fin.t ? (100 * (fin.b - fin.a)) / fin.t : expM;
    return { rep, fin, pctIn, m, band: band(pctIn), expM, swing: sv ? swing * 100 : null, counties, countiesIn };
  }
  // no county file or no county returns: the topline against the expected total
  if (top && top.length) {
    const s = sides(r, top); Object.assign(rep, s);
    const T = expTot || r.tot || expAll.t || s.t;
    const es = expSides(r); const eA = (es.a || expAll.a) / Math.max(1, T), eB = (es.b || expAll.b) / Math.max(1, T);
    const left = Math.max(0, T - s.t), w = Math.min(1, s.t / Math.max(1, T) * 2);
    const oA = s.t ? s.a / s.t : eA, oB = s.t ? s.b / s.t : eB;
    fin.a = s.a + left * (w * oA + (1 - w) * eA); fin.b = s.b + left * (w * oB + (1 - w) * eB); fin.o = s.o + left * Math.max(0, 1 - (w * oA + (1 - w) * eA) - (w * oB + (1 - w) * eB));
    if (mu) openingShift(fin, rep, mu, s.t, T, left * (1 - w));
    fin.t = fin.a + fin.b + fin.o;
  }
  const pctIn = fin.t ? Math.min(100, (100 * rep.t) / fin.t) : 0;
  const m = mu && !rep.t ? expM + prior : fin.t ? (100 * (fin.b - fin.a)) / fin.t : expM;
  return { rep, fin, pctIn, m, band: band(pctIn), expM, swing: null, counties, countiesIn };
}
/**
 * Moves `mu` (share units, toward side B) of the outstanding votes that still rest on the forecast, `U`, from A to B.
 * It shrinks as counted votes `V` grow against the expected total `T`, at the rate the swing estimate trusts returns.
 * Counted votes are never touched, so the shift is zero once nothing is outstanding.
 */
function openingShift(fin: { a: number; b: number }, rep: { a: number; b: number }, mu: number, V: number, T: number, U: number) {
  const rho = T > 0 ? (0.08 * T) / (V + 0.08 * T) : 0;
  const mv = Math.max(-(fin.b - rep.b), Math.min(fin.a - rep.a, (mu * rho * U) / 2));
  fin.a -= mv; fin.b += mv;
}
/** The forecast's expected votes for side A (D, or I where an independent is the main challenger, or Yes) and side B. */
export function expSides(r: XRace) {
  let a = 0, b = 0, o = 0; const ind = isInd(r);
  for (const [, p, v] of r.c ?? []) { if (p === "D" || p === "Y" || (ind && p === "I")) a += v; else if (p === "R" || p === "N") b += v; else o += v; }
  return { a, b, o, t: a + b + o };
}
/** Half width of the estimate's range in margin points: wide with little in, narrow near the end. */
export const band = (pctIn: number) => Math.max(0.6, 14 * Math.pow(1 - pctIn / 100, 0.8));

export const fmtM = (m: number | null | undefined, k?: Kind, ind = false) => {
  if (m == null || !Number.isFinite(m)) return "n/a";
  if (k === "measure") return `Yes ${((100 - m) / 2).toFixed(1)}%`;
  if (Math.abs(m) >= 99.5) return "Unopposed";
  if (Math.abs(m) < 0.05) return "Even";
  return `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`;
};
/** A gap between returns and the forecast, in margin points. */
export const fmtGap = (d: number | null | undefined, k?: Kind, ind = false) => {
  if (d == null || !Number.isFinite(d)) return "";
  if (Math.abs(d) < 0.05) return "On forecast";
  if (k === "measure") return `Yes ${d < 0 ? "up" : "down"} ${(Math.abs(d) / 2).toFixed(1)}`;
  return `${d < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(d).toFixed(1)}`;
};
export const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtK = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}K` : fmtN(n));
/** Expected margin of a forecast race, side B minus side A. */
export const expMargin = (r: XRace) => (r.k === "measure" ? (r.yes != null ? 100 - 2 * r.yes : null) : r.k === "leg" ? (r.dS != null && r.rS != null && r.seats ? (100 * (r.rS - r.dS)) / r.seats : null) : r.m ?? null);
export const isInd = (r: XRace) => r.c?.[0]?.[1] === "I";

// ---- election night rules ---------------------------------------------------------------------------------------
/** First polls close: 6 PM Eastern on November 3. civicAPI publishes test returns before then. */
export const FIRST_CLOSE = Date.parse("2026-11-03T23:00:00Z");
/** Test returns are hidden before polls close unless the page is opened with ?test=1. */
export const showTest = () => { try { return new URLSearchParams(window.location.search).has("test"); } catch { return false; } };
export const beforeClose = () => Date.now() < FIRST_CLOSE;

const erf = (x: number) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
export const Phi = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
const PhiInv = (p: number) => { // Acklam's approximation
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q = Math.min(1 - 1e-9, Math.max(1e-9, p));
  if (q < 0.02425) { const r = Math.sqrt(-2 * Math.log(q)); return (((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  if (q > 1 - 0.02425) { const r = Math.sqrt(-2 * Math.log(1 - q)); return -(((((c[0] * r + c[1]) * r + c[2]) * r + c[3]) * r + c[4]) * r + c[5]) / ((((d[0] * r + d[1]) * r + d[2]) * r + d[3]) * r + 1); }
  const r = q - 0.5, s = r * r; return (((((a[0] * s + a[1]) * s + a[2]) * s + a[3]) * s + a[4]) * s + a[5]) * r / (((((b[0] * s + b[1]) * s + b[2]) * s + b[3]) * s + b[4]) * s + 1);
};

/**
 * Live chance that side B (Republican, or No on a measure) wins. Before any votes it is the forecast's own chance;
 * the spread of the estimate starts at the forecast's spread and narrows as the share of the vote counted rises, so
 * the chance moves smoothly from the forecast to the count. A measure passes when its Yes share clears its own bar.
 * With an opening `prior`, the pre-vote chance moves by that many margin points at the forecast's own spread.
 */
export function liveOdds(r: XRace, P: Proj, prior = 0) {
  const cut = r.k === "measure" ? 100 - 200 * (r.thr ?? 0.5) : 0;
  const pB0 = r.k === "measure" ? 1 - (r.pPass ?? 0.5) : r.pR ?? 0.5;
  const z0 = PhiInv(pB0);
  const sdF = Math.min(20, Math.max(1.5, Math.abs(P.expM - cut) / Math.max(0.15, Math.abs(z0))));
  const f = Math.min(1, P.pctIn / 100);
  const sd = sdF * Math.pow(1 - f, 0.9) + (f >= 0.999 ? 0.05 : 0.35);
  const pB = P.rep.t > 0 ? Phi((P.m - cut) / sd) : prior ? Phi(z0 + prior / sdF) : pB0;
  return { pB, pA: 1 - pB, sd, lo: P.m - 1.96 * sd, hi: P.m + 1.96 * sd };
}
