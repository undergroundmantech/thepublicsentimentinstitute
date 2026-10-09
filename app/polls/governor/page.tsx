import type { Metadata } from "next";
import PollIndex from "../PollIndex";
export const metadata: Metadata = { title: "2026 governor polling averages", alternates: { canonical: "/polls/governor" } };
export default function Page() {
  return <PollIndex groups={["governor"]} crumb="Governor" title={<>2026 governor <em>averages</em></>} lede="Every 2026 governor's race with public polling, averaged daily. Open a race for its chart, trend lines and full poll table." />;
}
