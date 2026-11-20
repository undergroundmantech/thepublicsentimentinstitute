// Server side data for the new 2028 home and the 2028 state pages, cut down to what each page draws. Everything comes
// from the forecast's own files in public/forecast/2028/x, so a model update reaches these pages on the next build.
import fs from "node:fs";
import path from "node:path";
import { FIPS_ST, STATE_NAME, type GenFile, type PrimFile, type StatesGeo, type CountiesGeo } from "./lib";

const P = (f: string) => path.join(process.cwd(), "public", "forecast", "2028", "x", f);
const cache: Record<string, unknown> = {};
const read = <T,>(f: string): T => (cache[f] ??= JSON.parse(fs.readFileSync(P(f), "utf8"))) as T;
const gen = () => read<GenFile>("gen.json");
const prim = () => read<PrimFile>("prim.json");

export const ELECTION_DAY = "2028-11-07";

export type Pair = {
  id: string; d: string; r: string; pD: number; evD: number; ev10: number; ev90: number; nat: number; tip: string; odds: number | null;
  /** the Democrat's electoral votes from the states the Democrat leads on the map, so the headline count matches the map */
  evMap: number;
  /** state or district: [margin, Democratic win chance], margins Republican minus Democrat */
  st: Record<string, [number, number]>;
};
/** each state's county simulation added up, the vote weighted margin of its counties for the generic Democrat against
 * Vance, the dashboard's own state number */
let CS: Record<string, number> | null = null;
export function countySum(): Record<string, number> {
  if (CS) return CS;
  const G = gen(); const a: Record<string, [number, number]> = {};
  for (const [f, [w, , m]] of Object.entries(G.cty)) { const st = FIPS_ST[f.slice(0, 2)]; if (!st || !(w > 0)) continue; const x = (a[st] ??= [0, 0]); x[0] += m * w; x[1] += w; }
  CS = Object.fromEntries(Object.entries(a).map(([k, [mw, w]]) => [k, mw / w]));
  return CS;
}
/** a state's margin in a matchup the way the dashboard maps it: the sum of its counties, moved by the matchup's change
 * from the generic Democrat against Vance; districts and places without counties keep the matchup's own margin */
export const dashMargin = (k: string, m: number) => { const c = countySum()[k]; return c == null ? m : c + (m - (gen().base[k] ?? m)); };
const pairOf = (p: GenFile["pairs"][number], odds: number | null): Pair => {
  const G = gen(); const st: Pair["st"] = {};
  G.keys.forEach((k, i) => { const v = p[11][i]; if (v) st[k] = [dashMargin(k, v[0]), v[1]]; });
  return { id: `${p[0]}|${p[1]}`, d: p[0], r: p[1], pD: p[2], evD: p[3], ev10: p[4], ev90: p[5], nat: p[6], tip: p[7], odds, st, evMap: mapEV(st, G.ev) };
};

/** electoral votes from the states each side leads; Nebraska's 1st and 3rd districts are not modeled apart and go with the state */
export function mapEV(st: Pair["st"], ev: Record<string, number>): number {
  let d = 0;
  for (const [k, v] of Object.entries(st)) if (v[0] <= 0) d += ev[k] ?? 0;
  if (st.NE && st.NE[0] <= 0) d += 2;
  return d;
}

export function nomination() {
  const pr = prim(); const out = { D: [] as { name: string; p: number; color: string }[], R: [] as { name: string; p: number; color: string }[] };
  for (const k of ["D", "R"] as const) out[k] = pr[k].names.map((n, j) => ({ name: n, p: pr[k].nomination[j], color: pr[k].colors[j] })).sort((a, b) => b.p - a.p);
  return out;
}

/** the matchups worth a card: the likeliest pairings by both nominations' odds, then the forecast's generic headline */
export function featured(n = 8): Pair[] {
  const G = gen(); const nom = nomination();
  const odd = (k: "D" | "R", name: string) => nom[k].find((x) => x.name === name)?.p ?? 0;
  const ranked = G.pairs.filter((p) => !p[0].startsWith("Generic") && !p[1].startsWith("Generic"))
    .map((p) => ({ p, o: odd("D", p[0]) * odd("R", p[1]) })).sort((a, b) => b.o - a.o).slice(0, n);
  const out = ranked.map(({ p, o }) => pairOf(p, o));
  const g = G.pairs.find((p) => p[0] === "Generic Democrat" && p[1] === "Vance");
  if (g) out.push(pairOf(g, null));
  return out;
}

/** the primaries, state by state: the leader, their share and the top three */
export function primStates() {
  const pr = prim(); const out: Record<"D" | "R", Record<string, { lead: string; color: string; share: number; win: number; top: [string, number, string][] }>> = { D: {}, R: {} };
  for (const k of ["D", "R"] as const) {
    const f = pr[k];
    for (const [st, s] of Object.entries(f.states)) {
      const tot = s.total || s.votes.reduce((a, b) => a + b, 0) + s.other;
      const idx = s.votes.map((v, j) => [v, j] as const).sort((a, b) => b[0] - a[0]);
      const [v0, j0] = idx[0];
      out[k][st] = { lead: f.names[j0], color: f.colors[j0], share: tot ? v0 / tot : 0, win: s.win?.[j0] ?? 0,
        top: idx.slice(0, 3).map(([v, j]) => [f.names[j], tot ? v / tot : 0, f.colors[j]] as [string, number, string]) };
    }
  }
  return out;
}

export function geo() { return read<StatesGeo>("states.json"); }
export const stateCodes = () => Object.keys(geo().states).filter((s) => STATE_NAME[s]);

/** one state's page: its outline, its counties with their paths and baseline numbers, and every featured matchup there */
export function stateData(st: string) {
  const G = gen(); const g = geo(); const cg = read<CountiesGeo>("counties.json");
  const counties = cg.counties.filter((c) => c[1] === st).map((c) => { const b = G.cty[c[0]]; return { f: c[0], n: c[2], d: c[3], w: b?.[0] ?? 0, o: b?.[1] ?? 0, m: b?.[2] ?? 0, m24: c[4] }; });
  const dists = Object.keys(G.dist).filter((k) => k.startsWith(st + "-"));
  return {
    st, name: STATE_NAME[st], ev: G.ev[st] ?? 0, base: countySum()[st] ?? G.base[st] ?? 0, sig: G.sig[st] ?? 4, m24: g.a24[st] ?? null,
    outline: g.states[st], box: g.box[st], counties, dists: dists.map((k) => ({ k, ev: G.ev[k] ?? 0 })),
  };
}

/** any pairing the forecast ran, by the model's own names */
export function pairFor(d: string, r: string): Pair | null {
  const p = gen().pairs.find((x) => x[0] === d && x[1] === r); return p ? pairOf(p, null) : null;
}
/** the model's name for a person, matched from their full name */
export function modelName(full: string, party: "D" | "R"): string | null {
  const names = [...new Set([...prim()[party].names, ...gen().pairs.map((p) => p[party === "D" ? 0 : 1])])].filter((n) => !n.startsWith("Generic"));
  return names.find((n) => n === full) ?? names.find((n) => full.endsWith(" " + n) || full.endsWith(n)) ?? null;
}
