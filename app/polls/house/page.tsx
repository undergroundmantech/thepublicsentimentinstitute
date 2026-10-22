import type { Metadata } from "next";
import PollIndex from "../PollIndex";
import { seo } from "@/app/lib/seo";
export const metadata: Metadata = seo({ title: "2026 House district polls", description: "Every 2026 House district with public polling, on one board: the district polling average the On Point House forecast uses next to the forecast itself.", path: "/polls/house" });
export default function Page() {
  return <PollIndex initial="house" title={<>Every polled House <em>district</em></>} lede="Every 2026 House district with public polling. Each one shows the district polling average the House forecast uses, internals moved 1.5 points against their own side, next to the forecast margin. Tap a state to list its districts." />;
}
