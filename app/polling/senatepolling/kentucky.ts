// app/polling/senatepolling/kentucky.ts
// Kentucky — 2026 U.S. Senate: Charles Booker (D) vs. Andy Barr (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-27.

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
  abbr: "KY",
  name: "Kentucky",
};

export const DEFAULT_RACE_ID = "KY-SEN-2026";

export const RACES = [
  {
    raceId: "KY-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Charles Booker (D)", "Andy Barr (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  KY: [
    {"raceId": "KY-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2025-12-18", "endDate": "2025-12-19", "sampleSize": 650, "sampleType": "RV", "results": {"Charles Booker (D)": 38.0, "Andy Barr (R)": 49.0, "Undecided": 13.0}},
    {"raceId": "KY-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-08-24", "endDate": "2026-08-27", "sampleSize": 600, "sampleType": "LV", "results": {"Charles Booker (D)": 40.0, "Andy Barr (R)": 49.0, "Undecided": 11.0}}
  ],
};
