"use client";
// The monitor's side-panel charts: control and the House popular vote, following the same clock as the map.
import React, { useState } from "react";
import { CHART_CSS, NationalCharts } from "../2026/EngineCharts";
import { useEngine } from "../2026/engineClient";

export default function MonitorCharts() {
  const e = useEngine(); const [tab, setTab] = useState<"control" | "seats" | "vote">("control");
  if (!e.available || !e.view) return null;
  const now = e.mode === "REPLAY" && e.clock ? e.clock.tMs : null;
  return (
    <div className="mon-charts">
      <style>{CHART_CSS + MON_CSS}</style>
      <div className="mon-ch-tabs" role="tablist" aria-label="Charts">
        {([["control", "Control"], ["seats", "Seats"], ["vote", "Popular vote"]] as const).map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
      </div>
      {e.national.length ? <NationalCharts pts={e.national} now={now} mode={e.view.mode} only={[tab]} /> : <p className="mon-note">The history fills in as each update is recorded.</p>}
    </div>
  );
}
const MON_CSS = `.mon-charts{margin:4px 0 14px}.mon-charts .ec-grid2{grid-template-columns:1fr}.mon-charts .ec{padding-top:10px}
.mon-ch-tabs{display:flex;gap:4px;margin-bottom:4px}.mon-ch-tabs button{font:700 11.5px var(--font-b);color:var(--ink2);background:none;border:1px solid var(--line2);border-radius:999px;padding:4px 10px;cursor:pointer}
.mon-ch-tabs button[aria-selected="true"]{color:var(--hi);background:rgba(var(--line-rgb),.1)}`;
