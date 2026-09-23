// app/polling/governorpolling/arkansas.ts
// Arkansas — 2026 Governor: Fredrick Love (D) vs. Sarah Huckabee Sanders (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-12.

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
  abbr: "AR",
  name: "Arkansas",
};

export const DEFAULT_RACE_ID = "AR-GOV-2026";

export const RACES = [
  {
    raceId: "AR-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Fredrick Love (D)", "Sarah Huckabee Sanders (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AR: [
    {"raceId": "AR-GOV-2026", "pollster": "Talk Business & Politics / Hendrix College", "startDate": "2026-08-12", "endDate": "2026-08-12", "sampleSize": 1217, "sampleType": "LV", "results": {"Fredrick Love (D)": 40.0, "Sarah Huckabee Sanders (R)": 45.0, "Other": 7.0, "Undecided": 8.0}}
  ],
};
