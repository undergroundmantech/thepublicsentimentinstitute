"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SHOW_SITUATION_ROOM } from "@/app/lib/flags";
import ThemeToggle from "./ThemeToggle";

// Mirror of the global Navbar's destinations, rendered for dark/full-bleed pages.
const RESULTS_LIVE = true;
type Child = { href: string; label: string };
type Item = { href?: string; label: string; emphasize?: boolean; children?: Child[] };
const NAV: Item[] = [
  { href: "/", label: "Home" },
  ...(SHOW_SITUATION_ROOM ? [{ href: "/situationroom", label: "Situation Room", emphasize: RESULTS_LIVE }] : []),
  { href: "/results", label: "Election Results" },
  { href: "/polling/genericballot", label: "Polling Averages" },
  { href: "/tpsipoll", label: "TPSI Poll" },
  {
    label: "Maps & Ratings",
    children: [
      { href: "/electoralmap", label: "Electoral Map" },
      { href: "/voterregistration", label: "Voter Registration" },
      { href: "/forecastratings", label: "2026 Ratings" },
    ],
  },
  { href: "/contact", label: "Contact" },
];

export default function DarkNav() {
  const pathname = usePathname();
  const [drop, setDrop] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // the takeover owns the scroll + Escape while open
  useEffect(() => {
    if (!mobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setMobile(false); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [mobile]);
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  const flat: (Child & { emphasize?: boolean })[] = NAV.flatMap((it) =>
    it.children ? it.children : [{ href: it.href!, label: it.label, emphasize: it.emphasize }]
  );

  return (
    <nav className="dn" aria-label="Primary">
      <style>{CSS}</style>

      <Link href="/" className="dn-logo" aria-label="The Public Sentiment Institute">
        <span className="dn-logo-img" aria-hidden />
      </Link>

      <div className="dn-links">
        {NAV.map((it) =>
          it.children ? (
            <div key={it.label} className="dn-item" onMouseEnter={() => setDrop(true)} onMouseLeave={() => setDrop(false)}>
              <button type="button" className={`dn-link${it.children.some((c) => isActive(c.href)) ? " on" : ""}`}>
                {it.label} <span className="dn-caret" aria-hidden>▾</span>
              </button>
              <div className={`dn-drop${drop ? " open" : ""}`}>
                {it.children.map((c) => (
                  <Link key={c.href} href={c.href} className="dn-drop-link">{c.label}</Link>
                ))}
              </div>
            </div>
          ) : (
            <Link key={it.href} href={it.href!} className={`dn-link${isActive(it.href!) ? " on" : ""}`}>
              {it.emphasize && <span className="dn-live" aria-hidden />}
              {it.label}
            </Link>
          )
        )}
      </div>

      <div className="dn-right">
        <span className="dn-toggle-wrap"><ThemeToggle /></span>
        <Link href="/tpsipoll" className="dn-cta">Take the survey →</Link>
        <button type="button" className={`dn-burger${mobile ? " open" : ""}`} aria-label="Menu" aria-expanded={mobile} onClick={() => setMobile((m) => !m)}>
          <span /><span /><span />
        </button>
      </div>

      {mounted && createPortal(
        <div className={`dnm${mobile ? " open" : ""}`} aria-hidden={!mobile}>
          <div className="dnm-top">
            <span className="dnm-brand">the public sentiment institute</span>
            <button type="button" className="dnm-x" aria-label="Close menu" onClick={() => setMobile(false)}>
              <span /><span />
            </button>
          </div>
          <nav className="dnm-links" aria-label="Menu">
            {flat.map((c, i) => (
              <Link
                key={c.href}
                href={c.href}
                className={`dnm-link${isActive(c.href) ? " on" : ""}`}
                style={{ transitionDelay: mobile ? `${90 + i * 45}ms` : "0ms" }}
                onClick={() => setMobile(false)}
              >
                <span className="dnm-idx" aria-hidden>{String(i + 1).padStart(2, "0")}</span>
                <span className="dnm-word">{c.label}</span>
                {c.emphasize && <span className="dnm-live" aria-hidden />}
                {isActive(c.href) && <span className="dnm-here" aria-hidden>you are here</span>}
              </Link>
            ))}
          </nav>
          <div className="dnm-foot" style={{ transitionDelay: mobile ? `${90 + flat.length * 45}ms` : "0ms" }}>
            <Link href="/tpsipoll" className="dnm-cta" onClick={() => setMobile(false)}>Take the survey <span aria-hidden>→</span></Link>
            <ThemeToggle />
            <span className="dnm-meta">independent polling &amp; election analysis</span>
          </div>
        </div>,
        document.body
      )}
    </nav>
  );
}

const CSS = `
  .dn {
    position: relative; display: flex; align-items: center; gap: 18px; padding: 22px 0 30px;
    font-family: var(--font-body); letter-spacing: -0.01em;
  }
  .dn a, .dn button { font-family: inherit; }
  .dn-logo { display: inline-flex; align-items: center; flex-shrink: 0; text-decoration: none; }
  .dn-logo-img {
    display: block; width: 132px; height: 30px; background: var(--foreground);
    -webkit-mask: url(/tpsi-logo.svg) left center / contain no-repeat;
    mask: url(/tpsi-logo.svg) left center / contain no-repeat;
    transition: opacity .2s ease;
  }
  .dn-logo:hover .dn-logo-img { opacity: 0.82; }

  .dn-links { display: flex; align-items: center; gap: 24px; margin-left: 12px; }
  .dn-item { position: relative; }
  .dn-link {
    position: relative; display: inline-flex; align-items: center; gap: 6px; padding: 5px 0;
    background: none; border: 0; cursor: pointer; text-decoration: none;
    font-size: 14.5px; font-weight: 560; letter-spacing: -0.01em; color: var(--muted);
    transition: color .18s ease; white-space: nowrap;
  }
  .dn-link:hover, .dn-link.on { color: var(--foreground); }
  .dn-link::after {
    content: ''; position: absolute; left: 0; right: 0; bottom: -2px; height: 1.5px; background: var(--live);
    transform: scaleX(0); transform-origin: left center; transition: transform .26s cubic-bezier(.2,.8,.2,1);
  }
  .dn-link:hover::after, .dn-link.on::after { transform: scaleX(1); }
  .dn-caret { font-size: 9px; opacity: 0.55; }
  .dn-live { width: 6px; height: 6px; border-radius: 50%; background: var(--live); box-shadow: 0 0 8px rgba(13,148,136,0.6); animation: dn-pulse 1.8s ease-in-out infinite; }
  @keyframes dn-pulse { 50% { opacity: 0.35; } }

  .dn-drop {
    position: absolute; top: calc(100% + 12px); left: -12px; min-width: 196px; padding: 8px;
    border-radius: 14px; border: 1px solid var(--border2); background: var(--panel);
    -webkit-backdrop-filter: blur(22px); backdrop-filter: blur(22px); box-shadow: var(--shadow-lg);
    opacity: 0; visibility: hidden; transform: translateY(-6px); z-index: 90;
    transition: opacity .2s ease, transform .2s ease, visibility 0s linear .2s;
  }
  .dn-drop.open { opacity: 1; visibility: visible; transform: translateY(0); transition: opacity .2s ease, transform .2s ease; }
  .dn-drop-link { display: block; padding: 10px 12px; border-radius: 9px; font-size: 14px; font-weight: 540; color: var(--foreground2); text-decoration: none; transition: background .15s ease, color .15s ease; }
  .dn-drop-link:hover { background: var(--panel2); color: var(--foreground); }

  .dn-right { margin-left: auto; display: flex; align-items: center; gap: 14px; }
  .dn-cta {
    padding: 9px 16px; border-radius: 999px; background: var(--foreground); color: var(--background) !important;
    font-family: var(--font-numeric); font-size: 12px; font-weight: 700; text-decoration: none; white-space: nowrap;
    transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease;
  }
  .dn-cta:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg); }

  .dn-burger { display: none; width: 44px; height: 44px; border: 1px solid var(--border3); border-radius: 999px; background: var(--panel2); -webkit-backdrop-filter: blur(10px); backdrop-filter: blur(10px); cursor: pointer; align-items: center; justify-content: center; flex-direction: column; gap: 4.5px; flex-shrink: 0; }
  .dn-burger span { display: block; width: 17px; height: 1.8px; border-radius: 2px; background: var(--foreground); transition: transform .26s cubic-bezier(.2,.8,.2,1), opacity .2s ease; }
  .dn-burger.open span:nth-child(1) { transform: translateY(5.6px) rotate(45deg); }
  .dn-burger.open span:nth-child(2) { opacity: 0; }
  .dn-burger.open span:nth-child(3) { transform: translateY(-5.6px) rotate(-45deg); }

  /* ── the takeover — fullscreen menu, portaled to <body> ── */
  .dnm {
    position: fixed; inset: 0; z-index: 999; display: flex; flex-direction: column;
    padding: 18px clamp(20px, 6vw, 40px) clamp(22px, 5vh, 40px);
    background: var(--background);
    -webkit-backdrop-filter: blur(20px); backdrop-filter: blur(20px);
    font-family: var(--font-body); letter-spacing: -0.01em;
    opacity: 0; visibility: hidden; transition: opacity .32s ease, visibility 0s linear .32s;
  }
  .dnm.open { opacity: 1; visibility: visible; transition: opacity .32s ease; }
  .dnm::before {
    content: ''; position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(70% 50% at 86% 8%, var(--purple-glow), transparent 70%),
                radial-gradient(60% 44% at 8% 96%, var(--blue-glow), transparent 72%);
  }
  .dnm-top {
    position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px;
    padding-bottom: 16px; border-bottom: 1px solid var(--border);
  }
  .dnm-brand { font-size: 10.5px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted2); }
  .dnm-x {
    position: relative; width: 44px; height: 44px; flex-shrink: 0; border: 1px solid var(--border3);
    border-radius: 999px; background: var(--panel2); cursor: pointer;
  }
  .dnm-x span { position: absolute; left: 50%; top: 50%; width: 17px; height: 1.8px; border-radius: 2px; background: var(--foreground); }
  .dnm-x span:first-child { transform: translate(-50%, -50%) rotate(45deg); }
  .dnm-x span:last-child { transform: translate(-50%, -50%) rotate(-45deg); }
  .dnm-links { position: relative; flex: 1; display: flex; flex-direction: column; justify-content: center; gap: 2px; min-height: 0; overflow-y: auto; padding: 18px 0; }
  .dnm-link {
    position: relative; display: flex; align-items: baseline; gap: 16px; padding: 7px 0;
    text-decoration: none; opacity: 0; transform: translateY(22px);
    transition: opacity .4s ease, transform .5s cubic-bezier(.16,1,.3,1);
  }
  .dnm.open .dnm-link { opacity: 1; transform: none; }
  .dnm-idx { font-size: 11px; font-weight: 700; letter-spacing: 0.14em; color: var(--muted3); font-variant-numeric: tabular-nums; min-width: 22px; }
  .dnm-word {
    font-size: clamp(30px, 7.4vw, 44px); font-weight: 500; letter-spacing: -0.03em; line-height: 1.08;
    text-transform: lowercase; color: var(--muted); transition: color .18s ease;
  }
  .dnm-link:hover .dnm-word, .dnm-link.on .dnm-word { color: var(--foreground); }
  .dnm-link.on .dnm-idx { color: var(--purple); }
  .dnm-live { width: 8px; height: 8px; border-radius: 50%; background: var(--live); box-shadow: 0 0 10px rgba(13,148,136,0.6); align-self: center; animation: dnm-pulse 2s ease-in-out infinite; }
  @keyframes dnm-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  .dnm-here { font-size: 9.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--purple); }
  .dnm-foot {
    position: relative; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
    padding-top: 18px; border-top: 1px solid var(--border);
    opacity: 0; transform: translateY(14px); transition: opacity .4s ease, transform .5s cubic-bezier(.16,1,.3,1);
  }
  .dnm.open .dnm-foot { opacity: 1; transform: none; }
  .dnm-cta {
    display: inline-flex; align-items: center; gap: 10px; padding: 13px 22px; border-radius: 999px;
    background: var(--foreground); color: var(--background) !important; font-family: var(--font-numeric); font-size: 13px; font-weight: 700; text-decoration: none;
  }
  .dnm-meta { font-size: 10px; font-weight: 650; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted3); }
  @media (prefers-reduced-motion: reduce) { .dnm, .dnm-link, .dnm-foot { transition: none !important; } }

  @media (max-width: 1180px) {
    .dn-links { gap: 16px; }
    .dn-link { font-size: 13.5px; }
    .dn-cta { padding: 8px 14px; font-size: 13px; }
  }
  @media (max-width: 1024px) {
    .dn-links { gap: 13px; }
    .dn-link { font-size: 12.8px; }
  }
  @media (max-width: 900px) {
    .dn { padding: 16px 0 18px; }
    .dn-links { display: none; }
    .dn-burger { display: inline-flex; }
    .dn-toggle-wrap { display: none; }
  }
  @media (max-width: 560px) { .dn-cta { display: none; } }
  @media (prefers-reduced-motion: reduce) { .dn * { transition: none !important; } }
`;
