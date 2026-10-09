// app/polling/governorpolling/newhampshire.ts
// New Hampshire — 2026 Governor: Cinde Warmington (D) vs. Kelly Ayotte (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-11.

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
  abbr: "NH",
  name: "New Hampshire",
};

export const DEFAULT_RACE_ID = "NH-GOV-2026";

export const RACES = [
  {
    raceId: "NH-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Cinde Warmington (D)", "Kelly Ayotte (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NH: [
    {"raceId": "NH-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 2232, "sampleType": "LV", "results": {"Cinde Warmington (D)": 39.0, "Kelly Ayotte (R)": 44.0, "Other": 3.0, "Undecided": 13.0}},
    {"raceId": "NH-GOV-2026", "pollster": "Saint Anselm College", "startDate": "2026-06-24", "endDate": "2026-06-25", "sampleSize": 1614, "sampleType": "RV", "results": {"Cinde Warmington (D)": 37.0, "Kelly Ayotte (R)": 45.0, "Undecided": 18.0}},
    {"raceId": "NH-GOV-2026", "pollster": "Saint Anselm College", "startDate": "2026-08-17", "endDate": "2026-08-18", "sampleSize": 1411, "sampleType": "LV", "results": {"Cinde Warmington (D)": 38.0, "Kelly Ayotte (R)": 49.0, "Undecided": 13.0}},
    {"raceId": "NH-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-20", "endDate": "2026-08-24", "sampleSize": 1878, "sampleType": "LV", "results": {"Cinde Warmington (D)": 39.0, "Kelly Ayotte (R)": 49.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "NH-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-09", "endDate": "2026-09-11", "sampleSize": 958, "sampleType": "LV", "results": {"Cinde Warmington (D)": 34.0, "Kelly Ayotte (R)": 55.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "NH-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-09-17", "endDate": "2026-09-21", "sampleSize": 1418, "sampleType": "LV", "moe": 2.6, "results": {"Cinde Warmington (D)": 43.0, "Kelly Ayotte (R)": 47.0, "Other": 3.0, "Undecided": 7.0}}
  ],
};
