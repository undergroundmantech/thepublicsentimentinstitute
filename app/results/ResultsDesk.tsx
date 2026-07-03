"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Manrope } from "next/font/google";
import DarkNav from "@/app/components/DarkNav";
import { ThemeProvider } from "./onpoint/lib/theme.jsx";
import { OPA_GLOBAL_CSS } from "./onpoint/OpaResultsPage.jsx";
import { ResultCard } from "./onpoint/ElectionResults.jsx";
import { useElectionIndex } from "./onpoint/lib/electionIndex.js";
import { raceHasMap, candColor } from "./onpoint/electionLib.js";
import DeskSearch from "./components/DeskSearch";
import SwingOMeter from "./components/SwingOMeter";
import { needleFromRace } from "./components/needleModel";
import PrecinctShowcase from "./components/PrecinctShowcase";

// The desk's own backdrop — the REAL national county map, counties reporting
// in red/blue/purple across the night. Canvas 2D over the shared geometry.
const DeskMapField = dynamic(() => import("./components/DeskMapField"), { ssr: false });

const manrope = Manrope({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"], variable: "--font-mp", display: "swap" });

const fmtInt = (n: number) => (Number(n) || 0).toLocaleString("en-US");
const shortContest = (s?: string) => { const t = String(s || ""); return t.length > 34 ? t.slice(0, 32).trimEnd() + "…" : t; };
// "now" for the desk — the real clock (en-CA formats as YYYY-MM-DD)
const DESK_TODAY = new Date().toLocaleDateString("en-CA");
const tickMargin = (d: any) => {
  const L = d?.leader;
  if (!L) return "";
  const lead = Number(L.lead) || 0;
  if (lead >= 100) return "unopposed";
  const p = String(L.cand?.party || "").toLowerCase();
  const pl = /democr/.test(p) ? "D" : /republic|gop/.test(p) ? "R" : "";
  return `${pl ? pl + "+" : "+"}${lead < 10 ? lead.toFixed(1) : Math.round(lead)}`;
};
// party-spectrum tints for the season dot field (dem · gop · purple · green · teal)
const DOT_TINTS = ["29,78,216", "220,38,38", "124,77,255", "46,158,79", "24,182,166"];
const surname = (n?: string) => (n ? n.trim().split(/\s+/).pop() : "");

// ── reveal-on-scroll + lazy-in-view (one IO per element, once) ──────────────
function useInView(rootMargin = "-12% 0px"): [React.RefObject<HTMLElement | null>, boolean] {
  const ref = useRef<HTMLElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced) { setSeen(true); return; }
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { rootMargin }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [seen, rootMargin]);
  return [ref, seen];
}


function Eyebrow({ children, live }: { children: React.ReactNode; live?: boolean }) {
  return (
    <span className="desk-eyebrow">
      <span className="desk-eyebrow-mk" aria-hidden />
      {children}
      {live ? <span className="desk-eyebrow-pip" aria-hidden /> : null}
    </span>
  );
}

function Placeholder({ tall }: { tall?: boolean }) {
  return <div className="desk-ph" style={{ height: tall ? 340 : 230 }} aria-hidden />;
}

// ── the walkthrough's film frames: each frame eases toward full size as it
// crosses the viewport center — transform-only, one rAF per scroll tick ──────
function FilmMedia({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const tick = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 1;
      if (r.bottom < -120 || r.top > vh + 120) return;
      const p = Math.min(1, Math.abs(r.top + r.height / 2 - vh / 2) / (vh * 0.66));
      const ease = 1 - p * p;
      el.style.transform = `scale(${(0.93 + 0.07 * ease).toFixed(4)})`;
      el.style.setProperty("--film-halo", ease.toFixed(3));
    };
    const kick = () => { if (!raf) raf = requestAnimationFrame(tick); };
    tick();
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
  return (
    <div ref={ref} className={`desk-film-media ${wide ? "wide" : ""}`}>
      <span className="desk-film-halo" aria-hidden />
      <figure className="desk-film-frame">{children}</figure>
    </div>
  );
}

// plays only while on screen; muted loop, streams progressively
function FilmVideo() {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); },
      { threshold: 0.3 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <video
      ref={ref}
      src="/desk/desk-tour.mp4"
      muted
      loop
      playsInline
      preload="metadata"
      aria-label="A live pass over the precinct map — panning the state, hovering counties"
    />
  );
}

// Day toggle — the election nights of the season as a scrollable strip (no
// calendar). Each opens that day's full results grid at /results?date=YYYY-MM-DD.
function DayStrip({ index, onPick }: { index: any; onPick: (date: string) => void }) {
  const days = useMemo(() => {
    if (!index) return [] as { date: string; n: number; pct: number; big: boolean }[];
    const m = new Map<string, number>();
    for (const d of index.docs) { if (d?.date) m.set(d.date, (m.get(d.date) || 0) + 1); }
    const arr = [...m.entries()].filter(([, n]) => n >= 25).map(([date, n]) => ({ date, n })).sort((a, b) => a.date.localeCompare(b.date));
    const max = arr.reduce((mx, x) => Math.max(mx, x.n), 1);
    return arr.map((x) => ({ ...x, pct: Math.round((Math.log(x.n + 1) / Math.log(max + 1)) * 100), big: x.n >= 1000 }));
  }, [index]);
  if (!days.length) return null;
  return (
    <div className="desk-days">
      {days.map((d) => {
        const dt = new Date(d.date + "T00:00:00");
        return (
          <button key={d.date} type="button" className={`desk-day ${d.big ? "big" : ""}`} onClick={() => onPick(d.date)}>
            <span className="desk-day-mo">{dt.toLocaleDateString("en-US", { weekday: "short" })} · {dt.toLocaleDateString("en-US", { month: "short" })}</span>
            <span className="desk-day-d">{dt.getDate()}</span>
            <span className="desk-day-bar" aria-hidden><i style={{ width: `${Math.max(7, d.pct)}%` }} /></span>
            <span className="desk-day-n">{d.n.toLocaleString()} {d.big ? "races ●" : "races"}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function ResultsDesk() {
  if (typeof document !== "undefined") {
    try { document.documentElement.dataset.opaTheme = "dark"; } catch {}
  }
  return (
    <ThemeProvider>
      <Desk />
    </ThemeProvider>
  );
}

function Desk() {
  const router = useRouter();
  const { index } = useElectionIndex(true) as { index: any };
  const heroSearchRef = useRef<HTMLInputElement | null>(null);
  const [showPill, setShowPill] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const featured = useMemo(() => {
    if (!index) return null;
    const withMap = index.docs.filter((d: any) => d.hasResult && raceHasMap(d.race));
    withMap.sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
    return withMap[0] || index.docs.find((d: any) => d.hasResult) || index.docs[0] || null;
  }, [index]);

  // The lead precinct map (live ESRI tiles): the single richest geography we
  // have, so its partisan-lean basemap reads purple. Held static — the anchor.
  const precinctLead = useMemo(() => {
    if (!index) return null;
    const withMap = index.docs.filter((d: any) => d.hasResult && raceHasMap(d.race) && d.id !== featured?.race?.id);
    withMap.sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
    return withMap[0] || null;
  }, [index, featured]);

  // The cycling pool for the atlas plates. STATEWIDE contests first — their
  // county maps fill the whole state and read best — then the strongest local
  // maps. One race per state within each tier so the stream keeps moving.
  const cyclePool = useMemo(() => {
    if (!index) return [] as any[];
    const leadId = precinctLead?.id;
    const LOCAL_RE = /state senate|state house|assembly|house district|city|county|township|village|school|ward|precinct|borough/i;
    const WIDE_RE = /governor|lieutenant|u\.?s\.? senat|attorney general|secretary of state|treasurer|controller|comptroller|auditor|superintendent|commissioner|supreme court|proposition|amendment|question|measure|referendum/i;
    const isStatewide = (d: any) =>
      String(d.office || "").toLowerCase() === "statewide" ||
      (WIDE_RE.test(String(d.contest || "")) && !LOCAL_RE.test(String(d.contest || "")));
    const eligible = index.docs.filter((d: any) => d.hasResult && raceHasMap(d.race) && d.leader?.cand && d.id !== leadId);
    const tierPick = (docs: any[], max: number) => {
      const byState = new Map<string, any>();
      for (const d of docs) {
        const st = String(d.province || "");
        if (!st) continue;
        const cur = byState.get(st);
        if (!cur || (d.totalVotes || 0) > (cur.totalVotes || 0)) byState.set(st, d);
      }
      return [...byState.values()].sort((a, b) => (b.totalVotes || 0) - (a.totalVotes || 0)).slice(0, max);
    };
    const wide = tierPick(eligible.filter(isStatewide), 12).map((d: any) => ({ ...d, wholeMap: true }));
    // individual counties — local contests drawn as JUST their county shape
    // (no state silhouette), hash-shuffled so the mix reads random
    const hashOrd = (d: any) => ((Number(d.id) * 2654435761) >>> 0) % 100000;
    const seenLocal = new Set<string>();
    const locals = eligible
      .filter((d: any) => !isStatewide(d) && LOCAL_RE.test(String(d.contest || "")))
      .sort((a: any, b: any) => hashOrd(a) - hashOrd(b))
      .filter((d: any) => {
        const st = String(d.province || "");
        if (seenLocal.has(st)) return false;
        seenLocal.add(st);
        return true;
      })
      .slice(0, 10)
      .map((d: any) => ({ ...d, wholeMap: false }));
    // interleave: statewide, county, statewide, county…
    const out: any[] = [];
    const max = Math.max(wide.length, locals.length);
    for (let i = 0; i < max; i++) {
      if (wide[i]) out.push(wide[i]);
      if (locals[i]) out.push(locals[i]);
    }
    return out.slice(0, 20);
  }, [index, precinctLead]);

  // The docket — other big boards (distinct states) listed beside the featured
  // one. Map breakdown required so every board can draw a choropleth.
  const deckBacks = useMemo(() => {
    if (!index) return [] as any[];
    const top = index.docs
      .filter((d: any) => d.hasResult && raceHasMap(d.race) && d.race?.has_map && d.id !== featured?.race?.id)
      .sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
    const out: any[] = [];
    const seen = new Set<string>([String(featured?.race?.province || "")]);
    for (const d of top) {
      const st = String(d.province || "");
      if (seen.has(st)) continue;
      seen.add(st); out.push(d);
      if (out.length >= 4) break;
    }
    return out;
  }, [index, featured]);

  // The gallery cards: the lead plus the diverse per-state pool, ~5 specific races.

  // the docket rows beside the featured board
  const docket = useMemo(() => deckBacks.slice(0, 4), [deckBacks]);

  // hero ticker — the season's marquee contests as a newsroom chyron (one per
  // state for variety, biggest turnout first)
  const tickerItems = useMemo(() => {
    if (!index) return [] as any[];
    const seen = new Set<string>();
    const out: any[] = [];
    const pool = index.docs
      .filter((d: any) => d.hasResult && d.leader?.cand && (d.totalVotes || 0) > 1000)
      .sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
    for (const d of pool) {
      const st = String(d.province || "");
      if (!st || seen.has(st)) continue;
      seen.add(st);
      out.push(d);
      if (out.length >= 14) break;
    }
    return out;
  }, [index]);

  // races mid-count right now (0 < reporting < 100) — the "live" readout
  const liveNow = useMemo(() => {
    if (!index) return 0;
    return index.docs.filter((d: any) => d.hasResult && (d.reporting || 0) > 0 && (d.reporting || 0) < 100).length;
  }, [index]);

  // states with real returns — the hero map only tours places we actually have
  const bgStates = useMemo(() => {
    if (!index) return [] as string[];
    const seen = new Set<string>();
    for (const d of index.docs) {
      if (d.hasResult && raceHasMap(d.race)) seen.add(String(d.province || "").toUpperCase());
    }
    seen.delete("");
    return [...seen];
  }, [index]);

  // tonight on the desk — today's contests, or the edge case: point at the
  // next election night (or close the season) so the section is never stale
  const tonight = useMemo(() => {
    if (!index) return null;
    const nightOf = (date: string, mode: "tonight" | "latest") => {
      const docs = index.docs.filter((d: any) => d.date === date);
      // statewide/biggest first, one per state up front, then the rest
      const top = [...docs].sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
      const seen = new Set<string>();
      const lead: any[] = [];
      const rest: any[] = [];
      for (const d of top) {
        const st = String(d.province || "");
        if (!seen.has(st)) { seen.add(st); lead.push(d); } else rest.push(d);
      }
      return { mode, date, n: docs.length, feats: [...lead, ...rest].slice(0, 24) };
    };
    if (index.docs.some((d: any) => d.date === DESK_TODAY)) return nightOf(DESK_TODAY, "tonight");
    // no races today → the LATEST night that actually happened
    const past = ([...new Set(index.docs.map((d: any) => String(d.date || "")))] as string[]).filter((dt) => dt && dt < DESK_TODAY).sort();
    const latest = past[past.length - 1];
    if (latest) return nightOf(latest, "latest");
    return { mode: "done" as const, date: "", n: 0, feats: [] as any[] };
  }, [index]);
  const [tnQuery, setTnQuery] = useState("");
  const tnCards = useMemo(() => {
    const feats = tonight?.feats || [];
    const q = tnQuery.trim().toLowerCase();
    if (!q) return feats;
    return feats.filter((d: any) =>
      [d.contest, d.stateName, d.province, d.office, d.leader?.cand?.name]
        .filter(Boolean)
        .some((s: string) => String(s).toLowerCase().includes(q))
    );
  }, [tonight, tnQuery]);

  // monthly contest volume — the rhythm of the season (replaces the dot grid)
  const seasonBars = useMemo(() => {
    if (!index) return [] as { label: string; n: number; pct: number }[];
    const m = new Map<string, number>();
    for (const d of index.docs) { if (d?.date) { const k = String(d.date).slice(0, 7); m.set(k, (m.get(k) || 0) + 1); } }
    const arr = [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const max = arr.reduce((mx, x) => Math.max(mx, x[1]), 1);
    return arr.map(([k, n]) => ({ label: new Date(k + "-01T00:00:00").toLocaleDateString("en-US", { month: "short" }), n, pct: Math.round((n / max) * 100) }));
  }, [index]);

  // headline stats, derived from the data instead of hardcoded
  const seasonStats = useMemo(() => {
    if (!index) return null;
    const dates = new Map<string, number>();
    for (const d of index.docs) { if (d?.date) dates.set(d.date, (dates.get(d.date) || 0) + 1); }
    let bigN = 0, bigDate = "";
    for (const [dt, n] of dates) if (n > bigN) { bigN = n; bigDate = dt; }
    return { nights: dates.size, bigN, bigDate };
  }, [index]);

  const count = index?.count || 0;

  const openRace = (race: any) => { if (race?.id != null) router.push(`/results/race/${race.id}`); };
  const onPick = (doc: any) => openRace(doc.race);
  const focusSearch = () => { heroSearchRef.current?.focus(); window.scrollTo({ top: 0, behavior: "smooth" }); };

  useEffect(() => {
    const onScroll = () => setShowPill(window.scrollY > Math.max(420, window.innerHeight * 0.75));
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [callRef, callIn] = useInView();
  const [mapRef, mapIn] = useInView();
  const [filmRef, filmIn] = useInView();
  const [fcRef, fcIn] = useInView();
  const [scaleRef, scaleIn] = useInView();

  // "the call" — the stage cycles through tonight's boards; the docket tracks it
  const boards = useMemo(() => [featured, ...docket].filter(Boolean).slice(0, 5), [featured, docket]);
  const [boardIdx, setBoardIdx] = useState(0);
  const stageHover = useRef(false);
  useEffect(() => {
    if (!callIn || boards.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (!stageHover.current) setBoardIdx((x) => (x + 1) % boards.length);
    }, 6500);
    return () => window.clearInterval(id);
  }, [callIn, boards.length]);
  const activeBoard = boards.length ? boards[boardIdx % boards.length] : null;
  const abRace: any = activeBoard?.race || null;
  const abGlow = activeBoard?.leader?.cand ? candColor(activeBoard.leader.cand) : "#5566e6";

  // the forecast cycles the tightest live races — the needle swings per race
  const fcPool = useMemo(() => {
    if (!index) return [] as any[];
    const close = index.docs
      .filter((d: any) => {
        if (!d.hasResult || !Array.isArray(d.race?.candidates) || d.race.candidates.length < 2) return false;
        const cs = [...d.race.candidates].sort((a: any, b: any) => (b.votes || 0) - (a.votes || 0));
        const lead = (cs[0]?.percent || 0) - (cs[1]?.percent || 0);
        return lead > 0.2 && lead < 15 && (d.totalVotes || 0) > 5000;
      })
      .sort((a: any, b: any) => (b.totalVotes || 0) - (a.totalVotes || 0));
    const seen = new Set<string>();
    const out: any[] = [];
    for (const d of close) {
      const st = String(d.province || "");
      if (seen.has(st)) continue;
      seen.add(st); out.push(d);
      if (out.length >= 8) break;
    }
    return out.length ? out : featured ? [featured] : [];
  }, [index, featured]);
  const [fcIdx, setFcIdx] = useState(0);
  useEffect(() => {
    if (!fcIn || fcPool.length <= 1) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setFcIdx((x) => (x + 1) % fcPool.length), 7000);
    return () => window.clearInterval(id);
  }, [fcIn, fcPool.length]);
  const fcDoc = fcPool.length ? fcPool[fcIdx % fcPool.length] : null;
  const fcRace: any = fcDoc?.race || null;
  // the needle runs the SITE forecast engine (app/lib/electoralModel)
  const fcNeedle = useMemo(() => (fcRace ? needleFromRace(fcRace) : null), [fcRace]);

  // count the season total up when the section scrolls into view
  const [shownCount, setShownCount] = useState(0);
  useEffect(() => {
    if (!scaleIn || !count) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { setShownCount(count); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 1600;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      setShownCount(Math.round(count * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scaleIn, count]);

  return (
    <div className={`desk-page ${manrope.variable}`}>
      <style>{OPA_GLOBAL_CSS}</style>
      <style>{DESK_CSS}</style>
      <div className="desk-grain" aria-hidden />

      {/* 0 · status bar */}
      <div className="desk-status">
        <div className="desk-shell desk-status-in">
          <span className="desk-status-l"><span className="desk-pip" aria-hidden /> LIVE DESK <em>·</em> 2026 SEASON</span>
          <span className="desk-status-r">{count ? `${fmtInt(count)} contests` : "loading the season"} <em>·</em> auto-refresh 14s</span>
        </div>
      </div>

      {/* 1 · hero — big-type, search-first, over a live WebGL flow field */}
      <section className="desk-hero">
        <DeskMapField className="desk-shader" states={bgStates} />
        <div className="desk-shader-fade" aria-hidden />
        <div className="desk-shell">
          <DarkNav />
          <div className="desk-folio">
            <span>TPSI · Election Results</span>
            <span>live returns · county maps · forecasts</span>
          </div>
          <div className="desk-hero-main">
            <h1 className="desk-title" aria-label="pull any race.">
              {["pull", "any", "race"].map((w, i) => (
                <span className="desk-tw" key={w}>
                  <span style={{ animationDelay: `${0.1 + i * 0.1}s` }}>{w}{i === 2 ? <em>.</em> : null}</span>
                </span>
              ))}
            </h1>
            <p className="desk-lede" data-rise>Every contest of the 2026 season — live returns, county maps, and forecasts. Type a state, an office, or a candidate.</p>
            <div className="desk-hero-search" data-rise style={{ animationDelay: "0.15s" }}><DeskSearch active onPick={onPick} inputRef={heroSearchRef} /></div>
            <div className="desk-chips" data-rise style={{ animationDelay: "0.25s" }} aria-hidden>
              {["georgia governor", "AG primary", "ME senate", "prop 1"].map((c) => (
                <button key={c} className="desk-chip" onClick={focusSearch}>{c}</button>
              ))}
            </div>
            <div className="desk-hero-stats" data-rise style={{ animationDelay: "0.35s" }} aria-hidden>
              <span><b>{count ? fmtInt(count) : "—"}</b> contests</span>
              <em>·</em>
              <button
                type="button"
                className="desk-hero-nightlink"
                onClick={() => document.querySelector(".desk-nights")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              >
                <b>{seasonStats ? seasonStats.nights : "—"}</b> election nights — browse them ↓
              </button>
              <em>·</em>
              <span className="live"><i />{liveNow ? `${fmtInt(liveNow)} counting now` : "awaiting returns"}</span>
            </div>
          </div>
        </div>

        {/* chyron — real contests streaming across the hero's base */}
        {tickerItems.length ? (
          <div className="desk-ticker">
            <div className="desk-ticker-track">
              {[0, 1].map((rep) => (
                <div className="desk-ticker-row" key={rep} aria-hidden={rep === 1}>
                  {tickerItems.map((d: any) => (
                    <button key={`${rep}-${d.id}`} type="button" className="desk-tick" onClick={() => openRace(d.race)} tabIndex={rep === 1 ? -1 : 0}>
                      <i className="desk-tick-dot" style={{ background: candColor(d.leader.cand) }} />
                      <span className="desk-tick-st">{d.province}</span>
                      <span className="desk-tick-name">{shortContest(d.contest)}</span>
                      <b style={{ color: candColor(d.leader.cand) }}>{surname(d.leader.cand.name)} {tickMargin(d)}</b>
                      <span className="desk-tick-rep">{Math.round(d.reporting || 0)}% in</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      {/* 1.25 · on the ballot — tonight's races, or the next night's, as a
          horizontally scrolling rail with a type-to-find filter */}
      {tonight && tonight.mode !== "done" ? (
        <section className="desk-tonight">
          <div className="desk-tonight-head">
            <div className="desk-tonight-l">
              <Eyebrow live={tonight.mode === "tonight"}>{tonight.mode === "tonight" ? "counting tonight" : "the latest returns"}</Eyebrow>
              <h2 className="desk-tonight-h">{tonight.mode === "tonight" ? <>on the board tonight<em>.</em></> : <>the last night on the ballot<em>.</em></>}</h2>
            </div>
            <div className="desk-tonight-tools">
              <div className="desk-tonight-find">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
                  <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <input
                  value={tnQuery}
                  onChange={(e) => setTnQuery(e.target.value)}
                  placeholder="find a race…"
                  aria-label="Filter these races"
                  spellCheck={false}
                />
              </div>
              <button type="button" className="desk-textlink" onClick={() => router.push(`/results?date=${tonight.date}`)}>
                the full board — {fmtInt(tonight.n)} contests <span aria-hidden>→</span>
              </button>
            </div>
          </div>
          {tnCards.length ? (
            <div className="desk-tn-rail" role="list">
              {tnCards.map((d: any) => {
                const tone = d.leader?.cand ? candColor(d.leader.cand) : "#8a93a6";
                return (
                  <button key={d.id} type="button" role="listitem" className="desk-tn-card" style={{ ["--t" as any]: tone }} onClick={() => openRace(d.race)}>
                    <span className="desk-tn-top">
                      <b>{d.province}</b>
                      <i className={d.hasResult ? "on" : ""} aria-hidden />
                    </span>
                    <span className="desk-tn-name">{d.contest}</span>
                    <span className="desk-tn-meta">{[d.office, d.hasResult ? `${Math.round(d.reporting || 0)}% in` : "awaiting returns"].filter(Boolean).join(" · ")}</span>
                    <span className="desk-tn-lead">
                      {d.leader?.cand ? (
                        <><b style={{ color: tone }}>{surname(d.leader.cand.name)} {tickMargin(d)}</b><span aria-hidden>→</span></>
                      ) : (
                        <><b className="dim">no returns yet</b><span aria-hidden>→</span></>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="desk-tn-none">nothing matches &ldquo;{tnQuery.trim()}&rdquo; on this night — try the search above for the whole season.</div>
          )}
        </section>
      ) : null}

      {/* 1.5 · browse by night — a day toggle (replaces the calendar) */}
      <section className="desk-nights">
        <div className="desk-nights-head">
          <Eyebrow>every night of the season</Eyebrow>
          <h2 className="desk-nights-h">or browse a specific night<em>.</em></h2>
        </div>
        <DayStrip index={index} onPick={(date: string) => router.push(`/results?date=${date}`)} />
      </section>

      {/* 2 · the call — the featured board on stage + a docket ledger beside it */}
      <section className="desk-call" ref={callRef as any}>
        <div className={`desk-sechead ${callIn ? "is-in" : ""}`}>
          <div className="desk-sechead-l">
            <Eyebrow live>the call</Eyebrow>
            <h2 className="desk-h2">every contest, the moment it&rsquo;s called.</h2>
            <p className="desk-body">Margin-shaded by who&rsquo;s ahead, every candidate on the ballot, live reporting — the same board the desk runs on election night.</p>
          </div>
          <span className="desk-ghost" aria-hidden>01</span>
        </div>

        <div className={`desk-call-layout ${callIn ? "is-in" : ""}`}>
          <div className="desk-docket">
            <div className="desk-docket-h"><span>the docket — tonight&rsquo;s boards</span><span className="desk-docket-live">live</span></div>
            {boards.map((d: any, i: number) => {
              const called = Array.isArray(d.race?.candidates) && d.race.candidates.some((c: any) => c.winner);
              const tone = d.leader?.cand ? candColor(d.leader.cand) : "#8a93a6";
              const on = boards.length ? i === boardIdx % boards.length : false;
              return (
                <button key={d.id} type="button" className={`desk-docket-row ${on ? "on" : ""}`} style={{ transitionDelay: `${0.08 + i * 0.09}s` }} onClick={() => setBoardIdx(i)}>
                  <span className="desk-docket-idx">{String(i + 1).padStart(2, "0")}</span>
                  <span className="desk-docket-st">{d.province}</span>
                  <span className="desk-docket-main">
                    <b>{shortContest(d.contest)}</b>
                    <span>{[d.office, `${Math.round(d.reporting || 0)}% in`].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className="desk-docket-lead" style={{ color: tone }}>{surname(d.leader?.cand?.name)} {tickMargin(d)}</span>
                  <span className={`desk-docket-flag ${called ? "called" : ""}`}>{called ? "✓ called" : "● counting"}</span>
                  <span className="desk-docket-go" aria-hidden>→</span>
                </button>
              );
            })}
          </div>

          <div
            className="desk-call-stage"
            onMouseEnter={() => { stageHover.current = true; }}
            onMouseLeave={() => { stageHover.current = false; }}
          >
            <div className="desk-glow" style={{ background: `radial-gradient(58% 60% at 60% 44%, ${abGlow}2c, transparent 70%)` }} aria-hidden />
            <div className="desk-stage-swap" key={activeBoard?.id ?? "none"}>
              {abRace ? <ResultCard race={abRace} onOpen={openRace} compact={false} mapDelay={250} /> : <Placeholder />}
            </div>
            <div className="desk-stage-fig" aria-hidden>
              <span>board {boards.length ? String((boardIdx % boards.length) + 1).padStart(2, "0") : "—"} / {String(Math.max(boards.length, 1)).padStart(2, "0")}</span><i />
              <span>margin-shaded · every candidate · auto-refresh 14s — open the board to go deeper</span>
            </div>
          </div>
        </div>
      </section>

      {/* 3 · down to the precinct — a gallery of the REAL ESRI precinct maps,
          weighted to the closest two-party races so the partisan-lean palette
          reads in full purple. Each panel is a framed, non-interactive showcase
          that opens the live map. */}
      <section className="desk-precinct" ref={mapRef as any}>
        <div className={`desk-sechead ${mapIn ? "is-in" : ""}`}>
          <div className="desk-sechead-l">
            <Eyebrow live>down to the precinct</Eyebrow>
            <h2 className="desk-h2">every county. then every precinct.</h2>
            <p className="desk-body">The real map behind every race — partisan lean down to the block. Open any plate to explore it live.</p>
          </div>
          <span className="desk-ghost" aria-hidden>02</span>
        </div>
        <PrecinctShowcase lead={precinctLead} pool={cyclePool} onOpen={openRace} />
      </section>

      {/* 3.5 · the walkthrough — one Georgia race followed through three depths,
          as alternating film frames that scale up toward the viewport center */}
      <section className="desk-film" ref={filmRef as any}>
        <div className={`desk-sechead ${filmIn ? "is-in" : ""}`}>
          <div className="desk-sechead-l">
            <Eyebrow>one race, all the way down</Eyebrow>
            <h2 className="desk-h2">the same race, three depths<em>.</em></h2>
            <p className="desk-body">Georgia&rsquo;s Supreme Court seat at 99% reporting — followed from its race page into the live precinct map.</p>
          </div>
          <span className="desk-ghost" aria-hidden>03</span>
        </div>

        <div className="desk-film-rows">
          <div className="desk-film-row">
            <div className="desk-film-copy">
              <Eyebrow>the race page</Eyebrow>
              <h3 className="desk-film-h">tallies, the needle, the county map — one page.</h3>
              <p className="desk-film-p">Every candidate with full vote counts, live reporting, and win probability underneath. The state map sits beside the board, shaded county by county as returns land.</p>
            </div>
            <FilmMedia>
              <img src="/desk/film-race.jpg" alt="A race page: the tally board, the win-probability needle, and the Georgia county map" loading="lazy" />
            </FilmMedia>
          </div>

          <div className="desk-film-row center">
            <FilmMedia wide>
              <FilmVideo />
            </FilmMedia>
            <div className="desk-film-cap">
              <Eyebrow live>in motion</Eyebrow>
              <p className="desk-film-p">Recorded straight off the live map — pan the state, hover a county, the tally follows the cursor.</p>
            </div>
          </div>

          <div className="desk-film-row rev">
            <div className="desk-film-copy">
              <Eyebrow>the precinct map</Eyebrow>
              <h3 className="desk-film-h">then step into the full map.</h3>
              <p className="desk-film-p">Every plate and race page hands off to the live application: county shading by margin, the race rail on the left, tallies on hover, zoom down to the block.</p>
            </div>
            <FilmMedia>
              <img src="/desk/film-map.jpg" alt="The live precinct map: Georgia counties shaded by margin, the race rail, and the hover tally" loading="lazy" />
            </FilmMedia>
          </div>
        </div>
      </section>

      {/* 4 · the forecast — the needle swings race to race through the tightest
          contests on the board */}
      <section className="desk-fc" ref={fcRef as any}>
        <div className="desk-shell desk-fc-in">
          <Eyebrow live>the forecast</Eyebrow>
          <h2 className="desk-h2 desk-h2-center">a probabilistic call, the instant the math allows.</h2>
          {fcDoc ? (
            <div className="desk-fc-race" key={`r-${fcDoc.id}`}>
              {fcDoc.contest} — {fcDoc.stateName || fcDoc.province}
            </div>
          ) : null}
          <div className="desk-fc-gauge">
            {fcRace && fcNeedle ? (
              <SwingOMeter
                c1Name={fcNeedle.leaderName}
                c2Name={fcNeedle.runnerName}
                c1Color={fcNeedle.leaderColor}
                c2Color={fcNeedle.runnerColor}
                c1Prob={fcIn ? fcNeedle.pLeader : 0.5}
                c2Prob={fcIn ? fcNeedle.pRunner : 0.5}
                reportingPct={fcNeedle.reporting}
                marginPp={fcIn ? fcNeedle.marginPp : 0}
              />
            ) : (
              <Placeholder />
            )}
          </div>
          {fcNeedle ? (
            <div className="desk-fc-meta">
              <span><i style={{ background: fcNeedle.leaderColor }} />{surname(fcNeedle.leaderName)} leads</span>
              <em>·</em>
              <span>{fcNeedle.reporting.toFixed(0)}% reporting</span>
              <em>·</em>
              <span>same model, every state</span>
            </div>
          ) : null}
          {fcPool.length > 1 ? (
            <div className="desk-fc-dots" aria-hidden>
              {fcPool.map((_, k) => <i key={k} className={k === fcIdx % fcPool.length ? "on" : ""} />)}
            </div>
          ) : null}
        </div>
      </section>

      {/* 5 · the whole season — count-up + the season's monthly volume */}
      <section className="desk-scale" ref={scaleRef as any}>
        <div className="desk-scale-wrap">
          <div className="desk-scale-left">
            <Eyebrow live>the whole season</Eyebrow>
            <div className="desk-scale-num">{count ? fmtInt(shownCount) : "—"}</div>
            <div className="desk-scale-lab">contests across the 2026 season · every state · every election night</div>
            <div className={`desk-scale-stats ${scaleIn ? "is-in" : ""}`}>
              <div className="desk-scale-stat"><b>{seasonStats ? seasonStats.nights : "—"}</b><span>election nights</span></div>
              <div className="desk-scale-stat"><b>{seasonStats ? fmtInt(seasonStats.bigN) : "—"}</b><span>biggest single night</span></div>
              <div className="desk-scale-stat"><b>50<em>+</em></b><span>states &amp; territories</span></div>
            </div>
          </div>
          <div className={`desk-scale-chart ${scaleIn ? "is-in" : ""}`} aria-hidden>
            {seasonBars.map((b, i) => (
              <div key={i} className="desk-bar" style={{ transitionDelay: `${i * 60}ms` }}>
                <span className="desk-bar-track"><span className="desk-bar-v" style={{ height: `${Math.max(4, b.pct)}%`, transitionDelay: `${i * 60}ms` }} /></span>
                <span className="desk-bar-l">{b.label}<i>{fmtInt(b.n)}</i></span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 6 · close — centered refrain */}
      <section className="desk-close">
        <div className="desk-shell">
          <h2 className="desk-close-h">search any race<em>.</em></h2>
          <button className="desk-close-cta" onClick={focusSearch}>start typing <span aria-hidden>↑</span></button>
          <div className="desk-foot">
            <span>The Public Sentiment Institute</span>
            <span>independent polling &amp; election analysis</span>
          </div>
        </div>
      </section>

      {/* sticky search pill — portaled to <body> so it escapes the global
          `psi-animate-in` transform (which would otherwise make this fixed
          element anchor to the page, not the viewport, and scroll away). */}
      {mounted &&
        createPortal(
          <button className={`desk-pill ${manrope.variable} ${showPill ? "show" : ""}`} onClick={focusSearch} aria-label="Search any race">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
              <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            search any race<kbd>/</kbd>
          </button>,
          document.body
        )}
    </div>
  );
}

const SHELLPAD = "max(20px, calc((100vw - 1180px) / 2))";

const DESK_CSS = `
html, body { background: #050505 !important; }
html { height: auto !important; overflow-y: auto !important; }
body { height: auto !important; min-height: 100svh; overflow: visible !important; overflow-x: clip !important; }
body header, body footer { display: none !important; }
body main > div { max-width: none !important; padding-left: 0 !important; padding-right: 0 !important; }
body main > div > div { padding-top: 0 !important; padding-bottom: 0 !important; }

.desk-page { position: relative; min-height: 100svh; color: #f4f4ef; background: #050505; overflow-x: clip;
  font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; font-size: 15px; letter-spacing: -0.01em;
  width: 100vw; margin-left: calc(50% - 50vw); }
.desk-page h1, .desk-page h2, .desk-page h3 { text-transform: none; margin: 0; }
.desk-shell { position: relative; z-index: 2; max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px, 4vw, 44px); }
.desk-grain { position: fixed; inset: -40px; z-index: 3; pointer-events: none; opacity: 0.045; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='160' height='160' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E"); }

/* the typographic through-line: a lime '>' mono eyebrow */
.desk-eyebrow { display: inline-flex; align-items: center; gap: 9px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.desk-eyebrow-mk { width: 7px; height: 7px; background: #b7ff00; border-radius: 1.5px; flex-shrink: 0; }
.desk-eyebrow-pip { width: 6px; height: 6px; border-radius: 99px; background: #e23950; box-shadow: 0 0 0 3px rgba(226,57,80,0.16); animation: desk-pip 1.8s ease-in-out infinite; }
@keyframes desk-pip { 0%,100% { opacity: 1 } 50% { opacity: 0.32 } }

.desk-h2 { font-family: var(--font-mp), "Manrope", sans-serif; font-size: clamp(30px, 4.4vw, 56px); font-weight: 500; letter-spacing: -0.035em; line-height: 1.04; text-transform: lowercase; color: #f4f4ef; margin-top: 16px; }
.desk-h2-center { text-align: center; max-width: 18ch; margin-left: auto; margin-right: auto; }
.desk-body { margin-top: 18px; max-width: 46ch; font-size: 16px; line-height: 1.62; color: rgba(244,244,239,0.6); }
.desk-textcta { display: inline-flex; align-items: center; gap: 8px; margin-top: 22px; background: none; border: 0; padding: 0; cursor: pointer; font-family: var(--font-mp); font-size: 14.5px; font-weight: 600; color: #b7ff00; }
.desk-textcta span { display: inline-block; transition: transform .16s ease; }
.desk-textcta:hover span { transform: translateX(4px); }

/* status bar */
.desk-status { position: sticky; top: 0; z-index: 40; background: rgba(5,5,5,0.82); -webkit-backdrop-filter: blur(12px); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.07); }
.desk-status-in { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 9px clamp(20px,4vw,44px); font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.42); font-family: var(--font-mp); }
.desk-status-l { display: inline-flex; align-items: center; gap: 9px; color: rgba(244,244,239,0.7); }
.desk-status em, .desk-status-l em, .desk-status-r em { font-style: normal; opacity: 0.4; }
.desk-pip { width: 7px; height: 7px; border-radius: 99px; background: #e23950; box-shadow: 0 0 0 3px rgba(226,57,80,0.18); animation: desk-pip 1.8s ease-in-out infinite; }

/* 1 · hero — z-index above the following sections so the search panel can
   never be painted under them */
.desk-hero { position: relative; z-index: 5; padding-bottom: clamp(50px, 11vh, 120px); isolation: isolate;
  background:
    radial-gradient(38% 52% at 15% 4%, rgba(29,78,216,0.26), transparent 60%),
    radial-gradient(46% 58% at 86% 14%, rgba(124,77,255,0.26), transparent 62%),
    radial-gradient(54% 60% at 64% 98%, rgba(176,34,56,0.18), transparent 64%),
    #050505; }
/* the LED-wall shader behind the hero (same as the homepage) — the CSS mesh
   on .desk-hero shows through wherever WebGL is unavailable */
.desk-shader { position: absolute; inset: 0; z-index: 0; width: 100%; height: 100%; display: block; }
.desk-shader-fade { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background:
    radial-gradient(46% 52% at 50% 47%, rgba(5,5,5,0.76), rgba(5,5,5,0.30) 56%, transparent 76%),
    radial-gradient(80% 60% at 50% 0%, rgba(5,5,5,0.0), rgba(5,5,5,0.5) 100%),
    linear-gradient(180deg, rgba(5,5,5,0.28) 0%, rgba(5,5,5,0.02) 28%, rgba(5,5,5,0.5) 78%, #050505 100%); }
.desk-hero .desk-shell { position: relative; z-index: 3; }
/* faint coordinate-dot field for depth (masked to the center) */
.desk-hero::after { content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
  background-image: radial-gradient(rgba(244,244,239,0.055) 1px, transparent 1.4px); background-size: 30px 30px;
  -webkit-mask: radial-gradient(72% 66% at 50% 42%, #000 26%, transparent 74%); mask: radial-gradient(72% 66% at 50% 42%, #000 26%, transparent 74%); }
.desk-folio { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 0; margin-top: 6px; border-top: 1px solid rgba(255,255,255,0.10); border-bottom: 1px solid rgba(255,255,255,0.07); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(244,244,239,0.4); }
.desk-folio span:first-child { color: #f4f4ef; }
.desk-hero-main { padding-top: clamp(40px, 11vh, 110px); max-width: 940px; margin: 0 auto; text-align: center; }
.desk-title { font-family: var(--font-mp), "Manrope", "Helvetica Neue", Arial, sans-serif; font-weight: 500; text-transform: lowercase; letter-spacing: -0.045em; line-height: 0.9; font-size: clamp(56px, 11vw, 140px); color: #f4f4ef; }
.desk-title em { font-style: normal; color: #b7ff00; }
/* kinetic title — each word rises out of its own clip */
.desk-tw { display: inline-block; overflow: hidden; vertical-align: bottom; margin-right: 0.2em; }
.desk-tw:last-of-type { margin-right: 0; }
.desk-tw > span { display: inline-block; transform: translateY(112%); animation: deskWordUp 0.9s cubic-bezier(.16,1,.3,1) forwards; }
@keyframes deskWordUp { to { transform: none; } }
/* live readout under the search */
.desk-hero-stats { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 12px; margin-top: clamp(20px, 3.4vh, 32px); font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.42); }
.desk-hero-stats b { font-weight: 700; color: #f4f4ef; }
.desk-hero-stats em { font-style: normal; color: rgba(183,255,0,0.5); }
.desk-hero-stats .live { display: inline-flex; align-items: center; gap: 7px; color: rgba(183,255,0,0.85); }
.desk-hero-nightlink { background: none; border: 0; padding: 0; cursor: pointer; font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit; border-bottom: 1px solid rgba(183,255,0,0.35); padding-bottom: 1px; transition: color .15s ease, border-color .15s ease; }
.desk-hero-nightlink:hover { color: #f4f4ef; border-color: #b7ff00; }
.desk-hero-nightlink b { font-weight: 700; color: #f4f4ef; }
.desk-hero-stats .live i { width: 6px; height: 6px; border-radius: 99px; background: #b7ff00; box-shadow: 0 0 9px rgba(183,255,0,0.7); animation: desk-pip 1.8s ease-in-out infinite; }
/* chyron ticker — real contests streaming across the hero's base */
.desk-ticker { position: relative; z-index: 1; margin-top: clamp(44px, 9vh, 92px); border-top: 1px solid rgba(255,255,255,0.09); border-bottom: 1px solid rgba(255,255,255,0.09); background: rgba(5,5,5,0.55); -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); overflow: hidden;
  -webkit-mask: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent); mask: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent); }
.desk-ticker-track { display: flex; width: max-content; animation: deskTick 60s linear infinite; }
.desk-ticker:hover .desk-ticker-track { animation-play-state: paused; }
.desk-ticker-row { display: flex; }
@keyframes deskTick { to { transform: translateX(-50%); } }
.desk-tick { display: inline-flex; align-items: center; gap: 9px; padding: 12px 0 12px 26px; background: none; border: 0; cursor: pointer; white-space: nowrap; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; letter-spacing: 0.02em; color: rgba(244,244,239,0.6); transition: color .15s ease; }
.desk-tick::after { content: '◆'; margin-left: 26px; font-size: 6px; color: rgba(183,255,0,0.38); }
.desk-tick:hover { color: #f4f4ef; }
.desk-tick:hover .desk-tick-name { color: #f4f4ef; }
.desk-tick-dot { width: 7px; height: 7px; border-radius: 99px; flex-shrink: 0; }
.desk-tick-st { font-weight: 700; color: #f4f4ef; }
.desk-tick-name { color: rgba(244,244,239,0.55); transition: color .15s ease; }
.desk-tick b { font-weight: 700; }
.desk-tick-rep { color: rgba(244,244,239,0.35); }
.desk-lede { margin: clamp(18px, 3vh, 28px) auto 0; max-width: 54ch; font-size: clamp(15px, 1.5vw, 18px); line-height: 1.55; color: rgba(244,244,239,0.6); }
/* z-index lifts the open panel above the chip/stat rows below (their reveal
   transforms create stacking contexts that would otherwise paint over it) */
.desk-hero-search { position: relative; z-index: 30; margin: clamp(22px, 4vh, 38px) auto 0; max-width: 760px; }
.desk-chips { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-top: 16px; }
.desk-chip { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; color: rgba(244,244,239,0.55); background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 7px 13px; cursor: pointer; transition: color .16s ease, border-color .16s ease, background .16s ease; }
.desk-chip:hover { color: #f4f4ef; border-color: rgba(183,255,0,0.4); background: rgba(183,255,0,0.06); }

/* the inline search field (DeskSearch) */
.desk-search-field { position: relative; display: flex; align-items: center; gap: 12px; padding: 0 16px; height: 60px; border-radius: 16px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.12); transition: border-color .18s ease, background .18s ease, box-shadow .2s ease; }
.desk-search.pill .desk-search-field { height: 46px; border-radius: 999px; }
.desk-search-field:focus-within { border-color: rgba(183,255,0,0.55); background: rgba(255,255,255,0.06); box-shadow: 0 0 0 4px rgba(183,255,0,0.08); }
.desk-search-icon { color: rgba(244,244,239,0.4); flex-shrink: 0; }
.desk-search-field input { flex: 1; min-width: 0; background: none; border: 0; outline: none; color: #f4f4ef; font-family: var(--font-mp); font-size: 16px; letter-spacing: -0.01em; }
.desk-search-field input::placeholder { color: rgba(244,244,239,0.38); }
/* hero variant — deeper glass, quiet and confident */
.desk-search.hero .desk-search-field { height: 66px; border-radius: 18px; padding: 0 18px; background: rgba(9,10,13,0.72); border: 1px solid rgba(255,255,255,0.14); -webkit-backdrop-filter: blur(18px); backdrop-filter: blur(18px); box-shadow: 0 26px 64px -30px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.06); }
.desk-search.hero .desk-search-field input { font-size: 16.5px; }
.desk-search.hero .desk-search-field:focus-within { border-color: rgba(183,255,0,0.55); box-shadow: 0 0 0 1px rgba(183,255,0,0.3), 0 0 52px -10px rgba(183,255,0,0.22), 0 26px 64px -30px rgba(0,0,0,0.9); }
.desk-search-kbd { flex-shrink: 0; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: rgba(244,244,239,0.4); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 3px 7px; background: rgba(255,255,255,0.03); }
/* the response panel — a query ledger, not an autocomplete blob */
.desk-search-pop { position: absolute; top: calc(100% + 10px); left: 0; right: 0; z-index: 50; border-radius: 16px; border: 1px solid rgba(255,255,255,0.13); background: rgba(7,8,11,0.98); -webkit-backdrop-filter: blur(24px) saturate(1.2); backdrop-filter: blur(24px) saturate(1.2); box-shadow: 0 34px 90px -18px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.05); overflow: hidden; animation: deskPop .18s cubic-bezier(.2,.8,.2,1); }
@keyframes deskPop { from { opacity: 0; transform: translateY(-6px); } }
.desk-spop-h { display: flex; justify-content: space-between; gap: 12px; padding: 10px 16px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(244,244,239,0.38); border-bottom: 1px solid rgba(255,255,255,0.08); }
.desk-spop-h span:last-child { color: rgba(183,255,0,0.55); }
.desk-srow { position: relative; display: grid; grid-template-columns: 3px 42px minmax(0,1fr) auto; align-items: center; gap: 13px; width: 100%; text-align: left; border: 0; cursor: pointer; padding: 12px 16px; background: transparent; transition: background .12s ease; }
.desk-srow + .desk-srow { border-top: 1px solid rgba(255,255,255,0.05); }
.desk-srow[data-active="1"] { background: rgba(183,255,0,0.045); }
.desk-srow[data-active="1"]::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #b7ff00; box-shadow: 0 0 12px rgba(183,255,0,0.55); }
.desk-srow-tick { width: 3px; height: 26px; border-radius: 2px; }
.desk-srow-st { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.03em; color: #f4f4ef; }
.desk-srow-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.desk-srow-title { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: #f4f4ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-hl { background: none; color: #b7ff00; }
.desk-srow-meta { font-size: 10.5px; color: rgba(244,244,239,0.4); text-transform: lowercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-srow-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
.desk-srow-right b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11px; font-weight: 700; white-space: nowrap; }
.desk-srow-right > span { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; color: rgba(244,244,239,0.35); }
.desk-srow-await { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; color: rgba(244,244,239,0.32); text-transform: uppercase; letter-spacing: 0.08em; }
.desk-search-empty { padding: 20px 16px; color: rgba(244,244,239,0.5); font-size: 13px; }
.desk-search-empty b { color: #b7ff00; font-weight: 600; }
.desk-search-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 9px 16px; border-top: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; letter-spacing: 0.08em; text-transform: uppercase; color: rgba(244,244,239,0.35); }
.desk-search-keys { color: rgba(244,244,239,0.45); }

/* ── editorial section signage: heading block + ghost numeral ── */
.desk-sechead { position: relative; z-index: 1; max-width: 1280px; margin: 0 auto; padding: 0 clamp(20px,4vw,44px); display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1); }
.desk-sechead.is-in { opacity: 1; transform: none; }
.desk-sechead-l { max-width: 620px; }
.desk-sechead-l .desk-body { margin-left: 0; }
.desk-ghost { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 800; font-size: clamp(96px, 13vw, 200px); line-height: 0.72; letter-spacing: -0.06em; color: transparent; -webkit-text-stroke: 1.5px rgba(244,244,239,0.13); user-select: none; flex-shrink: 0; transform: translateY(10%); pointer-events: none; }

/* 2 · the call — featured board on stage + the docket ledger */
.desk-call { position: relative; padding: clamp(64px, 13vh, 150px) 0; overflow: hidden; }
.desk-call-layout { position: relative; max-width: 1280px; margin: clamp(34px,5.5vh,60px) auto 0; padding: 0 clamp(20px,4vw,44px); display: grid; grid-template-columns: minmax(320px, 5fr) 7fr; gap: clamp(28px,3.6vw,64px); align-items: center; }
/* docket — a rundown sheet, not cards */
.desk-docket { display: flex; flex-direction: column; }
.desk-docket-h { display: flex; justify-content: space-between; align-items: baseline; padding-bottom: 12px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.22em; text-transform: uppercase; color: rgba(244,244,239,0.38); }
.desk-docket-live { color: rgba(183,255,0,0.7); }
.desk-docket-row { position: relative; display: grid; grid-template-columns: 26px 42px minmax(0,1fr) auto auto 18px; align-items: center; gap: 12px; padding: 15px 8px; background: none; border: 0; border-top: 1px solid rgba(255,255,255,0.09); cursor: pointer; text-align: left; opacity: 0; transform: translateX(-16px); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1), background .2s ease; }
.desk-docket-row.on { background: rgba(183,255,0,0.045); }
.desk-docket-row.on::after { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 2px; background: #b7ff00; box-shadow: 0 0 12px rgba(183,255,0,0.55); }
.desk-docket-row.on .desk-docket-idx { color: #b7ff00; }
.desk-call-layout.is-in .desk-docket-row { opacity: 1; transform: none; }
.desk-docket-row:last-of-type { border-bottom: 1px solid rgba(255,255,255,0.09); }
.desk-docket-row:hover { background: rgba(255,255,255,0.03); }
.desk-docket-idx { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; font-weight: 700; color: rgba(183,255,0,0.55); }
.desk-docket-st { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 15px; font-weight: 800; letter-spacing: 0.02em; color: #f4f4ef; }
.desk-docket-main { min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.desk-docket-main b { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13px; font-weight: 600; color: #f4f4ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-docket-main span { font-size: 10.5px; color: rgba(244,244,239,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-docket-lead { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.desk-docket-flag { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 11px; font-weight: 600; color: rgba(244,244,239,0.4); white-space: nowrap; }
.desk-docket-flag.called { color: rgba(183,255,0,0.75); }
.desk-docket-go { font-size: 12px; color: rgba(244,244,239,0.3); transition: transform .2s ease, color .2s ease; }
.desk-docket-row:hover .desk-docket-go { transform: translateX(3px); color: #b7ff00; }
/* the stage — featured board, stamped */
.desk-call-stage { position: relative; opacity: 0; transform: translateX(36px); transition: opacity .7s ease .1s, transform .8s cubic-bezier(.16,1,.3,1) .1s; }
.desk-call-layout.is-in .desk-call-stage { opacity: 1; transform: none; }
.desk-glow { position: absolute; inset: -24% -12%; z-index: 0; filter: blur(40px); pointer-events: none; }
.desk-call-stage > :not(.desk-glow) { position: relative; z-index: 1; }
.desk-stage-fig { display: flex; align-items: center; gap: 12px; margin-top: 14px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.34); }
.desk-stage-fig i { flex: 0 0 34px; height: 1px; background: rgba(183,255,0,0.4); }
/* each board slides onto the stage */
.desk-stage-swap { position: relative; animation: stageIn .6s cubic-bezier(.2,.8,.2,1) both; }
@keyframes stageIn { from { opacity: 0; transform: translateX(28px) scale(0.985); } to { opacity: 1; transform: none; } }
/* 3.5 · the walkthrough — alternating film frames */
.desk-film { position: relative; padding: clamp(70px, 13vh, 150px) 0 clamp(50px, 9vh, 110px); }
.desk-film .desk-h2 em { font-style: normal; color: #b7ff00; }
.desk-film-rows { max-width: 1280px; margin: clamp(44px, 7vh, 84px) auto 0; padding: 0 clamp(20px, 4vw, 44px); display: grid; gap: clamp(84px, 13vh, 170px); }
.desk-film-row { display: grid; grid-template-columns: minmax(280px, 5fr) minmax(0, 7fr); gap: clamp(30px, 5vw, 76px); align-items: center; }
.desk-film-row.rev { grid-template-columns: minmax(0, 7fr) minmax(280px, 5fr); }
.desk-film-row.rev .desk-film-copy { order: 2; }
.desk-film-row.rev .desk-film-media { order: 1; }
.desk-film-h { margin-top: 14px; font-family: var(--font-mp), "Manrope", sans-serif; font-size: clamp(22px, 2.4vw, 31px); font-weight: 500; letter-spacing: -0.03em; line-height: 1.12; text-transform: lowercase; color: #f4f4ef; }
.desk-film-p { margin-top: 12px; max-width: 44ch; font-size: 15px; line-height: 1.62; color: rgba(244,244,239,0.58); }
.desk-film-media { position: relative; will-change: transform; }
.desk-film-halo { position: absolute; inset: -14% -10%; z-index: 0; border-radius: 40px; background: radial-gradient(60% 60% at 50% 46%, rgba(124,58,237,0.26), transparent 70%); filter: blur(36px); opacity: var(--film-halo, 0.35); pointer-events: none; }
.desk-film-frame { position: relative; z-index: 1; margin: 0; border-radius: 10px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: #08080a; box-shadow: 0 40px 110px rgba(0,0,0,0.6), 0 6px 24px rgba(0,0,0,0.45); }
.desk-film-frame img, .desk-film-frame video { display: block; width: 100%; height: auto; }
/* the centered video row — the section's featured plate, wider than the shell */
.desk-film-row.center { display: block; width: 100vw; margin-left: calc(50% - 50vw); padding: 0 clamp(16px, 3vw, 40px); }
.desk-film-row.center .desk-film-media { max-width: min(1320px, 100%); margin: 0 auto; }
.desk-film-row.center .desk-film-frame { border-radius: 12px; }
.desk-film-row.center .desk-film-halo { background: radial-gradient(58% 58% at 50% 46%, rgba(37,99,235,0.28), transparent 70%); }
.desk-film-cap { margin-top: 28px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.desk-film-cap .desk-film-p { margin-top: 10px; max-width: 54ch; }

/* the forecast's cycling race line + progress dots */
.desk-fc-race { margin: 18px auto 4px; text-align: center; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.55); max-width: 70ch; animation: capIn .5s ease both; }
.desk-fc-dots { display: flex; justify-content: center; gap: 5px; margin-top: 18px; }
.desk-fc-dots i { width: 5px; height: 5px; border-radius: 99px; background: rgba(255,255,255,0.18); transition: background .35s ease, width .35s ease; }
.desk-fc-dots i.on { width: 16px; background: #b7ff00; }

/* 3 · precinct gallery — the one sunken slab */
.desk-precinct { position: relative; background: #08080a; border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05); padding: clamp(60px, 12vh, 130px) 0; overflow: hidden; }
.desk-precinct::before { content: ''; position: absolute; inset: 0; pointer-events: none; background: radial-gradient(60% 50% at 78% 12%, rgba(124,77,255,0.10), transparent 64%); }
.desk-precinct-head { position: relative; max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px,4vw,44px); opacity: 0; transform: translateY(18px); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1); }
.desk-precinct-head.is-in { opacity: 1; transform: none; }
.desk-precinct-head .desk-body { margin-left: 0; }

/* the county atlas — editorial plates: one hero specimen + smaller figures,
   frameless maps floating with a tone glow, museum-style captions. */
.desk-atlaswrap { position: relative; max-width: 1280px; margin: clamp(34px,6vh,64px) auto 0; padding: 0 clamp(20px,4vw,44px); }
.desk-atlas-side { display: none; position: absolute; top: 10px; left: -14px; writing-mode: vertical-rl; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.34em; text-transform: uppercase; color: rgba(244,244,239,0.18); pointer-events: none; }
@media (min-width: 1360px) { .desk-atlas-side { display: block; } }
/* anchored composition: hero plate left, a tight 2×2 rail of specimens right —
   the rail stretches to the hero's height so the two columns close together */
.desk-atlas { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: clamp(28px,3.4vw,56px); align-items: stretch; }
.desk-atlas-main { min-width: 0; display: flex; }
.desk-atlas-main .desk-plate { flex: 1; }
.desk-atlas-rail { min-width: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); grid-template-rows: 1fr 1fr; gap: clamp(22px,2.6vw,36px) clamp(16px,2vw,28px); }
.desk-plate { position: relative; display: flex; flex-direction: column; gap: 12px; cursor: pointer; background: none; border: 0; padding: 0; text-align: left; opacity: 0; transform: translateY(26px); transition: opacity .7s ease, transform .7s cubic-bezier(.16,1,.3,1); }
.desk-atlaswrap.is-in .desk-plate { opacity: 1; transform: none; }
.desk-atlaswrap.is-in .desk-atlas-rail .desk-plate:nth-child(1) { transition-delay: .1s; }
.desk-atlaswrap.is-in .desk-atlas-rail .desk-plate:nth-child(2) { transition-delay: .18s; }
.desk-atlaswrap.is-in .desk-atlas-rail .desk-plate:nth-child(3) { transition-delay: .26s; }
.desk-atlaswrap.is-in .desk-atlas-rail .desk-plate:nth-child(4) { transition-delay: .34s; }
.desk-plate:focus-visible { outline: 2px solid #b7ff00; outline-offset: 6px; border-radius: 4px; }
.desk-plate-map { position: relative; flex: 1; min-height: 132px; transition: transform .4s cubic-bezier(.16,1,.3,1); }
.desk-plate.hero .desk-plate-map { min-height: clamp(380px, 44vh, 470px); }
.desk-plate:hover .desk-plate-map { transform: translateY(-6px); }
.desk-plate-map::before { content: ''; position: absolute; inset: -10% -4%; z-index: 0; border-radius: 40px;
  background: radial-gradient(58% 58% at 50% 46%, color-mix(in srgb, var(--t,#69f) 28%, transparent), transparent 72%);
  filter: blur(26px); opacity: 0.4; transition: opacity .4s ease; }
.desk-plate:hover .desk-plate-map::before { opacity: 0.95; }
.desk-plate-map .opa-er-map { position: absolute; inset: 0; width: 100%; height: 100%; z-index: 1; }
.desk-plate-map .opa-er-mapvig { display: none; }
/* cycling: each new map settles in with a soft focus-pull */
.desk-plate-swap { position: absolute; inset: 0; z-index: 1; animation: plateIn .75s cubic-bezier(.2,.8,.2,1) both; }
@keyframes plateIn { from { opacity: 0; transform: scale(1.04); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
.desk-plate-cap { animation: capIn .5s ease both; }
@keyframes capIn { from { opacity: 0.2; } to { opacity: 1; } }
.desk-plate-dots { position: absolute; left: 4px; bottom: 4px; z-index: 3; display: flex; gap: 4px; }
.desk-plate-dots i { width: 4px; height: 4px; border-radius: 99px; background: rgba(255,255,255,0.2); transition: background .35s ease, width .35s ease; }
.desk-plate-dots i.on { width: 13px; background: color-mix(in srgb, var(--t,#b7ff00) 75%, #fff); }
.desk-plate-cap { display: flex; align-items: baseline; gap: 12px; border-top: 1px solid rgba(255,255,255,0.1); padding: 10px 2px 0; }
.desk-plate-no { flex-shrink: 0; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: rgba(183,255,0,0.65); }
.desk-plate-body { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
.desk-plate-body b { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 12.5px; font-weight: 600; color: #f4f4ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-plate-body span { font-size: 10px; color: rgba(244,244,239,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.desk-plate-lead { flex-shrink: 0; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10.5px; font-weight: 700; white-space: nowrap; }
.desk-plate.hero .desk-plate-body b { font-size: 14.5px; }
.desk-plate.hero .desk-plate-lead { font-size: 12px; }
.desk-plate-cta { display: inline-flex; align-items: center; gap: 8px; margin-top: 4px; align-self: flex-start; padding-bottom: 2px; border-bottom: 1px solid rgba(244,244,239,0.2); font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; letter-spacing: -0.01em; color: #f4f4ef; transition: border-color .2s ease; }
.desk-plate-cta i { font-style: normal; color: #b7ff00; transition: transform .2s ease; }
.desk-plate.hero:hover .desk-plate-cta { border-color: #b7ff00; }
.desk-plate.hero:hover .desk-plate-cta i { transform: translateX(4px); }

/* on the ballot — a horizontally scrolling rail of the night's races */
.desk-tonight { position: relative; border-top: 1px solid rgba(255,255,255,0.07); border-bottom: 1px solid rgba(255,255,255,0.05); background: linear-gradient(180deg, rgba(183,255,0,0.04), transparent 70%); padding: clamp(30px, 5.5vh, 56px) 0 clamp(26px, 4.5vh, 44px); }
.desk-tonight-head { max-width: 1180px; margin: 0 auto; padding: 0 clamp(20px,4vw,44px); display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; flex-wrap: wrap; }
.desk-tonight-h { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 500; text-transform: lowercase; letter-spacing: -0.03em; line-height: 1.05; font-size: clamp(24px, 3.2vw, 40px); color: #f4f4ef; margin-top: 10px; }
.desk-tonight-h em { font-style: normal; color: #b7ff00; }
.desk-tonight-tools { display: flex; align-items: center; gap: 20px; flex-wrap: wrap; }
.desk-tonight-find { display: inline-flex; align-items: center; gap: 9px; height: 40px; padding: 0 14px; border-radius: 999px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.11); color: rgba(244,244,239,0.45); transition: border-color .18s ease; }
.desk-tonight-find:focus-within { border-color: rgba(183,255,0,0.5); }
.desk-tonight-find input { width: 150px; background: none; border: 0; outline: none; color: #f4f4ef; font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; }
.desk-tonight-find input::placeholder { color: rgba(244,244,239,0.35); }
.desk-textlink { display: inline-flex; align-items: center; gap: 8px; padding: 0 1px 3px; cursor: pointer; background: none; border: 0; border-bottom: 1px solid rgba(244,244,239,0.22); font-family: var(--font-mp), "Manrope", sans-serif; font-size: 14px; font-weight: 600; letter-spacing: -0.01em; color: #f4f4ef; transition: border-color .2s ease; }
.desk-textlink:hover { border-color: #b7ff00; }
.desk-textlink span { color: #b7ff00; transition: transform .2s ease; }
.desk-textlink:hover span { transform: translateX(3px); }
.desk-tn-rail { display: flex; gap: 14px; margin-top: clamp(20px, 3.4vh, 30px); padding: 6px clamp(20px,4vw,44px) 10px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity;
  -webkit-mask: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent); mask: linear-gradient(90deg, transparent, #000 3.5%, #000 96.5%, transparent); }
.desk-tn-rail::-webkit-scrollbar { display: none; }
.desk-tn-card { scroll-snap-align: start; flex: 0 0 258px; display: flex; flex-direction: column; align-items: flex-start; gap: 7px; padding: 16px 16px 14px; text-align: left; cursor: pointer; border-radius: 16px;
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)); border: 1px solid rgba(255,255,255,0.1);
  transition: transform .3s cubic-bezier(.16,1,.3,1), border-color .2s ease, box-shadow .3s ease; }
.desk-tn-card:hover { transform: translateY(-4px); border-color: color-mix(in srgb, var(--t,#9ab) 45%, rgba(255,255,255,0.14)); box-shadow: 0 22px 44px -24px rgba(0,0,0,0.8); }
.desk-tn-card:focus-visible { outline: 2px solid #b7ff00; outline-offset: 3px; }
.desk-tn-top { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.desk-tn-top b { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13px; font-weight: 800; letter-spacing: 0.04em; color: #f4f4ef; }
.desk-tn-top i { width: 7px; height: 7px; border-radius: 99px; background: rgba(244,244,239,0.2); }
.desk-tn-top i.on { background: var(--t, #b7ff00); box-shadow: 0 0 8px color-mix(in srgb, var(--t,#b7ff00) 60%, transparent); }
.desk-tn-name { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; line-height: 1.3; color: #f4f4ef; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; min-height: 2.6em; }
.desk-tn-meta { font-size: 10.5px; color: rgba(244,244,239,0.42); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.desk-tn-lead { display: flex; align-items: center; justify-content: space-between; width: 100%; margin-top: 3px; padding-top: 9px; border-top: 1px solid rgba(255,255,255,0.07); }
.desk-tn-lead b { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 700; white-space: nowrap; }
.desk-tn-lead b.dim { color: rgba(244,244,239,0.35); font-weight: 500; }
.desk-tn-lead span { font-size: 12px; color: rgba(244,244,239,0.3); transition: transform .2s ease, color .2s ease; }
.desk-tn-card:hover .desk-tn-lead span { transform: translateX(3px); color: #b7ff00; }
.desk-tn-none { max-width: 1180px; margin: 22px auto 0; padding: 0 clamp(20px,4vw,44px); font-size: 13.5px; color: rgba(244,244,239,0.5); }

/* browse by night — day toggle strip (no calendar) */
.desk-nights { position: relative; padding: clamp(40px, 8vh, 88px) 0; }
.desk-nights-head { max-width: 1180px; margin: 0 auto 20px; padding: 0 clamp(20px,4vw,44px); }
.desk-nights-h { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 500; text-transform: lowercase; letter-spacing: -0.03em; font-size: clamp(26px, 4vw, 44px); color: #f4f4ef; line-height: 1; margin-top: 8px; }
.desk-nights-h em { font-style: normal; color: #b7ff00; }
.desk-days { display: flex; gap: 12px; max-width: 1180px; margin: 0 auto; padding: 4px clamp(20px,4vw,44px) 16px; overflow-x: auto; scrollbar-width: none; scroll-snap-type: x proximity;
  -webkit-mask: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); mask: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent); }
.desk-days::-webkit-scrollbar { display: none; }
.desk-day { scroll-snap-align: start; flex: 0 0 auto; display: flex; flex-direction: column; align-items: flex-start; gap: 2px; min-width: 118px; padding: 14px 16px 13px; cursor: pointer; border-radius: 16px; text-align: left;
  background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.012)); border: 1px solid rgba(255,255,255,0.09);
  transition: transform .25s cubic-bezier(.16,1,.3,1), border-color .2s ease, background .2s ease; }
.desk-day:hover { transform: translateY(-4px); border-color: rgba(183,255,0,0.5); background: rgba(183,255,0,0.07); }
.desk-day:focus-visible { outline: 2px solid #b7ff00; outline-offset: 2px; }
.desk-day.big { border-color: rgba(183,255,0,0.34); background: linear-gradient(180deg, rgba(183,255,0,0.075), rgba(183,255,0,0.015)); }
.desk-day-mo { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.desk-day-d { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 30px; font-weight: 700; line-height: 0.95; color: #f4f4ef; letter-spacing: -0.035em; }
.desk-day-bar { display: block; width: 100%; height: 3px; border-radius: 99px; background: rgba(255,255,255,0.08); overflow: hidden; margin: 6px 0 3px; }
.desk-day-bar i { display: block; height: 100%; border-radius: 99px; background: rgba(244,244,239,0.4); transition: background .2s ease; }
.desk-day.big .desk-day-bar i { background: #b7ff00; box-shadow: 0 0 8px rgba(183,255,0,0.5); }
.desk-day:hover .desk-day-bar i { background: #b7ff00; }
.desk-day-n { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; color: rgba(244,244,239,0.42); white-space: nowrap; }
.desk-day.big .desk-day-n { color: rgba(183,255,0,0.78); }
.desk-precinct-gallery { position: relative; max-width: 1180px; margin: clamp(30px,5vh,54px) auto 0; padding: 0 clamp(20px,4vw,44px); display: flex; flex-direction: column; gap: clamp(16px,2vw,26px); }
.desk-precinct-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: clamp(16px,2vw,26px); }
.desk-precinct-row .pp { min-height: clamp(230px, 28vh, 300px); }

.desk-precinct-glow { position: absolute; left: -6%; right: -6%; top: -8%; height: 78%; z-index: 0; pointer-events: none;
  background: radial-gradient(48% 60% at 28% 42%, rgba(124,77,255,0.20), transparent 70%), radial-gradient(44% 56% at 80% 52%, rgba(29,78,216,0.13), transparent 72%); filter: blur(26px); }
.desk-precinct-gallery > .pp, .desk-precinct-col { position: relative; z-index: 1; }

/* a precinct panel — staged like a lifted fragment of the live map */
.pp { position: relative; display: flex; flex-direction: column; cursor: pointer; border-radius: 18px;
  background: linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.015));
  border: 1px solid rgba(255,255,255,0.10); overflow: hidden;
  box-shadow: 0 30px 72px -34px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.07);
  transition: transform .45s cubic-bezier(.16,1,.3,1), border-color .3s ease, box-shadow .45s ease; }
.pp-lead { min-height: clamp(400px, 56vh, 600px); }
.pp:hover { transform: translateY(-4px);
  border-color: color-mix(in srgb, var(--pp-tone,#66a) 55%, rgba(255,255,255,0.14));
  box-shadow: 0 44px 96px -34px rgba(0,0,0,0.95), 0 0 0 1px color-mix(in srgb, var(--pp-tone,#66a) 30%, transparent), 0 0 70px -12px color-mix(in srgb, var(--pp-tone,#66a) 28%, transparent); }
.pp:focus-visible { outline: 2px solid #b7ff00; outline-offset: 3px; }

.pp-frame { position: relative; flex: 1; min-height: 0; overflow: hidden;
  background: radial-gradient(130% 120% at 50% 24%, color-mix(in srgb, var(--pp-tone,#556) 18%, #0b0d12), #06070a); }
/* esri: render the embedded app larger, then scale down so its chrome reads small */
.pp-iframe { position: absolute; top: 0; left: 0; width: 154%; height: 154%; transform: scale(0.65); transform-origin: 0 0; border: 0; pointer-events: none; background: #0b0d12; transition: opacity .7s ease; }
/* svg map fills the frame */
.pp-map, .pp-map .opa-er-map { position: absolute; inset: 0; width: 100%; height: 100%; }
.pp-map .opa-er-mapvig { display: none; }
.pp-esri .pp-grid { display: none; } /* the live map has its own detail */

.pp-skeleton { position: absolute; inset: 0; background: radial-gradient(130% 120% at 50% 24%, color-mix(in srgb, var(--pp-tone,#556) 26%, #0b0d12), #06070a); transition: opacity .7s ease; }
.pp-skeleton::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg, transparent 30%, rgba(255,255,255,0.06) 50%, transparent 70%); background-size: 220% 100%; animation: desk-sh 1.5s linear infinite; }

/* faint coordinate grid — reads as a real map surface, not a flat screenshot */
.pp-grid { position: absolute; inset: 0; pointer-events: none; opacity: 0.55; z-index: 1;
  background-image: linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 38px 38px;
  -webkit-mask: radial-gradient(120% 100% at 50% 40%, #000 38%, transparent 80%); mask: radial-gradient(120% 100% at 50% 40%, #000 38%, transparent 80%); }
.pp-vignette { position: absolute; inset: 0; pointer-events: none; z-index: 1;
  box-shadow: inset 0 0 50px 18px rgba(6,7,10,0.62), inset 0 0 0 1px rgba(255,255,255,0.05);
  background: radial-gradient(140% 120% at 50% -8%, transparent 54%, rgba(6,7,10,0.5) 100%); }
.pp-sheen { position: absolute; inset: 0; pointer-events: none; z-index: 1; background: linear-gradient(180deg, rgba(255,255,255,0.07), transparent 18%); }

/* floating result badge — top-right, overlays the map like a real readout */
.pp-badge { position: absolute; top: 14px; right: 14px; z-index: 4; display: inline-flex; align-items: center; gap: 8px;
  padding: 7px 11px; border-radius: 11px; background: rgba(8,9,12,0.82); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px);
  border: 1px solid rgba(255,255,255,0.13); box-shadow: 0 14px 32px -16px rgba(0,0,0,0.85); }
.pp-badge-pip { width: 7px; height: 7px; border-radius: 99px; background: #e23950; box-shadow: 0 0 0 3px rgba(226,57,80,0.18); animation: desk-pip 1.8s ease-in-out infinite; }
.pp-badge-lead { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 12.5px; font-weight: 700; color: #f4f4ef; letter-spacing: -0.01em; text-transform: uppercase; }
.pp-badge-margin { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 11.5px; font-weight: 600; color: color-mix(in srgb, var(--pp-tone,#9ab) 70%, #fff); padding-left: 8px; border-left: 1px solid rgba(255,255,255,0.14); }

/* floating partisan-lean legend — bottom-left */
.pp-legend { position: absolute; left: 14px; bottom: 64px; z-index: 4; display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 10px; border-radius: 10px; background: rgba(8,9,12,0.82); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.13);
  font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 9.5px; font-weight: 700; color: rgba(244,244,239,0.6); }
.pp-legend-bar { width: 84px; height: 6px; border-radius: 99px; background: linear-gradient(90deg, #dc2626, #7c4dff 50%, #1d4ed8); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12); }

/* caption bar */
.pp-cap { position: relative; z-index: 3; display: flex; align-items: center; gap: 11px; padding: 12px 14px; background: rgba(8,9,12,0.86); -webkit-backdrop-filter: blur(14px); backdrop-filter: blur(14px); border-top: 1px solid rgba(255,255,255,0.08); }
.pp-cap-dot { width: 9px; height: 9px; border-radius: 99px; flex-shrink: 0; background: var(--pp-tone,#6a6); box-shadow: 0 0 0 3px color-mix(in srgb, var(--pp-tone,#6a6) 22%, transparent); }
.pp-cap-main { min-width: 0; flex: 1; display: flex; flex-direction: column; }
.pp-cap-title { font-family: var(--font-mp), "Manrope", sans-serif; font-size: 13.5px; font-weight: 600; color: #f4f4ef; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.pp-cap-meta { font-size: 11px; color: rgba(244,244,239,0.45); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.pp-cap-open { flex-shrink: 0; font-size: 13px; color: rgba(244,244,239,0.4); transition: transform .2s ease, color .2s ease; }
.pp:hover .pp-cap-open { color: #b7ff00; transform: translate(2px,-2px); }

/* cycling crossfade (re-runs each time the keyed map remounts) + position dots */
.pp-map { animation: ppMapIn .7s cubic-bezier(.2,.8,.2,1) both; }
@keyframes ppMapIn { from { opacity: 0; transform: scale(1.04); filter: blur(4px); } to { opacity: 1; transform: none; filter: none; } }
.pp-dots { position: absolute; left: 14px; bottom: 60px; z-index: 5; display: flex; gap: 5px; pointer-events: none; }
.pp-dots i { width: 5px; height: 5px; border-radius: 99px; background: rgba(255,255,255,0.28); transition: background .35s ease, width .35s ease; }
.pp-dots i.on { width: 15px; background: var(--pp-tone, #b7ff00); }

/* the lead reads as a "vision": its map dissolves into the page at the edges
   (feathered mask) with a soft blurred rim — not a hard embedded screenshot */
.pp-visionblur { display: none; }
.pp-esri.pp-lead { border: 0; background: transparent; border-radius: 0; overflow: visible; box-shadow: none; }
.pp-esri.pp-lead .pp-frame { border-radius: 28px;
  -webkit-mask: radial-gradient(128% 120% at 50% 44%, #000 36%, rgba(0,0,0,0.5) 66%, transparent 90%);
  mask: radial-gradient(128% 120% at 50% 44%, #000 36%, rgba(0,0,0,0.5) 66%, transparent 90%); }
.pp-esri.pp-lead .pp-visionblur { display: block; position: absolute; inset: 0; z-index: 2; pointer-events: none;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
  -webkit-mask: radial-gradient(120% 112% at 50% 44%, transparent 48%, #000 82%);
  mask: radial-gradient(120% 112% at 50% 44%, transparent 48%, #000 82%); }
.pp-esri.pp-lead .pp-vignette { box-shadow: none; background: radial-gradient(122% 114% at 50% 42%, transparent 42%, rgba(6,7,10,0.82) 92%); }
.pp-esri.pp-lead .pp-cap { position: absolute; left: 0; right: 0; bottom: 0; z-index: 5; border-top: 0; padding: 30px 22px 18px;
  background: linear-gradient(180deg, transparent, rgba(6,7,10,0.86) 62%); -webkit-backdrop-filter: none; backdrop-filter: none; }
.pp-esri.pp-lead .pp-badge { z-index: 5; }

/* 4 · forecast — centered float */
.desk-fc { padding: clamp(64px, 14vh, 170px) 0; }
.desk-fc-in { display: flex; flex-direction: column; align-items: center; text-align: center; }
.desk-fc-gauge { width: 100%; max-width: 460px; margin: clamp(26px, 5vh, 50px) auto 0; }
.desk-fc-meta { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: 26px; font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.desk-fc-meta i { display: inline-block; width: 8px; height: 8px; border-radius: 99px; margin-right: 7px; vertical-align: middle; }
.desk-fc-meta em { font-style: normal; opacity: 0.35; }

/* 5 · season scale — asymmetric big number */
.desk-scale { position: relative; padding: clamp(60px, 14vh, 170px) 0; overflow: hidden; }
.desk-scale-wrap { display: grid; grid-template-columns: 1.15fr 0.85fr; gap: clamp(16px, 3vw, 44px); align-items: center; padding-left: ${SHELLPAD}; padding-right: 0; }
.desk-scale-num { font-family: var(--font-mp), "Manrope", sans-serif; font-weight: 700; letter-spacing: -0.055em; line-height: 0.82; font-size: clamp(88px, 18vw, 240px); color: #f4f4ef; margin: 10px 0 0 -0.04em; font-variant-numeric: tabular-nums; }
.desk-scale-lab { margin-top: 16px; max-width: 34ch; font-size: 13px; letter-spacing: 0.05em; text-transform: uppercase; color: rgba(244,244,239,0.45); }
.desk-scale-stats { display: flex; gap: clamp(22px, 3.2vw, 50px); margin-top: clamp(24px, 3.4vh, 40px); flex-wrap: wrap; }
.desk-scale-stat { display: flex; flex-direction: column; gap: 5px; opacity: 0; transform: translateY(14px); transition: opacity .6s ease, transform .6s cubic-bezier(.16,1,.3,1); }
.desk-scale-stats.is-in .desk-scale-stat { opacity: 1; transform: none; }
.desk-scale-stats.is-in .desk-scale-stat:nth-child(2) { transition-delay: .1s; }
.desk-scale-stats.is-in .desk-scale-stat:nth-child(3) { transition-delay: .2s; }
.desk-scale-stat b { font-family: var(--font-mp), "Manrope", sans-serif; font-size: clamp(30px, 3.6vw, 48px); font-weight: 700; letter-spacing: -0.03em; line-height: 1; color: #f4f4ef; }
.desk-scale-stat b em { font-style: normal; color: #b7ff00; }
.desk-scale-stat span { font-size: 10.5px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; color: rgba(244,244,239,0.42); }
.desk-scale-grid { display: grid; grid-template-columns: repeat(48, 1fr); gap: 6px; margin-right: -40px; }
.desk-scale-grid span { aspect-ratio: 1; border-radius: 2px; background: rgba(255,255,255,0.07); opacity: 0; transform: scale(0.4); transition: opacity .5s ease, transform .5s cubic-bezier(.2,.8,.2,1); }
.desk-scale-grid.is-in span { opacity: 1; transform: none; }
@keyframes dotLive { 0%, 100% { opacity: 1; } 50% { opacity: 0.32; } }
.desk-scale-grid.is-in span.live { animation: dotLive 1.9s ease-in-out infinite; }

/* monthly contest-volume chart — the season's rhythm (replaces the dot grid) */
.desk-scale-chart { display: flex; align-items: stretch; gap: clamp(8px,1.4vw,18px); height: clamp(210px, 32vh, 330px); margin-right: -16px; }
.desk-bar { flex: 1; display: flex; flex-direction: column; gap: 10px; opacity: 0; transform: translateY(10px); transition: opacity .5s ease, transform .5s ease; }
.desk-scale-chart.is-in .desk-bar { opacity: 1; transform: none; }
.desk-bar-track { flex: 1; display: flex; align-items: flex-end; min-height: 0; }
.desk-bar-v { width: 100%; max-width: 62px; margin: 0 auto; border-radius: 8px 8px 2px 2px; transform: scaleY(0); transform-origin: bottom; transition: transform .9s cubic-bezier(.2,.85,.25,1);
  background: linear-gradient(180deg, rgba(183,255,0,0.8), rgba(120,150,230,0.16)); box-shadow: 0 0 20px -8px rgba(183,255,0,0.45); min-height: 4px; }
.desk-scale-chart.is-in .desk-bar-v { transform: scaleY(1); }
.desk-bar-l { display: flex; flex-direction: column; align-items: center; gap: 2px; font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(244,244,239,0.5); }
.desk-bar-l i { font-style: normal; font-weight: 500; font-size: 9.5px; letter-spacing: 0; text-transform: none; color: rgba(244,244,239,0.34); }

/* 6 · close */
.desk-close { padding: clamp(70px, 14vh, 150px) 0 clamp(40px,8vh,80px); text-align: center; }
.desk-close-h { font-family: var(--font-mp), "Manrope", sans-serif; font-size: clamp(44px, 8vw, 104px); font-weight: 500; letter-spacing: -0.045em; text-transform: lowercase; color: #f4f4ef; }
.desk-close-h em { font-style: normal; color: #b7ff00; }
.desk-close-cta { display: inline-flex; align-items: center; gap: 10px; margin-top: 28px; padding: 15px 30px; border-radius: 999px; background: #b7ff00; color: #050505; font-family: var(--font-mp); font-size: 15px; font-weight: 700; border: 0; cursor: pointer; transition: transform .2s cubic-bezier(.16,1,.3,1), box-shadow .2s ease; }
.desk-close-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 40px rgba(183,255,0,0.22); }
.desk-foot { display: flex; align-items: center; justify-content: center; gap: 14px; flex-wrap: wrap; margin-top: clamp(40px,8vh,80px); padding-top: 22px; border-top: 1px solid rgba(255,255,255,0.08); font-size: 10.5px; font-weight: 650; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.3); }

/* placeholder */
.desk-ph { width: 100%; border-radius: 12px; background: linear-gradient(100deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03)); background-size: 200% 100%; animation: desk-sh 1.4s linear infinite; }
@keyframes desk-sh { to { background-position: -200% 0 } }

/* sticky search pill */
.desk-pill { position: fixed; top: 14px; right: clamp(16px, 4vw, 44px); z-index: 60; display: inline-flex; align-items: center; gap: 9px; padding: 11px 16px; border-radius: 999px; background: rgba(13,13,16,0.9); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border: 1px solid rgba(255,255,255,0.14); color: #f4f4ef; font-family: var(--font-mp); font-size: 13.5px; font-weight: 600; cursor: pointer; opacity: 0; transform: translateY(-10px); pointer-events: none; transition: opacity .26s ease, transform .26s cubic-bezier(.16,1,.3,1); }
.desk-pill.show { opacity: 1; transform: none; pointer-events: auto; }
.desk-pill svg { color: rgba(244,244,239,0.55); }
.desk-pill kbd { font-family: "JetBrains Mono", ui-monospace, monospace; font-size: 10px; color: rgba(244,244,239,0.5); border: 1px solid rgba(255,255,255,0.14); border-radius: 5px; padding: 2px 6px; margin-left: 2px; }

/* hero rise */
[data-rise] { animation: desk-rise .7s cubic-bezier(.16,1,.3,1) both; }
@keyframes desk-rise { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: none } }

@media (prefers-reduced-motion: reduce) {
  .desk-sechead, .desk-docket-row, .desk-call-stage, .desk-plate, .desk-scale-grid span, .desk-mapfull-stage, [data-rise] { opacity: 1 !important; transform: none !important; transition: none !important; animation: none !important; clip-path: none !important; }
  .desk-tw > span { transform: none !important; animation: none !important; }
  .desk-ticker-track { animation: none !important; }
  .desk-hero-stats .live i { animation: none !important; }
  .desk-plate-swap, .desk-plate-cap, .desk-stage-swap { animation: none !important; }
  .desk-pip, .desk-eyebrow-pip, .desk-ph { animation: none !important; }
  .desk-film-media { transform: none !important; }
  .desk-film-halo { opacity: 0.35 !important; }
}

@media (max-width: 900px) {
  .desk-scale-wrap { grid-template-columns: 1fr; padding-left: clamp(20px,4vw,44px); padding-right: clamp(20px,4vw,44px); }
  .desk-call-layout { grid-template-columns: 1fr; }
  .desk-call-stage { order: -1; }
  .desk-docket-flag { display: none; }
  .desk-sechead { flex-direction: column; align-items: flex-start; gap: 10px; }
  .desk-ghost { display: none; }
  .desk-atlas { grid-template-columns: 1fr; }
  .desk-atlas-rail { grid-template-rows: none; }
  .desk-plate.hero .desk-plate-map { min-height: clamp(250px, 36vh, 330px); }
  .desk-plate.sm .desk-plate-map { min-height: 150px; }
  .desk-call-card { margin-right: 0; }
  .desk-scale-grid { margin-right: 0; grid-template-columns: repeat(32, 1fr); margin-top: 28px; }
  .desk-precinct-row { grid-template-columns: 1fr; }
  .pp-lead { min-height: clamp(300px, 50vh, 460px); }
  .desk-precinct-row .pp { min-height: 260px; }
  .desk-status-r { display: none; }
  .desk-film-row, .desk-film-row.rev { grid-template-columns: 1fr; gap: 22px; }
  .desk-film-row.rev .desk-film-copy { order: 1; }
  .desk-film-row.rev .desk-film-media { order: 2; }
  .desk-film-rows { gap: clamp(56px, 9vh, 90px); }
}
`;
