import type { Metadata } from "next";
import PollIndex from "./PollIndex";
import PollsHome from "./PollsHome";
import { timelineData } from "./timeline/data";
import { seo } from "@/app/lib/seo";
import "./timeline/timeline.css";
import "./promo.css";
export const metadata: Metadata = seo({"title": "2026 polling averages", "description": "The generic ballot and Trump approval averages with a timeline of the term, then every 2026 Senate, governor and House race On Point Politics tracks.", "path": "/polls"});
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
      <PollIndex initial="senate" sub title={<>Every race, <em>on one board</em></>} lede="House districts, Senate races, governor races and the national averages, all current polling: each average is a robust LOWESS fit through every public poll, weighted by recency with a 16 day half life, sample size, voter screen and pollster grade, then refit three times so outlying polls count for less." />
    </>
  );
}
