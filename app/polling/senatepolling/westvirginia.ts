// app/polling/senatepolling/westvirginia.ts
// West Virginia — 2026 U.S. Senate: Rachel Fetty Anderson (D) vs. Shelley Moore Capito (R)
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
  abbr: "WV",
  name: "West Virginia",
};

export const DEFAULT_RACE_ID = "WV-SEN-2026";

export const RACES = [
  {
    raceId: "WV-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Rachel Fetty Anderson (D)", "Shelley Moore Capito (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  WV: [

  ],
};
