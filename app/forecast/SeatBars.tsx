"use client";
// Seat count bars for the forecast console: the Senate, the House and governorships, each one bar split into the seats
// Democrats, independents and Republicans hold after November 3 if every race goes to the candidate the forecast has
// ahead, added to the seats not up this year. Independents are the independent nominees the forecast has ahead; the
// seats not up count King and Sanders with the Democrats they caucus with, as the rest of the forecast does.
// A bar opens its layer of the console.
import React from "react";
import type { CChamber, CRace, Layer } from "./ForecastConsole";

type Row = { k: Layer; label: string; total: number; majority: number; majLabel: string; d: number; i: number; r: number; note: string };

function rowOf(k: "senate" | "house" | "governor", c: CChamber, races: CRace[]): Row {
  // every race goes to the candidate the forecast has ahead, added to the seats not up this year
  let d = c.notUpD, i = c.notUpI ?? 0, r = c.notUpR;
  for (const x of races) {
    if (x.m < 0) { if (x.ind) i++; else d++; } else r++;
  }
  const label = k === "senate" ? "Senate" : k === "house" ? "House" : "Governors";
  const majLabel = k === "senate" ? "51 for control" : k === "house" ? "218 for control" : "26 for most";
  const up = k === "house" ? "all 435 seats up" : `${races.length} up, ${c.seatsTotal - races.length} not up`;
  return { k, label, total: c.seatsTotal, majority: c.majority, majLabel, d, i, r, note: up };
}

export default function SeatBars({ ch, data, onPick, active }: { ch: Record<"senate" | "governor" | "house", CChamber>; data: { senate: CRace[]; house: CRace[]; governor: CRace[] }; onPick: (k: Layer) => void; active: Layer }) {
  const rows: Row[] = [rowOf("senate", ch.senate, data.senate), rowOf("house", ch.house, data.house), rowOf("governor", ch.governor, data.governor)];
  return (
    <div className="fcx-seats" role="group" aria-label="Seats by party from the forecast race calls">
      {rows.map((w) => {
        const pct = (n: number) => `${(100 * n) / w.total}%`;
        const lead = w.d + w.i >= w.majority ? (w.d >= w.majority ? "d" : "i") : w.r >= w.majority ? "r" : "";
        return (
          <button type="button" key={w.k} className={`fcx-seat${active === w.k ? " on" : ""}`} onClick={() => onPick(w.k)}
            aria-label={`${w.label}: ${w.d} Democrats, ${w.i} independents, ${w.r} Republicans by the forecast's race calls, ${w.majLabel}`}>
            <span className="sh">
              <span className="lb">{w.label}</span>
              <span className="nt">{w.note}</span>
            </span>
            <span className="cn mono">
              <b className="d">{w.d}<small>D</small></b>
              {w.i > 0 || w.k === "senate" ? <b className="i">{w.i}<small>I</small></b> : null}
              <b className="r">{w.r}<small>R</small></b>
            </span>
            <span className="bar" aria-hidden="true">
              <i className="sd" style={{ width: pct(w.d) }} />
              <i className="si" style={{ width: pct(w.i) }} />
              <i className="sr" style={{ width: pct(w.r) }} />
              <em className="mk" style={{ left: pct(w.majority) }} />
            </span>
            <span className="ft">
              <span>{w.majLabel}</span>
              {lead ? <span className={lead}>{lead === "r" ? "Republicans" : lead === "i" ? "Independents" : "Democrats"} reach it</span> : <span>Nobody reaches it alone</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
