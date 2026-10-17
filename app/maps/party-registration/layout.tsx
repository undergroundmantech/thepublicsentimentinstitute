import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Party registration by state and county", "description": "Which party leads the voter rolls in every state and county that registers by party.", "path": "/maps/party-registration"});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
