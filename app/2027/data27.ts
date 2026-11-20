// The 2027 governor model, server side: Kentucky, Mississippi and Louisiana, read at build time from
// public/forecast/2027/gov27.json (built by the gov27 pipeline: 20,000 runs per state, a 2027 national environment,
// each state's lean and a bottom up electorate from the L2 voter file). Margins are Republican minus Democrat.
import fs from "node:fs";
import path from "node:path";

export type Code = "KY" | "MS" | "LA";
type Field = { names: string[]; p_run: number[]; nom: number[]; share: number[]; p_runoff: number; notes: string[] };
type Jungle = { names: string[]; party: ("R" | "D" | "I")[]; p_run: number[]; first: number[]; p_lead: number[]; p_win: number[]; notes: string[] };
export type County = { fips: string; name: string; path: string; votes: number; m24: number | null; m26: number | null; rel: number };
type RawState = {
  meta: { system: "closed" | "runoff" | "jungle"; primary: string; general: string; held: "R" | "D"; incumbent: string; runoff: string | null };
  lean: Record<string, unknown> & { governor_history_lean: number; senate_2026_lean: number; presidential_lean: number; down_ballot_lean: number };
  primary: { R?: Field; D?: Field; J?: Jungle; p_outright?: number; p_outright_R?: number };
  pR: number; margin: number; p10: number; p90: number; hist: number[];
  pairs: Record<string, { p: number; pR: number; margin: number; cty: number[] }>;
  counties: County[];
};
type File = { built: string; env27: number; env_sd: number; state_sd: number; N: number; states: Record<Code, RawState> };

let cache: File | null = null;
const file = (): File => (cache ??= JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", "2027", "gov27.json"), "utf8")) as File);

export const STATES: { code: Code; slug: string; name: string }[] = [
  { code: "KY", slug: "kentucky", name: "Kentucky" },
  { code: "MS", slug: "mississippi", name: "Mississippi" },
  { code: "LA", slug: "louisiana", name: "Louisiana" },
];
export const bySlug = (s: string) => STATES.find((x) => x.slug === s) ?? null;

export type Pair = { id: string; r: string; d: string; p: number; pR: number; margin: number; cty: number[] };
export type Cand = { name: string; party: "R" | "D" | "I"; pRun: number; win: number; share?: number; first?: number; note: string };

/** margin as a reader sees it: R +4.9, D +2.7, Even */
export const mg = (m: number, k = 1) => (Math.abs(m) < 0.05 ? "Even" : `${m > 0 ? "R" : "D"} +${Math.abs(m).toFixed(k)}`);
export const pc = (p: number) => (p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(p * 100)}%`);
export const last = (n: string) => n.split(" ").slice(-1)[0];

/** the counties' bounding box from their path coordinates, padded, as an SVG viewBox */
function viewBoxOf(counties: County[]) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const c of counties) {
    const n = c.path.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) { const x = n[i], y = n[i + 1]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  const pad = Math.max(x1 - x0, y1 - y0) * 0.03;
  return `${(x0 - pad).toFixed(1)} ${(y0 - pad).toFixed(1)} ${(x1 - x0 + 2 * pad).toFixed(1)} ${(y1 - y0 + 2 * pad).toFixed(1)}`;
}

function erf(x: number) { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
const ncdf = (z: number) => 0.5 * (1 + erf(z / Math.SQRT2));
function ninv(p: number) { let lo = -8, hi = 8; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (ncdf(m) < p) lo = m; else hi = m; } return (lo + hi) / 2; }

export function stateModel(code: Code) {
  const F = file(), S = F.states[code];
  // A matchup that only turns up in a few dozen of the 20,000 runs has a noisy win chance, so it is blended toward the
  // chance its own margin implies, using the spread the state's well sampled matchups show. Above a few thousand runs the
  // simulated chance stands on its own.
  const runs = (v: { p: number }) => v.p * F.N;
  const zs = Object.values(S.pairs).filter((v) => runs(v) >= 1000 && Math.abs(v.margin) > 0.5 && v.pR > 0.02 && v.pR < 0.98).map((v) => v.margin / ninv(v.pR)).filter((x) => x > 0).sort((a, b) => a - b);
  const sd = zs.length ? zs[Math.floor(zs.length / 2)] : (S.p90 - S.p10) / 2.5631;
  const steady = (v: { p: number; pR: number; margin: number }) => { const w = runs(v) / (runs(v) + 500); return w * v.pR + (1 - w) * ncdf(v.margin / sd); };
  const pairs: Pair[] = Object.entries(S.pairs).map(([id, v]) => { const [r, d] = id.split("|"); return { id, r, d, p: v.p, pR: steady(v), margin: v.margin, cty: v.cty }; }).sort((a, b) => b.p - a.p);
  const fieldOf = (party: "R" | "D"): Cand[] => {
    const f = S.primary[party]; if (!f) return [];
    return f.names.map((n, i) => ({ name: n, party, pRun: f.p_run[i], win: f.nom[i], share: f.share[i], note: f.notes[i] ?? "" })).sort((a, b) => b.win - a.win);
  };
  const J = S.primary.J;
  const jungle: Cand[] = J ? J.names.map((n, i) => ({ name: n, party: J.party[i], pRun: J.p_run[i], win: J.p_win[i], first: J.p_lead[i], share: J.first[i], note: J.notes[i] ?? "" })).sort((a, b) => b.win - a.win) : [];
  return {
    code, name: STATES.find((x) => x.code === code)!.name, slug: STATES.find((x) => x.code === code)!.slug,
    meta: S.meta, lean: S.lean, pR: S.pR, margin: S.margin, p10: S.p10, p90: S.p90, hist: S.hist,
    pairs, R: fieldOf("R"), D: fieldOf("D"), jungle,
    runoffR: S.primary.R?.p_runoff ?? null, runoffD: S.primary.D?.p_runoff ?? null,
    outright: S.primary.p_outright ?? null, outrightR: S.primary.p_outright_R ?? null,
    counties: S.counties.map((c) => ({ fips: c.fips, name: c.name, path: c.path, votes: c.votes, m24: c.m24 })),
    viewBox: viewBoxOf(S.counties),
    built: F.built, env: F.env27, N: F.N,
  };
}
export type StateModel = ReturnType<typeof stateModel>;
