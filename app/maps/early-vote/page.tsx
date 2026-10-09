import type { Metadata } from "next";
import EarlyVoteDesk from "./EarlyVoteDesk";

export const metadata: Metadata = {
  title: "Early vote",
  description:
    "Ballots requested, returned and cast in person ahead of the 2026 election, by state and county, with party and demographic breakdowns where states publish them.",
  alternates: { canonical: "/maps/early-vote" },
};

export default function EarlyVotePage() {
  return <EarlyVoteDesk />;
}
