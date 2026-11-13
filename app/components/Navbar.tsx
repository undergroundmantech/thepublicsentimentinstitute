"use client";

import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lockup } from "./opp/Logo";
import ThemeToggle from "./ThemeToggle";
import LangPicker from "./LangPicker";
import { MENU, type NavGroup } from "./navMenu";

// The On Point Politics masthead: the logo, five tabs and three controls. On Point Polling, Accuracy, Forecasts and Polls
// go straight to their page on a click and open a short panel on hover; More opens the rest of the site. One menu
// definition (navMenu.ts) drives the desktop panels, the phone menu and the footer.

const Caret = () => <svg className="cr" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.6 5 6.6 8 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;
const SearchIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>;

export default function Navbar() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);               // phone menu
  const [menu, setMenu] = useState<string | null>(null); // desktop panel
  const [acc, setAcc] = useState<string | null>(null);   // phone accordion
  const timer = useRef<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const head = useRef<HTMLElement>(null);

  useEffect(() => { setOpen(false); setMenu(null); }, [pathname]);
  useEffect(() => {
    // on a phone the masthead slides away while reading down the page and comes back on any scroll up
    let lastY = window.scrollY, ticking = false;
    const run = () => {
      ticking = false;
      const el = head.current; if (!el) return;
      const y = window.scrollY, dy = y - lastY;
      el.classList.toggle("scrolled", y > 8);
      if (document.documentElement.hasAttribute("data-phone")) {
        if (y < 120 || dy < -6) el.classList.remove("hide");
        else if (dy > 8 && !el.querySelector(".mnav")) el.classList.add("hide");
      } else el.classList.remove("hide");
      if (Math.abs(dy) > 6 || y < 120) lastY = y;
    };
    const on = () => { if (!ticking) { ticking = true; requestAnimationFrame(run); } };
    run(); window.addEventListener("scroll", on, { passive: true });
    const openMenu = () => { head.current?.classList.remove("hide"); setOpen(true); };
    window.addEventListener("opp:menu", openMenu);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("opp:menu", openMenu); };
  }, []);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open]);
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMenu(null); };
    const onDown = (e: MouseEvent) => { if (bar.current && !bar.current.contains(e.target as Node)) setMenu(null); };
    window.addEventListener("keydown", onKey); window.addEventListener("mousedown", onDown);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onDown); };
  }, [menu]);

  const under = (p: string) => pathname === p || pathname.startsWith(p + "/");
  const inGroup = (g: NavGroup) => {
    if (g.key === "opp") return under("/on-point-polling") || under("/portal") || pathname === "/contact";
    if (g.key === "accuracy") return under("/accuracy") || under("/most-accurate-pollster");
    if (g.key === "forecast") return under("/forecast") || under("/what-if") || under("/swingometer");
    if (g.key === "polls") return under("/polls") || under("/majority-tracker");
    if (g.more) return g.cols.some((c) => c.href && under(c.href.split("/").slice(0, 2).join("/"))) || under("/accountability") || under("/results");
    return under(g.href);
  };
  const enter = (k: string) => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(k), 80); };
  const leave = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(null), 200); };
  const cur = (href: string) => (pathname === href && !href.includes("#") ? "page" : undefined);

  return (
    <header className="opp opp-top" ref={head}>
      <div className="top" ref={bar}>
        <div className="wrap">
          <Link className="logo notranslate" translate="no" href="/" aria-label="On Point Politics home"><Lockup height={38} /></Link>
          <nav className="nav tabs5" aria-label="Primary">
            {MENU.map((g) => {
              const on = inGroup(g), op = menu === g.key;
              return (
                <div key={g.key} className={`t5-i${op ? " open" : ""}${on ? " on" : ""}`} onMouseEnter={() => enter(g.key)} onMouseLeave={leave}>
                  {g.more ? (
                    <button type="button" className="t5-t" aria-expanded={op} aria-controls={`t5-${g.key}`} onClick={() => setMenu(op ? null : g.key)}>{g.label}<Caret /></button>
                  ) : (
                    <span className="t5-t">
                      <Link href={g.href} className="t5-l" aria-current={on ? "page" : undefined} onFocus={() => enter(g.key)}>
                        {g.label}{g.chip ? <em className="t5-chip">{g.chip}</em> : null}
                      </Link>
                      <button type="button" className="t5-c" aria-label={`${g.label} menu`} aria-expanded={op} aria-controls={`t5-${g.key}`} onClick={() => setMenu(op ? null : g.key)}><Caret /></button>
                    </span>
                  )}
                  {op ? (
                    <div className={`t5-panel${g.more ? " more" : ""}`} id={`t5-${g.key}`} role="region" aria-label={`${g.label} menu`}>
                      <div className="t5-in">
                        <div className="t5-cols" style={{ ["--n" as string]: g.cols.length }}>
                          {g.cols.map((c) => (
                            <div key={c.h} className="t5-col">
                              {c.href ? <Link href={c.href} className="t5-h">{c.h}<Caret /></Link> : <p className="t5-h">{c.h}</p>}
                              <ul>{c.links.map((l) => (
                                <li key={l.href + l.label}><Link href={l.href} aria-current={cur(l.href)}>
                                  <span className="t">{l.label}{l.badge ? <em>{l.badge}</em> : null}</span>{l.note ? <span className="n">{l.note}</span> : null}
                                </Link></li>
                              ))}</ul>
                            </div>
                          ))}
                        </div>
                        {g.feature ? (
                          <Link className="t5-feat" href={g.feature.href}>
                            <span className="e">{g.feature.eyebrow}</span>
                            <span className="h">{g.feature.title}</span>
                            <span className="n">{g.feature.note}</span>
                            <span className="go">{g.feature.cta}</span>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="right">
            <Link className="btn icon t5-search" href="/search" aria-label="Search"><SearchIcon /></Link>
            <LangPicker />
            <ThemeToggle />
            <Link className="btn white hire" href="/on-point-polling#contact">Hire us</Link>
            <button type="button" className="btn burger" aria-expanded={open} aria-controls="opp-mnav" onClick={() => setOpen(true)}>Menu</button>
          </div>
        </div>
      </div>
      {open && (
        <div className="mnav" id="opp-mnav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mhead">
            <Link className="logo notranslate" translate="no" href="/" aria-label="On Point Politics home"><Lockup height={34} /></Link>
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>Close</button>
          </div>
          <Link href="/search" className="m5-search"><SearchIcon />Search the site</Link>
          <nav aria-label="Menu" className="macc">
            {MENU.flatMap((g) => g.more
              // More's sections each get their own row on a phone
              ? g.cols.map((c) => ({ key: `${g.key}-${c.h}`, label: c.h, href: c.href ?? g.href, cols: [{ h: "", links: c.links }] }))
              : [{ key: g.key, label: g.label, href: g.href, cols: g.cols }]
            ).map((g) => (
              <div key={g.key} className={`macc-g${acc === g.key ? " open" : ""}`}>
                <button type="button" aria-expanded={acc === g.key} onClick={() => setAcc(acc === g.key ? null : g.key)}>{g.label}<Caret /></button>
                {acc === g.key ? (
                  <div className="macc-b">
                    <Link href={g.href} className="all">Open {g.label}</Link>
                    {g.cols.map((c, i) => (
                      <div key={c.h || i}>{c.h ? <h3>{c.h}</h3> : null}{c.links.map((l) => <Link key={l.href + l.label} href={l.href}>{l.label}</Link>)}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </nav>
          <div className="mfoot">
            <Link className="btn white" href="/on-point-polling#contact">Hire us</Link>
            <Link className="btn" href="/contact">Contact</Link>
            <ThemeToggle className="btn" />
            <LangPicker className="btn" inMenu />
          </div>
        </div>
      )}
    </header>
  );
}
