// app/polling/governorpolling/maine.ts
// Maine — 2026 Governor: Hannah Pingree (D) vs. Bobby Charles (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-10.

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
  abbr: "ME",
  name: "Maine",
};

export const DEFAULT_RACE_ID = "ME-GOV-2026";

export const RACES = [
  {
    raceId: "ME-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Hannah Pingree (D)", "Bobby Charles (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  ME: [
    {"raceId": "ME-GOV-2026", "pollster": "New York Times / Portland Press Herald / Siena", "startDate": "2026-06-19", "endDate": "2026-06-26", "sampleSize": 608, "sampleType": "LV", "results": {"Hannah Pingree (D)": 50.0, "Bobby Charles (R)": 36.0, "Other": 8.0, "Undecided": 5.0}},
    {"raceId": "ME-GOV-2026", "pollster": "University of New Hampshire", "startDate": "2026-07-15", "endDate": "2026-07-20", "sampleSize": 1178, "sampleType": "LV", "results": {"Hannah Pingree (D)": 49.0, "Bobby Charles (R)": 35.0, "Other": 7.0, "Undecided": 8.0}},
    {"raceId": "ME-GOV-2026", "pollster": "Beacon Research / Shaw & Co.", "startDate": "2026-08-10", "endDate": "2026-08-10", "sampleSize": 1000, "sampleType": "RV", "results": {"Hannah Pingree (D)": 49.0, "Bobby Charles (R)": 38.0, "Other": 9.0, "Undecided": 3.0}}
  ],
};
