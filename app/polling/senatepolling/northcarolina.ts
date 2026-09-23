// app/polling/senatepolling/northcarolina.ts
// North Carolina — 2026 U.S. Senate: Roy Cooper (D) vs. Michael Whatley (R)
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
  abbr: "NC",
  name: "North Carolina",
};

export const DEFAULT_RACE_ID = "NC-SEN-2026";

export const RACES = [
  {
    raceId: "NC-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Roy Cooper (D)", "Michael Whatley (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NC: [
    {"raceId": "NC-SEN-2026", "pollster": "Emerson College", "startDate": "2025-07-30", "endDate": "2025-07-30", "sampleSize": 1000, "sampleType": "RV", "results": {"Michael Whatley (R)": 41, "Roy Cooper (D)": 47}},
    {"raceId": "NC-SEN-2026", "pollster": "Victory Insights (R)", "startDate": "2025-07-30", "endDate": "2025-07-30", "sampleSize": 600, "sampleType": "RV", "results": {"Michael Whatley (R)": 40, "Roy Cooper (D)": 43}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2025-08-12", "endDate": "2025-08-12", "sampleSize": 600, "sampleType": "RV", "results": {"Michael Whatley (R)": 39, "Roy Cooper (D)": 47}},
    {"raceId": "NC-SEN-2026", "pollster": "Change Research (D)", "startDate": "2025-09-08", "endDate": "2025-09-08", "sampleSize": 855, "sampleType": "RV", "results": {"Michael Whatley (R)": 41, "Roy Cooper (D)": 48}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2025-09-15", "endDate": "2025-09-15", "sampleSize": 600, "sampleType": "RV", "results": {"Michael Whatley (R)": 42, "Roy Cooper (D)": 46}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2025-11-10", "endDate": "2025-11-10", "sampleSize": 600, "sampleType": "RV", "results": {"Michael Whatley (R)": 39, "Roy Cooper (D)": 47}},
    {"raceId": "NC-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-01-07", "endDate": "2026-01-07", "sampleSize": 1105, "sampleType": "RV", "results": {"Michael Whatley (R)": 42, "Roy Cooper (D)": 47}},
    {"raceId": "NC-SEN-2026", "pollster": "TIPP Insights (R)", "startDate": "2026-01-15", "endDate": "2026-01-15", "sampleSize": 1512, "sampleType": "RV", "results": {"Michael Whatley (R)": 24, "Roy Cooper (D)": 48}},
    {"raceId": "NC-SEN-2026", "pollster": "Nexus Strategies/Strategic Partners Solutions", "startDate": "2026-03-08", "endDate": "2026-03-09", "sampleSize": 800, "sampleType": "RV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 32.0, "Other": 4.0, "Undecided": 14.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-03-13", "endDate": "2026-03-14", "sampleSize": 556, "sampleType": "RV", "results": {"Roy Cooper (D)": 47.0, "Michael Whatley (R)": 44.0, "Undecided": 9.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Catawba College/YouGov", "startDate": "2026-03-09", "endDate": "2026-03-18", "sampleSize": 1000, "sampleType": "LV", "results": {"Roy Cooper (D)": 48.0, "Michael Whatley (R)": 34.0, "Other": 4.0, "Undecided": 14.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2026-03-22", "endDate": "2026-03-23", "sampleSize": 600, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 41.0, "Other": 4.0, "Undecided": 6.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-03-31", "endDate": "2026-04-01", "sampleSize": 987, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 44.0, "Other": 2.0, "Undecided": 6.0}},
    {"raceId": "NC-SEN-2026", "pollster": "High Point University/YouGov", "startDate": "2026-03-26", "endDate": "2026-04-06", "sampleSize": 703, "sampleType": "LV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 42.0, "Other": 2.0, "Undecided": 6.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Opinion Diagnostics (R)", "startDate": "2026-04-21", "endDate": "2026-04-24", "sampleSize": 830, "sampleType": "RV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 41.0, "Undecided": 9.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-05-04", "endDate": "2026-05-08", "sampleSize": 957, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 42.0, "Undecided": 9.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2026-05-10", "endDate": "2026-05-11", "sampleSize": 600, "sampleType": "LV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 39.0, "Undecided": 11.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Catawba College/YouGov", "startDate": "2026-06-01", "endDate": "2026-06-10", "sampleSize": 905, "sampleType": "LV", "results": {"Roy Cooper (D)": 48.0, "Michael Whatley (R)": 34.0, "Undecided": 18.0}},
    {"raceId": "NC-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-06-15", "endDate": "2026-06-27", "sampleSize": 601, "sampleType": "LV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 43.0, "Undecided": 6.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-10", "endDate": "2026-07-11", "sampleSize": 759, "sampleType": "LV", "results": {"Roy Cooper (D)": 48.0, "Michael Whatley (R)": 44.0, "Undecided": 8.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Beacon Research (D)/Shaw & Co. Research (R)", "startDate": "2026-07-23", "endDate": "2026-07-27", "sampleSize": 1005, "sampleType": "RV", "results": {"Roy Cooper (D)": 53.0, "Michael Whatley (R)": 44.0, "Undecided": 3.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Elon University/YouGov", "startDate": "2026-07-23", "endDate": "2026-07-31", "sampleSize": 466, "sampleType": "LV", "results": {"Roy Cooper (D)": 53.0, "Michael Whatley (R)": 42.0, "Other": 3.0, "Undecided": 2.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-07-29", "endDate": "2026-08-01", "sampleSize": 967, "sampleType": "RV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 41.0, "Undecided": 9.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-08-03", "endDate": "2026-08-06", "sampleSize": 915, "sampleType": "LV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 43.0, "Undecided": 7.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2026-08-09", "endDate": "2026-08-10", "sampleSize": 600, "sampleType": "LV", "results": {"Roy Cooper (D)": 52.0, "Michael Whatley (R)": 39.0, "Other": 5.0, "Undecided": 5.0}},
    {"raceId": "NC-SEN-2026", "pollster": "High Point University/YouGov", "startDate": "2026-08-03", "endDate": "2026-08-12", "sampleSize": 660, "sampleType": "LV", "results": {"Roy Cooper (D)": 50.0, "Michael Whatley (R)": 45.0, "Other": 3.0, "Undecided": 3.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Elon University/YouGov", "startDate": "2026-08-21", "endDate": "2026-08-31", "sampleSize": 565, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 38.0, "Other": 4.0, "Undecided": 8.0}},
    {"raceId": "NC-SEN-2026", "pollster": "East Carolina University", "startDate": "2026-08-31", "endDate": "2026-09-03", "sampleSize": 675, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 41.5, "Other": 4.0, "Undecided": 7.0}},
    {"raceId": "NC-SEN-2026", "pollster": "The Trafalgar Group (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 1084, "sampleType": "LV", "results": {"Roy Cooper (D)": 48.0, "Michael Whatley (R)": 42.0, "Other": 3.0, "Undecided": 7.0}},
    {"raceId": "NC-SEN-2026", "pollster": "Harper Polling (R)", "startDate": "2026-09-13", "endDate": "2026-09-15", "sampleSize": 608, "sampleType": "LV", "results": {"Roy Cooper (D)": 49.0, "Michael Whatley (R)": 34.0, "Other": 5.0, "Undecided": 12.0}},
    {"raceId": "NC-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-16", "endDate": "2026-09-17", "sampleSize": 1200, "sampleType": "LV", "results": {"Roy Cooper (D)": 48.0, "Michael Whatley (R)": 43.0, "Other": 3.0, "Undecided": 6.0}}
  ],
};
