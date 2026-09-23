// app/polling/governorpolling/tennessee.ts
// Tennessee — 2026 Governor: Jerri Green (D) vs. Marsha Blackburn (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-26.

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
  abbr: "TN",
  name: "Tennessee",
};

export const DEFAULT_RACE_ID = "TN-GOV-2026";

export const RACES = [
  {
    raceId: "TN-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Jerri Green (D)", "Marsha Blackburn (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  TN: [
    {"raceId": "TN-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2026-04-20", "endDate": "2026-04-27", "sampleSize": 1200, "sampleType": "RV", "results": {"Jerri Green (D)": 27.0, "Marsha Blackburn (R)": 51.0, "Undecided": 22.0}},
    {"raceId": "TN-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2026-08-15", "endDate": "2026-08-26", "sampleSize": 1149, "sampleType": "RV", "results": {"Jerri Green (D)": 33.0, "Marsha Blackburn (R)": 46.0, "Other": 8.0, "Undecided": 14.0}}
  ],
};
