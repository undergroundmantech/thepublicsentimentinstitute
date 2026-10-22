import type { Metadata } from "next";
import { Suspense } from "react";
import { ForeignView } from "../views/watch";

export const metadata: Metadata = { title: "Foreign agents and cases", description: "Foreign agent registrations, FEC enforcement, Justice Department cases, stock trades and sanctions matches." };

export default function Page() {
  return <Suspense fallback={null}><ForeignView /></Suspense>;
}
