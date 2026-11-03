// app/polling/senatepolling/colorado.ts
// Colorado — 2026 U.S. Senate: John Hickenlooper (D) vs. Mark Baisley (R)
// Generated from the On Point Polling forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: -.

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
  abbr: "CO",
  name: "Colorado",
};

export const DEFAULT_RACE_ID = "CO-SEN-2026";

export const RACES = [
  {
    raceId: "CO-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["John Hickenlooper (D)", "Mark Baisley (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  CO: [
    {"raceId": "CO-SEN-2026", "pollster": "Lake Research Partners (D)", "startDate": "2026-09-16", "endDate": "2026-09-30", "sampleSize": 600, "sampleType": "RV", "results": {"John Hickenlooper (D)": 52.0, "Mark Baisley (R)": 38.0, "Undecided": 10.0}},
    {"raceId": "CO-SEN-2026", "pollster": "University of Colorado/YouGov", "startDate": "2026-10-09", "endDate": "2026-10-20", "sampleSize": 710, "sampleType": "LV", "results": {"John Hickenlooper (D)": 57.0, "Mark Baisley (R)": 39.0, "Other": 1.0, "Undecided": 3.0}},
    {"raceId": "CO-SEN-2026", "pollster": "Research Co.", "startDate": "2026-10-31", "endDate": "2026-11-02", "sampleSize": 450, "sampleType": "LV", "results": {"John Hickenlooper (D)": 61.0, "Mark Baisley (R)": 37.0, "Other": 2.0}}
  ],
};
