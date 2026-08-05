// August 4, 2026 coverage registry — the editorial gate for primary night.
//
// WHY THIS FILE EXISTS
// ResultsDesk.tsx:55 currently defines coverage as `tierOf(d) >= 3`, where
// tierOf is classifyRaceTier() — a regex over contest NAMES run against every
// race CivicAPI returns. Every US Senate race in the country matches
// NATIONAL_RE → 5. Every governor and US House race matches SPOTLIGHT_RE → 4.
// Every ballot measure matches FORECAST_RE → 3. So "covered" currently means
// "the contest name sounds important," which on a five-state primary night is
// thousands of races.
//
// This file replaces that test with an explicit list. classifyRaceTier keeps
// its job as a SORT fallback for ordering; it stops deciding membership.
//
// TIER vs BOARD — two different questions, per CO-04 §1.
//   tier  = what TPSI can DO for the race (capability). Numeric, TPSI-canonical
//           5=National 4=Spotlight 3=Forecast 2=Featured, matching
//           _data/raceCapabilities.ts. Feeds getRaceCapabilities().
//   board = WHERE the race sits on the page (placement). Independent of tier.
//
// Only 84778 carries a TPSI model. It is tier 3 Forecast, NOT tier 4 Spotlight:
// the model is statewide (n=254) and produces no county estimates, so
// countyModel must stay false. Tier 4 would switch it on. This maps to Level 2
// "Statewide forecast" in the five-level methodology prototype.
// Everything else is tier 2 (CivicAPI passthrough, forecast: false), which is
// Level 4 "Results only", separated purely by board placement.
//
// All 24 ids verified against CivicAPI 2026-08-04. MI US Senate (R) is
// deliberately absent: Rogers is unopposed and CivicAPI created no race.

import type { RaceRule } from "@/app/lib/electoralModel";
import type { RaceTier } from "./raceCapabilities";

/** Placement on the board. Orthogonal to capability tier. */
export type BoardSlot = "SPOTLIGHT" | "FEATURED" | "LIST";

export interface CoverageEntry {
  id: number;
  state: string;
  /** Full display title. */
  title: string;
  /** Plain-language explainer. Required on ballot measures. */
  dek?: string;
  tier: RaceTier;
  board: BoardSlot;
  raceRule: RaceRule;
  statewide: boolean;
  /** ISO with offset. Statewide entries in split-TZ states use the LAST close. */
  pollsCloseIso: string;
  /** True when pollsCloseIso is the last close in a split-timezone state. */
  finalClose: boolean;
  /** Editorial note / blurb. Board-visible on SPOTLIGHT and FEATURED. */
  note?: string;
  /** TPSI forecast prior (name → projected share). Spotlight race only —
   *  feeds both the ResultsDesk spotlight card and RaceDesk's needle model,
   *  so the two pages assert the same number. */
  pollAvg?: Record<string, number>;
  /** Fixed turnout call (total ballots), overriding the engine's own AUC
   *  turnout estimate. Spotlight race only — same reasoning as pollAvg. */
  projectedTurnout?: number;
}

const MI_DISTRICT = "2026-08-04T20:00:00-04:00"; // 8:00 PM ET
const MI_STATE    = "2026-08-04T21:00:00-04:00"; // 9:00 PM ET — UP is Central
const KS_STATE    = "2026-08-04T21:00:00-04:00"; // 9:00 PM ET — 4 western cos. Mountain
const MO          = "2026-08-04T20:00:00-04:00"; // 8:00 PM ET
const VA          = "2026-08-04T19:00:00-04:00"; // 7:00 PM ET — first close of the night
const WA          = "2026-08-04T23:00:00-04:00"; // 11:00 PM ET

export const COVERAGE_2026_08_04: CoverageEntry[] = [
  /* ───────────────────────────── MICHIGAN ───────────────────────────── */
  {
    id: 84778, state: "MI",
    title: "Michigan U.S. Senate · Democratic Primary",
    tier: 3, board: "SPOTLIGHT", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: MI_STATE, finalClose: true,
    note:
      "Open seat; Gary Peters is retiring. Rep. Haley Stevens against former " +
      "Detroit health director Abdul El-Sayed, a test of the party's " +
      "ideological direction. Mallory McMorrow suspended her campaign in July " +
      "but remains on the ballot. Winner faces Mike Rogers in November.",
    // DSMeridian Model 10/12, July 25–29, n=762: El-Sayed +9.5 over Stevens.
    // McMorrow stays on the ballot after withdrawing — a residual trace, not a contender.
    pollAvg: { "El-Sayed": 54.5, "Stevens": 45.0, "McMorrow": 0.5 },
    projectedTurnout: 1_160_000,
  },
  {
    id: 84668, state: "MI",
    title: "Michigan Governor · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: MI_STATE, finalClose: true,
    note: "Open seat; Whitmer is term-limited. Secretary of State Jocelyn Benson against Genesee County Sheriff Chris Swanson.",
  },
  {
    id: 84669, state: "MI",
    title: "Michigan Governor · Republican Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: MI_STATE, finalClose: true,
    note: "Rep. John James, Trump-endorsed, against self-funding businessman Perry Johnson. Aric Nesbitt and Mike Cox withdrew and endorsed James but remain on the ballot.",
  },
  {
    id: 84771, state: "MI",
    title: "Michigan U.S. House 13 · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false,
    note: "Rep. Shri Thanedar seeks a third term in this Detroit seat against a progressive challenge from state Rep. Donavan McKinney.",
  },
  {
    id: 84776, state: "MI",
    title: "Michigan U.S. House 7 · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false,
    note: "One of the closest general-election House races in the country. Progressive organizer William Lawrence may benefit from Bridget Brink and Matt Maasdam splitting the moderate lane.",
  },
  { id: 84769, state: "MI", title: "Michigan U.S. House 11 · Democratic Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false },
  { id: 84767, state: "MI", title: "Michigan U.S. House 10 · Democratic Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false },
  { id: 84768, state: "MI", title: "Michigan U.S. House 10 · Republican Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false },
  { id: 84777, state: "MI", title: "Michigan U.S. House 8 · Republican Primary",  tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MI_DISTRICT, finalClose: false },

  /* ────────────────────────────── KANSAS ────────────────────────────── */
  {
    id: 84971, state: "KS",
    title: "Kansas Constitutional Amendment · Supreme Court Selection",
    dek: "Would replace merit-based appointment of Kansas Supreme Court justices with direct popular election.",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: KS_STATE, finalClose: true,
    note: "Changes who selects the court that would hear the state's ongoing abortion-rights litigation.",
  },
  {
    id: 84781, state: "KS",
    title: "Kansas Governor · Republican Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: KS_STATE, finalClose: true,
    note: "Open seat; Laura Kelly is term-limited. Six candidates. State Senate President Ty Masterson holds Trump's and Sen. Marshall's endorsements. One of the GOP's best gubernatorial pickup chances.",
  },
  {
    id: 84780, state: "KS",
    title: "Kansas Governor · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: KS_STATE, finalClose: true,
    note: "State Sen. Cindy Holscher led the only public poll, but state Sen. Ethan Corson has outraised her and carries Kelly's endorsement.",
  },
  { id: 84840, state: "KS", title: "Kansas U.S. Senate · Democratic Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: true, pollsCloseIso: KS_STATE, finalClose: true },

  /* ───────────────────────────── MISSOURI ───────────────────────────── */
  {
    id: 84574, state: "MO",
    title: "Missouri Amendment 4 · Initiative Petition Threshold",
    dek: "Would require citizen-initiated constitutional amendments to win a majority in each of Missouri's eight congressional districts, not just statewide. Legislature-referred amendments keep the statewide-only standard.",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: true, pollsCloseIso: MO, finalClose: false,
    note: "One of four amendments on Missouri's August ballot — label it Amendment 4 explicitly. Also carries foreign-spending and petition-fraud provisions.",
  },
  {
    id: 84648, state: "MO",
    title: "Missouri U.S. House 1 · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: MO, finalClose: false,
    note: "Rematch. Rep. Wesley Bell ousted Cori Bush 51-46 in the 2024 primary and she is back. The lone Democratic seat left in Missouri after redistricting.",
  },
  {
    id: 84656, state: "MO",
    title: "Missouri U.S. House 5 · Republican Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: MO, finalClose: false,
    note: "The Kansas City seat shifted roughly 40 points right in redistricting. Six Republicans competing to flip it; state Sen. Rick Brattin and businessman Taylor Burks lead in money and endorsements.",
  },
  { id: 84658, state: "MO", title: "Missouri U.S. House 6 · Republican Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MO, finalClose: false },
  { id: 84650, state: "MO", title: "Missouri U.S. House 2 · Democratic Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: MO, finalClose: false },

  /* ───────────────────────────── VIRGINIA ───────────────────────────── */
  {
    id: 84964, state: "VA",
    title: "Virginia U.S. House 2 · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: VA, finalClose: false,
    note: "Former Rep. Elaine Luria seeks a rematch against Rep. Jen Kiggans, who beat her in 2022. One of Virginia's two most competitive general elections. First results of the night.",
  },
  {
    id: 84962, state: "VA",
    title: "Virginia U.S. House 1 · Democratic Primary",
    tier: 2, board: "FEATURED", raceRule: "PLURALITY",
    statewide: false, pollsCloseIso: VA, finalClose: false,
    note: "Rep. Rob Wittman faces his first serious challenge in a district trending away from him. Henrico County Commonwealth's Attorney Shannon Taylor has outraised the field and holds the governor's and both senators' endorsements.",
  },
  { id: 84965, state: "VA", title: "Virginia U.S. House 5 · Democratic Primary", tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: false, pollsCloseIso: VA, finalClose: false },
  { id: 84970, state: "VA", title: "Virginia U.S. Senate · Republican Primary",  tier: 2, board: "LIST", raceRule: "PLURALITY", statewide: true,  pollsCloseIso: VA, finalClose: false },

  /* ──────────────────────────── WASHINGTON ──────────────────────────── */
  {
    id: 84950, state: "WA",
    title: "Washington U.S. House 3 · Top-Two Primary",
    dek: "All candidates appear on one ballot regardless of party. The top two finishers advance to November.",
    tier: 2, board: "FEATURED", raceRule: "TOP_TWO",
    statewide: false, pollsCloseIso: WA, finalClose: false,
    note: "Washington's only competitive general-election district. Rep. Marie Gluesenkamp Perez in a nine-candidate field; Senate Minority Leader John Braun the likely second advancer. Joe Kent, her opponent the last two cycles, is not running.",
  },
  {
    id: 84951, state: "WA",
    title: "Washington U.S. House 4 · Top-Two Primary",
    dek: "All candidates appear on one ballot regardless of party. The top two finishers advance to November.",
    tier: 2, board: "LIST", raceRule: "TOP_TWO",
    statewide: false, pollsCloseIso: WA, finalClose: false,
  },
];

/* ───────────────────────────── HELPERS ───────────────────────────── */

const BY_ID = new Map(COVERAGE_2026_08_04.map((e) => [e.id, e]));

/** Membership test. This replaces `tierOf(d) >= 3` in ResultsDesk.tsx:55. */
export function isCoveredId(id: number): boolean {
  return BY_ID.has(id);
}

export function getCoverage(id: number): CoverageEntry | undefined {
  return BY_ID.get(id);
}

export function coverageBoard(slot: BoardSlot): CoverageEntry[] {
  return COVERAGE_2026_08_04.filter((e) => e.board === slot);
}

/** Exactly one spotlight tonight. */
export function getSpotlightEntry(): CoverageEntry | undefined {
  return COVERAGE_2026_08_04.find((e) => e.board === "SPOTLIGHT");
}

/**
 * Poll-close label. The underlying times are correct as-is; only the wording
 * needs to disambiguate. Michigan House at 8:00 and Michigan statewide at 9:00
 * is right (the UP is Central) but reads as a data error without "Final".
 */
export function pollsCloseLabel(e: CoverageEntry): string {
  const t = new Date(e.pollsCloseIso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
  return `${e.finalClose ? "Final polls close" : "Polls close"} ${t} ET`;
}

/** Board order — earliest close first, so the page reads as the night unfolds. */
export const STATE_ORDER = ["VA", "MI", "MO", "KS", "WA"] as const;

/**
 * Capability overrides to MERGE into RACE_CAPABILITY_OVERRIDES in
 * _data/raceCapabilities.ts. Only 84778 gets a non-default tier; the rest
 * resolve to tier 2 (forecast: false) via the existing safe fallback, which
 * is exactly right — we have no model for them.
 */
export const AUGUST_CAPABILITY_OVERRIDES = {
  84778: { tier: 3 as RaceTier, raceRule: "PLURALITY" as RaceRule },
  84950: { tier: 2 as RaceTier, raceRule: "TOP_TWO" as RaceRule },
  84951: { tier: 2 as RaceTier, raceRule: "TOP_TWO" as RaceRule },
};
