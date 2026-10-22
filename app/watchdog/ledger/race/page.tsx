import type { Metadata } from "next";
import { Suspense } from "react";
import { RaceView } from "../views/races";

export const metadata: Metadata = { title: "Race money", description: "One race side by side: each campaign's money, health and Ledger Score." };

export default function Page() {
  return <Suspense fallback={null}><RaceView /></Suspense>;
}
