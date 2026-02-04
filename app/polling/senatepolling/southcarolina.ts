// app/polling/senatepolling/southcarolina.ts
// South Carolina (SC) — 2026 Senate
// Matchups: Lindsey Graham (R) vs Annie Andrews (D); Lindsey Graham (R) vs Generic Democrat
// Source snippet provided by user (PPP Nov 21–22, 2025)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "SC-SEN-2026-GRAHAM-v-ANDREWS"
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
  abbr: "SC",
  name: "South Carolina",
};

export const DEFAULT_RACE_ID = "SC-SEN-2026-GRAHAM-v-ANDREWS";

export const RACES = [
  {
    raceId: "SC-SEN-2026-GRAHAM-v-ANDREWS",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Lindsey Graham (R)", "Annie Andrews (D)"],
  },
  {
    raceId: "SC-SEN-2026-GRAHAM-v-GENERIC-D",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Lindsey Graham (R)", "Generic Democrat (D)"],
  },
] as const;

/**
 * Notes:
 * - PPP sample type shown as "V" (voters). We store as RV for your weighting model.
 * - "Other" not listed for SC tables; we only store Undecided.
 * - Keep (R)/(D) labels for map coloring.
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  SC: [
    // Lindsey Graham vs Annie Andrews
    {
      raceId: "SC-SEN-2026-GRAHAM-v-ANDREWS",
      pollster: "Public Policy Polling",
      sponsor: "(D)",
      startDate: "2025-11-21",
      endDate: "2025-11-22",
      sampleSize: 704,
      sampleType: "RV",
      moe: 3.7,
      results: {
        "Lindsey Graham (R)": 42,
        "Annie Andrews (D)": 36,
        Undecided: 22,
      },
      notes: 'Sample type listed as "V" in source; stored as RV.',
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.SC ?? []).filter((p) => p.raceId === raceId);
}
