// app/polling/senatepolling/minnesota.ts
// Minnesota — 2026 U.S. Senate: Peggy Flanagan (D) vs. Michele Tafoya (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-15.

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
  abbr: "MN",
  name: "Minnesota",
};

export const DEFAULT_RACE_ID = "MN-SEN-2026";

export const RACES = [
  {
    raceId: "MN-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Peggy Flanagan (D)", "Michele Tafoya (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MN: [
    {"raceId": "MN-SEN-2026", "pollster": "KTSP/SurveyUSA", "startDate": "2026-08-13", "endDate": "2026-08-17", "sampleSize": 661, "sampleType": "LV", "results": {"Peggy Flanagan (D)": 46.0, "Michele Tafoya (R)": 41.0, "Other": 2.0, "Undecided": 11.0}},
    {"raceId": "MN-SEN-2026", "pollster": "Deep Root Analytics (R)", "startDate": "2026-08-17", "endDate": "2026-08-18", "sampleSize": 597, "sampleType": "RV", "results": {"Peggy Flanagan (D)": 50.0, "Michele Tafoya (R)": 45.0, "Undecided": 5.0}},
    {"raceId": "MN-SEN-2026", "pollster": "TIPP Insights (R)", "startDate": "2026-08-31", "endDate": "2026-09-02", "sampleSize": 1201, "sampleType": "LV", "results": {"Peggy Flanagan (D)": 44.0, "Michele Tafoya (R)": 42.0, "Other": 6.0, "Undecided": 8.0}},
    {"raceId": "MN-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 720, "sampleType": "LV", "results": {"Peggy Flanagan (D)": 48.0, "Michele Tafoya (R)": 44.0, "Undecided": 7.0}},
    {"raceId": "MN-SEN-2026", "pollster": "KSTP/SurveyUSA", "startDate": "2026-09-09", "endDate": "2026-09-14", "sampleSize": 654, "sampleType": "LV", "results": {"Peggy Flanagan (D)": 42.0, "Michele Tafoya (R)": 42.0, "Other": 4.0, "Undecided": 12.0}},
    {"raceId": "MN-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-15", "sampleSize": 833, "sampleType": "LV", "results": {"Peggy Flanagan (D)": 43.0, "Michele Tafoya (R)": 42.0, "Other": 4.0, "Undecided": 11.0}}
  ],
};
