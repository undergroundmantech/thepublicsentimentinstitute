import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";
import ForecastHub from "./ForecastHub";
import DeskJump from "./DeskJump";
import { DB_OFFICES, type DeskOffice } from "./lib";
import ForecastIndex from "./ForecastIndex";
import JsonLd from "@/app/components/JsonLd";
import { hubLd, hubMeta } from "./seo";

export function generateMetadata(): Metadata { return hubMeta(); }

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
      <JsonLd data={hubLd()} />
      <div className="opp fc-page hub-wrap"><ForecastHub /></div>
      <ForecastDesk initialOffice={office} embedded />
      <div className="opp fc-page fc-wide"><ForecastIndex /></div>
      {q ? <DeskJump /> : null}
    </>
  );
}
