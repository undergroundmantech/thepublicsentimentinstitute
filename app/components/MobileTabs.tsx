"use client";
// The phone tab bar: the 2026 results and the four desks people come back to, in reach of a thumb, and the full menu.
// Shown at 860px and narrower (app/phone.css). It steps aside while the on screen keyboard is up and in full screen
// views. Tapping Results goes straight to the Situation Monitor; holding it (half a second) opens the menu at the
// results pages instead, as hovering the desktop tab does.
// Nov 2026 refresh: a floating capsule with a lit blob that glides between tabs (refresh.css), one tab wide.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ev } from "@/app/lib/ev";

type Tab = { key: string; label: string; href: string; on: (p: string) => boolean; icon: React.ReactNode };

const I = (d: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

const TABS: Tab[] = [
  { key: "f28", label: "2028", href: "/2028", on: (p) => p.startsWith("/2028"),
    icon: I(<><path d="M3 6.5 12 3l9 3.5" /><path d="M5 9v9M9.5 9v9M14.5 9v9M19 9v9" /><path d="M3 20.5h18" /></>) },
  { key: "play", label: "Play", href: "/play", on: (p) => p.startsWith("/play"),
    icon: I(<><rect x="3" y="7" width="18" height="11" rx="5" /><path d="M8 10.5v4M6 12.5h4" /><circle cx="15.5" cy="11.5" r=".9" /><circle cx="17.5" cy="13.8" r=".9" /></>) },
  { key: "results", label: "Results", href: "/results/monitor", on: (p) => p.startsWith("/results"),
    icon: I(<><rect x="4" y="4" width="16" height="16" rx="3" /><path d="m8.5 12.2 2.4 2.4 4.8-5.2" /></>) },
  { key: "opp", label: "On Point", href: "/on-point-polling", on: (p) => p.startsWith("/on-point-polling") || p.startsWith("/accuracy") || p.startsWith("/most-accurate-pollster"),
    icon: I(<><path d="M4 19V9" /><path d="M9 19V5" /><path d="M14 19v-7" /><path d="M19 19v-4" /><path d="M3 19h18" /></>) },
  { key: "forecast", label: "Forecasts", href: "/forecast", on: (p) => p.startsWith("/forecast") || p.startsWith("/2027") || p.startsWith("/what-if") || p.startsWith("/swingometer"),
    icon: I(<><path d="M3 20h18" /><path d="M6 16V10" /><path d="M11 16V5" /><path d="M16 16v-8" /><path d="M21 16v-4" /></>) },
  { key: "polls", label: "Polls", href: "/polls", on: (p) => p.startsWith("/polls") || p.startsWith("/majority-tracker"),
    icon: I(<><path d="M4 18 9 12l4 3 7-8" /><circle cx="9" cy="12" r="1.2" /><circle cx="13" cy="15" r="1.2" /></>) },
];

export default function MobileTabs() {
  const path = usePathname() || "/";
  const [kb, setKb] = useState(false);
  useEffect(() => {
    const vv = window.visualViewport; if (!vv) return;
    // the keyboard takes a third of the screen or more; a sliding address bar never does
    const on = () => setKb(window.innerHeight - vv.height > window.innerHeight * 0.3);
    vv.addEventListener("resize", on);
    return () => vv.removeEventListener("resize", on);
  }, []);
  const at = TABS.findIndex((t) => t.on(path));
  const menu = () => { ev("Tab bar", { to: "menu" }); window.dispatchEvent(new Event("opp:menu")); };
  const hold = useRef<{ t: number | null; held: boolean }>({ t: null, held: false });
  const holdStart = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    hold.current.held = false; if (hold.current.t) window.clearTimeout(hold.current.t);
    hold.current.t = window.setTimeout(() => {
      hold.current.held = true; navigator.vibrate?.(10); ev("Tab bar", { to: "results menu" });
      // the finger's release still sends a click, now landing on the menu that just opened under it: swallow that one
      const eat = (c: MouseEvent) => { c.preventDefault(); c.stopPropagation(); window.removeEventListener("click", eat, true); };
      window.addEventListener("click", eat, true); window.setTimeout(() => window.removeEventListener("click", eat, true), 1200);
      window.dispatchEvent(new CustomEvent("opp:menu", { detail: { section: "results" } }));
    }, 450);
  };
  const holdEnd = () => { if (hold.current.t) window.clearTimeout(hold.current.t); hold.current.t = null; };
  return (
    <nav className={`opp opp-tabs${kb ? " kb" : ""}`} aria-label="Sections">
      {/* a soft lit blob that glides to the current tab */}
      <span className={`tb-blob${at >= 0 ? " on" : ""}`} style={{ width: `${100 / (TABS.length + 1)}%`, transform: `translateX(${Math.max(at, 0) * 100}%)` }} aria-hidden="true" />
      {TABS.map((t) => {
        const on = t.on(path);
        return (
          <Link key={t.key} href={t.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}
            onClick={(e) => { if (t.key === "results" && hold.current.held) { e.preventDefault(); hold.current.held = false; e.currentTarget.dataset.held = "1"; return; } ev("Tab bar", { to: t.key }); }}
            {...(t.key === "results" ? { onPointerDown: holdStart, onPointerUp: holdEnd, onPointerCancel: holdEnd, onContextMenu: (e: React.MouseEvent) => { if (hold.current.held || hold.current.t) e.preventDefault(); } } : {})}>
            {t.icon}<span>{t.label}</span>
          </Link>
        );
      })}
      <button type="button" onClick={menu} aria-haspopup="dialog" aria-controls="opp-mnav">
        {I(<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>)}<span>More</span>
      </button>
    </nav>
  );
}
