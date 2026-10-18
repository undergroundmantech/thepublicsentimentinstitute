import type { Metadata } from "next";
import EarlyVoteDesk from "./EarlyVoteDesk";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "2026 early vote tracker by state and county", "description": "Is 2026 early voting ahead of 2022 and 2024? Ballots cast by mail and in person in every reporting state against the same day in past years, with turnout so far, party and demographic breakdowns, by state and county.", "path": "/maps/early-vote"});

export default function EarlyVotePage() {
  return <EarlyVoteDesk />;
}
