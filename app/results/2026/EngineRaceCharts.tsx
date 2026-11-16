"use client";
// A race page's engine section: its charts through the night, and the projection object the page's headline reads.
// The chance of winning leads at headline size across the page; the projected margin and the count sit beneath it.
import React from "react";
import { CHART_CSS, RaceCharts } from "./EngineCharts";
import { useEngine, useRaceHistory, useRecordedRaceHistory } from "./engineClient";

export { engineOdds, engineProj } from "./engineRow";

const CSS = CHART_CSS + `.erc{margin-top:22px}.erc>h3{font:800 20px var(--font-d);letter-spacing:-.01em;margin:0 0 3px;color:var(--hi)}.erc>p{font-size:13px;line-height:1.5;color:var(--mute);margin:0 0 6px;max-width:92ch}
.erc>.erc-warn{color:var(--hi);border:1px solid #e0533d;border-left-width:4px;border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:12.5px}
.erc>.erc-rec{color:var(--ink2);border:1px solid var(--line2);border-left:4px solid var(--gold);border-radius:8px;padding:8px 12px;margin:0 0 10px;font-size:12.5px;max-width:92ch}`;

/** `title`: a heading other than the default (the state page names the race). `compact`: no heading text beyond it. */
export default function EngineRaceCharts({ raceId, title, recorded = false }: { raceId: string; title?: string; /** outside a replay, with no live engine history: show the recorded night from the replay pack, labelled as a replay */ recorded?: boolean }) {
  const e = useEngine(); const live = useRaceHistory(raceId);
  const rec = useRecordedRaceHistory(raceId, recorded && e.mode === "LIVE" && !live.length);
  if (!e.view && !rec.length) return null;
  const now = e.mode === "REPLAY" && e.clock ? e.clock.tMs : null;
  const fromPack = !live.length && rec.length > 0;
  // outside a replay the recorded chart is election night itself (the pack's first span): the count ran for days
  // after, and nine days on one axis would squeeze the night into a sliver. The replay has the rest.
  const pack = fromPack ? e.sources.find((s) => s.base && s.mode === "HISTORICAL") ?? null : null;
  const nightEnd = pack?.windows?.[0]?.to ?? "2026-11-04T12:00:00.000Z";
  const night = fromPack ? (() => { const p = rec.filter((x) => x.t <= nightEnd); if (p.length && p[p.length - 1].t < nightEnd) p.push({ ...p[p.length - 1], t: nightEnd }); return p; })() : [];
  const packTimes = pack ? pack.times.filter((t) => t <= nightEnd).map((t) => Date.parse(t)) : undefined;
  const pts = fromPack ? night : live, mode = fromPack ? "HISTORICAL" : e.view?.mode ?? "LIVE";
  const row = e.view?.races[raceId];
  const rowsOff = !fromPack && row?.flags.includes("PROVIDER_ROWS_INCONSISTENT");
  const dropped = !fromPack && row?.flags.includes("COUNT_DECREASED");
  const byCounty = !fromPack && row?.flags.includes("COUNTY_MODEL");
  return (
    <div className="erc">
      <style>{CSS}</style>
      {rowsOff ? <p className="erc-warn" role="note"><b>Data check.</b> civicAPI&apos;s total for this race does not agree with its own county rows at this moment (a total row listed among the counties, or a total far above them), so the count shown may be overstated. On Point makes no call on this race while that lasts.</p> : null}
      {dropped ? <p className="erc-warn" role="note"><b>Data check.</b> The count for this race is lower than it was earlier: a correction is in progress at the source. On Point makes no call on this race while that lasts.</p> : null}
      <h3>{title ?? "How the night unfolded"}</h3>
      {fromPack
        ? <p className="erc-rec" role="note"><b>A replay, not a live chart.</b> This is the current On Point model run over the count civicAPI published on election night and in the days after, update by update. It is not what this page showed on the night. The chart covers election night; the replay bar below plays the whole count.</p>
        : <p>Each point is a stored update of the On Point model. Reported votes are civicAPI&apos;s; projections are modeled and uncalibrated.{byCounty ? " This race is modeled county by county: each county's uncounted vote is estimated from its forecast and from how long its count has been still." : ""}{mode === "SIMULATED" ? " SIMULATED DATA: not actual results." : ""}</p>}
      {pts.length ? <RaceCharts pts={pts} now={now} mode={mode} lead obsTimes={fromPack ? packTimes : e.mode === "REPLAY" && e.info?.base && e.frame >= 0 ? e.timesMs.slice(0, e.frame + 1) : undefined} /> : <p className="ec-empty">The history appears once the recorder has stored updates for this race.</p>}
    </div>
  );
}
