// The rival war room: the other campaign as a real opponent that reads the race and picks a plan every week.
//
// How strong the rival is comes from the race itself, not the menu: an incumbent, a money edge from the FEC books, outside
// groups on their side and their own odds in the On Point forecast all make a sharper rival, one that more often picks the
// plan that hurts you most and hits harder when it lands.
//
// Each week the rival plays one plan: an air blitz, going negative, a turf war over the region you have been winning, a
// turnout surge, a money sprint for next week, a late October surprise, or coasting when far ahead. Every plan can be
// countered by what you do that same week: matching their television, a media consultant and opposition research when they
// go negative, showing up in the region they target, knocking doors when they push turnout. The forecast already prices in
// a normal campaign, so a plan you meet halfway costs nothing; one you ignore costs you, one you beat pays off.
// With opposition research on staff you see their next plan a week ahead.
import type { Ctx, Ev, State, Part, LogItem } from "./engine";
import { DIFF, att, cal, lenOf, schedAt, regionsOf, usd, polledAvg, applyGlobal, rand, EARLY_FROM } from "./engine";

export type Plan = "air" | "negative" | "turf" | "turnout" | "money" | "surprise" | "coast";
export type RivalMove = { w: number; plan: Plan; fx: number; q: number; t: string; taunt: string; region?: string };
export type Rival = { skill: number; stars: number; arche: string; why: string[]; plan: Plan; next: Plan; region: number; nextRegion: number;
  v0: Record<string, number>; neg: number; bank: number; moves: RivalMove[]; countered: number };

export const PLAN: Record<Plan, { name: string; tell: string; counter: string }> = {
  air: { name: "Air blitz", tell: "They bought a wall of television this week.", counter: "Match them on the air: run at least a normal week of TV, more if you can." },
  negative: { name: "Going negative", tell: "Their ad makers are cutting attack spots on you.", counter: "A media consultant and opposition research blunt it; answer the ad when it lands." },
  turf: { name: "Turf war", tell: "They are moving into the region you have been winning.", counter: "Hold your ground: two stops in that region, or an office there." },
  turnout: { name: "Turnout surge", tell: "Their field program is flooding their base with door knockers.", counter: "Knock doors yourself: crews, canvassing and a turnout push." },
  money: { name: "Money sprint", tell: "Their candidate is locked in call time and donor dinners.", counter: "Nothing to stop today, but next week they spend it all on the air." },
  surprise: { name: "October surprise", tell: "Their oppo shop has been sitting on a story about you.", counter: "Have a rapid response budget ready and keep your stamina up." },
  coast: { name: "Running out the clock", tell: "Far ahead, they are taking it easy.", counter: "Make them pay for it: this is your week to gain ground." },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const lg2 = (x: number) => Math.log(Math.max(1e-6, x)) / Math.log(2);
const sur = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];

/** The rival's strength from the real race: incumbency, money, outside groups and their forecast odds. */
export function rivalProfile(c: Ctx): Pick<Rival, "skill" | "stars" | "arche" | "why"> {
  const op = c.op, me = c.me, why: string[] = [];
  const money = (c.oppWeekly || 1) / Math.max(1, c.weekly || 1);
  const outside = (c.outOp + 1e5) / (c.outMe + 1e5);
  const pR = c.r.est.prob; // the Republican's chance in the forecast
  const pOp = c.side === "D" ? pR : 1 - pR;
  const self = op.worth?.self ?? 0;
  let k = 1 + (op.inc ? 0.12 : 0) + 0.12 * clamp(lg2(money), -1.5, 1.5) + 0.06 * clamp(lg2(outside), -1.5, 1.5) + 0.3 * (pOp - 0.5);
  k = clamp(k, 0.75, 1.45);
  const stars = clamp(Math.round(((k - 0.75) / 0.7) * 4) + 1, 1, 5);
  if (op.inc) why.push("Incumbent, with a record and a network");
  if (op.money.receipts && me.money.receipts) why.push(`Raised ${usd(op.money.receipts)} to your ${usd(me.money.receipts)}`);
  if (c.outOp > 0 || c.outMe > 0) why.push(`Outside groups ${outside >= 1.2 ? "lean their way" : outside <= 0.83 ? "lean your way" : "about even"}`);
  why.push(`The On Point forecast gives them ${Math.round(pOp * 100)}%`);
  if (self > 1e6) why.push(`Self funding ${usd(self)}`);
  const arche = op.inc && money >= 1.3 ? "The Machine" : self > 5e6 ? "The Self Funder" : money >= 1.6 ? "The Money Cannon" : op.inc ? "The Incumbent"
    : pOp >= 0.65 ? "The Front Runner" : pOp <= 0.35 ? "The Scrappy Underdog" : "The Street Fighter";
  return { skill: Math.round(k * 100) / 100, stars, arche, why };
}

export function initRival(c: Ctx, s: State) {
  if (s.rival) return;
  const p = rivalProfile(c);
  s.rival = { ...p, plan: "money", next: "money", region: -1, nextRegion: -1, v0: { ...s.visits }, neg: 0, bank: 0, moves: [], countered: 0 };
  s.rival.plan = choose(c, s); s.rival.region = pickRegion(c, s);
  s.rival.next = choose(c, s, 1); s.rival.nextRegion = pickRegion(c, s);
}

/** The region you have gained most in: your persuasion there, by its share of the vote. */
function pickRegion(c: Ctx, s: State) {
  const regs = regionsOf(c.r); if (!regs.length) return -1;
  let best = -1, bv = -Infinity;
  regs.forEach((g, k) => {
    let v = 0; for (const f of g.f) { const i = c.r.counties.findIndex((x) => x[0] === f); if (i >= 0) v += s.pers[i] * c.r.counties[i][5]; }
    v += (rand(s) - 0.5) * c.total * 0.2;
    if (v > bv) { bv = v; best = k; }
  });
  return best;
}

/** The plan for a week, ahead (0 this week, 1 next). A sharper rival more often plays the plan that fits the race best. */
function choose(c: Ctx, s: State, ahead = 0): Plan {
  const R = s.rival!; const k = cal(s, s.week + ahead), left = lenOf(s) - s.week - ahead;
  const m = polledAvg(s) ?? 0; // your lead as the polls show it; the rival reads the same polls
  const cashR = s.oppCash / Math.max(1, s.cash);
  if (R.bank > 0 && ahead === 0) return "air";
  const w: Record<Plan, number> = {
    air: 1 + (cashR > 1.2 ? 1.5 : 0) + (k >= 5 ? 1 : 0),
    negative: R.neg >= 3 || k <= 0 ? 0 : 0.8 + (m > 1 ? 1.6 : 0) + (m > 4 ? 1 : 0) + (left <= 3 && m > 0 ? 1 : 0),
    turf: 1 + (Object.values(s.visits).reduce((a, b) => a + b, 0) > 6 ? 0.8 : 0),
    turnout: 0.6 + (k >= EARLY_FROM ? 1.5 : 0) + (m < 0 ? 0.8 : 0),
    money: k <= 0 ? 2.2 : 0.8 + (cashR < 0.7 ? 1.4 : 0) - (left <= 2 ? 0.8 : 0),
    surprise: !s.used.includes("osurprise") && !s.rival?.moves.some((x) => x.plan === "surprise") && k >= 6 && k <= 7 && m > -2 ? 2.5 + (m > 2 ? 1.5 : 0) : 0,
    coast: m < -6 ? 1.8 : m < -3 ? 0.4 : 0,
  };
  // a war room mixes it up: the plan it just ran, and the one before, lose some of their pull
  const last = R.moves.slice(-2).map((x) => x.plan);
  if (ahead === 1) last.push(R.plan);
  for (const [j, p] of last.reverse().entries()) if (p !== "surprise") w[p] *= j === 0 ? 0.35 : 0.65;
  const plans = (Object.keys(w) as Plan[]).filter((p) => w[p] > 0);
  const best = plans.reduce((a, b) => (w[b] > w[a] ? b : a), plans[0]);
  if (rand(s) < clamp(R.skill - 0.55, 0.15, 0.85)) return best;
  let x = rand(s) * plans.reduce((a, p) => a + w[p], 0);
  for (const p of plans) { x -= w[p]; if (x <= 0) return p; }
  return best;
}

const TAUNT: Record<Plan, string[]> = {
  air: ["Hope you like seeing my face on every channel.", "We bought the whole fall. Good luck finding airtime.", "Turn on the TV. That's me. All week."],
  negative: ["Voters deserve to know the truth about you.", "Nothing personal. Just your record.", "We found the tape."],
  turf: ["Nice region you have there. Shame if someone flipped it.", "I'll be in your backyard all week.", "Your strongholds aren't as strong as you think."],
  turnout: ["Our doors get knocked. Do yours?", "We have more volunteers than you have voters.", "Every one of our voters is getting a ride to the polls."],
  money: ["Busy dialing. Talk later.", "The checks are clearing. See you on TV next week.", "Our donors just maxed out. Again."],
  surprise: ["Saved the best for last.", "Remember that thing you hoped nobody found?", "Check the news tonight."],
  coast: ["Wake me up on election night.", "I'll be at the lake. The polls say it's over.", "Not worried. Not even a little."],
};

/** The rival's week, before the week ends: how well you countered, what it did, and next week's plan. */
export function rivalWeek(c: Ctx, s: State): LogItem[] {
  initRival(c, s);
  const R = s.rival!, plan = R.plan, out: LogItem[] = [];
  const D = DIFF[s.diff];
  const M = 0.22 * R.skill * D.opp * att(s);
  const hard = (D.opp - 1) * 0.3 + (R.skill - 1) * 0.25;   // a sharper rival takes more to counter
  const opName = c.op.name, them = sur(opName);
  const expTV = Math.max(1, s.weekCash * schedAt(cal(s)));
  const visitsHere = (fs: string[]) => fs.reduce((a, f) => a + Math.max(0, (s.visits[f] ?? 0) - (R.v0[f] ?? 0)), 0);
  const regs = regionsOf(c.r);
  let q = 0.55, sev = 1, t = "", region: string | undefined;
  const parts: Part[] = [];
  if (plan === "air") {
    sev = R.bank > 0 ? 1.4 : 1;
    q = clamp(s.tvWeek / (expTV * 1.4), 0, 1) * 0.9 + (s.staff.media ? 0.1 : 0);
    t = R.bank > 0 ? `${opName} spent the war chest from the money sprint on a television blitz.` : `${opName} ran a television blitz.`;
    R.bank = 0;
    s.oppCash = Math.max(0, s.oppCash - c.oppWeekly * 0.4);
  } else if (plan === "negative") {
    R.neg += 1;
    q = 0.3 + (s.staff.media ? 0.3 : 0) + (s.staff.oppo ? 0.3 : 0);
    sev = 0.6;
    t = `${opName} went negative: a new attack ad is cut and about to air. Answer it when it lands.`;
    queue(s, rivalAttack(c, s));
  } else if (plan === "turf") {
    const g = regs[R.region];
    if (g) {
      region = g.name;
      const v = visitsHere(g.f), off = g.f.some((f) => s.offices.includes(f));
      q = clamp(v / 2, 0, 1) * 0.8 + (off ? 0.2 : 0);
      t = `${opName} camped out in ${g.name}, the region you have been winning.${v ? ` You were there too: ${v >= 2 ? "you held your ground" : "one stop was not quite enough"}.` : " You were not."}`;
    } else { q = 0.55; t = `${opName} toured the state.`; }
  } else if (plan === "turnout") {
    const doors = s.doorsWk ?? 0;
    q = clamp(doors / Math.max(1, c.total * 0.01), 0, 1) * 0.75 + (s.gotv > 0 ? 0.25 : 0);
    t = `${opName}'s field program flooded their base with door knockers.${doors ? ` Your crews knocked ${Math.round(doors).toLocaleString()} doors.` : " Your side knocked almost none."}`;
  } else if (plan === "money") {
    R.bank = 1; q = 0.55; sev = 0;
    const amt = Math.round(c.oppWeekly * 0.9 * R.skill);
    s.oppCash += amt;
    t = `${opName} disappeared into call time and raised about ${usd(amt)}. Expect it on the air next week.`;
  } else if (plan === "surprise") {
    q = 0.55; sev = 0;
    t = `${opName}'s allies are about to drop a story they have held for months.`;
    if (!s.used.includes("osurprise")) queue(s, { ...surpriseCard(c), id: "osurprise" });
  } else if (plan === "coast") {
    q = 1; sev = 0.5;
    t = `${opName} coasted on a big lead and barely campaigned. Every stop you made counted double.`;
  }
  q = clamp(q - hard * (plan === "coast" ? 0 : 1), 0, 1);
  const fx = plan === "coast" ? M * 0.5 : M * (q - 0.55) * sev;
  if (Math.abs(fx) > 1e-4) {
    if (plan === "turf" && regs[R.region]) {
      // the region takes it: persuasion in its counties, sized to move the state by fx
      const fs = regs[R.region].f; const idx = fs.map((f) => c.r.counties.findIndex((x) => x[0] === f)).filter((i) => i >= 0);
      const vt = idx.reduce((a, i) => a + c.r.counties[i][5], 0) || 1;
      for (const i of idx) s.pers[i] += (fx * c.total) / vt;
      parts.push({ label: `Voters in ${regs[R.region].name}`, share: Math.round((100 * vt) / c.total), lean: 0, fx });
    } else if (plan === "turnout") {
      const idx = c.r.counties.map((_, i) => i).filter((i) => (fx < 0 ? c.base[i] <= -5 : c.base[i] >= 5));
      const vt = idx.reduce((a, i) => a + c.r.counties[i][5], 0) || 1;
      const votes = (Math.abs(fx) / 100) * c.total;
      for (const i of idx) { const add = votes * (c.r.counties[i][5] / vt); if (fx < 0) s.xop[i] += add; else s.xme[i] += add; }
      parts.push({ label: fx < 0 ? "Their base turnout" : "Your base turnout", share: Math.round((100 * vt) / c.total), lean: 0, fx });
    } else {
      parts.push({ label: plan === "air" ? "Television viewers" : plan === "negative" ? "Independents" : "Voters following the race", share: 55, lean: 0, fx });
      applyGlobal(s, fx, parts, 0.7);
    }
  }
  const countered = plan !== "money" && plan !== "surprise" && plan !== "coast" && q >= 0.55;
  if (countered) R.countered += 1;
  const taunt = TAUNT[plan][Math.floor(rand(s) * TAUNT[plan].length)];
  const verdict = plan === "money" || plan === "surprise" ? "" : plan === "coast" ? " You gained on them." : countered ? " You countered it." : q >= 0.35 ? " You blunted part of it." : " It landed.";
  R.moves.push({ w: s.week, plan, fx, q, t: t + verdict, taunt, region });
  out.push({ w: s.week, kind: "opp", t: `Rival move, ${PLAN[plan].name}: ${t}${verdict}`, fx: Math.abs(fx) > 1e-4 ? fx : undefined, parts });
  // next week: last week's look ahead becomes the plan, and the war room picks the one after
  R.plan = R.bank > 0 ? "air" : R.next; R.region = R.nextRegion;
  R.v0 = { ...s.visits };
  return out;
}

/** After the week rolls over: the plan after next, so opposition research can see a week ahead. */
export function rivalLookAhead(c: Ctx, s: State) {
  const R = s.rival; if (!R) return;
  R.next = choose(c, s, 1); R.nextRegion = pickRegion(c, s);
  R.v0 = { ...s.visits };
}

/** What your campaign knows about the rival's plan this week. */
export function rivalIntel(c: Ctx, s: State): { plan: Plan; region: string | null; sure: boolean } | null {
  const R = s.rival; if (!R) return null;
  const sure = s.staff.oppo || s.met.some((m) => m.includes("mole"));
  if (!sure) return null;
  const g = regionsOf(c.r)[R.region];
  return { plan: R.plan, region: R.plan === "turf" && g ? g.name : null, sure };
}

function queue(s: State, e: Ev) { (s.queue ??= []).push(e); }

function rivalAttack(c: Ctx, s: State): Ev {
  const theirs = c.op.party === "I" ? "I" : c.side === "D" ? "R" : "D";
  const ads = (c.r.research?.ads ?? []).filter((a) => a.for === theirs);
  const ad = ads.length ? ads[(s.week + (s.rival?.neg ?? 0)) % ads.length] : null;
  const lines = [
    `says ${c.me.name} is out of touch with ${c.r.state} families and cannot be trusted with their money`,
    `digs up an old vote and an old quote and plays them side by side`,
    `stars a local voter who says ${sur(c.me.name)} never showed up for their town`,
    `calls ${sur(c.me.name)} a career politician who says one thing and does another`,
  ];
  const what = ad ? `${ad.by}: ${ad.theme}` : `A new ad from ${c.op.name} ${lines[Math.floor(rand(s) * lines.length)]}.`;
  return { id: `attack:r${s.week}`, kind: "attack", real: !!ad, src: ad?.src, title: `${sur(c.op.name)} goes negative`, prompt: `${ad ? "A real ad in this race just went up statewide. " : ""}${what} Their war room is watching to see if you flinch.`,
    opts: [
      { label: "Answer with an ad", say: "Cut a response ad and put it up within 48 hours.", cash: 300000, kind: "respond" },
      { label: "Clear it up in interviews", say: "Spend a day on local TV and radio answering it directly.", days: 1, kind: "clarify" },
      { label: "Hit back with their record", say: "Answer with your opposition research on them.", need: "oppo", cash: 200000, kind: "counter" },
      { label: "Ignore it", say: "Stay on your message and let it fade.", kind: "ignore" },
    ] };
}

function surpriseCard(c: Ctx): Ev {
  const what = c.me.intel.find((x) => /lawsuit|vote|tax|debt|record|former|company|business|said|ad/i.test(x.t))?.t ?? `a decade old lawsuit involving ${c.me.name}'s business partner`;
  return { id: "osurprise", kind: "osurprise", title: "An October surprise", prompt: `${c.op.name}'s allies dropped a story they have clearly held for months: ${what.replace(/\.$/, "")}. It leads every newscast tonight.`, opts: [
    { label: "Rapid response ad", say: "Answer it on the air by tomorrow.", cash: 250000, out: { fx: -0.12, t: "You blunted it, mostly." } },
    { label: "Counter with your own file", say: "Answer with what you have on them.", need: "oppo", out: { fx: -0.05, buzz: 6, risk: 0.3, riskT: "Voters tuned out the mud fight; both of you lost a little.", riskFx: -0.06, t: "You changed the subject." } },
    { label: "Press conference", say: "Take every question until they run out.", out: { days: 1, fx: -0.15, risk: 0.3, riskT: "You stayed calm, and it worked.", riskFx: 0.1, t: "A long, hard afternoon." } },
    { label: "Ignore it", say: "Close on your message.", out: { fx: -0.32, t: "It was the last thing many voters heard about you." } }] };
}

/** A line for the HQ: who you are up against. */
export const starsTxt = (n: number) => "★".repeat(n) + "☆".repeat(5 - n);
