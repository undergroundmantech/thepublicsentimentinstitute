// app/polling/governorpolling/southcarolina.ts
// South Carolina — 2026 Governor: Jermaine Johnson (D) vs. Alan Wilson (R)
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
  abbr: "SC",
  name: "South Carolina",
};

export const DEFAULT_RACE_ID = "SC-GOV-2026";

export const RACES = [
  {
    raceId: "SC-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Jermaine Johnson (D)", "Alan Wilson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SC: [
    {"raceId": "SC-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-16", "endDate": "2026-07-17", "sampleSize": 577, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 37.0, "Alan Wilson (R)": 45.0, "Undecided": 17.0}},
    {"raceId": "SC-GOV-2026", "pollster": "Hart Research (D)", "startDate": "2026-08-12", "endDate": "2026-08-15", "sampleSize": 600, "sampleType": "RV", "results": {"Jermaine Johnson (D)": 42.0, "Alan Wilson (R)": 50.0, "Undecided": 8.0}}
  ],
};
