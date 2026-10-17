import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

// A fixture preview for QA, never indexed.
export const metadata: Metadata = { title: "Timeline preview", robots: { index: false, follow: false } };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
