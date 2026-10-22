import type { Metadata } from "next";
import { Suspense } from "react";
import { TapeView } from "../views/desk";

export const metadata: Metadata = { title: "Live money tape", description: "Every itemized gift, outside spending report, payment, lobbying report and new filing, newest first." };

export default function Page() {
  return <Suspense fallback={null}><TapeView /></Suspense>;
}
