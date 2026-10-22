import type { Metadata } from "next";
import { Suspense } from "react";
import { DonorView } from "../views/money";

export const metadata: Metadata = { title: "Donor", description: "Where one donor's money went, by recipient and by month." };

export default function Page() {
  return <Suspense fallback={null}><DonorView /></Suspense>;
}
