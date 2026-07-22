import type { Metadata } from "next";
import ArizonaBoard from "./ArizonaBoard";

export const metadata: Metadata = {
  title: "Arizona Primary Results · July 21, 2026 | TPSI Election Desk",
  description:
    "Live Arizona primary results for July 21, 2026 — Governor, US Senate, and statewide offices, reported as counties close. The Public Sentiment Institute Election Desk.",
};

// Live board; never statically cached.
export const dynamic = "force-dynamic";

export default function ArizonaPage() {
  return <ArizonaBoard />;
}
