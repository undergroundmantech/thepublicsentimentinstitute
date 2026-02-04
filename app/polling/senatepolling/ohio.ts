// app/polling/senatepolling/ohio.ts
// Ohio (OH) — 2026 Senate (Special per your map list)
// Matchup: Jon Husted (R) vs. Sherrod Brown (D)
// Source snippet provided by user

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "OH-SEN-2026-HUSTED-v-BROWN"
  pollster: string;
  sponsor?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number; // +/- %
  results: Record<string, number>;
  notes?: string;
};

export const STATE = {
  abbr: "OH",
  name: "Ohio",
};

export const DEFAULT_RACE_ID = "OH-SEN-2026-HUSTED-v-BROWN";

export const RACES = [
  {
    raceId: "OH-SEN-2026-HUSTED-v-BROWN",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Jon Husted (R)", "Sherrod Brown (D)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OH: [
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Emerson College",
      startDate: "2025-12-06",
      endDate: "2025-12-08",
      sampleSize: 850,
      sampleType: "RV",
      moe: 3.3,
      results: {
        "Jon Husted (R)": 49,
        "Sherrod Brown (D)": 46,
        Undecided: 5,
      },
      notes: "Other not reported in table; undecided 5%.",
    },
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Bowling Green State University/YouGov",
      startDate: "2025-10-02",
      endDate: "2025-10-14",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.5,
      results: {
        "Jon Husted (R)": 48,
        "Sherrod Brown (D)": 49,
        Other: 3,
      },
      notes: "Undecided not reported in table; other listed as 3%.",
    },
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Hart Research",
      sponsor: "(D)",
      startDate: "2025-09-19",
      endDate: "2025-09-22",
      sampleSize: 800,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Jon Husted (R)": 45,
        "Sherrod Brown (D)": 48,
        Undecided: 7,
      },
      notes: "Other not reported in table; undecided 7%.",
    },
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Emerson College",
      startDate: "2025-08-18",
      endDate: "2025-08-19",
      sampleSize: 1000,
      sampleType: "RV",
      moe: 3.0,
      results: {
        "Jon Husted (R)": 50,
        "Sherrod Brown (D)": 44,
        Undecided: 7,
      },
      notes: "Other not reported in table; undecided 7%.",
    },
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Bowling Green State University/YouGov",
      startDate: "2025-04-18",
      endDate: "2025-04-24",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.1,
      results: {
        "Jon Husted (R)": 49,
        "Sherrod Brown (D)": 46,
        Other: 5,
      },
      notes: "Undecided not reported in table; other listed as 5%.",
    },
    {
      raceId: "OH-SEN-2026-HUSTED-v-BROWN",
      pollster: "Bowling Green State University/YouGov",
      startDate: "2025-02-14",
      endDate: "2025-02-21",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Jon Husted (R)": 47,
        "Sherrod Brown (D)": 41,
        Undecided: 12,
      },
      notes: "Other not reported in table; undecided 12%.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.OH ?? []).filter((p) => p.raceId === raceId);
}
