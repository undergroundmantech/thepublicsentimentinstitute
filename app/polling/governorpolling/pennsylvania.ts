// app/polling/governorpolling/pennsylvania.ts
// Pennsylvania (PA) — 2026 Governor (Incumbent: Shapiro)
// Matchup: Josh Shapiro (D) vs Stacy Garrity (R)
// Source snippet provided by user (Quinnipiac; Susquehanna)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "PA-GOV-2026-SHAPIRO-v-GARRITY"
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

export const STATE = { abbr: "PA", name: "Pennsylvania" };

export const DEFAULT_RACE_ID = "PA-GOV-2026-SHAPIRO-v-GARRITY";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Josh Shapiro (D)", "Stacy Garrity (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  PA: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Quinnipiac University",
      startDate: "2025-09-25",
      endDate: "2025-09-29",
      sampleSize: 1579,
      sampleType: "RV",
      moe: 3.3,
      results: {
        "Josh Shapiro (D)": 55,
        "Stacy Garrity (R)": 39,
        Other: 1,
        Undecided: 5,
      },
      notes: "Quinnipiac: Shapiro 55, Garrity 39, Other 1, Und 5.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Susquehanna Polling & Research",
      sponsor: "(R)",
      startDate: "2025-09-22",
      endDate: "2025-09-28",
      sampleSize: 700,
      sampleType: "LV",
      moe: 3.7,
      results: {
        "Josh Shapiro (D)": 54,
        "Stacy Garrity (R)": 36,
        Undecided: 9,
      },
      notes: "Susquehanna: Shapiro 54, Garrity 36; no Other reported; Und 9.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.PA ?? []).filter((p) => p.raceId === raceId);
}
