// app/polling/governorpolling/kansas.ts
// Kansas — 2026 Governor: Cindy Holscher (D) vs. Ty Masterson (R)
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
  abbr: "KS",
  name: "Kansas",
};

export const DEFAULT_RACE_ID = "KS-GOV-2026";

export const RACES = [
  {
    raceId: "KS-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Cindy Holscher (D)", "Ty Masterson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  KS: [
    {"raceId": "KS-GOV-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-08-13", "endDate": "2026-08-16", "sampleSize": 600, "sampleType": "LV", "results": {"Cindy Holscher (D)": 47.0, "Ty Masterson (R)": 46.0, "Undecided": 7.0}},
    {"raceId": "KS-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 915, "sampleType": "LV", "results": {"Cindy Holscher (D)": 43.0, "Ty Masterson (R)": 51.0, "Undecided": 6.0}},
    {"raceId": "KS-GOV-2026", "pollster": "Emerson College / Nexstar", "startDate": "2026-09-15", "endDate": "2026-09-16", "sampleSize": 750, "sampleType": "LV", "results": {"Cindy Holscher (D)": 44.0, "Ty Masterson (R)": 51.0, "Undecided": 6.0}}
  ],
};
