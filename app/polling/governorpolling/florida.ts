// app/polling/governorpolling/florida.ts
// Florida — 2026 Governor: David Jolly (D) vs. Byron Donalds (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-28. Full public poll list as of 2026-09-28.

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
    {"raceId": "FL-GOV-2026", "pollster": "Victory Insights (R)", "startDate": "2025-06-07", "endDate": "2025-06-10", "sampleSize": 600, "sampleType": "LV", "moe": 2.8, "results": {"David Jolly (D)": 31.0, "Byron Donalds (R)": 37.0, "Undecided": 32.0}},
    {"raceId": "FL-GOV-2026", "pollster": "AIF Center (R)", "startDate": "2025-08-25", "endDate": "2025-08-27", "sampleSize": 800, "sampleType": "LV", "moe": 3.5, "results": {"David Jolly (D)": 41.0, "Byron Donalds (R)": 49.0, "Undecided": 11.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Bendixen & Amandi International (D)", "startDate": "2025-09-07", "endDate": "2025-09-09", "sampleSize": 631, "sampleType": "LV", "moe": 4.0, "results": {"David Jolly (D)": 41.0, "Byron Donalds (R)": 40.0, "Undecided": 19.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2025-09-16", "endDate": "2025-09-18", "sampleSize": 1118, "sampleType": "RV", "moe": 2.8, "results": {"David Jolly (D)": 32.0, "Byron Donalds (R)": 36.0, "Other": 4.0, "Undecided": 28.0}},
    {"raceId": "FL-GOV-2026", "pollster": "University of North Florida", "startDate": "2025-10-15", "endDate": "2025-10-25", "sampleSize": 728, "sampleType": "LV", "moe": 4.3, "results": {"David Jolly (D)": 34.0, "Byron Donalds (R)": 45.0, "Other": 3.0, "Undecided": 18.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2026-02-13", "endDate": "2026-02-16", "sampleSize": 1129, "sampleType": "LV", "moe": 2.8, "results": {"David Jolly (D)": 36.0, "Byron Donalds (R)": 41.0, "Other": 6.0, "Undecided": 12.0}},
    {"raceId": "FL-GOV-2026", "pollster": "University of North Florida", "startDate": "2026-02-21", "endDate": "2026-03-02", "sampleSize": 786, "sampleType": "LV", "moe": 4.0, "results": {"David Jolly (D)": 36.0, "Byron Donalds (R)": 42.0, "Other": 5.0, "Undecided": 17.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Emerson College", "startDate": "2026-03-29", "endDate": "2026-03-31", "sampleSize": 1165, "sampleType": "LV", "moe": 2.8, "results": {"David Jolly (D)": 39.0, "Byron Donalds (R)": 44.0, "Other": 2.0, "Undecided": 17.0}},
    {"raceId": "FL-GOV-2026", "pollster": "MDW Communications (D)", "startDate": "2026-03-27", "endDate": "2026-04-03", "sampleSize": 1834, "sampleType": "LV", "moe": 2.0, "results": {"David Jolly (D)": 41.0, "Byron Donalds (R)": 41.0, "Undecided": 18.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Echelon Insights", "startDate": "2026-04-03", "endDate": "2026-04-09", "sampleSize": 406, "sampleType": "LV", "moe": 6.0, "results": {"David Jolly (D)": 43.0, "Byron Donalds (R)": 49.0, "Undecided": 8.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Stetson University", "startDate": "2026-03-15", "endDate": "2026-04-13", "sampleSize": 848, "sampleType": "LV", "moe": 4.1, "results": {"David Jolly (D)": 40.0, "Byron Donalds (R)": 47.0, "Undecided": 7.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Cherry Communications (R)", "startDate": "2026-05-01", "endDate": "2026-05-09", "sampleSize": 604, "sampleType": "LV", "moe": 4.0, "results": {"David Jolly (D)": 39.0, "Byron Donalds (R)": 47.0, "Undecided": 14.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Change Research (D)", "startDate": "2026-05-13", "endDate": "2026-05-16", "sampleSize": 1593, "sampleType": "LV", "moe": 2.3, "results": {"David Jolly (D)": 46.0, "Byron Donalds (R)": 42.0, "Other": 4.0, "Undecided": 8.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Change Research (D)", "startDate": "2026-07-09", "endDate": "2026-07-11", "sampleSize": 1348, "sampleType": "RV", "moe": 2.8, "results": {"David Jolly (D)": 39.0, "Byron Donalds (R)": 38.5, "Other": 9.0, "Undecided": 14.0}, "notes": "Two versions released, 37 to 37 and 41 to 40 Jolly; averaged, as the forecast does."},
    {"raceId": "FL-GOV-2026", "pollster": "University of North Florida", "startDate": "2026-07-08", "endDate": "2026-07-17", "sampleSize": 848, "sampleType": "LV", "moe": 3.8, "results": {"David Jolly (D)": 41.0, "Byron Donalds (R)": 46.0, "Other": 7.0, "Undecided": 6.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Targoz Market Research", "startDate": "2026-07-20", "endDate": "2026-07-26", "sampleSize": 1026, "sampleType": "LV", "results": {"David Jolly (D)": 38.0, "Byron Donalds (R)": 45.0, "Undecided": 17.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Hart Research Associates (D)", "startDate": "2026-08-10", "endDate": "2026-08-13", "sampleSize": 600, "sampleType": "LV", "moe": 4.0, "results": {"David Jolly (D)": 46.0, "Byron Donalds (R)": 45.0, "Undecided": 9.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Change Research (D)", "startDate": "2026-09-07", "endDate": "2026-09-09", "sampleSize": 1107, "sampleType": "LV", "moe": 2.8, "results": {"David Jolly (D)": 47.0, "Byron Donalds (R)": 44.0, "Other": 1.0, "Undecided": 7.0}},
    {"raceId": "FL-GOV-2026", "pollster": "St. Pete Polls", "startDate": "2026-09-15", "endDate": "2026-09-17", "sampleSize": 913, "sampleType": "LV", "moe": 3.2, "results": {"David Jolly (D)": 43.0, "Byron Donalds (R)": 44.0, "Other": 4.0, "Undecided": 9.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Stetson University", "startDate": "2026-09-14", "endDate": "2026-09-21", "sampleSize": 830, "sampleType": "LV", "moe": 4.3, "results": {"David Jolly (D)": 39.0, "Byron Donalds (R)": 51.0, "Other": 5.0, "Undecided": 5.0}},
    {"raceId": "FL-GOV-2026", "pollster": "Change Research", "startDate": "2026-09-26", "endDate": "2026-09-28", "sampleSize": 1063, "sampleType": "LV", "results": {"David Jolly (D)": 48.0, "Byron Donalds (R)": 47.0}},
  ],
};
