import type { Metadata } from "next";
import { Suspense } from "react";
import { EventsView } from "../views/watch";

export const metadata: Metadata = { title: "Events", description: "Organizing events and campaign paid events, coming up and past." };

export default function Page() {
  return <Suspense fallback={null}><EventsView /></Suspense>;
}
