// app/polling/senatepolling/montana.ts
// Montana — 2026 U.S. Senate: Seth Bodnar (I) vs. Kurt Alme (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-15.
// Open seat. Four candidate ballot: Kurt Alme (R), Seth Bodnar (I), Alani Bankhead (D)
// and Kyle Austin (L). Bodnar leads the non Republican vote and carries this matchup.

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
  abbr: "MT",
  name: "Montana",
};

export const DEFAULT_RACE_ID = "MT-SEN-2026";

export const RACES = [
  {
    raceId: "MT-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Seth Bodnar (I)", "Kurt Alme (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  MT: [
    {"raceId": "MT-SEN-2026", "pollster": "Public Opinion Strategies (R)", "startDate": "2026-06-08", "endDate": "2026-06-11", "sampleSize": 500, "sampleType": "LV", "results": {"Seth Bodnar (I)": 45.0, "Kurt Alme (R)": 44.0, "Other": 4.0, "Undecided": 7.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Tavern Research (D)", "startDate": "2026-06-16", "endDate": "2026-06-19", "sampleSize": 400, "sampleType": "LV", "results": {"Seth Bodnar (I)": 50.0, "Kurt Alme (R)": 49.0, "Other": 2.0}},
    {"raceId": "MT-SEN-2026", "pollster": "GrayHouse (R)", "startDate": "2026-06-23", "endDate": "2026-06-24", "sampleSize": 500, "sampleType": "RV", "results": {"Seth Bodnar (I)": 42.0, "Kurt Alme (R)": 41.0, "Other": 3.0, "Undecided": 13.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Hart Research (D)", "startDate": "2026-06-18", "endDate": "2026-06-24", "sampleSize": 800, "sampleType": "LV", "results": {"Seth Bodnar (I)": 47.0, "Kurt Alme (R)": 47.0, "Undecided": 6.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Bullfinch Group (R)", "startDate": "2026-07-13", "endDate": "2026-07-16", "sampleSize": 793, "sampleType": "LV", "results": {"Seth Bodnar (I)": 46.0, "Kurt Alme (R)": 36.0, "Undecided": 18.0}},
    {"raceId": "MT-SEN-2026", "pollster": "GQR (D)", "startDate": "2026-07-23", "endDate": "2026-07-26", "sampleSize": 500, "sampleType": "LV", "results": {"Seth Bodnar (I)": 49.0, "Kurt Alme (R)": 41.0, "Other": 6.0, "Undecided": 4.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Tavern Research (D)", "startDate": "2026-07-23", "endDate": "2026-07-27", "sampleSize": 517, "sampleType": "LV", "results": {"Seth Bodnar (I)": 49.0, "Kurt Alme (R)": 49.0, "Other": 2.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Hart Research (D)", "startDate": "2026-08-01", "endDate": "2026-08-04", "sampleSize": 800, "sampleType": "LV", "results": {"Seth Bodnar (I)": 45.0, "Kurt Alme (R)": 45.0, "Other": 6.0, "Undecided": 4.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Peak Insights", "startDate": "2026-08-23", "endDate": "2026-08-25", "sampleSize": 600, "sampleType": "LV", "results": {"Seth Bodnar (I)": 41.0, "Kurt Alme (R)": 44.0, "Other": 2.0, "Undecided": 13.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Rutgers University Eagleton Institute of Politics", "startDate": "2026-08-27", "endDate": "2026-09-07", "sampleSize": 845, "sampleType": "RV", "results": {"Seth Bodnar (I)": 46.0, "Kurt Alme (R)": 38.0, "Other": 5.0, "Undecided": 11.0}},
    {"raceId": "MT-SEN-2026", "pollster": "Aspect Strategic (I)", "startDate": "2026-09-07", "endDate": "2026-09-15", "sampleSize": 715, "sampleType": "LV", "results": {"Seth Bodnar (I)": 46.0, "Kurt Alme (R)": 44.0, "Undecided": 10.0}}
  ],
};
