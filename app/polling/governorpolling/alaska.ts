// app/polling/governorpolling/alaska.ts
// Alaska — 2026 Governor: Jonathan Kreiss-Tomkins (D) vs. Bernadette Wilson (R)
// Generated from the TPSI forecast poll feed (run of 2026-09-22), merged with
// the polls this file already carried. Polls of matchups that are not on the
// ballot were dropped. Newest poll: 2026-09-11.

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
    {"raceId": "AK-GOV-2026", "pollster": "Fabrizio Ward/Impact Research for AARP", "startDate": "2026-09-08", "endDate": "2026-09-11", "sampleSize": 800, "sampleType": "LV", "results": {"Jonathan Kreiss-Tomkins (D)": 50.0, "Bernadette Wilson (R)": 40.0}, "notes": "Simulated ranked-choice final round between the top two finishers in a four-candidate field."}
  ],
};
