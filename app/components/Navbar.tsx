"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/",                label: "Home" },
  { href: "/polling",         label: "Polling" },
  { href: "/results",         label: "Results" },
  { href: "/electoralmap",    label: "Electoral Map" },
  { href: "/goldstandard",    label: "Gold Standard" },
  { href: "/contact",         label: "Contact" },
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
        .nb-root {
          position: sticky;
          top: 0;
          z-index: 200;
          background: #070709;
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }

        /* Top utility bar — full-width bg, centered content */
        .nb-topbar-wrap {
          background: #0b0b0f;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        .nb-topbar {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 32px;
          gap: 24px;
        }

        .nb-date {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          letter-spacing: 0.14em;
          color: rgba(255,255,255,0.25);
          text-transform: uppercase;
          flex-shrink: 0;
        }

        /* Latest ticker items inline */
        .nb-latest-row {
          display: flex;
          align-items: center;
          gap: 0;
          flex: 1;
          overflow: hidden;
        }

        .nb-latest-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: #7c3aed;
          flex-shrink: 0;
          padding-right: 16px;
          margin-right: 16px;
          border-right: 1px solid rgba(124,58,237,0.25);
        }

        .nb-latest-items {
          display: flex;
          align-items: center;
          gap: 0;
          overflow: hidden;
        }

        .nb-latest-item {
          display: flex;
          align-items: center;
          gap: 7px;
          white-space: nowrap;
          padding-right: 20px;
          margin-right: 20px;
          border-right: 1px solid rgba(255,255,255,0.07);
        }
        .nb-latest-item:last-child { border-right: none; padding-right: 0; margin-right: 0; }

        .nb-latest-name {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.06em;
        }
        .nb-latest-dem {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          color: #3b82f6;
          letter-spacing: 0.04em;
        }
        .nb-latest-sep {
          font-size: 9px;
          color: rgba(255,255,255,0.15);
        }
        .nb-latest-rep {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          color: #e63946;
          letter-spacing: 0.04em;
        }
        .nb-latest-bar {
          width: 32px;
          height: 2px;
          overflow: hidden;
          background: rgba(255,255,255,0.08);
          display: inline-flex;
          flex-shrink: 0;
        }
        .nb-latest-bar-dem { background: #3b82f6; height: 100%; }
        .nb-latest-bar-rep { background: #e63946; height: 100%; }

        .nb-live-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 2px 8px;
          background: rgba(124,58,237,0.1);
          border: 1px solid rgba(124,58,237,0.3);
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.14em;
          color: #9d5cf0;
          text-transform: uppercase;
          flex-shrink: 0;
        }
        .nb-live-dot {
          width: 4px; height: 4px;
          border-radius: 50%;
          background: #9d5cf0;
          animation: nb-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes nb-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }

        /* Main masthead row */
        .nb-masthead {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          height: 60px;
          display: flex;
          align-items: center;
          gap: 0;
        }

        .nb-logo {
          display: flex;
          flex-direction: row;
          align-items: center;
          text-decoration: none;
          flex-shrink: 0;
          margin-right: 36px;
          padding-right: 36px;
          border-right: 1px solid rgba(255,255,255,0.08);
          gap: 12px;
        }
        .nb-logo:hover { text-decoration: none; opacity: 0.85; }

        .nb-logo-mark {
          font-family: var(--font-display), sans-serif;
          font-size: 32px;
          color: #fff;
          letter-spacing: 0.05em;
          line-height: 1;
          text-transform: uppercase;
        }

        .nb-logo-sub {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 400;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
          white-space: nowrap;
        }

        .nb-logo-wordmark {
          display: flex;
          flex-direction: column;
          gap: 1px;
          border-left: 1px solid rgba(255,255,255,0.1);
          padding-left: 12px;
        }

        .nb-logo-wordmark span {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          line-height: 1.6;
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
          padding: 0 13px;
          font-family: var(--font-body), monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          position: relative;
          top: 1px;
          transition: color 120ms ease, border-color 120ms ease;
          padding-bottom: 0;
          margin-bottom: 12px;
          align-self: flex-end;
        }
        .nb-link:hover { color: rgba(255,255,255,0.85); text-decoration: none; }
        .nb-link.nb-active {
          color: #fff;
          border-bottom-color: #7c3aed;
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
          padding: 6px 14px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.4);
          color: #9d5cf0 !important;
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          cursor: pointer;
          transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
          white-space: nowrap;
        }
        .nb-cta:hover { border-color: rgba(124,58,237,0.7); background: rgba(124,58,237,0.22); color: #b97ef5 !important; text-decoration: none; }

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
          background: #0f0f15;
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
          font-family: var(--font-body), monospace;
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          transition: background 80ms, color 80ms;
        }
        .nb-mob-link:hover { background: rgba(255,255,255,0.04); color: #fff; text-decoration: none; }
        .nb-mob-link.nb-active { color: #7c3aed; }

        .nb-mob-cta {
          padding: 16px 24px;
        }
        .nb-mob-cta a {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.4);
          color: #9d5cf0;
          font-family: var(--font-body), monospace;
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 100ms;
        }
        .nb-mob-cta a:hover { background: rgba(124,58,237,0.25); }

        @media (max-width: 900px) {
          .nb-topbar-wrap { display: none; }
          .nb-links, .nb-right { display: none; }
          .nb-ham { display: flex; }
          .nb-mobile { display: flex; }
          .nb-masthead { padding: 0 20px; }
          .nb-logo { margin-right: 0; border-right: none; padding-right: 0; }
        }
      `}</style>

      <header className="nb-root">
        {/* Top utility bar */}
        <div className="nb-topbar-wrap">
          <div className="nb-topbar">
            <span className="nb-date">
              {new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" })}
            </span>
            <div className="nb-latest-row">
              <span className="nb-latest-label">Latest</span>
              <div className="nb-latest-items">
                {TICKER.map(item => {
                  const demPct = (item.dem / (item.dem + item.rep)) * 100;
                  return (
                    <span key={item.label} className="nb-latest-item">
                      <span className="nb-latest-name">{item.label}</span>
                      <span className="nb-latest-dem">{item.dem}%</span>
                      <span className="nb-latest-sep">·</span>
                      <span className="nb-latest-rep">{item.rep}%</span>
                      <span className="nb-latest-bar">
                        <span className="nb-latest-bar-dem" style={{ width: `${demPct}%` }} />
                        <span className="nb-latest-bar-rep" style={{ flex: 1 }} />
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
            <span className="nb-live-pill">
              <span className="nb-live-dot" />
              Live Data
            </span>
          </div>
        </div>

        {/* Masthead */}
        <div className="nb-masthead">
          <Link href="/" className="nb-logo">
            <div
              aria-label="The Public Sentiment Institute"
              style={{
                height: 36,
                width: 142,
                flexShrink: 0,
                background: "linear-gradient(100deg, #ff4d5a 0%, #a78bfa 50%, #3b82f6 100%)",
                WebkitMaskImage: "url(/full_logo_clean.png)",
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "left center",
                maskImage: "url(/full_logo_clean.png)",
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "left center",
              }}
            />
            <div className="nb-logo-wordmark">
              <span>The Public</span>
              <span>Sentiment</span>
              <span>Institute</span>
            </div>
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