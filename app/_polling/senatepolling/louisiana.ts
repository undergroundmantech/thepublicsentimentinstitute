// app/polling/senatepolling/louisiana.ts
// Louisiana — 2026 U.S. Senate: Jamie Davis (D) vs. Julia Letlow (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-19.

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
  abbr: "LA",
  name: "Louisiana",
};

export const DEFAULT_RACE_ID = "LA-SEN-2026";

export const RACES = [
  {
    raceId: "LA-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Jamie Davis (D)", "Julia Letlow (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  LA: [
    {"raceId": "LA-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-21", "endDate": "2026-07-22", "sampleSize": 518, "sampleType": "RV", "results": {"Jamie Davis (D)": 37.0, "Julia Letlow (R)": 41.0, "Undecided": 22.0}},
    {"raceId": "LA-SEN-2026", "pollster": "Hart Research (D)", "startDate": "2026-09-17", "endDate": "2026-09-19", "sampleSize": 500, "sampleType": "LV", "results": {"Jamie Davis (D)": 44.0, "Julia Letlow (R)": 48.0, "Undecided": 8.0}}
  ],
};
