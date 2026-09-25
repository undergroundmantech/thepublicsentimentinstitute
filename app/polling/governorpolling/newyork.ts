// app/polling/governorpolling/newyork.ts
// New York — 2026 Governor: Kathy Hochul (D) vs. Bruce Blakeman (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-20.

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
  abbr: "NY",
  name: "New York",
};

export const DEFAULT_RACE_ID = "NY-GOV-2026";

export const RACES = [
  {
    raceId: "NY-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Kathy Hochul (D)", "Bruce Blakeman (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NY: [
    {"raceId": "NY-GOV-2026", "pollster": "GrayHouse", "startDate": "2025-04-22", "endDate": "2025-04-24", "sampleSize": 600, "sampleType": "RV", "results": {"Kathy Hochul (D)": 44, "Bruce Blakeman (R)": 36, "Undecided": 20}, "moe": 4, "notes": "GrayHouse Apr 22–24, 2025: Hochul 44, Blakeman 36, Und 20."},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2025-06-23", "endDate": "2025-06-26", "sampleSize": 800, "sampleType": "RV", "results": {"Kathy Hochul (D)": 44, "Bruce Blakeman (R)": 19, "Undecided": 37}, "moe": 4.4, "notes": "Siena Jun 23–26, 2025: Hochul 44, Blakeman 19, Und 37."},
    {"raceId": "NY-GOV-2026", "pollster": "J.L. Partners", "startDate": "2025-11-09", "endDate": "2025-11-10", "sampleSize": 500, "sampleType": "LV", "results": {"Kathy Hochul (D)": 47, "Bruce Blakeman (R)": 36, "Undecided": 17}, "moe": 4.4, "notes": "J.L. Partners Nov 9–10, 2025: Hochul 47, Blakeman 36, Und 17."},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2025-12-08", "endDate": "2025-12-12", "sampleSize": 801, "sampleType": "RV", "results": {"Kathy Hochul (D)": 50, "Bruce Blakeman (R)": 25, "Other": 4, "Undecided": 21}, "moe": 4.1, "notes": "Siena Dec 8–12, 2025: Hochul 50, Blakeman 25, Other 4, Und 21."},
    {"raceId": "NY-GOV-2026", "pollster": "John Zogby Strategies", "startDate": "2026-01-06", "endDate": "2026-01-08", "sampleSize": 844, "sampleType": "LV", "results": {"Kathy Hochul (D)": 53, "Bruce Blakeman (R)": 39, "Undecided": 8}, "moe": 3.4, "notes": "Zogby Jan 6–8, 2026 ballot test A (53–39; Und 8)."},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2026-01-26", "endDate": "2026-01-28", "sampleSize": 802, "sampleType": "RV", "results": {"Kathy Hochul (D)": 54, "Bruce Blakeman (R)": 28, "Other": 1, "Undecided": 17}, "moe": 4.3, "notes": "Siena Jan 26–28, 2026: Hochul 54, Blakeman 28, Other 1, Und 17."},
    {"raceId": "NY-GOV-2026", "pollster": "Pollfinity Research", "startDate": "2026-06-11", "endDate": "2026-06-14", "sampleSize": 229, "sampleType": "RV", "results": {"Kathy Hochul (D)": 48.0, "Bruce Blakeman (R)": 37.5, "Other": 2.0, "Undecided": 12.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2026-06-17", "endDate": "2026-06-23", "sampleSize": 1120, "sampleType": "RV", "results": {"Kathy Hochul (D)": 52.0, "Bruce Blakeman (R)": 32.0, "Other": 1.0, "Undecided": 15.0}},
    {"raceId": "NY-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-06-30", "endDate": "2026-07-02", "sampleSize": 1085, "sampleType": "LV", "results": {"Kathy Hochul (D)": 47.0, "Bruce Blakeman (R)": 41.0, "Undecided": 12.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Red Oak Strategic (R)", "startDate": "2026-07-07", "endDate": "2026-07-12", "sampleSize": 2000, "sampleType": "RV", "results": {"Kathy Hochul (D)": 47.0, "Bruce Blakeman (R)": 43.0, "Undecided": 10.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2026-08-03", "endDate": "2026-08-06", "sampleSize": 811, "sampleType": "LV", "results": {"Kathy Hochul (D)": 49.0, "Bruce Blakeman (R)": 39.0, "Other": 1.0, "Undecided": 11.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Concord Public Opinion Partners", "startDate": "2026-08-19", "endDate": "2026-08-21", "sampleSize": 505, "sampleType": "LV", "results": {"Kathy Hochul (D)": 50.0, "Bruce Blakeman (R)": 34.0, "Other": 5.0, "Undecided": 11.0}},
    {"raceId": "NY-GOV-2026", "pollster": "McLaughlin & Associates (R)", "startDate": "2026-08-27", "endDate": "2026-08-31", "sampleSize": 800, "sampleType": "LV", "results": {"Kathy Hochul (D)": 50.0, "Bruce Blakeman (R)": 46.0, "Undecided": 5.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Siena College", "startDate": "2026-09-11", "endDate": "2026-09-17", "sampleSize": 1144, "sampleType": "LV", "results": {"Kathy Hochul (D)": 50.0, "Bruce Blakeman (R)": 41.0}},
    {"raceId": "NY-GOV-2026", "pollster": "Quinnipiac University", "startDate": "2026-09-17", "endDate": "2026-09-20", "sampleSize": 1026, "sampleType": "LV", "results": {"Kathy Hochul (D)": 58.0, "Bruce Blakeman (R)": 39.0}}
  ],
};
