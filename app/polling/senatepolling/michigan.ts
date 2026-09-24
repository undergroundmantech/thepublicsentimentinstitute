// app/polling/senatepolling/michigan.ts
// Michigan — 2026 U.S. Senate: Abdul El-Sayed (D) vs. Mike Rogers (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-23.

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
  abbr: "MI",
  name: "Michigan",
};

export const DEFAULT_RACE_ID = "MI-SEN-2026";

export const RACES = [
  {
    raceId: "MI-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Abdul El-Sayed (D)", "Mike Rogers (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MI: [
    {"raceId": "MI-SEN-2026", "pollster": "Glengariff Group", "startDate": "2025-05-08", "endDate": "2025-05-08", "sampleSize": 600, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 41, "Mike Rogers (R)": 47}},
    {"raceId": "MI-SEN-2026", "pollster": "Rosetta Stone Communications (R)", "startDate": "2025-10-25", "endDate": "2025-10-25", "sampleSize": 637, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 31, "Mike Rogers (R)": 45}},
    {"raceId": "MI-SEN-2026", "pollster": "Mitchell Research & Communications", "startDate": "2025-11-21", "endDate": "2025-11-21", "sampleSize": 616, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 38, "Mike Rogers (R)": 41}},
    {"raceId": "MI-SEN-2026", "pollster": "Glengariff Group", "startDate": "2026-01-06", "endDate": "2026-01-06", "sampleSize": 600, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 47, "Mike Rogers (R)": 43}},
    {"raceId": "MI-SEN-2026", "pollster": "Emerson College", "startDate": "2026-01-25", "endDate": "2026-01-25", "sampleSize": 1000, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 43, "Mike Rogers (R)": 43}},
    {"raceId": "MI-SEN-2026", "pollster": "Beacon Research (D)/ Shaw & Co. Research (R)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1006, "sampleType": "RV", "results": {"Abdul El-Sayed (D)": 47.0, "Mike Rogers (R)": 51.0, "Undecided": 2.0}},
    {"raceId": "MI-SEN-2026", "pollster": "GBAO (D)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 800, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 50.0, "Mike Rogers (R)": 44.0, "Undecided": 6.0}},
    {"raceId": "MI-SEN-2026", "pollster": "TIPP Insights (R)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1215, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 45.0, "Mike Rogers (R)": 42.0, "Other": 7.0, "Undecided": 6.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Fabrizio Ward (R)/ Impact Research (D)", "startDate": "2026-08-09", "endDate": "2026-08-11", "sampleSize": 877, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 48.0, "Mike Rogers (R)": 47.0, "Undecided": 5.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Susquehanna Polling & Research (R)", "startDate": "2026-08-11", "endDate": "2026-08-17", "sampleSize": 800, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 46.0, "Mike Rogers (R)": 39.0, "Other": 6.0, "Undecided": 9.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Michigan State University/YouGov", "startDate": "2026-08-10", "endDate": "2026-08-20", "sampleSize": 779, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 50.0, "Mike Rogers (R)": 45.0, "Undecided": 5.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Abacus Data", "startDate": "2026-08-26", "endDate": "2026-08-28", "sampleSize": 332, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 49.0, "Mike Rogers (R)": 45.0, "Other": 6.0}},
    {"raceId": "MI-SEN-2026", "pollster": "EPIC-MRA", "startDate": "2026-08-22", "endDate": "2026-08-28", "sampleSize": 600, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 48.5, "Mike Rogers (R)": 44.0, "Undecided": 7.5}},
    {"raceId": "MI-SEN-2026", "pollster": "Glengariff Group", "startDate": "2026-08-31", "endDate": "2026-09-03", "sampleSize": 600, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 44.0, "Mike Rogers (R)": 46.0, "Undecided": 9.0}},
    {"raceId": "MI-SEN-2026", "pollster": "SSRS", "startDate": "2026-08-31", "endDate": "2026-09-06", "sampleSize": 843, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 47.0, "Mike Rogers (R)": 44.0, "Other": 8.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-07", "endDate": "2026-09-09", "sampleSize": 1079, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 46.0, "Mike Rogers (R)": 45.0, "Other": 2.0, "Undecided": 7.0}},
    {"raceId": "MI-SEN-2026", "pollster": "Emerson College", "startDate": "2026-09-12", "endDate": "2026-09-14", "sampleSize": 1000, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 48.0, "Mike Rogers (R)": 46.0, "Other": 2.0, "Undecided": 4.0}},
    {"raceId": "MI-SEN-2026", "pollster": "The Washington Post/SSPG", "startDate": "2026-09-10", "endDate": "2026-09-14", "sampleSize": 803, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 48.0, "Mike Rogers (R)": 45.0, "Other": 5.0, "Undecided": 2.0}},
    {"raceId": "MI-SEN-2026", "pollster": "InsiderAdvantage", "startDate": "2026-09-16", "endDate": "2026-09-17", "sampleSize": 1200, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 46.6, "Mike Rogers (R)": 44.7, "Other": 3.3, "Undecided": 5.4}},
    {"raceId": "MI-SEN-2026", "pollster": "Suffolk University", "startDate": "2026-09-16", "endDate": "2026-09-20", "sampleSize": 500, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 47.0, "Mike Rogers (R)": 40.0, "Other": 3.0, "Undecided": 8.0}},
    {"raceId": "MI-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-09-15", "endDate": "2026-09-22", "sampleSize": 613, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 49.0, "Mike Rogers (R)": 44.0, "Undecided": 7.0}},
    {"raceId": "MI-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-21", "endDate": "2026-09-23", "sampleSize": 843, "sampleType": "LV", "results": {"Abdul El-Sayed (D)": 45.0, "Mike Rogers (R)": 45.0, "Other": 2.0, "Undecided": 8.0}}
  ],
};
