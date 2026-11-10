// Campaign 2028, the story: what the campaign has said and done is remembered, and it comes back. Every public stance
// is on the record, so a later answer that contradicts it becomes an opponent's ad; meetings, promises, scandals,
// debates and research all schedule follow ups that refer to what actually happened; and the world moves on its own
// calendar, with jobs reports, campaign finance filings, storms and endorsements that build on earlier events.
import type { Data, GenS, LogItem, Party } from "./engine28";
import * as E from "./engine28";
import { groupsOf, kidsOf, toGo } from "./deep28";
import { ENDORSE } from "./more28";
import { DEPTS, headOf, type Dept } from "./team28";

// ------------------------------------------------------------- the record
export type Said = { pos: number; label: string; w: number; where: string };
export type Fx = { nat?: number; enth?: number; opEnth?: number; cash?: number; vol?: number; gsup?: Record<string, number>; gst?: [string, string, number]; flag?: [string, number | string]; chase?: [string, number]; days?: number; pers?: [string, number]; risk?: [number, Fx] };
export type StoryOpt = { label: string; say?: string; fx: Fx; tag?: string };
export type StoryEv = { id: string; title: string; prompt: string; who?: string; kind: "decision" | "news"; opts: StoryOpt[]; recall?: string };
export type Story = { said: Record<number, Said>; flags: Record<string, number | string>; queue: { w: number; id: string; p?: Record<string, string | number> }[]; due: StoryEv[]; facts: string[] };
export const newStory = (): Story => ({ said: {}, flags: {}, queue: [], due: [], facts: [] });
export const storyOf = (s: { story?: Story }) => (s.story = s.story ?? newStory());

/** Put a stance on the record. Returns the earlier one when this contradicts it. */
export function onRecord(st: Story, k: number, pos: number, label: string, w: number, where: string): Said | null {
  const prev = st.said[k]; st.said[k] = { pos, label, w, where };
  return prev && Math.abs(prev.pos - pos) > 1.2 ? prev : null;
}
export function queue(st: Story, w: number, id: string, p?: Record<string, string | number>) { if (!st.queue.some((q) => q.id === id && q.w === w)) st.queue.push({ w, id, p }); }
export const flag = (st: Story, k: string) => st.flags[k];
const fact = (st: Story, t: string) => { st.facts = [...st.facts.slice(-30), t]; };

// ------------------------------------------------------------- applying an effect to the general election
export function applyFx(d: Data, s: GenS, fx: Fx, G: { rng: number }): { t: string; v: number } {
  let v = 0; const parts: string[] = [];
  if (fx.risk && E.rand(G) < fx.risk[0]) { const r = applyFx(d, s, fx.risk[1], G); return { t: `It went wrong. ${r.t}`, v: r.v }; }
  if (fx.nat) { s.nat += fx.nat; v += fx.nat; }
  if (fx.enth) s.enth[0] = Math.max(0, Math.min(100, s.enth[0] + fx.enth));
  if (fx.opEnth) s.enth[1] = Math.max(0, Math.min(100, s.enth[1] + fx.opEnth));
  if (fx.cash) { s.cash += fx.cash; parts.push(`${fx.cash > 0 ? "+" : ""}${E.usd(fx.cash)}`); }
  if (fx.vol) { s.vol = Math.max(0, (s.vol ?? 0) + fx.vol); parts.push(`${fx.vol > 0 ? "+" : ""}${fx.vol.toLocaleString("en-US")} volunteers`); }
  if (fx.days) s.days = Math.max(0, s.days - fx.days);
  for (const [g0, x] of Object.entries(fx.gsup ?? {})) for (const g of kidsOf(g0)) { s.gsup = { ...(s.gsup ?? {}), [g]: (s.gsup?.[g] ?? 0) + x }; v += x * 0.1; }
  if (fx.gst) for (const g of kidsOf(fx.gst[1])) { const key = `${fx.gst[0]}:${g}`; s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + fx.gst[2] }; }
  if (fx.chase) { const i = d.states.findIndex((x) => x.st === fx.chase![0]); if (i >= 0) { s.chase = s.chase ?? d.states.map(() => 0); s.chase[i] += fx.chase[1]; } }
  if (fx.pers) { const i = d.states.findIndex((x) => x.st === fx.pers![0]); if (i >= 0) s.pers[i] += fx.pers[1]; }
  if (fx.flag) storyOf(s).flags[fx.flag[0]] = fx.flag[1];
  return { t: parts.join(", "), v };
}

// ------------------------------------------------------------- follow ups: each refers to what really happened
type Ctx = { d: Data; s: GenS; p: Record<string, string | number>; op: string; me: string; G: { rng: number } };
const sn = (d: Data, st: string | number | undefined) => (st ? E.nameOf(d, String(st)) : "a battleground");
const O = (...x: StoryOpt[]) => x;
const FOLLOW: Record<string, (c: Ctx) => StoryEv | null> = {
  union_pro: ({ d, p, op }) => ({ id: "union_pro", kind: "news", title: "Labor endorses you", recall: `You told the ${sn(d, p.st)} AFL-CIO you would sign the PRO Act in your first hundred days.`,
    prompt: `The national AFL-CIO endorses you and promises a door knocking program in every battleground. The Chamber of Commerce answers with an ad calling you a tool of union bosses, and ${op} repeats the line at a rally.`,
    opts: [{ label: "Good news", fx: { vol: 9000, gsup: { wnc: 0.5 }, nat: -0.05 } }] }),
  union_skip: ({ d, p }) => ({ id: "union_skip", kind: "news", title: "The building trades stay neutral", recall: `You sent a surrogate to the ${sn(d, p.st)} union hall.`,
    prompt: "The building trades unions announce they will not endorse in the presidential race. Their members hear about it at every shift change.", opts: [{ label: "Noted", fx: { gsup: { wnc_m: -0.3 } } }] }),
  dinner: ({ op, p }) => ({ id: "dinner", kind: "decision", title: "The billionaire calls back", recall: p.src === "retreat" ? "You held a retreat for your biggest bundlers and took their money." : "You took the billionaire's dinner and the money that came with it.",
    prompt: `Your host from the fundraiser wants a private meeting about the tax bill your administration would send to Congress. ${op}'s campaign is already running ads about your big donors.`,
    opts: O({ label: "Take the meeting quietly", say: "Of course.", fx: { cash: 8e6, risk: [0.35, { nat: -0.35, flag: ["donorScandal", 1] }] } }, { label: "Keep your distance", say: "My door is open, but my plan is my plan.", fx: { gsup: { wnc: 0.2, ind: 0.1 } } }, { label: "Return the next check", say: "", fx: { cash: -4e6, nat: 0.1, gsup: { ind: 0.2 } } }) }),
  podcast_clip: ({ op }) => ({ id: "podcast_clip", kind: "decision", title: "The clip from hour two", recall: "You went on the biggest podcast in America for three hours.",
    prompt: `A forty second clip from your podcast appearance is everywhere. ${op}'s allies have cut it into ads aimed at suburban women.`,
    opts: O({ label: "Stand by every word", say: "Watch the whole thing.", fx: { gsup: { young_m: 0.3, wcol_w: -0.5 } } }, { label: "Clarify on the morning shows", say: "That was clumsy, and here is what I meant.", fx: { days: 1, gsup: { wcol_w: -0.1 }, nat: -0.05 } }, { label: "Ignore it", say: "", fx: { risk: [0.5, { nat: -0.25 }] } }) }),
  podcast_hit: () => ({ id: "podcast_hit", kind: "news", title: "The most watched interview of the cycle", recall: "You went long on the biggest podcast in America.", prompt: "Your podcast appearance passes thirty million views. Young men who never watch the news are quoting it.", opts: [{ label: "Good news", fx: { gsup: { young_m: 0.6, pres: 0.3 } } }] }),
  pastor: ({ d, p }) => ({ id: "pastor", kind: "news", title: "Church buses to early voting", recall: `You spoke from the pulpit in ${sn(d, p.st)}.`, prompt: `The church where you spoke in ${sn(d, p.st)} runs buses to early voting after Sunday services, and three other congregations join them.`, opts: [{ label: "Good news", fx: { chase: [String(p.st), 3e6], gst: [String(p.st), "black", 1.2] } }] }),
  mayor_promise: ({ d, p }) => ({ id: "mayor_promise", kind: "news", title: "The mayor's machine turns out", recall: `You promised the mayor in ${sn(d, p.st)} federal money for transit and housing.`, prompt: "The mayor's precinct captains knock every door in the city over the final weekend, as promised in exchange for yours.", opts: [{ label: "Good news", fx: { gst: [String(p.st), "hisp", 1.4], chase: [String(p.st), 2e6] } }] }),
  farm_relief: ({ op }) => ({ id: "farm_relief", kind: "news", title: "Farmers remember", recall: "You promised farmers relief and an end to the trade war.", prompt: `The farm bureau's newsletter quotes your promise to every member. ${op}'s campaign calls it a giveaway.`, opts: [{ label: "Noted", fx: { gsup: { wnc_m: 0.3, old_m: 0.2 } } }] }),
  flipflop: ({ p, op }) => ({ id: "flipflop", kind: "decision", title: `${op} runs the two positions ad`, recall: `On ${String(p.issue).toLowerCase()} you first said “${p.before}” Then you said “${p.after}”`,
    prompt: `A new ad plays your two answers on ${String(p.issue).toLowerCase()} side by side. It is airing in every battleground.`,
    opts: [{ label: "Own the change", say: "I listened to people, and I changed my mind. That is called leadership.", fx: { nat: -0.08, gsup: { ind: 0.2 } } }, { label: "Say you were misquoted", say: "That is not what I meant.", fx: { risk: [0.55, { nat: -0.45 }], nat: 0.05 } }, { label: "Hit back on their record", say: "", fx: { risk: [0.4, { nat: -0.3 }], enth: 2 } }] }),
  second_tape: ({ op }) => ({ id: "second_tape", kind: "decision", title: "A second tape", recall: "You denied the hot mic clip was real.", prompt: `A second recording from the same event surfaces, longer and clearer. ${op} calls you a liar at three rallies in one day.`,
    opts: [{ label: "Apologize now", say: "I should have owned this the first time. I am sorry.", fx: { nat: -0.3, gsup: { ind: 0.1 } } }, { label: "Keep denying", say: "It is doctored.", fx: { risk: [0.6, { nat: -1.0, opEnth: 3 }], nat: -0.1 } }, { label: "Go dark for two days", say: "", fx: { days: 4, nat: -0.4 } }] }),
  apology: () => ({ id: "apology", kind: "news", title: "The apology lands", recall: "You owned the mistake on the hot mic.", prompt: "Columnists on both sides credit you for owning it. The story is gone in two days.", opts: [{ label: "Good", fx: { nat: 0.08, gsup: { ind: 0.15 } } }] }),
  donor_crisis: ({ op }) => ({ id: "donor_crisis", kind: "decision", title: "The meeting leaked", recall: "You met your billionaire donor about the tax bill.", prompt: `A reporter has the calendar entry and a source in the room. ${op} calls it pay to play.`,
    opts: [{ label: "Release the notes", say: "Here is everything we discussed.", fx: { nat: -0.15, gsup: { ind: 0.15 } } }, { label: "Refuse to comment", say: "", fx: { nat: -0.35 } }, { label: "Return the money", say: "", fx: { cash: -12e6, nat: -0.05 } }] }),
  counter_oppo: ({ op, me }) => ({ id: "counter_oppo", kind: "decision", title: `${op} hits back`, recall: "Your opposition research story ran everywhere last week.",
    prompt: `${op}'s campaign answers your attack with a dump of its own on ${me}'s record. Their research team has been holding it for weeks.`,
    opts: [{ label: "Rebut point by point", say: "Every claim in that story is false, and here is the proof.", fx: { days: 1, risk: [0.3, { nat: -0.25 }] } }, { label: "Ignore it and stay on message", say: "", fx: { nat: -0.2 } }, { label: "Escalate", say: "", fx: { risk: [0.5, { nat: -0.35 }], nat: 0.15, opEnth: 2, enth: 2 } }] }),
  debate_won: () => ({ id: "debate_won", kind: "news", title: "The money after the debate", recall: "You won the debate in the snap polls.", prompt: "Small dollar donations triple in the forty eight hours after the debate, and volunteer sign ups break your record.", opts: [{ label: "Good news", fx: { cash: 14e6, vol: 6000, enth: 2 } }] }),
  debate_lost: () => ({ id: "debate_lost", kind: "decision", title: "Donors are nervous", recall: "The snap polls gave the debate to your opponent.", prompt: "Your finance chair says three major donors want a call. The press is writing about a campaign in trouble.",
    opts: [{ label: "Reset the message", say: "", fx: { days: 2, nat: 0.15 } }, { label: "Call every donor yourself", say: "", fx: { days: 2, cash: 6e6 } }, { label: "Stay the course", say: "", fx: { enth: -2 } }] }),
  hurricane: ({ d, p, op }) => ({ id: "hurricane", kind: "decision", title: `A hurricane hits ${sn(d, p.st)}`, prompt: `A major hurricane makes landfall in ${sn(d, p.st)}. Hundreds of thousands are without power and early voting sites are closed for days. ${op} has paused campaigning there.`,
    opts: [{ label: "Pause and go help", say: "Politics can wait.", fx: { days: 2, pers: [String(p.st), 0.6], nat: 0.1, flag: ["hurricaneHelp", String(p.st)] } }, { label: "Send money and volunteers", say: "", fx: { cash: -3e6, vol: -2000, pers: [String(p.st), 0.3] } }, { label: "Keep campaigning elsewhere", say: "", fx: { risk: [0.4, { nat: -0.3 }] } }] }),
  vp_gaffe: ({ s }) => ({ id: "vp_gaffe", kind: "news", title: `${s.opVp ?? "Their running mate"} stumbles`, prompt: `${s.opVp ?? "The other running mate"} tells a crowd that the polls do not matter because "our people don't need to vote early." Their own campaign walks it back.`, opts: [{ label: "Noted", fx: { nat: 0.12, opEnth: -1 } }] }),
  endorse_cbc: ({ me, s }) => ({ id: "endorse_cbc", kind: "news", title: "Black leaders hit the road", recall: "Your work with Black voters has shown up in your own polling.", prompt: s.party === "D" ? `Members of the Congressional Black Caucus and a former president start a four state bus tour for ${me}.` : `Two hundred Black pastors and business owners in Georgia, North Carolina and Michigan form a coalition for ${me}, the largest a Republican has had in decades.`, opts: [{ label: "Good news", fx: { gsup: { black: 0.4 }, vol: 5000 } }] }),
  endorse_latino: ({ me }) => ({ id: "endorse_latino", kind: "news", title: "Latino business owners for you", recall: "Your outreach to Hispanic voters has been moving numbers.", prompt: `Two hundred Latino small business owners in Arizona, Nevada and Pennsylvania sign a letter backing ${me}.`, opts: [{ label: "Good news", fx: { gsup: { hisp: 0.4 } } }] }),
  lawsuit: ({ d, p }) => ({ id: "lawsuit", kind: "decision", title: `A lawsuit over ballots in ${sn(d, p.st)}`, prompt: `A lawsuit asks a court to throw out mail ballots in ${sn(d, p.st)} that arrive after Election Day but were postmarked on time. Your lawyers say the case is winnable, if you spend.`,
    opts: [{ label: "Fight it in court", say: "", fx: { cash: -3e6, risk: [0.35, { chase: [String(p.st), -4e6] }] } }, { label: "Tell voters to vote early", say: "Do not wait. Vote early, in person if you can.", fx: { chase: [String(p.st), 2e6] } }, { label: "Let the party handle it", say: "", fx: { risk: [0.5, { chase: [String(p.st), -5e6] }] } }] }),
  debate_duck: ({ op }) => ({ id: "debate_duck", kind: "news", title: `${op} says you are scared`, recall: "Your campaign pushed to cancel the final presidential debate.", prompt: `${op} stands next to an empty podium at a rally and asks where you are. The clip leads the evening news.`, opts: [{ label: "Take the hit", fx: { nat: -0.15, opEnth: 2 } }] }),
  debate_refused: ({ op }) => ({ id: "debate_refused", kind: "news", title: `${op} turns down a fourth debate`, recall: "You challenged your opponent to another debate.", prompt: `${op}'s campaign says three debates are plenty. Editorial boards in four swing states call that a dodge.`, opts: [{ label: "Good news", fx: { nat: 0.12, enth: 1 } }] }),
  debate_added: ({ op }) => ({ id: "debate_added", kind: "news", title: "A fourth debate is on", recall: "You challenged your opponent to another debate.", prompt: `${op} accepts your challenge. One more night on the stage, two weeks before the election.`, opts: [{ label: "Start preparing", fx: { enth: 1 } }] }),
  creator_disclosure: () => ({ id: "creator_disclosure", kind: "decision", title: "The paid posts", recall: "Your digital team paid online creators to talk about you.", prompt: "A reporter finds that a dozen creators who praised you never said they were paid by your campaign. The FEC complaint is filed by lunch.",
    opts: [{ label: "Disclose every contract", say: "Every dollar is public now.", fx: { nat: -0.1, gsup: { young: -0.15 } } }, { label: "Blame a vendor and fire them", say: "", fx: { risk: [0.4, { nat: -0.3 }], nat: -0.05 } }] }),
  ground_report: ({ d, p }) => ({ id: "ground_report", kind: "news", title: `The organizers land in ${sn(d, p.st)}`, recall: `You moved organizers out of ${sn(d, p.from)}.`, prompt: `Your new team in ${sn(d, p.st)} is knocking doors within days. Back in ${sn(d, p.from)}, the local party chair complains to a reporter that the campaign left them behind.`, opts: [{ label: "Worth it", fx: { gst: [String(p.from), "mid", -0.4] } }] }),
  surrogate_flap: ({ d, p }) => ({ id: "surrogate_flap", kind: "news", title: "The President goes off script", recall: `You sent the President to campaign in ${sn(d, p.st)}.`, prompt: `At the rally in ${sn(d, p.st)}, the President spends twenty minutes on old grievances. The crowd loves it. Suburban voters watching at home do not.`, opts: [{ label: "Noted", fx: { gsup: { wcol: -0.3 }, enth: 2 } }] }),
  endorse: ({ p }) => { const e = ENDORSE.find((x) => x.k === p.k); if (!e) return null;
    return { id: "endorse", kind: "news", title: `${e.who} ${e.pl ? "endorse" : "endorses"} you`, recall: `What it took: ${e.need.toLowerCase()}.`, prompt: `${e.who} ${e.pl ? "announce their" : "announces"} support at a press conference covered live on every network.`,
      opts: [{ label: "Good news", fx: { nat: e.fx.nat, gsup: e.fx.g, vol: e.fx.vol, cash: e.fx.cash } }] }; },
  viral_good: () => ({ id: "viral_good", kind: "decision", title: "You are a meme, the good kind", prompt: "A clip of you dancing badly at a rally has forty million views. Young voters love it. Your communications team is split.",
    opts: O({ label: "Lean in and post more", say: "", fx: { gsup: { young: 0.5 }, risk: [0.3, { nat: -0.1, gsup: { old: -0.2 } }] } }, { label: "Let it ride and stay on message", say: "", fx: { gsup: { young: 0.2 } } }) }),
  viral_op: ({ op }) => ({ id: "viral_op", kind: "decision", title: `A meme about ${op} is everywhere`, prompt: `Millions are sharing a mocking edit of ${op} from a rally. Your digital team wants to post it from the official account.`,
    opts: O({ label: "Post it", say: "", fx: { risk: [0.3, { nat: -0.15 }], nat: 0.1, gsup: { young: 0.2 } } }, { label: "Stay above it", say: "We are going to talk about your family's future.", fx: { gsup: { ind: 0.15, old: 0.1 } } }) }),
  viral_bad: () => ({ id: "viral_bad", kind: "decision", title: "The clip that will not die", prompt: "You froze for six seconds mid answer, and it is set to music on every platform. Late night hosts have it in their monologues.",
    opts: O({ label: "Laugh at yourself on a late show", say: "Even I watched it twice.", fx: { days: 1, nat: 0.05, gsup: { young: 0.2 } } }, { label: "Blame a deceptive edit", say: "", fx: { risk: [0.5, { nat: -0.25 }] } }, { label: "Ignore it", say: "", fx: { nat: -0.08 } }) }),
  sen_leader: ({ d, p }) => ({ id: "sen_leader", kind: "decision", title: "The party leader calls", recall: "You have not campaigned with your party's Senate candidates.", prompt: `Your party's Senate leader says the races in ${sn(d, p.a)} and ${sn(d, p.b)} are within three points, and you have not stood next to either candidate. The majority may ride on it.`,
    opts: O({ label: "Promise to stump with both", say: "We win together.", fx: { days: 1, enth: 1, flag: ["senPromise", 1] } }, { label: "Say your race comes first", say: "", fx: { cash: -3e6, enth: -1 } }) }),
  staff_quit: ({ s, p }) => { const dept = String(p.dept) as Dept; const h = headOf({ me: s.me, mo: { hires: { ...(s.mo?.hires ?? {}), [dept]: (s.mo?.hires?.[dept] ?? 1) - 1 } } }, dept);
    return { id: "staff_quit", kind: "decision", title: `${h.n} resigns`, recall: `You kept overruling or ignoring your ${DEPTS[dept].role.toLowerCase()}.`, prompt: `${h.n}, your ${DEPTS[dept].role.toLowerCase()}, has quit. Reporters are calling the campaign in disarray, and ${h.female ? "she" : "he"} knows everything.`,
      opts: O({ label: "Wish them well publicly", say: "We are grateful for the service.", fx: { nat: -0.05, risk: [0.5, { flag: ["tellAll", String(dept)] }] } }, { label: "Severance with a nondisclosure deal", say: "", fx: { cash: -1.5e6, nat: -0.03 } }) }; },
  tell_all: ({ me }) => ({ id: "tell_all", kind: "decision", title: "The former staffer talks", recall: "A senior staffer quit and you let them walk without a deal.", prompt: `Your former senior staffer gives a long interview: ${me} ignores advice, the campaign is chaos, and the polling is worse than you admit.`,
    opts: O({ label: "Attack their credibility", say: "", fx: { risk: [0.45, { nat: -0.3 }], nat: -0.05 } }, { label: "Say you wish them well", say: "Campaigns are hard. I wish them the best.", fx: { nat: -0.12 } }) }),
};

/** Turn what is due this week into events, newest decisions first. */
export function dueStory(d: Data, s: GenS, G: { rng: number }) {
  const st = storyOf(s);
  const now = st.queue.filter((q) => q.w <= s.week); st.queue = st.queue.filter((q) => q.w > s.week);
  for (const q of now) { const f = FOLLOW[q.id]; if (!f) continue; const ev = f({ d, s, p: q.p ?? {}, op: s.op, me: s.me, G }); if (ev) st.due.push(ev); }
}
export function resolveStory(d: Data, s: GenS, k: number, G: { rng: number }): { t: string; v: number; ev: StoryEv } | null {
  const st = storyOf(s); const ev = st.due[0]; if (!ev) return null; const o = ev.opts[Math.min(k, ev.opts.length - 1)];
  const r = applyFx(d, s, o.fx, G); st.due = st.due.slice(1);
  fact(st, `${ev.title}: ${o.label.toLowerCase()}.`);
  // what this decision sets up next
  if (ev.id === "dinner" && k === 0 && storyOf(s).flags.donorScandal) queue(st, s.week + 1, "donor_crisis");
  if (ev.id === "staff_quit" && st.flags.tellAll && !st.flags.tellAllQ) { st.flags.tellAllQ = 1; queue(st, s.week + 3, "tell_all"); }
  if (ev.id.startsWith("viral") && k === 0 && s.mo) s.mo.meme += 6;
  return { t: `${ev.title}: ${o.label.toLowerCase()}${r.t ? `. ${r.t}` : ""}.`, v: r.v, ev };
}

// ------------------------------------------------------------- hooks from the rest of the campaign
/** An invitation was answered: schedule what it sets in motion. */
export function afterInvite(s: GenS, tag: string | undefined, st: string, leaked: boolean) {
  if (!tag) return; const S = storyOf(s); const w = s.week;
  if (tag === "union_pro") queue(S, w + 2, "union_pro", { st });
  if (tag === "union_skip") queue(S, w + 1, "union_skip", { st });
  if (tag === "dinner") { S.flags.bigDonor = 1; if (!S.flags.dinnerQ) { S.flags.dinnerQ = 1; queue(S, w + 3, "dinner", { st }); } }
  if (tag === "podcast_long") queue(S, w + 1, leaked ? "podcast_clip" : "podcast_hit");
  if (tag === "pastor") { const ev = Math.max(w + 1, s.weeks - 5); queue(S, ev, "pastor", { st }); }
  if (tag === "mayor_promise") queue(S, s.weeks, "mayor_promise", { st });
  if (tag === "farm_relief") queue(S, w + 2, "farm_relief");
}
/** A crisis was answered: lies come back, apologies are rewarded. */
export function afterCrisis(s: GenS, id: string, label: string, bad: boolean) {
  const S = storyOf(s);
  if (id === "hotmic" && label === "Deny it") queue(S, s.week + 1, "second_tape");
  if (id === "hotmic" && label === "Own it" && !bad) queue(S, s.week + 1, "apology");
  S.flags[`crisis:${id}`] = label;
}
/** A stance was taken in public: on the record, and a contradiction becomes an ad. */
export function afterStance(d: Data, s: GenS, k: number, pos: number, say: string, where: string) {
  const S = storyOf(s); const prev = onRecord(S, k, pos, say, s.week, where);
  if (prev) queue(S, s.week + 1, "flipflop", { issue: d.issues[k].l, before: prev.label, after: say });
  return prev;
}
export function afterDrop(s: GenS, landed: boolean) { if (landed && !storyOf(s).flags.countered) { storyOf(s).flags.countered = 1; queue(storyOf(s), s.week + 1, "counter_oppo"); } }
export function afterDebate(s: GenS, won: boolean) { queue(storyOf(s), s.week + 1, won ? "debate_won" : "debate_lost"); }

// ------------------------------------------------------------- the world on its own calendar
export type Econ = { u: number; jobs: number; cpi: number; gas: number };
const INCUMBENT: Party = "R"; // the White House party in 2028
/** Runs inside the end of each week: jobs reports on the first week of each month, campaign finance filings, storms,
 * endorsements that follow real gains, lawsuits and the other side's mistakes. */
export function worldWeek(d: Data, s: GenS, G: { rng: number }, out: LogItem[]) {
  const S = storyOf(s); const w = s.week, g = toGo(s);
  // the economy: a random walk that the Iran war and gas prices push on, reported monthly
  const e: Econ = (s.econ = s.econ ?? { u: 4.4, jobs: 120, cpi: 3.1, gas: 3.65 });
  const war = S.flags.iranWar ? 1 : 0;
  e.u = Math.max(3.4, Math.min(6.5, e.u + E.gauss(G) * 0.06 + war * 0.02)); e.cpi = Math.max(1.5, Math.min(6, e.cpi + E.gauss(G) * 0.08 + war * 0.05)); e.gas = Math.max(2.8, Math.min(5.8, e.gas + E.gauss(G) * 0.08 + war * 0.07));
  if (w % 4 === 1) {
    e.jobs = Math.round(130 - (e.u - 4.4) * 120 + E.gauss(G) * 55);
    const bad = (e.jobs < 90 ? 1 : 0) + (e.cpi > 3.4 ? 1 : 0) + (e.gas > 4 ? 1 : 0) - (e.jobs > 170 ? 1 : 0);
    const hit = bad * 0.12 * (s.party === INCUMBENT ? -1 : 1);
    s.nat += hit;
    out.push({ t: w, kind: "event", s: `Jobs report: ${e.jobs > 0 ? "+" : ""}${e.jobs},000 jobs, unemployment ${e.u.toFixed(1)} percent, inflation ${e.cpi.toFixed(1)} percent, gas at $${e.gas.toFixed(2)}. ${bad > 0 ? `A rough month for the White House${s.party === INCUMBENT ? ", and for you" : ""}.` : bad < 0 ? "A good month for the White House." : "Mixed news."}`, fx: hit });
  }
  // campaign finance filings, monthly, on the third week
  if (w % 4 === 3) {
    const mine = s.raised ?? 0, theirs = s.opRaised ?? 0; const ahead = mine > theirs;
    out.push({ t: w, kind: "money", s: `Monthly FEC filing: you have raised ${E.usd(mine)} since the general began and have ${E.usd(s.cash)} on hand. ${s.op} has raised ${E.usd(theirs)} and has ${E.usd(s.opCash)} on hand. ${ahead ? "The press calls you the money leader." : "Stories about your fundraising gap follow."}` });
    s.enth[0] = Math.max(0, Math.min(100, s.enth[0] + (ahead ? 1 : -1)));
  }
  // a storm in the hurricane belt, once, in September or October
  if (!S.flags.hurricane && g >= 4 && g <= 9 && E.rand(G) < 0.1) {
    const st = ["FL", "NC", "SC", "GA", "LA", "TX"][Math.floor(E.rand(G) * 6)]; S.flags.hurricane = st; queue(S, w + 1, "hurricane", { st });
    const i = d.states.findIndex((x) => x.st === st); if (i >= 0) { s.ads[i] *= 0.5; s.opAds[i] *= 0.5; }
  }
  // endorsements that follow real gains with a group
  const gs = s.gsup ?? {};
  if (!S.flags.cbc && (gs.black_w ?? 0) + (gs.black_m ?? 0) > 2.2) { S.flags.cbc = 1; queue(S, w + 1, "endorse_cbc"); }
  if (!S.flags.latino && (gs.hisp_w ?? 0) + (gs.hisp_m ?? 0) > 2.2) { S.flags.latino = 1; queue(S, w + 1, "endorse_latino"); }
  // ballot lawsuits once early voting is near, in a close state that votes by mail a lot
  if (!S.flags.lawsuit && g <= 7 && g >= 3 && E.rand(G) < 0.25) {
    const ms = E.myMargins(d, s); const st = ["PA", "WI", "AZ", "NV", "GA", "MI", "NC"].map((x) => ({ x, m: Math.abs(ms[d.states.findIndex((y) => y.st === x)] ?? 9) })).sort((a, b) => a.m - b.m)[0].x;
    S.flags.lawsuit = st; queue(S, w + 1, "lawsuit", { st });
  }
  // the other running mate's mistake, once
  if (s.opVp && !S.flags.vpGaffe && g <= 6 && E.rand(G) < 0.12) { S.flags.vpGaffe = 1; queue(S, w + 1, "vp_gaffe"); }
  s.opRaised = (s.opRaised ?? 0) + 24e6 / E.DIFF[s.diff].opp;
  // money that comes in without asking: the website, the list, the post debate surge, more when your side is fired up
  const org = Math.round(11e6 * (s.mo?.hard ? 0.8 : 1) * E.DIFF[s.diff].fund * (0.5 + s.enth[0] / 100) * (s.staff?.digital ? 1.15 : 1)); s.cash += org; s.raised = (s.raised ?? 0) + org;
}
/** Remember world events from issue cards, so the economy and later news follow them. */
export function afterCard(s: GenS | { story?: Story }, id: string) {
  const S = storyOf(s as { story?: Story });
  if (id === "iran") S.flags.iranWar = 1;
  if (id === "gas") S.flags.gasHigh = 1;
}
/** Which public stance on an issue is already on the record, for showing the player before they answer again. */
export const recordOn = (s: { story?: Story }, k: number) => s.story?.said?.[k] ?? null;
/** How the record reads back to the player. */
export const recallText = (r: Said) => `On the record, ${r.w ? `week ${r.w}, ${r.where}` : r.where}: “${r.label}”`;
export { groupsOf };
