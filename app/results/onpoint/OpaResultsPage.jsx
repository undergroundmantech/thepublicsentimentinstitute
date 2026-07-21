"use client";

import React from "react";
import ElectionResults from "./ElectionResults.jsx";
import { ThemeProvider } from "./lib/theme.jsx";

export const OPA_GLOBAL_CSS = `
  @import url("https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@600;700;800;900&family=Inter:wght@400;500;600;700;800&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@400;500&family=Oswald:wght@500;600;700&display=swap");

  :root {
    /* ── TPSI Election Desk Design System §1 — canonical tokens (dark) ── */
    --page: #0a0a0c; --page-elev: #16161a; --page-sunken: #0a0a0c;
    --card: #111114; --card-2: #16161a; --card-bd: rgba(255,255,255,0.08);
    --ink: #f2f2f0; --ink-strong: #ffffff;
    --ink-mute: rgba(242,242,240,0.62); --ink-dim: rgba(242,242,240,0.36); --ink-dimmer: rgba(242,242,240,0.20);
    --rule: rgba(255,255,255,0.08); --rule-soft: rgba(255,255,255,0.05); --rule-strong: rgba(255,255,255,0.15);
    --wash: #16161a; --hover: #1c1c21; --hair: rgba(255,255,255,0.08);
    --page-rgb: 10,10,12; --ink-rgb: 242,242,240;
    --frost-bg: linear-gradient(180deg, rgba(22,22,26,0.70) 0%, rgba(12,12,14,0.76) 60%);
    --frost-shadow: 0 18px 46px -16px rgba(0,0,0,0.66), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 1px rgba(255,255,255,0.08);
    --shadow-card: 0 18px 46px -16px rgba(0,0,0,0.55);
    --shadow-pop: 0 30px 70px -18px rgba(0,0,0,0.8);
    /* party / candidate — DATA ONLY (§1) */
    --dem: #3b7bde; --gop: #d64550; --c2: #c757a8;
    --dem-tint: rgba(59,123,222,.14); --gop-tint: rgba(214,69,80,.14);
    /* non-partisan signal lane (§1) */
    --live: #2dd4bf; --called: #37b26c; --gold: #e8b93c;
    --accent: #e8b93c; --accent-soft: rgba(232,185,60,0.14); --accent-dim: rgba(232,185,60,0.55);
    --approve: #37b26c; --disapprove: #e8b93c;
    --polls-a: #3b7bde; --polls-b: #c757a8; --polls-live: #2dd4bf;
    --neutral: #3c3f47;
    --chart-surface: #f8f6f1; --chart-bd: transparent;
    --scrollbar-thumb: #2a2a2a; --scrollbar-thumb-hover: #3a3a3a; --selection: rgba(255,255,255,0.12);
  }
  :root[data-opa-theme="light"] {
    /* ── TPSI Election Desk Design System §1 — canonical tokens (light) ── */
    --page: #f7f7f4; --page-elev: #f1f1ed; --page-sunken: #e9e9e4;
    --card: #ffffff; --card-2: #f1f1ed; --card-bd: #e8e8e2;
    --ink: #17171b; --ink-strong: #0a0a0c;
    --ink-mute: #5d5d58; --ink-dim: #9c9c93; --ink-dimmer: rgba(23,23,27,0.28);
    --rule: #e8e8e2; --rule-soft: #eeeeea; --rule-strong: #d9d9d1;
    --wash: #f1f1ed; --hover: #e9e9e4; --hair: #e8e8e2;
    --page-rgb: 247,247,244; --ink-rgb: 23,23,27;
    --frost-bg: linear-gradient(180deg, rgba(255,255,255,0.92) 0%, rgba(246,248,250,0.94) 60%);
    --frost-shadow: 0 18px 40px -18px rgba(15,23,42,0.18), inset 0 1px 0 rgba(255,255,255,0.9), 0 0 0 1px rgba(0,0,0,0.08);
    --shadow-card: 0 14px 34px -16px rgba(15,23,42,0.16);
    --shadow-pop: 0 24px 56px -18px rgba(15,23,42,0.22);
    /* party / candidate — DATA ONLY (§1) */
    --dem: #1d5fc4; --gop: #c22f3b; --c2: #b5338f;
    --dem-tint: rgba(29,95,196,.08); --gop-tint: rgba(194,47,59,.08);
    /* non-partisan signal lane (§1) */
    --live: #0d9488; --called: #15803d; --gold: #a16207;
    --accent: #a16207; --accent-soft: rgba(161,98,7,0.12); --accent-dim: rgba(161,98,7,0.55);
    --approve: #15803d; --disapprove: #a16207;
    --polls-a: #1d5fc4; --polls-b: #b5338f; --polls-live: #0d9488;
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

export default function OpaResultsPage({ dateParam = null }) {
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
        <ElectionResults dateParam={dateParam} />
      </div>
    </ThemeProvider>
  );
}
