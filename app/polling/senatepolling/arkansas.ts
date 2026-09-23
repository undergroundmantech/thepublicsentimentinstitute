// app/polling/senatepolling/arkansas.ts
// Arkansas — 2026 U.S. Senate: Hallie Shoffner (D) vs. Tom Cotton (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-08-18.

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
  abbr: "AR",
  name: "Arkansas",
};

export const DEFAULT_RACE_ID = "AR-SEN-2026";

export const RACES = [
  {
    raceId: "AR-SEN-2026",
    office: "U.S. Senate",
    year: 2026,
    candidates: ["Hallie Shoffner (D)", "Tom Cotton (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AR: [
    {"raceId": "AR-SEN-2026", "pollster": "GrayHouse (R)", "startDate": "2026-02-07", "endDate": "2026-02-09", "sampleSize": 550, "sampleType": "LV", "results": {"Hallie Shoffner (D)": 36.0, "Tom Cotton (R)": 58.0, "Undecided": 7.0}},
    {"raceId": "AR-SEN-2026", "pollster": "2040 Strategy Group (D)", "startDate": "2026-07-17", "endDate": "2026-07-25", "sampleSize": 586, "sampleType": "LV", "results": {"Hallie Shoffner (D)": 43.0, "Tom Cotton (R)": 46.0, "Undecided": 11.0}},
    {"raceId": "AR-SEN-2026", "pollster": "Hendrix College", "startDate": "2026-08-11", "endDate": "2026-08-12", "sampleSize": 1217, "sampleType": "LV", "results": {"Hallie Shoffner (D)": 47.0, "Tom Cotton (R)": 44.0, "Other": 3.0, "Undecided": 6.0}},
    {"raceId": "AR-SEN-2026", "pollster": "J.L. Partners", "startDate": "2026-08-14", "endDate": "2026-08-18", "sampleSize": 803, "sampleType": "LV", "results": {"Hallie Shoffner (D)": 35.0, "Tom Cotton (R)": 51.0, "Other": 4.0, "Undecided": 11.0}}
  ],
};
