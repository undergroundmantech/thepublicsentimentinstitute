// The campaign game's engine: pure functions over a plain state object, so a game saves as JSON and replays the
// same from its seed. Every number the electorate reacts with comes from the race file built from the site's data:
// the forecast sets where the race starts, the county map holds the votes, the voter group estimates decide who
// hears a statement and how they lean, and the money books set what each side can spend.
// Margins are in points from the player's side: positive means the player leads.

import { rivalWeek, rivalLookAhead, initRival, type Rival } from "./rival";

export type Side = "D" | "R";
export type Diff = "safe" | "lean" | "tossup" | "wave";
export type Intel = { l: string | null; t: string; u: string | null };
export type Cand = { side: Side; name: string; party: string; inc: boolean; file: string | null; intel: Intel[]; blocs: string[];
  money: { receipts: number | null; cash: number | null; outside_for: number | null; spent: number | null; google_ads: number | null; as_of: string | null }; health: number | null;
  donors?: { donations: number | null; raised: number | null; home: number | null; small: number | null; big: number | null; pacs: number | null; self: number | null } | null;
  /** reported net worth and real self funding this race, sourced */
  worth?: { low: number | null; high: number | null; est: number | null; basis: string; self: number | null; past?: number | null; pastNote?: string | null; src: string; note: string } | null };
export type Research = {
  summary: string | null; issues: { issue: string; why: string; src: string }[];
  storylines: { title: string; date: string; what: string; helps: string; kind: string; src: string }[];
  events: { title: string; prompt: string; issue: string; src: string; opts: { label: string; say: string; pos: number; trump: number | null; tone: string | null }[] }[];
  debates: { date: string; where: string; src: string }[]; endorsements: { who: string; for: string; src: string }[];
  ads: { by: string; for: string; theme: string; src: string }[]; regions: { name: string; f: string[]; note: string }[];
};
export type CountyRow = [string, string, number, number, number, number, number | null]; // fips, name, margin R minus D, D, R, total, 2024 pres margin
export type GroupRow = [string, string, number, number, number, number]; // dimension, label, share, D, R, other
export type RaceFile = {
  id: string; office: "senate" | "governor"; st: string; state: string; name: string; open: boolean | null; pvi: number | null; pres24: number | null;
  est: { margin: number; prob: number; p10: number | null; p90: number | null }; pollAvg: number | null; votes: { dem: number; rep: number; other: number; total: number } | null;
  polls: { pollster: string; kind: string; age: number; n: number; margin: number }[]; cands: [Cand, Cand]; third: { name: string; party: string; pct: number }[];
  groups: GroupRow[]; counties: CountyRow[]; outside: { total: number | null; groups: { name: string; side: string; kind: string; target: string; amount: number }[] };
  earlyVote: { ballots: number; party: { d: number; r: number; o: number }; estimatedShare: number; date: string; expectedEarly?: number; expectedTotal?: number } | null;
  news: { id: string; title: string; dek: string; date: string }[]; media: { who: string; what: string; when: string; lean: string }[];
  research?: Research; donorSignal?: { z: number; shift_logit: number } | null;
  /** the Watchdog connections for each side, and the commentators paying attention to the race */
  net?: { D: Net; R: Net; attention: { who: string; role: string; side: string | null; about: string | null; notes: string[]; src: string }[] };
};
export type Net = { endorsers: { by: string; role: string; kind: string; src: string }[]; donors: { name: string; v: number; note: string; src: string }[];
  groups: { name: string; v: number; how: string; src: string }[]; mega: { name: string; v: number; via: string; src: string }[];
  surrogates: { name: string; n: number; note: string; src: string }[]; party: { name: string; v: number; src: string }[]; self: number | null };

export const DIFF: Record<Diff, { name: string; blurb: string; start: number; opp: number; fund: number; neg: number; drift: number; noise: number }> = {
  safe: { name: "Safe Seat", blurb: "A friendly year. You start two points better than the forecast, donors give more and the other side is slower.", start: 2, opp: 0.8, fund: 1.25, neg: 0.8, drift: 0, noise: 0.8 },
  lean: { name: "Lean", blurb: "The race exactly as the On Point forecast has it today. Both campaigns play it straight.", start: 0, opp: 1, fund: 1, neg: 1, drift: 0, noise: 1 },
  tossup: { name: "Toss Up", blurb: "You start two points behind the forecast, the other side spends sharper and bad news hits harder.", start: -2, opp: 1.15, fund: 0.92, neg: 1.2, drift: 0, noise: 1.1 },
  wave: { name: "Wave Against You", blurb: "A national wave runs against your party all fall. Down three and a half, sliding each week, outspent and outworked.", start: -3.5, opp: 1.3, fund: 0.82, neg: 1.35, drift: -0.12, noise: 1.25 },
};

export const WEEKS = 8;
/** Each week has twelve half days: a rally takes a full day, a town hall or call time takes a morning. */
export const DAYS = 12;
/** What each move costs, in half days. */
export const COST = { rally: 2, hall: 1, call: 1, donors: 2, media: 1, prep: 2, rest: 2, nap: 1, canvass: 2, reg: 1, virtual: 1, celeb: 2, jfc: 2, ask: 1, surrogate: 2, guest: 2, podcast: 2, meet: 1 } as const;
export const halfTxt = (n: number) => (n <= 0 ? "No time" : n === 1 ? "Half day" : n % 2 ? `${Math.floor(n / 2)}½ days` : n === 2 ? "1 day" : `${n / 2} days`);
/** Campaign lengths: the classic eight week fall sprint, or start in early August or mid July. */
export const LENGTHS: { w: number; name: string; blurb: string }[] = [
  { w: 8, name: "Fall sprint", blurb: "Labor Day to Election Day. Eight weeks, every one of them counts. About 45 minutes." },
  { w: 12, name: "From August", blurb: "Start the second week of August. Four summer weeks to raise money, hire, register voters and build a field program while voters are at the lake. About 70 minutes." },
  { w: 16, name: "From July", blurb: "Start in mid July. Eight long summer weeks for the full build: money, staff, offices, door knocking crews, then the fall sprint. About 90 minutes." },
];
const WEEK0 = Date.UTC(2026, 8, 8); // Tuesday after Labor Day
/** The calendar week a game week falls in: week 1 is the week after Labor Day, zero and below are summer weeks. */
export const cal = (s: { week: number; len?: number }, w = s.week) => w - ((s.len ?? 8) - 8);
export const lenOf = (s: { len?: number }) => s.len ?? 8;
/** Voters pay about half as much attention in summer: persuasion moves less, and the forecast expects less of everyone. */
export const att = (s: { week: number; len?: number }, w = s.week) => (cal(s, w) <= 0 ? 0.55 : 1);
export const phaseOf = (s: { week: number; len?: number }) => { const k = cal(s); return k <= 0 ? "summer" : k < 5 ? "fall" : k < 8 ? "stretch" : "final"; };
export const weekLabel = (w: number) => {
  const a = new Date(WEEK0 + (w - 1) * 7 * 864e5), b = new Date(WEEK0 + ((w - 1) * 7 + 6) * 864e5);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(a)} to ${f(b)}`;
};
export const DEBATE_WEEK = 6;
/** The game week a real date falls in, or null outside the eight weeks. */
export const weekOf = (iso: string) => { const t = Date.parse(iso + "T12:00:00Z"); if (!isFinite(t)) return null; const w = Math.floor((t - WEEK0) / (7 * 864e5)) + 1; return w >= -7 && w <= 8 ? w : null; };
/** The debate falls in the week of the race's first real debate; with none on record, week 6. */
export function debateWeek(r: RaceFile) {
  const ws = (r.research?.debates ?? []).map((d) => weekOf(d.date)).filter((w): w is number => w != null && w >= 2);
  return ws.length ? Math.min(...ws) : DEBATE_WEEK;
}
/** TV costs more as Election Day nears: stations raise rates and inventory runs short. Reserving early locks today's rate. */
export const RATE = [1, 1, 1, 1.05, 1.1, 1.15, 1.25, 1.4];
export const rateAt = (cw: number) => (cw <= 0 ? 0.85 : RATE[Math.min(8, cw) - 1] ?? 1.4);
export const EARLY_FROM = 5;

export type Staff = { pollster: 0 | 1 | 2 | 3; media: boolean; field: boolean; oppo: boolean; digital: boolean };
/** Your campaign manager: picked in the lobby, each with a strength and a voice. */
export type Mgr = "vet" | "digital" | "brawler";
export const MGR: Record<Mgr, { title: string; blurb: string; perk: string }> = {
  vet: { title: "The field general", blurb: "Twenty years of knocking doors in this state. Cautious, organized, allergic to surprises.", perk: "Door knocking and turnout programs go 20 percent further, and a tired candidate makes fewer mistakes." },
  digital: { title: "The digital native", blurb: "Built two presidential email programs. Thinks in clips, lists and dashboards.", perk: "Online fundraising and digital ads go 30 percent further, and buzz fades slower." },
  brawler: { title: "The brawler", blurb: "Ran the nastiest race in the state last cycle and won it. Wants to hit first.", perk: "Contrast and attack ads hit 15 percent harder, opposition research costs less, and attacks backfire half as often." },
};
/** A door knocking program in one region: persuasion conversations with swing voters, or turnout contacts with yours. */
export type Prog = { reg: number; kind: "pers" | "gotv"; crews: number };
export const CREW = { wk: 30000, doors: 5000, setup: 20000 };
export const POLLSTERS = [null, { name: "C rated pollster", sd: 3.4, wk: 18000 }, { name: "B rated pollster", sd: 2.2, wk: 38000 }, { name: "A rated pollster", sd: 1.2, wk: 70000 }] as const;
export const STAFF_COST = { media: { hire: 150000, wk: 25000, name: "Media consultant", what: "Television and radio go 25 percent further." },
  field: { hire: 80000, wk: 22000, name: "Field director", what: "Field offices and get out the vote go 40 percent further, and you can open more than three offices." },
  oppo: { hire: 120000, wk: 0, name: "Opposition research firm", what: "Turns the other side's record into ads and debate lines, and attacks stop backfiring." },
  digital: { hire: 60000, wk: 15000, name: "Digital director", what: "Online fundraising and targeted digital ads go further." } };

export type Opt = { label: string; say: string; st?: Stance; cash?: number; days?: number; out?: MeetOut; need?: "oppo" | "pollster"; kind?: "respond" | "ignore" | "clarify" | "counter" | "hit" | "hold" | "accept" | "decline" | "skip" | "amplify" | "push" | "pivot" | "rally" | "blast" | "tout" | "forum" | "dodge"; fx?: number };
export type Ev = { id: string; kind: "issue" | "news" | "attack" | "opening" | "surrogate" | "debate" | "real" | "flash" | "endorse" | "quarter" | "chair" | "scenario" | "fringe" | "star" | "shock" | "osurprise" | "crisis" | "chaos"; title: string; prompt: string; src?: string | null; opts: Opt[]; states?: string[]; sal?: number; helps?: string; real?: boolean; date?: string;
  /** a change to the world that lasts a few weeks, whatever you answer */ mod?: Mod };
/** Something happening in the world that changes the race for a while: a storm, a shutdown, a market drop. nat is points a
 * week in the player's favor; econ makes cost of living answers matter more; tv scales what ads can do; block holds
 * counties in disaster recovery, where campaigning as usual backfires. */
export type Mod = { id: string; label: string; until: number; good?: boolean; nat?: number; econ?: number; tv?: number; fund?: number; enth?: [number, number]; vol?: number; block?: string[] };
export const activeMods = (s: { mods?: Mod[]; week: number }) => (s.mods ?? []).filter((m) => m.until >= s.week);
const modProd = (s: State, k: "econ" | "tv" | "fund") => activeMods(s).reduce((a, m) => a * (m[k] ?? 1), 1);
export const blockedBy = (s: State, f: string) => activeMods(s).find((m) => m.block?.includes(f)) ?? null;
export type Part = { label: string; share: number; lean: number; fx: number };
export type LogItem = { w: number; kind: "you" | "opp" | "air" | "event" | "money" | "poll" | "gaffe" | "news"; t: string; fx?: number; parts?: Part[] };
export type Poll = { w: number; src: string; m: number; n: number; internal: boolean; groups?: { label: string; m: number }[] };

export type State = {
  v: 1; race: string; side: Side; diff: Diff; seed: number; rng: number;
  week: number; days: number; cash: number; oppCash: number; stamina: number; momentum: number; fatigue: number;
  pers: number[]; xme: number[]; xop: number[]; // per county: persuasion in points for the player, extra votes for each side
  glob: number; adStock: number; perm: number; nat: number; // statewide shifts in points
  ledger: Record<string, number>; visits: Record<string, number>; oppVisits: Record<string, number>; offices: string[];
  staff: Staff; tvWeek: number; digWeek: number; weekCash: number; prep: number; banked: number; gotv: number;
  spent: number; raised: number; pending: string[]; used: string[]; resolved: { id: string; choice: number; fx: number }[];
  polls: Poll[]; log: LogItem[]; trend: { w: number; m: number }[]; done: boolean; result?: Result;
  cur: Ev[]; evw: number; // this week's decisions, and the last week they were dealt
  buzz: number; volunteers: number; reserved: { w: number; amt: number; tone: string }[]; tests: Record<string, number[]>; endorsed: string[];
  dweek: number; knocks: number; flashes: string[]; weekly: { w: number; m: number; cash: number; buzz: number; vol: number }[];
  // added in the pixel edition
  enth: [number, number]; reads: Record<string, Read>; met: string[]; invites: Meet[]; invw: number; debated: number | null;
  lawyers: boolean; regs: number; final: boolean; oppLast: { stops: string[]; base: string[]; tv: number; ad: string | null } | null;
  low: number; rested: number; zingers: number; dodged: number; closing: string | null;
  // added in the long campaign edition
  pollBias?: number; mods?: Mod[]; dirt?: number; dumped?: boolean; shocks?: string[];
  len?: number; hd?: boolean; mgr?: Mgr; programs?: Prog[]; voterFile?: boolean; contacts?: number; doorsWk?: number;
  reach?: Record<string, number>; jfc?: boolean;
  // added in the live edition: the rival war room, cards waiting for next week, the hot streak, trophies, chat and chaos
  rival?: Rival; queue?: Ev[]; streak?: number; ach?: string[]; chatN?: number; chaosN?: number; chaosW?: number; hypeW?: number; hypeN?: number; merch?: boolean; selfIn?: number; asked?: string[]; redbox?: number; outPlus?: number; vfat?: number; partyW?: number; celebW?: number; pods?: string[]; fringe?: string | null;
};
export type Result = { m: number; win: boolean; me: number; op: number; counties: { f: string; m: number; t: number }[]; order: string[]; start: number; forecast: number;
  /** the campaign's final poll average, and the late break of undecided voters */ pollAvg?: number | null; late?: number;
  /** election night: [tick, county index, your votes, their votes, kind 0 early or mail, 1 Election Day, 2 late mail] */
  batches?: [number, number, number, number, number][]; ticks?: number; close?: number; weather?: string; mailLate?: boolean; turnout?: number; lines?: string | null };
/** How a campaign reads a county: its estimate of your margin, how sure it is, the week it last looked and who looked. */
export type Read = [number, number, number, string];
export type Role = "chair" | "union" | "farm" | "donor" | "mayor" | "faith" | "podcast" | "editor" | "sheriff" | "teacher" | "vet" | "student" | "biz" | "endorser" | "mole" | "tribal";
export type MeetOut = { cash?: number; vol?: number; enth?: number; oppEnth?: number; buzz?: number; st?: Stance; region?: string[]; pers?: number; risk?: number; riskT?: string; riskFx?: number; prep?: number; endorse?: string; t: string; days?: number;
  /** a direct shift in points, before noise */ fx?: number; fxLabel?: string; /** more outside money for you from here on */ outPlus?: number; /** a staffer quits */ quit?: boolean; /** extra cash lost if the risk hits */ riskCash?: number; stSal?: number };
export type MeetOpt = { label: string; say: string; out: MeetOut; need?: "oppo" };
export type Meet = { id: string; who: string; role: Role; seed: number; place: string; f?: string; title: string; intro: string; opts: MeetOpt[]; real?: boolean; src?: string;
  /** a show to go on instead of a meeting: the host's lean decides the audience */ pod?: { lean: "D" | "R" | "O"; show: string; note?: string } };

// ------------------------------------------------------------- randomness
export function rand(s: State) { // mulberry32 kept in the state
  let t = (s.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const gauss = (s: State) => { const u = Math.max(1e-9, rand(s)), v = rand(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const usd = (n: number) => (Math.abs(n) >= 1e9 ? `$${(n / 1e9).toFixed(1)}B` : Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
/** Older saves get the fields added since. */
export function migrate(s: State, r: RaceFile): State {
  s.buzz ??= 35; s.volunteers ??= 60; s.reserved ??= []; s.tests ??= {}; s.endorsed ??= []; s.dweek ??= debateWeek(r); s.knocks ??= 0; s.flashes ??= []; s.weekly ??= [];
  s.enth ??= [50, 50]; s.met ??= []; s.invites ??= []; s.invw ??= 0; s.debated ??= null; s.lawyers ??= false; s.regs ??= 0; s.final ??= false; s.oppLast ??= null;
  s.low ??= 99; s.rested ??= 0; s.zingers ??= 0; s.dodged ??= 0; s.closing ??= null;
  if (!s.reads) { s.reads = {}; seedReads(r, s); }
  s.pollBias ??= 0; s.mods ??= []; s.dirt ??= 0; s.dumped ??= false; s.shocks ??= [];
  s.len ??= 8; s.mgr ??= "vet"; s.programs ??= []; s.contacts ??= 0; s.doorsWk ??= 0; s.selfIn ??= 0; s.asked ??= []; s.redbox ??= 0; s.outPlus ??= 0; s.vfat ??= 0; s.partyW ??= -9; s.celebW ??= -9; s.pods ??= []; s.fringe ??= null;
  if (!s.hd) { s.days = Math.min(DAYS, s.days * 2); s.hd = true; }
  s.queue ??= []; s.streak ??= 0; s.ach ??= []; s.chatN ??= 0; s.chaosN ??= 0;
  if (!s.rival && !s.done) initRival(ctx(r, s.side), s);
  return s;
}
export const lead = (m: number, me: string, op: string) => (Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${me} +${m.toFixed(1)}` : `${op} +${Math.abs(m).toFixed(1)}`);

// ------------------------------------------------------------- the race seen from the player's chair
export type Ctx = {
  r: RaceFile; side: Side; me: Cand; op: Cand; sign: number; // sign turns R minus D into the player's favor
  total: number; cost: number; base: number[]; // base[c] player margin in county c
  groups: { dim: string; label: string; share: number; L: number; d: number; r: number }[];
  g: (label: string, dim?: string) => { dim: string; label: string; share: number; L: number; d: number; r: number } | undefined;
  approve: number; costsHard: number; small: number; weekly: number; oppWeekly: number; outMe: number; outOp: number;
  smallShare: number; bigShare: number; // the share of the player's itemized money in gifts under $200 and $2,500 and up, from the donor map
};
export function ctx(r: RaceFile, side: Side): Ctx {
  const me = r.cands[side === "D" ? 0 : 1], op = r.cands[side === "D" ? 1 : 0], sign = side === "R" ? 1 : -1;
  const total = r.votes?.total || r.counties.reduce((a, c) => a + c[5], 0) || 1e6;
  const groups = r.groups.filter((g) => g[0] !== "All voters").map(([dim, label, share, d, rr]) => ({ dim, label, share, L: (rr - d) / 100, d, r: rr }));
  const g = (label: string, dim?: string) => groups.find((x) => x.label === label && (!dim || x.dim === dim));
  const est = (c: Cand, o: Cand) => c.money.receipts || (o.money.receipts ? o.money.receipts * 0.5 : total * 5);
  const recMe = est(me, op), recOp = est(op, me);
  return {
    r, side, me, op, sign, total, cost: total * 0.55, base: r.counties.map((c) => sign * c[2]), groups, g,
    approve: g("Approve")?.share ?? 45, costsHard: g("Difficult")?.share ?? 55, small: g("Small, under 50K")?.share ?? 15,
    weekly: recMe * 0.035, oppWeekly: recOp * 0.035, outMe: (me.money.outside_for || 0) * 0.08, outOp: (op.money.outside_for || 0) * 0.08,
    smallShare: me.donors?.small ?? (me.party === "R" ? 0.3 : 0.45), bigShare: me.donors?.big ?? 0.2,
  };
}

export function newGame(r: RaceFile, side: Side, diff: Diff, seed = Math.floor(Math.random() * 1e9), len = 8, mgr: Mgr = "vet"): State {
  const c = ctx(r, side);
  // a longer campaign starts earlier, before the summer's money is in the bank
  const early = Math.max(0.42, 1 - 0.07 * (len - 8));
  const cash0 = (c.me.money.cash || (c.me.money.receipts || c.total * 5) * 0.3) * 0.85 * early;
  const opCash0 = (c.op.money.cash || (c.op.money.receipts || c.total * 5) * 0.3) * 0.85 * early;
  const n = r.counties.length;
  const s: State = {
    v: 1, race: r.id, side, diff, seed, rng: seed, week: 1, days: DAYS, cash: Math.round(cash0), oppCash: Math.round(opCash0), stamina: 100, momentum: 0, fatigue: 0,
    pers: Array(n).fill(0), xme: Array(n).fill(0), xop: Array(n).fill(0), glob: 0, adStock: 0, perm: 0, nat: DIFF[diff].start,
    ledger: {}, visits: {}, oppVisits: {}, offices: [], staff: { pollster: 0, media: false, field: false, oppo: false, digital: false },
    tvWeek: 0, digWeek: 0, weekCash: Math.round(cash0), prep: 0, banked: 0, gotv: 0, spent: 0, raised: 0, pending: [], used: [], resolved: [], polls: [], log: [], trend: [], done: false, cur: [], evw: 0,
    buzz: 35, volunteers: 60 + Math.round(Math.sqrt(c.me.donors?.donations ?? 20000) * 0.6), reserved: [], tests: {}, endorsed: [], dweek: debateWeek(r), knocks: 0, flashes: [], weekly: [],
    enth: [50, 50], reads: {}, met: [], invites: [], invw: 0, debated: null, lawyers: false, regs: 0, final: false, oppLast: null, low: 99, rested: 0, zingers: 0, dodged: 0, closing: null,
    len, hd: true, mgr, programs: [], voterFile: false, contacts: 0, doorsWk: 0, jfc: false, merch: false, selfIn: 0, asked: [], redbox: 0, outPlus: 0, vfat: 0, partyW: -9, celebW: -9, pods: [], fringe: null,
  };
  s.dweek = debateWeek(r) + (len - 8);
  // the county map and the forecast can disagree, as in a race with strong third candidates: start where the forecast is
  const gap = c.sign * r.est.margin + DIFF[diff].start - margin(r, s);
  if (Math.abs(gap) > 0.5) s.nat += gap;
  // Polls in every race share an error nobody can see: the people who answer are not quite the people who vote. The polls
  // start where the forecast is; the truth sits off by this much, and only election night shows which way.
  s.pollBias = Math.round(gauss(s) * 2.2 * DIFF[diff].noise * 100) / 100;
  s.nat -= s.pollBias;
  s.mods = []; s.dirt = 0; s.dumped = false; s.shocks = [];
  seedReads(r, s);
  s.trend.push({ w: 0, m: margin(r, s) });
  publicPolls(r, s, true);
  initRival(c, s);
  s.queue = []; s.streak = 0; s.ach = []; s.chatN = 0; s.chaosN = 0;
  return s;
}

// ------------------------------------------------------------- where the race stands
export function countyVotes(r: RaceFile, s: State, i: number, glob: number) {
  const c = r.counties[i], sign = s.side === "R" ? 1 : -1;
  const meV0 = sign > 0 ? c[4] : c[3], opV0 = sign > 0 ? c[3] : c[4];
  const shift = ((s.pers[i] + glob) / 200) * c[5];
  // enthusiasm moves turnout: each side's voters show up a little more or less than the forecast expects
  const tm = 1 + ((s.enth?.[0] ?? 50) - 50) / 450, to = 1 + ((s.enth?.[1] ?? 50) - 50) / 450;
  const me = Math.max(0, (meV0 + shift) * tm + s.xme[i]), op = Math.max(0, (opV0 - shift) * to + s.xop[i]);
  const other = Math.max(0, c[5] - c[3] - c[4]);
  return { me, op, t: me + op + other };
}
export const globalShift = (s: State) => s.glob + s.adStock + s.perm + s.nat;
export function margin(r: RaceFile, s: State) {
  let me = 0, op = 0, t = 0;
  const g = globalShift(s);
  for (let i = 0; i < r.counties.length; i++) { const v = countyVotes(r, s, i, g); me += v.me; op += v.op; t += v.t; }
  if (!r.counties.length) { const sign = s.side === "R" ? 1 : -1; return sign * r.est.margin + g; }
  return (100 * (me - op)) / Math.max(1, t);
}
export const polledAvg = (s: State) => {
  const ps = s.polls.filter((p) => p.w >= s.week - 3);
  if (!ps.length) return null;
  let a = 0, w = 0;
  for (const p of ps) { const k = (p.internal ? 1.6 : 1) * Math.pow(0.7, s.week - 1 - p.w); a += k * p.m; w += k; }
  return a / w;
};

// ------------------------------------------------------------- how the electorate hears a statement
export type Stance = { pos?: number; issue?: string; trump?: number; tone?: "calm" | "fiery"; extra?: string[]; sal?: number };
const ISSUE: Record<string, string> = { econ: "Economy and cost of living", health: "Health care and Social Security", immig: "Immigration", corruption: "Corruption", other: "Something else" };
const ideal = (L: number) => clamp(L * 1.4, -1, 1);
const appeal = (p: number, L: number) => 1 - Math.abs(p - ideal(L));

/** Points for the player when they take this stance, and who moved. Each audience moves by how much closer the stance
 * sits to what that group of voters wants than the candidate's party usually does, times how persuadable the group is. */
export function react(c: Ctx, s: State, st: Stance, mult = 1, noisy = true): { fx: number; parts: Part[] } {
  const party = c.me.party === "I" ? "I" : c.side;
  const p0 = party === "R" ? 0.65 : party === "D" ? -0.65 : 0;
  const pos = st.pos ?? (st.tone === "fiery" ? Math.max(-1, Math.min(1, p0 * 1.5)) : p0);
  const aud: { label: string; share: number; L: number; per: number; w: number; own?: boolean; other?: boolean }[] = [];
  const add = (label: string, dim: string | undefined, per: number, w: number, nice?: string, own?: boolean, other?: boolean) => {
    const g = c.g(label, dim); if (g) aud.push({ label: nice ?? g.label, share: g.share, L: g.L, per, w, own, other });
  };
  const sal = st.sal ?? 1;
  if (st.issue) { const g = c.g(ISSUE[st.issue] ?? st.issue, "Top issue"); if (g) aud.push({ label: `${g.label.replace(/^Economy and cost of living$/, "Cost of living")} voters`, share: g.share, L: g.L, per: 0.35 + 0.5 * (1 - Math.abs(g.L)), w: 1.3 }); }
  add("Independent", "Party ID", 1, 0.9 * sal, "Independents");
  add("Moderate", "Ideology", 0.85, 0.7 * sal, "Moderates");
  for (const x of st.extra ?? []) add(x, undefined, 0.7, 0.8 * sal);
  const ownL = party === "R" ? "Republican" : "Democrat", othL = party === "R" ? "Democrat" : "Republican";
  if (party !== "I") { add(ownL, "Party ID", 0.45, 0.8 * sal, `${ownL}s, your base`, true); add(othL, "Party ID", 0.12, 0.6 * sal, `${othL}s`, false, true); }
  else { add("Democrat", "Party ID", 0.3, 0.6 * sal, "Democrats"); add("Republican", "Party ID", 0.3, 0.6 * sal, "Republicans"); }
  const parts: Part[] = [];
  const K = 2.6 * mult;
  const crossing = party === "D" ? pos > 0.25 : party === "R" ? pos < -0.25 : false;
  for (const a of aud) {
    let d = appeal(pos, a.L) - appeal(p0, a.L);
    if (crossing && a.other) d *= 0.6; // the other party's voters half believe a crossover
    parts.push({ label: a.label, share: a.share, lean: a.L, fx: (a.share / 100) * d * a.per * a.w * K });
  }
  if (st.trump != null) {
    const t0 = party === "R" ? 0.45 : party === "D" ? -0.6 : -0.1;
    const A = c.approve, D = 100 - A;
    const dA = appeal(st.trump, 0.85) - appeal(t0, 0.85), dD = appeal(st.trump, -0.85) - appeal(t0, -0.85);
    parts.push({ label: "Voters who approve of Trump", share: A, lean: 0.8, fx: (A / 100) * dA * 0.32 * K });
    parts.push({ label: "Voters who disapprove of Trump", share: D, lean: -0.8, fx: (D / 100) * dD * 0.32 * K });
  }
  let fx = parts.reduce((a, p) => a + p.fx, 0) / Math.max(1, aud.length / 3);
  parts.forEach((p) => (p.fx /= Math.max(1, aud.length / 3)));
  const amp = (st.tone === "fiery" ? 1.3 : 1) * (st.issue === "econ" ? modProd(s, "econ") : 1);
  const noise = noisy ? 1 + gauss(s) * (st.tone === "fiery" ? 0.35 : 0.18) : 1;
  fx *= amp * noise; parts.forEach((p) => (p.fx *= amp * noise));
  if (noisy && fx < 0) { fx *= DIFF[s.diff].neg; parts.forEach((p) => (p.fx *= DIFF[s.diff].neg)); }
  parts.sort((a, b) => Math.abs(b.fx) - Math.abs(a.fx));
  return { fx, parts };
}

export function applyGlobal(s: State, fx: number, parts?: Part[], durable = 1) {
  s.glob += fx * durable; s.adStock += fx * (1 - durable);
  for (const p of parts ?? []) s.ledger[p.label] = (s.ledger[p.label] ?? 0) + p.fx;
}

// ------------------------------------------------------------- actions
export type ActResult = { ok: boolean; t: string; fx?: number; parts?: Part[]; big?: "viral" | "packed" | "dud" };
const gaffes = ["mixed up two county names at a rally", "misstated the state's unemployment rate in an interview", "was caught on a hot mic calling a reporter's question dumb", "flubbed the name of a local high school team", "said the wrong date for early voting in a radio spot, and the campaign had to correct it"];
function tire(c: Ctx, s: State, cost: number): ActResult | null {
  s.stamina = clamp(s.stamina - cost, 0, 100);
  if (s.stamina < 28 && rand(s) < (0.16 + (28 - s.stamina) / 120) * (s.mgr === "vet" ? 0.7 : 1)) {
    const fx = -(0.12 + rand(s) * 0.28) * DIFF[s.diff].neg;
    applyGlobal(s, fx, [{ label: "Everyone", share: 100, lean: 0, fx }], 0.4);
    const t = `Running on fumes, ${c.me.name} ${gaffes[Math.floor(rand(s) * gaffes.length)]}.`;
    s.log.push({ w: s.week, kind: "gaffe", t, fx });
    return { ok: true, t, fx };
  }
  return null;
}
const dim = (n: number) => 1 / (1 + 0.55 * n);
const ci = (r: RaceFile, f: string) => r.counties.findIndex((c) => c[0] === f);

export function rally(c: Ctx, s: State, f: string): ActResult {
  if (s.days < COST.rally) return { ok: false, t: "Not enough time left this week: a rally takes a full day." };
  if (s.cash < 35000) return { ok: false, t: "Not enough cash for a rally." };
  const i = ci(c.r, f); if (i < 0) return { ok: false, t: "Unknown county." };
  const bk = blockedBy(s, f); if (bk) return { ok: false, t: `${c.r.counties[i][1]} is recovering from ${bk.label.toLowerCase()}. A rally there would look tone deaf; hold a relief day instead.` };
  const co = c.r.counties[i], pm = c.base[i] + s.pers[i], e = dim(s.visits[f] ?? 0) * (0.75 + s.stamina / 400) * att(s);
  s.days -= COST.rally; s.cash -= 35000; s.spent += 35000; s.visits[f] = (s.visits[f] ?? 0) + 1;
  let t: string;
  if (pm >= 8) { const meV = s.side === "R" ? co[4] : co[3]; const add = meV * 0.008 * e * (cal(s) >= EARLY_FROM ? 1.3 : 1); s.xme[i] += add; s.pers[i] += 0.3 * e; const fire = 0.1 * e; s.glob += fire; s.ledger["Your base"] = (s.ledger["Your base"] ?? 0) + fire; t = `Rally in ${co[1]}, your country: about ${Math.round(add).toLocaleString()} more of your voters there fired up to turn out, and your base statewide saw it.`; }
  else if (pm > -8) { s.pers[i] += 2.6 * e; t = `Rally in ${co[1]}, a battleground: about ${(2.6 * e).toFixed(1)} points of persuasion there.`; }
  else { s.pers[i] += 1.7 * e; t = `Rally in ${co[1]}, the other side's turf: ${(1.7 * e).toFixed(1)} points there, and a story about reaching every voter.`; }
  const media = 0.06 * e * Math.pow(co[5] / c.total * 10, 0.35);
  s.glob += media; s.ledger["Local news viewers"] = (s.ledger["Local news viewers"] ?? 0) + media;
  const fx = (co[5] / c.total) * (pm >= 8 ? 0 : (pm > -8 ? 2.6 : 1.7) * e) + media;
  s.log.push({ w: s.week, kind: "you", t, fx });
  s.buzz = clamp(s.buzz + 5 * e, 0, 100); s.volunteers += Math.round(18 * e);
  s.enth[0] = clamp(s.enth[0] + (pm >= 8 ? 1.6 : 0.8) * e, 0, 100);
  groundRead(c, s, i, "Your advance team");
  const crowd = crowdRoll(c, s, co[1]);
  return tire(c, s, 13) ?? { ok: true, t: crowd ? `${t} ${crowd.t}` : t, fx: fx + (crowd?.fx ?? 0), big: crowd?.big };
}
/** Every rally rolls its crowd: once in a while a clip goes viral, sometimes the gym is half empty. */
function crowdRoll(c: Ctx, s: State, name: string): { t: string; fx: number; big: "viral" | "packed" | "dud" } | null {
  const x = rand(s), pv = 0.05 + s.buzz / 900 + (s.staff.digital ? 0.03 : 0), pd = 0.07 + (s.stamina < 40 ? 0.08 : 0) + (s.buzz < 25 ? 0.05 : 0);
  if (x < pv) {
    const fx = 0.05 + rand(s) * 0.05; s.buzz = clamp(s.buzz + 14, 0, 100); s.volunteers += 120; applyGlobal(s, fx, [{ label: "Voters online", share: 40, lean: 0, fx }], 0.6);
    const t = `Viral moment: a clip from ${name} hit millions of views overnight.`; s.log.push({ w: s.week, kind: "you", t, fx }); return { t, fx, big: "viral" };
  }
  if (x < pv + 0.12) { s.buzz = clamp(s.buzz + 4, 0, 100); s.volunteers += 40; return { t: "A packed house, with a line out the door.", fx: 0, big: "packed" }; }
  if (x > 1 - pd) {
    const fx = -(0.02 + rand(s) * 0.03) * DIFF[s.diff].neg; s.buzz = clamp(s.buzz - 6, 0, 100); applyGlobal(s, fx, [{ label: "Local news viewers", share: 30, lean: 0, fx }], 0.5);
    const t = `Empty seats: the local news led with the half empty gym in ${name}.`; s.log.push({ w: s.week, kind: "gaffe", t, fx }); return { t, fx, big: "dud" };
  }
  return null;
}

export function townHall(c: Ctx, s: State, f: string): ActResult {
  if (s.days < COST.hall) return { ok: false, t: "No time left this week." };
  if (s.cash < 12000) return { ok: false, t: "Not enough cash." };
  const i = ci(c.r, f); if (i < 0) return { ok: false, t: "Unknown county." };
  if (blockedBy(s, f)) return { ok: false, t: `${c.r.counties[i][1]} is in recovery. Hold a relief day there instead.` };
  const co = c.r.counties[i], e = dim(s.visits[f] ?? 0) * att(s);
  s.days -= COST.hall; s.cash -= 12000; s.spent += 12000; s.visits[f] = (s.visits[f] ?? 0) + 1;
  s.pers[i] += 1.15 * e;
  const ind = c.g("Independent", "Party ID")?.share ?? 30;
  let fx = (ind / 100) * 0.4 * e;
  let t = `Town hall in ${co[1]}: an hour of questions from undecided voters.`;
  if (rand(s) < 0.15) { const good = rand(s) < 0.55; const k = (good ? 1 : -1.2) * (0.1 + rand(s) * 0.15); fx += k; t += good ? " A tough exchange with a heckler went viral the good way." : " A testy answer to a voter became the clip of the day."; }
  applyGlobal(s, fx, [{ label: "Independents", share: ind, lean: 0, fx }], 0.7);
  s.buzz = clamp(s.buzz + 2, 0, 100); s.volunteers += 8;
  s.log.push({ w: s.week, kind: "you", t, fx });
  groundRead(c, s, i, "Questions at your town hall");
  return tire(c, s, 9) ?? { ok: true, t, fx };
}

export function fundraise(c: Ctx, s: State, kind: "call" | "donors" | "email" | "virtual" | "celeb"): ActResult {
  const fm = DIFF[s.diff].fund * (1 + 0.3 * s.momentum);
  if (kind === "virtual") {
    if (s.days < COST.virtual) return { ok: false, t: "No time left this week." };
    if ((s.vfat ?? 0) >= 2) return { ok: false, t: "Two video fundraisers is the most your list will sit through in a week." };
    s.days -= COST.virtual; s.vfat = (s.vfat ?? 0) + 1;
    const amt = Math.round(c.weekly * 0.2 * fm * (0.6 + c.smallShare) * (0.7 + s.buzz / 150) * (s.mgr === "digital" ? 1.3 : 1) * (s.staff.digital ? 1.25 : 1) * Math.pow(0.75, (s.vfat ?? 1) - 1));
    s.cash += amt; s.raised += amt;
    const t = `A video call fundraiser with grassroots donors: ${usd(amt)}, and nobody had to drive anywhere.`; s.log.push({ w: s.week, kind: "money", t });
    return tire(c, s, 3) ?? { ok: true, t };
  }
  if (kind === "celeb") {
    if (s.days < COST.celeb) return { ok: false, t: "A celebrity fundraiser takes a full day." };
    if (s.week - (s.celebW ?? -9) < 3) return { ok: false, t: "The celebrity circuit needs three weeks between events." };
    s.days -= COST.celeb; s.celebW = s.week;
    const star = c.me.party === "R" ? "a country music star" : c.me.party === "D" ? "an Oscar winning actor" : "a famous retired quarterback";
    const amt = Math.round(c.weekly * 1.25 * fm * (0.8 + s.buzz / 250));
    s.cash += amt; s.raised += amt; s.buzz = clamp(s.buzz + 7, 0, 100);
    let t = `A fundraiser hosted by ${star}: ${usd(amt)} and a lot of photos.`;
    if (rand(s) < 0.18 + (c.costsHard > 55 ? 0.1 : 0)) {
      const fx = -0.13 * DIFF[s.diff].neg * att(s);
      applyGlobal(s, fx, [{ label: "Voters who find daily costs hard to afford", share: c.costsHard, lean: 0, fx }], 0.6);
      t += " Then the $10,000 a plate menu leaked, and your opponent had a field day.";
      s.log.push({ w: s.week, kind: "money", t, fx }); return tire(c, s, 9) ?? { ok: true, t, fx };
    }
    s.log.push({ w: s.week, kind: "money", t });
    return tire(c, s, 9) ?? { ok: true, t };
  }
  if (kind === "email") {
    if (s.fatigue >= 3) return { ok: false, t: "Your list is tapped out this week. Try again next week." };
    // the list's size and habits come from the donor map: a campaign that raises more in gifts under $200 gets more from a blast
    const amt = Math.round(c.weekly * 0.22 * fm * (s.staff.digital ? 1.6 : 1) * (s.mgr === "digital" ? 1.3 : 1) * Math.pow(0.7, s.fatigue) * (0.55 + c.smallShare) * (0.75 + s.buzz / 200));
    s.fatigue += 1; s.cash += amt; s.raised += amt;
    const t = `An email and text blast to small donors brought in ${usd(amt)}. ${Math.round(c.smallShare * 100)}% of your itemized money comes in gifts under $200.`; s.log.push({ w: s.week, kind: "money", t }); return { ok: true, t };
  }
  const need = kind === "call" ? COST.call : COST.donors;
  if (s.days < need) return { ok: false, t: kind === "call" ? "No time left this week." : "A big dollar fundraiser takes a full day." };
  s.days -= need;
  if (kind === "call") {
    const amt = Math.round(c.weekly * 0.38 * fm);
    s.cash += amt; s.raised += amt; const t = `A morning of call time: ${usd(amt)} raised.`; s.log.push({ w: s.week, kind: "money", t });
    return tire(c, s, 6) ?? { ok: true, t };
  }
  const amt = Math.round(c.weekly * 0.85 * fm * (0.7 + c.bigShare * 1.5));
  s.cash += amt; s.raised += amt;
  let t = `A big dollar fundraiser: ${usd(amt)} raised.`;
  if (c.costsHard > 50 && rand(s) < 0.22) {
    const fx = -0.15 * DIFF[s.diff].neg * att(s);
    applyGlobal(s, fx, [{ label: "Voters who find daily costs hard to afford", share: c.costsHard, lean: 0, fx }], 0.6);
    t += ` A photo from the event drew an out of touch story; ${Math.round(c.costsHard)} percent of voters here say daily costs are hard to afford.`;
    s.log.push({ w: s.week, kind: "money", t, fx }); return tire(c, s, 10) ?? { ok: true, t, fx };
  }
  s.log.push({ w: s.week, kind: "money", t });
  return tire(c, s, 10) ?? { ok: true, t };
}

export function media(c: Ctx, s: State): ActResult {
  if (s.days < COST.media) return { ok: false, t: "No time left this week." };
  s.days -= COST.media;
  const fx = (0.04 + rand(s) * 0.04) * att(s);
  applyGlobal(s, fx, [{ label: "Local news viewers", share: 60, lean: 0, fx }], 0.5);
  const t = "A media tour: local TV, talk radio and two podcasts."; s.log.push({ w: s.week, kind: "you", t, fx });
  s.buzz = clamp(s.buzz + 8, 0, 100);
  return tire(c, s, 8) ?? { ok: true, t, fx };
}
export function rest(s: State, half = false): ActResult {
  const n = half ? COST.nap : COST.rest;
  if (s.days < n) return { ok: false, t: "No time left this week." };
  s.days -= n; s.stamina = clamp(s.stamina + (half ? 14 : 32), 0, 100); s.rested += 1;
  return { ok: true, t: half ? "An afternoon off: a nap on the bus and a call home." : "A day off the trail. The candidate sleeps in and calls home." };
}
export function debatePrep(c: Ctx, s: State): ActResult {
  if (s.days < COST.prep) return { ok: false, t: "Debate prep takes a full day." };
  if (s.week > s.dweek) return { ok: false, t: "The debate is over." };
  s.days -= COST.prep; s.prep += 1;
  const t = `Debate prep with a stand in for ${c.op.name}.`; s.log.push({ w: s.week, kind: "you", t });
  return tire(c, s, 5) ?? { ok: true, t };
}

/** How much of its cash a normal campaign puts on television each week, rising to the end. */
export const SCHED = [0.07, 0.08, 0.09, 0.1, 0.12, 0.15, 0.2, 0.35];
export const schedAt = (cw: number) => (cw <= 0 ? 0.035 : SCHED[Math.min(8, cw) - 1] ?? 0.35);
/** What a normal week on the trail is worth; the forecast assumes you do at least this much. */
export const NORMAL_WEEK = 0.13;
export const airFx = (spend: number, cost: number) => 0.45 * Math.log(1 + Math.max(0, spend) / cost);
export function buyTV(c: Ctx, s: State, amt: number, tone: "positive" | "contrast" | "attack"): ActResult {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const rate = rateAt(cal(s));
  s.cash -= amt; s.spent += amt; s.tvWeek += amt;
  s.pending.push(`tv:${Math.round(amt / rate)}:${tone}`);
  const t = `${usd(amt)} of ${tone} television booked for this week across ${c.r.state}${rate > 1 ? `, at late rates ${Math.round((rate - 1) * 100)}% above September` : rate < 1 ? ", at cheap summer rates, though fewer voters are watching" : ""}.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
export function reserveTV(c: Ctx, s: State, w: number, amt: number, tone: "positive" | "contrast" | "attack"): ActResult {
  if (w <= s.week || w > lenOf(s)) return { ok: false, t: "Reserve a future week." };
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  // reserved airtime is booked at today's rate and counted at that week's rate
  const now = rateAt(cal(s)), then = rateAt(cal(s, w));
  s.cash -= amt; s.spent += amt; s.reserved.push({ w, amt: Math.round(amt * then / Math.max(0.01, now)), tone });
  const t = `Reserved ${usd(amt)} of ${tone} television for week ${w} at today's rate, ${Math.max(0, Math.round((then / now - 1) * 100))}% cheaper than buying it then.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
/** A weekend of door knocking: volunteers from your field offices contact voters in those counties. */
export function canvass(c: Ctx, s: State): ActResult {
  if (s.days < COST.canvass) return { ok: false, t: "A door knocking weekend takes a full day of the candidate's time." };
  if (!s.offices.length) return { ok: false, t: "Open a field office first; volunteers need somewhere to pick up their walk lists." };
  s.days -= COST.canvass;
  const k = cal(s), when = k <= 0 ? 0.45 : k >= EARLY_FROM ? 1.25 : 1;
  const votes = s.volunteers * 3 * (s.staff.field ? 1.4 : 1) * (s.mgr === "vet" ? 1.2 : 1) * when;
  const idx = s.offices.map((f) => ci(c.r, f)).filter((i) => i >= 0);
  const tot = idx.reduce((a, i) => a + c.r.counties[i][5], 0) || 1;
  for (const i of idx) s.xme[i] += votes * (c.r.counties[i][5] / tot);
  s.knocks += Math.round(s.volunteers * 60);
  const t = `Door knocking weekend: ${s.volunteers.toLocaleString()} volunteers knocked about ${Math.round(s.volunteers * 60).toLocaleString()} doors and turned out roughly ${Math.round(votes).toLocaleString()} more of your voters.`;
  s.log.push({ w: s.week, kind: "you", t });
  return tire(c, s, 7) ?? { ok: true, t };
}
export function buyDigital(c: Ctx, s: State, amt: number, label: string): ActResult {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const g = c.groups.find((x) => x.label === label); if (!g) return { ok: false, t: "Unknown group." };
  s.cash -= amt; s.spent += amt; s.digWeek += amt;
  const per = 0.3 + 0.7 * (1 - Math.abs(g.L));
  const fx = (g.share / 100) * 3.2 * Math.log(1 + amt / (c.total * 0.18)) * per * (s.staff.digital ? 1.2 : 1) * (s.staff.media ? 1.1 : 1) * (s.mgr === "digital" ? 1.2 : 1) * att(s);
  applyGlobal(s, fx, [{ label: g.label, share: g.share, lean: g.L, fx }], 0.5);
  const t = `${usd(amt)} of digital ads aimed at ${g.label.toLowerCase()}, ${Math.round(g.share)} percent of voters, who split ${Math.round(g.d)} to ${Math.round(g.r)}.`;
  s.log.push({ w: s.week, kind: "you", t, fx });
  return { ok: true, t, fx };
}
export function openOffice(c: Ctx, s: State, f: string): ActResult {
  const cost = 60000;
  if (s.offices.includes(f)) return { ok: false, t: "You already have an office there." };
  if (!s.staff.field && s.offices.length >= 3) return { ok: false, t: "Hire a field director to run more than three offices." };
  if (s.cash < cost) return { ok: false, t: "Not enough cash." };
  s.cash -= cost; s.spent += cost; s.offices.push(f);
  const co = c.r.counties[ci(c.r, f)];
  const t = `Field office opened in ${co?.[1] ?? f}. Volunteers start knocking doors this week.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
export function fundGotv(c: Ctx, s: State, amt: number): ActResult {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  s.cash -= amt; s.spent += amt; s.gotv += amt;
  const t = `${usd(amt)} into the statewide turnout program: paid canvassers, rides to the polls and ballot chase.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
export function hire(c: Ctx, s: State, who: keyof typeof STAFF_COST | "pollster", tier?: 1 | 2 | 3): ActResult {
  if (who === "pollster") {
    s.staff.pollster = tier ?? 2; const t = `Hired a ${POLLSTERS[s.staff.pollster]!.name}. An internal poll lands every week.`; s.log.push({ w: s.week, kind: "you", t });
    return { ok: true, t };
  }
  const x = STAFF_COST[who];
  const price = Math.round(x.hire * (who === "oppo" && s.mgr === "brawler" ? 0.6 : 1));
  if (s.staff[who]) return { ok: false, t: "Already on staff." };
  if (s.cash < price) return { ok: false, t: "Not enough cash." };
  s.cash -= price; s.spent += price; s.staff[who] = true;
  const t = `Hired a ${x.name.toLowerCase()}.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}


// ------------------------------------------------------------- what the campaign knows: county reads
/** Regions of the state: the research's own, and everything else as one more. */
export function regionsOf(r: RaceFile): { name: string; f: string[]; note?: string }[] {
  const regs = (r.research?.regions ?? []).map((g) => ({ name: g.name, f: g.f.filter((f) => r.counties.some((c) => c[0] === f)), note: g.note })).filter((g) => g.f.length);
  const inR = new Set(regs.flatMap((g) => g.f));
  const rest = r.counties.filter((c) => !inR.has(c[0])).map((c) => c[0]);
  if (!regs.length) {
    const big = [...r.counties].sort((a, b) => b[5] - a[5]);
    const top = big.slice(0, Math.min(4, big.length)).map((c) => ({ name: c[1], f: [c[0]] }));
    const left = big.slice(4).map((c) => c[0]);
    return left.length ? [...top, { name: "Rest of the state", f: left }] : top;
  }
  return rest.length ? [...regs, { name: "Everywhere else", f: rest }] : regs;
}
export function truthAt(r: RaceFile, s: State, i: number) { const v = countyVotes(r, s, i, globalShift(s)); return (100 * (v.me - v.op)) / Math.max(1, v.t); }
function setRead(s: State, f: string, est: number, sd: number, src: string) {
  const old = s.reads[f];
  // a fresh, sharper read replaces an older or blurrier one
  if (!old || sd <= old[1] + 1.1 * (s.week - old[2]) + 0.01) s.reads[f] = [Math.round(est * 10) / 10, Math.round(sd * 10) / 10, s.week, src];
}
export function seedReads(r: RaceFile, s: State) {
  r.counties.forEach((co, i) => { setRead(s, co[0], truthAt(r, s, i) + (s.pollBias ?? 0) + gauss(s) * 4.5, 6.5, "The pre campaign model"); });
}
function groundRead(c: Ctx, s: State, i: number, src: string, sd = 3.6) { setRead(s, c.r.counties[i][0], truthAt(c.r, s, i) + gauss(s) * sd, sd, src); }
function pollRegion(c: Ctx, s: State, f: string[], sd: number, src: string) {
  const e = gauss(s) * sd;
  // polls carry the shared polling error; your own canvassers and field offices do not
  for (const x of f) { const i = ci(c.r, x); if (i >= 0) setRead(s, x, truthAt(c.r, s, i) + (s.pollBias ?? 0) + e + gauss(s) * 2, sd + 2, src); }
}
/** The campaign's read of a county, blurred by how long ago anyone looked. */
export function readOf(s: State, f: string): { est: number; sd: number; w: number; src: string } | null {
  const x = s.reads?.[f]; if (!x) return null;
  return { est: x[0], sd: x[1] + 1.1 * Math.max(0, s.week - x[2]), w: x[2], src: x[3] };
}
export function readLabel(est: number, sd: number) {
  const k = Math.abs(est) / Math.max(1, sd);
  const side = est >= 0 ? "you" : "them";
  if (k < 0.35) return "Toss up";
  if (k < 1) return `Lean ${side}`;
  if (k < 2) return `Likely ${side}`;
  return `Safe ${side}`;
}
export const confLabel = (sd: number) => (sd < 4 ? "Good read" : sd < 7 ? "Fuzzy" : "Guesswork");

// ------------------------------------------------------------- more of the campaign
export const REG_DEADLINE = 4;
/** A voter registration drive: volunteers sign up new voters in one county, before the deadline. About half of new
 * registrants vote, and they split the way the county leans, a little better for whoever signed them up. */
export function regDrive(c: Ctx, s: State, f: string): ActResult {
  if (cal(s) > REG_DEADLINE) return { ok: false, t: "Registration closed in early October." };
  if (s.days < COST.reg) return { ok: false, t: "No time left this week." };
  if (s.cash < 15000) return { ok: false, t: "Not enough cash." };
  const i = ci(c.r, f); if (i < 0) return { ok: false, t: "Unknown county." };
  const co = c.r.counties[i], pm = c.base[i] + s.pers[i];
  s.days -= COST.reg; s.cash -= 15000; s.spent += 15000;
  const n = Math.round(Math.min(co[5] * 0.03, s.volunteers * 9 * (s.staff.field ? 1.3 : 1) * dim(s.visits["reg:" + f] ?? 0)));
  s.visits["reg:" + f] = (s.visits["reg:" + f] ?? 0) + 1;
  const pMe = Math.max(0.1, Math.min(0.9, 0.5 + pm / 200 + 0.06));
  const net = n * 0.5 * (2 * pMe - 1);
  s.xme[i] += Math.max(0, net); if (net < 0) s.xop[i] += -net;
  s.regs += n;
  const t = `Registration drive in ${co[1]}: ${n.toLocaleString()} new voters signed up. About half will vote, and in a county like this they net you about ${Math.round(net).toLocaleString()}.`;
  s.log.push({ w: s.week, kind: "you", t });
  return tire(c, s, 6) ?? { ok: true, t };
}
/** A quick poll of one region; sharper with a better pollster on staff. */
export function regionPoll(c: Ctx, s: State, k: number): ActResult {
  const reg = regionsOf(c.r)[k]; if (!reg) return { ok: false, t: "Unknown region." };
  const cost = 30000; if (s.cash < cost) return { ok: false, t: "Not enough cash." };
  s.cash -= cost; s.spent += cost;
  const sd = s.staff.pollster ? POLLSTERS[s.staff.pollster]!.sd * 1.3 + 0.8 : 3.8;
  pollRegion(c, s, reg.f, sd, `A poll of ${reg.name}`);
  const t = `A poll of ${reg.name} is in. Your read on its counties is fresh.`; s.log.push({ w: s.week, kind: "poll", t });
  return { ok: true, t };
}
export function hireLawyers(s: State): ActResult {
  if (s.lawyers) return { ok: false, t: "Your voter protection team is already set." };
  if (s.cash < 150000) return { ok: false, t: "Not enough cash." };
  s.cash -= 150000; s.spent += 150000; s.lawyers = true;
  const t = "Voter protection team hired: lawyers and poll watchers in every big county, and a hotline for voters in line."; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
/** The last 72 hours: volunteer shifts by county, and the closing message. */
export function finalPush(c: Ctx, s: State, alloc: Record<string, number>, closing: "positive" | "contrast" | "attack" | "base"): ActResult {
  if (s.final) return { ok: false, t: "Already done." };
  const tot = Object.values(alloc).reduce((a, b) => a + b, 0) || 1;
  const vols = s.volunteers * (s.staff.field ? 1.4 : 1);
  let made = 0;
  for (const [f, k] of Object.entries(alloc)) {
    const i = ci(c.r, f); if (i < 0 || k <= 0) continue;
    const co = c.r.counties[i], pm = c.base[i] + s.pers[i];
    const pMe = Math.max(0.1, Math.min(0.9, 0.5 + pm / 200));
    const contacts = vols * 25 * (k / tot); // doors and calls across the weekend
    const turned = Math.min(co[5] * 0.04, contacts * 0.06);
    const net = turned * (2 * pMe - 1) * 1.6; // shifts go to your own lists, so most of them are your voters
    if (net > 0) s.xme[i] += net; else s.xop[i] += -net * 0.4;
    made += net;
  }
  const g = closing === "attack" ? -0.05 + 0.25 * rand(s) : closing === "contrast" ? 0.08 : closing === "positive" ? 0.06 : 0.02;
  if (closing === "base") s.enth[0] = clamp(s.enth[0] + 6, 0, 100);
  applyGlobal(s, g, [{ label: "Late deciding voters", share: 8, lean: 0, fx: g }], 1);
  s.final = true; s.closing = closing;
  const t = `The final weekend: ${Math.round(vols).toLocaleString()} volunteers worked their shifts and turned out about ${Math.round(Math.max(0, made)).toLocaleString()} more of your voters.`;
  s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}

// ------------------------------------------------------------- the world, the oppo file and the odds
/** A day helping in a county hit by a storm or fire: no speeches, sandbags and supply runs. Voters notice. */
export function reliefDay(c: Ctx, s: State, f: string): ActResult {
  const i = ci(c.r, f), bk = blockedBy(s, f);
  if (i < 0 || !bk) return { ok: false, t: "Only counties in recovery need a relief day." };
  if (s.days < COST.rally) return { ok: false, t: "A relief day takes a full day." };
  if (s.visits["relief:" + f]) return { ok: false, t: "You already helped there; another photo op would look staged." };
  s.days -= COST.rally; s.visits["relief:" + f] = 1;
  s.pers[i] += 1.6 * att(s);
  const fx = (0.03 + rand(s) * 0.04) * att(s);
  applyGlobal(s, fx, [{ label: "Voters following the storm coverage", share: 50, lean: 0, fx }], 0.8);
  s.buzz = clamp(s.buzz + 6, 0, 100); s.volunteers += 25;
  const t = `A relief day in ${c.r.counties[i][1]}: sandbags, supply runs and no speeches. The local news ran it without a word from your campaign.`;
  s.log.push({ w: s.week, kind: "you", t, fx });
  return tire(c, s, 12) ?? { ok: true, t, fx };
}
/** Your opposition research builds a file on the other side, a bit every week. Drop it once: late is stronger, since
 * there is less time to answer, but it can turn out to be old news. */
export function dropOppo(c: Ctx, s: State): ActResult {
  if (!s.staff.oppo) return { ok: false, t: "Hire an opposition research firm first." };
  if (s.dumped) return { ok: false, t: "You already dropped the file." };
  if ((s.dirt ?? 0) < 2) return { ok: false, t: "The file is too thin. Give your researchers another week or two." };
  if (s.cash < 200000) return { ok: false, t: "Rolling it out with ads and a press push costs $200K." };
  s.cash -= 200000; s.spent += 200000; s.dumped = true;
  const late = cal(s) >= 6 ? 1.2 : 1;
  let fx = Math.min(0.75, 0.075 * (s.dirt ?? 0)) * (0.75 + rand(s) * 0.5) * late * att(s) * (s.mgr === "brawler" ? 1.15 : 1);
  let t = `You dropped the opposition file on ${c.op.name}: ${Math.round(s.dirt ?? 0)} weeks of research, a press call and ads behind it.`;
  if (rand(s) < 0.15) { fx *= 0.25; t += " Reporters had seen most of it before. Old news."; } else t += late > 1 ? " So close to the election, there is no time left to answer it." : " It led the news for days.";
  applyGlobal(s, fx, [{ label: "Voters following the race", share: 55, lean: 0, fx }], 0.75);
  s.enth[1] = clamp(s.enth[1] - 3, 0, 100); s.buzz = clamp(s.buzz + 12, 0, 100);
  s.log.push({ w: s.week, kind: "you", t, fx });
  return { ok: true, t, fx };
}
const PHI = (z: number) => 1 / (1 + Math.exp(-1.702 * z));
/** The campaign's own odds: its poll average against the shared polling error, the noise in its polls and the weeks
 * left for things to change. It never sees the truth, only the polls. */
export function winOdds(s: State): { p: number; sd: number; avg: number } | null {
  const avg = polledAvg(s); if (avg == null) return null;
  const left = Math.max(0, lenOf(s) - s.week + 1);
  const tier = POLLSTERS[s.staff.pollster];
  const sd = Math.sqrt(2.4 ** 2 + (tier ? tier.sd ** 2 / 2 : 4) + 0.55 * left);
  return { p: PHI(avg / sd), sd, avg };
}

// ------------------------------------------------------------- the field program
/** Programs you can run at once: four, six with a field director. */
export const maxPrograms = (s: State) => (s.staff.field ? 6 : 4);
export function addProgram(c: Ctx, s: State, reg: number, kind: "pers" | "gotv"): ActResult {
  const g = regionsOf(c.r)[reg]; if (!g) return { ok: false, t: "Unknown region." };
  const P = (s.programs ??= []);
  if (P.some((p) => p.reg === reg && p.kind === kind)) return { ok: false, t: "That program is already running." };
  if (P.length >= maxPrograms(s)) return { ok: false, t: s.staff.field ? "Six programs is all your field staff can run." : "Hire a field director to run more than four programs." };
  if (s.cash < CREW.setup) return { ok: false, t: "Not enough cash." };
  s.cash -= CREW.setup; s.spent += CREW.setup; P.push({ reg, kind, crews: 0 });
  const t = `${kind === "pers" ? "Persuasion" : "Turnout"} program started in ${g.name}: turf cut, walk lists printed, volunteers assigned.`;
  s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
export function setCrews(s: State, k: number, crews: number): ActResult {
  const p = s.programs?.[k]; if (!p) return { ok: false, t: "No such program." };
  p.crews = Math.max(0, Math.min(8, Math.round(crews)));
  return { ok: true, t: p.crews ? `${p.crews} paid canvass crew${p.crews > 1 ? "s" : ""} on this program: ${usd(p.crews * CREW.wk)} a week.` : "Paid crews pulled; volunteers only." };
}
export function dropProgram(s: State, k: number): ActResult { if (!s.programs?.[k]) return { ok: false, t: "No such program." }; s.programs.splice(k, 1); return { ok: true, t: "Program shut down." }; }
export function buyVoterFile(s: State): ActResult {
  if (s.voterFile) return { ok: false, t: "You already have the data." };
  if (s.cash < 40000) return { ok: false, t: "Not enough cash." };
  s.cash -= 40000; s.spent += 40000; s.voterFile = true;
  const t = "Bought the enhanced voter file and a canvassing app: better targets, no wasted doors, and results synced every night."; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
/** What a program would do this week, before it runs: doors, conversations and net votes. */
export function programYield(c: Ctx, s: State, p: Prog, nProg: number) {
  const g = regionsOf(c.r)[p.reg]; if (!g) return { doors: 0, talks: 0, votes: 0, pts: 0, office: false, tot: 0 };
  const office = g.f.some((f) => s.offices.includes(f));
  const k = cal(s);
  const volDoors = (s.volunteers / Math.max(1, nProg)) * 55 * (office ? 1 : 0.55);
  const doors = volDoors + p.crews * CREW.doors;
  const talks = doors * (k <= 0 ? 0.33 : 0.27) * (s.voterFile ? 1.15 : 1);
  const skill = (s.staff.field ? 1.3 : 1) * (s.mgr === "vet" ? 1.2 : 1) * (s.voterFile ? 1.1 : 1);
  const per = p.kind === "pers" ? 0.04 * (k <= 4 ? 1 : 0.7) : 0.05 * (k <= 0 ? 0.3 : k < EARLY_FROM ? 0.7 : 1.3);
  const tot = g.f.reduce((a, f) => { const i = ci(c.r, f); return a + (i >= 0 ? c.r.counties[i][5] : 0); }, 0);
  // the same doors get knocked again: once a region's voters have all been talked to, each new talk is worth less
  const done = s.reach?.[`${p.reg}:${p.kind}`] ?? 0;
  const fresh = 1 / (1 + done / Math.max(1, tot * 0.35));
  const votes = talks * per * skill * fresh;
  return { doors: Math.round(doors), talks: Math.round(talks), votes, pts: (100 * votes) / Math.max(1, c.total), office, tot };
}
function fieldWeek(c: Ctx, s: State) {
  const P = s.programs ?? []; if (!P.length) { s.doorsWk = 0; return; }
  let doors = 0, talks = 0, votes = 0, pay = 0;
  P.forEach((p) => {
    const y = programYield(c, s, p, P.length); const g = regionsOf(c.r)[p.reg]; if (!g) return;
    doors += y.doors; talks += y.talks; votes += y.votes; pay += p.crews * CREW.wk;
    const rk = `${p.reg}:${p.kind}`; (s.reach ??= {})[rk] = (s.reach[rk] ?? 0) + y.talks;
    // persuasion goes to the region's closest counties, turnout to the ones that lean your way, by size
    const idx = g.f.map((f) => ci(c.r, f)).filter((i) => i >= 0);
    const wt = idx.map((i) => c.r.counties[i][5] * (p.kind === "pers" ? Math.max(0.15, 1 - Math.abs(c.base[i] + s.pers[i]) / 25) : Math.max(0.1, 0.5 + (c.base[i] + s.pers[i]) / 40)));
    const W = wt.reduce((a, b) => a + b, 0) || 1;
    idx.forEach((i, j) => {
      const v = y.votes * (wt[j] / W);
      if (p.kind === "pers") s.pers[i] += (100 * v) / Math.max(1, c.r.counties[i][5]); // net votes on the margin, as points of that county
      else s.xme[i] += v;
      groundRead(c, s, i, "Your canvassers", 4.6);
    });
  });
  s.cash -= pay; s.spent += pay; s.contacts = (s.contacts ?? 0) + talks; s.doorsWk = doors;
  s.knocks += Math.round(doors);
  s.log.push({ w: s.week, kind: "you", t: `Field: ${Math.round(doors).toLocaleString()} doors knocked and ${Math.round(talks).toLocaleString()} real conversations across ${P.length} program${P.length > 1 ? "s" : ""}, worth about ${Math.round(votes).toLocaleString()} net votes.${pay ? ` Paid crews cost ${usd(pay)}.` : ""}` });
}

// ------------------------------------------------------------- more ways to raise money
const nice = (v: number) => { const p = Math.pow(10, Math.max(3, Math.floor(Math.log10(Math.max(1, v))) - 1)); return Math.max(1000, Math.floor(v / p) * p); };
/** How much of their own money a candidate can put in: about a quarter of reported net worth, since most of a fortune is
 * a house, a business or a retirement account, never less than what they really put in this race, and $250,000 when
 * nothing has been reported, about what a candidate can borrow against a house and savings. */
export function selfCap(c: Ctx): { cap: number; worth: number | null; real: number; why: string } {
  const w = c.me.worth, real = Math.max(0, w?.self ?? 0), past = Math.max(0, w?.past ?? 0);
  let worth: number | null = null;
  if (w?.est) worth = w.est;
  else if (w?.low != null && w?.high != null) worth = Math.sqrt(Math.max(1, w.low) * Math.max(1, w.high));
  else if (w?.low != null || w?.high != null) worth = (w?.low ?? w?.high) as number;
  const fromWorth = worth != null ? Math.min(worth * 0.25, 150e6) : 250000;
  const cap = nice(Math.max(10000, fromWorth, real * 1.25, past * 1.25));
  const range = w?.low != null && w?.high != null ? `${usd(w.low)} to ${usd(w.high)}` : worth != null ? `about ${usd(worth)}` : null;
  const why = (range ? `Reported net worth ${range}${w?.basis === "disclosure range" ? " on financial disclosures" : ""}. Candidates rarely put in more than a quarter of what they are worth; most of it is a house, a business or a retirement account.` : `No net worth has been reported, so the cap is ${usd(250000)}, about what a candidate can borrow against a house and savings.`)
    + (real > 1000 ? ` In real life ${c.me.name} has put ${usd(real)} into this race.` : "") + (past > 0 && w?.pastNote ? ` ${w.pastNote}.` : "");
  return { cap, worth, real, why };
}
/** Self funding steps for the money tab: small, medium, large and everything that is left. */
export function selfSteps(c: Ctx, s: State) {
  const left = Math.max(0, selfCap(c).cap - (s.selfIn ?? 0));
  return [...new Set([0.05, 0.15, 0.4, 1].map((k) => (k === 1 ? Math.floor(left) : nice(left * k))).filter((v) => v >= 1000 && v <= left))];
}
export function selfFund(c: Ctx, s: State, amt: number): ActResult {
  const cap = selfCap(c).cap;
  if ((s.selfIn ?? 0) + amt > cap + 1) return { ok: false, t: (s.selfIn ?? 0) >= cap ? "Your accountant says that is everything you can liquidate." : `You can only put in ${usd(cap - (s.selfIn ?? 0))} more.` };
  s.cash += amt; s.selfIn = (s.selfIn ?? 0) + amt;
  let t = `You wrote your campaign a check for ${usd(amt)}.`, fx = 0;
  if ((s.selfIn ?? 0) > 1e6) {
    fx = -Math.min(0.15, 0.025 * (amt / 1e6)) * DIFF[s.diff].neg * att(s);
    applyGlobal(s, fx, [{ label: "Voters who find daily costs hard to afford", share: c.costsHard, lean: 0, fx }], 0.6);
    t += ` ${c.op.name} called it buying a seat, and your small donors felt less needed.`;
    s.fatigue = Math.min(3, s.fatigue + 1);
  }
  s.log.push({ w: s.week, kind: "money", t, fx: fx || undefined });
  return { ok: true, t, fx };
}
export function setupJFC(c: Ctx, s: State): ActResult {
  if (s.jfc) return { ok: false, t: "Your joint fundraising committee is already running." };
  if (s.days < COST.jfc) return { ok: false, t: "The launch event takes a full day." };
  s.days -= COST.jfc; s.jfc = true;
  const amt = Math.round(c.weekly * 0.5); s.cash += amt; s.raised += amt;
  const t = `Joint fundraising committee with the national party: big donors can now write one check that is split between you and the party. The launch raised ${usd(amt)}, and your weekly money runs about 15 percent higher.`;
  s.log.push({ w: s.week, kind: "money", t });
  return { ok: true, t };
}
export function openMerch(c: Ctx, s: State): ActResult {
  if (s.merch) return { ok: false, t: "The store is already open." };
  if (s.cash < 25000) return { ok: false, t: "Not enough cash." };
  s.cash -= 25000; s.spent += 25000; s.merch = true; s.buzz = clamp(s.buzz + 3, 0, 100);
  const t = "The merch store is open: hats, shirts and yard signs. It earns a little every week, more when your buzz is up, and every hat is a walking ad.";
  s.log.push({ w: s.week, kind: "money", t });
  return { ok: true, t };
}
/** Ask the party committee for help. The party funds races it thinks are close, so a blowout either way gets little. */
export function askParty(c: Ctx, s: State, who: string): ActResult {
  if (s.days < COST.ask) return { ok: false, t: "No time left this week." };
  if (s.week - (s.partyW ?? -9) < 4) return { ok: false, t: "The party will take your call again in a few weeks." };
  s.days -= COST.ask; s.partyW = s.week;
  const avg = polledAvg(s) ?? margin(c.r, s);
  const close = Math.max(0.15, 1 - Math.abs(avg) / 8);
  const amt = Math.round(c.weekly * 1.1 * close * (cal(s) <= 0 ? 0.6 : 1));
  s.cash += amt; s.raised += amt;
  const t = close > 0.6 ? `${who} sees a race it can win: ${usd(amt)} in coordinated money is on the way.` : `${who} has other races to save. They sent ${usd(amt)} and their best wishes.`;
  s.log.push({ w: s.week, kind: "money", t });
  return { ok: true, t };
}

// ------------------------------------------------------------- the debate stage
export const debateMult = (s: State) => 1.5 * (1 + 0.12 * Math.min(4, s.prep));
/** One answer: how it lands against the average of the answers on offer, times the delivery (0 to 1, 0.5 is average). */
export function debateAnswer(c: Ctx, s: State, st: Stance, all: Stance[], delivery: number): { fx: number; parts: Part[] } {
  const mult = debateMult(s);
  const others = all.map((x) => react(c, s, x, mult, false));
  const meanFx = others.reduce((a, x) => a + x.fx, 0) / Math.max(1, others.length);
  const r = react(c, s, st, mult);
  const d = 0.5 + Math.max(0, Math.min(1, delivery));
  // good delivery makes a good answer land harder and softens a bad one
  const base = (r.fx - meanFx) * 0.55, k = base >= 0 ? d : 1.5 - d * 0.7;
  const fx = base * k + (delivery - 0.5) * 0.08;
  const parts = r.parts.slice(0, 4).map((p) => ({ ...p, fx: (p.fx - meanFx / 4) * 0.55 * k }));
  return { fx, parts };
}
/** A comeback after the other candidate's answer. */
export function rebuttal(c: Ctx, s: State, kind: "counter" | "zinger" | "calm"): { fx: number; good: boolean; t: string } {
  if (kind === "calm") return { fx: 0.015, good: true, t: "You let it go and looked steady." };
  if (kind === "counter") { const fx = 0.03 + (s.staff.oppo ? 0.05 : 0) + gauss(s) * 0.02; return { fx, good: fx > 0, t: s.staff.oppo ? "Your opposition research gave you the exact vote to cite." : "A solid answer, if a little general." }; }
  s.zingers += 1;
  const p = 0.42 + 0.07 * Math.min(4, s.prep) + (s.staff.oppo ? 0.1 : 0) - (s.stamina < 35 ? 0.15 : 0);
  if (rand(s) < p) { s.buzz = clamp(s.buzz + 14, 0, 100); return { fx: 0.16 + rand(s) * 0.06, good: true, t: "The line of the night. It will be on every channel by midnight." }; }
  return { fx: -(0.12 + rand(s) * 0.06) * DIFF[s.diff].neg, good: false, t: "It landed with a thud, and the clip is already going around." };
}
/** Debate night is over: apply what happened, plus the snap poll on who won. */
export function finishDebate(c: Ctx, s: State, total: number, oppTotal: number): { won: boolean; snap: number; fx: number } {
  const net = total - oppTotal;
  const snap = Math.max(8, Math.min(92, Math.round(50 + net * 45 + gauss(s) * 4)));
  const won = snap >= 50;
  const fx = net * 0.6 + (won ? 0.05 : -0.05);
  applyGlobal(s, fx, [{ label: "Debate watchers", share: 25, lean: 0, fx }], 0.7);
  s.enth[0] = clamp(s.enth[0] + (won ? 4 : -2), 0, 100); s.enth[1] = clamp(s.enth[1] + (won ? -2 : 3), 0, 100);
  s.buzz = clamp(s.buzz + (won ? 10 : 4), 0, 100);
  s.debated = fx; s.used.push("debate");
  s.log.push({ w: s.week, kind: "event", t: `Debate night: the snap poll had ${won ? "you" : c.op.name} winning, ${Math.max(snap, 100 - snap)} to ${Math.min(snap, 100 - snap)}.`, fx });
  return { won, snap, fx };
}

// ------------------------------------------------------------- meetings
export function resolveMeet(c: Ctx, s: State, m: Meet, k: number): { t: string; fx: number; parts: Part[]; caught: boolean } {
  const o = m.opts[k];
  if (!o) { s.invites = s.invites.filter((y) => y.id !== m.id); return { t: "", fx: 0, parts: [], caught: false }; }
  const x = o.out;
  s.met.push(m.id); s.invites = s.invites.filter((y) => y.id !== m.id);
  s.days = Math.max(0, s.days - meetCost(x));
  const res = applyOut(c, s, x);
  s.log.push({ w: s.week, kind: "event", t: `Met with ${m.who}: ${o.label}. ${res.t}`, fx: res.fx || undefined });
  return res;
}
/** Time a meeting choice takes, in half days: a meeting is a half day unless it says otherwise. */
export const meetCost = (x: MeetOut) => (x.days == null ? COST.meet : Math.round(x.days * 2));
/** What a choice does: money, volunteers, enthusiasm, a stance voters hear, a risk that leaks. Shared by meetings,
 * scenario cards and the network. */
export function applyOut(c: Ctx, s: State, x: MeetOut): { t: string; fx: number; parts: Part[]; caught: boolean } {
  let fx = 0, parts: Part[] = [], t = x.t, caught = false;
  if (x.cash) { s.cash += x.cash; if (x.cash > 0) s.raised += x.cash; else s.spent -= x.cash; }
  if (x.vol) s.volunteers = Math.max(10, s.volunteers + x.vol);
  if (x.enth) s.enth[0] = clamp(s.enth[0] + x.enth, 0, 100);
  if (x.oppEnth) s.enth[1] = clamp(s.enth[1] + x.oppEnth, 0, 100);
  if (x.buzz) s.buzz = clamp(s.buzz + x.buzz, 0, 100);
  if (x.prep) s.prep += x.prep;
  if (x.endorse) s.endorsed.push(x.endorse);
  if (x.region && x.pers) for (const f of x.region) { const i = ci(c.r, f); if (i >= 0) s.pers[i] += x.pers; }
  if (x.st) { const r = react(c, s, x.st, 0.6 * (x.stSal ?? 1)); fx += r.fx * 0.5; parts = r.parts.map((p) => ({ ...p, fx: p.fx * 0.5 })); }
  if (x.fx) { const d = x.fx * (x.fx < 0 ? DIFF[s.diff].neg : 1) * (0.85 + rand(s) * 0.3); fx += d; parts = [{ label: x.fxLabel ?? "Voters following the race", share: 55, lean: 0, fx: d }, ...parts]; }
  if (x.outPlus) s.outPlus = (s.outPlus ?? 0) + x.outPlus;
  if (x.quit) { const k = (["media", "digital", "field"] as const).find((y) => s.staff[y]); if (k) { s.staff[k] = false; t += ` Your ${STAFF_COST[k].name.toLowerCase()} resigned over it.`; } }
  if (x.risk && rand(s) < x.risk) {
    caught = true; const hit = (x.riskFx ?? -0.2) * (x.riskFx != null && x.riskFx > 0 ? 1 : DIFF[s.diff].neg); fx += hit;
    if (x.riskCash) { s.cash += x.riskCash; if (x.riskCash < 0) s.spent -= x.riskCash; }
    parts = [{ label: "Voters following the race", share: 55, lean: 0, fx: hit }, ...parts];
    t += " " + (x.riskT ?? "Then a recording of the meeting leaked.");
  }
  fx *= att(s); parts = parts.map((p) => ({ ...p, fx: p.fx * att(s) }));
  if (fx) applyGlobal(s, fx, parts, 0.7);
  return { t, fx, parts: parts.slice(0, 5), caught };
}

// ------------------------------------------------------------- polls
function publicPolls(r: RaceFile, s: State, first = false) {
  const truth = margin(r, s), sign = s.side === "R" ? 1 : -1;
  if (first) {
    for (const p of r.polls.slice(0, 4)) s.polls.push({ w: 0, src: p.pollster, m: sign * p.margin + DIFF[s.diff].start, n: p.n, internal: false });
    return;
  }
  const chance = Math.min(0.92, (0.35 + r.polls.length / 16 + (cal(s) >= 6 ? 0.2 : 0)) * (cal(s) <= 0 ? 0.5 : 1));
  if (rand(s) < chance) {
    const p = r.polls[Math.floor(rand(s) * Math.max(1, r.polls.length))];
    const house = ((p?.pollster.length ?? 7) % 5 - 2) * 0.6 * (p?.pollster.includes("(R)") ? sign : p?.pollster.includes("(D)") ? -sign : 1);
    s.polls.push({ w: s.week, src: p?.pollster ?? "Local university poll", m: truth + (s.pollBias ?? 0) + house + gauss(s) * 3 * DIFF[s.diff].noise, n: p?.n || 600, internal: false });
  }
}
function internalPoll(c: Ctx, s: State) {
  const tier = POLLSTERS[s.staff.pollster]; if (!tier) return;
  s.cash -= tier.wk; s.spent += tier.wk;
  const truth = margin(c.r, s);
  const pick = ["Independent", "Women", "Men", "65+", "18 to 29", "College graduate", "No college degree", "Moderate"];
  const groups = pick.map((l) => c.g(l)).filter(Boolean).map((g) => {
    const baseM = -c.sign * (g!.d - g!.r);
    const moved = (s.ledger[g!.label] ?? 0) * (100 / Math.max(1, g!.share)) + (truth - s.trend[0].m);
    return { label: g!.label, m: baseM + moved + gauss(s) * tier.sd * 2 };
  });
  // regions from the race research: each region's margin from its counties, with more noise than the statewide number
  const g0 = globalShift(s);
  for (const reg of c.r.research?.regions ?? []) {
    let me = 0, op = 0, t = 0;
    for (const f of reg.f) { const i = ci(c.r, f); if (i < 0) continue; const v = countyVotes(c.r, s, i, g0); me += v.me; op += v.op; t += v.t; }
    if (t > 0) groups.push({ label: `Region: ${reg.name}`, m: (100 * (me - op)) / t + gauss(s) * tier.sd * 1.6 });
  }
  for (const reg of regionsOf(c.r)) pollRegion(c, s, reg.f, tier.sd * 1.6 + 1.5, `Your ${tier.name}`);
  // a better pollster cuts the random error, and a little of the shared one with a better likely voter screen
  const shared = (s.pollBias ?? 0) * (s.staff.pollster === 3 ? 0.8 : s.staff.pollster === 2 ? 0.9 : 1);
  groups.forEach((g) => (g.m += shared));
  s.polls.push({ w: s.week, src: `Your ${tier.name}`, m: truth + shared + gauss(s) * tier.sd, n: [0, 500, 800, 1200][s.staff.pollster], internal: true, groups });
}

// ------------------------------------------------------------- the other campaign
function opponentWeek(c: Ctx, s: State) {
  // The forecast already expects the other side to campaign normally, so only what they do beyond that moves the race:
  // nothing on Lean, more on the harder levels. Their stops still show up in your briefing.
  const k = (DIFF[s.diff].opp - 1 + 0.15) * att(s), r = c.r;
  const idx = r.counties.map((_, i) => i);
  const opBase = idx.filter((i) => c.base[i] <= -8).sort((a, b) => r.counties[b][5] - r.counties[a][5]).slice(0, 6);
  const swing = idx.filter((i) => Math.abs(c.base[i]) < 8).sort((a, b) => r.counties[b][5] - r.counties[a][5]).slice(0, 6);
  const stops: string[] = [], fips: string[] = [], bases: string[] = [];
  const go = (i: number, base: boolean) => {
    const f = r.counties[i][0], e = dim(s.oppVisits[f] ?? 0) * k;
    s.oppVisits[f] = (s.oppVisits[f] ?? 0) + 1;
    if (base) { s.xop[i] += (s.side === "R" ? r.counties[i][3] : r.counties[i][4]) * 0.008 * e; s.glob -= 0.1 * e; }
    else s.pers[i] -= 2.6 * e;
    s.glob -= 0.06 * e;
    stops.push(r.counties[i][1]); (base ? bases : fips).push(f);
    s.enth[1] = clamp(s.enth[1] + (base ? 1.2 : 0.6) * dim(s.oppVisits[f] - 1), 0, 100);
  };
  for (let j = 0; j < 2; j++) { if (opBase.length) go(opBase[Math.floor(rand(s) * opBase.length)], true); if (swing.length) go(swing[Math.floor(rand(s) * swing.length)], false); }
  // money in, money out
  s.oppCash += c.oppWeekly * (2 - DIFF[s.diff].fund);
  const rate = schedAt(cal(s));
  const opTV = s.oppCash * rate * 0.8;
  s.oppCash -= opTV / 0.8;
  if (cal(s) >= 4) for (const i of opBase.slice(0, 4)) s.xop[i] += (s.side === "R" ? r.counties[i][3] : r.counties[i][4]) * 0.003 * Math.max(0, k);
  if (stops.length) s.log.push({ w: s.week, kind: "opp", t: `${c.op.name} campaigned in ${[...new Set(stops)].join(", ")}.` });
  const theirs = c.op.party === "I" ? "I" : c.side === "D" ? "R" : "D";
  const ads = (r.research?.ads ?? []).filter((a) => a.for === theirs);
  s.oppLast = { stops: fips, base: bases, tv: Math.round(opTV), ad: ads.length ? `${ads[s.week % ads.length].by}: ${ads[s.week % ads.length].theme}` : null };
  return opTV;
}

// ------------------------------------------------------------- end of the week
export function endWeek(c: Ctx, s: State): LogItem[] {
  const before = s.log.length, r = c.r;
  const m0 = margin(r, s);
  // the air war: your television, theirs, and the outside groups, against what the forecast already expects both sides to spend
  const opTV = opponentWeek(c, s);
  let mineTV = 0;
  for (const x of s.reserved.filter((x) => x.w === s.week)) { s.pending.push(`tv:${Math.round(x.amt / rateAt(cal(s)))}:${x.tone}`); s.tvWeek += x.amt; }
  s.reserved = s.reserved.filter((x) => x.w !== s.week);
  for (const p of s.pending) { const [, a, tone] = p.split(":"); mineTV += Number(a) * (tone === "positive" ? 0.85 : tone === "contrast" ? 1.05 : 1.3); }
  const attacks = s.pending.filter((p) => p.endsWith("attack")).length;
  const hard = s.pending.filter((p) => !p.endsWith("positive")).length, booked = s.pending.length;
  s.pending = [];
  const medMult = s.staff.media ? 1.25 : 1;
  // The forecast already prices in a normal air war, both campaigns and their outside groups. Your television counts
  // against what a campaign with your money would normally run this week; on the harder levels the other side runs more.
  const expTV = s.weekCash * schedAt(cal(s));
  const toneK = s.mgr === "brawler" && booked ? 1 + 0.15 * hard / booked : 1;
  const myAir = airFx(mineTV * medMult * Math.min(1.15, toneK), c.cost), expMy = airFx(expTV, c.cost);
  const extra = (DIFF[s.diff].opp - 1) * (airFx(opTV, c.cost) + 0.7 * airFx(c.outOp, c.cost));
  // allies: extra outside money you brought in, and a redbox that tells the groups what to say
  const allies = 0.6 * airFx((s.outPlus ?? 0) * 0.08, c.cost) + ((s.redbox ?? 0) > 0 ? 0.2 * airFx(c.outMe, c.cost) : 0);
  let air = (myAir - expMy - extra + allies) * att(s) * modProd(s, "tv");
  if (attacks && !s.staff.oppo && rand(s) < (s.mgr === "brawler" ? 0.15 : 0.3)) { const back = -0.12 * attacks * DIFF[s.diff].neg; air += back; s.log.push({ w: s.week, kind: "air", t: "Your attack ad drew a fact check that says it stretches the record. Independents noticed.", fx: back }); }
  s.adStock = s.adStock * 0.55 + air * 0.75; s.perm += air * 0.25;
  s.log.push({ w: s.week, kind: "air", t: `Air war this week: ${usd(s.tvWeek)} of your television against about ${usd(opTV)} from ${c.op.name}; outside groups spent about ${usd(c.outMe + (s.outPlus ?? 0) * 0.08)} for you and ${usd(c.outOp)} for ${c.op.name}.${(s.redbox ?? 0) > 0 ? " Your redbox kept your allies on message." : ""}${cal(s) <= 0 ? " It is summer: fewer voters are watching." : ""}`, fx: air });
  if ((s.redbox ?? 0) > 0) s.redbox = (s.redbox ?? 0) - 1;
  // field: offices and the turnout program
  const fm = s.staff.field ? 1.4 : 1;
  for (const f of s.offices) { const i = ci(r, f); if (i < 0) continue; const meV = s.side === "R" ? r.counties[i][4] : r.counties[i][3]; s.xme[i] += meV * 0.004 * fm * (cal(s) >= EARLY_FROM ? 1.5 : cal(s) <= 0 ? 0.4 : 1); }
  fieldWeek(c, s);
  for (const l of rivalWeek(c, s)) s.log.push(l);
  if (s.gotv > 0) {
    const g = Math.min(1, s.gotv / (c.total * 1.2));
    const baseIdx = r.counties.map((_, i) => i).filter((i) => c.base[i] > 0);
    for (const i of baseIdx) { const meV = s.side === "R" ? r.counties[i][4] : r.counties[i][3]; s.xme[i] += meV * 0.02 * g * fm; }
    if (cal(s) >= EARLY_FROM) s.banked = Math.min(1, s.banked + 0.12 * g * fm + s.offices.length * 0.01);
    s.gotv = 0;
  }
  // the national environment, and the fundraising that follows the polls
  // The forecast is the race as it stands, summer included, so a summer week only has to balance the other side's summer
  // stops; a fall week has to beat a normal campaign week.
  s.nat += DIFF[s.diff].drift * (8 / lenOf(s)) + (cal(s) <= 0 ? 0.05 : -NORMAL_WEEK);
  const inc = Math.round(c.weekly * 0.55 * DIFF[s.diff].fund * (1 + 0.3 * s.momentum) * (s.jfc ? 1.15 : 1) * modProd(s, "fund"));
  // the world: storms, shutdowns and market drops push the race for as long as they last
  for (const m of activeMods(s)) {
    if (m.nat) s.nat += m.nat;
    if (m.enth) { s.enth[0] = clamp(s.enth[0] + m.enth[0], 0, 100); s.enth[1] = clamp(s.enth[1] + m.enth[1], 0, 100); }
    if (m.vol) s.volunteers = Math.max(20, s.volunteers + m.vol);
  }
  if (s.staff.oppo) s.dirt = (s.dirt ?? 0) + (s.mgr === "brawler" ? 1.5 : 1);
  s.cash += inc;
  if (s.merch) { const m = Math.round(c.weekly * 0.035 * (0.4 + s.buzz / 60)); s.cash += m; s.raised += m; s.buzz = clamp(s.buzz + 0.6, 0, 100); }
  for (const k of ["media", "field", "digital"] as const) if (s.staff[k]) { s.cash -= STAFF_COST[k].wk; s.spent += STAFF_COST[k].wk; }
  // enthusiasm fades back toward normal; the forecast already expects both bases to be about as fired up as usual
  s.enth[0] = clamp(50 + (s.enth[0] - 50) * 0.82 - 0.9, 0, 100);
  s.enth[1] = clamp(50 + (s.enth[1] - 50) * 0.82 + (DIFF[s.diff].opp - 1) * 3 - 0.9, 0, 100);
  for (const f of s.offices) { const i = ci(r, f); if (i >= 0) groundRead(c, s, i, "Your field office", 4.2); }
  internalPoll(c, s);
  publicPolls(r, s);
  const pa = polledAvg(s); if (pa != null && cal(s) >= 5) s.low = Math.min(s.low, pa);
  const m1 = margin(r, s);
  s.momentum = clamp((m1 - m0) / 0.8, -1, 1);
  s.trend.push({ w: s.week, m: m1 });
  // the hot streak: weeks of gains in a row bring money and volunteers in, a slump scares them off
  const st0 = s.streak ?? 0;
  s.streak = m1 - m0 > 0.05 ? Math.max(0, st0) + 1 : m1 - m0 < -0.05 ? Math.min(0, st0) - 1 : 0;
  if (s.streak >= 3) { const b = Math.round(c.weekly * 0.08 * Math.min(3, s.streak - 2)); s.cash += b; s.raised += b; s.buzz = clamp(s.buzz + 3, 0, 100); s.log.push({ w: s.week, kind: "money", t: `Hot streak, ${s.streak} weeks of gains: donors and volunteers want in. ${usd(b)} more came in unasked.` }); }
  else if (s.streak <= -3) { const b = Math.round(c.weekly * 0.06); s.cash -= b; s.volunteers = Math.max(20, Math.round(s.volunteers * 0.95)); s.log.push({ w: s.week, kind: "money", t: `Slump, ${-s.streak} weeks of slipping: some donors are holding back ${usd(b)} and volunteers are drifting off.` }); }
  // buzz fades toward normal, and volunteers follow offices, buzz and momentum
  const keep = s.mgr === "digital" ? 0.9 : 0.85;
  s.buzz = clamp(s.buzz * keep + 30 * (1 - keep) + 6 * s.momentum, 0, 100);
  s.volunteers = Math.max(20, Math.round(s.volunteers * 0.95 + s.offices.length * 55 * (s.staff.field ? 1.4 : 1) + 40 * s.momentum + s.buzz * 0.8));
  s.weekly.push({ w: s.week, m: m1, cash: s.cash, buzz: Math.round(s.buzz), vol: s.volunteers });
  s.stamina = clamp(s.stamina + 18, 0, 100);
  s.tvWeek = 0; s.digWeek = 0; s.fatigue = 0; s.vfat = 0;
  // a county's memory of your last visit fades: in a long campaign, coming back a month later counts again
  for (const k of Object.keys(s.visits)) s.visits[k] *= 0.85;
  for (const k of Object.keys(s.oppVisits)) s.oppVisits[k] *= 0.85;
  s.week += 1; s.days = DAYS; s.weekCash = Math.max(0, s.cash);
  rivalLookAhead(c, s);
  s.mods = (s.mods ?? []).filter((m) => m.until >= s.week);
  if (s.cash < 0) { s.log.push({ w: s.week - 1, kind: "money", t: "The campaign ended the week in the red; vendors want to be paid before they book more." }); }
  if (s.week > lenOf(s)) electionNight(c, s);
  return s.log.slice(before);
}

// ------------------------------------------------------------- election night
/** States that cannot count mail ballots before Election Day, so mail comes in late on the night. */
const MAIL_LATE = new Set(["PA", "WI"]);
/** Poll closing time in the state's last time zone, as Eastern hours. */
const CLOSE: Record<string, number> = { GA: 19, SC: 19, VT: 19, NH: 20, ME: 20, FL: 20, MI: 21, OH: 19.5, NC: 19.5, PA: 20, TN: 21, AL: 21, MS: 21, IL: 21, OK: 21, TX: 21, KS: 21, NE: 22, SD: 22, MN: 22, WI: 22, IA: 23, LA: 22, AR: 20.5, NM: 22, AZ: 22, CO: 22, NV: 23, NY: 22, OR: 24, WY: 22, AK: 25, HI: 24, RI: 20, MA: 20, MD: 20, CT: 20 };
export const NIGHT_TICKS = 480; // at 1.5 seconds a tick, twelve minutes at normal speed
export const WEATHER = ["Clear and cool", "Rain across the state", "Sunny and mild", "Cold and windy", "Storms in the afternoon"];

export function electionNight(c: Ctx, s: State) {
  const r = c.r;
  const spread = r.est.p10 != null && r.est.p90 != null ? Math.abs(r.est.p90 - r.est.p10) / 2.56 : 4;
  const bank = Math.min(1, s.banked);
  // the polling error is already in the truth; what is left is the night's own chaos, plus late deciders, who break a
  // little toward whoever has the momentum
  const err = gauss(s) * Math.max(1.0, spread * 0.36) * (1 - 0.3 * bank);
  const late = Math.round((gauss(s) * 0.55 + 0.35 * s.momentum) * 100) / 100;
  // Election Day itself: the weather, and lines at the polls in a big county if nobody is watching them
  const wx = Math.floor(rand(s) * WEATHER.length), wet = wx === 1 || wx === 4;
  const wxFx = wet ? -0.35 * (1 - bank) + 0.2 : 0; // rain keeps more of the voters who had not voted yet home
  let lines: string | null = null, linesFx = 0;
  if (!s.lawyers && rand(s) < 0.35) {
    const big = r.counties.map((x, i) => i).filter((i) => c.base[i] > 0).sort((a, b) => r.counties[b][5] - r.counties[a][5])[0];
    if (big != null) { lines = r.counties[big][1]; linesFx = -0.25; }
  }
  const g = globalShift(s) + err + wxFx + linesFx + late;
  let me = 0, op = 0, t = 0;
  const counties = r.counties.map((co, i) => {
    const v = countyVotes(r, s, i, g + gauss(s) * 1.6);
    me += v.me; op += v.op; t += v.t;
    return { f: co[0], m: (100 * (v.me - v.op)) / Math.max(1, v.t), t: Math.round(v.t), vm: v.me, vo: v.op };
  });
  if (!r.counties.length) { const m = c.sign * r.est.margin + g; me = 50 + m / 2; op = 50 - m / 2; t = 100; }
  const order = counties.map((x, i) => ({ f: x.f, k: Math.log(x.t + 10) + rand(s) * 2.2 + (i % 3) * 0.2 })).sort((a, b) => a.k - b.k).map((x) => x.f);
  const m = (100 * (me - op)) / Math.max(1, t);
  // How the count comes in: early and mail ballots, then Election Day, then late mail. Early ballots lean toward the
  // party whose voters cast more of them in the state's real early vote, so the lead can swing during the night.
  const ev = r.earlyVote, mailLate = MAIL_LATE.has(r.st);
  const share = Math.max(0.3, Math.min(0.7, ev?.expectedTotal && ev.expectedEarly ? ev.expectedEarly / ev.expectedTotal : 0.45));
  const delta = (ev as unknown as { delta?: number } | null)?.delta;
  const dr = ev ? (ev.party.d - ev.party.r) * 100 : 8;
  // early ballots this many points more Democratic than the county, from the state's real early vote against expectations
  const skewD = Math.max(-18, Math.min(26, delta != null && isFinite(delta) ? -delta : 4 + dr * 0.7));
  const skew = (c.me.party === "R" ? -1 : 1) * skewD; // in the player's favor
  const batches: [number, number, number, number, number][] = [];
  const T = NIGHT_TICKS;
  const rank = new Map([...counties.keys()].sort((a, b) => counties[a].t - counties[b].t).map((i, k) => [i, k / Math.max(1, counties.length - 1)]));
  const split3 = (n: number) => { const w = Array.from({ length: n }, () => 0.6 + rand(s)); const t = w.reduce((a, b) => a + b, 0); return w.map((x) => x / t); };
  counties.forEach((x, i) => {
    const big = rank.get(i) ?? 0.5; // bigger counties count slower
    const e = Math.max(0.15, Math.min(0.8, share + bank * 0.08 + gauss(s) * 0.05));
    const late = 0.05;
    const tot = x.vm + x.vo;
    const split = (w: number, mm: number) => { const v = tot * w; const meV = v * (0.5 + Math.max(-99, Math.min(99, mm)) / 200); return [meV, v - meV]; };
    const mm = (100 * (x.vm - x.vo)) / Math.max(1, tot);
    let [eMe, eOp] = split(e, mm + skew * (1 - e));
    let [lMe, lOp] = split(late, mm + skew * 0.6);
    if (x.vm - eMe - lMe < 0 || x.vo - eOp - lOp < 0) { [eMe, eOp] = split(e, mm); [lMe, lOp] = split(late, mm); } // a one sided county: no room for a skew
    const dMe = Math.max(0, x.vm - eMe - lMe), dOp = Math.max(0, x.vo - eOp - lOp);
    // when each part comes in, as a share of the night: small counties first, big ones later
    const j = () => rand(s) * 0.05;
    const sz = big * big;
    const tE = mailLate ? 0.3 + sz * 0.42 + j() : 0.01 + sz * 0.14 + j();
    const tD = mailLate ? 0.04 + sz * 0.3 + j() : 0.1 + sz * 0.32 + j();
    const parts = 2 + Math.floor(sz * 4);
    const at = (x: number) => Math.max(1, Math.min(T - 3, Math.round(x * T)));
    const we = split3(parts), wd = split3(parts + 1);
    for (let k = 0; k < parts; k++) batches.push([at(tE + k * 0.03), i, eMe * we[k], eOp * we[k], 0]);
    for (let k = 0; k < parts + 1; k++) batches.push([at(tD + k * (0.03 + sz * 0.03)), i, dMe * wd[k], dOp * wd[k], 1]);
    batches.push([at(0.8 + sz * 0.12 + j()), i, lMe, lOp, 2]);
  });
  batches.sort((a, b) => a[0] - b[0]);
  s.result = { pollAvg: polledAvg(s), late, m, win: m > 0, me: Math.round(me), op: Math.round(op), counties: counties.map(({ f, m: cm, t: ct }) => ({ f, m: cm, t: ct })), order, start: s.trend[0].m, forecast: c.sign * r.est.margin,
    batches: batches.map((b) => [b[0], b[1], Math.round(b[2]), Math.round(b[3]), b[4]] as [number, number, number, number, number]), ticks: T, close: CLOSE[r.st] ?? 20, weather: WEATHER[wx], mailLate, turnout: Math.round(t), lines };
  s.done = true;
}

export function grade(s: State): { letter: string; line: string } {
  if (!s.result) return { letter: "", line: "" };
  const beat = s.result.m - (s.result.forecast + DIFF[s.diff].start);
  const bonus = { safe: -1, lean: 0, tossup: 1, wave: 2 }[s.diff];
  const v = beat + bonus + (s.result.win ? 1 : 0);
  const letter = v >= 5 ? "A+" : v >= 3.5 ? "A" : v >= 2.5 ? "A-" : v >= 1.5 ? "B+" : v >= 0.8 ? "B" : v >= 0 ? "B-" : v >= -1 ? "C" : v >= -2.5 ? "D" : "F";
  const line = beat >= 0.05 ? `You ran ${beat.toFixed(1)} points ahead of where the forecast had your race.` : beat <= -0.05 ? `You ran ${Math.abs(beat).toFixed(1)} points behind where the forecast had your race.` : "You ran exactly even with the forecast.";
  return { letter, line };
}
