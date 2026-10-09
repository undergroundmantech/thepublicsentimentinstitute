// Race capability flags — extends the registry with per-race feature flags
// that decide which Command Deck / Deep Dive sections mount for a given race.
// Authoritative spec: changeorders/CHANGE-ORDER-04-election-desk.md §1.
//
// Tier numbering is TPSI-canonical (5 high → 2 low). The reference concept
// doc (reference-deepdive.html) numbers tiers in the OPPOSITE direction —
// ignore its numbering entirely.

import type { RaceRule } from "@/app/lib/electoralModel";

export type RaceTier = 5 | 4 | 3 | 2; // 5=National, 4=Spotlight, 3=Forecast, 2=Featured

export const TIER_LABEL: Record<RaceTier, string> = {
  5: "National",
  4: "Spotlight",
  3: "Forecast",
  2: "Featured",
};

export interface RaceCapabilities {
  tier: RaceTier;
  forecast: boolean;    // in-house model exists (tier 3+)
  countyModel: boolean; // county-level projections (Spotlight only)
  modeData: boolean;    // Early/VBM/Election Day splits available for this state
  telemetry: boolean;   // flight-recorder history exists AND the public Live Timeline flag is on
  // CO-04 §1 lists a 3-value subset ("PLURALITY" | "MAJORITY_RUNOFF" | "THRESHOLD_RUNOFF").
  // Real races also use TOP_TWO / RANKED_CHOICE / THRESHOLD_35_* (see app/lib/electoralModel's
  // RaceRule), so this reuses that richer, already-live union instead of narrowing it.
  raceRule: RaceRule;
  spotlight: boolean; // marquee placement flag
}

/** Live Timeline stays flag-off until the Nov 3 general (§0.2). The flight
 *  recorder captures silently for tier 3+ regardless of this flag (§6) — this
 *  only gates the PUBLIC section mount. */
export const TIMELINE_PUBLIC_FLAG = false;

/** Tier-level defaults per the §1 capability matrix. Per-race overrides win. */
const TIER_DEFAULTS: Record<RaceTier, Omit<RaceCapabilities, "tier" | "raceRule">> = {
  5: { forecast: true, countyModel: false, modeData: false, telemetry: false, spotlight: true },
  4: { forecast: true, countyModel: true, modeData: true, telemetry: true, spotlight: true },
  3: { forecast: true, countyModel: false, modeData: false, telemetry: true, spotlight: false },
  2: { forecast: false, countyModel: false, modeData: false, telemetry: false, spotlight: false },
};

/** Per-race overrides, keyed by CivicAPI race id. */
export const RACE_CAPABILITY_OVERRIDES: Partial<Record<number, Partial<RaceCapabilities>>> = {
  83479: { tier: 4, raceRule: "RANKED_CHOICE" }, // DC Mayor Democratic Primary — RCV, spotlight example

  // Command Deck test beds (2026-07-19): both already-called, real CivicAPI
  // races used to exercise Spotlight-tier features end-to-end. Colorado is
  // the literal reference race from changeorders/spec-command-deck.html's
  // own mockup (Hickenlooper vs. Gonzales, 52.9%/47.1%).
  84322: { tier: 4, raceRule: "PLURALITY" },      // Colorado US Senate Democratic Primary
  84105: { tier: 4, raceRule: "PLURALITY" },      // South Carolina Governor Republican Runoff (2-candidate runoff round)

  // August 4, 2026 primary night coverage gate (CO-07). Only 84778 carries a
  // TPSI model — statewide (n=254), no county estimates — so it stays tier 3
  // Forecast, not tier 4 Spotlight; 84950/84951 are pinned to TOP_TWO for WA's
  // blanket primary. See _data/coverage.2026-08-04.ts for the full editorial
  // coverage list.
  84778: { tier: 3, raceRule: "PLURALITY" }, // Michigan US Senate Democratic Primary — statewide forecast, no county model
  84950: { tier: 2, raceRule: "TOP_TWO" },   // Washington US House 3 — top-two, no party primary
  84951: { tier: 2, raceRule: "TOP_TWO" },   // Washington US House 4 — top-two, no party primary

  // August 18, 2026 primary night. The Florida Governor Republican primary is
  // the marquee race and DOES have a county model, but it lives in its own
  // board (app/results/2026-08-18/FloridaBoard.tsx) rather than in RaceDesk —
  // countyModel here would mount a generic section with no Florida geometry
  // behind it. Tier 3 is therefore the honest flag set: statewide forecast,
  // recorder in scope, county work owned by the dedicated route.
  86349: { tier: 3, raceRule: "PLURALITY" }, // Florida Governor Republican Primary
  // Alaska runs a top-FOUR open primary. RaceRule has no such member and the
  // difference only affects how many candidates advance, not how the winner of
  // this round is determined, so PLURALITY is correct for the model; the board
  // carries the display-side `topFour` flag.
  86863: { tier: 2, raceRule: "PLURALITY" }, // Alaska US Senate Open Primary
  86862: { tier: 2, raceRule: "PLURALITY" }, // Alaska US House At-Large Open Primary

  // August 25, 2026 runoff night. Oklahoma Governor has a county model, but as
  // with Florida it lives in its own board (app/results/2026-08-25) rather than
  // RaceDesk, so tier 3 is again the honest flag set. Runoffs are two-candidate
  // rounds where the winner is simply whoever leads, hence PLURALITY and not
  // one of the MAJORITY_RUNOFF rules, which describe how a runoff is triggered.
  87529: { tier: 3, raceRule: "PLURALITY" }, // Oklahoma Governor Republican Runoff
  // South Carolina publishes a statewide win probability with no poll and no
  // county model behind it. Tier 3 without countyModel is exactly that claim.
  87534: { tier: 3, raceRule: "PLURALITY" }, // South Carolina US Senate Special Republican Runoff
  87530: { tier: 2, raceRule: "PLURALITY" }, // Oklahoma Insurance Commissioner Republican Runoff
  87531: { tier: 2, raceRule: "PLURALITY" }, // Oklahoma Commissioner of Labor Republican Runoff
  87532: { tier: 2, raceRule: "PLURALITY" }, // Oklahoma Supt. of Public Instruction Republican Runoff
  87533: { tier: 2, raceRule: "PLURALITY" }, // Oklahoma US Senate Democratic Runoff
  87536: { tier: 2, raceRule: "PLURALITY" }, // Georgia US House 13 Runoff
};

/** Resolves full capabilities for a race: explicit override > tier default > safe fallback (tier 2). */
export function getRaceCapabilities(
  raceId: number,
  opts?: { defaultTier?: RaceTier; raceRule?: RaceRule },
): RaceCapabilities {
  const override = RACE_CAPABILITY_OVERRIDES[raceId] ?? {};
  const tier = override.tier ?? opts?.defaultTier ?? 2;
  const base = TIER_DEFAULTS[tier];
  const telemetryFlag = override.telemetry ?? base.telemetry;
  return {
    tier,
    forecast: override.forecast ?? base.forecast,
    countyModel: override.countyModel ?? base.countyModel,
    modeData: override.modeData ?? base.modeData,
    // Public mount always requires the global flag, on top of the per-race flag.
    telemetry: TIMELINE_PUBLIC_FLAG && telemetryFlag,
    raceRule: override.raceRule ?? opts?.raceRule ?? "PLURALITY",
    spotlight: override.spotlight ?? base.spotlight,
  };
}

/** Whether the flight recorder should silently capture snapshots for this race (§6 scope guard: tiers 3+ only, never the local board). */
export function isRecorderInScope(tier: RaceTier): boolean {
  return tier >= 3;
}

/** Race ids the flight recorder (§6) should poll and capture: every registry
 *  override whose resolved tier is 3+. Only covers hand-registered races (the
 *  same small set Command Deck features are gated on) — the recorder has no
 *  season-wide crawl, matching the scope guard's "never the local board"
 *  intent. */
export function getRecorderRaceIds(): number[] {
  return Object.entries(RACE_CAPABILITY_OVERRIDES)
    .filter(([, override]) => isRecorderInScope((override?.tier ?? 2) as RaceTier))
    .map(([id]) => Number(id));
}
// --- Heuristic tier classification for hub-page ranking -------------------
//
// RACE_CAPABILITY_OVERRIDES above only covers a handful of hand-registered
// races (Command Deck / Deep Dive feature flags). The results hub has to
// rank ALL ~34k races that come back from CivicAPI on any given night, and
// almost none of them have an override entry, so it needs a contest-text
// heuristic instead: same RaceTier scale, driven by office keywords rather
// than a per-id lookup. Used to make Senate/Governor (and President) races
// take precedence over down-ballot/local contests when picking what's
// "featured" on the hub — NOT used for Command Deck capability flags.
const NATIONAL_RE = /\bpresident\b|u\.?s\.? senat/i;
const SPOTLIGHT_RE = /governor|lieutenant governor|u\.?s\.? house|for congress|congressional district/i;
const FORECAST_RE = /attorney general|secretary of state|state senate|supreme court|treasurer|controller|comptroller|auditor|superintendent|proposition|amendment|^question\b|^measure\b|referendum/i;

/** Ranks a race for hub-page precedence by office type, from contest/office
 *  text alone (no per-id registry needed). President/US Senate first,
 *  Governor/US House next, other statewide/forecast-grade races next,
 *  everything else (local, judicial, school board, ballot line items…)
 *  falls to the same tier-2 default as an unregistered Command Deck race. */
export function classifyRaceTier(contest?: string | null, office?: string | null): RaceTier {
  const c = String(contest || "");
  if (NATIONAL_RE.test(c)) return 5;
  if (SPOTLIGHT_RE.test(c)) return 4;
  if (FORECAST_RE.test(c)) return 3;
  return 2;
}
