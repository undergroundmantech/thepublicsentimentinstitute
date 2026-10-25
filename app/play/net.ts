// The campaign's network, from the site's Watchdog connections: the people and groups who endorsed each candidate, the
// donors and super PACs behind them, the surrogates who rallied for them and the commentators talking about the race.
// Your side's network is something to work: activate endorsers, book surrogates, ask donors to host, send your allies a
// redbox. Theirs is something to aim at. Podcasts and shows come from the same list of who is paying attention.
import { type Ctx, type State, type ActResult, type Part, type Stance, type Meet, COST, DIFF, STAFF_COST, applyGlobal, react, rand, gauss, usd, att, cal, askParty, setupJFC, regionsOf } from "./engine";

export type NetKind = "endorser" | "surrogate" | "donor" | "party" | "group" | "theirgroup" | "theirdonor";
export type NetItem = { id: string; kind: NetKind; name: string; sub: string; act: string; cost: string; real: boolean; src?: string; v?: number; note?: string; used: boolean; why?: string };

const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const RISKY = /crypto|casino|gambl|oil|gas|private equity|pharma|lobby|insurance|tobacco|payday|hedge/i;
const LOCAL = /state (senator|rep|house)|state representative|mayor|county|council|legislat|commission|sheriff|delegate|alder|assembly|city/i;
export const partyCmte = (c: Ctx) => {
  const sen = c.r.office === "senate", R = c.me.party === "R";
  return c.me.party === "I" ? "The state's independent donor network" : sen ? (R ? "The NRSC" : "The DSCC") : (R ? "The Republican Governors Association" : "The Democratic Governors Association");
};

/** Your side's network and theirs, with what you can do with each. */
export function networkOf(c: Ctx, s: State): { mine: NetItem[]; theirs: NetItem[]; att: NonNullable<Ctx["r"]["net"]>["attention"] } {
  const n = c.r.net, me = n?.[c.side], op = n?.[c.side === "D" ? "R" : "D"];
  const asked = s.asked ?? [];
  const mine: NetItem[] = [];
  for (const e of me?.endorsers ?? []) {
    const id = `e:${e.by}`;
    const what = e.kind === "union" ? "Members on your doors" : e.kind === "celebrity" ? "A post and a fundraising video" : e.kind === "newspaper" ? "Run the endorsement in your ads" : e.kind === "media" ? "A plug on their show" : e.kind === "politician" ? (LOCAL.test(e.role) ? "Work their home turf with them" : "A joint appearance") : "Their list and their volunteers";
    mine.push({ id, kind: "endorser", name: e.by, sub: e.role || e.kind, act: what, cost: "Half day", real: true, src: e.src, note: e.kind, used: asked.includes(id) });
  }
  for (const x of me?.surrogates ?? []) {
    const id = `s:${x.name}`; const last = Math.max(-9, ...asked.filter((a) => a.startsWith(id + "@")).map((a) => Number(a.split("@")[1])));
    mine.push({ id, kind: "surrogate", name: x.name, sub: `Rallied for you ${x.n} time${x.n > 1 ? "s" : ""} in real life`, act: "Book a rally together", cost: "1 day, $40K", real: true, src: x.src, note: x.note, used: s.week - last < 3, why: s.week - last < 3 ? "Booked recently" : undefined });
  }
  const donors = (me?.donors ?? []).map((d) => ({ ...d, real: true }));
  if (donors.length < 3) {
    const big = [...c.r.counties].sort((a, b) => b[5] - a[5]);
    const gen = [`A car dealer who owns lots across ${big[0]?.[1] ?? c.r.state}`, `A homebuilder from ${big[1]?.[1] ?? c.r.state}`, "A hospital system founder", "A family that owns the state's biggest grocery chain"];
    for (const g of gen.slice(0, 4 - donors.length)) donors.push({ name: g, v: Math.round(c.weekly * (0.3 + (hash(g) % 50) / 100)), note: "", src: "", real: false });
  }
  for (const d of donors) {
    const id = `d:${d.name}`;
    mine.push({ id, kind: "donor", name: d.name, sub: d.real ? `Gave ${usd(d.v)} to your side${d.note ? `: ${d.note.slice(0, 90)}` : ""}` : "A local donor, not from the Watchdog files", act: "Ask them to host a fundraiser", cost: "Half day", real: d.real, src: d.src || undefined, v: d.v, note: d.note, used: asked.includes(id) });
  }
  const pc = me?.party?.[0]?.name ?? partyCmte(c);
  mine.push({ id: "party", kind: "party", name: pc, sub: "The party funds races it thinks are close", act: "Ask for coordinated money", cost: "Half day, every 4 weeks", real: !!me?.party?.length, src: me?.party?.[0]?.src, used: s.week - (s.partyW ?? -9) < 4, why: s.week - (s.partyW ?? -9) < 4 ? "Asked recently" : undefined });
  mine.push({ id: "jfc", kind: "party", name: "Joint fundraising committee", sub: "One check, split between you and the party", act: "Launch it with a party event", cost: "1 day, once", real: false, used: !!s.jfc });
  for (const g of me?.groups ?? []) {
    const id = `g:${g.name}`;
    mine.push({ id, kind: "group", name: g.name, sub: `${usd(g.v)} ${g.how === "for" ? "spent for you" : `spent against ${c.op.name}`}`, act: "Special guest at their fundraiser", cost: "1 day, once", real: true, src: g.src || undefined, v: g.v, used: asked.includes(id) });
  }
  if (!(me?.groups ?? []).length) mine.push({ id: "g:allies", kind: "group", name: "Your party's main super PAC", sub: "Outside money on your side", act: "Special guest at their fundraiser", cost: "1 day, once", real: false, v: c.me.money.outside_for ?? 2e6, used: asked.includes("g:allies") });
  const theirs: NetItem[] = [];
  for (const g of op?.groups ?? []) { const id = `tg:${g.name}`; theirs.push({ id, kind: "theirgroup", name: g.name, sub: `${usd(g.v)} ${g.how === "for" ? `spent for ${c.op.name}` : "spent against you"}`, act: "Make their money the story", cost: "$150K ad", real: true, src: g.src || undefined, v: g.v, used: asked.includes(id) }); }
  for (const d of op?.mega ?? []) { const id = `tm:${d.name}`; if (theirs.some((x) => x.id === id)) continue; theirs.push({ id, kind: "theirdonor", name: d.name, sub: `Gave ${usd(d.v)} to ${d.via}`, act: "Tie them to the billionaire", cost: "$150K ad", real: true, src: d.src || undefined, v: d.v, used: asked.includes(id) }); }
  for (const d of (op?.donors ?? []).slice(0, 4)) { const id = `td:${d.name}`; theirs.push({ id, kind: "theirdonor", name: d.name, sub: `Gave ${usd(d.v)} to ${c.op.name}`, act: "Make it an ad", cost: "$150K ad", real: true, src: d.src || undefined, v: d.v, used: asked.includes(id) }); }
  return { mine, theirs, att: n?.attention ?? [] };
}

/** Work one connection. */
export function workNet(c: Ctx, s: State, it: NetItem): ActResult & { parts?: Part[] } {
  if (it.used) return { ok: false, t: it.why ?? "Already done." };
  const ask = (n: number) => { if (s.days < n) return false; s.days -= n; return true; };
  const A = att(s);
  const done = (t: string, fx = 0, parts?: Part[]) => { if (fx) applyGlobal(s, fx, parts ?? [{ label: "Voters following the race", share: 55, lean: 0, fx }], 0.7); s.log.push({ w: s.week, kind: "you", t, fx: fx || undefined }); return { ok: true, t, fx, parts }; };
  const mark = () => { (s.asked ??= []).push(it.id); };
  const big = [...c.r.counties.keys()].sort((a, b) => c.r.counties[b][5] - c.r.counties[a][5]);
  const swing = big.filter((i) => Math.abs(c.base[i] + s.pers[i]) < 10);
  if (it.kind === "endorser") {
    if (!ask(COST.ask)) return { ok: false, t: "No time left this week." };
    mark();
    if (it.note === "union") { const v = c.me.party === "R" ? 60 + Math.round(rand(s) * 60) : 120 + Math.round(rand(s) * 120); s.volunteers += v; s.enth[0] = clamp(s.enth[0] + 2, 0, 100); return done(`${it.name} put ${v} members on your walk lists and phone banks.`); }
    if (it.note === "celebrity") { const amt = Math.round(c.weekly * 0.12); s.cash += amt; s.raised += amt; s.buzz = clamp(s.buzz + 12, 0, 100); return done(`${it.name} posted a video for you: ${usd(amt)} in small donations and a lot of new followers.`); }
    if (it.note === "newspaper") { const fx = (0.03 + rand(s) * 0.03) * A; return done(`${it.name}'s endorsement now runs at the end of your ads.`, fx, [{ label: "College graduates", share: c.g("College graduate")?.share ?? 35, lean: 0, fx }]); }
    if (it.note === "media") { s.buzz = clamp(s.buzz + 7, 0, 100); return done(`${it.name} gave you a plug to a big audience.`); }
    if (it.note === "politician" && !LOCAL.test(it.sub)) { s.buzz = clamp(s.buzz + 6, 0, 100); s.enth[0] = clamp(s.enth[0] + 2, 0, 100); const fx = (0.02 + rand(s) * 0.03) * A; return done(`A joint appearance with ${it.name} made the evening news.`, fx); }
    if (it.note === "politician") { const i = swing[Math.floor(rand(s) * Math.min(4, swing.length))] ?? big[0]; if (i != null) s.pers[i] += 0.9 * A; return done(`${it.name} walked you through ${c.r.counties[i ?? 0]?.[1] ?? "their district"} and vouched for you.`); }
    const v = 40 + Math.round(rand(s) * 50), amt = Math.round(c.weekly * 0.08); s.volunteers += v; s.cash += amt; s.raised += amt;
    return done(`${it.name} sent their list ${v} volunteer shifts and ${usd(amt)}.`);
  }
  if (it.kind === "surrogate") {
    if (s.cash < 40000) return { ok: false, t: "Not enough cash." };
    if (!ask(COST.surrogate)) return { ok: false, t: "A rally with a surrogate takes a full day." };
    (s.asked ??= []).push(`${it.id}@${s.week}`);
    s.cash -= 40000; s.spent += 40000;
    const i = swing[0] ?? big[0];
    const star = /trump|obama|vance|harris|sanders|ocasio|desantis|newsom|shapiro|whitmer/i.test(it.name);
    if (i != null) s.pers[i] += (star ? 2.4 : 1.6) * A;
    s.enth[0] = clamp(s.enth[0] + (star ? 6 : 3), 0, 100); s.buzz = clamp(s.buzz + (star ? 14 : 6), 0, 100); s.volunteers += star ? 150 : 60;
    let fx = 0, parts: Part[] | undefined;
    if (/trump/i.test(it.name)) { const r = react(c, s, { pos: 0.7, trump: 1, tone: "fiery" }, 0.5); fx = r.fx * 0.6 * A; parts = r.parts.slice(0, 4).map((p) => ({ ...p, fx: p.fx * 0.6 * A })); }
    else if (/obama/i.test(it.name)) { const r = react(c, s, { pos: -0.5, trump: -0.6, tone: "calm" }, 0.5); fx = r.fx * 0.6 * A; parts = r.parts.slice(0, 4).map((p) => ({ ...p, fx: p.fx * 0.6 * A })); }
    if (star) s.enth[1] = clamp(s.enth[1] + 2, 0, 100);
    return done(`${it.name} rallied with you in ${c.r.counties[i ?? 0]?.[1] ?? c.r.state}. ${star ? "Wall to wall coverage, and the other side's base noticed too." : "A solid crowd and good local coverage."}`, fx, parts);
  }
  if (it.kind === "donor") {
    if (!ask(COST.ask)) return { ok: false, t: "No time left this week." };
    mark();
    const amt = Math.round(clamp((it.v ?? c.weekly * 0.4) * 0.6, c.weekly * 0.15, c.weekly * 1.3) * DIFF[s.diff].fund);
    s.cash += amt; s.raised += amt;
    if (RISKY.test(`${it.name} ${it.note ?? ""}`) && rand(s) < 0.2) {
      const fx = -0.07 * DIFF[s.diff].neg * A;
      return done(`${it.name} hosted a fundraiser for ${usd(amt)}. A local reporter wrote about who was in the room and what their industry wants.`, fx);
    }
    return done(`${it.name} hosted a fundraiser and bundled ${usd(amt)} from friends and colleagues.`);
  }
  if (it.kind === "party") {
    if (it.id === "jfc") return setupJFC(c, s);
    return askParty(c, s, it.name);
  }
  if (it.kind === "group") {
    if (!ask(COST.guest)) return { ok: false, t: "A fundraiser trip takes a full day." };
    mark();
    const add = clamp((it.v ?? 2e6) * 0.18, 5e5, 6e6);
    s.outPlus = (s.outPlus ?? 0) + add;
    let t = `You were the special guest at a ${it.name} fundraiser. Federal law lets you appear but not ask for more than $5,000 a person; the group's donors gave anyway, and about ${usd(add)} more will be spent for you.`, fx = 0;
    if (rand(s) < 0.15) { fx = -0.05 * DIFF[s.diff].neg * A; t += " A photo from the billionaire's living room made the rounds."; }
    return done(t, fx);
  }
  // their network: make their money the story
  if (s.cash < 150000) return { ok: false, t: "Not enough cash." };
  mark(); s.cash -= 150000; s.spent += 150000;
  const hit = (0.06 + 0.08 * rand(s)) * (s.staff.oppo ? 1.3 : 0.85) * (s.mgr === "brawler" ? 1.15 : 1) * A;
  if (!s.staff.oppo && rand(s) < 0.2) { const fx = -0.04 * DIFF[s.diff].neg * A; return done(`Your ad about ${it.name} got the facts slightly wrong and drew a fact check.`, fx); }
  const costs = c.costsHard;
  return done(`Your ad tying ${c.op.name} to ${it.name} ran statewide. ${Math.round(costs)} percent of voters here say daily costs are hard to afford, and it landed with them.`, hit, [{ label: "Voters who find daily costs hard to afford", share: costs, lean: 0, fx: hit }]);
}

/** A show offer for this week: the commentators and hosts the Watchdog has covering this race, else a generic one. */
export function podInvite(c: Ctx, s: State): Meet | null {
  const done = s.pods ?? [];
  const hosts = (c.r.net?.attention ?? []).filter((a) => /host|podcast|commentator|anchor|radio|streamer/i.test(a.role) && !/fuentes/i.test(a.who) && !done.includes(a.who));
  const R = c.me.party === "R";
  const gen = [
    { who: "The host of a top ten comedy podcast", side: "O", note: "Three hours, no topics off limits.", show: "a comedy podcast" },
    { who: R ? "A conservative talk radio host" : "A progressive podcast host", side: c.side, note: "A friendly room, a big audience of your own voters.", show: R ? "statewide talk radio" : "a progressive podcast" },
    { who: R ? "A progressive podcast host" : "A conservative talk radio host", side: c.side === "D" ? "R" : "D", note: "Hostile ground, and a chance to look brave.", show: R ? "a progressive podcast" : "conservative talk radio" },
    { who: "A sports talk show host", side: "O", note: "Ninety minutes about football, with politics slipped in.", show: "sports radio" },
  ].filter((g) => !done.includes(g.who));
  const pick = hosts.length && rand(s) < 0.7 ? (() => { const a = hosts[Math.floor(rand(s) * hosts.length)]; return { who: a.who, side: a.side ?? "O", note: a.notes[0] ?? "", show: /podcast/i.test(a.role) ? "their podcast" : /radio/i.test(a.role) ? "their radio show" : /streamer/i.test(a.role) ? "their stream" : "their show", src: a.src, real: true }; })()
    : gen.length ? { ...gen[Math.floor(rand(s) * gen.length)], src: undefined, real: false } : null;
  if (!pick) return null;
  const lean = (pick.side === "D" || pick.side === "R" ? pick.side : "O") as "D" | "R" | "O";
  const friendly = lean === c.side, hostile = lean !== "O" && !friendly;
  return { id: `pod:${pick.who}`, who: pick.who, role: "podcast", seed: hash(pick.who), place: pick.show, title: hostile ? "Into the lion's den" : friendly ? "A friendly room" : "A big new audience", real: pick.real, src: pick.src,
    intro: pick.real ? `${pick.who} has been covering your race: "${pick.note}" Now they want you on.` : `"${pick.note}"`,
    pod: { lean, show: pick.show, note: pick.real ? pick.note : undefined }, opts: [] };
}

export type PodQ = { q: string; opts: { label: string; say: string; st: Stance; style: "straight" | "middle" | "joke" | "push" }[] };
/** Three questions: the host's own angle on your race, then two issues. */
export function podQuestions(c: Ctx, s: State, m: Meet): PodQ[] {
  const p0 = c.me.party === "R" ? 0.65 : c.me.party === "D" ? -0.65 : 0;
  const styles = (iss: string): PodQ["opts"] => [
    { label: "Straight answer", say: "Say exactly what you believe, no hedging.", st: { issue: iss, pos: p0 * 1.1 }, style: "straight" },
    { label: "Find common ground", say: "Grant the host's point and offer a practical fix.", st: { issue: iss, pos: p0 * 0.2, tone: "calm" }, style: "middle" },
    { label: "Make them laugh", say: "A self deprecating story, then a short answer.", st: { issue: iss, pos: p0 * 0.5, sal: 0.6, tone: "calm" }, style: "joke" },
    { label: "Push back on the host", say: "Challenge the premise of the question.", st: { issue: iss, pos: p0 * 0.9, tone: "fiery" }, style: "push" },
  ];
  const out: PodQ[] = [];
  out.push({ q: m.pod?.note ? `About your race, the host says: "${m.pod.note}" Fair?` : "So why should anyone listening trust a politician?", opts: styles("other") });
  const iss = (c.r.research?.issues ?? []).slice(0, 4);
  const k = (s.pods?.length ?? 0) % Math.max(1, iss.length);
  if (iss[k]) out.push({ q: `${iss[k].issue}. ${iss[k].why} Where are you?`, opts: styles("econ") });
  out.push({ q: "Give me one thing your own party gets wrong.", opts: [
    { label: "Name a real one", say: "Break with your party on something specific.", st: { pos: -p0 * 0.3, tone: "calm", extra: ["Independent"] }, style: "middle" },
    { label: "Dodge it", say: "Say both parties need to do better.", st: { pos: p0 * 0.6, sal: 0.5 }, style: "joke" },
    { label: "The other party is worse", say: "Turn it around on the other side.", st: { pos: p0 * 1.1, tone: "fiery" }, style: "push" }] });
  if (out.length < 3) out.push(out[0]);
  return out.slice(0, 3);
}

/** One answer on the show. The host's lean decides who is listening: your own voters, the other side's or the persuadable middle. */
export function podAnswer(c: Ctx, s: State, m: Meet, q: PodQ, k: number): { fx: number; parts: Part[]; clip: string | null } {
  const o = q.opts[k], lean = m.pod?.lean ?? "O";
  const friendly = lean === c.side, hostile = lean !== "O" && !friendly;
  const others = q.opts.map((x) => react(c, s, x.st, 0.7, false));
  const mean = others.reduce((a, x) => a + x.fx, 0) / Math.max(1, others.length);
  const r = react(c, s, o.st, 0.7);
  let k2 = 0.6;
  if (hostile) k2 *= o.style === "middle" ? 1.6 : o.style === "push" ? 1.25 : o.style === "joke" ? 1.1 : 0.7;
  if (friendly) k2 *= o.style === "straight" ? 1.2 : o.style === "push" ? 1 : 0.7;
  if (lean === "O") k2 *= o.style === "joke" ? 1.3 : o.style === "middle" ? 1.15 : 0.9;
  let fx = (r.fx - mean) * k2 + (hostile && o.style !== "straight" ? 0.02 : 0);
  let clip: string | null = null;
  const risk = o.style === "push" ? 0.22 : o.style === "joke" ? 0.14 : 0.05;
  if (rand(s) < risk) { const good = rand(s) < (hostile ? 0.55 : 0.45) + (s.mgr === "digital" ? 0.08 : 0); const d = (good ? 1 : -1) * (0.06 + rand(s) * 0.06); fx += good ? d : d * DIFF[s.diff].neg; clip = good ? "That moment is already a clip with a million views. A good one." : "That moment is already a clip, and it is being shared with the worst possible caption."; }
  fx *= att(s);
  const parts = r.parts.slice(0, 4).map((p) => ({ ...p, fx: (p.fx - mean / 4) * k2 * att(s) }));
  return { fx, parts, clip };
}
export function finishPod(c: Ctx, s: State, m: Meet, total: number, parts: Part[]) {
  const lean = m.pod?.lean ?? "O", friendly = lean === c.side;
  s.days = Math.max(0, s.days - COST.podcast);
  (s.pods ??= []).push(m.who); s.met.push(m.id); s.invites = s.invites.filter((y) => y.id !== m.id);
  s.buzz = clamp(s.buzz + (friendly ? 8 : 14) + (total > 0 ? 4 : 0), 0, 100);
  if (friendly) s.enth[0] = clamp(s.enth[0] + (total >= 0 ? 4 : 1), 0, 100);
  if (friendly) { const amt = Math.round(c.weekly * 0.1); s.cash += amt; s.raised += amt; }
  applyGlobal(s, total, parts, 0.6);
  s.log.push({ w: s.week, kind: "event", t: `On ${m.who}'s show: ${total >= 0.03 ? "it went well" : total <= -0.03 ? "it went badly" : "a wash"}.`, fx: total });
}

export const STAFF_NAME = (k: keyof typeof STAFF_COST) => STAFF_COST[k].name;
export const regionNames = (c: Ctx) => regionsOf(c.r).map((g) => g.name);
export const summerNow = (s: State) => cal(s) <= 0;
export const noise = (s: State) => gauss(s);

/** A redbox: a box on your website that tells allied outside groups, in public, what message to run and where. It is
 * how campaigns legally steer super PACs they may not coordinate with. Allied money hits harder for two weeks. */
export function sendRedbox(c: Ctx, s: State, msg: "positive" | "contrast"): ActResult {
  const last = Math.max(-9, ...(s.asked ?? []).filter((a) => a.startsWith("rb@")).map((a) => Number(a.slice(3))));
  if (s.week - last < 3) return { ok: false, t: "Your allies already have this month's redbox." };
  (s.asked ??= []).push(`rb@${s.week}`); s.redbox = 2;
  let t = `Redbox posted: "${msg === "positive" ? `${c.r.state} families need to see ${c.me.name}'s plan on costs` : `voters in ${c.r.state} need to know ${c.op.name}'s record`}." Allied groups picked it up within a day.`, fx = 0;
  if (rand(s) < 0.08) { fx = -0.04 * DIFF[s.diff].neg * att(s); applyGlobal(s, fx, [{ label: "Voters following the race", share: 55, lean: 0, fx }], 0.7); t += " A watchdog filed a coordination complaint. It will go nowhere, but it made the news."; }
  s.log.push({ w: s.week, kind: "you", t, fx: fx || undefined });
  return { ok: true, t, fx };
}
