// app/polling/governorpolling/southdakota.ts
// South Dakota — 2026 Governor: Dan Ahlers (D) vs. Larry Rhoden (R)
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
  abbr: "SD",
  name: "South Dakota",
};

export const DEFAULT_RACE_ID = "SD-GOV-2026";

export const RACES = [
  {
    raceId: "SD-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Dan Ahlers (D)", "Larry Rhoden (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  SD: [
    {"raceId": "SD-GOV-2026", "pollster": "Lake Research Partners (D)", "startDate": "2026-08-26", "endDate": "2026-08-30", "sampleSize": 500, "sampleType": "LV", "results": {"Dan Ahlers (D)": 44.0, "Larry Rhoden (R)": 51.0, "Undecided": 5.0}},
    {"raceId": "SD-GOV-2026", "pollster": "Concord Public Opinion Partners (D)", "startDate": "2026-10-06", "endDate": "2026-10-08", "sampleSize": 400, "sampleType": "LV", "results": {"Dan Ahlers (D)": 38.0, "Larry Rhoden (R)": 48.0, "Other": 4.0, "Undecided": 10.0}},
    {"raceId": "SD-GOV-2026", "pollster": "Mason-Dixon for South Dakota News Watch and USD Chiesman Center", "startDate": "2026-10-12", "endDate": "2026-10-14", "sampleSize": 500, "sampleType": "LV", "results": {"Dan Ahlers (D)": 36.0, "Larry Rhoden (R)": 56.0, "Undecided": 8.0}},
    {"raceId": "SD-GOV-2026", "pollster": "Emerson College", "startDate": "2026-10-19", "endDate": "2026-10-20", "sampleSize": 803, "sampleType": "LV", "results": {"Dan Ahlers (D)": 38.0, "Larry Rhoden (R)": 56.0, "Undecided": 6.0}}
  ],
};
