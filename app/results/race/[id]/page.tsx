"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { notFound } from "next/navigation";
import { SITE_V2 } from "@/app/lib/flags";

// The single-race desk (RaceDesk.tsx) is retired for primary night
// (2026-08-04) — it proved too unstable to ship under time pressure, and
// every race it would have shown (county map, county table included) now
// lives directly on /results/tonight. Redirect rather than delete
// RaceDesk.tsx, so this can be restored later by reverting this one file.
export default function ResultsRacePage() {
  // v2-only route — v1 race URLs rewrite to /results (see next.config.ts)
  if (!SITE_V2) notFound();
  const router = useRouter();
  useEffect(() => {
    router.replace("/results/tonight");
  }, [router]);
  return (
    <>
      <style>{`body header, body footer { display: none !important; }`}</style>
      <div aria-hidden style={{ position: "fixed", inset: 0, zIndex: 200, background: "#f7f7f4" }} />
    </>
  );
}
