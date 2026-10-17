import type { Metadata } from "next";
import FloridaPrimary from "./FloridaPrimary";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Florida Republican governor primary scenario engine", "description": "Interactive scenario engine for the 2026 Florida Republican gubernatorial primary. Set candidate performance by demographic group, model turnout, and watch all 67 counties recompute.", "path": "/floridaprimary"});

export default function Page() {
  return <FloridaPrimary />;
}
