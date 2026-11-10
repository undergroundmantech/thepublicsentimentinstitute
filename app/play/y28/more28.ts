// Campaign 2028, the wider race: the Senate and House races on the same ballot, ballot measures, party registration,
// regions inside each state, media outlets, the running mate's job, cabinet promises, the endorsement chase, viral
// moments, a rival that answers your moves, staff morale, hard mode, starting maps, the recount, the speech, the
// first hundred days and the 2030 midterm outlook. Everything lives on the general election state under `mo`.
import type { Data, GenS, Res, LogItem, Party, NightRes } from "./engine28";
import * as E from "./engine28";
import * as X2 from "./deep28";
import { storyOf, queue } from "./story28";

export type More = {
  senN: number[]; senWork: Record<string, number>; senHelp: Record<string, number>; measures: { st: string; k: string }[];
  reg: Record<string, [number, number, number]>; regWork: Record<string, number>; wk0?: number[];
  vpRole: "trail" | "attack" | "groups" | "money"; vpGroup: string; cabinet: { post: string; who: string; w: number }[];
  morale: Record<string, number>; hires: Record<string, number>; endorsed: string[]; hard?: boolean; meme: number;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const si = (d: Data, st: string) => d.states.findIndex((x) => x.st === st);
const sizeK = (d: Data, i: number) => 3.2 / Math.sqrt(4 + d.states[i].ev);
const sg = (p: Party) => (p === "R" ? 1 : -1);
const kidsGsup = (s: GenS, gk: string, v: number) => { for (const g of X2.kidsOf(gk)) s.gsup = { ...(s.gsup ?? {}), [g]: (s.gsup?.[g] ?? 0) + v }; };
const gstAdd = (s: GenS, st: string, gk: string, v: number) => { for (const g of X2.kidsOf(gk)) { const key = `${st}:${g}`; s.gstate = { ...(s.gstate ?? {}), [key]: (s.gstate?.[key] ?? 0) + v }; } };

// ------------------------------------------------------------- the Senate and the House
/** The 2028 Senate map: class 3 seats, with the party that held each before the 2026 midterms. */
export const SENATE28: [string, Party][] = [["AL", "R"], ["AK", "R"], ["AZ", "D"], ["AR", "R"], ["CA", "D"], ["CO", "D"], ["CT", "D"], ["FL", "R"], ["GA", "D"], ["HI", "D"], ["ID", "R"], ["IL", "D"],
  ["IN", "R"], ["IA", "R"], ["KS", "R"], ["KY", "R"], ["LA", "R"], ["MD", "D"], ["MO", "R"], ["NV", "D"], ["NH", "D"], ["NY", "D"], ["NC", "R"], ["ND", "R"], ["OH", "R"], ["OK", "R"],
  ["OR", "D"], ["PA", "D"], ["SC", "R"], ["SD", "R"], ["UT", "R"], ["VT", "D"], ["WA", "D"], ["WI", "R"]];
/** Seats not on the 2028 ballot, counted as they stood before the 2026 midterms. */
export const SEN_HOLD = { R: 34, D: 32 };
export function moreOf(d: Data, s: GenS): More {
  if (s.mo) return s.mo;
  const G = { rng: (s.bias * 1e4) | 0 || 2028 };
  const senN = SENATE28.map(() => E.gauss(G) * 2.6);
  const pool = ["AZ", "NV", "FL", "MI", "OH", "MO", "MT", "NE", "CO", "ME", "AR", "SD"].filter((st) => si(d, st) >= 0);
  const ks = Object.keys(MEASURES); const measures: { st: string; k: string }[] = [];
  while (measures.length < 5 && pool.length) { const st = pool.splice(Math.floor(E.rand(G) * pool.length), 1)[0]; measures.push({ st, k: ks[Math.floor(E.rand(G) * ks.length)] }); }
  const reg: Record<string, [number, number, number]> = {}; for (const [st, v] of Object.entries(REG0)) reg[st] = [...v];
  s.mo = { senN, senWork: {}, senHelp: {}, measures, reg, regWork: {}, vpRole: "trail", vpGroup: "ind", cabinet: [], morale: {}, hires: {}, endorsed: [], meme: 10 };
  // a measure on the ballot brings its voters out, for whichever side they lean
  for (const m of measures) for (const [gk, v] of Object.entries(MEASURES[m.k].turn)) gstAdd(s, m.st, gk, v);
  return s.mo;
}
/** Each Senate race, the player's way: the top of the ticket in that state, the incumbent party's edge and the candidates. */
export function senate(d: Data, s: GenS, ms = E.readMargins(d, s)) {
  const M = moreOf(d, s); const p = s.party;
  return SENATE28.map(([st, hold], k) => { const i = si(d, st); const inc = (hold === p ? 1 : -1) * 2.5; const m = (i >= 0 ? ms[i] : 0) * 0.9 + inc + M.senN[k] * (hold === p ? 1 : -1) * 0.5 + (M.senWork[st] ?? 0);
    return { st, hold, m, mine: hold === p }; });
}
export function senateCount(d: Data, s: GenS, ms?: number[]) {
  const rs = senate(d, s, ms); const won = rs.filter((r) => r.m > 0).length; const opP: Party = s.party === "D" ? "R" : "D";
  const mine = SEN_HOLD[s.party] + won, theirs = SEN_HOLD[opP] + rs.length - won; return { mine, theirs, races: rs };
}
/** The House, from the national vote: about five seats a point around a tie, plus coattails from your own work. */
export const houseSeats = (natMine: number) => clamp(Math.round(217.5 + natMine * 5.2), 150, 290);
/** Campaign beside the Senate candidate: half a day, and your coattails get longer there. */
export function senStump(d: Data, s: GenS, st: string): Res {
  if (s.days < 1) return { ok: false, t: "No time left this week." }; const M = moreOf(d, s); const i = si(d, st); const n = M.senHelp[st] ?? 0;
  const k = 0.9 * sizeK(d, i) / (1 + 0.5 * n); s.days -= 1; M.senWork[st] = (M.senWork[st] ?? 0) + k; M.senHelp[st] = n + 1; s.pers[i] += k * 0.12; s.visits[st] = (s.visits[st] ?? 0) + 1;
  return { ok: true, t: `You campaigned beside the Senate candidate in ${E.nameOf(d, st)}. The party noticed.`, fx: k * 0.12 };
}

// ------------------------------------------------------------- ballot measures
export const MEASURES: Record<string, { l: string; turn: Record<string, number>; side: Party }> = {
  abortion: { l: "Abortion rights amendment", turn: { young_w: 1.4, wcol_w: 1.0 }, side: "D" },
  wage: { l: "Minimum wage increase", turn: { wnc_w: 0.8, young_m: 0.7, hisp_w: 0.6 }, side: "D" },
  weed: { l: "Legal marijuana", turn: { young_m: 1.1, young_w: 0.8 }, side: "D" },
  voterid: { l: "Voter ID amendment", turn: { wnc_m: 0.9, old_m: 0.7 }, side: "R" },
  tax: { l: "Property tax cap", turn: { old_w: 0.8, old_m: 0.8, wnc_m: 0.4 }, side: "R" },
};
/** Campaign on the measure: it brings out its voters again, which helps you only where they lean your way. */
export function measureStump(d: Data, s: GenS, st: string): Res {
  const M = moreOf(d, s); const m = M.measures.find((x) => x.st === st); if (!m) return { ok: false, t: "No measure here." };
  if (s.days < 1) return { ok: false, t: "No time left this week." }; s.days -= 1; const def = MEASURES[m.k];
  for (const [gk, v] of Object.entries(def.turn)) gstAdd(s, st, gk, v * 0.5);
  return { ok: true, t: `You campaigned ${def.side === s.party ? "for" : "against"} the ${def.l.toLowerCase()} in ${E.nameOf(d, st)}.${def.side === s.party ? "" : " Its voters lean the other way, so this mostly fires up your opponent's side."}`, fx: 0 };
}

// ------------------------------------------------------------- party registration, where voters register by party
/** Approximate shares of registered voters, Democratic, Republican and other, around 2024. */
export const REG0: Record<string, [number, number, number]> = {
  AZ: [30, 35, 35], NV: [29, 29, 42], NC: [32, 30, 38], PA: [44, 41, 15], FL: [32, 41, 27], CO: [26, 24, 50], NH: [28, 31, 41], IA: [30, 36, 34], NM: [42, 32, 26], ME: [33, 28, 39],
};
function regWeek(d: Data, s: GenS, out: LogItem[]) {
  const M = moreOf(d, s); if (s.week > X2.regDeadline(s)) return; const opP: Party = s.party === "D" ? "R" : "D"; const ms = E.readMargins(d, s);
  const close = Object.keys(M.reg).sort((a, b) => Math.abs(ms[si(d, a)] ?? 9) - Math.abs(ms[si(d, b)] ?? 9)).slice(0, 3);
  for (const st of Object.keys(M.reg)) {
    const r = M.reg[st]; const mine = s.party === "D" ? 0 : 1, theirs = 1 - mine;
    const w = M.regWork[st] ?? 0; const add = 0.04 + 0.12 * Math.log(1 + w / 2e6); const opAdd = 0.04 + (close.includes(st) ? 0.09 * E.DIFF[s.diff].opp : 0) + 0.03; // a steady drift toward Republican registration
    r[mine] += add * (s.party === "R" ? 1.4 : 1); r[theirs] += opAdd * (opP === "R" ? 1.4 : 1) * 0.7; r[2] = 100 - r[0] - r[1];
    M.regWork[st] = w * 0.5;
  }
}

// ------------------------------------------------------------- regions inside a state
export type Region = { n: string; sh: number; m: number; a: string };
export const regionsOf = (d: Data, st: string) => ((d as Data & { regions?: Record<string, { m: number; r: Region[] }> }).regions ?? {})[st.split("-")[0]] ?? null;
/** The player's margin in a region now: the state's read plus how far the region ran from the state in 2024. */
export const regionMargin = (s: GenS, stateRead: number, R: { m: number }, r: Region) => stateRead + sg(s.party) * (r.m - R.m);
/** Work one region for a day: persuasion where it is close, turnout where it is yours, little where it is theirs. */
export function workRegion(d: Data, s: GenS, st: string, k: number): Res {
  const R = regionsOf(d, st); const r = R?.r[k]; if (!R || !r) return { ok: false, t: "No region data." };
  if (s.days < 2) return { ok: false, t: "A day in one region takes a full day." }; if (s.cash < 150e3) return { ok: false, t: "Not enough cash." };
  const i = si(d, st); const lean = regionMargin(s, E.readMargins(d, s)[i], R, r); const key = `rg:${st}:${k}`; const n = s.gused?.[key] ?? 0;
  const fade = 1 / (1 + 0.45 * n); const scale = Math.min(1, Math.sqrt(r.sh) * 1.6) * sizeK(d, i) * fade * (0.7 + s.stamina / 330);
  let fx = 0, how = "";
  if (lean > 12) { fx = 0.32 * scale; s.gotv[i] += fx; how = "a turnout push in your base"; }
  else if (lean < -12) { fx = 0.08 * scale; s.pers[i] += fx; how = "a long shot in their territory, and the local press loved it"; }
  else { fx = 0.36 * scale * (r.a === "Suburban" ? 1.2 : 1); s.pers[i] += fx; how = "persuasion where the voters are up for grabs"; }
  s.days -= 2; s.cash -= 150e3; s.stamina = clamp(s.stamina - 8, 0, 100); s.gused = { ...(s.gused ?? {}), [key]: n + 1 }; s.visits[st] = (s.visits[st] ?? 0) + 1;
  return { ok: true, t: `A day in ${r.n}, ${E.nameOf(d, st)}: ${how}.`, fx };
}

// ------------------------------------------------------------- the media, outlet by outlet
export const OUTLETS: { k: string; l: string; blurb: string; g?: Record<string, number>; nat?: number; enth?: number; risk?: number; local?: boolean }[] = [
  { k: "cable", l: "Cable news", blurb: "Your partisans watch. Fires up the base, moves few minds.", enth: 1.6, nat: 0.01 },
  { k: "network", l: "Network morning show", blurb: "Older women and suburban parents.", g: { wcol_w: 0.3, old_w: 0.3 }, nat: 0.03 },
  { k: "podcast", l: "A podcast for young men", blurb: "Huge reach with young men. Loose talk can turn into a clip.", g: { young_m: 0.5, wnc_m: 0.15 }, risk: 0.2 },
  { k: "spanish", l: "Spanish language TV", blurb: "Univision and Telemundo audiences.", g: { hisp_w: 0.4, hisp_m: 0.4 } },
  { k: "black", l: "Black radio", blurb: "Morning shows in Atlanta, Detroit, Philadelphia and Charlotte.", g: { black_w: 0.4, black_m: 0.45 } },
  { k: "sunday", l: "A Sunday show", blurb: "The press corps watches. Good answers travel, bad ones too.", nat: 0.07, risk: 0.18 },
  { k: "local", l: "Local TV in the state you hold", blurb: "Five anchors in one day. Moves that state.", local: true },
];
export function outlet(d: Data, s: GenS, k: string, st: string | null, G: { rng: number }): Res {
  const o = OUTLETS.find((x) => x.k === k)!; if (s.days < 1) return { ok: false, t: "No time left this week." };
  const key = `out:${k}`; const n = s.gused?.[key] ?? 0; const f = 1 / (1 + 0.3 * n); let fx = 0; let t = `${o.l}: `;
  s.days -= 1; s.stamina = clamp(s.stamina - 5, 0, 100); s.gused = { ...(s.gused ?? {}), [key]: n + 1 };
  if (o.risk && E.rand(G) < o.risk * (s.stamina < 30 ? 1.6 : 1)) { s.nat -= 0.12; moreOf(d, s).meme += 8; return { ok: true, t: `${t}a bad answer became the clip of the day.`, fx: -0.12 }; }
  for (const [gk, v] of Object.entries(o.g ?? {})) { kidsGsup(s, gk, v * f); fx += v * f * 0.1; }
  if (o.nat) { s.nat += o.nat * f; fx += o.nat * f; }
  if (o.enth) s.enth[0] = clamp(s.enth[0] + o.enth * f, 0, 100);
  if (o.local && st) { const i = si(d, st); const v = 0.22 * sizeK(d, i) * f; s.pers[i] += v; fx += v; t += `${E.nameOf(d, st)} saw you on every station`; } else t += "a solid hit";
  return { ok: true, t: `${t}.`, fx };
}

// ------------------------------------------------------------- the running mate's job
export const VP_ROLES: Record<More["vpRole"], { l: string; blurb: string }> = {
  trail: { l: "Work one state", blurb: "All week in the state you send them to." },
  attack: { l: "Attack dog", blurb: "Hits your opponent every day. Helps a little, and sometimes goes too far." },
  groups: { l: "Group outreach", blurb: "A week of events with one group, nationwide." },
  money: { l: "Fundraising", blurb: "Donor events all week." },
};
function vpWeek(d: Data, s: GenS, G: { rng: number }, out: LogItem[]) {
  const M = moreOf(d, s); if (!s.vp || M.vpRole === "trail") return;
  if (M.vpRole === "attack") { if (E.rand(G) < 0.15) { s.nat -= 0.12; out.push({ t: s.week, kind: "bad", s: `${s.vp} went too far on the attack and had to walk it back.`, fx: -0.12 }); } else { s.nat += 0.05; s.enth[1] = clamp(s.enth[1] - 0.6, 0, 100); out.push({ t: s.week, kind: "you", s: `${s.vp} spent the week on the attack.`, fx: 0.05 }); } }
  if (M.vpRole === "groups") { kidsGsup(s, M.vpGroup, 0.3); out.push({ t: s.week, kind: "you", s: `${s.vp} spent the week with ${X2.groupsOf(d).find((g) => g.k === M.vpGroup)?.l.toLowerCase() ?? "one group"}.` }); }
  if (M.vpRole === "money") { const a = Math.round(6e6 * E.DIFF[s.diff].fund); s.cash += a; s.raised = (s.raised ?? 0) + a; out.push({ t: s.week, kind: "money", s: `${s.vp} raised ${E.usd(a)} at donor events.` }); }
}

// ------------------------------------------------------------- cabinet promises
export const POSTS = ["Secretary of State", "Treasury Secretary", "Defense Secretary", "Attorney General", "Labor Secretary", "Health Secretary", "Homeland Security Secretary", "Agriculture Secretary", "Energy Secretary", "Commerce Secretary"];
/** Promise a cabinet post to someone in your party: their voters come along now, and the bill comes due in January. */
export function promisePost(d: Data, s: GenS, post: string, who: string): Res {
  const M = moreOf(d, s); if (M.cabinet.some((c) => c.who === who)) return { ok: false, t: `${who} already has your promise.` };
  const c = E.candOf(d, s.party, who); if (!c) return { ok: false, t: "Unknown." };
  const dup = M.cabinet.some((x) => x.post === post); M.cabinet.push({ post, who, w: s.week });
  let fx = 0.04; s.nat += 0.04; s.enth[0] = clamp(s.enth[0] + 1, 0, 100);
  for (const [st, v] of Object.entries(c.home ?? {})) { const i = si(d, st); if (i >= 0 && v) { const k = 0.3 * sizeK(d, i); s.pers[i] += k; fx += k * 0.2; } }
  return { ok: true, t: `You quietly promised ${who} the job of ${post.toLowerCase()}. Their supporters come aboard.${dup ? " You already promised that job to someone else." : ""}`, fx };
}

// ------------------------------------------------------------- the endorsement chase
type EndDef = { k: string; pl?: boolean; who: string; need: string; ok: (d: Data, s: GenS) => boolean; fx: { nat?: number; g?: Record<string, number>; vol?: number; cash?: number } };
const gs = (s: GenS, ...ks: string[]) => ks.reduce((a, k) => a + (s.gsup?.[k] ?? 0), 0);
export const ENDORSE: EndDef[] = [
  { k: "papers", pl: true, who: "Swing state editorial boards", need: "Win a debate and lead the national polls", ok: (d, s) => s.debates.some((x) => x.done && (x.score ?? 0) > 0 && x.kind === "pres") && (s.natPolls[s.natPolls.length - 1]?.m ?? -1) > 0, fx: { nat: 0.15, g: { wcol_w: 0.2, wcol_m: 0.2 } } },
  { k: "teachers", pl: true, who: "The national teachers unions", need: "Gain 1 point with white college women", ok: (d, s) => gs(s, "wcol_w") >= 1, fx: { vol: 8000, g: { wcol_w: 0.3 } } },
  { k: "police", who: "A national police union", need: "Take a tough stand on crime", ok: (d, s) => (s.story?.said?.[7]?.pos ?? -9) >= 0.4, fx: { g: { wnc_m: 0.3, old_m: 0.2 } } },
  { k: "gov", who: "A popular swing state governor", need: "Visit one battleground three times and lead there", ok: (d, s) => { const ms = E.readMargins(d, s); return Object.entries(s.visits).some(([st, v]) => v >= 3 && ms[si(d, st)] > 0 && Math.abs(ms[si(d, st)]) < 6); }, fx: { nat: 0.08, vol: 4000 } },
  { k: "celeb", who: "A pop star with 300 million followers", need: "Gain 1.5 points with young voters", ok: (d, s) => gs(s, "young_w", "young_m") >= 1.5, fx: { g: { young_w: 0.5, young_m: 0.2 }, vol: 6000 } },
  { k: "nfl", pl: true, who: "Retired NFL stars", need: "Gain 1 point with white working class men", ok: (d, s) => gs(s, "wnc_m") >= 1, fx: { g: { wnc_m: 0.4, black_m: 0.2 } } },
  { k: "ceos", pl: true, who: "Fortune 500 chief executives", need: "Take big donor money and outraise your opponent", ok: (d, s) => !!s.story?.flags?.bigDonor && (s.raised ?? 0) > (s.opRaised ?? 0) * 0.8, fx: { cash: 10e6, g: { wnc: -0.1 } } },
  { k: "generals", pl: true, who: "Forty retired generals and admirals", need: "Go on the record on the Iran war and do the veterans forum", ok: (d, s) => s.story?.said?.[11] != null && s.story?.flags?.["inv:7"] != null, fx: { nat: 0.1, g: { old_m: 0.3 } } },
];
function endorseWeek(d: Data, s: GenS) {
  const M = moreOf(d, s);
  for (const e of ENDORSE) if (!M.endorsed.includes(e.k) && e.ok(d, s)) { M.endorsed.push(e.k); queue(storyOf(s), s.week + 1, "endorse", { k: e.k }); break; }
}
export function applyEndorse(d: Data, s: GenS, k: string) {
  const e = ENDORSE.find((x) => x.k === k); if (!e) return; if (e.fx.nat) s.nat += e.fx.nat; if (e.fx.vol) s.vol = (s.vol ?? 0) + e.fx.vol;
  if (e.fx.cash) { s.cash += e.fx.cash; s.raised = (s.raised ?? 0) + e.fx.cash; } for (const [g, v] of Object.entries(e.fx.g ?? {})) kidsGsup(s, g, v);
}

// ------------------------------------------------------------- the week: rival answers, viral moments, the party, the money
export function moreWeek(d: Data, s: GenS, G: { rng: number }, out: LogItem[]) {
  const M = moreOf(d, s); const F = storyOf(s).flags; const g = X2.toGo(s);
  // the rival answers your biggest pushes of the week
  if (M.wk0) {
    const now = d.states.map((_, i) => s.ads[i] + s.pers[i] + s.gotv[i]); const push = now.map((v, i) => ({ i, v: (v - (M.wk0![i] ?? 0)) * Math.sqrt(d.states[i].ev) })).filter((x) => x.v > 0.4).sort((a, b) => b.v - a.v).slice(0, 2);
    const k = E.DIFF[s.diff].opp * (M.hard ? 1.35 : 1);
    for (const x of push) s.opAds[x.i] += Math.min(1.2, (now[x.i] - M.wk0[x.i]) * 0.45 * k);
    if (push.length) out.push({ t: s.week, kind: "rival", s: `${s.op} answered your push in ${push.map((x) => d.states[x.i].n).join(" and ")} with ads of their own.` });
  }
  // hard mode: a richer, meaner rival
  if (M.hard) { s.opCash += 8e6; s.nat -= 0.03; }
  vpWeek(d, s, G, out); regWeek(d, s, out); endorseWeek(d, s);
  // viral moments: the more you court the internet, the more it finds you
  if (!storyOf(s).queue.some((q) => q.w === s.week + 1) && E.rand(G) < 0.18 + M.meme / 400) {
    const bad = E.rand(G) < M.meme / 100; const left = (bad ? ["viral_bad", "viral_good", "viral_op"] : ["viral_good", "viral_op", "viral_bad"]).filter((v) => !F[v]);
    const pick = bad ? left[0] : left[Math.floor(E.rand(G) * left.length)]; if (pick) { F[pick] = 1; queue(storyOf(s), s.week + 1, pick); }
  }
  M.meme = clamp(M.meme * 0.9 + (F.creators ? 1.5 : 0), 3, 60);
  // the party leaders want you in the close Senate races
  if (g <= 6 && !F.senLeader) {
    const rs = senate(d, s).filter((r) => Math.abs(r.m) < 3 && !(M.senHelp[r.st] ?? 0));
    if (rs.length >= 2) { F.senLeader = 1; queue(storyOf(s), s.week + 1, "sen_leader", { a: rs[0].st, b: rs[1].st }); }
  }
  // staff morale: a meeting left hanging costs that department
  if (s.meeting && !s.meeting.done) M.morale[s.meeting.dept] = (M.morale[s.meeting.dept] ?? 65) - 8;
  for (const [dept, v] of Object.entries(M.morale)) if (v < 30) {
    M.morale[dept] = 62; M.hires[dept] = (M.hires[dept] ?? 0) + 1; queue(storyOf(s), s.week + 1, "staff_quit", { dept });
    out.push({ t: s.week, kind: "bad", s: `A senior staffer has resigned. Morale in that department had collapsed.` }); break;
  }
}
/** Remember where things stood when the week began, so the rival can see what you did with it. */
export function weekStart(d: Data, s: GenS) { moreOf(d, s).wk0 = d.states.map((_, i) => s.ads[i] + s.pers[i] + s.gotv[i]); }
/** Morale moves with how the candidate treats each department's advice. */
export function moraleAfter(d: Data, s: GenS, dept: string, k: number, act: string) {
  const M = moreOf(d, s); M.morale[dept] = clamp((M.morale[dept] ?? 65) + (act === "none" ? -6 : k === 0 ? 5 : 2), 0, 100);
}
/** Running on empty: a tired candidate makes mistakes. */
export function tired(s: GenS, G: { rng: number }): string | null {
  if (s.stamina >= 22 || E.rand(G) > 0.2) return null;
  const t = ["mixed up the name of the city you were standing in", "snapped at a reporter on camera", "lost your place in the stump speech for twenty seconds", "called a voter by the wrong name, twice"][Math.floor(E.rand(G) * 4)];
  s.nat -= 0.12; return `Exhausted, you ${t}. It is all over cable.`;
}

// ------------------------------------------------------------- starting maps and what ifs
export const SCENARIOS: { k: string; l: string; blurb: string }[] = [
  { k: "model", l: "The 2028 model", blurb: "Every state where the On Point model has this matchup today." },
  { k: "m24", l: "The 2024 map", blurb: "Every state starts where Trump and Harris finished in 2024." },
  { k: "m20", l: "The 2020 map", blurb: "Every state starts where Biden and Trump finished in 2020, from county returns." },
  { k: "recession", l: "What if: a recession", blurb: "Unemployment is climbing. The White House party starts three points worse everywhere." },
  { k: "tied", l: "What if: dead even", blurb: "The national vote starts tied, with every state's lean intact." },
  { k: "landslide", l: "What if: a landslide for you", blurb: "You start five points up. Can you avoid blowing it?" },
];
/** Offsets, R minus D, that move the matchup's map to the scenario's. */
export function scenarioShift(d: Data, s: GenS, k: string): number[] {
  const D = s.party === "D" ? s.me : s.op, R = s.party === "R" ? s.me : s.op; const base = E.pairMargins(d, D, R);
  const h20 = (d as Data & { hist20?: Record<string, number> }).hist20 ?? {};
  if (k === "m24") return d.states.map((x, i) => (x.p24 == null ? 0 : x.p24 - base[i]));
  if (k === "m20") return d.states.map((x, i) => { const v = h20[x.st]; return v == null ? 0 : v - base[i]; });
  if (k === "recession") return d.states.map(() => -3); // the White House is Republican, so R minus D falls
  if (k === "tied") { const nm = E.natMargin(d, base); return d.states.map(() => -nm); }
  if (k === "landslide") { const nm = E.natMargin(d, base) * sg(s.party); return d.states.map(() => sg(s.party) * (5 - nm)); }
  return d.states.map(() => 0);
}

// ------------------------------------------------------------- the recount
export type Recount = { st: string; m: number; ev: number; pick?: string; after?: number };
export const RECOUNT_T = 0.5;
export const recountsFor = (res: NightRes): Recount[] => res.calls.filter((c) => Math.abs(c.m) < RECOUNT_T && !c.st.includes("-")).map((c) => ({ st: c.st, m: c.m, ev: c.ev }));
export const RC_OPTS: Record<string, { l: string; blurb: string; legacy: number }> = {
  cure: { l: "Count every vote", blurb: "Cure flagged ballots and push for a full hand count. Slow and clean.", legacy: 2 },
  challenge: { l: "Challenge their ballots", blurb: "Contest provisional and late ballots from their strongholds. Ugly.", legacy: -4 },
  court: { l: "Go to court", blurb: "Sue over the rules. Could swing a few thousand votes either way.", legacy: -1 },
  accept: { l: "Accept the count", blurb: "Let the certified result stand.", legacy: 4 },
};
/** Recounts move a few hundred votes, a court fight maybe a few thousand: only the closest states ever flip. */
export function runRecount(d: Data, s: GenS, rc: Recount, pick: string, G: { rng: number }) {
  const v = d.states[si(d, rc.st)]?.votes ?? 3e6; const law = s.lawyers ? 1.4 : 1; let shift = 0;
  if (pick === "cure") shift = (300 + E.rand(G) * 1500) * law;
  if (pick === "challenge") shift = (E.rand(G) < 0.55 ? 1 : -0.4) * (500 + E.rand(G) * 2500) * law;
  if (pick === "court") shift = (E.rand(G) < 0.5 ? 1 : -0.6) * (1000 + E.rand(G) * 5000) * law;
  const opShift = 200 + E.rand(G) * 900; // their lawyers fight too
  const after = rc.m + ((pick === "accept" ? 0 : shift - opShift) / v) * 100;
  return { ...rc, pick, after };
}
/** Apply finished recounts to the night's result. */
export function applyRecounts(d: Data, res: NightRes, rcs: Recount[]): NightRes {
  const calls = res.calls.map((c) => { const r = rcs.find((x) => x.st === c.st && x.after != null); return r ? { ...c, m: r.after!, win: r.after! > 0, close: Math.abs(r.after!) } : c; });
  const ev = calls.filter((c) => c.win).reduce((a, c) => a + c.ev, 0); return { ...res, calls, ev, opEv: 538 - ev, win: ev >= 270 };
}

// ------------------------------------------------------------- the first hundred days and the 2030 midterms
export type Hundred = { approval: number; confirmed: string[]; failed: string[]; passed: string[]; stalled: string[]; house: number; senate: number; midHouse: number; midSenate: number };
export function govern(d: Data, s: GenS, res: NightRes, picks: number[], seed: number, legacy: number): Hundred {
  const G = { rng: seed }; const sen = senateCount(d, s, res.calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m)); const house = houseSeats(res.pop);
  const senCtl = sen.mine >= 50, houseCtl = house >= 218; const M = moreOf(d, s);
  let approval = 50 + clamp(res.pop, -6, 8) * 0.5 + legacy * 0.4;
  const confirmed: string[] = [], failed: string[] = []; const posts = new Set<string>();
  for (const c of M.cabinet) { if (posts.has(c.post)) { failed.push(`${c.who}: you gave ${c.post.toLowerCase()} to someone else`); approval -= 1.5; continue; } posts.add(c.post);
    if (E.rand(G) < (senCtl ? 0.93 : 0.55)) confirmed.push(`${c.who}, ${c.post}`); else { failed.push(`${c.who}: the Senate rejected the nomination`); approval -= 1; } }
  const passed: string[] = [], stalled: string[] = [];
  for (const k of picks) { const is = d.issues[k]; const said = s.story?.said?.[k]; const pos = said?.pos ?? (s.party === "D" ? is.d : is.r); const popular = Math.abs(pos - is.i) < 0.9;
    const p = (senCtl ? 0.55 : 0.12) * (houseCtl ? 1 : 0.35) + (popular ? 0.15 : 0); if (E.rand(G) < p) { passed.push(is.l); approval += popular ? 2.5 : -0.5; } else { stalled.push(is.l); approval -= 1.2; } }
  approval = clamp(approval + E.gauss(G) * 1.5, 30, 70);
  const midHouse = Math.round(-22 + (approval - 50) * 1.6); const midSenate = Math.round(-2 + (approval - 50) * 0.18);
  return { approval, confirmed, failed, passed, stalled, house, senate: sen.mine, midHouse, midSenate };
}

// ------------------------------------------------------------- the campaign diary
export function diary(d: Data, s: GenS, res: NightRes, legacy?: number): string {
  const t = s.trend; const st0 = t[0]; let big = { w: 0, dp: 0 };
  for (let k = 1; k < t.length; k++) { const dp = t[k].p - t[k - 1].p; if (Math.abs(dp) > Math.abs(big.dp)) big = { w: t[k].w, dp }; }
  const facts = s.story?.facts ?? []; const crises = Object.entries(s.story?.flags ?? {}).filter(([k]) => k.startsWith("crisis:")).map(([k, v]) => `${k.slice(7)}, answered with "${String(v).toLowerCase()}"`);
  const deb = s.debates.filter((x) => x.done).map((x) => ((x.score ?? 0) >= 0 ? "won" : "lost"));
  const sen = senateCount(d, s, res.calls.slice().sort((a, b) => a.i - b.i).map((c) => c.m));
  const L = [
    `${s.me} against ${s.op}, ${s.weeks} weeks to Election Day. The campaign began with a ${Math.round((st0?.p ?? 0.5) * 100)} percent chance and ${st0?.ev ?? 0} electoral votes on paper.`,
    big.w ? `The turning point came in week ${big.w}, when the race moved ${Math.abs(Math.round(big.dp * 100))} points ${big.dp > 0 ? "your way" : "against you"}.` : "",
    deb.length ? `On the debate stage you ${deb.join(", then ")}.` : "",
    crises.length ? `Scandals: ${crises.join("; ")}.` : "",
    facts.length ? `Decisions that shaped it: ${facts.slice(-6).map((f) => f.replace(/\.$/, "")).join("; ")}.` : "",
    `${res.win ? "You won" : "You lost"}, ${res.ev} to ${res.opEv} in the electoral college, ${res.pop >= 0 ? "winning" : "losing"} the popular vote by ${Math.abs(res.pop).toFixed(1)} points. Your party holds ${sen.mine} Senate seats and about ${houseSeats(res.pop)} House seats.`,
    legacy != null ? `History's verdict on how you handled the night: ${legacy >= 8 ? "graceful" : legacy >= 0 ? "steady" : "bitter"}.` : "",
  ];
  return L.filter(Boolean).join(" ");
}
export const dailySeed = (dt = new Date()) => Number(`${dt.getUTCFullYear()}${String(dt.getUTCMonth() + 1).padStart(2, "0")}${String(dt.getUTCDate()).padStart(2, "0")}`);
