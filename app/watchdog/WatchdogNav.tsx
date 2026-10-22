"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export const WD_TABS = [
  { href: "/watchdog", label: "Desk" },
  { href: "/watchdog/trail", label: "Campaign trail" },
  { href: "/watchdog/endorsements", label: "Endorsements" },
  { href: "/watchdog/media", label: "Media watch" },
  { href: "/watchdog/money", label: "Money flow" },
  { href: "/watchdog/connections", label: "Connections" },
  { href: "/watchdog/paid", label: "Who gets paid" },
  { href: "/watchdog/counties", label: "County data center" },
];

export default function WatchdogNav() {
  const path = usePathname() || "/watchdog";
  return (
    <nav className="wd-nav" aria-label="Watchdog sections">
      <Link href="/watchdog" className="wd-brand"><i aria-hidden="true" />Watchdog</Link>
      {WD_TABS.map((t) => {
        const on = t.href === "/watchdog" ? path === "/watchdog" : path.startsWith(t.href);
        return <Link key={t.href} href={t.href} className={`wd-tab${on ? " on" : ""}`} aria-current={on ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
