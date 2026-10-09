"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { FLSE_CSS } from "./flseCss";

/**
 * Florida GOP Primary — Prediction Sandbox.
 * Layout, responsiveness, functionality and every number are the reference build's
 * (changeorders/TPSI_FL_Scenario_Engine_Final.html). Only the palette and type are
 * re-pointed at the OnPoint Politics tokens (dark only). The page header uses the shared
 * .opp inner template; the engine stays outside .opp so its .card/.tip/.bar classes do not
 * collide with the shared component classes.
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
    <>
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><span>Florida primary sandbox</span></nav>
      <header className="ph" style={{ marginBottom: 14 }}>
        <div className="eye g">Scenario engine · Fieldwork by TPSI</div>
        <h1>Florida GOP primary <em>sandbox</em></h1>
        <p className="lede">
          Set how candidates perform within demographic groups, adjust who turns out, and every
          county recomputes from its own composition. Anything other than the baseline is a
          user-built scenario.
        </p>
      </header>
    </div>
    <div className="flse">
      <style>{FLSE_CSS}</style>

      <div className="wrap">
        <div className="masthead">
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
          <span>Fieldwork by The Public Sentiment Institute</span>
          <span>Florida 2026</span>
        </div>
      </div>

      <div className="tip" id="fl-tip" />
    </div>
    </>
  );
}
