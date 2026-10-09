import type { Metadata } from "next";
import PollIndex from "./PollIndex";
export const metadata: Metadata = { title: "Polling averages", description: "Every polling average OnPoint Politics tracks: approval, the generic ballot, and every 2026 Senate and governor race.", alternates: { canonical: "/polls" } };
export default function Page() {
  return <PollIndex groups={["national", "senate", "governor", "primaries", "2025", "2024"]} title={<>Every average, <em>one page</em></>} lede="Daily averages of every public poll, weighted by recency, sample size, voter screen and pollster grade, with LOWESS trend lines on every head to head." />;
}
