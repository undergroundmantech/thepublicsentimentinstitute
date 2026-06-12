"use client";

import dynamic from "next/dynamic";

const OpaResultsPage = dynamic(() => import("../../onpoint/OpaResultsPage"), { ssr: false });

export default function ResultsRacePage() {
  return <OpaResultsPage />;
}
