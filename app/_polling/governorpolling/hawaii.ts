// app/polling/governorpolling/hawaii.ts
// Hawaii — 2026 Governor: Josh Green (D) vs. Gary Cordery (R)
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
  abbr: "HI",
  name: "Hawaii",
};

export const DEFAULT_RACE_ID = "HI-GOV-2026";

export const RACES = [
  {
    raceId: "HI-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Josh Green (D)", "Gary Cordery (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  HI: [

  ],
};
