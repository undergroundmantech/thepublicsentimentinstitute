// app/polling/governorpolling/massachusetts.ts
// Massachusetts — 2026 Governor: Maura Healey (D) vs. Michael Minogue (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-24.

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
  abbr: "MA",
  name: "Massachusetts",
};

export const DEFAULT_RACE_ID = "MA-GOV-2026";

export const RACES = [
  {
    raceId: "MA-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Maura Healey (D)", "Michael Minogue (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MA: [
    {"raceId": "MA-GOV-2026", "pollster": "Suffolk University", "startDate": "2026-06-08", "endDate": "2026-06-12", "sampleSize": 500, "sampleType": "LV", "results": {"Maura Healey (D)": 56.0, "Michael Minogue (R)": 31.0, "Other": 1.0, "Undecided": 11.0}},
    {"raceId": "MA-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 623, "sampleType": "LV", "results": {"Maura Healey (D)": 51.0, "Michael Minogue (R)": 32.0, "Other": 1.0, "Undecided": 16.0}},
    {"raceId": "MA-GOV-2026", "pollster": "UMass Amherst / YouGov", "startDate": "2026-08-12", "endDate": "2026-08-12", "sampleSize": 800, "sampleType": "RV", "results": {"Maura Healey (D)": 53.0, "Michael Minogue (R)": 33.0, "Other": 2.0, "Undecided": 12.0}},
    {"raceId": "MA-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-24", "endDate": "2026-08-24", "sampleSize": 881, "sampleType": "LV", "results": {"Maura Healey (D)": 54.0, "Michael Minogue (R)": 30.0, "Other": 2.0, "Undecided": 14.0}},
    {"raceId": "MA-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-09-17", "endDate": "2026-09-21", "sampleSize": 564, "sampleType": "LV", "moe": 4.1, "results": {"Maura Healey (D)": 54.0, "Michael Minogue (R)": 38.0, "Undecided": 8.0}}
  ],
};
