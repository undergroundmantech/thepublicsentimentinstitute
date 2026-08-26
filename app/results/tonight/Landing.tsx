"use client";

/**
 * ELECTIONS LANDING — the standing /results/tonight surface.
 *
 * Sits here between election nights. The primary-night boards it replaced stay
 * live and unchanged at /results/archive/2026-08-04 (Michigan et al),
 * /results/archive/2026-08-18 (Florida, Wyoming, Alaska) and
 * /results/archive/2026-08-25 (Oklahoma, South Carolina, Georgia runoffs).
 * Built in those boards' design language: same `.desk` shell, tokens, mono
 * chrome and card anatomy, so nothing about the visual system changes.
 *
 * The hero advertises the next election on the calendar. When that night
 * arrives, point NEXT_ELECTION at its board and the countdown/CTA follow.
 */

import React, { useEffect, useState } from "react";

const NEXT_ELECTION = {
  kicker: "Next election",
  state: "Nationwide",
  date: "Tuesday, November 3, 2026",
  iso: "2026-11-03T19:00:00-05:00",
  title: "2026 Midterm General Election",
  deck:
    "The whole House, a third of the Senate and 36 governorships. TPSI race ratings " +
    "are live now; the forecast model and the election night board follow as the " +
    "calendar closes in. First polls close at 7:00 PM ET.",
  cta: { href: "/forecastratings", label: "See the 2026 race ratings" },
  stats: [
    { k: "House seats", v: "435" },
    { k: "Senate seats", v: "35" },
    { k: "Governorships", v: "36" },
    { k: "First polls close", v: "7:00 PM ET" },
  ],
};

const ARCHIVE = [
  {
    href: "/results/archive/2026-08-25",
    date: "August 25, 2026",
    label: "Oklahoma, South Carolina & Georgia runoffs",
    note: "County forecast · Oklahoma governor Republican runoff, called for Mazzei by 2,047",
  },
  {
    href: "/results/archive/2026-08-18",
    date: "August 18, 2026",
    label: "Florida, Wyoming & Alaska primaries",
    note: "Spotlight forecast · Florida Republican gubernatorial primary",
  },
  {
    href: "/results/archive/2026-08-04",
    date: "August 4, 2026",
    label: "Michigan, Missouri, Kansas, Virginia & Washington primaries",
    note: "Level 2 statewide forecast · Michigan U.S. Senate Democratic primary",
  },
];

const ELSEWHERE = [
  { href: "/floridaprimary", label: "Florida GOP Primary", note: "Interactive scenario engine · all 67 counties" },
  { href: "/forecastratings", label: "2026 Race Ratings", note: "Senate & governor competitiveness" },
  { href: "/electoralmap", label: "Electoral Map", note: "Build your own map" },
  { href: "/results/archive", label: "Results by date", note: "Browse every tracked night" },
];

function useCountdown(iso: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(new Date(iso).getTime() - Date.now());
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

function formatLeft(ms: number | null) {
  if (ms == null) return "—";
  if (ms <= 0) return "Polls open";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  return `${h}h ${m}m ${s % 60}s`;
}

export default function ElectionsLanding() {
  const left = useCountdown(NEXT_ELECTION.iso);

  return (
    <div className="desk">
      <style>{CSS}</style>

      <main className="shell">
        <section className="hero">
          <div className="hero-kicker">
            <span className="live-dot" aria-hidden />
            <span>{NEXT_ELECTION.kicker}</span>
            <span>•</span>
            <span>{NEXT_ELECTION.state}</span>
          </div>

          <div className="hero-body">
            <div className="hero-copy">
              <div className="hero-date">{NEXT_ELECTION.date}</div>
              <h1>{NEXT_ELECTION.title}</h1>
              <p className="prose">{NEXT_ELECTION.deck}</p>
              <a className="hero-cta" href={NEXT_ELECTION.cta.href}>
                {NEXT_ELECTION.cta.label} →
              </a>
            </div>

            <aside className="hero-clock" aria-label="Time until polls close">
              <span>Polls close in</span>
              <b>{formatLeft(left)}</b>
              <small>Election night coverage begins here</small>
            </aside>
          </div>

          <div className="hero-stats">
            {NEXT_ELECTION.stats.map((s) => (
              <div className="hero-stat" key={s.k}>
                <span>{s.k}</span>
                <b>{s.v}</b>
              </div>
            ))}
          </div>
        </section>

        <section className="card block" aria-labelledby="archive-title">
          <div className="block-head">
            <h2 id="archive-title">Past election nights</h2>
            <p>Archived boards stay live, with the certified final numbers.</p>
          </div>
          {ARCHIVE.map((a) => (
            <a className="listrow" href={a.href} key={a.href}>
              <div className="listrow-copy">
                <strong>{a.date}</strong>
                <small>{a.label}</small>
                <span>{a.note}</span>
              </div>
              <span className="listrow-go" aria-hidden>→</span>
            </a>
          ))}
        </section>

        <section className="card block" aria-labelledby="else-title">
          <div className="block-head">
            <h2 id="else-title">Elsewhere on the desk</h2>
            <p>Forecasts, maps and models between election nights.</p>
          </div>
          <div className="tilegrid">
            {ELSEWHERE.map((e) => (
              <a className="tile" href={e.href} key={e.href}>
                <strong>{e.label}</strong>
                <small>{e.note}</small>
              </a>
            ))}
          </div>
        </section>

        <div className="landing-foot">
          <span>The Public Sentiment Institute</span>
          <span>Election coverage</span>
        </div>
      </main>
    </div>
  );
}

/* Tokens, type scale and card anatomy are the August 4 board's, so this page
   reads as the same product. Surfaces/ink/party colors come from globals.css,
   which is what makes light and dark work without a second palette here. */
const CSS = `
.desk{
  --mono:var(--font-numeric,'JetBrains Mono'),ui-monospace,monospace;
  --sans:var(--font-body,'Geist'),system-ui,sans-serif;
  --r-panel:14px; --r-card:10px; --r-pill:999px;
  color:var(--ink);min-height:100vh;font-family:var(--sans);
  -webkit-font-smoothing:antialiased;
}
.desk *{margin:0;padding:0;box-sizing:border-box}
.desk a{text-decoration:none;color:inherit}
.desk h1,.desk h2{font-family:var(--sans);font-weight:800;letter-spacing:-.028em}
.desk .prose{font-family:var(--sans);line-height:1.6}

.shell{max-width:1180px;margin:0 auto;padding:26px 22px 70px}

/* hero */
.hero{padding-bottom:22px;border-bottom:1px solid var(--hairline)}
.hero-kicker{display:flex;align-items:center;gap:9px;flex-wrap:wrap;
  font-family:var(--mono);font-weight:700;font-size:8px;letter-spacing:.11em;
  text-transform:uppercase;color:var(--ink3)}
.live-dot{width:7px;height:7px;border-radius:50%;background:var(--live);
  animation:dpulse 1.7s infinite;flex:0 0 auto}
@keyframes dpulse{50%{opacity:.3}}
.hero-body{display:flex;justify-content:space-between;gap:32px;align-items:flex-start;
  margin-top:14px;flex-wrap:wrap}
.hero-copy{flex:1 1 420px;min-width:0}
.hero-date{font-family:var(--mono);font-size:10px;font-weight:700;letter-spacing:.11em;
  text-transform:uppercase;color:var(--gold);margin-bottom:8px}
.hero h1{font-size:clamp(24px,3.2vw,40px);line-height:1.1}
.hero .prose{font-size:14px;color:var(--ink2);max-width:620px;margin-top:11px}
/* .desk a sets color:inherit at (0,1,1), so this needs the .desk prefix to win. */
.desk .hero-cta{display:inline-block;margin-top:18px;padding:10px 18px;border-radius:var(--r-pill);
  background:var(--ink);color:var(--canvas);font-size:12px;font-weight:700;
  letter-spacing:.02em;transition:opacity 140ms ease}
.desk .hero-cta:hover{opacity:.86}
.hero-clock{flex:0 0 auto;min-width:190px;padding:15px 17px;border-radius:var(--r-panel);
  background:var(--panel);border:1px solid var(--hairline)}
.hero-clock span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.hero-clock b{display:block;font-family:var(--mono);font-size:26px;font-weight:800;
  letter-spacing:-.03em;margin-top:6px;font-variant-numeric:tabular-nums}
.hero-clock small{display:block;font-size:11px;color:var(--ink3);margin-top:7px;line-height:1.5}
.hero-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));
  gap:14px 26px;margin-top:22px}
.hero-stat span{display:block;font-family:var(--mono);font-size:8px;font-weight:700;
  letter-spacing:.11em;text-transform:uppercase;color:var(--ink3)}
.hero-stat b{display:block;font-family:var(--mono);font-size:17px;font-weight:800;
  letter-spacing:-.02em;margin-top:3px;font-variant-numeric:tabular-nums}

/* blocks */
.card{background:var(--panel);border:1px solid var(--hairline);border-radius:var(--r-panel);
  overflow:hidden}
.block{margin-top:20px}
.block-head{padding:16px 18px 13px;border-bottom:1px solid var(--hairline)}
.block-head h2{font-size:19px;line-height:1.14}
.block-head p{font-size:11.5px;color:var(--ink2);margin-top:5px}

.listrow{display:flex;align-items:center;justify-content:space-between;gap:16px;
  padding:14px 18px;border-bottom:1px solid var(--hairline);transition:background 140ms ease}
.listrow:last-child{border-bottom:none}
.listrow:hover{background:var(--panel2)}
.listrow-copy strong{display:block;font-size:15px;font-weight:700;letter-spacing:-.01em}
.listrow-copy small{display:block;font-size:12px;color:var(--ink2);margin-top:3px}
.listrow-copy span{display:block;font-family:var(--mono);font-size:8.5px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);margin-top:5px}
.listrow-go{font-size:16px;color:var(--ink3);flex:0 0 auto}
.listrow:hover .listrow-go{color:var(--ink)}

.tilegrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:1px;
  background:var(--hairline)}
.tile{padding:15px 18px;background:var(--panel);transition:background 140ms ease}
.tile:hover{background:var(--panel2)}
.tile strong{display:block;font-size:14px;font-weight:700;letter-spacing:-.01em}
.tile small{display:block;font-size:11.5px;color:var(--ink2);margin-top:4px;line-height:1.5}

.landing-foot{display:flex;justify-content:space-between;gap:12px;margin-top:26px;
  padding-top:14px;border-top:1px solid var(--hairline);font-family:var(--mono);
  font-size:9px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--ink3)}

@media(max-width:640px){
  .shell{padding:20px 14px 56px}
  .hero-clock{width:100%}
}
`;
