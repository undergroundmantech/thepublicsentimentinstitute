// Campaign 2028: the engine. Pure functions over a plain state object, so a game saves as JSON and replays from its
// seed. Everything the voters react with comes from public/play/2028.json, built from the On Point 2028 model: every
// pairing's state margins, each candidate's coalition and issue positions, the primary calendar and every state's
// primary standing, the third party lanes, the vote history segments and where each party's voters stand.
// Margins in the general are R minus D in the data; the engine turns them into points from the player's side.

import { CRISES } from "./cards28";
import { worldWeek, dueStory, storyOf, type Story, type Econ } from "./story28";
import type { Meeting } from "./team28";
import { moreWeek, weekStart, type More, type Recount } from "./more28";
import { deepWeek, groupFx, groupStance, toGo, pollSd, payroll, bankOf, skewOf, earlyOf, type Grp, type Dma, type Staff, type Invite, type Closing } from "./deep28";

export type Party = "D" | "R";
export type Cand = { n: string; c: string; nat: number; home: Record<string, number>; hyp: number; lane: string; grp: Record<string, number>; nom: number; field: number;
  eff: number[]; effSrc: string; pos: number[] | null; emph: number[] | null; ind: number | null; note: string; src: string; sim: Record<string, number> };
export type Seg = [number, number, number]; // share of the state's 2028 voters, Democratic two party share, turnout
export type St = { st: string; n: string; ev: number; m: number; sd: number; p24: number | null; votes: number; close: number; segs: Seg[] };
export type Third = { n: string; who: string; status: string; lane: string; core: string; quotes: string[]; pillars: string; attacks: string; reach: string; risks: string; share: number; rlean: number; dlean: number; home: Record<string, number>; pos: number[] | null };
export type Issue = { k: string; l: string; d: number; r: number; i: number; cd: number; cr: number; ci: number };
export type Prim = { total: number; cal: [string, number, number][]; shares: Record<string, Record<string, number>>; rule: string };
export type Data = { groups?: Grp[]; dmas?: Dma[]; asOf: string; election: string; nat: number; pD: number; ev: number; iss: string[]; issues: Issue[]; seg: string[]; states: St[]; cands: Record<Party, Cand[]>; primary: Record<Party, Prim>; third: Third[] };
export type Diff = "safe" | "lean" | "tossup" | "wave";
export const DIFF: Record<Diff, { name: string; blurb: string; start: number; fund: number; opp: number; neg: number }> = {
  safe: { name: "Friendly year", blurb: "The wind at your back: two points better than the model, donors give more, rivals are slower.", start: 2, fund: 1.25, opp: 0.8, neg: 0.8 },
  lean: { name: "The model's year", blurb: "2028 exactly as the On Point model has it today.", start: 0, fund: 1, opp: 1, neg: 1 },
  tossup: { name: "Headwinds", blurb: "Two points behind the model, rivals spend sharper and mistakes cost more.", start: -2, fund: 0.92, opp: 1.15, neg: 1.2 },
  wave: { name: "Wave against you", blurb: "A national wave runs against your party. Down three and a half and sliding.", start: -3.5, fund: 0.82, opp: 1.3, neg: 1.35 },
};
/** Who runs your campaign. Each one makes one part of the operation better. */
export type Mgr = "data" | "ads" | "field" | "money" | "message";
export const MGR: Record<Mgr, { name: string; who: string; blurb: string; poll: number; tv: number; field: number; fund: number; crisis: number }> = {
  data: { name: "The data guru", who: "Analytics shop alum", blurb: "Sharper internal polls for less money, and every turnout drive is better targeted.", poll: 0.55, tv: 1, field: 1.15, fund: 1, crisis: 1 },
  ads: { name: "The ad maker", who: "Twenty years of spots", blurb: "Every television dollar goes further and attack ads backfire less.", poll: 1, tv: 1.2, field: 1, fund: 1, crisis: 1 },
  field: { name: "The field general", who: "Ran the last ground game", blurb: "Offices and field programs pay off a third more, and lines on Election Day hurt less.", poll: 1, tv: 1, field: 1.33, fund: 1, crisis: 1 },
  money: { name: "The finance chair", who: "Knows every bundler", blurb: "A quarter more from every call, dinner and email.", poll: 1, tv: 1, field: 1, fund: 1.25, crisis: 1 },
  message: { name: "The message guru", who: "Crisis comms veteran", blurb: "Scandals hurt about a third less and debate answers land harder.", poll: 1, tv: 1, field: 1, fund: 1, crisis: 0.68 },
};
export const mgrOf = (s: { mgr?: Mgr }) => MGR[s.mgr ?? "data"];
/** A scandal or attack that needs an answer. */
export type Crisis = { id: string; title: string; prompt: string; sev: number; opts: { label: string; say: string; risk: number; base: number; up: number; dn: number; days?: number }[] };
/** A hit your researchers found on the other side. power is how much it can move, solid how well it is sourced. */
export type Hit = { t: string; power: number; solid: number; used?: boolean; hit?: boolean };
export type LogItem = { t: number; kind: "you" | "rival" | "event" | "money" | "poll" | "result" | "bad"; s: string; fx?: number };
export const DAYS = 12;
export const COST = { rally: 2, hall: 1, fund: 2, media: 1, prep: 2, rest: 2, endorse: 2, organize: 1 } as const;
export const usd = (n: number) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// ------------------------------------------------------------- randomness, kept in the state
export function rand(g: { rng: number }) { let t = (g.rng += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const gauss = (g: { rng: number }) => { const u = Math.max(1e-9, rand(g)), v = rand(g); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ============================================================= PRIMARIES
export type Rival = { n: string; alive: boolean; cash: number; mom: number; del: number; wins: number; endorse: string[]; out?: number; why?: string };
export type Turn = { label: string; date: string; states: string[]; debate?: boolean };
export type PrimS = {
  party: Party; turns: Turn[]; t: number; days: number; cash: number; stamina: number; buzz: number; field: Rival[];
  boost: Record<string, Record<string, number>>; // log share boosts by state by candidate
  visits: Record<string, number>; offices: string[]; results: Record<string, { sh: Record<string, number>; del: Record<string, number>; win: string }>;
  shifts: Record<string, number>; // your stance moves on each issue from your record, carried into November
  endorsed: string[]; debates: number; done: boolean; nominee?: string; contested?: boolean; cards: Card[]; cardT: number; ans?: number; debW?: number;
  mgr?: Mgr; gused?: Record<string, number>; vpPromise?: string; crisis?: Crisis | null; crisisT?: number; deals?: string[]; perfect?: number; early?: number;
  story?: Story;
};
/** Who can endorse in each party's primary, and what the endorsement does. */
export const ENDORSERS: Record<Party, { id: string; who: string; what: string; mom: number; st?: string[]; local?: number; cash?: number; lean?: string; hard: number }[]> = {
  D: [
    { id: "clyburn", who: "Jim Clyburn", what: "The South Carolina kingmaker. A big lift with Black voters across the South.", mom: 0.06, st: ["SC", "GA", "AL", "MS", "NC", "VA", "TN", "LA"], local: 0.22, hard: 0.55 },
    { id: "sanders", who: "Bernie Sanders", what: "The progressive movement's blessing: young voters, small donors, a rally army.", mom: 0.07, cash: 18e6, lean: "left", hard: 0.6 },
    { id: "unions", who: "AFL-CIO and the UAW", what: "Union halls in the industrial Midwest and Nevada's culinary workers.", mom: 0.04, st: ["MI", "PA", "OH", "WI", "NV", "MN", "IL"], local: 0.18, hard: 0.5 },
    { id: "obama", who: "Barack Obama", what: "Almost never endorses in a primary. If he does, it ends a lot of arguments.", mom: 0.18, hard: 0.9 },
    { id: "govs", who: "A bloc of Democratic governors", what: "Machines in the big states and a signal to donors.", mom: 0.05, cash: 25e6, hard: 0.5 },
  ],
  R: [
    { id: "trump", who: "Donald Trump", what: "The endorsement that decides most Republican primaries. He wants loyalty on tariffs and immigration.", mom: 0.32, local: 0.1, hard: 0.85, lean: "right" },
    { id: "musk", who: "Elon Musk", what: "A super PAC check with a lot of zeros, and a platform.", mom: 0.05, cash: 120e6, hard: 0.7 },
    { id: "evang", who: "Iowa evangelical leaders", what: "Church networks that power the caucuses and the South.", mom: 0.03, st: ["IA", "SC", "AL", "MS", "TN", "OK", "AR"], local: 0.2, hard: 0.5 },
    { id: "af", who: "Tucker Carlson's America First wing", what: "Anti war voters and the online right.", mom: 0.05, st: ["NH", "NV", "IA"], local: 0.12, hard: 0.6, lean: "af" },
    { id: "cfg", who: "Club for Growth", what: "Free market money and ads in the early states.", mom: 0.02, cash: 40e6, st: ["IA", "NH"], local: 0.08, hard: 0.45 },
  ],
};
const PRIM_DATES: Record<Party, Record<string, string>> = {
  D: { SC: "Feb 3", NH: "Feb 10", NV: "Feb 17", MI: "Feb 27" },
  R: { IA: "Jan 17", NH: "Jan 25", NV: "Feb 8", SC: "Feb 22" },
};
export function primTurns(d: Data, p: Party, long = false): Turn[] {
  const cal = d.primary[p].cal; const w = (k: number) => cal.filter((c) => c[1] === k).map((c) => c[0]);
  const early = w(1).sort((a, b) => Date.parse(`${PRIM_DATES[p][a] ?? "Mar 1"} 2028`) - Date.parse(`${PRIM_DATES[p][b] ?? "Mar 1"} 2028`));
  const w4 = w(4); const half = Math.ceil(w4.length / 2);
  const w3 = w(3); const h3 = Math.ceil(w3.length / 2);
  if (long) return [
    { label: "The launch", date: "Summer 2027", states: [] },
    { label: "The cattle calls", date: "Fall 2027", states: [], debate: true },
    { label: "The money race", date: "December 2027", states: [] },
    { label: "The final push", date: "January 2028", states: [], debate: true },
    ...early.map((st) => ({ label: `${d.states.find((x) => x.st === st)?.n ?? st} ${p === "R" && st === "IA" ? "caucuses" : "primary"}`, date: PRIM_DATES[p][st] ?? "February", states: [st], debate: st === early[1] })),
    { label: "Super Tuesday", date: "Mar 7", states: w(2), debate: false },
    { label: "Mid March", date: "Mar 14", states: w3.slice(0, h3), debate: true },
    { label: "Late March", date: "Mar 21 to 28", states: w3.slice(h3) },
    { label: "April primaries", date: "April", states: w4.slice(0, half) },
    { label: "The last primaries", date: "May and June", states: w4.slice(half) },
  ];
  return [
    { label: "The invisible primary", date: "Fall 2027", states: [], debate: true },
    { label: "The final push", date: "January 2028", states: [], debate: true },
    ...early.map((st) => ({ label: `${d.states.find((x) => x.st === st)?.n ?? st} ${p === "R" && st === "IA" ? "caucuses" : "primary"}`, date: PRIM_DATES[p][st] ?? "February", states: [st], debate: st === early[1] })),
    { label: "Super Tuesday", date: "Mar 7", states: w(2), debate: false },
    { label: "Mid March", date: "Mar 14 to 21", states: w(3), debate: true },
    { label: "April primaries", date: "April", states: w4.slice(0, half) },
    { label: "The last primaries", date: "May and June", states: w4.slice(half) },
  ];
}
export function newPrimary(d: Data, p: Party, me: string, diff: Diff, seed: number, long = false): PrimS {
  const g = { rng: seed };
  const cs = d.cands[p];
  const top = cs.filter((c) => c.n !== me).sort((a, b) => b.nom - a.nom || b.field - a.field).slice(0, 7).map((c) => c.n);
  const names = [me, ...top];
  const meC = cs.find((c) => c.n === me)!;
  const startCash = (c: Cand) => 6e6 + 70e6 * Math.min(1, c.nom * 1.4) + 1.6e6 * c.field;
  const field: Rival[] = names.map((n) => { const c = cs.find((x) => x.n === n)!; return { n, alive: true, cash: startCash(c) * (n === me ? DIFF[diff].fund : 1 / DIFF[diff].opp), mom: n === me ? DIFF[diff].start * 0.04 : gauss(g) * 0.03, del: 0, wins: 0, endorse: [] }; });
  const s: PrimS = { party: p, turns: primTurns(d, p, long), t: 0, days: DAYS, cash: field[0].cash, stamina: 100, buzz: 30 + Math.round(meC.field * 2), field, boost: {}, visits: {}, offices: [], results: {}, shifts: {}, endorsed: [], debates: 0, done: false, cards: [], cardT: -1 };
  field[0].cash = 0; // the player's cash lives in s.cash
  return s;
}
/** Every candidate's share in a state right now, from the model's primary standing, momentum and local boosts. */
export function primShares(d: Data, s: PrimS, st: string): Record<string, number> {
  const base = d.primary[s.party].shares[st] ?? {};
  const alive = s.field.filter((r) => r.alive);
  const w: Record<string, number> = {};
  for (const r of alive) { const b0 = Math.max(0.3, base[r.n] ?? d.cands[s.party].find((c) => c.n === r.n)?.field ?? 1); w[r.n] = b0 * Math.exp(r.mom + (s.boost[st]?.[r.n] ?? 0)); }
  const tot = Object.values(w).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, (100 * v) / tot]));
}
export function natShares(d: Data, s: PrimS) {
  const sts = Object.keys(d.primary[s.party].shares); const acc: Record<string, number> = {};
  for (const st of sts) { const x = primShares(d, s, st); for (const k in x) acc[k] = (acc[k] ?? 0) + x[k] / sts.length; }
  return acc;
}
const delOf = (d: Data, p: Party, st: string) => d.primary[p].cal.find((c) => c[0] === st)?.[2] ?? 0;
const winOf = (d: Data, p: Party, st: string) => d.primary[p].cal.find((c) => c[0] === st)?.[1] ?? 4;
const addBoost = (s: PrimS, st: string, n: string, v: number) => { s.boost[st] ??= {}; s.boost[st][n] = (s.boost[st][n] ?? 0) + v; };
const me0 = (s: PrimS) => s.field[0].n;
export type Res = { ok: boolean; t: string; fx?: number };

export function primRally(d: Data, s: PrimS, st: string): Res {
  if (s.days < COST.rally) return { ok: false, t: "A rally takes a full day." };
  if (s.cash < 150e3) return { ok: false, t: "Not enough cash for a rally." };
  const v = s.visits[st] ?? 0; const early = winOf(d, s.party, st) === 1 ? 1.6 : 1;
  const k = 0.16 * early / (1 + 0.45 * v) * (0.7 + s.stamina / 330);
  s.days -= COST.rally; s.cash -= 150e3; s.visits[st] = v + 1; s.stamina = clamp(s.stamina - 12, 0, 100); s.buzz = clamp(s.buzz + 3, 0, 100);
  addBoost(s, st, me0(s), k);
  return { ok: true, t: `Rally in ${nameOf(d, st)}: about ${(k * 100).toFixed(0)} percent more support there.`, fx: k };
}
export function primTownHall(d: Data, s: PrimS, st: string): Res {
  if (s.days < 1) return { ok: false, t: "No time left this turn." };
  const v = s.visits[st] ?? 0; const k = 0.07 / (1 + 0.3 * v) * (winOf(d, s.party, st) === 1 ? 1.5 : 1);
  s.days -= 1; s.cash -= 40e3; s.visits[st] = v + 1; s.stamina = clamp(s.stamina - 6, 0, 100); addBoost(s, st, me0(s), k);
  return { ok: true, t: `A diner and town hall swing through ${nameOf(d, st)}.`, fx: k };
}
export function primTV(d: Data, s: PrimS, st: string, amt: number): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const scale = Math.max(1, delOf(d, s.party, st)) * 60e3;
  const k = 0.22 * Math.log(1 + amt / scale) * mgrOf(s).tv;
  s.cash -= amt; addBoost(s, st, me0(s), k);
  return { ok: true, t: `${usd(amt)} of television in ${nameOf(d, st)}.`, fx: k };
}
export function primOffice(d: Data, s: PrimS, st: string): Res {
  if (s.offices.includes(st)) return { ok: false, t: "You already have an operation there." };
  if (s.cash < 400e3) return { ok: false, t: "An operation costs $400K." };
  if (s.days < COST.organize) return { ok: false, t: "No time left this turn." };
  const k = 0.09 * mgrOf(s).field; s.cash -= 400e3; s.days -= COST.organize; s.offices.push(st); addBoost(s, st, me0(s), k);
  return { ok: true, t: `Staff and organizers on the ground in ${nameOf(d, st)}. Your voters there are now on lists, and they turn out.`, fx: k };
}
export function primFund(d: Data, s: PrimS, kind: "call" | "email" | "bundlers"): Res {
  const sh = natShares(d, s)[me0(s)] ?? 5;
  if (kind === "email") {
    const amt = Math.round((0.6e6 + 0.12e6 * sh) * (0.6 + s.buzz / 80) * Math.exp(s.field[0].mom) * mgrOf(s).fund);
    s.cash += amt; s.buzz = clamp(s.buzz - 4, 0, 100); return { ok: true, t: `A small dollar email and text blast: ${usd(amt)}.` };
  }
  const need = kind === "call" ? 1 : 2; if (s.days < need) return { ok: false, t: "No time left this turn." };
  s.days -= need; s.stamina = clamp(s.stamina - 5 * need, 0, 100);
  const amt = Math.round((kind === "call" ? 0.8e6 : 2.6e6) * (0.5 + sh / 12) * Math.exp(s.field[0].mom * 0.8) * mgrOf(s).fund);
  s.cash += amt; return { ok: true, t: kind === "call" ? `A morning of call time: ${usd(amt)}.` : `A bundlers' dinner on the coasts: ${usd(amt)}.` };
}
export function primMedia(d: Data, s: PrimS, G: { rng: number }): Res {
  if (s.days < 1) return { ok: false, t: "No time left this turn." };
  s.days -= 1; const k = 0.015 + rand(G) * 0.02;
  s.field[0].mom += k; s.buzz = clamp(s.buzz + 6, 0, 100);
  return { ok: true, t: "Sunday shows, two podcasts and a late night couch.", fx: k };
}
export function primRest(s: PrimS): Res { if (s.days < 2) return { ok: false, t: "No time left this turn." }; s.days -= 2; s.stamina = clamp(s.stamina + 30, 0, 100); return { ok: true, t: "A day home. The candidate sleeps." }; }
/** Chase an endorsement: the closer your record sits to what the endorser wants, the better the odds. */
export function primEndorse(d: Data, s: PrimS, id: string, seedG: { rng: number }): Res {
  const e = ENDORSERS[s.party].find((x) => x.id === id); if (!e) return { ok: false, t: "Unknown." };
  if (s.endorsed.includes(id) || s.field.some((r) => r.endorse.includes(id))) return { ok: false, t: `${e.who} has already endorsed.` };
  if (s.days < COST.endorse) return { ok: false, t: "Courting an endorsement takes a full day." };
  s.days -= COST.endorse;
  const me = d.cands[s.party].find((c) => c.n === me0(s))!; const sh = natShares(d, s)[me.n] ?? 5;
  let fit = 0.5;
  if (e.lean === "left" && me.pos) fit = clamp(0.5 - (me.pos[0] + me.pos[1] + me.pos[12]) / 6, 0, 1);
  if (e.lean === "right" && me.pos) fit = clamp((me.pos[4] + me.pos[13]) / 4, 0, 1);
  if (e.lean === "af" && me.pos) fit = clamp(0.5 - me.pos[11] / 3, 0, 1);
  const p = clamp((0.15 + 0.5 * fit + sh / 60 + s.field[0].mom) * (1 - e.hard * 0.7), 0.03, 0.85);
  if (rand(seedG) < p) {
    s.endorsed.push(id); s.field[0].mom += e.mom; s.field[0].endorse.push(id); if (e.cash) s.cash += e.cash;
    for (const st of e.st ?? []) addBoost(s, st, me.n, e.local ?? 0.1);
    return { ok: true, t: `${e.who} endorses you. ${e.what}`, fx: e.mom };
  }
  return { ok: true, t: `${e.who} took the meeting, and is keeping their powder dry. About a ${Math.round(p * 100)} percent shot.` };
}
/** Take a stand on an issue in the primary. Your party's voters reward moving toward them, weighted by how much they
 * care; independents remember it in November. Breaking with your own record costs credibility. */
/** How many points of the national margin a full move to where independents are is worth, per unit of how much they care. */
const STANCE_IND = 1.0;
export function primStance(d: Data, s: PrimS, k: number, pos: number, mult = 1): { fx: number; gen: number } {
  const me = d.cands[s.party].find((c) => c.n === me0(s))!; const is = d.issues[k];
  const cur = (me.pos?.[k] ?? (s.party === "D" ? is.d : is.r)) + (s.shifts[d.iss[k]] ?? 0);
  const voter = s.party === "D" ? is.d : is.r; const care = s.party === "D" ? is.cd : is.cr;
  const gain = 0.8 * care * ((voter - cur) ** 2 - (voter - pos) ** 2) * mult;
  const dev = Math.abs(pos - (me.pos?.[k] ?? cur)); const flip = dev > 0.9 ? -0.05 * (0.5 + (me.emph?.[k] ?? 1)) * (dev - 0.9) : 0;
  const gen = STANCE_IND * is.ci * ((is.i - cur) ** 2 - (is.i - pos) ** 2);
  s.shifts[d.iss[k]] = pos - (me.pos?.[k] ?? cur);
  const fx = gain + flip; s.field[0].mom += fx;
  return { fx, gen };
}
/** End the turn: rivals campaign, the turn's contests are counted, delegates allocated, momentum moves and the weak drop. */
export function primEnd(d: Data, s: PrimS, G: { rng: number }): LogItem[] {
  const out: LogItem[] = []; const T = s.turns[s.t];
  // rivals spend where the next contests are
  const next = s.turns.slice(s.t, s.t + 2).flatMap((x) => x.states);
  for (const r of s.field.slice(1)) {
    if (!r.alive) continue;
    r.mom += gauss(G) * 0.035 - 0.004;
    const spend = Math.min(r.cash, 2.5e6 + r.cash * 0.25) * DIFF.lean.opp;
    r.cash -= spend; r.cash += (1.2e6 + 0.5e6 * (natShares(d, s)[r.n] ?? 3)) * Math.exp(r.mom);
    for (const st of next) addBoost(s, st, r.n, 0.12 * Math.log(1 + spend / Math.max(1, next.length) / (Math.max(1, delOf(d, s.party, st)) * 60e3)) * (0.6 + rand(G) * 0.8));
    // rivals chase endorsements too
    if (rand(G) < 0.18) {
      const free = ENDORSERS[s.party].filter((e) => !s.endorsed.includes(e.id) && !s.field.some((x) => x.endorse.includes(e.id)));
      const e = free[Math.floor(rand(G) * free.length)];
      if (e && rand(G) < 0.5 * (1 - e.hard * 0.6) + (natShares(d, s)[r.n] ?? 0) / 80) { r.endorse.push(e.id); r.mom += e.mom; if (e.cash) r.cash += e.cash; for (const st of e.st ?? []) addBoost(s, st, r.n, e.local ?? 0.1); out.push({ t: s.t, kind: "rival", s: `${e.who} endorses ${r.n}.` }); }
    }
  }
  // the turn's contests
  for (const st of T.states) {
    const sh = primShares(d, s, st);
    const noisy: Record<string, number> = {}; for (const k in sh) noisy[k] = sh[k] * Math.exp(gauss(G) * (s.offices.includes(st) && k === me0(s) ? 0.1 : 0.16));
    const tot = Object.values(noisy).reduce((a, b) => a + b, 0); for (const k in noisy) noisy[k] = (100 * noisy[k]) / tot;
    const del = delOf(d, s.party, st); const win = Object.entries(noisy).sort((a, b) => b[1] - a[1])[0][0];
    const alloc: Record<string, number> = {};
    const wta = s.party === "R" && winOf(d, s.party, st) >= 3;
    if (wta) alloc[win] = del;
    else {
      const th = s.party === "D" ? 15 : 20;
      let elig = Object.entries(noisy).filter(([, v]) => v >= th); if (!elig.length) elig = [[win, 100]];
      const et = elig.reduce((a, [, v]) => a + v, 0); let left = del;
      elig.sort((a, b) => b[1] - a[1]).forEach(([k, v], i) => { const n = i === elig.length - 1 ? left : Math.round((del * v) / et); alloc[k] = n; left -= n; });
    }
    for (const r of s.field) { r.del += alloc[r.n] ?? 0; }
    const wr = s.field.find((r) => r.n === win)!; wr.wins += 1;
    const early = winOf(d, s.party, st) === 1;
    for (const r of s.field) { if (!r.alive) continue; const v = noisy[r.n] ?? 0; const exp = sh[r.n] ?? 0; r.mom += (early ? 0.5 : 0.15) * ((v - exp) / 100) + (r.n === win ? (early ? 0.09 : 0.02) : 0); }
    s.results[st] = { sh: noisy, del: alloc, win };
    out.push({ t: s.t, kind: "result", s: `${nameOf(d, st)}: ${win} wins with ${noisy[win].toFixed(0)} percent${win === me0(s) ? ", your win" : ""}. You take ${alloc[me0(s)] ?? 0} of ${del} delegates.` });
  }
  if (T.states.length) {
    const mine = T.states.reduce((a, st) => a + (s.results[st].del[me0(s)] ?? 0), 0);
    s.cash += Math.round(1.5e6 * mine / 30);
  }
  // receipts for the player
  const sh = natShares(d, s)[me0(s)] ?? 4;
  const rec = Math.round((1.4e6 + 0.45e6 * sh) * Math.exp(s.field[0].mom) * (0.7 + s.buzz / 100));
  s.cash += rec; out.push({ t: s.t, kind: "money", s: `Online and mail receipts: ${usd(rec)}.` });
  // dropouts after the voting starts: the weak and the broke leave, and their voters move to the candidates most like them
  if (s.t >= 3) {
    const ns = natShares(d, s); const lead = Math.max(...s.field.map((r) => r.del));
    for (const r of s.field.slice(1)) {
      if (!r.alive) continue;
      const weak = (ns[r.n] ?? 0) < (s.t >= 6 ? 9 : 5) && r.del < 0.08 * d.primary[s.party].total;
      const broke = r.cash < 1e6; const far = lead > 0.5 * d.primary[s.party].total && r.del < lead * 0.45;
      if (weak || broke || far) {
        const why = far ? "the math is gone" : broke ? "the money ran out" : "no path";
        const simTo = d.cands[s.party].find((c) => c.n === r.n)?.sim ?? {};
        const best = s.field.filter((x) => x.alive && x.n !== r.n).sort((a, b) => (simTo[b.n] ?? 0) - (simTo[a.n] ?? 0))[0];
        const to = best && rand(G) < 0.55 ? best.n : null;
        dropOut(d, s, r.n, to, why);
        out.push({ t: s.t, kind: "rival", s: to ? `${r.n} drops out, since ${why}, and endorses ${to}. Their voters split mostly toward the candidates closest to them.` : `${r.n} suspends the campaign: ${why}. Their voters split toward the candidates closest to them.` });
      }
    }
  }
  // a scandal or a rival's attack, roughly one turn in five once the race is on
  if (!s.crisis && s.t >= 1 && rand(G) < 0.22) { const riv = s.field.filter((r) => r.alive && r.n !== me0(s)).sort((a, b) => (natShares(d, s)[b.n] ?? 0) - (natShares(d, s)[a.n] ?? 0))[0]; s.crisis = dealCrisis(d, s.party, me0(s), riv?.n ?? "a rival", null, G, false); s.crisisT = s.t + 1; }
  s.field.forEach((r) => (r.mom = clamp(r.mom, -1.6, 1.6)));
  s.t += 1; s.days = DAYS; s.stamina = clamp(s.stamina + 18, 0, 100);
  const tot = d.primary[s.party].total;
  const leader = s.field.slice().sort((a, b) => b.del - a.del)[0];
  if (s.t >= s.turns.length || leader.del > tot / 2 && s.t >= s.turns.length - 1) {
    s.done = true;
    if (leader.del > tot / 2) s.nominee = leader.n; else { s.contested = true; }
  }
  return out;
}
export const nameOf = (d: Data, st: string) => d.states.find((x) => x.st === st)?.n ?? st;
/** The chance of each candidate's nomination right now, from delegates in hand and their standing in what is left. */
export function primOdds(d: Data, s: PrimS): Record<string, number> {
  const tot = d.primary[s.party].total; const left = s.turns.slice(s.t).flatMap((x) => x.states);
  const ns = natShares(d, s); const w: Record<string, number> = {};
  for (const r of s.field) { if (!r.alive) { w[r.n] = 0; continue; } const proj = r.del + (left.reduce((a, st) => a + delOf(d, s.party, st), 0) * (ns[r.n] ?? 0)) / 100; w[r.n] = Math.pow(Math.max(0.01, proj / tot), 3.2); }
  const t = Object.values(w).reduce((a, b) => a + b, 0) || 1; return Object.fromEntries(Object.entries(w).map(([k, v]) => [k, v / t]));
}

// ============================================================= THE GENERAL ELECTION
export type GenS = {
  party: Party; me: string; op: string; vp: string | null; opVp: string | null; third: string | null; diff: Diff;
  week: number; weeks: number; days: number; cash: number; opCash: number; stamina: number; enth: [number, number];
  pers: number[]; ads: number[]; opAds: number[]; gotv: number[]; offices: string[]; visits: Record<string, number>; opVisits: string[];
  nat: number; bias: number; vpSt: string | null; prep: number; debates: { w: number; done: boolean; score?: number; kind: "pres" | "vp" }[];
  polls: { w: number; st: string; m: number; by?: string }[]; natPolls: { w: number; m: number }[]; segUsed: Record<string, number>; banked: number;
  cards: Card[]; cardW: number; done: boolean; result?: NightRes; shifts: Record<string, number>; trend: { w: number; m: number; ev: number; p: number }[]; ans?: number; debW?: number; emailW?: number; opN?: Record<string, number>;
  mgr?: Mgr; fog?: number[]; polledW?: Record<string, number>; oppo?: Hit[]; dug?: number; crisis?: Crisis | null; crisisW?: number; surprise?: boolean;
  pac?: [number, number]; perfect?: number; ralliesW?: number; lowP?: number; promise?: string;
  // the deep campaign: groups, early votes, staff, field, air time, invitations, the betting line, the final weekend
  gsup?: Record<string, number>; gturn?: Record<string, number>; opGsup?: Record<string, number>; opGturn?: Record<string, number>; gstate?: Record<string, number>; gused?: Record<string, number>;
  bank?: number[]; bankM?: number[]; chase?: number[]; opChase?: number[]; ballots?: number; ballotsM?: number;
  staff?: Staff; vol?: number; contacts?: number; reserved?: { w: number; dma: string; amt: number; tone: string }[];
  invites?: Invite[]; invW?: number; met?: number; mkt?: { p: number; hist: number[] }; finalDone?: boolean; closing?: Closing; lawyers?: boolean;
  // the story and the staff: what the campaign has said and done, the world's own calendar, and the weekly staff meeting
  story?: Story; econ?: Econ; raised?: number; opRaised?: number; spent?: number; spentLast?: number; opFocus?: string[];
  meeting?: Meeting | null; meetW?: number; metDept?: Record<string, number>;
  mo?: More; scen?: number[];
};
export const nState = (d: Data) => d.states.length;
export function candOf(d: Data, p: Party, n: string) { return d.cands[p].find((c) => c.n === n)!; }
const sideSign = (p: Party) => (p === "R" ? 1 : -1); // turns R minus D into the player's favor
/** The model's margin in each state for this pairing, R minus D: base, the Democrat's effect, the Republican's. */
export function pairMargins(d: Data, dName: string, rName: string): number[] {
  const D = candOf(d, "D", dName), R = candOf(d, "R", rName);
  return d.states.map((s, i) => s.m + (D?.eff[i] ?? 0) + (R?.eff[i] ?? 0));
}
/** A running mate brings their home state and half their regional pull. */
export function vpEffect(d: Data, p: Party, vp: string | null): number[] {
  if (!vp) return d.states.map(() => 0);
  const c = candOf(d, p, vp); const mean = c.eff.reduce((a, b) => a + b, 0) / c.eff.length;
  return d.states.map((s, i) => { const home = c.home[s.st.split("-")[0]] ?? 0; return -0.3 * (c.eff[i] - mean) + (home ? (p === "R" ? 1 : -1) * Math.abs(home) * 0.5 : 0); }); // R minus D
}
/** A third party candidate takes votes by lane: their draw from each side moves the two party margin. */
export function thirdEffect(d: Data, t: string | null): number[] {
  const x = d.third.find((y) => y.n === t); if (!x) return d.states.map(() => 0);
  return d.states.map((s) => { const comp = Math.max(0.4, 1 - Math.abs(s.m) / 40); return -x.share * comp * (x.rlean - x.dlean) * 0.9; });
}
export function newGeneral(d: Data, p: Party, me: string, op: string, vp: string | null, opVp: string | null, third: string | null, diff: Diff, seed: number, shifts: Record<string, number> = {}, cashAdd = 0, mgr: Mgr = "data", weeks = 12): GenS {
  const g = { rng: seed }; const n = nState(d); const W = Math.max(8, Math.min(16, weeks));
  const cashK = 0.55 + 0.45 * (W / 10); // a longer race means more to raise and more to spend
  const s: GenS = { party: p, me, op, vp, opVp, third, diff, week: 1, weeks: W, days: DAYS, cash: 200e6 * cashK * DIFF[diff].fund + cashAdd, opCash: 200e6 * cashK / DIFF[diff].opp,
    stamina: 100, enth: [50, 50], pers: Array(n).fill(0), ads: Array(n).fill(0), opAds: Array(n).fill(0), gotv: Array(n).fill(0), offices: [], visits: {}, opVisits: [],
    nat: DIFF[diff].start, bias: Math.round(gauss(g) * 2.0 * 100) / 100, vpSt: null, prep: 0,
    debates: [{ w: W - 5, done: false, kind: "pres" }, { w: W - 3, done: false, kind: "vp" }, { w: W - 1, done: false, kind: "pres" }],
    polls: [], natPolls: [], segUsed: {}, banked: 0, cards: [], cardW: 0, done: false, shifts, trend: [],
    mgr, fog: d.states.map(() => gauss(g) * 2.2), polledW: {}, oppo: [], pac: [0, 0], perfect: 0,
    staff: { pollster: 0, media: false, field: false, digital: false, oppo: false }, vol: 15000, gsup: {}, gturn: {}, opGsup: {}, opGturn: {}, gstate: {}, reserved: [], invites: [] };
  // what the primary did to you with independents: every stance you moved, judged by independents and how much they care
  const meC = candOf(d, p, me); let gen = 0;
  d.issues.forEach((is, k) => { const sh = shifts[is.k]; if (!sh || !meC.pos) return; const a = meC.pos[k], b = a + sh; gen += STANCE_IND * is.ci * ((is.i - a) ** 2 - (is.i - b) ** 2); });
  s.nat += gen;
  s.trend.push({ w: 0, ...snapshot(d, s) }); s.lowP = s.trend[0].p;
  return s;
}
/** Expected R minus D margins by state, before election night noise. */
export function marginsRD(d: Data, s: GenS): number[] {
  const D = s.party === "D" ? s.me : s.op, R = s.party === "R" ? s.me : s.op;
  const base = pairMargins(d, D, R), vD = vpEffect(d, "D", s.party === "D" ? s.vp : s.opVp), vR = vpEffect(d, "R", s.party === "R" ? s.vp : s.opVp), th = thirdEffect(d, s.third);
  const sg = sideSign(s.party);
  const en = ((s.enth[0] - 50) - (s.enth[1] - 50)) / 25; // points from enthusiasm, the player's way
  const gf = groupFx(d, s);
  return base.map((b, i) => b + (s.scen?.[i] ?? 0) + vD[i] + vR[i] + th[i] + sg * (s.nat + s.pers[i] + s.ads[i] - s.opAds[i] + s.gotv[i] + en + gf[i]));
}
/** Player margins (positive is the player leading). */
export const myMargins = (d: Data, s: GenS) => marginsRD(d, s).map((m) => sideSign(s.party) * m);
export function evCount(d: Data, s: GenS, ms = myMargins(d, s)) { let me = 0; d.states.forEach((x, i) => { if (ms[i] > 0) me += x.ev; }); return me; }
/** Win chance from a quick simulation: one shared national error, a regional error and each state's own. */
export function winProb(d: Data, s: GenS, N = 500, seed = 7, ms0?: number[]): number {
  const g = { rng: seed + s.week * 101 }; const ms = ms0 ?? readMargins(d, s); let w = 0;
  const regs = d.states.map((x) => REGION[x.st.split("-")[0]] ?? 0);
  const left = Math.max(0.35, (s.weeks - s.week + 1) / s.weeks);
  for (let k = 0; k < N; k++) {
    const nat = gauss(g) * (2.4 + 2.2 * left); const rg = [0, 1, 2, 3, 4].map(() => gauss(g) * 1.4);
    let ev = 0; d.states.forEach((x, i) => { if (ms[i] + nat + rg[regs[i]] + gauss(g) * Math.max(1.5, x.sd * 0.45) > 0) ev += x.ev; });
    if (ev >= 270) w++;
  }
  return w / N;
}
export const REGION: Record<string, number> = Object.fromEntries([
  ...["ME", "NH", "VT", "MA", "RI", "CT", "NY", "NJ", "PA", "DE", "MD", "DC"].map((s) => [s, 0]), ...["OH", "MI", "IN", "IL", "WI", "MN", "IA", "MO", "ND", "SD", "NE", "KS"].map((s) => [s, 1]),
  ...["VA", "WV", "KY", "TN", "NC", "SC", "GA", "FL", "AL", "MS", "LA", "AR", "OK", "TX"].map((s) => [s, 2]), ...["MT", "ID", "WY", "CO", "UT", "NV", "AZ", "NM"].map((s) => [s, 3]), ...["CA", "OR", "WA", "AK", "HI"].map((s) => [s, 4])]);
export function snapshot(d: Data, s: GenS) { const ms = readMargins(d, s); return { m: natMargin(d, ms), ev: evCount(d, s, ms), p: winProb(d, s, 300, 7, ms) }; }
export function natMargin(d: Data, ms: number[]) { let a = 0, t = 0; d.states.forEach((x, i) => { if (x.st.includes("-")) return; a += ms[i] * x.votes; t += x.votes; }); return a / Math.max(1, t); }
const si = (d: Data, st: string) => d.states.findIndex((x) => x.st === st);
const sizeK = (x: St) => 3.2 / Math.sqrt(4 + x.ev); // a visit moves a small state more

export function genRally(d: Data, s: GenS, st: string): Res {
  if (s.days < COST.rally) return { ok: false, t: "A rally takes a full day." };
  if (s.cash < 400e3) return { ok: false, t: "Not enough cash for a rally." };
  const i = si(d, st); if (i < 0) return { ok: false, t: "Unknown state." };
  const v = s.visits[st] ?? 0; const k = sizeK(d.states[i]) * 0.55 / (1 + 0.5 * v) * (0.7 + s.stamina / 330);
  s.days -= COST.rally; s.cash -= 400e3; s.visits[st] = v + 1; s.pers[i] += k; s.enth[0] = clamp(s.enth[0] + 0.8, 0, 100); s.stamina = clamp(s.stamina - 12, 0, 100);
  return { ok: true, t: `Rally in ${d.states[i].n}: about ${k.toFixed(2)} points there, and your voters saw it.`, fx: k };
}
export function genHall(d: Data, s: GenS, st: string): Res {
  if (s.days < 1) return { ok: false, t: "No time left this week." };
  const i = si(d, st); const v = s.visits[st] ?? 0; const k = sizeK(d.states[i]) * 0.25 / (1 + 0.4 * v);
  s.days -= 1; s.cash -= 80e3; s.visits[st] = v + 1; s.pers[i] += k; s.nat += 0.02; s.stamina = clamp(s.stamina - 6, 0, 100);
  return { ok: true, t: `Town hall with undecided voters in ${d.states[i].n}.`, fx: k };
}
export type Tone = "positive" | "contrast" | "attack";
export const TONES: Record<Tone, { name: string; blurb: string; k: number; risk: number }> = {
  positive: { name: "Positive", blurb: "Your story. Moves less, fires up your side, never backfires.", k: 0.85, risk: 0 },
  contrast: { name: "Contrast", blurb: "You against them on the issues. The workhorse.", k: 1, risk: 0.04 },
  attack: { name: "Attack", blurb: "Hits hardest, and about one in five backfires.", k: 1.3, risk: 0.2 },
};
export function genTV(d: Data, s: GenS, st: string, amt: number, tone: Tone = "contrast", G?: { rng: number }): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const i = si(d, st); if (i < 0) return { ok: false, t: "Unknown state." };
  const T = TONES[tone]; let k = 0.9 * Math.log(1 + amt / (d.states[i].votes * 1.6)) * (toGo(s) <= 2 ? 1.15 : 1) * mgrOf(s).tv * T.k * (s.staff?.media ? 1.2 : 1);
  s.cash -= amt;
  const risk = T.risk * (s.mgr === "ads" ? 0.5 : 1);
  if (G && rand(G) < risk) { k = -0.35 * k; s.ads[i] += k; s.enth[1] = clamp(s.enth[1] + 0.8, 0, 100); return { ok: true, t: `The ${T.name.toLowerCase()} ad in ${d.states[i].n} backfired: local news called it misleading and ran it free for the other side.`, fx: k }; }
  s.ads[i] += k; if (tone === "positive") s.enth[0] = clamp(s.enth[0] + 0.4, 0, 100);
  return { ok: true, t: `${usd(amt)} of ${T.name.toLowerCase()} television in ${d.states[i].n}.`, fx: k };
}
export function genNatTV(d: Data, s: GenS, amt: number): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const k = 0.35 * Math.log(1 + amt / 60e6); s.cash -= amt; s.nat += k * 0.5; d.states.forEach((_, i) => (s.ads[i] += k * 0.5));
  return { ok: true, t: `${usd(amt)} on national cable, streaming and the big games.`, fx: k };
}
export function genOffice(d: Data, s: GenS, st: string): Res {
  if (s.offices.includes(st)) return { ok: false, t: "You already run a field program there." };
  if (s.cash < 2.5e6) return { ok: false, t: "A coordinated field program costs $2.5M." };
  const i = si(d, st); s.cash -= 2.5e6; s.offices.push(st); s.gotv[i] += 0.35 * sizeK(d.states[i]) * 2 * mgrOf(s).field;
  return { ok: true, t: `A field program in ${d.states[i].n}: offices, organizers and a voter file. It keeps paying every week.`, fx: 0.35 };
}
/** A turnout drive aimed at one vote history segment in one state. It pays where that segment leans your way and has
 * room to turn out more; driving out a segment that leans against you is money spent for the other side. */
export function genSegment(d: Data, s: GenS, st: string, seg: number, amt: number): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const i = si(d, st); if (i < 0) return { ok: false, t: "Unknown state." };
  const [share, dem, turn] = d.states[i].segs[seg]; const key = `${st}:${seg}`; const used = s.segUsed[key] ?? 0;
  const room = Math.max(0.05, (100 - turn) / 100);
  const lift = room * 0.32 * Math.log(1 + amt / (d.states[i].votes * (share / 100) * 1.2 + 1)) / (1 + 0.6 * used);
  const lean = (s.party === "D" ? dem : 100 - dem) / 100;
  const fx = share * lift * (2 * lean - 1) * (toGo(s) <= 4 ? 1.2 : 1) * (lean >= 0.5 ? mgrOf(s).field : 1);
  s.cash -= amt; s.gotv[i] += fx; s.segUsed[key] = used + 1;
  return { ok: true, t: `${usd(amt)} to turn out ${d.seg[seg]} voters in ${d.states[i].n}: they vote ${Math.round(lean * 100)} percent your way.${fx < 0 ? " That drive helped the other side." : ""}`, fx };
}
export function genFund(d: Data, s: GenS, kind: "call" | "dinner" | "email"): Res {
  const f = DIFF[s.diff].fund * mgrOf(s).fund;
  if (kind === "email") { const amt = Math.round(9e6 * f * (0.6 + s.enth[0] / 100) * (s.staff?.digital ? 1.4 : 1)); s.cash += amt; s.enth[0] = clamp(s.enth[0] - 0.6, 0, 100); return { ok: true, t: `Small dollar blast: ${usd(amt)}.` }; }
  const need = kind === "call" ? 1 : 2; if (s.days < need) return { ok: false, t: "No time left this week." };
  s.days -= need; s.stamina = clamp(s.stamina - 5 * need, 0, 100);
  const amt = Math.round((kind === "call" ? 6e6 : 18e6) * f); s.cash += amt;
  return { ok: true, t: kind === "call" ? `Call time: ${usd(amt)}.` : `A finance dinner: ${usd(amt)}.` };
}
export function genMedia(d: Data, s: GenS, G: { rng: number }): Res {
  if (s.days < 1) return { ok: false, t: "No time left this week." };
  s.days -= 1; const k = 0.04 + gauss(G) * 0.05; s.nat += k; s.stamina = clamp(s.stamina - 5, 0, 100);
  return { ok: true, t: k >= 0 ? "A strong interview round: network, a podcast with millions of young men, local TV." : "An interview went sideways on a follow up question.", fx: k };
}
export function genRest(s: GenS): Res { if (s.days < 2) return { ok: false, t: "No time left this week." }; s.days -= 2; s.stamina = clamp(s.stamina + 30, 0, 100); return { ok: true, t: "A day off the trail." }; }
export function genPrep(s: GenS): Res { if (s.days < 2) return { ok: false, t: "Debate prep takes a full day." }; s.days -= 2; s.prep += 1; return { ok: true, t: "Mock debate with a stand in for your opponent." }; }
/** Take a stand in the general: independents weigh it by how much they care, your base by how far you strayed. */
export function genStance(d: Data, s: GenS, k: number, pos: number, G: { rng: number }, mult = 1): { fx: number; base: number; flip: number; groups: { g: string; v: number }[] } {
  const meC = candOf(d, s.party, s.me); const is = d.issues[k];
  const cur = (meC.pos?.[k] ?? (s.party === "D" ? is.d : is.r)) + (s.shifts[is.k] ?? 0);
  const ind = STANCE_IND * is.ci * ((is.i - cur) ** 2 - (is.i - pos) ** 2) * mult;
  const own = s.party === "D" ? is.d : is.r; const base = 6 * (s.party === "D" ? is.cd : is.cr) * ((own - cur) ** 2 - (own - pos) ** 2);
  const dev = Math.abs(pos - (meC.pos?.[k] ?? cur)); const flip = dev > 0.9 ? -0.25 * (0.5 + (meC.emph?.[k] ?? 1)) * (dev - 0.9) : 0;
  // independents weigh the stance, your own voters turn out less when you break with them, and a reversal gets attacked
  const raw = Math.max(-1.2, Math.min(1.0, ind + 0.25 * base + flip));
  const fx = raw * (1 + gauss(G) * 0.2) * (raw < 0 ? DIFF[s.diff].neg : 1);
  s.nat += fx; s.enth[0] = clamp(s.enth[0] + base * 8, 0, 100); s.shifts[is.k] = pos - (meC.pos?.[k] ?? cur);
  const groups = groupStance(d, s, k, cur, pos);
  return { fx, base, flip, groups };
}
/** End the week: the rival campaigns, ads decay, polls land, early votes bank. */
export function genEnd(d: Data, s: GenS, G: { rng: number }): LogItem[] {
  const out: LogItem[] = []; const ms = myMargins(d, s);
  // the rival targets the closest states by tipping weight
  const order = d.states.map((x, i) => ({ i, w: x.ev / (1 + Math.abs(ms[i]) ** 1.6) })).sort((a, b) => b.w - a.w);
  const k = DIFF[s.diff].opp; const spend = Math.min(s.opCash, 28e6 * k + s.opCash * 0.08);
  s.opCash -= spend; s.opCash += 24e6 / k;
  const tgt = order.slice(0, 6); s.opVisits = tgt.slice(0, 3).map((x) => d.states[x.i].st);
  for (const x of tgt) s.opAds[x.i] += 0.9 * Math.log(1 + (spend / 6) / (d.states[x.i].votes * 1.6)) * k * 0.92;
  s.opN = s.opN ?? {};
  for (const x of tgt.slice(0, 3)) { const st = d.states[x.i].st, v = s.opN[st] ?? 0; s.pers[x.i] -= sizeK(d.states[x.i]) * 0.5 * k * 0.8 / (1 + 0.5 * v); s.opN[st] = v + 1; }
  out.push({ t: s.week, kind: "rival", s: `${s.op} campaigned in ${s.opVisits.map((st) => nameOf(d, st)).join(", ")} and ran about ${usd(spend)} of ads.` });
  // the running mate works the trail
  if (s.vp && s.vpSt && (s.mo?.vpRole ?? "trail") === "trail") { const i = si(d, s.vpSt); s.pers[i] += sizeK(d.states[i]) * 0.3; out.push({ t: s.week, kind: "you", s: `${s.vp} worked ${d.states[i].n} all week.` }); }
  // field programs keep paying
  for (const st of s.offices) s.gotv[si(d, st)] += 0.06 * mgrOf(s).field;
  moreWeek(d, s, G, out);
  // the super PACs: outside money you cannot direct, spent where the race is closest, at worse ad rates
  const pacMe = 16e6 * DIFF[s.diff].fund * (0.6 + s.enth[0] / 100), pacOp = 16e6 * k * (0.6 + s.enth[1] / 100);
  s.pac = [(s.pac?.[0] ?? 0) + pacMe, (s.pac?.[1] ?? 0) + pacOp];
  for (const x of order.slice(0, 5)) { s.ads[x.i] += 0.55 * Math.log(1 + (pacMe / 5) / (d.states[x.i].votes * 1.6)); s.opAds[x.i] += 0.55 * Math.log(1 + (pacOp / 5) / (d.states[x.i].votes * 1.6)); }
  out.push({ t: s.week, kind: "money", s: `Super PACs: about ${usd(pacMe)} on your side and ${usd(pacOp)} on theirs, in ${order.slice(0, 5).map((x) => d.states[x.i].st).join(", ")}.` });
  // ads fade, persuasion holds
  s.ads = s.ads.map((a) => a * 0.62); s.opAds = s.opAds.map((a) => a * 0.62);
  s.enth[1] = clamp(s.enth[1] + gauss(G) * 1.2, 30, 75); s.enth[0] = clamp(s.enth[0] + gauss(G) * 0.8, 25, 80);
  s.nat += gauss(G) * 0.35;
  // polls
  const ms2 = myMargins(d, s); const nm = natMargin(d, ms2);
  // the polls see the race as the model does; the truth sits off by an error nobody sees until election night
  s.natPolls.push({ w: s.week, m: Math.round((nm + gauss(G) * 1.6) * 10) / 10 });
  for (const x of order.slice(0, 6)) { const P = POLLSTERS[Math.floor(rand(G) * POLLSTERS.length)]; s.polls.push({ w: s.week, st: d.states[x.i].st, by: P.n, m: Math.round((ms2[x.i] + sideSign(s.party) * P.h + gauss(G) * P.sd) * 10) / 10 }); }
  out.push({ t: s.week, kind: "poll", s: `National polls: ${lead(s.natPolls[s.natPolls.length - 1].m)}.` });
  deepWeek(d, s, G, out, order);
  worldWeek(d, s, G, out);
  { const tot = d.states.reduce((a, x) => a + (x.st.includes("-") ? 0 : x.votes), 0); s.banked = clamp((s.ballots ?? 0) / Math.max(1, tot), 0, 0.95); }
  // the campaign's read of each state drifts unless it keeps polling there
  if (s.fog) s.fog = s.fog.map((f, i) => { const age = pollAge(s, d.states[i].st); const sd = age != null && age <= 1 ? 0.5 : Math.min(3.2, 1 + 0.35 * (age ?? 6)); return f * 0.55 + gauss(G) * sd * 0.8 * mgrOf(s).poll * pollSd(s); });
  // scandals, attacks and the October surprise
  if (!s.crisis && s.week < s.weeks) {
    // a scandal never repeats, and a donor scandal needs a big donor first
    const F = storyOf(s).flags; const avoid = (id: string) => F[`crisis:${id}`] != null || (id === "donor" && !F.bigDonor);
    if (toGo(s) === 4 && !s.surprise) { s.surprise = true; s.crisis = dealCrisis(d, s.party, s.me, s.op, s.vp, G, true, true, avoid); s.crisisW = s.week + 1; }
    else if (rand(G) < (s.mo?.hard ? 0.3 : 0.2) && !storyOf(s).queue.some((q) => q.w === s.week + 1)) { s.crisis = dealCrisis(d, s.party, s.me, s.op, s.vp, G, true, false, avoid); s.crisisW = s.week + 1; }
  }
  s.week += 1; s.days = DAYS; s.stamina = clamp(s.stamina + 16, 0, 100);
  s.spentLast = (s.spent ?? 0) + payroll(s); s.spent = 0; weekStart(d, s);
  if (s.week <= s.weeks) dueStory(d, s, G);
  s.trend.push({ w: s.week - 1, ...snapshot(d, s) }); s.lowP = Math.min(s.lowP ?? 1, s.trend[s.trend.length - 1].p);
  if (s.week > s.weeks) s.done = true;
  return out;
}
/** The public pollsters, all fictional: a grade for accuracy and a house lean, R minus D, that shows up in every poll. */
export const POLLSTERS: { n: string; g: string; h: number; sd: number }[] = [
  { n: "Meridian Opinion", g: "A", h: 0, sd: 2.2 }, { n: "Lakeshore University Poll", g: "A", h: -0.6, sd: 2.4 }, { n: "Keystone Analytics", g: "A", h: 0.4, sd: 2.3 },
  { n: "Granite Polling Group", g: "B", h: 0.8, sd: 3 }, { n: "Bluewater Research", g: "B", h: -1.5, sd: 3 }, { n: "Heartland Survey Company", g: "B", h: 1.2, sd: 3.1 },
  { n: "Patriot Insights", g: "C", h: 2.6, sd: 4 }, { n: "Frontline Data", g: "C", h: -2.3, sd: 4 },
];
export const pollsterOf = (n?: string) => POLLSTERS.find((p) => p.n === n);
export const lead = (m: number, me = "You", op = "Them") => (Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${me} +${m.toFixed(1)}` : `${op} +${Math.abs(m).toFixed(1)}`);

// ------------------------------------------------------------- election night
export type Call = { st: string; i: number; at: number; m: number; ev: number; win: boolean; close: number; early: number; em: number; dm: number };
export type NightRes = { calls: Call[]; ev: number; opEv: number; pop: number; win: boolean; nat: number; events?: string[]; rc?: Recount[] };
export function election(d: Data, s: GenS, seed: number): NightRes {
  const G = { rng: seed }; const ms = myMargins(d, s);
  const nat = gauss(G) * 2.2 + s.bias; const rg = [0, 1, 2, 3, 4].map(() => gauss(G) * 1.5);
  // Election Day: storms keep Election Day voters home, which costs Republicans more since Democrats vote earlier;
  // long lines in close states without a field program cost the side that did not build one
  const events: string[] = []; const RN = ["the Northeast", "the Midwest", "the South", "the Mountain West", "the West Coast"];
  const storm = [0, 1, 2, 3, 4].map((r) => { if (rand(G) > 0.22) return 0; const sev = 0.4 + rand(G) * 0.8; events.push(`${sev > 0.9 ? "Heavy storms" : "Rain and wind"} across ${RN[r]} keep Election Day turnout down.`); return sev; });
  const side = s.party === "D" ? 1 : -1; const lineK = s.mgr === "field" ? 0.5 : 1;
  const lines = new Set(d.states.map((x, i) => ({ x, i })).filter(({ x, i }) => Math.abs(ms[i]) < 4 && !s.offices.includes(x.st) && !x.st.includes("-") && rand(G) < 0.18).map(({ x }) => x.st));
  for (const st of lines) events.push(`Hours long lines in ${nameOf(d, st)}, where you had no field program.`);
  const calls: Call[] = d.states.map((x, i) => {
    const r = REGION[x.st.split("-")[0]] ?? 0; const b = bankOf(s, i); const cast = Math.min(0.95, b.cast); const rest = 1 - cast;
    const err = nat + rg[r] + gauss(G) * Math.max(1.2, x.sd * 0.4);
    const wx = storm[r] * side * 0.7 * (s.offices.includes(x.st) && side < 0 ? 0.5 : 1) - (lines.has(x.st) ? 0.6 * lineK * (s.lawyers ? 0.4 : 1) : 0);
    // what is left to vote on Election Day leans the other way by as much as the early vote leaned toward Democrats
    const sideD = s.party === "D" ? 1 : -1; const skewAdj = rest > 0 ? skewOf(x.st) * sideD * Math.min(cast, 0.9) / rest * 0.9 : 0;
    const dm = ms[i] + err - skewAdj + wx; const em = cast > 0 ? b.m + err : ms[i] + err + skewOf(x.st) * sideD;
    const m = cast > 0 ? cast * em + rest * dm : ms[i] + err + wx;
    const close = Math.abs(m); const delay = close < 1 ? 5 + rand(G) * 6 : close < 3 ? 1.5 + rand(G) * 3 : close < 6 ? 0.4 + rand(G) * 1 : rand(G) * 0.1;
    return { st: x.st, i, at: x.close + delay, m, ev: x.ev, win: m > 0, close, early: cast > 0 ? cast : Math.min(0.95, earlyOf(x.st)), em, dm };
  }).sort((a, b) => a.at - b.at);
  const ev = calls.filter((c) => c.win).reduce((a, c) => a + c.ev, 0);
  const pop = natMargin(d, calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m));
  return { calls, ev, opEv: 538 - ev, pop, win: ev >= 270, nat, events };
}

// ------------------------------------------------------------- cards: what happens in the world
export type Opt = { label: string; say: string; pos: number };
export type Card = { id: string; k: number; title: string; prompt: string; opts: Opt[]; src?: string; when?: "prim" | "gen" | "both" };

// ============================================================= deals, scandals and oppo, in both phases
/** A candidate leaves the primary. In every state their voters move to who is left, weighted by how alike the
 * candidates are and how big each still is; an endorsement pulls a larger slice to the endorsed candidate. */
export function dropOut(d: Data, s: PrimS, n: string, to: string | null, why: string) {
  const r = s.field.find((x) => x.n === n); if (!r || !r.alive) return;
  const simTo = d.cands[s.party].find((c) => c.n === n)?.sim ?? {};
  for (const st of Object.keys(d.primary[s.party].shares)) {
    const sh = primShares(d, s, st); const v = sh[n] ?? 0; if (v <= 0) continue;
    const rest = s.field.filter((x) => x.alive && x.n !== n);
    const w = rest.map((x) => Math.exp(3 * (simTo[x.n] ?? 0)) * Math.sqrt(Math.max(0.5, sh[x.n] ?? 0)) * (x.n === to ? 2.2 : 1));
    const tw = w.reduce((a, b) => a + b, 0) || 1;
    rest.forEach((x, k) => { const add = (v * w[k]) / tw; const cur = Math.max(0.2, sh[x.n] ?? 0); addBoost(s, st, x.n, Math.log(1 + add / cur)); });
  }
  r.alive = false; r.out = s.t; r.why = why;
  if (to) { const t = s.field.find((x) => x.n === to); if (t) t.mom += 0.04; }
}
/** Ask a rival to drop out and endorse you, with a cabinet post or the vice presidency on the table. */
export function primDeal(d: Data, s: PrimS, n: string, offer: "cabinet" | "vp", G: { rng: number }): Res {
  const r = s.field.find((x) => x.n === n); if (!r || !r.alive) return { ok: false, t: "They are already out." };
  if (s.days < 2) return { ok: false, t: "A sit down like this takes a full day." };
  if ((s.deals ?? []).includes(n)) return { ok: false, t: `${n} already turned you down.` };
  if (offer === "vp" && s.vpPromise) return { ok: false, t: `You already promised the vice presidency to ${s.vpPromise}.` };
  s.days -= 2; s.deals = [...(s.deals ?? []), n];
  const ns = natShares(d, s); const mine = ns[me0(s)] ?? 1, theirs = ns[n] ?? 1;
  const sim = d.cands[s.party].find((c) => c.n === n)?.sim?.[me0(s)] ?? 0;
  const p = clamp(0.06 + 0.42 * clamp(1 - theirs / Math.max(1, mine), 0, 1) + 0.25 * sim + (offer === "vp" ? 0.18 : 0) + (r.cash < 5e6 ? 0.12 : 0) + (s.t >= 5 ? 0.08 : 0), 0.03, 0.85);
  if (rand(G) < p) {
    dropOut(d, s, n, me0(s), "a deal with the front runner"); s.field[0].endorse.push(`deal:${n}`);
    if (offer === "vp") s.vpPromise = n;
    return { ok: true, t: `${n} drops out and endorses you${offer === "vp" ? ", with a spot on the ticket promised" : ", with a cabinet post promised"}. Most of their voters follow.`, fx: theirs / 100 };
  }
  s.field[0].mom -= 0.02;
  return { ok: true, t: `${n} said no and the meeting leaked. About a ${Math.round(p * 100)} percent shot. A small hit to your momentum.` };
}
/** A scandal or attack from the list, written for this race. */
export function dealCrisis(d: Data, p: Party, me: string, op: string, vp: string | null, G: { rng: number }, general: boolean, surprise = false, avoid?: (id: string) => boolean): Crisis {
  const all = CRISES.filter((c) => (general || !c.genOnly) && (vp || !c.vp) && (!surprise || c.big));
  const fresh = all.filter((c) => !avoid?.(c.id)); const pool = fresh.length ? fresh : all;
  const c = pool[Math.floor(rand(G) * pool.length)];
  const meC = candOf(d, p, me); let k = 0, worst = -1;
  d.issues.forEach((is, i) => { const v = Math.abs((meC?.pos?.[i] ?? 0) - is.i) * is.ci; if (v > worst) { worst = v; k = i; } });
  const fill = (t: string) => t.replaceAll("{me}", me).replaceAll("{op}", op).replaceAll("{vp}", vp ?? "your running mate").replaceAll("{issue}", d.issues[k].l.toLowerCase());
  const sev = (surprise ? 1.5 : 0.7 + rand(G) * 0.6);
  return { id: c.id, title: fill(surprise ? `October surprise: ${c.title}` : c.title), prompt: fill(c.prompt), sev, opts: c.opts.map((o) => ({ ...o, label: fill(o.label), say: fill(o.say) })) };
}
/** Answer a crisis: each answer has a likely result and a risky one. Returns points of the national race. */
export function answerCrisis(c: Crisis, i: number, G: { rng: number }, mgr: Mgr | undefined, neg = 1): { fx: number; bad: boolean } {
  const o = c.opts[i]; const bad = rand(G) < o.risk;
  let fx = (o.base + (bad ? o.dn : o.up)) * c.sev;
  if (fx < 0) fx *= MGR[mgr ?? "data"].crisis * neg;
  return { fx, bad };
}
/** Opposition research: the other candidate's most exposed positions in the dataset, cut into a hit. */
export function genDig(d: Data, s: GenS, G: { rng: number }): Res {
  if (s.days < 2) return { ok: false, t: "A research push takes a full day of your time." };
  if (s.cash < 3e6) return { ok: false, t: "Opposition research costs $3M." };
  s.days -= 2; s.cash -= 3e6; s.dug = (s.dug ?? 0) + 1;
  const opP: Party = s.party === "D" ? "R" : "D"; const opC = candOf(d, opP, s.op); const have = new Set((s.oppo ?? []).map((h) => h.t));
  const cand = d.issues.map((is, i) => ({ is, v: Math.abs((opC?.pos?.[i] ?? (opP === "D" ? is.d : is.r)) - is.i) * is.ci * (1 + (opC?.emph?.[i] ?? 0) * 0.3) })).sort((a, b) => b.v - a.v);
  const odds = (s.staff?.oppo ? 0.75 : 0.55) / (1 + 0.25 * (s.dug - 1));
  if (rand(G) > odds) return { ok: true, t: `The researchers came back empty this time. About a ${Math.round(odds * 100)} percent shot.` };
  const pick = cand.find((x) => ![...have].some((t) => t.includes(x.is.l.toLowerCase()))) ?? cand[0];
  const t = HIT_T[Math.floor(rand(G) * HIT_T.length)](s.op, pick.is.l.toLowerCase());
  const h: Hit = { t, power: clamp(0.35 + pick.v * 4, 0.35, 1.3), solid: Math.min(0.97, 0.5 + rand(G) * 0.45 + (s.staff?.oppo ? 0.12 : 0)) };
  s.oppo = [...(s.oppo ?? []), h];
  return { ok: true, t: `Found something: ${t}. Hold it or use it; it hits harder in the last three weeks.` };
}
const HIT_T = [
  (op: string, l: string) => `an old clip of ${op} going further than ever on ${l}`,
  (op: string, l: string) => `${op}'s record on ${l}, cut into thirty seconds`,
  (op: string, l: string) => `the donors behind ${op}'s stand on ${l}`,
];
export function genDrop(d: Data, s: GenS, i: number, G: { rng: number }): Res {
  const h = s.oppo?.[i]; if (!h || h.used) return { ok: false, t: "Already used." };
  if (s.cash < 2e6) return { ok: false, t: "Placing a story and an ad behind it costs $2M." };
  s.cash -= 2e6; h.used = true; const late = toGo(s) <= 3 ? 1.4 : 1;
  if (rand(G) < h.solid) { h.hit = true; const fx = h.power * late * (0.8 + rand(G) * 0.4); s.nat += fx; s.enth[1] = clamp(s.enth[1] - 1.5, 0, 100); return { ok: true, t: `The story runs everywhere: ${h.t}.`, fx }; }
  const fx = -0.45 * h.power; s.nat += fx; s.enth[1] = clamp(s.enth[1] + 1.5, 0, 100);
  return { ok: true, t: `Fact checkers took the hit apart and ${s.op}'s side rallied. It backfired.`, fx };
}
/** An internal poll: the campaign's read of a state, sharpened for a few weeks. */
export function genPoll(d: Data, s: GenS, st: string, G: { rng: number }): Res {
  const cost = 1.2e6 * mgrOf(s).poll; if (s.cash < cost) return { ok: false, t: `An internal poll costs ${usd(cost)}.` };
  const i = si(d, st); s.cash -= cost; s.polledW = { ...(s.polledW ?? {}), [st]: s.week };
  if (s.fog) s.fog[i] = gauss(G) * 0.6 * mgrOf(s).poll;
  const m = myMargins(d, s)[i] + (s.fog?.[i] ?? 0);
  return { ok: true, t: `Internal poll of ${d.states[i].n}: ${lead(m)}. Your read there is sharp for about two weeks.`, fx: 0 };
}
/** What the campaign believes: the true margins plus the error in its read of each state. */
export const readMargins = (d: Data, s: GenS) => myMargins(d, s).map((m, i) => m + (s.fog?.[i] ?? 0));
export const pollAge = (s: GenS, st: string) => (s.polledW?.[st] == null ? null : s.week - s.polledW[st]);

// ============================================================= the primary coalition
/** A group's share of a party's primary electorate in a state: its share of the state's voters, weighted by how much of it
 * votes with that party. */
export function primGroupShare(d: Data, p: Party, gk: string, st: string) {
  const G = d.groups ?? []; const race = ["black_w", "black_m", "hisp_w", "hisp_m", "asian", "wnc_w", "wnc_m", "wcol_w", "wcol_m"];
  const at = (g: Grp) => g.st[st] ?? g.us; const w = (g: Grp) => at(g)[0] * (p === "D" ? at(g)[1] : 100 - at(g)[1]) / 100;
  const g = G.find((x) => x.k === gk); if (!g) return 0;
  const pool = race.includes(gk) ? G.filter((x) => race.includes(x.k)) : [g, ...G.filter((x) => race.includes(x.k))];
  const tot = race.includes(gk) ? pool.reduce((a, x) => a + w(x), 0) : G.filter((x) => race.includes(x.k)).reduce((a, x) => a + w(x), 0);
  return Math.min(0.9, w(g) / Math.max(1, tot));
}
/** Court a group in the primary: a strong boost in the state you go to and a smaller one wherever the group is big. */
export function primGroup(d: Data, s: PrimS, gk: string, st: string): Res {
  if (s.days < 2) return { ok: false, t: "Outreach takes a full day." };
  if (s.cash < 120e3) return { ok: false, t: "Not enough cash." };
  const g = (d.groups ?? []).find((x) => x.k === gk); if (!g) return { ok: false, t: "Unknown group." };
  const n = s.gused?.[gk] ?? 0;
  s.days -= 2; s.cash -= 120e3; s.gused = { ...(s.gused ?? {}), [gk]: n + 1 }; s.visits[st] = (s.visits[st] ?? 0) + 1; s.stamina = clamp(s.stamina - 8, 0, 100);
  const k = 0.5 / (1 + 0.4 * n);
  for (const x of Object.keys(d.primary[s.party].shares)) { const sh = primGroupShare(d, s.party, gk, x); addBoost(s, x, me0(s), k * sh * (x === st ? 1 : 0.18)); }
  return { ok: true, t: `Courting ${g.l.toLowerCase()} in ${nameOf(d, st)}. They are about ${Math.round(primGroupShare(d, s.party, gk, st) * 100)} percent of the ${s.party === "D" ? "Democratic" : "Republican"} primary vote there.`, fx: k };
}
