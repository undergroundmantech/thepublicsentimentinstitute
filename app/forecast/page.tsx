import type { Metadata } from "next";
import fs from "node:fs";
import path from "node:path";
import ForecastIndex from "./ForecastIndex";
import ForecastConsole, { type ConsoleData, type CRace, type Layer } from "./ForecastConsole";
import { getModel, isInd } from "@/app/lib/forecastData";
import { raceHref } from "@/app/lib/opp";
import { getDownballot } from "./statewide/data";
import JsonLd from "@/app/components/JsonLd";
import { hubLd, hubMeta } from "./seo";

export function generateMetadata(): Metadata { return hubMeta(); }

const readPub = <T,>(f: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), "public", "forecast", f), "utf8")) as T;

// ?office= picks the layer the console opens on, so the old desk links still land in the right place
function layerOf(q: string): Layer {
  if (q === "senate" || q === "sen") return "senate";
  if (q === "house") return "house";
  if (q === "governor" || q === "governors" || q === "gov") return "governor";
  if (q === "legislatures" || q === "legislature" || q === "sl") return "legis";
  if (q === "measures" || q === "ballot-measures") return "measures";
  if (q === "statewide" || q.includes("-")) return "statewide";
  return "senate";
}

// /forecast is one console: pick a layer, read its map, its odds and its closest races, then every race in it.
export default async function ForecastPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.office) ? sp.office[0] : sp.office;
  const q = (raw ?? "").toLowerCase();
  const model = getModel();
  const pick = (o: string): CRace[] => model.races.filter((r) => r.office === o).map((r) => ({
    id: r.id, st: r.st, state: r.state, d: r.district, name: r.name, dem: r.dem, gop: r.gop, m: r.est.margin, p: r.est.prob, ind: isInd(r), href: raceHref(r.id),
    open: !!r.open, p10: r.est.p10 ?? r.est.margin, p90: r.est.p90 ?? r.est.margin,
  }));
  const chOf = (k: "senate" | "governor" | "house") => {
    const c = model.chambers[k];
    return { demControl: c.demControl, demSeats: c.demSeats, median: c.median ?? Math.round(c.demSeats), seatsTotal: c.seatsTotal, p10: c.demP10 ?? 0, p90: c.demP90 ?? 0,
      majority: k === "senate" ? 51 : k === "house" ? 218 : 26, trend: ((c as unknown as { trend?: { dem: number }[] }).trend ?? []).map((x) => x.dem),
      notUpD: k === "senate" ? model.meta.senNotUpD : k === "governor" ? model.meta.govNotUpD : 0, notUpR: k === "senate" ? model.meta.senNotUpR : k === "governor" ? model.meta.govNotUpR : 0 };
  };
  const statewide: CRace[] = getDownballot().races.map((r) => {
    const un = r.uncontested;
    const m = un ? (un === "D" ? -100 : 100) : r.est.margin;
    return { id: r.id, st: r.st, state: r.state, d: 0, name: `${r.state} ${r.officeLabel.toLowerCase()}`, dem: r.dem ?? "No Democrat", gop: r.gop ?? "No Republican", m, p: un ? (un === "D" ? 0 : 1) : r.est.prob,
      ind: false, href: raceHref(r.id), open: !r.incRunning, p10: r.est.p10 ?? m, p90: r.est.p90 ?? m, office: r.office, officeLabel: r.officeLabel };
  });
  const sl = readPub<{ chambers: { id: string; st: string; state: string; chamber: "house" | "senate"; name: string; seats: number; up: number; majority: number; demControl: number; gopControl: number; demSeats: number; gopSeats: number; p10: number; p90: number }[] }>("statehouse_hub.json");
  const bm = readPub<{ measures: [string, string, string, number, number, number, string][] }>("measures_hub.json");
  const data: ConsoleData = {
    senate: pick("senate"), governor: pick("governor"), house: pick("house"), statewide,
    legis: sl.chambers.map((c) => ({ id: c.id, st: c.st, state: c.state, chamber: c.chamber, name: c.name, seats: c.seats, up: c.up, majority: c.majority, demControl: c.demControl, gopControl: c.gopControl,
      demSeats: c.demSeats, gopSeats: c.gopSeats, p10: c.p10, p90: c.p90, href: `/forecast/legislatures/${c.st.toLowerCase()}/${c.chamber}` })),
    measures: bm.measures.map(([st, label, title, yes, prob, thr, href]) => ({ st, label, title, yes, prob, thr, href })),
    ch: { senate: chOf("senate"), governor: chOf("governor"), house: chOf("house") },
    updated: model.meta.updated, daysOut: model.meta.daysOut, sims: model.meta.sims, generic: model.meta.genericBallot?.avg ?? null,
    ev: model.meta.earlyVote ? { ballots: model.meta.earlyVote.ballots, states: model.meta.earlyVote.states } : null,
  };
  return (
    <>
      <JsonLd data={hubLd()} />
      <div className="opp fc-page fc-xl fx-dark"><ForecastConsole data={data} initial={layerOf(q)} initialOffice={q.includes("-") ? q : undefined} /></div>
      <div className="opp fc-page fc-wide">
        <details className="fcx-index">
          <summary>Browse every forecast page as a plain index</summary>
          <ForecastIndex />
        </details>
      </div>
    </>
  );
}
