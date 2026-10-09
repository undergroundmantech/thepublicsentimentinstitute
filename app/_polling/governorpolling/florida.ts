// app/polling/governorpolling/florida.ts
// Florida — 2026 Governor: David Jolly (D) vs. Byron Donalds (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-17.

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
  abbr: "FL",
  name: "Florida",
};

export const DEFAULT_RACE_ID = "FL-GOV-2026";

export const RACES = [
  {
    raceId: "FL-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["David Jolly (D)", "Byron Donalds (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  FL: [
    {"raceId": "FL-GOV-2026", "pollster": "Victory Insights", "startDate": "2025-06-07", "endDate": "2025-06-10", "sampleSize": 600, "sampleType": "LV", "results": {"Byron Donalds (R)": 37, "David Jolly (D)": 31, "Undecided": 32}, "moe": 2.8, "notes": "Victory Insights: no Other reported; Und 32."},
    {"raceId": "FL-GOV-2026", "pollster": "AIF Center", "startDate": "2025-08-25", "endDate": "2025-08-27", "sampleSize": 800, "sampleType": "LV", "results": {"Byron Donalds (R)": 49, "David Jolly (D)": 41, "Undecided": 11}, "moe": 3.5, "notes": "AIF Center: no Other reported; Und 11."},
    {"raceId": "FL-GOV-2026", "pollster": "Bendixen & Amandi International", "startDate": "2025-09-07", "endDate": "2025-09-09", "sampleSize": 631, "sampleType": "LV", "results": {"Byron Donalds (R)": 40, "David Jolly (D)": 41, "Undecided": 19}, "moe": 4, "notes": "Bendixen & Amandi: no Other reported; Und 19."},
    {"raceId": "FL-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2025-09-16", "endDate": "2025-09-18", "sampleSize": 1118, "sampleType": "RV", "results": {"Byron Donalds (R)": 36, "David Jolly (D)": 32, "Other": 4, "Undecided": 28}, "moe": 2.8, "notes": "Targoz: Donalds 36, Jolly 32, Other 4, Und 28."},
    {"raceId": "FL-GOV-2026", "pollster": "University of North Florida", "startDate": "2025-10-15", "endDate": "2025-10-25", "sampleSize": 728, "sampleType": "LV", "results": {"Byron Donalds (R)": 45, "David Jolly (D)": 34, "Other": 3, "Undecided": 18}, "moe": 4.3, "notes": "UNF: Donalds 45, Jolly 34, Other 3, Und 18."},
    {"raceId": "FL-GOV-2026", "pollster": "Change Research (D)", "startDate": "2026-09-07", "endDate": "2026-09-09", "sampleSize": 1107, "sampleType": "LV", "results": {"David Jolly (D)": 47.0, "Byron Donalds (R)": 44.0, "Other": 1.0, "Undecided": 7.0}},
    {"raceId": "FL-GOV-2026", "pollster": "St. Pete Polls", "startDate": "2026-09-15", "endDate": "2026-09-17", "sampleSize": 913, "sampleType": "LV", "results": {"David Jolly (D)": 43.0, "Byron Donalds (R)": 44.0, "Other": 4.0, "Undecided": 9.0}}
  ],
};
