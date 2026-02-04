// app/polling/governorpolling/newyork.ts
// New York (NY) — 2026 Governor (Incumbent: Hochul)
// Matchup: Kathy Hochul (D) vs Bruce Blakeman (R)
// Source snippet provided by user; includes one poll with two lines (John Zogby Strategies Jan 6–8, 2026)

export type SampleType = "LV" | "RV" | "V" | "A";

export type Poll = {
  raceId: string; // e.g. "NY-GOV-2026-HOCHUL-v-BLAKEMAN"
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

export const STATE = { abbr: "NY", name: "New York" };

export const DEFAULT_RACE_ID = "NY-GOV-2026-HOCHUL-v-BLAKEMAN";

export const RACES = [
  {
    raceId: DEFAULT_RACE_ID,
    office: "Governor",
    year: 2026,
    candidates: ["Kathy Hochul (D)", "Bruce Blakeman (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NY: [
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Siena College",
      startDate: "2026-01-26",
      endDate: "2026-01-28",
      sampleSize: 802,
      sampleType: "RV",
      moe: 4.3,
      results: {
        "Kathy Hochul (D)": 54,
        "Bruce Blakeman (R)": 28,
        Other: 1,
        Undecided: 17,
      },
      notes: "Siena Jan 26–28, 2026: Hochul 54, Blakeman 28, Other 1, Und 17.",
    },

    // John Zogby Strategies — Jan 6–8, 2026 (line 1)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "John Zogby Strategies",
      startDate: "2026-01-06",
      endDate: "2026-01-08",
      sampleSize: 844,
      sampleType: "LV",
      moe: 3.4,
      results: {
        "Kathy Hochul (D)": 53,
        "Bruce Blakeman (R)": 39,
        Undecided: 8,
      },
      notes: "Zogby Jan 6–8, 2026 ballot test A (53–39; Und 8).",
    },

    // John Zogby Strategies — Jan 6–8, 2026 (line 2)
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "John Zogby Strategies",
      startDate: "2026-01-06",
      endDate: "2026-01-08",
      sampleSize: 844,
      sampleType: "LV",
      moe: 3.4,
      results: {
        "Kathy Hochul (D)": 49,
        "Bruce Blakeman (R)": 34,
        Other: 8,
        Undecided: 9,
      },
      notes: "Zogby Jan 6–8, 2026 ballot test B (49–34; Other 8; Und 9).",
    },

    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Siena College",
      startDate: "2025-12-08",
      endDate: "2025-12-12",
      sampleSize: 801,
      sampleType: "RV",
      moe: 4.1,
      results: {
        "Kathy Hochul (D)": 50,
        "Bruce Blakeman (R)": 25,
        Other: 4,
        Undecided: 21,
      },
      notes: "Siena Dec 8–12, 2025: Hochul 50, Blakeman 25, Other 4, Und 21.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "J.L. Partners",
      sponsor: "(R)",
      startDate: "2025-11-09",
      endDate: "2025-11-10",
      sampleSize: 500,
      sampleType: "LV",
      moe: 4.4,
      results: {
        "Kathy Hochul (D)": 47,
        "Bruce Blakeman (R)": 36,
        Undecided: 17,
      },
      notes: "J.L. Partners Nov 9–10, 2025: Hochul 47, Blakeman 36, Und 17.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "Siena College",
      startDate: "2025-06-23",
      endDate: "2025-06-26",
      sampleSize: 800,
      sampleType: "RV",
      moe: 4.4,
      results: {
        "Kathy Hochul (D)": 44,
        "Bruce Blakeman (R)": 19,
        Undecided: 37,
      },
      notes: "Siena Jun 23–26, 2025: Hochul 44, Blakeman 19, Und 37.",
    },
    {
      raceId: DEFAULT_RACE_ID,
      pollster: "GrayHouse",
      sponsor: "(R)",
      startDate: "2025-04-22",
      endDate: "2025-04-24",
      sampleSize: 600,
      sampleType: "RV",
      moe: 4.0,
      results: {
        "Kathy Hochul (D)": 44,
        "Bruce Blakeman (R)": 36,
        Undecided: 20,
      },
      notes: "GrayHouse Apr 22–24, 2025: Hochul 44, Blakeman 36, Und 20.",
    },
  ],
};

export function getPollsForRace(raceId: string): Poll[] {
  return (STATE_POLLS.NY ?? []).filter((p) => p.raceId === raceId);
}
