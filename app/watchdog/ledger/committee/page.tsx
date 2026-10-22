import type { Metadata } from "next";
import { Suspense } from "react";
import { CommitteeView } from "../views/money";

export const metadata: Metadata = { title: "Committee", description: "What a committee raised, from whom, whom it spent for and against and which firms it paid." };

export default function Page() {
  return <Suspense fallback={null}><CommitteeView /></Suspense>;
}
