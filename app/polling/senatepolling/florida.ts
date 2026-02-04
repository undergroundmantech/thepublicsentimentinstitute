// app/polling/senatepolling/florida.ts
// Florida (FL) — 2026 Senate (Special per your model)
// Matchup: Ashley Moody (R) vs Jennifer Jenkins (D)
// Source snippet provided by user (UNF Oct 15–25, 2025; Tyson Group Oct 1–3, 2025)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "FL-SEN-2026-MOODY-v-JENKINS"
  pollster: string;
  sponsor?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number;
  results: Record<string, number>;
  notes?: string;
};

export const STATE = {
  abbr: "FL",
  name: "Florida",
};

export const DEFAULT_RACE_ID = "FL-SEN-2026-MOODY-v-JENKINS";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Ashley Moody (R)", "Jennifer Jenkins (D)"],
  },
] as const;

/**
 * Notes:
 * - UNF line appears to include two result lines (likely two ballot tests/frames).
 *   We store them as separate Poll entries with the same field dates.
 * - UNF reports "Other" = 3% and Undecided = 10% on first line.
 *   Second line: 47–37 with Other=3 and Undecided=13.
 * - Tyson Group reports no "Other"; only Undecided 19.
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  FL: [
    // UNF (line 1)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "University of North Florida",
      startDate: "2025-10-15",
      endDate: "2025-10-25",
      sampleSize: 728,
      sampleType: "LV",
      moe: 4.3,
      results: {
        "Ashley Moody (R)": 49,
        "Jennifer Jenkins (D)": 38,
        Other: 3,
        Undecided: 10,
      },
      notes: "UNF table line 1 (49–38, Other 3, Und 10).",
    },

    // UNF (line 2)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "University of North Florida",
      startDate: "2025-10-15",
      endDate: "2025-10-25",
      sampleSize: 728,
      sampleType: "LV",
      moe: 4.3,
      results: {
        "Ashley Moody (R)": 47,
        "Jennifer Jenkins (D)": 37,
        Other: 3,
        Undecided: 13,
      },
      notes: "UNF table line 2 (47–37, Other 3, Und 13).",
    },

    // Tyson Group
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "The Tyson Group",
      sponsor: "(R)",
      startDate: "2025-10-01",
      endDate: "2025-10-03",
      sampleSize: 800,
      sampleType: "LV",
      results: {
        "Ashley Moody (R)": 44,
        "Jennifer Jenkins (D)": 37,
        Undecided: 19,
      },
      notes: "Other not reported in table; undecided 19%.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.FL ?? []).filter((p) => p.raceId === raceId);
}
