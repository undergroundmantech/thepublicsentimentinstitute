// app/polling/governorpolling/michigan.ts
// Michigan (MI) — 2026 Governor (Open seat; Whitmer term-limited per your table)
// Matchup: Jocelyn Benson (D) vs John James (R) vs Mike Duggan (I)
// Source rows provided by user; includes multiple ballot tests for same field dates (Glengariff May 5–8, 2025 and Jan 2–6, 2026)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "MI-GOV-2026-BENSON-v-JAMES-v-DUGGAN"
  pollster: string;
  sponsor?: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number;
  results: Record<string, number>;
  notes?: string; // for alternate ballot tests / variants
};

export const STATE = {
  abbr: "MI",
  name: "Michigan",
};

export const DEFAULT_RACE_ID = "MI-GOV-2026-BENSON-v-JAMES-v-DUGGAN";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Jocelyn Benson (D)", "John James (R)", "Mike Duggan (I)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MI: [
    // Glengariff Group — Jan 2–6, 2026 (Ballot test A: 32/34/26, Und 8)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Glengariff Group",
      startDate: "2026-01-02",
      endDate: "2026-01-06",
      sampleSize: 600,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 32,
        "John James (R)": 34,
        "Mike Duggan (I)": 26,
        Undecided: 8,
      },
      notes: "Glengariff Jan 2–6, 2026 ballot test A (3-way).",
    },

    // Glengariff Group — Jan 2–6, 2026 (Ballot test B: 47/45, Und 9)
    // (The snippet appears to be a 2-way/alternate test; Duggan not shown.)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Glengariff Group",
      startDate: "2026-01-02",
      endDate: "2026-01-06",
      sampleSize: 600,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 47,
        "John James (R)": 45,
        Undecided: 9,
      },
      notes: "Glengariff Jan 2–6, 2026 ballot test B (alternate test; Duggan not listed).",
    },

    // Mitchell Research — Nov 18–21, 2025
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Mitchell Research",
      sponsor: "(C)",
      startDate: "2025-11-18",
      endDate: "2025-11-21",
      sampleSize: 616,
      sampleType: "LV",
      moe: 3.7,
      results: {
        "Jocelyn Benson (D)": 31,
        "John James (R)": 37,
        "Mike Duggan (I)": 18,
        Undecided: 14,
      },
      notes: "Mitchell Research Nov 18–21, 2025 (3-way).",
    },

    // EPIC-MRA — Nov 6–11, 2025
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "EPIC-MRA",
      startDate: "2025-11-06",
      endDate: "2025-11-11",
      sampleSize: 600,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 33,
        "John James (R)": 34,
        "Mike Duggan (I)": 20,
        Undecided: 13,
      },
      notes: "EPIC-MRA Nov 6–11, 2025 (3-way).",
    },

    // Rosetta Stone Communications — Oct 23–25, 2025
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Rosetta Stone Communications",
      sponsor: "(R)",
      startDate: "2025-10-23",
      endDate: "2025-10-25",
      sampleSize: 637,
      sampleType: "LV",
      moe: 3.9,
      results: {
        "Jocelyn Benson (D)": 34,
        "John James (R)": 39,
        "Mike Duggan (I)": 18,
        Undecided: 9,
      },
      notes: "Rosetta Stone Oct 23–25, 2025 (3-way).",
    },

    // Schoen Cooperman Research — Oct 9–14, 2025
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Schoen Cooperman Research",
      sponsor: "(D)",
      startDate: "2025-10-09",
      endDate: "2025-10-14",
      sampleSize: 600,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 30,
        "John James (R)": 29,
        "Mike Duggan (I)": 26,
        Undecided: 15,
      },
      notes: "Schoen Cooperman Oct 9–14, 2025 (3-way).",
    },

    // Glengariff Group — May 5–8, 2025 (Ballot test A: 35/34/22, Und 9)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Glengariff Group",
      startDate: "2025-05-05",
      endDate: "2025-05-08",
      sampleSize: 600,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 35,
        "John James (R)": 34,
        "Mike Duggan (I)": 22,
        Undecided: 9,
      },
      notes: "Glengariff May 5–8, 2025 ballot test A (3-way).",
    },

    // Glengariff Group — May 5–8, 2025 (Ballot test B: 38/33/21, Und 8)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Glengariff Group",
      startDate: "2025-05-05",
      endDate: "2025-05-08",
      sampleSize: 600,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 38,
        "John James (R)": 33,
        "Mike Duggan (I)": 21,
        Undecided: 8,
      },
      notes: "Glengariff May 5–8, 2025 ballot test B (3-way).",
    },

    // Mitchell Research — March 13, 2025 (single-day)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Mitchell Research",
      sponsor: "(C)",
      startDate: "2025-03-13",
      endDate: "2025-03-13",
      sampleSize: 688,
      sampleType: "LV",
      moe: 3.7,
      results: {
        "Jocelyn Benson (D)": 37,
        "John James (R)": 34,
        "Mike Duggan (I)": 16,
        Undecided: 13,
      },
      notes: "Mitchell Research Mar 13, 2025 (3-way).",
    },

    // Target Insyght — Feb 3–8, 2025 (population listed as 'V' in snippet)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Target Insyght",
      startDate: "2025-02-03",
      endDate: "2025-02-08",
      sampleSize: 600,
      sampleType: "V",
      moe: 4.0,
      results: {
        "Jocelyn Benson (D)": 42,
        "John James (R)": 30,
        "Mike Duggan (I)": 21,
        Undecided: 7,
      },
      notes: "Target Insyght Feb 3–8, 2025 (3-way; population shown as V).",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.MI ?? []).filter((p) => p.raceId === raceId);
}
