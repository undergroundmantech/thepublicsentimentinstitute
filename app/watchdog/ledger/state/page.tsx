import type { Metadata } from "next";
import { Suspense } from "react";
import { StateView } from "../views/watch";

export const metadata: Metadata = { title: "State money", description: "One state's candidates, races, committees, counties and money." };

export default function Page() {
  return <Suspense fallback={null}><StateView /></Suspense>;
}
