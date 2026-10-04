// app/polling/governorpolling/alaska.ts
// Alaska — 2026 Governor: Jonathan Kreiss-Tomkins (D) vs. Bernadette Wilson (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
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
    {"raceId": "AK-GOV-2026", "pollster": "co/efficient (R)", "startDate": "2026-09-14", "endDate": "2026-09-17", "sampleSize": 799, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 43, "Bernadette Wilson (R)": 20, "Dave Bronson (R)": 17, "Treg Taylor (R)": 6, "Undecided": 14}, "notes": "First-choice ballot; no final round published."},
    {"raceId": "AK-GOV-2026", "pollster": "Cygnal (R)", "startDate": "2026-09-24", "endDate": "2026-09-27", "sampleSize": 502, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 44.0, "Bernadette Wilson (R)": 24.0, "Other": 18.0, "Undecided": 15.0}, "notes": "Ranked choice first round. Other is Taylor 8, Bronson 8 and others."},
    {"raceId": "AK-GOV-2026", "pollster": "New York Times/Siena", "startDate": "2026-09-21", "endDate": "2026-09-30", "sampleSize": 600, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 52.0, "Bernadette Wilson (R)": 48.0}, "notes": "Two way figure as published. Sample size was not yet published, so 600 is a placeholder."}
  ],
};
