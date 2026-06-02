"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
    setMounted(true);
  }, []);

  const apply = (next: Theme) => {
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("psi-theme", next); } catch {}
  };

  const toggle = () => apply(theme === "dark" ? "light" : "dark");

  return (
    <>
      <style>{`
        .psi-theme-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px;
          border-radius: var(--r-pill);
          background: var(--panel2);
          border: 1px solid var(--border);
          font-family: var(--font-body);
        }
        .psi-theme-seg {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: var(--r-pill);
          border: none;
          background: transparent;
          color: var(--muted);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          cursor: pointer;
          transition: color var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out);
        }
        .psi-theme-seg:hover { color: var(--foreground); }
        .psi-theme-seg.is-active {
          background: var(--panel);
          color: var(--foreground);
          box-shadow: var(--shadow-sm);
        }
        .psi-theme-icon { width: 13px; height: 13px; display: block; }
      `}</style>

      <div
        className="psi-theme-toggle"
        role="group"
        aria-label="Theme"
        suppressHydrationWarning
      >
        <button
          type="button"
          className={`psi-theme-seg${mounted && theme === "light" ? " is-active" : ""}`}
          onClick={() => apply("light")}
          aria-pressed={mounted && theme === "light"}
          aria-label="Switch to light theme"
        >
          <svg className="psi-theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          Light
        </button>
        <button
          type="button"
          className={`psi-theme-seg${mounted && theme === "dark" ? " is-active" : ""}`}
          onClick={() => apply("dark")}
          aria-pressed={mounted && theme === "dark"}
          aria-label="Switch to dark theme"
        >
          <svg className="psi-theme-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
          Dark
        </button>
      </div>
    </>
  );
}
