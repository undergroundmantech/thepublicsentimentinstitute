"use client";

/**
 * ELECTIONS LANDING, the standing /results/live surface (also /results with no ?date).
 *
 * Sits here between election nights. The primary night boards it replaced stay
 * live at /results/archive/2026-08-04 (Michigan et al), /results/archive/2026-08-18
 * (Florida, Wyoming, Alaska) and /results/archive/2026-08-25 (Oklahoma, South
 * Carolina, Georgia runoffs).
 *
 * The header advertises the next election on the calendar. When that night
 * arrives, point NEXT_ELECTION at its board and the countdown and CTA follow.
 */

import Link from "next/link";
import React, { useEffect, useState } from "react";

const NEXT_ELECTION = {
  kicker: "Next election",
  state: "Nationwide",
  date: "Tuesday, November 3, 2026",
  iso: "2026-11-03T19:00:00-05:00",
  title: "2026 midterm general election",
  deck:
    "The whole House, a third of the Senate and 36 governorships. OnPoint Politics race " +
    "ratings are live now; the forecast model and the election night board follow as the " +
    "calendar closes in. First polls close at 7:00 PM ET.",
  cta: { href: "/forecast", label: "See the 2026 forecast" },
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
    label: "Oklahoma, South Carolina and Georgia runoffs",
    note: "County forecast · Oklahoma governor GOP runoff, called for Mazzei by 2,047",
  },
  {
    href: "/results/archive/2026-08-18",
    date: "August 18, 2026",
    label: "Florida, Wyoming and Alaska primaries",
    note: "Spotlight forecast · Florida governor GOP primary",
  },
  {
    href: "/results/archive/2026-08-04",
    date: "August 4, 2026",
    label: "Michigan, Missouri, Kansas, Virginia and Washington primaries",
    note: "Statewide forecast · Michigan U.S. Senate Democratic primary",
  },
];

const ELSEWHERE = [
  { href: "/forecast", label: "2026 forecast", note: "Senate, House and governor ratings from the model" },
  { href: "/maps/electoral", label: "Electoral map", note: "Build your own map" },
  { href: "/floridaprimary", label: "Florida GOP primary engine", note: "Scenario engine across all 67 counties" },
  { href: "/results/archive", label: "Results by date", note: "Every night the desk has tracked" },
];

function useCountdown(iso: string) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setLeft(new Date(iso).getTime() - Date.now());
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [iso]);
  return left;
}

function splitLeft(ms: number | null) {
  if (ms == null || ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60) };
}

export default function ElectionsLanding() {
  const left = useCountdown(NEXT_ELECTION.iso);
  const parts = splitLeft(left);
  const pollsOpen = left != null && left <= 0;

  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span>
        <Link href="/results">Results</Link><span className="sep">/</span>
        <span>Live desk</span>
      </nav>
      <header className="ph">
        <div className="eye g">OnPoint Politics results desk</div>
        <h1>Election night <em>results</em></h1>
        <p className="lede">{NEXT_ELECTION.deck}</p>
        <div className="pmeta">
          {pollsOpen ? <span className="pill live">Live</span> : <span className="eye">{NEXT_ELECTION.kicker} · {NEXT_ELECTION.state}</span>}
          <span>Election day <b>{NEXT_ELECTION.date}</b></span>
          <span>First polls close <b className="mono">7:00 PM ET</b></span>
          <Link className="btn g sm" href={NEXT_ELECTION.cta.href}>{NEXT_ELECTION.cta.label}</Link>
        </div>
      </header>

      <div className="layout">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="card" aria-labelledby="next-title">
            <div className="card-h">
              <h3 id="next-title">{NEXT_ELECTION.title[0].toUpperCase() + NEXT_ELECTION.title.slice(1)}</h3>
              <span className="eye" style={{ marginLeft: "auto" }}>{NEXT_ELECTION.state}</span>
            </div>
            <div className="card-b">
              <div className="grid4" style={{ gap: 12 }}>
                {NEXT_ELECTION.stats.map((s) => (
                  <div key={s.k}>
                    <div className="eye" style={{ fontSize: 10 }}>{s.k}</div>
                    <div className="mono" style={{ font: "700 22px var(--font-m)", color: "#fff", marginTop: 4 }}>{s.v}</div>
                  </div>
                ))}
              </div>
              <p style={{ margin: "16px 0 0", fontSize: 13.5, color: "var(--mute)" }}>
                The board for November 3 mounts here on election night, with county returns, race calls and the
                model&rsquo;s read of the outstanding vote.
              </p>
            </div>
          </section>

          <section className="card" aria-labelledby="archive-title">
            <div className="card-h">
              <h3 id="archive-title">Past election nights</h3>
              <span className="eye" style={{ marginLeft: "auto" }}>Certified final numbers</span>
            </div>
            <div>
              {ARCHIVE.map((a) => (
                <Link className="rx-row" href={a.href} key={a.href}>
                  <div>
                    <strong>{a.date}</strong>
                    <small>{a.label}</small>
                    <span className="eye">{a.note}</span>
                  </div>
                  <span className="go">Open board</span>
                </Link>
              ))}
            </div>
          </section>

          <section className="card" aria-labelledby="else-title">
            <div className="card-h">
              <h3 id="else-title">Between election nights</h3>
              <span className="eye" style={{ marginLeft: "auto" }}>Forecasts, maps, models</span>
            </div>
            <div>
              {ELSEWHERE.map((e) => (
                <Link className="rx-row" href={e.href} key={e.href}>
                  <div>
                    <strong>{e.label}</strong>
                    <small>{e.note}</small>
                  </div>
                  <span className="go">Open</span>
                </Link>
              ))}
            </div>
          </section>
        </div>

        <aside className="side">
          <div className="card rx-clock" aria-label="Time until polls close">
            <div className="card-h"><h3>Polls close in</h3>{pollsOpen && <span className="pill live" style={{ marginLeft: "auto" }}>Live</span>}</div>
            <div className="card-b">
              {parts ? (
                <div className="n">
                  <div><b>{parts.d}</b><span>days</span></div>
                  <div><b>{parts.h}</b><span>hrs</span></div>
                  <div><b>{parts.m}</b><span>min</span></div>
                </div>
              ) : (
                <div className="mono" style={{ font: "700 22px var(--font-m)", color: "#fff" }}>{pollsOpen ? "Polls open" : " "}</div>
              )}
              <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--mute)" }}>First polls close 7:00 PM ET, November 3. Election night coverage begins here.</p>
            </div>
          </div>
          <div className="callout">
            <div className="eye">How the desk works</div>
            Returns come from AP through civicAPI and refresh every few seconds on election night. Race calls are AP&rsquo;s;
            OnPoint Politics projections are labelled as ours. Fieldwork by The Public Sentiment Institute.
          </div>
        </aside>
      </div>
    </div>
  );
}
