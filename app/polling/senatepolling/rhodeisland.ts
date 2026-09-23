// app/polling/senatepolling/rhodeisland.ts
// Rhode Island — 2026 U.S. Senate: Jack Reed (D) vs. Raymond McKay (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-24.

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
  abbr: "RI",
  name: "Rhode Island",
};

export const DEFAULT_RACE_ID = "RI-SEN-2026";

export const RACES = [
  {
    raceId: "RI-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Jack Reed (D)", "Raymond McKay (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  RI: [
    {"raceId": "RI-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-04-16", "endDate": "2026-04-20", "sampleSize": 556, "sampleType": "LV", "results": {"Jack Reed (D)": 52.0, "Raymond McKay (R)": 34.0, "Other": 2.0, "Undecided": 12.0}},
    {"raceId": "RI-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 664, "sampleType": "LV", "results": {"Jack Reed (D)": 52.0, "Raymond McKay (R)": 35.0, "Other": 1.0, "Undecided": 12.0}},
    {"raceId": "RI-SEN-2026", "pollster": "University of New Hampshire", "startDate": "2026-08-20", "endDate": "2026-08-24", "sampleSize": 750, "sampleType": "LV", "results": {"Jack Reed (D)": 51.0, "Raymond McKay (R)": 31.0, "Other": 6.0, "Undecided": 13.0}}
  ],
};
