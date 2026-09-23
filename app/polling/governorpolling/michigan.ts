// app/polling/governorpolling/michigan.ts
// Michigan — 2026 Governor: Jocelyn Benson (D) vs. John James (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-06.

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
  abbr: "MI",
  name: "Michigan",
};

export const DEFAULT_RACE_ID = "MI-GOV-2026";

export const RACES = [
  {
    raceId: "MI-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Jocelyn Benson (D)", "John James (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MI: [
    {"raceId": "MI-GOV-2026", "pollster": "Target Insyght", "startDate": "2025-02-03", "endDate": "2025-02-08", "sampleSize": 600, "sampleType": "RV", "results": {"Jocelyn Benson (D)": 42, "John James (R)": 30, "Undecided": 7}, "moe": 4, "notes": "Target Insyght Feb 3–8, 2025 (3-way; population shown as V)."},
    {"raceId": "MI-GOV-2026", "pollster": "Mitchell Research", "startDate": "2025-03-13", "endDate": "2025-03-13", "sampleSize": 688, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 37, "John James (R)": 34, "Undecided": 13}, "moe": 3.7, "notes": "Mitchell Research Mar 13, 2025 (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Glengariff Group", "startDate": "2025-05-05", "endDate": "2025-05-08", "sampleSize": 600, "sampleType": "RV", "results": {"Jocelyn Benson (D)": 35, "John James (R)": 34, "Undecided": 9}, "moe": 4, "notes": "Glengariff May 5–8, 2025 ballot test A (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Schoen Cooperman Research", "startDate": "2025-10-09", "endDate": "2025-10-14", "sampleSize": 600, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 30, "John James (R)": 29, "Undecided": 15}, "moe": 4, "notes": "Schoen Cooperman Oct 9–14, 2025 (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Rosetta Stone Communications", "startDate": "2025-10-23", "endDate": "2025-10-25", "sampleSize": 637, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 34, "John James (R)": 39, "Undecided": 9}, "moe": 3.9, "notes": "Rosetta Stone Oct 23–25, 2025 (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "EPIC-MRA", "startDate": "2025-11-06", "endDate": "2025-11-11", "sampleSize": 600, "sampleType": "RV", "results": {"Jocelyn Benson (D)": 33, "John James (R)": 34, "Undecided": 13}, "moe": 4, "notes": "EPIC-MRA Nov 6–11, 2025 (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Mitchell Research", "startDate": "2025-11-18", "endDate": "2025-11-21", "sampleSize": 616, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 31, "John James (R)": 37, "Undecided": 14}, "moe": 3.7, "notes": "Mitchell Research Nov 18–21, 2025 (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Glengariff Group", "startDate": "2026-01-02", "endDate": "2026-01-06", "sampleSize": 600, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 32, "John James (R)": 34, "Undecided": 8}, "moe": 4, "notes": "Glengariff Jan 2–6, 2026 ballot test A (3-way)."},
    {"raceId": "MI-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1006, "sampleType": "RV", "results": {"Jocelyn Benson (D)": 52.0, "John James (R)": 47.0, "Undecided": 1.0}},
    {"raceId": "MI-GOV-2026", "pollster": "TIPP Insights (R)", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1215, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 53.0, "John James (R)": 37.0, "Other": 5.0, "Undecided": 5.0}},
    {"raceId": "MI-GOV-2026", "pollster": "Fabrizio Ward and Impact Research bipartisan", "startDate": "2026-08-09", "endDate": "2026-08-11", "sampleSize": 877, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 49.0, "John James (R)": 44.0, "Other": 1.0, "Undecided": 6.0}},
    {"raceId": "MI-GOV-2026", "pollster": "Michigan State University/YouGov", "startDate": "2026-08-10", "endDate": "2026-08-20", "sampleSize": 779, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 52.0, "John James (R)": 43.0, "Undecided": 5.0}},
    {"raceId": "MI-GOV-2026", "pollster": "EPIC-MRA", "startDate": "2026-08-22", "endDate": "2026-08-28", "sampleSize": 600, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 46.5, "John James (R)": 42.5, "Undecided": 11.0}},
    {"raceId": "MI-GOV-2026", "pollster": "Glengariff Group", "startDate": "2026-08-31", "endDate": "2026-09-03", "sampleSize": 600, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 47.0, "John James (R)": 43.0, "Undecided": 10.0}},
    {"raceId": "MI-GOV-2026", "pollster": "SSRS", "startDate": "2026-08-31", "endDate": "2026-09-06", "sampleSize": 843, "sampleType": "LV", "results": {"Jocelyn Benson (D)": 50.0, "John James (R)": 41.0, "Other": 9.0}}
  ],
};
