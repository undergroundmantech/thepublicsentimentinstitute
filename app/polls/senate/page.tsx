import type { Metadata } from "next";
import PollIndex from "../PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({"title": "2026 Senate polling averages", "description": "Every 2026 Senate race with public polling, averaged daily and weighted by recency, sample size and pollster grade. Open a race for its chart, trend lines and full poll table.", "path": "/polls/senate"});
export default function Page() {
  return <PollIndex groups={["senate"]} crumb="Senate" title={<>2026 Senate <em>averages</em></>} lede="Every 2026 Senate matchup with public polling, averaged daily. Open a race for its chart, trend lines and full poll table." />;
}
