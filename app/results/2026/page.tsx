import type { Metadata } from "next";
import { Suspense } from "react";
import fs from "node:fs";
import path from "node:path";
import Link from "@/app/components/Link";
import RacesHub from "./RacesHub";
import { seo } from "@/app/lib/seo";
import { STN } from "./live";
import "./results2026.css";
import "./[id]/stateResults.css";

export const metadata: Metadata = seo({
  title: "2026 Election Results: Live Senate, Governor and House Results by State | On Point Politics", absoluteTitle: true, path: "/results/2026",
  description: "Live November 3, 2026 election results for every Senate, governor and House race and every statewide office, ballot measure and state legislature On Point Politics forecasts, state by state, with the expected vote beside the count.",
  keywords: ["2026 election results", "midterm election results", "election results tonight", "senate results 2026", "governor results 2026", "house results 2026"],
});

const states = () => {
  const rs = JSON.parse(fs.readFileSync(path.join(process.cwd(), "public/results/2026/index.json"), "utf8")).races as { st: string }[];
  return [...new Set(rs.map((r) => r.st))].filter((s) => STN[s]).sort((a, b) => STN[a].localeCompare(STN[b]));
};

export default function Page() {
  return (
    <>
      <Suspense fallback={<div className="rl-load sx-skel" />}><RacesHub /></Suspense>
      <nav className="opp srs srs-states" aria-label="Results by state" style={{ paddingTop: 0 }}>
        <h2>Results by state</h2>
        <div>{states().map((s) => <Link key={s} href={`/results/2026/${STN[s].toLowerCase().replace(/[^a-z]+/g, "-")}`}>{STN[s]}</Link>)}</div>
      </nav>
    </>
  );
}
