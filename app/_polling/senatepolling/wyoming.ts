// app/polling/senatepolling/wyoming.ts
// Wyoming — 2026 U.S. Senate: James Byrd (D) vs. Harriet Hageman (R)
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
  abbr: "WY",
  name: "Wyoming",
};

export const DEFAULT_RACE_ID = "WY-SEN-2026";

export const RACES = [
  {
    raceId: "WY-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["James Byrd (D)", "Harriet Hageman (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  WY: [

  ],
};
