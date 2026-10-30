// Site appearance: three modes on two colour schemes. Two attributes on <html>, kept in step by this file only:
//   data-mode  "dark" | "light" | "themed"   the visitor's choice (Pro Dark, Pro Light, Theme); mode-only CSS keys off it
//   data-theme "dark" | "light"              the colour scheme; every existing token, stylesheet and chart keys off it
// Theme is the expressive OnPoint mode drawn on the dark scheme, so everything written for data-theme keeps working.
// The choice is stored in localStorage under opp.theme (older "dark"/"light" values are valid modes) and applied by
// THEME_INIT_SCRIPT before first paint. Default is Pro Dark; the operating system preference is never consulted.

export type Theme = "dark" | "light";
export type Mode = "dark" | "light" | "themed";

export const MODES: readonly Mode[] = ["dark", "light", "themed"];
export const MODE_LABEL: Record<Mode, string> = { dark: "Pro Dark", light: "Pro Light", themed: "Theme" };
export const MODE_NOTE: Record<Mode, string> = { dark: "Data first, dark ground", light: "Clean editorial light", themed: "OnPoint colour and Pointy" };
export const DEFAULT_MODE: Mode = "dark";

export const THEME_KEY = "opp.theme";
/** Fired on window after every change; detail is the new Mode. */
export const THEME_EVENT = "opp:theme";
export const CHROME: Record<Mode, string> = { dark: "#110019", light: "#f5f3fa", themed: "#1a0832" };

export const isMode = (v: unknown): v is Mode => v === "dark" || v === "light" || v === "themed";
export const schemeOf = (m: Mode): Theme => (m === "light" ? "light" : "dark");

/** The colour scheme. Safe on the server, where it is the default. */
export function getTheme(): Theme {
  if (typeof document === "undefined") return schemeOf(DEFAULT_MODE);
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/** The appearance mode. Falls back to the scheme for a root written by an older script. */
export function getMode(): Mode {
  if (typeof document === "undefined") return DEFAULT_MODE;
  const m = document.documentElement.dataset.mode;
  return isMode(m) ? m : getTheme();
}

export function readStoredMode(): Mode | null {
  try { const v = localStorage.getItem(THEME_KEY); return isMode(v) ? v : null; } catch { return null; }
}

export function setMode(next: Mode, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement, scheme = schemeOf(next);
  root.dataset.mode = next;
  if (root.dataset.theme !== scheme) root.dataset.theme = scheme;
  root.dataset.opaTheme = scheme;
  root.style.colorScheme = scheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CHROME[next]);
  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }
  window.dispatchEvent(new CustomEvent<Mode>(THEME_EVENT, { detail: next }));
}

/** Two-mode callers: picks Pro Dark or Pro Light. */
export const setTheme = (next: Theme, persist = true) => setMode(next, persist);

/** Two-mode callers: flips the scheme between Pro Dark and Pro Light. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  setMode(next);
  return next;
}

// Inline, blocking, runs in <head> before first paint, so a returning visitor never sees the wrong mode flash. A missing,
// unknown or unreadable value leaves the server default (Pro Dark) in place.
export const THEME_INIT_SCRIPT = `(function(){try{var t=null;try{t=localStorage.getItem(${JSON.stringify(THEME_KEY)})}catch(e){}if(t!=="dark"&&t!=="light"&&t!=="themed")return;var r=document.documentElement,s=t==="light"?"light":"dark";r.dataset.mode=t;r.dataset.theme=s;r.dataset.opaTheme=s;r.style.colorScheme=s;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",${JSON.stringify(CHROME)}[t])}catch(e){}})();`;
