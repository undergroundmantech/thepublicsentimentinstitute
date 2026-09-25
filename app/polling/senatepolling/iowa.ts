// app/polling/senatepolling/iowa.ts
// Iowa — 2026 U.S. Senate: Josh Turek (D) vs. Ashley Hinson (R)
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
  abbr: "IA",
  name: "Iowa",
};

export const DEFAULT_RACE_ID = "IA-SEN-2026";

export const RACES = [
  {
    raceId: "IA-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Josh Turek (D)", "Ashley Hinson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  IA: [
    {"raceId": "IA-SEN-2026", "pollster": "Change Research (D)", "startDate": "2026-01-08", "endDate": "2026-01-11", "sampleSize": 1108, "sampleType": "LV", "results": {"Josh Turek (D)": 41.0, "Ashley Hinson (R)": 44.0, "Other": 1.0, "Undecided": 14.0}},
    {"raceId": "IA-SEN-2026", "pollster": "GQR (D)", "startDate": "2026-03-10", "endDate": "2026-03-16", "sampleSize": 1200, "sampleType": "LV", "results": {"Josh Turek (D)": 43.0, "Ashley Hinson (R)": 47.0, "Undecided": 11.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Echelon Insights (R)", "startDate": "2026-04-03", "endDate": "2026-04-09", "sampleSize": 377, "sampleType": "LV", "results": {"Josh Turek (D)": 46.0, "Ashley Hinson (R)": 45.0, "Undecided": 9.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-06-03", "endDate": "2026-06-04", "sampleSize": 557, "sampleType": "RV", "results": {"Josh Turek (D)": 46.0, "Ashley Hinson (R)": 46.0, "Undecided": 7.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-06-08", "endDate": "2026-06-11", "sampleSize": 1000, "sampleType": "LV", "results": {"Josh Turek (D)": 47.0, "Ashley Hinson (R)": 45.0, "Undecided": 8.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Cygnal (R)", "startDate": "2026-06-16", "endDate": "2026-06-19", "sampleSize": 600, "sampleType": "LV", "results": {"Josh Turek (D)": 44.0, "Ashley Hinson (R)": 46.0, "Undecided": 10.0}},
    {"raceId": "IA-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-06-15", "endDate": "2026-06-27", "sampleSize": 600, "sampleType": "LV", "results": {"Josh Turek (D)": 46.0, "Ashley Hinson (R)": 48.0, "Undecided": 5.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-06-23", "endDate": "2026-06-27", "sampleSize": 1003, "sampleType": "RV", "results": {"Josh Turek (D)": 50.0, "Ashley Hinson (R)": 46.0, "Undecided": 4.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Emerson College", "startDate": "2026-08-02", "endDate": "2026-08-04", "sampleSize": 712, "sampleType": "LV", "results": {"Josh Turek (D)": 45.0, "Ashley Hinson (R)": 48.0, "Undecided": 6.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Suffolk University", "startDate": "2026-08-20", "endDate": "2026-08-23", "sampleSize": 500, "sampleType": "LV", "results": {"Josh Turek (D)": 41.0, "Ashley Hinson (R)": 45.0, "Other": 4.0, "Undecided": 10.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Abacus Data", "startDate": "2026-08-26", "endDate": "2026-08-28", "sampleSize": 323, "sampleType": "LV", "results": {"Josh Turek (D)": 54.0, "Ashley Hinson (R)": 45.0, "Other": 1.0}, "notes": "Likely voter version; the registered voter version is also published."},
    {"raceId": "IA-SEN-2026", "pollster": "Wedgewood Polls", "startDate": "2026-08-27", "endDate": "2026-08-29", "sampleSize": 600, "sampleType": "LV", "results": {"Josh Turek (D)": 48.0, "Ashley Hinson (R)": 50.0, "Undecided": 2.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Global Strategy Group (D)", "startDate": "2026-08-27", "endDate": "2026-08-31", "sampleSize": 800, "sampleType": "LV", "results": {"Josh Turek (D)": 46.0, "Ashley Hinson (R)": 42.0, "Other": 6.0, "Undecided": 6.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Emerson College", "startDate": "2026-08-31", "endDate": "2026-09-01", "sampleSize": 750, "sampleType": "LV", "results": {"Josh Turek (D)": 45.0, "Ashley Hinson (R)": 50.0, "Other": 1.0, "Undecided": 5.0}},
    {"raceId": "IA-SEN-2026", "pollster": "YouGov", "startDate": "2026-09-03", "endDate": "2026-09-08", "sampleSize": 2041, "sampleType": "LV", "results": {"Josh Turek (D)": 47.0, "Ashley Hinson (R)": 43.0, "Other": 1.0, "Undecided": 8.0}, "notes": "Likely voter version; the registered voter version is also published."},
    {"raceId": "IA-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 1031, "sampleType": "LV", "results": {"Josh Turek (D)": 45.0, "Ashley Hinson (R)": 40.0, "Other": 4.0, "Undecided": 11.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Cygnal (R)", "startDate": "2026-09-09", "endDate": "2026-09-11", "sampleSize": 500, "sampleType": "LV", "results": {"Josh Turek (D)": 43.0, "Ashley Hinson (R)": 43.0, "Other": 4.0, "Undecided": 10.0}},
    {"raceId": "IA-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 831, "sampleType": "LV", "results": {"Josh Turek (D)": 42.5, "Ashley Hinson (R)": 47.0, "Other": 1.0, "Undecided": 9.0}, "notes": "Two published versions, averaged as the model does."},
    {"raceId": "IA-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-16", "endDate": "2026-09-18", "sampleSize": 1089, "sampleType": "LV", "results": {"Josh Turek (D)": 42.0, "Ashley Hinson (R)": 44.0, "Other": 3.0, "Undecided": 10.0}},
    {"raceId": "IA-SEN-2026", "pollster": "Marist College", "startDate": "2026-09-17", "endDate": "2026-09-20", "sampleSize": 1050, "sampleType": "RV", "results": {"Josh Turek (D)": 50.0, "Ashley Hinson (R)": 42.0, "Other": 2.0, "Undecided": 5.0}}
  ],
};
