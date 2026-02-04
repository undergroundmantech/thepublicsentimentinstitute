// app/polling/governorpolling/arizona.ts

/**
 * Arizona Governor (2026) polling
 * Matchup: Katie Hobbs (D) vs Andy Biggs (R)
 *
 * Notes:
 * - Results keys include (D)/(R) so your map code can infer party.
 * - "Other" / "Undecided" are included but excluded from leader calc by EXCLUDE_KEYS.
 * - Dates are ISO (YYYY-MM-DD). endDate is required by your pipeline.
 */

export const STATE_POLLS: Record<string, any[]> = {
  AZ: [
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "RealClearPolitics Avg",
      startDate: "2025-08-11",
      endDate: "2025-11-10",
      updatedDate: "2025-11-14",
      sampleSize: 0,
      sampleType: "A",
      results: {
        "Katie Hobbs (D)": 41.5,
        "Andy Biggs (R)": 40.0,
        "Other/Undecided": 18.5,
      },
    },

    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "NXTGenP (R)",
      startDate: "2025-12-15",
      endDate: "2025-12-17",
      sampleSize: 2725,
      sampleType: "LV",
      results: {
        "Katie Hobbs (D)": 51,
        "Andy Biggs (R)": 32,
        Other: 7,
        Undecided: 9,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Emerson College",
      startDate: "2025-11-08",
      endDate: "2025-11-10",
      sampleSize: 850,
      sampleType: "RV",
      results: {
        "Katie Hobbs (D)": 44,
        "Andy Biggs (R)": 43,
        Undecided: 13,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Noble Predictive Insights",
      startDate: "2025-08-11",
      endDate: "2025-08-18",
      sampleSize: 948,
      sampleType: "RV",
      results: {
        "Katie Hobbs (D)": 39,
        "Andy Biggs (R)": 37,
        Other: 4,
        Undecided: 20,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Noble Predictive Insights",
      startDate: "2025-05-12",
      endDate: "2025-05-16",
      sampleSize: 1026,
      sampleType: "RV",
      results: {
        "Katie Hobbs (D)": 40,
        "Andy Biggs (R)": 38,
        Other: 5,
        Undecided: 17,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Pulse Decision Science (R)",
      startDate: "2025-04-06",
      endDate: "2025-04-09",
      sampleSize: 501,
      sampleType: "LV",
      results: {
        "Katie Hobbs (D)": 46,
        "Andy Biggs (R)": 42,
        Undecided: 12,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Noble Predictive Insights",
      startDate: "2025-02-11",
      endDate: "2025-02-13",
      sampleSize: 1006,
      sampleType: "RV",
      results: {
        "Katie Hobbs (D)": 40,
        "Andy Biggs (R)": 38,
        Other: 5,
        Undecided: 17,
      },
    },
    {
      raceId: "AZ-GOV-2026-Hobbs-Biggs",
      pollster: "Kreate Strategies (R)",
      startDate: "2025-02-05",
      endDate: "2025-02-07",
      sampleSize: 924,
      sampleType: "LV",
      results: {
        "Katie Hobbs (D)": 43,
        "Andy Biggs (R)": 44,
        Undecided: 13,
      },
    },
  ],
};

// Optional convenience export if you ever want to call mod.getStateSummary("AZ")
export function getStatePolls(abbr: string) {
  return STATE_POLLS[abbr] ?? [];
}
