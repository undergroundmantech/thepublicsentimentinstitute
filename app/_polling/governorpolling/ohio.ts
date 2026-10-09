// app/polling/governorpolling/ohio.ts
// Ohio — 2026 Governor: Amy Acton (D) vs. Vivek Ramaswamy (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-10.

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
  abbr: "OH",
  name: "Ohio",
};

export const DEFAULT_RACE_ID = "OH-GOV-2026";

export const RACES = [
  {
    raceId: "OH-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Amy Acton (D)", "Vivek Ramaswamy (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  OH: [
    {"raceId": "OH-GOV-2026", "pollster": "Public Policy Polling", "startDate": "2025-02-19", "endDate": "2025-02-20", "sampleSize": 642, "sampleType": "RV", "results": {"Vivek Ramaswamy (R)": 44, "Amy Acton (D)": 45, "Undecided": 11}, "moe": 3.9, "notes": "PPP: Acton 45, Ramaswamy 44; no Other reported; Und 11."},
    {"raceId": "OH-GOV-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2025-04-18", "endDate": "2025-04-24", "sampleSize": 800, "sampleType": "RV", "results": {"Vivek Ramaswamy (R)": 50, "Amy Acton (D)": 45, "Other": 5}, "moe": 4.1, "notes": "BGSU/YouGov: Ramaswamy 50, Acton 45, Other 5; Und not reported."},
    {"raceId": "OH-GOV-2026", "pollster": "Impact Research", "startDate": "2025-07-24", "endDate": "2025-07-28", "sampleSize": 800, "sampleType": "LV", "results": {"Vivek Ramaswamy (R)": 47, "Amy Acton (D)": 46, "Undecided": 7}, "moe": 3.5, "notes": "Impact: Ramaswamy 47, Acton 46; no Other reported; Und 7."},
    {"raceId": "OH-GOV-2026", "pollster": "Emerson College", "startDate": "2025-08-18", "endDate": "2025-08-19", "sampleSize": 1000, "sampleType": "RV", "results": {"Vivek Ramaswamy (R)": 49, "Amy Acton (D)": 39, "Undecided": 12}, "moe": 3, "notes": "Emerson: Ramaswamy 49, Acton 39; no Other reported; Und 12."},
    {"raceId": "OH-GOV-2026", "pollster": "Hart Research", "startDate": "2025-09-19", "endDate": "2025-09-22", "sampleSize": 800, "sampleType": "LV", "results": {"Vivek Ramaswamy (R)": 45, "Amy Acton (D)": 46, "Undecided": 9}, "moe": 3, "notes": "Hart: Acton 46, Ramaswamy 45; no Other reported; Und 9."},
    {"raceId": "OH-GOV-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2025-10-02", "endDate": "2025-10-14", "sampleSize": 800, "sampleType": "RV", "results": {"Vivek Ramaswamy (R)": 50, "Amy Acton (D)": 47, "Other": 3}, "moe": 4.5, "notes": "BGSU/YouGov: Ramaswamy 50, Acton 47, Other 3; Und not reported."},
    {"raceId": "OH-GOV-2026", "pollster": "Emerson College", "startDate": "2025-12-06", "endDate": "2025-12-08", "sampleSize": 850, "sampleType": "RV", "results": {"Vivek Ramaswamy (R)": 45, "Amy Acton (D)": 46, "Undecided": 9}, "moe": 3.3, "notes": "Emerson: Acton 46, Ramaswamy 45; no Other reported; Und 9."},
    {"raceId": "OH-GOV-2026", "pollster": "Data Targeting", "startDate": "2025-12-03", "endDate": "2025-12-08", "sampleSize": 603, "sampleType": "LV", "results": {"Vivek Ramaswamy (R)": 45, "Amy Acton (D)": 43, "Undecided": 12}, "moe": 4, "notes": "Data Targeting: Ramaswamy 45, Acton 43; no Other reported; Und 12."},
    {"raceId": "OH-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-05-28", "endDate": "2026-06-01", "sampleSize": 1015, "sampleType": "RV", "results": {"Amy Acton (D)": 50.0, "Vivek Ramaswamy (R)": 49.0, "Undecided": 1.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Tulchin Research (D)", "startDate": "2026-06-02", "endDate": "2026-06-04", "sampleSize": 600, "sampleType": "LV", "results": {"Amy Acton (D)": 47.0, "Vivek Ramaswamy (R)": 44.0, "Undecided": 9.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Fabrizio Ward and Impact Research bipartisan", "startDate": "2026-06-14", "endDate": "2026-06-16", "sampleSize": 800, "sampleType": "LV", "results": {"Amy Acton (D)": 47.0, "Vivek Ramaswamy (R)": 44.0, "Other": 1.0, "Undecided": 9.0}},
    {"raceId": "OH-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-06-15", "endDate": "2026-06-28", "sampleSize": 601, "sampleType": "LV", "results": {"Amy Acton (D)": 47.0, "Vivek Ramaswamy (R)": 47.0, "Undecided": 6.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Tulchin Research (D)", "startDate": "2026-07-29", "endDate": "2026-08-04", "sampleSize": 600, "sampleType": "LV", "results": {"Amy Acton (D)": 46.0, "Vivek Ramaswamy (R)": 44.0, "Other": 5.0, "Undecided": 5.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-08-06", "endDate": "2026-08-10", "sampleSize": 1008, "sampleType": "RV", "results": {"Amy Acton (D)": 48.0, "Vivek Ramaswamy (R)": 50.0, "Undecided": 2.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Wedgewood Polls", "startDate": "2026-08-11", "endDate": "2026-08-13", "sampleSize": 800, "sampleType": "LV", "results": {"Amy Acton (D)": 47.0, "Vivek Ramaswamy (R)": 46.0, "Undecided": 7.0}},
    {"raceId": "OH-GOV-2026", "pollster": "Bowling Green State University/YouGov", "startDate": "2026-09-01", "endDate": "2026-09-10", "sampleSize": 1000, "sampleType": "LV", "results": {"Amy Acton (D)": 48.0, "Vivek Ramaswamy (R)": 45.0, "Other": 7.0}}
  ],
};
