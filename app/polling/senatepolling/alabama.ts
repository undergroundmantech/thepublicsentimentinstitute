// app/polling/senatepolling/alabama.ts
// Alabama — 2026 U.S. Senate: Everett Wess (D) vs. Barry Moore (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-07-11.

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
  abbr: "AL",
  name: "Alabama",
};

export const DEFAULT_RACE_ID = "AL-SEN-2026";

export const RACES = [
  {
    raceId: "AL-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Everett Wess (D)", "Barry Moore (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AL: [
    {"raceId": "AL-SEN-2026", "pollster": "yes. every kid.", "startDate": "2026-07-08", "endDate": "2026-07-11", "sampleSize": 601, "sampleType": "LV", "results": {"Everett Wess (D)": 32.0, "Barry Moore (R)": 47.0, "Other": 1.0, "Undecided": 20.0}}
  ],
};
