// Election night projection for the Brazil runoff, shared by the live route and the preview simulation.
// Each state: the vote counted so far, plus the vote still to count. The uncounted part starts from what the model
// expected in the municipalities that have not reported, then moves by how far the reported municipalities ran from
// their own expectation. The band narrows as the count grows; a state or the country is called only when the
// projection sits far outside it.
export type Exp = { states: Record<string, [number, number, number, number, string]>; mun: Record<string, Record<string, [number, number]>>; nat: [number, number, number, number] };
export type RawState = { pr: number; fv: number; lv: number; m: Record<string, [number, number, number]>; win?: "F" | "L" | null };
export type Proj = { f: number; lo: number; hi: number; p: number; total: number; counted: number; call: "F" | "L" | null; swing: number | null };
export type LiveState = { pr: number; fv: number; lv: number; m: Record<string, [number, number, number]>; proj: Proj };
export type Live = { t: string; test: boolean; sim?: boolean; nat: { pr: number; fv: number; lv: number; proj: Proj }; st: Record<string, LiveState> };

export function phi(z: number) {
  const t = 1 / (1 + 0.2316419 * Math.abs(z)), d = 0.3989423 * Math.exp((-z * z) / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - p : p;
}
const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));

export function projectState(uf: string, r: RawState, exp: Exp): Proj {
  const [expS, expValid, p10, p90] = exp.states[uf];
  const mun = exp.mun[uf] || {};
  const counted = r.fv + r.lv;
  let mF = 0, mV = 0, aF = 0, aV = 0;
  for (const [k, v] of Object.entries(r.m || {})) {
    const e = mun[k]; if (!e) continue;
    const c = v[0] + v[1]; if (c <= 0) continue;
    // a municipality partly counted only stands for the share it has counted
    const share = clamp((v[2] || 100) / 100, 0.05, 1);
    mF += (e[0] / 100) * e[1] * share; mV += e[1] * share; aF += v[0]; aV += c;
  }
  let swing: number | null = null;
  if (aV > 0 && mV > 0) swing = (100 * aF) / aV - (100 * mF) / mV;
  else if (counted > 0) swing = 0.5 * ((100 * r.fv) / counted - expS);
  const w = clamp(r.pr / 100, 0, 1);
  let total = expValid;
  if (counted > 0) total = w >= 0.995 ? counted : Math.max(counted, w > 0.01 ? w * (counted / w) + (1 - w) * expValid : expValid);
  const remaining = Math.max(0, total - counted);
  const unrepV = expValid - mV;
  const unrepExp = mV > 0 && unrepV > expValid * 0.02 ? clamp((100 * ((expS / 100) * expValid - mF)) / unrepV, 1, 99) : expS;
  const k = counted / (counted + 0.04 * expValid);
  const remShare = clamp(unrepExp + (swing ?? 0) * k, 1, 99);
  const f = total > 0 ? (100 * (r.fv + (remShare / 100) * remaining)) / total : expS;
  const base = (p90 - p10) / 2.563;
  const sd = base * (remaining / Math.max(total, 1)) * (1 - 0.5 * k) + 0.04;
  const p = phi((f - 50) / sd);
  let call: "F" | "L" | null = r.win ?? null;
  if (!call && counted / Math.max(total, 1) >= 0.15 && Math.abs(f - 50) > 3.3 * sd) call = f > 50 ? "F" : "L";
  if (!call && w >= 0.999 && counted > 0) call = r.fv >= r.lv ? "F" : "L";
  return { f, lo: clamp(f - 1.2816 * sd, 0, 100), hi: clamp(f + 1.2816 * sd, 0, 100), p, total, counted, call, swing };
}

export function projectAll(raw: Record<string, RawState>, nat: { pr: number; fv: number; lv: number; win?: "F" | "L" | null }, exp: Exp, t: string, test = false): Live {
  const st: Record<string, LiveState> = {};
  let tot = 0, fvP = 0, cnt = 0, sfv = 0, slv = 0;
  for (const uf of Object.keys(exp.states)) {
    const r = raw[uf] ?? { pr: 0, fv: 0, lv: 0, m: {} };
    const proj = projectState(uf, r, exp);
    st[uf] = { pr: r.pr, fv: r.fv, lv: r.lv, m: r.m, proj };
    tot += proj.total; fvP += (proj.f / 100) * proj.total; cnt += proj.counted; sfv += r.fv; slv += r.lv;
  }
  const [, natValid, p10, p90] = exp.nat;
  const f = (100 * fvP) / tot;
  const remaining = Math.max(0, tot - cnt);
  const k = cnt / (cnt + 0.04 * natValid);
  const sd = ((p90 - p10) / 2.563) * (remaining / tot) * (1 - 0.5 * k) + 0.03;
  let call: "F" | "L" | null = nat.win ?? null;
  if (!call && cnt / tot >= 0.3 && Math.abs(f - 50) > 3.5 * sd) call = f > 50 ? "F" : "L";
  const useNat = nat.fv + nat.lv >= sfv + slv;
  return {
    t, test,
    nat: { pr: nat.pr, fv: useNat ? nat.fv : sfv, lv: useNat ? nat.lv : slv,
      proj: { f, lo: clamp(f - 1.2816 * sd, 0, 100), hi: clamp(f + 1.2816 * sd, 0, 100), p: phi((f - 50) / sd), total: tot, counted: cnt, call, swing: null } },
    st,
  };
}

// a preview of election night from the model's own expectations, labelled on every page as a simulation
export function simulate(exp: Exp, progress: number, seed = 7): Live {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-9)) * Math.cos(2 * Math.PI * rnd());
  const natErr = gauss() * 0.6;
  const raw: Record<string, RawState> = {};
  let nfv = 0, nlv = 0;
  for (const [uf, munis] of Object.entries(exp.mun)) {
    const stErr = natErr + gauss() * 1.0;
    const speed = 0.6 + rnd() * 0.8;
    let fv = 0, lv = 0; const m: Record<string, [number, number, number]> = {};
    for (const [k, [e, v]] of Object.entries(munis)) {
      const done = clamp((progress * speed - rnd() * 0.5) * 2.2, 0, 1);
      if (done <= 0) continue;
      const sh = clamp(e + stErr + gauss() * 2.5, 2, 98) / 100;
      const c = Math.round(v * done);
      const a = Math.round(c * sh);
      m[k] = [a, c - a, Math.round(done * 100)];
      fv += a; lv += c - a;
    }
    const expValid = exp.states[uf][1];
    raw[uf] = { pr: clamp((100 * (fv + lv)) / expValid, 0, 100), fv, lv, m };
    nfv += fv; nlv += lv;
  }
  return { ...projectAll(raw, { pr: clamp((100 * (nfv + nlv)) / exp.nat[1], 0, 100), fv: nfv, lv: nlv }, exp, new Date().toISOString()), sim: true };
}
