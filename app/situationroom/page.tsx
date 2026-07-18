"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { SHOW_SITUATION_ROOM } from "@/app/lib/flags";
import { createPortal } from "react-dom";
import Link from "next/link";
import DarkNav from "@/app/components/DarkNav";
import WireGlobe from "@/app/components/WireGlobe";
import { SENATE_MODEL, senateBalance } from "@/app/components/senateModel";
import { getHomeStats, type HomeStats, type HomeSeriesPoint } from "@/app/polling/lib/homeStats";
import { RAW_POLLS as GENERIC_POLLS, GOLD_STANDARD_NAMES as GENERIC_GOLD } from "@/app/polling/genericballot/data";
import { RAW_POLLS as APPROVAL_POLLS, GOLD_STANDARD_NAMES as APPROVAL_GOLD } from "@/app/polling/donaldtrumpapproval/data";
import { useElectionIndex } from "@/app/results/onpoint/lib/electionIndex.js";
import { useUpcomingDays } from "./upcoming";

// ─── the muted data family ────────────────────────────────────────────────────
const D_SOFT = "#8aa3f2";
const R_SOFT = "#ef8b94";
const PG_GREEN = "#7cbb9f";
const PG_MAGENTA = "#c08fd6";
const LIME = "#6d3ee9";

// Mirrors the REDIST const on /electoralmap (enacted house nets, June 2026) —
// update both together when a map moves.
const REDIST_NET = { r: 9, d: 6 };
// Mirrors the headline on /tpsipoll (Bass margin, leaners allocated).
const TPSI_HEADLINE = { fig: "B+18.8", sub: "bass margin · leaners allocated" };

const pad = (n: number) => String(n).padStart(2, "0");
const isoToday = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtDay = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
const fmtShort = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
const fmtWeekday = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
const daysUntil = (iso: string) => Math.max(0, Math.round((Date.parse(iso + "T00:00:00") - Date.now()) / 86400000));

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
  DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana",
  IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts",
  MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada",
  NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

const isGold = (pollster: string, gold: string[]) => {
  const norm = (s: string) => s.toLowerCase().replace(/\(r\)/g, "").replace(/[^a-z0-9]+/g, " ").trim();
  const p = norm(pollster);
  return gold.some((g) => p.includes(norm(g)));
};

type WirePoll = {
  pollster: string; endDate: string; type: "Generic ballot" | "Trump approval";
  a: number; b: number; net: number; gold: boolean; sampleType: string; sampleSize: number;
};

function buildWire(): WirePoll[] {
  const gen: WirePoll[] = GENERIC_POLLS.map((p) => ({
    pollster: p.pollster.replace(/\*\*/g, "").trim(), endDate: p.endDate, type: "Generic ballot" as const,
    a: Number((p.results as Record<string, number>)["Democrats"] ?? 0),
    b: Number((p.results as Record<string, number>)["Republicans"] ?? 0),
    net: 0, gold: isGold(p.pollster, GENERIC_GOLD), sampleType: p.sampleType, sampleSize: p.sampleSize,
  }));
  const app: WirePoll[] = APPROVAL_POLLS.map((p) => ({
    pollster: p.pollster.replace(/\*\*/g, "").trim(), endDate: p.endDate, type: "Trump approval" as const,
    a: Number((p.results as Record<string, number>)["Approve"] ?? 0),
    b: Number((p.results as Record<string, number>)["Disapprove"] ?? 0),
    net: 0, gold: isGold(p.pollster, APPROVAL_GOLD), sampleType: p.sampleType, sampleSize: p.sampleSize,
  }));
  return [...gen, ...app]
    .map((p) => ({ ...p, net: Math.round((p.a - p.b) * 10) / 10 }))
    .filter((p) => Number.isFinite(p.a) && Number.isFinite(p.b))
    .sort((x, y) => y.endDate.localeCompare(x.endDate))
    .slice(0, 14);
}

// doc shape from the election index (results hub)
type Doc = {
  id: string | number; date: string; title: string; province: string; stateName: string;
  office: string; totalVotes: number; reporting: number; hasResult: boolean;
  leader: { cand: { name?: string; party?: string; percent?: number } | null; lead: number } | null;
  race: { candidates?: { name?: string; party?: string; percent?: number; votes?: number }[] };
};

const partyTone = (party?: string) => {
  const p = String(party || "").toLowerCase();
  if (/democr/.test(p)) return D_SOFT;
  if (/republic/.test(p)) return R_SOFT;
  return "rgba(244,244,239,0.6)";
};

const fmtNet = (n: number, pos = "D+", neg = "R+") =>
  Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${pos}${n.toFixed(1)}` : `${neg}${Math.abs(n).toFixed(1)}`;
const appNet = (n: number) => (n > 0 ? `+${Math.abs(n).toFixed(0)}` : `−${Math.abs(n).toFixed(0)}`);
const pollTone = (p: WirePoll) =>
  p.type === "Generic ballot"
    ? (p.net === 0 ? "rgba(244,244,239,0.5)" : p.net > 0 ? D_SOFT : R_SOFT)
    : (p.net === 0 ? "rgba(244,244,239,0.5)" : p.net > 0 ? PG_GREEN : PG_MAGENTA);
const pollFig = (p: WirePoll) => (p.type === "Generic ballot" ? fmtNet(p.net) : appNet(p.net));

// ─── exhibits ─────────────────────────────────────────────────────────────────

function DualSpark({ daily, w = 640, h = 120, tones, labelDigits = 1 }: {
  daily: HomeSeriesPoint[]; w?: number; h?: number; tones: [string, string]; labelDigits?: number;
}) {
  if (!daily || daily.length < 2) return null;
  const n = daily.length;
  const vals = daily.flatMap((p) => [p.a, p.b]);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const padV = Math.max(1.2, (hi - lo) * 0.16);
  const y = (v: number) => 6 + (1 - (v - (lo - padV)) / (hi - lo + padV * 2)) * (h - 18);
  const x = (i: number) => 2 + (i / (n - 1)) * (w - 56);
  const path = (k: "a" | "b") => daily.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join("");
  const area = (k: "a" | "b") => `${path(k)}L${x(n - 1).toFixed(1)},${h - 5}L${x(0).toFixed(1)},${h - 5}Z`;
  const last = daily[n - 1];
  let ya = y(last.a), yb = y(last.b);
  if (Math.abs(ya - yb) < 15) { const mid = (ya + yb) / 2, s = ya <= yb ? 1 : -1; ya = mid - s * 7.5; yb = mid + s * 7.5; }
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="sr-spark" aria-hidden="true">
      <line x1={2} x2={w - 54} y1={h - 5} y2={h - 5} stroke="rgba(244,244,239,0.13)" strokeWidth="1" />
      <path d={area("a")} fill={tones[0]} opacity="0.08" />
      <path d={area("b")} fill={tones[1]} opacity="0.07" />
      <path d={path("b")} stroke={tones[1]} strokeWidth="1.7" fill="none" opacity="0.8" />
      <path d={path("a")} stroke={tones[0]} strokeWidth="1.7" fill="none" />
      <circle cx={x(n - 1)} cy={y(last.a)} r="2.8" fill={tones[0]} />
      <circle cx={x(n - 1)} cy={y(last.b)} r="2.8" fill={tones[1]} />
      <text x={x(n - 1) + 11} y={ya + 4.5} fill={tones[0]} fontSize="13.5" fontWeight="650" fontFamily="inherit">{last.a.toFixed(labelDigits)}</text>
      <text x={x(n - 1) + 11} y={yb + 4.5} fill={tones[1]} fontSize="13.5" fontWeight="650" fontFamily="inherit" opacity="0.85">{last.b.toFixed(labelDigits)}</text>
    </svg>
  );
}

// 100 senate seats as ticks — holdovers solid, modeled seats faded by tier
function SeatStrip() {
  const op = (m: number) => (Math.abs(m) >= 12 ? 0.95 : Math.abs(m) >= 6 ? 0.62 : Math.abs(m) >= 2 ? 0.42 : 0.27);
  const dMod = SENATE_MODEL.filter((r) => r.m < 0).sort((a, b) => Math.abs(b.m) - Math.abs(a.m));
  const rMod = SENATE_MODEL.filter((r) => r.m > 0).sort((a, b) => Math.abs(a.m) - Math.abs(b.m));
  const seats = [
    ...Array.from({ length: 34 }, () => ({ c: D_SOFT, o: 0.95 })),
    ...dMod.map((r) => ({ c: D_SOFT, o: op(r.m) })),
    ...rMod.map((r) => ({ c: R_SOFT, o: op(r.m) })),
    ...Array.from({ length: 31 }, () => ({ c: R_SOFT, o: 0.95 })),
  ];
  return (
    <span className="sr-seats" aria-hidden="true">
      {seats.map((s, i) => <i key={i} style={{ background: s.c, opacity: s.o }} />)}
      <b className="sr-seam"><span>50</span></b>
    </span>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default function SituationRoomPage() {
  if (!SHOW_SITUATION_ROOM) notFound();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [clock, setClock] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { index, error: indexError } = useElectionIndex(true) as { index: { docs: Doc[] } | null; error: boolean };
  const today = isoToday();
  const upcoming = useUpcomingDays(today);

  useEffect(() => {
    const t = setTimeout(() => setStats(getHomeStats()), 1);
    return () => clearTimeout(t);
  }, []);

  // live eastern-time clock — the desk runs on ET
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-US", { hour12: false, timeZone: "America/New_York" }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  const wire = useMemo(buildWire, []);

  const todays = useMemo(() => {
    const docs = index?.docs ?? [];
    const t = docs.filter((d) => d.date === today);
    t.sort((a, b) => (b.totalVotes - a.totalVotes) || a.title.localeCompare(b.title));
    return t;
  }, [index, today]);

  const nextDay = upcoming && upcoming.length ? upcoming[0] : null;

  const { d: dSeats, r: rSeats } = senateBalance();
  const generic = stats?.generic.net ?? 0;
  const approval = stats?.approval.net ?? 0;
  const track = stats?.track.net ?? 0;
  const days = Math.max(0, Math.round((Date.parse("2026-11-03T00:00:00") - Date.now()) / 86400000));
  const hotRaces = [...SENATE_MODEL].sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 5);

  // staggered reveal — rise + fade, once
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".sr-page .sr-rv:not(.is-in)"));
    if (!els.length) return;
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); }
    }, { threshold: 0.12, rootMargin: "0px 0px -36px 0px" });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [index, stats, upcoming]);

  // the ticker tape — live races, the calendar ahead, then the freshest polls
  const ticker = useMemo(() => {
    const items: { stamp: string; src: string; type: string; fig: string; tone: string; gold?: boolean; live?: boolean }[] = [];
    for (const d of todays.slice(0, 4)) {
      items.push({
        stamp: "today", src: d.title, type: d.province || d.stateName || "",
        fig: d.hasResult ? `${Math.round(d.reporting)}% in` : "polls open", tone: LIME, live: true,
      });
    }
    for (const u of (upcoming ?? []).slice(0, 3)) {
      items.push({ stamp: fmtShort(u.date), src: u.sample[0] || "Election day", type: `${u.count} contest${u.count === 1 ? "" : "s"}`, fig: `in ${daysUntil(u.date)}d`, tone: "rgba(244,244,239,0.72)" });
    }
    for (const p of wire.slice(0, 10)) items.push({ stamp: fmtShort(p.endDate), src: p.pollster, type: p.type, fig: pollFig(p), tone: pollTone(p), gold: p.gold });
    return items;
  }, [todays, upcoming, wire]);

  // the wire feed — today's races pinned, then polls, stamps suppressed on repeat
  type Entry = { kind: "race"; doc: Doc } | { kind: "note" } | { kind: "poll"; p: WirePoll };
  const entries: Entry[] = useMemo(() => ([
    ...todays.slice(0, 5).map((doc) => ({ kind: "race" as const, doc })),
    ...(!todays.length && index ? [{ kind: "note" as const }] : []),
    ...wire.map((p) => ({ kind: "poll" as const, p })),
  ]), [todays, index, wire]);

  let prevStamp = "";
  const stampFor = (e: Entry) => (e.kind === "poll" ? fmtShort(e.p.endDate) : "today");

  // figure scale per instrument — the generic ballot leads the line
  const INS_SIZES = ["clamp(46px,4.6vw,64px)", "clamp(34px,3.4vw,46px)", "clamp(34px,3.4vw,46px)", "clamp(28px,2.8vw,38px)", "clamp(36px,3.7vw,50px)", "clamp(28px,2.8vw,38px)", "clamp(30px,3vw,42px)", "clamp(30px,3vw,42px)"];

  // the big board — every tracker the desk runs, one strip
  const board: { label: string; fig: React.ReactNode; tone?: string; sub: string; href: string }[] = [
    {
      label: "generic ballot", href: "/polling/genericballot",
      fig: stats ? fmtNet(generic) : "—", tone: generic >= 0 ? D_SOFT : R_SOFT,
      sub: stats ? `${stats.generic.count} polls · gold ×2` : "model loading",
    },
    {
      label: "trump approval", href: "/polling/donaldtrumpapproval",
      fig: stats ? appNet(approval) : "—", tone: approval < 0 ? PG_MAGENTA : PG_GREEN,
      sub: stats ? `${stats.approval.approve.toFixed(0)} approve · ${stats.approval.disapprove.toFixed(0)} disapprove` : "model loading",
    },
    {
      label: "right track", href: "/polling/genericballot?race=right-wrong-track",
      fig: stats ? appNet(track) : "—", tone: track < 0 ? PG_MAGENTA : PG_GREEN,
      sub: stats ? `${stats.track.right.toFixed(0)} right · ${stats.track.wrong.toFixed(0)} wrong` : "model loading",
    },
    {
      label: "tpsi poll", href: "/tpsipoll",
      fig: TPSI_HEADLINE.fig, tone: D_SOFT, sub: TPSI_HEADLINE.sub,
    },
    {
      label: "projected senate", href: "/forecastratings",
      fig: <><b style={{ color: D_SOFT }}>{Math.max(dSeats, rSeats)}</b><em>–</em><b style={{ color: R_SOFT }}>{Math.min(dSeats, rSeats)}</b></>,
      sub: "35 seats modeled nightly",
    },
    {
      label: "redistricting", href: "/electoralmap?mode=redist",
      fig: <><b style={{ color: R_SOFT }}>R+{REDIST_NET.r}</b><em>·</em><b style={{ color: D_SOFT }}>D+{REDIST_NET.d}</b></>,
      sub: "enacted house nets · june",
    },
    {
      label: "next election", href: "/results",
      fig: nextDay ? fmtShort(nextDay.date) : upcoming === null ? "…" : fmtShort("2026-11-03"),
      sub: nextDay ? `${nextDay.count.toLocaleString()} contest${nextDay.count === 1 ? "" : "s"} · in ${daysUntil(nextDay.date)} days` : upcoming === null ? "checking the calendar" : "the midterms",
    },
    {
      label: "the midterms", href: "/electoralmap",
      fig: String(days), sub: "days · november 3, 2026",
    },
  ];

  return (
    <div className="sr-page">
      <style>{CSS}</style>
      <div className="sr-air" aria-hidden="true" />
      <div className="sr-grain" aria-hidden="true" />
      <DarkNav />

      {/* ── masthead ── */}
      <div className="sr-folio">
        <span>TPSI Situation Room</span>
        <span>live monitor · the wire, the board, the watchlist</span>
        <span>{fmtDay(today)}</span>
      </div>
      <div className="sr-mast">
        <div className="sr-mast-copy">
          <h1 className="sr-title">situation room</h1>
          <div className="sr-status">
            <span className="hot">{!index && !indexError ? "checking the wire" : todays.length ? `${todays.length} contest${todays.length === 1 ? "" : "s"} reporting today` : "no contests reporting today"}</span>
            <em>·</em>
            <span>{nextDay ? `next election ${fmtShort(nextDay.date)} · ${nextDay.count.toLocaleString()} contests` : upcoming === null ? "reading the calendar ahead" : `midterms in ${days} days`}</span>
          </div>
        </div>
        <div className="sr-globe" aria-hidden="true">
          <WireGlobe />
          <span className="sr-globe-cap"><i />toss-up senate states</span>
        </div>
      </div>

      {/* ── the big board — one typeset line of instruments, not a grid ── */}
      <div className="sr-bb">
        {board.map((c, i) => (
          <Link href={c.href} key={c.label} className="sr-ins sr-rv" style={{ "--fs": INS_SIZES[i], "--rd": `${i * 50}ms` } as React.CSSProperties}>
            <span className="sr-ins-label">{c.label}</span>
            <span className="sr-ins-fig" style={c.tone ? { color: c.tone } : undefined}>{c.fig}</span>
            <span className="sr-ins-sub">{c.sub}</span>
          </Link>
        ))}
      </div>

      {/* ── ticker ── */}
      <div className="sr-ticker" aria-hidden="true">
        <div className="sr-tick-track">
          {[0, 1].map((dup) => (
            <span className="sr-tick-run" key={dup}>
              {ticker.map((t, i) => (
                <span className={`sr-tick-item${t.live ? " is-live" : ""}`} key={`${dup}-${i}`}>
                  <span className="tk-stamp">{t.stamp}</span>
                  <span className="tk-src">{t.src}{t.gold && <i> ◆</i>}</span>
                  {t.type && <span className="tk-type">{t.type}</span>}
                  <b style={{ color: t.tone }}>{t.fig}</b>
                  <span className="tk-sep">/</span>
                </span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* ── 01 · the wire ── */}
      <section className="sr-sec">
        <div className="sr-sec-head">
          <span className="sr-idx">01</span>
          <span className="sr-sec-title">The wire</span>
          <span className="sr-sec-meta">today’s contests and the latest polls, one stream · ◆ gold-standard</span>
          <Link className="sr-sec-link" href="/results">Election results →</Link>
        </div>

        <div className="sr-wire">
          {!index && !indexError && (
            <div className="sr-wirerow is-skel" aria-hidden="true">
              <span className="sr-w-stamp">…</span><span className="sr-w-node" />
              <div className="sr-w-body"><span className="sr-skel" style={{ width: "42%" }} /><span className="sr-skel" style={{ width: "26%" }} /></div>
            </div>
          )}
          {entries.map((e, i) => {
            const stamp = stampFor(e);
            const show = stamp !== prevStamp; prevStamp = stamp;
            const rd = `${Math.min(i, 9) * 55}ms`;

            if (e.kind === "note") {
              return (
                <div className="sr-wirerow sr-rv is-note" key="note" style={{ "--rd": rd } as React.CSSProperties}>
                  <span className="sr-w-stamp">{show ? stamp : ""}</span>
                  <span className="sr-w-node is-hollow" />
                  <div className="sr-w-body">
                    <p className="sr-w-note">
                      The board is quiet — no contests reporting today.{" "}
                      {nextDay
                        ? <>Next on the calendar: <b>{fmtDay(nextDay.date)}</b> — {nextDay.count.toLocaleString()} contest{nextDay.count === 1 ? "" : "s"}.</>
                        : upcoming === null
                          ? <>Reading the calendar ahead…</>
                          : <>Next up: the midterms, <b>november 3</b> — {days} days out.</>}
                    </p>
                  </div>
                </div>
              );
            }

            if (e.kind === "race") {
              const d = e.doc;
              const cands = (d.race?.candidates ?? []).slice().sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0)).slice(0, 2);
              const tot = cands.reduce((s, c) => s + Number(c.percent ?? 0), 0);
              return (
                <Link href="/results" className="sr-wirerow sr-rv is-race" key={`r-${d.id}`} style={{ "--rd": rd } as React.CSSProperties}>
                  <span className="sr-w-stamp">{show ? stamp : ""}</span>
                  <span className="sr-w-node is-live" />
                  <div className="sr-w-body">
                    <div className="sr-w-line">
                      <span className="sr-w-src">{d.title}</span>
                      <span className="sr-w-type">{[d.province || d.stateName, d.office].filter(Boolean).join(" · ")}</span>
                      <b className="sr-w-fig" style={{ color: LIME }}>{d.hasResult ? `${Math.round(d.reporting)}% in` : "polls open"}</b>
                    </div>
                    {cands.length > 0 && (
                      <div className="sr-w-meta">
                        {cands.map((c, j) => (
                          <span className="sr-w-cand" key={j}>
                            <i style={{ background: partyTone(c.party) }} />
                            {String(c.name || "").split(/\s+/).pop()}
                            <b>{Number(c.percent ?? 0) > 0 ? `${Number(c.percent).toFixed(1)}` : "—"}</b>
                          </span>
                        ))}
                        {tot > 0 && (
                          <span className="sr-w-bar">
                            <i style={{ width: `${(Number(cands[0]?.percent ?? 0) / tot) * 100}%`, background: partyTone(cands[0]?.party) }} />
                            <i style={{ width: `${(Number(cands[1]?.percent ?? 0) / tot) * 100}%`, background: partyTone(cands[1]?.party), opacity: 0.7 }} />
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </Link>
              );
            }

            const p = e.p;
            return (
              <Link
                href={p.type === "Generic ballot" ? "/polling/genericballot" : "/polling/donaldtrumpapproval"}
                className="sr-wirerow sr-rv" key={`p-${p.pollster}-${p.endDate}-${i}`}
                style={{ "--rd": rd } as React.CSSProperties}
              >
                <span className="sr-w-stamp">{show ? stamp : ""}</span>
                <span className="sr-w-node" />
                <div className="sr-w-body">
                  <div className="sr-w-line">
                    <span className="sr-w-src">{p.pollster}{p.gold && <i> ◆</i>}</span>
                    <span className="sr-w-type">{p.type}</span>
                    <b className="sr-w-fig" style={{ color: pollTone(p) }}>{pollFig(p)}</b>
                  </div>
                  <div className="sr-w-meta">
                    <span className="sr-w-split">
                      <b style={{ color: p.type === "Generic ballot" ? D_SOFT : PG_GREEN }}>{p.a.toFixed(0)}</b>
                      <em>—</em>
                      <b style={{ color: p.type === "Generic ballot" ? R_SOFT : PG_MAGENTA }}>{p.b.toFixed(0)}</b>
                    </span>
                    <span className="sr-w-n">{p.sampleType} · {p.sampleSize ? p.sampleSize.toLocaleString() : "—"}{p.gold ? " · gold-standard" : ""}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── 02 · the calendar ahead ── */}
      <section className="sr-sec">
        <div className="sr-sec-head">
          <span className="sr-idx">02</span>
          <span className="sr-sec-title">The calendar ahead</span>
          <span className="sr-sec-meta">every election day between now and the midterms</span>
          <Link className="sr-sec-link" href="/results">Full calendar →</Link>
        </div>
        <div className="sr-cal">
          {upcoming === null && (
            <div className="sr-calrow" aria-hidden="true">
              <span className="sr-skel" style={{ width: "30%" }} /><span /><span className="sr-skel" style={{ width: "18%" }} />
            </div>
          )}
          {upcoming && upcoming.length === 0 && (
            <p className="sr-w-note" style={{ padding: "20px 0 4px" }}>
              The wire shows nothing scheduled before the midterms — <b>november 3</b>, {days} days out.
            </p>
          )}
          {(upcoming ?? []).map((u, i) => (
            <Link href="/results" key={u.date} className="sr-calrow sr-rv" style={{ "--rd": `${i * 70}ms` } as React.CSSProperties}>
              <span className="sr-cal-date">{fmtShort(u.date)}</span>
              <span className="sr-cal-day">{fmtWeekday(u.date)}</span>
              <span className="sr-cal-sample">{u.sample.join(" · ") || "contests on the wire"}</span>
              <span className="sr-watch-lead" aria-hidden="true" />
              <span className="sr-cal-count">{u.count.toLocaleString()} <em>contest{u.count === 1 ? "" : "s"}</em></span>
              <span className="sr-cal-in">in {daysUntil(u.date)}d</span>
            </Link>
          ))}
        </div>
      </section>

      {/* ── 03 · the board ── */}
      <section className="sr-sec">
        <div className="sr-sec-head">
          <span className="sr-idx">03</span>
          <span className="sr-sec-title">The board</span>
          <span className="sr-sec-meta">the desk’s live model — ninety days of it</span>
        </div>
        <div className="sr-board">
          <Link href="/polling/genericballot" className="sr-hero-fig sr-rv" style={{ "--rd": "0ms" } as React.CSSProperties}>
            <span className="sr-fig-label">generic congressional ballot</span>
            <span className="sr-hero-num" style={{ color: generic >= 0 ? D_SOFT : R_SOFT }}>{stats ? fmtNet(generic) : "—"}</span>
            {stats && <DualSpark daily={stats.generic.daily.slice(-90)} tones={[D_SOFT, R_SOFT]} />}
            <span className="sr-fig-sub">{stats ? `${stats.generic.count} polls · gold-standard weighted ×2 · 90-day window` : ""}</span>
          </Link>

          <div className="sr-board-stack">
            <Link href="/polling/donaldtrumpapproval" className="sr-fig sr-rv" style={{ "--rd": "80ms" } as React.CSSProperties}>
              <div className="sr-fig-row">
                <div className="sr-fig-main">
                  <span className="sr-fig-label">trump net approval</span>
                  <span className="sr-fig-num" style={{ color: approval < 0 ? PG_MAGENTA : PG_GREEN }}>{stats ? appNet(approval) : "—"}</span>
                </div>
                {stats && <span className="sr-fig-aside"><DualSpark daily={stats.approval.daily.slice(-90)} w={300} h={84} tones={[PG_GREEN, PG_MAGENTA]} labelDigits={0} /></span>}
              </div>
              <span className="sr-fig-sub">{stats ? `${stats.approval.approve.toFixed(0)} approve · ${stats.approval.disapprove.toFixed(0)} disapprove · ${stats.approval.count} polls` : ""}</span>
            </Link>

            <Link href="/polling/genericballot?race=right-wrong-track" className="sr-fig sr-rv" style={{ "--rd": "160ms" } as React.CSSProperties}>
              <div className="sr-fig-row">
                <div className="sr-fig-main">
                  <span className="sr-fig-label">direction of the country</span>
                  <span className="sr-fig-num" style={{ color: track < 0 ? PG_MAGENTA : PG_GREEN }}>{stats ? appNet(track) : "—"}</span>
                </div>
                {stats && <span className="sr-fig-aside"><DualSpark daily={stats.track.daily.slice(-90)} w={300} h={84} tones={[PG_GREEN, PG_MAGENTA]} labelDigits={0} /></span>}
              </div>
              <span className="sr-fig-sub">{stats ? `${stats.track.right.toFixed(0)} right track · ${stats.track.wrong.toFixed(0)} wrong track · ${stats.track.count} polls` : ""}</span>
            </Link>

            <Link href="/forecastratings" className="sr-fig sr-rv" style={{ "--rd": "240ms" } as React.CSSProperties}>
              <span className="sr-fig-label">projected senate</span>
              <span className="sr-fig-num"><b style={{ color: D_SOFT }}>{Math.max(dSeats, rSeats)}</b><em>–</em><b style={{ color: R_SOFT }}>{Math.min(dSeats, rSeats)}</b></span>
              <SeatStrip />
              <span className="sr-fig-sub">65 holdovers + 35 modeled · faded ticks are this cycle’s seats</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 04 · the watchlist ── */}
      <section className="sr-sec sr-sec-last">
        <div className="sr-sec-head">
          <span className="sr-idx">04</span>
          <span className="sr-sec-title">The watchlist</span>
          <span className="sr-sec-meta">the five tightest senate races in the model</span>
          <Link className="sr-sec-link" href="/forecastratings">All 35 ratings →</Link>
        </div>
        <div className="sr-watch">
          {hotRaces.map((r, i) => {
            const dLead = r.m < 0;
            const w = Math.sqrt(Math.min(Math.abs(r.m), 3) / 3) * 47;
            return (
              <Link key={r.st} href="/forecastratings" className="sr-watchrow sr-rv" style={{ "--rd": `${i * 70}ms` } as React.CSSProperties}>
                <span className="sr-watch-ord">{pad(i + 1)}</span>
                <span className="sr-watch-st">{r.st}</span>
                <span className="sr-watch-name">{STATE_NAMES[r.st] || ""}</span>
                <span className="sr-watch-lead" aria-hidden="true" />
                <span className="sr-watch-bar" aria-hidden="true">
                  <i className="sr-watch-seam" />
                  <i className="sr-watch-fill" style={{ left: dLead ? `${50 - w}%` : "50%", width: `${w}%`, background: dLead ? D_SOFT : R_SOFT }} />
                </span>
                <span className="sr-watch-m" style={{ color: dLead ? D_SOFT : R_SOFT }}>{dLead ? `D+${Math.abs(r.m).toFixed(1)}` : `R+${r.m.toFixed(1)}`}</span>
                <span className="sr-watch-tag">{r.open ? "open seat" : "incumbent"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* ── the desk clock — pill overlay, portaled past the layout's
             transformed wrapper (transforms hijack position:fixed) ── */}
      {mounted && createPortal(
        <div className="sr-pill" role="status" aria-label="Live desk clock, eastern time" style={{ fontFamily: "var(--font-body)" }}>
          <i className="sr-pill-dot" aria-hidden="true" />
          <b>{clock || "––:––:––"}</b>
          <span className="sr-pill-sep" aria-hidden="true" />
          <span className="sr-pill-label">eastern</span>
          <span className="sr-pill-sep" aria-hidden="true" />
          <span className="sr-pill-stat">{todays.length ? `${todays.length} live` : "quiet board"}</span>
        </div>,
        document.body,
      )}
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const CSS = `
html, body { background: #050505 !important; }
body header, body footer { display: none !important; }

.sr-page {
  --foreground: #f4f4ef;
  --muted: rgba(244,244,239,0.58); --muted2: rgba(244,244,239,0.40); --muted3: rgba(244,244,239,0.25);
  --rule: rgba(255,255,255,0.10); --rule2: rgba(255,255,255,0.16);
  max-width: 1120px; margin: 0 auto; padding: 0 2px 150px;
  position: relative; z-index: 1; color: var(--foreground);
  font-family: var(--font-body);
  font-size: 14px; letter-spacing: -0.01em;
}
.sr-page a { color: inherit; text-decoration: none; }

/* atmosphere — feathered light, no boxes */
.sr-air { position: fixed; inset: 0; z-index: 0; pointer-events: none;
  background:
    radial-gradient(900px 600px at 12% -6%, rgba(138,163,242,0.055), transparent 68%),
    radial-gradient(820px 640px at 94% 38%, rgba(239,139,148,0.04), transparent 70%),
    radial-gradient(1100px 420px at 50% 0%, rgba(244,244,239,0.035), transparent 72%);
}
.sr-grain { position: fixed; inset: -40px; z-index: 2; pointer-events: none; opacity: 0.05; mix-blend-mode: overlay;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='180' height='180' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E");
}

/* reveal */
.sr-rv { opacity: 0; transform: translateY(14px);
  transition: opacity 0.75s cubic-bezier(0.16,1,0.3,1) var(--rd, 0ms), transform 0.75s cubic-bezier(0.16,1,0.3,1) var(--rd, 0ms); }
.sr-rv.is-in { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) { .sr-rv { opacity: 1; transform: none; transition: none; } }

/* masthead */
.sr-folio { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; padding: 14px 0; border-top: 1px solid var(--rule2); border-bottom: 1px solid var(--rule); font-size: 10.5px; font-weight: 600; letter-spacing: 0.18em; text-transform: uppercase; color: var(--muted2); }
.sr-folio span:first-child { color: var(--foreground); }
.sr-mast { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) clamp(300px, 36vw, 470px); align-items: end; min-height: 270px; }
.sr-mast-copy { padding: 40px 0 26px; position: relative; z-index: 1; }
.sr-title { font-family: var(--font-display); font-weight: 500; text-transform: lowercase; letter-spacing: -0.03em; line-height: 0.9; font-size: clamp(44px, 7.4vw, 88px); margin: 0; }
.sr-status { display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; margin: 22px 0 0; font-size: 11px; font-weight: 650; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted2); }
.sr-status .hot { color: var(--foreground); }
.sr-status em { font-style: normal; color: var(--muted3); }

/* the desk's eye — compact globe, feathered into the black */
.sr-globe { position: relative; height: clamp(250px, 27vw, 340px); margin: -34px -28px -10px 0;
  -webkit-mask-image: radial-gradient(78% 84% at 52% 46%, #000 42%, transparent 76%);
  mask-image: radial-gradient(78% 84% at 52% 46%, #000 42%, transparent 76%); }
.sr-globe-cap { position: absolute; right: 26px; bottom: 18px; display: inline-flex; align-items: center; gap: 7px;
  font-size: 9.5px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted3); }
.sr-globe-cap i { width: 5px; height: 5px; border-radius: 99px; background: var(--brand-grad); box-shadow: 0 0 8px rgba(109,62,233,0.6); animation: sr-pulse 2s ease-in-out infinite; }
@keyframes sr-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

/* the big board — instruments typeset on a shared baseline, slash hairlines between */
.sr-bb { display: flex; flex-wrap: wrap; align-items: flex-end; row-gap: 30px; border-top: 1px solid var(--rule2); padding: 28px 0 4px; }
.sr-ins { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 0 clamp(16px, 2.4vw, 32px); min-width: 0; }
.sr-ins:first-child { padding-left: 0; }
.sr-ins:not(:first-child)::before { content: ''; position: absolute; left: 0; bottom: 2px; height: 74%; width: 1px;
  background: linear-gradient(180deg, transparent, rgba(244,244,239,0.17) 28%, rgba(244,244,239,0.17) 72%, transparent);
  transform: rotate(13deg); transform-origin: bottom center; }
.sr-ins-label { font-size: 10px; font-weight: 700; letter-spacing: 0.15em; text-transform: uppercase; color: var(--muted2); transition: color 200ms ease; white-space: nowrap; }
.sr-ins-fig { font-size: var(--fs, 42px); font-weight: 320; letter-spacing: -0.04em; line-height: 0.88; font-variant-numeric: tabular-nums; color: var(--foreground); white-space: nowrap; transition: filter 200ms ease; }
.sr-ins-fig b { font-weight: 320; }
.sr-ins-fig em { font-style: normal; margin: 0 6px; color: var(--muted3); font-weight: 300; }
.sr-ins-sub { font-size: 10.5px; font-weight: 560; color: var(--muted3); font-variant-numeric: tabular-nums; white-space: nowrap; min-height: 13px; transition: color 200ms ease; }
.sr-ins:hover .sr-ins-label { color: var(--muted); }
.sr-ins:hover .sr-ins-fig { filter: brightness(1.18); }
.sr-ins:hover .sr-ins-sub { color: var(--muted2); }

/* ticker */
.sr-ticker { border-top: 1px solid var(--rule2); border-bottom: 1px solid var(--rule); overflow: hidden; white-space: nowrap;
  -webkit-mask-image: linear-gradient(90deg, transparent, #000 80px, #000 calc(100% - 80px), transparent);
  mask-image: linear-gradient(90deg, transparent, #000 80px, #000 calc(100% - 80px), transparent); }
.sr-tick-track { display: inline-flex; padding: 11px 0; animation: sr-marq 74s linear infinite; will-change: transform; }
.sr-ticker:hover .sr-tick-track { animation-play-state: paused; }
@media (prefers-reduced-motion: reduce) { .sr-tick-track { animation: none; } }
@keyframes sr-marq { to { transform: translateX(-50%); } }
.sr-tick-run { display: inline-flex; }
.sr-tick-item { display: inline-flex; align-items: baseline; gap: 9px; font-size: 12px; }
.sr-tick-item .tk-stamp { font-size: 10px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted3); }
.sr-tick-item.is-live .tk-stamp { color: ${LIME}; }
.sr-tick-item .tk-src { font-weight: 650; color: var(--muted); }
.sr-tick-item .tk-src i { font-style: normal; color: ${LIME}; font-size: 10px; }
.sr-tick-item .tk-type { font-size: 11px; font-weight: 550; color: var(--muted3); }
.sr-tick-item b { font-weight: 700; font-variant-numeric: tabular-nums; }
.sr-tick-item .tk-sep { margin: 0 22px; color: rgba(244,244,239,0.14); font-weight: 300; }

/* sections */
.sr-sec { margin-top: clamp(56px, 7vw, 92px); }
.sr-sec-head { display: flex; align-items: baseline; gap: 16px; padding-bottom: 13px; border-bottom: 1px solid var(--rule2); }
.sr-idx { font-size: 11.5px; font-weight: 600; color: var(--muted3); font-variant-numeric: tabular-nums; }
.sr-sec-title { font-size: 13px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
.sr-sec-meta { font-size: 12px; font-weight: 550; color: var(--muted2); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr-sec-link { margin-left: auto; font-size: 12.5px; font-weight: 600; color: var(--muted); white-space: nowrap; transition: color 180ms ease; }
.sr-sec-link:hover { color: var(--foreground); }

/* 01 — the wire: a rail, not a table */
.sr-wire { position: relative; padding-top: 26px; }
.sr-wire::before { content: ''; position: absolute; left: 107px; top: 18px; bottom: 6px; width: 1px;
  background: linear-gradient(180deg, rgba(244,244,239,0.22), rgba(244,244,239,0.07) 70%, transparent); }
.sr-wirerow { position: relative; display: grid; grid-template-columns: 88px 38px minmax(0, 1fr); align-items: baseline; padding: 11px 0; }
.sr-w-stamp { font-size: 10.5px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted3); text-align: right; }
.sr-w-node { position: relative; align-self: center; justify-self: center; width: 5px; height: 5px; border-radius: 999px; background: rgba(244,244,239,0.38); transition: background 200ms ease, box-shadow 200ms ease; }
.sr-w-node.is-hollow { background: transparent; box-shadow: inset 0 0 0 1.2px rgba(244,244,239,0.45); width: 7px; height: 7px; }
.sr-w-node.is-live { background: var(--brand-grad); box-shadow: 0 0 10px rgba(109,62,233,0.6); animation: sr-pulse 2s ease-in-out infinite; width: 6px; height: 6px; }
.sr-w-body { min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.sr-w-line { display: flex; align-items: baseline; gap: 14px; min-width: 0; }
.sr-w-src { font-size: 16.5px; font-weight: 640; letter-spacing: -0.015em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: rgba(244,244,239,0.88); transition: color 180ms ease; }
.sr-w-src i { font-style: normal; color: ${LIME}; font-size: 11px; letter-spacing: 0; }
.sr-w-type { font-size: 10.5px; font-weight: 650; letter-spacing: 0.13em; text-transform: uppercase; color: var(--muted3); white-space: nowrap; }
.sr-w-fig { margin-left: auto; font-size: 21px; font-weight: 650; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; white-space: nowrap; }
.sr-wirerow.is-race .sr-w-fig { font-size: 14px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.sr-w-meta { display: flex; align-items: center; gap: 14px; font-size: 11.5px; font-weight: 550; color: var(--muted2); font-variant-numeric: tabular-nums; }
.sr-w-split { display: inline-flex; align-items: baseline; gap: 6px; font-size: 12.5px; }
.sr-w-split b { font-weight: 650; opacity: 0.85; }
.sr-w-split em { font-style: normal; color: var(--muted3); font-size: 10px; }
.sr-w-n { color: var(--muted3); }
.sr-w-cand { display: inline-flex; align-items: baseline; gap: 7px; font-size: 12.5px; color: var(--muted); font-weight: 580; }
.sr-w-cand i { width: 5px; height: 5px; border-radius: 99px; align-self: center; }
.sr-w-cand b { font-weight: 680; color: rgba(244,244,239,0.85); }
.sr-w-bar { display: inline-flex; width: 130px; height: 2px; gap: 2px; align-self: center; }
.sr-w-bar i { height: 100%; border-radius: 99px; }
.sr-w-note { margin: 0; font-size: 18px; line-height: 1.5; font-weight: 460; color: var(--muted); letter-spacing: -0.012em; max-width: 62ch; }
.sr-w-note b { color: var(--foreground); font-weight: 640; }
.sr-wirerow:not(.is-note):hover .sr-w-src { color: #ffffff; }
.sr-wirerow:not(.is-note):hover .sr-w-node { background: rgba(244,244,239,0.85); box-shadow: 0 0 8px rgba(244,244,239,0.4); }
.sr-wirerow.is-race:hover .sr-w-node { background: var(--brand-grad); }
.sr-skel { display: block; height: 12px; border-radius: 3px; background: rgba(255,255,255,0.05); animation: sr-pulse 1.4s ease-in-out infinite; }

/* 02 — the calendar ahead */
.sr-cal { display: flex; flex-direction: column; padding-top: 14px; }
.sr-calrow { display: grid; grid-template-columns: 92px 110px minmax(120px, auto) minmax(24px, 1fr) 130px 64px; gap: 16px; align-items: baseline; padding: 16px 0; }
.sr-cal-date { font-size: 23px; font-weight: 640; letter-spacing: -0.02em; line-height: 1; color: rgba(244,244,239,0.92); transition: color 180ms ease; white-space: nowrap; }
.sr-cal-day { font-size: 11px; font-weight: 650; letter-spacing: 0.13em; text-transform: uppercase; color: var(--muted2); }
.sr-cal-sample { font-size: 13px; font-weight: 550; color: var(--muted); min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr-cal-count { font-size: 14.5px; font-weight: 680; font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.sr-cal-count em { font-style: normal; font-weight: 550; color: var(--muted2); font-size: 11.5px; }
.sr-cal-in { font-size: 11px; font-weight: 680; letter-spacing: 0.1em; text-transform: uppercase; color: var(--muted3); text-align: right; font-variant-numeric: tabular-nums; }
.sr-calrow:hover .sr-cal-date { color: #ffffff; }

/* 03 — the board: exhibits, not cards */
.sr-board { display: grid; grid-template-columns: minmax(0, 7fr) minmax(0, 5fr); gap: clamp(40px, 6vw, 84px); padding-top: 40px; align-items: start; }
.sr-hero-fig { position: relative; display: flex; flex-direction: column; gap: 14px; }
.sr-hero-fig::before { content: ''; position: absolute; inset: -14% -10%; pointer-events: none;
  background: radial-gradient(58% 56% at 38% 38%, rgba(138,163,242,0.075), transparent 72%); opacity: 0.85; transition: opacity 300ms ease; }
.sr-hero-fig:hover::before { opacity: 1.25; }
.sr-fig-label { font-size: 10.5px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); transition: color 200ms ease; }
.sr-hero-num { font-size: clamp(72px, 9vw, 124px); font-weight: 300; letter-spacing: -0.045em; line-height: 0.9; font-variant-numeric: tabular-nums; }
.sr-spark { width: 100%; height: auto; display: block; margin-top: 4px; }
.sr-fig-sub { font-size: 11.5px; font-weight: 560; color: var(--muted2); font-variant-numeric: tabular-nums; letter-spacing: 0.01em; }
.sr-board-stack { display: flex; flex-direction: column; gap: 30px; }
.sr-fig { display: flex; flex-direction: column; gap: 10px; }
.sr-fig-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; }
.sr-fig-main { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.sr-fig-aside { width: 46%; max-width: 220px; flex-shrink: 0; }
.sr-fig-num { font-size: clamp(38px, 4vw, 50px); font-weight: 340; letter-spacing: -0.03em; line-height: 0.92; font-variant-numeric: tabular-nums; color: var(--foreground); }
.sr-fig-num b { font-weight: 340; }
.sr-fig-num em { font-style: normal; margin: 0 5px; color: var(--muted3); font-weight: 300; }
.sr-fig:hover .sr-fig-label, .sr-hero-fig:hover .sr-fig-label { color: var(--muted); }

/* the 100-seat strip */
.sr-seats { position: relative; display: grid; grid-template-columns: repeat(100, 1fr); gap: 1.6px; height: 17px; margin-top: 6px; }
.sr-seats i { border-radius: 0.5px; }
.sr-seam { position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px; background: rgba(244,244,239,0.55); }
.sr-seam span { position: absolute; top: calc(100% + 4px); left: 50%; transform: translateX(-50%); font-size: 9px; font-weight: 700; letter-spacing: 0.1em; color: var(--muted3); }

/* 04 — the watchlist: dotted leaders + needles */
.sr-watch { display: flex; flex-direction: column; padding-top: 18px; }
.sr-watchrow { display: grid; grid-template-columns: 30px 58px minmax(80px, auto) minmax(24px, 1fr) 230px 72px 90px; gap: 16px; align-items: center; padding: 17px 0; }
.sr-watch-ord { font-size: 10.5px; font-weight: 600; color: var(--muted3); font-variant-numeric: tabular-nums; }
.sr-watch-st { font-size: 26px; font-weight: 680; letter-spacing: 0.04em; line-height: 1; transition: color 180ms ease; color: rgba(244,244,239,0.92); }
.sr-watch-name { font-size: 11px; font-weight: 650; letter-spacing: 0.13em; text-transform: uppercase; color: var(--muted2); white-space: nowrap; }
.sr-watch-lead { height: 2px; align-self: center;
  background-image: radial-gradient(circle, rgba(244,244,239,0.22) 0.8px, transparent 1.3px);
  background-size: 8px 2px; background-repeat: repeat-x; background-position: 0 center; }
.sr-watch-bar { position: relative; height: 12px; }
.sr-watch-bar::before { content: ''; position: absolute; left: 0; right: 0; top: 50%; height: 1px; background: rgba(244,244,239,0.13); }
.sr-watch-seam { position: absolute; left: 50%; top: 0; bottom: 0; width: 1px; background: rgba(244,244,239,0.4); }
.sr-watch-fill { position: absolute; top: calc(50% - 1.5px); height: 3px; border-radius: 99px; opacity: 0.85; transition: opacity 180ms ease; }
.sr-watch-m { font-size: 13.5px; font-weight: 700; font-variant-numeric: tabular-nums; text-align: right; }
.sr-watch-tag { font-size: 10px; font-weight: 680; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted3); text-align: right; }
.sr-watchrow:hover .sr-watch-st { color: #ffffff; }
.sr-watchrow:hover .sr-watch-fill { opacity: 1; }

/* the desk clock pill — portaled to <body>, so no .sr-page vars in here */
.sr-pill { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 60;
  display: inline-flex; align-items: baseline; gap: 12px; padding: 11px 20px 12px; border-radius: 999px;
  color: #f4f4ef; background: rgba(9,9,12,0.58); border: 1px solid rgba(255,255,255,0.12);
  -webkit-backdrop-filter: blur(18px) saturate(1.3); backdrop-filter: blur(18px) saturate(1.3);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.08), 0 14px 40px rgba(0,0,0,0.5);
  animation: sr-pill-in 800ms cubic-bezier(0.16,1,0.3,1) 500ms backwards; }
.sr-pill-dot { width: 6px; height: 6px; border-radius: 999px; background: var(--brand-grad); align-self: center;
  box-shadow: 0 0 10px rgba(109,62,233,0.7); animation: sr-pulse 2s ease-in-out infinite; }
.sr-pill b { font-size: 16px; font-weight: 560; letter-spacing: 0.02em; font-variant-numeric: tabular-nums; line-height: 1; }
.sr-pill-sep { width: 1px; height: 13px; background: rgba(244,244,239,0.16); align-self: center; }
.sr-pill-label, .sr-pill-stat { font-size: 10px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: rgba(244,244,239,0.40); white-space: nowrap; }
.sr-pill-stat { color: rgba(244,244,239,0.58); }
@keyframes sr-pill-in { from { opacity: 0; transform: translate(-50%, 18px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .sr-pill { animation: none; } }

/* responsive */
@media (max-width: 980px) {
  .sr-mast { grid-template-columns: 1fr; min-height: 0; }
  .sr-globe { height: 280px; margin: -8px -10px 0; order: 2; }
  .sr-mast-copy { padding-bottom: 0; }
  .sr-ins-fig { font-size: calc(var(--fs, 42px) * 0.78); }
  .sr-board { grid-template-columns: 1fr; gap: 52px; }
  .sr-fig-aside { max-width: 200px; }
}
@media (max-width: 700px) {
  .sr-wire::before { left: 75px; }
  .sr-wirerow { grid-template-columns: 60px 30px minmax(0, 1fr); }
  .sr-w-type { display: none; }
  .sr-w-fig { font-size: 18px; }
  .sr-calrow { grid-template-columns: 84px minmax(0, 1fr) 96px; row-gap: 6px; }
  .sr-cal-day, .sr-watch-lead { display: none; }
  .sr-cal-sample { grid-column: 1 / -1; grid-row: 2; }
  .sr-cal-in { display: none; }
  .sr-watchrow { grid-template-columns: 24px 50px minmax(0, 1fr) 64px; row-gap: 10px; }
  .sr-watch-name { display: none; }
  .sr-watch-bar { grid-column: 2 / -1; grid-row: 2; }
  .sr-watch-tag { display: none; }
  .sr-w-bar { width: 90px; }
  .sr-w-note { font-size: 15.5px; }
  .sr-pill { bottom: 14px; padding: 9px 16px 10px; gap: 10px; }
  .sr-pill b { font-size: 14px; }
}
@media (max-width: 560px) {
  .sr-folio span:nth-child(2) { display: none; }
  .sr-sec-meta { display: none; }
  .sr-globe { height: 230px; }
}
`;
