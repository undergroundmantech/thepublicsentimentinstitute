// app/polling/senatepolling/florida.ts
// Florida — 2026 U.S. Senate: Angie Nixon (D) vs. Ashley Moody (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-21.

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
  abbr: "FL",
  name: "Florida",
};

export const DEFAULT_RACE_ID = "FL-SEN-2026";

export const RACES = [
  {
    raceId: "FL-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Angie Nixon (D)", "Ashley Moody (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  FL: [
    {"raceId": "FL-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-09-07", "endDate": "2026-09-09", "sampleSize": 1107, "sampleType": "LV", "results": {"Angie Nixon (D)": 47.0, "Ashley Moody (R)": 47.0, "Other": 1.0, "Undecided": 5.0}},
    {"raceId": "FL-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 733, "sampleType": "LV", "results": {"Angie Nixon (D)": 43.0, "Ashley Moody (R)": 50.0, "Other": 3.0, "Undecided": 4.0}},
    {"raceId": "FL-SEN-2026", "pollster": "St. Pete Polls", "startDate": "2026-09-15", "endDate": "2026-09-17", "sampleSize": 913, "sampleType": "LV", "results": {"Angie Nixon (D)": 45.0, "Ashley Moody (R)": 45.0, "Other": 3.0, "Undecided": 7.0}},
    {"raceId": "FL-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-20", "endDate": "2026-09-21", "sampleSize": 600, "sampleType": "LV", "results": {"Angie Nixon (D)": 42.0, "Ashley Moody (R)": 49.0, "Other": 2.0, "Undecided": 7.0}}
  ],
};
