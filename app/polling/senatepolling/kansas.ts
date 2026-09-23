// app/polling/senatepolling/kansas.ts
// Kansas — 2026 U.S. Senate: Adam Hamilton (D) vs. Roger Marshall (R)
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

export const DEFAULT_RACE_ID = "KS-SEN-2026";

export const RACES = [
  {
    raceId: "KS-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Adam Hamilton (D)", "Roger Marshall (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  KS: [
    {"raceId": "KS-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-08-07", "endDate": "2026-08-08", "sampleSize": 569, "sampleType": "LV", "results": {"Adam Hamilton (D)": 45.0, "Roger Marshall (R)": 46.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-08-12", "endDate": "2026-08-16", "sampleSize": 800, "sampleType": "LV", "results": {"Adam Hamilton (D)": 44.0, "Roger Marshall (R)": 43.0, "Other": 5.0, "Undecided": 8.0}},
    {"raceId": "KS-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 915, "sampleType": "LV", "results": {"Adam Hamilton (D)": 44.0, "Roger Marshall (R)": 49.0, "Other": 2.0, "Undecided": 5.0}},
    {"raceId": "KS-SEN-2026", "pollster": "Emerson College / Nexstar", "startDate": "2026-09-15", "endDate": "2026-09-16", "sampleSize": 750, "sampleType": "LV", "results": {"Adam Hamilton (D)": 45.0, "Roger Marshall (R)": 43.0, "Other": 4.0, "Undecided": 8.0}}
  ],
};
