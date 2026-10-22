import type { Metadata } from "next";
import { Suspense } from "react";
import { LobbyingView } from "../views/watch";

export const metadata: Metadata = { title: "Lobbying", description: "The biggest lobbying clients, their issues and the latest reports." };

export default function Page() {
  return <Suspense fallback={null}><LobbyingView /></Suspense>;
}
