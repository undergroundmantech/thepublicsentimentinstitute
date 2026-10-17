import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";
import { DB_OFFICES, type DeskOffice } from "./lib";

export const metadata: Metadata = {
  title: "2026 forecast",
  description:
    "The On Point Politics 2026 midterm forecast for governors, the Senate and the House, from fundamentals, the polling average and 2,000 correlated simulations.",
  alternates: { canonical: "/forecast" },
};

const OFFICES: readonly string[] = ["governor", "senate", "house", ...DB_OFFICES];

// /forecast?office=senate (or governor, house, statewide, attorney-general and the other statewide offices) opens the desk on that office.
export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.office) ? sp.office[0] : sp.office;
  const q = (raw ?? "").toLowerCase();
  const office: DeskOffice = OFFICES.includes(q) ? (q as DeskOffice)
    : q === "statewide" ? "attorney-general"
    : q === "governors" || q === "gov" ? "governor" : q === "sen" ? "senate" : "house";
  return <ForecastDesk initialOffice={office} />;
}
