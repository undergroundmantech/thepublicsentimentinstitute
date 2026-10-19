"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Lockup } from "./opp/Logo";
import ThemeToggle from "./ThemeToggle";

// The On Point Politics masthead (.top in opp-ui/components.md). One header for every page.
// Results carries the pulsing live dot while RESULTS_LIVE is on.
const RESULTS_LIVE = true;

const NAV = [
  { href: "/polls", label: "Polls" },
  { href: "/forecast", label: "Forecast" },
  { href: "/forecast/swingometer", label: "Swingometer" },
  { href: "/maps", label: "Maps" },
  { href: "/results", label: "Results", live: RESULTS_LIVE },
  { href: "/maps/early-vote", label: "Early Vote" },
  { href: "/on-point-polling", label: "On Point Polling" },
];

export default function Navbar() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);

  // /maps/early-vote belongs to Early Vote, not Maps
  const active = (href: string) => {
    if (href === "/maps") return pathname.startsWith("/maps") && !pathname.startsWith("/maps/early-vote");
    if (href === "/forecast") return pathname.startsWith("/forecast") && !pathname.startsWith("/forecast/swingometer");
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <header className="opp opp-top">
      <div className="top">
        <div className="wrap">
          <Link className="logo" href="/" aria-label="On Point Politics home"><Lockup height={44} /></Link>
          <nav className="nav" aria-label="Primary">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href}
                className={[n.live ? "live" : "", active(n.href) ? "on" : ""].join(" ").trim() || undefined}
                aria-current={active(n.href) ? "page" : undefined}>
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="right">
            <Link className="btn ghost" href="/search">Search</Link>
            <ThemeToggle />
            <Link className="btn gold" href="/on-point-polling/weighting-room">The Weighting Room</Link>
            <button type="button" className="btn burger" aria-expanded={open} aria-controls="opp-mnav" onClick={() => setOpen(true)}>Menu</button>
          </div>
        </div>
      </div>
      {open && (
        <div className="mnav" id="opp-mnav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mhead">
            <Link className="logo" href="/" aria-label="On Point Politics home"><Lockup height={36} /></Link>
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>Close</button>
          </div>
          <nav aria-label="Menu">
            {NAV.map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
            <Link href="/search">Search</Link>
          </nav>
          <div className="mfoot">
            <Link className="btn gold" href="/on-point-polling/weighting-room">The Weighting Room</Link>
            <Link className="btn" href="/contact">Contact</Link>
            <ThemeToggle className="btn" />
          </div>
        </div>
      )}
    </header>
  );
}
