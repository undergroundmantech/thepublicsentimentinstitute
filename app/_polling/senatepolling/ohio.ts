// app/polling/senatepolling/ohio.ts
// Ohio — 2026 U.S. Senate: Sherrod Brown (D) vs. Jon Husted (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-16.

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
  abbr: "OH",
  name: "Ohio",
};

export const DEFAULT_RACE_ID = "OH-SEN-2026";

export const RACES = [
  {
    raceId: "OH-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Sherrod Brown (D)", "Jon Husted (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OH: [
    {"raceId": "OH-SEN-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2025-02-14", "endDate": "2025-02-21", "sampleSize": 800, "sampleType": "RV", "results": {"Jon Husted (R)": 47, "Sherrod Brown (D)": 41, "Undecided": 12}, "moe": 4, "notes": "Other not reported in table; undecided 12%."},
    {"raceId": "OH-SEN-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2025-04-18", "endDate": "2025-04-24", "sampleSize": 800, "sampleType": "RV", "results": {"Jon Husted (R)": 49, "Sherrod Brown (D)": 46, "Other": 5}, "moe": 4.1, "notes": "Undecided not reported in table; other listed as 5%."},
    {"raceId": "OH-SEN-2026", "pollster": "Emerson College", "startDate": "2025-08-18", "endDate": "2025-08-19", "sampleSize": 1000, "sampleType": "RV", "results": {"Jon Husted (R)": 50, "Sherrod Brown (D)": 44, "Undecided": 7}, "moe": 3, "notes": "Other not reported in table; undecided 7%."},
    {"raceId": "OH-SEN-2026", "pollster": "Hart Research", "startDate": "2025-09-19", "endDate": "2025-09-22", "sampleSize": 800, "sampleType": "LV", "results": {"Jon Husted (R)": 45, "Sherrod Brown (D)": 48, "Undecided": 7}, "moe": 3.5, "notes": "Other not reported in table; undecided 7%."},
    {"raceId": "OH-SEN-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2025-10-02", "endDate": "2025-10-14", "sampleSize": 800, "sampleType": "RV", "results": {"Jon Husted (R)": 48, "Sherrod Brown (D)": 49, "Other": 3}, "moe": 4.5, "notes": "Undecided not reported in table; other listed as 3%."},
    {"raceId": "OH-SEN-2026", "pollster": "Emerson College", "startDate": "2025-12-06", "endDate": "2025-12-08", "sampleSize": 850, "sampleType": "RV", "results": {"Jon Husted (R)": 49, "Sherrod Brown (D)": 46, "Undecided": 5}, "moe": 3.3, "notes": "Other not reported in table; undecided 5%."},
    {"raceId": "OH-SEN-2026", "pollster": "Beacon Research (D)/ Shaw & Co. Research (R)", "startDate": "2026-05-28", "endDate": "2026-06-01", "sampleSize": 1015, "sampleType": "RV", "results": {"Sherrod Brown (D)": 53.0, "Jon Husted (R)": 45.0, "Undecided": 2.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Tulchin Research (D)", "startDate": "2026-06-02", "endDate": "2026-06-04", "sampleSize": 600, "sampleType": "LV", "results": {"Sherrod Brown (D)": 46.0, "Jon Husted (R)": 42.0, "Other": 4.0, "Undecided": 7.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Fabrizio Ward (R)/ Impact Research (D)", "startDate": "2026-06-14", "endDate": "2026-06-16", "sampleSize": 800, "sampleType": "LV", "results": {"Sherrod Brown (D)": 48.0, "Jon Husted (R)": 45.0, "Other": 1.0, "Undecided": 7.0}},
    {"raceId": "OH-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-06-15", "endDate": "2026-06-28", "sampleSize": 601, "sampleType": "LV", "results": {"Sherrod Brown (D)": 47.0, "Jon Husted (R)": 50.0, "Undecided": 3.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Tulchin Research (D)", "startDate": "2026-07-29", "endDate": "2026-08-04", "sampleSize": 600, "sampleType": "LV", "results": {"Sherrod Brown (D)": 47.0, "Jon Husted (R)": 43.0, "Other": 4.0, "Undecided": 6.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Beacon Research (D)/ Shaw & Co. Research (R)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1008, "sampleType": "RV", "results": {"Sherrod Brown (D)": 53.0, "Jon Husted (R)": 45.0, "Undecided": 2.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Wedgewood Polls", "startDate": "2026-08-11", "endDate": "2026-08-13", "sampleSize": 800, "sampleType": "LV", "results": {"Sherrod Brown (D)": 48.0, "Jon Husted (R)": 44.0, "Undecided": 8.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Abacus Data", "startDate": "2026-08-26", "endDate": "2026-08-28", "sampleSize": 306, "sampleType": "LV", "results": {"Sherrod Brown (D)": 52.0, "Jon Husted (R)": 46.0, "Other": 3.0}},
    {"raceId": "OH-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-08", "endDate": "2026-09-09", "sampleSize": 1200, "sampleType": "LV", "results": {"Sherrod Brown (D)": 47.0, "Jon Husted (R)": 42.0, "Other": 3.0, "Undecided": 8.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2026-09-01", "endDate": "2026-09-10", "sampleSize": 1000, "sampleType": "LV", "results": {"Sherrod Brown (D)": 48.0, "Jon Husted (R)": 45.0}},
    {"raceId": "OH-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 1085, "sampleType": "LV", "results": {"Sherrod Brown (D)": 45.0, "Jon Husted (R)": 42.0}}
  ],
};
