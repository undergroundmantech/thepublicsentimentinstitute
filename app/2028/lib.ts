// 2028 model pages: shared types, formats and colors. Margins are Republican minus Democrat, two party, so negative is a
// Democratic lead, the same sign as every On Point forecast.
export const X = "/forecast/2028/x";

export interface StateRes { D: number; R: number; I: number; O: number; m: number; pD: number; pR: number; pI: number; ev: number;
  /** each third party ticket in this state: its votes, average share across the simulations and chance to carry it */
  tk?: { v: number; s: number; p: number }[] }
/** a third party ticket as the dashboard's engine reports it */
export interface TicketRes { newV?: number; nf?: number; color: string; key: string; name: string; vp: string; label: string; votes: number; modeled: number; joint: number; target: number; user: number | null; fromD: number | null; custom: boolean; pWin: number; ev: number }
/** a county: Democratic, Republican, third party and other votes, then the Democratic and Republican win chance */
export type CtyRes = [number, number, number, number, number, number];
export interface Res {
  D: string; R: string; T: string | null;
  pD: number; pR: number; pI: number; pNone: number; evD: number; evR: number; evI: number;
  VD: number; VR: number; VI: number; VO: number; hist: number[]; tip: string | null;
  states: Record<string, StateRes>; cty: Record<string, CtyRes>;
  /** the artifact's General election tab: its national margin, 80% electoral vote range and simulation count */
  natM?: number; ev10?: number; ev90?: number; hyp?: boolean; sims?: number; tickets?: TicketRes[];
  /** each third party ticket's votes in each county, in ticket order */
  ctyT?: Record<string, number[]>;
  /** v51: eligible citizens, the generic electorate, the votes this matchup adds or loses and the third parties' new voters */
  turnout?: { elig: number; base: number; matchup: number; newT: number; stE: Record<string, number> };
  prim?: Record<"D" | "R", { share: number; front: string; frontShare: number; quality: number; consol: number; polled: boolean } | null>;
}
export interface DefaultFile {
  built: string; sims: number;
  summary: { D: string; R: string; pD: number; pR: number; pNone: number; evD: number; evR: number; VD: number; VR: number; VO: number; hist: number[]; tip: string | null;
    states: Record<string, { D: number; R: number; O: number; m: number; pD: number; ev: number }> };
  cty: Record<string, [number, number, number, number]>;
  example?: { label: string; pD: number; nat: number; evD: number; label3: string; pD3: number; nat3: number; tps3: number };
  grid: { d: string; r: string; pD: number; evD: number; nat: number; dShare: number; rShare: number; odds: number | null }[];
}
export interface PrimField {
  party: "D" | "R"; names: string[]; colors: string[]; nomination: number[]; votes: number[]; other: number; expected?: number[];
  calendar: string[][] | null;
  states: Record<string, { votes: number[]; other: number; total: number; win: number[]; window: number | null; proxy: string[] | null; hist: { year: string; votes: number | null; type: string } | null }>;
  /** fips: [other votes, [candidate index, votes], ...] */
  counties: Record<string, (number | [number, number])[]>;
}
export interface PrimFile { D: PrimField; R: PrimField; sims: { primary: number }; built: string; method?: string }
export interface StatesGeo { frame: [number, number]; states: Record<string, string>; labels: Record<string, [number, number, number]>; box: Record<string, [number, number, number, number]>; a24: Record<string, number | null> }
/** fips, state, name, path, 2024 two party margin, generational shift */
export type CountyGeo = [string, string, string, string, number | null, number | null];
export interface CountiesGeo { counties: CountyGeo[]; akct: [string, string, number, number, number][] }

export function fromDefault(f: DefaultFile): Res {
  const s = f.summary;
  const states: Record<string, StateRes> = {};
  for (const [k, v] of Object.entries(s.states)) states[k] = { D: v.D, R: v.R, I: 0, O: v.O, m: v.m, pD: v.pD, pR: 1 - v.pD, pI: 0, ev: v.ev };
  const cty: Record<string, CtyRes> = {};
  for (const [k, v] of Object.entries(f.cty)) cty[k] = [v[0], v[1], 0, v[2], v[3], 1 - v[3]];
  return { D: s.D, R: s.R, T: null, pD: s.pD, pR: s.pR, pI: 0, pNone: s.pNone, evD: s.evD, evR: s.evR, evI: 0, VD: s.VD, VR: s.VR, VI: 0, VO: s.VO, hist: s.hist, tip: s.tip, states, cty };
}
type EngOut = { turnout?: Res["turnout"]; tickets?: TicketRes[]; D: string; R: string; T: string | null; pD: number; pR: number; pI: number; pNone: number; evD: number; evR: number; evI: number; VD: number; VR: number; VI: number; VO: number; hist: number[]; tip: string | null;
  states: Record<string, StateRes>; cty: { fips: string; D: number; R: number; I: number; O: number; pD: number; pR: number; T?: number[] }[]; prim: Res["prim"] };
export function fromEngine(t: EngOut, N = 4000): Res {
  const cty: Record<string, CtyRes> = {};
  const ctyT: Record<string, number[]> = {};
  for (const c of t.cty) if (c) { cty[c.fips] = [c.D, c.R, c.I, c.O, c.pD, c.pR]; if (c.T) ctyT[c.fips] = c.T; }
  return { ctyT, turnout: t.turnout, D: t.D, R: t.R, T: t.T, pD: t.pD, pR: t.pR, pI: t.pI, pNone: t.pNone, evD: t.evD, evR: t.evR, evI: t.evI, VD: t.VD, VR: t.VR, VI: t.VI, VO: t.VO,
    hist: t.hist.map((h) => h / N), tip: t.tip, states: t.states, cty, prim: t.prim, tickets: t.tickets ?? [] };
}

export const STATE_NAME: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", "ME-1": "Maine 1st District", "ME-2": "Maine 2nd District", "NE-2": "Nebraska 2nd District" };
export const FIPS_ST: Record<string, string> = { "01": "AL", "02": "AK", "04": "AZ", "05": "AR", "06": "CA", "08": "CO", "09": "CT", "10": "DE", "11": "DC", "12": "FL", "13": "GA", "15": "HI", "16": "ID", "17": "IL", "18": "IN", "19": "IA", "20": "KS", "21": "KY", "22": "LA", "23": "ME", "24": "MD", "25": "MA", "26": "MI", "27": "MN", "28": "MS", "29": "MO", "30": "MT", "31": "NE", "32": "NV", "33": "NH", "34": "NJ", "35": "NM", "36": "NY", "37": "NC", "38": "ND", "39": "OH", "40": "OK", "41": "OR", "42": "PA", "44": "RI", "45": "SC", "46": "SD", "47": "TN", "48": "TX", "49": "UT", "50": "VT", "51": "VA", "53": "WA", "54": "WV", "55": "WI", "56": "WY" };

export const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtK = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e3)}K` : fmtN(n));
export const fmtPct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
export const fmtSh = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
export const fmtMg = (m: number, d = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(d)}`);
export const two = (d: number, r: number) => (d + r > 0 ? ((r - d) / (d + r)) * 100 : 0);
export const last = (n: string) => (n.startsWith("Generic") ? n : n.split(" ").slice(-1)[0] === "Jr." ? n : n.split(" ").slice(-1)[0]);

const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
/** the site's ramp: pale for close, deep for safe, by the margin over 40 points */
export function marginColor(m: number) {
  const a = Math.min(40, Math.abs(m || 0)) / 40;
  return m < 0 ? mix([214, 226, 255], [16, 40, 140], a) : mix([255, 220, 228], [140, 10, 40], a);
}
export const probColor = (pD: number) => marginColor((0.5 - pD) * 80);
export function shiftColor(x: number, span = 12) {
  const a = Math.min(1, Math.abs(x || 0) / span);
  return x < 0 ? mix([236, 240, 250], [36, 84, 214], a) : mix([250, 236, 240], [200, 30, 64], a);
}
/** a candidate's color, deeper as their share grows */
export function leaderColor(hex: string, share: number) {
  const t = Math.max(0.28, Math.min(1, (share - 0.12) / 0.5));
  const c = hex.replace("#", ""); const rgb = [0, 2, 4].map((i) => parseInt(c.slice(i, i + 2), 16)); const base = [232, 228, 240];
  return mix(base, rgb, t);
}
export const RAMP = "linear-gradient(90deg,#10288c 0%,#3d7bff 25%,#d6e2ff 48%,#ffdce4 52%,#ff3b5c 75%,#8c0a28 100%)";
export const SHIFT_RAMP = "linear-gradient(90deg,#2454d6 0%,#ecf0fa 48%,#faecf0 52%,#c81e40 100%)";
export const DEM = "var(--dem)", REP = "var(--gop)", IND = "var(--ind)";
export function rateLabel(m: number) {
  const a = Math.abs(m); const s = m < 0 ? "D" : "R"; if (a < 2) return `Tilt ${s}`;
  return `${a < 6 ? "Lean" : a < 12 ? "Likely" : "Safe"} ${s}`;
}

/** the On Point 2028 Forecast artifact's General election tab, every pairing, with its county forecasts */
export type GenPair = [string, string, number, number, number, number, number, string, number, number, number[], ([number, number] | null)[]];
export interface GenFile { keys: string[]; ev: Record<string, number>; sig: Record<string, number>; base: Record<string, number>;
  /** fips: two party votes, other votes, margin and Democratic win chance for the generic Democrat against Vance */
  cty: Record<string, [number, number, number, number]>; dist: Record<string, [number, number, number]>; pairs: GenPair[];
  /** v51 turnout by matchup: each county's voter group mix (Republican, independent, Black, Hispanic, Asian and other,
   *  30 to 44, 45 to 64, 65 and up, college, 2024 nonvoter shares) and eligible citizens, and each nominee's turnout effect */
  tm?: { dims: Record<string, number[]>; coef: Record<string, number[]> } }
/** the change in a county's votes when these two nominees are on the ballot instead of generic ones */
export type TM = { dims: Record<string, number[]>; coef: Record<string, number[]> };
export function turnoutAdd(G: GenFile, key: string, d: string, r: string, base: number) { return G.tm ? tmAdd(G.tm, key, d, r, base) : 0; }
export function tmAdd(t: TM, key: string, d: string, r: string, base: number) { const own = t.dims[key]; const v = own ?? (/^\d/.test(key) ? t.dims[FIPS_ST[key.slice(0, 2)]] : undefined); if (!v) return 0;
  // the forecast file's counties are the generic Democrat against Vance, so Vance's own turnout is taken back out first
  const sum = (cs: (number[] | undefined)[]) => { let x = 0; for (const c of cs) if (c) { x += c[0]; for (let j = 0; j < 10; j++) x += c[j + 1] * v[j]; } return x; };
  const x = sum([t.coef[`D|${d}`], t.coef[`R|${r}`]]) - sum([t.coef["R|Vance"]]); if (!x) return 0;
  // a county of Alaska or Connecticut takes its state's mix at the usual two in three turnout of eligible citizens
  // v57: realistic turnout, a pairing moves a county's vote at most 3 percent up or 4 down, and never more than a point of its
  // eligible citizens over its own expected turnout
  const E = own ? v[10] : base / 0.66; return Math.max(-0.04 * base, Math.min(0.03 * base, Math.max(0, Math.min(0.95 * E, base + 0.01 * E) - base), (E * x) / 100));
}
function erf(x: number) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const ncdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
function ninv(p: number) { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }
/** A pairing as the artifact shows it: each county moves by its state's change from the generic Democrat against Vance, the
 * artifact's own county map rule, so a state is the sum of its counties; the headline numbers are the artifact's. */
export function genRes(G: GenFile, d: string, r: string): Res | null {
  const p = G.pairs.find((x) => x[0] === d && x[1] === r); if (!p) return null;
  const dl: Record<string, number> = {}, pm: Record<string, [number, number]> = {};
  G.keys.forEach((s, k) => { const v = p[11][k]; if (v) { dl[s] = v[0] - G.base[s]; pm[s] = v; } });
  const cty: Record<string, CtyRes> = {}, states: Record<string, StateRes> = {};
  const add = (s: string, D: number, R: number, O: number) => { const a = states[s] || (states[s] = { D: 0, R: 0, I: 0, O: 0, m: 0, pD: pm[s]?.[1] ?? 0, pR: 1 - (pm[s]?.[1] ?? 0), pI: 0, ev: G.ev[s] ?? 0 }); a.D += D; a.R += R; a.O += O; };
  // who shows up depends on the matchup: each county's votes grow or shrink with its voter groups' turnout for these two
  // nominees, and a small uniform shift inside each state keeps the state's margin, the sum of its counties, where it was
  const fx: Record<string, number> = {}; const s0: Record<string, [number, number]> = {}, s1: Record<string, [number, number]> = {};
  for (const [f, [w, o, m]] of Object.entries(G.cty)) {
    const st = FIPS_ST[f.slice(0, 2)]; const mm = m + (dl[st] ?? 0); const k = 1 + turnoutAdd(G, f, d, r, w + o) / Math.max(1, w + o); fx[f] = k;
    const a = (s0[st] ||= [0, 0]); a[0] += (w * mm) / 100; a[1] += w; const b = (s1[st] ||= [0, 0]); b[0] += (w * k * mm) / 100; b[1] += w * k;
  }
  // the electorate: eligible citizens, the generic nominees' voters and what this pairing adds or loses
  let vNow = 0, vGen = 0; const stE: Record<string, number> = {};
  for (const [f, [w, o]] of Object.entries(G.cty)) { vNow += (w + o) * (fx[f] ?? 1); vGen += w + o + turnoutAdd(G, f, "Generic Democrat", "Generic Republican", w + o); }
  for (const [k, v] of Object.entries(G.tm?.dims ?? {})) { const st = /^\d/.test(k) ? FIPS_ST[k.slice(0, 2)] : k; stE[st] = (stE[st] ?? 0) + v[10]; }
  const adj: Record<string, number> = {}; for (const st of Object.keys(s0)) adj[st] = (100 * s0[st][0]) / s0[st][1] - (100 * s1[st][0]) / s1[st][1];
  for (const [f, [w0, o0, m, pd]] of Object.entries(G.cty)) {
    const st = FIPS_ST[f.slice(0, 2)]; const sh = dl[st] ?? 0; const k = fx[f] ?? 1; const w = w0 * k, o = o0 * k; const mm = m + sh + (adj[st] ?? 0); const D = (w * (1 - mm / 100)) / 2, R = w - D;
    const z = ninv(Math.min(0.999, Math.max(0.001, pd))) - sh / (G.sig[st] ?? 4); const pD = ncdf(z);
    cty[f] = [D, R, 0, o, pD, 1 - pD]; add(st, D, R, o);
  }
  for (const [s, [w0, o0, m]] of Object.entries(G.dist)) { const k = s.includes("-") ? 1 : 1 + turnoutAdd(G, s, d, r, w0 + o0) / Math.max(1, w0 + o0); const w = w0 * k, o = o0 * k; const mm = pm[s]?.[0] ?? m; const D = (w * (1 - mm / 100)) / 2; add(s, D, w - D, o); }
  let VD = 0, VR = 0, VO = 0;
  for (const [s, a] of Object.entries(states)) { a.m = pm[s]?.[0] ?? two(a.D, a.R); if (!s.includes("-")) { VD += a.D; VR += a.R; VO += a.O; } }
  // a place with no county rows, the District of Columbia, keeps the pairing's own margin and chance, at its usual turnout
  for (const s of G.keys) if (!states[s] && pm[s] && (G.ev[s] ?? 0) > 0) { const w = 330000, D = (w * (1 - pm[s][0] / 100)) / 2; states[s] = { D, R: w - D, I: 0, O: 0, m: pm[s][0], pD: pm[s][1], pR: 1 - pm[s][1], pI: 0, ev: G.ev[s] }; }
  return { D: d, R: r, T: null, pD: p[2], pR: 1 - p[2], pI: 0, pNone: 0, evD: p[3], evR: 538 - p[3], evI: 0, VD, VR, VI: 0, VO, hist: p[10], tip: p[7], states, cty,
    natM: p[6], ev10: p[4], ev90: p[5], hyp: p[9] === 1, sims: 20000,
    turnout: G.tm ? { elig: Object.values(stE).reduce((a, b) => a + b, 0), base: vGen + 330000, matchup: vNow - vGen, newT: 0, stE } : undefined };
}

/** the 2028 county wash: the win chance ramp at five steps a side, pale for close, deep for safe, lavender for even */
export const WASH_D = ["#a6b5e3", "#798bc9", "#5367b3", "#30469e", "#10288c"];
export const WASH_R = ["#e3aab7", "#c9798c", "#b35168", "#9e2c46", "#8c0a28"];
export const WASH_T = "#d9c6fb";
export const WASH_CUTS = [1, 6, 14, 26, 40];
export function washStep(m: number) { const a = Math.abs(m); return a < WASH_CUTS[0] ? 0 : a < WASH_CUTS[1] ? 1 : a < WASH_CUTS[2] ? 2 : a < WASH_CUTS[3] ? 3 : a < WASH_CUTS[4] ? 4 : 5; }
export function washColor(m: number) { const s = washStep(m); return s === 0 ? WASH_T : (m < 0 ? WASH_D : WASH_R)[s - 1]; }
export function washInk(m: number) { return washStep(m) >= 3 ? "#fff" : "#141218"; }
