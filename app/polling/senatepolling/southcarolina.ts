// app/polling/senatepolling/southcarolina.ts
// South Carolina — 2026 U.S. Senate: Annie Andrews (D) vs. Darline Graham (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-09.

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
  abbr: "SC",
  name: "South Carolina",
};

export const DEFAULT_RACE_ID = "SC-SEN-2026";

export const RACES = [
  {
    raceId: "SC-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Annie Andrews (D)", "Darline Graham (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SC: [
    {"raceId": "SC-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-14", "endDate": "2026-08-22", "sampleSize": 900, "sampleType": "LV", "results": {"Annie Andrews (D)": 42.0, "Darline Graham (R)": 39.0, "Other": 6.0, "Undecided": 13.0}},
    {"raceId": "SC-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-18", "endDate": "2026-08-24", "sampleSize": 700, "sampleType": "LV", "results": {"Annie Andrews (D)": 41.0, "Darline Graham (R)": 41.0, "Other": 5.0, "Undecided": 13.0}},
    {"raceId": "SC-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-09-08", "endDate": "2026-09-09", "sampleSize": 1200, "sampleType": "LV", "results": {"Annie Andrews (D)": 43.0, "Darline Graham (R)": 45.0, "Other": 3.0, "Undecided": 9.0}}
  ],
};
