import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Timeline from "../../timeline/Timeline";
import { timelineData } from "../../timeline/data";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({ title: "Trump approval timeline: the average and the events of his second term", description: "Scroll through Donald Trump's second term day by day: the On Point Politics approval average with the tariffs, the shutdowns, the Iran strikes and every major event marked where it happened.", path: "/polls/approval/timeline" });

export default function Page() {
  const d = timelineData("trump-approval", {
    title: "Trump approval", kicker: "Polling timeline · second term", kind: "approval", avgHref: "/polls/approval",
    lede: "Every day of Donald Trump's second term in the On Point average of job approval polls, with the moments that made news marked where they happened: the tariffs, both shutdowns, the strikes on Iran and Venezuela and more.",
  });
  if (!d) notFound();
  return <Timeline data={d} />;
}
