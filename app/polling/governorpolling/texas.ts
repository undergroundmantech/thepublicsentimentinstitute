// app/polling/governorpolling/texas.ts
// Texas — 2026 Governor: Gina Hinojosa (D) vs. Greg Abbott (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-22.

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
  abbr: "TX",
  name: "Texas",
};

export const DEFAULT_RACE_ID = "TX-GOV-2026";

export const RACES = [
  {
    raceId: "TX-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Gina Hinojosa (D)", "Greg Abbott (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  TX: [
    {"raceId": "TX-GOV-2026", "pollster": "Emerson College", "startDate": "2026-01-10", "endDate": "2026-01-12", "sampleSize": 1165, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 42.0, "Greg Abbott (R)": 50.0, "Undecided": 8.0}},
    {"raceId": "TX-GOV-2026", "pollster": "University of Houston/YouGov", "startDate": "2026-01-20", "endDate": "2026-01-31", "sampleSize": 1502, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 42.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 6.0}},
    {"raceId": "TX-GOV-2026", "pollster": "GBAO (D)", "startDate": "2026-01-26", "endDate": "2026-02-03", "sampleSize": 1000, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 43.0, "Greg Abbott (R)": 46.0, "Other": 6.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "University of Texas/Texas Politics Project", "startDate": "2026-02-02", "endDate": "2026-02-16", "sampleSize": 1300, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 35.0, "Greg Abbott (R)": 45.0, "Other": 6.0, "Undecided": 14.0}},
    {"raceId": "TX-GOV-2026", "pollster": "UT Tyler", "startDate": "2026-02-13", "endDate": "2026-02-22", "sampleSize": 1117, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 41.0, "Greg Abbott (R)": 49.0, "Undecided": 10.0}},
    {"raceId": "TX-GOV-2026", "pollster": "University of Texas/Texas Politics Project", "startDate": "2026-04-10", "endDate": "2026-04-20", "sampleSize": 1200, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 38.0, "Greg Abbott (R)": 44.0, "Other": 5.0, "Undecided": 13.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Slingshot Strategies (D)", "startDate": "2026-04-17", "endDate": "2026-04-20", "sampleSize": 1018, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 43.0, "Greg Abbott (R)": 48.0, "Other": 2.0, "Undecided": 7.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Southern University/YouGov", "startDate": "2026-04-22", "endDate": "2026-05-05", "sampleSize": 1223, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 43.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Public Policy Polling (D)", "startDate": "2026-05-22", "endDate": "2026-05-23", "sampleSize": 643, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 44.0, "Greg Abbott (R)": 48.0, "Undecided": 8.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Public Opinion Research", "startDate": "2026-05-27", "endDate": "2026-05-28", "sampleSize": 1670, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 41.0, "Greg Abbott (R)": 46.0, "Other": 3.0, "Undecided": 9.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas A&M University/ReconMR", "startDate": "2026-06-01", "endDate": "2026-06-04", "sampleSize": 807, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 43.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Quantus Insights (R)", "startDate": "2026-06-03", "endDate": "2026-06-04", "sampleSize": 800, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 41.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 7.0}},
    {"raceId": "TX-GOV-2026", "pollster": "University of Texas/Texas Politics Project", "startDate": "2026-06-05", "endDate": "2026-06-12", "sampleSize": 1200, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 40.0, "Greg Abbott (R)": 47.0, "Other": 3.0, "Undecided": 10.0}},
    {"raceId": "TX-GOV-2026", "pollster": "SoCal Strategies (R)", "startDate": "2026-06-21", "endDate": "2026-06-21", "sampleSize": 800, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 42.0, "Greg Abbott (R)": 54.0, "Undecided": 4.0}},
    {"raceId": "TX-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-06-19", "endDate": "2026-06-27", "sampleSize": 656, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 44.0, "Greg Abbott (R)": 51.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Public Opinion Research", "startDate": "2026-07-15", "endDate": "2026-07-17", "sampleSize": 1048, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 42.0, "Greg Abbott (R)": 45.0, "Undecided": 13.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Beacon Research and Shaw & Co. Research bipartisan", "startDate": "2026-07-23", "endDate": "2026-07-27", "sampleSize": 1005, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 49.0, "Greg Abbott (R)": 50.0, "Undecided": 1.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas A&M University/ReconMR/Siena", "startDate": "2026-07-27", "endDate": "2026-07-30", "sampleSize": 619, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 45.0, "Greg Abbott (R)": 46.0, "Other": 4.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Southern University", "startDate": "2026-07-27", "endDate": "2026-07-30", "sampleSize": 1200, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 43.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Cygnal (R)", "startDate": "2026-07-29", "endDate": "2026-07-31", "sampleSize": 800, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 46.0, "Greg Abbott (R)": 49.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Wedgewood Polls (D)", "startDate": "2026-07-30", "endDate": "2026-07-31", "sampleSize": 800, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 44.0, "Greg Abbott (R)": 50.0, "Undecided": 6.0}},
    {"raceId": "TX-GOV-2026", "pollster": "GBAO (D)", "startDate": "2026-08-04", "endDate": "2026-08-09", "sampleSize": 1000, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 48.0, "Greg Abbott (R)": 49.0, "Undecided": 3.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Emerson College", "startDate": "2026-08-09", "endDate": "2026-08-10", "sampleSize": 1000, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 45.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 4.0}},
    {"raceId": "TX-GOV-2026", "pollster": "University of Texas/Texas Politics Project", "startDate": "2026-08-05", "endDate": "2026-08-13", "sampleSize": 1200, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 40.0, "Greg Abbott (R)": 45.0, "Other": 5.0, "Undecided": 10.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Public Opinion Research", "startDate": "2026-08-21", "endDate": "2026-08-24", "sampleSize": 1000, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 42.0, "Greg Abbott (R)": 49.0, "Other": 3.0, "Undecided": 6.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Overton Insights (R)", "startDate": "2026-08-24", "endDate": "2026-08-26", "sampleSize": 1167, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 47.5, "Greg Abbott (R)": 49.0, "Undecided": 3.5}, "notes": "Two published versions, leaned and unleaned, averaged as the model does."},
    {"raceId": "TX-GOV-2026", "pollster": "Fabrizio Ward and Impact Research bipartisan", "startDate": "2026-08-30", "endDate": "2026-09-01", "sampleSize": 895, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 46.0, "Greg Abbott (R)": 49.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Univision/YouGov", "startDate": "2026-08-27", "endDate": "2026-09-04", "sampleSize": 1000, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 47.0, "Greg Abbott (R)": 47.0, "Other": 1.0, "Undecided": 5.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Mason-Dixon", "startDate": "2026-09-08", "endDate": "2026-09-10", "sampleSize": 625, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 41.0, "Greg Abbott (R)": 48.0, "Other": 3.0, "Undecided": 8.0}},
    {"raceId": "TX-GOV-2026", "pollster": "ReconMR/Siena University", "startDate": "2026-09-08", "endDate": "2026-09-11", "sampleSize": 614, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 49.0, "Greg Abbott (R)": 45.0, "Other": 2.0, "Undecided": 4.0}},
    {"raceId": "TX-GOV-2026", "pollster": "SoCal Strategies (R)", "startDate": "2026-09-12", "endDate": "2026-09-13", "sampleSize": 649, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 44.0, "Greg Abbott (R)": 52.0, "Undecided": 3.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Emerson College", "startDate": "2026-09-12", "endDate": "2026-09-14", "sampleSize": 1000, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 46.0, "Greg Abbott (R)": 49.0, "Other": 2.0, "Undecided": 4.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Southern University", "startDate": "2026-09-15", "endDate": "2026-09-19", "sampleSize": 1800, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 45.0, "Greg Abbott (R)": 49.0, "Other": 2.0, "Undecided": 4.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Marist University", "startDate": "2026-09-17", "endDate": "2026-09-20", "sampleSize": 1139, "sampleType": "RV", "results": {"Gina Hinojosa (D)": 49.0, "Greg Abbott (R)": 46.0, "Other": 1.0, "Undecided": 3.0}},
    {"raceId": "TX-GOV-2026", "pollster": "Texas Public Opinion Research", "startDate": "2026-09-19", "endDate": "2026-09-22", "sampleSize": 1007, "sampleType": "LV", "results": {"Gina Hinojosa (D)": 46.0, "Greg Abbott (R)": 50.0, "Other": 3.0, "Undecided": 2.0}}
  ],
};
