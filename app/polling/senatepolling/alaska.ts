// app/polling/senatepolling/alaska.ts
// Alaska (AK) — 2026 Senate
// Matchup: Dan Sullivan (R) vs. Mary Peltola (D)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "AK-SEN-2026-SULLIVAN-v-PELTOLA"
  pollster: string;
  sponsor?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number; // +/- %
  results: Record<string, number>;
  notes?: string;
};

export const STATE = {
  abbr: "AK",
  name: "Alaska",
};

export const DEFAULT_RACE_ID = "AK-SEN-2026-SULLIVAN-v-PELTOLA";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Dan Sullivan (R)", "Mary Peltola (D)"],
  },
] as const;

/**
 * Notes:
 * - PPP shows sample type "V" (voters). We map unknown -> "RV" by default.
 * - Where "Other" is not reported, we only include Undecided.
 * - Keep candidate labels exactly with (R)/(D) for your map coloring logic.
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  AK: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Public Policy Polling",
      sponsor: "(D)",
      startDate: "2026-01-16",
      endDate: "2026-01-17",
      sampleSize: 611,
      sampleType: "RV",
      results: {
        "Dan Sullivan (R)": 47,
        "Mary Peltola (D)": 49,
        Undecided: 4,
      },
      notes: 'Sample type listed as "V" in source; stored as RV.',
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Alaska Survey Research",
      startDate: "2026-01-08",
      endDate: "2026-01-11",
      sampleSize: 1988,
      sampleType: "LV",
      moe: 2.2,
      results: {
        "Dan Sullivan (R)": 46,
        "Mary Peltola (D)": 48,
        Undecided: 6,
      },
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Data for Progress",
      sponsor: "(D)",
      startDate: "2025-10-17",
      endDate: "2025-10-23",
      sampleSize: 823,
      sampleType: "LV",
      moe: 3.0,
      results: {
        "Dan Sullivan (R)": 45,
        "Mary Peltola (D)": 46,
        Other: 5,
        Undecided: 4,
      },
      notes: "Other listed as 5% in source.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Alaska Survey Research",
      startDate: "2025-10-10",
      endDate: "2025-10-15",
      sampleSize: 1708,
      sampleType: "LV",
      results: {
        "Dan Sullivan (R)": 46,
        "Mary Peltola (D)": 48,
        Undecided: 6,
      },
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Alaska Survey Research",
      startDate: "2025-07-29",
      endDate: "2025-08-01",
      sampleSize: 1623,
      sampleType: "LV",
      moe: 2.5,
      results: {
        "Dan Sullivan (R)": 47,
        "Mary Peltola (D)": 42,
        Undecided: 11,
      },
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Data for Progress",
      sponsor: "(D)",
      startDate: "2025-07-21",
      endDate: "2025-07-27",
      sampleSize: 678,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Dan Sullivan (R)": 46,
        "Mary Peltola (D)": 45,
        Other: 5,
        Undecided: 4,
      },
      notes: "Other listed as 5% in source.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Alaska Survey Research",
      startDate: "2023-04-21",
      endDate: "2023-04-25",
      sampleSize: 1261,
      sampleType: "LV",
      results: {
        "Dan Sullivan (R)": 41,
        "Mary Peltola (D)": 44,
        Undecided: 15,
      },
      notes: "Older poll included for historical context.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.AK ?? []).filter((p) => p.raceId === raceId);
}
