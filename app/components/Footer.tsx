import Link from "next/link";
import ThemeToggle from "./ThemeToggle";

const COLS = [
  {
    label: "Tracking",
    links: [
      { href: "/polling/donaldtrumpapproval", label: "Trump Approval" },
      { href: "/polling/genericballot",       label: "Generic Ballot" },
      { href: "/polling/rightorwrongtrack",   label: "Right / Wrong Track" },
      { href: "/polling",                     label: "All Polling Averages" },
    ],
  },
  {
    label: "Institute",
    links: [
      { href: "/contact",                                                                  label: "Partner With Us" },
      { href: "/contact",                                                                  label: "Request a Poll" },
      { href: "/contact",                                                                  label: "Contact" },
      { href: "https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6",        label: "Take the Survey" },
      { href: "/SMSOptIn",                                                                 label: "SMS Sign-Up" },
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
          margin-top: 40px;
          padding: 0 24px 28px;
          font-family: var(--font-body);
        }

        .ft-shell {
          max-width: 1280px;
          margin: 0 auto;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          box-shadow: var(--shadow-md);
          overflow: hidden;
        }

        /* CTA band */
        .ft-cta {
          padding: 36px 36px 32px;
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 28px;
          background:
            radial-gradient(ellipse 70% 100% at 0% 100%, rgba(124,58,237,0.07) 0%, transparent 60%),
            radial-gradient(ellipse 60% 100% at 100% 0%, rgba(37,99,235,0.05) 0%, transparent 60%),
            var(--panel);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 768px) {
          .ft-cta { grid-template-columns: 1fr; padding: 28px 22px; }
        }

        .ft-cta-eyebrow {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--purple);
          margin-bottom: 10px;
        }
        .ft-cta-head {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: clamp(24px, 3vw, 36px);
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--foreground);
          line-height: 1.05;
          margin-bottom: 8px;
        }
        .ft-cta-head em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ft-cta-sub {
          font-size: 14px;
          color: var(--muted);
          max-width: 480px;
        }
        .ft-cta-btns { display: flex; gap: 10px; flex-wrap: wrap; flex-shrink: 0; }

        .ft-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 11px 22px;
          border-radius: var(--r-pill);
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.02em;
          text-decoration: none;
          border: 1px solid transparent;
          transition: transform var(--dur-1) var(--ease-out), background var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
        }
        .ft-btn-primary {
          background: var(--gradient-purple);
          color: #fff !important;
          border-color: var(--purple);
          box-shadow: var(--shadow-purple);
        }
        .ft-btn-primary:hover {
          background: var(--gradient-purple-soft);
          border-color: var(--purple-soft);
          transform: translateY(-1px);
          text-decoration: none;
          color: #fff !important;
          box-shadow: 0 8px 22px rgba(124, 58, 237, 0.32);
        }
        .ft-btn-ghost {
          background: var(--panel);
          color: var(--foreground) !important;
          border-color: var(--border2);
        }
        .ft-btn-ghost:hover {
          background: var(--panel2);
          border-color: var(--border3);
          text-decoration: none;
          color: var(--foreground) !important;
        }

        /* Stats strip */
        .ft-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 4px 24px;
          background: var(--panel2);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 600px) { .ft-stats { grid-template-columns: repeat(2, 1fr); padding: 4px 14px; } }

        .ft-stat {
          position: relative;
          padding: 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .ft-stat + .ft-stat::before {
          content: "";
          position: absolute;
          left: 0;
          top: 22%;
          bottom: 22%;
          width: 1px;
          background: var(--border);
        }
        @media (max-width: 600px) {
          .ft-stat:nth-child(2n+1)::before { display: none; }
          .ft-stat:nth-child(-n+2) { border-bottom: 1px solid var(--border); }
        }
        .ft-stat-k {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-family: var(--font-body);
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .ft-stat-k::before {
          content: "";
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--purple);
          opacity: 0.55;
        }
        .ft-stat-v {
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 22px;
          font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--foreground);
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }

        /* Main grid */
        .ft-grid {
          display: grid;
          grid-template-columns: 1.8fr repeat(2, 1fr);
          padding: 32px 36px;
          gap: 32px;
        }
        @media (max-width: 900px) {
          .ft-grid { grid-template-columns: 1fr 1fr; padding: 28px 22px; gap: 24px; }
        }
        @media (max-width: 560px) { .ft-grid { grid-template-columns: 1fr; } }

        .ft-brand-col { display: flex; flex-direction: column; gap: 14px; max-width: 320px; }
        .ft-brand-logo {
          display: inline-block;
          height: 56px;
          width: 220px;
          background:
            linear-gradient(100deg, #c22f3b 0%, #6d3ee9 50%, #1d5fc4 100%);
          -webkit-mask-image: url(/full_logo_clean.png);
          -webkit-mask-size: contain;
          -webkit-mask-repeat: no-repeat;
          -webkit-mask-position: left center;
          mask-image: url(/full_logo_clean.png);
          mask-size: contain;
          mask-repeat: no-repeat;
          mask-position: left center;
          transition: opacity var(--dur-1) var(--ease-out);
        }
        .ft-brand-logo:hover { opacity: 0.85; }
        .ft-brand-desc {
          font-size: 13px;
          color: var(--muted);
          line-height: 1.6;
        }

        .ft-col-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--foreground);
          margin-bottom: 14px;
        }
        .ft-nav-link {
          display: block;
          font-size: 13px;
          color: var(--muted);
          text-decoration: none;
          padding: 6px 0;
          transition: color var(--dur-1) var(--ease-out);
        }
        .ft-nav-link:hover { color: var(--foreground); text-decoration: none; }

        /* Bottom bar */
        .ft-bottom {
          padding: 16px 36px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
          background: var(--panel2);
          border-top: 1px solid var(--border);
        }
        @media (max-width: 768px) {
          .ft-bottom { padding: 14px 22px; flex-direction: column; align-items: flex-start; gap: 10px; }
        }
        .ft-copyright { font-size: 12px; color: var(--muted); }
        .ft-bottom-links { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
        .ft-bottom-link { font-size: 12px; color: var(--muted); text-decoration: none; }
        .ft-bottom-link:hover { color: var(--foreground); text-decoration: none; }
      `}</style>

      <footer className="ft-root">
        <div className="ft-shell">
          {/* CTA band */}
          <div className="ft-cta">
            <div>
              <div className="ft-cta-eyebrow">Participate · Shape the Data</div>
              <div className="ft-cta-head">
                Your voice. <em>National impact.</em>
              </div>
              <div className="ft-cta-sub">
                Join thousands of Americans shaping the national sentiment baseline.
              </div>
            </div>
            <div className="ft-cta-btns">
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="ft-btn ft-btn-primary"
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
              <Link href="/contact" className="ft-btn ft-btn-ghost">Partner With Us</Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="ft-stats">
            {STATS.map(s => (
              <div key={s.k} className="ft-stat">
                <div className="ft-stat-k">{s.k}</div>
                <div className="ft-stat-v">{s.v}</div>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div className="ft-grid">
            <div className="ft-brand-col">
              <Link href="/" aria-label="Public Sentiment Institute" className="ft-brand-logo-link">
                <span className="ft-brand-logo" aria-hidden />
              </Link>
              <div className="ft-brand-desc">
                A living, continuously updated national polling database —
                capturing what Americans believe by issue, region, demographic, and time.
              </div>
            </div>

            {COLS.map(col => (
              <div key={col.label}>
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

          {/* Bottom bar */}
          <div className="ft-bottom">
            <span className="ft-copyright">
              © {year} Public Sentiment Institute · Open Methodology
            </span>
            <div className="ft-bottom-links">
              <ThemeToggle />
              <Link href="/contact" className="ft-bottom-link">Contact</Link>
              <Link href="/TermsAndConditions" className="ft-bottom-link">Terms &amp; Conditions</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
