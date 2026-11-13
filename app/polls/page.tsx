import type { Metadata } from "next";
import PollIndex from "./PollIndex";
import PollsHome from "./PollsHome";
import { timelineData } from "./timeline/data";
import { seo } from "@/app/lib/seo";
import "./timeline/timeline.css";
import "./promo.css";
export const metadata: Metadata = seo({"title": "Polling averages: 2028 primaries, 2028 matchups, Trump approval", "description": "The generic ballot and Trump approval averages with a timeline of the term, the 2028 Republican and Democratic primaries with every candidate, every 2028 general election matchup and the 2024 and 2025 archive.", "path": "/polls"});
export default function Page() {
  const approval = timelineData("trump-approval", {
    title: "Trump approval", kicker: "Polling timeline · second term", kind: "approval", avgHref: "/polls/approval",
    lede: "Every day of Donald Trump's second term in the On Point average of job approval polls, with the moments that made news marked where they happened.",
  });
  const generic = timelineData("generic-ballot", {
    title: "The generic ballot", kicker: "Polling timeline · 2026 midterms", kind: "generic", avgHref: "/polls/generic-ballot",
    lede: "Every day since the inauguration in the On Point average of the generic congressional ballot, with the moments that made news marked where they happened.",
  });
  return (
    <>
      {approval && generic ? <PollsHome approval={approval} generic={generic} /> : null}
      <PollIndex initial="2028" sub title={<>2028, <em>on one board</em></>} lede="Both 2028 primaries with every candidate, every 2028 general election matchup, the national averages and the 2024 and 2025 archive. The 2026 race averages closed with the election and stay with each race on the forecast. Each average is a robust LOWESS fit through every public poll, weighted by recency with a 16 day half life, sample size, voter screen and pollster grade, then refit three times so outlying polls count for less." />
    </>
  );
}
