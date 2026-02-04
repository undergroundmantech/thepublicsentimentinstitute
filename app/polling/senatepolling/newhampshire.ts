// app/polling/senatepolling/newhampshire.ts
// New Hampshire (NH) — 2026 Senate
// Source snippet provided by user (UNH, NHJournal/Praecones Analytica, Guidant, Saint Anselm, co/efficient, 1892)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "NH-SEN-2026-PAPPAS-v-SUNUNU"
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
  abbr: "NH",
  name: "New Hampshire",
};

export const RACES = [
  {
    raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Chris Pappas (D)", "John E. Sununu (R)"],
  },
] as const;

/**
 * Polls keyed by state abbr so your Senate leaderboard can do:
 *   STATE_POLLS["NH"]
 * and compute the weighted leader.
 *
 * IMPORTANT: Keep candidate labels exactly as displayed, including "(R)/(D)",
 * so your map coloring logic works.
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  NH: [
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "University of New Hampshire",
      startDate: "2026-01-15",
      endDate: "2026-01-19",
      sampleSize: 2053,
      sampleType: "LV",
      moe: 2.1,
      results: {
        "Chris Pappas (D)": 50,
        "John E. Sununu (R)": 45,
        Other: 1,
        Undecided: 5,
      },
      notes: "Other listed as 1% in table; undecided 5%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "NHJournal/Praecones Analytica",
      startDate: "2025-12-26",
      endDate: "2025-12-28",
      sampleSize: 603,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Chris Pappas (D)": 42,
        "John E. Sununu (R)": 36,
        // Other not reported
        Undecided: 22,
      },
      notes: "Other not reported in table; undecided 22%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "Guidant Polling and Strategy",
      sponsor: "(R)",
      startDate: "2025-12-09",
      endDate: "2025-12-11",
      sampleSize: 600,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Chris Pappas (D)": 47,
        "John E. Sununu (R)": 44,
        // Other not reported
        Undecided: 9,
      },
      notes: "Other not reported in table; undecided 9%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "Saint Anselm College",
      startDate: "2025-11-18",
      endDate: "2025-11-19",
      sampleSize: 2212,
      sampleType: "RV",
      // MOE not listed in table
      results: {
        "Chris Pappas (D)": 44,
        "John E. Sununu (R)": 41,
        // Other not reported
        Undecided: 16,
      },
      notes: "MOE not listed; other not reported; undecided 16%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "co/efficient",
      sponsor: "(R)",
      startDate: "2025-10-09",
      endDate: "2025-10-13",
      sampleSize: 1034,
      sampleType: "LV",
      moe: 3.1,
      results: {
        "Chris Pappas (D)": 45,
        "John E. Sununu (R)": 42,
        // Other not reported
        Undecided: 12,
      },
      notes: "Other not reported in table; undecided 12%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "University of New Hampshire",
      startDate: "2025-09-17",
      endDate: "2025-09-23",
      sampleSize: 1235,
      sampleType: "LV",
      moe: 2.8,
      results: {
        "Chris Pappas (D)": 49,
        "John E. Sununu (R)": 43,
        Other: 1,
        Undecided: 7,
      },
      notes: "Other listed as 1% in table; undecided 7%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "co/efficient",
      sponsor: "(R)",
      startDate: "2025-09-10",
      endDate: "2025-09-12",
      sampleSize: 904,
      sampleType: "LV",
      moe: 3.3,
      results: {
        "Chris Pappas (D)": 46,
        "John E. Sununu (R)": 43,
        // Other not reported
        Undecided: 11,
      },
      notes: "Other not reported in table; undecided 11%.",
    },
    {
      raceId: "NH-SEN-2026-PAPPAS-v-SUNUNU",
      pollster: "1892 Polling",
      sponsor: "(R)",
      startDate: "2025-09-02",
      endDate: "2025-09-04",
      sampleSize: 500,
      sampleType: "LV",
      moe: 4.4,
      results: {
        "Chris Pappas (D)": 45,
        "John E. Sununu (R)": 43,
        // Other not reported
        Undecided: 12,
      },
      notes: "Other not reported in table; undecided 12%.",
    },
  ],
};

/**
 * Optional helper if you later want per-race summaries.
 */
export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.NH ?? []).filter((p) => p.raceId === raceId);
}
