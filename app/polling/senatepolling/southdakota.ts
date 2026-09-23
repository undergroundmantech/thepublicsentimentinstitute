// app/polling/senatepolling/southdakota.ts
// South Dakota — 2026 U.S. Senate: Brian Bengs (I) vs. Mike Rounds (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-09.
// Bengs runs as an independent after the Democratic nominee withdrew. Two candidate
// ballot, no third party line.

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
  abbr: "SD",
  name: "South Dakota",
};

export const DEFAULT_RACE_ID = "SD-SEN-2026";

export const RACES = [
  {
    raceId: "SD-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Brian Bengs (I)", "Mike Rounds (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SD: [
    {"raceId": "SD-SEN-2026", "pollster": "Public Opinion Strategies (R)", "startDate": "2026-07-06", "endDate": "2026-07-09", "sampleSize": 500, "sampleType": "LV", "results": {"Brian Bengs (I)": 33.0, "Mike Rounds (R)": 56.0, "Undecided": 11.0}},
    {"raceId": "SD-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-13", "endDate": "2026-08-17", "sampleSize": 500, "sampleType": "LV", "results": {"Brian Bengs (I)": 44.0, "Mike Rounds (R)": 44.0, "Undecided": 12.0}},
    {"raceId": "SD-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-09-08", "endDate": "2026-09-09", "sampleSize": 629, "sampleType": "RV", "results": {"Brian Bengs (I)": 42.0, "Mike Rounds (R)": 45.0, "Undecided": 13.0}}
  ],
};
