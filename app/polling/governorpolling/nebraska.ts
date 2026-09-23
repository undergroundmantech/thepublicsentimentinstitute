// app/polling/governorpolling/nebraska.ts
// Nebraska — 2026 Governor: Lynne Walz (D) vs. Jim Pillen (R)
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
  abbr: "NE",
  name: "Nebraska",
};

export const DEFAULT_RACE_ID = "NE-GOV-2026";

export const RACES = [
  {
    raceId: "NE-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Lynne Walz (D)", "Jim Pillen (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NE: [
    {"raceId": "NE-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-04-06", "endDate": "2026-04-07", "sampleSize": 670, "sampleType": "RV", "results": {"Lynne Walz (D)": 33.0, "Jim Pillen (R)": 38.0, "Other": 12.0, "Undecided": 17.0}},
    {"raceId": "NE-GOV-2026", "pollster": "Lake Research Partners (D)", "startDate": "2026-04-25", "endDate": "2026-04-29", "sampleSize": 900, "sampleType": "LV", "results": {"Lynne Walz (D)": 45.0, "Jim Pillen (R)": 47.0, "Undecided": 5.0}},
    {"raceId": "NE-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-09-01", "endDate": "2026-09-02", "sampleSize": 559, "sampleType": "RV", "results": {"Lynne Walz (D)": 31.0, "Jim Pillen (R)": 32.0, "Other": 21.0, "Undecided": 17.0}},
    {"raceId": "NE-GOV-2026", "pollster": "SurveyUSA", "startDate": "2026-09-08", "endDate": "2026-09-13", "sampleSize": 503, "sampleType": "LV", "results": {"Lynne Walz (D)": 35.0, "Jim Pillen (R)": 43.0, "Other": 13.0, "Undecided": 9.0}},
    {"raceId": "NE-GOV-2026", "pollster": "Wedgewood Polls", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 500, "sampleType": "LV", "results": {"Lynne Walz (D)": 36.0, "Jim Pillen (R)": 53.0, "Other": 11.0}}
  ],
};
