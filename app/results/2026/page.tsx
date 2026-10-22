import type { Metadata } from "next";
import { Suspense } from "react";
import RacesHub from "./RacesHub";
import "./results2026.css";

export const metadata: Metadata = {
  title: "Every November 3, 2026 race: expected and reported",
  description: "All 1,017 races the On Point Politics forecast covers on November 3, 2026, from the Senate and House to statewide offices, ballot measures and state legislatures, with the expected vote and live returns from civicAPI.",
  alternates: { canonical: "https://onpointpolitics.com/results/2026" },
};

export default function Page() {
  return <Suspense fallback={<div className="rl-load sx-skel" />}><RacesHub /></Suspense>;
}
