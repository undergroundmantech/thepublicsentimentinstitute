"use client";

import dynamic from "next/dynamic";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

// Dark hold while the (heavy, client-only) chunk downloads — without this the
// global light layout flashes through for a beat on every navigation in.
function DarkHold() {
  const light =
    typeof window !== "undefined" &&
    (() => {
      try {
        return localStorage.getItem("opa-theme") === "light";
      } catch {
        return false;
      }
    })();
  return (
    <>
      <style>{`body header, body footer { display: none !important; }`}</style>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 200, background: light ? "#ffffff" : "#050505" }} />
    </>
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
const TonightBoard = dynamic(() => import("./tonight/page"), {
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
