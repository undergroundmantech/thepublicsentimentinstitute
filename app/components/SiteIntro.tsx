"use client";

import { useEffect, useRef, useState } from "react";

// First-visit announcement — shown once, then remembered. Two beats:
//   1 · the reveal — artwork on top, a line of copy, Continue
//   2 · the demo — the panel widens; live video left, caption right
// `?intro=1` forces it back up for review; `?nointro=1` suppresses it.
const SEEN_KEY = "psi-intro-v2";

export default function SiteIntro() {
  const [phase, setPhase] = useState<"idle" | "in" | "out">("idle");
  const [step, setStep] = useState<0 | 1>(0);
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

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

  // step 2's video: React's `muted` prop doesn't reliably reach the DOM, and
  // an unmuted video is denied autoplay — set it directly, then play
  useEffect(() => {
    if (step !== 1) return;
    const v = videoRef.current;
    if (v) {
      v.muted = true;
      v.defaultMuted = true;
      v.play().catch(() => {});
    }
    // hand focus to the new page's button so Enter still advances
    panelRef.current?.querySelector("button")?.focus();
  }, [step]);

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
          /* keep the page's color alive behind the glass — the panel drinks it */
          background: rgba(3, 3, 6, 0.44);
          -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
          opacity: 0; transition: opacity 340ms ease;
        }
        .psi-intro[data-phase="in"] { opacity: 1; }
        .psi-intro[data-phase="out"] { opacity: 0; pointer-events: none; }
        .psi-intro-panel {
          position: relative;
          width: min(500px, 100%);
          font-family: var(--font-body);
          /* the glass: translucent gradient fill + heavy saturated blur */
          background: linear-gradient(165deg, rgba(30, 32, 44, 0.58), rgba(12, 13, 19, 0.66) 55%, rgba(10, 10, 15, 0.7));
          -webkit-backdrop-filter: blur(32px) saturate(1.75); backdrop-filter: blur(32px) saturate(1.75);
          border-radius: 22px;
          /* edge light: bright bevel above, falloff below — not a flat border */
          border: 1px solid rgba(255, 255, 255, 0.12);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.18),
            inset 0 -1px 0 rgba(255, 255, 255, 0.03),
            0 40px 110px rgba(0, 0, 0, 0.58),
            0 2px 12px rgba(0, 0, 0, 0.38);
          overflow: hidden;
          transform: translateY(14px) scale(0.975);
          transition: transform 420ms cubic-bezier(0.22, 1, 0.36, 1), width 480ms cubic-bezier(0.22, 1, 0.36, 1);
        }
        /* specular sheen sweeping from the light source (top-left) */
        .psi-intro-panel::before {
          content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
          background:
            radial-gradient(130% 55% at 16% -4%, rgba(255, 255, 255, 0.11), transparent 52%),
            linear-gradient(115deg, transparent 42%, rgba(255, 255, 255, 0.045) 50%, transparent 58%);
        }
        /* fine grain so the glass doesn't band */
        .psi-intro-panel::after {
          content: ""; position: absolute; inset: 0; z-index: 1; pointer-events: none;
          opacity: 0.05; mix-blend-mode: overlay;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
        }
        .psi-intro-panel > * { position: relative; z-index: 2; }
        .psi-intro[data-phase="in"] .psi-intro-panel { transform: none; }
        .psi-intro-panel[data-step="1"] { width: min(1020px, 100%); }
        .psi-intro-page { animation: psiPageIn 380ms cubic-bezier(0.22, 1, 0.36, 1) both; }
        @keyframes psiPageIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        /* beat 1 — the reveal */
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
          background: linear-gradient(180deg, transparent 82%, rgba(8, 9, 14, 0.5) 100%);
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
          color: rgba(245, 245, 242, 0.7);
          font-size: 14px; line-height: 1.6; font-weight: 500;
        }
        .psi-intro-btn {
          display: block; width: 100%; padding: 13px 18px;
          border: 0; border-radius: 999px; cursor: pointer;
          background: #f5f5f2; color: #0a0a0c;
          font-family: inherit; font-size: 14.5px; font-weight: 600;
          line-height: 1; letter-spacing: 0.01em;
          transition: transform 160ms ease, background 160ms ease;
          box-shadow: 0 10px 26px rgba(0, 0, 0, 0.38), inset 0 1px 0 rgba(255, 255, 255, 0.9);
        }
        .psi-intro-btn:hover { background: #ffffff; }
        .psi-intro-btn:active { transform: scale(0.985); }
        .psi-intro-btn:focus-visible { outline: 2px solid rgba(245,245,242,0.6); outline-offset: 3px; }

        /* beat 2 — the demo: video left, words right. The film's native
           2560:1618 ratio sets the row height so nothing gets cropped short */
        .psi-intro-duo { display: grid; grid-template-columns: minmax(0, 60fr) minmax(0, 40fr); align-items: stretch; }
        .psi-intro-film {
          position: relative; background: #060608;
          aspect-ratio: 2560 / 1618; height: auto;
          border-right: 1px solid rgba(255, 255, 255, 0.07);
        }
        .psi-intro-film video {
          position: absolute; inset: 0; width: 100%; height: 100%;
          object-fit: cover; display: block;
        }
        .psi-intro-side {
          display: flex; flex-direction: column; justify-content: center;
          padding: 36px 34px; text-align: left; min-height: 0;
        }
        .psi-intro-side h2 {
          margin: 0 0 10px; color: #f5f5f2; font-family: inherit;
          font-size: 20px; line-height: 1.3; font-weight: 800; letter-spacing: -0.01em;
          text-transform: none;
        }
        .psi-intro-side p {
          margin: 0 0 24px; color: rgba(245, 245, 242, 0.7);
          font-size: 13.5px; line-height: 1.65; font-weight: 500;
        }
        .psi-intro-dots { display: flex; gap: 5px; margin-bottom: 16px; }
        .psi-intro-dots i { width: 5px; height: 5px; border-radius: 99px; background: rgba(245,245,242,0.22); }
        .psi-intro-dots i.on { width: 16px; background: rgba(245,245,242,0.85); }
        @media (prefers-reduced-motion: reduce) {
          .psi-intro, .psi-intro-panel, .psi-intro-page { transition: none; transform: none; animation: none; }
        }
        @media (max-width: 640px) {
          .psi-intro { padding: 16px; }
          .psi-intro-body { padding: 22px 20px 22px; }
          .psi-intro-duo { grid-template-columns: 1fr; }
          .psi-intro-film { aspect-ratio: 2560 / 1618; border-right: 0; border-bottom: 1px solid rgba(255,255,255,0.07); }
          .psi-intro-film video { position: absolute; }
          .psi-intro-side { padding: 22px 20px; }
        }
      `}</style>

      <div ref={panelRef} className="psi-intro-panel" data-step={step}>
        {step === 0 ? (
          <div className="psi-intro-page" key="reveal">
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
              <button type="button" className="psi-intro-btn" onClick={() => setStep(1)}>
                Continue
              </button>
            </div>
          </div>
        ) : (
          <div className="psi-intro-page psi-intro-duo" key="demo">
            <div className="psi-intro-film" aria-hidden="true">
              {/* poster keeps the pane filled while the film buffers */}
              <video ref={videoRef} src="/desk/desk-tour.mp4" poster="/desk/film-map.jpg" muted loop playsInline preload="auto" />
            </div>
            <div className="psi-intro-side">
              <div className="psi-intro-dots" aria-hidden="true"><i /><i className="on" /></div>
              <h2 id="psi-intro-title">Every race, live</h2>
              <p>
                County maps that fill in as returns land, win-probability on
                every board, and a precinct-level map one click away. This is
                the desk running on a real election night.
              </p>
              <button type="button" className="psi-intro-btn" onClick={dismiss}>
                Enter the site
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
