import type { Metadata } from "next";
import LocalBoard from "./LocalBoard";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Local and down ballot race results", "description": "A fast scan of local and down ballot race results as they are reported.", "path": "/results/local"});

export default function LocalPage() {
  return <LocalBoard />;
}
