"use client";
// The live site theme for client components that paint with canvas or inline colors. It follows the
// <html data-theme> and data-mode attributes, so a click on the appearance switch repaints at once.
import { useEffect, useRef, useState } from "react";
import { getMode, getTheme, THEME_EVENT, type Mode, type Theme } from "./theme";

function subscribe(f: () => void) {
  window.addEventListener(THEME_EVENT, f);
  const mo = new MutationObserver(f);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-mode"] });
  return () => { window.removeEventListener(THEME_EVENT, f); mo.disconnect(); };
}

/** The theme as state, for render. Starts dark on the server and settles on mount. */
export function useSiteTheme(): Theme {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => { const f = () => setT(getTheme()); f(); return subscribe(f); }, []);
  return t;
}

/** The appearance mode (Pro Dark, Pro Light, Theme) as state. Use it as an effect dependency for canvases that read
 *  CSS tokens, since Pro Dark and Theme share the dark scheme but not every token. */
export function useSiteMode(): Mode {
  const [m, setM] = useState<Mode>("dark");
  useEffect(() => { const f = () => setM(getMode()); f(); return subscribe(f); }, []);
  return m;
}

/** The theme as a ref, for animation loops that read it every frame. */
export function useThemeRef() {
  const ref = useRef<Theme>("dark");
  useEffect(() => { const f = () => { ref.current = getTheme(); }; f(); return subscribe(f); }, []);
  return ref;
}
