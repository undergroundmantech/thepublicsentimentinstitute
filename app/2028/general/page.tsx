import type { Metadata } from "next";
import General28 from "../General28";
import Method from "../Method";
import AdUnit from "@/app/components/AdUnit";
import { seo } from "@/app/lib/seo";
import "@/onpoint-sketchbook/styles/sketchbook.css";
import "../h28.css";
import { genRes } from "../lib";
import { geo } from "../data28";
import { getCands, getGen, getGenNames, getGrid } from "../server";

export const metadata: Metadata = seo({
  title: "2028 general election forecast: build any matchup, with third parties",
  description: "Pick any 2028 Democrat and Republican, add running mates and add or remove a third party candidate. Every county is forecast and every state is the sum of its counties, with the path to 270 and the closest states.",
  path: "/2028/general",
  keywords: ["2028 general election forecast", "2028 electoral map", "2028 matchup", "2028 third party", "2028 independent candidate", "2028 election simulator", "build a 2028 ticket"],
});

export default function General28Page() {
  const grid = getGrid();
  const top = [...grid].filter((g) => g.odds != null).sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0))[0];
  const r = genRes(getGen(), top?.d ?? "Generic Democrat", top?.r ?? "Vance")!;
  // the page draws states, not counties, so the counties stay on the server
  const base = { ...r, cty: {} };
  return (
    <main className="h28-page">
      <General28 base={base} cands={getCands()} grid={grid} names={getGenNames()} a24={geo().a24} />
      <AdUnit />
      <Method />
      <AdUnit kind="multiplex" />
    </main>
  );
}
