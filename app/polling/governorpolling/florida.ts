// app/polling/governorpolling/florida.ts
// Florida (FL) — 2026 Governor (Open seat; DeSantis term-limited in your list)
// Matchup: Byron Donalds (R) vs David Jolly (D)
// Source snippet provided by user (UNF; Targoz; Bendixen & Amandi; AIF Center; Victory Insights)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "FL-GOV-2026-DONALDS-v-JOLLY"
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

export const DEFAULT_RACE_ID = "FL-GOV-2026-DONALDS-v-JOLLY";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Byron Donalds (R)", "David Jolly (D)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  FL: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "University of North Florida",
      startDate: "2025-10-15",
      endDate: "2025-10-25",
      sampleSize: 728,
      sampleType: "LV",
      moe: 4.3,
      results: {
        "Byron Donalds (R)": 45,
        "David Jolly (D)": 34,
        Other: 3,
        Undecided: 18,
      },
      notes: "UNF: Donalds 45, Jolly 34, Other 3, Und 18.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Targoz Market Research",
      sponsor: "(D)",
      startDate: "2025-09-16",
      endDate: "2025-09-18",
      sampleSize: 1118,
      sampleType: "RV",
      moe: 2.8,
      results: {
        "Byron Donalds (R)": 36,
        "David Jolly (D)": 32,
        Other: 4,
        Undecided: 28,
      },
      notes: "Targoz: Donalds 36, Jolly 32, Other 4, Und 28.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Bendixen & Amandi International",
      sponsor: "(D)",
      startDate: "2025-09-07",
      endDate: "2025-09-09",
      sampleSize: 631,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Byron Donalds (R)": 40,
        "David Jolly (D)": 41,
        Undecided: 19,
      },
      notes: "Bendixen & Amandi: no Other reported; Und 19.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "AIF Center",
      sponsor: "(R)",
      startDate: "2025-08-25",
      endDate: "2025-08-27",
      sampleSize: 800,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Byron Donalds (R)": 49,
        "David Jolly (D)": 41,
        Undecided: 11,
      },
      notes: "AIF Center: no Other reported; Und 11.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Victory Insights",
      sponsor: "(R)",
      startDate: "2025-06-07",
      endDate: "2025-06-10",
      sampleSize: 600,
      sampleType: "LV",
      moe: 2.8,
      results: {
        "Byron Donalds (R)": 37,
        "David Jolly (D)": 31,
        Undecided: 32,
      },
      notes: "Victory Insights: no Other reported; Und 32.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.FL ?? []).filter((p) => p.raceId === raceId);
}
