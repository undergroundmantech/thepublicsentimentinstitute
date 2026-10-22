"use client";
// The section bar on every forecast page, so each forecast is one click from any other.
import Link from "next/link";
import { usePathname } from "next/navigation";
import "./forecastnav.css";

const TABS: { href: string; label: string; match?: (p: string) => boolean }[] = [
  { href: "/forecast", label: "Overview", match: (p) => p === "/forecast" },
  { href: "/forecast?office=senate", label: "Senate", match: (p) => /^\/forecast\/[a-z]{2}\/senate$/.test(p) },
  { href: "/forecast?office=house", label: "House", match: (p) => /^\/forecast\/[a-z]{2}\/house-/.test(p) },
  { href: "/forecast?office=governor", label: "Governors", match: (p) => /^\/forecast\/[a-z]{2}\/governor$/.test(p) },
  { href: "/what-if", label: "What if" },
  { href: "/swingometer", label: "Swingometer" },
  { href: "/forecast/statewide", label: "Statewide offices" },
  { href: "/forecast/legislatures", label: "State legislatures" },
  { href: "/forecast/measures", label: "Ballot measures" },
  { href: "/forecast/other", label: "Every other race" },
  { href: "/forecast/methodology", label: "Methodology" },
];

export default function ForecastNav() {
  const p = usePathname() || "";
  return (
    <nav className="fnav" aria-label="Forecast sections">
      {TABS.map((t) => {
        const on = t.match ? t.match(p) : p === t.href || p.startsWith(t.href + "/");
        return <Link key={t.label} href={t.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
