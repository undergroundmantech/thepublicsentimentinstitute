// app/polling/governorpolling/nevada.ts
// Nevada (NV) — 2026 Governor (Incumbent: Lombardo)
// Matchup: Joe Lombardo (R) vs Aaron Ford (D)
// Source snippet provided by user (Emerson; Noble Predictive; Vote TXT older)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "NV-GOV-2026-LOMBARDO-v-FORD"
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

export const STATE = { abbr: "NV", name: "Nevada" };

export const DEFAULT_RACE_ID = "NV-GOV-2026-LOMBARDO-v-FORD";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Joe Lombardo (R)", "Aaron Ford (D)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NV: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-11-16",
      endDate: "2025-11-18",
      sampleSize: 800,
      sampleType: "RV",
      moe: 3.4,
      results: {
        "Joe Lombardo (R)": 41,
        "Aaron Ford (D)": 41,
        Undecided: 18,
      },
      notes: "Emerson: tie 41–41; no Other reported; Und 18.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Noble Predictive Insights",
      startDate: "2025-10-07",
      endDate: "2025-10-13",
      sampleSize: 766,
      sampleType: "RV",
      moe: 3.5,
      results: {
        "Joe Lombardo (R)": 40,
        "Aaron Ford (D)": 37,
        Undecided: 23,
      },
      notes: "Noble: Lombardo 40, Ford 37; no Other reported; Und 23.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Vote TXT",
      sponsor: "(B)",
      startDate: "2023-05-15",
      endDate: "2023-05-19",
      sampleSize: 412,
      sampleType: "RV",
      moe: 4.7,
      results: {
        "Joe Lombardo (R)": 51,
        "Aaron Ford (D)": 30,
        Other: 7,
        Undecided: 12,
      },
      notes: "Older poll (2023): Lombardo 51, Ford 30, Other 7, Und 12.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.NV ?? []).filter((p) => p.raceId === raceId);
}
