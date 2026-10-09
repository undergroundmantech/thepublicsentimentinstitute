// app/polling/governorpolling/wisconsin.ts
// Wisconsin — 2026 Governor: David Crowley (D) vs. Tom Tiffany (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-20.

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
  abbr: "WI",
  name: "Wisconsin",
};

export const DEFAULT_RACE_ID = "WI-GOV-2026";

export const RACES = [
  {
    raceId: "WI-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["David Crowley (D)", "Tom Tiffany (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  WI: [
    {"raceId": "WI-GOV-2026", "pollster": "Platform Communications (R)", "startDate": "2026-08-12", "endDate": "2026-08-13", "sampleSize": 500, "sampleType": "LV", "results": {"David Crowley (D)": 48.0, "Tom Tiffany (R)": 44.0, "Undecided": 8.0}},
    {"raceId": "WI-GOV-2026", "pollster": "TIPP Insights (R)", "startDate": "2026-08-14", "endDate": "2026-08-18", "sampleSize": 1199, "sampleType": "LV", "results": {"David Crowley (D)": 47.0, "Tom Tiffany (R)": 43.0, "Other": 4.0, "Undecided": 6.0}},
    {"raceId": "WI-GOV-2026", "pollster": "Marquette University", "startDate": "2026-08-12", "endDate": "2026-08-20", "sampleSize": 738, "sampleType": "LV", "results": {"David Crowley (D)": 49.0, "Tom Tiffany (R)": 44.0, "Undecided": 7.0}}
  ],
};
