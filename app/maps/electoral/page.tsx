import type { Metadata } from "next";
import ElectoralBoard from "./ElectoralBoard";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "2026 electoral map builder: Senate, House and governor", "description": "Build your own 2026 map. Governor, Senate and House scenarios starting from the On Point Politics forecast, with a live seat count and a shareable link.", "path": "/maps/electoral"});

export default function ElectoralMapPage() {
  return <ElectoralBoard />;
}
