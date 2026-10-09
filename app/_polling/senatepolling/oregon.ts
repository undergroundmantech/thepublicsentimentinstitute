// app/polling/senatepolling/oregon.ts
// Oregon — 2026 U.S. Senate: Jeff Merkley (D) vs. David Brock Smith (R)
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
  abbr: "OR",
  name: "Oregon",
};

export const DEFAULT_RACE_ID = "OR-SEN-2026";

export const RACES = [
  {
    raceId: "OR-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Jeff Merkley (D)", "David Brock Smith (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OR: [

  ],
};
