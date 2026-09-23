// app/polling/senatepolling/virginia.ts
// Virginia — 2026 U.S. Senate: Mark Warner (D) vs. Bert Mizusawa (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-06-16.

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
  abbr: "VA",
  name: "Virginia",
};

export const DEFAULT_RACE_ID = "VA-SEN-2026";

export const RACES = [
  {
    raceId: "VA-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Mark Warner (D)", "Bert Mizusawa (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  VA: [
    {"raceId": "VA-SEN-2026", "pollster": "The Public Sentiment Institute/Virginia Project (R)", "startDate": "2026-05-01", "endDate": "2026-05-05", "sampleSize": 1047, "sampleType": "LV", "results": {"Mark Warner (D)": 55.0, "Bert Mizusawa (R)": 29.0, "Other": 3.0, "Undecided": 14.0}},
    {"raceId": "VA-SEN-2026", "pollster": "The Public Sentiment Institute", "startDate": "2026-06-12", "endDate": "2026-06-16", "sampleSize": 996, "sampleType": "LV", "results": {"Mark Warner (D)": 51.0, "Bert Mizusawa (R)": 33.0, "Other": 3.0, "Undecided": 14.0}}
  ],
};
