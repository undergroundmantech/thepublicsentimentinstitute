"use client";

import Link from "@/app/components/Link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Lockup } from "./opp/Logo";
import ThemeToggle from "./ThemeToggle";
import LangPicker from "./LangPicker";
import { MENU, type NavGroup } from "./navMenu";
import { createPortal } from "react-dom";
import MonitorSplash from "@/app/results/monitor/MonitorSplash";

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
  // Entering the Situation Monitor from any link on any page: its opening screen goes up at the click and the menu
  // closes, so nothing half-open is left on screen while the route changes. The monitor then keeps the same screen up
  // until it is ready. A modified click (new tab) is left alone; the screen never outlives eight seconds.
  const [enterFrom, setEnterFrom] = useState<string | null>(null);
  const entering = enterFrom != null && enterFrom === pathname;
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const held = (e.target as Element | null)?.closest?.("a[data-held]") as HTMLAnchorElement | null;
      if (held) { delete held.dataset.held; return; }
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.target === "_blank" || a.origin !== window.location.origin || a.pathname !== "/results/monitor" || window.location.pathname === "/results/monitor") return;
      setMenu(null); setOpen(false); setEnterFrom(window.location.pathname);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);
  useEffect(() => { if (!entering) return; const t = window.setTimeout(() => setEnterFrom(null), 8000); return () => window.clearTimeout(t); }, [entering]);
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
    // (the phone tab bar can ask for a section to be open: holding its Results tab opens the menu at Results)
    const openMenu = (e: Event) => { head.current?.classList.remove("hide"); setOpen(true); const k = (e as CustomEvent<{ section?: string }>).detail?.section; if (k) setAcc(k); };
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
    if (g.key === "opp") return under("/on-point-polling") || under("/portal") || pathname === "/contact" || under("/accuracy") || under("/most-accurate-pollster");
    if (g.key === "f28") return under("/2028") || under("/2028-presidential-candidates");
    if (g.key === "play") return under("/play");
    if (g.key === "forecast") return under("/forecast") || under("/what-if") || under("/swingometer") || under("/2027");
    if (g.key === "polls") return under("/polls");
    if (g.key === "results") return under("/results");
    if (g.more) return g.cols.some((c) => c.href && under(c.href.split("/").slice(0, 2).join("/"))) || under("/accountability");
    return under(g.href);
  };
  // How a tab answers (patch 5): a click or a tap goes straight to its page and closes every panel; hovering with a
  // mouse, holding a finger on it for half a second, the caret, or the keyboard opens its panel. After a click the
  // tab does not reopen its panel from the pointer that is still over it, or from the focus the click left on it,
  // until the pointer has left the tab.
  const hush = useRef<string | null>(null);
  const press = useRef<{ t: number | null; held: boolean }>({ t: null, held: false });
  const enter = (k: string) => { if (hush.current === k) return; if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(k), 80); };
  const leave = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setMenu(null), 200); };
  const go = (k: string) => { if (timer.current) window.clearTimeout(timer.current); hush.current = k; setMenu(null); };
  const holdStart = (k: string, e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    press.current.held = false; if (press.current.t) window.clearTimeout(press.current.t);
    press.current.t = window.setTimeout(() => { press.current.held = true; hush.current = null; setMenu(k); navigator.vibrate?.(10); }, 450);
  };
  const holdEnd = () => { if (press.current.t) window.clearTimeout(press.current.t); press.current.t = null; };
  /** a tap that ended a hold opens the panel only; any other click goes to the page */
  // (the anchor carries data-held for the one click that ends a hold, so the page-wide handler above does not take it
  // for a navigation; the phone tab bar marks its own the same way)
  const tabClick = (k: string, e: React.MouseEvent<HTMLAnchorElement>) => { if (press.current.held) { e.preventDefault(); press.current.held = false; e.currentTarget.dataset.held = "1"; return; } go(k); };
  const cur = (href: string) => (pathname === href && !href.includes("#") ? "page" : undefined);

  return (
    <header className="opp opp-top" ref={head}>
      {entering ? createPortal(<MonitorSplash fixed />, document.body) : null}
      <div className="top" ref={bar}>
        <div className="wrap">
          <Link className="logo notranslate" translate="no" href="/" aria-label="On Point Politics home"><Lockup height={38} /></Link>
          <nav className="nav tabs5" aria-label="Primary">
            {MENU.map((g) => {
              const on = inGroup(g), op = menu === g.key;
              return (
                <div key={g.key} className={`t5-i${op ? " open" : ""}${on ? " on" : ""}`}
                  onPointerEnter={(e) => { if (e.pointerType === "mouse") enter(g.key); }}
                  onPointerLeave={(e) => { if (e.pointerType === "mouse") { if (hush.current === g.key) hush.current = null; leave(); } }}>
                  {g.more ? (
                    <button type="button" className="t5-t" aria-expanded={op} aria-controls={`t5-${g.key}`} onClick={() => setMenu(op ? null : g.key)}>{g.label}<Caret /></button>
                  ) : (
                    <span className="t5-t">
                      <Link href={g.href} className="t5-l" aria-current={on ? "page" : undefined}
                        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) enter(g.key); }}
                        onClick={(e) => tabClick(g.key, e)} onPointerDown={(e) => holdStart(g.key, e)} onPointerUp={holdEnd} onPointerCancel={holdEnd}
                        onContextMenu={(e) => { if (press.current.held || press.current.t) e.preventDefault(); }}>
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
                              {c.href ? <Link href={c.href} className="t5-h" onClick={() => go(g.key)}>{c.h}<Caret /></Link> : <p className="t5-h">{c.h}</p>}
                              <ul>{c.links.map((l) => (
                                <li key={l.href + l.label}><Link href={l.href} aria-current={cur(l.href)} onClick={() => go(g.key)}>
                                  <span className="t">{l.label}{l.badge ? <em>{l.badge}</em> : null}</span>{l.note ? <span className="n">{l.note}</span> : null}
                                </Link></li>
                              ))}</ul>
                            </div>
                          ))}
                        </div>
                        {g.feature ? (
                          <Link className="t5-feat" href={g.feature.href} onClick={() => go(g.key)}>
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
              ? g.cols.map((c) => ({ key: `${g.key}-${c.h}`, label: c.h, href: c.href ?? g.href, cols: [{ h: "", links: c.links }], page: false }))
              : [{ key: g.key, label: g.label, href: g.href, cols: g.cols, page: true }]
            ).map((g) => (
              <div key={g.key} className={`macc-g${acc === g.key ? " open" : ""}`}>
                {g.page ? (
                  // a section with its own page: tapping its name goes there; the caret, or holding the name, opens its list
                  <div className="macc-row">
                    <Link href={g.href} className="macc-go" onClick={(e) => { if (press.current.held) { e.preventDefault(); press.current.held = false; e.currentTarget.dataset.held = "1"; } }}
                      onPointerDown={(e) => { if (e.pointerType === "mouse") return; press.current.held = false; if (press.current.t) window.clearTimeout(press.current.t); press.current.t = window.setTimeout(() => { press.current.held = true; setAcc(g.key); navigator.vibrate?.(10); }, 450); }}
                      onPointerUp={holdEnd} onPointerCancel={holdEnd} onContextMenu={(e) => { if (press.current.held || press.current.t) e.preventDefault(); }}>{g.label}</Link>
                    <button type="button" className="macc-x" aria-label={`${g.label}: more pages`} aria-expanded={acc === g.key} onClick={() => setAcc(acc === g.key ? null : g.key)}><Caret /></button>
                  </div>
                ) : <button type="button" aria-expanded={acc === g.key} onClick={() => setAcc(acc === g.key ? null : g.key)}>{g.label}<Caret /></button>}
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
