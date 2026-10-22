import type { Metadata } from "next";
import PollIndex from "../PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({"title": "2026 governor polling averages", "description": "Every 2026 governor race with public polling, averaged daily and weighted by recency, sample size and pollster grade. Open a race for its chart, trend lines and full poll table.", "path": "/polls/governor"});
export default function Page() {
  return <PollIndex initial="governor" title={<>Every 2026 governor <em>poll</em></>} lede="Every governor race with public polling, on one board: the marker map, every race in the list beside it and the closest races on sticky notes. Tap any race to open its average." />;
}
