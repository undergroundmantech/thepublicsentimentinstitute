// Campaign 2028, the deep campaign: voter groups, early vote banking and ballot chase, staff, volunteers, television by
// media market with reserved time, invitations from the people who matter, the betting line and the final weekend.
// Everything here plays on the general election state in engine28 and the data in public/play/2028.json.
import type { Data, GenS, Res, LogItem, Party, Tone } from "./engine28";
import * as E from "./engine28";
import { afterInvite } from "./story28";

// ------------------------------------------------------------- the calendar
/** Weeks left in the race, counting this one: 1 is the final week. */
export const toGo = (s: { week: number; weeks: number }, w = s.week) => s.weeks - w + 1;
const DAY0 = (d: Data) => Date.parse(`${d.election}T12:00:00Z`);
/** The dates a campaign week covers. */
export function weekDates(d: Data, s: { weeks: number }, w: number) {
  const end = DAY0(d) - (s.weeks - w) * 7 * 864e5, start = end - 6 * 864e5;
  const f = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return `${f(start)} to ${f(end)}`;
}
export const LENGTHS = [
  { w: 8, name: "Sprint", blurb: "Labor Day to Election Day. Eight weeks, every one of them decisive." },
  { w: 12, name: "The full fall", blurb: "From the middle of August. Time to build a ground game and bank early votes." },
  { w: 16, name: "Marathon", blurb: "Out of the conventions in July. Sixteen weeks of strategy, money and staff." },
];

// ------------------------------------------------------------- early voting
/** Roughly the share of each state's 2024 vote cast before Election Day, by mail or in person. Approximate. */
export const EARLY: Record<string, number> = {
  AL: 0.12, AK: 0.4, AZ: 0.85, AR: 0.6, CA: 0.88, CO: 0.94, CT: 0.35, DE: 0.42, DC: 0.6, FL: 0.78, GA: 0.75, HI: 0.94, ID: 0.45, IL: 0.55, IN: 0.45, IA: 0.45,
  KS: 0.5, KY: 0.3, LA: 0.4, ME: 0.45, MD: 0.5, MA: 0.55, MI: 0.6, MN: 0.55, MS: 0.15, MO: 0.3, MT: 0.75, NE: 0.5, NV: 0.85, NH: 0.15, NJ: 0.55, NM: 0.7,
  NY: 0.4, NC: 0.78, ND: 0.55, OH: 0.45, OK: 0.35, OR: 0.95, PA: 0.38, RI: 0.45, SC: 0.6, SD: 0.5, TN: 0.65, TX: 0.65, UT: 0.94, VT: 0.8, VA: 0.65, WA: 0.95,
  WV: 0.45, WI: 0.55, WY: 0.45,
};
/** States that count ballots cast before Election Day first, so their early returns lean toward whoever banked more. */
export const COUNTS_EARLY_FIRST = new Set(["AZ", "FL", "GA", "NC", "TX", "OH", "NV", "VA", "IA", "NH", "MN", "CO", "NM"]);
export const earlyOf = (st: string) => EARLY[st.split("-")[0]] ?? 0.5;
/** Early voters lean Democratic by this many points of margin against the final count in a state; less where nearly everyone votes early. */
export const skewOf = (st: string) => 1.5 + 6 * (1 - earlyOf(st));
/** The share of a state's eventual early vote cast in each of the last six weeks. */
const SCHED = [0.35, 0.25, 0.17, 0.11, 0.08, 0.04]; // weeks to go 1 to 6
export const EARLY_FROM = 6;
export const earlyOpen = (s: { week: number; weeks: number }) => toGo(s) <= EARLY_FROM;

// ------------------------------------------------------------- voter groups
export type Grp = { k: string; l: string; fam?: string; turn?: number; us: [number, number]; st: Record<string, [number, number]>; pos: number[]; care: number[]; ck: string };
export const OUTREACH: Record<string, { ev: string; ads: string; reg: string; where: string }> = {
  black_w: { ev: "a church women's day luncheon and a sorority forum on health care and child care", ads: "Black radio, gospel stations and targeted digital", reg: "registration with Black churches and sororities", where: "Atlanta, Philadelphia, Detroit and Charlotte" },
  black_m: { ev: "a barbershop tour and an HBCU homecoming tailgate", ads: "sports radio, barbershop podcasts and YouTube", reg: "registration with fraternities, barbershops and second chance groups", where: "Milwaukee, Detroit, Atlanta and Philadelphia" },
  hisp_w: { ev: "a Spanish language town hall on prices and schools", ads: "Spanish language television and WhatsApp groups", reg: "a naturalization ceremony registration table", where: "Phoenix, Las Vegas, Orlando and the Rio Grande Valley" },
  hisp_m: { ev: "a construction site visit and a boxing night watch party", ads: "Spanish sports radio, YouTube and Facebook", reg: "registration at job sites and soccer leagues", where: "Las Vegas, Phoenix, the Rio Grande Valley and Reading" },
  asian: { ev: "a community center festival and an in language press roundtable", ads: "in language digital, radio and newspapers", reg: "in language registration with community groups", where: "Gwinnett County, Clark County and the Philadelphia suburbs" },
  wnc_w: { ev: "a kitchen table forum on grocery prices at a diner", ads: "local news, daytime television and Facebook", reg: "registration at county fairs and big box stores", where: "Scranton, Saginaw, Green Bay and rural Georgia" },
  wnc_m: { ev: "a factory floor shift change and a county fair", ads: "local radio, sports broadcasts and podcasts", reg: "registration at union halls and gun shows", where: "Erie, Macomb County, Wausau and northeast Ohio" },
  wcol_w: { ev: "a suburban coffee shop tour and a school board forum", ads: "streaming television and parenting podcasts", reg: "registration at farmers markets and new developments", where: "Bucks County, Oakland County, Waukesha and Cobb County" },
  wcol_m: { ev: "a business roundtable and a tech meetup", ads: "streaming, sports and business podcasts", reg: "registration outreach in new suburbs", where: "Chester County, Ozaukee County and North Fulton" },
  young_w: { ev: "a campus rally on abortion rights and student debt", ads: "TikTok, Instagram and creator partnerships", reg: "campus registration with student groups", where: "Ann Arbor, Madison, Athens and Tempe" },
  young_m: { ev: "a gaming stream, a sports podcast and a gym tour", ads: "YouTube, Twitch and sports creators", reg: "registration at games, gyms and trade schools", where: "Phoenix, Las Vegas, Milwaukee and Atlanta suburbs" },
  mid: { ev: "a parents' night on child care, housing and costs", ads: "streaming television and Instagram", reg: "registration at day cares and new apartment complexes", where: "fast growing suburbs and exurbs" },
  gx: { ev: "a town hall on jobs, health care and retirement", ads: "cable news, local news and Facebook", reg: "registration drives at workplaces", where: "older suburbs and small cities" },
  old_w: { ev: "a Medicare and Social Security forum at a senior center", ads: "local news, daytime television and direct mail", reg: "absentee ballot request drives at retirement communities", where: "The Villages, Sun City and the Lehigh Valley" },
  old_m: { ev: "a VFW hall and a veterans breakfast", ads: "local news, talk radio and direct mail", reg: "absentee ballot request drives at veterans halls", where: "Pinellas County, Maricopa and Lackawanna" },
  ind: { ev: "a no party forum with undecided voters", ads: "a bipartisan message on cable news", reg: "registration outreach to unaffiliated voters", where: "the Philadelphia collar counties, Maricopa and Washoe" },
  pres: { ev: "a big stadium rally that feels like an event, not a lecture", ads: "sports broadcasts, YouTube and podcasts", reg: "reminders to voters who skip midterms", where: "everywhere, especially exurbs and small towns" },
  new24: { ev: "a first time voter concert", ads: "creator partnerships and text programs", reg: "registration checks for people who moved since 2024", where: "college towns and growing exurbs" },
  surge: { ev: "a thank you rally for the voters who turned out in 2026", ads: "text programs and digital", reg: "address updates for 2026 voters who moved", where: "suburbs that flipped in 2026" },
  lapsed: { ev: "door to door in neighborhoods that stopped voting", ads: "direct mail and local radio", reg: "re-registration for voters purged from the rolls", where: "rural counties and older cities" },
};
/** The finer groups that make up a broad group, so an endorsement or meeting aimed at "union households" reaches them all. */
export const KIDS: Record<string, string[]> = {
  black: ["black_w", "black_m"], hisp: ["hisp_w", "hisp_m"], asian: ["asian"], wnc: ["wnc_w", "wnc_m"], wcol: ["wcol_w", "wcol_m"],
  young: ["young_w", "young_m"], old: ["old_w", "old_m"], ind: ["ind"], new: ["new24", "surge"], women: ["black_w", "hisp_w", "wnc_w", "wcol_w", "young_w", "old_w"], men: ["black_m", "hisp_m", "wnc_m", "wcol_m", "young_m", "old_m"],
};
export const kidsOf = (k: string) => KIDS[k] ?? [k];
const grpData = (d: Data) => (d as Data & { groups?: Grp[] }).groups ?? [];
export const groupsOf = (d: Data) => grpData(d);
/** The group's lean toward the player in a state, from -1 to 1, before anything the campaign has done. */
function leanFor(g: Grp, st: string, p: Party) { const x = g.st[st] ?? g.st[st.split("-")[0]] ?? g.us; const dshare = x[1] / 100; return p === "D" ? 2 * dshare - 1 : 1 - 2 * dshare; }
const shareIn = (g: Grp, st: string) => ((g.st[st] ?? g.st[st.split("-")[0]] ?? g.us)[0]) / 100;
/** The player's share of the group's two party vote nationally, with the campaign's work in it. */
export function groupShare(d: Data, s: GenS, g: Grp) {
  const base = s.party === "D" ? g.us[1] : 100 - g.us[1];
  const meC = E.candOf(d, s.party, s.me), opC = E.candOf(d, s.party === "D" ? "R" : "D", s.op);
  const cand = ((meC?.grp?.[g.ck] ?? 0) - (opC?.grp?.[g.ck] ?? 0)) / 4;
  const work = (s.gsup?.[g.k] ?? 0) - (s.opGsup?.[g.k] ?? 0);
  return Math.max(2, Math.min(98, base + cand / 2 + work / 2));
}
/** Points of margin the campaign's work with each group adds in each state, the player's way. Groups overlap, so each
 * effect is damped. */
export function groupFx(d: Data, s: GenS): number[] {
  const G = grpData(d); if (!G.length || (!s.gsup && !s.gturn)) return d.states.map(() => 0);
  return d.states.map((x) => {
    let v = 0;
    for (const g of G) {
      const sh = shareIn(g, x.st); if (!sh) continue;
      const sup = (s.gsup?.[g.k] ?? 0) - (s.opGsup?.[g.k] ?? 0);
      const turn = (s.gturn?.[g.k] ?? 0) - (s.opGturn?.[g.k] ?? 0) + (s.gstate?.[`${x.st.split("-")[0]}:${g.k}`] ?? 0);
      v += sh * (0.31 * sup + 0.24 * turn * leanFor(g, x.st, s.party)); // twenty groups that overlap across four families
    }
    return v;
  });
}
/** Take a stand: each group reacts by where it stands on the issue and how much it cares. */
export function groupStance(d: Data, s: GenS, k: number, from: number, to: number) {
  const out: { g: string; v: number }[] = [];
  for (const g of grpData(d)) {
    const v = 1.6 * (g.care[k] ?? 0) * ((g.pos[k] - from) ** 2 - (g.pos[k] - to) ** 2);
    s.gsup = { ...(s.gsup ?? {}), [g.k]: clamp((s.gsup?.[g.k] ?? 0) + v, -12, 12) }; out.push({ g: g.l, v });
  }
  return out.sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
}
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const si = (d: Data, st: string) => d.states.findIndex((x) => x.st === st);
const used = (s: GenS, key: string) => (s.gused?.[key] ?? 0);
const bump = (s: GenS, key: string) => { s.gused = { ...(s.gused ?? {}), [key]: used(s, key) + 1 }; };

/** Go where the group is: an event in a state, aimed at one group. */
export function groupEvent(d: Data, s: GenS, gk: string, st: string): Res {
  if (s.days < 2) return { ok: false, t: "An outreach event takes a full day." };
  if (s.cash < 300e3) return { ok: false, t: "Not enough cash for the event." };
  const g = grpData(d).find((x) => x.k === gk); if (!g) return { ok: false, t: "Unknown group." };
  const n = used(s, `ev:${gk}`); const sh = shareIn(g, st); const k = (0.55 / (1 + 0.35 * n)) * (0.7 + s.stamina / 330);
  s.days -= 2; s.cash -= 300e3; s.stamina = clamp(s.stamina - 10, 0, 100); bump(s, `ev:${gk}`);
  s.gsup = { ...(s.gsup ?? {}), [gk]: (s.gsup?.[gk] ?? 0) + k * 0.5 };
  const key = `${st.split("-")[0]}:${gk}`; s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + k * 2.2 };
  s.visits[st] = (s.visits[st] ?? 0) + 1; s.vol = (s.vol ?? 0) + Math.round(400 * k * (1 + sh * 4));
  return { ok: true, t: `${OUTREACH[gk]?.ev ?? "An outreach event"} in ${E.nameOf(d, st)}. ${g.l} are ${Math.round(sh * 100)} percent of the vote there.`, fx: k };
}
/** A targeted buy: the media each group actually uses, nationwide. */
export function groupAds(d: Data, s: GenS, gk: string, amt: number): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const g = grpData(d).find((x) => x.k === gk); if (!g) return { ok: false, t: "Unknown group." };
  const n = used(s, `ad:${gk}`); const k = 0.8 * Math.log(1 + amt / 12e6) / (1 + 0.25 * n) * (s.staff?.digital ? 1.25 : 1) * E.mgrOf(s).tv;
  s.cash -= amt; bump(s, `ad:${gk}`); s.gsup = { ...(s.gsup ?? {}), [gk]: (s.gsup?.[gk] ?? 0) + k };
  return { ok: true, t: `${E.usd(amt)} on ${OUTREACH[gk]?.ads ?? "targeted ads"} for ${g.l.toLowerCase()}.`, fx: k };
}
export const regDeadline = (s: { weeks: number }) => s.weeks - 3; // the last week to register new voters
/** Register new voters from a group in a state, before the deadline. Pays where the group leans your way. */
export function groupReg(d: Data, s: GenS, gk: string, st: string, amt: number): Res {
  if (s.week > regDeadline(s)) return { ok: false, t: "Registration has closed in most states." };
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const g = grpData(d).find((x) => x.k === gk); if (!g) return { ok: false, t: "Unknown group." };
  const key = `${st.split("-")[0]}:${gk}`; const n = used(s, `reg:${key}`);
  const lean = leanFor(g, st, s.party); const k = 1.6 * Math.log(1 + amt / (d.states[si(d, st)].votes * 0.35)) / (1 + 0.5 * n) * (s.staff?.field ? 1.3 : 1);
  s.cash -= amt; bump(s, `reg:${key}`); s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + k };
  return { ok: true, t: `${OUTREACH[gk]?.reg ?? "A registration drive"} in ${E.nameOf(d, st)}. ${lean > 0 ? `${g.l} there lean your way, about ${Math.round((lean + 1) * 50)} percent.` : `${g.l} there lean against you, so this helps them as much as you.`}`, fx: k * lean * shareIn(g, st) };
}

// ------------------------------------------------------------- staff
export const STAFF = {
  pollster: { name: "Pollster", tiers: [null, { name: "C rated pollster", wk: 150e3, sd: 0.82 }, { name: "B rated pollster", wk: 300e3, sd: 0.62 }, { name: "A rated pollster", wk: 520e3, sd: 0.45 }] },
  media: { name: "Media consultant", wk: 400e3, hire: 1e6, what: "Television and group ads go 20 percent further." },
  field: { name: "Field director", wk: 350e3, hire: 800e3, what: "Ballot chase, canvassing and registration go 30 percent further, and volunteers grow faster." },
  digital: { name: "Digital director", wk: 300e3, hire: 600e3, what: "Email and text raise 40 percent more, and group ads go 25 percent further." },
  oppo: { name: "Research director", wk: 250e3, hire: 500e3, what: "Opposition research finds more, and what it finds is better sourced." },
} as const;
export type StaffKey = "media" | "field" | "digital" | "oppo";
export type Staff = { pollster: 0 | 1 | 2 | 3; media: boolean; field: boolean; digital: boolean; oppo: boolean };
export function hireStaff(s: GenS, key: StaffKey | "pollster", tier?: 1 | 2 | 3): Res {
  s.staff = s.staff ?? { pollster: 0, media: false, field: false, digital: false, oppo: false };
  if (key === "pollster") { const t = STAFF.pollster.tiers[tier ?? 1]!; s.staff.pollster = tier ?? 1; return { ok: true, t: `Hired a ${t.name} at ${E.usd(t.wk)} a week. Your read of every state gets sharper.` }; }
  const x = STAFF[key]; if (s.staff[key]) { s.staff[key] = false; return { ok: true, t: `Let the ${x.name.toLowerCase()} go.` }; }
  if (s.cash < x.hire) return { ok: false, t: `Hiring a ${x.name.toLowerCase()} costs ${E.usd(x.hire)} up front.` };
  s.cash -= x.hire; s.staff[key] = true; return { ok: true, t: `Hired a ${x.name.toLowerCase()} for ${E.usd(x.hire)} and ${E.usd(x.wk)} a week. ${x.what}` };
}
export function payroll(s: GenS) {
  const st = s.staff; if (!st) return 0; let w = 0;
  const t = STAFF.pollster.tiers[st.pollster]; if (t) w += t.wk;
  for (const k of ["media", "field", "digital", "oppo"] as StaffKey[]) if (st[k]) w += STAFF[k].wk;
  return w;
}
export const pollSd = (s: GenS) => STAFF.pollster.tiers[s.staff?.pollster ?? 0]?.sd ?? 1;

// ------------------------------------------------------------- field: volunteers, canvassing, ballot chase
/** Send the volunteer army into one state for a weekend of door knocking. */
export function canvass(d: Data, s: GenS, st: string): Res {
  if (s.days < 2) return { ok: false, t: "Organizing a canvass weekend takes a full day of your time." };
  const v = s.vol ?? 0; if (v < 2000) return { ok: false, t: "You need at least 2,000 volunteers. Rallies and outreach events recruit them." };
  const i = si(d, st); const x = d.states[i]; const n = used(s, `can:${st}`);
  const doors = Math.round(v * 0.35 * 30); const k = 0.6 * Math.log(1 + doors / (x.votes * 0.25)) / (1 + 0.35 * n) * (s.staff?.field ? 1.3 : 1) * E.mgrOf(s).field;
  s.days -= 2; bump(s, `can:${st}`); s.gotv[i] += k; s.contacts = (s.contacts ?? 0) + doors;
  return { ok: true, t: `${doors.toLocaleString("en-US")} doors knocked in ${x.n} in one weekend.`, fx: k };
}
/** Chase ballots: find your supporters who requested a ballot or have not voted early, and get them banked. */
export function chase(d: Data, s: GenS, st: string, amt: number): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  const i = si(d, st); s.cash -= amt; s.chase = s.chase ?? d.states.map(() => 0); s.chase[i] += amt * (s.staff?.field ? 1.3 : 1) * E.mgrOf(s).field;
  return { ok: true, t: `${E.usd(amt)} into ballot chase in ${d.states[i].n}: mail ballot follow ups, rides to early voting and cure teams for rejected ballots.${earlyOpen(s) ? "" : " It starts working when early voting opens."}`, fx: 0 };
}
const chaseFx = (votes: number, amt: number) => 2.2 * Math.log(1 + amt / (votes * 0.9));

// ------------------------------------------------------------- television by media market, and reserved time
export type Dma = { n: string; v: number; s: [string, number][] };
export const dmasOf = (d: Data) => (d as Data & { dmas?: Dma[] }).dmas ?? [];
/** Ad rates climb as Election Day nears, and stations sell out. */
export const rateAt = (s: { week: number; weeks: number }, w = s.week) => { const g = s.weeks - w + 1; return g >= 9 ? 0.8 : g >= 6 ? 1 : g >= 3 ? 1.25 : 1.55; };
export function marketsFor(d: Data, st: string) {
  return dmasOf(d).map((m) => ({ m, sh: m.s.find((x) => x[0] === st.split("-")[0])?.[1] ?? 0 })).filter((x) => x.sh > 0.04).sort((a, b) => b.sh - a.sh).slice(0, 6);
}
function airMarket(d: Data, s: GenS, m: Dma, amt: number, mult: number) {
  const k = 0.9 * Math.log(1 + amt / (m.v * 1.6)) * mult;
  for (const [st, sh] of m.s) { const i = si(d, st); if (i >= 0) s.ads[i] += k * sh * 1.6; for (const dd of ["-1", "-2", "-3"]) { const j = si(d, st + dd); if (j >= 0) s.ads[j] += k * sh * 1.6; } }
  return k;
}
export function buyMarket(d: Data, s: GenS, name: string, amt: number, tone: Tone, G: { rng: number }): Res {
  const m = dmasOf(d).find((x) => x.n === name); if (!m) return { ok: false, t: "Unknown market." };
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  s.cash -= amt; const T = E.TONES[tone]; const risk = T.risk * (s.mgr === "ads" ? 0.5 : 1);
  const mult = T.k * E.mgrOf(s).tv * (s.staff?.media ? 1.2 : 1) / rateAt(s);
  if (rand(G) < risk) { airMarket(d, s, m, amt, -0.35 * mult); s.enth[1] = clamp(s.enth[1] + 0.8, 0, 100); return { ok: true, t: `The ${T.name.toLowerCase()} ad in the ${m.n} market backfired. Local news called it misleading.`, fx: -0.2 }; }
  const k = airMarket(d, s, m, amt, mult); if (tone === "positive") s.enth[0] = clamp(s.enth[0] + 0.3, 0, 100);
  const reach = m.s.map(([st, sh]) => `${st} ${Math.round(sh * 100)}%`).join(", ");
  return { ok: true, t: `${E.usd(amt)} of ${T.name.toLowerCase()} ads in ${m.n}, at ${rateAt(s).toFixed(2)} times the base rate. It reaches ${reach} of those states' voters.`, fx: k };
}
/** Book air time now for a later week, at today's rate. It airs that week. */
export function reserveMarket(d: Data, s: GenS, name: string, amt: number, w: number, tone: Tone): Res {
  if (s.cash < amt) return { ok: false, t: "Not enough cash." };
  if (w <= s.week || w > s.weeks) return { ok: false, t: "Pick a later week." };
  s.cash -= amt; s.reserved = [...(s.reserved ?? []), { w, dma: name, amt: amt * rateAt(s, w) / rateAt(s), tone }];
  return { ok: true, t: `Reserved ${E.usd(amt)} in ${name} for week ${w}, at today's rate. When it airs it buys what ${E.usd(amt * rateAt(s, w) / rateAt(s))} would then.` };
}

// ------------------------------------------------------------- invitations: the people who can help
export type InvOpt = { label: string; say: string; days: number; cash?: number; vol?: number; gsup?: Record<string, number>; gst?: number; enth?: number; nat?: number; risk?: number; leak?: string; tag?: string };
export type Invite = { id: string; who: string; role: string; st: string; g: string; title: string; intro: string; opts: InvOpt[] };
const O = (...x: InvOpt[]) => x;
const INV: ((st: string, sn: string) => Omit<Invite, "id" | "st">)[] = [
  (st, sn) => ({ who: `${sn} AFL-CIO president`, role: "union", g: "wnc", title: "The union hall wants a sit down", intro: `The ${sn} labor federation has two hundred thousand members and a door knocking program. They want to hear where you stand on trade and the right to organize before they commit.`,
    opts: O({ label: "Back the PRO Act", say: "I will sign it in my first hundred days.", tag: "union_pro", days: 1, vol: 6000, gsup: { wnc: 0.6, wcol: -0.2 }, gst: 1.2 }, { label: "Talk jobs, not bills", say: "I am for every worker in this room.", days: 1, vol: 2500, gsup: { wnc: 0.25 } }, { label: "Send a surrogate", say: "", tag: "union_skip", days: 0, gsup: { wnc: -0.15 } }) }),
  (st, sn) => ({ who: `A megadonor from ${sn}`, role: "donor", g: "wcol", title: "A billionaire wants a dinner", intro: "One of the biggest donors in the country will host a fundraiser at their house. They have asked, politely, about your tax plan.",
    opts: O({ label: "Take the dinner", say: "Thank you for having me.", tag: "dinner", days: 2, cash: 22e6, risk: 0.2, leak: "Video from inside the dinner leaks, and it does not look great.", nat: -0.15 }, { label: "Take it and tell them taxes go up", say: "You will pay more under me, and you can afford it.", tag: "dinner_tax", days: 2, cash: 9e6, gsup: { wnc: 0.25, ind: 0.15 } }, { label: "Decline", say: "", days: 0, gsup: { wnc: 0.1 } }) }),
  (st, sn) => ({ who: "The biggest podcast in America", role: "podcast", g: "young", title: "Three hours on the podcast", intro: "The most listened to podcast in the country, with millions of young men, wants you for a long form conversation. No notes, no time limit.",
    opts: O({ label: "Go on for three hours", say: "Let's do it.", tag: "podcast_long", days: 1, gsup: { young: 1.1, wnc: 0.4 }, risk: 0.3, leak: "One clip from hour two goes viral for the wrong reasons.", nat: -0.2 }, { label: "Do a short version", say: "I have an hour.", days: 1, gsup: { young: 0.5 } }, { label: "Pass", say: "", days: 0, gsup: { young: -0.3 } }) }),
  (st, sn) => ({ who: `A megachurch pastor in ${sn}`, role: "faith", g: "black", title: "Speak from the pulpit", intro: `The pastor of the biggest church in ${sn} invites you to speak at Sunday service and stay for the fellowship lunch.`,
    opts: O({ label: "Speak and stay all day", say: "I am honored to be here.", tag: "pastor", days: 2, gsup: { black: 0.9, old: 0.2 }, gst: 1.8 }, { label: "Attend the service", say: "", days: 1, gsup: { black: 0.4 }, gst: 0.6 }, { label: "Send your running mate", say: "", days: 0, gsup: { black: 0.15 } }) }),
  (st, sn) => ({ who: `The mayor of ${sn}'s largest city`, role: "mayor", g: "hisp", title: "The mayor will endorse, with a catch", intro: "The mayor is ready to endorse and put the city's machine behind you, if you promise federal money for transit and housing.",
    opts: O({ label: "Promise the money", say: "You have my word.", tag: "mayor_promise", days: 1, gsup: { hisp: 0.5, black: 0.3 }, gst: 1.4, vol: 4000 }, { label: "Endorsement, no promises", say: "", days: 1, gsup: { hisp: 0.2 }, risk: 0.35, leak: "The mayor stays neutral and says so on television.", nat: -0.05 }, { label: "Skip it", say: "", days: 0 }) }),
  (st, sn) => ({ who: `${sn} farm bureau leaders`, role: "farm", g: "wnc", title: "Farmers want to talk tariffs", intro: "Soybean and corn growers have lost export markets and want to know where you stand on tariffs and the farm bill.",
    opts: O({ label: "Promise relief and fair trade", say: "No farmer pays for a trade war.", tag: "farm_relief", days: 1, gsup: { wnc: 0.5, old: 0.2 } }, { label: "Defend tariffs", say: "Short term pain for American strength.", days: 1, gsup: { wnc: 0.2, ind: -0.3 } }, { label: "Skip it", say: "", days: 0 }) }),
  (st, sn) => ({ who: `A Latino business association in ${sn}`, role: "biz", g: "hisp", title: "Small business owners want answers", intro: "Hispanic small business owners, many of them former Republicans, want to hear about prices, permits and immigration enforcement.",
    opts: O({ label: "Lead with the economy", say: "Lower costs and fewer permits.", days: 1, gsup: { hisp: 0.8, ind: 0.2 } }, { label: "Lead with immigration reform", say: "", days: 1, gsup: { hisp: 0.6, wnc: -0.2 } }, { label: "Skip it", say: "", days: 0, gsup: { hisp: -0.25 } }) }),
  (st, sn) => ({ who: "A national veterans group", role: "vet", g: "old", title: "Veterans want a forum", intro: "The largest veterans group in the country hosts a forum on the Iran war and the VA. They invited both candidates. Only you have said yes so far.",
    opts: O({ label: "Do the forum", say: "Thank you for your service, and here is my plan.", days: 1, gsup: { old: 0.6, wnc: 0.3 }, gst: 0.8 }, { label: "Send a statement", say: "", days: 0, gsup: { old: 0.1 } }) }),
  (st, sn) => ({ who: "A campus coalition", role: "student", g: "young", title: "Students want you on campus", intro: `Student groups at the biggest university in ${sn} want a rally and a registration push before the deadline.`,
    opts: O({ label: "Rally and register", say: "Your vote is your power.", days: 2, gsup: { young: 0.7 }, gst: 2.2, vol: 5000 }, { label: "A quick stop", say: "", days: 1, gsup: { young: 0.3 }, gst: 0.8 }, { label: "Pass", say: "", days: 0 }) }),
  (st, sn) => ({ who: "A suburban moms network", role: "teacher", g: "wcol", title: "A kitchen table forum", intro: "A network of suburban parents with a large online following wants a frank conversation about schools, costs and safety.",
    opts: O({ label: "Do the forum", say: "Let's talk about what keeps you up at night.", days: 1, gsup: { wcol: 0.7, ind: 0.3 } }, { label: "Do it, livestreamed", say: "", days: 1, gsup: { wcol: 0.9, ind: 0.3 }, risk: 0.25, leak: "A testy exchange with a mom becomes the clip of the day.", nat: -0.1 }, { label: "Skip it", say: "", days: 0 }) }),
];
export function dealInvites(d: Data, s: GenS, G: { rng: number }): Invite[] {
  const ms = E.readMargins(d, s);
  const close = d.states.map((x, i) => ({ x, w: x.ev / (1 + Math.abs(ms[i]) ** 1.4) })).filter((z) => !z.x.st.includes("-")).sort((a, b) => b.w - a.w).slice(0, 10);
  const out: Invite[] = []; const seen = new Set<number>(); const F = s.story?.flags ?? {};
  // whoever has already had their answer does not ask again
  for (let k = 0; k < INV.length; k++) if (F[`inv:${k}`] != null) seen.add(k);
  while (out.length < 2 && seen.size < INV.length) {
    const k = Math.floor(rand(G) * INV.length); if (seen.has(k)) continue; seen.add(k);
    const st = close[Math.floor(rand(G) * close.length)].x;
    out.push({ id: `${s.week}:${k}`, st: st.st, ...INV[k](st.st, st.n) });
  }
  return out;
}
export function answerInvite(d: Data, s: GenS, inv: Invite, k: number, G: { rng: number }): Res {
  const o = inv.opts[k]; if (s.days < o.days * 2) return { ok: false, t: "Not enough time left this week." };
  s.days -= o.days * 2; let t = o.label;
  if (o.cash) { s.cash += o.cash; t += `: ${E.usd(o.cash)} raised`; }
  if (o.vol) { s.vol = (s.vol ?? 0) + o.vol; t += `, ${o.vol.toLocaleString("en-US")} new volunteers`; }
  for (const [g0, v] of Object.entries(o.gsup ?? {})) for (const g of kidsOf(g0)) s.gsup = { ...(s.gsup ?? {}), [g]: (s.gsup?.[g] ?? 0) + v };
  if (o.gst) for (const gk of kidsOf(inv.g)) { const key = `${inv.st}:${gk}`; s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + o.gst! }; }
  if (o.enth) s.enth[0] = clamp(s.enth[0] + o.enth, 0, 100);
  if (o.days) s.visits[inv.st] = (s.visits[inv.st] ?? 0) + 1;
  let fx = Object.values(o.gsup ?? {}).reduce((a, b) => a + b, 0) * 0.3; let leaked = false;
  if (o.risk && rand(G) < o.risk) { leaked = true; s.nat += o.nat ?? -0.1; fx += o.nat ?? -0.1; t += `. ${o.leak ?? "It leaked."}`; }
  // the answer goes on the record and sets up what follows
  s.story = s.story ?? { said: {}, flags: {}, queue: [], due: [], facts: [] }; s.story.flags[`inv:${inv.id.split(":")[1]}`] = o.label;
  afterInvite(s, o.tag, inv.st, leaked);
  s.invites = (s.invites ?? []).filter((x) => x.id !== inv.id); s.met = (s.met ?? 0) + (o.days ? 1 : 0);
  return { ok: true, t: `${inv.who}: ${t}.`, fx };
}

// ------------------------------------------------------------- the betting line
/** A prediction market on the race: it trades on the public polls, overreacts, and whales move it. */
export function marketWeek(s: GenS, G: { rng: number }, pubM: number): string | null {
  const fair = 1 / (1 + Math.exp(-pubM / 2.6));
  const p0 = s.mkt?.p ?? fair; let p = p0 + (fair - p0) * 0.6 + E.gauss(G) * 0.025; let note: string | null = null;
  if (rand(G) < 0.18) { const big = E.gauss(G) * 0.07; p += big; note = `A whale ${big > 0 ? "bought" : "sold"} about ${E.usd(2e6 + rand(G) * 6e6)} of your contract and moved the line ${Math.abs(big * 100).toFixed(0)} cents.`; }
  p = clamp(p, 0.02, 0.98); s.mkt = { p, hist: [...(s.mkt?.hist ?? []), Math.round(p * 1000) / 1000] };
  return note;
}

// ------------------------------------------------------------- the deep week, run inside genEnd before the week turns
export function deepWeek(d: Data, s: GenS, G: { rng: number }, out: LogItem[], order: { i: number; w: number }[]) {
  const w = s.week, g = toGo(s);
  // payroll
  const pay = payroll(s); if (pay) { s.cash -= pay; out.push({ t: w, kind: "money", s: `Payroll for your senior staff: ${E.usd(pay)}.` }); }
  // reserved air time that airs this week
  for (const r of (s.reserved ?? []).filter((x) => x.w === w)) { const m = dmasOf(d).find((x) => x.n === r.dma); if (m) airMarket(d, s, m, r.amt, E.TONES[r.tone as Tone].k * E.mgrOf(s).tv * (s.staff?.media ? 1.2 : 1) / rateAt(s)); }
  if ((s.reserved ?? []).some((x) => x.w === w)) out.push({ t: w, kind: "you", s: `Your reserved air time ran this week in ${[...new Set((s.reserved ?? []).filter((x) => x.w === w).map((x) => x.dma))].join(", ")}.` });
  // volunteers: enthusiasm brings them in, offices keep them, fatigue thins them
  const v0 = s.vol ?? 0; s.vol = Math.max(0, Math.round(v0 * 0.94 + 900 * (s.enth[0] / 50) * (s.staff?.field ? 1.4 : 1) + 450 * s.offices.length));
  // the rival works its groups: the two that lean its way the most and have the most room
  const opP: Party = s.party === "D" ? "R" : "D"; const GR = groupsOf(d);
  if (GR.length) {
    const top = GR.slice().sort((a, b) => leanFor(b, "US", opP) * b.us[0] - leanFor(a, "US", opP) * a.us[0]).slice(0, 5);
    // it works its strongest groups, but not the same two every week: it also answers where you have been gaining
    const gain = GR.slice().sort((a, b) => ((s.gsup?.[b.k] ?? 0) - (s.opGsup?.[b.k] ?? 0)) - ((s.gsup?.[a.k] ?? 0) - (s.opGsup?.[a.k] ?? 0)))[0];
    const r1 = top[Math.floor(rand(G) * top.length)]; const pick = [r1, (s.gsup?.[gain.k] ?? 0) > 1 && gain.k !== r1.k ? gain : top.find((x) => x.k !== r1.k)!];
    const kk = E.DIFF[s.diff].opp;
    for (const x of pick) { s.opGsup = { ...(s.opGsup ?? {}), [x.k]: (s.opGsup?.[x.k] ?? 0) + 0.22 * kk }; s.opGturn = { ...(s.opGturn ?? {}), [x.k]: (s.opGturn?.[x.k] ?? 0) + 0.25 * kk }; }
    s.opFocus = pick.map((x) => x.k);
    out.push({ t: w, kind: "rival", s: `${s.op} courted ${pick.map((x) => x.l.toLowerCase()).join(" and ")} this week.` });
  }
  // early voting: ballots bank at this week's margins, plus each side's chase
  if (g <= EARLY_FROM) {
    const ms = E.myMargins(d, s); const sideD = s.party === "D" ? 1 : -1; const frac = SCHED[g - 1] ?? 0;
    s.bank = s.bank ?? d.states.map(() => 0); s.bankM = s.bankM ?? d.states.map(() => 0); s.chase = s.chase ?? d.states.map(() => 0); s.opChase = s.opChase ?? d.states.map(() => 0);
    // the rival chases where it is closest
    const kk = E.DIFF[s.diff].opp; for (const x of order.slice(0, 6)) s.opChase[x.i] += 3e6 * kk;
    let tot = 0, totM = 0;
    d.states.forEach((x, i) => {
      const e = Math.min(0.95, earlyOf(x.st)), f = frac * e; if (f <= 0) return;
      const ch = chaseFx(x.votes, s.chase![i]) - chaseFx(x.votes, s.opChase![i]);
      const m = ms[i] + skewOf(x.st) * sideD + ch;
      s.bank![i] += f; s.bankM![i] += f * m;
      if (!x.st.includes("-")) { tot += f * x.votes; totM += f * x.votes * m; }
    });
    s.ballots = (s.ballots ?? 0) + tot; s.ballotsM = (s.ballotsM ?? 0) + totM;
    out.push({ t: w, kind: "event", s: `Early voting: about ${(tot / 1e6).toFixed(1)} million ballots banked this week, ${(s.ballots / 1e6).toFixed(1)} million so far. Among them you lead by about ${(totM / Math.max(1, tot)).toFixed(1)} points.` });
  }
  // the betting line and invitations for next week
  const pm = s.natPolls[s.natPolls.length - 1]?.m ?? 0; const note = marketWeek(s, G, pm); if (note) out.push({ t: w, kind: "money", s: note });
  s.invites = dealInvites(d, s, G); s.invW = w + 1;
}
/** On election night: the banked share of each state's vote and its margin, the player's way. */
export function bankOf(s: GenS, i: number) { const c = s.bank?.[i] ?? 0; return { cast: c, m: c > 0 ? (s.bankM![i] / c) : 0 }; }

// ------------------------------------------------------------- the final weekend
export type Closing = "positive" | "contrast" | "attack" | "base";
export const CLOSINGS: Record<Closing, { name: string; blurb: string }> = {
  positive: { name: "Hope", blurb: "Your vision, your story. Fires up your base and steadies the undecided." },
  contrast: { name: "Choice", blurb: "The clearest contrast between you and your opponent. The safe closing." },
  attack: { name: "Danger", blurb: "Everything wrong with your opponent. Hits hard, can backfire." },
  base: { name: "Turnout", blurb: "Every message is about voting. Lifts the groups that lean your way." },
};
export function finalPush(d: Data, s: GenS, me: string[], vp: string[], closing: Closing, G: { rng: number }): Res {
  for (const st of me) { const i = si(d, st); if (i < 0) continue; const k = 3.2 / Math.sqrt(4 + d.states[i].ev) * 0.9; s.pers[i] += k; s.gotv[i] += k * 0.6; s.visits[st] = (s.visits[st] ?? 0) + 1; }
  for (const st of vp) { const i = si(d, st); if (i < 0) continue; s.pers[i] += 3.2 / Math.sqrt(4 + d.states[i].ev) * 0.4; }
  let t = `Final weekend: you closed in ${me.map((x) => E.nameOf(d, x)).join(", ")}${vp.length ? `, your running mate in ${vp.map((x) => E.nameOf(d, x)).join(", ")}` : ""}.`;
  if (closing === "positive") { s.enth[0] = clamp(s.enth[0] + 4, 0, 100); s.nat += 0.15; }
  if (closing === "contrast") s.nat += 0.3;
  if (closing === "attack") { if (rand(G) < 0.3) { s.nat -= 0.2; s.enth[1] = clamp(s.enth[1] + 3, 0, 100); t += " The closing attack backfired."; } else s.nat += 0.6; }
  if (closing === "base") for (const g of groupsOf(d)) if (leanFor(g, "US", s.party) > 0.05) s.gturn = { ...(s.gturn ?? {}), [g.k]: (s.gturn?.[g.k] ?? 0) + 1.2 };
  s.finalDone = true; s.closing = closing;
  return { ok: true, t: `${t} Closing message: ${CLOSINGS[closing].name.toLowerCase()}.`, fx: 0 };
}
export function hireLawyers(s: GenS): Res {
  if (s.lawyers) return { ok: false, t: "Your election protection team is already in place." };
  if (s.cash < 6e6) return { ok: false, t: "An election protection operation costs $6M." };
  s.cash -= 6e6; s.lawyers = true; return { ok: true, t: "Lawyers and poll watchers in every battleground. Long lines and ballot fights will cost you less." };
}

const rand = (G: { rng: number }) => E.rand(G);
