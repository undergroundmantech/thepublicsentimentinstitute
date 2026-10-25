// The campaign game's engine: pure functions over a plain state object, so a game saves as JSON and replays the
// same from its seed. Every number the electorate reacts with comes from the race file built from the site's data:
// the forecast sets where the race starts, the county map holds the votes, the voter group estimates decide who
// hears a statement and how they lean, and the money books set what each side can spend.
// Margins are in points from the player's side: positive means the player leads.

export type Side = "D" | "R";
export type Diff = "safe" | "lean" | "tossup" | "wave";
export type Intel = { l: string | null; t: string; u: string | null };
export type Cand = { side: Side; name: string; party: string; inc: boolean; file: string | null; intel: Intel[]; blocs: string[];
  money: { receipts: number | null; cash: number | null; outside_for: number | null; spent: number | null; google_ads: number | null; as_of: string | null }; health: number | null };
export type CountyRow = [string, string, number, number, number, number, number | null]; // fips, name, margin R minus D, D, R, total, 2024 pres margin
export type GroupRow = [string, string, number, number, number, number]; // dimension, label, share, D, R, other
export type RaceFile = {
  id: string; office: "senate" | "governor"; st: string; state: string; name: string; open: boolean | null; pvi: number | null; pres24: number | null;
  est: { margin: number; prob: number; p10: number | null; p90: number | null }; pollAvg: number | null; votes: { dem: number; rep: number; other: number; total: number } | null;
  polls: { pollster: string; kind: string; age: number; n: number; margin: number }[]; cands: [Cand, Cand]; third: { name: string; party: string; pct: number }[];
  groups: GroupRow[]; counties: CountyRow[]; outside: { total: number | null; groups: { name: string; side: string; kind: string; target: string; amount: number }[] };
  earlyVote: { ballots: number; party: { d: number; r: number; o: number }; estimatedShare: number; date: string } | null;
  news: { id: string; title: string; dek: string; date: string }[]; media: { who: string; what: string; when: string; lean: string }[];
};

export const DIFF: Record<Diff, { name: string; blurb: string; start: number; opp: number; fund: number; neg: number; drift: number; noise: number }> = {
  safe: { name: "Safe Seat", blurb: "A friendly year. You start two points better than the forecast, donors give more and the other side is slower.", start: 2, opp: 0.8, fund: 1.25, neg: 0.8, drift: 0, noise: 0.8 },
  lean: { name: "Lean", blurb: "The race exactly as the On Point forecast has it today. Both campaigns play it straight.", start: 0, opp: 1, fund: 1, neg: 1, drift: 0, noise: 1 },
  tossup: { name: "Toss Up", blurb: "You start two points behind the forecast, the other side spends sharper and bad news hits harder.", start: -2, opp: 1.15, fund: 0.92, neg: 1.2, drift: 0, noise: 1.1 },
  wave: { name: "Wave Against You", blurb: "A national wave runs against your party all fall. Down three and a half, sliding each week, outspent and outworked.", start: -3.5, opp: 1.3, fund: 0.82, neg: 1.35, drift: -0.12, noise: 1.25 },
};

export const WEEKS = 8;
export const DAYS = 6;
const WEEK0 = Date.UTC(2026, 8, 8); // Tuesday after Labor Day
export const weekLabel = (w: number) => {
  const a = new Date(WEEK0 + (w - 1) * 7 * 864e5), b = new Date(WEEK0 + ((w - 1) * 7 + 6) * 864e5);
  const f = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(a)} to ${f(b)}`;
};
export const DEBATE_WEEK = 6;
export const EARLY_FROM = 5;

export type Staff = { pollster: 0 | 1 | 2 | 3; media: boolean; field: boolean; oppo: boolean; digital: boolean };
export const POLLSTERS = [null, { name: "C rated pollster", sd: 3.4, wk: 18000 }, { name: "B rated pollster", sd: 2.2, wk: 38000 }, { name: "A rated pollster", sd: 1.2, wk: 70000 }] as const;
export const STAFF_COST = { media: { hire: 150000, wk: 25000, name: "Media consultant", what: "Television and radio go 25 percent further." },
  field: { hire: 80000, wk: 22000, name: "Field director", what: "Field offices and get out the vote go 40 percent further, and you can open more than three offices." },
  oppo: { hire: 120000, wk: 0, name: "Opposition research firm", what: "Turns the other side's record into ads and debate lines, and attacks stop backfiring." },
  digital: { hire: 60000, wk: 15000, name: "Digital director", what: "Online fundraising and targeted digital ads go further." } };

export type Opt = { label: string; say: string; st?: Stance; cash?: number; days?: number; need?: "oppo"; kind?: "respond" | "ignore" | "clarify" | "counter" | "hit" | "hold" | "accept" | "decline" | "skip" };
export type Ev = { id: string; kind: "issue" | "news" | "attack" | "opening" | "surrogate" | "debate"; title: string; prompt: string; src?: string | null; opts: Opt[]; states?: string[]; sal?: number };
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
};
export type Result = { m: number; win: boolean; me: number; op: number; counties: { f: string; m: number; t: number }[]; order: string[]; start: number; forecast: number };

// ------------------------------------------------------------- randomness
export function rand(s: State) { // mulberry32 kept in the state
  let t = (s.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const gauss = (s: State) => { const u = Math.max(1e-9, rand(s)), v = rand(s); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
export const usd = (n: number) => (Math.abs(n) >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
export const lead = (m: number, me: string, op: string) => (Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${me} +${m.toFixed(1)}` : `${op} +${Math.abs(m).toFixed(1)}`);

// ------------------------------------------------------------- the race seen from the player's chair
export type Ctx = {
  r: RaceFile; side: Side; me: Cand; op: Cand; sign: number; // sign turns R minus D into the player's favor
  total: number; cost: number; base: number[]; // base[c] player margin in county c
  groups: { dim: string; label: string; share: number; L: number; d: number; r: number }[];
  g: (label: string, dim?: string) => { dim: string; label: string; share: number; L: number; d: number; r: number } | undefined;
  approve: number; costsHard: number; small: number; weekly: number; oppWeekly: number; outMe: number; outOp: number;
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
  };
}

export function newGame(r: RaceFile, side: Side, diff: Diff, seed = Math.floor(Math.random() * 1e9)): State {
  const c = ctx(r, side);
  const cash0 = (c.me.money.cash || (c.me.money.receipts || c.total * 5) * 0.3) * 0.85;
  const opCash0 = (c.op.money.cash || (c.op.money.receipts || c.total * 5) * 0.3) * 0.85;
  const n = r.counties.length;
  const s: State = {
    v: 1, race: r.id, side, diff, seed, rng: seed, week: 1, days: DAYS, cash: Math.round(cash0), oppCash: Math.round(opCash0), stamina: 100, momentum: 0, fatigue: 0,
    pers: Array(n).fill(0), xme: Array(n).fill(0), xop: Array(n).fill(0), glob: 0, adStock: 0, perm: 0, nat: DIFF[diff].start,
    ledger: {}, visits: {}, oppVisits: {}, offices: [], staff: { pollster: 0, media: false, field: false, oppo: false, digital: false },
    tvWeek: 0, digWeek: 0, weekCash: Math.round(cash0), prep: 0, banked: 0, gotv: 0, spent: 0, raised: 0, pending: [], used: [], resolved: [], polls: [], log: [], trend: [], done: false, cur: [], evw: 0,
  };
  s.trend.push({ w: 0, m: margin(r, s) });
  publicPolls(r, s, true);
  return s;
}

// ------------------------------------------------------------- where the race stands
export function countyVotes(r: RaceFile, s: State, i: number, glob: number) {
  const c = r.counties[i], sign = s.side === "R" ? 1 : -1;
  const meV0 = sign > 0 ? c[4] : c[3], opV0 = sign > 0 ? c[3] : c[4];
  const shift = ((s.pers[i] + glob) / 200) * c[5];
  const me = Math.max(0, meV0 + shift + s.xme[i]), op = Math.max(0, opV0 - shift + s.xop[i]);
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
  const amp = st.tone === "fiery" ? 1.3 : 1;
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
export type ActResult = { ok: boolean; t: string; fx?: number; parts?: Part[] };
const gaffes = ["mixed up two county names at a rally", "misstated the state's unemployment rate in an interview", "was caught on a hot mic calling a reporter's question dumb", "flubbed the name of a local high school team", "said the wrong date for early voting in a radio spot, and the campaign had to correct it"];
function tire(c: Ctx, s: State, cost: number): ActResult | null {
  s.stamina = clamp(s.stamina - cost, 0, 100);
  if (s.stamina < 28 && rand(s) < 0.16 + (28 - s.stamina) / 120) {
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
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  if (s.cash < 35000) return { ok: false, t: "Not enough cash for a rally." };
  const i = ci(c.r, f); if (i < 0) return { ok: false, t: "Unknown county." };
  const co = c.r.counties[i], pm = c.base[i] + s.pers[i], e = dim(s.visits[f] ?? 0) * (0.75 + s.stamina / 400);
  s.days -= 1; s.cash -= 35000; s.spent += 35000; s.visits[f] = (s.visits[f] ?? 0) + 1;
  let t: string;
  if (pm >= 8) { const meV = s.side === "R" ? co[4] : co[3]; const add = meV * 0.008 * e * (s.week >= EARLY_FROM ? 1.3 : 1); s.xme[i] += add; s.pers[i] += 0.3 * e; const fire = 0.1 * e; s.glob += fire; s.ledger["Your base"] = (s.ledger["Your base"] ?? 0) + fire; t = `Rally in ${co[1]}, your country: about ${Math.round(add).toLocaleString()} more of your voters there fired up to turn out, and your base statewide saw it.`; }
  else if (pm > -8) { s.pers[i] += 2.6 * e; t = `Rally in ${co[1]}, a battleground: about ${(2.6 * e).toFixed(1)} points of persuasion there.`; }
  else { s.pers[i] += 1.7 * e; t = `Rally in ${co[1]}, the other side's turf: ${(1.7 * e).toFixed(1)} points there, and a story about reaching every voter.`; }
  const media = 0.06 * e * Math.pow(co[5] / c.total * 10, 0.35);
  s.glob += media; s.ledger["Local news viewers"] = (s.ledger["Local news viewers"] ?? 0) + media;
  const fx = (co[5] / c.total) * (pm >= 8 ? 0 : (pm > -8 ? 2.6 : 1.7) * e) + media;
  s.log.push({ w: s.week, kind: "you", t, fx });
  return tire(c, s, 13) ?? { ok: true, t, fx };
}

export function townHall(c: Ctx, s: State, f: string): ActResult {
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  if (s.cash < 12000) return { ok: false, t: "Not enough cash." };
  const i = ci(c.r, f); if (i < 0) return { ok: false, t: "Unknown county." };
  const co = c.r.counties[i], e = dim(s.visits[f] ?? 0);
  s.days -= 1; s.cash -= 12000; s.spent += 12000; s.visits[f] = (s.visits[f] ?? 0) + 1;
  s.pers[i] += 1.4 * e;
  const ind = c.g("Independent", "Party ID")?.share ?? 30;
  let fx = (ind / 100) * 0.4 * e;
  let t = `Town hall in ${co[1]}: an hour of questions from undecided voters.`;
  if (rand(s) < 0.15) { const good = rand(s) < 0.55; const k = (good ? 1 : -1.2) * (0.1 + rand(s) * 0.15); fx += k; t += good ? " A tough exchange with a heckler went viral the good way." : " A testy answer to a voter became the clip of the day."; }
  applyGlobal(s, fx, [{ label: "Independents", share: ind, lean: 0, fx }], 0.7);
  s.log.push({ w: s.week, kind: "you", t, fx });
  return tire(c, s, 9) ?? { ok: true, t, fx };
}

export function fundraise(c: Ctx, s: State, kind: "call" | "donors" | "email"): ActResult {
  const fm = DIFF[s.diff].fund * (1 + 0.3 * s.momentum);
  if (kind === "email") {
    if (s.fatigue >= 3) return { ok: false, t: "Your list is tapped out this week. Try again next week." };
    const amt = Math.round(c.weekly * 0.22 * fm * (s.staff.digital ? 1.6 : 1) * Math.pow(0.7, s.fatigue));
    s.fatigue += 1; s.cash += amt; s.raised += amt;
    const t = `An email and text blast to small donors brought in ${usd(amt)}.`; s.log.push({ w: s.week, kind: "money", t }); return { ok: true, t };
  }
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  s.days -= 1;
  if (kind === "call") {
    const amt = Math.round(c.weekly * 0.38 * fm);
    s.cash += amt; s.raised += amt; const t = `A day of call time: ${usd(amt)} raised.`; s.log.push({ w: s.week, kind: "money", t });
    return tire(c, s, 6) ?? { ok: true, t };
  }
  const amt = Math.round(c.weekly * 0.85 * fm);
  s.cash += amt; s.raised += amt;
  let t = `A big dollar fundraiser: ${usd(amt)} raised.`;
  if (c.costsHard > 50 && rand(s) < 0.22) {
    const fx = -0.15 * DIFF[s.diff].neg;
    applyGlobal(s, fx, [{ label: "Voters who find daily costs hard to afford", share: c.costsHard, lean: 0, fx }], 0.6);
    t += ` A photo from the event drew an out of touch story; ${Math.round(c.costsHard)} percent of voters here say daily costs are hard to afford.`;
    s.log.push({ w: s.week, kind: "money", t, fx }); return tire(c, s, 10) ?? { ok: true, t, fx };
  }
  s.log.push({ w: s.week, kind: "money", t });
  return tire(c, s, 10) ?? { ok: true, t };
}

export function media(c: Ctx, s: State): ActResult {
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  s.days -= 1;
  const fx = 0.05 + rand(s) * 0.05;
  applyGlobal(s, fx, [{ label: "Local news viewers", share: 60, lean: 0, fx }], 0.5);
  const t = "A media tour: local TV, talk radio and two podcasts."; s.log.push({ w: s.week, kind: "you", t, fx });
  return tire(c, s, 8) ?? { ok: true, t, fx };
}
export function rest(s: State): ActResult {
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  s.days -= 1; s.stamina = clamp(s.stamina + 32, 0, 100);
  return { ok: true, t: "A day off the trail. The candidate sleeps in and calls home." };
}
export function debatePrep(c: Ctx, s: State): ActResult {
  if (s.days < 1) return { ok: false, t: "No days left this week." };
  if (s.week > DEBATE_WEEK) return { ok: false, t: "The debate is over." };
  s.days -= 1; s.prep += 1;
  const t = `Debate prep with a stand in for ${c.op.name}.`; s.log.push({ w: s.week, kind: "you", t });
  return tire(c, s, 5) ?? { ok: true, t };
}

/** How much of its cash a normal campaign puts on television each week, rising to the end. */
export const SCHED = [0.07, 0.08, 0.09, 0.1, 0.12, 0.15, 0.2, 0.35];
/** What a normal week on the trail is worth; the forecast assumes you do at least this much. */
export const NORMAL_WEEK = 0.13;
export const airFx = (spend: number, cost: number) => 0.45 * Math.log(1 + Math.max(0, spend) / cost);
export function buyTV(c: Ctx, s: State, amt: number, tone: "positive" | "contrast" | "attack"): ActResult {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  s.cash -= amt; s.spent += amt; s.tvWeek += amt;
  const pending = `tv:${amt}:${tone}`;
  s.pending.push(pending);
  const t = `${usd(amt)} of ${tone} television booked for this week across ${c.r.state}.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}
export function buyDigital(c: Ctx, s: State, amt: number, label: string): ActResult {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const g = c.groups.find((x) => x.label === label); if (!g) return { ok: false, t: "Unknown group." };
  s.cash -= amt; s.spent += amt; s.digWeek += amt;
  const per = 0.3 + 0.7 * (1 - Math.abs(g.L));
  const fx = (g.share / 100) * 3.2 * Math.log(1 + amt / (c.total * 0.18)) * per * (s.staff.digital ? 1.2 : 1) * (s.staff.media ? 1.1 : 1);
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
  if (s.staff[who]) return { ok: false, t: "Already on staff." };
  if (s.cash < x.hire) return { ok: false, t: "Not enough cash." };
  s.cash -= x.hire; s.spent += x.hire; s.staff[who] = true;
  const t = `Hired a ${x.name.toLowerCase()}.`; s.log.push({ w: s.week, kind: "you", t });
  return { ok: true, t };
}

// ------------------------------------------------------------- polls
function publicPolls(r: RaceFile, s: State, first = false) {
  const truth = margin(r, s), sign = s.side === "R" ? 1 : -1;
  if (first) {
    for (const p of r.polls.slice(0, 4)) s.polls.push({ w: 0, src: p.pollster, m: sign * p.margin + DIFF[s.diff].start, n: p.n, internal: false });
    return;
  }
  const chance = Math.min(0.92, 0.35 + r.polls.length / 16 + (s.week >= 6 ? 0.2 : 0));
  if (rand(s) < chance) {
    const p = r.polls[Math.floor(rand(s) * Math.max(1, r.polls.length))];
    const house = ((p?.pollster.length ?? 7) % 5 - 2) * 0.6 * (p?.pollster.includes("(R)") ? sign : p?.pollster.includes("(D)") ? -sign : 1);
    s.polls.push({ w: s.week, src: p?.pollster ?? "Local university poll", m: truth + house + gauss(s) * 3 * DIFF[s.diff].noise, n: p?.n || 600, internal: false });
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
  s.polls.push({ w: s.week, src: `Your ${tier.name}`, m: truth + gauss(s) * tier.sd, n: 800, internal: true, groups });
}

// ------------------------------------------------------------- the other campaign
function opponentWeek(c: Ctx, s: State) {
  // The forecast already expects the other side to campaign normally, so only what they do beyond that moves the race:
  // nothing on Lean, more on the harder levels. Their stops still show up in your briefing.
  const k = DIFF[s.diff].opp - 1 + 0.15, r = c.r;
  const idx = r.counties.map((_, i) => i);
  const opBase = idx.filter((i) => c.base[i] <= -8).sort((a, b) => r.counties[b][5] - r.counties[a][5]).slice(0, 6);
  const swing = idx.filter((i) => Math.abs(c.base[i]) < 8).sort((a, b) => r.counties[b][5] - r.counties[a][5]).slice(0, 6);
  const stops: string[] = [];
  const go = (i: number, base: boolean) => {
    const f = r.counties[i][0], e = dim(s.oppVisits[f] ?? 0) * k;
    s.oppVisits[f] = (s.oppVisits[f] ?? 0) + 1;
    if (base) { s.xop[i] += (s.side === "R" ? r.counties[i][3] : r.counties[i][4]) * 0.008 * e; s.glob -= 0.1 * e; }
    else s.pers[i] -= 2.6 * e;
    s.glob -= 0.06 * e;
    stops.push(r.counties[i][1]);
  };
  for (let j = 0; j < 2; j++) { if (opBase.length) go(opBase[Math.floor(rand(s) * opBase.length)], true); if (swing.length) go(swing[Math.floor(rand(s) * swing.length)], false); }
  // money in, money out
  s.oppCash += c.oppWeekly * (2 - DIFF[s.diff].fund);
  const rate = SCHED[s.week - 1] ?? 0.2;
  const opTV = s.oppCash * rate * 0.8;
  s.oppCash -= opTV / 0.8;
  if (s.week >= 4) for (const i of opBase.slice(0, 4)) s.xop[i] += (s.side === "R" ? r.counties[i][3] : r.counties[i][4]) * 0.003 * Math.max(0, k);
  if (stops.length) s.log.push({ w: s.week, kind: "opp", t: `${c.op.name} campaigned in ${[...new Set(stops)].join(", ")}.` });
  return opTV;
}

// ------------------------------------------------------------- end of the week
export function endWeek(c: Ctx, s: State): LogItem[] {
  const before = s.log.length, r = c.r;
  const m0 = margin(r, s);
  // the air war: your television, theirs, and the outside groups, against what the forecast already expects both sides to spend
  const opTV = opponentWeek(c, s);
  let mineTV = 0;
  for (const p of s.pending) { const [, a, tone] = p.split(":"); mineTV += Number(a) * (tone === "positive" ? 0.85 : tone === "contrast" ? 1.05 : 1.3); }
  const attacks = s.pending.filter((p) => p.endsWith("attack")).length;
  s.pending = [];
  const medMult = s.staff.media ? 1.25 : 1;
  // The forecast already prices in a normal air war, both campaigns and their outside groups. Your television counts
  // against what a campaign with your money would normally run this week; on the harder levels the other side runs more.
  const expTV = s.weekCash * SCHED[s.week - 1];
  const myAir = airFx(mineTV * medMult, c.cost), expMy = airFx(expTV, c.cost);
  const extra = (DIFF[s.diff].opp - 1) * (airFx(opTV, c.cost) + 0.7 * airFx(c.outOp, c.cost));
  let air = myAir - expMy - extra;
  if (attacks && !s.staff.oppo && rand(s) < 0.3) { const back = -0.12 * attacks * DIFF[s.diff].neg; air += back; s.log.push({ w: s.week, kind: "air", t: "Your attack ad drew a fact check that says it stretches the record. Independents noticed.", fx: back }); }
  s.adStock = s.adStock * 0.55 + air * 0.75; s.perm += air * 0.25;
  s.log.push({ w: s.week, kind: "air", t: `Air war this week: ${usd(s.tvWeek)} of your television against about ${usd(opTV)} from ${c.op.name}; outside groups spent about ${usd(c.outMe)} for you and ${usd(c.outOp)} for ${c.op.name}.`, fx: air });
  // field: offices and the turnout program
  const fm = s.staff.field ? 1.4 : 1;
  for (const f of s.offices) { const i = ci(r, f); if (i < 0) continue; const meV = s.side === "R" ? r.counties[i][4] : r.counties[i][3]; s.xme[i] += meV * 0.004 * fm * (s.week >= EARLY_FROM ? 1.5 : 1); }
  if (s.gotv > 0) {
    const g = Math.min(1, s.gotv / (c.total * 1.2));
    const baseIdx = r.counties.map((_, i) => i).filter((i) => c.base[i] > 0);
    for (const i of baseIdx) { const meV = s.side === "R" ? r.counties[i][4] : r.counties[i][3]; s.xme[i] += meV * 0.02 * g * fm; }
    if (s.week >= EARLY_FROM) s.banked = Math.min(1, s.banked + 0.12 * g * fm + s.offices.length * 0.01);
    s.gotv = 0;
  }
  // the national environment, and the fundraising that follows the polls
  s.nat += DIFF[s.diff].drift - NORMAL_WEEK;
  s.cash += Math.round(c.weekly * 0.55 * DIFF[s.diff].fund * (1 + 0.3 * s.momentum));
  for (const k of ["media", "field", "digital"] as const) if (s.staff[k]) { s.cash -= STAFF_COST[k].wk; s.spent += STAFF_COST[k].wk; }
  internalPoll(c, s);
  publicPolls(r, s);
  const m1 = margin(r, s);
  s.momentum = clamp((m1 - m0) / 0.8, -1, 1);
  s.trend.push({ w: s.week, m: m1 });
  s.stamina = clamp(s.stamina + 18, 0, 100);
  s.tvWeek = 0; s.digWeek = 0; s.fatigue = 0;
  s.week += 1; s.days = DAYS; s.weekCash = Math.max(0, s.cash);
  if (s.cash < 0) { s.log.push({ w: s.week - 1, kind: "money", t: "The campaign ended the week in the red; vendors want to be paid before they book more." }); }
  if (s.week > WEEKS) electionNight(c, s);
  return s.log.slice(before);
}

// ------------------------------------------------------------- election night
export function electionNight(c: Ctx, s: State) {
  const r = c.r;
  const spread = r.est.p10 != null && r.est.p90 != null ? Math.abs(r.est.p90 - r.est.p10) / 2.56 : 4;
  const err = gauss(s) * Math.max(1.4, spread * 0.55) * (1 - 0.3 * s.banked);
  const g = globalShift(s) + err;
  let me = 0, op = 0, t = 0;
  const counties = r.counties.map((co, i) => {
    const v = countyVotes(r, s, i, g + gauss(s) * 1.6);
    me += v.me; op += v.op; t += v.t;
    return { f: co[0], m: (100 * (v.me - v.op)) / Math.max(1, v.t), t: Math.round(v.t) };
  });
  if (!r.counties.length) { const m = c.sign * r.est.margin + g; me = 50 + m / 2; op = 50 - m / 2; t = 100; }
  // small and rural places report first, the big cities and their mail ballots last
  const order = counties.map((x, i) => ({ f: x.f, k: Math.log(x.t + 10) + rand(s) * 2.2 + (i % 3) * 0.2 })).sort((a, b) => a.k - b.k).map((x) => x.f);
  const m = (100 * (me - op)) / Math.max(1, t);
  s.result = { m, win: m > 0, me: Math.round(me), op: Math.round(op), counties, order, start: s.trend[0].m, forecast: c.sign * r.est.margin };
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
