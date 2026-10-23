"use client";
// The mode switch on /what-if and /swingometer: "Across the map" keeps the statewide tool exactly as it was,
// "Within a state" opens the county tools. ?mode=state opens a page on the county tool, and ?race= picks the race,
// so a race page can link straight to /what-if?mode=state&race=sen-NC.
import React, { useEffect, useRef, useState } from "react";
import StateLab, { type Tool } from "./StateLab";
import "./scenarios.css";

type Mode = "map" | "state";

/** runs before the page paints, so a link to the county tool never flashes the statewide one */
export const MODE_BOOT = "try{if(/[?&]mode=state(&|$)/.test(location.search))document.documentElement.setAttribute('data-scn','state')}catch(e){}";

export default function ScenarioModes({ tool, base, crumbs = false, children }: { tool: Tool; base: string; crumbs?: boolean; children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("map");
  const [opened, setOpened] = useState(false);
  // read once while hydrating, before the page's own tool rewrites the address
  const [boot] = useState(() => (typeof window !== "undefined" ? window.location.search : ""));
  const acrossSearch = useRef("");
  const stateSearch = useRef("");

  useEffect(() => {
    const q = new URLSearchParams(boot);
    // the server renders the statewide tool, so a link to the county tool switches over once hydrated
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (q.get("mode") === "state") { setMode("state"); setOpened(true); }
    document.documentElement.removeAttribute("data-scn");
  }, [boot]);

  const go = (m: Mode) => {
    if (m === mode) return;
    try {
      if (m === "state") {
        acrossSearch.current = window.location.search;
        window.history.replaceState(window.history.state, "", `${base}${stateSearch.current || "?mode=state"}${window.location.hash}`);
      } else {
        stateSearch.current = window.location.search;
        const back = new URLSearchParams(acrossSearch.current);
        back.delete("mode"); back.delete("x");
        const s = back.toString();
        window.history.replaceState(window.history.state, "", `${base}${s ? `?${s}` : ""}${window.location.hash}`);
      }
    } catch { /* history unavailable */ }
    setMode(m); if (m === "state") setOpened(true);
  };

  return (
    <>
      <div className={`scn-modes${mode === "state" ? " st" : ""}`} role="tablist" aria-label="Scenario scope">
        <span className="scn-glide" aria-hidden="true" />
        <button type="button" role="tab" aria-selected={mode === "map"} className={mode === "map" ? "on" : undefined} onClick={() => go("map")}>
          <b>Across the map</b><small>Every race moves together</small>
        </button>
        <button type="button" role="tab" aria-selected={mode === "state"} className={mode === "state" ? "on" : undefined} onClick={() => go("state")}>
          <b>Within a state</b><small>{tool === "counties" ? "Change any county" : "Move voters county by county"}</small>
        </button>
      </div>
      <div className="scn-across" hidden={mode === "state"}>{children}</div>
      {opened ? <div className="scn-state" hidden={mode !== "state"}><StateLab tool={tool} base={base} crumbs={crumbs} bootSearch={boot} /></div> : <div className="scn-state-ph card sl-load" aria-hidden="true"><span />Loading the county scenarios</div>}
    </>
  );
}
