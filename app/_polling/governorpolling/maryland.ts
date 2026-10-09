// app/polling/governorpolling/maryland.ts
// Maryland — 2026 Governor: Wes Moore (D) vs. Dan Cox (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-03.

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
  abbr: "MD",
  name: "Maryland",
};

export const DEFAULT_RACE_ID = "MD-GOV-2026";

export const RACES = [
  {
    raceId: "MD-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Wes Moore (D)", "Dan Cox (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MD: [
    {"raceId": "MD-GOV-2026", "pollster": "Zenith Research", "startDate": "2026-07-27", "endDate": "2026-08-03", "sampleSize": 800, "sampleType": "LV", "results": {"Wes Moore (D)": 58.0, "Dan Cox (R)": 31.0, "Other": 3.0, "Undecided": 9.0}}
  ],
};
