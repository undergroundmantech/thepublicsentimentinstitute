// Campaign 2028: the county ground game. Every state's counties come from the On Point 2028 forecast, each with its
// projected votes and its 2028 baseline margin, so a state's margin is the sum of its counties, as in the forecast.
// What a campaign does in one county is real work in one place: a rally persuades where there are persuadable voters
// and fires up turnout where the county is already yours, its local coverage spills into the counties around it, a
// field office keeps paying in turnout every week, volunteers knock doors, and geotargeted ads buy reach by the voter.
// Persuasion fades week to week unless it is renewed; turnout work mostly holds. The other campaign works counties
// too. Getting around costs time: a stop in another part of the country takes an extra half day of travel.
import type { Data, GenS, Res } from "./engine28";
import { REGION, coAt, readMargins, usd } from "./engine28";

/** A county: fips, name, projected 2028 votes, baseline margin R minus D, and its center on the national map. */
export type CRow = [string, string, number, number, number, number, number?, number?, (number | null)?];
export type CIdx = Record<string, CRow[]>;
export type CShape = { st: string; box: [number, number, number, number] | null; outline: string | null; p: Record<string, string> };
/** The campaign's county work. loc and turn are points in the player's favor, local to one county. */
export type CW = {
  pers: Record<string, number>; turn: Record<string, number>; vis: Record<string, number>; canv: Record<string, number>;
  off: string[]; opOff: string[]; opVis: Record<string, number>;
  stops: { w: number; f: string; st: string; who: "me" | "op"; k: string }[];
  lastSt?: string; lastW?: number;
};
export type CKind = "rally" | "hall" | "office" | "canvass" | "digital";
export const CACT: Record<CKind, { l: string; cost: number; days: number; blurb: string }> = {
  rally: { l: "Rally", cost: 350e3, days: 2, blurb: "Persuades where voters are up for grabs, turns out your base where you lead, and local TV carries it next door." },
  hall: { l: "Town hall", cost: 80e3, days: 1, blurb: "Undecided voters in one room. Only works where the county is close." },
  office: { l: "Field office", cost: 450e3, days: 0, blurb: "Organizers and a voter file. Turnout now, and more every week until November." },
  canvass: { l: "Door knocking", cost: 60e3, days: 1, blurb: "Your volunteers knock doors. Best in counties full of your own voters." },
  digital: { l: "Local digital ads", cost: 500e3, days: 0, blurb: "Geotargeted video and streaming in this county only. Pays by the voter." },
};

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
const sg = (s: GenS) => (s.party === "R" ? 1 : -1);
const si = (d: Data, st: string) => d.states.findIndex((x) => x.st === st);
/** A county's own pull on its state is bigger the smaller it is: a rally reaches about the same crowd anywhere. */
const amp = (v: number) => Math.min(1.4, Math.sqrt(150e3 / Math.max(5e3, v)));
/** Persuadable voters: most in counties near even, few in the deep red or blue ones. */
export const swingK = (m: number) => 0.18 + 0.82 * Math.exp(-((m / 24) ** 2));
/** How much a county is the player's: 0 where it is even or theirs, 1 where it is solidly yours. */
const baseK = (m: number) => clamp(m / 35, 0, 1);

export const cwOf = (s: GenS): CW => (s.cw ??= { pers: {}, turn: {}, vis: {}, canv: {}, off: [], opOff: [], opVis: {}, stops: [] });
export const rowsOf = (d: Data, st: string): CRow[] => d.cty?.[st.split("-")[0]] ?? [];
const votesOf = (rows: CRow[]) => rows.reduce((a, r) => a + r[2], 0);
/** The forecast's own state margin from its counties, R minus D, which the counties move around. */
export const baseOf = (rows: CRow[]) => { const V = votesOf(rows); return V ? rows.reduce((a, r) => a + r[2] * r[3], 0) / V : 0; };
const locOf = (cw: CW, f: string) => (cw.pers[f] ?? 0) + (cw.turn[f] ?? 0);

/** The county work's effect on each state's margin, in the player's favor, for marginsRD. Maine's and Nebraska's
 * districts move with their state. */
export function sync(d: Data, s: GenS) {
  const cw = cwOf(s); const fx: Record<string, number> = {};
  for (const st of Object.keys(d.cty ?? {})) {
    const rows = rowsOf(d, st); let a = 0; for (const r of rows) { const l = locOf(cw, r[0]); if (l) a += r[2] * l; }
    if (a) fx[st] = a / Math.max(1, votesOf(rows));
  }
  s.cfx = d.states.map((x) => fx[x.st.split("-")[0]] ?? 0);
}

/** Every county of a state as the campaign reads it now: margin in the player's favor, its share of the state's vote,
 * the persuadable share and the work done there. The counties average to the state's read. */
export function counties(d: Data, s: GenS, st: string, ms = readMargins(d, s)) {
  const rows = rowsOf(d, st); const i = si(d, st.split("-")[0]); if (!rows.length || i < 0) return [];
  const V = votesOf(rows), b = baseOf(rows), cw = cwOf(s), cf = s.cfx?.[i] ?? 0;
  // the nominees' coalitions move each county against its state: a Haley gains in the suburbs and gives back the
  // Trump gains in the small towns, and the counties still average to the state
  const Dn = s.party === "D" ? s.me : s.op, Rn = s.party === "R" ? s.me : s.op;
  const Dc = d.cands.D.find((c) => c.n === Dn), Rc = d.cands.R.find((c) => c.n === Rn);
  const co = rows.map((r) => coAt(Dc, Rc, r[6] ?? 0, r[7] ?? 0)); const coS = rows.reduce((a, r, k) => a + r[2] * co[k], 0) / Math.max(1, V);
  return rows.map((r, k) => {
    const loc = locOf(cw, r[0]); const m = sg(s) * (r[3] + co[k] - coS - b) + ms[i] - cf + loc;
    return { f: r[0], n: r[1], v: r[2], sh: r[2] / V, m, x: r[4], y: r[5], loc, swing: swingK(m), vis: cw.vis[r[0]] ?? 0, op: cw.opVis[r[0]] ?? 0, off: cw.off.includes(r[0]), opOff: cw.opOff.includes(r[0]) };
  });
}
/** County margins on election night from the state's final margin, so the counties add up to the call. */
export function nightCounties(d: Data, s: GenS, st: string, finalMine: number) {
  const now = counties(d, s, st); const rows = rowsOf(d, st); const V = votesOf(rows);
  const avg = now.reduce((a, c) => a + c.m * c.v, 0) / Math.max(1, V);
  return now.map((c) => ({ ...c, m: c.m - avg + finalMine }));
}

/** Getting there: the first stop of the week is free, a stop in another part of the country costs a half day. */
export function travelOf(s: GenS, st: string) {
  const cw = cwOf(s); if (cw.lastW !== s.week || !cw.lastSt) return 0;
  const a = REGION[cw.lastSt.split("-")[0]], b = REGION[st.split("-")[0]];
  return a === b ? 0 : 1;
}

/** One action in one county. */
export function act(d: Data, s: GenS, st0: string, f: string, k: CKind, amt?: number): Res {
  const st = st0.split("-")[0]; const A = CACT[k]; const cw = cwOf(s);
  const all = counties(d, s, st); const c = all.find((x) => x.f === f); if (!c) return { ok: false, t: "No county data here yet." };
  const cost = k === "digital" ? (amt ?? A.cost) : A.cost; const travel = A.days ? travelOf(s, st) : 0; const days = A.days + travel;
  if (s.days < days) return { ok: false, t: travel ? `Not enough time left this week: getting to ${c.n} takes a half day of travel on top.` : "No time left this week." };
  if (s.cash < cost) return { ok: false, t: `Not enough cash: ${A.l.toLowerCase()} costs ${usd(cost)}.` };
  // one county that is most of a state cannot move all of it
  const stam = 0.7 + s.stamina / 330; const dom = Math.min(1, Math.sqrt(0.22 / Math.max(0.01, c.sh))); const stV = s.visits[st] ?? 0; const stFade = 1 / (1 + 0.22 * stV);
  let pers = 0, turn = 0, spill = 0, note = "";
  if (k === "rally" || k === "hall") {
    const n = cw.vis[f] ?? 0; const fade = 1 / (1 + 0.55 * n) * stFade * stam;
    if (k === "rally") {
      pers = 5.2 * c.swing * amp(c.v) * fade; turn = 3.2 * baseK(c.m) * amp(c.v) * fade; spill = 0.35;
      s.enth[0] = clamp(s.enth[0] + 0.5 + 0.6 * baseK(c.m), 0, 100); s.stamina = clamp(s.stamina - 12, 0, 100);
      note = c.m > 14 ? "Your base packed the arena." : c.m < -14 ? "A rally deep in their territory: a few converts and a lot of local press." : "The crowd was full of people still making up their minds.";
    } else {
      pers = 3.4 * Math.max(0, c.swing - 0.3) * amp(c.v) * fade; s.stamina = clamp(s.stamina - 6, 0, 100);
      note = c.swing > 0.7 ? "The undecided voters in the room moved." : "Most of the room had already decided.";
    }
    cw.vis[f] = n + 1; s.visits[st] = stV + 1; cw.lastSt = st; cw.lastW = s.week; cw.stops.push({ w: s.week, f, st, who: "me", k });
  } else if (k === "office") {
    if (cw.off.includes(f)) return { ok: false, t: `You already have an office in ${c.n}.` };
    const own = clamp(0.5 + c.m / 200, 0.2, 0.85); turn = 4.6 * own * amp(c.v); cw.off.push(f);
    note = "It pays a little more every week until November.";
  } else if (k === "canvass") {
    const vol = s.vol ?? 0; if (vol < 3000) return { ok: false, t: "You need at least 3,000 volunteers to run a door knocking weekend." };
    const n = cw.canv[f] ?? 0; const own = clamp(0.5 + c.m / 200, 0.15, 0.9);
    turn = 2.6 * (2 * own - 0.6) * amp(c.v) * Math.min(1.3, vol / 30000) / (1 + 0.6 * n) * (cw.off.includes(f) ? 1.35 : 1);
    cw.canv[f] = n + 1; s.contacts = (s.contacts ?? 0) + Math.round(vol * 4);
    note = turn < 0 ? "Most of the doors you knocked belong to the other side's voters. That one helped them." : cw.off.includes(f) ? "Your field office there ran the turf." : "";
  } else {
    const per = cost / Math.max(1, c.v); pers = 2.4 * c.swing * Math.log(1 + per / 1.2) * Math.min(1.25, amp(c.v) + 0.3);
    note = `${usd(cost)} is about $${per.toFixed(2)} a voter there.`;
  }
  pers *= dom; turn *= dom;
  s.cash -= cost; s.days -= days;
  cw.pers[f] = (cw.pers[f] ?? 0) + pers; cw.turn[f] = (cw.turn[f] ?? 0) + turn;
  // local television carries a rally into the counties around it, fading with distance
  if (spill && pers + turn > 0) for (const o of all) { if (o.f === f) continue; const dist = Math.hypot(o.x - c.x, o.y - c.y); if (dist < 22) cw.pers[o.f] = (cw.pers[o.f] ?? 0) + (pers * 0.8 + turn * 0.2) * spill * (1 - dist / 22); }
  sync(d, s);
  const after = counties(d, s, st); const V = after.reduce((a, x) => a + x.v, 0);
  const stateFx = after.reduce((a, x) => a + x.v * x.m, 0) / V - all.reduce((a, x) => a + x.v * x.m, 0) / V;
  return { ok: true, t: `${A.l} in ${c.n}, ${d.states[si(d, st)]?.n}${travel ? " after a flight across the country" : ""}: about ${stateFx >= 0 ? "+" : ""}${stateFx.toFixed(2)} statewide. ${note}`.trim(), fx: stateFx };
}

/** The week in the counties: persuasion fades, offices pay, and the other campaign works the counties it wants. */
export function ctyWeek(d: Data, s: GenS, G: { rng: number }, rand: (g: { rng: number }) => number, opp: number): string[] {
  if (!d.cty) return [];
  const cw = cwOf(s); const out: string[] = [];
  for (const f of Object.keys(cw.pers)) { cw.pers[f] *= 0.9; if (Math.abs(cw.pers[f]) < 0.01) delete cw.pers[f]; }
  for (const f of Object.keys(cw.turn)) cw.turn[f] *= 0.97;
  // an office pays in turnout every week; in a county that is most of its state it reaches a smaller share of it
  const dom = new Map<string, number>(); for (const f of [...cw.off, ...cw.opOff]) { if (dom.has(f)) continue; for (const st of Object.keys(d.cty)) { const rows = d.cty[st]; const r = rows.find((x) => x[0] === f); if (r) { dom.set(f, amp(r[2]) * Math.min(1, Math.sqrt(0.22 / Math.max(0.01, r[2] / votesOf(rows))))); break; } } }
  for (const f of cw.off) cw.turn[f] = (cw.turn[f] ?? 0) + 0.45 * (dom.get(f) ?? 0);
  for (const f of cw.opOff) cw.turn[f] = (cw.turn[f] ?? 0) - 0.4 * (dom.get(f) ?? 0) * opp;
  // the other campaign: two county stops in each of the states it is working, aimed at big counties near even
  const ms = readMargins(d, s);
  for (const st0 of s.opVisits.slice(0, 3)) {
    const st = st0.split("-")[0]; const cs = counties(d, s, st, ms); if (!cs.length) continue;
    const pick = cs.map((c) => ({ c, w: Math.sqrt(c.v) * swingK(-c.m) / (1 + (cw.opVis[c.f] ?? 0)) * (0.8 + rand(G) * 0.4) })).sort((a, b) => b.w - a.w).slice(0, 2);
    for (const { c } of pick) {
      const n = cw.opVis[c.f] ?? 0; const k = 3.4 * swingK(-c.m) * amp(c.v) * opp / (1 + 0.55 * n);
      cw.pers[c.f] = (cw.pers[c.f] ?? 0) - k; cw.opVis[c.f] = n + 1; cw.stops.push({ w: s.week, f: c.f, st, who: "op", k: "rally" });
    }
    out.push(`${s.op} held rallies in ${pick.map((p) => p.c.n).join(" and ")}, ${d.states[si(d, st)]?.n}.`);
  }
  // every other week the other side opens an office in the biggest close county of its top state
  if (s.week % 2 === 0 && s.opVisits[0]) {
    const cs = counties(d, s, s.opVisits[0].split("-")[0], ms).filter((c) => !cw.opOff.includes(c.f) && Math.abs(c.m) < 15).sort((a, b) => b.v - a.v);
    if (cs[0]) { cw.opOff.push(cs[0].f); out.push(`${s.op} opened a field office in ${cs[0].n}.`); }
  }
  cw.stops = cw.stops.filter((x) => x.w >= s.week - 2);
  sync(d, s);
  return out;
}
