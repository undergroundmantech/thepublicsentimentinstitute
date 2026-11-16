"use client";
// A state page's charts: the state's Senate and governor races through the night, at headline size. In a replay they
// follow the replay clock; outside one they show the recorded night from the replay pack, labelled as a replay.
import React, { useState } from "react";
import EngineRaceCharts from "../EngineRaceCharts";
import { useEngine } from "../engineClient";

export default function StateCharts({ races, state }: { races: { id: string; label: string }[]; state: string }) {
  const e = useEngine(); const [pick, setPick] = useState(0);
  if (!races.length) return null;
  const r = races[Math.min(pick, races.length - 1)];
  // nothing to draw without an engine view or a recorded pack
  const recorded = e.mode === "LIVE" && !e.available;
  if (recorded && !e.sources.some((s) => s.base && s.mode === "HISTORICAL")) return null;
  if (!recorded && !e.view) return null;
  return (
    <section className="srs-charts" aria-labelledby="srs-charts-h">
      <div className="srs-charts-h">
        <h2 id="srs-charts-h">{state} through the night</h2>
        {races.length > 1 ? (
          <div className="srs-seg" role="group" aria-label="Race">
            {races.map((x, i) => <button key={x.id} type="button" aria-pressed={i === pick} onClick={() => setPick(i)}>{x.label}</button>)}
          </div>
        ) : null}
      </div>
      <EngineRaceCharts key={r.id} raceId={r.id} title={`${state} ${r.label.toLowerCase()}: how the night unfolded`} recorded={recorded} />
    </section>
  );
}
