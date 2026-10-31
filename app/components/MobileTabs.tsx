"use client";
// The phone tab bar: the four desks people come back to, in reach of a thumb, and the full menu. Shown at 860px
// and narrower (app/phone.css). It steps aside while the on screen keyboard is up and in full screen views.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ev } from "@/app/lib/ev";

type Tab = { key: string; label: string; href: string; on: (p: string) => boolean; icon: React.ReactNode };

const I = (d: React.ReactNode) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;

const TABS: Tab[] = [
  { key: "forecast", label: "Forecast", href: "/forecast", on: (p) => p.startsWith("/forecast") || p.startsWith("/what-if") || p.startsWith("/swingometer"),
    icon: I(<><path d="M3 20h18" /><path d="M6 16V10" /><path d="M11 16V5" /><path d="M16 16v-8" /><path d="M21 16v-4" /></>) },
  { key: "polls", label: "Polls", href: "/polls", on: (p) => p.startsWith("/polls"),
    icon: I(<><path d="M4 18 9 12l4 3 7-8" /><circle cx="9" cy="12" r="1.2" /><circle cx="13" cy="15" r="1.2" /></>) },
  { key: "early", label: "Early vote", href: "/maps/early-vote", on: (p) => p.startsWith("/maps/early-vote"),
    icon: I(<><rect x="4" y="9" width="16" height="11" rx="2" /><path d="M9 9V6h6v3" /><path d="M8 14h8" /></>) },
  { key: "results", label: "Results", href: "/results/monitor", on: (p) => p.startsWith("/results"),
    icon: I(<><circle cx="12" cy="12" r="8" /><path d="m8.5 12.5 2.3 2.3 4.7-5" /></>) },
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
  const menu = () => { ev("Tab bar", { to: "menu" }); window.dispatchEvent(new Event("opp:menu")); };
  return (
    <nav className={`opp opp-tabs${kb ? " kb" : ""}`} aria-label="Sections">
      {TABS.map((t) => {
        const on = t.on(path);
        return (
          <Link key={t.key} href={t.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined} onClick={() => ev("Tab bar", { to: t.key })}>
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
