// app/polling/governorpolling/georgia.ts
// Georgia — 2026 Governor: Keisha Lance Bottoms (D) vs. Rick Jackson (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-14.

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

export const DEFAULT_RACE_ID = "GA-GOV-2026";

export const RACES = [
  {
    raceId: "GA-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Keisha Lance Bottoms (D)", "Rick Jackson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  GA: [
    {"raceId": "GA-GOV-2026", "pollster": "Echelon Insights (R)", "startDate": "2026-04-03", "endDate": "2026-04-09", "sampleSize": 407, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 49.0, "Rick Jackson (R)": 43.0, "Undecided": 8.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Concord Public Opinion Partners (D)", "startDate": "2026-05-30", "endDate": "2026-06-02", "sampleSize": 510, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 53.0, "Rick Jackson (R)": 38.0, "Undecided": 9.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-06-23", "endDate": "2026-06-27", "sampleSize": 1002, "sampleType": "RV", "results": {"Keisha Lance Bottoms (D)": 52.0, "Rick Jackson (R)": 47.0, "Undecided": 1.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Wick", "startDate": "2026-06-27", "endDate": "2026-06-30", "sampleSize": 1175, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 43.0, "Rick Jackson (R)": 43.0, "Undecided": 14.0}},
    {"raceId": "GA-GOV-2026", "pollster": "State Navigate", "startDate": "2026-07-10", "endDate": "2026-07-13", "sampleSize": 448, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 50.5, "Rick Jackson (R)": 43.5, "Undecided": 5.5}},
    {"raceId": "GA-GOV-2026", "pollster": "Fabrizio Ward and Impact Research bipartisan", "startDate": "2026-07-13", "endDate": "2026-07-16", "sampleSize": 1060, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 48.0, "Rick Jackson (R)": 46.0, "Undecided": 5.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-07-29", "endDate": "2026-08-01", "sampleSize": 815, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 46.0, "Rick Jackson (R)": 45.0, "Other": 1.0, "Undecided": 8.0}},
    {"raceId": "GA-GOV-2026", "pollster": "InsiderAdvantage (R)", "startDate": "2026-08-16", "endDate": "2026-08-17", "sampleSize": 800, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 46.0, "Rick Jackson (R)": 46.0, "Undecided": 8.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Rasmussen Reports (R)", "startDate": "2026-09-14", "endDate": "2026-09-14", "sampleSize": 1019, "sampleType": "LV", "results": {"Keisha Lance Bottoms (D)": 45.0, "Rick Jackson (R)": 48.0, "Undecided": 7.0}},
    {"raceId": "GA-GOV-2026", "pollster": "Big Data Poll", "startDate": "2026-09-21", "endDate": "2026-09-23", "sampleSize": 678, "sampleType": "LV", "moe": 4.0, "results": {"Keisha Lance Bottoms (D)": 46.7, "Rick Jackson (R)": 48.7, "Undecided": 4.6}, "notes": "Initial ballot. Leaned, the release has it 50.5 to 49.5 for Jackson."}
  ],
};
