// app/polling/governorpolling/california.ts
// California — 2026 Governor: Xavier Becerra (D) vs. Steve Hilton (R)
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
  abbr: "CA",
  name: "California",
};

export const DEFAULT_RACE_ID = "CA-GOV-2026";

export const RACES = [
  {
    raceId: "CA-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Xavier Becerra (D)", "Steve Hilton (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  CA: [
    {"raceId": "CA-GOV-2026", "pollster": "Berkeley IGS", "startDate": "2026-05-19", "endDate": "2026-05-24", "sampleSize": 8578, "sampleType": "RV", "results": {"Xavier Becerra (D)": 52.0, "Steve Hilton (R)": 31.0, "Undecided": 17.0}},
    {"raceId": "CA-GOV-2026", "pollster": "CEPP", "startDate": "2026-05-23", "endDate": "2026-05-26", "sampleSize": 735, "sampleType": "LV", "results": {"Xavier Becerra (D)": 58.0, "Steve Hilton (R)": 35.0, "Other": 2.0, "Undecided": 5.0}},
    {"raceId": "CA-GOV-2026", "pollster": "Kreate Strategies", "startDate": "2026-06-13", "endDate": "2026-06-17", "sampleSize": 900, "sampleType": "LV", "results": {"Xavier Becerra (D)": 58.0, "Steve Hilton (R)": 33.0, "Undecided": 8.0}},
    {"raceId": "CA-GOV-2026", "pollster": "PPIC", "startDate": "2026-06-29", "endDate": "2026-07-06", "sampleSize": 1003, "sampleType": "LV", "results": {"Xavier Becerra (D)": 61.0, "Steve Hilton (R)": 36.0, "Undecided": 2.0}},
    {"raceId": "CA-GOV-2026", "pollster": "Berkeley IGS", "startDate": "2026-08-03", "endDate": "2026-08-09", "sampleSize": 2310, "sampleType": "LV", "results": {"Xavier Becerra (D)": 55.0, "Steve Hilton (R)": 37.0, "Undecided": 8.0}},
    {"raceId": "CA-GOV-2026", "pollster": "PPIC", "startDate": "2026-09-04", "endDate": "2026-09-10", "sampleSize": 1103, "sampleType": "LV", "results": {"Xavier Becerra (D)": 60.0, "Steve Hilton (R)": 38.0, "Other": 1.0, "Undecided": 1.0}}
  ],
};
