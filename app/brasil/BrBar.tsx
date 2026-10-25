"use client";
// The Brasil section bar: the forecast, states and towns, and the live results, with the language switch.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ELECTION_ISO } from "./lib";
import { LangToggle, useLang } from "./i18n";

const LINKS: [string, string, string][] = [
  ["/brasil", "Forecast", "Previsão"], ["/brasil/estados", "States and towns", "Estados e municípios"], ["/brasil/resultados", "Live results", "Resultados ao vivo"],
];

export default function BrBar() {
  const p = usePathname() || "/brasil";
  const { lang } = useLang();
  const on = (href: string) => (href === "/brasil" ? p === "/brasil"
    : href === "/brasil/resultados" ? p.startsWith("/brasil/resultados") || p.startsWith("/brasil/monitor")
    : p.startsWith(href) || (href === "/brasil/estados" && /^\/brasil\/(?!resultados|monitor|estados)[a-z-]+$/.test(p)));
  const [live, setLive] = useState(false);
  useEffect(() => { const t = new Date(ELECTION_ISO).getTime(), n = Date.now(); setLive(n > t - 12 * 3600e3 && n < t + 30 * 3600e3); }, []);
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
        <span className="live">{live ? <><i />{lang === "pt" ? "2º turno hoje" : "Runoff today"}</> : lang === "pt" ? "2º turno · 25 de outubro" : "Runoff · October 25"}</span>
        <LangToggle />
      </div>
    </div>
  );
}
