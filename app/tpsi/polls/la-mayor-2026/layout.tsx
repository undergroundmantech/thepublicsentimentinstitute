import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Los Angeles mayor poll 2026", "description": "The Public Sentiment Institute's Los Angeles mayoral survey: first choice, leaners allocated, the 2026 midterm mood and Trump approval among likely voters.", "path": "/tpsi/polls/la-mayor-2026", "type": "article"});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
