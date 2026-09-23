// app/polling/governorpolling/oregon.ts
// Oregon — 2026 Governor: Tina Kotek (D) vs. Christine Drazan (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-09.

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

export const DEFAULT_RACE_ID = "OR-GOV-2026";

export const RACES = [
  {
    raceId: "OR-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Tina Kotek (D)", "Christine Drazan (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OR: [
    {"raceId": "OR-GOV-2026", "pollster": "Public Opinion Strategies (R)", "startDate": "2026-06-22", "endDate": "2026-06-24", "sampleSize": 600, "sampleType": "RV", "results": {"Tina Kotek (D)": 44.0, "Christine Drazan (R)": 48.0, "Undecided": 8.0}},
    {"raceId": "OR-GOV-2026", "pollster": "DHM Research", "startDate": "2026-09-03", "endDate": "2026-09-09", "sampleSize": 600, "sampleType": "LV", "results": {"Tina Kotek (D)": 43.0, "Christine Drazan (R)": 45.0, "Other": 4.0, "Undecided": 13.0}}
  ],
};
