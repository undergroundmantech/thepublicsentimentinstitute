import type { Metadata } from "next";
import EarlyVoteDesk from "./EarlyVoteDesk";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "2026 early vote tracker by state and county", "description": "Ballots requested, returned and cast in person ahead of the 2026 election, by state and county, with party and demographic breakdowns where states publish them.", "path": "/maps/early-vote"});

export default function EarlyVotePage() {
  return <EarlyVoteDesk />;
}
