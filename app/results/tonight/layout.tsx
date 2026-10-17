import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

// The page is a client board, so its metadata lives here.
export const metadata: Metadata = seo({ title: "Election night results tonight", description: "The On Point Politics election night board: live results, county maps and race calls for the next election on the calendar, and links to every night already counted.", path: "/results/tonight" });

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
