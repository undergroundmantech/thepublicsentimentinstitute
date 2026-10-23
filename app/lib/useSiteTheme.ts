"use client";
// The live site theme for client components that paint with canvas or inline colors. It follows the
// <html data-theme> attribute, so a click on the theme switch repaints at once.
import { useEffect, useRef, useState } from "react";
import { getTheme, THEME_EVENT, type Theme } from "./theme";

function subscribe(f: () => void) {
  window.addEventListener(THEME_EVENT, f);
  const mo = new MutationObserver(f);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => { window.removeEventListener(THEME_EVENT, f); mo.disconnect(); };
}

/** The theme as state, for render. Starts dark on the server and settles on mount. */
export function useSiteTheme(): Theme {
  const [t, setT] = useState<Theme>("dark");
  useEffect(() => { const f = () => setT(getTheme()); f(); return subscribe(f); }, []);
  return t;
}

/** The theme as a ref, for animation loops that read it every frame. */
export function useThemeRef() {
  const ref = useRef<Theme>("dark");
  useEffect(() => { const f = () => { ref.current = getTheme(); }; f(); return subscribe(f); }, []);
  return ref;
}
