// app/polling/governorpolling/idaho.ts
// Idaho — 2026 Governor: Terri Pickens (D) vs. Brad Little (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-16.

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
  abbr: "ID",
  name: "Idaho",
};

export const DEFAULT_RACE_ID = "ID-GOV-2026";

export const RACES = [
  {
    raceId: "ID-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Terri Pickens (D)", "Brad Little (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  ID: [
    {"raceId": "ID-GOV-2026", "pollster": "Change Research for the Stegner campaign", "startDate": "2026-07-28", "endDate": "2026-07-30", "sampleSize": 1213, "sampleType": "LV", "results": {"Terri Pickens (D)": 27.0, "Brad Little (R)": 48.0, "Other": 11.0, "Undecided": 13.0}},
    {"raceId": "ID-GOV-2026", "pollster": "Advanced Targeting Research", "startDate": "2026-09-13", "endDate": "2026-09-16", "sampleSize": 700, "sampleType": "RV", "results": {"Terri Pickens (D)": 27.0, "Brad Little (R)": 37.0}}
  ],
};
