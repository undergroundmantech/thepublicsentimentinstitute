// app/polling/governorpolling/oklahoma.ts
// Oklahoma — 2026 Governor: Cyndi Munson (D) vs. Mike Mazzei (R)
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
  abbr: "OK",
  name: "Oklahoma",
};

export const DEFAULT_RACE_ID = "OK-GOV-2026";

export const RACES = [
  {
    raceId: "OK-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Cyndi Munson (D)", "Mike Mazzei (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OK: [

  ],
};
