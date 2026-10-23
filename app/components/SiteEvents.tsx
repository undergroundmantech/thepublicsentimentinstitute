"use client";
// Site wide analytics wiring for Vercel Web Analytics, mounted once in the root layout.
//  1. Emits the visitor's own flag values into the DOM beside the build's flags, so Web Analytics
//     can split page views and events by them: the theme they read in, and whether the page runs in light
//     rendering and the phone layout (app/lib/lite.ts).
//  2. One delegated click listener sends the events every page shares:
//     Nav click       a link in the masthead or menu, by where it goes
//     Outbound link   a source or story on another site, by host and the section it was clicked from
//     any element with data-ev="Event name" and optional data-ev-d='{"key":"value"}'
//  3. Theme changed, when the visitor flips light and dark.
import { useEffect, useState } from "react";
import { ev, type EvData } from "@/app/lib/ev";
import { flagJson } from "@/app/lib/flagValues";
import { THEME_EVENT, getTheme, type Theme } from "@/app/lib/theme";

const section = () => window.location.pathname.split("/")[1] || "home";

function onClick(e: MouseEvent) {
  const t = e.target as Element | null;
  if (!t || typeof t.closest !== "function") return;
  const tagged = t.closest<HTMLElement>("[data-ev]");
  if (tagged) {
    let d: EvData | undefined;
    try { d = tagged.dataset.evD ? (JSON.parse(tagged.dataset.evD) as EvData) : undefined; } catch { d = undefined; }
    ev(tagged.dataset.ev || "Click", d);
  }
  const a = t.closest<HTMLAnchorElement>("a[href]");
  if (!a || tagged) return;
  let u: URL;
  try { u = new URL(a.href, window.location.href); } catch { return; }
  if (u.origin !== window.location.origin) {
    if (/^https?:$/.test(u.protocol)) ev("Outbound link", { host: u.hostname.replace(/^www\./, ""), from: section() });
    return;
  }
  if (a.closest("header.opp-top")) ev("Nav click", { to: u.pathname, menu: a.closest(".macc") ? "phone menu" : "masthead" });
}

export default function SiteEvents() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [lite, setLite] = useState({ lite: false, phone: false });
  useEffect(() => {
    setTheme(getTheme());
    setLite({ lite: document.documentElement.hasAttribute("data-lite"), phone: document.documentElement.hasAttribute("data-phone") });
    const onTheme = (e: Event) => { const to = (e as CustomEvent<Theme>).detail; setTheme(to); ev("Theme changed", { to }); };
    window.addEventListener(THEME_EVENT, onTheme);
    document.addEventListener("click", onClick, { capture: true, passive: true });
    return () => { window.removeEventListener(THEME_EVENT, onTheme); document.removeEventListener("click", onClick, { capture: true }); };
  }, []);
  return <script type="application/json" data-flag-values="" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: flagJson({ theme, "lite-render": lite.lite, "phone-layout": lite.phone }) }} />;
}
