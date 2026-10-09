// app/polling/governorpolling/alabama.ts
// Alabama — 2026 Governor: Doug Jones (D) vs. Tommy Tuberville (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-07-11.

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
  abbr: "AL",
  name: "Alabama",
};

export const DEFAULT_RACE_ID = "AL-GOV-2026";

export const RACES = [
  {
    raceId: "AL-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Doug Jones (D)", "Tommy Tuberville (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AL: [
    {"raceId": "AL-GOV-2026", "pollster": "yes. every kid.", "startDate": "2026-07-08", "endDate": "2026-07-11", "sampleSize": 601, "sampleType": "LV", "results": {"Doug Jones (D)": 41.0, "Tommy Tuberville (R)": 49.0, "Undecided": 11.0}}
  ],
};
