"use client";
// The standing notice at the foot of every results page: what the numbers are, where they come from, and where the
// certified results are. In a replay it says so in plain words: a recorded replay of civicAPI's published data
// (never called a simulation: "simulation" on this site means interpolated test data, which is labelled as such).
import React from "react";
import { engine, useEngine } from "./2026/engineClient";

export default function ResultsNotice() {
  const e = useEngine(); const replay = e.mode === "REPLAY", sim = replay && e.info?.mode === "SIMULATED";
  const recorded = e.sources.find((s) => s.mode === "HISTORICAL" && s.base);
  return (
    <aside className="rs-notice" role="note" aria-label="About these results">
      <style>{CSS}</style>
      {sim ? <p><b>Simulation. Not actual results.</b> This is interpolated test data for checking the replay. It is not what any election office or civicAPI reported.</p>
        : replay ? <p><b>Recorded replay.</b> You are watching election-night data as civicAPI published it on November 3 and 4, 2026, and in the days of counting after, replayed at the times it was published. It is shown for research, analysis and interest, with civicAPI&apos;s permission.</p>
        : <p><b>Unofficial results.</b> Vote counts and race calls on these pages come from <a href="https://civicapi.org" target="_blank" rel="noopener noreferrer">civicAPI</a>. {recorded ? <> The election-night replay shows that data as civicAPI published it on November 3 and 4, 2026. <button type="button" onClick={() => { void engine.enterReplay(recorded.id); window.scrollTo({ top: 0 }); }}>Watch the replay</button></> : null}</p>}
      <p>These are not certified results. Chances, projected margins and model calls are On Point Politics estimates from an uncalibrated model; they are not results and not official calls. For certified results, go to your state&apos;s election office (in most states the Secretary of State): <a href="https://www.usa.gov/election-office" target="_blank" rel="noopener noreferrer">find your state election office</a>.</p>
    </aside>
  );
}
const CSS = `
.rs-notice{max-width:1120px;margin:28px auto 18px;padding:14px 18px;border-top:1px solid var(--line2);color:var(--mute);font:500 12.5px/1.55 var(--font-b)}
.rs-notice p{margin:0 0 6px;max-width:900px}.rs-notice b{color:var(--ink2);font-weight:700}
.rs-notice a,.rs-notice button{color:var(--ink2);text-decoration:underline;text-underline-offset:3px}
.rs-notice button{background:none;border:0;padding:0;font:inherit;font-weight:700;cursor:pointer}
`;
