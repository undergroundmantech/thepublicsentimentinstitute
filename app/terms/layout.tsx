import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Privacy policy and terms", "description": "The privacy policy, terms and conditions and mobile terms of service for On Point Politics and The Public Sentiment Institute.", "path": "/terms"});

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
