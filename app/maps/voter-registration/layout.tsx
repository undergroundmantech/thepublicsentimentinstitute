import type { Metadata } from "next";
import type { ReactNode } from "react";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Voter registration by state and county", "description": "Registered voter totals by state and county, from each state's own election authority.", "path": "/maps/voter-registration"});

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
