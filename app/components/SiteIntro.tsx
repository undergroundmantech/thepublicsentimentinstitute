"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Icon, Lockup } from "./opp/Logo";

// First-visit announcement, shown once and then remembered under SEEN_KEY.
// `?intro=1` forces it back up for review; `?nointro=1` suppresses it.
const SEEN_KEY = "psi-intro-v2";

const FEATURES: [string, string, string][] = [
  ["Polls", "Polling averages", "Every tracked race, weighted by recency, sample and pollster quality."],
  ["Forecast", "The 2026 forecast", "Senate, House and governor odds from thousands of simulated elections."],
  ["Results", "Live results", "County maps that fill in as returns land on election night."],
  ["Fieldwork", "Polls by TPSI", "Original surveys fielded by The Public Sentiment Institute."],
];

export default function SiteIntro() {
  const [phase, setPhase] = useState<"idle" | "in" | "out">("idle");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.has("nointro")) return;
      if (!q.has("intro") && localStorage.getItem(SEEN_KEY)) return;
    } catch {
      return;
    }
    setMounted(true);
    // let the page paint first, then lift the dialog in
    const t = window.setTimeout(() => setPhase("in"), 650);
    return () => window.clearTimeout(t);
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {}
    setPhase("out");
    window.setTimeout(() => setMounted(false), 360);
  };

  // scroll lock + escape while open
  useEffect(() => {
    if (phase !== "in") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLButtonElement>("button.btn.g")?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!mounted) return null;

  return (
    <div
      className="opp opp-intro"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="opp-intro-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <style>{`
        .opp-intro {
          position: fixed; inset: 0; z-index: 200;
          display: grid; place-items: center; padding: 24px;
          background: rgba(var(--canvas-rgb), .62);
          -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
          opacity: 0; transition: opacity 320ms ease;
        }
        .opp-intro[data-phase="in"] { opacity: 1; }
        .opp-intro[data-phase="out"] { opacity: 0; pointer-events: none; }
        .opp-intro .panel {
          position: relative; width: min(540px, 100%); max-height: calc(100vh - 48px); overflow: auto;
          background: linear-gradient(180deg, rgba(var(--line-rgb),.07), rgba(var(--line-rgb),.03)), rgba(var(--bg2-rgb),.92);
          -webkit-backdrop-filter: blur(24px) saturate(140%); backdrop-filter: blur(24px) saturate(140%);
          border: 1px solid var(--line2); border-radius: 20px;
          box-shadow: var(--shadow-card);
          transform: translateY(12px); transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }
        .opp-intro[data-phase="in"] .panel { transform: none; }
        .opp-intro .art {
          position: relative; overflow: hidden; padding: 34px 28px 26px;
          background: radial-gradient(420px 220px at 10% -10%, rgba(6,75,249,.38), transparent 70%),
                      radial-gradient(360px 220px at 100% 120%, rgba(249,6,75,.28), transparent 70%), #110019;
          border-bottom: 1px solid var(--line); color: #fff;
        }
        .opp-intro .art .wm { position: absolute; right: -36px; bottom: -48px; opacity: .12; color: #fff; }
        .opp-intro .body { padding: 22px 28px 26px; }
        .opp-intro h2 { font-size: 24px; font-weight: 800; letter-spacing: -.03em; margin: 8px 0 8px; }
        .opp-intro h2 em { font-style: normal; background: var(--grad); -webkit-background-clip: text; background-clip: text; color: transparent; }
        .opp-intro .lede { color: var(--ink2); font-size: 14.5px; margin: 0 0 16px; }
        .opp-intro .feat { display: grid; grid-template-columns: 92px 1fr; gap: 4px 14px; padding: 10px 0; border-top: 1px solid var(--line); }
        .opp-intro .feat .k { font: 700 10.5px var(--font-m); letter-spacing: .12em; text-transform: uppercase; color: var(--mute); padding-top: 3px; }
        .opp-intro .feat b { display: block; font: 700 14px var(--font-b); color: var(--ink); }
        .opp-intro .feat span { font-size: 13px; color: var(--mute); }
        .opp-intro .acts { display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px; }
        .opp-intro .acts .btn.g { flex: 1; justify-content: center; padding: 12px 18px; font-size: 14px; }
        .opp-intro .btn:focus-visible { outline: 2px solid var(--hi); outline-offset: 3px; }
        @media (max-width: 600px) {
          .opp-intro { padding: 16px; }
          .opp-intro .art, .opp-intro .body { padding-inline: 20px; }
          .opp-intro .feat { grid-template-columns: 1fr; }
        }
        @media (prefers-reduced-motion: reduce) {
          .opp-intro, .opp-intro .panel { transition: none; transform: none; }
        }
      `}</style>

      <div ref={panelRef} className="panel">
        <div className="art">
          <Lockup height={52} />
          <Icon size={220} className="wm" />
        </div>
        <div className="body">
          <div className="eye g">Welcome</div>
          <h2 id="opp-intro-title">This is <em>OnPoint Politics</em></h2>
          <p className="lede">The new home for polling averages, the 2026 forecast and live election results, with fieldwork by The Public Sentiment Institute.</p>
          {FEATURES.map(([k, t, s]) => (
            <div className="feat" key={k}>
              <div className="k">{k}</div>
              <div><b>{t}</b><span>{s}</span></div>
            </div>
          ))}
          <div className="acts">
            <button type="button" className="btn g" onClick={dismiss}>Enter the site</button>
            <Link className="btn" href="/forecast" onClick={dismiss}>See the forecast</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
