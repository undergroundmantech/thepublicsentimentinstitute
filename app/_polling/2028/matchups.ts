// The 2028 averages: every general election matchup with at least two national polls becomes a two way average on the
// same engine as the generic ballot, and the two primaries are multi candidate averages on the same weights.
import type { AggregateDef, MultiAggregateDef } from "@/app/_polling/lib/aggregates";
import type { ModelOptions } from "@/app/_polling/lib/buildDailyModel";
import { GOLD_2026 } from "@/app/_polling/lib/ratings2026";
import { D_PRIMARY_2028, GENERAL_2028, R_PRIMARY_2028, type Poll2028 } from "./data";

export const CAT_2028 = "2028";
const RED = "var(--gop)", BLUE = "var(--dem)", PURPLE = "#7a4bb0";
const REPS = ["Vance", "Rubio", "Trump Jr.", "DeSantis"];
const IND = /^(Smith|Rodgers|Cuban)$/;

export const slug = (s: string) => s.toLowerCase().replace(/\./g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export type Matchup2028 = { id: string; slug: string; rep: string; dem: string; polls: Poll2028[] };

/** Every pairing in the poll list, with its polls. A poll that asks three names counts toward the two way pairing. */
function pairings(): Matchup2028[] {
  const by = new Map<string, Matchup2028>();
  for (const p of GENERAL_2028) {
    const names = Object.keys(p.results);
    const rep = names.find((n) => REPS.includes(n));
    // the Democrat, or the other name of a two way poll; an independent in a three way poll is shown on the poll only
    const dem = names.find((n) => n !== rep && !IND.test(n)) ?? (names.length === 2 ? names.find((n) => n !== rep) : undefined);
    if (!rep || !dem) continue;
    const id = `2028-${slug(rep)}-${slug(dem)}`;
    const m = by.get(id) ?? { id, slug: `${slug(rep)}-vs-${slug(dem)}`, rep, dem, polls: [] };
    m.polls.push(p);
    by.set(id, m);
  }
  return [...by.values()].sort((a, b) => b.polls.length - a.polls.length || a.id.localeCompare(b.id));
}

export const PAIRINGS_2028 = pairings();
/** Matchups with an average: two or more national polls. */
export const MATCHUPS_2028 = PAIRINGS_2028.filter((m) => m.polls.length >= 2);
/** Matchups with a single poll, listed on the hub without an average. */
export const SINGLES_2028 = PAIRINGS_2028.filter((m) => m.polls.length < 2);

export const GENERAL_2028_AGGS: AggregateDef[] = MATCHUPS_2028.map((m) => ({
  id: m.id,
  label: `${m.rep} vs. ${m.dem}`,
  category: CAT_2028,
  title: `2028 · ${m.rep} vs. ${m.dem}`,
  subtitle: "A daily weighted average of every national poll of this 2028 matchup, on the On Point model: recency, sample size, voter screen and pollster grade.",
  unit: "%",
  keyA: m.rep, keyB: m.dem,
  seriesA: { label: m.rep, color: RED, party: "Republican" },
  seriesB: { label: m.dem, color: IND.test(m.dem) ? PURPLE : BLUE, party: IND.test(m.dem) ? "Independent" : "Democrat" },
  marginLabel: "Margin",
  fmtMargin: (n: number) => (Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${m.rep} +${n.toFixed(1)}` : `${m.dem} +${Math.abs(n).toFixed(1)}`),
  polls: m.polls,
  gold: GOLD_2026,
  goldMult: 2,
}));

/* ------------------------------- primaries ------------------------------- */

/** The primaries run on the election weights with one change: a 14 name field leaves a large share of every poll on
 *  candidates a pollster did not list, so the uncommitted discount is the tracker strength, 0.6, not 3. At 3 every
 *  primary poll would hit the floor and the discount would stop telling polls apart. */
export const PRIMARY_PROFILE: ModelOptions = { maxPollShare: 0.15, undecidedPenaltyK: 0.6 };

export type PrimaryDef = { id: "republican-primary" | "democratic-primary"; party: "R" | "D"; title: string; short: string; polls: Poll2028[]; gold: string[] };
export const PRIMARIES_2028: PrimaryDef[] = [
  { id: "republican-primary", party: "R", title: "2028 Republican presidential primary", short: "Republican primary", polls: R_PRIMARY_2028, gold: GOLD_2026 },
  { id: "democratic-primary", party: "D", title: "2028 Democratic presidential primary", short: "Democratic primary", polls: D_PRIMARY_2028, gold: GOLD_2026 },
];
export const hrefOf2028 = (s: string) => `/polls/2028/${s}`;

/* ----------- the primaries as multi candidate averages on the polling averages page ----------- */
const SHADES: Record<"R" | "D", string[]> = {
  R: ["#ff3b5c", "#ff8a5b", "#c2183f", "#ffb3c0", "#e0525e", "#d9798a", "#8f1d33", "#ff6f91", "#c24a2c", "#f2a07b", "#a8455a", "#ffd1d9", "#7a2030", "#e88f6a", "#b86b78", "#ff9fae"],
  D: ["#3d7bff", "#5fc4e8", "#1a3fb0", "#a6c2ff", "#6f6cf0", "#7d93c9", "#2a9bd6", "#9db8ff", "#3f56a8", "#86d3f0", "#5470d6", "#c9d8ff", "#24357a", "#6aa8d9", "#8a8fd6", "#b3e4f7"],
};
export const PRIMARY_IDS: Record<PrimaryDef["id"], string> = { "republican-primary": "2028-gop-primary", "democratic-primary": "2028-dem-primary" };
/** Candidates in the order of their recent polling: the mean of the polls in the last 150 days that asked them, then all polls. */
function ordered(polls: Poll2028[]): string[] {
  const end = polls.reduce((m, p) => (p.endDate > m ? p.endDate : m), "");
  const cut = new Date(new Date(end).getTime() - 150 * 864e5).toISOString().slice(0, 10);
  const stat = new Map<string, { r: number[]; a: number[] }>();
  for (const p of polls) for (const [k, v] of Object.entries(p.results)) {
    if (k === "Undecided" || k === "Other" || !Number.isFinite(v)) continue;
    const s = stat.get(k) ?? { r: [], a: [] }; s.a.push(v); if (p.endDate >= cut) s.r.push(v); stat.set(k, s);
  }
  const mean = (x: number[]) => (x.length ? x.reduce((a, b) => a + b, 0) / x.length : -1);
  return [...stat.entries()].sort((a, b) => mean(b[1].r) - mean(a[1].r) || mean(b[1].a) - mean(a[1].a)).map(([k]) => k);
}
export const PRIMARY_2028_MULTI: MultiAggregateDef[] = PRIMARIES_2028.map((p) => ({
  id: PRIMARY_IDS[p.id],
  label: p.short,
  group: "2028 General",
  title: p.title,
  subtitle: "Every candidate any national poll has named, on the On Point model: recency, sample size, voter screen and pollster grade.",
  unit: "%",
  series: ordered(p.polls).map((k, i) => ({ key: k, label: k, color: SHADES[p.party][i % SHADES[p.party].length] })),
  polls: p.polls,
  gold: GOLD_2026,
  goldMult: 2,
  opts: PRIMARY_PROFILE,
  from: "2024-11-06",
}));
