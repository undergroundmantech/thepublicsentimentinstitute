// app/polling/senatepolling/newmexico.ts
// New Mexico — 2026 U.S. Senate: Ben Ray Luján (D) vs. Larry Marker (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-28.

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
  abbr: "NM",
  name: "New Mexico",
};

export const DEFAULT_RACE_ID = "NM-SEN-2026";

export const RACES = [
  {
    raceId: "NM-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Ben Ray Luján (D)", "Larry Marker (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NM: [
    {"raceId": "NM-SEN-2026", "pollster": "Research & Polling Inc.", "startDate": "2026-08-21", "endDate": "2026-08-28", "sampleSize": 516, "sampleType": "LV", "results": {"Ben Ray Luján (D)": 53.0, "Larry Marker (R)": 38.0, "Undecided": 9.0}}
  ],
};
