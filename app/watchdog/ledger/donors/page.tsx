import type { Metadata } from "next";
import { Suspense } from "react";
import { DonorsView } from "../views/money";

export const metadata: Metadata = { title: "Donors", description: "The biggest donors of the 2026 cycle, tier by tier, with the side their money helps." };

export default function Page() {
  return <Suspense fallback={null}><DonorsView /></Suspense>;
}
