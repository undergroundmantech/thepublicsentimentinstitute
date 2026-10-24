"use client";
// The Brasil section bar: forecast, live results and the control room, with the html lang set to Portuguese while
// these pages are open so screen readers, browsers and search engines read them as pt-BR.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ELECTION_ISO } from "./lib";

const LINKS: [string, string][] = [["/brasil", "Previsão"], ["/brasil/estados", "Estados e municípios"], ["/brasil/resultados", "Resultados ao vivo"], ["/brasil/monitor", "Sala de situação"]];

export default function BrBar() {
  const p = usePathname() || "/brasil";
  useEffect(() => {
    const h = document.documentElement, was = h.lang;
    h.lang = "pt-BR";
    return () => { h.lang = was || "en"; };
  }, []);
  const on = (href: string) => (href === "/brasil" ? p === "/brasil" : p.startsWith(href) || (href === "/brasil/estados" && /^\/brasil\/(?!resultados|monitor|estados)[a-z-]+$/.test(p)));
  const [live, setLive] = useState(false);
  useEffect(() => { const t = new Date(ELECTION_ISO).getTime(), n = Date.now(); setLive(n > t - 12 * 3600e3 && n < t + 30 * 3600e3); }, []);
  return (
    <div className="br-bar">
      <div className="in">
        <span className="tag">
          <svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true"><rect width="22" height="16" rx="3" fill="#00a651" /><path d="M11 2 20 8 11 14 2 8Z" fill="#ffcc29" /><circle cx="11" cy="8" r="3.4" fill="#1d3f9a" /></svg>
          Brasil 2026
        </span>
        <nav aria-label="Brasil 2026">
          {LINKS.map(([h, l]) => <Link key={h} href={h} aria-current={on(h) ? "page" : undefined}>{l}</Link>)}
        </nav>
        <span className="live">{live ? <><i />2º turno hoje</> : "2º turno · 25 de outubro"}</span>
      </div>
    </div>
  );
}
