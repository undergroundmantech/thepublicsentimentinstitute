import type { Metadata } from "next";
import { Suspense } from "react";
import { CommitteesView } from "../views/money";

export const metadata: Metadata = { title: "Committees", description: "Super PACs, PACs and campaigns: what they raised, from whom and whom they spent on." };

export default function Page() {
  return <Suspense fallback={null}><CommitteesView /></Suspense>;
}
