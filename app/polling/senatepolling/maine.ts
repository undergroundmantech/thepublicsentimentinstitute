// app/polling/senatepolling/maine.ts
// Maine (ME) — 2026 Senate
// Source snippet provided by user (Pan Atlantic Research, MPRC, Zenith Research)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "ME-SEN-2026-COLLINS-v-MILLS"
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
  abbr: "ME",
  name: "Maine",
};

export const RACES = [
  {
    raceId: "ME-SEN-2026-COLLINS-v-MILLS",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Susan Collins (R)", "Janet Mills (D)"],
  },
  {
    raceId: "ME-SEN-2026-COLLINS-v-PLATNER",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Susan Collins (R)", "Graham Platner (D)"],
  },
] as const;

/**
 * Polls keyed by state abbr so your Senate leaderboard can do:
 *   STATE_POLLS["ME"]
 * and compute the weighted leader.
 *
 * IMPORTANT: We keep candidate labels exactly as displayed, including "(R)/(D)"
 * so your map coloring logic works.
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  ME: [
    // =========================
    // Collins vs. Mills
    // =========================
    {
      raceId: "ME-SEN-2026-COLLINS-v-MILLS",
      pollster: "Pan Atlantic Research",
      startDate: "2025-11-29",
      endDate: "2025-12-07",
      sampleSize: 820,
      sampleType: "LV",
      moe: 3.7,
      results: {
        "Susan Collins (R)": 43,
        "Janet Mills (D)": 43,
        // (Other not reported)
        Undecided: 14,
      },
      notes: "Other not reported in table; undecided 14%.",
    },
    {
      raceId: "ME-SEN-2026-COLLINS-v-MILLS",
      pollster: "Maine People's Resource Center",
      startDate: "2025-10-26",
      endDate: "2025-10-29",
      sampleSize: 783,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Susan Collins (R)": 46,
        "Janet Mills (D)": 42,
        // (Other not reported)
        Undecided: 14,
      },
      notes: "Other not reported in table; undecided 14%.",
    },
    {
      raceId: "ME-SEN-2026-COLLINS-v-MILLS",
      pollster: "Zenith Research",
      sponsor: "(D)",
      startDate: "2025-10-07",
      endDate: "2025-10-10",
      sampleSize: 501,
      sampleType: "LV",
      moe: 4.4,
      results: {
        "Susan Collins (R)": 37,
        "Janet Mills (D)": 42,
        Other: 10,
        Undecided: 12,
      },
      notes: "Other listed as 10% in table.",
    },

    // =========================
    // Collins vs. Platner
    // =========================
    {
      raceId: "ME-SEN-2026-COLLINS-v-PLATNER",
      pollster: "Pan Atlantic Research",
      startDate: "2025-11-29",
      endDate: "2025-12-07",
      sampleSize: 820,
      sampleType: "LV",
      moe: 3.7,
      results: {
        "Susan Collins (R)": 42,
        "Graham Platner (D)": 43,
        // (Other not reported)
        Undecided: 15,
      },
      notes: "Other not reported in table; undecided 15%.",
    },
    {
      raceId: "ME-SEN-2026-COLLINS-v-PLATNER",
      pollster: "Maine People's Resource Center",
      startDate: "2025-10-26",
      endDate: "2025-10-29",
      sampleSize: 783,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Susan Collins (R)": 41,
        "Graham Platner (D)": 45,
        // (Other not reported)
        Undecided: 14,
      },
      notes: "Other not reported in table; undecided 14%.",
    },
    {
      raceId: "ME-SEN-2026-COLLINS-v-PLATNER",
      pollster: "Zenith Research",
      sponsor: "(D)",
      startDate: "2025-10-07",
      endDate: "2025-10-10",
      sampleSize: 501,
      sampleType: "LV",
      moe: 4.4,
      results: {
        "Susan Collins (R)": 38,
        "Graham Platner (D)": 38,
        Other: 10,
        Undecided: 15,
      },
      notes: "Other listed as 10% in table.",
    },
  ],
};

/**
 * Optional helper if you later want per-race summaries.
 */
export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.ME ?? []).filter((p) => p.raceId === raceId);
}
