"use client";

import React from "react";
import ElectionResults from "./ElectionResults.jsx";
import { ThemeProvider } from "./lib/theme.jsx";

// Results hub tokens. These are the hub's own variable names, mapped onto the
// OnPoint Politics tokens in app/globals.css; nothing here redefines a site
// token, so mounting the hub never recolors the rest of the page. Dark only.
export const OPA_GLOBAL_CSS = `
  :root {
    --page: var(--bg); --page-elev: rgba(255,255,255,.035); --page-sunken: var(--bg);
    --card: rgba(255,255,255,.035); --card-2: rgba(255,255,255,.06); --card-bd: var(--line);
    --ink-strong: #ffffff;
    --ink-mute: var(--ink2); --ink-dim: var(--mute); --ink-dimmer: var(--mute2);
    --rule: var(--line); --rule-soft: rgba(255,255,255,.05); --rule-strong: var(--line2);
    --wash: rgba(255,255,255,.06); --hover: rgba(255,255,255,.08); --hair: var(--line);
    --page-rgb: 10,7,17;
    --frost-bg: rgba(255,255,255,.035);
    --frost-shadow: 0 0 0 1px var(--line);
    --shadow-pop: 0 12px 40px rgba(0,0,0,.5);
    --accent: #ffffff; --accent-soft: rgba(255,255,255,.14); --accent-dim: rgba(255,255,255,.55);
    --neutral: #3a3348;
    --scrollbar-thumb: rgba(255,255,255,.14); --scrollbar-thumb-hover: rgba(255,255,255,.24); --selection: rgba(255,255,255,.14);
  }
  .opa-results-shell * { box-sizing: border-box; }
  .opa-results-shell ::-webkit-scrollbar { width: 6px; height: 6px; }
  .opa-results-shell ::-webkit-scrollbar-track { background: transparent; }
  .opa-results-shell ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
  .opa-results-shell ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
`;

export default function OpaResultsPage({ dateParam = null }) {
  return (
    <ThemeProvider>
      <style>{OPA_GLOBAL_CSS}</style>
      {/* The hub scrolls inside its own frame (its race grid is virtualized
          against this scroller), under the site header and above the footer. */}
      <div
        className="opa-results-shell"
        style={{
          position: "relative",
          width: "100%",
          height: "calc(100dvh - 150px)",
          minHeight: 620,
          color: "var(--ink)",
          fontFamily: "var(--font-b)",
          WebkitFontSmoothing: "antialiased",
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        <ElectionResults dateParam={dateParam} />
      </div>
    </ThemeProvider>
  );
}
