import type { Metadata } from "next";
import ElectoralBoard from "./ElectoralBoard";

export const metadata: Metadata = {
  title: "Electoral map",
  description:
    "Build your own 2026 map. Governor, Senate and House scenarios starting from the OnPoint Politics forecast, with a live seat count and a shareable link.",
  alternates: { canonical: "/maps/electoral" },
};

export default function ElectoralMapPage() {
  return <ElectoralBoard />;
}
