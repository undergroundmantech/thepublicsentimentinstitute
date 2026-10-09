"use client";
import { RAW_POLLS } from "./data";
import PrimaryAverage from "@/app/_polling/lib/PrimaryAverage";

// Maine Senate Democratic primary (Platner, Mills, Costello, Wood), rendered at
// /polls/me/senate-dem-primary.
export default function MaineGovDemocraticPrimaryPage() {
  return (
    <PrimaryAverage cfg={{
      state: "Maine", office: "Senate", party: "D", polls: RAW_POLLS, crumb: "Maine Senate",
      generalHref: "/polls/me/senate", forecastHref: "/forecast/me/senate",
    }} />
  );
}
