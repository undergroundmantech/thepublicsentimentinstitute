"use client";
// The monitor's chart dock: one large chart at a time under the globe, following the same clock as the map. It shows
// the national picture (control of each chamber, projected seats, the House popular vote) or, when a race is picked
// on the globe or in a list, that race (its chance of winning, its projected margin, its count). The charts used to
// sit in the 370-pixel side panel, three to a column, too small to read; here a chart has the width of the map.
import React, { useEffect, useRef, useState } from "react";
import { CHART_CSS, NATIONAL_CHART_LABEL, NationalCharts, RaceCharts, firstRoundOnly, type NationalChartKey, type RaceChartKey } from "../2026/EngineCharts";
import { useEngine, useRaceHistory } from "../2026/engineClient";

export type DockSize = "min" | "half" | "full";
const NAT: NationalChartKey[] = ["house-control", "senate-control", "house-seats", "senate-seats", "gov-seats", "vote"];
const RACE: [RaceChartKey, string][] = [["prob", "Chance of winning"], ["margin", "Projected margin"], ["votes", "Votes counted"]];

export default function MonitorCharts({ race, size, onSize }: { race: { id: string; nm: string } | null; size: DockSize; onSize: (s: DockSize) => void }) {
  const e = useEngine();
  const [nat, setNat] = useState<NationalChartKey>("house-control");
  const [rk, setRk] = useState<RaceChartKey>("prob");
  // a picked race takes the dock; "National" brings the national charts back without unpicking it
  const [scope, setScope] = useState<"race" | "national">("national");
  const last = useRef<string | null>(null);
  useEffect(() => { const id = race?.id ?? null; if (id !== last.current) { last.current = id; setScope(id ? "race" : "national"); } }, [race?.id]);
  const pts = useRaceHistory(race && scope === "race" ? race.id : null);
  const body = useRef<HTMLDivElement>(null); const [h, setH] = useState(0);
  const ready = e.available && !!e.view;
  useEffect(() => {
    const el = body.current; if (!el) return; const read = () => setH(Math.round(el.clientHeight));
    read(); if (typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, [size, ready]);
  if (!ready || !e.view) return null;
  const now = e.mode === "REPLAY" && e.clock ? e.clock.tMs : null;
  const showRace = !!race && scope === "race";
  // the chart takes the dock's height, less its source line (the chart's own title is the dock's caption here)
  const ch = h > 0 ? Math.max(150, h - 30) : undefined;
  const cap: [string, string] = showRace
    ? (rk === "prob" ? (firstRoundOnly(pts) ? ["Chance of finishing first", "This race needs a majority, so a runoff is possible: the model's chance of finishing first in this round. Not a call."] : ["Chance of winning", "The model's probability at each update. A probability is not a call."]) : rk === "margin" ? ["Projected final margin", "Colour: the projected final margin and its 80% range. Black: the margin of the votes counted so far."] : ["Votes counted", "As reported by civicAPI. A count can go down when a county corrects it."])
    : (nat === "house-control" ? ["Chance of controlling the House", "Modeled from the returns at each moment. A probability, not a call."] : nat === "senate-control" ? ["Chance of controlling the Senate", "51 seats, or 50 with the Vice President. Independents are counted with the Democratic caucus (an assumption)."]
      : nat === "vote" ? ["National House popular vote", "Black: margin of the votes counted so far. Colour: projected final margin, with its 80% range."] : [nat === "house-seats" ? "Projected House seats" : nat === "senate-seats" ? "Projected Senate seats" : "Projected governorships", "Projected final seats with the model's 80% range. Dotted: seats On Point has called."]);
  return (
    <section className={`mon-dock s-${size}`} aria-label="Charts">
      <style>{CHART_CSS}</style>
      <header className="mon-dock-h">
        <b>Charts</b>
        {race ? (
          <div className="mon-seg sm" role="group" aria-label="Which charts">
            <button type="button" aria-pressed={showRace} onClick={() => setScope("race")}>{race.nm}</button>
            <button type="button" aria-pressed={!showRace} onClick={() => setScope("national")}>National</button>
          </div>
        ) : null}
        {size !== "min" ? (
          <div className="mon-dock-tabs" role="tablist" aria-label="Chart">
            {showRace
              ? RACE.map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={rk === k} onClick={() => setRk(k)}>{l}</button>)
              : NAT.map((k) => <button key={k} type="button" role="tab" aria-selected={nat === k} onClick={() => setNat(k)}>{NATIONAL_CHART_LABEL[k]}</button>)}
          </div>
        ) : <span className="mon-dock-hint">{showRace ? race!.nm : "Control, seats and the popular vote through the night"}</span>}
        <div className="mon-dock-size" role="group" aria-label="Chart size">
          <button type="button" aria-pressed={size === "min"} onClick={() => onSize("min")} title="Hide the chart" aria-label="Hide the chart"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="1.5" y="10" width="11" height="2.5" rx="1" fill="currentColor" /></svg></button>
          <button type="button" aria-pressed={size === "half"} onClick={() => onSize("half")} title="Chart under the map" aria-label="Chart under the map"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><rect x="1.5" y="7.5" width="11" height="5" rx="1" fill="currentColor" /></svg></button>
          <button type="button" aria-pressed={size === "full"} onClick={() => onSize("full")} title="Chart in place of the map" aria-label="Chart in place of the map"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden><rect x="1.5" y="1.5" width="11" height="11" rx="1.5" fill="currentColor" /></svg></button>
        </div>
      </header>
      {size !== "min" ? <p className="mon-dock-cap"><b>{showRace ? `${race!.nm}: ${cap[0].toLowerCase()}` : cap[0]}</b>{cap[1]}</p> : null}
      {size !== "min" ? (
        <div className="mon-dock-b" ref={body}>
          {showRace
            ? (pts.length ? <RaceCharts pts={pts} now={now} mode={e.view.mode} only={[rk]} stack height={ch} obsTimes={e.mode === "REPLAY" && e.info?.base && e.frame >= 0 ? e.timesMs.slice(0, e.frame + 1) : undefined} /> : <p className="mon-note">This race has no chart history yet. It fills in from its first returns.</p>)
            : (e.national.length ? <NationalCharts pts={e.national} now={now} mode={e.view.mode} only={[nat]} stack height={ch} /> : <p className="mon-note">The history fills in as each update is recorded.</p>)}
        </div>
      ) : null}
    </section>
  );
}
