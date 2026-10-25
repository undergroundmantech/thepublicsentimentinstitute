// The decisions a campaign faces each week. Issue questions are the ones reporters and voters are asking this fall;
// the race's own events come from the On Point news desk and from the people files, where each candidate's real
// message and the vulnerabilities opponents are running on are written down with sources.
// A stance's pos runs from -1, the most progressive answer, to +1, the most conservative; trump runs from -1, distance
// from the president, to +1, embrace. How voters take it is worked out in engine.react from the race's own voter data.
import { type Ctx, type State, type Part, type Ev, type Stance, react, applyGlobal, usd, DIFF, rand, gauss, weekOf, POLLSTERS } from "./engine";
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
  const fit = R.storylines.map((x, k) => ({ x, k, w: weekOf(x.date) })).filter((y) => y.w != null && y.w <= s.week && !s.flashes.includes(`flash:${y.k}`))
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
  const w = s.week;
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
  if (o.days) s.days = Math.max(0, s.days - o.days);
  let fx = 0, parts: Part[] = [], t = "";
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
    if (declined) out.push(chairEv(c)); else out.push(...debateQs(c, s));
  } else { const e = eventFor(c, s); if (e) out.push(e); }
  const f = flashFor(c, s); if (f) out.push(f);
  if (s.week >= 2 && rand(s) < 0.22) { const sc = SCENARIOS.filter((x) => !s.used.includes(x.id)); if (sc.length) out.push(sc[Math.floor(rand(s) * sc.length)]); }
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
