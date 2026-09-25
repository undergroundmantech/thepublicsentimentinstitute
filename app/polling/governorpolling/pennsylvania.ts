// app/polling/governorpolling/pennsylvania.ts
// Pennsylvania — 2026 Governor: Josh Shapiro (D) vs. Stacy Garrity (R)
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
  abbr: "PA",
  name: "Pennsylvania",
};

export const DEFAULT_RACE_ID = "PA-GOV-2026";

export const RACES = [
  {
    raceId: "PA-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Josh Shapiro (D)", "Stacy Garrity (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  PA: [
    {"raceId": "PA-GOV-2026", "pollster": "Susquehanna Polling & Research", "startDate": "2025-09-22", "endDate": "2025-09-28", "sampleSize": 700, "sampleType": "LV", "results": {"Josh Shapiro (D)": 54, "Stacy Garrity (R)": 36, "Undecided": 9}, "moe": 3.7, "notes": "Susquehanna: Shapiro 54, Garrity 36; no Other reported; Und 9."},
    {"raceId": "PA-GOV-2026", "pollster": "Quinnipiac University", "startDate": "2025-09-25", "endDate": "2025-09-29", "sampleSize": 1579, "sampleType": "RV", "results": {"Josh Shapiro (D)": 55, "Stacy Garrity (R)": 39, "Other": 1, "Undecided": 5}, "moe": 3.3, "notes": "Quinnipiac: Shapiro 55, Garrity 39, Other 1, Und 5."},
    {"raceId": "PA-GOV-2026", "pollster": "MAD Global Strategy", "startDate": "2026-06-09", "endDate": "2026-06-11", "sampleSize": 600, "sampleType": "LV", "results": {"Josh Shapiro (D)": 48.0, "Stacy Garrity (R)": 31.0, "Undecided": 18.0}},
    {"raceId": "PA-GOV-2026", "pollster": "Franklin & Marshall College", "startDate": "2026-06-08", "endDate": "2026-06-14", "sampleSize": 546, "sampleType": "RV", "results": {"Josh Shapiro (D)": 50.0, "Stacy Garrity (R)": 28.0, "Other": 6.0, "Undecided": 16.0}},
    {"raceId": "PA-GOV-2026", "pollster": "PennLive", "startDate": "2026-06-18", "endDate": "2026-06-25", "sampleSize": 644, "sampleType": "RV", "results": {"Josh Shapiro (D)": 54.0, "Stacy Garrity (R)": 29.0, "Other": 7.0, "Undecided": 9.0}},
    {"raceId": "PA-GOV-2026", "pollster": "Quinnipiac University", "startDate": "2026-07-09", "endDate": "2026-07-13", "sampleSize": 895, "sampleType": "RV", "results": {"Josh Shapiro (D)": 53.0, "Stacy Garrity (R)": 40.0, "Other": 3.0, "Undecided": 4.0}},
    {"raceId": "PA-GOV-2026", "pollster": "National Public Affairs (R)", "startDate": "2026-07-26", "endDate": "2026-07-30", "sampleSize": 600, "sampleType": "LV", "results": {"Josh Shapiro (D)": 50.0, "Stacy Garrity (R)": 43.0, "Undecided": 7.0}},
    {"raceId": "PA-GOV-2026", "pollster": "The New York Times/The Philadelphia Inquirer/Siena", "startDate": "2026-08-17", "endDate": "2026-08-21", "sampleSize": 760, "sampleType": "LV", "results": {"Josh Shapiro (D)": 55.0, "Stacy Garrity (R)": 39.0, "Undecided": 6.0}},
    {"raceId": "PA-GOV-2026", "pollster": "PennLive", "startDate": "2026-08-18", "endDate": "2026-08-22", "sampleSize": 711, "sampleType": "RV", "results": {"Josh Shapiro (D)": 56.0, "Stacy Garrity (R)": 25.0, "Undecided": 19.0}},
    {"raceId": "PA-GOV-2026", "pollster": "Franklin & Marshall College", "startDate": "2026-08-17", "endDate": "2026-08-23", "sampleSize": 501, "sampleType": "RV", "results": {"Josh Shapiro (D)": 50.0, "Stacy Garrity (R)": 25.0, "Other": 7.0, "Undecided": 18.0}},
    {"raceId": "PA-GOV-2026", "pollster": "The New York Times/The Philadelphia Inquirer/Siena", "startDate": "2026-09-15", "endDate": "2026-09-21", "sampleSize": 615, "sampleType": "LV", "results": {"Josh Shapiro (D)": 58.0, "Stacy Garrity (R)": 38.0}}
  ],
};
