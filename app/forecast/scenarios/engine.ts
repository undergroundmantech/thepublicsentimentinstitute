// Within a state scenarios: the county math shared by the county what if and the demographic swingometer.
// Inputs come from public/forecast/scenarios/{id}.json, built by scripts/forecast/scenarios/build_scenarios.mjs.
// Margins are R minus D in points, the sign the site uses. Every shift the user sets is "toward Democrats"
// when positive, the way the statewide swingometer reads.

export type Dim = { k: string; l: string; g: string[] };
export type County = [id: string, name: string, dem: number, rep: number, other: number];
export type RaceFile = {
  v: number; updated: string; id: string; st: string; office: "senate" | "governor"; state: string; name: string;
  dem: string; gop: string; ind: boolean; m: number; pD: number; sd: number; p10: number; p90: number;
  votes: { dem: number; rep: number; other: number; total: number } | null; unit: string; prof: string | null;
  dims: Dim[]; c: County[]; x: Record<string, (number[] | null)[]>; regions: { k: string; l: string; i: number[] }[];
};
export type IndexRace = { id: string; st: string; state: string; office: "senate" | "governor"; dem: string; gop: string; ind: boolean; m: number; pD: number; n: number; dims: number };
export type Index = { updated: string; races: IndexRace[] };

/** m: points toward Democrats, t: turnout change in percent */
export type Edit = { m: number; t: number };
export type GroupShift = { m: number[]; t: number[] };
export type Scen = { c: Record<string, Edit>; r: Record<string, Edit>; g: Record<string, GroupShift>; o: number };
export const EMPTY: Scen = { c: {}, r: {}, g: {}, o: 0 };

export type CountyOut = { i: number; id: string; name: string; D0: number; R0: number; O0: number; T0: number; M0: number; D: number; R: number; O: number; T: number; M: number };
export type Out = { rows: CountyOut[]; D: number; R: number; O: number; T: number; T0: number; dM: number; M: number; pD: number; net: number };

export const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
export const Phi = (z: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
};
export function PhiInv(p: number) {
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  const pl = 0.02425;
  if (p < pl) { const q = Math.sqrt(-2 * Math.log(p)); return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  if (p > 1 - pl) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}

export const editZero = (e?: Edit) => !e || (!e.m && !e.t);
export const groupZero = (g?: GroupShift) => !g || (g.m.every((v) => !v) && g.t.every((v) => !v));
export const scenZero = (s: Scen) => !s.o && Object.values(s.c).every(editZero) && Object.values(s.r).every(editZero) && Object.values(s.g).every(groupZero);

/** which area groups each county sits in */
export function memberships(rf: RaceFile): string[][] {
  const m: string[][] = rf.c.map(() => []);
  for (const r of rf.regions) for (const i of r.i) m[i]?.push(r.k);
  return m;
}

/** the scenario, county by county, then the state */
export function compute(rf: RaceFile, sc: Scen, mem: string[][], only?: { dim?: string; overall?: boolean; edits?: boolean }): Out {
  const rows: CountyOut[] = [];
  let D = 0, R = 0, O = 0, T = 0, D0s = 0, R0s = 0, T0s = 0;
  const useG = !only || only.dim != null, useO = !only || only.overall, useE = !only || only.edits;
  const all = sc.r.all;
  rf.c.forEach(([id, name, D0, R0, O0], i) => {
    const TP0 = D0 + R0, T0 = TP0 + O0;
    const M2 = TP0 > 0 ? ((R0 - D0) / TP0) * 100 : 0;
    let dd = 0, f = 1;
    if (useG) {
      for (const d of rf.dims) {
        if (only?.dim && only.dim !== d.k) continue;
        const sh = sc.g[d.k], row = rf.x[d.k]?.[i];
        if (!row || groupZero(sh)) continue;
        let w = 0, base = 0, num = 0, den = 0;
        for (let gi = 0; gi < d.g.length; gi++) {
          const s = row[2 * gi], m = row[2 * gi + 1], k = 1 + (sh.t[gi] || 0) / 100;
          w += s; base += s * m; num += s * k * clamp(m - (sh.m[gi] || 0), -100, 100); den += s * k;
        }
        if (!w || !den) continue;
        dd += num / den - base / w; f *= den / w;
      }
    }
    if (useO) dd -= sc.o;
    if (useE) {
      let em = 0, et = 1;
      const ap = (e?: Edit) => { if (!e) return; em += e.m; et *= 1 + e.t / 100; };
      ap(all);
      for (const k of mem[i]) ap(sc.r[k]);
      ap(sc.c[id]);
      // county and area moves are in points of the whole vote, the margin the map shows
      dd -= TP0 > 0 ? (em * T0) / TP0 : 0;
      f *= Math.max(0.05, et);
    }
    const M2n = clamp(M2 + dd, -100, 100);
    const TP = TP0 * f, Oc = O0 * f, Rc = (TP * (1 + M2n / 100)) / 2, Dc = TP - Rc, Tc = TP + Oc;
    rows.push({ i, id, name, D0, R0, O0, T0, M0: T0 ? ((R0 - D0) / T0) * 100 : 0, D: Dc, R: Rc, O: Oc, T: Tc, M: Tc ? ((Rc - Dc) / Tc) * 100 : 0 });
    D += Dc; R += Rc; O += Oc; T += Tc; D0s += D0; R0s += R0; T0s += T0;
  });
  const mBase = T0s ? ((R0s - D0s) / T0s) * 100 : 0;
  const mNow = T ? ((R - D) / T) * 100 : 0;
  const dM = mNow - mBase;
  const p0 = clamp(rf.pD, 0.0005, 0.9995);
  const pD = Math.abs(dM) < 1e-6 ? rf.pD : clamp(Phi(PhiInv(p0) - dM / (rf.sd || 6)), 0.0005, 0.9995);
  return { rows, D, R, O, T, T0: T0s, dM, M: rf.m + dM, pD, net: R - D };
}

// ---------- share links ----------
const b64 = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64 = (s: string) => atob(s.replace(/-/g, "+").replace(/_/g, "/"));
export function encodeScen(s: Scen): string {
  if (scenZero(s)) return "";
  const o: Record<string, unknown> = {};
  const c = Object.entries(s.c).filter(([, e]) => !editZero(e)).map(([k, e]) => [k, e.m, e.t]);
  const r = Object.entries(s.r).filter(([, e]) => !editZero(e)).map(([k, e]) => [k, e.m, e.t]);
  const g = Object.entries(s.g).filter(([, v]) => !groupZero(v)).map(([k, v]) => [k, v.m, v.t]);
  if (c.length) o.c = c; if (r.length) o.r = r; if (g.length) o.g = g; if (s.o) o.o = s.o;
  return b64(JSON.stringify(o));
}
export function decodeScen(h: string, rf: RaceFile): Scen | null {
  try {
    const raw = JSON.parse(unb64(h)) as { c?: [string, number, number][]; r?: [string, number, number][]; g?: [string, number[], number[]][]; o?: number };
    const ids = new Set(rf.c.map((x) => x[0])), regs = new Set(["all", ...rf.regions.map((x) => x.k)]);
    const s: Scen = { c: {}, r: {}, g: {}, o: clamp(Number(raw.o) || 0, -20, 20) };
    for (const [k, m, t] of raw.c ?? []) if (ids.has(k)) s.c[k] = { m: clamp(+m || 0, -40, 40), t: clamp(+t || 0, -60, 60) };
    for (const [k, m, t] of raw.r ?? []) if (regs.has(k)) s.r[k] = { m: clamp(+m || 0, -30, 30), t: clamp(+t || 0, -50, 50) };
    for (const [k, m, t] of raw.g ?? []) {
      const d = rf.dims.find((x) => x.k === k); if (!d) continue;
      s.g[k] = { m: d.g.map((_, i) => clamp(Number(m?.[i]) || 0, -25, 25)), t: d.g.map((_, i) => clamp(Number(t?.[i]) || 0, -50, 50)) };
    }
    return s;
  } catch { return null; }
}

// ---------- formatting ----------
export const pct = (p: number) => (p > 0.995 ? ">99%" : p < 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
/** an R minus D margin as "D +4.2" or "R +1.0" */
export const fmM = (m: number, L = "D") => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? L : "R"} +${Math.abs(m).toFixed(1)}`);
/** a shift toward Democrats as "D +3.0" */
export const fmShift = (v: number, L = "D") => (Math.abs(v) < 0.05 ? "No change" : `${v > 0 ? L : "R"} +${Math.abs(v).toFixed(1)}`);
export const n0 = (n: number) => Math.round(n).toLocaleString("en-US");
export const short = (n: number) => (Math.abs(n) >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : Math.abs(n) >= 1e4 ? `${Math.round(n / 1e3)}K` : n0(n));
export const lastName = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").trim().split(/\s+/).slice(-1)[0];
