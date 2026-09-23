import type { Metadata } from "next";
import ElectoralBoard from "./ElectoralBoard";

export const metadata: Metadata = {
  title: "Electoral Map · TPSI",
  description:
    "Flip the 2026 board. Governor, Senate and House scenarios starting from the TPSI forecast, with a live seat count and a shareable link.",
};

export default function ElectoralMapPage() {
  return <ElectoralBoard />;
}
