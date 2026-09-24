// app/polling/senatepolling/maine.ts
// Maine — 2026 U.S. Senate: Troy Jackson (D) vs. Susan Collins (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-22.

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
  abbr: "ME",
  name: "Maine",
};

export const DEFAULT_RACE_ID = "ME-SEN-2026";

export const RACES = [
  {
    raceId: "ME-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Troy Jackson (D)", "Susan Collins (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  ME: [
    {"raceId": "ME-SEN-2026", "pollster": "Wedgewood Polls (D)", "startDate": "2026-07-04", "endDate": "2026-07-06", "sampleSize": 405, "sampleType": "LV", "results": {"Troy Jackson (D)": 48.0, "Susan Collins (R)": 43.0, "Undecided": 9.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-07", "endDate": "2026-07-07", "sampleSize": 785, "sampleType": "LV", "results": {"Troy Jackson (D)": 49.0, "Susan Collins (R)": 44.0, "Undecided": 7.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Z to A Research (D)", "startDate": "2026-07-07", "endDate": "2026-07-08", "sampleSize": 988, "sampleType": "LV", "results": {"Troy Jackson (D)": 47.0, "Susan Collins (R)": 48.0, "Undecided": 5.0}},
    {"raceId": "ME-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-07-15", "endDate": "2026-07-20", "sampleSize": 1178, "sampleType": "LV", "results": {"Troy Jackson (D)": 49.0, "Susan Collins (R)": 46.0, "Other": 2.0, "Undecided": 3.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Hart Research (D)", "startDate": "2026-07-27", "endDate": "2026-08-01", "sampleSize": 802, "sampleType": "LV", "results": {"Troy Jackson (D)": 49.0, "Susan Collins (R)": 45.0, "Undecided": 6.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Beacon Research (D)/Shaw & Co. Research (R)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1000, "sampleType": "RV", "results": {"Troy Jackson (D)": 48.0, "Susan Collins (R)": 46.0, "Other": 1.0, "Undecided": 5.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Abacus Data", "startDate": "2026-08-26", "endDate": "2026-08-28", "sampleSize": 327, "sampleType": "LV", "results": {"Troy Jackson (D)": 52.0, "Susan Collins (R)": 43.0, "Other": 4.0}},
    {"raceId": "ME-SEN-2026", "pollster": "SSRS", "startDate": "2026-08-31", "endDate": "2026-09-06", "sampleSize": 880, "sampleType": "LV", "results": {"Troy Jackson (D)": 48.0, "Susan Collins (R)": 45.0, "Other": 7.0}},
    {"raceId": "ME-SEN-2026", "pollster": "YouGov", "startDate": "2026-09-02", "endDate": "2026-09-08", "sampleSize": 1335, "sampleType": "LV", "results": {"Troy Jackson (D)": 48.0, "Susan Collins (R)": 44.0, "Other": 1.0, "Undecided": 6.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 1033, "sampleType": "LV", "results": {"Troy Jackson (D)": 46.0, "Susan Collins (R)": 45.0, "Undecided": 9.0}},
    {"raceId": "ME-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-09-14", "endDate": "2026-09-15", "sampleSize": 621, "sampleType": "LV", "results": {"Troy Jackson (D)": 46.5, "Susan Collins (R)": 47.5, "Other": 2.0, "Undecided": 4.5}},
    {"raceId": "ME-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-09-15", "endDate": "2026-09-22", "sampleSize": 619, "sampleType": "LV", "results": {"Troy Jackson (D)": 46.0, "Susan Collins (R)": 49.0, "Undecided": 5.0}}
  ],
};
