import type { Metadata } from "next";
import PollIndex from "../PollIndex";
export const metadata: Metadata = { title: "2026 Senate polling averages", alternates: { canonical: "/polls/senate" } };
export default function Page() {
  return <PollIndex groups={["senate"]} crumb="Senate" title={<>2026 Senate <em>averages</em></>} lede="Every 2026 Senate matchup with public polling, averaged daily. Open a race for its chart, trend lines and full poll table." />;
}
