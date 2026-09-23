// app/polling/senatepolling/mississippi.ts
// Mississippi — 2026 U.S. Senate: Scott Colom (D) vs. Cindy Hyde-Smith (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-15.

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
  abbr: "MS",
  name: "Mississippi",
};

export const DEFAULT_RACE_ID = "MS-SEN-2026";

export const RACES = [
  {
    raceId: "MS-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Scott Colom (D)", "Cindy Hyde-Smith (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MS: [
    {"raceId": "MS-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-04-08", "endDate": "2026-04-12", "sampleSize": 500, "sampleType": "LV", "results": {"Scott Colom (D)": 39.0, "Cindy Hyde-Smith (R)": 42.0, "Other": 6.0, "Undecided": 13.0}},
    {"raceId": "MS-SEN-2026", "pollster": "Data for Progress (D)", "startDate": "2026-08-05", "endDate": "2026-08-15", "sampleSize": 1018, "sampleType": "LV", "results": {"Scott Colom (D)": 38.0, "Cindy Hyde-Smith (R)": 44.0, "Other": 7.0, "Undecided": 11.0}}
  ],
};
