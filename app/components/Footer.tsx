import Link from "next/link";

const COLS = [
  {
    label: "Tracking",
    links: [
      { href: "/polling/", label: "Trump Approval" },
      { href: "/polling/",        label: "Generic Ballot" },
      { href: "/polling/",     label: "Right / Wrong Track" },
      { href: "/polling",                       label: "All Polling Averages" },
    ],
  },
  {
    label: "Institute",
    links: [
      { href: "/contact", label: "Partner With Us" },
      { href: "/contact", label: "Request a Poll" },
      { href: "/contact", label: "Contact" },
      { href: "https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6", label: "Take the Survey" },
    ],
  },
];

const STATS = [
  { k: "Polls Tracked", v: "150+" },
  { k: "States",        v: "50" },
  { k: "Updated",       v: "Daily" },
  { k: "Access",        v: "Free" },
];

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');

        .ft-root {
          background: #0a0a08;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-family: 'DM Mono', monospace;
          margin-top: 0;
        }

        /* Bicolor rule */
        .ft-stripe {
          height: 3px;
          background: linear-gradient(90deg, #5b8fd4 50%, #d45b5b 50%);
        }

        /* CTA band */
        .ft-cta-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ft-cta {
          max-width: 1280px;
          margin: 0 auto;
          padding: 40px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 32px;
        }
        @media (max-width: 768px) {
          .ft-cta { grid-template-columns: 1fr; padding: 28px 20px; }
        }

        .ft-cta-eyebrow {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #c5a55a;
          margin-bottom: 8px;
        }

        .ft-cta-head {
          font-family: 'Bebas Neue', sans-serif;
          font-size: clamp(28px, 4vw, 52px);
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
          margin-bottom: 6px;
        }
        .ft-cta-head .dem { color: #5b8fd4; }
        .ft-cta-head .rep { color: #d45b5b; }

        .ft-cta-sub {
          font-size: 11px;
          color: rgba(255,255,255,0.35);
          letter-spacing: 0.06em;
        }

        .ft-cta-btns {
          display: flex;
          gap: 12px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .ft-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          background: #c5a55a;
          color: #0a0a08;
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 120ms, transform 80ms;
        }
        .ft-btn-primary:hover { background: #d4b46a; text-decoration: none; transform: translateY(-1px); }

        .ft-btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 10px 22px;
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-family: 'DM Mono', monospace;
          font-size: 10px;
          font-weight: 400;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.15);
          transition: border-color 120ms, color 120ms;
        }
        .ft-btn-ghost:hover { border-color: rgba(255,255,255,0.4); color: rgba(255,255,255,0.8); text-decoration: none; }

        /* Stats strip */
        .ft-stats-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.08);
          background: #0f0f0d;
        }
        .ft-stats {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 600px) { .ft-stats { grid-template-columns: repeat(2, 1fr); } }

        .ft-stat {
          padding: 20px 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          padding-right: 24px;
          margin-right: 24px;
        }
        .ft-stat:last-child { border-right: none; }
        .ft-stat-k {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.3);
          margin-bottom: 4px;
        }
        .ft-stat-v {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 28px;
          letter-spacing: 0.04em;
          color: #c5a55a;
          line-height: 1;
        }

        /* Main grid */
        .ft-grid-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.08);
        }
        .ft-grid {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          display: grid;
          grid-template-columns: 1.8fr repeat(3, 1fr);
        }
        @media (max-width: 900px) { .ft-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .ft-grid { grid-template-columns: 1fr; } }

        .ft-brand-col {
          padding: 36px 40px 36px 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        @media (max-width: 900px) {
          .ft-brand-col {
            grid-column: 1 / -1;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 28px 0;
          }
        }

        .ft-brand-mark {
          font-family: 'Bebas Neue', sans-serif;
          font-size: 48px;
          letter-spacing: 0.05em;
          color: #fff;
          line-height: 1;
          display: block;
          text-decoration: none;
        }
        .ft-brand-mark:hover { text-decoration: none; opacity: 0.8; }

        .ft-brand-eyebrow {
          font-size: 8px;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-top: -4px;
        }

        .ft-brand-desc {
          font-size: 12px;
          color: rgba(255,255,255,0.3);
          line-height: 1.75;
          max-width: 260px;
          letter-spacing: 0.02em;
        }

        /* Nav columns */
        .ft-nav-col {
          padding: 36px 28px;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .ft-nav-col:last-child { border-right: none; }
        @media (max-width: 560px) {
          .ft-nav-col {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 24px 0;
          }
        }

        .ft-col-label {
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #c5a55a;
          margin-bottom: 16px;
          padding-bottom: 10px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }

        .ft-nav-link {
          display: block;
          font-size: 11px;
          color: rgba(255,255,255,0.4);
          text-decoration: none;
          padding: 5px 0;
          letter-spacing: 0.04em;
          transition: color 80ms;
        }
        .ft-nav-link:hover { color: rgba(255,255,255,0.85); text-decoration: none; }

        /* Bottom bar */
        .ft-bottom {
          max-width: 1280px;
          margin: 0 auto;
          padding: 16px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .ft-bottom { padding: 16px 20px; flex-direction: column; align-items: flex-start; gap: 10px; }
        }

        .ft-copyright {
          font-size: 10px;
          color: rgba(255,255,255,0.2);
          letter-spacing: 0.08em;
        }

        .ft-bottom-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .ft-bottom-link {
          font-size: 10px;
          color: rgba(255,255,255,0.25);
          text-decoration: none;
          letter-spacing: 0.08em;
          transition: color 80ms;
        }
        .ft-bottom-link:hover { color: rgba(255,255,255,0.6); }

        .ft-live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #e05a4a;
        }
        .ft-live-dot-sm {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #e05a4a;
          animation: ft-pulse 1.8s ease-in-out infinite;
        }
        @keyframes ft-pulse { 0%,100%{opacity:1} 50%{opacity:0.25} }
      `}</style>

      <footer className="ft-root">
        <div className="ft-stripe" />

        {/* CTA band */}
        <div className="ft-cta-wrap">
          <div className="ft-cta">
            <div>
              <div className="ft-cta-eyebrow">Participate · Shape the Data</div>
              <div className="ft-cta-head">
                Your Voice.{" "}
                <span className="dem">National</span>{" "}
                <span className="rep">Impact.</span>
              </div>
              <div className="ft-cta-sub">Join thousands of Americans shaping the national sentiment baseline.</div>
            </div>
            <div className="ft-cta-btns">
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="ft-btn-primary"
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
              <Link href="/contact" className="ft-btn-ghost">Partner With Us</Link>
            </div>
          </div>
        </div>

        {/* Stats strip */}
        <div className="ft-stats-wrap">
          <div className="ft-stats">
            {STATS.map(s => (
              <div key={s.k} className="ft-stat">
                <div className="ft-stat-k">{s.k}</div>
                <div className="ft-stat-v">{s.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Main grid */}
        <div className="ft-grid-wrap">
          <div className="ft-grid">
            <div className="ft-brand-col">
              <div>
                <Link href="/" className="ft-brand-mark">PSI</Link>
                <div className="ft-brand-eyebrow">Public Sentiment Institute</div>
              </div>
              <div className="ft-brand-desc">
                A living, continuously updated national polling database —
                capturing what Americans believe by issue, region, demographic,
                and time.
              </div>
            </div>

            {COLS.map(col => (
              <div key={col.label} className="ft-nav-col">
                <div className="ft-col-label">{col.label}</div>
                {col.links.map(link => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="ft-nav-link"
                    {...(link.href.startsWith("http") ? { target:"_blank", rel:"noopener noreferrer" } : {})}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="ft-bottom">
          <span className="ft-copyright">
            © {year} Public Sentiment Institute · Open Methodology
          </span>
          <div className="ft-bottom-links">
            <Link href="/" className="ft-bottom-link">Methodology</Link>
            <Link href="/" className="ft-bottom-link">Data Disclosure</Link>
            <Link href="/contact" className="ft-bottom-link">Contact</Link>
          </div>
          <div className="ft-live-indicator">
            <span className="ft-live-dot-sm" />
            Data collection active
          </div>
        </div>
      </footer>
    </>
  );
}