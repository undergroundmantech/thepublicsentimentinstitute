"use client";
import { RAW_POLLS } from "./data";
import PrimaryAverage, { type PrimaryResult } from "@/app/_polling/lib/PrimaryAverage";

// Actual election results (more than 95% reporting, March 3, 2026)
const RESULT: PrimaryResult = {
  results: { Talarico: 52.45, Crockett: 46.22, Hassan: 1.34 },
  date: "2026-03-03",
  votes: "2,309,696",
  reporting: "More than 95% reporting",
  source: "Results from official Texas election returns.",
};

// Texas Senate Democratic primary, rendered at /polls/tx/senate-dem-primary.
export default function TexasDemPrimaryPage() {
  return (
    <PrimaryAverage cfg={{
      state: "Texas", office: "Senate", party: "D", polls: RAW_POLLS, crumb: "Texas Senate", result: RESULT,
      generalHref: "/polls/tx/senate", forecastHref: "/forecast/tx/senate",
      note: "Actual results come from official Texas election returns at more than 95% reporting.",
    }} />
  );
}
