import type { Metadata } from "next";
import { Suspense } from "react";
import { VendorView } from "../views/money";

export const metadata: Metadata = { title: "Vendor", description: "One firm's clients on both sides and what they paid it for." };

export default function Page() {
  return <Suspense fallback={null}><VendorView /></Suspense>;
}
