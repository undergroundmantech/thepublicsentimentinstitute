// app/polling/governorpolling/iowa.ts
// Iowa — 2026 Governor: Rob Sand (D) vs. Zach Lahn (R)
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
  abbr: "IA",
  name: "Iowa",
};

export const DEFAULT_RACE_ID = "IA-GOV-2026";

export const RACES = [
  {
    raceId: "IA-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Rob Sand (D)", "Zach Lahn (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  IA: [
    {"raceId": "IA-GOV-2026", "pollster": "Cygnal (R)", "startDate": "2026-06-16", "endDate": "2026-06-19", "sampleSize": 600, "sampleType": "LV", "results": {"Rob Sand (D)": 48.0, "Zach Lahn (R)": 43.0, "Undecided": 9.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-06-23", "endDate": "2026-06-27", "sampleSize": 1003, "sampleType": "RV", "results": {"Rob Sand (D)": 53.0, "Zach Lahn (R)": 44.0, "Undecided": 3.0}},
    {"raceId": "IA-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-06-15", "endDate": "2026-06-27", "sampleSize": 600, "sampleType": "LV", "results": {"Rob Sand (D)": 48.0, "Zach Lahn (R)": 47.0, "Undecided": 5.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Emerson College", "startDate": "2026-08-02", "endDate": "2026-08-04", "sampleSize": 712, "sampleType": "LV", "results": {"Rob Sand (D)": 48.0, "Zach Lahn (R)": 43.0, "Other": 2.0, "Undecided": 7.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Suffolk University", "startDate": "2026-08-20", "endDate": "2026-08-23", "sampleSize": 500, "sampleType": "LV", "results": {"Rob Sand (D)": 48.0, "Zach Lahn (R)": 44.0, "Undecided": 8.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Wedgewood Polls", "startDate": "2026-08-27", "endDate": "2026-08-29", "sampleSize": 600, "sampleType": "LV", "results": {"Rob Sand (D)": 51.0, "Zach Lahn (R)": 46.0, "Undecided": 3.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Emerson College", "startDate": "2026-08-31", "endDate": "2026-09-01", "sampleSize": 750, "sampleType": "LV", "results": {"Rob Sand (D)": 49.0, "Zach Lahn (R)": 46.0, "Undecided": 6.0}},
    {"raceId": "IA-GOV-2026", "pollster": "YouGov", "startDate": "2026-09-03", "endDate": "2026-09-08", "sampleSize": 2041, "sampleType": "LV", "results": {"Rob Sand (D)": 51.0, "Zach Lahn (R)": 41.0, "Undecided": 8.0}},
    {"raceId": "IA-GOV-2026", "pollster": "Cygnal (R)", "startDate": "2026-09-09", "endDate": "2026-09-11", "sampleSize": 500, "sampleType": "LV", "results": {"Rob Sand (D)": 48.0, "Zach Lahn (R)": 44.0, "Undecided": 8.0}},
    {"raceId": "IA-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 831, "sampleType": "LV", "results": {"Rob Sand (D)": 46.0, "Zach Lahn (R)": 42.0, "Undecided": 12.0}}
  ],
};
