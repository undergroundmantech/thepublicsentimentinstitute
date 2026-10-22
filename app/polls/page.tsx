import type { Metadata } from "next";
import PollIndex from "./PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({"title": "2026 polling averages", "description": "Every polling average On Point Politics tracks: approval, the generic ballot, and every 2026 Senate and governor race.", "path": "/polls"});
export default function Page() {
  return <PollIndex initial="senate" title={<>Every poll, <em>on one board</em></>} lede="House districts, Senate races, governor races and the national averages, all current polling: each average is a robust LOWESS fit through every public poll, weighted by recency with a 16 day half life, sample size, voter screen and pollster grade, then refit three times so outlying polls count for less." />;
}
