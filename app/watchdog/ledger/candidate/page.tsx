import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidateView } from "../views/races";

export const metadata: Metadata = { title: "Candidate money", description: "A campaign's health, Ledger Score, donors, outside groups, timeline and voting record." };

export default function Page() {
  return <Suspense fallback={null}><CandidateView /></Suspense>;
}
