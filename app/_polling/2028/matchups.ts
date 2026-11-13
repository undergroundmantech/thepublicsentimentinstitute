// The 2028 averages: every general election matchup with at least two national polls becomes a two way average on the
// same engine as the generic ballot, and the two primaries are multi candidate averages on the same weights.
import type { AggregateDef } from "@/app/_polling/lib/aggregates";
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
