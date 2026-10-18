// Builds the swingometer's inputs from the published forecast: every race's forecast margin, odds, spread
// and votes, plus the electorate it is built on, group by group. Senate and governor races use the model's
// own simulated electorate (the estimated exit poll). House districts have no published electorate, so
// each one starts from its state's and is tilted, group by group, toward the district's own partisanship:
// the smallest change to the state's mix that matches how far the district runs from the state.
import fs from "node:fs";
import path from "node:path";
import { raceHref } from "@/app/lib/opp";

type XRow = [string, string, number, number, number, number];
type Race = {
  id: string; office: "senate" | "governor" | "house"; st: string; state: string; district: number; name: string;
  dem: string; gop: string; cands: { name: string; party: string; pct: number }[];
  est: { margin: number; prob: number; p10: number; p90: number };
  votes?: { dem: number; rep: number; other: number; total: number };
};
type Chamber = { demControl: number; demSeats: number; seatsTotal: number; hist: [number, number][]; median?: number };

export const DIMS: { key: string; label: string; src: string; groups: string[]; short?: string[]; cap: number }[] = [
  { key: "race", label: "Race", src: "Race", groups: ["White", "Black", "Latino", "Asian and other"], cap: 8 },
  { key: "age", label: "Age", src: "Age", groups: ["18 to 29", "30 to 44", "45 to 64", "65+"], cap: 1.6 },
  { key: "edu", label: "Education", src: "Education", groups: ["College graduate", "No college degree"], cap: 1.6 },
  { key: "raceedu", label: "Race and education", src: "Race and education", groups: ["White college graduates", "White, no college degree", "Nonwhite college graduates", "Nonwhite, no college degree"], cap: 6 },
  { key: "gender", label: "Gender", src: "Gender", groups: ["Men", "Women"], cap: 1.15 },
  { key: "income", label: "Income", src: "Income", groups: ["Under $50K", "$50K to $124K", "$125K and up"], cap: 1.5 },
  { key: "party", label: "Party", src: "Party ID", groups: ["Democrat", "Republican", "Independent"], cap: 5 },
  { key: "vote24", label: "2024 vote", src: "2024 presidential vote", groups: ["Harris", "Trump", "Other or did not vote"], cap: 5 },
  { key: "history", label: "Turnout history", src: "Vote history", groups: ["Voted in 2022 and 2024", "Voted in 2024, not 2022", "Voted in 2022, not 2024", "New or irregular voter"], cap: 1.6 },
];

/** One dimension of one race's electorate: [share of voters, Democratic minus Republican margin] per group. */
type Prof = [number, number][];
export type SwingRace = {
  id: string; o: "s" | "g" | "h"; st: string; name: string; dem: string; gop: string; ind: boolean;
  m: number; pD: number; sd: number; v: [number, number, number, number] | null; href: string; x: Prof[] | null; est: boolean;
};
export type SwingData = {
  updated: string; daysOut: number;
  dims: { key: string; label: string; groups: string[] }[];
  nat: Prof[];
  races: SwingRace[];
  chambers: Record<"senate" | "governor" | "house", { hist: [number, number][]; total: number; thr: number; offset: number; notUpD: number; notUpR: number; demControl: number; demSeats: number }>;
};

const r1 = (x: number) => Math.round(x * 10) / 10;

function prof(rows: XRow[]): Prof[] {
  return DIMS.map((d) => d.groups.map((g) => {
    const r = rows.find((x) => x[0] === d.src && x[1] === g);
    return r ? [r[2], r[3] - r[4]] as [number, number] : [0, 0] as [number, number];
  }));
}
const total = (rows: XRow[]) => { const t = rows.find((x) => x[0] === "All voters"); return t ? t[3] - t[4] : 0; };
const comp = (p: [number, number][]) => { const s = p.reduce((a, g) => a + g[0], 0) || 1; return p.reduce((a, g) => a + g[0] * g[1], 0) / s; };

/** Reweight a state's groups by exp(t * margin) so the mix matches a target margin, within a cap on how far any group can move. */
function tilt(p: [number, number][], target: number, cap: number): [number, number][] {
  const live = p.filter((g) => g[0] > 0);
  if (live.length < 2) return p;
  const spread = Math.max(...live.map((g) => g[1])) - Math.min(...live.map((g) => g[1]));
  if (spread < 1) return p;
  const tmax = Math.log(cap) / spread;
  const at = (t: number) => p.map(([s, m]) => [s * Math.exp(t * m), m] as [number, number]);
  let lo = -tmax, hi = tmax;
  if (comp(at(hi)) <= target) return norm(at(hi));
  if (comp(at(lo)) >= target) return norm(at(lo));
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (comp(at(mid)) < target) lo = mid; else hi = mid; }
  return norm(at((lo + hi) / 2));
}
function norm(p: [number, number][]): [number, number][] {
  const s = p.reduce((a, g) => a + g[0], 0) || 1;
  return p.map(([w, m]) => [r1((100 * w) / s), r1(m)]);
}


let cache: SwingData | null = null;
export function getSwingData(): SwingData {
  if (cache) return cache;
  const dir = path.join(process.cwd(), "public", "forecast");
  const model = JSON.parse(fs.readFileSync(path.join(dir, "model.json"), "utf8")) as { meta: Record<string, number | string>; chambers: Record<string, Chamber>; races: Race[] };
  const xt = JSON.parse(fs.readFileSync(path.join(dir, "crosstabs.json"), "utf8")) as Record<string, XRow[]>;

  // national electorate: each state counted once, by its statewide race with the most votes
  const byState = new Map<string, { rows: XRow[]; votes: number; race: Race }>();
  for (const r of model.races) {
    if (r.office === "house" || !xt[r.id]) continue;
    const v = r.votes?.total ?? 0;
    const cur = byState.get(r.st);
    if (!cur || (r.office === "senate" && cur.race.office !== "senate") || (r.office === cur.race.office && v > cur.votes)) byState.set(r.st, { rows: xt[r.id], votes: v, race: r });
  }
  const natW = [...byState.values()];
  const natTot = natW.reduce((a, s) => a + s.votes, 0) || 1;
  const nat: Prof[] = DIMS.map((_, di) => DIMS[di].groups.map((_, gi) => {
    let s = 0, m = 0, w = 0;
    for (const x of natW) { const p = prof(x.rows)[di][gi]; s += (p[0] * x.votes) / natTot; m += p[1] * p[0] * x.votes; w += p[0] * x.votes; }
    return [r1(s), r1(w ? m / w : 0)] as [number, number];
  }));

  const races: SwingRace[] = [];
  for (const r of model.races) {
    const o = r.office === "senate" ? "s" : r.office === "governor" ? "g" : "h";
    const e = r.est;
    const pD = 1 - e.prob;
    const sd = e.p90 > e.p10 ? (e.p90 - e.p10) / 2.5631 : 6;
    const ind = !!r.cands?.[0] && r.cands[0].party === "IND" && e.margin < 0;
    const unc = Math.abs(e.margin) >= 99;
    let x: Prof[] | null = null, est = false;
    if (!unc) {
      if (xt[r.id]) x = prof(xt[r.id]).map((d) => d.map(([s, m]) => [r1(s), r1(m)] as [number, number]));
      else {
        const base = byState.get(r.st);
        const sp = base ? prof(base.rows) : nat;
        const sTot = base ? total(base.rows) : comp(nat[0]);
        const stateD = base ? -base.race.est.margin : sTot;
        const target = sTot + (-e.margin - stateD);
        // tilt each breakdown toward the district, then move every group by what is left over, so the district's
        // mix adds up to its own forecast margin and turnout changes are weighed against the district, not the state
        x = sp.map((d, di) => {
          const t = tilt(d, target, DIMS[di].cap);
          const rest = target - comp(t);
          return t.map(([w, m]) => [w, r1(Math.max(-99, Math.min(99, m + rest)))] as [number, number]);
        });
        est = true;
      }
    }
    const v = r.votes && r.votes.total ? [r.votes.dem, r.votes.rep, r.votes.other, r.votes.total] as [number, number, number, number] : null;
    races.push({
      id: r.id, o, st: r.st, name: r.office === "house" ? r.name : r.state, dem: r.dem, gop: r.gop, ind,
      m: e.margin, pD: Math.round(pD * 10000) / 10000, sd: r1(sd), v, href: raceHref(r.id), x, est,
    });
  }

  const meta = model.meta as Record<string, number | string>;
  const ch = (k: "senate" | "governor" | "house", thr: number, notUpD: number, notUpR: number) => {
    const c = model.chambers[k];
    const T = c.seatsTotal;
    const base = c.hist.reduce((a, [s, p]) => a + (T - s >= thr ? p : 0), 0);
    return { hist: c.hist, total: T, thr, offset: c.demControl - base, notUpD, notUpR, demControl: c.demControl, demSeats: c.demSeats };
  };
  cache = {
    updated: String(meta.updated), daysOut: Number(meta.daysOut),
    dims: DIMS.map((d) => ({ key: d.key, label: d.label, groups: d.groups })),
    nat, races,
    chambers: {
      senate: ch("senate", 51, Number(meta.senNotUpD), Number(meta.senNotUpR)),
      governor: ch("governor", 26, Number(meta.govNotUpD), Number(meta.govNotUpR)),
      house: ch("house", 218, 0, 0),
    },
  };
  return cache;
}
