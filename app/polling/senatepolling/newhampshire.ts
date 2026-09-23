// app/polling/senatepolling/newhampshire.ts
// New Hampshire — 2026 U.S. Senate: Chris Pappas (D) vs. John E. Sununu (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-17.

export type SampleType = "LV" | "RV" | "A";

export type Poll = {
  raceId: string;
  pollster: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  sampleSize: number;
  sampleType: SampleType;
  moe?: number;
  results: Record<string, number>;
  notes?: string;
};

export const STATE = {
  abbr: "NH",
  name: "New Hampshire",
};

export const DEFAULT_RACE_ID = "NH-SEN-2026";

export const RACES = [
  {
    raceId: "NH-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Chris Pappas (D)", "John E. Sununu (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NH: [
    {"raceId": "NH-SEN-2026", "pollster": "1892 Polling", "startDate": "2025-09-02", "endDate": "2025-09-04", "sampleSize": 500, "sampleType": "LV", "results": {"Chris Pappas (D)": 45, "John E. Sununu (R)": 43, "Undecided": 12}, "moe": 4.4, "notes": "Other not reported in table; undecided 12%."},
    {"raceId": "NH-SEN-2026", "pollster": "co/efficient", "startDate": "2025-09-10", "endDate": "2025-09-12", "sampleSize": 904, "sampleType": "LV", "results": {"Chris Pappas (D)": 46, "John E. Sununu (R)": 43, "Undecided": 11}, "moe": 3.3, "notes": "Other not reported in table; undecided 11%."},
    {"raceId": "NH-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2025-09-17", "endDate": "2025-09-23", "sampleSize": 1235, "sampleType": "LV", "results": {"Chris Pappas (D)": 49, "John E. Sununu (R)": 43, "Other": 1, "Undecided": 7}, "moe": 2.8, "notes": "Other listed as 1% in table; undecided 7%."},
    {"raceId": "NH-SEN-2026", "pollster": "co/efficient", "startDate": "2025-10-09", "endDate": "2025-10-13", "sampleSize": 1034, "sampleType": "LV", "results": {"Chris Pappas (D)": 45, "John E. Sununu (R)": 42, "Undecided": 12}, "moe": 3.1, "notes": "Other not reported in table; undecided 12%."},
    {"raceId": "NH-SEN-2026", "pollster": "Saint Anselm College", "startDate": "2025-11-18", "endDate": "2025-11-19", "sampleSize": 2212, "sampleType": "RV", "results": {"Chris Pappas (D)": 44, "John E. Sununu (R)": 41, "Undecided": 16}, "notes": "MOE not listed; other not reported; undecided 16%."},
    {"raceId": "NH-SEN-2026", "pollster": "Guidant Polling and Strategy", "startDate": "2025-12-09", "endDate": "2025-12-11", "sampleSize": 600, "sampleType": "LV", "results": {"Chris Pappas (D)": 47, "John E. Sununu (R)": 44, "Undecided": 9}, "moe": 4, "notes": "Other not reported in table; undecided 9%."},
    {"raceId": "NH-SEN-2026", "pollster": "NHJournal/Praecones Analytica", "startDate": "2025-12-26", "endDate": "2025-12-28", "sampleSize": 603, "sampleType": "RV", "results": {"Chris Pappas (D)": 42, "John E. Sununu (R)": 36, "Undecided": 22}, "moe": 4, "notes": "Other not reported in table; undecided 22%."},
    {"raceId": "NH-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-01-15", "endDate": "2026-01-19", "sampleSize": 2053, "sampleType": "LV", "results": {"Chris Pappas (D)": 50, "John E. Sununu (R)": 45, "Other": 1, "Undecided": 5}, "moe": 2.1, "notes": "Other listed as 1% in table; undecided 5%."},
    {"raceId": "NH-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 2232, "sampleType": "LV", "results": {"Chris Pappas (D)": 47.0, "John E. Sununu (R)": 44.0, "Other": 2.0, "Undecided": 7.0}},
    {"raceId": "NH-SEN-2026", "pollster": "Saint Anselm College", "startDate": "2026-06-24", "endDate": "2026-06-25", "sampleSize": 1614, "sampleType": "RV", "results": {"Chris Pappas (D)": 47.0, "John E. Sununu (R)": 41.0, "Undecided": 12.0}},
    {"raceId": "NH-SEN-2026", "pollster": "Peak Insights (R)", "startDate": "2026-06-24", "endDate": "2026-06-27", "sampleSize": 500, "sampleType": "LV", "results": {"Chris Pappas (D)": 43.0, "John E. Sununu (R)": 42.0, "Undecided": 15.0}},
    {"raceId": "NH-SEN-2026", "pollster": "Saint Anselm College", "startDate": "2026-08-17", "endDate": "2026-08-18", "sampleSize": 1411, "sampleType": "LV", "results": {"Chris Pappas (D)": 48.0, "John E. Sununu (R)": 41.0, "Undecided": 11.0}},
    {"raceId": "NH-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-20", "endDate": "2026-08-24", "sampleSize": 1878, "sampleType": "LV", "results": {"Chris Pappas (D)": 43.0, "John E. Sununu (R)": 45.0, "Other": 5.0, "Undecided": 7.0}},
    {"raceId": "NH-SEN-2026", "pollster": "Fabrizio, Lee & Associates (R)", "startDate": "2026-08-27", "endDate": "2026-08-30", "sampleSize": 600, "sampleType": "LV", "results": {"Chris Pappas (D)": 36.0, "John E. Sununu (R)": 37.0, "Other": 4.0, "Undecided": 23.0}},
    {"raceId": "NH-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 1000, "sampleType": "LV", "results": {"Chris Pappas (D)": 45.0, "John E. Sununu (R)": 34.0, "Other": 13.0, "Undecided": 9.0}},
    {"raceId": "NH-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-09", "endDate": "2026-09-11", "sampleSize": 958, "sampleType": "LV", "results": {"Chris Pappas (D)": 46.0, "John E. Sununu (R)": 46.0, "Undecided": 9.0}},
    {"raceId": "NH-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-16", "endDate": "2026-09-17", "sampleSize": 1200, "sampleType": "LV", "results": {"Chris Pappas (D)": 48.0, "John E. Sununu (R)": 40.0, "Other": 3.0, "Undecided": 9.0}}
  ],
};
