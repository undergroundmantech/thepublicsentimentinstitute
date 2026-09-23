// app/polling/governorpolling/colorado.ts
// Colorado — 2026 Governor: Phil Weiser (D) vs. Victor Marx (R)
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
  abbr: "CO",
  name: "Colorado",
};

export const DEFAULT_RACE_ID = "CO-GOV-2026";

export const RACES = [
  {
    raceId: "CO-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Phil Weiser (D)", "Victor Marx (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  CO: [

  ],
};
