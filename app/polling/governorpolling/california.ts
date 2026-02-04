// app/polling/governorpolling/california.ts
// California (CA) — 2026 Governor (Open seat; Newsom term-limited per your table)
// Multi-candidate primary polling table provided by user.
// IMPORTANT:
// - Your leaderboard code expects a single "raceId" bucket; this is the CA all-candidates field.
// - "Other" / "Undecided" included when provided. Missing fields omitted.
// - SampleType uses "LV" and "V" (as listed).

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "CA-GOV-2026-PRIMARY-ALL"
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

export const STATE = { abbr: "CA", name: "California" };

export const DEFAULT_RACE_ID = "CA-GOV-2026-PRIMARY-ALL";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: [
      "Xavier Becerra (D)",
      "Chad Bianco (R)",
      "Steve Hilton (R)",
      "Matt Mahan (D)",
      "Katie Porter (D)",
      "Tom Steyer (D)",
      "Eric Swalwell (D)",
      "Tony Thurmond (D)",
      "Antonio Villaraigosa (D)",
      "Betty Yee (D)",
    ],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  CA: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Public Policy Polling",
      sponsor: "(D)",
      startDate: "2026-01-20",
      endDate: "2026-01-21",
      sampleSize: 1001,
      sampleType: "V",
      results: {
        "Xavier Becerra (D)": 6,
        "Chad Bianco (R)": 18,
        "Steve Hilton (R)": 17,
        "Matt Mahan (D)": 5,
        "Katie Porter (D)": 14,
        "Tom Steyer (D)": 8,
        "Eric Swalwell (D)": 12,
        "Tony Thurmond (D)": 1,
        "Antonio Villaraigosa (D)": 2,
        Undecided: 17,
      },
      notes: "PPP all-candidate field; Other not listed; Und 17.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "David Binder Research",
      sponsor: "(B)",
      startDate: "2026-01-17",
      endDate: "2026-01-20",
      sampleSize: 800,
      sampleType: "LV",
      moe: 3.5,
      results: {
        "Xavier Becerra (D)": 5,
        "Chad Bianco (R)": 17,
        "Steve Hilton (R)": 14,
        "Katie Porter (D)": 11,
        "Tom Steyer (D)": 8,
        "Eric Swalwell (D)": 11,
        "Tony Thurmond (D)": 2,
        "Antonio Villaraigosa (D)": 3,
        "Betty Yee (D)": 1,
        Other: 3, // noted in table as Other=3
        Undecided: 25,
      },
      notes: "Binder: Matt Mahan not listed; Other 3; Und 25.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "CivicLens Research",
      startDate: "2025-12-14",
      endDate: "2025-12-16",
      sampleSize: 400,
      sampleType: "LV",
      moe: 4.5,
      results: {
        "Xavier Becerra (D)": 1,
        "Chad Bianco (R)": 14,
        "Steve Hilton (R)": 18,
        "Katie Porter (D)": 9,
        "Tom Steyer (D)": 7,
        "Eric Swalwell (D)": 12,
        "Tony Thurmond (D)": 3,
        "Antonio Villaraigosa (D)": 2,
        "Betty Yee (D)": 2,
        Other: 3,
        Undecided: 31,
      },
      notes: "CivicLens: Matt Mahan not listed; Other 3; Und 31.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "FM3 Research",
      startDate: "2025-11-30",
      endDate: "2025-12-07",
      sampleSize: 632,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Xavier Becerra (D)": 3,
        "Chad Bianco (R)": 17,
        "Steve Hilton (R)": 18,
        "Katie Porter (D)": 13,
        "Tom Steyer (D)": 6,
        "Eric Swalwell (D)": 17,
        "Tony Thurmond (D)": 1,
        "Antonio Villaraigosa (D)": 3,
        "Betty Yee (D)": 1,
        Undecided: 20,
      },
      notes: "FM3: Matt Mahan not listed; Other not listed; Und 20.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-12-01",
      endDate: "2025-12-02",
      sampleSize: 1000,
      sampleType: "LV",
      moe: 3.0,
      results: {
        "Xavier Becerra (D)": 4,
        "Chad Bianco (R)": 13,
        "Steve Hilton (R)": 12,
        "Katie Porter (D)": 11,
        "Tom Steyer (D)": 4,
        "Eric Swalwell (D)": 12,
        "Tony Thurmond (D)": 2,
        "Antonio Villaraigosa (D)": 5,
        "Betty Yee (D)": 2,
        Other: 5,
        Undecided: 31,
      },
      notes: "Emerson Dec 1–2, 2025: Matt Mahan not listed; Other 5; Und 31.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Lake Research Partners",
      sponsor: "(D)",
      startDate: "2025-11-17",
      endDate: "2025-11-20",
      sampleSize: 600,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Xavier Becerra (D)": 6,
        "Chad Bianco (R)": 10,
        "Steve Hilton (R)": 17,
        "Katie Porter (D)": 15,
        "Tom Steyer (D)": 4,
        "Eric Swalwell (D)": 10,
        "Tony Thurmond (D)": 3,
        "Antonio Villaraigosa (D)": 7,
        "Betty Yee (D)": 3,
        Other: 1,
        Undecided: 22,
      },
      notes: "Lake: Matt Mahan not listed; Other 1; Und 22.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "PPIC",
      startDate: "2025-11-13",
      endDate: "2025-11-19",
      sampleSize: 1086,
      sampleType: "LV",
      moe: 3.9,
      results: {
        "Xavier Becerra (D)": 14,
        "Chad Bianco (R)": 10,
        "Steve Hilton (R)": 14,
        "Katie Porter (D)": 21,
        "Tony Thurmond (D)": 2,
        "Antonio Villaraigosa (D)": 8,
        "Betty Yee (D)": 7,
        Other: 19,
        Undecided: 5,
      },
      notes: "PPIC: Steyer/Swalwell/Mahan not listed; Other 19; Und 5.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Tavern Research",
      sponsor: "(D)",
      startDate: "2025-10-27",
      endDate: "2025-10-30",
      sampleSize: 1001,
      sampleType: "LV",
      moe: 4.0,
      results: {
        "Xavier Becerra (D)": 9,
        "Chad Bianco (R)": 16,
        "Steve Hilton (R)": 12,
        "Katie Porter (D)": 15,
        "Tony Thurmond (D)": 2,
        "Antonio Villaraigosa (D)": 5,
        "Betty Yee (D)": 3,
        Other: 9,
        Undecided: 29,
      },
      notes: "Tavern: Steyer/Swalwell/Mahan not listed; Other 9; Und 29.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "EMC Research",
      sponsor: "(D)",
      startDate: "2025-10-22",
      endDate: "2025-10-26",
      sampleSize: 1000,
      sampleType: "LV",
      moe: 3.1,
      results: {
        "Xavier Becerra (D)": 9,
        "Chad Bianco (R)": 14,
        "Steve Hilton (R)": 20,
        "Katie Porter (D)": 16,
        "Tom Steyer (D)": 3,
        "Eric Swalwell (D)": 11,
        "Tony Thurmond (D)": 3,
        "Antonio Villaraigosa (D)": 5,
        "Betty Yee (D)": 3,
        Other: 16,
        // Undecided not shown in your pasted row for EMC
      },
      notes: "EMC: Undecided not listed in provided row; Other 16.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-10-20",
      endDate: "2025-10-21",
      sampleSize: 900,
      sampleType: "LV",
      moe: 3.19,
      results: {
        "Xavier Becerra (D)": 5,
        "Chad Bianco (R)": 11,
        "Steve Hilton (R)": 16,
        "Katie Porter (D)": 15,
        "Tony Thurmond (D)": 3,
        "Antonio Villaraigosa (D)": 5,
        "Betty Yee (D)": 2,
        Other: 4,
        Undecided: 39,
      },
      notes: "Emerson Oct 20–21, 2025: Steyer/Swalwell/Mahan not listed; Other 4; Und 39.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Bold Decision",
      startDate: "2025-10-16",
      endDate: "2025-10-21",
      sampleSize: 509,
      sampleType: "LV",
      moe: 4.3,
      results: {
        "Xavier Becerra (D)": 8,
        "Chad Bianco (R)": 14,
        "Steve Hilton (R)": 13,
        "Katie Porter (D)": 12,
        "Tom Steyer (D)": 7,
        "Antonio Villaraigosa (D)": 7,
        "Betty Yee (D)": 4,
        Other: 4,
        Undecided: 29,
      },
      notes: "Bold Decision: Swalwell/Thurmond/Mahan not listed; Other 4; Und 29.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Emerson College",
      startDate: "2025-04-12",
      endDate: "2025-04-14",
      sampleSize: 899,
      sampleType: "LV",
      moe: 3.2,
      results: {
        "Xavier Becerra (D)": 3,
        "Chad Bianco (R)": 4,
        "Katie Porter (D)": 12,
        "Tony Thurmond (D)": 2,
        "Antonio Villaraigosa (D)": 5,
        "Betty Yee (D)": 3,
        Other: 17,
        Undecided: 54,
      },
      notes: "Emerson Apr 12–14, 2025 (early field; many candidates not listed).",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.CA ?? []).filter((p) => p.raceId === raceId);
}
