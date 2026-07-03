"use client";

import { useEffect, useRef, useState } from "react";
import { Manrope } from "next/font/google";

// the homepage hero's sans — keeps the dialog in the product register,
// away from the site-wide mono body
const manrope = Manrope({ subsets: ["latin"], weight: ["500", "600", "800"] });

// First-visit announcement — shown once, then remembered. The dialog follows
// the product-release idiom: artwork on top, a short line of copy, one button.
const SEEN_KEY = "psi-intro-v2";

export default function SiteIntro() {
  const [phase, setPhase] = useState<"idle" | "in" | "out">("idle");
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
      // suppression hatch for clean captures/embeds
      if (new URLSearchParams(window.location.search).has("nointro")) return;
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
    panelRef.current?.querySelector("button")?.focus();
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (!mounted) return null;

  return (
    <div
      className="psi-intro"
      data-phase={phase}
      role="dialog"
      aria-modal="true"
      aria-labelledby="psi-intro-title"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      <style>{`
        .psi-intro {
          position: fixed; inset: 0; z-index: 200;
          display: grid; place-items: center; padding: 24px;
          background: rgba(4, 4, 6, 0.62);
          -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px);
          opacity: 0; transition: opacity 340ms ease;
        }
        .psi-intro[data-phase="in"] { opacity: 1; }
        .psi-intro[data-phase="out"] { opacity: 0; pointer-events: none; }
        .psi-intro-panel {
          width: min(500px, 100%);
          background: #101013;
          border: 1px solid rgba(255, 255, 255, 0.09);
          border-radius: 20px;
          box-shadow: 0 32px 90px rgba(0, 0, 0, 0.55), 0 2px 10px rgba(0, 0, 0, 0.4);
          overflow: hidden;
          transform: translateY(14px) scale(0.975);
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        .psi-intro[data-phase="in"] .psi-intro-panel { transform: none; }
        .psi-intro-art {
          position: relative; aspect-ratio: 1954 / 1234;
          background: #060608;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }
        .psi-intro-art img {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; object-position: center; display: block;
        }
        .psi-intro-art::after {
          content: ""; position: absolute; inset: 0;
          background: linear-gradient(180deg, transparent 80%, rgba(16, 16, 19, 0.4) 100%);
        }
        .psi-intro-body { padding: 26px 28px 28px; text-align: center; }
        .psi-intro-body h2 {
          margin: 0 0 10px; color: #f5f5f2;
          font-family: inherit;
          font-size: 21px; line-height: 1.3; font-weight: 800;
          letter-spacing: -0.01em; text-transform: none; text-wrap: balance;
        }
        .psi-intro-body p {
          margin: 0 auto 24px; max-width: 44ch;
          color: rgba(245, 245, 242, 0.6);
          font-size: 14px; line-height: 1.6; font-weight: 500;
        }
        .psi-intro-btn {
          display: block; width: 100%; padding: 13px 18px;
          border: 0; border-radius: 999px; cursor: pointer;
          background: #f5f5f2; color: #0a0a0c;
          font-family: inherit; font-size: 14.5px; font-weight: 600;
          line-height: 1; letter-spacing: 0.01em;
          transition: transform 160ms ease, background 160ms ease;
        }
        .psi-intro-btn:hover { background: #ffffff; }
        .psi-intro-btn:active { transform: scale(0.985); }
        .psi-intro-btn:focus-visible { outline: 2px solid rgba(245,245,242,0.6); outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .psi-intro, .psi-intro-panel { transition: none; transform: none; }
        }
        @media (max-width: 480px) {
          .psi-intro { padding: 16px; }
          .psi-intro-body { padding: 22px 20px 22px; }
        }
      `}</style>

      <div ref={panelRef} className={`psi-intro-panel ${manrope.className}`}>
        <div className="psi-intro-art" aria-hidden="true">
          <img src="/announce/new-site.jpg" alt="" draggable={false} />
        </div>
        <div className="psi-intro-body">
          <h2 id="psi-intro-title">
            Introducing the New Public Sentiment Institute Site
          </h2>
          <p>
            Polling averages, race ratings, and live election results —
            rebuilt from the ground up on one transparent data desk.
          </p>
          <button type="button" className="psi-intro-btn" onClick={dismiss}>
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
