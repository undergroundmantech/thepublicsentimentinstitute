import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupsView } from "../views/money";

export const metadata: Metadata = { title: "Groups", description: "Politically active nonprofits, unions and trade groups, matched to IRS filings, committees and lobbying." };

export default function Page() {
  return <Suspense fallback={null}><GroupsView /></Suspense>;
}
