import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

// Race URLs forward to the elections landing page, so they stay out of the index.
export const metadata: Metadata = { title: "Race results", robots: { index: false, follow: true } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
