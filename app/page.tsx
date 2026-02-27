import Link from "next/link";

const metrics = [
  { k: "RESPONDENTS", v: "10", delta: "+3 TODAY" },
  { k: "STATES COVERED", v: "50", delta: "ALL REGIONS" },
  { k: "RELEASE CYCLE", v: "LIVE", delta: "CONTINUOUS" },
];

const features = [
  {
    accent: "var(--blue2)",
    glow: "rgba(59,130,246,0.4)",
    tag: "CORE MODULE",
    title: "National Issue Tracker",
    sub: "Consistent questions repeated over time across all regions. Trendlines built for longitudinal analysis.",
    pct: 78,
  },
  {
    accent: "var(--purple-soft)",
    glow: "rgba(124,58,237,0.35)",
    tag: "RESPONDENT LAYER",
    title: "Panel-Aware Results",
    sub: "Optional respondent IDs for recruitment and source matching across wave deployments.",
    pct: 55,
  },
  {
    accent: "var(--red2)",
    glow: "rgba(230,57,70,0.35)",
    tag: "ANALYTICS",
    title: "Cross-Tab Engine",
    sub: "Slice sentiment by demographics, geography, and turnout likelihood indicators.",
    pct: 62,
  },
  {
    accent: "var(--purple-soft)",
    glow: "rgba(124,58,237,0.25)",
    tag: "TRANSPARENCY",
    title: "Public Summaries",
    sub: "Clean toplines with documented methodology and full disclosure. Open for media use.",
    pct: 89,
  },
];

const callouts = [
  {
    color: "var(--blue2)",
    bg: "rgba(37,99,235,0.06)",
    border: "rgba(59,130,246,0.20)",
    icon: "◈",
    label: "TAKE THE SURVEY",
    desc: "Join thousands of Americans shaping the national baseline dataset.",
    href: "https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6",
    cta: "PARTICIPATE →",
  },
  {
    color: "var(--purple-soft)",
    bg: "rgba(124,58,237,0.06)",
    border: "rgba(124,58,237,0.22)",
    icon: "◉",
    label: "PARTNER WITH US",
    desc: "Commission recurring fielding or custom demographic deep-dives.",
    href: "/contact",
    cta: "REACH OUT →",
  },
  {
    color: "var(--red2)",
    bg: "rgba(230,57,70,0.06)",
    border: "rgba(230,57,70,0.20)",
    icon: "◫",
    label: "USE THE DATA",
    desc: "Public summaries with full method disclosure — free to cite and publish.",
    href: "/results",
    cta: "VIEW DATA →",
  },
];

const recentPolls = [
  { issue: "Presidential Approval", dem: 44, rep: 51, n: "2,104", date: "FEB 2026" },
  { issue: "Economy Confidence", dem: 38, rep: 57, n: "1,891", date: "FEB 2026" },
  { issue: "Healthcare Access", dem: 61, rep: 35, n: "2,340", date: "JAN 2026" },
  { issue: "Immigration Policy", dem: 32, rep: 64, n: "1,744", date: "JAN 2026" },
];

export default function HomePage() {
  return (
    <>
      <style>{`
        /* ── Animations ── */
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(18px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity:0; }
          to   { opacity:1; }
        }
        @keyframes barGrow {
          from { width: 0%; }
          to   { width: var(--target); }
        }
        @keyframes pulse-glow {
          0%,100% { opacity:1; }
          50%      { opacity:0.35; }
        }
        @keyframes ticker-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes count-up {
          from { opacity:0; transform:scale(0.9); }
          to   { opacity:1; transform:scale(1); }
        }

        .hp-animate-1 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.05s both; }
        .hp-animate-2 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.15s both; }
        .hp-animate-3 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.25s both; }
        .hp-animate-4 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.35s both; }
        .hp-animate-5 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.45s both; }
        .hp-animate-6 { animation: fadeUp 0.7s cubic-bezier(0.22,1,0.36,1) 0.55s both; }

        /* ── Background atmosphere ── */
        .hp-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
          background:
            radial-gradient(ellipse 55% 45% at 8% 12%, rgba(230,57,70,0.055) 0%, transparent 65%),
            radial-gradient(ellipse 50% 40% at 92% 88%, rgba(37,99,235,0.065) 0%, transparent 65%),
            radial-gradient(ellipse 40% 35% at 50% 50%, rgba(124,58,237,0.04) 0%, transparent 70%);
        }
        .hp-bg::after {
          content: '';
          position: absolute;
          inset: 0;
          background-image: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(255,255,255,0.008) 2px,
            rgba(255,255,255,0.008) 4px
          );
          pointer-events: none;
        }

        /* ── Page shell ── */
        .hp-page {
          position: relative;
          z-index: 1;
          padding: 0;
        }

        /* ── HERO ── */
        .hp-hero {
          position: relative;
          min-height: 88vh;
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto 1fr;
          border-bottom: 1px solid var(--border);
          overflow: hidden;
        }
        .hp-hero::before {
          content: '';
          position: absolute;
          top: 0; bottom: 0;
          left: 50%;
          width: 1px;
          background: var(--border);
          z-index: 2;
        }
        @media (max-width: 900px) {
          .hp-hero { grid-template-columns: 1fr; min-height: auto; }
          .hp-hero::before { display: none; }
        }

        .hp-hero-left {
          grid-column: 1;
          grid-row: 1 / 3;
          padding: 56px 48px 56px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-right: 1px solid var(--border);
          position: relative;
        }
        @media (max-width: 900px) {
          .hp-hero-left { padding: 36px 20px; grid-column:1; grid-row:1; border-right:none; }
        }

        .hp-hero-right {
          grid-column: 2;
          grid-row: 1 / 3;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        @media (max-width: 900px) {
          .hp-hero-right { grid-column:1; grid-row:2; }
        }

        /* Tri stripe */
        .tri-stripe {
          height: 3px;
          flex-shrink: 0;
          background: linear-gradient(
            90deg,
            var(--red) 0%, var(--red) 33.33%,
            var(--purple) 33.33%, var(--purple) 66.66%,
            var(--blue) 66.66%, var(--blue) 100%
          );
        }

        /* Live badge */
        .hp-live-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          border: 1px solid var(--border2);
          background: var(--panel);
          padding: 6px 14px 6px 10px;
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }
        .live-pulse {
          width: 7px; height: 7px;
          border-radius: 50%;
          background: var(--red);
          box-shadow: 0 0 8px rgba(230,57,70,0.8);
          animation: pulse-glow 1.8s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* Big headline — uses display font (Syne) */
        .hp-headline {
          font-family: var(--font-display), ui-sans-serif, system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(40px, 5.5vw, 78px);
          text-transform: uppercase;
          line-height: 0.90;
          letter-spacing: -0.01em;
          color: #fff;
          margin: 0;
        }
        .hp-headline em {
          font-style: normal;
          background: linear-gradient(100deg, var(--red2) 0%, var(--purple-soft) 50%, var(--blue2) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* Subhead — uses body font (DM Mono) */
        .hp-subhead {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: clamp(10px, 1.1vw, 12px);
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          color: var(--muted2);
          line-height: 1.7;
          max-width: 400px;
        }

        /* Metric strip */
        .hp-metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          border-top: 1px solid var(--border);
          border-left: 1px solid var(--border);
        }
        .hp-metric {
          padding: 14px 16px;
          border-right: 1px solid var(--border);
          border-bottom: 1px solid var(--border);
          position: relative;
          overflow: hidden;
        }
        .hp-metric::before {
          content: '';
          position: absolute;
          top: 0; left: 0;
          width: 2px; height: 100%;
          background: var(--purple);
          opacity: 0.5;
        }
        .hp-metric-key {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.26em;
          color: var(--muted3);
          text-transform: uppercase;
        }
        .hp-metric-val {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: clamp(18px, 2vw, 24px);
          font-weight: 900;
          color: #fff;
          line-height: 1;
          margin-top: 4px;
          font-variant-numeric: tabular-nums;
          animation: count-up 0.6s cubic-bezier(0.22,1,0.36,1) both;
        }
        .hp-metric-delta {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.18em;
          color: var(--purple-soft);
          margin-top: 3px;
          text-transform: uppercase;
        }

        /* CTA row */
        .hp-cta-row {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
        }
        .hp-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 26px;
          background: var(--purple);
          border: 1px solid rgba(124,58,237,0.65);
          color: #fff;
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 140ms cubic-bezier(0.22,1,0.36,1);
          position: relative;
          overflow: hidden;
        }
        .hp-btn-primary::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
          transform: translateX(-100%);
          transition: transform 0.4s ease;
        }
        .hp-btn-primary:hover::before { transform: translateX(100%); }
        .hp-btn-primary:hover {
          background: var(--purple2);
          transform: translateY(-2px);
          box-shadow: 0 8px 30px rgba(124,58,237,0.35);
        }
        .hp-btn-ghost {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 13px 26px;
          background: transparent;
          border: 1px solid var(--border2);
          color: rgba(255,255,255,0.55);
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-decoration: none;
          transition: all 140ms cubic-bezier(0.22,1,0.36,1);
        }
        .hp-btn-ghost:hover {
          background: rgba(255,255,255,0.03);
          border-color: var(--border3);
          color: rgba(255,255,255,0.85);
        }

        /* ── RIGHT PANEL ── */
        .hp-right-panel {
          flex: 1;
          display: flex;
          flex-direction: column;
          background: var(--background2);
        }
        .hp-panel-header {
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .hp-panel-tag {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--purple-soft);
        }
        .hp-panel-status {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          letter-spacing: 0.22em;
          color: var(--muted3);
        }

        .hp-feature-list { flex: 1; overflow-y: auto; }
        .hp-feature {
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
          transition: background 140ms ease;
          position: relative;
        }
        .hp-feature:hover { background: rgba(255,255,255,0.015); }
        .hp-feature-tag {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 7.5px;
          font-weight: 700;
          letter-spacing: 0.26em;
          text-transform: uppercase;
          margin-bottom: 5px;
        }
        .hp-feature-title {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #fff;
          line-height: 1;
        }
        .hp-feature-sub {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 9.5px;
          letter-spacing: 0.10em;
          color: var(--muted3);
          margin-top: 5px;
          line-height: 1.5;
        }
        .hp-feature-bar-track {
          margin-top: 10px;
          height: 2px;
          background: var(--border);
          position: relative;
          overflow: hidden;
        }
        .hp-feature-bar-fill {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          animation: barGrow 1.2s cubic-bezier(0.22,1,0.36,1) 0.4s both;
        }
        .hp-feature-bar-fill[data-pct="78"] { --target: 78%; }
        .hp-feature-bar-fill[data-pct="55"] { --target: 55%; }
        .hp-feature-bar-fill[data-pct="62"] { --target: 62%; }
        .hp-feature-bar-fill[data-pct="89"] { --target: 89%; }
        .hp-feature-pct {
          position: absolute;
          right: 0; top: -16px;
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 7px;
          font-weight: 700;
          letter-spacing: 0.14em;
        }

        /* ── SECTION LABEL ── */
        .hp-section { border-bottom: 1px solid var(--border); }
        .hp-section-label {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.32em;
          text-transform: uppercase;
          color: var(--muted3);
          padding: 10px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--background2);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .hp-section-label::before {
          content: '';
          display: block;
          width: 18px; height: 1px;
          background: var(--purple-soft);
          opacity: 0.6;
        }

        /* ── CALLOUTS ── */
        .hp-callouts {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          border-top: 1px solid var(--border);
        }
        @media (max-width: 768px) {
          .hp-callouts { grid-template-columns: 1fr; }
        }
        .hp-callout {
          padding: 28px 24px;
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          gap: 12px;
          position: relative;
          overflow: hidden;
          transition: background 160ms ease;
        }
        .hp-callout:last-child { border-right: none; }
        .hp-callout:hover { background: var(--panel); }
        .hp-callout-icon { font-size: 22px; line-height: 1; }
        .hp-callout-label {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
        }
        .hp-callout-desc {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 10px;
          letter-spacing: 0.10em;
          color: var(--muted2);
          line-height: 1.6;
          flex: 1;
        }
        .hp-callout-link {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.22em;
          text-transform: uppercase;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: opacity 140ms ease;
          margin-top: auto;
          padding-top: 8px;
          border-top: 1px solid var(--border);
        }
        .hp-callout-link:hover { opacity: 0.75; }

        /* ── PROGRESS BAR ── */
        .hp-progress-section {
          padding: 24px;
          background: var(--panel);
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 20px;
          flex-wrap: wrap;
        }
        .hp-progress-label {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          font-weight: 700;
          letter-spacing: 0.28em;
          text-transform: uppercase;
          color: var(--purple-soft);
          white-space: nowrap;
        }
        .hp-progress-track {
          flex: 1;
          min-width: 120px;
          height: 3px;
          background: var(--border);
          position: relative;
          overflow: hidden;
        }
        .hp-progress-fill {
          position: absolute;
          top: 0; left: 0; bottom: 0;
          width: 62%;
          background: linear-gradient(90deg, var(--red), var(--purple), var(--blue));
          box-shadow: 0 0 12px rgba(124,58,237,0.5);
          animation: barGrow 1.5s cubic-bezier(0.22,1,0.36,1) 0.3s both;
          --target: 1%;
        }
        .hp-progress-pct {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 11px;
          font-weight: 900;
          letter-spacing: 0.06em;
          color: #fff;
          white-space: nowrap;
        }
        .hp-progress-note {
          font-family: var(--font-body), ui-monospace, 'Courier New', monospace;
          font-size: 8px;
          letter-spacing: 0.16em;
          color: var(--muted3);
        }
      `}</style>

      <div className="hp-bg" />

      <div className="hp-page">

        {/* ══════════════════════════════════
            HERO
        ══════════════════════════════════ */}
        <section className="hp-hero">

          {/* LEFT */}
          <div className="hp-hero-left">

            <div className="hp-animate-1">
              <div className="hp-live-badge">
                <div className="live-pulse" />
                BUILDING A LIVE NATIONAL DATABASE
                <span style={{ color: "var(--border3)", marginLeft: 4 }}>·</span>
                <span style={{ color: "var(--muted3)", letterSpacing: "0.22em" }}>DISCLOSURE-FIRST</span>
              </div>
            </div>

            <div style={{ margin: "28px 0 24px" }}>
              <div className="hp-animate-2">
                <p
                  style={{
                    fontFamily: "var(--font-body), ui-monospace, 'Courier New', monospace",
                    fontSize: "9px",
                    fontWeight: 700,
                    letterSpacing: "0.32em",
                    textTransform: "uppercase",
                    color: "var(--purple-soft)",
                    marginBottom: "14px",
                  }}
                >
                  PUBLIC SENTIMENT INSTITUTE
                </p>
              </div>

              <div className="hp-animate-2">
                <h1 className="hp-headline">
                  Measure<br />
                  What<br />
                  <em>America</em><br />
                  Believes
                </h1>
              </div>

              <div className="hp-animate-3">
                <p className="hp-subhead" style={{ marginTop: "20px" }}>
                  A living, continuously updated national dataset
                  capturing opinion by issue, region, demographic,
                  and time — built for transparency.
                </p>
              </div>
            </div>

            <div className="hp-animate-4">
              <div className="hp-metrics">
                {metrics.map((m, i) => (
                  <div key={m.k} className="hp-metric" style={{ animationDelay: `${0.4 + i * 0.08}s` }}>
                    <div className="hp-metric-key">{m.k}</div>
                    <div className="hp-metric-val">{m.v}</div>
                    <div className="hp-metric-delta">{m.delta}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hp-animate-5">
              <div className="hp-cta-row" style={{ marginTop: "24px" }}>
                <Link
                  href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                  className="hp-btn-primary"
                >
                  TAKE THE SURVEY →
                </Link>
                <Link href="/contact" className="hp-btn-ghost">
                  PARTNER WITH US
                </Link>
              </div>
            </div>

          </div>

          {/* RIGHT */}
          <div className="hp-hero-right">
            <div className="tri-stripe" />

            <div className="hp-right-panel">
              <div className="hp-panel-header">
                <span className="hp-panel-tag">◈ WHAT WE'RE BUILDING</span>
                <span className="hp-panel-status">PSI · v0.1 · ACTIVE</span>
              </div>

              <div className="hp-feature-list">
                {features.map((f, i) => (
                  <div key={f.title} className="hp-feature" style={{ animationDelay: `${0.3 + i * 0.1}s` }}>
                    <div className="hp-feature-tag" style={{ color: f.accent }}>
                      {f.tag}
                    </div>
                    <div className="hp-feature-title">{f.title}</div>
                    <div className="hp-feature-sub">{f.sub}</div>
                    <div className="hp-feature-bar-track">
                      <div style={{ position: "relative" }}>
                        <span
                          className="hp-feature-pct"
                          style={{ color: f.accent, position: "absolute", right: `${100 - f.pct}%`, top: "-14px" }}
                        >
                          {f.pct}%
                        </span>
                      </div>
                      <div
                        className="hp-feature-bar-fill"
                        data-pct={f.pct}
                        style={{
                          background: f.accent,
                          boxShadow: `0 0 8px ${f.glow}`,
                          width: `${f.pct}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                <div className="hp-progress-section">
                  <div className="hp-progress-label">DEPLOY STATUS</div>
                  <div className="hp-progress-track">
                    <div className="hp-progress-fill" />
                  </div>
                  <div className="hp-progress-pct">1%</div>
                  <div className="hp-progress-note">BUILDING · FIELDING · PUBLISHING</div>
                </div>
              </div>
            </div>
          </div>

        </section>

        {/* ══════════════════════════════════
            CALLOUTS
        ══════════════════════════════════ */}
        <section className="hp-animate-6">
          <div className="hp-section-label">GET INVOLVED</div>
          <div className="hp-callouts">
            {callouts.map((c) => (
              <div
                key={c.label}
                className="hp-callout"
                style={{ background: c.bg }}
              >
                <div style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: "2px",
                  background: c.color,
                  opacity: 0.65,
                }} />
                <div className="hp-callout-icon" style={{ color: c.color }}>{c.icon}</div>
                <div className="hp-callout-label" style={{ color: c.color }}>{c.label}</div>
                <div className="hp-callout-desc">{c.desc}</div>
                <Link href={c.href} className="hp-callout-link" style={{ color: c.color }}>
                  {c.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

      </div>
    </>
  );
}