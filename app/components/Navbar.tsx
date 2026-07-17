"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

// Flip to `true` on election night to light up Election Results with the purple glow.
const RESULTS_LIVE = true;

type NavChild = { href: string; label: string; desc?: string };
type NavItem = {
  href?: string;
  label: string;
  emphasize?: boolean;
  children?: NavChild[];
};

const NAV: NavItem[] = [
  { href: "/",         label: "Home" },
  { href: "/results",  label: "Election Results", emphasize: RESULTS_LIVE },
  { href: "/polling/genericballot", label: "Polling Averages" },
  { href: "/tpsipoll", label: "TPSI Poll" },
  {
    label: "Maps & Ratings",
    children: [
      { href: "/electoralmap",    label: "Electoral Map",     desc: "Interactive state map" },
      { href: "/forecastratings", label: "2026 Ratings",      desc: "Race ratings & competitiveness" },
      { href: "/partymap",        label: "Party Registration", desc: "Party of the rolls · state & county" },
    ],
  },
  { href: "/contact",  label: "Contact" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);
  const isGroupActive = (item: NavItem) =>
    !!item.children?.some(c => isActive(c.href));

  const openMenu = (label: string) => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setMenuOpen(label);
  };
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenuOpen(null), 140);
  };

  // close dropdown / mobile menu on route change
  useEffect(() => {
    setMenuOpen(null);
    setOpen(false);
  }, [pathname]);

  return (
    <>
      <style>{`
        .nb-root {
          position: sticky;
          top: 0;
          z-index: 200;
          background: color-mix(in srgb, var(--panel) 82%, transparent);
          backdrop-filter: saturate(140%) blur(18px);
          -webkit-backdrop-filter: saturate(140%) blur(18px);
        }
        .nb-root::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--brand-grad);
        }

        .nb-bar {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .nb-logo {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
          padding-right: 10px;
          border-right: 1px solid var(--border);
        }
        .nb-logo-img {
          height: 36px;
          width: 140px;
          flex-shrink: 0;
          background: var(--brand-grad);
          -webkit-mask-image: url(/tpsi-logo.svg);
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: left center;
          mask-image: url(/tpsi-logo.svg);
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: left center;
        }
        .nb-logo-sub {
          display: none;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted);
        }
        @media (min-width: 1100px) {
          .nb-logo-sub { display: block; max-width: 100px; line-height: 1.25; }
        }

        .nb-links {
          display: flex;
          align-items: center;
          gap: 2px;
          margin-left: auto;
          padding: 4px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: var(--r-pill);
          overflow: visible;
        }

        .nb-link {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: var(--r-pill);
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 500;
          color: var(--muted);
          text-decoration: none;
          white-space: nowrap;
          background: transparent;
          border: none;
          cursor: pointer;
          transition:
            color var(--dur-1) var(--ease-out),
            background var(--dur-1) var(--ease-out);
        }
        .nb-link:hover {
          color: var(--foreground);
          background: var(--panel2);
          text-decoration: none;
        }
        .nb-link.nb-active {
          color: var(--foreground);
          background: var(--panel);
          font-weight: 600;
          box-shadow: var(--shadow-sm);
        }
        .nb-link.nb-active:hover { background: var(--panel); color: var(--foreground); }

        .nb-caret {
          margin-left: 5px;
          width: 9px;
          height: 9px;
          opacity: 0.7;
          transition: transform var(--dur-1) var(--ease-out);
        }
        .nb-group.nb-open .nb-caret { transform: rotate(180deg); }

        .nb-link.nb-emphasize {
          margin-left: 6px;
          padding: 8px 12px 8px 10px;
          gap: 7px;
          background: transparent;
          color: var(--purple);
          box-shadow: none;
        }
        .nb-link.nb-emphasize::before {
          content: "";
          display: inline-block;
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--purple);
          box-shadow: 0 0 0 3px rgba(109, 62, 233, 0.22);
          animation: psi-pulse 2s infinite;
        }
        .nb-link.nb-emphasize:hover {
          color: var(--purple);
          background: var(--panel2);
        }
        .nb-link.nb-emphasize.nb-active {
          background: var(--panel);
          color: var(--purple);
          box-shadow: var(--shadow-sm);
        }
        .nb-link.nb-emphasize.nb-active:hover {
          background: var(--panel);
          color: var(--purple);
        }

        /* Dropdown */
        .nb-group { position: relative; }
        .nb-menu {
          position: absolute;
          top: calc(100% + 10px);
          left: 50%;
          transform: translateX(-50%) translateY(-4px);
          min-width: 260px;
          padding: 8px;
          background: var(--panel);
          backdrop-filter: blur(18px);
          -webkit-backdrop-filter: blur(18px);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          box-shadow: var(--shadow-lg);
          opacity: 0;
          pointer-events: none;
          transition: opacity var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
          z-index: 220;
        }
        .nb-group.nb-open .nb-menu {
          opacity: 1;
          transform: translateX(-50%) translateY(0);
          pointer-events: auto;
        }
        .nb-menu-item {
          display: block;
          padding: 10px 12px;
          border-radius: 10px;
          text-decoration: none;
          color: var(--foreground);
          transition: background var(--dur-1) var(--ease-out);
        }
        .nb-menu-item:hover { background: var(--panel2); text-decoration: none; }
        .nb-menu-item.nb-mi-active { background: var(--purple-dim); }
        .nb-mi-label {
          font-family: var(--font-body);
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground);
          line-height: 1.2;
        }
        .nb-menu-item.nb-mi-active .nb-mi-label { color: var(--purple); }
        .nb-mi-desc {
          margin-top: 2px;
          font-family: var(--font-body);
          font-size: 11px;
          font-weight: 400;
          color: var(--muted);
          line-height: 1.3;
        }

        .nb-right {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-shrink: 0;
        }

        .nb-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 9px 18px;
          border-radius: var(--r-pill);
          background: var(--gradient-purple);
          color: #fff !important;
          font-family: var(--font-numeric);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          box-shadow: var(--shadow-purple);
          transition: transform var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out);
        }
        .nb-cta:hover { background: var(--gradient-purple-soft); transform: translateY(-1px); text-decoration: none; color: #fff !important; box-shadow: 0 8px 22px rgba(109, 62, 233, 0.32); }

        .nb-ham {
          display: none;
          flex-direction: column;
          gap: 4px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          cursor: pointer;
          padding: 9px;
          margin-left: auto;
        }
        .nb-ham span {
          display: block;
          width: 18px; height: 1.6px;
          background: var(--foreground);
          border-radius: 2px;
          transition: all 200ms ease;
        }
        .nb-ham.open span:nth-child(1) { transform: translateY(5.5px) rotate(45deg); }
        .nb-ham.open span:nth-child(2) { opacity: 0; }
        .nb-ham.open span:nth-child(3) { transform: translateY(-5.6px) rotate(-45deg); }

        .nb-mobile {
          display: none;
          flex-direction: column;
          gap: 4px;
          padding: 0 16px;
          background: var(--panel);
          border-top: 1px solid var(--border);
          max-height: 0;
          overflow: hidden;
          transition: max-height 260ms ease, padding-top 260ms ease, padding-bottom 260ms ease;
        }
        .nb-mobile.open { max-height: 820px; padding-top: 12px; padding-bottom: 18px; }

        .nb-mob-link {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 14px;
          border-radius: var(--r-md);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 500;
          color: var(--muted);
          text-decoration: none;
          transition: background var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out);
        }
        .nb-mob-link:hover { background: var(--panel2); color: var(--foreground); text-decoration: none; }
        .nb-mob-link.nb-active { background: var(--panel2); color: var(--foreground); }

        .nb-mob-section {
          margin: 10px 0 2px;
          padding: 0 14px;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--muted2);
        }
        .nb-mob-sublink { padding-left: 26px; }

        .nb-mob-cta {
          margin-top: 10px;
          display: flex;
          padding: 0 2px;
        }
        .nb-mob-cta a {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 12px;
          border-radius: var(--r-pill);
          background: var(--gradient-purple);
          color: #fff;
          font-family: var(--font-numeric);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          box-shadow: var(--shadow-purple);
        }

        @media (max-width: 980px) {
          .nb-links, .nb-right { display: none; }
          .nb-ham { display: flex; }
          .nb-mobile { display: flex; }
          .nb-bar { padding: 12px 16px; }
        }

        :root[data-theme="dark"] .nb-root {
          background: rgba(10, 11, 20, 0.85);
        }
        :root[data-theme="dark"] .nb-links {
          background: var(--panel2);
          border-color: var(--border);
        }
      `}</style>

      <header className="nb-root">
        <div className="nb-bar">
          <Link href="/" className="nb-logo" aria-label="Public Sentiment Institute">
            <span className="nb-logo-img" aria-hidden />
            <span className="nb-logo-sub">Public Sentiment Institute</span>
          </Link>

          <nav className="nb-links" aria-label="Main navigation">
            {NAV.map(item => {
              if (item.children) {
                const groupActive = isGroupActive(item);
                const isOpen = menuOpen === item.label;
                return (
                  <div
                    key={item.label}
                    className={`nb-group${isOpen ? " nb-open" : ""}`}
                    onMouseEnter={() => openMenu(item.label)}
                    onMouseLeave={scheduleClose}
                  >
                    <button
                      type="button"
                      className={`nb-link${groupActive ? " nb-active" : ""}`}
                      aria-haspopup="menu"
                      aria-expanded={isOpen}
                      onClick={() => setMenuOpen(isOpen ? null : item.label)}
                    >
                      {item.label}
                      <svg className="nb-caret" viewBox="0 0 10 6" fill="none" aria-hidden>
                        <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <div className="nb-menu" role="menu">
                      {item.children.map(c => (
                        <Link
                          key={c.href}
                          href={c.href}
                          role="menuitem"
                          className={`nb-menu-item${isActive(c.href) ? " nb-mi-active" : ""}`}
                          onClick={() => setMenuOpen(null)}
                        >
                          <div className="nb-mi-label">{c.label}</div>
                          {c.desc && <div className="nb-mi-desc">{c.desc}</div>}
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              }
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={[
                    "nb-link",
                    item.emphasize ? "nb-emphasize" : "",
                    isActive(item.href!) ? "nb-active" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="nb-right">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              className="nb-cta"
              target="_blank" rel="noopener noreferrer"
            >
              Take the Survey →
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

        <div className={`nb-mobile${open ? " open" : ""}`} aria-hidden={!open}>
          {NAV.map(item => {
            if (item.children) {
              return (
                <div key={item.label}>
                  <div className="nb-mob-section">{item.label}</div>
                  {item.children.map(c => (
                    <Link
                      key={c.href}
                      href={c.href}
                      className={`nb-mob-link nb-mob-sublink${isActive(c.href) ? " nb-active" : ""}`}
                      onClick={() => setOpen(false)}
                    >
                      {c.label}
                      <span style={{ opacity: 0.3, fontSize: 14 }}>›</span>
                    </Link>
                  ))}
                </div>
              );
            }
            return (
              <Link
                key={item.href}
                href={item.href!}
                className={`nb-mob-link${isActive(item.href!) ? " nb-active" : ""}`}
                onClick={() => setOpen(false)}
              >
                {item.label}
                <span style={{ opacity: 0.3, fontSize: 14 }}>›</span>
              </Link>
            );
          })}
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
