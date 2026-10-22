import type { Metadata } from "next";
import { Suspense } from "react";
import { WebView } from "../views/watch";

export const metadata: Metadata = { title: "Money web", description: "How the money moves between donors, committees, candidates, vendors and groups." };

export default function Page() {
  return <Suspense fallback={null}><WebView /></Suspense>;
}
