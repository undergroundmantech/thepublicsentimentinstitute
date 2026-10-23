import type { Metadata } from "next";
import WhatIf from "@/app/forecast/what-if/WhatIf";
import ScenarioNav from "@/app/components/opp/ScenarioNav";
import ScenarioModes, { MODE_BOOT } from "@/app/forecast/scenarios/ScenarioModes";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({
  title: "2026 What If Scenarios: Pick Winners, Watch Every Race Move | On Point Politics",
  absoluteTitle: true,
  description: "Pick a winner or a winning margin in any 2026 Senate, governor or House race and see how every other race and control of each chamber moves, using the On Point forecast's 2,000 joint simulations.",
  path: "/what-if",
  keywords: ["2026 election scenarios", "what if election map", "Senate scenario builder", "2026 forecast simulator", "midterm election what if"],
});

export default function Page() {
  return (
    <div className="opp fc-page fx-dark">
      <script dangerouslySetInnerHTML={{ __html: MODE_BOOT }} />
      <ScenarioNav />
      <ScenarioModes tool="counties" base="/what-if" crumbs>
        <WhatIf />
      </ScenarioModes>
    </div>
  );
}
