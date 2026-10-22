import type { Metadata } from "next";
import { Suspense } from "react";
import { StatesView } from "../views/watch";

export const metadata: Metadata = { title: "States", description: "Money and races in every state." };

export default function Page() {
  return <Suspense fallback={null}><StatesView /></Suspense>;
}
