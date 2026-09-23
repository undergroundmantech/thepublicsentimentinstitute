// app/polling/governorpolling/vermont.ts
// Vermont — 2026 Governor: Amanda Janoo (D) vs. Phil Scott (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-07-20.

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
  abbr: "VT",
  name: "Vermont",
};

export const DEFAULT_RACE_ID = "VT-GOV-2026";

export const RACES = [
  {
    raceId: "VT-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Amanda Janoo (D)", "Phil Scott (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  VT: [
    {"raceId": "VT-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-06-18", "endDate": "2026-06-23", "sampleSize": 887, "sampleType": "LV", "results": {"Amanda Janoo (D)": 27.0, "Phil Scott (R)": 42.0, "Other": 5.0, "Undecided": 26.0}},
    {"raceId": "VT-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-07-15", "endDate": "2026-07-20", "sampleSize": 954, "sampleType": "LV", "results": {"Amanda Janoo (D)": 33.0, "Phil Scott (R)": 44.0, "Other": 6.0, "Undecided": 17.0}}
  ],
};
