import Link from "next/link";

const navCols = [
  {
    label: "Coverage",
    links: [
      { href: "/floridapoll", label: "Latest Poll Results" },
      { href: "/results", label: "Election Results" },
      { href: "/polling", label: "Polling Averages" },
      { href: "/goldstandard", label: "Gold Standard Pollsters" },
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
  {
    label: "Transparency",
    links: [
      { href: "/", label: "Methodology" },
      { href: "/", label: "Data Disclosure" },
      { href: "/", label: "Wave Archive" },
      { href: "/", label: "Source Documentation" },
    ],
  },
];

const stats = [
  { k: "RESPONDENTS", v: "10" },
  { k: "STATES", v: "50" },
  { k: "RELEASE", v: "LIVE" },
];

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <>
      <style>{`
        /* ── Tokens (mirror navbar) ── */
        .ft-root {
          --background:  #070709;
          --background2: #0b0b0f;
          --panel:       #0f0f15;
          --panel2:      #141420;
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
        }

        /* ── Shell ── */
        .ft-root {
          background: var(--background2);
          border-top: 1px solid var(--border);
          position: relative;
          overflow: hidden;
        }

        /* Subtle atmosphere glow */
        .ft-root::before {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0;
          height: 280px;
          background:
            radial-gradient(ellipse 50% 60% at 15% 100%, rgba(230,57,70,0.04) 0%, transparent 70%),
            radial-gradient(ellipse 50% 60% at 85% 100%, rgba(37,99,235,0.05) 0%, transparent 70%),
            radial-gradient(ellipse 30% 40% at 50% 100%, rgba(124,58,237,0.04) 0%, transparent 70%);
          pointer-events: none;
        }

        /* ── CTA BAND ── */
        .ft-cta-band {
          position: relative;
          border-bottom: 1px solid var(--border);
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: center;
          gap: 24px;
          padding: 28px 40px;
        }
        @media (max-width: 768px) {
          .ft-cta-band {
            grid-template-columns: 1fr;
            padding: 24px 20px;
          }
        }

        /* Tri stripe accent on left edge */
        .ft-cta-band::before {
          content: '';
          position: absolute;
          top: 0; bottom: 0; left: 0;
          width: 3px;
          background: linear-gradient(
            180deg,
            var(--red)    0%,
            var(--purple) 50%,
            var(--blue)   100%
          );
        }

        .ft-cta-eyebrow {
          font-family: ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--purple-soft);
          margin-bottom: 6px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ft-cta-eyebrow::before {
          content: '';
          display: block;
          width: 16px;
          height: 1px;
          background: var(--purple-soft);
          opacity: 0.5;
        }

        .ft-cta-heading {
          font-family: ui-monospace, 'Courier New', monospace;
          font-size: clamp(18px, 2.5vw, 28px);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #fff;
          line-height: 1;
        }
        .ft-cta-heading em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red2), var(--purple-soft), var(--blue2));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .ft-cta-sub {
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.14em;
          color: var(--muted3);
          margin-top: 6px;
          text-transform: uppercase;
        }

        .ft-cta-actions {
          display: flex;
          gap: 10px;
          flex-shrink: 0;
        }
        @media (max-width: 768px) {
          .ft-cta-actions { flex-wrap: wrap; }
        }

        .ft-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 22px;
          background: var(--purple);
          border: 1px solid rgba(124,58,237,0.65);
          color: #fff;
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          transition: background 140ms ease, transform 140ms ease;
        }
        .ft-btn-primary:hover {
          background: var(--purple2);
          transform: translateY(-1px);
          opacity: 1;
        }

        .ft-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding: 11px 22px;
          background: transparent;
          border: 1px solid var(--border2);
          color: rgba(255,255,255,0.45);
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-decoration: none;
          white-space: nowrap;
          transition: all 140ms ease;
        }
        .ft-btn-ghost:hover {
          border-color: var(--border3);
          color: rgba(255,255,255,0.78);
          opacity: 1;
        }

        /* ── MAIN FOOTER GRID ── */
        .ft-main {
          display: grid;
          grid-template-columns: 1.5fr repeat(3, 1fr);
          border-bottom: 1px solid var(--border);
        }
        @media (max-width: 900px) {
          .ft-main { grid-template-columns: 1fr 1fr; }
        }
        @media (max-width: 560px) {
          .ft-main { grid-template-columns: 1fr; }
        }

        /* Brand column */
        .ft-brand-col {
          padding: 32px 36px 32px 40px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        @media (max-width: 900px) {
          .ft-brand-col {
            grid-column: 1 / -1;
            border-right: none;
            border-bottom: 1px solid var(--border);
            padding: 24px 20px;
          }
        }

        .ft-brand-wordmark {
          display: flex;
          flex-direction: column;
          gap: 3px;
          text-decoration: none;
        }
        .ft-brand-wordmark:hover { opacity: 1; }

        .ft-brand-name {
          font-family: ui-monospace, 'Courier New', monospace;
          font-size: 15px;
          font-weight: 900;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #fff;
          line-height: 1;
        }
        .ft-brand-name .br { color: var(--red); }
        .ft-brand-name .bb { color: var(--blue2); }

        .ft-brand-institute {
          font-family: ui-monospace, monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.42em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }

        .ft-brand-desc {
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          letter-spacing: 0.10em;
          color: var(--muted3);
          line-height: 1.65;
          text-transform: uppercase;
        }

        /* Stats grid inside brand col */
        .ft-stats-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          border: 1px solid var(--border);
        }
        .ft-stat {
          padding: 10px 12px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          position: relative;
        }
        .ft-stat:nth-child(even) { border-right: none; }
        .ft-stat:nth-last-child(-n+2) { border-bottom: none; }
        .ft-stat::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 1px;
          background: var(--purple);
          opacity: 0;
          transition: opacity 200ms ease;
        }
        .ft-stat:hover::before { opacity: 0.4; }

        .ft-stat-k {
          font-family: ui-monospace, monospace;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--muted3);
        }
        .ft-stat-v {
          font-family: ui-monospace, monospace;
          font-size: 16px;
          font-weight: 900;
          color: #fff;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
          line-height: 1;
          margin-top: 3px;
        }

        /* Nav columns */
        .ft-nav-col {
          padding: 28px 24px;
          border-right: 1px solid var(--border);
        }
        .ft-nav-col:last-child { border-right: none; }
        @media (max-width: 900px) {
          .ft-nav-col { border-bottom: 1px solid var(--border); }
          .ft-nav-col:last-child { border-bottom: none; }
        }
        @media (max-width: 560px) {
          .ft-nav-col { padding: 20px; border-right: none; border-bottom: 1px solid var(--border); }
          .ft-nav-col:last-child { border-bottom: none; }
        }

        .ft-nav-col-label {
          font-family: ui-monospace, monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.30em;
          text-transform: uppercase;
          color: var(--purple-soft);
          margin-bottom: 14px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .ft-nav-col-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border2);
        }

        .ft-nav-links {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .ft-nav-link {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-family: ui-monospace, monospace;
          font-size: 9.5px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted3);
          text-decoration: none;
          border-bottom: 1px solid transparent;
          transition: color 120ms ease, border-color 120ms ease;
          position: relative;
        }
        .ft-nav-link::before {
          content: '›';
          font-size: 11px;
          color: var(--border2);
          transition: color 120ms ease, transform 120ms ease;
          flex-shrink: 0;
        }
        .ft-nav-link:hover {
          color: rgba(255,255,255,0.75);
          opacity: 1;
        }
        .ft-nav-link:hover::before {
          color: var(--purple-soft);
          transform: translateX(2px);
        }

        /* ── TRI-COLOR DIVIDER ── */
        .ft-tri-stripe {
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
          opacity: 0.6;
        }

        /* ── BOTTOM BAR ── */
        .ft-bottom {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 14px 40px;
          flex-wrap: wrap;
        }
        @media (max-width: 768px) {
          .ft-bottom { padding: 14px 20px; flex-direction: column; align-items: flex-start; gap: 10px; }
        }

        .ft-bottom-left {
          display: flex;
          align-items: center;
          gap: 14px;
          flex-wrap: wrap;
        }

        .ft-copyright {
          font-family: ui-monospace, monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--muted3);
        }

        .ft-bottom-sep {
          width: 1px;
          height: 12px;
          background: var(--border2);
        }

        .ft-bottom-link {
          font-family: ui-monospace, monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted3);
          text-decoration: none;
          transition: color 120ms ease;
        }
        .ft-bottom-link:hover { color: rgba(255,255,255,0.6); opacity: 1; }

        .ft-bottom-right {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ft-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--red);
          box-shadow: 0 0 6px rgba(230,57,70,0.7);
          animation: ft-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes ft-pulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.3; }
        }

        .ft-status-text {
          font-family: ui-monospace, monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted3);
        }
        .ft-status-text strong {
          color: var(--red);
          font-weight: 700;
        }

        /* Scanline grain texture overlay */
        .ft-root::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 3px,
            rgba(255,255,255,0.006) 3px,
            rgba(255,255,255,0.006) 4px
          );
          pointer-events: none;
        }
      `}</style>

      <footer className="ft-root">

        {/* ── CTA Band ── */}
        <div className="ft-cta-band">
          <div>
            <div className="ft-cta-eyebrow">PARTICIPATE IN THE NATIONAL DATABASE</div>
            <div className="ft-cta-heading">
              Your Voice.<br />
              <em>National Impact.</em>
            </div>
            <div className="ft-cta-sub">
              Thousands of Americans shaping the dataset — join them.
            </div>
          </div>
          <div className="ft-cta-actions">
            <Link
              href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
              className="ft-btn-primary"
            >
              TAKE THE SURVEY →
            </Link>
            <Link href="/contact" className="ft-btn-ghost">
              PARTNER WITH US
            </Link>
          </div>
        </div>

        {/* ── Main Grid ── */}
        <div className="ft-main">

          {/* Brand column */}
          <div className="ft-brand-col">
            <Link href="/" className="ft-brand-wordmark">
              <div className="ft-brand-name">
                <span className="br">P</span>ublic <span className="bb">S</span>entiment
              </div>
              <div className="ft-brand-institute">Institute</div>
            </Link>

            <div className="ft-brand-desc">
              A living, continuously updated national dataset capturing what Americans believe —
              by issue, region, demographic, and time.
              Built for transparency. Designed for analysis.
            </div>

            <div className="ft-stats-grid">
              {stats.map((s) => (
                <div key={s.k} className="ft-stat">
                  <div className="ft-stat-k">{s.k}</div>
                  <div className="ft-stat-v">{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {navCols.map((col) => (
            <div key={col.label} className="ft-nav-col">
              <div className="ft-nav-col-label">{col.label}</div>
              <div className="ft-nav-links">
                {col.links.map((link) => (
                  <Link key={link.label} href={link.href} className="ft-nav-link">
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}

        </div>

        {/* Tri-color accent stripe */}
        <div className="ft-tri-stripe" />

        {/* ── Bottom bar ── */}
        <div className="ft-bottom">
          <div className="ft-bottom-left">
            <span className="ft-copyright">
              © {year} Public Sentiment Institute
            </span>
            <div className="ft-bottom-sep" />
            <Link href="/" className="ft-bottom-link">Privacy</Link>
            <div className="ft-bottom-sep" />
            <Link href="/" className="ft-bottom-link">Terms</Link>
            <div className="ft-bottom-sep" />
            <Link href="/" className="ft-bottom-link">Methodology</Link>
          </div>

          <div className="ft-bottom-right">
            <div className="ft-status-dot" />
            <span className="ft-status-text">
              <strong>LIVE</strong> · DATA COLLECTION ACTIVE
            </span>
          </div>
        </div>

      </footer>
    </>
  );
}