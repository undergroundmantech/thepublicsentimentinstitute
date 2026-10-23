import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Timeline from "../../timeline/Timeline";
import { timelineData } from "../../timeline/data";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({ title: "Generic ballot timeline: the 2026 House vote and the events behind it", description: "Scroll through the race for the House day by day: the On Point Politics generic ballot average with every major event of 2025 and 2026 marked where it happened.", path: "/polls/generic-ballot/timeline" });

export default function Page() {
  const d = timelineData("generic-ballot", {
    title: "The generic ballot", kicker: "Polling timeline · 2026 House", kind: "generic", avgHref: "/polls/generic-ballot",
    lede: "Which party voters want running the House, day by day in the On Point average of generic ballot polls, with the moments that made news marked where they happened.",
  });
  if (!d) notFound();
  return <Timeline data={d} />;
}
