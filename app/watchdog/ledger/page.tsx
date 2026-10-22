import type { Metadata } from "next";
import { Suspense } from "react";
import { LedgerDesk } from "./views/desk";

export const metadata: Metadata = { title: "Ledger money desk", description: "Every reported dollar in the 2026 midterms as it lands: totals, where the money went, the biggest checks, outside money by candidate and alerts." };

export default function Page() {
  return <Suspense fallback={null}><LedgerDesk /></Suspense>;
}
