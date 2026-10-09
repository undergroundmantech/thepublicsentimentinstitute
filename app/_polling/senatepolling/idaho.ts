// app/polling/senatepolling/idaho.ts
// Idaho — 2026 U.S. Senate: Todd Achilles (I) vs. Jim Risch (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-16.
// Achilles runs as an independent after the Democratic nominee withdrew. Also on the
// ballot: Natalie Fleming (I) and Matt Loesby (L).

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
  abbr: "ID",
  name: "Idaho",
};

export const DEFAULT_RACE_ID = "ID-SEN-2026";

export const RACES = [
  {
    raceId: "ID-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Todd Achilles (I)", "Jim Risch (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  ID: [
    {"raceId": "ID-SEN-2026", "pollster": "The Bullfinch Group", "startDate": "2026-05-29", "endDate": "2026-06-01", "sampleSize": 774, "sampleType": "RV", "results": {"Todd Achilles (I)": 36.0, "Jim Risch (R)": 40.0, "Undecided": 24.0}},
    {"raceId": "ID-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-07-28", "endDate": "2026-07-30", "sampleSize": 1213, "sampleType": "LV", "results": {"Todd Achilles (I)": 21.0, "Jim Risch (R)": 45.0, "Other": 11.0, "Undecided": 22.0}},
    {"raceId": "ID-SEN-2026", "pollster": "The Bullfinch Group", "startDate": "2026-08-04", "endDate": "2026-08-07", "sampleSize": 608, "sampleType": "LV", "results": {"Todd Achilles (I)": 34.0, "Jim Risch (R)": 33.5, "Other": 2.0, "Undecided": 30.5}},
    {"raceId": "ID-SEN-2026", "pollster": "Peak Insights (R)", "startDate": "2026-08-11", "endDate": "2026-08-13", "sampleSize": 500, "sampleType": "LV", "results": {"Todd Achilles (I)": 18.0, "Jim Risch (R)": 52.0, "Other": 12.0, "Undecided": 17.0}},
    {"raceId": "ID-SEN-2026", "pollster": "Advanced Targeting Research", "startDate": "2026-09-13", "endDate": "2026-09-16", "sampleSize": 700, "sampleType": "RV", "results": {"Todd Achilles (I)": 48.0, "Jim Risch (R)": 39.0, "Other": 2.5, "Undecided": 11.0}}
  ],
};
