// Server side builds for the 2028 pages, run at deploy so the browser only draws them.
import { buildDailyWeightedSeries, getCandidateList, getDateRange, getPollsterEntry, isExcludedPollster } from "@/app/_polling/lib/buildDailyModel";
import { PRIMARIES_2028, PRIMARY_PROFILE, type PrimaryDef } from "@/app/_polling/2028/matchups";
import type { Poll2028 } from "@/app/_polling/2028/data";

const CHART_FROM = "2024-11-06";
const r1 = (n: number) => Math.round(n * 10) / 10;
const norm = (s: string) => s.toLowerCase().replace(/\((r|d)\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();

export type PrimaryCand = { key: string; now: number | null; peak: number; polls: number; lastAsked: string; color: string };
export type PrimaryPoll = { pollster: string; start?: string; end: string; n: number; imputed: boolean; type: string; grade: string; gold: boolean; v: Record<string, number> };
export type PrimaryBuilt = {
  id: PrimaryDef["id"]; party: "R" | "D"; title: string; short: string;
  cands: PrimaryCand[];                 // every candidate named in any poll, current average first
  daily: { date: string; v: (number | null)[] }[];  // weekly points, aligned to cands
  polls: PrimaryPoll[];                 // newest first
  updated: string; first: string; pollsters: number;
};

const SHADES: Record<"R" | "D", string[]> = {
  R: ["#ff3b5c", "#ff8a5b", "#c2183f", "#ffb3c0", "#e0525e", "#d9798a", "#8f1d33", "#ff6f91", "#c24a2c", "#f2a07b", "#a8455a", "#ffd1d9", "#7a2030", "#e88f6a", "#b86b78", "#ff9fae"],
  D: ["#3d7bff", "#5fc4e8", "#1a3fb0", "#a6c2ff", "#6f6cf0", "#7d93c9", "#2a9bd6", "#9db8ff", "#3f56a8", "#86d3f0", "#5470d6", "#c9d8ff", "#24357a", "#6aa8d9", "#8a8fd6", "#b3e4f7"],
};

export function buildPrimary(def: PrimaryDef): PrimaryBuilt {
  const polls = def.polls.filter((p) => !isExcludedPollster(p.pollster));
  const gold = (name: string) => def.gold.some((g) => norm(name).includes(norm(g)));
  // the same gold standard lift as every other average: the sample counts goldMult squared times
  const weighted = polls.map((p) => ({ ...p, sampleSize: gold(p.pollster) ? p.sampleSize * 4 : p.sampleSize }));
  const keys = getCandidateList(weighted);
  const range = getDateRange(weighted);
  const rows = buildDailyWeightedSeries(weighted, keys, range.start, range.end, PRIMARY_PROFILE);
  const last = rows[rows.length - 1];
  const stat = (k: string) => {
    const asked = polls.filter((p) => Number.isFinite(Number(p.results[k])));
    const lastAsked = asked.map((p) => p.endDate).sort().pop() ?? "";
    const peak = Math.max(0, ...rows.map((r) => Number(r[k] ?? 0)));
    // a candidate no poll has asked about in the last 150 days has no current average
    const v = last ? Number(last[k] ?? 0) : 0;
    const recent = lastAsked && (new Date(range.end).getTime() - new Date(lastAsked).getTime()) / 864e5 <= 150;
    return { key: k, now: v > 0 ? r1(v) : recent ? 0 : null, peak: r1(peak), polls: asked.length, lastAsked };
  };
  const cands = keys.map(stat).sort((a, b) => (b.now ?? -1) - (a.now ?? -1) || b.peak - a.peak)
    .map((c, i) => ({ ...c, color: SHADES[def.party][i % SHADES[def.party].length] }));
  const order = cands.map((c) => c.key);
  // one point a week, plus the last day, is plenty for the chart and keeps the page small
  // the chart opens after the 2024 election; a handful of earlier polls asked a different field
  const daily = rows.filter((r, i) => String(r.date) >= CHART_FROM && (i % 7 === 0 || i === rows.length - 1))
    .map((r) => ({ date: String(r.date), v: order.map((k) => { const x = Number(r[k] ?? 0); return x > 0 ? r1(x) : null; }) }));
  const out: PrimaryPoll[] = [...polls].sort((a, b) => b.endDate.localeCompare(a.endDate)).map((p: Poll2028) => ({
    pollster: p.pollster.replace(/\*\*/g, "").trim(), start: p.startDate, end: p.endDate, n: p.sampleSize, imputed: !!p.sampleImputed,
    type: p.sampleType, grade: getPollsterEntry(p.pollster).grade, gold: gold(p.pollster), v: p.results as Record<string, number>,
  }));
  return {
    id: def.id, party: def.party, title: def.title, short: def.short, cands, daily, polls: out,
    updated: range.end, first: range.start, pollsters: new Set(out.map((p) => p.pollster)).size,
  };
}

const cache = new Map<string, PrimaryBuilt>();
export function primaryBuilt(id: PrimaryDef["id"]): PrimaryBuilt {
  let b = cache.get(id);
  if (!b) { b = buildPrimary(PRIMARIES_2028.find((p) => p.id === id)!); cache.set(id, b); }
  return b;
}
