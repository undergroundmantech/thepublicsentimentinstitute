"use client";

import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { HomeStats } from "@/app/polling/lib/homeStats";
import { SHOW_SITUATION_ROOM } from "@/app/lib/flags";
import { senateBalance } from "./senateModel";

/**
 * What we publish — the deck.
 *
 * A pinned theater: as the visitor scrolls, each product plate flies up from
 * below the fold and LANDS on the pile — slightly offset, slightly rotated,
 * like prints being dealt onto a light table. The left rail narrates the
 * plate currently landing. Once you hover the pile, the deck FANS into an
 * arc so every plate is visible; the one under the cursor lifts. Click
 * through to the product.
 *
 * Scroll-scrub writes transforms straight to the DOM (no React per frame);
 * the fan is pure CSS transitions gated by .is-fan/.is-anim so the two
 * systems never fight.
 */

type Plate = {
  key: string;
  title: string;
  href: string;
  src: string;
  alt: string;
  note: string;
  live: (stats: HomeStats | null) => { text: string; tone: string; dot?: boolean };
};

const IVY = "rgba(244,244,239,0.92)";

const ALL_PLATES: Plate[] = [
  {
    key: "polling",
    title: "Polling Averages",
    href: "/polling/donaldtrumpapproval",
    src: "/landing-thumbnails/polling-averages.png",
    alt: "Polling averages tracker",
    note: "Daily weighted averages for presidential approval and the national mood — recency, sample size, voter universe, and pollster quality folded into one series.",
    live: (s) => ({
      text: s ? (s.approval.net > 0 ? `+${s.approval.net.toFixed(0)}` : `−${Math.abs(s.approval.net).toFixed(0)}`) : "—",
      tone: "#c08fd6",
    }),
  },
  {
    key: "generic",
    title: "Generic Ballot",
    href: "/polling/genericballot",
    src: "/landing-thumbnails/generic-ballot.png",
    alt: "Generic congressional ballot tracker",
    note: "The national congressional preference, polled and re-polled — every entry charted against the gold-standard weighted trend.",
    live: (s) => ({
      text: s ? (s.generic.net > 0 ? `D+${s.generic.net.toFixed(1)}` : `R+${Math.abs(s.generic.net).toFixed(1)}`) : "—",
      tone: "#8aa3f2",
    }),
  },
  {
    key: "ratings",
    title: "Forecast Ratings",
    href: "/forecastratings",
    src: "/landing-thumbnails/forecast.png",
    alt: "Senate forecast ratings",
    note: "All 35 Senate seats modeled nightly — margins, rating tiers, and the projected balance of the chamber.",
    live: () => {
      const b = senateBalance();
      return { text: `${Math.max(b.d, b.r)}–${Math.min(b.d, b.r)}`, tone: "#8aa3f2" };
    },
  },
  {
    key: "results",
    title: "Live Results",
    href: "/results",
    src: "/landing-thumbnails/live-results.png",
    alt: "Live election results hub",
    note: "Election-night returns with reporting context — every contest on the wire, county by county, as it lands.",
    live: () => ({ text: "live", tone: "#b7ff00", dot: true }),
  },
  {
    key: "map",
    title: "Electoral Map",
    href: "/electoralmap",
    src: "/landing-thumbnails/electoral-map.png",
    alt: "Interactive electoral map",
    note: "Four maps in one — presidential, senate, house by district, and redistricting — every seat paintable, every scenario shareable.",
    live: () => ({ text: "270 to win", tone: "rgba(244,244,239,0.6)" }),
  },
  {
    key: "room",
    title: "Situation Room",
    href: "/situationroom",
    src: "/landing-thumbnails/situation-room.png",
    alt: "The TPSI situation room",
    note: "The whole desk on one wire — live contests, the freshest polls, the model board, and the watchlist, monitored in eastern time.",
    live: () => ({ text: "on the wire", tone: "#b7ff00", dot: true }),
  },
];

const PLATES: Plate[] = ALL_PLATES.filter((p) => p.key !== "room" || SHOW_SITUATION_ROOM);

const MORE = [
  { label: "Gold Standard Pollsters", href: "/goldstandard" },
  { label: "TPSI Poll", href: "/tpsipoll" },
  { label: "Partner Research", href: "/contact" },
];

const COVERAGE = ["National", "Senate", "Governor", "House", "Primaries", "Issue polls", "Custom research"];

const N = PLATES.length;
const MID = (N - 1) / 2;
const cl01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

export default function PublishDeck({ stats }: { stats: HomeStats | null }) {
  const secRef = useRef<HTMLElement | null>(null);
  const deckRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [fanned, setFanned] = useState(false);

  useEffect(() => {
    const sec = secRef.current;
    const deck = deckRef.current;
    if (!sec || !deck) return;
    const cards = Array.from(deck.querySelectorAll<HTMLElement>(".pd-card"));
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let lastActive = -1;

    const update = () => {
      const desktop = window.innerWidth > 980 && !reduced;
      if (!desktop) {
        cards.forEach((c) => { c.style.transform = ""; c.style.filter = ""; c.style.zIndex = ""; });
        return;
      }
      const vh = Math.max(window.innerHeight, 1);
      const rect = sec.getBoundingClientRect();
      const scrollable = Math.max(sec.offsetHeight - vh, 1);
      const p = cl01(-rect.top / scrollable);

      const ai = Math.max(0, Math.min(N - 1, Math.floor(p * N + 0.25)));
      if (ai !== lastActive) { lastActive = ai; setActive(ai); }

      for (let i = 0; i < N; i++) {
        const c = cards[i];
        // each plate gets its slice of the runway; the last slice settles early
        const t = easeOut(cl01(p * N - i));
        const settleX = (i - MID) * 7;
        const settleY = -i * 13;
        const settleR = (i % 2 ? 1 : -1) * (0.7 + (i % 3) * 0.35);
        const y = (1 - t) * vh * 1.08 + settleY * t;
        const r = (1 - t) * 4.5 + settleR * t;
        // plates already on the pile sink + dim as new ones land
        const landedAfter = cl01(p * N - i - 1);
        const sink = landedAfter * Math.min(2, N - 1 - i);
        const dim = 1 - Math.min(0.22, landedAfter * 0.11 * Math.min(3, N - 1 - i));
        c.style.transform = `translate3d(${settleX * t}px, ${y + sink * 5}px, 0) rotate(${r}deg) scale(${1 - sink * 0.014})`;
        c.style.filter = `brightness(${dim})`;
        c.style.zIndex = String(10 + i);
      }
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);


  return (
    <>
    <section className="pd-sec" ref={secRef} aria-label="What we publish">
      <style>{CSS}</style>
      <div className="pd-stage">
        <div className="pd-rail">
          <span className="pd-eyebrow">What we publish</span>
          <div className="pd-narr">
            {PLATES.map((pl, i) => {
              const lv = pl.live(stats);
              return (
                <div className={`pd-narr-item${i === active ? " is-on" : ""}`} key={pl.key} aria-hidden={i !== active}>
                  <span className="pd-ord">{String(i + 1).padStart(2, "0")} / {String(N).padStart(2, "0")}</span>
                  <h3>{pl.title}</h3>
                  <p>{pl.note}</p>
                  <span className="pd-live" style={{ color: lv.tone }}>
                    {lv.dot && <i aria-hidden="true" style={{ background: lv.tone }} />}
                    {lv.text}
                  </span>
                  <Link href={pl.href} className="pd-open">Open {pl.title.toLowerCase()} →</Link>
                </div>
              );
            })}
          </div>
          <span className="pd-hint" aria-hidden="true">{fanned ? "pick a plate" : "hover the pile to fan the deck"}</span>
        </div>

        <div
          className={`pd-deck${fanned ? " is-fan" : ""}`}
          ref={deckRef}
          onPointerEnter={() => setFanned(true)}
          onPointerLeave={() => setFanned(false)}
        >
          {PLATES.map((pl, i) => {
            const lv = pl.live(stats);
            return (
              <Link
                href={pl.href}
                key={pl.key}
                className="pd-card"
                style={{ "--fi": i - MID, "--afi": Math.abs(i - MID), "--zi": 10 + i } as React.CSSProperties}
                aria-label={pl.title}
              >
                <span className="pd-card-in">
                  <Image src={pl.src} alt={pl.alt} width={1672} height={941} sizes="(max-width: 980px) 92vw, 640px" />
                  <span className="pd-card-scrim" aria-hidden="true" />
                  <span className="pd-card-foot">
                    <b>{pl.title}</b>
                    <i style={{ color: lv.tone }}>{lv.dot && <em aria-hidden="true" style={{ background: lv.tone }} />}{lv.text}</i>
                  </span>
                  <span className="pd-card-ring" aria-hidden="true" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>

    </section>
      <div className="pd-more">
        <div className="pd-more-links" aria-label="More from the desk">
          {MORE.map((m, i) => (
            <Link href={m.href} key={m.label}>
              <span className="pd-more-idx">{String(i + 1).padStart(2, "0")}</span>
              {m.label}
              <span aria-hidden="true" className="pd-more-arw">→</span>
            </Link>
          ))}
        </div>
        <div className="pd-cov" aria-label="Coverage areas">
          <span className="pd-cov-label">Coverage</span>
          {COVERAGE.map((c) => <span className="pd-cov-chip" key={c}>{c}</span>)}
        </div>
      </div>
    </>
  );
}

const CSS = `
.pd-sec { position: relative; height: ${N * 56 + 120}vh; background: #050505; }
.pd-stage { position: sticky; top: 0; height: 100vh; height: 100svh; overflow: hidden; background: #050505;
  display: grid; grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
  gap: clamp(28px, 4vw, 72px); align-items: center;
  max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 48px); }

/* left rail */
.pd-rail { position: relative; z-index: 3; display: flex; flex-direction: column; min-width: 0; }
.pd-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: 1.9px; text-transform: uppercase; color: rgba(244,244,239,0.46); }
.pd-narr { position: relative; margin-top: 26px; min-height: 320px; }
.pd-narr-item { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: flex-start;
  opacity: 0; transform: translateY(16px); pointer-events: none;
  transition: opacity 480ms cubic-bezier(0.16,1,0.3,1), transform 480ms cubic-bezier(0.16,1,0.3,1); }
.pd-narr-item.is-on { opacity: 1; transform: none; pointer-events: auto; }
.pd-ord { font-size: 11.5px; font-weight: 650; letter-spacing: 0.14em; color: rgba(244,244,239,0.3); font-variant-numeric: tabular-nums; }
.pd-narr-item h3 { margin: 14px 0 0; font-size: clamp(30px, 3vw, 42px); font-weight: 560; letter-spacing: -0.028em; line-height: 1; color: ${IVY}; }
.pd-narr-item p { margin: 16px 0 0; font-size: 15px; line-height: 1.55; color: rgba(244,244,239,0.55); max-width: 40ch; }
.pd-live { display: inline-flex; align-items: center; gap: 8px; margin-top: 20px; font-size: 22px; font-weight: 600; letter-spacing: -0.01em; font-variant-numeric: tabular-nums; }
.pd-live i { width: 7px; height: 7px; border-radius: 99px; box-shadow: 0 0 10px currentColor; animation: pd-pulse 2s ease-in-out infinite; }
@keyframes pd-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.45; } }
.pd-open { display: inline-block; margin-top: 22px; font-size: 13.5px; font-weight: 650; color: rgba(244,244,239,0.62); text-decoration: none; transition: color 180ms ease; }
.pd-open:hover { color: #f4f4ef; }
.pd-hint { margin-top: 34px; font-size: 10.5px; font-weight: 650; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.24); }

/* the deck */
.pd-deck { position: relative; z-index: 2; height: min(66vh, 620px); align-self: center; }
.pd-card { position: absolute; left: 50%; top: 50%; width: min(100%, 640px); aspect-ratio: 1672 / 941;
  margin: calc(min(100%, 640px) * 941 / 1672 / -2) 0 0 calc(min(100%, 640px) / -2);
  display: block; text-decoration: none;
  transform: translate3d(0, 120vh, 0); z-index: var(--zi); will-change: transform, filter; }
.pd-card-in { position: absolute; inset: 0; display: block; border-radius: 14px; overflow: hidden;
  background: #0b0b0d; isolation: isolate;
  box-shadow: 0 30px 90px rgba(0,0,0,0.6), 0 4px 18px rgba(0,0,0,0.5);
  transition: transform 660ms cubic-bezier(0.22, 1.18, 0.3, 1), box-shadow 420ms ease; will-change: transform; }
.pd-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
.pd-card-ring { position: absolute; inset: 0; border-radius: inherit; pointer-events: none;
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.16); }
.pd-card-scrim { position: absolute; left: 0; right: 0; bottom: 0; height: 38%; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(4,4,6,0.82)); }
.pd-card-foot { position: absolute; left: 18px; right: 18px; bottom: 13px; display: flex; align-items: baseline; justify-content: space-between; gap: 14px; }
.pd-card-foot b { font-size: 16px; font-weight: 650; letter-spacing: -0.015em; color: #f4f4ef; }
.pd-card-foot i { display: inline-flex; align-items: center; gap: 7px; font-style: normal; font-size: 12.5px; font-weight: 700; font-variant-numeric: tabular-nums; letter-spacing: 0.02em; }
.pd-card-foot i em { width: 6px; height: 6px; border-radius: 99px; box-shadow: 0 0 8px currentColor; animation: pd-pulse 2s ease-in-out infinite; }

/* fan: the inner layer arcs out — the scrub's outer transform stays put */
.pd-deck.is-fan .pd-card { filter: brightness(1) !important; }
.pd-deck.is-fan .pd-card-in {
  transform: translate3d(calc(var(--fi) * 19%), calc(var(--afi) * var(--afi) * 2.6% - 9%), 0)
             rotate(calc(var(--fi) * 6.5deg)); }
.pd-deck.is-fan .pd-card:hover { z-index: 60; }
.pd-deck.is-fan .pd-card:hover .pd-card-in {
  transform: translate3d(calc(var(--fi) * 19%), calc(var(--afi) * var(--afi) * 2.6% - 9%), 0)
             rotate(calc(var(--fi) * 6.5deg)) translateY(-7%) scale(1.05);
  box-shadow: 0 44px 120px rgba(0,0,0,0.78), 0 0 44px rgba(255,255,255,0.07); }
.pd-deck.is-fan .pd-card:hover .pd-card-ring { box-shadow: inset 0 0 0 1px rgba(255,255,255,0.3), inset 0 1px 0 rgba(255,255,255,0.28); }

/* tail */
.pd-more { max-width: 1280px; margin: 0 auto; padding: clamp(40px, 6vh, 80px) clamp(20px, 4vw, 48px) clamp(60px, 8vh, 110px);
  display: flex; flex-direction: column; gap: 34px; }
.pd-more-links { display: flex; flex-wrap: wrap; gap: 14px 44px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 26px; }
.pd-more-links a { display: inline-flex; align-items: baseline; gap: 12px; font-size: clamp(18px, 2vw, 26px); font-weight: 560; letter-spacing: -0.02em; color: rgba(244,244,239,0.78); text-decoration: none; transition: color 200ms ease; }
.pd-more-links a:hover { color: #ffffff; }
.pd-more-idx { font-size: 11px; font-weight: 650; color: rgba(244,244,239,0.28); font-variant-numeric: tabular-nums; }
.pd-more-arw { font-size: 0.8em; color: rgba(244,244,239,0.4); transition: transform 200ms ease, color 200ms ease; }
.pd-more-links a:hover .pd-more-arw { transform: translateX(5px); color: #b7ff00; }
.pd-cov { display: flex; flex-wrap: wrap; align-items: baseline; gap: 10px 18px; }
.pd-cov-label { font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.34); margin-right: 8px; }
.pd-cov-chip { font-size: 13px; font-weight: 580; color: rgba(244,244,239,0.55); }
.pd-cov-chip:not(:last-child):after { content: '·'; margin-left: 18px; color: rgba(244,244,239,0.2); }

/* mobile: plates in flow, no pin, no fan */
@media (max-width: 980px) {
  .pd-sec { height: auto; }
  .pd-stage { position: static; height: auto; grid-template-columns: 1fr; padding-top: 64px; gap: 40px; }
  .pd-narr { min-height: 0; margin-top: 18px; }
  .pd-narr-item { position: static; opacity: 1; transform: none; pointer-events: auto; display: none; }
  .pd-narr-item.is-on { display: flex; }
  .pd-hint { display: none; }
  .pd-deck { height: auto; display: flex; flex-direction: column; gap: 22px; }
  .pd-card { position: relative; left: auto; top: auto; margin: 0; width: 100%; transform: none !important; filter: none !important; }
  .pd-card-in { transform: none !important; }
}
@media (prefers-reduced-motion: reduce) {
  .pd-deck.is-anim .pd-card { transition: none; }
  .pd-narr-item { transition: none; }
}
`;
