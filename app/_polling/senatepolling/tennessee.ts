// app/polling/senatepolling/tennessee.ts
// Tennessee — 2026 U.S. Senate: Marquita Bradshaw (D) vs. Bill Hagerty (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-26.

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
  abbr: "TN",
  name: "Tennessee",
};

export const DEFAULT_RACE_ID = "TN-SEN-2026";

export const RACES = [
  {
    raceId: "TN-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Marquita Bradshaw (D)", "Bill Hagerty (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  TN: [
    {"raceId": "TN-SEN-2026", "pollster": "Targoz Market Research", "startDate": "2026-08-15", "endDate": "2026-08-26", "sampleSize": 1157, "sampleType": "RV", "results": {"Marquita Bradshaw (D)": 31.0, "Bill Hagerty (R)": 51.0, "Other": 6.0, "Undecided": 12.0}}
  ],
};
