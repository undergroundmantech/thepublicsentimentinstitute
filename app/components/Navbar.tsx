"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lockup } from "./opp/Logo";
import ThemeToggle from "./ThemeToggle";
import { MENU, type NavGroup } from "./navMenu";

// The On Point Politics masthead. A slim status strip (Election Day countdown, the three control odds, utility links)
// over the main bar, where every section opens a grouped menu: what the section holds, sorted into columns, each link
// with a one line note. One menu definition (navMenu.ts) drives the desktop menus, the phone menu and the footer.

const Caret = () => <svg className="cr" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><path d="M2 3.6 5 6.6 8 3.6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>;

export default function Navbar({ status }: { status?: { days: number; updated: string; sen: number; house: number; gov: number } }) {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);               // phone menu
  const [menu, setMenu] = useState<string | null>(null); // desktop group
  const [acc, setAcc] = useState<string | null>(null);   // phone accordion
  const timer = useRef<number | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => { setOpen(false); setMenu(null); }, [pathname]);
  const head = useRef<HTMLElement>(null);
  useEffect(() => {
    const on = () => head.current?.classList.toggle("scrolled", window.scrollY > 40);
    on(); window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
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

  const inGroup = (g: NavGroup) => {
    if (g.key === "early") return pathname.startsWith("/maps/early-vote");
    if (g.key === "maps") return pathname.startsWith("/maps") && !pathname.startsWith("/maps/early-vote");
    if (g.key === "forecast") return pathname.startsWith("/forecast") || pathname.startsWith("/what-if") || pathname.startsWith("/swingometer");
    if (g.key === "opp") return pathname.startsWith("/on-point-polling") || pathname.startsWith("/portal") || pathname === "/contact";
    return pathname === g.href || pathname.startsWith(g.href + "/");
  };
  const enter = (k: string) => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(k), 90); };
  const leave = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(null), 180); };
  const pct = (p: number) => `${Math.round(p * 100)}%`;

  return (
    <header className="opp opp-top" ref={head}>
      {status ? (
        <div className="mstrip">
          <div className="wrap">
            <span className="ms-day"><i aria-hidden="true" />Election Day, Nov 3 <b>{status.days === 0 ? "Today" : `${status.days} ${status.days === 1 ? "day" : "days"}`}</b></span>
            <Link href="/forecast" className="ms-odds" aria-label="Chances of Democratic control">
              <span>Senate <b>D {pct(status.sen)}</b></span><span>House <b>D {pct(status.house)}</b></span><span>Governors <b>D {pct(status.gov)}</b></span>
            </Link>
            <span className="ms-upd">Forecast updated {status.updated}</span>
            <nav className="ms-links" aria-label="Utility">
              <Link href="/on-point-polling/polls">Poll releases</Link>
              <Link href="/portal/login">Client portal</Link>
              <Link href="/contact">Contact</Link>
            </nav>
          </div>
        </div>
      ) : null}
      <div className="top" ref={bar}>
        <div className="wrap">
          <Link className="logo" href="/" aria-label="On Point Politics home"><Lockup height={40} /></Link>
          <nav className="nav mmenu" aria-label="Primary">
            {MENU.map((g) => {
              const has = g.cols.length > 0, on = inGroup(g), op = menu === g.key;
              return (
                <div key={g.key} className={`mm-i${op ? " open" : ""}`} onMouseEnter={has ? () => enter(g.key) : undefined} onMouseLeave={has ? leave : undefined}>
                  {has ? (
                    <button type="button" className={[g.live ? "live" : "", on ? "on" : ""].join(" ").trim() || undefined} aria-expanded={op} aria-controls={`mm-${g.key}`}
                      onClick={() => setMenu(op ? null : g.key)}>
                      {g.label}<Caret />
                    </button>
                  ) : (
                    <Link href={g.href} className={on ? "on" : undefined} aria-current={on ? "page" : undefined}>{g.label}</Link>
                  )}
                  {has && op ? (
                    <div className="mm-panel" id={`mm-${g.key}`} role="region" aria-label={`${g.label} menu`}>
                      <div className="mm-cols" style={{ gridTemplateColumns: `repeat(${g.cols.length}, minmax(190px, 1fr))${g.feature ? " minmax(230px, 280px)" : ""}` }}>
                        {g.cols.map((c) => (
                          <div key={c.h} className="mm-col">
                            <h3>{c.h}</h3>
                            <ul>{c.links.map((l) => (
                              <li key={l.href + l.label}><Link href={l.href} aria-current={pathname === l.href && !l.href.includes("?") ? "page" : undefined}>
                                <span className="t">{l.label}{l.badge ? <em>{l.badge}</em> : null}</span>{l.note ? <span className="n">{l.note}</span> : null}
                              </Link></li>
                            ))}</ul>
                          </div>
                        ))}
                        {g.feature ? (
                          <Link className="mm-feat" href={g.feature.href}>
                            <span className="e">{g.feature.eyebrow}</span><span className="h">{g.feature.title}</span><span className="n">{g.feature.note}</span><span className="go">Open</span>
                          </Link>
                        ) : null}
                      </div>
                      <div className="mm-foot"><Link href={g.href}>All of {g.label}</Link></div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </nav>
          <div className="right">
            <Link className="btn ghost search" href="/search"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>Search</Link>
            <ThemeToggle />
            <Link className="btn gold" href="/on-point-polling/weighting-room">The Weighting Room</Link>
            <button type="button" className="btn burger" aria-expanded={open} aria-controls="opp-mnav" onClick={() => setOpen(true)}>Menu</button>
          </div>
        </div>
      </div>
      {open && (
        <div className="mnav" id="opp-mnav" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="mhead">
            <Link className="logo" href="/" aria-label="On Point Politics home"><Lockup height={36} /></Link>
            <button type="button" className="btn sm" onClick={() => setOpen(false)}>Close</button>
          </div>
          <nav aria-label="Menu" className="macc">
            {MENU.map((g) => g.cols.length ? (
              <div key={g.key} className={`macc-g${acc === g.key ? " open" : ""}`}>
                <button type="button" aria-expanded={acc === g.key} onClick={() => setAcc(acc === g.key ? null : g.key)}>{g.label}<Caret /></button>
                {acc === g.key ? (
                  <div className="macc-b">
                    <Link href={g.href} className="all">All of {g.label}</Link>
                    {g.cols.map((c) => (
                      <div key={c.h}><h3>{c.h}</h3>{c.links.map((l) => <Link key={l.href + l.label} href={l.href}>{l.label}</Link>)}</div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : <Link key={g.key} href={g.href} className="macc-l">{g.label}</Link>)}
            <Link href="/search" className="macc-l">Search</Link>
          </nav>
          <div className="mfoot">
            <Link className="btn gold" href="/on-point-polling/weighting-room">The Weighting Room</Link>
            <Link className="btn" href="/contact">Contact</Link>
            <ThemeToggle className="btn" />
          </div>
        </div>
      )}
    </header>
  );
}
