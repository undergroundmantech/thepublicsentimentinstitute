import type { Metadata } from "next";
import { Suspense } from "react";
import { CandidatesView } from "../views/races";

export const metadata: Metadata = { title: "Candidates", description: "Every candidate with money on file: raised, cash, debt and outside money for and against." };

export default function Page() {
  return <Suspense fallback={null}><CandidatesView /></Suspense>;
}
