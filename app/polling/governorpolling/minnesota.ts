// app/polling/governorpolling/minnesota.ts
// Minnesota — 2026 Governor: Amy Klobuchar (D) vs. Lisa Demuth (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-15.

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
  abbr: "MN",
  name: "Minnesota",
};

export const DEFAULT_RACE_ID = "MN-GOV-2026";

export const RACES = [
  {
    raceId: "MN-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Amy Klobuchar (D)", "Lisa Demuth (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MN: [
    {"raceId": "MN-GOV-2026", "pollster": "KSTP/SurveyUSA", "startDate": "2026-08-13", "endDate": "2026-08-17", "sampleSize": 661, "sampleType": "LV", "results": {"Amy Klobuchar (D)": 51.0, "Lisa Demuth (R)": 36.0, "Other": 1.0, "Undecided": 12.0}},
    {"raceId": "MN-GOV-2026", "pollster": "TIPP Insights", "startDate": "2026-08-31", "endDate": "2026-09-02", "sampleSize": 1201, "sampleType": "LV", "results": {"Amy Klobuchar (D)": 50.0, "Lisa Demuth (R)": 40.0, "Other": 6.0, "Undecided": 4.0}},
    {"raceId": "MN-GOV-2026", "pollster": "KSTP/SurveyUSA", "startDate": "2026-09-09", "endDate": "2026-09-14", "sampleSize": 654, "sampleType": "LV", "results": {"Amy Klobuchar (D)": 47.0, "Lisa Demuth (R)": 40.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "MN-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-15", "sampleSize": 833, "sampleType": "LV", "results": {"Amy Klobuchar (D)": 47.0, "Lisa Demuth (R)": 45.0, "Undecided": 9.0}}
  ],
};
