import type { Metadata } from "next";
import { Suspense } from "react";
import { ScoresView } from "../views/watch";

export const metadata: Metadata = { title: "Scores", description: "Campaign health and Ledger Scores for every scored candidate, with a party balance check." };

export default function Page() {
  return <Suspense fallback={null}><ScoresView /></Suspense>;
}
