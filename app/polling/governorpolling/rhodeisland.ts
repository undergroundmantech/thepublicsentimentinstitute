// app/polling/governorpolling/rhodeisland.ts
// Rhode Island — 2026 Governor: Helena Foulkes (D) vs. Aaron Guckian (R)
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
  abbr: "RI",
  name: "Rhode Island",
};

export const DEFAULT_RACE_ID = "RI-GOV-2026";

export const RACES = [
  {
    raceId: "RI-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Helena Foulkes (D)", "Aaron Guckian (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  RI: [
    {"raceId": "RI-GOV-2026", "pollster": "Emerson College", "startDate": "2026-08-22", "endDate": "2026-08-22", "sampleSize": 1000, "sampleType": "LV", "results": {"Helena Foulkes (D)": 45.0, "Aaron Guckian (R)": 18.0, "Other": 21.0, "Undecided": 14.0}},
    {"raceId": "RI-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-24", "endDate": "2026-08-24", "sampleSize": 750, "sampleType": "LV", "results": {"Helena Foulkes (D)": 40.0, "Aaron Guckian (R)": 15.0, "Other": 19.0, "Undecided": 19.0}},
    {"raceId": "RI-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-09-17", "endDate": "2026-09-21", "sampleSize": 598, "sampleType": "LV", "moe": 4.0, "results": {"Helena Foulkes (D)": 44.0, "Aaron Guckian (R)": 17.0, "Other": 29.0, "Undecided": 10.0}, "notes": "Other is independent Ken Block at 25, ahead of the Republican, plus CD Reynolds at 2."}
  ],
};
