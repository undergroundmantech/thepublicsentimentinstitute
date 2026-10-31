// Turns civicAPI's Brazil runoff records (the national race and the 27 state races) into the Live payload every
// Brazil results page reads, with the On Point projection worked out. Election night ran this in /api/brasil/live;
// the archive capture script runs the same code over the saved provider records, so the archived count is processed
// exactly the way the live count was.
import { projectAll, type Exp, type Live, type RawState } from "./project";

export type CivicCand = { name: string; party?: string; votes?: number; winner?: boolean };
export type CivicRegion = { name: string; type?: string; percent_reporting?: number; candidates?: CivicCand[] };
export type CivicRace = { candidates?: CivicCand[]; region_results?: CivicRegion[] | Record<string, CivicRegion>; percent_reporting?: number; test_data?: boolean; last_updated?: string };

const key = (s: string) => s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const isF = (c: CivicCand) => c.party === "PL" || /bolsonaro/i.test(c.name);
const isL = (c: CivicCand) => c.party === "PT" || /lula/i.test(c.name);
function two(cs: CivicCand[] = []) {
  let fv = 0, lv = 0, win: "F" | "L" | null = null;
  for (const c of cs) { if (isF(c)) { fv += c.votes ?? 0; if (c.winner) win = "F"; } else if (isL(c)) { lv += c.votes ?? 0; if (c.winner) win = "L"; } }
  return { fv, lv, win };
}
// TSE and IBGE spell a few towns differently, Arês and Arez, Assu and Açu; a looser key ties those to the model's name
const loose = (k: string) => k.replace(/z/g, "s").replace(/y/g, "i").replace(/ph/g, "f").replace(/h/g, "").replace(/(.)\1/g, "$1");
let keys: { exp: Exp; alias: Record<string, Record<string, string>>; state: Record<string, string> } | null = null;
function keysFor(exp: Exp) {
  if (keys?.exp !== exp) keys = {
    exp,
    alias: Object.fromEntries(Object.entries(exp.mun).map(([uf, m]) => [uf, Object.fromEntries(Object.keys(m).map((k) => [loose(k), k]))])),
    state: Object.fromEntries(Object.entries(exp.states).map(([uf, s]) => [key(s[4]), uf])),
  };
  return keys;
}

/** nat: the national race record, or null if it could not be read; states: each state's race record by UF, or null */
export function liveFromCivic(exp: Exp, nat: CivicRace | null, states: Record<string, CivicRace | null>, now = new Date().toISOString()): Live {
  const { alias, state } = keysFor(exp);
  const munKey = (uf: string, name: string) => { const k = key(name); return exp.mun[uf]?.[k] ? k : alias[uf]?.[loose(k)] ?? k; };
  const raw: Record<string, RawState> = {};
  let n = { pr: 0, fv: 0, lv: 0, win: null as "F" | "L" | null }, test = false, t = now;
  if (nat) {
    const s = two(nat.candidates); test = !!nat.test_data; t = nat.last_updated ?? t;
    n = { pr: nat.percent_reporting ?? 0, ...s };
    for (const v of Object.values(nat.region_results || {})) {
      const uf = /exterior/i.test(v.name) ? "ZZ" : state[key(v.name)]; if (!uf) continue;
      const x = two(v.candidates); raw[uf] = { pr: v.percent_reporting ?? 0, fv: x.fv, lv: x.lv, m: {}, win: x.win };
    }
  }
  for (const [uf, j] of Object.entries(states)) {
    if (!j) continue;
    const s = two(j.candidates), m: RawState["m"] = {};
    let sp = j.percent_reporting ?? 0;
    for (const v of Object.values(j.region_results || {})) {
      const x = two(v.candidates);
      if (v.type === "State") { sp = Math.max(sp, v.percent_reporting ?? 0); continue; }
      if (x.fv + x.lv > 0) m[munKey(uf, v.name)] = [x.fv, x.lv, v.percent_reporting ?? 0];
    }
    const prev = raw[uf];
    // the state race and the national race's state row can update a moment apart; take whichever has counted more
    if (!prev || s.fv + s.lv >= prev.fv + prev.lv) raw[uf] = { pr: Math.max(sp, prev?.pr ?? 0), fv: s.fv, lv: s.lv, m, win: s.win ?? prev?.win ?? null };
    else raw[uf] = { ...prev, m };
  }
  return projectAll(raw, n, exp, t, test);
}
