import type { Metadata } from "next";
import PollIndex from "./PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({"title": "2026 polling averages", "description": "Every polling average On Point Politics tracks: approval, the generic ballot, and every 2026 Senate and governor race.", "path": "/polls"});
export default function Page() {
  return <PollIndex groups={["national", "senate", "governor", "primaries", "2025", "2024"]} title={<>Every average, <em>one page</em></>} lede="Daily averages of every public poll: one robust LOWESS trend line per race, weighted by recency with a 16 day half life, sample size, voter screen and pollster grade." />;
}
