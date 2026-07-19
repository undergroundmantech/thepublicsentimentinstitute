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

/**
 * Per-race overrides, keyed by CivicAPI race id.
 *
 * NOTE (2026-07-19): the registry has no August 2026 entries yet — CivicAPI's
 * race-search endpoint returns zero races for the 2026-08-01..2026-08-31
 * window as of this writing (it appears to publish races only ~2-3 weeks
 * out). Real August primary tiers/flags must be added here once CivicAPI
 * publishes those race ids; do not fabricate ids. The one entry below is a
 * real, already-registered race included as a worked example of the
 * override shape.
 */
export const RACE_CAPABILITY_OVERRIDES: Partial<Record<number, Partial<RaceCapabilities>>> = {
  83479: { tier: 4, raceRule: "RANKED_CHOICE" }, // DC Mayor Democratic Primary — RCV, spotlight example
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
