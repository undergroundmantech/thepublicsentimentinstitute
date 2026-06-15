"use client";

import dynamic from "next/dynamic";

// Hold the paint on the hub's dark field — and hide the global light chrome —
// while the heavy client-only results chunk downloads. Without this the global
// layout (light nav + background) flashes through before the OPA shell mounts.
function ResultsLoader() {
  const light =
    typeof window !== "undefined" &&
    (() => { try { return localStorage.getItem("opa-theme") === "light"; } catch { return false; } })();
  return (
    <>
      <style>{`body header, body footer { display: none !important; }`}</style>
      <div
        aria-hidden
        style={{ position: "fixed", inset: 0, zIndex: 200, background: light ? "#ffffff" : "#0a0b0d" }}
      />
    </>
  );
}

const OpaResultsPage = dynamic(() => import("../../onpoint/OpaResultsPage"), {
  ssr: false,
  loading: () => <ResultsLoader />,
});

export default function ResultsRacePage() {
  return <OpaResultsPage />;
}
