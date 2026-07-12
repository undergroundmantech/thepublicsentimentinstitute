"use client";

import dynamic from "next/dynamic";
import { notFound } from "next/navigation";
import { SITE_V2 } from "@/app/lib/flags";

// Hold the paint on the desk's dark field — and hide the global light chrome —
// while the client-only race page chunk downloads.
function RaceLoader() {
  return (
    <>
      <style>{`body header, body footer { display: none !important; }`}</style>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 200, background: "#050505" }} />
    </>
  );
}

// The race desk — NYT-style single-race page: tallies + county map + the
// needle, with every party's contest for the office on one page. The precinct
// map (the full ESRI build) opens from here.
const RaceDesk = dynamic(() => import("./RaceDesk"), {
  ssr: false,
  loading: () => <RaceLoader />,
});

export default function ResultsRacePage() {
  // v2-only route — v1 race URLs rewrite to /results (see next.config.ts)
  if (!SITE_V2) notFound();
  return <RaceDesk />;
}
