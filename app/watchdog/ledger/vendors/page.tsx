import type { Metadata } from "next";
import { Suspense } from "react";
import { VendorsView } from "../views/money";

export const metadata: Metadata = { title: "Vendors", description: "The firms campaigns and super PACs pay, by kind of work, and who pays them." };

export default function Page() {
  return <Suspense fallback={null}><VendorsView /></Suspense>;
}
