// app/polling/senatepolling/nebraska.ts
// Nebraska — 2026 U.S. Senate: Dan Osborn (I) vs. Pete Ricketts (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-16.
// Osborn runs as an independent. The Democratic nominee withdrew, so he holds the
// only non Republican line on the ballot and the forecast models him in that column.

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
  abbr: "NE",
  name: "Nebraska",
};

export const DEFAULT_RACE_ID = "NE-SEN-2026";

export const RACES = [
  {
    raceId: "NE-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Dan Osborn (I)", "Pete Ricketts (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  NE: [
    {"raceId": "NE-SEN-2026", "pollster": "Change Research", "startDate": "2025-03-28", "endDate": "2025-04-01", "sampleSize": 524, "sampleType": "LV", "results": {"Pete Ricketts (R)": 46, "Dan Osborn (I)": 45, "Undecided": 9}, "moe": 4.6, "notes": "Osborn is Democratic-endorsed Independent."},
    {"raceId": "NE-SEN-2026", "pollster": "Lake Research Partners", "startDate": "2025-07-23", "endDate": "2025-07-29", "sampleSize": 900, "sampleType": "LV", "results": {"Pete Ricketts (R)": 46, "Dan Osborn (I)": 47, "Undecided": 7}, "moe": 3.3, "notes": "Osborn treated as Dem-aligned Independent."},
    {"raceId": "NE-SEN-2026", "pollster": "Lake Research Partners", "startDate": "2025-12-11", "endDate": "2025-12-17", "sampleSize": 900, "sampleType": "LV", "results": {"Pete Ricketts (R)": 48, "Dan Osborn (I)": 47, "Undecided": 5}, "notes": "Osborn is an Independent endorsed by Democrats."},
    {"raceId": "NE-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-02-02", "endDate": "2026-02-05", "sampleSize": 600, "sampleType": "LV", "results": {"Dan Osborn (I)": 47.0, "Pete Ricketts (R)": 48.0, "Undecided": 5.0}},
    {"raceId": "NE-SEN-2026", "pollster": "Tavern Research (D)", "startDate": "2026-05-08", "endDate": "2026-05-11", "sampleSize": 1165, "sampleType": "LV", "results": {"Dan Osborn (I)": 47.0, "Pete Ricketts (R)": 42.0, "Undecided": 12.0}},
    {"raceId": "NE-SEN-2026", "pollster": "Impact Research (D)", "startDate": "2026-08-09", "endDate": "2026-08-13", "sampleSize": 600, "sampleType": "LV", "results": {"Dan Osborn (I)": 47.0, "Pete Ricketts (R)": 47.0, "Undecided": 5.0}},
    {"raceId": "NE-SEN-2026", "pollster": "SurveyUSA", "startDate": "2026-09-08", "endDate": "2026-09-13", "sampleSize": 503, "sampleType": "LV", "results": {"Dan Osborn (I)": 46.0, "Pete Ricketts (R)": 42.0, "Other": 4.0, "Undecided": 7.0}},
    {"raceId": "NE-SEN-2026", "pollster": "Wedgewood Polls", "startDate": "2026-09-14", "endDate": "2026-09-16", "sampleSize": 500, "sampleType": "LV", "results": {"Dan Osborn (I)": 48.0, "Pete Ricketts (R)": 52.0}}
  ],
};
