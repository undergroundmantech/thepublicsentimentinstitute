// app/polling/governorpolling/wisconsin.ts
// Wisconsin (WI) — 2026 Governor (Open seat; Evers retiring per your table)
// Matchup: Mandela Barnes (D) vs Tom Tiffany (R)
// Source snippet provided by user (Impact Research Oct 2–8, 2025)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "WI-GOV-2026-BARNES-v-TIFFANY"
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

export const STATE = { abbr: "WI", name: "Wisconsin" };

export const DEFAULT_RACE_ID = "WI-GOV-2026-BARNES-v-TIFFANY";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Mandela Barnes (D)", "Tom Tiffany (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  WI: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Impact Research",
      sponsor: "(D)",
      startDate: "2025-10-02",
      endDate: "2025-10-08",
      sampleSize: 500,
      sampleType: "LV",
      moe: 4.4,
      results: {
        "Mandela Barnes (D)": 50,
        "Tom Tiffany (R)": 44,
        Undecided: 7,
      },
      notes: "Impact: Barnes 50, Tiffany 44, Und 7.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.WI ?? []).filter((p) => p.raceId === raceId);
}
