// Server side inputs for the early vote console: today's count by state, each state's 2022 and 2024 early vote
// checkpoints for pace, the 2026 count on each saved snapshot day, and the state's marquee forecast page.
import fs from "node:fs";
import path from "node:path";
import { getModel } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import type { EarlyVote } from "./server";
import { STATE_NAME } from "./lib";

export type EvRow = {
  st: string; name: string; slug: string; total: number; mail: number; inperson: number; requested: number;
  dem: number; rep: number; ind: number; partyShare: number;
  t22: number | null; t24: number | null; e22: number | null; e24: number | null;
  pace22: number | null; pace24: number | null;
  cps22: [number, number][]; cps24: [number, number][]; s26: [number, number][];
  fc: { href: string; label: string } | null;
};
export type EvConsole = { snapshot: string; daysOut: number; total: number; mail: number; inperson: number; requested: number; dem: number; rep: number; ind: number; partyTotal: number;
  t22: number; e22: number; t24: number; e24: number; rows: EvRow[]; s26: [number, number][] };

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
  const rows: EvRow[] = ev.states.map((s) => {
    const h = hist.states[s.st] ?? {};
    const cp = (y: "2022" | "2024") => (h[y]?.cps ?? []).map((c) => [c[0], c[1]] as [number, number]);
    const c22 = cp("2022"), c24 = cp("2024");
    const a22 = at(c22, daysOut), a24 = at(c24, daysOut);
    const s26 = (series[s.st] ?? []).filter((p) => p[0] >= daysOut).sort((a, b) => b[0] - a[0]);
    if (!s26.some((p) => p[0] === daysOut)) s26.push([daysOut, s.total]);
    return { st: s.st, name: s.name, slug: s.slug, total: s.total, mail: s.mail, inperson: s.inperson, requested: s.requested, dem: s.dem, rep: s.rep, ind: s.ind, partyShare: s.partyShare,
      t22: h["2022"]?.turnout ?? null, t24: h["2024"]?.turnout ?? null, e22: h["2022"]?.early ?? null, e24: h["2024"]?.early ?? null,
      pace22: a22 ? s.total / a22 : null, pace24: a24 ? s.total / a24 : null, cps22: c22, cps24: c24, s26, fc: fc[s.st] ?? null };
  });
  const us26 = (series.US ?? []).filter((p) => p[0] >= daysOut).sort((a, b) => b[0] - a[0]);
  if (!us26.some((p) => p[0] === daysOut)) us26.push([daysOut, ev.total]);
  return { snapshot: ev.snapshot, daysOut, total: ev.total, mail: ev.mail, inperson: ev.inperson, requested: ev.requested, dem: ev.dem, rep: ev.rep, ind: ev.ind, partyTotal: ev.partyTotal,
    t22: hist.us["2022"].turnout, e22: hist.us["2022"].early, t24: hist.us["2024"].turnout, e24: hist.us["2024"].early, rows, s26: us26 };
}
