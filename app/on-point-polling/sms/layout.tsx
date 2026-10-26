import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "SMS polling updates", "description": "Sign up for survey invitations and polling updates by text from The Public Sentiment Institute (TPSI), doing business as On Point Polling, the polling arm behind On Point Politics.", "path": "/on-point-polling/sms"});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
