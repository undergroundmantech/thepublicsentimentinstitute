import type { Metadata } from "next";
import PollIndex from "../PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({"title": "2026 governor polling averages", "description": "Every 2026 governor race with public polling, averaged daily and weighted by recency, sample size and pollster grade. Open a race for its chart, trend lines and full poll table.", "path": "/polls/governor"});
export default function Page() {
  return <PollIndex groups={["governor"]} crumb="Governor" title={<>2026 governor <em>averages</em></>} lede="Every 2026 governor's race with public polling, averaged daily. Open a race for its chart, trend lines and full poll table." />;
}
