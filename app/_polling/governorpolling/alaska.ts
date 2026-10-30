// app/polling/governorpolling/alaska.ts
// Alaska — 2026 Governor: Jonathan Kreiss-Tomkins (D) vs. Bernadette Wilson (R)
// Generated from the On Point Polling forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-30.

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

export const DEFAULT_RACE_ID = "AK-GOV-2026";

export const RACES = [
  {
    raceId: "AK-GOV-2026",
    office: "Governor",
    year: 2026,
    candidates: ["Jonathan Kreiss-Tomkins (D)", "Bernadette Wilson (R)"],
  },
] as const;

export const STATE_POLLS: Record<string, Poll[]> = {
  AK: [
    {"raceId": "AK-GOV-2026", "pollster": "Fabrizio Ward/Impact Research", "startDate": "2026-09-08", "endDate": "2026-09-11", "sampleSize": 800, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 55, "Bernadette Wilson (R)": 45}, "notes": "Published ranked-choice final round. Bipartisan, for AARP. First choice: Kreiss-Tomkins 40, Wilson 20, Bronson 14, Taylor 7, undecided 18."},
    {"raceId": "AK-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-17", "sampleSize": 799, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 55.4, "Bernadette Wilson (R)": 44.6}, "notes": "Final round estimated from the first choice ballot with the forecast's ranked choice transfers, since no final round was published. First choice as published: Kreiss-Tomkins 43, Wilson 20, Bronson 17, Taylor 6, undecided 14."},
    {"raceId": "AK-GOV-2026", "pollster": "Cygnal (R)", "startDate": "2026-09-24", "endDate": "2026-09-27", "sampleSize": 502, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 55.4, "Bernadette Wilson (R)": 44.6}, "notes": "Final round estimated from the first round with the forecast's ranked choice transfers, since no final round was published. First round as published: Kreiss-Tomkins 44, Wilson 24, other 18 with Taylor 8 and Bronson 8, undecided 15."},
    {"raceId": "AK-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-09-21", "endDate": "2026-09-30", "sampleSize": 600, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 52.0, "Bernadette Wilson (R)": 48.0}, "notes": "Two way figure as published. Sample size was not yet published, so 600 is a placeholder."},
    {"raceId": "AK-GOV-2026", "pollster": "Alaska Survey Research", "startDate": "2026-10-01", "endDate": "2026-10-03", "sampleSize": 1512, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 54.0, "Bernadette Wilson (R)": 46.0}, "notes": "Final ranked choice round. First round Kreiss-Tomkins 48, Wilson 27, Bronson 15, Taylor 10."},
    {"raceId": "AK-GOV-2026", "pollster": "Data for Progress (D)", "startDate": "2026-10-08", "endDate": "2026-10-16", "sampleSize": 694, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 53, "Bernadette Wilson (R)": 47}, "notes": "Final ranked choice round as published. First choice Kreiss-Tomkins 46 against 49 for the Republican field combined."},
    {"raceId": "AK-GOV-2026", "pollster": "Alaska Survey Research", "startDate": "2026-10-15", "endDate": "2026-10-18", "sampleSize": 1568, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 55, "Bernadette Wilson (R)": 45}, "notes": "Final ranked choice round. First choice party totals 50 and 50."},
    {"raceId": "AK-GOV-2026", "pollster": "Alaska Survey Research", "startDate": "2026-10-23", "endDate": "2026-10-25", "sampleSize": 1068, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 51, "Bernadette Wilson (R)": 50}, "notes": "First choice party totals: Kreiss-Tomkins 51, Wilson 31, Bronson 12, Taylor 7; no final round published. Seen on 270toWin only, added Oct 29 at the publisher's request."}
  ],
};
