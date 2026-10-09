// app/polling/governorpolling/illinois.ts
// Illinois — 2026 Governor: JB Pritzker (D) vs. Darren Bailey (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2025-11-25.

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
  abbr: "IL",
  name: "Illinois",
};

export const DEFAULT_RACE_ID = "IL-GOV-2026";

export const RACES = [
  {
    raceId: "IL-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["JB Pritzker (D)", "Darren Bailey (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  IL: [
    {"raceId": "IL-GOV-2026", "pollster": "Victory Research", "startDate": "2025-11-25", "endDate": "2025-11-25", "sampleSize": 1208, "sampleType": "LV", "results": {"JB Pritzker (D)": 54.0, "Darren Bailey (R)": 34.0, "Undecided": 12.0}}
  ],
};
