import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Los Angeles mayor poll 2026", "description": "On Point Polling's Los Angeles mayoral survey: first choice, leaners allocated, the 2026 midterm mood and Trump approval among likely voters.", "path": "/on-point-polling/polls/la-mayor-2026", "type": "article"});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
