// Server side inputs for the early vote console: today's count by state, each state's 2022 and 2024 early vote
// checkpoints for pace, the 2026 count on each saved snapshot day, and the state's marquee forecast page.
import fs from "node:fs";
import path from "node:path";
import { getModel, isInd } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import type { EarlyVote, EvState } from "./server";
import { STATE_NAME, stateOfFips } from "./lib";

export type EvRow = {
  st: string; name: string; slug: string; total: number; mail: number; inperson: number; requested: number;
  dem: number; rep: number; ind: number; partyShare: number;
  t22: number | null; t24: number | null; e22: number | null; e24: number | null;
  pace22: number | null; pace24: number | null;
  cps22: [number, number][]; cps24: [number, number][]; s26: [number, number][];
  fc: { href: string; label: string } | null;
  /** the benchmark inputs: the state's Senate and governor forecasts, its poll range and the 2024 presidential result */
  bench: Bench | null;
  /** the On Point party model: reported party where the state publishes it, modeled where it does not */
  pm: { d: number; r: number; o: number; est: number; xd: number; xr: number; delta: number; shift: number | null } | null;
};
type P3 = { d: number; r: number; o: number };
export type BenchRace = { id: string; office: "senate" | "governor"; label: string; dem: string; gop: string; ind: boolean; href: string;
  /** the forecast margin, Republican positive, and its 80 percent range */
  F: number; p10: number; p90: number; prob: number; evShift: number;
  /** polls of the last 30 days the site average counts, as margins */
  polls: { lo: number; hi: number; loBy: string; hiBy: string; n: number; avg: number } | null };
export type Bench = { races: BenchRace[]; pres24: number | null; expEarly: number; expTotal: number; ballots: number; now: P3; expNow: P3; expFull: P3;
  /** 2024 vote of the early voters the forecast expects by now and of its whole electorate: Trump, Harris, new */
  gExp?: number[]; gFc?: number[] };
/** how On Point Polling likely voters of each party registration vote: shares of 2024 Trump, Harris and new voters, and their crossover */
export type Crossover = { trumpToD: number; harrisToR: number; newD: number; partyToGroup: Record<"Democrat" | "Republican" | "Independent", number[]> };
export type EvConsole = { snapshot: string; daysOut: number; total: number; mail: number; inperson: number; requested: number; dem: number; rep: number; ind: number; partyTotal: number;
  t22: number; e22: number; t24: number; e24: number; rows: EvRow[]; s26: [number, number][];
  pm: { d: number; r: number; o: number; est: number; delta: number } | null; signalsDate: string | null;
  xo: Crossover | null; pres24: number | null };

type Hist = { us: Record<"2022" | "2024", { turnout: number; early: number }>; states: Record<string, Partial<Record<"2022" | "2024", { turnout: number; early: number; cps?: [number, number, string?][] }>>> };
type Feed = { snapshot_date: string; regions: Record<string, Record<string, { votes: number }>> };

const ELECTION = Date.parse("2026-11-03T12:00:00Z");
export const daysOutOf = (d: string) => Math.max(0, Math.round((ELECTION - Date.parse(`${d}T12:00:00Z`)) / 864e5));

// the count a past cycle had reached this many days out, read between its published checkpoints
function at(cps: [number, number][], days: number): number | null {
  if (!cps.length) return null;
  const s = [...cps].sort((a, b) => b[0] - a[0]);
  if (days > s[0][0] || days < s[s.length - 1][0]) return null;
  for (let i = 0; i < s.length - 1; i++) {
    const [d0, v0] = s[i], [d1, v1] = s[i + 1];
    if (days <= d0 && days >= d1) return d0 === d1 ? v0 : v0 + ((d0 - days) / (d0 - d1)) * (v1 - v0);
  }
  return s[s.length - 1][1];
}

function dailySeries(): Record<string, [number, number][]> {
  const out: Record<string, [number, number][]> = {};
  try {
    const dir = path.join(process.cwd(), "scripts/forecast/earlyvote/snapshots");
    for (const day of fs.readdirSync(dir).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()) {
      const read = (c: string): Feed | null => { const f = path.join(dir, day, `US_${c}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) as Feed : null; };
      const r = read("returned"), i = read("inperson"); if (!r && !i) continue;
      const snap = [r?.snapshot_date, i?.snapshot_date].filter(Boolean).sort().reverse()[0] as string;
      const dOut = daysOutOf(snap);
      const tot: Record<string, number> = {};
      for (const f of [r, i]) for (const [st, g] of Object.entries(f?.regions ?? {})) tot[st] = (tot[st] ?? 0) + Object.values(g).reduce((a, b) => a + (Number(b?.votes) || 0), 0);
      let us = 0;
      for (const [st, v] of Object.entries(tot)) { if (!STATE_NAME[st] || st === "US") continue; us += v; const L = (out[st] ??= []); if (!L.some((p) => p[0] === dOut)) L.push([dOut, v]); }
      const U = (out.US ??= []); if (!U.some((p) => p[0] === dOut)) U.push([dOut, us]);
    }
  } catch { /* no saved snapshots on this server */ }
  return out;
}

type Sig = { ballots: number; estimatedShare: number; party: P3; expectedParty?: P3; expectedPartyFull?: P3; expectedEarly?: number; expectedTotal?: number; expGroups?: number[]; forecastElectorate?: number[]; actualMargin: number; expectedMargin: number; delta: number };
function signals(): { date: string | null; states: Record<string, Sig> } {
  try {
    const dir = path.join(process.cwd(), "scripts/forecast/earlyvote/snapshots");
    for (const d of fs.readdirSync(dir).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).sort().reverse()) {
      const f = path.join(dir, d, "ev_signals.json");
      if (fs.existsSync(f)) return { date: d, states: (JSON.parse(fs.readFileSync(f, "utf8")) as { states: Record<string, Sig> }).states };
    }
  } catch { /* no signals on this server */ }
  return { date: null, states: {} };
}
// the forecast correction the early vote put on each state's marquee race, in points of margin, Republican positive
function evShifts(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of getModel().races) {
    const ev = (r as unknown as { ev?: { shift?: number } }).ev;
    if (r.office === "house" || !ev || typeof ev.shift !== "number") continue;
    if (r.office === "senate" || out[r.st] == null) out[r.st] = ev.shift;
  }
  return out;
}

// the site poll average leaves these pollsters out, so the poll range does too
const POLL_OUT = /rasmussen|activote|wedgewood/i;
function benchRaces(): Record<string, BenchRace[]> {
  const out: Record<string, BenchRace[]> = {};
  for (const r of getModel().races) {
    if (r.office === "house" || !r.est) continue;
    const ps = (r.polls ?? []).filter((p) => p.age <= 30 && !POLL_OUT.test(p.pollster) && Number.isFinite(p.margin));
    const lo = ps.length ? ps.reduce((a, b) => (b.margin < a.margin ? b : a)) : null, hi = ps.length ? ps.reduce((a, b) => (b.margin > a.margin ? b : a)) : null;
    (out[r.st] ??= []).push({ id: r.id, office: r.office, label: r.office === "senate" ? "Senate" : "Governor", dem: r.dem, gop: r.gop, ind: isInd(r), href: raceHref(r.id),
      F: r.est.margin, p10: r.est.p10, p90: r.est.p90, prob: r.est.prob, evShift: r.ev?.shift ?? 0,
      polls: lo && hi ? { lo: lo.margin, hi: hi.margin, loBy: lo.pollster, hiBy: hi.pollster, n: ps.length, avg: ps.reduce((a, p) => a + p.margin, 0) / ps.length } : null });
  }
  for (const L of Object.values(out)) L.sort((a, b) => (a.office === b.office ? 0 : a.office === "senate" ? -1 : 1));
  return out;
}
// the 2024 presidential margin by state, Republican positive, from the certified county vote
function pres24(): Record<string, number> {
  const out: Record<string, number> = {};
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/forecast/pres24_counties.json"), "utf8")) as { c: Record<string, [number, number, number]> };
    const t: Record<string, [number, number, number]> = {};
    for (const [f, v] of Object.entries(j.c)) { const st = stateOfFips(f); if (!st) continue; const a = (t[st] ??= [0, 0, 0]); a[0] += v[0]; a[1] += v[1]; a[2] += v[2]; }
    let D = 0, R = 0, T = 0;
    for (const [st, [d, r, o]] of Object.entries(t)) { const n = d + r + o; if (n > 0) out[st] = ((r - d) / n) * 100; D += d; R += r; T += n; }
    if (T > 0) out.US = ((R - D) / T) * 100;
  } catch { /* no county file on this server */ }
  return out;
}
function crossover(): Crossover | null {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/earlyvote-electorate.json"), "utf8")) as { meta: { crossover: Crossover; partyToGroup: Crossover["partyToGroup"] } };
    return { trumpToD: j.meta.crossover.trumpToD, harrisToR: j.meta.crossover.harrisToR, newD: j.meta.crossover.newD, partyToGroup: j.meta.partyToGroup };
  } catch { return null; }
}

function forecastLinks(): Record<string, { href: string; label: string }> {
  const ids = new Set(getModel().races.map((r) => r.id)), out: Record<string, { href: string; label: string }> = {};
  for (const st of Object.keys(STATE_NAME)) {
    if (ids.has(`sen-${st}`)) out[st] = { href: raceHref(`sen-${st}`), label: `${STATE_NAME[st]} Senate forecast` };
    else if (ids.has(`gov-${st}`)) out[st] = { href: raceHref(`gov-${st}`), label: `${STATE_NAME[st]} governor forecast` };
  }
  return out;
}

export function buildEvConsole(ev: EarlyVote): EvConsole {
  const hist = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "earlyvote-history.json"), "utf8")) as Hist;
  const daysOut = daysOutOf(ev.snapshot);
  const series = dailySeries();
  const fc = forecastLinks();
  const sig = signals(), shifts = evShifts(), BR = benchRaces(), P24 = pres24();
  // Oct 24: where a state reports the party of its ballots, the party split is read from the live feed this page just
  // loaded, not from the saved snapshot the party model last ran on, so it moves with every new count. The model's
  // expected split for this point stays as it was, and the gap against it is worked out again from the live split.
  const reported = (s: EvState): Sig["party"] | null => {
    const T = s.dem + s.rep + s.ind;
    return s.partyShare >= 0.9 && T > 0 ? { d: s.dem / T, r: s.rep / T, o: s.ind / T } : null;
  };
  const sigOf = (s: EvState): Sig | undefined => {
    const g = sig.states[s.st], live = reported(s);
    if (!g || !live) return g;
    const actualMargin = (live.r - live.d) * 100;
    return { ...g, party: live, estimatedShare: Math.max(0, 1 - s.partyShare), ballots: s.total, actualMargin, delta: actualMargin - g.expectedMargin };
  };
  const rows: EvRow[] = ev.states.map((s) => {
    const h = hist.states[s.st] ?? {};
    const g0 = sigOf(s);
    const cp = (y: "2022" | "2024") => (h[y]?.cps ?? []).map((c) => [c[0], c[1]] as [number, number]);
    const c22 = cp("2022"), c24 = cp("2024");
    const a22 = at(c22, daysOut), a24 = at(c24, daysOut);
    const s26 = (series[s.st] ?? []).filter((p) => p[0] >= daysOut).sort((a, b) => b[0] - a[0]);
    if (!s26.some((p) => p[0] === daysOut)) s26.push([daysOut, s.total]);
    return { st: s.st, name: s.name, slug: s.slug, total: s.total, mail: s.mail, inperson: s.inperson, requested: s.requested, dem: s.dem, rep: s.rep, ind: s.ind, partyShare: s.partyShare,
      t22: h["2022"]?.turnout ?? null, t24: h["2024"]?.turnout ?? null, e22: h["2022"]?.early ?? null, e24: h["2024"]?.early ?? null,
      pace22: a22 ? s.total / a22 : null, pace24: a24 ? s.total / a24 : null, cps22: c22, cps24: c24, s26, fc: fc[s.st] ?? null,
      bench: (() => { const g = g0; if (!g || !g.expectedParty || !g.expectedPartyFull || !g.expectedEarly || !g.expectedTotal) return null;
        return { races: BR[s.st] ?? [], pres24: P24[s.st] ?? null, expEarly: g.expectedEarly, expTotal: g.expectedTotal, ballots: g.ballots, now: g.party, expNow: g.expectedParty, expFull: g.expectedPartyFull, gExp: g.expGroups, gFc: g.forecastElectorate }; })(),
      pm: g0 ? { d: g0.party.d, r: g0.party.r, o: g0.party.o, est: g0.estimatedShare ?? 0,
        xd: g0.expectedParty?.d ?? 0, xr: g0.expectedParty?.r ?? 0, delta: g0.delta ?? 0, shift: shifts[s.st] ?? null } : null };
  });
  const us26 = (series.US ?? []).filter((p) => p[0] >= daysOut).sort((a, b) => b[0] - a[0]);
  if (!us26.some((p) => p[0] === daysOut)) us26.push([daysOut, ev.total]);
  const pmRows = rows.filter((r) => r.pm);
  const B = pmRows.reduce((a, r) => a + r.total, 0);
  const pm = B ? { d: pmRows.reduce((a, r) => a + r.total * r.pm!.d, 0) / B, r: pmRows.reduce((a, r) => a + r.total * r.pm!.r, 0) / B, o: pmRows.reduce((a, r) => a + r.total * r.pm!.o, 0) / B,
    est: pmRows.reduce((a, r) => a + r.total * r.pm!.est, 0) / B, delta: pmRows.reduce((a, r) => a + r.total * r.pm!.delta, 0) / B } : null;
  return { pm, signalsDate: sig.date, snapshot: ev.snapshot, daysOut, total: ev.total, mail: ev.mail, inperson: ev.inperson, requested: ev.requested, dem: ev.dem, rep: ev.rep, ind: ev.ind, partyTotal: ev.partyTotal,
    t22: hist.us["2022"].turnout, e22: hist.us["2022"].early, t24: hist.us["2024"].turnout, e24: hist.us["2024"].early, rows, s26: us26, xo: crossover(), pres24: P24.US ?? null };
}
