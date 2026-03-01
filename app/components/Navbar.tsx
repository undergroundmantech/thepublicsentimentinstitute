"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

const nav = [
  { href: "/", label: "Home" },
  { href: "/electoralmap", label: "Electoral Map" },
  { href: "/results", label: "Election Results" },
  { href: "/polling", label: "Polling Averages" },
  { href: "/goldstandard", label: "Gold Standard Pollsters" },
  { href: "/contact", label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const activeLabel = useMemo(() => {
    const found =
      nav.find((n) =>
        n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)
      ) ?? nav[0];
    return found?.label ?? "Menu";
  }, [pathname]);

  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const timeStr = new Date(nowMs).toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <>
      <style>{`
        :root {
          --background:  #070709;
          --background2: #0b0b0f;
          --panel:       #0f0f15;
          --foreground:  #f0f0f5;
          --muted:       rgba(240,240,245,0.62);
          --muted2:      rgba(240,240,245,0.40);
          --muted3:      rgba(240,240,245,0.22);
          --border:      rgba(255,255,255,0.09);
          --border2:     rgba(255,255,255,0.15);
          --purple:      #7c3aed;
          --purple2:     #9d5cf0;
          --purple-soft: #a78bfa;
          --red:         #e63946;
          --red2:        #ff4d5a;
          --blue:        #2563eb;
          --blue2:       #3b82f6;
          --trk-2:       0.12em;
          --trk-3:       0.22em;
          --dur-1:       140ms;
          --dur-2:       220ms;
          --ease-out:    cubic-bezier(0.22,1,0.36,1);
        }

        /* ── Tri-color top stripe ── */
        .nav-stripe {
          height: 3px;
          background: linear-gradient(
            90deg,
            var(--red)    0%,
            var(--red)    33.33%,
            var(--purple) 33.33%,
            var(--purple) 66.66%,
            var(--blue)   66.66%,
            var(--blue)   100%
          );
        }

        /* ── Ticker row ── */
        .nav-ticker {
          background: var(--background2);
          border-bottom: 1px solid var(--border);
          padding: 6px 0;
        }
        .nav-ticker-inner {
          max-width: 1152px;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .nav-ticker-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: var(--trk-3);
          text-transform: uppercase;
          color: rgba(255,255,255,0.35);
        }
        .live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--red);
          box-shadow: 0 0 8px rgba(230,57,70,0.75);
          animation: pulse-dot 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.4; transform:scale(0.85); }
        }
        .nav-ticker-live {
          color: var(--red);
          letter-spacing: var(--trk-3);
        }
        .nav-ticker-sep {
          color: rgba(255,255,255,0.12);
        }
        .nav-ticker-right {
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: var(--trk-3);
          color: rgba(255,255,255,0.20);
        }

        /* ── Main nav shell ── */
        .nav-main {
          background: var(--panel);
          border-bottom: 1px solid var(--border);
          position: sticky;
          top: 0;
          z-index: 50;
        }
        .nav-inner {
          max-width: 1152px;
          margin: 0 auto;
          padding: 0 1rem;
          display: flex;
          align-items: stretch;
          min-height: 54px;
        }

        /* ── Brand block ── */
        .nav-brand {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding-right: 20px;
          margin-right: 4px;
          border-right: 1px solid var(--border);
          text-decoration: none;
          flex-shrink: 0;
          gap: 1px;
        }
        .nav-brand:hover { opacity: 1; }
        .brand-primary {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 900;
          letter-spacing: 0.10em;
          text-transform: uppercase;
          color: #fff;
          line-height: 1;
        }
        .brand-primary span.brand-r { color: var(--red); }
        .brand-primary span.brand-b { color: var(--blue2); }
        .brand-sub {
          font-family: var(--font-display);
          font-size: 8.5px;
          font-weight: 500;
          letter-spacing: 0.38em;
          text-transform: uppercase;
          color: var(--purple-soft);
          line-height: 1;
          margin-top: 3px;
        }

        /* ── Desktop nav links ── */
        .nav-links {
          display: flex;
          align-items: stretch;
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .nav-links::-webkit-scrollbar { display: none; }

        .nav-link {
          display: inline-flex;
          align-items: center;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: var(--trk-2);
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          position: relative;
          border-right: 1px solid var(--border);
          transition:
            color var(--dur-1) var(--ease-out),
            background var(--dur-1) var(--ease-out);
          white-space: nowrap;
        }
        .nav-link::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 2px;
          background: var(--purple);
          transform: scaleX(0);
          transform-origin: left;
          transition: transform var(--dur-2) var(--ease-out);
        }
        .nav-link:hover {
          color: rgba(255,255,255,0.82);
          background: rgba(255,255,255,0.025);
        }
        .nav-link:hover::after { transform: scaleX(1); }
        .nav-link.active {
          color: #fff;
          background: rgba(124,58,237,0.10);
        }
        .nav-link.active::after { transform: scaleX(1); }

        /* ── CTA button ── */
        .nav-cta-wrap {
          display: flex;
          align-items: center;
          padding-left: 14px;
          flex-shrink: 0;
        }
        .nav-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          background: var(--purple);
          border: 1px solid rgba(124,58,237,0.65);
          color: #fff;
          font-family: var(--font-body);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: var(--trk-2);
          text-transform: uppercase;
          text-decoration: none;
          transition:
            background var(--dur-1) var(--ease-out),
            border-color var(--dur-1) var(--ease-out),
            transform var(--dur-1) var(--ease-out);
        }
        .nav-cta:hover {
          background: var(--purple2);
          border-color: rgba(157,92,240,0.8);
          opacity: 1;
          transform: translateY(-1px);
        }
        .nav-cta-arrow {
          font-size: 10px;
          opacity: 0.7;
        }

        /* ── Hamburger (mobile) ── */
        .nav-hamburger {
          display: none;
          flex-direction: column;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          padding: 8px;
          margin-left: auto;
          background: none;
          border: none;
        }
        .nav-hamburger span {
          display: block;
          width: 22px;
          height: 1.5px;
          background: rgba(255,255,255,0.5);
          transition: all var(--dur-2) var(--ease-out);
        }
        .nav-hamburger.open span:nth-child(1) {
          transform: translateY(6.5px) rotate(45deg);
          background: var(--purple-soft);
        }
        .nav-hamburger.open span:nth-child(2) {
          opacity: 0; transform: scaleX(0);
        }
        .nav-hamburger.open span:nth-child(3) {
          transform: translateY(-6.5px) rotate(-45deg);
          background: var(--purple-soft);
        }

        /* ── Mobile drawer ── */
        .nav-mobile {
          display: none;
          flex-direction: column;
          background: var(--background2);
          border-top: 1px solid var(--border);
          overflow: hidden;
          max-height: 0;
          transition: max-height 300ms var(--ease-out);
        }
        .nav-mobile.open {
          max-height: 500px;
        }
        .nav-mobile-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 24px;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: var(--trk-2);
          text-transform: uppercase;
          color: rgba(255,255,255,0.45);
          text-decoration: none;
          border-bottom: 1px solid var(--border);
          transition: all var(--dur-1) var(--ease-out);
        }
        .nav-mobile-link:hover,
        .nav-mobile-link.active {
          color: #fff;
          background: rgba(124,58,237,0.08);
          padding-left: 28px;
        }
        .nav-mobile-link.active { color: var(--purple-soft); }
        .nav-mobile-cta {
          margin: 14px 24px;
        }
        .nav-mobile-cta a {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px;
          background: var(--purple);
          border: 1px solid rgba(124,58,237,0.65);
          color: #fff;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: var(--trk-2);
          text-transform: uppercase;
          text-decoration: none;
        }

        /* ── Responsive breakpoint ── */
        @media (max-width: 768px) {
          .nav-links { display: none; }
          .nav-cta-wrap { display: none; }
          .nav-hamburger { display: flex; }
          .nav-mobile { display: flex; }
          .nav-brand { border-right: none; padding-right: 0; }
        }

        /* ── Stat chips (desktop only) ── */
        .nav-stat-chips {
          display: flex;
          align-items: center;
          gap: 1px;
          padding: 0 10px;
          border-right: 1px solid var(--border);
          flex-shrink: 0;
        }
        .stat-chip {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 4px 10px;
          gap: 2px;
        }
        .stat-chip-val {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 900;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .stat-chip-val.dem { color: var(--blue2); }
        .stat-chip-val.rep { color: var(--red); }
        .stat-chip-label {
          font-family: var(--font-body);
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
        }
        .stat-chip-divider {
          width: 1px;
          height: 24px;
          background: var(--border2);
          margin: 0 2px;
        }

        @media (max-width: 900px) {
          .nav-stat-chips { display: none; }
        }
      `}</style>

      <header className="nav-main">
        {/* Tri-color stripe */}
        <div className="nav-stripe" />

        {/* Main nav */}
        <div className="nav-inner">
          {/* Brand */}
          <Link href="/" className="nav-brand">
            <div className="brand-primary">
              <span className="brand-r">P</span>ublic{" "}
              <span className="brand-b">S</span>entiment
            </div>
            <div className="brand-sub">Institute</div>
          </Link>

          {/* Desktop links */}
          <nav className="nav-links">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={["nav-link", isActive(item.href) ? "active" : ""].join(" ")}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* CTA */}
          <div className="nav-cta-wrap">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              className="nav-cta"
            >
              Take Survey
              <span className="nav-cta-arrow">→</span>
            </Link>
          </div>

          {/* Hamburger */}
          <button
            className={["nav-hamburger", mobileOpen ? "open" : ""].join(" ")}
            onClick={() => setMobileOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        {/* Mobile drawer */}
        <div className={["nav-mobile", mobileOpen ? "open" : ""].join(" ")}>
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={["nav-mobile-link", isActive(item.href) ? "active" : ""].join(" ")}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
              <span style={{ opacity: 0.3, fontSize: "10px" }}>›</span>
            </Link>
          ))}
          <div className="nav-mobile-cta">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              onClick={() => setMobileOpen(false)}
            >
              Take Survey →
            </Link>
          </div>
        </div>
      </header>
    </>
  );
}
