// app/methodology/gold-standard-pollsters/page.tsx
"use client";

import Link from "next/link";
import React, { useState } from "react";

type Pollster = {
  name: string;
  abbr: string;
  website: string;
  why: string[];
  standards: string[];
  multiplier: number;
  note: string;
  transparency: {
    fieldDates: boolean;
    sampleType: boolean;
    sampleSize: boolean;
    methodology: boolean;
    sponsorDisclosure: boolean;
  };
};

const POLLSTERS: Pollster[] = [
  {
    name: "Big Data Poll",
    abbr: "BDP",
    website: "https://bigdatapoll.com",
    why: [
      "Pioneer in online data collection since 2016; developed methodology to eliminate response bias.",
      "Consistent performance and recognizable house style across multiple electoral cycles.",
      "Demonstrated strong understanding of the Trump coalition and modern polling dynamics.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population (A/RV/LV) and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "PSI upweight for Gold Standard pollsters.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Rasmussen Reports",
    abbr: "RAS",
    website: "https://www.rasmussenreports.com",
    why: [
      "High-frequency daily tracking ideal for time-series modeling and trend detection.",
      "Asks questions many firms avoid, creating additional signal for sentiment measurement.",
      "Leadership emphasizes issue salience and continuous public feedback loops.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Gold Standard upweight; PSI may cap impact depending on documentation/mode considerations.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "AtlasIntel",
    abbr: "ATL",
    website: "https://atlasintel.org",
    why: [
      "Strong performance in recent cycles across both national and swing-state environments.",
      "Publishes politician approvals and trendable releases suitable for aggregation.",
      "Often provides high-signal readings when documentation is present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Full Gold Standard upweight when documentation is present.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "SoCalStrategies",
    abbr: "SCS",
    website: "https://socalpoll.com",
    why: [
      "Demonstrated accuracy in the Wisconsin Supreme Court race (April 2025).",
      "Competitive performance vs. industry in NJ/VA gubernatorial contexts (2025) per PSI review.",
      "Newer pollster with strong early performance across select environments.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional Gold Standard upweight: requires PSI minimum disclosure items to apply.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Emerson College Polling",
    abbr: "EMR",
    website: "https://emersoncollegepolling.com",
    why: [
      "Longstanding, widely-cited pollster with consistent reporting format across years.",
      "Broad national and state coverage suitable for multi-environment aggregation.",
      "Historically competitive accuracy vs. industry averages across multiple cycles.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Gold Standard upweight; PSI may adjust depending on project mode/field method details.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Trafalgar Group",
    abbr: "TFG",
    website: "https://www.thetrafalgargroup.org",
    why: [
      "Historically competitive performance in select cycles per PSI review.",
      "Recognizable approach and consistent structure across election environments.",
      "Adds methodological diversity to aggregates when disclosures are present.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight; PSI may cap impact if documentation is thin.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "InsiderAdvantage",
    abbr: "IA",
    website: "https://insideradvantage.com",
    why: [
      "Often produces timely reads with clear toplines for rapid trend updates.",
      "Useful short-window signal contributor for daily tracking cycles.",
      "Included for PSI upweighting when disclosure meets minimum standards.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight: requires minimum disclosure items to be present.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
  {
    name: "Patriot Polling",
    abbr: "PAT",
    website: "https://patriotpolling.com",
    why: [
      "Performed well in PSI review of 2024 national and state-level releases.",
      "Produces structured releases that are easy to audit and aggregate.",
      "Timely field windows with consistent topline reporting format.",
    ],
    standards: [
      "Publishes field dates + sample size",
      "States target population and mode",
      "Provides toplines in consistent format",
    ],
    multiplier: 2,
    note: "Conditional upweight: requires minimum disclosure items to be present.",
    transparency: { fieldDates: true, sampleType: true, sampleSize: true, methodology: true, sponsorDisclosure: false },
  },
];

const CRITERIA = [
  {
    code: "ACC",
    label: "Accuracy",
    items: [
      "Repeatable performance across electoral environments",
      "Stable, trackable readings suitable for time-series modeling",
      "No extreme methodological drift without disclosure",
    ],
  },
  {
    code: "TRN",
    label: "Transparency",
    items: [
      "Field dates and sample size published",
      "Defined universe (A/RV/LV) and mode when available",
      "Sponsor disclosure and/or full release notes when applicable",
    ],
  },
  {
    code: "STD",
    label: "Standards",
    items: [
      "Clear toplines and consistent formatting across releases",
      "Question wording consistency preferred for trackers",
      "Auditable, public-facing or verifiable releases",
    ],
  },
];

const DISC_LABELS: Record<keyof Pollster["transparency"], string> = {
  fieldDates: "Field Dates",
  sampleSize: "Sample Size",
  sampleType: "Sample Type",
  methodology: "Methodology",
  sponsorDisclosure: "Sponsor",
};

export default function GoldStandardPollstersPage() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      <style>{CSS}</style>
      <div className="gs-root">
        <div className="gs-stripe" />

        {/* ── HERO ── */}
        <div className="gs-hero">
          <div className="gs-stripe" />
          <div className="gs-hero-inner">
            <div>
              <div className="gs-eyebrow">PSI Methodology · Pollster Weighting</div>
              <h1 className="gs-hero-title">
                Gold Standard<br />
                <em className="gs-em">Pollsters</em>
              </h1>
              <p className="gs-hero-desc">
                PSI designates a curated set of pollsters as Gold Standard when they meet criteria for
                consistency, transparency, and real-world accuracy in tracking public sentiment.
                Gold Standard polls receive a ×2 upweight in all PSI daily averages.
              </p>
              <div className="gs-badge-row">
                <span className="gs-badge gs-badge-gold">★ ×2 UPWEIGHT IN ALL PSI AVERAGES</span>
                <span className="gs-badge gs-badge-purple">{POLLSTERS.length} DESIGNATED POLLSTERS</span>
                <Link href="/methodology" className="gs-badge gs-badge-link">← BACK TO METHODOLOGY</Link>
              </div>
            </div>
            <div className="gs-hero-stats">
              {[
                { label: "POLLSTERS", val: `${POLLSTERS.length}` },
                { label: "UPWEIGHT", val: "×2.00" },
                { label: "EFF. √N",  val: "×2.00" },
              ].map(({ label, val }) => (
                <div key={label} className="gs-stat">
                  <div className="gs-stat-label">{label}</div>
                  <div className="gs-stat-val">{val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── CRITERIA ── */}
        <div className="gs-section-label">DESIGNATION CRITERIA</div>
        <div className="gs-criteria-grid">
          {CRITERIA.map((c) => (
            <div key={c.code} className="gs-criteria-card">
              <div className="gs-criteria-code">{c.code}</div>
              <div className="gs-criteria-title">{c.label}</div>
              <div className="gs-divider" />
              <ul className="gs-criteria-list">
                {c.items.map((item, i) => (
                  <li key={i}>
                    <span className="gs-criteria-dot" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* ── WEIGHTING NOTE ── */}
        <div className="gs-note-panel">
          <div className="gs-note-icon">∑</div>
          <div>
            <div className="gs-note-title">HOW UPWEIGHTING WORKS</div>
            <p className="gs-note-body">
              Gold Standard pollsters receive an effective sample size inflation of n′ = n × (m²) where m = 2,
              so √n′ = 2 × √n. This means their contribution to the daily weighted average is doubled relative to
              standard pollsters of equivalent raw sample size. The upweight applies only when PSI minimum
              disclosure items (field dates, sample size, sample type) are present in the release.
            </p>
          </div>
        </div>

        {/* ── POLLSTER LIST ── */}
        <div className="gs-section-label">DESIGNATED POLLSTERS</div>
        <div className="gs-table-panel">
          <div className="gs-stripe" />
          <div className="gs-table-head">
            <span className="gs-table-head-title">ALL GOLD STANDARD POLLSTERS</span>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span className="gs-badge gs-badge-gold">★ ALL RECEIVE ×2 UPWEIGHT</span>
              <span className="gs-table-head-note">CLICK ROW TO EXPAND</span>
            </div>
          </div>

          <div className="gs-pollster-list">
            {POLLSTERS.map((p, idx) => {
              const isOpen = expanded === p.name;
              const discKeys = Object.keys(p.transparency) as Array<keyof typeof p.transparency>;
              const metCount = discKeys.filter((k) => p.transparency[k]).length;

              return (
                <div
                  key={p.name}
                  className={`gs-pollster-row ${isOpen ? "gs-pollster-row--open" : ""}`}
                  onClick={() => setExpanded(isOpen ? null : p.name)}
                >
                  {/* Row header */}
                  <div className="gs-pollster-header">
                    <div className="gs-pollster-index">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="gs-pollster-abbr">{p.abbr}</div>
                    <div className="gs-pollster-name">
                      {p.name}
                      <span className="gs-gold-badge">GOLD</span>
                    </div>
                    <div className="gs-pollster-meta">
                      <span className="gs-pollster-disc-count">{metCount}/{discKeys.length} DISCLOSURE</span>
                      <span className="gs-pollster-weight">×{p.multiplier}.00</span>
                    </div>
                    {/* Disclosure mini-dots */}
                    <div className="gs-disc-dots">
                      {discKeys.map((k) => (
                        <span
                          key={k}
                          className={`gs-disc-dot ${p.transparency[k] ? "gs-disc-dot--on" : "gs-disc-dot--off"}`}
                          title={DISC_LABELS[k]}
                        />
                      ))}
                    </div>
                    <div className="gs-pollster-chevron">{isOpen ? "▲" : "▼"}</div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="gs-pollster-detail" onClick={(e) => e.stopPropagation()}>
                      <div className="gs-divider" />
                      <div className="gs-detail-grid">
                        {/* Why included */}
                        <div>
                          <div className="gs-detail-section-label">WHY PSI INCLUDES IT</div>
                          <ul className="gs-why-list">
                            {p.why.map((w, i) => (
                              <li key={i}>
                                <span className="gs-why-num">{String(i + 1).padStart(2, "0")}</span>
                                {w}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Right col */}
                        <div className="gs-detail-right">
                          {/* Disclosure breakdown */}
                          <div>
                            <div className="gs-detail-section-label">DISCLOSURE CHECKLIST</div>
                            <div className="gs-disc-list">
                              {discKeys.map((k) => (
                                <div key={k} className="gs-disc-item">
                                  <span className={`gs-disc-status ${p.transparency[k] ? "gs-disc-status--yes" : "gs-disc-status--no"}`}>
                                    {p.transparency[k] ? "✓" : "✗"}
                                  </span>
                                  <span className="gs-disc-item-label">{DISC_LABELS[k]}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Weighting note */}
                          <div>
                            <div className="gs-detail-section-label">WEIGHTING NOTE</div>
                            <p className="gs-note-small">{p.note}</p>
                          </div>

                          {/* Link */}
                          <a
                            href={p.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="gs-website-link"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {new URL(p.website).hostname.replace(/^www\./, "")} ↗
                          </a>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── DISCLOSURE KEY ── */}
        <div className="gs-disclosure-key">
          <div className="gs-disclosure-key-title">DISCLOSURE KEY</div>
          <div className="gs-disclosure-key-items">
            {Object.entries(DISC_LABELS).map(([k, label]) => (
              <div key={k} className="gs-disclosure-key-item">
                <span className="gs-disc-dot gs-disc-dot--on" />
                <span>{label}</span>
              </div>
            ))}
            <div className="gs-disclosure-key-item">
              <span className="gs-disc-dot gs-disc-dot--off" />
              <span>Not documented / not required</span>
            </div>
          </div>
        </div>

        {/* ── CTA ── */}
        <div className="gs-cta">
          <div className="gs-stripe" />
          <div className="gs-cta-inner">
            <div>
              <div className="gs-cta-title">WANT PSI TO REVIEW A POLLSTER?</div>
              <p className="gs-cta-body">
                If you have a release with field dates, sample details, and documentation, send it over.
                We review all submissions against the criteria above.
              </p>
            </div>
            <Link href="/contact" className="gs-cta-btn">
              CONTACT PSI →
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}

const CSS = `
  .gs-root {
    --bg:          #070709;
    --bg2:         #0b0b0f;
    --panel:       #0f0f15;
    --border:      rgba(255,255,255,0.09);
    --border2:     rgba(255,255,255,0.18);
    --muted:       rgba(240,240,245,0.62);
    --muted2:      rgba(240,240,245,0.40);
    --muted3:      rgba(240,240,245,0.22);
    --purple:      #7c3aed;
    --purple-soft: #a78bfa;
    --gold:        #f59e0b;
    --gold-soft:   rgba(245,158,11,0.85);
    --green:       rgba(34,197,94,0.9);
    --red:         rgba(239,68,68,0.9);
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: gs-fade-up 0.45s cubic-bezier(0.22,1,0.36,1) both;
  }

  @keyframes gs-fade-up {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }

  /* STRIPE */
  .gs-stripe {
    height: 3px;
    background: linear-gradient(90deg,
      var(--gold) 0%, var(--gold) 33%,
      var(--purple) 33%, var(--purple) 66%,
      rgba(255,255,255,0.15) 66%, rgba(255,255,255,0.15) 100%
    );
  }

  /* EYEBROW */
  .gs-eyebrow {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: 8px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--gold-soft);
    margin-bottom: 12px;
    display: flex; align-items: center; gap: 10px;
  }
  .gs-eyebrow::before {
    content: '';
    display: inline-block; width: 16px; height: 1px;
    background: var(--gold-soft); opacity: 0.6;
  }

  /* HERO */
  .gs-hero {
    border: 1px solid var(--border);
    background: var(--panel);
    position: relative; overflow: hidden;
  }
  .gs-hero::before {
    content: '';
    position: absolute; inset: 0;
    background:
      radial-gradient(ellipse 50% 120% at 0% 50%, rgba(245,158,11,0.05) 0%, transparent 60%),
      radial-gradient(ellipse 40% 80% at 100% 50%, rgba(124,58,237,0.05) 0%, transparent 60%),
      repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(255,255,255,0.005) 3px, rgba(255,255,255,0.005) 4px);
    pointer-events: none;
  }
  .gs-hero-inner {
    position: relative;
    padding: 28px 30px 26px;
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: end;
    gap: 24px;
  }
  @media (max-width: 640px) { .gs-hero-inner { grid-template-columns: 1fr; } }

  .gs-hero-title {
    font-family: ui-monospace,'Courier New',monospace;
    font-size: clamp(26px,4vw,52px);
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    line-height: 0.9;
    color: #fff;
    margin: 0 0 16px;
  }
  .gs-em {
    font-style: normal;
    background: linear-gradient(110deg, var(--gold), rgba(251,191,36,0.7));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .gs-hero-desc {
    font-family: ui-monospace,monospace;
    font-size: 9.5px; letter-spacing: 0.12em; line-height: 1.8;
    color: var(--muted2); text-transform: uppercase; max-width: 540px;
  }
  .gs-badge-row {
    display: flex; flex-wrap: wrap; gap: 6px; margin-top: 18px;
  }
  .gs-badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 3px 9px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.03);
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--muted3);
    text-decoration: none;
  }
  .gs-badge-gold {
    border-color: rgba(245,158,11,0.35);
    background: rgba(245,158,11,0.07);
    color: var(--gold-soft);
  }
  .gs-badge-purple {
    border-color: rgba(124,58,237,0.35);
    background: rgba(124,58,237,0.07);
    color: var(--purple-soft);
  }
  .gs-badge-link {
    border-color: rgba(255,255,255,0.12);
    color: var(--muted2);
    transition: background 120ms;
  }
  .gs-badge-link:hover { background: rgba(255,255,255,0.06); }

  /* HERO STATS */
  .gs-hero-stats {
    display: flex; flex-direction: column; gap: 6px; min-width: 140px;
  }
  .gs-stat {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 10px 14px;
    border: 1px solid var(--border);
    background: rgba(255,255,255,0.025);
  }
  .gs-stat-label {
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700; letter-spacing: 0.28em;
    text-transform: uppercase; color: var(--muted3);
  }
  .gs-stat-val {
    font-family: ui-monospace,monospace;
    font-size: 18px; font-weight: 900;
    color: var(--gold-soft);
    font-variant-numeric: tabular-nums;
  }

  /* SECTION LABEL */
  .gs-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; font-weight: 700;
    letter-spacing: 0.32em; text-transform: uppercase;
    color: var(--muted3);
    display: flex; align-items: center; gap: 10px;
    margin-bottom: 12px;
  }
  .gs-section-label::before { content:''; width:20px; height:1px; background:var(--gold-soft); opacity:0.5; }
  .gs-section-label::after  { content:''; flex:1; height:1px; background:var(--border); }

  /* DIVIDER */
  .gs-divider {
    height: 1px; background: var(--border); margin: 14px 0;
  }

  /* CRITERIA */
  .gs-criteria-grid {
    display: grid; grid-template-columns: repeat(3,1fr); gap: 8px;
  }
  @media (max-width: 760px) { .gs-criteria-grid { grid-template-columns: 1fr; } }

  .gs-criteria-card {
    background: var(--panel);
    border: 1px solid var(--border);
    padding: 20px 22px;
    position: relative; overflow: hidden;
    transition: border-color 150ms;
  }
  .gs-criteria-card:hover { border-color: rgba(245,158,11,0.25); }
  .gs-criteria-card::before {
    content: '';
    position: absolute; top: 0; left: 0; right: 0; height: 2px;
    background: linear-gradient(90deg, var(--gold), transparent);
  }
  .gs-criteria-code {
    font-family: ui-monospace,monospace;
    font-size: 32px; font-weight: 900;
    color: rgba(245,158,11,0.12);
    letter-spacing: -0.02em;
    line-height: 1; margin-bottom: 4px;
  }
  .gs-criteria-title {
    font-family: ui-monospace,monospace;
    font-size: 11px; font-weight: 800;
    letter-spacing: 0.26em; text-transform: uppercase;
    color: rgba(255,255,255,0.85);
    margin-bottom: 2px;
  }
  .gs-criteria-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 8px;
  }
  .gs-criteria-list li {
    display: flex; align-items: flex-start; gap: 8px;
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.09em; line-height: 1.6;
    color: var(--muted2);
  }
  .gs-criteria-dot {
    display: inline-block; width: 4px; height: 4px;
    background: var(--gold-soft); border-radius: 50%;
    margin-top: 5px; flex-shrink: 0;
  }

  /* NOTE PANEL */
  .gs-note-panel {
    border: 1px solid rgba(245,158,11,0.2);
    background: rgba(245,158,11,0.03);
    padding: 20px 24px;
    display: flex; gap: 20px; align-items: flex-start;
  }
  .gs-note-icon {
    font-family: ui-monospace,monospace;
    font-size: 32px; font-weight: 900;
    color: rgba(245,158,11,0.3);
    line-height: 1; flex-shrink: 0;
  }
  .gs-note-title {
    font-family: ui-monospace,monospace;
    font-size: 8px; font-weight: 800;
    letter-spacing: 0.3em; text-transform: uppercase;
    color: var(--gold-soft); margin-bottom: 8px;
  }
  .gs-note-body {
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.09em; line-height: 1.8;
    color: var(--muted2); margin: 0;
  }

  /* TABLE PANEL */
  .gs-table-panel {
    background: var(--panel);
    border: 1px solid var(--border);
    overflow: hidden;
  }
  .gs-table-head {
    background: var(--bg2);
    border-bottom: 1px solid var(--border);
    padding: 14px 20px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap;
  }
  .gs-table-head-title {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    letter-spacing: 0.26em; text-transform: uppercase;
    color: var(--gold-soft);
  }
  .gs-table-head-note {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.20em;
    text-transform: uppercase; color: var(--muted3);
  }

  /* POLLSTER LIST */
  .gs-pollster-list {
    display: flex; flex-direction: column;
  }
  .gs-pollster-row {
    border-bottom: 1px solid rgba(255,255,255,0.04);
    cursor: pointer;
    transition: background 100ms;
  }
  .gs-pollster-row:hover { background: rgba(245,158,11,0.025); }
  .gs-pollster-row--open { background: rgba(245,158,11,0.03); border-bottom-color: rgba(245,158,11,0.1); }
  .gs-pollster-row:last-child { border-bottom: none; }

  .gs-pollster-header {
    display: grid;
    grid-template-columns: 36px 52px 1fr auto 60px 20px;
    align-items: center;
    gap: 12px;
    padding: 14px 20px;
  }
  @media (max-width: 640px) {
    .gs-pollster-header {
      grid-template-columns: 32px 44px 1fr 20px;
    }
    .gs-pollster-meta, .gs-disc-dots { display: none; }
  }

  .gs-pollster-index {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 700;
    color: var(--muted3); letter-spacing: 0.1em;
  }
  .gs-pollster-abbr {
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 900;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: var(--gold-soft);
    padding: 2px 6px;
    border: 1px solid rgba(245,158,11,0.25);
    background: rgba(245,158,11,0.05);
    text-align: center;
  }
  .gs-pollster-name {
    font-family: ui-monospace,monospace;
    font-size: 11.5px; font-weight: 700;
    color: rgba(255,255,255,0.88);
    display: flex; align-items: center; gap: 10px;
  }
  .gs-gold-badge {
    display: inline-flex; align-items: center;
    padding: 1px 6px;
    border: 1px solid rgba(245,158,11,0.3);
    background: rgba(245,158,11,0.07);
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 700;
    letter-spacing: 0.18em; text-transform: uppercase;
    color: var(--gold-soft);
  }
  .gs-pollster-meta {
    display: flex; flex-direction: column; align-items: flex-end; gap: 2px;
  }
  .gs-pollster-disc-count {
    font-family: ui-monospace,monospace;
    font-size: 7.5px; letter-spacing: 0.16em;
    color: var(--muted3);
  }
  .gs-pollster-weight {
    font-family: ui-monospace,monospace;
    font-size: 12px; font-weight: 900;
    color: var(--gold-soft);
  }
  .gs-disc-dots {
    display: flex; gap: 4px; align-items: center;
  }
  .gs-disc-dot {
    display: inline-block; width: 8px; height: 8px; border-radius: 50%;
  }
  .gs-disc-dot--on  { background: rgba(34,197,94,0.85); box-shadow: 0 0 4px rgba(34,197,94,0.4); }
  .gs-disc-dot--off { background: rgba(255,255,255,0.12); }
  .gs-pollster-chevron {
    font-family: ui-monospace,monospace;
    font-size: 8px; color: var(--muted3);
    text-align: right;
  }

  /* EXPANDED DETAIL */
  .gs-pollster-detail {
    padding: 0 20px 20px;
    cursor: default;
  }
  .gs-detail-grid {
    display: grid; grid-template-columns: 1fr 280px; gap: 24px;
    margin-top: 16px;
  }
  @media (max-width: 760px) { .gs-detail-grid { grid-template-columns: 1fr; } }

  .gs-detail-section-label {
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 800;
    letter-spacing: 0.3em; text-transform: uppercase;
    color: rgba(245,158,11,0.6); margin-bottom: 10px;
  }
  .gs-why-list {
    list-style: none; padding: 0; margin: 0;
    display: flex; flex-direction: column; gap: 10px;
  }
  .gs-why-list li {
    display: flex; gap: 12px;
    font-family: ui-monospace,monospace;
    font-size: 9.5px; letter-spacing: 0.08em; line-height: 1.7;
    color: var(--muted);
  }
  .gs-why-num {
    font-family: ui-monospace,monospace;
    font-size: 8px; font-weight: 900;
    color: rgba(245,158,11,0.4);
    flex-shrink: 0; margin-top: 1px;
  }

  .gs-detail-right {
    display: flex; flex-direction: column; gap: 16px;
  }
  .gs-disc-list {
    display: flex; flex-direction: column; gap: 6px;
  }
  .gs-disc-item {
    display: flex; align-items: center; gap: 8px;
  }
  .gs-disc-status {
    font-family: ui-monospace,monospace;
    font-size: 10px; font-weight: 900; width: 14px;
    flex-shrink: 0;
  }
  .gs-disc-status--yes { color: rgba(34,197,94,0.85); }
  .gs-disc-status--no  { color: rgba(255,255,255,0.2); }
  .gs-disc-item-label {
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.12em;
    color: var(--muted2);
  }
  .gs-note-small {
    font-family: ui-monospace,monospace;
    font-size: 8.5px; letter-spacing: 0.08em; line-height: 1.7;
    color: var(--muted3); margin: 0;
  }
  .gs-website-link {
    display: inline-flex; align-items: center;
    font-family: ui-monospace,monospace;
    font-size: 8.5px; font-weight: 700; letter-spacing: 0.18em;
    color: var(--gold-soft);
    text-decoration: none;
    padding: 5px 10px;
    border: 1px solid rgba(245,158,11,0.25);
    background: rgba(245,158,11,0.04);
    transition: background 120ms;
    text-transform: uppercase;
    align-self: flex-start;
  }
  .gs-website-link:hover { background: rgba(245,158,11,0.1); }

  /* DISCLOSURE KEY */
  .gs-disclosure-key {
    display: flex; align-items: center; gap: 20px; flex-wrap: wrap;
    padding: 12px 18px;
    border: 1px solid var(--border);
    background: var(--panel);
  }
  .gs-disclosure-key-title {
    font-family: ui-monospace,monospace;
    font-size: 7px; font-weight: 800; letter-spacing: 0.3em;
    text-transform: uppercase; color: var(--muted3);
    white-space: nowrap;
  }
  .gs-disclosure-key-items {
    display: flex; flex-wrap: wrap; gap: 12px;
  }
  .gs-disclosure-key-item {
    display: flex; align-items: center; gap: 6px;
    font-family: ui-monospace,monospace;
    font-size: 8px; letter-spacing: 0.1em; color: var(--muted3);
  }

  /* CTA */
  .gs-cta {
    background: var(--panel);
    border: 1px solid rgba(245,158,11,0.2);
    overflow: hidden;
  }
  .gs-cta-inner {
    padding: 24px 28px;
    display: flex; align-items: center; justify-content: space-between;
    gap: 20px; flex-wrap: wrap;
  }
  .gs-cta-title {
    font-family: ui-monospace,monospace;
    font-size: 11px; font-weight: 900; letter-spacing: 0.22em;
    text-transform: uppercase; color: rgba(255,255,255,0.88);
    margin-bottom: 8px;
  }
  .gs-cta-body {
    font-family: ui-monospace,monospace;
    font-size: 9px; letter-spacing: 0.1em; line-height: 1.7;
    color: var(--muted2); margin: 0; max-width: 480px;
  }
  .gs-cta-btn {
    display: inline-flex; align-items: center;
    padding: 10px 20px;
    border: 1px solid rgba(245,158,11,0.4);
    background: rgba(245,158,11,0.08);
    font-family: ui-monospace,monospace;
    font-size: 9px; font-weight: 800; letter-spacing: 0.22em;
    text-transform: uppercase; color: var(--gold-soft);
    text-decoration: none;
    transition: background 150ms, border-color 150ms;
    white-space: nowrap;
  }
  .gs-cta-btn:hover {
    background: rgba(245,158,11,0.15);
    border-color: rgba(245,158,11,0.6);
  }

  @media (prefers-reduced-motion: reduce) {
    .gs-root { animation: none !important; }
  }
`;