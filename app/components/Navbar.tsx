"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/",                label: "Home" },
  { href: "/polling",         label: "Polling" },
  { href: "/results",         label: "Results" },
  { href: "/electoralmap",    label: "Electoral Map" },
  { href: "/contact",         label: "Contact" },
  { href: "/SMSOptIn",         label: "SMS Opt-In" },
  { href: "/TermsAndConditions",         label: "Terms & Conditions" },
];

const TICKER = [
  { label: "Trump Approval", dem: 43, rep: 55 },
  { label: "Generic Ballot", dem: 47, rep: 42 },
  { label: "Right Track",    dem: 37, rep: 54 },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');

        .nb-root {
          position: sticky;
          top: 0;
          z-index: 200;
          background: #0a0a08;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        /* Top utility bar */
        .nb-topbar {
          background: #0a0a08;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 32px;
          max-width: 1280px;
          margin: 0 auto;
        }

        .nb-date {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
        }

        .nb-edition {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .nb-edition-text {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          letter-spacing: 0.1em;
          color: rgba(255,255,255,0.3);
          text-transform: uppercase;
        }

        .nb-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          background: rgba(192,57,43,0.15);
          border: 1px solid rgba(192,57,43,0.4);
          border-radius: 2px;
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.14em;
          color: #e05a4a;
          text-transform: uppercase;
        }

        .nb-live-dot {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #e05a4a;
          animation: nb-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes nb-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

        /* Main masthead row */
        .nb-masthead {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          height: 64px;
          display: flex;
          align-items: center;
          gap: 0;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        .nb-logo {
          display: flex;
          flex-direction: column;
          text-decoration: none;
          flex-shrink: 0;
          margin-right: 40px;
          padding-right: 40px;
          border-right: 1px solid rgba(255,255,255,0.1);
          line-height: 1;
          gap: 2px;
        }
        .nb-logo:hover { text-decoration: none; opacity: 0.85; }

        .nb-logo-mark {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 36px;
          color: #fff;
          letter-spacing: 0.05em;
          line-height: 1;
        }

        .nb-logo-sub {
          font-family: 'DM Mono', monospace;
          font-size: 8px;
          font-weight: 400;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          white-space: nowrap;
        }

        /* Nav links */
        .nb-links {
          display: flex;
          align-items: stretch;
          height: 100%;
          flex: 1;
          gap: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .nb-links::-webkit-scrollbar { display: none; }

        .nb-link {
          display: inline-flex;
          align-items: center;
          padding: 0 14px;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 400;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          position: relative;
          top: 1px;
          transition: color 120ms ease, border-color 120ms ease;
        }
        .nb-link:hover { color: rgba(255,255,255,0.85); text-decoration: none; }
        .nb-link.nb-active {
          color: #fff;
          border-bottom-color: #c5a55a;
        }

        /* Right side */
        .nb-right {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-shrink: 0;
          margin-left: 20px;
          padding-left: 20px;
          border-left: 1px solid rgba(255,255,255,0.1);
        }

        .nb-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 16px;
          background: #c5a55a;
          color: #0a0a08 !important;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          border: none;
          cursor: pointer;
          transition: background 120ms ease, transform 80ms ease;
          white-space: nowrap;
        }
        .nb-cta:hover { background: #d4b46a; text-decoration: none; transform: translateY(-1px); }
        .nb-cta:active { transform: translateY(0); }

        /* Ticker */
        .nb-ticker {
          background: #111110;
          padding: 0 32px;
          display: flex;
          align-items: center;
          height: 34px;
          gap: 0;
          overflow: hidden;
          position: relative;
        }

        .nb-ticker::after {
          content: '';
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 60px;
          background: linear-gradient(to right, transparent, #111110);
          pointer-events: none;
        }

        .nb-ticker-label {
          font-family: 'DM Mono', monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: #c5a55a;
          flex-shrink: 0;
          padding-right: 20px;
          margin-right: 20px;
          border-right: 1px solid rgba(255,255,255,0.1);
        }

        .nb-ticker-scroll {
          display: flex;
          align-items: center;
          gap: 0;
          overflow: hidden;
        }

        .nb-ticker-item {
          display: flex;
          align-items: center;
          gap: 8px;
          white-space: nowrap;
          padding: 0 24px 0 0;
          margin-right: 24px;
          border-right: 1px solid rgba(255,255,255,0.08);
        }
        .nb-ticker-item:last-child { border-right: none; }

        .nb-ticker-name {
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.4);
          letter-spacing: 0.06em;
        }
        .nb-ticker-dem {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #5b8fd4;
          letter-spacing: 0.04em;
        }
        .nb-ticker-sep {
          font-size: 10px;
          color: rgba(255,255,255,0.2);
        }
        .nb-ticker-rep {
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          font-weight: 500;
          color: #d45b5b;
          letter-spacing: 0.04em;
        }

        /* Mini split bar in ticker */
        .nb-ticker-bar {
          width: 40px;
          height: 3px;
          border-radius: 1px;
          overflow: hidden;
          background: rgba(255,255,255,0.1);
          display: inline-flex;
          flex-shrink: 0;
        }
        .nb-ticker-bar-dem { background: #5b8fd4; height: 100%; }
        .nb-ticker-bar-rep { background: #d45b5b; height: 100%; }

        /* Hamburger */
        .nb-ham {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 6px;
          margin-left: auto;
        }
        .nb-ham span {
          display: block;
          width: 22px; height: 1.5px;
          background: rgba(255,255,255,0.6);
          border-radius: 1px;
          transition: all 200ms ease;
        }
        .nb-ham.open span:nth-child(1) { transform: translateY(6.5px) rotate(45deg); }
        .nb-ham.open span:nth-child(2) { opacity: 0; }
        .nb-ham.open span:nth-child(3) { transform: translateY(-6.5px) rotate(-45deg); }

        /* Mobile menu */
        .nb-mobile {
          display: none;
          flex-direction: column;
          background: #0f0f0d;
          border-top: 1px solid rgba(255,255,255,0.08);
          max-height: 0;
          overflow: hidden;
          transition: max-height 300ms ease;
        }
        .nb-mobile.open { max-height: 600px; }

        .nb-mob-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          font-family: 'DM Mono', monospace;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 80ms, color 80ms;
        }
        .nb-mob-link:hover { background: rgba(255,255,255,0.04); color: #fff; text-decoration: none; }
        .nb-mob-link.nb-active { color: #c5a55a; }

        .nb-mob-cta {
          padding: 16px 24px;
        }
        .nb-mob-cta a {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          background: #c5a55a;
          color: #0a0a08;
          font-family: 'DM Mono', monospace;
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 100ms;
        }
        .nb-mob-cta a:hover { background: #d4b46a; }

        @media (max-width: 900px) {
          .nb-topbar { display: none; }
          .nb-links, .nb-right { display: none; }
          .nb-ham { display: flex; }
          .nb-mobile { display: flex; }
          .nb-ticker { display: none; }
          .nb-masthead { padding: 0 20px; }
          .nb-logo { margin-right: 0; border-right: none; padding-right: 0; }
        }
      `}</style>

      <header className="nb-root">
        {/* Top utility bar */}
        <div className="nb-topbar">
          <span className="nb-date">
            {new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
          </span>
          <div className="nb-edition">
            <span className="nb-edition-text">National Edition</span>
            <span className="nb-live-pill">
              <span className="nb-live-dot" />
              Live Data
            </span>
          </div>
        </div>

        {/* Masthead */}
        <div className="nb-masthead">
          <Link href="/" className="nb-logo">
            <span className="nb-logo-mark">PSI</span>
            <span className="nb-logo-sub">Public Sentiment Institute</span>
          </Link>

          <nav className="nb-links" aria-label="Main navigation">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nb-link${isActive(item.href) ? " nb-active" : ""}`}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="nb-right">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              className="nb-cta"
              target="_blank" rel="noopener noreferrer"
            >
              Take Survey →
            </Link>
          </div>

          <button
            className={`nb-ham${open ? " open" : ""}`}
            onClick={() => setOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>
        </div>

        {/* Ticker */}
        <div className="nb-ticker" aria-label="Latest polling snapshot">
          <span className="nb-ticker-label">Latest</span>
          <div className="nb-ticker-scroll">
            {TICKER.map((item, i) => {
              const demPct = (item.dem / (item.dem + item.rep)) * 100;
              return (
                <span key={item.label} className="nb-ticker-item">
                  <span className="nb-ticker-name">{item.label}</span>
                  <span className="nb-ticker-dem">{item.dem}%</span>
                  <span className="nb-ticker-sep">·</span>
                  <span className="nb-ticker-rep">{item.rep}%</span>
                  <span className="nb-ticker-bar">
                    <span className="nb-ticker-bar-dem" style={{ width: `${demPct}%` }} />
                    <span className="nb-ticker-bar-rep" style={{ flex: 1 }} />
                  </span>
                </span>
              );
            })}
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`nb-mobile${open ? " open" : ""}`} aria-hidden={!open}>
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`nb-mob-link${isActive(item.href) ? " nb-active" : ""}`}
              onClick={() => setOpen(false)}
            >
              {item.label}
              <span style={{ opacity: 0.3, fontSize: 14 }}>›</span>
            </Link>
          ))}
          <div className="nb-mob-cta">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              onClick={() => setOpen(false)}
              target="_blank" rel="noopener noreferrer"
            >
              Take the Survey →
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}