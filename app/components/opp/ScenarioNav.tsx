"use client";
// The two scenario tools, What If and the swingometer, each on its own page: a small bar to hop between them and back to the forecast.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import "./forecastnav.css";

const TABS = [
  { href: "/what-if", label: "What if" },
  { href: "/swingometer", label: "Swingometer" },
  { href: "/forecast", label: "Back to the forecast" },
];

export default function ScenarioNav() {
  const p = usePathname() || "";
  return (
    <nav className="fnav" aria-label="Scenario tools">
      {TABS.map((t) => {
        const on = p === t.href;
        return <Link key={t.href} href={t.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{t.label}</Link>;
      })}
    </nav>
  );
}
