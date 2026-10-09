// app/polling/senatepolling/illinois.ts
// Illinois — 2026 U.S. Senate: Juliana Stratton (D) vs. Don Tracy (R)
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
  abbr: "IL",
  name: "Illinois",
};

export const DEFAULT_RACE_ID = "IL-SEN-2026";

export const RACES = [
  {
    raceId: "IL-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Juliana Stratton (D)", "Don Tracy (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  IL: [

  ],
};
