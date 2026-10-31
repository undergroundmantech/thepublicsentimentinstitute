"use client";
// The Brasil section bar: the forecast, states and towns, the results and the archive notes, with the language switch.
// The runoff is over, so the bar says these pages are an archive.
import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { LangToggle, useLang } from "./i18n";

const LINKS: [string, string, string][] = [
  ["/brasil", "Forecast", "Previsão"], ["/brasil/estados", "States and towns", "Estados e municípios"], ["/brasil/resultados", "Results", "Resultados"], ["/brasil/arquivo", "About the archive", "Sobre o arquivo"],
];

export default function BrBar() {
  const p = usePathname() || "/brasil";
  const { lang } = useLang();
  const on = (href: string) => (href === "/brasil" ? p === "/brasil"
    : href === "/brasil/resultados" ? p.startsWith("/brasil/resultados") || p.startsWith("/brasil/monitor")
    : p.startsWith(href) || (href === "/brasil/estados" && /^\/brasil\/(?!resultados|monitor|estados|arquivo)[a-z-]+$/.test(p)));
  return (
    <div className="br-bar">
      <div className="in">
        <span className="tag">
          <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" rx="3" fill="#00a651" /><path d="M11 2 20 8 11 14 2 8Z" fill="#ffcc29" /><circle cx="11" cy="8" r="3.4" fill="#1d3f9a" /></svg>
          {lang === "pt" ? "Brasil 2026" : "Brazil 2026"}
        </span>
        <nav aria-label="Brazil 2026">
          {LINKS.map(([h, en, pt]) => <Link key={h} href={h} aria-current={on(h) ? "page" : undefined}>{lang === "pt" ? pt : en}</Link>)}
        </nav>
        <span className="live">{lang === "pt" ? "Arquivo · 2º turno de 25/10/2026" : "Archive · runoff of Oct 25, 2026"}</span>
        <LangToggle />
      </div>
    </div>
  );
}
