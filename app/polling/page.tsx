// app/polling/page.tsx
import Link from "next/link";

type PollPage = {
  title: string;
  description: string;
  href: string;
  badge?: string;
  tag?: string;
  status?: "live" | "building" | "planned";
};

const PAGES: PollPage[] = [
  {
    title: "Donald Trump • Job Approval",
    description: "Tracking the President's job approval in real time",
    href: "/polling/donaldtrumpapproval",
    badge: "Approval",
    tag: "National",
    status: "live",
  },
  {
    title: "2026 National Generic Ballot",
    description: "View how the 2028 Democrat candidates are shaping up in one of the most contested primaries of all time",
    href: "/polling/genericballot",
    badge: "Daily Average",
    tag: "National",
    status: "live",
  },
];

const statusMeta = {
  live:     { label: "LIVE",     cls: "pd-badge-live" },
  building: { label: "BUILDING", cls: "pd-badge-neutral" },
  planned:  { label: "PLANNED",  cls: "pd-badge-neutral" },
};

const tagColors: Record<string, string> = {
  National: "var(--purple-soft)",
  Florida:  "var(--blue2)",
};

function Card({ p, index }: { p: PollPage; index: number }) {
  const isLive = p.status === "live";
  const meta = statusMeta[p.status ?? "planned"];
  const tagColor = tagColors[p.tag ?? ""] ?? "var(--muted3)";

  return (
    <div
      className="pd-card"
      style={{ animationDelay: `${index * 0.06}s` }}
    >
      {/* Left accent stripe — colored by party tag */}
      <div className="pd-card-stripe" style={{ background: tagColor }} />

      {/* Inner content */}
      <div className="pd-card-body">

        {/* Top row: chips + status */}
        <div className="pd-card-top">
          <div className="pd-chip-row">
            {p.badge && <span className="pd-chip">{p.badge}</span>}
            {p.tag && (
              <span className="pd-chip" style={{ borderColor: `${tagColor}44`, background: `${tagColor}11`, color: tagColor }}>
                {p.tag}
              </span>
            )}
          </div>
          <span className={`pd-status-badge ${meta.cls}`}>
            {meta.label === "LIVE" && <span className="pd-live-dot" />}
            {meta.label}
          </span>
        </div>

        {/* Title */}
        <div className="pd-card-title">{p.title}</div>

        {/* Description */}
        <div className="pd-card-desc">{p.description}</div>

        {/* Divider */}
        <div className="pd-divider" />

        {/* Footer row */}
        <div className="pd-card-footer">
          <span className="pd-footer-note">
            {isLive ? "POLLING AVERAGE · UPDATED DAILY" : "NOT YET AVAILABLE"}
          </span>
          {isLive ? (
            <Link href={p.href} className="pd-open-btn">
              OPEN →
            </Link>
          ) : (
            <span className="pd-open-btn pd-open-disabled" aria-disabled="true">
              OPEN →
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PollingHomePage() {
  const liveCount = PAGES.filter((p) => p.status === "live").length;

  return (
    <>
      <style>{`
        /* ── Tokens ── */
        .pd-root {
          --background:  #070709;
          --background2: #0b0b0f;
          --panel:       #0f0f15;
          --panel2:      #141420;
          --border:      rgba(255,255,255,0.09);
          --border2:     rgba(255,255,255,0.15);
          --border3:     rgba(255,255,255,0.22);
          --muted:       rgba(240,240,245,0.62);
          --muted2:      rgba(240,240,245,0.40);
          --muted3:      rgba(240,240,245,0.22);
          --purple:      #7c3aed;
          --purple2:     #9d5cf0;
          --purple-soft: #a78bfa;
          --red:         #e63946;
          --red2:        #ff4d5a;
          --blue:        #2563eb;
          --blue2:       #3b82f6;
          --win:         #4ade80;
        }

        /* ── ANIMATIONS ── */
        @keyframes pd-fade-up {
          from { opacity:0; transform:translateY(14px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes pd-live-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.3; transform:scale(0.8); }
        }
        @keyframes pd-scan-line {
          from { background-position: 0 0; }
          to   { background-position: 0 100px; }
        }

        /* ── PAGE SHELL ── */
        .pd-root {
          min-height: 100vh;
          position: relative;
        }

        /* ── TRI STRIPE ── */
        .pd-tri-stripe {
          height: 3px;
          width: 100%;
          background: linear-gradient(
            90deg,
            var(--red)    0%,    var(--red)    33.33%,
            var(--purple) 33.33%, var(--purple) 66.66%,
            var(--blue)   66.66%, var(--blue)   100%
          );
        }

        /* ── HERO ── */
        .pd-hero {
          border-bottom: 1px solid var(--border);
          background: var(--background2);
          position: relative;
          overflow: hidden;
          padding: 36px 0 28px;
        }
        .pd-hero::before {
          content: '';
          position: absolute;
          inset: 0;
          background:
            radial-gradient(ellipse 50% 100% at 0% 50%,   rgba(230,57,70,0.04)   0%, transparent 70%),
            radial-gradient(ellipse 50% 100% at 100% 50%, rgba(37,99,235,0.05)  0%, transparent 70%),
            radial-gradient(ellipse 30% 60% at 50% 100%, rgba(124,58,237,0.04) 0%, transparent 70%);
          pointer-events: none;
        }
        .pd-hero-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          position: relative;
        }
        .pd-hero-grid {
          display: grid;
          grid-template-columns: 1fr auto;
          align-items: end;
          gap: 24px;
        }
        @media (max-width: 640px) {
          .pd-hero-grid { grid-template-columns: 1fr; }
        }

        .pd-eyebrow {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: ui-monospace,'Courier New',monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--purple-soft);
          margin-bottom: 14px;
        }
        .pd-eyebrow-line {
          width: 20px;
          height: 1px;
          background: var(--purple-soft);
          opacity: 0.5;
        }

        .pd-hero-title {
          font-family: ui-monospace,'Courier New',monospace;
          font-size: clamp(32px, 5vw, 62px);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.01em;
          line-height: 0.92;
          color: #fff;
          margin: 0 0 16px;
        }
        .pd-hero-title em {
          font-style: normal;
          background: linear-gradient(100deg, var(--red2) 0%, var(--purple-soft) 50%, var(--blue2) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .pd-hero-desc {
          font-family: ui-monospace,monospace;
          font-size: 10.5px;
          letter-spacing: 0.12em;
          line-height: 1.7;
          color: var(--muted2);
          max-width: 520px;
          text-transform: uppercase;
        }

        /* Hero stat chips */
        .pd-hero-stats {
          display: flex;
          flex-direction: column;
          gap: 6px;
          align-items: flex-end;
        }
        @media (max-width: 640px) {
          .pd-hero-stats { flex-direction: row; align-items: flex-start; }
        }
        .pd-hero-stat {
          border: 1px solid var(--border);
          background: var(--panel);
          padding: 10px 16px;
          min-width: 120px;
          text-align: center;
        }
        .pd-hero-stat-val {
          font-family: ui-monospace,monospace;
          font-size: 26px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          font-variant-numeric: tabular-nums;
        }
        .pd-hero-stat-key {
          font-family: ui-monospace,monospace;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          color: var(--muted3);
          margin-top: 4px;
        }

        /* Hero badge row */
        .pd-hero-badge-row {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 8px;
          margin-top: 20px;
        }

        /* ── BADGES ── */
        .pd-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted3);
        }
        .pd-badge-live {
          border-color: rgba(230,57,70,0.28);
          background: rgba(230,57,70,0.07);
          color: rgba(230,57,70,0.9);
        }
        .pd-badge-purple {
          border-color: rgba(124,58,237,0.35);
          background: rgba(124,58,237,0.07);
          color: var(--purple-soft);
        }
        .pd-badge-neutral {
          border-color: var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--muted3);
        }

        .pd-live-dot {
          display: inline-block;
          width: 5px; height: 5px;
          border-radius: 50%;
          background: currentColor;
          box-shadow: 0 0 6px currentColor;
          animation: pd-live-pulse 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* ── SECTION LABEL ── */
        .pd-section-label {
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--muted3);
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
        }
        .pd-section-label::before {
          content: '';
          display: block;
          width: 20px;
          height: 1px;
          background: var(--purple-soft);
          opacity: 0.5;
        }
        .pd-section-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        /* ── CARDS ── */
        .pd-card {
          display: flex;
          background: var(--panel);
          border: 1px solid var(--border);
          position: relative;
          overflow: hidden;
          transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease;
          animation: pd-fade-up 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .pd-card:hover {
          border-color: rgba(124,58,237,0.30);
          box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(124,58,237,0.10);
          transform: translateY(-2px);
        }

        /* Scanline texture on card */
        .pd-card::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            0deg, transparent, transparent 3px,
            rgba(255,255,255,0.006) 3px, rgba(255,255,255,0.006) 4px
          );
          pointer-events: none;
        }

        .pd-card-stripe {
          width: 3px;
          flex-shrink: 0;
          opacity: 0.7;
          transition: opacity 160ms ease;
        }
        .pd-card:hover .pd-card-stripe { opacity: 1; }

        .pd-card-body {
          flex: 1;
          padding: 20px 20px 18px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .pd-card-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }

        .pd-chip-row {
          display: flex;
          flex-wrap: wrap;
          gap: 5px;
        }

        .pd-chip {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--muted3);
          white-space: nowrap;
        }

        .pd-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted3);
          flex-shrink: 0;
        }
        .pd-badge-live {
          border-color: rgba(230,57,70,0.28);
          background: rgba(230,57,70,0.07);
          color: rgba(230,57,70,0.9);
        }

        .pd-card-title {
          font-family: ui-monospace,'Courier New',monospace;
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: #fff;
          line-height: 1.25;
        }

        .pd-card-desc {
          font-family: ui-monospace,monospace;
          font-size: 9.5px;
          letter-spacing: 0.10em;
          line-height: 1.65;
          color: var(--muted2);
          text-transform: uppercase;
        }

        .pd-divider {
          height: 1px;
          background: var(--border);
          margin: 2px 0;
        }

        .pd-card-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .pd-footer-note {
          font-family: ui-monospace,monospace;
          font-size: 7.5px;
          letter-spacing: 0.20em;
          text-transform: uppercase;
          color: var(--muted3);
        }

        .pd-open-btn {
          display: inline-flex;
          align-items: center;
          padding: 7px 16px;
          background: var(--purple);
          border: 1px solid rgba(124,58,237,0.55);
          color: #fff;
          font-family: ui-monospace,monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-decoration: none;
          transition: background 130ms ease, transform 130ms ease;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pd-open-btn:hover {
          background: var(--purple2);
          transform: translateY(-1px);
          opacity: 1;
        }
        .pd-open-disabled {
          background: rgba(255,255,255,0.04);
          border-color: var(--border);
          color: var(--muted3);
          cursor: not-allowed;
        }
        .pd-open-disabled:hover { transform: none; background: rgba(255,255,255,0.04); }

        /* ── GRID ── */
        .pd-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        @media (max-width: 860px) { .pd-grid { grid-template-columns: 1fr; } }

        /* ── MAIN LAYOUT ── */
        .pd-content {
          max-width: 1200px;
          margin: 0 auto;
          padding: 32px 24px 60px;
        }

        /* ── FOOTNOTE ── */
        .pd-footnote {
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
        }
        .pd-footnote-text {
          font-family: ui-monospace,monospace;
          font-size: 8px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--muted3);
        }

        @media (prefers-reduced-motion: reduce) {
          .pd-card { animation: none !important; transition: none !important; }
          .pd-live-dot { animation: none !important; }
        }
      `}</style>

      <div className="pd-root">
        <div className="pd-tri-stripe" />

        {/* ── HERO ── */}
        <header className="pd-hero">
          <div className="pd-hero-inner">
            <div className="pd-hero-grid">
              <div>
                <div className="pd-eyebrow">
                  <div className="pd-eyebrow-line" />
                  Public Sentiment Institute · Data Products
                </div>

                <h1 className="pd-hero-title">
                  Polling<br /><em>Dashboard</em>
                </h1>

                <p className="pd-hero-desc">
                  Public-facing pages built on the same measurement standard —
                  documented question wording, field dates, sample notes, and
                  transparent weighting decisions.
                </p>

                <div className="pd-hero-badge-row">
                  <span className="pd-badge pd-badge-live">
                    <span className="pd-live-dot" />
                    LIVE DATA
                  </span>
                  <span className="pd-badge pd-badge-purple">WEIGHTED AVERAGES</span>
                  <span className="pd-badge">DISCLOSURE-FIRST</span>
                  <span className="pd-badge">RECENCY + √N + LV/RV/A</span>
                </div>
              </div>

              <div className="pd-hero-stats">
                <div className="pd-hero-stat">
                  <div className="pd-hero-stat-val">{liveCount}</div>
                  <div className="pd-hero-stat-key">LIVE TRACKERS</div>
                </div>
                <div className="pd-hero-stat" style={{ borderTop: "2px solid var(--purple)", paddingTop: "8px" }}>
                  <div className="pd-hero-stat-val" style={{ background: "linear-gradient(90deg,var(--red2),var(--purple-soft),var(--blue2))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                    DAILY
                  </div>
                  <div className="pd-hero-stat-key">UPDATE CADENCE</div>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── CONTENT ── */}
        <div className="pd-content">
          <div className="pd-section-label">ALL POLLING AVERAGES</div>
          <div className="pd-grid">
            {PAGES.map((p, i) => <Card key={p.href} p={p} index={i} />)}
          </div>

          <div className="pd-footnote">
            <span className="pd-footnote-text">
              All averages: documented weighting · recency decay · sample size adjustment · LV/RV/A screen
            </span>
            <span className="pd-badge pd-badge-purple">PSI · METHODOLOGY ON FILE</span>
          </div>
        </div>
      </div>
    </>
  );
}