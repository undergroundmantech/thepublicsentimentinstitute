// Browser side: the state level matchup simulation, colors and formats that client components share.
// The published county simulation covers the generic Democrat against Vance; other matchups move each state by the
// candidates' polling, home state and 2026 midterm effects and rerun the Electoral College here.
export type Cand = [number, Record<string, number>, number?];
export interface SimState { m: number; p10: number; p90: number; ev: number | null; reg: string | null }

export const fmtPct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
export const fmtN = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtMg = (m: number, d = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(d)}`);
export type Coal = { D: Record<string, Record<string, number>>; R: Record<string, Record<string, number>> };
/** Margin change against the published generic Democrat and Vance means: polling, home state, 2026 midterm and county coalition effects. */
export const shiftFor = (dc: Record<string, Cand>, rc: Record<string, Cand>, d: string, r: string, st: string, coal?: Coal) => {
  const a = dc[d] ?? [0, {}], b = rc[r] ?? [0, {}], v = rc["Vance"] ?? [0, {}];
  const cd = coal?.D[d]?.[st] ?? 0, cr = coal?.R[r]?.[st] ?? 0, cv = coal?.R["Vance"]?.[st] ?? 0;
  return a[0] + (a[1][st] ?? 0) + b[0] + (b[1][st] ?? 0) - v[0] - (v[1][st] ?? 0) + cd + cr - cv;
};

/** Pale for close, deep for safe: the site's county ramp, by |margin| over 40. */
export function marginColor(m: number) {
  const a = Math.min(40, Math.abs(m || 0)) / 40;
  const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
  return m < 0 ? mix([214, 226, 255], [16, 40, 140], a) : mix([255, 220, 228], [140, 10, 40], a);
}
/** A smaller span for shifts: generation and migration move counties by tenths of a point to a few points. */
export function shiftColor(x: number, span = 3) {
  const a = Math.min(1, Math.abs(x || 0) / span);
  const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
  return x < 0 ? mix([236, 240, 250], [36, 84, 214], a) : mix([250, 236, 240], [200, 30, 64], a);
}
export function probColor(pD: number) { return marginColor((0.5 - pD) * 80); }
export function leaderColor(hex: string, share: number) {
  const t = Math.max(0.3, Math.min(1, (share - 8) / 32));
  const c = hex.replace("#", ""); const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
  const base = [42, 35, 51];
  return `rgb(${[r, g, b].map((v, i) => Math.round(base[i] + (v - base[i]) * t)).join(",")})`;
}

function rng(seed: number) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
function gauss(r: () => number) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

export interface SimOut { pD: number; mean: number; p10: number; p90: number; win: Record<string, number>; tip: [string, number] | null; hist: number[] }
/** 20,000 runs: national error with fat tails, regional 1.5, and each state's own spread from the county simulation. */
export function simulate(states: Record<string, SimState>, shift: (st: string) => number, N = 20000): SimOut {
  const r = rng(20280);
  const keys = Object.keys(states).filter((k) => states[k].ev);
  const regs = [...new Set(keys.map((k) => states[k].reg || "x"))];
  const mu = keys.map((k) => states[k].m + shift(k.split("-")[0]));
  // the county simulation's 80% range already holds national, regional and state error; take national and regional out
  const sdS = keys.map((k) => Math.max(1.5, Math.sqrt(Math.max(0, ((states[k].p90 - states[k].p10) / 2.563) ** 2 - 4.6 ** 2 - 1.5 ** 2))));
  const ev = keys.map((k) => states[k].ev as number);
  const win: Record<string, number> = Object.fromEntries(keys.map((k) => [k, 0]));
  const out = new Float64Array(N); const hist = new Array(54).fill(0);
  for (let i = 0; i < N; i++) {
    // t with 6 degrees of freedom, scale 3.8
    let chi = 0; for (let j = 0; j < 6; j++) { const z = gauss(r); chi += z * z; }
    const nat = 3.8 * gauss(r) / Math.sqrt(chi / 6);
    const rg: Record<string, number> = {}; regs.forEach((g) => (rg[g] = 1.5 * gauss(r)));
    let e = 0;
    for (let k = 0; k < keys.length; k++) {
      const d = mu[k] + nat + rg[states[keys[k]].reg || "x"] + sdS[k] * gauss(r);
      if (d < 0) { e += ev[k]; win[keys[k]]++; }
    }
    // Nebraska's first district follows the state when the state is close
    out[i] = e; hist[Math.min(53, Math.floor(e / 10))]++;
  }
  const s = Array.from(out).sort((a, b) => a - b);
  keys.forEach((k) => (win[k] /= N));
  const order = keys.filter((k) => !k.includes("-")).map((k) => [k, mu[keys.indexOf(k)]] as [string, number]).sort((a, b) => a[1] - b[1]);
  let cum = 0, tip: [string, number] | null = null;
  for (const [k, m] of order) { cum += states[k].ev as number; if (cum >= 270) { tip = [k, m]; break; } }
  return { pD: s.filter((x) => x >= 270).length / N, mean: s.reduce((a, b) => a + b, 0) / N, p10: s[Math.floor(N * 0.1)], p90: s[Math.floor(N * 0.9)], win, tip, hist };
}
