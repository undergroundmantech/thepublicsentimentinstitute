// app/polling/governorpolling/nevada.ts
// Nevada — 2026 Governor: Aaron Ford (D) vs. Joe Lombardo (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-08.

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
  abbr: "NV",
  name: "Nevada",
};

export const DEFAULT_RACE_ID = "NV-GOV-2026";

export const RACES = [
  {
    raceId: "NV-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Aaron Ford (D)", "Joe Lombardo (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NV: [
    {"raceId": "NV-GOV-2026", "pollster": "Vote TXT", "startDate": "2023-05-15", "endDate": "2023-05-19", "sampleSize": 412, "sampleType": "RV", "results": {"Joe Lombardo (R)": 51, "Aaron Ford (D)": 30, "Other": 7, "Undecided": 12}, "moe": 4.7, "notes": "Older poll (2023): Lombardo 51, Ford 30, Other 7, Und 12."},
    {"raceId": "NV-GOV-2026", "pollster": "Noble Predictive Insights", "startDate": "2025-10-07", "endDate": "2025-10-13", "sampleSize": 766, "sampleType": "RV", "results": {"Joe Lombardo (R)": 40, "Aaron Ford (D)": 37, "Undecided": 23}, "moe": 3.5, "notes": "Noble: Lombardo 40, Ford 37; no Other reported; Und 23."},
    {"raceId": "NV-GOV-2026", "pollster": "Emerson College", "startDate": "2025-11-16", "endDate": "2025-11-18", "sampleSize": 800, "sampleType": "RV", "results": {"Joe Lombardo (R)": 41, "Aaron Ford (D)": 41, "Undecided": 18}, "moe": 3.4, "notes": "Emerson: tie 41–41; no Other reported; Und 18."},
    {"raceId": "NV-GOV-2026", "pollster": "Public Opinion Strategies (R)", "startDate": "2026-06-27", "endDate": "2026-06-29", "sampleSize": 600, "sampleType": "LV", "results": {"Aaron Ford (D)": 42.0, "Joe Lombardo (R)": 51.0, "Undecided": 7.0}},
    {"raceId": "NV-GOV-2026", "pollster": "Grassroots Targeting (R)", "startDate": "2026-07-06", "endDate": "2026-07-08", "sampleSize": 500, "sampleType": "LV", "results": {"Aaron Ford (D)": 40.0, "Joe Lombardo (R)": 52.0, "Undecided": 8.0}},
    {"raceId": "NV-GOV-2026", "pollster": "Wedgewood Polls (D)", "startDate": "2026-07-09", "endDate": "2026-07-12", "sampleSize": 700, "sampleType": "LV", "results": {"Aaron Ford (D)": 47.0, "Joe Lombardo (R)": 50.0, "Undecided": 3.0}},
    {"raceId": "NV-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-07-15", "endDate": "2026-07-16", "sampleSize": 558, "sampleType": "LV", "results": {"Aaron Ford (D)": 44.0, "Joe Lombardo (R)": 44.0, "Undecided": 12.0}},
    {"raceId": "NV-GOV-2026", "pollster": "Tarrance Group (R)", "startDate": "2026-07-25", "endDate": "2026-07-29", "sampleSize": 519, "sampleType": "LV", "results": {"Aaron Ford (D)": 43.0, "Joe Lombardo (R)": 50.0, "Undecided": 7.0}},
    {"raceId": "NV-GOV-2026", "pollster": "Emerson College", "startDate": "2026-09-05", "endDate": "2026-09-08", "sampleSize": 680, "sampleType": "LV", "results": {"Aaron Ford (D)": 44.0, "Joe Lombardo (R)": 42.0, "Other": 2.0, "Undecided": 11.0}}
  ],
};
