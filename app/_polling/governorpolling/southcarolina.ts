// app/polling/governorpolling/southcarolina.ts
// South Carolina — 2026 Governor: Jermaine Johnson (D) vs. Alan Wilson (R)
// Generated from the On Point Polling forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-10-26.

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

export const DEFAULT_RACE_ID = "SC-GOV-2026";

export const RACES = [
  {
    raceId: "SC-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Jermaine Johnson (D)", "Alan Wilson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SC: [
    {"raceId": "SC-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-16", "endDate": "2026-07-17", "sampleSize": 577, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 37.0, "Alan Wilson (R)": 45.0, "Undecided": 17.0}},
    {"raceId": "SC-GOV-2026", "pollster": "Hart Research (D)", "startDate": "2026-08-12", "endDate": "2026-08-15", "sampleSize": 600, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 42.0, "Alan Wilson (R)": 50.0, "Undecided": 8.0}},
    {"raceId": "SC-GOV-2026", "pollster": "FITSNews/Rick Quinn", "startDate": "2026-09-29", "endDate": "2026-10-03", "sampleSize": 638, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 35.03, "Alan Wilson (R)": 45.17, "Undecided": 19.8}},
    {"raceId": "SC-GOV-2026", "pollster": "Resonance Media", "startDate": "2026-09-29", "endDate": "2026-10-03", "sampleSize": 638, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 35.0, "Alan Wilson (R)": 45.0, "Other": 4.0, "Undecided": 16.0}},
    {"raceId": "SC-GOV-2026", "pollster": "National Public Affairs (R)", "startDate": "2026-10-13", "endDate": "2026-10-16", "sampleSize": 604, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 41.0, "Alan Wilson (R)": 51.0, "Other": 2.0, "Undecided": 7.0}},
    {"raceId": "SC-GOV-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-10-16", "endDate": "2026-10-18", "sampleSize": 1095, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 36.5, "Alan Wilson (R)": 52.5, "Other": 5.8, "Undecided": 5.2}},
    {"raceId": "SC-GOV-2026", "pollster": "On Point Polling", "startDate": "2026-10-18", "endDate": "2026-10-19", "sampleSize": 294, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 44.9, "Alan Wilson (R)": 53.1, "Other": 1.3, "Undecided": 0.8}},
    {"raceId": "SC-GOV-2026", "pollster": "Targoz Market Research for the South Carolina Policy Council", "startDate": "2026-10-16", "endDate": "2026-10-25", "sampleSize": 895, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 41.0, "Alan Wilson (R)": 51.0, "Other": 2.0, "Undecided": 5.0}},
    {"raceId": "SC-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-10-19", "endDate": "2026-10-26", "sampleSize": 707, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 44.0, "Alan Wilson (R)": 51.0, "Undecided": 5.0}},
    {"raceId": "SC-GOV-2026", "pollster": "The Citadel Poll", "startDate": "2026-10-14", "endDate": "2026-10-25", "sampleSize": 890, "sampleType": "LV", "results": {"Jermaine Johnson (D)": 31.0, "Alan Wilson (R)": 42.0, "Other": 1.0, "Undecided": 26.0}}
  ],
};
