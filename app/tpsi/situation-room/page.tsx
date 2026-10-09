"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { SHOW_SITUATION_ROOM } from "@/app/lib/flags";
import Link from "next/link";
import WireGlobe from "@/app/components/WireGlobe";
import { SENATE_MODEL, senateBalance } from "@/app/components/senateModel";
import { getHomeStats, type HomeStats, type HomeSeriesPoint } from "@/app/_polling/lib/homeStats";
import { RAW_POLLS as GENERIC_POLLS, GOLD_STANDARD_NAMES as GENERIC_GOLD } from "@/app/_polling/genericballot/data";
import { RAW_POLLS as APPROVAL_POLLS, GOLD_STANDARD_NAMES as APPROVAL_GOLD } from "@/app/_polling/donaldtrumpapproval/data";
import { useElectionIndex } from "@/app/results/onpoint/lib/electionIndex.js";
import { useUpcomingDays } from "./upcoming";

// ─── data colors: party for party data, approve/disapprove pair for approval style numbers ───
const D_SOFT = "#7fa6ff";   // --dem2
const R_SOFT = "#ff8399";   // --gop2
const PG_GREEN = "#3ddc97"; // --win, approve / right track
const PG_MAGENTA = "#ff8399"; // disapprove / wrong track
const LIVE = "#f3eff8";     // live contest figures stay neutral; the live pill carries the red

// Mirrors the REDIST const on /electoralmap (enacted house nets, June 2026) —
// update both together when a map moves.
const REDIST_NET = { r: 9, d: 6 };
// Mirrors the headline on /tpsi/polls/la-mayor-2026 (Bass margin, leaners allocated).
const TPSI_HEADLINE = { fig: "B+18.8", sub: "LA mayor, Bass margin with leaners allocated" };

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
  return "var(--ind)";
};

const fmtNet = (n: number, pos = "D+", neg = "R+") =>
  Math.abs(n) < 0.05 ? "Even" : n > 0 ? `${pos}${n.toFixed(1)}` : `${neg}${Math.abs(n).toFixed(1)}`;
const appNet = (n: number) => (n > 0 ? `+${Math.abs(n).toFixed(0)}` : `−${Math.abs(n).toFixed(0)}`);
const pollTone = (p: WirePoll) =>
  p.type === "Generic ballot"
    ? (p.net === 0 ? "var(--ink2)" : p.net > 0 ? D_SOFT : R_SOFT)
    : (p.net === 0 ? "var(--ink2)" : p.net > 0 ? PG_GREEN : PG_MAGENTA);
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
      <line x1={2} x2={w - 54} y1={h - 5} y2={h - 5} stroke="rgba(var(--line-rgb),.1)" strokeWidth="1" />
      <path d={area("a")} fill={tones[0]} opacity="0.08" />
      <path d={area("b")} fill={tones[1]} opacity="0.07" />
      <path d={path("b")} stroke={tones[1]} strokeWidth="1.7" fill="none" opacity="0.8" />
      <path d={path("a")} stroke={tones[0]} strokeWidth="1.7" fill="none" />
      <circle cx={x(n - 1)} cy={y(last.a)} r="2.8" fill={tones[0]} />
      <circle cx={x(n - 1)} cy={y(last.b)} r="2.8" fill={tones[1]} />
      <text x={x(n - 1) + 11} y={ya + 4.5} fill={tones[0]} fontSize="13.5" fontWeight="650" fontFamily="var(--font-m)">{last.a.toFixed(labelDigits)}</text>
      <text x={x(n - 1) + 11} y={yb + 4.5} fill={tones[1]} fontSize="13.5" fontWeight="650" fontFamily="var(--font-m)" opacity="0.85">{last.b.toFixed(labelDigits)}</text>
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
  // Situation Room reads the full season index, not the 24-race coverage
  // gate (_data/coverage.2026-08-04) — it's a season-wide status view, not
  // one of the /results desk's covered-races display surfaces.
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

  // the wire feed — today's races pinned, then polls, stamps suppressed on repeat
  type Entry = { kind: "race"; doc: Doc } | { kind: "note" } | { kind: "poll"; p: WirePoll };
  const entries: Entry[] = useMemo(() => ([
    ...todays.slice(0, 5).map((doc) => ({ kind: "race" as const, doc })),
    ...(!todays.length && index ? [{ kind: "note" as const }] : []),
    ...wire.map((p) => ({ kind: "poll" as const, p })),
  ]), [todays, index, wire]);

  let prevStamp = "";
  const stampFor = (e: Entry) => (e.kind === "poll" ? fmtShort(e.p.endDate) : "today");

  // the big board — every tracker the desk runs, one strip
  const board: { label: string; fig: React.ReactNode; tone?: string; sub: string; href: string }[] = [
    {
      label: "Generic ballot", href: "/polls/generic-ballot",
      fig: stats ? fmtNet(generic) : "...", tone: generic >= 0 ? D_SOFT : R_SOFT,
      sub: stats ? `${stats.generic.count} polls, gold standard x2` : "Model loading",
    },
    {
      label: "Trump approval", href: "/polls/approval",
      fig: stats ? appNet(approval) : "...", tone: approval < 0 ? PG_MAGENTA : PG_GREEN,
      sub: stats ? `${stats.approval.approve.toFixed(0)} approve · ${stats.approval.disapprove.toFixed(0)} disapprove` : "Model loading",
    },
    {
      label: "Right track", href: "/polls/generic-ballot?race=right-wrong-track",
      fig: stats ? appNet(track) : "...", tone: track < 0 ? PG_MAGENTA : PG_GREEN,
      sub: stats ? `${stats.track.right.toFixed(0)} right · ${stats.track.wrong.toFixed(0)} wrong` : "Model loading",
    },
    {
      label: "TPSI poll", href: "/tpsi/polls",
      fig: TPSI_HEADLINE.fig, tone: D_SOFT, sub: TPSI_HEADLINE.sub,
    },
    {
      label: "Projected Senate", href: "/forecast",
      fig: <><b style={{ color: D_SOFT }}>{Math.max(dSeats, rSeats)}</b><em>-</em><b style={{ color: R_SOFT }}>{Math.min(dSeats, rSeats)}</b></>,
      sub: "35 seats modeled nightly",
    },
    {
      label: "Redistricting", href: "/maps/electoral?mode=redist",
      fig: <><b style={{ color: R_SOFT }}>R+{REDIST_NET.r}</b><em>·</em><b style={{ color: D_SOFT }}>D+{REDIST_NET.d}</b></>,
      sub: "Enacted House nets, June",
    },
    {
      label: "Next election", href: "/results",
      fig: nextDay ? fmtShort(nextDay.date) : upcoming === null ? "..." : fmtShort("2026-11-03"),
      sub: nextDay ? `${nextDay.count.toLocaleString()} contest${nextDay.count === 1 ? "" : "s"} · in ${daysUntil(nextDay.date)} days` : upcoming === null ? "Checking the calendar" : "The midterms",
    },
    {
      label: "The midterms", href: "/maps/electoral",
      fig: String(days), sub: "Days to November 3, 2026",
    },
  ];

  const statusLine = !index && !indexError ? "Checking the wire" : todays.length ? `${todays.length} contest${todays.length === 1 ? "" : "s"} reporting today` : "No contests reporting today";
  const nextLine = nextDay ? `Next election ${fmtShort(nextDay.date)}, ${nextDay.count.toLocaleString()} contests` : upcoming === null ? "Reading the calendar ahead" : `Midterms in ${days} days`;

  return (
    <div className="opp sr">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/tpsi">TPSI</Link><span className="sep">/</span><span>Situation room</span></nav>
      <header className="ph">
        <div className="eye g">Live monitor</div>
        <h1>Situation <em>room</em></h1>
        <p className="lede">The wire, the board, the calendar ahead and the watchlist, on one screen. The desk runs on eastern time.</p>
        <div className="pmeta">
          {todays.length > 0 ? <span className="pill live">Live</span> : null}
          <span><b>{statusLine}</b></span>
          <span>{nextLine}</span>
          <span>{fmtDay(today)}</span>
          <span role="status" aria-label="Live desk clock, eastern time">ET <b className="mono">{mounted ? clock || "--:--:--" : "--:--:--"}</b></span>
        </div>
      </header>

      {/* the big board: every tracker the desk runs */}
      <div className="sr-board">
        {board.map((c) => (
          <Link href={c.href} key={c.label} className="card sr-ins">
            <span className="eye">{c.label}</span>
            <span className="sr-ins-fig" style={c.tone ? { color: c.tone } : undefined}>{c.fig}</span>
            <span className="sr-ins-sub">{c.sub}</span>
          </Link>
        ))}
      </div>

      <div className="layout">
        <div style={{ display: "grid", gap: 16, minWidth: 0 }}>
          {/* the wire */}
          <section className="card">
            <div className="card-h">
              <h3>The wire</h3>
              <span className="eye">Today&rsquo;s contests and the latest polls</span>
              <Link className="btn sm" href="/results/live" style={{ marginLeft: "auto" }}>Election results</Link>
            </div>
            <div className="sr-wire">
              {!index && !indexError && (
                <div className="sr-wirerow" aria-hidden="true">
                  <span className="sr-w-stamp">...</span>
                  <div className="sr-w-body"><span className="sr-skel" style={{ width: "42%" }} /><span className="sr-skel" style={{ width: "26%" }} /></div>
                </div>
              )}
              {entries.map((e, i) => {
                const stamp = stampFor(e);
                const show = stamp !== prevStamp; prevStamp = stamp;

                if (e.kind === "note") {
                  return (
                    <div className="sr-wirerow is-note" key="note">
                      <span className="sr-w-stamp">{show ? stamp : ""}</span>
                      <div className="sr-w-body">
                        <p className="sr-w-note">
                          The board is quiet, with no contests reporting today.{" "}
                          {nextDay
                            ? <>Next on the calendar: <b>{fmtDay(nextDay.date)}</b>, {nextDay.count.toLocaleString()} contest{nextDay.count === 1 ? "" : "s"}.</>
                            : upcoming === null
                              ? <>Reading the calendar ahead.</>
                              : <>Next up: the midterms, <b>November 3</b>, {days} days out.</>}
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
                    <Link href="/results/live" className="sr-wirerow" key={`r-${d.id}`}>
                      <span className="sr-w-stamp">{show ? <span className="pill live">{stamp}</span> : ""}</span>
                      <div className="sr-w-body">
                        <div className="sr-w-line">
                          <span className="sr-w-src">{d.title}</span>
                          <span className="sr-w-type">{[d.province || d.stateName, d.office].filter(Boolean).join(" · ")}</span>
                          <b className="sr-w-fig" style={{ color: LIVE }}>{d.hasResult ? `${Math.round(d.reporting)}% in` : "Polls open"}</b>
                        </div>
                        {cands.length > 0 && (
                          <div className="sr-w-meta">
                            {cands.map((c, j) => (
                              <span className="sr-w-cand" key={j}>
                                <i style={{ background: partyTone(c.party) }} />
                                {String(c.name || "").split(/\s+/).pop()}
                                <b className="mono">{Number(c.percent ?? 0) > 0 ? `${Number(c.percent).toFixed(1)}` : "n/a"}</b>
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
                  <Link href={p.type === "Generic ballot" ? "/polls/generic-ballot" : "/polls/approval"} className="sr-wirerow" key={`p-${p.pollster}-${p.endDate}-${i}`}>
                    <span className="sr-w-stamp mono">{show ? stamp : ""}</span>
                    <div className="sr-w-body">
                      <div className="sr-w-line">
                        <span className="sr-w-src">{p.pollster}{p.gold && <span className="sr-gold" title="Gold Standard pollster">Gold</span>}</span>
                        <span className="sr-w-type">{p.type}</span>
                        <b className="sr-w-fig" style={{ color: pollTone(p) }}>{pollFig(p)}</b>
                      </div>
                      <div className="sr-w-meta">
                        <span className="sr-w-split mono">
                          <b style={{ color: p.type === "Generic ballot" ? D_SOFT : PG_GREEN }}>{p.a.toFixed(0)}</b>
                          <em>/</em>
                          <b style={{ color: p.type === "Generic ballot" ? R_SOFT : PG_MAGENTA }}>{p.b.toFixed(0)}</b>
                        </span>
                        <span className="sr-w-n">{p.sampleType} · <span className="mono">{p.sampleSize ? p.sampleSize.toLocaleString() : "n/a"}</span></span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* the board: the desk's live model, ninety days of it */}
          <section className="card">
            <div className="card-h"><h3>The board</h3><span className="eye" style={{ marginLeft: "auto" }}>Last 90 days</span></div>
            <div className="sr-trends">
              <Link href="/polls/generic-ballot" className="sr-trend sr-trend-hero">
                <span className="eye">Generic congressional ballot</span>
                <span className="sr-big" style={{ color: generic >= 0 ? D_SOFT : R_SOFT }}>{stats ? fmtNet(generic) : "..."}</span>
                {stats && <DualSpark daily={stats.generic.daily.slice(-90)} tones={[D_SOFT, R_SOFT]} />}
                <span className="sr-sub">{stats ? `${stats.generic.count} polls · Gold Standard weighted x2 · 90 day window` : ""}</span>
              </Link>
              <Link href="/polls/approval" className="sr-trend">
                <span className="eye">Trump net approval</span>
                <span className="sr-mid" style={{ color: approval < 0 ? PG_MAGENTA : PG_GREEN }}>{stats ? appNet(approval) : "..."}</span>
                {stats && <DualSpark daily={stats.approval.daily.slice(-90)} w={300} h={84} tones={[PG_GREEN, PG_MAGENTA]} labelDigits={0} />}
                <span className="sr-sub">{stats ? `${stats.approval.approve.toFixed(0)} approve · ${stats.approval.disapprove.toFixed(0)} disapprove · ${stats.approval.count} polls` : ""}</span>
              </Link>
              <Link href="/polls/generic-ballot?race=right-wrong-track" className="sr-trend">
                <span className="eye">Direction of the country</span>
                <span className="sr-mid" style={{ color: track < 0 ? PG_MAGENTA : PG_GREEN }}>{stats ? appNet(track) : "..."}</span>
                {stats && <DualSpark daily={stats.track.daily.slice(-90)} w={300} h={84} tones={[PG_GREEN, PG_MAGENTA]} labelDigits={0} />}
                <span className="sr-sub">{stats ? `${stats.track.right.toFixed(0)} right track · ${stats.track.wrong.toFixed(0)} wrong track · ${stats.track.count} polls` : ""}</span>
              </Link>
              <Link href="/forecast" className="sr-trend sr-trend-hero">
                <span className="eye">Projected Senate</span>
                <span className="sr-mid"><b style={{ color: D_SOFT }}>{Math.max(dSeats, rSeats)}</b><em> - </em><b style={{ color: R_SOFT }}>{Math.min(dSeats, rSeats)}</b></span>
                <SeatStrip />
                <span className="sr-sub">65 holdovers + 35 modeled · faded ticks are this cycle&rsquo;s seats</span>
              </Link>
            </div>
          </section>
        </div>

        <aside className="side">
          {/* the calendar ahead */}
          <section className="card">
            <div className="card-h"><h3>The calendar ahead</h3><Link className="eye" href="/results" style={{ marginLeft: "auto" }}>See all</Link></div>
            <div>
              {upcoming === null && <div className="sr-calrow" aria-hidden="true"><span className="sr-skel" style={{ width: "60%" }} /></div>}
              {upcoming && upcoming.length === 0 && (
                <p className="sr-w-note" style={{ padding: "14px 18px" }}>Nothing scheduled before the midterms on <b>November 3</b>, {days} days out.</p>
              )}
              {(upcoming ?? []).map((u) => (
                <Link href="/results" key={u.date} className="sr-calrow">
                  <span className="sr-cal-date mono">{fmtShort(u.date)}</span>
                  <span className="sr-cal-main">
                    <b>{fmtWeekday(u.date)}</b>
                    <small>{u.sample.join(" · ") || "Contests on the wire"}</small>
                  </span>
                  <span className="sr-cal-count mono">{u.count.toLocaleString()}<small>in {daysUntil(u.date)}d</small></span>
                </Link>
              ))}
            </div>
          </section>

          {/* the watchlist */}
          <section className="card">
            <div className="card-h"><h3>The watchlist</h3><Link className="eye" href="/forecast" style={{ marginLeft: "auto" }}>All 35</Link></div>
            <div>
              {hotRaces.map((r, i) => {
                const dLead = r.m < 0;
                const w = Math.sqrt(Math.min(Math.abs(r.m), 3) / 3) * 47;
                return (
                  <Link key={r.st} href="/forecast" className="race sr-watch">
                    <span className="st">{pad(i + 1)} {r.st}</span>
                    <span className="who"><b>{STATE_NAMES[r.st] || ""}</b><small>{r.open ? "Open seat" : "Incumbent"}</small>
                      <span className="sr-watch-bar" aria-hidden="true">
                        <i className="sr-watch-seam" />
                        <i className="sr-watch-fill" style={{ left: dLead ? `${50 - w}%` : "50%", width: `${w}%`, background: dLead ? D_SOFT : R_SOFT }} />
                      </span>
                    </span>
                    <span className={`mg ${dLead ? "d" : "r"}`}>{dLead ? `D+${Math.abs(r.m).toFixed(1)}` : `R+${r.m.toFixed(1)}`}</span>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* the desk's eye */}
          <section className="card sr-globe-card" aria-hidden="true">
            <div className="card-h"><h3>Toss up Senate states</h3></div>
            <div className="sr-globe"><WireGlobe /></div>
          </section>
        </aside>
      </div>
    </div>
  );
}

// ─── styles ──────────────────────────────────────────────────────────────────
const CSS = `
.sr .sr-board { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; margin-bottom: 16px; }
@media (max-width: 960px) { .sr .sr-board { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.sr .sr-ins { display: grid; gap: 6px; padding: 14px 16px; transition: .2s; align-content: start; }
.sr .sr-ins:hover { transform: translateY(-2px); border-color: var(--line2); }
.sr .sr-ins-fig { font: 800 30px/1 var(--font-d); letter-spacing: -.03em; font-variant-numeric: tabular-nums; }
.sr .sr-ins-fig em { font-style: normal; color: var(--mute2); }
.sr .sr-ins-sub { font-size: 12px; color: var(--mute); }

.sr .sr-wire { display: grid; }
.sr .sr-wirerow { display: grid; grid-template-columns: 64px minmax(0,1fr); gap: 12px; padding: 11px 18px; border-top: 1px solid var(--line); transition: background .15s; }
.sr .sr-wirerow:first-child { border-top: 0; }
.sr a.sr-wirerow:hover { background: var(--glass2); }
.sr .sr-w-stamp { font-size: 11.5px; color: var(--mute); padding-top: 2px; text-transform: uppercase; letter-spacing: .06em; }
.sr .sr-w-stamp .pill { font-size: 9.5px; }
.sr .sr-w-body { min-width: 0; display: grid; gap: 4px; }
.sr .sr-w-line { display: flex; align-items: baseline; gap: 10px; min-width: 0; }
.sr .sr-w-src { font-weight: 700; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr .sr-gold { margin-left: 8px; font: 700 9.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); border: 1px solid var(--line2); border-radius: 999px; padding: 1px 6px; vertical-align: 2px; }
.sr .sr-w-type { font-size: 12px; color: var(--mute); white-space: nowrap; }
.sr .sr-w-fig { margin-left: auto; font: 700 14px var(--font-m); font-variant-numeric: tabular-nums; white-space: nowrap; }
.sr .sr-w-meta { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; font-size: 12px; color: var(--mute); }
.sr .sr-w-split em { font-style: normal; color: var(--mute2); margin: 0 4px; }
.sr .sr-w-cand { display: inline-flex; align-items: center; gap: 6px; color: var(--ink2); }
.sr .sr-w-cand i { width: 8px; height: 8px; border-radius: 2px; display: inline-block; }
.sr .sr-w-bar { display: inline-flex; width: 120px; height: 5px; border-radius: 99px; overflow: hidden; background: rgba(var(--line-rgb),.06); }
.sr .sr-w-bar i { display: block; height: 100%; }
.sr .sr-w-note { font-size: 13.5px; color: var(--ink2); margin: 0; }
.sr .sr-skel { display: block; height: 10px; border-radius: 4px; background: rgba(var(--line-rgb),.07); margin: 4px 0; }

.sr .sr-trends { display: grid; grid-template-columns: 1fr 1fr; }
.sr .sr-trend { display: grid; gap: 6px; padding: 16px 18px; border-top: 1px solid var(--line); transition: background .15s; align-content: start; }
.sr .sr-trend:nth-child(2n) { border-left: 1px solid var(--line); }
.sr .sr-trend:nth-child(-n+2) { border-top: 0; }
.sr .sr-trend:hover { background: var(--glass2); }
.sr .sr-big { font: 800 44px/1 var(--font-d); letter-spacing: -.04em; }
.sr .sr-mid { font: 800 32px/1 var(--font-d); letter-spacing: -.03em; }
.sr .sr-mid em { font-style: normal; color: var(--mute2); }
.sr .sr-sub { font-size: 12px; color: var(--mute); }
.sr .sr-spark { width: 100%; height: auto; display: block; margin-top: 4px; }
.sr .sr-seats { position: relative; display: flex; gap: 1.5px; height: 22px; margin-top: 8px; }
.sr .sr-seats i { flex: 1; border-radius: 1px; }
.sr .sr-seam { position: absolute; left: 50%; top: -4px; bottom: -4px; width: 1px; background: var(--hi); }
.sr .sr-seam span { position: absolute; top: -14px; left: -8px; font: 600 9px var(--font-m); color: var(--mute); }
@media (max-width: 700px) {
  .sr .sr-trends { grid-template-columns: 1fr; }
  .sr .sr-trend:nth-child(2n) { border-left: 0; }
  .sr .sr-trend:nth-child(2) { border-top: 1px solid var(--line); }
}

.sr .sr-calrow { display: grid; grid-template-columns: 52px minmax(0,1fr) auto; gap: 10px; align-items: center; padding: 10px 18px; border-top: 1px solid var(--line); transition: background .15s; }
.sr .sr-calrow:first-child { border-top: 0; }
.sr a.sr-calrow:hover { background: var(--glass2); }
.sr .sr-cal-date { font-weight: 700; font-size: 12.5px; }
.sr .sr-cal-main { min-width: 0; font-size: 13px; }
.sr .sr-cal-main small { display: block; font-size: 11.5px; color: var(--mute); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sr .sr-cal-count { text-align: right; font-weight: 700; font-size: 13px; }
.sr .sr-cal-count small { display: block; font-weight: 500; font-size: 11px; color: var(--mute2); }

.sr .sr-watch .st { font-size: 12px; white-space: nowrap; }
.sr .sr-watch { grid-template-columns: 52px 1fr auto; }
.sr .sr-watch-bar { position: relative; display: block; height: 4px; margin-top: 6px; border-radius: 99px; background: rgba(var(--line-rgb),.06); }
.sr .sr-watch-seam { position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: var(--line2); }
.sr .sr-watch-fill { position: absolute; top: 0; bottom: 0; border-radius: 99px; }

.sr .sr-globe { position: relative; height: 260px; overflow: hidden; }
`;
