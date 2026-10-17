import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Situation room: the live election monitor", "description": "The On Point Politics live monitor: the latest polls, today's contests, the calendar ahead and the tightest Senate races.", "path": "/tpsi/situation-room"});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
