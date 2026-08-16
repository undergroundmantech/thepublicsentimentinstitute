"use client";

import { useEffect, useRef } from "react";
import DarkNav from "@/app/components/DarkNav";
import { FLSE_CSS } from "./flseCss";

/**
 * Florida GOP Primary — Prediction Sandbox.
 * Layout, responsiveness, functionality and every number are the reference build's
 * (changeorders/TPSI_FL_Scenario_Engine_Final.html). Only the palette and type are
 * re-pointed at the site's tokens so the page carries the house UI in light and dark.
 * The engine itself is imperative DOM code — see flEngine.js for why.
 */
export default function FloridaPrimaryPage() {
  const booted = useRef(false);

  useEffect(() => {
    // StrictMode double-invokes effects in dev; the engine binds global DOM once.
    if (booted.current) return;
    booted.current = true;
    let dispose: (() => void) | undefined;
    import("./flEngine").then((m) => { dispose = m.initFloridaEngine(); });
    return () => { dispose?.(); booted.current = false; };
  }, []);

  return (
    <div className="flse">
      <style>{FLSE_CSS}</style>
      {/* DarkNav replaces the global chrome, per the convention in ElectoralMapV2 et al. */}
      <style>{`body header, body footer { display: none !important; }`}</style>
      <DarkNav />

      <div className="wrap">
        <div className="masthead">
          <div className="eyebrow">The Public Sentiment Institute · Scenario Engine</div>
          <h1>Florida GOP Primary — Prediction Sandbox</h1>
          <div className="sub">
            Set how candidates perform within demographic groups, adjust who turns out, and every
            county recomputes from its own composition. Anything other than the baseline is a
            user-built scenario.
          </div>
          <div className="presets" id="fl-presets" />
        </div>

        <div className="grid">
          <div id="fl-left" />
          <div id="fl-mid">
            <div className="tabs" id="fl-tabs" />
            <div className="mapwrap"><svg id="fl-map" /></div>
            <div className="card" style={{ marginTop: 14 }}>
              <div className="ch">
                <div className="ct">County detail</div>
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div className="cs" id="fl-ctnote" />
                  <button className="xbtn" id="fl-expandAll">Show all 67</button>
                </div>
              </div>
              <div id="fl-ctwrap" style={{ maxHeight: 360, overflow: "auto" }}>
                <table className="ctbl" id="fl-ctbl" />
              </div>
            </div>
          </div>
          <div id="fl-right" />
        </div>

        <div className="foot">
          <span>The Public Sentiment Institute</span>
          <span>Florida 2026</span>
        </div>
      </div>

      <div className="tip" id="fl-tip" />
    </div>
  );
}
