// app/polling/senatepolling/alaska.ts
// Alaska — 2026 U.S. Senate: Mary Peltola (D) vs. Dan S. Sullivan (R)
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
  abbr: "AK",
  name: "Alaska",
};

export const DEFAULT_RACE_ID = "AK-SEN-2026";

export const RACES = [
  {
    raceId: "AK-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Mary Peltola (D)", "Dan S. Sullivan (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AK: [
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2023-04-21", "endDate": "2023-04-25", "sampleSize": 1261, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 41, "Mary Peltola (D)": 44, "Undecided": 15}, "notes": "Older poll included for historical context."},
    {"raceId": "AK-SEN-2026", "pollster": "Data for Progress", "startDate": "2025-07-21", "endDate": "2025-07-27", "sampleSize": 678, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 46, "Mary Peltola (D)": 45, "Other": 5, "Undecided": 4}, "moe": 4, "notes": "Other listed as 5% in source."},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2025-07-29", "endDate": "2025-08-01", "sampleSize": 1623, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 47, "Mary Peltola (D)": 42, "Undecided": 11}, "moe": 2.5},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2025-10-10", "endDate": "2025-10-15", "sampleSize": 1708, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 46, "Mary Peltola (D)": 48, "Undecided": 6}},
    {"raceId": "AK-SEN-2026", "pollster": "Data for Progress", "startDate": "2025-10-17", "endDate": "2025-10-23", "sampleSize": 823, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 45, "Mary Peltola (D)": 46, "Other": 5, "Undecided": 4}, "moe": 3, "notes": "Other listed as 5% in source."},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-01-08", "endDate": "2026-01-11", "sampleSize": 1988, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 46, "Mary Peltola (D)": 48, "Undecided": 6}, "moe": 2.2},
    {"raceId": "AK-SEN-2026", "pollster": "Public Policy Polling", "startDate": "2026-01-16", "endDate": "2026-01-17", "sampleSize": 611, "sampleType": "RV", "results": {"Dan S. Sullivan (R)": 47, "Mary Peltola (D)": 49, "Undecided": 4}, "notes": "Sample type listed as \"V\" in source; stored as RV."},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-03-19", "endDate": "2026-03-22", "sampleSize": 1590, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 44, "Mary Peltola (D)": 49, "Other": 7}},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-04-16", "endDate": "2026-04-19", "sampleSize": 1946, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 43, "Mary Peltola (D)": 49, "Other": 8}},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-05-14", "endDate": "2026-05-17", "sampleSize": 1401, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 44, "Mary Peltola (D)": 48, "Gerald Heikes (R)": 3, "Other": 5}},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-06-04", "endDate": "2026-06-07", "sampleSize": 1393, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 44, "Mary Peltola (D)": 49, "Gerald Heikes (R)": 4, "Other": 3}},
    {"raceId": "AK-SEN-2026", "pollster": "New York Times/Siena University", "startDate": "2026-06-15", "endDate": "2026-06-29", "sampleSize": 593, "sampleType": "LV", "results": {"Dan S. Sullivan (R)": 47, "Mary Peltola (D)": 45, "Other": 2, "Undecided": 5}},
    {"raceId": "AK-SEN-2026", "pollster": "Data for Progress (D)", "startDate": "2026-07-28", "endDate": "2026-08-04", "sampleSize": 578, "sampleType": "LV", "results": {"Mary Peltola (D)": 52, "Dan S. Sullivan (R)": 48}, "notes": "Published ranked-choice final round. First choice: Peltola 45, Sullivan 41, Dan J. Sullivan 4, Heikes 3."},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-08-02", "endDate": "2026-08-05", "sampleSize": 1371, "sampleType": "LV", "results": {"Mary Peltola (D)": 51, "Dan S. Sullivan (R)": 49}},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-08-20", "endDate": "2026-08-23", "sampleSize": 1495, "sampleType": "LV", "results": {"Mary Peltola (D)": 51.0, "Dan S. Sullivan (R)": 49.0}},
    {"raceId": "AK-SEN-2026", "pollster": "Fabrizio Ward/Impact Research", "startDate": "2026-09-08", "endDate": "2026-09-11", "sampleSize": 800, "sampleType": "LV", "results": {"Mary Peltola (D)": 53, "Dan S. Sullivan (R)": 47}, "notes": "Published ranked-choice final round. Bipartisan, for AARP. First choice: Peltola 46, Sullivan 41, Dan J. Sullivan 4, Heikes 3, undecided 7."},
    {"raceId": "AK-SEN-2026", "pollster": "Alaska Survey Research", "startDate": "2026-09-10", "endDate": "2026-09-12", "sampleSize": 1352, "sampleType": "LV", "results": {"Mary Peltola (D)": 52, "Dan S. Sullivan (R)": 48}, "notes": "Published ranked-choice final round. First choice: Peltola 48, Sullivan 44, Dan J. Sullivan 4, Heikes 4."},
    {"raceId": "AK-SEN-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-13", "endDate": "2026-09-14", "sampleSize": 1188, "sampleType": "LV", "results": {"Mary Peltola (D)": 42.7, "Dan S. Sullivan (R)": 45.5, "Undecided": 9.0}},
    {"raceId": "AK-SEN-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-17", "sampleSize": 799, "sampleType": "LV", "results": {"Mary Peltola (D)": 46, "Dan S. Sullivan (R)": 49, "Undecided": 5}, "notes": "Head-to-head version; the first-choice ballot had Sullivan 48, Peltola 46, Dan J. Sullivan 1, Heikes 1."}
  ],
};
