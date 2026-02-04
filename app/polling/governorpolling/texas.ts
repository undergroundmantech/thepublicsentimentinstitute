// app/polling/governorpolling/texas.ts
// Texas (TX) — 2026 Governor (Incumbent: Abbott)
// Matchup: Greg Abbott (R) vs Gina Hinojosa (D)
// Source snippet provided by user (Emerson Jan 10–12, 2026)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "TX-GOV-2026-ABBOTT-v-HINOJOSA"
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

export const STATE = { abbr: "TX", name: "Texas" };

export const DEFAULT_RACE_ID = "TX-GOV-2026-ABBOTT-v-HINOJOSA";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Greg Abbott (R)", "Gina Hinojosa (D)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  TX: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      sponsor: "(B)",
      startDate: "2026-01-10",
      endDate: "2026-01-12",
      sampleSize: 1165,
      sampleType: "RV",
      moe: 2.8,
      results: {
        "Greg Abbott (R)": 50,
        "Gina Hinojosa (D)": 42,
        Undecided: 8,
      },
      notes: "Emerson: Abbott 50, Hinojosa 42, Und 8.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.TX ?? []).filter((p) => p.raceId === raceId);
}
