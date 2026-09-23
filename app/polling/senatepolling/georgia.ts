// app/polling/senatepolling/georgia.ts
// Georgia — 2026 U.S. Senate: Jon Ossoff (D) vs. Mike Collins (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-16.

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
  abbr: "GA",
  name: "Georgia",
};

export const DEFAULT_RACE_ID = "GA-SEN-2026";

export const RACES = [
  {
    raceId: "GA-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Jon Ossoff (D)", "Mike Collins (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  GA: [
    {"raceId": "GA-SEN-2026", "pollster": "WPA Intelligence (R)", "startDate": "2025-01-15", "endDate": "2025-01-15", "sampleSize": 500, "sampleType": "RV", "results": {"Jon Ossoff (D)": 44, "Mike Collins (R)": 34}},
    {"raceId": "GA-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2025-04-27", "endDate": "2025-04-27", "sampleSize": 1426, "sampleType": "RV", "results": {"Jon Ossoff (D)": 48, "Mike Collins (R)": 43}},
    {"raceId": "GA-SEN-2026", "pollster": "Cygnal (R)", "startDate": "2025-05-17", "endDate": "2025-05-17", "sampleSize": 800, "sampleType": "RV", "results": {"Jon Ossoff (D)": 46, "Mike Collins (R)": 43}},
    {"raceId": "GA-SEN-2026", "pollster": "TIPP Insights", "startDate": "2025-08-01", "endDate": "2025-08-01", "sampleSize": 2956, "sampleType": "RV", "results": {"Jon Ossoff (D)": 45, "Mike Collins (R)": 44}},
    {"raceId": "GA-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2025-09-12", "endDate": "2025-09-12", "sampleSize": 624, "sampleType": "RV", "results": {"Jon Ossoff (D)": 38, "Mike Collins (R)": 38}},
    {"raceId": "GA-SEN-2026", "pollster": "Beacon Research (D)/Shaw & Co. Research (R)", "startDate": "2026-06-23", "endDate": "2026-06-27", "sampleSize": 1002, "sampleType": "RV", "results": {"Jon Ossoff (D)": 56.0, "Mike Collins (R)": 43.0, "Undecided": 1.0}},
    {"raceId": "GA-SEN-2026", "pollster": "Wick", "startDate": "2026-06-27", "endDate": "2026-06-30", "sampleSize": 1175, "sampleType": "LV", "results": {"Jon Ossoff (D)": 47.0, "Mike Collins (R)": 43.0, "Undecided": 10.0}},
    {"raceId": "GA-SEN-2026", "pollster": "Fabrizio Ward (R)/Impact Research (D)", "startDate": "2026-07-13", "endDate": "2026-07-16", "sampleSize": 1060, "sampleType": "LV", "results": {"Jon Ossoff (D)": 52.0, "Mike Collins (R)": 43.0, "Undecided": 5.0}},
    {"raceId": "GA-SEN-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-08-16", "endDate": "2026-08-17", "sampleSize": 800, "sampleType": "LV", "results": {"Jon Ossoff (D)": 50.0, "Mike Collins (R)": 43.0, "Undecided": 7.0}},
    {"raceId": "GA-SEN-2026", "pollster": "Trafalgar Group (R)", "startDate": "2026-09-10", "endDate": "2026-09-12", "sampleSize": 1091, "sampleType": "LV", "results": {"Jon Ossoff (D)": 49.0, "Mike Collins (R)": 43.0, "Other": 1.0, "Undecided": 7.0}},
    {"raceId": "GA-SEN-2026", "pollster": "Rasmussen Reports", "startDate": "2026-09-14", "endDate": "2026-09-14", "sampleSize": 1019, "sampleType": "LV", "results": {"Jon Ossoff (D)": 51.0, "Mike Collins (R)": 42.0, "Undecided": 6.0}},
    {"raceId": "GA-SEN-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 645, "sampleType": "LV", "results": {"Jon Ossoff (D)": 48.5, "Mike Collins (R)": 44.5, "Other": 1.0, "Undecided": 6.0}}
  ],
};
