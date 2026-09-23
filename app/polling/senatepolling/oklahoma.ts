// app/polling/senatepolling/oklahoma.ts
// Oklahoma — 2026 U.S. Senate: N'Kiyla Jasmine Thomas (D) vs. Kevin Hern (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-06.

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
  abbr: "OK",
  name: "Oklahoma",
};

export const DEFAULT_RACE_ID = "OK-SEN-2026";

export const RACES = [
  {
    raceId: "OK-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["N'Kiyla Jasmine Thomas (D)", "Kevin Hern (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OK: [
    {"raceId": "OK-SEN-2026", "pollster": "CHS & Associates", "startDate": "2026-08-03", "endDate": "2026-08-06", "sampleSize": 500, "sampleType": "RV", "results": {"N'Kiyla Jasmine Thomas (D)": 25.0, "Kevin Hern (R)": 49.0, "Other": 8.0, "Undecided": 19.0}}
  ],
};
