// app/polling/senatepolling/texas.ts
// Texas (TX) — 2026 Senate
// Source snippet provided by user (Emerson, Change Research, UH/TSU, Ragnar, UT Tyler)
//
// ✅ Default race is set to: Cornyn vs. Crockett

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "TX-SEN-2026-CORNYN-v-CROCKETT"
  pollster: string;
  sponsor?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number; // margin of error (percentage points), if known
  results: Record<string, number>; // candidate label -> %
  notes?: string;
};

export const STATE = {
  abbr: "TX",
  name: "Texas",
};

// ✅ Default race for leaderboard/map coloring
export const DEFAULT_RACE_ID = "TX-SEN-2026-CORNYN-v-CROCKETT";

export const RACES = [
  {
    raceId: "TX-SEN-2026-CORNYN-v-CROCKETT",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["John Cornyn (R)", "Jasmine Crockett (D)"],
    default: true,
  },
  {
    raceId: "TX-SEN-2026-PAXTON-v-CROCKETT",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Ken Paxton (R)", "Jasmine Crockett (D)"],
  },
  {
    raceId: "TX-SEN-2026-HUNT-v-CROCKETT",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Wesley Hunt (R)", "Jasmine Crockett (D)"],
  },
  {
    raceId: "TX-SEN-2026-CORNYN-v-TALARICO",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["John Cornyn (R)", "James Talarico (D)"],
  },
  {
    raceId: "TX-SEN-2026-PAXTON-v-TALARICO",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Ken Paxton (R)", "James Talarico (D)"],
  },
  {
    raceId: "TX-SEN-2026-HUNT-v-TALARICO",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Wesley Hunt (R)", "James Talarico (D)"],
  },
] as const;

/**
 * Polls keyed by state abbr so your Senate leaderboard can do:
 *   STATE_POLLS["TX"]
 *
 * IMPORTANT:
 * - Keep candidate labels exactly with "(R)/(D)" for map coloring.
 * - This file contains multiple matchups; the leaderboard should filter to DEFAULT_RACE_ID
 *   (recommended) OR accept that other matchups may influence totals if not filtered.
 *
 * If your Senate page currently doesn’t filter by raceId, add a simple filter:
 *   polls.filter(p => p.raceId === (DEFAULT_RACE_ID or chosen race))
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  TX: [
    // =========================
    // ✅ Default: Cornyn vs. Crockett
    // =========================
    {
      raceId: "TX-SEN-2026-CORNYN-v-CROCKETT",
      pollster: "Emerson College",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
      sampleSize: 1165,
      sampleType: "RV",
      moe: 2.8,
      results: {
        "John Cornyn (R)": 48,
        "Jasmine Crockett (D)": 43,
        Undecided: 9,
      },
      notes: "Other not reported in table; undecided 9%.",
    },
    {
      raceId: "TX-SEN-2026-CORNYN-v-CROCKETT",
      pollster: "Change Research",
      sponsor: "(D)",
      startDate: "2025-11-21",
      endDate: "2025-11-26",
      sampleSize: 1189,
      sampleType: "RV", // table shows (V); mapping to RV for your weighting
      moe: 3.1,
      results: {
        "John Cornyn (R)": 49,
        "Jasmine Crockett (D)": 41,
        Undecided: 10,
      },
      notes: "Sample type listed as (V) in table; mapped to RV. Other not reported; undecided 10%.",
    },
    {
      raceId: "TX-SEN-2026-CORNYN-v-CROCKETT",
      pollster: "University of Houston / Texas Southern University",
      startDate: "2025-09-19",
      endDate: "2025-10-01",
      sampleSize: 1650,
      sampleType: "RV",
      moe: 2.41,
      results: {
        "John Cornyn (R)": 50,
        "Jasmine Crockett (D)": 44,
        Undecided: 6,
      },
      notes: "Other not reported in table; undecided 6%.",
    },
  ],
};

/**
 * Optional helper if you later want per-race polls.
 */
export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.TX ?? []).filter((p) => p.raceId === "TX-SEN-2026-CORNYN-v-CROCKETT");
}
