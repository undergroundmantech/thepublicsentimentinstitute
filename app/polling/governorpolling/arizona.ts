// app/polling/governorpolling/arizona.ts
// Arizona — 2026 Governor: Katie Hobbs (D) vs. Andy Biggs (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-19.

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
  abbr: "AZ",
  name: "Arizona",
};

export const DEFAULT_RACE_ID = "AZ-GOV-2026";

export const RACES = [
  {
    raceId: "AZ-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Katie Hobbs (D)", "Andy Biggs (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AZ: [
    {"raceId": "AZ-GOV-2026", "pollster": "Kreate Strategies (R)", "startDate": "2025-02-05", "endDate": "2025-02-07", "sampleSize": 924, "sampleType": "LV", "results": {"Katie Hobbs (D)": 43, "Andy Biggs (R)": 44, "Undecided": 13}},
    {"raceId": "AZ-GOV-2026", "pollster": "Noble Predictive Insights", "startDate": "2025-02-11", "endDate": "2025-02-13", "sampleSize": 1006, "sampleType": "RV", "results": {"Katie Hobbs (D)": 40, "Andy Biggs (R)": 38, "Other": 5, "Undecided": 17}},
    {"raceId": "AZ-GOV-2026", "pollster": "Pulse Decision Science (R)", "startDate": "2025-04-06", "endDate": "2025-04-09", "sampleSize": 501, "sampleType": "LV", "results": {"Katie Hobbs (D)": 46, "Andy Biggs (R)": 42, "Undecided": 12}},
    {"raceId": "AZ-GOV-2026", "pollster": "Noble Predictive Insights", "startDate": "2025-05-12", "endDate": "2025-05-16", "sampleSize": 1026, "sampleType": "RV", "results": {"Katie Hobbs (D)": 40, "Andy Biggs (R)": 38, "Other": 5, "Undecided": 17}},
    {"raceId": "AZ-GOV-2026", "pollster": "Noble Predictive Insights", "startDate": "2025-08-11", "endDate": "2025-08-18", "sampleSize": 948, "sampleType": "RV", "results": {"Katie Hobbs (D)": 39, "Andy Biggs (R)": 37, "Other": 4, "Undecided": 20}},
    {"raceId": "AZ-GOV-2026", "pollster": "RealClearPolitics Avg", "startDate": "2025-08-11", "endDate": "2025-11-10", "sampleSize": 0, "sampleType": "A", "results": {"Katie Hobbs (D)": 41.5, "Andy Biggs (R)": 40, "Undecided": 18.5}},
    {"raceId": "AZ-GOV-2026", "pollster": "Emerson College", "startDate": "2025-11-08", "endDate": "2025-11-10", "sampleSize": 850, "sampleType": "RV", "results": {"Katie Hobbs (D)": 44, "Andy Biggs (R)": 43, "Undecided": 13}},
    {"raceId": "AZ-GOV-2026", "pollster": "NXTGenP (R)", "startDate": "2025-12-15", "endDate": "2025-12-17", "sampleSize": 2725, "sampleType": "LV", "results": {"Katie Hobbs (D)": 51, "Andy Biggs (R)": 32, "Other": 7, "Undecided": 9}},
    {"raceId": "AZ-GOV-2026", "pollster": "Fabrizio Ward and Impact Research bipartisan", "startDate": "2026-07-26", "endDate": "2026-07-28", "sampleSize": 913, "sampleType": "LV", "results": {"Katie Hobbs (D)": 52.0, "Andy Biggs (R)": 44.0, "Undecided": 4.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "The Tarrance Group (R)", "startDate": "2026-07-27", "endDate": "2026-07-30", "sampleSize": 600, "sampleType": "LV", "results": {"Katie Hobbs (D)": 52.0, "Andy Biggs (R)": 48.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "Grayhouse (R)", "startDate": "2026-08-09", "endDate": "2026-08-11", "sampleSize": 600, "sampleType": "LV", "results": {"Katie Hobbs (D)": 49.0, "Andy Biggs (R)": 45.0, "Undecided": 6.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "Noble Predictive Insights", "startDate": "2026-08-10", "endDate": "2026-08-13", "sampleSize": 923, "sampleType": "LV", "results": {"Katie Hobbs (D)": 48.0, "Andy Biggs (R)": 35.0, "Other": 4.0, "Undecided": 12.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "Stealth Analytics", "startDate": "2026-08-11", "endDate": "2026-08-13", "sampleSize": 530, "sampleType": "LV", "results": {"Katie Hobbs (D)": 43.0, "Andy Biggs (R)": 38.0, "Other": 1.0, "Undecided": 18.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "Kreate Strategies (R)", "startDate": "2026-08-13", "endDate": "2026-08-16", "sampleSize": 900, "sampleType": "LV", "results": {"Katie Hobbs (D)": 45.0, "Andy Biggs (R)": 40.0, "Other": 3.0, "Undecided": 13.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-08-14", "endDate": "2026-08-17", "sampleSize": 780, "sampleType": "LV", "results": {"Katie Hobbs (D)": 49.0, "Andy Biggs (R)": 43.0, "Other": 2.0, "Undecided": 6.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "HighGround, Inc.", "startDate": "2026-08-15", "endDate": "2026-08-18", "sampleSize": 400, "sampleType": "LV", "results": {"Katie Hobbs (D)": 49.0, "Andy Biggs (R)": 34.0, "Other": 4.0, "Undecided": 13.0}},
    {"raceId": "AZ-GOV-2026", "pollster": "NextGen Polling (R)", "startDate": "2026-08-17", "endDate": "2026-08-19", "sampleSize": 1627, "sampleType": "LV", "results": {"Katie Hobbs (D)": 39.0, "Andy Biggs (R)": 38.0, "Other": 2.0, "Undecided": 22.0}}
  ],
};
