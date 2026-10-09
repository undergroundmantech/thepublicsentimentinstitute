"use client";
import { RAW_POLLS } from "./data";
import PrimaryAverage, { type PrimaryResult } from "@/app/_polling/lib/PrimaryAverage";

// Actual election results (more than 95% reporting, March 3, 2026)
const RESULT: PrimaryResult = {
  results: { Cornyn: 41.88, Paxton: 40.69, Hunt: 13.51 },
  date: "2026-03-03",
  votes: "2,142,151",
  reporting: "More than 95% reporting",
  source: "Results from official Texas election returns.",
};

// Texas Senate Republican primary, rendered at /polls/tx/senate-gop-primary.
export default function TexasRepPrimaryPage() {
  return (
    <PrimaryAverage cfg={{
      state: "Texas", office: "Senate", party: "R", polls: RAW_POLLS, crumb: "Texas Senate", result: RESULT,
      generalHref: "/polls/tx/senate", forecastHref: "/forecast/tx/senate",
      note: "Actual results come from official Texas election returns at more than 95% reporting.",
    }} />
  );
}
