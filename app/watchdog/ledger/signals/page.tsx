import type { Metadata } from "next";
import { Suspense } from "react";
import { SignalsView } from "../views/watch";

export const metadata: Metadata = { title: "Signals", description: "2028 watch, races heating up, money trouble, shared vendors and donor moves." };

export default function Page() {
  return <Suspense fallback={null}><SignalsView /></Suspense>;
}
