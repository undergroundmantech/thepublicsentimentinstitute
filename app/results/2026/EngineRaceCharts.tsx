"use client";
// A race page's engine section: its charts through the night, and the projection object the page's headline reads.
import React from "react";
import { CHART_CSS, RaceCharts } from "./EngineCharts";
import { useEngine, useRaceHistory } from "./engineClient";

export { engineOdds, engineProj } from "./engineRow";

export default function EngineRaceCharts({ raceId }: { raceId: string }) {
  const e = useEngine(); const pts = useRaceHistory(raceId);
  if (!e.view) return null;
  const now = e.mode === "REPLAY" && e.clock ? e.clock.tMs : null;
  const rowsOff = e.view.races[raceId]?.flags.includes("PROVIDER_ROWS_INCONSISTENT");
  const byCounty = e.view.races[raceId]?.flags.includes("COUNTY_MODEL");
  return (
    <div className="erc">
      <style>{CHART_CSS + ".erc{margin-top:18px}.erc>h3{font:700 17px var(--font-d);margin:0 0 2px;color:var(--hi)}.erc>p{font-size:12px;color:var(--mute);margin:0 0 4px}.erc>.erc-warn{color:var(--hi);border:1px solid #e0533d;border-left-width:4px;border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:12.5px}"}</style>
      {rowsOff ? <p className="erc-warn" role="note"><b>Data check.</b> civicAPI&apos;s total for this race does not agree with its own county rows at this moment (a total row listed among the counties, or a total far above them), so the count shown may be overstated. The model makes no call on this race while that lasts.</p> : null}
      <h3>How the night unfolded</h3>
      <p>Each point is a stored update of the On Point model. Reported votes are civicAPI&apos;s; projections are modeled and uncalibrated.{byCounty ? " This race is modeled county by county: each county's uncounted vote is estimated from its forecast and from how long its count has been still." : ""}{e.view.mode === "SIMULATED" ? " SIMULATED DATA: not actual results." : ""}</p>
      {pts.length ? <RaceCharts pts={pts} now={now} mode={e.view.mode} obsTimes={e.mode === "REPLAY" && e.info?.base && e.frame >= 0 ? e.timesMs.slice(0, e.frame + 1) : undefined} /> : <p className="ec-empty">The history appears once the recorder has stored updates for this race.</p>}
    </div>
  );
}
