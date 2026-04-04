import Link from "next/link";
import Image from "next/image";

const COLS = [
  {
    label: "Tracking",
    links: [
      { href: "/polling/donaldtrumpapproval", label: "Trump Approval" },
      { href: "/polling/genericballot",        label: "Generic Ballot" },
      { href: "/polling/rightorwrongtrack",     label: "Right / Wrong Track" },
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
      { href: "/SMSOptIn", label: "SMS Sign-Up" },
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
        .ft-root {
          background: #070709;
          border-top: 1px solid rgba(255,255,255,0.08);
          font-family: var(--font-body), monospace;
          margin-top: 0;
        }

        /* Tri-color rule matching the page hero */
        .ft-stripe {
          height: 3px;
          background: linear-gradient(90deg, #e63946 0%, #e63946 33.33%, #7c3aed 33.33%, #7c3aed 66.66%, #2563eb 66.66%, #2563eb 100%);
        }

        /* CTA band */
        .ft-cta-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ft-cta {
          max-width: 1280px;
          margin: 0 auto;
          padding: 36px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 32px;
        }
        @media (max-width: 768px) {
          .ft-cta { grid-template-columns: 1fr; padding: 28px 20px; }
        }

        .ft-cta-eyebrow {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #7c3aed;
          margin-bottom: 8px;
        }

        .ft-cta-head {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(26px, 3.5vw, 46px);
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .ft-cta-head .dem { color: #2563eb; }
        .ft-cta-head .rep { color: #e63946; }

        .ft-cta-sub {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.32);
          letter-spacing: 0.06em;
        }

        .ft-cta-btns {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          flex-shrink: 0;
        }

        .ft-btn-primary {
          display: inline-flex;
          align-items: center;
          padding: 9px 20px;
          background: rgba(124,58,237,0.15);
          border: 1px solid rgba(124,58,237,0.5);
          color: #9d5cf0;
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 500;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          transition: border-color 120ms, color 120ms, background 120ms;
        }
        .ft-btn-primary:hover { border-color: rgba(124,58,237,0.8); color: #b97ef5; background: rgba(124,58,237,0.22); text-decoration: none; }

        .ft-btn-ghost {
          display: inline-flex;
          align-items: center;
          padding: 9px 20px;
          background: transparent;
          color: rgba(255,255,255,0.4);
          font-family: var(--font-body), monospace;
          font-size: 9px;
          font-weight: 400;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          text-decoration: none;
          border: 1px solid rgba(255,255,255,0.12);
          transition: border-color 120ms, color 120ms;
        }
        .ft-btn-ghost:hover { border-color: rgba(255,255,255,0.35); color: rgba(255,255,255,0.75); text-decoration: none; }

        /* Stats strip */
        .ft-stats-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.07);
          background: #0b0b0f;
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
          padding: 18px 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          padding-right: 24px;
          margin-right: 24px;
        }
        .ft-stat:last-child { border-right: none; }
        .ft-stat-k {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(255,255,255,0.25);
          margin-bottom: 4px;
        }
        .ft-stat-v {
          font-family: var(--font-display), sans-serif;
          font-size: 26px;
          letter-spacing: 0.04em;
          color: #9d5cf0;
          line-height: 1;
          text-transform: uppercase;
        }

        /* Main grid */
        .ft-grid-wrap {
          border-bottom: 1px solid rgba(255,255,255,0.07);
        }
        .ft-grid {
          max-width: 1280px;
          margin: 0 auto;
          padding: 0 32px;
          display: grid;
          grid-template-columns: 1.8fr repeat(2, 1fr);
        }
        @media (max-width: 900px) { .ft-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .ft-grid { grid-template-columns: 1fr; } }

        .ft-brand-col {
          padding: 32px 40px 32px 0;
          border-right: 1px solid rgba(255,255,255,0.06);
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        @media (max-width: 900px) {
          .ft-brand-col {
            grid-column: 1 / -1;
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 24px 0;
          }
        }

        .ft-brand-logo {
          display: block;
          width: 140px;
          height: auto;
          opacity: 0.9;
          transition: opacity 120ms;
        }
        .ft-brand-logo:hover { opacity: 1; }

        .ft-brand-desc {
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.28);
          line-height: 1.8;
          max-width: 260px;
          letter-spacing: 0.02em;
        }

        /* Nav columns */
        .ft-nav-col {
          padding: 32px 28px;
          border-right: 1px solid rgba(255,255,255,0.06);
        }
        .ft-nav-col:last-child { border-right: none; }
        @media (max-width: 560px) {
          .ft-nav-col {
            border-right: none;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            padding: 22px 0;
          }
        }

        .ft-col-label {
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: #7c3aed;
          margin-bottom: 14px;
          padding-bottom: 9px;
          border-bottom: 1px solid rgba(124,58,237,0.2);
        }

        .ft-nav-link {
          display: block;
          font-family: var(--font-body), monospace;
          font-size: 10px;
          color: rgba(255,255,255,0.35);
          text-decoration: none;
          padding: 5px 0;
          letter-spacing: 0.04em;
          transition: color 80ms;
        }
        .ft-nav-link:hover { color: rgba(255,255,255,0.8); text-decoration: none; }

        /* Bottom bar */
        .ft-bottom-wrap {
          background: #0b0b0f;
        }
        .ft-bottom {
          max-width: 1280px;
          margin: 0 auto;
          padding: 14px 32px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .ft-bottom { padding: 14px 20px; flex-direction: column; align-items: flex-start; gap: 8px; }
        }

        .ft-copyright {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.18);
          letter-spacing: 0.08em;
        }

        .ft-bottom-links {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .ft-bottom-link {
          font-family: var(--font-body), monospace;
          font-size: 9px;
          color: rgba(255,255,255,0.22);
          text-decoration: none;
          letter-spacing: 0.08em;
          transition: color 80ms;
        }
        .ft-bottom-link:hover { color: rgba(255,255,255,0.55); }

        .ft-live-indicator {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body), monospace;
          font-size: 8px;
          font-weight: 500;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: #7c3aed;
        }
        .ft-live-dot-sm {
          width: 5px; height: 5px;
          border-radius: 50%;
          background: #7c3aed;
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
              <Link href="/">
                <Image
                  src="/full_logo_clean.png"
                  alt="Public Sentiment Institute"
                  width={160}
                  height={56}
                  className="ft-brand-logo"
                />
              </Link>
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
        <div className="ft-bottom-wrap">
          <div className="ft-bottom">
            <span className="ft-copyright">
              © {year} Public Sentiment Institute · Open Methodology
            </span>
            <div className="ft-bottom-links">
              <Link href="/" className="ft-bottom-link">Methodology</Link>
              <Link href="/" className="ft-bottom-link">Data Disclosure</Link>
              <Link href="/contact" className="ft-bottom-link">Contact</Link>
              <Link href="/TermsAndConditions" className="ft-bottom-link">Terms &amp; Conditions</Link>
            </div>
            <div className="ft-live-indicator">
              <span className="ft-live-dot-sm" />
              Data collection active
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}