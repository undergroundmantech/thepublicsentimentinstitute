// app/polling/governorpolling/ohio.ts
// Ohio (OH) — 2026 Governor (Open seat; DeWine term-limited per your table)
// Matchup: Vivek Ramaswamy (R) vs Amy Acton (D)
// Source snippet provided by user

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "OH-GOV-2026-RAMASWAMY-v-ACTON"
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

export const STATE = { abbr: "OH", name: "Ohio" };

export const DEFAULT_RACE_ID = "OH-GOV-2026-RAMASWAMY-v-ACTON";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Vivek Ramaswamy (R)", "Amy Acton (D)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OH: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-12-06",
      endDate: "2025-12-08",
      sampleSize: 850,
      sampleType: "RV",
      moe: 3.3,
      results: {
        "Vivek Ramaswamy (R)": 45,
        "Amy Acton (D)": 46,
        Undecided: 9,
      },
      notes: "Emerson: Acton 46, Ramaswamy 45; no Other reported; Und 9.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Data Targeting",
      sponsor: "(R)",
      startDate: "2025-12-03",
      endDate: "2025-12-08",
      sampleSize: 603,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Vivek Ramaswamy (R)": 45,
        "Amy Acton (D)": 43,
        Undecided: 12,
      },
      notes: "Data Targeting: Ramaswamy 45, Acton 43; no Other reported; Und 12.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Bowling Green State University/YouGov",
      startDate: "2025-10-02",
      endDate: "2025-10-14",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.5,
      results: {
        "Vivek Ramaswamy (R)": 50,
        "Amy Acton (D)": 47,
        Other: 3,
      },
      notes: "BGSU/YouGov: Ramaswamy 50, Acton 47, Other 3; Und not reported.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Hart Research",
      sponsor: "(D)",
      startDate: "2025-09-19",
      endDate: "2025-09-22",
      sampleSize: 800,
      sampleType: "LV",
      moe: 3.0,
      results: {
        "Vivek Ramaswamy (R)": 45,
        "Amy Acton (D)": 46,
        Undecided: 9,
      },
      notes: "Hart: Acton 46, Ramaswamy 45; no Other reported; Und 9.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-08-18",
      endDate: "2025-08-19",
      sampleSize: 1000,
      sampleType: "RV",
      moe: 3.0,
      results: {
        "Vivek Ramaswamy (R)": 49,
        "Amy Acton (D)": 39,
        Undecided: 12,
      },
      notes: "Emerson: Ramaswamy 49, Acton 39; no Other reported; Und 12.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Impact Research",
      sponsor: "(D)",
      startDate: "2025-07-24",
      endDate: "2025-07-28",
      sampleSize: 800,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Vivek Ramaswamy (R)": 47,
        "Amy Acton (D)": 46,
        Undecided: 7,
      },
      notes: "Impact: Ramaswamy 47, Acton 46; no Other reported; Und 7.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Bowling Green State University/YouGov",
      startDate: "2025-04-18",
      endDate: "2025-04-24",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.1,
      results: {
        "Vivek Ramaswamy (R)": 50,
        "Amy Acton (D)": 45,
        Other: 5,
      },
      notes: "BGSU/YouGov: Ramaswamy 50, Acton 45, Other 5; Und not reported.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Public Policy Polling",
      sponsor: "(D)",
      startDate: "2025-02-19",
      endDate: "2025-02-20",
      sampleSize: 642,
      sampleType: "RV",
      moe: 3.9,
      results: {
        "Vivek Ramaswamy (R)": 44,
        "Amy Acton (D)": 45,
        Undecided: 11,
      },
      notes: "PPP: Acton 45, Ramaswamy 44; no Other reported; Und 11.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.OH ?? []).filter((p) => p.raceId === raceId);
}
