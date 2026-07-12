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

// The new house-style landing ("The Query Desk") — the default /results surface.
const ResultsDesk = dynamic(() => import("./ResultsDesk"), {
  ssr: false,
  loading: () => <DarkHold />,
});

function ResultsRouter() {
  const sp = useSearchParams();
  const hasDate = !!sp.get("date");
  return hasDate ? <OpaResultsPage /> : <ResultsDesk />;
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<DarkHold />}>
      <ResultsRouter />
    </Suspense>
  );
}
