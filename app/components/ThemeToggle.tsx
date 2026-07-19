"use client";

import { useEffect, useState } from "react";

type Theme = "light" | "dark";

// Wraps the theme flip in the View Transitions API so the page reveals the
// new theme through a circle expanding from the toggle button itself. Falls
// back to an instant swap on browsers without support (and respects
// prefers-reduced-motion via the CSS in globals.css).
function tripTheme(next: Theme, origin: { x: number; y: number }) {
  const root = document.documentElement;
  root.style.setProperty("--theme-trip-x", `${origin.x}px`);
  root.style.setProperty("--theme-trip-y", `${origin.y}px`);

  const apply = () => {
    root.setAttribute("data-theme", next);
    try { localStorage.setItem("psi-theme", next); } catch {}
  };

  if (typeof document.startViewTransition !== "function") {
    apply();
    return;
  }
  document.startViewTransition(apply);
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const current = (document.documentElement.getAttribute("data-theme") as Theme) || "light";
    setTheme(current);
    setMounted(true);
  }, []);

  const toggle = (e: React.MouseEvent<HTMLButtonElement>) => {
    const next = theme === "dark" ? "light" : "dark";
    const rect = e.currentTarget.getBoundingClientRect();
    tripTheme(next, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    setTheme(next);
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
    </>
  );
}

