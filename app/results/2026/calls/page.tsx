import type { Metadata } from "next";
import { LiveProvider } from "../LiveProvider";
import CallsBoard from "./CallsBoard";
import "../results2026.css";
import "./calls.css";

// Public but unlinked: no header, footer, sitemap or other link points here, and it asks search engines to stay out.
// "Unlinked" is not "private": everything on it is already public, and nothing internal is read.
export const metadata: Metadata = {
  title: "Election calls board",
  description: "Every election call in one read-only board: official calls, On Point projections and races not yet called.",
  robots: { index: false, follow: false, nocache: true },
  alternates: { canonical: "/results/2026/calls" },
};

export default function CallsPage() {
  return (
    <LiveProvider>
      <CallsBoard />
    </LiveProvider>
  );
}
