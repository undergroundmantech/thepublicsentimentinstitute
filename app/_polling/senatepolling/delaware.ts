// app/polling/senatepolling/delaware.ts
// Delaware — 2026 U.S. Senate: Chris Coons (D) vs. Michael Katz (R)
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
  abbr: "DE",
  name: "Delaware",
};

export const DEFAULT_RACE_ID = "DE-SEN-2026";

export const RACES = [
  {
    raceId: "DE-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Chris Coons (D)", "Michael Katz (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  DE: [

  ],
};
