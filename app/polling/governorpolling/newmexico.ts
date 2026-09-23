// app/polling/governorpolling/newmexico.ts
// New Mexico — 2026 Governor: Deb Haaland (D) vs. Gregg Hull (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-28.

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
  abbr: "NM",
  name: "New Mexico",
};

export const DEFAULT_RACE_ID = "NM-GOV-2026";

export const RACES = [
  {
    raceId: "NM-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Deb Haaland (D)", "Gregg Hull (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NM: [
    {"raceId": "NM-GOV-2026", "pollster": "McLaughlin & Associates (R) for the Hull campaign", "startDate": "2026-07-13", "endDate": "2026-07-15", "sampleSize": 400, "sampleType": "LV", "results": {"Deb Haaland (D)": 46.0, "Gregg Hull (R)": 45.0, "Undecided": 9.0}},
    {"raceId": "NM-GOV-2026", "pollster": "BSP Research", "startDate": "2026-07-22", "endDate": "2026-08-07", "sampleSize": 800, "sampleType": "RV", "results": {"Deb Haaland (D)": 41.0, "Gregg Hull (R)": 24.0, "Other": 3.0, "Undecided": 27.0}},
    {"raceId": "NM-GOV-2026", "pollster": "Research & Polling for the Albuquerque Journal", "startDate": "2026-08-28", "endDate": "2026-08-28", "sampleSize": 516, "sampleType": "LV", "results": {"Deb Haaland (D)": 49.0, "Gregg Hull (R)": 43.0, "Undecided": 8.0}}
  ],
};
