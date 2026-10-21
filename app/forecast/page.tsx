import type { Metadata } from "next";
import ForecastDesk from "./ForecastDesk";
import ForecastHub from "./ForecastHub";
import DeskJump from "./DeskJump";
import { DB_OFFICES, type DeskOffice } from "./lib";
import ForecastIndex from "./ForecastIndex";
import ForecastBoard, { type BoardData, type BRace } from "./ForecastBoard";
import { getModel, isInd } from "@/app/lib/forecastData";
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
  const model = getModel();
  const pick = (o: string): BRace[] => model.races.filter((r) => r.office === o).map((r) => ({ id: r.id, st: r.st, state: r.state, d: r.district, name: r.name, dem: r.dem, gop: r.gop,
    m: r.est.margin, p: r.est.prob, ind: isInd(r) }));
  const chOf = (k: "senate" | "governor" | "house") => { const c = model.chambers[k];
    return { demControl: c.demControl, demSeats: c.demSeats, median: c.median ?? Math.round(c.demSeats), seatsTotal: c.seatsTotal, p10: c.demP10 ?? 0, p90: c.demP90 ?? 0, notUpD: 0, notUpR: 0,
      majority: k === "senate" ? 51 : k === "house" ? 218 : 26 }; };
  const board: BoardData = { senate: pick("senate"), governor: pick("governor"), house: pick("house"), ch: { senate: chOf("senate"), governor: chOf("governor"), house: chOf("house") }, updated: model.meta.updated };
  return (
    <>
      <JsonLd data={hubLd()} />
      <div className="opp fc-page fc-xl"><ForecastBoard data={board} /></div>
      <div className="opp fc-page hub-wrap"><ForecastHub /></div>
      <div id="fc-desk" style={{ scrollMarginTop: 90 }}><ForecastDesk initialOffice={office} embedded /></div>
      <div className="opp fc-page fc-wide"><ForecastIndex /></div>
      {q ? <DeskJump /> : null}
    </>
  );
}
