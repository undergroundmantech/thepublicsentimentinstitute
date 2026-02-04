// app/polling/senatepolling/nebraska.ts
// Nebraska (NE) — 2026 Senate
// Matchup: Pete Ricketts (R) vs. Dan Osborn (I, Democratic-endorsed)

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string; // e.g. "NE-SEN-2026-RICKETTS-v-OSBORN"
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
  abbr: "NE",
  name: "Nebraska",
};

export const DEFAULT_RACE_ID = "NE-SEN-2026-RICKETTS-v-OSBORN";

export const RACES = [
  {
    raceId: "NE-SEN-2026-RICKETTS-v-OSBORN",
    office: "U.S. Senate",
    year: 2026,
    candidates: [
      "Pete Ricketts (R)",
      "Dan Osborn (I/D)", // treated as Dem-aligned
    ],
  },
] as const;

/**
 * IMPORTANT:
 * Dan Osborn is listed as (I/D) so:
 * - party parsing logic treats him as Democratic-aligned
 * - map + margins remain consistent with your framework
 */
export const STATE_POLLS: Record<string, Poll[]> = {
  NE: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Lake Research Partners",
      sponsor: "(D)",
      startDate: "2025-12-11",
      endDate: "2025-12-17",
      sampleSize: 900,
      sampleType: "LV",
      results: {
        "Pete Ricketts (R)": 48,
        "Dan Osborn (I/D)": 47,
        Undecided: 5,
      },
      notes: "Osborn is an Independent endorsed by Democrats.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Lake Research Partners",
      sponsor: "(D)",
      startDate: "2025-07-23",
      endDate: "2025-07-29",
      sampleSize: 900,
      sampleType: "LV",
      moe: 3.3,
      results: {
        "Pete Ricketts (R)": 46,
        "Dan Osborn (I/D)": 47,
        Undecided: 7,
      },
      notes: "Osborn treated as Dem-aligned Independent.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Change Research",
      sponsor: "(D)",
      startDate: "2025-03-28",
      endDate: "2025-04-01",
      sampleSize: 524,
      sampleType: "LV",
      moe: 4.6,
      results: {
        "Pete Ricketts (R)": 46,
        "Dan Osborn (I/D)": 45,
        Undecided: 9,
      },
      notes: "Osborn is Democratic-endorsed Independent.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.NE ?? []).filter((p) => p.raceId === raceId);
}
