import type { Metadata } from "next";
import { Suspense } from "react";
import { RacesView } from "../views/races";

export const metadata: Metadata = { title: "Races by the money", description: "Every Senate, House and governor race with what each candidate raised, their cash and the outside money in the race." };

export default function Page() {
  return <Suspense fallback={null}><RacesView /></Suspense>;
}
