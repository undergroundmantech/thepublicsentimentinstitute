// The decisions a campaign faces each week. Issue questions are the ones reporters and voters are asking this fall;
// the race's own events come from the On Point news desk and from the people files, where each candidate's real
// message and the vulnerabilities opponents are running on are written down with sources.
// A stance's pos runs from -1, the most progressive answer, to +1, the most conservative; trump runs from -1, distance
// from the president, to +1, embrace. How voters take it is worked out in engine.react from the race's own voter data.
import { podInvite } from "./net";
import { type Ctx, type State, type Part, type Ev, type Stance, type Meet, type Role, type MeetOut, react, applyGlobal, applyOut, usd, DIFF, rand, gauss, weekOf, POLLSTERS, cal, att } from "./engine";
export type { Ev, Opt } from "./engine";

const FARM = ["IA", "NE", "KS", "SD", "MN", "WI", "OH", "MI", "GA", "AR", "MS", "LA", "TN", "OK", "TX", "ME", "VT", "NC", "SC"];

export const ISSUES: Ev[] = [
  { id: "costs", kind: "issue", title: "The price of everything", prompt: "At a diner stop a voter says groceries and rent are eating her paycheck and asks what you will actually do about it.", opts: [
    { label: "Blame the tariffs", say: "Promise to fight the tariffs driving up prices and to cap what families pay for basics.", st: { issue: "econ", pos: -0.6, trump: -0.6 } },
    { label: "Cut taxes and red tape", say: "Promise lower taxes, cheaper energy and fewer regulations so prices come down.", st: { issue: "econ", pos: 0.65, trump: 0.3 } },
    { label: "Go after price gouging", say: "Name the grocery chains and landlords raising prices fastest and promise a crackdown.", st: { issue: "econ", pos: -0.2, tone: "fiery", extra: ["Under $50K"] } },
    { label: "Talk about your own budget", say: "Skip the policy and talk about your family's grocery bill. Relatable, not specific.", st: { issue: "econ", pos: 0, sal: 0.6, tone: "calm" } },
  ] },
  { id: "health", kind: "issue", title: "Health insurance premiums", prompt: "Premiums on the marketplace jumped this year for thousands of families in the state. A local station asks where you stand.", opts: [
    { label: "Restore the tax credits", say: "Bring back the larger premium tax credits and expand them.", st: { issue: "health", pos: -0.75, extra: ["45 to 64"] } },
    { label: "Lower costs through competition", say: "Let insurers sell cheaper plans across state lines and expand health savings accounts.", st: { issue: "health", pos: 0.6 } },
    { label: "Protect Medicare first", say: "Say you will never vote to cut Medicare or Social Security, and leave the rest vague.", st: { issue: "health", pos: -0.15, extra: ["65+"] } },
  ] },
  { id: "immig", kind: "issue", title: "Immigration enforcement", prompt: "Federal immigration agents arrested workers at a plant in the state this week. Protesters and supporters are both outside your event.", opts: [
    { label: "Back the deportations", say: "Say the law is the law and the administration is right to enforce it.", st: { issue: "immig", pos: 0.9, trump: 0.7 } },
    { label: "Secure the border, spare the workplaces", say: "Back a secure border but say raids on farms, plants and schools go too far.", st: { issue: "immig", pos: -0.05 } },
    { label: "Demand oversight of ICE", say: "Call for limits on the raids and an investigation of the agents' tactics.", st: { issue: "immig", pos: -0.8, trump: -0.7, tone: "fiery" } },
  ] },
  { id: "abortion", kind: "issue", title: "Abortion", prompt: "A debate moderator's preview question leaks: would you vote for a national law on abortion, either way?", opts: [
    { label: "Protect abortion rights in law", say: "Back a federal law restoring the protections of Roe.", st: { pos: -0.8, extra: ["Women", "18 to 29"] } },
    { label: "Leave it to the states", say: "Say it belongs to the states now and you would not vote for a national ban or a national right.", st: { pos: 0.25, extra: ["Women"] } },
    { label: "Back a national limit", say: "Support a national limit at 15 weeks with exceptions.", st: { pos: 0.8, extra: ["Women"] } },
  ] },
  { id: "power", kind: "issue", title: "Data centers and power bills", prompt: "A tech company wants to build a giant data center in the state. Neighbors say it will raise electric rates and drain water.", opts: [
    { label: "Welcome the jobs", say: "Back the project and the construction jobs and tax base it brings.", st: { issue: "econ", pos: 0.45 } },
    { label: "Make them pay their own way", say: "Support it only if the company pays for its own power lines and plants, not ratepayers.", st: { issue: "econ", pos: -0.05, extra: ["Small, under 50K"] } },
    { label: "Pause the projects", say: "Call for a pause on new data centers until the grid and water studies are done.", st: { issue: "econ", pos: -0.6 } },
  ] },
  { id: "tariffs-farm", kind: "issue", title: "Tariffs and the farm economy", states: FARM, prompt: "Crop prices are down and farmers say they lost export markets in the trade fight. The farm bureau asks for your position.", opts: [
    { label: "Stand with the president's trade fight", say: "Say short term pain will bring better deals, and back the farm aid payments.", st: { issue: "econ", pos: 0.6, trump: 0.6, extra: ["Small, under 50K"] } },
    { label: "Ask for exemptions", say: "Support the strategy but ask for relief for the state's crops and exports.", st: { issue: "econ", pos: 0.1, trump: 0, extra: ["Small, under 50K"] } },
    { label: "End the tariffs", say: "Call the tariffs a tax on farmers and promise to vote to end them.", st: { issue: "econ", pos: -0.5, trump: -0.7, extra: ["Small, under 50K"] } },
  ] },
  { id: "elections", kind: "issue", title: "Who counts the votes", prompt: "The Justice Department says it may act on certifying some midterm results. A reporter asks if you will accept the result of your own race.", opts: [
    { label: "Yes, whatever it is", say: "Say you will accept the result and call for every legal ballot to be counted.", st: { issue: "corruption", pos: -0.3, trump: -0.4, tone: "calm" } },
    { label: "Yes, if it is clean", say: "Say you will accept a fair result and that you support checking voter rolls for noncitizens.", st: { issue: "corruption", pos: 0.5, trump: 0.4 } },
    { label: "Attack the Justice Department", say: "Call it an attack on democracy and promise to fight any federal interference.", st: { issue: "corruption", pos: -0.8, trump: -0.9, tone: "fiery" } },
  ] },
  { id: "iran", kind: "issue", title: "Strikes on Iran and the price of gas", prompt: "Oil hit its highest price since March after tanker attacks in the Gulf, and the president is floating more strikes on Iran.", opts: [
    { label: "Back the president", say: "Support further strikes if Iran keeps attacking shipping.", st: { issue: "other", pos: 0.6, trump: 0.7 } },
    { label: "Congress must vote first", say: "Say any new war needs a vote in Congress.", st: { issue: "other", pos: -0.3, trump: -0.4 } },
    { label: "Talk about gas prices", say: "Skip the foreign policy and promise to fight for cheaper gas at home.", st: { issue: "econ", pos: 0, sal: 0.7 } },
  ] },
  { id: "trading", kind: "issue", title: "A ban on stock trading in Congress", prompt: "A government watchdog group asks every candidate to pledge to support a ban on members of Congress trading stocks.", opts: [
    { label: "Take the pledge", say: "Sign it and challenge your opponent to sign too.", st: { issue: "corruption", pos: 0, tone: "fiery", sal: 1.2 } },
    { label: "Decline politely", say: "Say you support transparency but not this bill.", st: { issue: "corruption", pos: 0.2, sal: 0.8 } },
  ] },
  { id: "ss", kind: "issue", title: "Social Security", prompt: "A seniors' group asks whether you would raise the retirement age to keep Social Security solvent.", opts: [
    { label: "Never", say: "No cuts and no higher retirement age; lift the cap on income that is taxed.", st: { issue: "health", pos: -0.5, extra: ["65+"] } },
    { label: "Everything on the table", say: "Say the program needs a bipartisan fix and you will not rule anything out.", st: { issue: "health", pos: 0.5, extra: ["65+"] } },
    { label: "Protect current retirees", say: "Promise no change for anyone over 55 and a commission for the rest.", st: { issue: "health", pos: 0.1, extra: ["65+"] } },
  ] },
  { id: "crime", kind: "issue", title: "Crime and the police", prompt: "A shooting in the state's largest city leads the local news. A police union asks for your support.", opts: [
    { label: "Fund the police", say: "Promise more money for officers and tougher sentences for repeat offenders.", st: { issue: "other", pos: 0.55, extra: ["65+"] } },
    { label: "Police and prevention", say: "Back the police and money for mental health and youth programs.", st: { issue: "other", pos: -0.1 } },
    { label: "Reform first", say: "Call for police accountability before more funding.", st: { issue: "other", pos: -0.8 } },
  ] },
  { id: "ai", kind: "issue", title: "AI and jobs", prompt: "Tech stocks fell on doubts about AI spending, and a call center in the state is replacing workers with AI.", opts: [
    { label: "Protect workers", say: "Back rules that make companies give notice and pay for retraining before replacing workers with AI.", st: { issue: "econ", pos: -0.4, extra: ["No college degree"] } },
    { label: "Keep America ahead", say: "Say regulation would hand the lead to China, and back training programs instead.", st: { issue: "econ", pos: 0.4, extra: ["College graduate"] } },
  ] },
  { id: "shutdown", kind: "issue", title: "Federal workers and a funding fight", prompt: "Congress is fighting over the next spending deadline and federal workers in the state are worried about missed paychecks.", opts: [
    { label: "Blame the other party", say: "Say the other side is holding workers hostage.", st: { pos: undefined, tone: "fiery", sal: 0.8 } },
    { label: "Pay workers no matter what", say: "Back a bill that pays federal workers and troops through any shutdown.", st: { pos: 0, sal: 1.1, tone: "calm" } },
  ] },
];

/** A surrogate offer: Trump for Republicans, Obama for Democrats, both of whom are on the trail this fall. */
export function surrogate(c: Ctx): Ev {
  const R = c.me.party === "R", I = c.me.party === "I";
  const who = R ? "Donald Trump" : "Barack Obama";
  return { id: "surrogate", kind: "surrogate", title: `${who} wants to rally with you`, prompt: I
    ? `As an independent, both parties' biggest names would love to claim you. ${R ? "" : "A national Democratic group offers a rally with Barack Obama."} Taking it fires up one side and costs you with the other.`
    : `${who}'s team offers a rally in your state's biggest media market. It will fire up your base and dominate the news for two days, for better and worse.`,
    opts: [
      { label: "Hold the rally", say: `Share a stage with ${who}.`, st: { pos: R ? 0.7 : -0.7, trump: R ? 1 : -0.9, tone: "fiery" }, kind: "accept" },
      { label: "Take a smaller event", say: "Do a closed fundraiser with them instead: money, no cameras.", kind: "skip" },
      { label: "Politely decline", say: "Say you are running your own race.", st: { pos: R ? 0.3 : -0.3, trump: R ? 0.1 : -0.3 }, kind: "decline" },
    ] };
}

function vuln(x: { intel: { l: string | null; t: string; u: string | null }[] }) {
  return x.intel.find((i) => /vulnerab/i.test(i.l ?? "")) ?? x.intel.find((i) => /attack|criticiz|ad |ads |hit/i.test(i.t)) ?? null;
}
/** The other side runs on your record: the vulnerability your people file says opponents are using. */
export function attack(c: Ctx, w = 3): Ev {
  // a real ad against you from the race research first, then the vulnerability in your people file
  const theirs = c.op.party === "I" ? "I" : c.side === "D" ? "R" : "D";
  const ads = (c.r.research?.ads ?? []).filter((a) => a.for === theirs);
  const ad = ads[w === 7 ? 1 : 0] ?? ads[0];
  const v = vuln(c.me);
  const what = ad ? `${ad.by}: ${ad.theme}` : v ? v.t : `${c.op.name}'s campaign calls you out of step with ${c.r.state} in a new ad.`;
  return { id: `attack:${w}`, kind: "attack", real: !!(ad || v), title: `${c.op.name} goes on the attack`, src: ad?.src ?? v?.u, prompt: ad ? `A real ad in this race is running statewide. ${what}` : `A new ad from ${c.op.name} and allied groups is running statewide. From your people file, what they are hitting you on: ${what}`,
    opts: [
      { label: "Answer with an ad", say: "Cut a response ad and put it up within 48 hours.", cash: 300000, kind: "respond" },
      { label: "Clear it up in interviews", say: "Spend a day on local TV and radio answering it directly.", days: 1, kind: "clarify" },
      { label: "Hit back with their record", say: "Answer with your opposition research on them.", need: "oppo", cash: 200000, kind: "counter" },
      { label: "Ignore it", say: "Stay on your message and let it fade.", kind: "ignore" },
    ] };
}
/** Your opening: the opponent's vulnerability from their people file. */
export function opening(c: Ctx): Ev {
  const v = vuln(c.op);
  return { id: "opening", kind: "opening", title: "Your research team found something", src: v?.u, prompt: v ? `From ${c.op.name}'s file: ${v.t}` : `${c.op.name} has a record in ${c.r.state} your team thinks voters do not know.`,
    opts: [
      { label: "Make it the closing ad", say: "Put real money behind it statewide.", cash: 400000, kind: "hit" },
      { label: "Raise it at the debate", say: "Save it for the debate stage.", kind: "hold" },
      { label: "Leave it alone", say: "Stay positive. Some voters reward it.", kind: "skip" },
    ] };
}
/** The race's own news from the On Point news desk. */
export function newsEv(c: Ctx, s: State): Ev | null {
  const n = c.r.news.find((x) => !s.used.includes("news:" + x.id));
  if (!n) return null;
  const mine = n.title.includes(c.me.name.split(" ").slice(-1)[0]);
  return { id: "news:" + n.id, kind: "news", title: "In the news", prompt: `${n.title}. ${n.dek}`.trim(), src: `/news/story/${n.id}`, opts: [
    { label: mine ? "Lean into it" : "Seize on it", say: mine ? "Make it the story of the week." : "Hold a press conference about it.", st: { pos: c.me.party === "R" ? 0.6 : c.me.party === "D" ? -0.6 : 0, tone: "fiery", sal: 0.9 } },
    { label: "Turn it to your message", say: "Answer briefly and pivot to cost of living.", st: { issue: "econ", pos: c.me.party === "R" ? 0.3 : c.me.party === "D" ? -0.3 : 0, tone: "calm", sal: 0.7 } },
    { label: "No comment", say: "Stay out of it.", kind: "skip" },
  ] };
}

/** Real decisions from the race research: each was built from a sourced storyline or issue in this race. */
function realEvents(c: Ctx): Ev[] {
  const R = c.r.research; if (!R) return [];
  const iss: Record<string, string> = { econ: "econ", health: "health", immig: "immig", corruption: "corruption", other: "other" };
  return R.events.map((e, k) => ({ id: `real:${k}`, kind: "real" as const, real: true, title: e.title, prompt: e.prompt, src: e.src,
    opts: e.opts.map((o) => ({ label: o.label, say: o.say, st: { issue: iss[e.issue] ?? "other", pos: o.pos, trump: o.trump ?? undefined, tone: (o.tone === "fiery" || o.tone === "calm") ? o.tone : undefined } as Stance })) }));
}
/** A real moment from the campaign, dated: if it helped you, amplify it; if it helped them, push back or change the subject. */
function flashFor(c: Ctx, s: State): Ev | null {
  const R = c.r.research; if (!R) return null;
  const mine = c.me.party === "I" ? "I" : c.side, theirs = c.op.party === "I" ? "I" : c.side === "D" ? "R" : "D";
  const fit = R.storylines.map((x, k) => ({ x, k, w: weekOf(x.date) })).filter((y) => y.w != null && y.w <= cal(s) && !s.flashes.includes(`flash:${y.k}`))
    .sort((a, b) => (b.w! - a.w!));
  const y = fit[0]; if (!y) return null;
  const helps = y.x.helps === mine ? "you" : y.x.helps === theirs ? "them" : "mixed";
  const base = { id: `flash:${y.k}`, kind: "flash" as const, real: true, title: y.x.title, prompt: `${y.x.what}`, src: y.x.src, helps, date: y.x.date };
  if (helps === "you") return { ...base, opts: [
    { label: "Amplify it", say: "Put digital money and your surrogates behind it for a week.", cash: 75000, kind: "amplify" },
    { label: "Mention it, move on", say: "One press release and back to your message.", kind: "pivot" },
    { label: "Let it ride", say: "Do nothing; the press already has it.", kind: "skip" }] };
  if (helps === "them") return { ...base, opts: [
    { label: "Push back hard", say: "Rapid response: statement, surrogates and a fact sheet the same day.", cash: 60000, kind: "push" },
    { label: "Change the subject", say: "Drop a new policy plan to own the next news cycle.", days: 1, kind: "pivot" },
    { label: "Ignore it", say: "Do not give it oxygen.", kind: "ignore" }] };
  return { ...base, opts: [
    { label: "Spin your side of it", say: "Tell reporters what it means for your campaign.", kind: "pivot" },
    { label: "Stay out of it", say: "Let the story run its course.", kind: "skip" }] };
}
/** A real endorsement for your side, from the research, as an event to court and accept. */
function endorseEv(c: Ctx, s: State): Ev | null {
  const R = c.r.research; if (!R) return null;
  const mine = c.me.party === "I" ? "I" : c.side;
  const e = R.endorsements.find((x, k) => x.for === mine && !s.endorsed.includes(String(k)));
  if (!e) return null;
  const k = R.endorsements.indexOf(e);
  return { id: `endorse:${k}`, kind: "endorse", real: true, title: `${e.who} is ready to endorse you`, src: e.src,
    prompt: `${e.who} backed ${c.me.name} in real life. Roll it out big, or keep it low key.`, opts: [
      { label: "Big rollout", say: "A joint event and an ad featuring the endorsement.", cash: 120000, days: 1, kind: "accept" },
      { label: "Press release", say: "Announce it and move on.", kind: "pivot" }] };
}
/** The end of the third quarter: FEC reports cover through Sep 30, and the money race becomes a story. */
function quarterEv(c: Ctx): Ev {
  return { id: "quarter", kind: "quarter", title: "End of quarter deadline", prompt: `Reports covering through September 30 are due October 15. ${c.op.name}'s team will tout their number; donors who give before midnight count in yours.`, opts: [
    { label: "All out deadline push", say: "Five emails and three texts a day until midnight. Big money, some list fatigue.", kind: "blast" },
    { label: "Tout your number", say: "Release your total early to win the money story.", kind: "tout" },
    { label: "Skip the hype", say: "Business as usual.", kind: "skip" }] };
}
/** No debate on the calendar: real when the other side declined. */
function chairEv(c: Ctx): Ev {
  return { id: "chair", kind: "chair", title: "No debate on the calendar", prompt: `There is no debate between ${c.me.name} and ${c.op.name} on the calendar. You can hold your own forum and dare them to show, or not.`, opts: [
    { label: "Empty chair forum", say: "Hold a televised forum with an empty podium for your opponent.", cash: 50000, days: 1, kind: "forum" },
    { label: "Attack them for dodging", say: "Make the missing debate an ad.", cash: 150000, kind: "hit" },
    { label: "Fine by us", say: "No debate suits you.", kind: "dodge" }] };
}
/** Things that happen to campaigns, labeled as game scenarios, not real events. */
const SCENARIOS: Ev[] = [
  { id: "sc:post", kind: "scenario", title: "A staffer's old posts surface", prompt: "Scenario: a reporter found crude posts a mid level staffer wrote years ago.", opts: [
    { label: "Fire the staffer", say: "Same day, with an apology.", kind: "respond" }, { label: "Stand by them", say: "They have apologized; you move on.", kind: "ignore" }] },
  { id: "sc:storm", kind: "scenario", title: "Severe storm damage", prompt: "Scenario: storms knocked out power across part of the state. Campaigning through it could look tone deaf.", opts: [
    { label: "Pause and volunteer", say: "Suspend ads in the area for three days and help with cleanup.", days: 1, kind: "respond" }, { label: "Keep campaigning", say: "Stick to the schedule.", kind: "ignore" }] },
  { id: "sc:complaint", kind: "scenario", title: "A campaign finance complaint", prompt: "Scenario: a watchdog group files an FEC complaint about how one of your events was paid for.", opts: [
    { label: "Lawyer up quietly", say: "Respond through counsel and refund anything questionable.", cash: 40000, kind: "respond" }, { label: "Call it a smear", say: "Attack the group's funding.", kind: "ignore" }] },
  { id: "sc:viral", kind: "scenario", title: "Your clip is going viral", prompt: "Scenario: a clip of you fixing a voter's flat tire on the way to an event is all over social media.", opts: [
    { label: "Ride the wave", say: "Cut it into an ad and a fundraising email.", cash: 50000, kind: "amplify" }, { label: "Stay humble", say: "No comment beyond a thank you.", kind: "skip" }] },
];

/** This week's decisions: a main event, plus a real dated story from the campaign when one fits the week. */
export function eventFor(c: Ctx, s: State): Ev | null {
  const w = cal(s);
  if (w <= 0) { // summer: a quieter news cycle, fairs and parades, and the July money report
    const sm = summerEvent(c, s); if (sm) return sm;
    const pool = ISSUES.filter((e) => !s.used.includes(e.id) && (!e.states || e.states.includes(c.r.st)));
    return pool.length ? pool[Math.floor(rand(s) * pool.length)] : null;
  }
  if (w === 4 && !s.used.includes("quarter")) return quarterEv(c);
  if (w === 3 || w === 7) return attack(c, w);
  if (w === 5) return opening(c);
  if (w === 8) { const e = endorseEv(c, s); if (e) return e; if (!s.used.includes("surrogate")) return surrogate(c); }
  const real = realEvents(c).filter((e) => !s.used.includes(e.id));
  if (real.length && (w <= 2 || rand(s) < 0.75)) return real[0];
  const n = w >= 6 ? newsEv(c, s) : null; if (n) return n;
  const pool = ISSUES.filter((e) => !s.used.includes(e.id) && (!e.states || e.states.includes(c.r.st)));
  if (!pool.length) return null;
  const firsts = ["costs", "health", "tariffs-farm", "power"];
  return w <= 2 ? pool.find((e) => firsts.includes(e.id)) ?? pool[0] : pool[Math.floor(rand(s) * pool.length)];
}

export type Outcome = { t: string; fx: number; parts: Part[] };
export function resolve(c: Ctx, s: State, ev: Ev, i: number, debate = false): Outcome {
  const o = ev.opts[i];
  s.used.push(ev.id);
  if (ev.kind === "flash") s.flashes.push(ev.id);
  if (o.cash) { s.cash -= o.cash; s.spent += o.cash; }
  if (o.days) s.days = Math.max(0, s.days - o.days * 2);
  let fx = 0, parts: Part[] = [], t = "";
  if (o.out) { // a scenario card with a full outcome: money, volunteers, a stance, a risk
    s.days = Math.max(0, s.days - Math.round((o.out.days ?? 0) * 2));
    const res = applyOut(c, s, o.out);
    s.resolved.push({ id: ev.id, choice: i, fx: res.fx });
    s.log.push({ w: s.week, kind: "event", t: `${ev.title}: ${o.label}. ${res.t}`, fx: res.fx || undefined, parts: res.parts });
    return { t: res.t, fx: res.fx, parts: res.parts };
  }
  const neg = DIFF[s.diff].neg, oppK = DIFF[s.diff].opp;
  if (ev.kind === "attack") {
    const hit = -(0.35 + 0.25 * rand(s)) * oppK * neg;
    const keep = o.kind === "respond" ? 0.25 : o.kind === "clarify" ? 0.5 : o.kind === "counter" ? 0.1 : 1;
    fx = hit * keep + (o.kind === "counter" ? 0.18 : 0);
    parts = [{ label: "Independents", share: c.g("Independent", "Party ID")?.share ?? 30, lean: 0, fx: fx * 0.6 }, { label: "Your base", share: 30, lean: 0, fx: fx * 0.4 }];
    t = o.kind === "ignore" ? "The ad ran unanswered for a week and it cost you." : o.kind === "respond" ? "Your response ad blunted most of it." : o.kind === "clarify" ? "The interviews took some of the sting out." : "Your counterpunch changed the subject.";
  } else if (ev.kind === "opening") {
    if (o.kind === "hit") { fx = (0.25 + 0.25 * rand(s)) * (s.staff.oppo ? 1.4 : 0.9) * (s.staff.media ? 1.15 : 1); t = "The ad landed. The other side spent the week explaining."; }
    else if (o.kind === "hold") { s.prep += 1; t = "Saved for the debate. It makes your prep sharper."; }
    else { fx = 0.04; t = "You stayed positive. A few voters noticed."; }
    parts = [{ label: "Independents", share: c.g("Independent", "Party ID")?.share ?? 30, lean: 0, fx }];
  } else if (ev.kind === "flash") {
    const sal = 0.12 + 0.12 * rand(s);
    if (ev.helps === "you") fx = o.kind === "amplify" ? sal * 1.6 : o.kind === "pivot" ? sal * 0.7 : sal * 0.4;
    else if (ev.helps === "them") fx = o.kind === "push" ? -sal * 0.35 : o.kind === "pivot" ? -sal * 0.55 : -sal * DIFF[s.diff].neg;
    else fx = o.kind === "pivot" ? sal * 0.3 * (rand(s) < 0.6 ? 1 : -1) : 0;
    s.buzz = Math.min(100, s.buzz + (fx > 0 ? 6 : 2));
    parts = [{ label: "Voters following the race", share: 55, lean: 0, fx }];
    t = fx >= 0.08 ? "It became your story of the week." : fx <= -0.08 ? "It stuck, and it cost you." : "A one day story.";
  } else if (ev.kind === "endorse") {
    s.endorsed.push(ev.id.split(":")[1]);
    fx = o.kind === "accept" ? 0.12 + 0.12 * rand(s) : 0.05;
    parts = [{ label: "Independents", share: c.g("Independent", "Party ID")?.share ?? 30, lean: 0, fx: fx * 0.6 }, { label: "Your base", share: 35, lean: 0, fx: fx * 0.4 }];
    t = o.kind === "accept" ? "The rollout led the local news." : "A nice line in the clips.";
  } else if (ev.kind === "quarter") {
    if (o.kind === "blast") { const amt = Math.round(c.weekly * 1.6 * (0.55 + c.smallShare) * DIFF[s.diff].fund); s.cash += amt; s.raised += amt; s.fatigue = 3; t = `The deadline push raised ${usd(amt)}; your list needs a rest this week.`; }
    else if (o.kind === "tout") { const ahead = (c.me.money.receipts ?? 0) >= (c.op.money.receipts ?? 0); fx = ahead ? 0.08 : -0.05; s.momentum = Math.max(-1, Math.min(1, s.momentum + (ahead ? 0.3 : -0.2))); t = ahead ? "You won the money story; donors and reporters took note." : "Their number was bigger, and the story wrote itself."; }
    else t = "Business as usual.";
  } else if (ev.kind === "chair") {
    if (o.kind === "forum") { fx = 0.1 + 0.1 * rand(s); s.buzz = Math.min(100, s.buzz + 10); t = "The empty podium photo ran everywhere."; }
    else if (o.kind === "hit") { fx = 0.06 + 0.1 * rand(s); t = "The dodging ad ran all week."; }
    else { fx = -0.03; t = "Voters who wanted a debate noticed."; }
    parts = [{ label: "Independents", share: c.g("Independent", "Party ID")?.share ?? 30, lean: 0, fx }];
  } else if (ev.kind === "scenario") {
    const good = o.kind === "respond" || o.kind === "amplify";
    fx = ev.id === "sc:viral" ? (o.kind === "amplify" ? 0.12 : 0.06) : good ? -0.03 : (rand(s) < 0.5 ? -0.18 : 0.02) * DIFF[s.diff].neg;
    t = fx >= 0.05 ? "It worked." : fx <= -0.08 ? "It got worse before it got better." : "It passed.";
    parts = [{ label: "Voters following the race", share: 55, lean: 0, fx }];
  } else if (ev.kind === "surrogate" && o.kind === "skip") {
    const amt = Math.round(c.weekly * 0.6); s.cash += amt; s.raised += amt; t = `A closed door fundraiser raised ${usd(amt)} and made no news.`;
  } else if (o.st) {
    // Every campaign answers something; the forecast already expects a typical answer, so a choice counts against
    // the average of the answers on offer. Debate answers count more, and prep sharpens them.
    const mult = debate ? 1.5 * (1 + 0.12 * Math.min(4, s.prep)) : 1;
    const others = ev.opts.filter((x) => x.st).map((x) => react(c, s, x.st!, mult, false));
    const meanFx = others.reduce((a, x) => a + x.fx, 0) / Math.max(1, others.length);
    const meanBy: Record<string, number> = {};
    for (const x of others) for (const p of x.parts) meanBy[p.label] = (meanBy[p.label] ?? 0) + p.fx / others.length;
    const r = react(c, s, o.st, mult);
    fx = (r.fx - meanFx) * 0.65; parts = r.parts.map((p) => ({ ...p, fx: (p.fx - (meanBy[p.label] ?? 0)) * 0.65 })).sort((x, y) => Math.abs(y.fx) - Math.abs(x.fx));
    if (fx < 0) { fx *= DIFF[s.diff].neg; parts = parts.map((p) => ({ ...p, fx: p.fx * DIFF[s.diff].neg })); }
    t = fx >= 0.05 ? "It played well." : fx <= -0.05 ? "It cost you." : "It barely registered.";
  } else {
    t = "You stayed out of it.";
  }
  if (!debate) { fx *= att(s); parts = parts.map((p) => ({ ...p, fx: p.fx * att(s) })); }
  applyGlobal(s, fx, parts, ev.kind === "attack" ? 0.6 : 0.7);
  s.resolved.push({ id: ev.id, choice: i, fx });
  s.log.push({ w: s.week, kind: "event", t: `${ev.title}: ${o.label}. ${t}`, fx, parts: parts.slice(0, 5) });
  return { t, fx, parts };
}

/** Debate night: three questions from the issues not yet asked. */
export function debateQs(c: Ctx, s: State): Ev[] {
  const pool = ISSUES.filter((e) => !s.used.includes(e.id) && (!e.states || e.states.includes(c.r.st)));
  const out: Ev[] = [];
  for (let k = 0; k < 3 && pool.length; k++) out.push(pool.splice(Math.floor(rand(s) * pool.length), 1)[0]);
  return out.map((e) => ({ ...e, kind: "debate" as const }));
}

/** Deal this week's decisions once: the debate's three questions in debate week, otherwise the main event, then a real
 * dated story from the campaign when one fits the week, and now and then a scenario. */
export function dealWeek(c: Ctx, s: State) {
  if (s.done || s.evw >= s.week) return;
  s.evw = s.week;
  const out: Ev[] = [];
  if (s.week === s.dweek) {
    const declined = !(c.r.research?.debates ?? []).length && (c.r.research?.storylines ?? []).some((x) => /declin|skip|refus|no debate|won.t debate|will not debate/i.test(x.title + " " + x.what));
    if (declined) out.push(chairEv(c)); // otherwise debate night is its own scene, on the stage
  } else { const e = eventFor(c, s); if (e) out.push(e); }
  const f = flashFor(c, s); if (f) out.push(f);
  if (s.week >= 2 && rand(s) < 0.22) { const sc = SCENARIOS.filter((x) => !s.used.includes(x.id)); if (sc.length) out.push(sc[Math.floor(rand(s) * sc.length)]); }
  // bigger dilemmas, each at most once a campaign: about one week in three
  if (s.week >= 2 && rand(s) < 0.34) { const d = dilemmas(c).filter((x) => !s.used.includes(x.id)); if (d.length) out.push(d[Math.floor(rand(s) * d.length)]); }
  // an unwanted fan, once a campaign, somewhere in the middle of it
  const fr = fringeEv(c); if (fr && !s.used.includes(fr.id) && s.week >= 3 && cal(s) <= 6 && (rand(s) < 0.3 || cal(s) === 6)) out.push(fr);
  const st = starEv(c, s); if (st && !s.used.includes(st.id) && s.week >= 2 && rand(s) < 0.18) out.push(st);
  s.cur = out;
}

/** Message testing: your pollster tests each answer with a quick online panel before you choose. The read is the real
 * expected effect plus the pollster's error, so a better pollster gives a truer read. Costs $25,000. */
export function testEvent(c: Ctx, s: State, ev: Ev): number[] | null {
  const tier = POLLSTERS[s.staff.pollster]; if (!tier) return null;
  if (s.tests[ev.id]) return s.tests[ev.id];
  if (s.cash < 25000) return null;
  s.cash -= 25000; s.spent += 25000;
  const st = ev.opts.map((o) => (o.st ? react(c, s, o.st, ev.kind === "debate" ? 1.5 : 1, false).fx : null));
  const vals = st.filter((x): x is number => x != null);
  const mean = vals.reduce((a, b) => a + b, 0) / Math.max(1, vals.length);
  const out = st.map((x) => (x == null ? NaN : Math.round(((x - mean) * 0.65 + gauss(s) * tier.sd * 0.04) * 100) / 100));
  s.tests[ev.id] = out;
  return out;
}

// ============================================================ the debate stage
export type DOpt = { label: string; say: string; st: Stance };
export type DRound = { q: string; topic: string; src?: string; real: boolean; opts: DOpt[]; opp: string };
const ISSUE_RE: [RegExp, string][] = [[/health|medic|insur|drug|hospital|aca\b|premium|social security/i, "health"], [/immigra|border|ice\b|deport/i, "immig"], [/corrupt|ethic|stock|lobby|epstein|scandal|truth|integrity/i, "corruption"], [/price|cost|tariff|tax|job|wage|econom|gas|fuel|diesel|housing|rent|grocer|farm|energy|power|inflation/i, "econ"]];
const issueOf = (t: string) => ISSUE_RE.find(([re]) => re.test(t))?.[1] ?? "other";
export function debateRounds(c: Ctx, s: State): DRound[] {
  const p0 = c.me.party === "R" ? 0.65 : c.me.party === "D" ? -0.65 : 0;
  const theirs = c.op.party === "I" ? "I" : c.side === "D" ? "R" : "D";
  const oppAds = (c.r.research?.ads ?? []).filter((a) => a.for === theirs).map((a) => a.theme);
  const oppMsg = c.op.intel.find((i) => /main message/i.test(i.l ?? ""))?.t;
  const lines = [...oppAds, ...(oppMsg ? [oppMsg] : [])];
  const out: DRound[] = [];
  for (const x of (c.r.research?.issues ?? []).slice(0, 3)) {
    const iss = issueOf(x.issue + " " + x.why);
    out.push({ topic: x.issue, real: true, src: x.src, q: `${x.issue}. ${x.why} What would you do?`, opp: lines[out.length % Math.max(1, lines.length)] ?? `${c.op.name} says you are out of step with ${c.r.state}.`, opts: [
      { label: "Your party's answer", say: "Give the answer your base wants to hear, without hedging.", st: { issue: iss, pos: p0 * 1.2 } },
      { label: "Meet in the middle", say: "Name what both sides get right and offer a practical fix.", st: { issue: iss, pos: p0 * 0.2, tone: "calm" } },
      { label: "Turn it on them", say: "Make the answer about your opponent's record on it.", st: { issue: iss, pos: p0 * 0.8, tone: "fiery" } },
      { label: "Tell a story", say: "Talk about a family you met on the trail.", st: { issue: iss, pos: p0 * 0.5, sal: 0.75, tone: "calm" } },
    ] });
  }
  const pool = ISSUES.filter((e) => !s.used.includes(e.id) && (!e.states || e.states.includes(c.r.st)));
  while (out.length < 4 && pool.length) {
    const e = pool.splice(Math.floor(rand(s) * pool.length), 1)[0];
    out.push({ topic: e.title, real: false, q: e.prompt, opp: lines[out.length % Math.max(1, lines.length)] ?? `${c.op.name} answers with the party line.`, opts: e.opts.filter((o) => o.st).map((o) => ({ label: o.label, say: o.say, st: o.st! })) });
  }
  return out;
}

// ============================================================ meetings
const FIRST = ["Dana", "Marcus", "Linda", "Ray", "Teresa", "Hank", "Priya", "Luis", "Carol", "Dwayne", "Mei", "Frank", "Rosa", "Earl", "Janelle", "Bud", "Keisha", "Tom", "Ana", "Walt", "Gloria", "Darnell", "Becky", "Omar"];
const LAST = ["Hollister", "Ortega", "Banks", "Kowalski", "Nguyen", "Whitfield", "Reyes", "Lindqvist", "Okafor", "McAllister", "Brandt", "Castillo", "Pruitt", "Yoder", "Delgado", "Haskins", "Albright", "Soto", "Fairbanks", "Mahoney"];
const TRIBAL = ["AK", "AZ", "NM", "SD", "OK", "MN", "WI", "NE", "MI", "MT", "NV", "ME"];
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export function invitesFor(c: Ctx, s: State): Meet[] {
  const r = c.r, R = c.me.party === "R", I = c.me.party === "I";
  const own = (x: number) => (R ? x : I ? x * 0.3 : -x);
  const idx = r.counties.map((_, i) => i);
  const bySize = (f: (i: number) => boolean) => idx.filter(f).sort((a, b) => r.counties[b][5] - r.counties[a][5]);
  const base = bySize((i) => c.base[i] >= 8), swing = bySize((i) => Math.abs(c.base[i]) < 8), theirs = bySize((i) => c.base[i] <= -8), all = bySize(() => true);
  const pick = <T,>(a: T[]) => a[Math.floor(rand(s) * a.length)];
  const name = () => `${pick(FIRST)} ${pick(LAST)}`;
  const cn = (i: number | undefined) => (i != null ? r.counties[i][1] : r.state);
  const reg = (i: number | undefined) => (i != null ? [r.counties[i][0]] : []);
  const party = R ? "Republican" : I ? "independent" : "Democratic";
  const w = c.weekly;
  const T: (() => Meet | null)[] = [
    () => { const i = pick(base.slice(0, 5)); const n = name(); return { id: `chair:${s.week}`, who: `${n}, ${cn(i)} County ${party} chair`, role: "chair", seed: hash(n), place: cn(i), f: r.counties[i ?? 0]?.[0], title: "The county party fish fry", intro: `"Folks here knock the doors that win this thing. Come to the fish fry Saturday and give them a reason to."`, opts: [
      { label: "Work the room", say: "Shake every hand and pose for every photo.", out: { enth: 3, vol: 70, t: "The volunteers went home fired up." } },
      { label: "Give them red meat", say: "A fiery speech about the other side.", out: { enth: 6, vol: 40, st: { pos: own(0.9), tone: "fiery" }, risk: 0.18, riskT: "A phone video of the hottest line went statewide.", riskFx: -0.14, t: "The crowd roared." } },
      { label: "Send your spouse", say: "Stay on the road and send family instead.", out: { enth: 1, vol: 20, days: 0, t: "A warm welcome, but they wanted you." } }] }; },
    () => { const n = name(); const i = pick(swing.slice(0, 6)); return { id: `union:${s.week}`, who: R ? `${n}, a Teamsters local president` : `${n}, president of the state AFL-CIO`, role: "union", seed: hash(n), place: cn(i), title: R ? "The Teamsters are listening" : "The labor endorsement", intro: R ? `"Our members voted for Trump. They also want their pensions safe and their jobs here. Convince me."` : `"Our members knock more doors than anybody. They want to know you will be there on the PRO Act and on trade."`, opts: [
      { label: R ? "Back them on trade and pensions" : "Sign the labor pledge", say: R ? "Promise to protect pensions and fight offshoring." : "Commit to the PRO Act and to walking picket lines.", out: { vol: R ? 90 : 220, enth: 2, st: { issue: "econ", pos: own(R ? -0.1 : 0.9), extra: ["No college degree"] }, region: reg(i), pers: 1.2, t: "Members will be on doors for you." } },
      { label: "Talk jobs, sign nothing", say: "Stay friendly and general.", out: { vol: 40, st: { issue: "econ", pos: own(0.3), tone: "calm" }, t: "A polite meeting. Some members will help." } },
      { label: "Skip it", say: "Business groups would notice.", out: { days: 0, enth: -1, t: "The union sat this one out." } }] }; },
    () => (["IA", "NE", "KS", "SD", "MN", "WI", "OH", "MI", "GA", "TX", "OK", "AR", "TN", "NC", "ME", "MT", "ID", "WY"].includes(r.st) ? (() => { const n = name(); const rural = idx.filter((i) => r.counties[i][5] < (all[Math.floor(all.length / 3)] != null ? r.counties[all[Math.floor(all.length / 3)]][5] : 1e9)).map((i) => r.counties[i][0]); return { id: `farm:${s.week}`, who: `${n}, head of the state Farm Bureau`, role: "farm", seed: hash(n), place: "a grain elevator", title: "Out on the farm", intro: `"Soybean prices are in the tank and diesel is up. My members want to hear one thing: are you with us on trade?"`, opts: [
      { label: "End the tariffs", say: "Call them a tax on farmers.", out: { st: { issue: "econ", pos: -0.4, trump: -0.6, extra: ["Small, under 50K"] }, region: rural, pers: R ? 0.2 : 0.7, t: "The farmers nodded. Some of them anyway." } },
      { label: "Ask for relief, keep the strategy", say: "Back the trade fight with aid payments.", out: { st: { issue: "econ", pos: 0.3, trump: 0.3, extra: ["Small, under 50K"] }, region: rural, pers: R ? 0.6 : 0.2, t: "A careful answer for a careful crowd." } },
      { label: "Drive a combine for the cameras", say: "Skip the policy and make the evening news.", out: { buzz: 8, risk: 0.2, riskT: "You stalled the combine on camera.", riskFx: -0.06, t: "Good pictures." } }] }; })() : null),
    () => { const n = name(); return { id: `donor:${s.week}`, who: `${n}, a private equity founder`, role: "donor", seed: hash(n), place: "a lake house", title: "A very big check", intro: `"I can raise you a fortune by Friday. I just need to know you will look out for the carried interest break. Between us."`, opts: [
      { label: "Say what they want to hear", say: "Wink and take the money.", out: { cash: Math.round(w * 1.4), risk: 0.3, riskT: "A guest recorded your remarks, and a reporter has the tape.", riskFx: -0.28, t: `They raised ${usd(Math.round(w * 1.4))} by Friday.` } },
      { label: "Take the money, promise nothing", say: "Thank them, commit to nothing.", out: { cash: Math.round(w * 0.6), risk: 0.08, riskT: "The guest list made the papers.", riskFx: -0.08, t: `A smaller night: ${usd(Math.round(w * 0.6))}.` } },
      { label: "Walk out", say: "Tell them you cannot be bought, and tell your small donors about it.", out: { cash: Math.round(w * 0.25), buzz: 8, days: 0, t: "Your small dollar email about it did well." } }] }; },
    () => { const i = all[0]; const n = name(); const same = i != null && c.base[i] > 0; return { id: `mayor:${s.week}`, who: `Mayor ${n} of ${cn(i)}`, role: "mayor", seed: hash(n), place: cn(i), f: r.counties[i ?? 0]?.[0], title: same ? "The big city mayor" : "A mayor from the other party", intro: same ? `"Turnout in my city decides your race. Come do a bus tour with me and the neighborhood groups."` : `"I am not voting for you. But I will stand next to you to talk about the bridge money if you are serious about it."`, opts: [
      { label: same ? "Do the bus tour" : "Joint appearance on the bridge", say: same ? "A day in the neighborhoods." : "Stand together on infrastructure.", out: same ? { region: reg(i), pers: 1, enth: 3, vol: 60, t: "Big crowds, and the mayor's machine is now yours." } : { st: { pos: 0, tone: "calm", extra: ["Independent"] }, region: reg(i), pers: 1.5, enth: -2, t: "Independents liked it. Your base grumbled." } },
      { label: "Private meeting only", say: "No cameras.", out: { region: reg(i), pers: 0.5, t: "Quietly useful." } },
      { label: "Decline", say: "Not worth the day.", out: { days: 0, t: "Fine." } }] }; },
    () => { const i = pick(swing.concat(base).slice(0, 8)); const n = name(); return { id: `faith:${s.week}`, who: `Pastor ${n}`, role: "faith", seed: hash(n), place: `a church in ${cn(i)}`, title: "Sunday service", intro: `"Our congregation is three thousand strong and they vote. They want to know what you believe, not what you poll."`, opts: [
      { label: "Speak about faith and family", say: "Speak from the pulpit about your own faith.", out: { st: { pos: own(0.4), extra: ["65+"] }, region: reg(i), pers: 0.8, risk: 0.15, riskT: "A line about a hot button issue drew a protest.", riskFx: -0.1, t: "A standing ovation." } },
      { label: "Talk about service", say: "Talk about community and helping neighbors.", out: { st: { pos: 0, tone: "calm" }, region: reg(i), pers: 0.5, t: "Warm, and safe." } },
      { label: "Just attend", say: "Sit in a pew and shake hands after.", out: { region: reg(i), pers: 0.3, t: "People noticed you came." } }] }; },
    () => { const n = name(); return { id: `podcast:${s.week}`, who: `${n}, host of a podcast with two million subscribers`, role: "podcast", seed: hash(n), place: "a studio full of neon", title: "Three hours, no notes", intro: `"No handlers, no time limit. My audience is young guys who do not trust either party. You in?"`, opts: [
      { label: "Go long and loose", say: "Three hours. Talk about anything.", out: { buzz: 22, st: { pos: 0, extra: ["18 to 29", "Men"] }, risk: 0.3, riskT: "Hour two produced a clip you will be answering for all week.", riskFx: -0.18, t: "Millions of views overnight." } },
      { label: "Stick to talking points", say: "Stay on message for an hour.", out: { buzz: 7, st: { pos: own(0.2), sal: 0.7 }, t: "The comments called you robotic, but no damage." } },
      { label: "Decline", say: "Too risky.", out: { days: 0, buzz: -3, t: "The host mocked you for it on the next show." } }] }; },
    () => { const n = name(); return { id: `editor:${s.week}`, who: `${n}, editorial page editor`, role: "editor", seed: hash(n), place: "the newspaper's conference room", title: "The editorial board", intro: `"We endorse in this race on Sunday. Convince us you would be more than a party vote."`, opts: [
      { label: "Show your independent streak", say: "Name where you break with your party.", out: { st: { pos: own(0.1), tone: "calm", extra: ["College graduate"] }, risk: 0.55, riskT: "On Sunday, the board endorsed you.", riskFx: 0.14, t: "They took a lot of notes." } },
      { label: "Make the partisan case", say: "Say the stakes are control of the chamber.", out: { st: { pos: own(0.8) }, risk: 0.2, riskT: "The board endorsed you anyway.", riskFx: 0.1, t: "They looked unconvinced." } }] }; },
    () => { const n = name(); const i = pick(swing.concat(theirs).slice(0, 6)); return { id: `sheriff:${s.week}`, who: `Sheriff ${n} of ${cn(i)} County`, role: "sheriff", seed: hash(n), place: cn(i), title: "A ride along", intro: `"Fentanyl is killing kids in my county and I am short twelve deputies. Ride with me Friday night."`, opts: [
      { label: "Do the ride along", say: "Spend a night with the deputies.", out: { st: { issue: "other", pos: 0.45, extra: ["65+"] }, region: reg(i), pers: 1, t: "The sheriff said nice things to the local paper." } },
      { label: "Promise funding, skip the ride", say: "A press release backing more deputies.", out: { st: { issue: "other", pos: 0.3, sal: 0.6 }, days: 0, t: "A one day story." } }] }; },
    () => { const n = name(); return { id: `teacher:${s.week}`, who: `${n}, president of the state teachers union`, role: "teacher", seed: hash(n), place: "a middle school gym", title: "Back to school", intro: `"Vouchers are draining our schools. Where are you?"`, opts: [
      { label: "Oppose vouchers", say: "Stand with public schools.", out: { st: { pos: -0.6, extra: ["Women", "College graduate"] }, vol: R ? 0 : 160, t: "Teachers are in." } },
      { label: "Back school choice", say: "Say parents should choose.", out: { st: { pos: 0.6, extra: ["Women"] }, vol: R ? 30 : -40, t: "The union walked out." } },
      { label: "Talk teacher pay", say: "Promise higher pay and dodge vouchers.", out: { st: { pos: 0, tone: "calm" }, vol: 50, t: "Applause, and a follow up question you did not answer." } }] }; },
    () => { const n = name(); return { id: `vet:${s.week}`, who: `${n}, commander of a VFW post`, role: "vet", seed: hash(n), place: "the VFW hall", title: "Veterans hall", intro: `"Wait times at the VA clinic are three months. Come hear it from the guys."`, opts: [
      { label: "Listen for two hours", say: "No speech. Just listen.", out: { st: { issue: "health", pos: 0, tone: "calm", extra: ["65+", "Men"] }, enth: 1, t: "They talked about it for weeks." } },
      { label: "Bring a plan", say: "Unveil a VA plan.", out: { st: { issue: "health", pos: own(0.3), extra: ["65+"] }, buzz: 4, t: "Solid coverage." } }] }; },
    () => { const n = name(); return { id: `student:${s.week}`, who: `${n}, a campus organizer`, role: "student", seed: hash(n), place: "the main quad", title: "Campus rally", intro: `"We registered four thousand students. They will vote if you give them a reason."`, opts: [
      { label: "Rally on the quad", say: "A loud evening rally.", out: { vol: 240, enth: R ? 1 : 4, st: { pos: own(R ? 0.5 : 0.9), extra: ["18 to 29"] }, t: "Students signed up by the hundreds." } },
      { label: "Talk about costs", say: "Rent, loans and jobs.", out: { vol: 120, st: { issue: "econ", pos: own(0.2), extra: ["18 to 29"] }, t: "Polite, real interest." } }] }; },
    () => { const n = name(); return { id: `biz:${s.week}`, who: `${n}, who owns three diners`, role: "biz", seed: hash(n), place: "a diner counter", title: "Small business roundtable", intro: `"Eggs doubled, insurance doubled and I cannot find cooks. What are you going to do for people like me?"`, opts: [
      { label: "Cut taxes and red tape", say: "Promise relief from regulations.", out: { st: { issue: "econ", pos: 0.5 }, cash: Math.round(w * 0.15), t: "The owners liked it." } },
      { label: "Go after the big chains", say: "Say giant corporations are crushing small business.", out: { st: { issue: "econ", pos: -0.3, tone: "fiery", extra: ["Under $50K"] }, t: "The waitress cheered." } }] }; },
    () => { const n = name(); return { id: `mole:${s.week}`, who: `A former aide to ${c.op.name}`, role: "mole", seed: hash(n), place: "a parking garage", title: "A tip from the inside", intro: `"I worked for ${c.op.name.split(" ").slice(-1)[0]} for two years. You would not believe what I have. Meet me."`, opts: [
      { label: "Take the meeting", say: "Hear them out yourself.", out: { prep: 2, risk: 0.25, riskT: "A reporter learned you met with a disgruntled ex staffer.", riskFx: -0.15, t: "Plenty of material for the debate." } },
      { label: "Hand them to opposition research", say: "Keep your distance.", need: "oppo", out: { prep: 2, days: 0, t: "Your researchers verified most of it." } },
      { label: "Refuse", say: "Not how you run.", out: { days: 0, t: "You may regret it, or not." } }] }; },
    () => (TRIBAL.includes(r.st) ? (() => { const n = name(); return { id: `tribal:${s.week}`, who: `${n}, a tribal council chair`, role: "tribal", seed: hash(n), place: "the tribal council chambers", title: "Nation to nation", intro: `"Our polling places are fifty miles apart and the roads are bad. Will you fight for our voters and our sovereignty?"`, opts: [
      { label: "Fund rides and polling sites", say: "Promise money for rides and new polling places.", out: { vol: 80, enth: 2, st: { pos: own(0), tone: "calm" }, t: "The council said it would help turn out its members." } },
      { label: "Listen and learn", say: "A long listening session.", out: { enth: 1, t: "Respectful and useful." } }] }; })() : null),
  ];
  // real endorsers for your side who are not yet on board
  const mine = I ? "I" : c.side;
  const endorsers = (r.research?.endorsements ?? []).map((e, k) => ({ e, k })).filter(({ e, k }) => e.for === mine && !s.endorsed.includes(String(k)) && !s.met.includes(`end:${k}`));
  const out: Meet[] = [];
  if (endorsers.length && s.week >= 2) {
    const { e, k } = endorsers[0];
    out.push({ id: `end:${k}`, who: e.who, role: "endorser", seed: hash(e.who), place: r.state, title: `${e.who.split(",")[0]} wants to talk`, real: true, src: e.src,
      intro: `In real life, ${e.who} backed ${c.me.name}. They want to hear it from you first.`, opts: [
        { label: "Ask for it on camera", say: "A joint event and an ad.", out: { endorse: String(k), st: { pos: own(0.2), extra: ["Independent"] }, buzz: 8, t: "The endorsement led the local news." } },
        { label: "Ask them to call donors", say: "Quiet help with money.", out: { endorse: String(k), cash: Math.round(w * 0.5), t: `Their calls brought in ${usd(Math.round(w * 0.5))}.` } }] });
  }
  const fns = T.map((f, j) => ({ f, j })).sort(() => rand(s) - 0.5);
  for (const { f } of fns) { if (out.length >= 3) break; const m = f(); if (m && !s.met.some((x) => x.split(":")[0] === m.id.split(":")[0] && s.met.filter((y) => y.startsWith(m.id.split(":")[0])).length >= 2)) out.push(m); }
  return out;
}
/** Deal this week's meeting invitations once. */
export function dealInvites(c: Ctx, s: State) {
  if (s.done || s.invw >= s.week) return;
  s.invw = s.week; s.invites = invitesFor(c, s).filter((m) => m.role !== "podcast");
  if (rand(s) < 0.6) { const p = podInvite(c, s); if (p) s.invites.unshift(p); }
}
export const ROLE_NAME: Record<Role, string> = { chair: "Party chair", union: "Labor", farm: "Farm country", donor: "Big money", mayor: "City hall", faith: "Faith leader", podcast: "Podcaster", editor: "Editorial board", sheriff: "Law enforcement", teacher: "Teachers", vet: "Veterans", student: "Students", biz: "Small business", endorser: "Real endorsement", mole: "Inside source", tribal: "Tribal nation" };

// ============================================================ the long campaign: summer, dilemmas, fans you did not ask for
/** Summer cards, for the weeks before Labor Day in a longer campaign. */
function summerEvent(c: Ctx, s: State): Ev | null {
  const R = c.me.party === "R", fair = `the ${c.r.state} State Fair`;
  const cards: Ev[] = [
    { id: "su:report", kind: "quarter", title: "The July money report", prompt: `Second quarter reports are public on July 15. Reporters will write the money race off them, and ${c.op.name}'s team is already spinning.`, opts: [
      { label: "Tout your number", say: "Release your total early to win the story.", kind: "tout" },
      { label: "Deadline email push", say: "Five emails before midnight on June 30 to pad the number.", kind: "blast" },
      { label: "Say nothing", say: "Let the filing speak.", kind: "skip" }] },
    { id: "su:fair", kind: "scenario", title: `${c.r.state === "Iowa" || c.r.state === "Minnesota" ? "Pork chops and soapboxes" : "Corn dogs and handshakes"} at the fair`, prompt: `Every campaign in the state shows up to ${fair}. A day on the midway is a day of photos, voters and the chance of eating something on camera.`, opts: [
      { label: "Work the whole fair", say: "A full day: the livestock barns, the soapbox, the food stands.", out: { days: 1, vol: 70, buzz: 8, enth: 2, risk: 0.18, riskT: "A photo of you struggling with a corn dog became the meme of the week.", riskFx: -0.05, t: "Thousands of handshakes and a good day of local news." } },
      { label: "Soapbox speech only", say: "Twenty minutes on the stage, then back on the road.", out: { days: 0.5, buzz: 4, st: { issue: "econ", pos: R ? 0.5 : -0.5, sal: 0.6 }, t: "A solid speech to a sunburned crowd." } },
      { label: "Skip it", say: "Spend the day raising money instead.", out: { days: 0, cash: Math.round(c.weekly * 0.15), fx: -0.03, fxLabel: "Rural voters", t: "The local paper noticed you were not there." } }] },
    { id: "su:parade", kind: "scenario", title: "A small town parade", prompt: "A county parade committee invites you to march, and so is your opponent's team. The fire trucks go first.", opts: [
      { label: "March and hand out candy", say: "Walk the route with a volunteer float.", out: { days: 0.5, vol: 40, enth: 2, t: "Kids loved the float. Parents took the yard signs." } },
      { label: "Send volunteers", say: "Your float, without you.", out: { days: 0, vol: 15, t: "Fine, but people asked where you were." } }] },
    { id: "su:recess", kind: "scenario", title: "August recess town halls", prompt: "Congress is home for August and every town hall in the state is packed. Activists from both sides are showing up with phones out.", opts: [
      { label: "Hold an open town hall", say: "No screening, no time limit.", out: { days: 0.5, st: { pos: 0, tone: "calm", extra: ["Independent"] }, risk: 0.3, riskT: "A shouting match with a heckler went viral. The clip cut both ways.", riskFx: -0.06, buzz: 8, t: "Two hours of questions. Independents liked that you showed up." } },
      { label: "Tele town hall", say: "A phone call with ten thousand voters, screened questions.", out: { days: 0.5, st: { pos: 0, tone: "calm", sal: 0.6 }, t: "Safe and useful." } },
      { label: "Skip them", say: "Do private events instead.", out: { days: 0, fx: -0.04, fxLabel: "Independents", t: "The opponent ran a where is my senator style ad." } }] },
    { id: "su:hire", kind: "scenario", title: "A top operative is on the market", prompt: "A field director who ran a winning statewide race two years ago is free and talking to both campaigns.", opts: [
      { label: "Hire them now", say: "Pay their price before the other side does.", out: { cash: -90000, vol: 120, t: "They brought their old precinct captains with them." } },
      { label: "Pass", say: "Your team is set.", out: { days: 0, t: "They signed with a super PAC instead." } }] },
  ];
  return cards.find((e) => !s.used.includes(e.id)) ?? null;
}

/** Hard calls campaigns really face, labeled as scenarios: each choice has a price. */
export function dilemmas(c: Ctx): Ev[] {
  const R = c.me.party === "R", w = c.weekly;
  const own = (x: number) => (R ? x : -x);
  return [
    { id: "dl:crypto", kind: "scenario", title: "A crypto super PAC calls", prompt: "Scenario: a super PAC funded by cryptocurrency companies says it will spend millions for you this fall. Its lobbyists also want your support for their market structure bill.", opts: [
      { label: "Welcome the help, promise nothing", say: "Outside groups can spend what they like. You do not coordinate.", out: { outPlus: 4e6, risk: 0.22, riskT: "A watchdog report tied the money to the bill, and your opponent ran with it.", riskFx: -0.1, t: "The super PAC booked its first flight of ads for you." } },
      { label: "Endorse their bill", say: "Say the bill is good policy and you would vote for it.", out: { outPlus: 9e6, st: { issue: "corruption", pos: own(0.3), sal: 0.6 }, risk: 0.35, riskT: "The pledge became the story: bought and paid for.", riskFx: -0.16, t: "The group doubled its buy." } },
      { label: "Ask them to stay out", say: "Say publicly you do not want their money.", out: { buzz: 6, fx: 0.03, fxLabel: "Voters who distrust big money", t: "A good day with reformers; the money went elsewhere." } }] },
    { id: "dl:foreign", kind: "scenario", title: "A check you cannot cash", prompt: "Scenario: your finance director flags a $50,000 bundle at last night's fundraiser. Most of it came from a businessman who is not a citizen or green card holder. Federal law bans it.", opts: [
      { label: "Refund it and report it", say: "Return every dollar today and tell the FEC.", out: { cash: -50000, t: "Your lawyers handled it. Nobody wrote a story about a campaign following the law." } },
      { label: "Keep it quiet", say: "Nobody will notice.", out: { risk: 0.55, riskT: "A reporter matched the donor to a corporate filing abroad. Now it is a federal complaint and a week of bad headlines.", riskFx: -0.38, riskCash: -150000, t: "For now, the money is in the bank." } }] },
    { id: "dl:deepfake", kind: "scenario", title: "A fake video of you", prompt: "Scenario: an AI made video of you saying something you never said is spreading in group chats and on social media. It looks real.", opts: [
      { label: "Rapid response with proof", say: "Forensic experts, a press call and a takedown request the same day.", cash: 40000, out: { fx: -0.02, buzz: 4, t: "Most outlets called it fake by evening. Some people will always believe it." } },
      { label: "Turn it into a fundraiser", say: "Email your list: they are lying about you.", out: { cash: Math.round(w * 0.3), fx: -0.05, buzz: 6, t: "Donors rallied. The video kept spreading." } },
      { label: "Ignore it", say: "Do not give it oxygen.", out: { fx: -0.1, fxLabel: "Voters who saw the video", t: "It reached more people than your ads did that week." } }] },
    { id: "dl:strike", kind: "scenario", title: "A strike at the biggest plant", prompt: "Scenario: workers at the largest manufacturer in the state walked out over pay and pensions. Both sides want you on their side by the evening news.", opts: [
      { label: "Walk the picket line", say: "Bring coffee and stand with the workers.", out: { days: 0.5, vol: R ? 30 : 120, st: { issue: "econ", pos: -0.35, extra: ["No college degree"] }, t: "The union posted the photo everywhere." } },
      { label: "Call for a fair deal", say: "Urge both sides back to the table.", out: { st: { issue: "econ", pos: 0, tone: "calm" }, t: "Nobody loved it. Nobody hated it." } },
      { label: "Side with the company", say: "Say the strike threatens jobs and the state's economy.", out: { st: { issue: "econ", pos: 0.55, extra: ["College graduate"] }, cash: Math.round(w * 0.2), t: "Business groups noticed, and so did the strikers." } }] },
    { id: "dl:taxes", kind: "scenario", title: "Release your tax returns?", prompt: `Scenario: ${c.op.name} released ten years of tax returns and dared you to do the same.`, opts: [
      { label: "Release them all", say: "Ten years, today.", out: { fx: 0.03, risk: 0.2, riskT: "Reporters found a deduction that looked bad out of context.", riskFx: -0.08, t: "A one day story, mostly good." } },
      { label: "Release two years", say: "Enough to answer the question.", out: { fx: 0, risk: 0.3, riskT: "The question became what are you hiding.", riskFx: -0.07, t: "Half an answer." } },
      { label: "Refuse", say: "Say your finances are in your disclosure forms.", out: { fx: -0.08, fxLabel: "Independents", t: "It became an ad." } }] },
    { id: "dl:rival", kind: "scenario", title: "Your primary rival will not endorse", prompt: "Scenario: the candidate you beat in the primary still has not endorsed you, and their voters are watching.", opts: [
      { label: "Give them a policy win", say: "Adopt one of their signature ideas.", out: { enth: 5, vol: 80, st: { pos: own(0.9), sal: 0.5 }, t: "They endorsed you at a joint rally." } },
      { label: "Ask quietly", say: "A private dinner, no concessions.", out: { days: 0.5, enth: 2, risk: 0.5, riskT: "They endorsed you after all.", riskFx: 0.05, t: "They said they would think about it." } },
      { label: "Move on", say: "You won; their voters will come home.", out: { enth: -3, t: "Some of their voters are still on the fence." } }] },
    { id: "dl:ally", kind: "scenario", title: "A scandal in your own party", prompt: `Scenario: a ${R ? "Republican" : "Democratic"} state official is accused of steering contracts to a donor. Reporters want to know if you think they should resign.`, opts: [
      { label: "Call for resignation", say: "Corruption is corruption, whatever the party.", out: { fx: 0.06, fxLabel: "Independents", enth: -2, t: "Editorial boards praised you. Some party loyalists did not." } },
      { label: "Let the process play out", say: "Wait for the facts.", out: { fx: -0.02, t: "It followed you to every event that week." } },
      { label: "Defend them", say: "Call it a political hit job.", out: { enth: 2, fx: -0.07, risk: 0.3, riskT: "More documents came out the next day.", riskFx: -0.1, t: "The base cheered." } }] },
    { id: "dl:robocall", kind: "scenario", title: "AI phone banking, at a discount", prompt: "Scenario: a vendor offers AI voice calls to a million voters for a tenth of what a phone bank costs. In 2024 the FCC ruled that AI generated voices in robocalls fall under the federal robocall law.", opts: [
      { label: "Use it anyway", say: "It is cheap and nobody will check.", out: { cash: -30000, pers: 0.2, region: c.r.counties.slice(0, 6).map((x) => x[0]), risk: 0.45, riskT: "An FCC complaint and a front page story about illegal AI robocalls.", riskFx: -0.2, riskCash: -120000, t: "A million calls went out overnight." } },
      { label: "Hire a real phone bank", say: "Pay humans to call, legally.", out: { cash: -120000, vol: 30, enth: 2, t: "Slower and pricier, and clean." } },
      { label: "Pass", say: "Not worth the risk.", out: { t: "Your volunteers kept calling the old way." } }] },
    { id: "dl:bus", kind: "scenario", title: "The bus broke down", prompt: "Scenario: the campaign bus threw a rod outside a truck stop. Tomorrow's stops are in jeopardy.", opts: [
      { label: "Rent a new one tonight", say: "Pay whatever it costs.", out: { cash: -30000, t: "Back on the road by morning." } },
      { label: "Make it a moment", say: "Livestream from the truck stop diner while you wait.", out: { days: 1, buzz: 9, enth: 1, t: "The truckers loved it, and so did the internet." } }] },
  ];
}

const isFuentes = (n: string) => /fuentes/i.test(n);
/** An endorsement nobody wants. Real when the Watchdog has the streamer talking about this race; otherwise a scenario. */
export function fringeEv(c: Ctx): Ev | null {
  const R = c.me.party === "R";
  const real = (c.r.net?.attention ?? []).find((a) => isFuentes(a.who));
  const id = "fringe";
  const hurtsMe = (o: { label: string; say: string; out: MeetOut }) => o;
  if (real) {
    const note = real.notes.join(" ");
    if (R) return { id, kind: "fringe", real: true, src: real.src, title: "Nick Fuentes is campaigning against you", prompt: `Nick Fuentes, the white nationalist livestreamer, has made your race his cause. ${note} Reporters want to know what you will do about it.`, opts: [
      hurtsMe({ label: "Condemn him by name", say: "Call him a bigot and say you do not want votes from people who follow him.", out: { st: { pos: 0.2, tone: "calm", extra: ["Independent", "College graduate"] }, buzz: 6, enth: -1, t: "Most of the party backed you. His followers flooded your comments." } }),
      hurtsMe({ label: "Ignore him", say: "Do not give him oxygen.", out: { fx: -0.02, t: "His posts kept drawing millions of views, and the press kept asking." } }),
      hurtsMe({ label: "Mock him on camera", say: "A fiery line about losers in their basements.", out: { buzz: 12, enth: 2, st: { pos: 0.4, tone: "fiery" }, risk: 0.25, riskT: "The back and forth dragged on for days, and none of it was about your plans.", riskFx: -0.08, t: "The clip did numbers." } }),
      hurtsMe({ label: "Court his followers", say: "Say you want every vote and some of his points have merit.", out: { fx: -0.55, fxLabel: "Moderates and independents", enth: 2, buzz: 20, quit: true, cash: -Math.round(c.weekly * 0.5), t: "Party leaders condemned you, donors called to cancel and it led the national news." } })] };
    return { id, kind: "fringe", real: true, src: real.src, title: "Nick Fuentes is telling his followers to vote for you", prompt: `Nick Fuentes, the white nationalist livestreamer, is urging his followers to vote for you as a protest against ${c.op.name}. ${note} ${c.op.name}'s allies are already asking if you welcome it.`, opts: [
      hurtsMe({ label: "Reject his support loudly", say: "Say you do not want and will not accept the support of a bigot.", out: { st: { pos: -0.2, tone: "calm", extra: ["Independent"] }, buzz: 5, t: "A clean answer. The story died in a day." } }),
      hurtsMe({ label: "Stay quiet", say: "It is a distraction from your message.", out: { risk: 0.45, riskT: `${c.op.name}'s allies cut an ad asking why you would not reject him.`, riskFx: -0.1, t: "You stayed on message, for now." } }),
      hurtsMe({ label: "Welcome every voter", say: "Say you will take votes from anyone.", out: { fx: -0.4, fxLabel: "Your base and independents", enth: -5, quit: true, t: "Your own party was furious, and it became the story of the race." } })] };
  }
  if (R) return { id, kind: "fringe", title: "Nick Fuentes wants you on his stream", prompt: "Scenario, not a real event in this race: Nick Fuentes, the white nationalist livestreamer, praised you on his show, offered his endorsement and invited you on for an hour. Half the internet is waiting to see what you say.", opts: [
    hurtsMe({ label: "Decline quietly", say: "No interview, no comment.", out: { risk: 0.4, riskT: "Reporters asked why you would not denounce him, and the question followed you for days.", riskFx: -0.07, t: "You stayed out of it." } }),
    hurtsMe({ label: "Denounce him publicly", say: "Reject the endorsement and call out his views by name.", out: { st: { pos: 0.25, tone: "calm", extra: ["Independent", "Moderate"] }, buzz: 6, enth: -1, t: "Editorials praised you. His followers spent a week attacking you online." } }),
    hurtsMe({ label: "Say you do not know who he is", say: "Laugh it off.", out: { risk: 0.5, riskT: "A reporter found your old post quoting him. Now you look evasive and he has a new clip.", riskFx: -0.16, t: "It bought you a day." } }),
    hurtsMe({ label: "Go on the stream", say: "An hour, live, with the chat running.", out: { fx: -0.85, fxLabel: "Moderates, independents and suburban women", enth: 3, buzz: 25, quit: true, cash: -Math.round(c.weekly * 0.8), oppEnth: 6, t: "It led every national broadcast. The party's Senate leaders condemned you, two endorsers withdrew, big donors canceled events and the other side's turnout operation had its best fundraising day of the year." } })] };
  return { id, kind: "fringe", title: "A far left streamer wants you on", prompt: "Scenario, not a real event in this race: a far left livestreamer with a huge young audience, and a record of excusing political violence and antisemitic remarks, praised you and invited you on. Your youth director loves it. Your pollster does not.", opts: [
    hurtsMe({ label: "Decline quietly", say: "No interview, no comment.", out: { risk: 0.35, riskT: `${c.op.name} asked why you will not condemn him, and it stuck for a few days.`, riskFx: -0.06, t: "You stayed out of it." } }),
    hurtsMe({ label: "Denounce his comments", say: "Say there is no place for that, then talk to young voters on your own terms.", out: { st: { pos: -0.2, tone: "calm", extra: ["Independent", "Moderate"] }, buzz: 5, enth: -1, t: "Moderates noticed. His fans called you a sellout." } }),
    hurtsMe({ label: "Go on and push back", say: "Do the show and challenge him on air.", out: { buzz: 18, enth: 2, risk: 0.45, riskT: "A two second clip of you laughing along went everywhere without the pushback.", riskFx: -0.25, t: "Millions watched. Some of it went well." } }),
    hurtsMe({ label: "Go on and play along", say: "Friendly hour, no pushback.", out: { fx: -0.7, fxLabel: "Moderates, independents and Jewish voters", enth: 4, buzz: 24, quit: true, cash: -Math.round(c.weekly * 0.6), oppEnth: 5, t: "It became the defining story of your race, and not in a good way." } })] };
}

/** A celebrity wants in. Fun, fast and occasionally a liability. */
function starEv(c: Ctx, s: State): Ev | null {
  const R = c.me.party === "R";
  const stars = R ? ["a country music star who grew up in the state", "a former NFL lineman turned sports radio host", "a UFC champion with a huge young following"] : ["a pop star with a hundred million followers", "a beloved actor who grew up in the state", "an NBA legend from the state's flagship school"];
  const who = stars[(s.seed >>> 3) % stars.length];
  return { id: "star", kind: "star", title: "A celebrity wants to endorse you", prompt: `Scenario: ${who} wants to endorse you and is offering to headline an event. Celebrities move young and casual voters, and say unscripted things.`, opts: [
    { label: "Headline a rally", say: "A concert sized rally in the biggest city.", out: { days: 1, buzz: 18, enth: 5, vol: 180, st: { pos: 0, extra: ["18 to 29"], sal: 0.7 }, risk: 0.2, riskT: "The star went off script about the other party's voters, and that became the clip.", riskFx: -0.1, t: "Thousands showed up, and the line to register went around the block." } },
    { label: "A video and a post", say: "Cut a vertical video for their feeds.", out: { buzz: 9, cash: Math.round(c.weekly * 0.15), t: "Millions of views and a burst of small donations." } },
    { label: "Thanks, but no", say: "Keep the focus on the state.", out: { t: "Their fans did not notice." } }] };
}
