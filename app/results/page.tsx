"use client";

import dynamic from "next/dynamic";

// While the (heavy, client-only) results chunk downloads, hold the paint
// with the hub's own dark field — without this, the global light layout
// flashes through for a beat on every navigation into the section.
const OpaResultsPage = dynamic(() => import("./onpoint/OpaResultsPage"), {
  ssr: false,
  loading: () => (
    <>
      {/* Hide the global light chrome during the loading window — otherwise the
          old nav/background flashes for a beat before the OPA shell mounts. */}
      <style>{`body header, body footer { display: none !important; }`}</style>
      <div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background:
            typeof window !== "undefined" && (() => { try { return localStorage.getItem("opa-theme") === "light"; } catch { return false; } })()
              ? "#ffffff"
              : "#0a0b0d",
        }}
      />
    </>
  ),
});

export default function ResultsPage() {
  return <OpaResultsPage />;
}
