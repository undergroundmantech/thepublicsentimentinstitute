"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Theme = "light" | "dark";

// Flat canvas colors per theme (mirrors --background in globals.css). Used
// only to color the flood-fill disc below -- not read from computed styles,
// so this never depends on the CSS var actually being resolved yet.
const THEME_BG: Record<Theme, string> = {
  light: "#f7f7f4",
  dark: "#0a0a0c",
};

type Ripple = { x: number; y: number; color: string; grown: boolean };

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);
  const [ripple, setRipple] = useState<Ripple | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
    setMounted(true);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next: Theme = theme === "dark" ? "light" : "dark";

    const apply = () => {
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("psi-theme", next); } catch {}
      setTheme(next);
    };

    const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { apply(); return; }

    // A flat disc in the TARGET theme's color floods out from the button. By
    // the time it's grown enough to cover the viewport, the real theme swaps
    // underneath (imperceptibly -- the colors match), then the disc is
    // dropped. Reads as the new theme radiating outward from the toggle.
    // Plain CSS clip-path transition -- no View Transitions API dependency,
    // so it works the same in every browser.
    const rect = e.currentTarget.getBoundingClientRect();
    if (timer.current) window.clearTimeout(timer.current);
    setRipple({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, color: THEME_BG[next], grown: false });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setRipple((r) => (r ? { ...r, grown: true } : r));
      });
    });
    timer.current = window.setTimeout(() => {
      apply();
      setRipple(null);
    }, 620);
  };

  return (
    <>
      <style>{`
        .psi-theme-toggle {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          flex-shrink: 0;
          border-radius: 50%;
          border: 1px solid var(--border2);
          background: var(--panel2);
          color: var(--foreground);
          cursor: pointer;
          transition: border-color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
        }
        .psi-theme-toggle:hover { border-color: var(--border3); transform: translateY(-1px); }
        .psi-theme-icon {
          position: absolute;
          inset: 0;
          margin: auto;
          width: 16px;
          height: 16px;
          transition: opacity 260ms ease, transform 420ms cubic-bezier(.2,.8,.2,1);
        }
        .psi-theme-icon.sun {
          opacity: 0;
          transform: rotate(-90deg) scale(0.6);
        }
        .psi-theme-icon.moon {
          opacity: 0;
          transform: rotate(90deg) scale(0.6);
        }
        .psi-theme-toggle[data-mode="light"] .psi-theme-icon.sun {
          opacity: 1;
          transform: rotate(0deg) scale(1);
        }
        .psi-theme-toggle[data-mode="dark"] .psi-theme-icon.moon {
          opacity: 1;
          transform: rotate(0deg) scale(1);
        }
      `}</style>

      <button
        type="button"
        className="psi-theme-toggle"
        data-mode={mounted ? theme : "light"}
        onClick={toggle}
        aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        suppressHydrationWarning
      >
        <svg className="psi-theme-icon sun" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 2.5v2.4M12 19.1v2.4M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <svg className="psi-theme-icon moon" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M20.2 14.7A8.6 8.6 0 1 1 9.3 3.8a7 7 0 0 0 10.9 10.9z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
      </button>

      {mounted && ripple && createPortal(
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 2147483647,
            pointerEvents: "none",
            background: ripple.color,
            clipPath: `circle(${ripple.grown ? 150 : 0}% at ${ripple.x}px ${ripple.y}px)`,
            transition: "clip-path 600ms cubic-bezier(0.22, 0.61, 0.36, 1)",
          }}
        />,
        document.body
      )}
    </>
  );
}
