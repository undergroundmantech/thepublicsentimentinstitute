// Site theme. The <html data-theme> attribute is the single source of truth;
// every token in globals.css keys off it. Default is dark. A visitor's choice
// is stored in localStorage and applied by THEME_INIT_SCRIPT before first paint.

export type Theme = "dark" | "light";

export const THEME_KEY = "opp.theme";
export const THEME_EVENT = "opp:theme";
const CHROME: Record<Theme, string> = { dark: "#110019", light: "#f5f3fa" };

export function getTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function setTheme(next: Theme, persist = true): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.dataset.theme = next;
  root.style.colorScheme = next;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CHROME[next]);
  if (persist) {
    try { localStorage.setItem(THEME_KEY, next); } catch {}
  }
  window.dispatchEvent(new CustomEvent(THEME_EVENT, { detail: next }));
}

export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

// Inline, blocking, runs in <head>. Keeps a returning light-mode visitor from
// seeing a dark flash.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var r=document.documentElement;if(t==="light"||t==="dark"){r.dataset.theme=t;r.style.colorScheme=t;var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content",t==="light"?"${CHROME.light}":"${CHROME.dark}")}}catch(e){}})();`;
