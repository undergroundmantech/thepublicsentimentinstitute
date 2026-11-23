"use client";
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";

// The 2028 pages share the masthead's 2028 Forecast menu, so this strip is only the breadcrumb.
export default function Nav28() {
  const p = usePathname() || "";
  const here = p === "/2028" ? null : p.startsWith("/2028/primaries") ? "Primaries" : p.startsWith("/2028/general") ? "General election" : p.startsWith("/2028/ticket") ? "Pick a ticket" : p.startsWith("/2028/map-maker") ? "Map maker" : null;
  return (
    <div className="x28-top">
      <nav className="x28-crumb" aria-label="Breadcrumb"><Link href="/">Home</Link><span>/</span><Link href="/forecast">Forecast</Link><span>/</span>{here ? <><Link href="/2028">2028</Link><span>/</span><span>{here}</span></> : <span>2028</span>}</nav>
    </div>
  );
}
