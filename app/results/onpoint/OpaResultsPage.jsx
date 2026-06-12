"use client";

import React from "react";
import ElectionResults from "./ElectionResults.jsx";
import { ThemeProvider } from "./lib/theme.jsx";

const OPA_GLOBAL_CSS = `
  @import url("https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Oswald:wght@500;600;700&display=swap");

  :root {
    --page: #0a0b0d; --page-elev: #15171c; --page-sunken: #070708;
    --card: #0d1117; --card-2: rgba(255,255,255,0.02); --card-bd: #1c2230;
    --ink: #f1ece1; --ink-strong: #ffffff;
    --ink-mute: rgba(241,236,225,0.60); --ink-dim: rgba(241,236,225,0.38); --ink-dimmer: rgba(241,236,225,0.18);
    --rule: rgba(255,255,255,0.08); --rule-soft: rgba(255,255,255,0.05); --rule-strong: rgba(255,255,255,0.14);
    --wash: rgba(255,255,255,0.02); --hover: rgba(255,255,255,0.05); --hair: rgba(255,255,255,0.08);
    --page-rgb: 10,11,13; --ink-rgb: 241,236,225;
    --frost-bg: linear-gradient(180deg, rgba(24,23,20,0.70) 0%, rgba(14,13,11,0.76) 60%);
    --frost-shadow: 0 18px 46px -16px rgba(0,0,0,0.66), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.08);
    --shadow-card: 0 18px 46px -16px rgba(0,0,0,0.55);
    --shadow-pop: 0 30px 70px -18px rgba(0,0,0,0.8);
    --accent: #d4a73b; --accent-soft: rgba(212,167,59,0.14); --accent-dim: rgba(212,167,59,0.55);
    --approve: #34c4ad; --disapprove: #d4a73b; --dem: #1d4ed8; --gop: #dc2626;
    --polls-a: #3DD68C; --polls-b: #D946C6; --polls-live: #FF4D8F;
    --neutral: #3c3f47;
    --chart-surface: #f8f6f1; --chart-bd: transparent;
    --scrollbar-thumb: #2a2a2a; --scrollbar-thumb-hover: #3a3a3a; --selection: rgba(255,255,255,0.12);
  }
  :root[data-opa-theme="light"] {
    --page: #ffffff; --page-elev: #f4f5f7; --page-sunken: #eceef1;
    --card: #ffffff; --card-2: #fafbfc; --card-bd: rgba(0,0,0,0.12);
    --ink: #16181d; --ink-strong: #0a0b0d;
    --ink-mute: rgba(22,24,29,0.64); --ink-dim: rgba(22,24,29,0.48); --ink-dimmer: rgba(22,24,29,0.28);
    --rule: rgba(0,0,0,0.12); --rule-soft: rgba(0,0,0,0.07); --rule-strong: rgba(0,0,0,0.18);
    --wash: rgba(0,0,0,0.025); --hover: rgba(0,0,0,0.05); --hair: rgba(0,0,0,0.12);
    --page-rgb: 255,255,255; --ink-rgb: 22,24,29;
    --frost-bg: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,248,250,0.94) 60%);
    --frost-shadow: 0 18px 40px -18px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08);
    --shadow-card: 0 14px 34px -16px rgba(15,23,42,0.16);
    --shadow-pop: 0 24px 56px -18px rgba(15,23,42,0.22);
    --accent: #a8791f; --accent-soft: rgba(168,121,31,0.12); --accent-dim: rgba(168,121,31,0.55);
    --approve: #0f9b87; --disapprove: #b8860b; --dem: #1d4ed8; --gop: #c81e1e;
    --polls-a: #1f9d5f; --polls-b: #b02ca0; --polls-live: #e11d6b;
    --neutral: #cdd1d8;
    --chart-surface: #ffffff; --chart-bd: rgba(0,0,0,0.10);
    --scrollbar-thumb: #c8ccd3; --scrollbar-thumb-hover: #aab0ba; --selection: rgba(0,0,0,0.12);
  }
  ::selection { background: var(--selection); }
  .opa-results-shell * { box-sizing: border-box; }
  body:has(.opa-results-shell) {
    overflow: hidden !important;
    background: var(--page) !important;
    /* Scope color-scheme to WHILE the results shell is mounted (covers the
       shell AND its body-portals like RaceDetail). It reverts the instant you
       navigate away, so other pages never inherit the election theme's
       scrollbar / form-control colors. */
    color-scheme: dark;
  }
  :root[data-opa-theme="light"] body:has(.opa-results-shell) {
    color-scheme: light;
  }
  body:has(.opa-results-shell) header,
  body:has(.opa-results-shell) footer {
    display: none !important;
  }
  body:has(.opa-results-shell) main > div,
  body:has(.opa-results-shell) main > div > div {
    max-width: none !important;
    width: 100% !important;
    padding: 0 !important;
    margin: 0 !important;
  }
  .opa-results-shell ::-webkit-scrollbar { width: 6px; height: 6px; }
  .opa-results-shell ::-webkit-scrollbar-track { background: transparent; }
  .opa-results-shell ::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 3px; }
  .opa-results-shell ::-webkit-scrollbar-thumb:hover { background: var(--scrollbar-thumb-hover); }
  @keyframes opa-theme-trip {
    from { clip-path: circle(0% at 100% 0%); }
    to   { clip-path: circle(140% at 100% 0%); }
  }
  ::view-transition-old(root) {
    animation: none;
    z-index: 1;
    mix-blend-mode: normal;
  }
  ::view-transition-new(root) {
    animation: opa-theme-trip 760ms cubic-bezier(0.22, 0.61, 0.36, 1);
    z-index: 2;
    mix-blend-mode: normal;
  }
  @media (prefers-reduced-motion: reduce) {
    ::view-transition-old(root),
    ::view-transition-new(root) { animation: none !important; }
  }
`;

export default function OpaResultsPage() {
  return (
    <ThemeProvider>
      <style>{OPA_GLOBAL_CSS}</style>
      <div
        className="opa-results-shell"
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          minHeight: "100vh",
          zIndex: 9999,
          background: "var(--page)",
          color: "var(--ink)",
          fontFamily: '"Instrument Sans", system-ui, sans-serif',
          WebkitFontSmoothing: "antialiased",
          overflow: "hidden",
          isolation: "isolate",
        }}
      >
        <ElectionResults />
      </div>
    </ThemeProvider>
  );
}
