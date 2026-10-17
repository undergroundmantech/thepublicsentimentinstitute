import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";
import ForecastHub from "./ForecastHub";
import DeskJump from "./DeskJump";
import { DB_OFFICES, type DeskOffice } from "./lib";

export const metadata: Metadata = {
  title: "2026 forecast",
  description:
    "Every 2026 forecast on one board: the Senate, the House, governors, statewide offices and all 87 state legislative chambers, from the On Point Politics model and 2,000 correlated simulations.",
  alternates: { canonical: "/forecast" },
};

const OFFICES: readonly string[] = ["governor", "senate", "house", ...DB_OFFICES];

// /forecast opens on the hub, every forecast at once, with the race desk below it.
// /forecast?office=senate (or governor, house, statewide, attorney-general and the other statewide offices)
// sets the desk to that office and scrolls straight to it.
export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.office) ? sp.office[0] : sp.office;
  const q = (raw ?? "").toLowerCase();
  const office: DeskOffice = OFFICES.includes(q) ? (q as DeskOffice)
    : q === "statewide" ? "attorney-general"
    : q === "governors" || q === "gov" ? "governor" : q === "sen" ? "senate" : "house";
  return (
    <>
      <div className="opp fc-page hub-wrap"><ForecastHub /></div>
      <ForecastDesk initialOffice={office} embedded />
      {q ? <DeskJump /> : null}
    </>
  );
}
