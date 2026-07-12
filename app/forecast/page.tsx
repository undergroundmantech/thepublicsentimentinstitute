import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ForecastDesk from "./ForecastDesk";
import { SITE_V2 } from "@/app/lib/flags";

export const metadata: Metadata = {
  title: "The Forecast · TPSI",
  description:
    "TPSI's 2026 midterm forecast — governors, Senate, and House, from fundamentals, polling, expert ratings, and 10,000 correlated simulations.",
};

export default function ForecastPage() {
  // v2-only route
  if (!SITE_V2) notFound();
  return <ForecastDesk />;
}
