// app/polling/governorpolling/connecticut.ts
// Connecticut — 2026 Governor: Ned Lamont (D) vs. Ryan Fazio (R)
// Generated from the On Point Polling forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-10-12.

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
  abbr: "CT",
  name: "Connecticut",
};

export const DEFAULT_RACE_ID = "CT-GOV-2026";

export const RACES = [
  {
    raceId: "CT-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Ned Lamont (D)", "Ryan Fazio (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  CT: [
    {"raceId": "CT-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 828, "sampleType": "LV", "results": {"Ned Lamont (D)": 49.0, "Ryan Fazio (R)": 36.0, "Other": 2.0, "Undecided": 12.0}},
    {"raceId": "CT-GOV-2026", "pollster": "Sacred Heart University / WFSB / CT Insider", "startDate": "2026-07-21", "endDate": "2026-07-26", "sampleSize": 1000, "sampleType": "RV", "results": {"Ned Lamont (D)": 50.0, "Ryan Fazio (R)": 30.0, "Other": 1.0, "Undecided": 20.0}},
    {"raceId": "CT-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-24", "endDate": "2026-08-24", "sampleSize": 809, "sampleType": "LV", "results": {"Ned Lamont (D)": 52.0, "Ryan Fazio (R)": 37.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "CT-GOV-2026", "pollster": "GreatBlue Research", "startDate": "2026-09-01", "endDate": "2026-09-08", "sampleSize": 1000, "sampleType": "RV", "results": {"Ned Lamont (D)": 48.0, "Ryan Fazio (R)": 34.0, "Undecided": 18.0}},
    {"raceId": "CT-GOV-2026", "pollster": "Quinnipiac University Polling Institute", "startDate": "2026-09-08", "endDate": "2026-09-14", "sampleSize": 1288, "sampleType": "LV", "results": {"Ned Lamont (D)": 55.0, "Ryan Fazio (R)": 38.0, "Other": 2.0, "Undecided": 5.0}},
    {"raceId": "CT-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-16", "endDate": "2026-09-17", "sampleSize": 979, "sampleType": "LV", "results": {"Ned Lamont (D)": 48.0, "Ryan Fazio (R)": 41.0, "Undecided": 11.0}},
    {"raceId": "CT-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-09-17", "endDate": "2026-09-21", "sampleSize": 540, "sampleType": "LV", "moe": 4.2, "results": {"Ned Lamont (D)": 55.0, "Ryan Fazio (R)": 38.0, "Other": 1.0, "Undecided": 6.0}},
    {"raceId": "CT-GOV-2026", "pollster": "Quinnipiac University", "startDate": "2026-10-08", "endDate": "2026-10-12", "sampleSize": 1225, "sampleType": "LV", "moe": 3.8, "results": {"Ned Lamont (D)": 58.0, "Ryan Fazio (R)": 38.0, "Undecided": 3.0}, "notes": "Undecided includes 2 percent who refused."},
    {"raceId": "CT-GOV-2026", "pollster": "Emerson College", "startDate": "2026-10-10", "endDate": "2026-10-12", "sampleSize": 800, "sampleType": "LV", "moe": 3.5, "results": {"Ned Lamont (D)": 51.0, "Ryan Fazio (R)": 38.0, "Undecided": 11.0}, "notes": "Emerson College Polling for Nexstar Media."},
    {"raceId": "CT-GOV-2026", "pollster": "Wesleyan SurveyLab/YouGov", "startDate": "2026-09-22", "endDate": "2026-10-07", "sampleSize": 420, "sampleType": "LV", "results": {"Ned Lamont (D)": 57.0, "Ryan Fazio (R)": 34.0, "Undecided": 9.0}},
    {"raceId": "CT-GOV-2026", "pollster": "Sacred Heart University / WFSB / CT Insider", "startDate": "2026-10-12", "endDate": "2026-10-12", "sampleSize": 1000, "sampleType": "LV", "results": {"Ned Lamont (D)": 59.3, "Ryan Fazio (R)": 32.7, "Undecided": 8.0}}
  ],
};
