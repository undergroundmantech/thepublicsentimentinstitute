import type { Metadata } from "next";
import { Suspense } from "react";
import { AdsView } from "../views/watch";

export const metadata: Metadata = { title: "Political ads", description: "The biggest political ad buyers, weekly spending, spending by state and the latest ads." };

export default function Page() {
  return <Suspense fallback={null}><AdsView /></Suspense>;
}
