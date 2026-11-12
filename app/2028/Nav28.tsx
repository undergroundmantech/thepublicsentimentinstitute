"use client";
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/2028", label: "Overview" },
  { href: "/2028/primaries", label: "Primaries" },
  { href: "/2028/general", label: "General election" },
  { href: "/2028/ticket", label: "Pick a ticket" },
];
export default function Nav28() {
  const p = usePathname() || "";
  return (
    <div className="x28-top">
      <nav className="x28-crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/forecast">Forecast</Link><span>/</span><span>2028</span></nav>
      <nav className="x28-nav" aria-label="2028 model">
        <span className="x28-brand"><b>2028</b> Presidential model</span>
        {TABS.map((t) => { const on = p === t.href; return <Link key={t.href} href={t.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{t.label}</Link>; })}
      </nav>
    </div>
  );
}
