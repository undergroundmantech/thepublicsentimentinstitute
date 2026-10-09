"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Quiet hold while the (heavy, client only) chunk downloads.
function DarkHold() {
  return (
    <div className="opp" style={{ minHeight: "60vh" }}>
      <div className="empty" role="status">Loading the results desk</div>
    </div>
  );
}

// The hub (date grid + race detail). Mounted only when a ?date= is present or a
// deep-linked race is open.
const OpaResultsPage = dynamic(() => import("./onpoint/OpaResultsPage"), {
  ssr: false,
  loading: () => <DarkHold />,
});

// The standing elections landing page (CO-07), currently the default /results
// surface. ResultsDesk ("The Query Desk") is untouched underneath and returns as
// the default once this landing is retired; this is a router swap only, not a
// replacement of that file. The August 4 primary board it replaced is archived
// at /results/archive/2026-08-04.
const TonightBoard = dynamic(() => import("./live/page"), {
  ssr: false,
  loading: () => <DarkHold />,
});

function ResultsRouter() {
  const sp = useSearchParams();
  const hasDate = !!sp.get("date");
  return hasDate ? <OpaResultsPage /> : <TonightBoard />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<DarkHold />}>
      <ResultsRouter />
    </Suspense>
  );
}
