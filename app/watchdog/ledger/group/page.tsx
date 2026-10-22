import type { Metadata } from "next";
import { Suspense } from "react";
import { GroupView } from "../views/money";

export const metadata: Metadata = { title: "Group", description: "A group's IRS filings, committees, spending on candidates and lobbying." };

export default function Page() {
  return <Suspense fallback={null}><GroupView /></Suspense>;
}
