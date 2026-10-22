"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const WD_TABS = [
  { href: "/watchdog", label: "Desk" },
  { href: "/watchdog/trail", label: "Campaign trail" },
  { href: "/watchdog/endorsements", label: "Endorsements" },
  { href: "/watchdog/media", label: "Media watch" },
  { href: "/watchdog/money", label: "Money flow" },
  { href: "/watchdog/connections", label: "Connections" },
  { href: "/watchdog/paid", label: "Who gets paid" },
  { href: "/watchdog/counties", label: "County data center" },
  { href: "/watchdog/ledger", label: "Ledger records" },
];

const LINES = [
  "indexing campaign stops, endorsements and media hits",
  "tracing outside money from donor to super PAC to ad buy",
  "matching vendors paid by both campaigns and super PACs",
  "cross checking every claim against its source",
];

/** The investigator's status line: a typed readout, the case path and a live clock. */
function StatusLine({ path }: { path: string }) {
  const [i, setI] = useState(0);
  const [n, setN] = useState(0);
  const [now, setNow] = useState("");
  useEffect(() => {
    const line = LINES[i];
    const t = setTimeout(() => { if (n < line.length) setN(n + 1); else { setTimeout(() => { setI((i + 1) % LINES.length); setN(0); }, 2200); } }, n < line.length ? 28 : 0);
    return () => clearTimeout(t);
  }, [i, n]);
  useEffect(() => { const tick = () => setNow(new Date().toLocaleTimeString("en-US", { hour12: false })); tick(); const id = setInterval(tick, 1000); return () => clearInterval(id); }, []);
  const seg = path.replace(/^\/watchdog\/?/, "") || "desk";
  return (
    <div className="wdt-status" aria-hidden="true">
      <span className="rec"><i />LIVE</span>
      <span className="path">watchdog://{seg}</span>
      <span className="typed">&gt; {LINES[i].slice(0, n)}<b className="cur">█</b></span>
      <span className="clock">{now} ET</span>
    </div>
  );
}

export default function WatchdogNav() {
  const path = usePathname() || "/watchdog";
  return (
    <>
      <div className="wdt-tape" aria-hidden="true"><span>WATCHDOG INVESTIGATION</span><span>FOLLOW THE MONEY</span><span>EVERY CLAIM SOURCED</span><span>WATCHDOG INVESTIGATION</span><span>FOLLOW THE MONEY</span><span>EVERY CLAIM SOURCED</span></div>
      <nav className="wd-nav" aria-label="Watchdog sections">
        <Link href="/watchdog" className="wd-brand"><i aria-hidden="true" />Watchdog<small>OS</small></Link>
        {WD_TABS.map((t) => {
          const on = t.href === "/watchdog" ? path === "/watchdog" : path.startsWith(t.href);
          return <Link key={t.href} href={t.href} className={`wd-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>{t.label}</Link>;
        })}
      </nav>
      <StatusLine path={path} />
    </>
  );
}
