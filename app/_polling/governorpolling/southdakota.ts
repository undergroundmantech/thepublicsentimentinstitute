// app/polling/governorpolling/southdakota.ts
// South Dakota — 2026 Governor: Dan Ahlers (D) vs. Larry Rhoden (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
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

  ],
};
