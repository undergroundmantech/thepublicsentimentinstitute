"use client";
import { RAW_POLLS } from "./data";
import PrimaryAverage from "@/app/_polling/lib/PrimaryAverage";

// Florida governor Republican primary: the OnPoint average of every public poll,
// rendered at /polls/fl/governor-gop-primary.
export default function FloridaGovRepublicanPrimaryPage() {
  return (
    <PrimaryAverage cfg={{
      state: "Florida", office: "Governor", party: "R", polls: RAW_POLLS, crumb: "Florida governor",
      generalHref: "/polls/fl/governor", forecastHref: "/forecast/fl/governor",
    }} />
  );
}
