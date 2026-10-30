// app/polling/senatepolling/southcarolina.ts
// South Carolina — 2026 U.S. Senate: Annie Andrews (D) vs. Darline Graham (R)
// Generated from the On Point Polling forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-10-29.

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
  abbr: "SC",
  name: "South Carolina",
};

export const DEFAULT_RACE_ID = "SC-SEN-2026";

export const RACES = [
  {
    raceId: "SC-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Annie Andrews (D)", "Darline Graham (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SC: [
    {"raceId": "SC-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-14", "endDate": "2026-08-22", "sampleSize": 900, "sampleType": "LV", "results": {"Annie Andrews (D)": 42.0, "Darline Graham (R)": 39.0, "Other": 6.0, "Undecided": 13.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-18", "endDate": "2026-08-24", "sampleSize": 700, "sampleType": "LV", "results": {"Annie Andrews (D)": 41.0, "Darline Graham (R)": 41.0, "Other": 5.0, "Undecided": 13.0}},
    {"raceId": "SC-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-08", "endDate": "2026-09-09", "sampleSize": 1200, "sampleType": "LV", "results": {"Annie Andrews (D)": 43.0, "Darline Graham (R)": 45.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-14", "endDate": "2026-09-14", "sampleSize": 1006, "sampleType": "LV", "results": {"Annie Andrews (D)": 43.0, "Darline Graham (R)": 48.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-23", "endDate": "2026-09-25", "sampleSize": 1087, "sampleType": "LV", "results": {"Annie Andrews (D)": 42.3, "Darline Graham (R)": 43.4, "Other": 5.9, "Undecided": 8.4}},
    {"raceId": "SC-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-28", "endDate": "2026-09-29", "sampleSize": 1200, "sampleType": "LV", "results": {"Annie Andrews (D)": 45.0, "Darline Graham (R)": 46.0, "Other": 6.0, "Undecided": 3.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-10-05", "endDate": "2026-10-08", "sampleSize": 837, "sampleType": "LV", "results": {"Annie Andrews (D)": 45.0, "Darline Graham (R)": 49.0, "Undecided": 6.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-10-16", "endDate": "2026-10-18", "sampleSize": 1095, "sampleType": "LV", "results": {"Annie Andrews (D)": 46.0, "Darline Graham (R)": 49.0, "Other": 5.0, "Undecided": 1.0}},
    {"raceId": "SC-SEN-2026", "pollster": "On Point Polling", "startDate": "2026-10-18", "endDate": "2026-10-19", "sampleSize": 294, "sampleType": "LV", "results": {"Annie Andrews (D)": 48.5, "Darline Graham (R)": 45.0, "Other": 5.5, "Undecided": 1.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-10-15", "endDate": "2026-10-21", "sampleSize": 800, "sampleType": "LV", "results": {"Annie Andrews (D)": 45.0, "Darline Graham (R)": 44.0, "Other": 5.0, "Undecided": 5.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Targoz Market Research for the South Carolina Policy Council", "startDate": "2026-10-16", "endDate": "2026-10-25", "sampleSize": 895, "sampleType": "LV", "results": {"Annie Andrews (D)": 46.0, "Darline Graham (R)": 47.0, "Other": 3.0, "Undecided": 4.0}},
    {"raceId": "SC-SEN-2026", "pollster": "New York Times/Siena", "startDate": "2026-10-19", "endDate": "2026-10-26", "sampleSize": 707, "sampleType": "LV", "results": {"Annie Andrews (D)": 48.0, "Darline Graham (R)": 48.0, "Undecided": 4.0}},
    {"raceId": "SC-SEN-2026", "pollster": "The Citadel Poll", "startDate": "2026-10-14", "endDate": "2026-10-25", "sampleSize": 890, "sampleType": "LV", "results": {"Annie Andrews (D)": 39.0, "Darline Graham (R)": 43.0, "Other": 4.0, "Undecided": 14.0}},
    {"raceId": "SC-SEN-2026", "pollster": "East Carolina University", "startDate": "2026-10-19", "endDate": "2026-10-24", "sampleSize": 955, "sampleType": "LV", "results": {"Annie Andrews (D)": 47.0, "Darline Graham (R)": 51.0, "Other": 2.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Patinkin Research Strategies", "startDate": "2026-10-27", "endDate": "2026-10-29", "sampleSize": 500, "sampleType": "LV", "results": {"Annie Andrews (D)": 48.0, "Darline Graham (R)": 43.0, "Other": 8.0}}
  ],
};
