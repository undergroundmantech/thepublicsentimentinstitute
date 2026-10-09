// app/polling/senatepolling/kansas.ts
// Kansas — 2026 U.S. Senate: Adam Hamilton (D) vs. Roger Marshall (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-10-01.

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
  abbr: "KS",
  name: "Kansas",
};

export const DEFAULT_RACE_ID = "KS-SEN-2026";

export const RACES = [
  {
    raceId: "KS-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Adam Hamilton (D)", "Roger Marshall (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  KS: [
    {"raceId": "KS-SEN-2026", "pollster": "Tavern Research (D)", "startDate": "2026-01-26", "endDate": "2026-01-28", "sampleSize": 1013, "sampleType": "LV", "moe": 4.0, "results": {"Adam Hamilton (D)": 46.0, "Roger Marshall (R)": 54.0}},
    {"raceId": "KS-SEN-2026", "pollster": "GBAO (D)", "startDate": "2026-07-08", "endDate": "2026-07-13", "sampleSize": 600, "sampleType": "LV", "moe": 4.0, "results": {"Adam Hamilton (D)": 43.0, "Roger Marshall (R)": 47.0, "Undecided": 10.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-08-07", "endDate": "2026-08-08", "sampleSize": 569, "sampleType": "LV", "results": {"Adam Hamilton (D)": 45.0, "Roger Marshall (R)": 46.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-08-12", "endDate": "2026-08-16", "sampleSize": 800, "sampleType": "LV", "results": {"Adam Hamilton (D)": 44.0, "Roger Marshall (R)": 43.0, "Other": 5.0, "Undecided": 8.0}},
    {"raceId": "KS-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 915, "sampleType": "LV", "results": {"Adam Hamilton (D)": 44.0, "Roger Marshall (R)": 49.0, "Other": 2.0, "Undecided": 5.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Emerson College / Nexstar", "startDate": "2026-09-15", "endDate": "2026-09-16", "sampleSize": 750, "sampleType": "LV", "results": {"Adam Hamilton (D)": 45.0, "Roger Marshall (R)": 43.0, "Other": 4.0, "Undecided": 8.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Wedgewood Polls", "startDate": "2026-09-22", "endDate": "2026-09-24", "sampleSize": 500, "sampleType": "LV", "moe": 4.4, "results": {"Adam Hamilton (D)": 50.0, "Roger Marshall (R)": 48.0, "Other": 2.0}, "notes": "Leaners pushed, no undecided reported."},
    {"raceId": "KS-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-09-13", "endDate": "2026-09-16", "sampleSize": 800, "sampleType": "LV", "results": {"Adam Hamilton (D)": 47.0, "Roger Marshall (R)": 43.0, "Other": 5.0, "Undecided": 5.0}, "notes": "Head to head: Hamilton 49, Marshall 47."},
    {"raceId": "KS-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-29", "endDate": "2026-10-01", "sampleSize": 1095, "sampleType": "LV", "results": {"Adam Hamilton (D)": 44.4, "Roger Marshall (R)": 43.5, "Other": 2.0, "Undecided": 10.1}, "notes": "Other is David Graham at 2. Sample R54, D29, I18."},
    {"raceId": "KS-SEN-2026", "pollster": "New York Times/Siena", "startDate": "2026-09-21", "endDate": "2026-09-30", "sampleSize": 600, "sampleType": "LV", "results": {"Adam Hamilton (D)": 45.0, "Roger Marshall (R)": 45.0, "Other": 3.0, "Undecided": 7.0}, "notes": "Other is David Graham. Sample size was not yet published, so 600 is a placeholder."},
    {"raceId": "KS-SEN-2026", "pollster": "YouGov", "startDate": "2026-09-24", "endDate": "2026-10-04", "sampleSize": 2255, "sampleType": "LV", "results": {"Adam Hamilton (D)": 48.0, "Roger Marshall (R)": 45.0, "Other": 1.0, "Undecided": 6.0}},
    {"raceId": "KS-SEN-2026", "pollster": "GBAO for Hamilton (D)", "startDate": "2026-09-30", "endDate": "2026-10-04", "sampleSize": 600, "sampleType": "LV", "results": {"Adam Hamilton (D)": 47.5, "Roger Marshall (R)": 42.5, "Other": 3.5, "Undecided": 6.5}, "notes": "Hamilton campaign internal. Two published figures, 46 to 41 with David Graham at 7 and 49 to 44, averaged as the model does."}
  ],
};
