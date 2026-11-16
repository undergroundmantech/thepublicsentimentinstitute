import type { Metadata } from "next";
import { LiveProvider } from "../LiveProvider";
import CallsTracker from "./CallsTracker";
import "../results2026.css";
import "./calls.css";

// The Calls Desk: a page of the site (in the header's 2026 Results tab, on the monitor and on the main results page).
// It shows On Point's calls and the progress of every other race in one table. It does not make calls and reads
// nothing internal.
export const metadata: Metadata = {
  title: "Calls desk: every 2026 race in one table",
  description: "Every On Point Politics call of the 2026 election and where every other race stands: votes in, the lead, the model's win probability and forecast result. Filter by office and by status.",
  alternates: { canonical: "/results/2026/calls" },
};

export default function CallsPage() {
  return (
    <LiveProvider>
      <CallsTracker />
    </LiveProvider>
  );
}
