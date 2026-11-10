// Campaign 2028, the senior staff. Every Monday one department head brings the candidate a briefing built from the
// campaign's own numbers: the polling team's crosstabs and tipping point, the field team's doors and offices, the
// early vote team's ballot returns, communications, finance, digital, coalitions, research, the lawyers and the
// schedulers. Each briefing ends with a decision, and decisions set flags the story remembers. The candidate can also
// call any department in for half a day.
import type { Data, GenS, Res } from "./engine28";
import * as E from "./engine28";
import * as X2 from "./deep28";
import { storyOf, queue } from "./story28";
import { moraleAfter } from "./more28";

export type Dept = "polling" | "field" | "early" | "comms" | "finance" | "digital" | "coalitions" | "research" | "legal" | "advance";
export const DEPTS: Record<Dept, { name: string; role: string; blurb: string }> = {
  polling: { name: "Polling and analytics", role: "Chief pollster", blurb: "Crosstabs, the tipping point and where your read is stale." },
  field: { name: "Field operations", role: "Field director", blurb: "Volunteers, doors, offices and where organizers go." },
  early: { name: "Early vote and ballot ops", role: "Early vote director", blurb: "Mail ballot requests, returns, cures and the chase." },
  comms: { name: "Communications", role: "Communications director", blurb: "Debate negotiations, rapid response and the press." },
  finance: { name: "Finance", role: "Finance director", blurb: "Burn rate, runway and where the next dollar comes from." },
  digital: { name: "Digital", role: "Digital director", blurb: "Email, texting, creators and relational organizing." },
  coalitions: { name: "Coalitions", role: "Coalitions director", blurb: "The groups you are winning, losing and fighting over." },
  research: { name: "Research", role: "Research director", blurb: "The file on your opponent and the file on you." },
  legal: { name: "Legal and voter protection", role: "General counsel", blurb: "Ballot rules, lawsuits and poll watchers." },
  advance: { name: "Scheduling and advance", role: "Scheduling director", blurb: "Where the candidate and the surrogates go." },
};
const FIRST: [string, boolean][] = [["Dana", true], ["Marcus", false], ["Priya", true], ["Luis", false], ["Keisha", true], ["Tom", false], ["Ana", true], ["Jordan", false], ["Mei", true], ["Caleb", false],
  ["Rosa", true], ["Devin", false], ["Hannah", true], ["Omar", false], ["Grace", true], ["Wes", false], ["Tasha", true], ["Ben", false], ["Nadia", true], ["Eli", false]];
const LAST = ["Okafor", "Reyes", "Brennan", "Whitaker", "Nguyen", "Delgado", "Sorensen", "Haddad", "Castillo", "Lindqvist", "Abernathy", "Moreno", "Kowalski", "Baptiste", "Yamada", "Fitzgerald", "Osei", "Marsh", "Pruitt", "Albright"];
const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
/** The department head, the same person all campaign. */
export function headOf(s: { me: string; mo?: { hires: Record<string, number> } }, dept: Dept) {
  const k = Object.keys(DEPTS).indexOf(dept); const n = s.mo?.hires?.[dept] ?? 0; const h = hash(`${s.me}:${dept}${n ? `:${n}` : ""}`);
  const [f, fem] = FIRST[(h + k * 7) % FIRST.length]; const l = LAST[(Math.floor(h / 97) + k * 3) % LAST.length];
  return { n: `${f} ${l}`, female: fem, seed: h % 100000 };
}

export type MOpt = { label: string; note: string; act: string; arg?: string; cost?: number; days?: number };
export type Row = { l: string; v: string; tone?: "up" | "dn" };
export type Meeting = { dept: Dept; w: number; title: string; say: string; rows: Row[]; opts: MOpt[]; done?: string; called?: boolean };

const si = (d: Data, st: string) => d.states.findIndex((x) => x.st === st);
const sizeK = (d: Data, i: number) => 3.2 / Math.sqrt(4 + d.states[i].ev);
const lead = (m: number) => (Math.abs(m) < 0.05 ? "even" : m > 0 ? `up ${m.toFixed(1)}` : `down ${Math.abs(m).toFixed(1)}`);
const signed = (m: number) => `${m >= 0 ? "+" : ""}${m.toFixed(1)}`;
const list = (a: string[]) => (a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`);
function battle(d: Data, s: GenS, n = 12) {
  const ms = E.readMargins(d, s);
  return d.states.map((x, i) => ({ x, i, m: ms[i], w: x.ev / (1 + Math.abs(ms[i]) ** 1.4) })).filter((r) => !r.x.st.includes("-")).sort((a, b) => b.w - a.w).slice(0, n);
}
function tipping(d: Data, s: GenS) {
  const ms = E.readMargins(d, s); const o = d.states.map((x, i) => ({ x, i, m: ms[i] })).sort((a, b) => b.m - a.m); let a = 0;
  for (const r of o) { a += r.x.ev; if (a >= 270) return r; } return o[0];
}
function groupRead(d: Data, s: GenS) {
  return X2.groupsOf(d).filter((g) => g.fam !== "Vote history").map((g) => { const base = s.party === "D" ? g.us[1] : 100 - g.us[1]; const now = X2.groupShare(d, s, g); return { g, base, now, dlt: now - base }; });
}
const surOf = (n: string) => n.split(" ").slice(-1)[0];

/** Which department most needs the candidate this week. */
export function pickDept(d: Data, s: GenS, G: { rng: number }): Dept {
  const g = X2.toGo(s); const F = storyOf(s).flags; const met = s.metDept ?? {};
  const B = battle(d, s, 12); const stale = B.filter((r) => { const a = E.pollAge(s, r.x.st); return a == null || a >= 2; }).length;
  const firstDeb = s.debates.find((x) => x.kind === "pres" && !x.done);
  const runway = s.cash / Math.max(1, s.spentLast ?? 0);
  const sc: Record<Dept, number> = {
    polling: 1 + stale / 5, field: 1 + (B.slice(0, 6).some((r) => !s.offices.includes(r.x.st)) ? 0.6 : 0), early: g <= 8 ? 2.4 : 0,
    comms: F.debateDeal == null && firstDeb && s.week < firstDeb.w ? 4 : 1, finance: runway < g ? 3 : 0.8, digital: 0.8,
    coalitions: 1 + (s.opFocus?.length ? 0.4 : 0), research: 0.9 + ((s.oppo ?? []).length ? 0 : 0.4), legal: g <= 6 && !s.lawyers ? 2.2 : 0, advance: s.stamina < 40 ? 2.2 : 0.8,
  };
  // the debate schedule has to be settled before the first debate
  if (sc.comms === 4 && firstDeb && s.week >= firstDeb.w - 3) return "comms";
  const keys = (Object.keys(sc) as Dept[]).filter((k) => sc[k] > 0 && !(met[k] != null && s.week - met[k] < 3));
  if (!keys.length) return "polling";
  const w = keys.map((k) => sc[k] ** 2); const t = w.reduce((a, b) => a + b, 0); let r = E.rand(G) * t;
  for (let k = 0; k < keys.length; k++) { r -= w[k]; if (r <= 0) return keys[k]; }
  return keys[0];
}

/** Build the department's briefing from the campaign's numbers. */
export function brief(d: Data, s: GenS, dept: Dept): Meeting {
  const F = storyOf(s).flags; const g = X2.toGo(s); const B = battle(d, s, 12); const T = tipping(d, s); const op = surOf(s.op);
  const M: Meeting = { dept, w: s.week, title: DEPTS[dept].name, say: "", rows: [], opts: [] };
  const none: MOpt = { label: "Thanks. Nothing new this week", note: "Free", act: "none" };
  if (dept === "polling") {
    const stale = B.filter((r) => { const a = E.pollAge(s, r.x.st); return a == null || a >= 2; });
    const gr = groupRead(d, s).filter((x) => x.g.us[0] >= 4); const lost = gr.slice().sort((a, b) => a.dlt - b.dlt); const won = gr.slice().sort((a, b) => b.dlt - a.dlt)[0];
    const swing = gr.slice().sort((a, b) => Math.abs(a.now - 50) - Math.abs(b.now - 50))[0];
    M.title = "The numbers meeting";
    M.say = `${T.x.n} is the tipping point and we are ${lead(T.m)} there. ${stale.length === 0 ? "Every battleground has a fresh poll." : `${stale.length >= B.length ? `None of our ${B.length} battlegrounds has` : `${stale.length} of our ${B.length} battlegrounds have not`} been polled in the last two weeks, so our read there could be off by two or three points.`} ${lost[0].dlt < -0.5 ? `The crosstabs worry me on ${lost[0].g.l.toLowerCase()}.` : "The crosstabs look stable."}`;
    M.rows = [
      { l: "Tipping point", v: `${T.x.st} ${signed(T.m)}`, tone: T.m >= 0 ? "up" : "dn" },
      { l: "Stale battlegrounds", v: stale.length ? stale.slice(0, 6).map((r) => r.x.st).join(" ") : "None" },
      ...lost.slice(0, 2).map((x) => ({ l: x.g.l, v: `${x.now.toFixed(0)}% · ${signed(x.dlt)} against the model`, tone: (x.dlt >= 0 ? "up" : "dn") as "up" | "dn" })),
      { l: won.g.l, v: `${won.now.toFixed(0)}% · ${signed(won.dlt)} against the model`, tone: won.dlt >= 0 ? "up" : "dn" },
      { l: "Most persuadable", v: `${swing.g.l}, ${swing.now.toFixed(0)}% yours` },
    ];
    const wave = Math.round(1.8e6 * E.mgrOf(s).poll * (s.staff?.pollster ? 0.8 : 1));
    M.opts = [
      { label: `Field a poll wave in ${list(B.slice(0, 6).map((r) => r.x.st))}`, note: `${E.usd(wave)} · sharp read for two weeks`, act: "wave", cost: wave },
      { label: "Run a message test before your next big answer", note: "$500K · your next stance or debate lands 20 percent harder", act: "msgtest", cost: 500e3 },
      { label: `Move $6M of contrast ads into ${T.x.n}`, note: "$6M · the tipping point", act: "tip", arg: T.x.st, cost: 6e6 },
      none,
    ];
  }
  if (dept === "field") {
    const noOff = B.filter((r) => !s.offices.includes(r.x.st)); const safe = s.offices.filter((st) => { const i = si(d, st); return Math.abs(E.readMargins(d, s)[i]) > 9; });
    const low = B.slice(0, 8).sort((a, b) => (s.gused?.[`can:${a.x.st}`] ?? 0) - (s.gused?.[`can:${b.x.st}`] ?? 0) || b.w - a.w)[0];
    M.title = "Field operations";
    M.say = `We have ${(s.vol ?? 0).toLocaleString("en-US")} volunteers and ${(s.contacts ?? 0).toLocaleString("en-US")} doors knocked. ${noOff.length ? `${list(noOff.slice(0, 3).map((r) => r.x.n))} still have no coordinated field program.` : "Every battleground has a field program."} ${safe.length ? `We are still paying organizers in ${list(safe.map((st) => E.nameOf(d, st)))}, which is not close.` : ""}`;
    M.rows = [{ l: "Volunteers", v: (s.vol ?? 0).toLocaleString("en-US") }, { l: "Doors knocked", v: (s.contacts ?? 0).toLocaleString("en-US") }, { l: "Field programs", v: s.offices.length ? s.offices.join(" ") : "None" }, { l: "No program yet", v: noOff.slice(0, 6).map((r) => r.x.st).join(" ") || "None" }];
    M.opts = [];
    if (noOff[0]) M.opts.push({ label: `Open a field program in ${noOff[0].x.n}`, note: "$2.5M · pays every week", act: "office", arg: noOff[0].x.st, cost: 2.5e6 });
    if (low) M.opts.push({ label: `Weekend of action in ${low.x.n}`, note: (s.vol ?? 0) >= 2000 ? "No candidate time · uses the volunteers" : "Needs 2,000 volunteers", act: "canvass", arg: low.x.st });
    if (safe[0] && noOff[0]) M.opts.push({ label: `Move the organizers in ${E.nameOf(d, safe[0])} to ${noOff[0].x.n}`, note: "Free · the local party will grumble", act: "move", arg: `${safe[0]}>${noOff[0].x.st}` });
    M.opts.push({ label: "Fund a volunteer training program", note: `$1M · about ${s.staff?.field ? "3,500" : "2,500"} new volunteers`, act: "train", cost: 1e6 });
    M.opts.push(none);
  }
  if (dept === "early") {
    const open = X2.earlyOpen(s); M.title = open ? "Ballot returns" : "Getting ready for early voting";
    if (!open) {
      const mail = B.filter((r) => X2.earlyOf(r.x.st) >= 0.6).slice(0, 3); const bk = blackHeavy(d, B);
      M.say = `Early voting opens in week ${s.weeks - X2.EARLY_FROM + 1}. ${list(mail.map((r) => r.x.n))} vote mostly before Election Day, and every ballot request we bank now is a vote we do not have to chase in the final week.`;
      M.rows = mail.map((r) => ({ l: r.x.n, v: `${Math.round(X2.earlyOf(r.x.st) * 100)}% vote early · ${signed(r.m)}`, tone: r.m >= 0 ? "up" : "dn" }));
      M.opts = [{ label: `Mail ballot request drive in ${list(mail.map((r) => r.x.st))}`, note: "$3M · counts once voting opens", act: "apps", arg: mail.map((r) => r.x.st).join(","), cost: 3e6 }];
      if (bk.length) M.opts.push({ label: `Plan Souls to the Polls with Black churches in ${list(bk.map((r) => r.x.n))}`, note: "$1.5M · buses after Sunday services", act: "souls", arg: bk.map((r) => r.x.st).join(","), cost: 1.5e6 });
      M.opts.push({ label: "Rides to early voting for seniors in the three closest states", note: "$1.5M", act: "seniors", arg: B.slice(0, 3).map((r) => r.x.st).join(","), cost: 1.5e6 }, none);
    } else {
      const ret = B.slice(0, 8).map((r) => { const b = X2.bankOf(s, r.i); return { ...r, b, rate: b.cast / Math.max(0.05, Math.min(0.95, X2.earlyOf(r.x.st))) }; });
      const worst = ret.filter((r) => r.b.cast > 0).sort((a, b) => a.b.m - b.b.m)[0] ?? ret[0];
      const lb = (s.ballots ?? 0) > 0 ? (s.ballotsM ?? 0) / (s.ballots ?? 1) : 0;
      M.say = `${((s.ballots ?? 0) / 1e6).toFixed(1)} million ballots are in and we lead among them by ${lb.toFixed(1)}. That is not the same as winning: early voters lean Democratic, so ${s.party === "D" ? "we need a cushion before Election Day voters show up" : "we only need to keep it close before our Election Day voters show up"}. Our weakest return is in ${worst.x.n}.`;
      M.rows = ret.slice(0, 5).map((r) => ({ l: r.x.n, v: `${Math.round(r.rate * 100)}% of early vote in · ${r.b.cast > 0 ? signed(r.b.m) : "none yet"}`, tone: r.b.m >= 0 ? "up" : "dn" }));
      M.opts = [
        { label: `Chase every unreturned ballot in ${worst.x.n}`, note: "$4M", act: "chase", arg: worst.x.st, cost: 4e6 },
        { label: `Ballot cure teams in ${list(B.slice(0, 3).map((r) => r.x.st))}`, note: "$2.5M · fixes rejected signatures", act: "cure", arg: B.slice(0, 3).map((r) => r.x.st).join(","), cost: 2.5e6 },
        { label: "Text every supporter who has not voted yet", note: `$1M${s.staff?.digital ? " · your digital director doubles it" : ""}`, act: "text", cost: 1e6 },
        { label: "Save it for Election Day turnout in the states that vote late", note: "$3M", act: "eday", arg: B.filter((r) => X2.earlyOf(r.x.st) < 0.6).slice(0, 3).map((r) => r.x.st).join(","), cost: 3e6 },
        none,
      ];
    }
  }
  if (dept === "comms") {
    const firstDeb = s.debates.find((x) => x.kind === "pres" && !x.done); const win = E.winProb(d, s, 200);
    if (F.debateDeal == null && firstDeb && s.week < firstDeb.w) {
      M.title = "Debate negotiations";
      M.say = `The commission has proposed ${s.debates.filter((x) => x.kind === "pres").length} presidential debates and one for the running mates. ${op}'s people will agree to whatever we do not want. ${win > 0.55 ? "We are ahead, and fewer debates means fewer chances to lose it." : win < 0.45 ? "We are behind, and the stage is our best shot at moving this." : "It is close, and these nights could decide it."}`;
      M.rows = [...s.debates.map((x) => ({ l: `Week ${x.w}`, v: x.kind === "vp" ? "Running mates" : "Presidential" })), { l: "Your prep sessions", v: String(s.prep) }, { l: "Win chance", v: `${Math.round(win * 100)}%`, tone: win >= 0.5 ? "up" : "dn" }];
      M.opts = [
        { label: "Accept the commission's schedule", note: "Free · looks confident", act: "deb_accept" },
        { label: "Insist on a town hall format for the first debate", note: "Free · one extra prep session", act: "deb_hall" },
        { label: "Push to drop the final debate", note: win > 0.5 ? "Protects a lead · they will call you scared" : "Risky when you are behind", act: "deb_drop" },
        { label: "Challenge them to a fourth debate", note: "They may say no, and that helps you", act: "deb_add" },
      ];
    } else {
      const foc = (s.opFocus ?? []).map((k) => X2.groupsOf(d).find((x) => x.k === k)?.l.toLowerCase()).filter(Boolean) as string[];
      M.title = "Rapid response";
      M.say = `${op} spent last week in ${list(s.opVisits.map((st) => E.nameOf(d, st)))}${foc.length ? ` and went after ${list(foc)}` : ""}. They have ${E.usd(s.opCash)} in the bank. ${F.prebuttal ? "Our prebuttal file is ready for their next hit." : "We have nothing ready for their next attack."}`;
      M.rows = [{ l: `${op} visited`, v: s.opVisits.join(" ") || "Nowhere" }, { l: "Their cash", v: E.usd(s.opCash) }, { l: "Their target groups", v: foc.length ? list(foc) : "Unknown" }, { l: "National polls", v: s.natPolls.length ? signed(s.natPolls[s.natPolls.length - 1].m) : "None yet" }];
      M.opts = [
        { label: "Build a prebuttal file for their next attack", note: "$500K · softens the next crisis", act: "prebut", cost: 500e3 },
        { label: "Book the candidate on the Sunday shows", note: "Half a day", act: "sunday", days: 1 },
        { label: `Fact check ${op}'s ads in ${list(s.opVisits.slice(0, 3))}`, note: "$1M · their ads lose some punch there", act: "factcheck", arg: s.opVisits.slice(0, 3).join(","), cost: 1e6 },
        none,
      ];
    }
  }
  if (dept === "finance") {
    const burn = s.spentLast ?? 0; const runway = s.cash / Math.max(1, burn);
    const tm = X2.marketsFor(d, T.x.st)[0]?.m;
    M.title = "The money meeting";
    M.say = `We spent ${E.usd(burn)} last week. At that pace we have ${runway > 30 ? "plenty of" : `about ${runway.toFixed(1)} weeks of`} money with ${g} week${g > 1 ? "s" : ""} to go. ${op} has ${E.usd(s.opCash)}. ${s.cash < s.opCash ? "They will outspend us in the final stretch unless we raise." : "We can match them on the air."}`;
    M.rows = [{ l: "Cash on hand", v: E.usd(s.cash), tone: s.cash >= s.opCash ? "up" : "dn" }, { l: "Spent last week", v: E.usd(burn) }, { l: "Raised in the general", v: E.usd(s.raised ?? 0) }, { l: `${op} cash`, v: E.usd(s.opCash) }];
    M.opts = [
      { label: "Hold a retreat for your biggest bundlers", note: "1 day · big money, and they will want something", act: "bundlers", days: 2 },
      { label: "A small dollar push with a hard deadline", note: "Free · costs some goodwill with the list", act: "smalldollar" },
    ];
    if (tm && s.week < s.weeks) M.opts.push({ label: `Book $8M of final week air in ${tm.n} at today's rate`, note: `$8M · ${X2.rateAt(s).toFixed(2)}x now against ${X2.rateAt(s, s.weeks).toFixed(2)}x then`, act: "reserve", arg: tm.n, cost: 8e6 });
    if (!F.partyMoney) M.opts.push({ label: "Ask the party to fund the coordinated campaign", note: "Once · $6M, and the party picks the message", act: "party" });
    M.opts.push(none);
  }
  if (dept === "digital") {
    const yg = X2.groupsOf(d).filter((x) => x.k.startsWith("young")); const ys = yg.map((x) => X2.groupShare(d, s, x));
    M.title = "Digital";
    M.say = `Our list has about ${Math.round(((s.raised ?? 0) / 38 + 900e3) / 1000).toLocaleString("en-US")} thousand donors. Young voters are ${ys.map((v, k) => `${v.toFixed(0)} percent ours among ${yg[k].l.toLowerCase()}`).join(" and ")}. ${s.staff?.digital ? "The team is fully staffed." : "We still have no digital director."}`;
    M.rows = [{ l: "Volunteers", v: (s.vol ?? 0).toLocaleString("en-US") }, ...yg.map((x, k) => ({ l: x.l, v: `${ys[k].toFixed(0)}%`, tone: (ys[k] >= 50 ? "up" : "dn") as "up" | "dn" }))];
    M.opts = [
      { label: "Launch a relational organizing app", note: "$1.5M · supporters text their own friends", act: "relational", cost: 1.5e6 },
      { label: "Pay online creators to talk about you", note: "$3M · reaches young voters, with some risk", act: "creators", cost: 3e6 },
      { label: `Streaming ads in ${list(B.slice(0, 4).map((r) => r.x.st))}`, note: "$5M · positive ads", act: "stream", arg: B.slice(0, 4).map((r) => r.x.st).join(","), cost: 5e6 },
      none,
    ];
  }
  if (dept === "coalitions") {
    const gr = groupRead(d, s).filter((x) => x.g.us[0] >= 3); const lost = gr.slice().sort((a, b) => a.dlt - b.dlt)[0];
    const foc = (s.opFocus ?? []).map((k) => gr.find((x) => x.g.k === k)).filter(Boolean) as typeof gr;
    const target = foc[0] ?? lost; const where = B.slice(0, 8).sort((a, b) => shareIn(target.g, b.x.st) - shareIn(target.g, a.x.st))[0];
    M.title = "Coalitions";
    M.say = `${foc.length ? `${op} spent last week courting ${list(foc.map((x) => x.g.l.toLowerCase()))}.` : ""} We are at ${target.now.toFixed(0)} percent with ${target.g.l.toLowerCase()}, ${target.dlt >= 0 ? "up" : "down"} ${Math.abs(target.dlt).toFixed(1)} against the model. They are ${Math.round(shareIn(target.g, where.x.st) * 100)} percent of the vote in ${where.x.n}.`;
    M.rows = gr.slice().sort((a, b) => b.g.us[0] - a.g.us[0]).slice(0, 6).map((x) => ({ l: x.g.l, v: `${x.now.toFixed(0)}% · ${signed(x.dlt)}`, tone: x.dlt >= 0 ? "up" : "dn" }));
    M.opts = [
      { label: `Answer ${op} with ads for ${target.g.l.toLowerCase()}`, note: "$2M · in the media they use", act: "gads", arg: target.g.k, cost: 2e6 },
      { label: `Launch ${target.g.l} for ${surOf(s.me)} in ${where.x.n}`, note: "$1M · no candidate time", act: "launch", arg: `${target.g.k}>${where.x.st}`, cost: 1e6 },
    ];
    if (F[`chair:${lost.g.k}`] == null) M.opts.push({ label: `Name a national chair for ${lost.g.l.toLowerCase()}`, note: "Free · once per group", act: "chair", arg: lost.g.k });
    M.opts.push(none);
  }
  if (dept === "research") {
    const file = s.oppo ?? []; const used = file.filter((h) => h.used); const cr = Object.keys(F).filter((k) => k.startsWith("crisis:")).length;
    M.title = "Research";
    M.say = `We have ${file.length} item${file.length === 1 ? "" : "s"} in the file on ${op}, ${used.length} already used. ${F.vetted ? "We have vetted your own record, so we know what is coming." : "We have never vetted your own record. If a reporter finds something before we do, we lose a news cycle."} You have weathered ${cr} scandal${cr === 1 ? "" : "s"} so far.`;
    M.rows = [{ l: "Items in the file", v: String(file.length) }, { l: "Used, landed", v: `${used.length}, ${used.filter((h) => h.hit).length}` }, { l: "Your record vetted", v: F.vetted ? "Yes" : "No", tone: F.vetted ? "up" : "dn" }];
    M.opts = [{ label: `Put the research team on ${op}`, note: "$3M · no candidate time", act: "dig", cost: 3e6 }];
    if (!F.vetted) M.opts.push({ label: "Vet your own record before the press does", note: "$1M · softens the next scandal", act: "vet", cost: 1e6 });
    if (!F.prebuttal) M.opts.push({ label: "Prepare a prebuttal for their next attack", note: "$500K", act: "prebut", cost: 500e3 });
    M.opts.push(none);
  }
  if (dept === "legal") {
    const lw = F.lawsuit ? E.nameOf(d, String(F.lawsuit)) : null; const close = B.slice(0, 3);
    M.title = "Voter protection";
    M.say = `${lw ? `The ballot lawsuit in ${lw} is still live. ` : ""}${s.lawyers ? "Our lawyers and poll watchers are in place." : "We have no election protection operation yet. Long lines and ballot challenges on Election Day will cost us in the close states."} The closest states are ${list(close.map((r) => r.x.n))}.`;
    M.rows = close.map((r) => ({ l: r.x.n, v: `${signed(r.m)} · ${Math.round(X2.earlyOf(r.x.st) * 100)}% vote early`, tone: r.m >= 0 ? "up" : "dn" }));
    M.opts = [];
    if (!s.lawyers) M.opts.push({ label: "Put lawyers and poll watchers in every battleground", note: "$6M", act: "lawyers", cost: 6e6 });
    M.opts.push({ label: "A voter hotline and a cure program", note: "$2M", act: "hotline", arg: close.map((r) => r.x.st).join(","), cost: 2e6 });
    M.opts.push({ label: `Sue to extend early voting hours in ${close[0].x.n}`, note: "$1.5M · a judge may say no", act: "sue", arg: close[0].x.st, cost: 1.5e6 }, none);
  }
  if (dept === "advance") {
    const least = B.slice(0, 8).sort((a, b) => (s.visits[a.x.st] ?? 0) - (s.visits[b.x.st] ?? 0)).slice(0, 3);
    const incumbent = s.party === "R";
    M.title = "The schedule";
    M.say = `Stamina is at ${Math.round(s.stamina)} and there are ${s.days / 2} days left this week. You have barely been to ${list(least.map((r) => r.x.n))}${least.map((r) => s.visits[r.x.st] ?? 0).some((v) => v === 0) ? ", and voters there have noticed" : ""}.`;
    M.rows = least.map((r) => ({ l: r.x.n, v: `${s.visits[r.x.st] ?? 0} visits · ${signed(r.m)}`, tone: r.m >= 0 ? "up" : "dn" })).concat([{ l: "Stamina", v: String(Math.round(s.stamina)), tone: s.stamina >= 40 ? "up" : "dn" }]) as Row[];
    M.opts = [
      { label: `A three day bus tour through ${list(least.map((r) => r.x.st))}`, note: "3 days · $1.5M · heavy on stamina", act: "bus", arg: least.map((r) => r.x.st).join(","), days: 6, cost: 1.5e6 },
      { label: incumbent ? `Send the President to ${least[0].x.n}` : `Send a former president to ${least[0].x.n}`, note: incumbent ? "$800K · fires up the base, and he goes off script" : "$800K · no candidate time", act: "surrogate", arg: least[0].x.st, cost: 800e3 },
      { label: "Block out a day at home", note: "1 day · stamina back", act: "rest", days: 2 },
      none,
    ];
  }
  return M;
}
const shareIn = (g: X2.Grp, st: string) => ((g.st[st] ?? g.st[st.split("-")[0]] ?? g.us)[0]) / 100;
function blackHeavy(d: Data, B: ReturnType<typeof battle>) {
  const bw = X2.groupsOf(d).filter((x) => x.k.startsWith("black")); if (!bw.length) return [];
  return B.slice(0, 8).map((r) => ({ ...r, b: bw.reduce((a, x) => a + shareIn(x, r.x.st), 0) })).filter((r) => r.b >= 0.12).sort((a, b) => b.b - a.b).slice(0, 2);
}

/** Open this week's meeting, or one the candidate called. */
export function openMeeting(d: Data, s: GenS, dept: Dept, called = false): Meeting {
  const m = brief(d, s, dept); m.called = called; s.meeting = m; s.metDept = { ...(s.metDept ?? {}), [dept]: s.week };
  if (called) s.days = Math.max(0, s.days - 1);
  return m;
}

/** Act on the decision. Every act is plain data, so a saved game resumes mid meeting. */
export function decide(d: Data, s: GenS, k: number, G: { rng: number }): Res {
  const m = s.meeting; if (!m) return { ok: false, t: "No meeting." };
  const o = m.opts[k]; const F = storyOf(s).flags; const op = surOf(s.op);
  if ((o.cost ?? 0) > s.cash) return { ok: false, t: `Not enough cash: that costs ${E.usd(o.cost!)}.` };
  if ((o.days ?? 0) > s.days) return { ok: false, t: "Not enough time left this week." };
  const pay = () => { s.cash -= o.cost ?? 0; s.days -= o.days ?? 0; };
  const sts = (o.arg ?? "").split(",").filter(Boolean);
  const done = (t: string, fx = 0): Res => { m.done = o.label; moraleAfter(d, s, m.dept, k, o.act); if (o.act !== "none") storyOf(s).facts = [...storyOf(s).facts.slice(-30), `${DEPTS[m.dept].name}: ${o.label[0].toLowerCase()}${o.label.slice(1)}.`]; return { ok: true, t, fx }; };
  const chaseIn = (st: string, amt: number) => { const i = si(d, st); if (i < 0) return; s.chase = s.chase ?? d.states.map(() => 0); s.chase[i] += amt * (s.staff?.field ? 1.3 : 1); };
  const gst = (st: string, gk: string, v: number) => { for (const g of X2.kidsOf(gk)) { const key = `${st.split("-")[0]}:${g}`; s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + v }; } };
  const gsup = (gk: string, v: number) => { for (const g of X2.kidsOf(gk)) s.gsup = { ...(s.gsup ?? {}), [g]: (s.gsup?.[g] ?? 0) + v }; };
  switch (o.act) {
    case "none": return done("The team goes back to work.");
    case "wave": {
      pay(); const B = battle(d, s, 6); const ms = E.myMargins(d, s); const pollSd = X2.pollSd(s) * E.mgrOf(s).poll;
      const out = B.map((r) => { s.polledW = { ...(s.polledW ?? {}), [r.x.st]: s.week }; if (s.fog) s.fog[r.i] = E.gauss(G) * 0.6 * pollSd; return `${r.x.st} ${signed(ms[r.i] + (s.fog?.[r.i] ?? 0))}`; });
      return done(`Your poll wave is back: ${out.join(", ")}.`);
    }
    case "msgtest": pay(); F.msgTest = 1; return done("The message test is in. Your next big answer is tuned to the voters who matter.");
    case "tip": { pay(); s.cash += o.cost!; const r = E.genTV(d, s, o.arg!, o.cost!, "contrast", G); return r.ok ? done(r.t, r.fx) : r; }
    case "office": { const r = E.genOffice(d, s, o.arg!); return r.ok ? done(r.t, r.fx) : r; }
    case "canvass": { s.days += 2; const r = X2.canvass(d, s, o.arg!); s.days -= 2; return r.ok ? done(`Your field team ran it without you. ${r.t}`, r.fx) : r; }
    case "move": {
      const [from, to] = o.arg!.split(">"); const i = si(d, to); s.offices = [...s.offices.filter((x) => x !== from), to]; s.gotv[i] += 0.3 * sizeK(d, i) * 2 * E.mgrOf(s).field;
      queue(storyOf(s), s.week + 1, "ground_report", { st: to, from }); return done(`Organizers move from ${E.nameOf(d, from)} to ${E.nameOf(d, to)}.`, 0.2);
    }
    case "train": pay(); s.vol = (s.vol ?? 0) + (s.staff?.field ? 3500 : 2500); F.trained = 1; return done(`${s.staff?.field ? "3,500" : "2,500"} new volunteers trained and ready.`);
    case "apps": pay(); for (const st of sts) chaseIn(st, 1.25e6); return done(`Mail ballot request drive in ${list(sts)}. Those requests turn into banked votes once voting opens.`);
    case "souls": pay(); for (const st of sts) { chaseIn(st, 1e6); gst(st, "black", 0.6); } F.souls = 1; return done(`Souls to the Polls is planned in ${list(sts.map((x) => E.nameOf(d, x)))}.`);
    case "seniors": pay(); for (const st of sts) { chaseIn(st, 0.5e6); gst(st, "old", 0.4); } return done(`Rides to early voting for seniors in ${list(sts)}.`);
    case "chase": { pay(); chaseIn(o.arg!, 4e6); return done(`$4M of ballot chase in ${E.nameOf(d, o.arg!)}.`); }
    case "cure": pay(); for (const st of sts) chaseIn(st, 1.2e6); F.cure = 1; return done(`Cure teams are calling every voter whose ballot was flagged in ${list(sts)}.`);
    case "text": { pay(); const B = battle(d, s, 6); for (const r of B) chaseIn(r.x.st, s.staff?.digital ? 0.7e6 : 0.35e6); return done("Every supporter who has not voted in the battlegrounds gets a text today."); }
    case "eday": { pay(); for (const st of sts) { const i = si(d, st); if (i >= 0) s.gotv[i] += 0.18 * sizeK(d, i) * 2; } return done(`Election Day turnout money set aside for ${list(sts)}.`, 0.1); }
    case "deb_accept": F.debateDeal = "accept"; s.nat += 0.03; return done("You accept the schedule. The press calls you confident.", 0.03);
    case "deb_hall": F.debateDeal = "hall"; s.prep += 1; return done("The first debate will be a town hall with undecided voters, the format you know best.");
    case "deb_drop": {
      F.debateDeal = "drop"; const last = s.debates.filter((x) => x.kind === "pres" && !x.done).slice(-1)[0];
      if (last && s.debates.filter((x) => x.kind === "pres").length > 1) s.debates = s.debates.filter((x) => x !== last);
      queue(storyOf(s), s.week + 1, "debate_duck"); return done(`The final debate is off. ${op} will make you pay for it.`);
    }
    case "deb_add": {
      F.debateDeal = "add"; const yes = E.rand(G) < (E.winProb(d, s, 200) > 0.5 ? 0.65 : 0.4); const w = s.weeks - 2;
      if (yes && !s.debates.some((x) => x.w === w)) { s.debates = [...s.debates, { w, done: false, kind: "pres" as const }].sort((a, b) => a.w - b.w); queue(storyOf(s), s.week + 1, "debate_added"); }
      else queue(storyOf(s), s.week + 1, "debate_refused");
      return done("Your campaign issues the challenge.");
    }
    case "prebut": pay(); F.prebuttal = 1; return done("The prebuttal file is ready. When they hit you next, you answer within the hour.");
    case "sunday": { const r = E.genMedia(d, s, G); return r.ok ? done(`Sunday shows: ${r.t}`, r.fx) : r; }
    case "factcheck": pay(); for (const st of sts) { const i = si(d, st); if (i >= 0) s.opAds[i] *= 0.85; } return done(`Local stations add fact checks to ${op}'s ads in ${list(sts)}.`);
    case "bundlers": {
      pay(); const amt = Math.round(16e6 * E.DIFF[s.diff].fund * E.mgrOf(s).fund); s.cash += amt; F.bigDonor = 1;
      if (!F.dinnerQ) { F.dinnerQ = 1; queue(storyOf(s), s.week + 3, "dinner", { src: "retreat" }); }
      return done(`The bundler retreat raises ${E.usd(amt)}. Several of them asked about the tax bill.`);
    }
    case "smalldollar": { const amt = Math.round(7e6 * E.DIFF[s.diff].fund * (s.staff?.digital ? 1.4 : 1)); s.cash += amt; s.enth[0] = Math.max(0, s.enth[0] - 1.2); return done(`The deadline push raises ${E.usd(amt)}. Unsubscribes spike.`); }
    case "reserve": { const r = X2.reserveMarket(d, s, o.arg!, 8e6, s.weeks, "contrast"); return r.ok ? done(r.t) : r; }
    case "party": F.partyMoney = 1; s.cash += 6e6; s.nat -= 0.03; return done("The party funds the coordinated campaign, $6M, and runs its own generic ads.", -0.03);
    case "relational": pay(); s.vol = (s.vol ?? 0) + 3000; s.contacts = (s.contacts ?? 0) + 250000; return done("The app is live. Supporters text a quarter million friends in the first week.");
    case "creators": pay(); F.creators = 1; gsup("young_m", 0.5); gsup("young_w", 0.4); if (E.rand(G) < 0.3) queue(storyOf(s), s.week + 1, "creator_disclosure"); return done("A hundred creators post about you this week.", 0.25);
    case "stream": { pay(); let f = 0; for (const st of sts) { s.cash += 1.25e6; const r = E.genTV(d, s, st, 1.25e6, "positive", G); f += r.fx ?? 0; } return done(`Streaming ads in ${list(sts)}.`, f); }
    case "gads": { const r = X2.groupAds(d, s, o.arg!, 2e6); return r.ok ? done(r.t, r.fx) : r; }
    case "launch": { pay(); const [gk, st] = o.arg!.split(">"); gst(st, gk, 1.2); gsup(gk, 0.2); s.vol = (s.vol ?? 0) + 1500; return done(`The launch in ${E.nameOf(d, st)} draws local press and 1,500 new volunteers.`, 0.2); }
    case "chair": F[`chair:${o.arg}`] = 1; gsup(o.arg!, 0.3); return done("Your new coalition chair is on cable news by dinner.", 0.1);
    case "dig": { s.days += 2; const r = E.genDig(d, s, G); s.days -= 2; return r.ok ? done(r.t) : r; }
    case "vet": pay(); F.vetted = 1; return done("Your lawyers and researchers go through your record line by line. Nothing new, but now you know what they know.");
    case "lawyers": { const r = X2.hireLawyers(s); return r.ok ? done(r.t) : r; }
    case "hotline": pay(); for (const st of sts) chaseIn(st, 0.7e6); return done(`A voter hotline and cure teams in ${list(sts)}.`);
    case "sue": { pay(); const won = E.rand(G) < 0.55; if (won) chaseIn(o.arg!, 3e6); return done(won ? `A judge extends early voting hours in ${E.nameOf(d, o.arg!)}.` : `The judge rules against you in ${E.nameOf(d, o.arg!)}. The money is gone.`); }
    case "bus": {
      pay(); let f = 0; for (const st of sts) { const i = si(d, st); const v = 0.45 * sizeK(d, i) * (0.7 + s.stamina / 330); s.pers[i] += v; f += v; s.visits[st] = (s.visits[st] ?? 0) + 1; }
      s.vol = (s.vol ?? 0) + 3000; s.stamina = Math.max(0, s.stamina - 18); s.enth[0] = Math.min(100, s.enth[0] + 1.5); return done(`The bus rolls through ${list(sts.map((x) => E.nameOf(d, x)))}.`, f);
    }
    case "surrogate": {
      pay(); const i = si(d, o.arg!); s.pers[i] += 0.3 * sizeK(d, i);
      if (s.party === "R") { s.enth[0] = Math.min(100, s.enth[0] + 2); if (E.rand(G) < 0.45) queue(storyOf(s), s.week + 1, "surrogate_flap", { st: o.arg! }); return done(`The President rallies in ${E.nameOf(d, o.arg!)}.`); }
      gsup("black", 0.15); return done(`A former president rallies in ${E.nameOf(d, o.arg!)}.`);
    }
    case "rest": pay(); s.stamina = Math.min(100, s.stamina + 25); return done("A day at home. The candidate sleeps.");
  }
  return done("Done.");
}
