// app/polling/senatepolling/massachusetts.ts
// Massachusetts — 2026 U.S. Senate: Ed Markey (D) vs. John Deaton (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-24.

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
  abbr: "MA",
  name: "Massachusetts",
};

export const DEFAULT_RACE_ID = "MA-SEN-2026";

export const RACES = [
  {
    raceId: "MA-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Ed Markey (D)", "John Deaton (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MA: [
    {"raceId": "MA-SEN-2026", "pollster": "SurveyUSA", "startDate": "2025-02-28", "endDate": "2025-03-04", "sampleSize": 775, "sampleType": "RV", "results": {"Ed Markey (D)": 45.0, "John Deaton (R)": 26.0, "Undecided": 30.0}},
    {"raceId": "MA-SEN-2026", "pollster": "Suffolk University", "startDate": "2025-11-19", "endDate": "2025-11-23", "sampleSize": 500, "sampleType": "RV", "results": {"Ed Markey (D)": 54.0, "John Deaton (R)": 31.0, "Undecided": 15.0}},
    {"raceId": "MA-SEN-2026", "pollster": "Cygnal (R)", "startDate": "2026-01-22", "endDate": "2026-01-25", "sampleSize": 800, "sampleType": "LV", "results": {"Ed Markey (D)": 54.0, "John Deaton (R)": 30.0, "Undecided": 16.0}},
    {"raceId": "MA-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-02-12", "endDate": "2026-02-16", "sampleSize": 620, "sampleType": "LV", "results": {"Ed Markey (D)": 56.0, "John Deaton (R)": 27.0, "Other": 2.0, "Undecided": 15.0}},
    {"raceId": "MA-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-04-16", "endDate": "2026-04-20", "sampleSize": 603, "sampleType": "LV", "results": {"Ed Markey (D)": 55.0, "John Deaton (R)": 32.0, "Other": 1.0, "Undecided": 12.0}},
    {"raceId": "MA-SEN-2026", "pollster": "Suffolk University", "startDate": "2026-06-08", "endDate": "2026-06-12", "sampleSize": 500, "sampleType": "LV", "results": {"Ed Markey (D)": 55.0, "John Deaton (R)": 30.0, "Other": 1.0, "Undecided": 14.0}},
    {"raceId": "MA-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 623, "sampleType": "LV", "results": {"Ed Markey (D)": 50.0, "John Deaton (R)": 34.0, "Undecided": 16.0}},
    {"raceId": "MA-SEN-2026", "pollster": "UMass Amherst/YouGov", "startDate": "2026-08-05", "endDate": "2026-08-12", "sampleSize": 800, "sampleType": "RV", "results": {"Ed Markey (D)": 51.0, "John Deaton (R)": 30.0, "Other": 3.0, "Undecided": 15.0}},
    {"raceId": "MA-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-20", "endDate": "2026-08-24", "sampleSize": 881, "sampleType": "LV", "results": {"Ed Markey (D)": 49.0, "John Deaton (R)": 30.0, "Other": 8.0, "Undecided": 12.0}}
  ],
};
