"use client";

import React, { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import HeroElectoralMap from "@/app/components/HeroElectoralMap";
import DarkNav from "@/app/components/DarkNav";
import PublishDeck from "@/app/components/PublishDeck";
import { SENATE_MODEL, senateBalance } from "@/app/components/senateModel";
import { getHomeStats, type HomeStats, type HomeSeriesPoint, type HomePollPoint } from "@/app/polling/lib/homeStats";

const SentimentGlobe = dynamic(() => import("@/app/components/SentimentGlobe"), { ssr: false });
const DotField = dynamic(() => import("@/app/components/DotField"), { ssr: false });

type ProcessItem = {
  title: string;
  body: string;
};

const proofText =
  "A polling product should show its work, not hide it behind a dashboard skin.";

const narrativeStatement =
  "We believe that every voice carries a signal. Most research misses those voices. The Public Sentiment Institute is built to find it — in the data beneath the data, in the areas others overlook, asking the tough questions other researchers won’t.";

const process: ProcessItem[] = [
  {
    title: "Collect",
    body: "Polls and live race data are normalized into consistent candidate, sample, and date fields.",
  },
  {
    title: "Weight",
    body: "Gold-standard pollsters, recency, sample size, and voter universe shape the daily average.",
  },
  {
    title: "Model",
    body: "Forecast inputs blend polling priors, reporting progress, and expected turnout.",
  },
  {
    title: "Publish",
    body: "Charts, race ratings, maps, and result pages stay readable for real voters and campaigns.",
  },
  {
    title: "Explain",
    body: "Every public surface keeps the assumptions, data lineage, and election-night context close to the result.",
  },
];

const faqs = [
  {
    question: "Do you run your own polls?",
    answer: "Yes. PSI publishes its own fielded research and also aggregates public polling where methodology is clear.",
  },
  {
    question: "How are averages weighted?",
    answer: "The public trackers combine recency, sample size, voter universe, pollster quality, and candidate fields into a daily weighted series.",
  },
  {
    question: "Can campaigns request a custom poll?",
    answer: "Yes. Campaigns, media groups, and organizations can start through the partner intake page for custom fielding or recurring tracks.",
  },
  {
    question: "Where do live results come from?",
    answer: "Live result pages use civic race data, candidate rows, reporting progress, and local model inputs to keep election-night context readable.",
  },
  {
    question: "Can I participate in a survey?",
    answer: "Yes. PSI maintains survey recruitment flows for public opinion research and issue polling.",
  },
];

function ApproachTheater() {
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rows = Array.from(wrap.querySelectorAll<HTMLElement>(".ap-row"));
    const reduced = prefersReduced();
    const update = () => {
      const vh = Math.max(window.innerHeight, 1);
      for (const row of rows) {
        const r = row.getBoundingClientRect();
        // arrival: 0 as the row enters from below → 1 once it sits mid-frame
        const p = reduced ? 1 : Math.max(0, Math.min(1, (vh * 0.94 - r.top) / (vh * 0.66)));
        // departure: grows as the row passes upward — the glow disperses
        const dep = reduced ? 0.5 : Math.max(0, Math.min(1, (vh * 0.42 - r.top) / (vh * 0.9)));
        const ease = 1 - Math.pow(1 - p, 3);
        row.style.setProperty("--wx", (1 - ease).toFixed(4));
        row.style.setProperty("--wo", Math.min(1, p * 1.6).toFixed(4));
        row.style.setProperty("--co", Math.max(0, Math.min(1, (p - 0.35) * 2)).toFixed(4));
        row.style.setProperty("--go", (Math.min(1, p * 1.8) * (1 - dep * 0.75) * 0.95).toFixed(4));
        row.style.setProperty("--gs", (1 + dep * 0.6).toFixed(4));
      }
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  const hues: [string, string][] = [
    ["186,150,255", "138,163,242"],   // collect — violet / periwinkle
    ["138,163,242", "124,187,159"],   // weight — periwinkle / sage
    ["124,187,159", "186,150,255"],   // model — sage / violet
    ["238,108,170", "255,170,140"],   // publish — rose / peach
    ["255,180,150", "186,150,255"],   // explain — peach / violet
  ];
  return (
    <div className="ap" ref={wrapRef}>
      <div className="ap-eyebrow"><span aria-hidden="true" />The approach</div>
      {process.map((item, i) => (
        <div key={item.title} className={`ap-row ${i % 2 === 0 ? "ap-right" : "ap-left"}`}
          style={{ "--ga": hues[i][0], "--gb": hues[i][1] } as React.CSSProperties}>
          <span className="ap-glow" aria-hidden="true" />
          <div className="ap-copy">
            <span className="ap-idx">{String(i + 1).padStart(2, "0")}</span>
            <p>{item.body}</p>
          </div>
          <h3 className="ap-word">{item.title}</h3>
        </div>
      ))}
    </div>
  );
}

// ─── "State of the play" data band + "Inside the desk" stage ─────────────────
function prefersReduced() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}
function useCountUp(target: number, armed: boolean, decimals = 0, duration = 950) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!armed) return;
    if (prefersReduced()) { const r = requestAnimationFrame(() => setVal(target)); return () => cancelAnimationFrame(r); }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick); else setVal(target);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [armed, target, decimals, duration]);
  return val.toFixed(decimals);
}
function useArmed(threshold = 0.3) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    const n = ref.current;
    if (!n || typeof IntersectionObserver === "undefined") { const r = requestAnimationFrame(() => setArmed(true)); return () => cancelAnimationFrame(r); }
    const o = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { setArmed(true); o.disconnect(); } }), { threshold });
    o.observe(n);
    return () => o.disconnect();
  }, [threshold]);
  return { ref, armed };
}
/* Product colors — lifted verbatim from the destination pages. */
const PG_BLUE = "#8aa3f2";    // Democrats, muted
const PG_RED = "#ef8b94";     // Republicans, muted
const PG_GREEN = "#7cbb9f";   // Approve, muted
const PG_MAGENTA = "#c08fd6"; // Disapprove, muted
const FC_BLUE = "#8aa3f2";    // forecast D, muted
const FC_RED = "#ef8b94";     // forecast R, muted

// forecast page rating tiers
function ratingTone(m: number): string {
  if (m >= 12) return "#d9707a";
  if (m >= 6) return "#ef8b94";
  if (m >= 2) return "#f4b0b6";
  if (m > 0) return "#f8cdd1";
  if (m > -2) return "#ccd6f8";
  if (m > -6) return "#aabcf5";
  if (m > -12) return "#8aa3f2";
  return "#6f86d9";
}

const BALLOT: { name: string; pct: number }[] = [
  { name: "Bass", pct: 39.9 }, { name: "Pratt", pct: 21.1 }, { name: "Raman", pct: 12.2 },
  { name: "Other", pct: 12.1 }, { name: "Huang", pct: 7.8 }, { name: "Miller", pct: 6.9 },
];
// 2022 Iowa Governor, certified result — replayed through the live-results UI.
const RESULTS = { rows: [{ name: "Kim Reynolds", party: "R" as const, pct: 58.0, color: FC_RED }, { name: "Deidre DeJear", party: "D" as const, pct: 39.5, color: FC_BLUE }] };
// 2024 base map with the seven battlegrounds left open (93 EV among them).
const EV = { d: 226, t: 93, r: 219 };

type PreviewProps = { stats: HomeStats | null };

/* The tracker pages' chart language at marketing scale: poll dots + two
   weighted daily lines, value pills riding the line ends. */
function DualChart({ daily, polls, colA, colB, yPad = 3, strokeW = 2.6, ends = "pill", endA, endB }: {
  daily: HomeSeriesPoint[]; polls?: HomePollPoint[];
  colA: string; colB: string; yPad?: number; strokeW?: number;
  ends?: "pill" | "text" | "none"; endA?: string; endB?: string;
}) {
  const W = 640, H = 260, padL = 10, padR = 64, padT = 16, padB = 10;
  if (!daily.length) return <svg viewBox={`0 0 ${W} ${H}`} className="pvb-svg" />;
  const t1 = daily[daily.length - 1].t;
  const t0 = t1 - 120 * 86400000;
  const win = daily.filter((p) => p.t >= t0);
  const pwin = (polls ?? []).filter((p) => p.t >= t0);
  const vals = [...win.flatMap((p) => [p.a, p.b]), ...pwin.flatMap((p) => [p.a, p.b])];
  const lo = Math.min(...vals) - yPad;
  const hi = Math.max(...vals) + yPad;
  const mx = (t: number) => padL + ((t - t0) / Math.max(t1 - t0, 1)) * (W - padL - padR);
  const my = (v: number) => padT + (1 - (v - lo) / Math.max(hi - lo, 1)) * (H - padT - padB);
  const path = (key: "a" | "b") => `M${win.map((p) => `${mx(p.t).toFixed(1)},${my(p[key]).toFixed(1)}`).join(" L")}`;
  const last = win[win.length - 1];
  const tag = (v: number, col: string, lab?: string) => {
    if (ends === "none") return null;
    if (ends === "text") {
      return (
        <g transform={`translate(${mx(last.t) + 12}, ${my(v)})`}>
          <text y="-3" className="ex-endlab" fill={col}>{lab}</text>
          <text y="13" className="ex-endval" fill={col}>{v.toFixed(1)}</text>
        </g>
      );
    }
    return (
      <g transform={`translate(${mx(last.t) + 10}, ${my(v) - 10})`}>
        <rect width="48" height="20" rx="10" fill={col} />
        <text x="24" y="14" textAnchor="middle" className="pvb-tagtext">{v.toFixed(1)}</text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="pvb-svg" preserveAspectRatio="none">
      {pwin.map((p, i) => (
        <g key={i} opacity={0.08 + ((p.t - t0) / Math.max(t1 - t0, 1)) * 0.24}>
          <circle cx={mx(p.t)} cy={my(p.a)} r="2.8" fill={colA} />
          <circle cx={mx(p.t)} cy={my(p.b)} r="2.8" fill={colB} />
        </g>
      ))}
      <path d={path("b")} fill="none" stroke={colB} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <path d={path("a")} fill="none" stroke={colA} strokeWidth={strokeW} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={mx(last.t)} cy={my(last.a)} r="4" fill={colA} stroke="#0b0b0d" strokeWidth="1.6" />
      <circle cx={mx(last.t)} cy={my(last.b)} r="4" fill={colB} stroke="#0b0b0d" strokeWidth="1.6" />
      {tag(last.a, colA, endA)}
      {tag(last.b, colB, endB)}
    </svg>
  );
}

// ─── The evidence — three columns of light rising with the scroll ────────────
function EvidenceBars({ stats }: { stats: HomeStats | null }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const update = () => {
      const n = ref.current; if (!n) return;
      const rect = n.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const scrollable = Math.max(n.offsetHeight - vh, 1);
      const np = prefersReduced() ? 1 : Math.max(0, Math.min(1, -rect.top / scrollable));
      setP((prev) => (Math.abs(prev - np) > 0.003 ? np : prev));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  const bars = [
    { v: stats?.approval.count ?? 585, label: "approval polls in the model", note: "every public job-approval poll", color: "246,244,240" },
    { v: stats?.generic.count ?? 221, label: "generic-ballot polls", note: "gold-standard weighted, daily", color: "246,244,240" },
    { v: 50, label: "states in the forecast map", note: "the complete forecast map", color: "246,244,240" },
  ];
  const maxSqrt = Math.sqrt(Math.max(...bars.map((b) => b.v)));

  return (
    <div className="ev" ref={ref} aria-label="What feeds the model">
      <div className="ev-sticky">
        <div className="ev-eyebrow"><span aria-hidden="true" />The evidence</div>
        <div className="ev-row">
          {bars.map((b, i) => {
            const start = i * 0.16;
            const k = Math.max(0, Math.min(1, (p * 1.45 - start) / 0.62));
            const g = 1 - Math.pow(1 - k, 3);
            const hRel = Math.sqrt(b.v) / maxSqrt;
            const hPct = Math.max(g * hRel * 100, 0.001);
            return (
              <div className="ev-col" key={b.label} style={{ "--c": `rgb(${b.color})`, "--ca": b.color, "--g": g.toFixed(3) } as React.CSSProperties}>
                <div className="ev-fill" style={{ height: `${hPct.toFixed(2)}%` }}>
                  <span className="ev-crest" aria-hidden="true" />
                </div>
                <div className="ev-num" style={{ bottom: `calc(${hPct.toFixed(2)}% + 22px)` }}>
                  {Math.round(b.v * g)}
                </div>
                <div className="ev-lab">{b.label}<i>{b.note}</i></div>
              </div>
            );
          })}
          <span className="ev-base" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}

/* ─── The desk — an editorial exhibit wall. No containers: each tracker is a
   large borderless exhibit floating on the page, its data feathered into the
   dark at the edges, separated by hairline rules and index typography. ─── */

function ExhibitFrame({ idx, title, sub, href, cta, depth, children }: {
  idx: string; title: string; sub?: string; href: string; cta: string;
  depth: number; children: React.ReactNode;
}) {
  return (
    <Link href={href} className="ex" style={{ "--depth": depth } as React.CSSProperties}>
      <span className="ex-rule" aria-hidden="true" />
      <span className="ex-meta">
        <span className="ex-idx">{idx}</span>
        <span className="ex-title">{title}</span>
        {sub && <span className="ex-sub">{sub}</span>}
        <span className="ex-cta">{cta}<i aria-hidden="true">→</i></span>
      </span>
      <span className="ex-body">{children}</span>
    </Link>
  );
}

/* 01 — generic ballot: the dual-line chart floats free, edges feathered,
   today's margin as a huge numeral riding the right edge. */
function BallotExhibit({ stats }: PreviewProps) {
  const g = stats?.generic;
  const fmt = !g ? "" : g.net > 0 ? `D+${g.net.toFixed(1)}` : g.net < 0 ? `R+${Math.abs(g.net).toFixed(1)}` : "Even";
  return (
    <span className="ex-stage ex-stage-tall">
      <span className="ex-wash" style={{ background: "radial-gradient(56% 70% at 38% 55%, rgba(138,163,242,0.06), transparent 70%)" }} />
      <span className="ex-chart ex-fade">
        {g && <DualChart daily={g.daily} polls={g.polls} colA={PG_BLUE} colB={PG_RED} ends="text" endA="Dem" endB="Rep" />}
      </span>
      <span className="ex-big" style={{ color: PG_BLUE }}>{fmt}<i>today’s weighted margin</i></span>
    </span>
  );
}

/* 02 — senate ratings: the beeswarm at scale with an annotated callout and
   the projected balance as paired numerals. */
function SenateExhibit() {
  const W = 980, H = 270, pad = 40, R = 13, stepY = 29, gap = 3, cap = 42;
  const mx = (m: number) => pad + ((Math.max(-cap, Math.min(cap, m)) + cap) / (cap * 2)) * (W - 2 * pad);
  const sorted = [...SENATE_MODEL].sort((a, b) => a.m - b.m);
  const placed: { st: string; m: number; open?: boolean; x: number; row: number }[] = [];
  for (const s of sorted) { const x = mx(s.m); let row = 0; while (placed.some((p) => p.row === row && Math.abs(p.x - x) < R * 2 + gap)) row++; placed.push({ ...s, x, row }); }
  const baseY = H - 26;
  const { d, r } = senateBalance();
  const ia = placed.find((p) => p.st === "IA");
  return (
    <span className="ex-stage ex-stage-swarm">
      <span className="ex-wash" style={{ background: "radial-gradient(40% 80% at 30% 70%, rgba(111,134,217,0.055), transparent 70%), radial-gradient(40% 80% at 70% 70%, rgba(217,112,122,0.05), transparent 70%)" }} />
      <span className="ex-chart ex-fade-x">
        <svg viewBox={`0 0 ${W} ${H}`} className="ex-svg" preserveAspectRatio="xMidYMax meet">
          {[-40, -20, 0, 20, 40].map((g) => (
            <g key={g}>
              <line x1={mx(g)} y1={g === 0 ? 14 : 56} x2={mx(g)} y2={baseY + 4} stroke={g === 0 ? "rgba(244,244,239,0.2)" : "rgba(244,244,239,0.07)"} strokeWidth="1" strokeDasharray={g === 0 ? "3 5" : "0"} />
              <text x={mx(g)} y={baseY + 21} textAnchor="middle" className="ex-axis">{g === 0 ? "EVEN" : g > 0 ? `R+${g}` : `D+${-g}`}</text>
            </g>
          ))}
          {placed.map((p) => {
            const cy = baseY - 10 - p.row * stepY, c = ratingTone(p.m);
            return p.open
              ? <circle key={p.st} cx={p.x} cy={cy} r={R - 1.2} fill="#050505" stroke={c} strokeWidth="2.2" />
              : <circle key={p.st} cx={p.x} cy={cy} r={R} fill={c} />;
          })}
        </svg>
      </span>
      {ia && (
        <span className="ex-ann" style={{ left: `${(ia.x / W) * 100}%` }}>
          <span className="ex-ann-text"><b>Iowa</b> — open seat, R+0.7 · the tightest seat on the board</span>
          <span className="ex-ann-line" />
        </span>
      )}
      <span className="ex-big ex-big-pair"><b style={{ color: FC_BLUE }}>{d}</b><span>–</span><b style={{ color: FC_RED }}>{r}</b><i>projected balance</i></span>
    </span>
  );
}

/* 03 — approval: a huge net numeral over the diverging lines. */
function ApprovalExhibit({ stats }: PreviewProps) {
  const a = stats?.approval;
  return (
    <span className="ex-stage ex-stage-cell">
      <span className="ex-cellbig" style={{ color: PG_MAGENTA }}>{a ? (a.net > 0 ? "+" : "−") + Math.abs(a.net).toFixed(0) : ""}</span>
      <span className="ex-cellsub">{a ? `${a.approve.toFixed(0)} approve · ${a.disapprove.toFixed(0)} disapprove` : ""}</span>
      <span className="ex-chart ex-chart-mini ex-fade-x">
        {a && <DualChart daily={a.daily} colA={PG_GREEN} colB={PG_MAGENTA} yPad={2} strokeW={2.2} ends="text" endA="App" endB="Dis" />}
      </span>
    </span>
  );
}

/* 04 — live results: the Iowa replay as quiet editorial rows. */
function ResultsExhibit() {
  return (
    <span className="ex-stage ex-stage-cell">
      <span className="ex-cellhead">Iowa Governor<i>’22 replay · 100% in</i></span>
      <span className="ex-rows">
        {RESULTS.rows.map((row, i) => (
          <span className="ex-row" key={row.name}>
            <span className="ex-row-name">{row.name}{i === 0 && <em>✓</em>}</span>
            <span className="ex-row-bar ex-fade-r"><i style={{ width: `${row.pct}%`, background: row.color, opacity: i === 0 ? 0.95 : 0.5 }} /></span>
            <b className="ex-row-pct" style={{ opacity: i === 0 ? 1 : 0.55 }}>{row.pct.toFixed(1)}</b>
          </span>
        ))}
      </span>
      <span className="ex-cellsub">certified result · 1,989 of 1,989 precincts</span>
    </span>
  );
}

/* 05 — electoral map: geography feathered into the dark, the 270 line below. */
function MapExhibit() {
  const tot = EV.d + EV.t + EV.r;
  return (
    <span className="ex-stage ex-stage-cell">
      <span className="ex-wash" style={{ background: "radial-gradient(60% 70% at 50% 40%, rgba(141,127,214,0.055), transparent 72%)" }} />
      <span className="ex-map ex-fade">{<HeroElectoralMap />}</span>
      <span className="ex-evwrap">
        <span className="ex-evtick" style={{ left: `${(270 / tot) * 100}%` }}><i />270</span>
        <span className="ex-evbar">
          <i style={{ width: `${(EV.d / tot) * 100}%`, background: FC_BLUE }} />
          <i style={{ width: `${(EV.t / tot) * 100}%`, background: "rgba(244,244,239,0.14)" }} />
          <i style={{ width: `${(EV.r / tot) * 100}%`, background: FC_RED }} />
        </span>
        <span className="ex-evcaps"><b style={{ color: FC_BLUE }}>{EV.d}</b><span>{EV.t} open</span><b style={{ color: FC_RED }}>{EV.r}</b></span>
      </span>
    </span>
  );
}

/* 06 — tpsi field poll: the LA mayor ballot, bars feathering rightward. */
function TpsiExhibit() {
  const max = BALLOT[0].pct;
  return (
    <span className="ex-stage ex-stage-cell">
      <span className="ex-cellbig" style={{ color: PG_BLUE, fontSize: "clamp(40px, 3.4vw, 58px)" }}>B+18.8</span>
      <span className="ex-cellsub">Los Angeles Mayor · likely voters, leaners allocated</span>
      <span className="ex-rows ex-rows-tight">
        {BALLOT.slice(0, 4).map((b, i) => (
          <span className="ex-row" key={b.name}>
            <span className="ex-row-name">{b.name}</span>
            <span className="ex-row-bar ex-fade-r"><i style={{ width: `${(b.pct / max) * 100}%`, background: i === 0 ? PG_BLUE : i === 1 ? PG_RED : i === 2 ? "#b98cff" : "rgba(244,244,239,0.22)", opacity: i === 0 ? 0.95 : 0.65 }} /></span>
            <b className="ex-row-pct" style={{ opacity: i === 0 ? 1 : 0.55 }}>{b.pct.toFixed(1)}</b>
          </span>
        ))}
      </span>
    </span>
  );
}

function DeskWall({ stats }: { stats: HomeStats | null }) {
  const { ref, armed } = useArmed(0.06);
  const wallRef = useRef<HTMLDivElement | null>(null);
  const [days, setDays] = useState(150);

  useEffect(() => {
    const r = requestAnimationFrame(() => setDays(Math.max(0, Math.round((Date.parse("2026-11-03T00:00:00") - Date.now()) / 86400000))));
    return () => cancelAnimationFrame(r);
  }, []);

  // one scroll-driven progress var; exhibits drift at their own depths
  useEffect(() => {
    const wall = wallRef.current;
    if (!wall) return;
    const update = () => {
      const rect = wall.getBoundingClientRect();
      const vh = Math.max(window.innerHeight, 1);
      const p = Math.max(0, Math.min(1, (vh - rect.top) / (vh + rect.height)));
      wall.style.setProperty("--p", p.toFixed(4));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);

  const dv = useCountUp(days, armed, 0);

  return (
    <section className={`dk${armed ? " is-in" : ""}`} aria-label="The state of the play">
      <div className="dk-shell" ref={ref}>
        <div className="dk-headrow">
          <div>
            <div className="dk-eyebrow"><span aria-hidden="true" />Inside the desk</div>
            <h2 className="dk-title">The state of the play.</h2>
          </div>
          <div className="dk-live"><i aria-hidden="true" />updated daily · <b>{dv}</b> days to the midterms</div>
        </div>

        <div className="xw" ref={wallRef}>
          <ExhibitFrame idx="01" title="Polling averages" sub={`national generic ballot · ${stats?.generic.count ?? "—"} polls`} href="/polling/genericballot" cta="Open the tracker" depth={-8}>
            <BallotExhibit stats={stats} />
          </ExhibitFrame>

          <ExhibitFrame idx="02" title="Race ratings" sub="2026 senate · all 35 seats, modeled nightly" href="/forecastratings" cta="See the ratings" depth={10}>
            <SenateExhibit />
          </ExhibitFrame>

          <div className="xw-duo">
            <ExhibitFrame idx="03" title="Trump approval" sub="every public poll" href="/polling/donaldtrumpapproval" cta="Open" depth={-6}>
              <ApprovalExhibit stats={stats} />
            </ExhibitFrame>
            <span className="xw-div" aria-hidden="true" />
            <ExhibitFrame idx="04" title="Live results" sub="election night, replayed" href="/results" cta="Open" depth={8}>
              <ResultsExhibit />
            </ExhibitFrame>
          </div>

          <div className="xw-duo">
            <ExhibitFrame idx="05" title="Electoral map" sub="2024 base · 7 battlegrounds open" href="/electoralmap" cta="Open" depth={9}>
              <MapExhibit />
            </ExhibitFrame>
            <span className="xw-div" aria-hidden="true" />
            <ExhibitFrame idx="06" title="TPSI poll" sub="our own field research" href="/tpsipoll" cta="Read" depth={-7}>
              <TpsiExhibit />
            </ExhibitFrame>
          </div>
        </div>
      </div>
    </section>
  );
}


// ─── Horizon footer — curved gradient wave + rotating wordmark ───────────────
function HorizonFooter() {
  const ref = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      const r = requestAnimationFrame(() => setArmed(true));
      return () => cancelAnimationFrame(r);
    }
    const o = new IntersectionObserver(
      (es) => es.forEach((e) => { if (e.isIntersecting) { setArmed(true); o.disconnect(); } }),
      { threshold: 0.4 },
    );
    o.observe(node);
    return () => o.disconnect();
  }, []);

  return (
    <section className={`ft${armed ? " is-on" : ""}`} ref={ref} aria-label="Work with the desk">
      <div className="ft-backdrop" aria-hidden="true" />
      <div className="ft-vignette" aria-hidden="true" />

      <div className="ft-pane">
        <div className="ft-split">
          <div className="ft-side-l">
            <div className="ft-kicker"><span className="ft-dot" aria-hidden="true" />The Public Sentiment Institute</div>
            <h2 className="ft-headline">Work with<br />the <span className="ft-cyc">desk</span>.</h2>
            <p className="ft-sub">Polling, forecasts, and election night intelligence for teams that need the call right, not just first.</p>
          </div>
          <div className="ft-side-r">
            <div className="ft-rlab">Start a conversation</div>
            <a className="ft-cta" href="mailto:tpsinstitutecontact@gmail.com">
              Email the desk <span className="ft-arw" aria-hidden="true">&rarr;</span>
            </a>
            <div className="ft-cta-addr">
              <a href="mailto:tpsinstitutecontact@gmail.com">tpsinstitutecontact@gmail.com</a>
            </div>
            <div className="ft-cta-note">Typical reply within<br />one business day</div>
          </div>
        </div>
      </div>

      <div className="ft-rfoot">
        <span className="ft-logo" aria-label="The Public Sentiment Institute" />
        <nav className="ft-links2" aria-label="Footer">
          <Link href="/polling">Polling</Link>
          <Link href="/forecastratings">Forecasts</Link>
          <Link href="/results">Results</Link>
          <Link href="/contact">Contact</Link>
        </nav>
        <div className="ft-copy">&copy; 2026 The Public Sentiment Institute &middot; Florida</div>
      </div>
    </section>
  );
}

// ─── Narrative camera — the statement as a filmed typographic stage ──────────
const CAM_END = 0.62;   // pan word-by-word — ~7vh of scroll per word
const ZOOM_END = 0.72;  // pull back to the full statement
const NARR_PHRASES = [
  "We believe that every voice carries a signal.",
  "Most research misses those voices.",
  "The Public Sentiment Institute is built to find it —",
  "in the data beneath the data,",
  "in the areas others overlook,",
  "asking the tough questions other researchers won’t.",
];
const NARR_WORDS_PER = NARR_PHRASES.map((p) => p.split(" ").length);
const NARR_TOTAL_WORDS = NARR_WORDS_PER.reduce((a, b) => a + b, 0);
const NARR_OFFSETS = NARR_WORDS_PER.map((_, i) => NARR_WORDS_PER.slice(0, i).reduce((a, b) => a + b, 0));

export default function HomePage() {
  const [openFaq, setOpenFaq] = useState(0);
  const [stats, setStats] = useState<HomeStats | null>(null);

  // Run the weighted model off the critical path; everything that quotes a
  // number reads from this one computation.
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    const run = () => setStats(getHomeStats());
    if (w.requestIdleCallback) w.requestIdleCallback(run);
    else window.setTimeout(run, 1);
  }, []);

  const proofRef = useRef<HTMLDivElement | null>(null);
  const [proofProgress, setProofProgress] = useState(0);
  const [narrativeProgress, setNarrativeProgress] = useState(0);
  const narrativeRef = useRef<HTMLDivElement | null>(null);
  const camStageRef = useRef<HTMLDivElement | null>(null);
  const camVpRef = useRef<HTMLDivElement | null>(null);
  const camAnchorsRef = useRef<{ x: number; y: number }[]>([]);
  const camSizeRef = useRef({ w: 1, h: 1 });
  const camNpRef = useRef(0);
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const proofLetterProgress = clamp01(proofProgress / 0.72);
  const proofSettle = clamp01((proofProgress - 0.72) / 0.2);
  const proofFade = clamp01((proofProgress - 0.88) / 0.12);
  const proofStyle = {
    "--proof-lift": `${Math.round(proofSettle * -132)}px`,
    "--proof-scale": String(1 - proofSettle * 0.08),
    "--proof-grid-y": `${Math.round(46 - proofSettle * 46)}px`,
    opacity: 1 - proofFade,
  } as React.CSSProperties;

  const applyCam = (npNow: number) => {
    const stage = camStageRef.current;
    const vp = camVpRef.current;
    if (!stage || !vp) return;
    const desktop = window.innerWidth > 980 && !prefersReduced();
    if (!desktop) {
      stage.style.transform = "none";
      vp.style.setProperty("--vg", "0");
      return;
    }
    const A = camAnchorsRef.current;
    if (!A.length) return;
    const { w: sw, h: sh } = camSizeRef.current;
    const vw = window.innerWidth, vh = window.innerHeight;
    const fit = Math.min((vw - 150) / sw, (vh - 220) / sh, 1);
    const ss = (t: number) => t * t * (3 - 2 * t);
    let x: number, y: number, sc: number, vg: number;
    if (npNow <= CAM_END) {
      const t = (npNow / CAM_END) * (A.length - 1);
      const i = Math.max(0, Math.min(A.length - 2, Math.floor(t)));
      const f = ss(Math.max(0, Math.min(1, t - i)));
      x = A[i].x + (A[i + 1].x - A[i].x) * f;
      y = A[i].y + (A[i + 1].y - A[i].y) * f;
      sc = 3.05 - 0.3 * (npNow / CAM_END);
      vg = 1;
    } else if (npNow <= ZOOM_END) {
      const u = ss((npNow - CAM_END) / (ZOOM_END - CAM_END));
      const last = A[A.length - 1];
      x = last.x + (sw / 2 - last.x) * u;
      y = last.y + (sh / 2 - last.y) * u;
      sc = 2.75 + (fit - 2.75) * u;
      vg = 1 - u;
    } else {
      x = sw / 2; y = sh / 2; sc = fit; vg = 0;
    }
    stage.style.transform = `translate3d(${(vw / 2 - x * sc).toFixed(2)}px, ${(vh / 2 - y * sc).toFixed(2)}px, 0) scale(${sc.toFixed(4)})`;
    vp.style.setProperty("--vg", vg.toFixed(3));
  };
  const applyCamRef = useRef(applyCam);
  useEffect(() => { applyCamRef.current = applyCam; });

  useEffect(() => {
    const measure = () => {
      const stage = camStageRef.current;
      if (!stage) return;
      const prev = stage.style.transform;
      stage.style.transform = "none";
      const stageRect = stage.getBoundingClientRect();
      camSizeRef.current = { w: stage.offsetWidth, h: stage.offsetHeight };
      camAnchorsRef.current = Array.from(stage.querySelectorAll<HTMLElement>(".cam-w")).map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - stageRect.left + r.width / 2, y: r.top - stageRect.top + r.height / 2 };
      });
      stage.style.transform = prev;
      applyCamRef.current(camNpRef.current);
    };
    measure();
    if (typeof document !== "undefined" && "fonts" in document) {
      (document as Document & { fonts: { ready: Promise<unknown> } }).fonts.ready.then(() => measure());
    }
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Cinematic narrative beats — all driven by scroll position so scroll-up rewinds.
  const np = narrativeProgress;
  const narr2In = clamp01(np / 0.025);
  const narr2Out = clamp01((np - 0.765) / 0.05);
  const narr2Opacity = Math.max(0, narr2In - narr2Out);
  const camWp = clamp01(np / CAM_END) * (NARR_TOTAL_WORDS - 1);
  const camNowIdx = Math.floor(camWp);
  const camRevealed = np > CAM_END + 0.015;
  const narr3In = clamp01((np - 0.81) / 0.07);
  const narr3Opacity = narr3In;
  const narr3Y = (1 - narr3In) * 24;
  const whiteT = clamp01((np - 0.88) / 0.1);
  const mixChannel = (from: number, to: number) => Math.round(from + (to - from) * whiteT);
  const narrativeBg = `rgb(${mixChannel(5, 244)}, ${mixChannel(5, 244)}, ${mixChannel(5, 239)})`;
  const narr3Color = `rgb(${mixChannel(244, 10)}, ${mixChannel(244, 10)}, ${mixChannel(239, 10)})`;

  useEffect(() => {
    const updateProofProgress = () => {
      const node = proofRef.current;
      if (!node) return;

      const rect = node.getBoundingClientRect();
      const viewportHeight = Math.max(window.innerHeight, 1);
      const scrollableDistance = Math.max(node.offsetHeight - viewportHeight, 1);
      const nextProgress = Math.max(0, Math.min(1, -rect.top / scrollableDistance));

      setProofProgress((current) =>
        Math.abs(current - nextProgress) > 0.006 ? nextProgress : current,
      );

      const narrativeNode = narrativeRef.current;
      if (narrativeNode) {
        const narrativeRect = narrativeNode.getBoundingClientRect();
        const narrativeScrollable = Math.max(narrativeNode.offsetHeight - viewportHeight, 1);
        const narrativeNext = Math.max(0, Math.min(1, -narrativeRect.top / narrativeScrollable));
        camNpRef.current = narrativeNext;
        applyCamRef.current(narrativeNext);
        setNarrativeProgress((current) =>
          Math.abs(current - narrativeNext) > 0.004 ? narrativeNext : current,
        );

      }
    };

    updateProofProgress();
    window.addEventListener("scroll", updateProofProgress, { passive: true });
    window.addEventListener("resize", updateProofProgress);

    return () => {
      window.removeEventListener("scroll", updateProofProgress);
      window.removeEventListener("resize", updateProofProgress);
    };
  }, []);


  return (
    <>
      <style>{`
        body {
          background: #050505 !important;
          color: #f4f4ef;
          overflow-x: clip;
        }

        body header,
        body footer {
          display: none !important;
        }

        body main > div {
          max-width: none !important;
          padding-left: 0 !important;
          padding-right: 0 !important;
        }

        body main > div > div {
          padding-top: 0 !important;
          padding-bottom: 0 !important;
          animation: none !important;
        }

        .lp-root {
          min-height: 100vh;
          overflow-x: clip;
          background: #050505;
          color: #f4f4ef;
          font-family: var(--font-body);
          letter-spacing: -0.01em;
        }

        .lp-root h1,
        .lp-root h2,
        .lp-root h3,
        .lp-root h4 {
          font-family: var(--font-display);
          text-transform: none;
        }

        .lp-root p,
        .lp-root a,
        .lp-root button {
          font-family: var(--font-body);
          text-transform: none;
        }

        .lp-root h1,
        .lp-root h2,
        .lp-root h3,
        .lp-root h4 {
          color: #f4f4ef;
        }

        .lp-root ul,
        .lp-root li {
          color: inherit;
        }

        .lp-shell {
          width: min(1100px, calc(100vw - 160px));
          margin: 0 auto;
        }

        /* ── Hero — full-viewport Game-of-Life shader stage ── */
        .lp-hero {
          position: relative;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 110px 0 120px;
          overflow: hidden;
          /* fallback grade if WebGL2 is unavailable */
          background:
            radial-gradient(110% 90% at 30% 40%, #150b2e 0%, #0a0618 48%, #050505 100%);
        }

        .lp-hero:before {
          content: none;
        }

        .lp-hero-glass {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          display: block;
          z-index: 0;
          animation: lp-life-in 1.4s ease 0.15s both;
        }

        @keyframes lp-life-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .lp-hero-blooms {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          mix-blend-mode: screen;
          background:
            radial-gradient(40% 50% at 82% 20%, rgba(63,96,232,.30), transparent 70%),
            radial-gradient(36% 44% at 10% 40%, rgba(210,73,75,.20), transparent 70%),
            radial-gradient(34% 40% at 60% 96%, rgba(109,62,233,.24), transparent 72%);
        }

        .lp-hero-veil {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background:
            linear-gradient(180deg, rgba(5, 5, 5, 0.45), transparent 18%),
            linear-gradient(180deg, transparent 62%, rgba(5, 5, 5, 0.5) 88%, #050505 100%),
            radial-gradient(86% 64% at 50% 54%, rgba(5, 4, 9, 0.62) 0%, rgba(5, 4, 9, 0.34) 46%, rgba(5, 4, 9, 0.04) 74%, transparent 88%);
        }

        .lp-hero-inner {
          position: relative;
          z-index: 2;
          width: min(1240px, calc(100vw - 120px));
        }

        .lp-hero-nav {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          z-index: 6;
          padding-top: 10px;
          background: linear-gradient(180deg, rgba(5, 5, 5, 0.46), transparent);
        }

        .lp-hero-nav-in {
          width: min(1240px, calc(100vw - 120px));
          margin: 0 auto;
        }

        .lp-hero-foot {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 26px;
          z-index: 2;
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: min(1100px, calc(100vw - 160px));
          margin: 0 auto;
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 1.6px;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.4);
        }

        .lp-hero-scroll {
          display: inline-flex;
          align-items: center;
          gap: 12px;
        }

        .lp-hero-scroll i {
          position: relative;
          width: 1px;
          height: 34px;
          background: rgba(244, 244, 239, 0.18);
          overflow: hidden;
        }

        .lp-hero-scroll i:after {
          content: "";
          position: absolute;
          left: 0;
          top: -50%;
          width: 100%;
          height: 50%;
          background: rgba(244, 244, 239, 0.7);
          animation: lp-scroll-drip 2.2s cubic-bezier(.65,0,.35,1) infinite;
        }

        @keyframes lp-scroll-drip {
          to { top: 100%; }
        }

        .lp-hero-sim b {
          color: rgba(244, 244, 239, 0.75);
          font-weight: 650;
        }

        .lp-nav {
          display: none;
        }

        .lp-topbar {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 70;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          height: 56px;
          padding: 0 16px 0 18px;
          background: rgba(5, 5, 5, 0.66);
          backdrop-filter: blur(20px) saturate(1.4);
          -webkit-backdrop-filter: blur(20px) saturate(1.4);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-topbar-brand {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }

        .lp-topbar-brand .lp-brand-logo {
          width: 112px;
          height: 24px;
        }

        .lp-burger {
          position: relative;
          width: 42px;
          height: 42px;
          border: 1px solid rgba(255, 255, 255, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          cursor: pointer;
          -webkit-tap-highlight-color: transparent;
          transition: background 180ms ease, border-color 180ms ease;
        }

        .lp-burger:active {
          background: rgba(255, 255, 255, 0.12);
        }

        .lp-burger span {
          position: relative;
          display: block;
          width: 17px;
          height: 1.6px;
          border-radius: 999px;
          background: #f4f4ef;
          transition: background 160ms ease;
        }

        .lp-burger span:before,
        .lp-burger span:after {
          content: "";
          position: absolute;
          left: 0;
          width: 17px;
          height: 1.6px;
          border-radius: 999px;
          background: #f4f4ef;
          transition: transform 280ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-burger span:before { top: -5.5px; }
        .lp-burger span:after { top: 5.5px; }

        .lp-burger.is-open span {
          background: transparent;
        }

        .lp-burger.is-open span:before {
          transform: translateY(5.5px) rotate(45deg);
        }

        .lp-burger.is-open span:after {
          transform: translateY(-5.5px) rotate(-45deg);
        }

        .lp-menu-scrim {
          position: fixed;
          inset: 0;
          z-index: 58;
          background: rgba(5, 5, 5, 0.5);
          opacity: 0;
          pointer-events: none;
          transition: opacity 240ms ease;
        }

        .lp-menu-scrim.is-open {
          opacity: 1;
          pointer-events: auto;
        }

        .lp-mobile-menu {
          display: none;
          position: fixed;
          top: 64px;
          left: 10px;
          right: 10px;
          z-index: 65;
          flex-direction: column;
          max-height: calc(100svh - 82px);
          overflow-y: auto;
          padding: 7px;
          border-radius: 18px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          background: rgba(13, 13, 13, 0.96);
          backdrop-filter: blur(26px) saturate(1.3);
          -webkit-backdrop-filter: blur(26px) saturate(1.3);
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.6);
          opacity: 0;
          visibility: hidden;
          pointer-events: none;
          transform: translateY(-10px) scale(0.97);
          transform-origin: top center;
          transition: opacity 220ms ease, transform 300ms cubic-bezier(.2,.8,.2,1), visibility 0ms linear 240ms;
        }

        .lp-mobile-menu.is-open {
          opacity: 1;
          visibility: visible;
          pointer-events: auto;
          transform: translateY(0) scale(1);
          transition: opacity 220ms ease, transform 320ms cubic-bezier(.2,.8,.2,1), visibility 0ms;
        }

        .lp-mobile-menu-list {
          display: flex;
          flex-direction: column;
          gap: 1px;
        }

        .lp-mobile-menu-list a {
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr) auto;
          align-items: center;
          gap: 12px;
          padding: 12px 13px;
          border-radius: 12px;
          color: #f4f4ef;
          text-decoration: none;
          font-size: 16px;
          font-weight: 600;
          letter-spacing: -0.1px;
          opacity: 0;
          transform: translateY(8px);
          transition: background 160ms ease, color 160ms ease;
        }

        .lp-mobile-menu.is-open .lp-mobile-menu-list a {
          animation: lp-menu-item 340ms cubic-bezier(.2,.8,.2,1) forwards;
        }

        .lp-mobile-menu-list a:hover,
        .lp-mobile-menu-list a:active,
        .lp-mobile-menu-list a:focus-visible {
          background: rgba(255, 255, 255, 0.07);
        }

        .lp-mobile-menu-list a:active .arw {
          transform: translateX(3px);
        }

        .lp-mobile-menu-list .idx {
          font-size: 11px;
          font-weight: 700;
          color: rgba(244, 244, 239, 0.32);
          letter-spacing: 0;
          font-variant-numeric: tabular-nums;
        }

        .lp-mobile-menu-list .arw {
          color: #6d3ee9;
          font-size: 15px;
          font-weight: 700;
          transition: transform 200ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-mobile-menu-foot {
          margin-top: 5px;
          padding: 13px 13px 6px;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
        }

        .lp-mobile-menu-foot a {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: rgba(244, 244, 239, 0.64);
          text-decoration: none;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 0.2px;
        }

        @keyframes lp-menu-item {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* ---- Desktop nav — free elements over a progressive-blur top edge ---- */
        .lp-desktop-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 70;
          display: flex;
          align-items: center;
          gap: 18px;
          padding: 22px clamp(28px, 4vw, 60px) 18px;
          pointer-events: none;
        }

        .lp-desktop-nav > * {
          pointer-events: auto;
        }

        /* the frosted edge — content blurs as it slides under the nav, no box */
        .lp-desktop-nav:before {
          content: "";
          position: absolute;
          inset: 0 0 -34px 0;
          z-index: -1;
          pointer-events: none;
          -webkit-backdrop-filter: blur(16px) saturate(1.3);
          backdrop-filter: blur(16px) saturate(1.3);
          -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 46%, transparent 100%);
          mask-image: linear-gradient(180deg, #000 0%, #000 46%, transparent 100%);
          background: linear-gradient(180deg, rgba(5, 5, 5, 0.42), rgba(5, 5, 5, 0.05) 70%, transparent);
        }

        .lp-desktop-brand {
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }

        .lp-brand-logo {
          display: block;
          width: 116px;
          height: 25px;
          background: #f4f4ef;
          -webkit-mask: url(/full_logo_clean.png) left center / contain no-repeat;
          mask: url(/full_logo_clean.png) left center / contain no-repeat;
          transition: opacity 200ms ease, background 280ms ease;
        }

        .lp-desktop-brand:hover .lp-brand-logo {
          opacity: 0.8;
        }

        /* live reading — free element, no casing */
        .lp-nav-live {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          font-size: 12.5px;
          font-weight: 650;
          letter-spacing: 0.2px;
          font-variant-numeric: tabular-nums;
          color: rgba(138, 163, 242, 0.95);
          text-decoration: none;
          transition: color 200ms ease;
        }

        .lp-nav-live i {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: var(--brand-grad);
          animation: lp-dot-pulse 2.4s ease-in-out infinite;
        }

        .lp-nav-live:hover {
          color: #aabcf5;
        }

        .lp-nav-sep {
          display: none;
        }

        .lp-desktop-links {
          display: flex;
          align-items: center;
          gap: clamp(26px, 2.6vw, 40px);
          margin-left: auto;
        }

        .lp-desknav-item {
          position: relative;
          display: inline-flex;
          align-items: center;
          padding: 6px 0;
          background: none;
          border: 0;
          font: inherit;
          font-size: 14px;
          font-weight: 580;
          letter-spacing: -0.005em;
          color: rgba(244, 244, 239, 0.72);
          text-decoration: none;
          cursor: pointer;
          transition: color 200ms ease;
        }

        .lp-desknav-item:after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          height: 1px;
          background: rgba(244, 244, 239, 0.85);
          transform: scaleX(0);
          transform-origin: left center;
          transition: transform 300ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-desknav-item:hover {
          color: #f4f4ef;
        }

        .lp-desknav-item.is-open {
          color: #f4f4ef;
        }

        .lp-desknav-item.is-open:after {
          transform: scaleX(1);
        }

        /* The strip — a full-width glass band sliding from under the nav */
        .lp-navstrip {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          z-index: 69;
          padding: 70px 0 0;
          transform: translateY(-101%);
          visibility: hidden;
          pointer-events: none;
          transition: transform 360ms cubic-bezier(.2, .8, .2, 1), visibility 0ms linear 360ms;
        }

        .lp-navstrip.is-open {
          transform: translateY(0);
          visibility: visible;
          pointer-events: auto;
          transition: transform 420ms cubic-bezier(.16, 1, .3, 1), visibility 0ms;
        }

        .lp-navstrip-band {
          border-top: 1px solid rgba(244, 244, 239, 0.07);
          border-bottom: 1px solid rgba(244, 244, 239, 0.09);
          background: rgba(8, 8, 11, 0.58);
          -webkit-backdrop-filter: blur(26px) saturate(1.5);
          backdrop-filter: blur(26px) saturate(1.5);
          box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 24px 60px rgba(0, 0, 0, 0.4);
        }

        .lp-navstrip-row {
          display: flex;
          align-items: stretch;
          width: min(1240px, calc(100vw - 96px));
          margin: 0 auto;
        }

        .lp-navstrip-item {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 6px;
          min-width: 0;
          padding: 18px 22px;
          color: #f4f4ef;
          text-decoration: none;
          transition: background 180ms ease;
        }

        .lp-navstrip-item + .lp-navstrip-item {
          border-left: 1px solid rgba(244, 244, 239, 0.07);
        }

        .lp-navstrip-item:hover {
          background: rgba(244, 244, 239, 0.05);
        }

        .lp-navstrip-idx {
          font-size: 10px;
          font-weight: 650;
          letter-spacing: 1px;
          color: rgba(244, 244, 239, 0.32);
          font-variant-numeric: tabular-nums;
        }

        .lp-navstrip-label {
          font-size: 13.5px;
          font-weight: 600;
          letter-spacing: -0.005em;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .lp-navstrip-item b {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 650;
          font-variant-numeric: tabular-nums;
          letter-spacing: 0.2px;
        }

        .lp-navstrip-dot {
          width: 5px;
          height: 5px;
          border-radius: 999px;
          background: var(--brand-grad);
          animation: lp-dot-pulse 2s infinite;
        }

        .lp-navstrip-cell {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 21px 16px;
          color: rgba(244, 244, 239, 0.75);
          text-decoration: none;
          font-size: 13px;
          font-weight: 580;
          white-space: nowrap;
          transition: background 180ms ease, color 180ms ease;
        }

        .lp-navstrip-cell + .lp-navstrip-cell {
          border-left: 1px solid rgba(244, 244, 239, 0.07);
        }

        .lp-navstrip-cell:hover {
          background: rgba(244, 244, 239, 0.05);
          color: #f4f4ef;
        }

        .lp-navstrip.is-light .lp-navstrip-band {
          background: rgba(244, 244, 239, 0.72);
          border-color: rgba(10, 10, 10, 0.08);
        }

        .lp-navstrip.is-light .lp-navstrip-item,
        .lp-navstrip.is-light .lp-navstrip-cell {
          color: rgba(10, 10, 10, 0.85);
        }

        .lp-navstrip.is-light .lp-navstrip-item:hover,
        .lp-navstrip.is-light .lp-navstrip-cell:hover {
          background: rgba(10, 10, 10, 0.05);
        }


        .lp-wordmark {
          display: inline-flex;
          align-items: center;
          gap: 13px;
          color: inherit;
          text-decoration: none;
          font-size: 34px;
          font-weight: 780;
          letter-spacing: 0;
          line-height: 1;
        }

        .lp-wordmark:hover {
          text-decoration: none;
        }

        .lp-wordmark span {
          font-size: 13px;
          font-weight: 720;
          letter-spacing: 0;
          line-height: 1.04;
          max-width: 96px;
        }

        .lp-nav-links {
          display: flex;
          align-items: center;
          gap: 22px;
          font-size: 14px;
          color: rgba(244, 244, 239, 0.58);
        }

        .lp-nav-links a {
          color: inherit;
          text-decoration: none;
          transition: color 180ms ease, transform 180ms ease;
        }

        .lp-nav-links a:hover {
          color: #f4f4ef;
          transform: translateY(-1px);
          text-decoration: none;
        }

        .lp-hero-copy {
          position: relative;
          width: min(780px, 100%);
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
          animation: lp-rise 720ms cubic-bezier(.2,.8,.2,1) both;
        }

        .lp-hero-eyebrow {
          display: flex;
          align-items: center;
          gap: 11px;
          margin-bottom: 22px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.4);
        }

        .lp-hero-eyebrow-live {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          color: var(--live);
        }

        .lp-hero-eyebrow-live i {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--live);
          box-shadow: 0 0 10px var(--live);
          animation: lp-eyebrow-pulse 1.8s infinite;
        }

        @keyframes lp-eyebrow-pulse { 50% { opacity: 0.35; } }

        .lp-hero h1 {
          margin: 0;
          max-width: 17ch;
          font-family: var(--font-display), system-ui, sans-serif;
          font-size: clamp(38px, 6.4vw, 84px);
          line-height: 0.98;
          letter-spacing: -0.03em;
          font-weight: 700;
          color: #f4f4ef;
          text-shadow: 0 2px 50px rgba(0, 0, 0, 0.55);
          text-wrap: balance;
        }

        .lp-hero h1 .g {
          color: transparent;
          background: var(--brand-grad);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .lp-hero p {
          margin: 22px 0 0;
          max-width: 44ch;
          font-size: clamp(15px, 1.7vw, 19px);
          line-height: 1.5;
          letter-spacing: 0;
          color: rgba(244, 244, 239, 0.64);
          font-weight: 420;
          text-shadow: 0 1px 30px rgba(5, 4, 9, 0.65);
          text-wrap: balance;
        }

        .lp-actions {
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 20px;
          margin-top: 32px;
          flex-wrap: wrap;
        }

        /* Buttons — layered like real product UI, not flat fills */
        .lp-pill {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 15px 28px;
          border-radius: 999px;
          border: 0;
          background: linear-gradient(180deg, #ffffff 0%, #ececE4 100%);
          color: #0b0a14;
          text-decoration: none;
          font-size: 15.5px;
          font-weight: 640;
          letter-spacing: -0.01em;
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.6),
            inset 0 -8px 20px rgba(109, 62, 233, 0.18),
            0 14px 34px rgba(0, 0, 0, 0.4);
          transition: transform 240ms cubic-bezier(.2,.8,.2,1), box-shadow 260ms ease, background 220ms ease;
        }

        .lp-pill i {
          font-style: normal;
          font-weight: 600;
          transition: transform 240ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-pill:hover {
          transform: translateY(-2px);
          text-decoration: none;
        }

        .lp-pill:hover i {
          transform: translateX(4px);
        }

        .lp-pill:active {
          transform: translateY(0) scale(0.985);
        }

        .lp-pill:focus-visible {
          outline: 2px solid #6d3ee9;
          outline-offset: 3px;
        }

        .lp-pill-dark {
          background: rgba(255, 255, 255, 0.06);
          color: #f4f4ef;
          border: 1px solid rgba(255, 255, 255, 0.16);
          -webkit-backdrop-filter: blur(14px);
          backdrop-filter: blur(14px);
          box-shadow: none;
        }

        .lp-pill-dark:hover {
          background: rgba(255, 255, 255, 0.1);
          box-shadow: none;
        }

        .lp-dot {
          position: relative;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #f4f4ef;
          margin-left: 18px;
          animation: lp-dot-pulse 2.8s ease-in-out infinite;
        }

        .lp-dot:before {
          content: none;
        }

        .lp-dot:after {
          content: none;
        }

        .lp-gallery-band {
          border-top: 1px solid rgba(255, 255, 255, 0.09);
          border-bottom: 1px solid rgba(255, 255, 255, 0.09);
          padding: 30px 0 38px;
          background: #050505;
        }

        .lp-gallery-window {
          width: 100%;
          overflow: hidden;
          position: relative;
        }

        .lp-gallery-window:before,
        .lp-gallery-window:after {
          content: "";
          position: absolute;
          z-index: 4;
          top: 0;
          bottom: 0;
          width: min(17vw, 230px);
          pointer-events: none;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }

        .lp-gallery-window:before {
          left: 0;
          background: linear-gradient(90deg, #050505 0%, #050505 24%, rgba(5, 5, 5, 0.6) 58%, transparent 100%);
          -webkit-mask-image: linear-gradient(90deg, #000 0%, #000 46%, transparent 100%);
          mask-image: linear-gradient(90deg, #000 0%, #000 46%, transparent 100%);
        }

        .lp-gallery-window:after {
          right: 0;
          background: linear-gradient(270deg, #050505 0%, #050505 24%, rgba(5, 5, 5, 0.6) 58%, transparent 100%);
          -webkit-mask-image: linear-gradient(270deg, #000 0%, #000 46%, transparent 100%);
          mask-image: linear-gradient(270deg, #000 0%, #000 46%, transparent 100%);
        }

        .lp-gallery-track {
          display: flex;
          gap: 16px;
          margin-left: 24px;
          width: max-content;
          animation: lp-gallery-slide 72s linear infinite;
          will-change: transform;
        }

        .lp-gallery-window:hover .lp-gallery-track {
          animation-play-state: paused;
        }

        .lp-gallery-card {
          width: min(720px, 90vw);
          min-height: 0;
          display: flex;
          flex-direction: column;
          gap: 0;
          flex: 0 0 auto;
          padding: 0;
          border-radius: 10px;
          background: transparent;
          color: #f4f4ef;
          text-decoration: none;
          box-shadow: 0 24px 80px rgba(0, 0, 0, 0.48);
          border: 0;
          isolation: isolate;
          overflow: hidden;
          position: relative;
          transform: translateZ(0);
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), box-shadow 360ms cubic-bezier(.2,.8,.2,1), border-color 360ms ease;
        }

        .lp-gallery-card:before {
          content: none;
          position: absolute;
          inset: 0;
          z-index: 2;
          pointer-events: none;
          border-radius: inherit;
          box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.42);
        }

        .lp-gallery-card:after {
          content: "";
          position: absolute;
          z-index: 3;
          inset: -45% -25%;
          pointer-events: none;
          background: linear-gradient(110deg, transparent 35%, rgba(255,255,255,0.26) 48%, transparent 60%);
          transform: translateX(-70%) rotate(7deg);
          opacity: 0;
          transition: transform 700ms cubic-bezier(.2,.8,.2,1), opacity 260ms ease;
        }

        .lp-gallery-ratings,
        .lp-gallery-results,
        .lp-gallery-map {
          background: transparent;
          color: #f4f4ef;
        }

        .lp-gallery-card:hover {
          transform: translateY(-12px) rotate(-0.35deg) scale(1.014);
          box-shadow: 0 34px 100px rgba(0, 0, 0, 0.72), 0 0 42px rgba(255, 255, 255, 0.08);
          border-color: transparent;
          text-decoration: none;
        }

        .lp-gallery-ratings:hover {
          transform: translateY(-12px) rotate(0.35deg) scale(1.012);
        }

        .lp-gallery-results:hover {
          transform: translateY(-12px) rotate(-0.2deg) scale(1.012);
          box-shadow: 0 36px 90px rgba(0, 0, 0, 0.32);
        }

        .lp-gallery-card:hover:after {
          opacity: 1;
          transform: translateX(70%) rotate(7deg);
        }

        .lp-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          padding: 13px 16px 7px;
          min-height: 44px;
        }

        .lp-card-head h3 {
          margin: 0;
          font-size: 22px;
          letter-spacing: 0;
          font-weight: 660;
        }

        .lp-card-head span {
          color: #6d3ee9;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0;
          white-space: nowrap;
        }

        .lp-gallery-ratings .lp-card-head h3,
        .lp-gallery-ratings .lp-card-head span,
        .lp-gallery-results .lp-card-head h3 {
          color: #ffffff;
        }

        .lp-gallery-results .lp-card-head span {
          color: #6d3ee9;
        }

        .lp-gallery-map .lp-card-head span {
          color: #050505;
        }

        .lp-art {
          flex: 1;
          min-height: 376px;
          border-radius: 6px;
          padding: 26px;
          position: relative;
          overflow: hidden;
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), filter 360ms ease;
        }

        .lp-gallery-card:hover .lp-art {
          transform: translateY(-3px) scale(1.006);
        }

        .lp-art-thumbnail {
          aspect-ratio: 1672 / 941;
          flex: 0 0 auto;
          min-height: 0;
          padding: 0;
          border-radius: 10px;
          background: #050505;
          box-shadow: none;
        }

        .lp-art-thumbnail img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scale(1.002);
          transition: transform 520ms cubic-bezier(.2,.8,.2,1), filter 520ms ease;
        }

        .lp-gallery-card:hover .lp-art-thumbnail img {
          transform: scale(1.035);
          filter: contrast(1.06) saturate(1.04);
        }

        .lp-art-polling {
          background: #dededb;
          color: #0a0a0a;
          display: flex;
          flex-direction: column;
          gap: 18px;
        }

        .lp-art-polling:before {
          content: "PSI POLLING / NATIONAL TRACKER / MAY 30";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 30px;
          display: flex;
          align-items: center;
          padding-left: 18px;
          background: #050505;
          color: rgba(255, 255, 255, 0.72);
          font-size: 9px;
          font-weight: 760;
          letter-spacing: 0;
        }

        .lp-art-polling:after {
          content: "";
          position: absolute;
          width: 220px;
          height: 220px;
          right: -74px;
          top: 74px;
          border: 1px solid rgba(10, 10, 10, 0.13);
          border-radius: 999px;
          box-shadow: -92px 92px 0 -91px rgba(10, 10, 10, 0.38);
        }

        .lp-poll-chrome,
        .lp-poll-hero,
        .lp-map-title,
        .lp-rating-title {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
        }

        .lp-poll-chrome {
          margin-top: 20px;
          color: #666;
          font-size: 11px;
          font-weight: 650;
        }

        .lp-poll-hero strong,
        .lp-rating-title strong,
        .lp-map-title strong {
          display: block;
          font-size: 42px;
          line-height: 0.92;
          font-weight: 560;
        }

        .lp-poll-hero span,
        .lp-rating-title span,
        .lp-map-title span {
          display: block;
          margin-bottom: 6px;
          font-size: 12px;
          font-weight: 700;
        }

        .lp-poll-hero b {
          font-size: 68px;
          line-height: 0.85;
          font-weight: 520;
          transition: transform 360ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-card:hover .lp-poll-hero b {
          transform: translateX(-8px);
        }

        .lp-poll-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1fr) 148px;
          gap: 14px;
          align-items: stretch;
        }

        .lp-poll-chart-card {
          border-radius: 12px;
          background: #f8f8f5;
          padding: 16px;
          border: 1px solid rgba(10, 10, 10, 0.07);
          box-shadow: 0 14px 28px rgba(10, 10, 10, 0.045);
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), box-shadow 360ms ease;
        }

        .lp-gallery-card:hover .lp-poll-chart-card {
          transform: translateY(-4px);
          box-shadow: 0 22px 40px rgba(10, 10, 10, 0.08);
        }

        .lp-poll-source-stack {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 10px;
        }

        .lp-poll-source-stack span {
          width: 130px;
          border-radius: 999px;
          background: #f8f8f5;
          border: 1px solid rgba(10, 10, 10, 0.08);
          padding: 9px 12px;
          color: #555;
          font-size: 11px;
          font-weight: 650;
          transform: translateX(var(--source-offset));
          transition: transform 360ms cubic-bezier(.2,.8,.2,1), background 360ms ease;
        }

        .lp-gallery-card:hover .lp-poll-source-stack span {
          transform: translateX(calc(var(--source-offset) + 10px));
          background: #ffffff;
        }

        .lp-tabs {
          display: flex;
          gap: 6px;
          margin-bottom: 18px;
        }

        .lp-tabs span {
          padding: 8px 12px;
          border-radius: 7px;
          background: #e9e9e6;
          color: #6b6b6b;
          font-size: 10px;
          font-weight: 650;
        }

        .lp-tabs .is-active {
          background: #0a0a0a;
          color: #ffffff;
        }

        .lp-line-chart {
          width: 100%;
          height: 112px;
          overflow: visible;
        }

        .lp-line-chart .grid {
          fill: none;
          stroke: rgba(10, 10, 10, 0.09);
          stroke-width: 0.7;
        }

        .lp-line-chart .red,
        .lp-line-chart .blue {
          fill: none;
          stroke-width: 2.8;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 132;
          transition: stroke-dashoffset 620ms cubic-bezier(.2,.8,.2,1), stroke-width 260ms ease;
        }

        .lp-line-chart .red { stroke: #c22f3b; stroke-dashoffset: 16; }
        .lp-line-chart .blue { stroke: #1d5fc4; stroke-dashoffset: 8; }

        .lp-gallery-card:hover .lp-line-chart .red,
        .lp-gallery-card:hover .lp-line-chart .blue {
          stroke-dashoffset: 0;
          stroke-width: 3.4;
        }

        .lp-mini-stats {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          overflow: hidden;
          border-radius: 12px;
          background: rgba(10, 10, 10, 0.07);
          box-shadow: 0 12px 24px rgba(10, 10, 10, 0.04);
        }

        .lp-mini-stats span {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 13px 14px;
          background: #fbfbfa;
          color: #777;
          font-size: 11px;
        }

        .lp-art-ratings {
          background: #ff7a00;
          color: #ffffff;
          display: grid;
          grid-template-columns: 1fr 150px;
          grid-template-rows: auto auto 1fr;
          gap: 18px 20px;
          align-items: start;
        }

        .lp-art-ratings:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255,255,255,0.08) 1px, transparent 1px);
          background-size: 64px 64px;
          mask-image: linear-gradient(to bottom, transparent, black 18%, black 72%, transparent);
          opacity: 0.32;
        }

        .lp-art-ratings:after {
          content: "RATINGS";
          position: absolute;
          left: -8px;
          bottom: -28px;
          color: rgba(255, 255, 255, 0.14);
          font-size: 112px;
          line-height: 1;
          font-weight: 720;
        }

        .lp-rating-title {
          grid-column: 1 / 2;
          color: #ffffff;
          align-self: start;
          flex-direction: column;
          gap: 14px;
        }

        .lp-rating-title strong {
          color: #ffffff;
          max-width: 360px;
          font-size: 44px;
        }

        .lp-rating-side {
          position: relative;
          z-index: 1;
          grid-column: 2;
          display: grid;
          gap: 8px;
          align-self: start;
          justify-items: end;
          color: rgba(255,255,255,0.86);
          font-size: 13px;
          font-weight: 680;
        }

        .lp-rating-tabs {
          position: relative;
          z-index: 1;
          display: grid;
          gap: 9px;
          align-self: stretch;
          align-content: start;
          justify-items: end;
          grid-column: 2;
          grid-row: 2;
        }

        .lp-rating-tabs span {
          width: fit-content;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.24);
          padding: 9px 14px;
          color: #ffffff;
          font-size: 12px;
          font-weight: 700;
        }

        .lp-rating-tabs .is-active {
          background: #050505;
        }

        .lp-mini-stats b {
          color: #0a0a0a;
          font-size: 22px;
          line-height: 1;
          letter-spacing: 0;
        }

        .red { color: #c22f3b !important; }
        .blue { color: #1d5fc4 !important; }

        .lp-state-grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 8px;
          grid-column: 1 / 2;
          grid-row: 2;
          align-self: start;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-ratings:hover .lp-state-grid {
          transform: translateY(-8px);
        }

        .lp-state {
          height: 34px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 760;
          color: #ffffff;
          box-shadow: 0 12px 24px rgba(10, 10, 10, 0.14);
          transition: transform 260ms ease, box-shadow 260ms ease;
        }

        .lp-gallery-ratings:hover .lp-state:nth-child(3n) {
          transform: translateY(-3px);
          box-shadow: 0 16px 30px rgba(10, 10, 10, 0.2);
        }

        .lp-state-r { background: #c22f3b; }
        .lp-state-d { background: #1d5fc4; }
        .lp-state-t { background: #6d3ee9; }

        .lp-rating-key,
        .lp-ev-row {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 20px;
          color: rgba(10, 10, 10, 0.58);
          font-size: 11px;
        }

        .lp-art-ratings .lp-rating-key {
          grid-column: 1 / -1;
          grid-row: 3;
          align-self: end;
          color: rgba(255, 255, 255, 0.78);
          margin-top: 0;
        }

        .lp-rating-key i {
          display: inline-block;
          width: 10px;
          height: 10px;
          border-radius: 999px;
          margin-right: 5px;
        }

        .lp-rating-key .r { background: #c22f3b; }
        .lp-rating-key .d { background: #1d5fc4; }
        .lp-rating-key .t { background: #6d3ee9; }

        .lp-result-head {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          color: rgba(255, 255, 255, 0.62);
          font-size: 12px;
          margin-bottom: 14px;
        }

        .lp-result-toolbar {
          display: flex;
          gap: 6px;
          margin-bottom: 18px;
        }

        .lp-result-toolbar span {
          width: 9px;
          height: 9px;
          border-radius: 999px;
          background: rgba(255,255,255,0.24);
        }

        .lp-result-head span {
          color: #ffffff;
          font-weight: 690;
        }

        .lp-art-results {
          background:
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            #090909;
          background-size: 42px 42px;
          color: #ffffff;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 18px;
          align-items: end;
        }

        .lp-results-grid-bg {
          position: absolute;
          top: 0;
          right: -84px;
          width: 260px;
          height: 100%;
          background: var(--brand-grad);
          opacity: 0.1;
          transform: skewX(-15deg);
          pointer-events: none;
        }

        .lp-result-console {
          position: relative;
          z-index: 1;
          align-self: stretch;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.11);
          background: rgba(255, 255, 255, 0.05);
          padding: 20px;
          transition: border-color 360ms ease, background 360ms ease, transform 360ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-results:hover .lp-result-console {
          border-color: rgba(109,62,233,0.28);
          background: rgba(255,255,255,0.075);
          transform: translateX(4px);
        }

        .lp-result-console h4 {
          margin: 18px 0 10px;
          color: #ffffff;
          font-size: 44px;
          line-height: 0.94;
          font-weight: 520;
        }

        .lp-result-console p {
          color: rgba(255, 255, 255, 0.62);
          font-size: 15px;
          line-height: 1.24;
        }

        .lp-result-county-strip {
          display: grid;
          grid-template-columns: repeat(12, 1fr);
          gap: 5px;
          margin-top: 20px;
        }

        .lp-result-county-strip span {
          height: 34px;
          border-radius: 6px;
          opacity: 0.9;
          transition: transform 300ms ease, opacity 300ms ease;
        }

        .lp-gallery-results:hover .lp-result-county-strip span:nth-child(odd) {
          transform: translateY(-5px);
          opacity: 1;
        }

        .lp-result-county-strip .red { background: #c22f3b; }
        .lp-result-county-strip .purple { background: #6d3ee9; }

        .lp-result-row {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 100px 1fr 58px;
          gap: 14px;
          align-items: center;
          padding: 18px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.95);
          transition: transform 320ms cubic-bezier(.2,.8,.2,1), background 320ms ease;
        }

        .lp-gallery-results:hover .lp-result-row {
          transform: translateX(-5px);
          background: #ffffff;
        }

        .lp-result-row div:first-child {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .lp-result-row strong {
          font-size: 14px;
          letter-spacing: 0;
        }

        .lp-result-row small {
          color: #888;
          font-size: 11px;
        }

        .lp-result-row b {
          font-size: 20px;
          letter-spacing: 0;
          text-align: right;
        }

        .lp-result-bar {
          height: 5px;
          border-radius: 999px;
          background: rgba(10, 10, 10, 0.09);
          overflow: hidden;
        }

        .lp-result-bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
        }

        .lp-result-row.red .lp-result-bar span { background: #c22f3b; }
        .lp-result-row.purple .lp-result-bar span { background: #6d3ee9; }
        .lp-result-row.gray .lp-result-bar span { background: #909090; }
        .lp-result-row.red b { color: #c22f3b; }
        .lp-result-row.purple b { color: #6d3ee9; }

        .lp-us-map {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: repeat(9, 1fr);
          gap: 6px;
          min-height: 164px;
          align-content: center;
          transition: transform 420ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-gallery-map:hover .lp-us-map {
          transform: translateY(-7px) scale(1.015);
        }

        .lp-us-map span {
          height: 22px;
          border-radius: 3px;
          transform: skew(-9deg);
          box-shadow: 0 9px 18px rgba(10, 10, 10, 0.12);
          transition: transform 280ms ease, filter 280ms ease;
        }

        .lp-gallery-map:hover .lp-us-map span:nth-child(4n) {
          transform: skew(-9deg) translateY(-4px);
          filter: saturate(1.15);
        }

        .lp-us-map .r { background: #c22f3b; }
        .lp-us-map .d { background: #1d5fc4; }
        .lp-us-map .t { background: #d7d7d3; }

        .lp-ev-row b {
          display: block;
          font-size: 29px;
          line-height: 1;
          letter-spacing: 0;
        }

        .lp-ev-bar {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: 42% 2px 58%;
          height: 13px;
          border-radius: 999px;
          overflow: hidden;
          margin-top: 13px;
          background: #e5e5e2;
        }

        .lp-art-map {
          background: var(--brand-grad);
          color: #050505;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        .lp-art-map:before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            linear-gradient(90deg, rgba(10,10,10,0.06) 1px, transparent 1px),
            linear-gradient(0deg, rgba(10,10,10,0.05) 1px, transparent 1px);
          background-size: 58px 58px;
          opacity: 0.36;
        }

        .lp-art-map:after {
          content: "*";
          position: absolute;
          right: 26px;
          top: 18px;
          color: rgba(10, 10, 10, 0.9);
          font-size: 68px;
          line-height: 1;
          font-weight: 300;
        }

        .lp-map-title strong {
          max-width: 260px;
        }

        .lp-map-title span {
          margin-top: 8px;
          margin-right: 58px;
        }

        .lp-map-controls {
          position: relative;
          z-index: 1;
          display: flex;
          gap: 8px;
          margin: 12px 0 4px;
        }

        .lp-map-controls span {
          border-radius: 999px;
          border: 1px solid rgba(10, 10, 10, 0.18);
          padding: 7px 10px;
          color: #050505;
          font-size: 11px;
          font-weight: 740;
          background: rgba(255,255,255,0.18);
        }

        .lp-map-controls .is-active {
          background: #050505;
          color: #6d3ee9;
        }

        .lp-ev-bar .blue { background: #1d5fc4; }
        .lp-ev-bar .red { background: #c22f3b; }
        .lp-ev-bar i { background: #0a0a0a; }

        .lp-section {
          padding: clamp(96px, 10vw, 150px) 0;
          position: relative;
        }

        .lp-section-title {
          display: flex;
          align-items: flex-start;
          gap: 32px;
          margin-bottom: 64px;
        }

        .lp-section-title h2,
        .lp-work h2,
        .lp-faq h2 {
          margin: 0;
          font-size: 68px;
          line-height: 1;
          letter-spacing: 0;
          font-weight: 540;
        }

        .lp-section-dot,
        .lp-floating-dot {
          width: 10px;
          height: 10px;
          border-radius: 999px;
          background: #f4f4ef;
          flex: 0 0 auto;
        }


        .lp-proof {
          --proof-lift: 0px;
          --proof-scale: 1;
          --proof-grid-y: 46px;
          width: 100vw;
          min-height: 210vh;
          margin: 0 calc(50% - 50vw) 28px;
          padding: 0;
          position: relative;
          z-index: 3;
          background: #050505;
        }

        .lp-proof-stage {
          position: sticky;
          top: 0;
          z-index: 4;
          width: 100vw;
          min-height: 100vh;
          min-height: 100svh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 68px 0;
          overflow: hidden;
          background: #050505;
        }

        .lp-proof h2 {
          max-width: 1020px;
          margin: 0;
          font-size: 76px;
          line-height: 0.98;
          letter-spacing: 0;
          font-weight: 520;
          text-align: center;
          opacity: 0;
          transform: translateY(var(--proof-lift)) scale(var(--proof-scale));
          transform-origin: center center;
          transition: opacity 180ms ease;
          will-change: transform;
        }

        .lp-proof.is-visible h2 {
          opacity: 1;
        }

        .lp-proof h2 span {
          color: rgba(244, 244, 239, 0.16);
          transition: color 90ms linear;
        }

        .lp-proof h2 span.is-lit {
          color: #f4f4ef;
        }

        /* ===== The evidence — columns of light ===== */
        .ev {
          position: relative;
          width: 100vw;
          margin: 0 calc(50% - 50vw);
          height: 230vh;
          background: #050505;
          z-index: 3;
        }
        .ev-sticky {
          position: sticky;
          top: 0;
          height: 100vh;
          height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(36px, 6vh, 64px);
          overflow: hidden;
        }

        .ev-sticky:before {
          content: "";
          position: absolute;
          left: 50%;
          bottom: -28vh;
          transform: translateX(-50%);
          width: 130vw;
          height: 70vh;
          pointer-events: none;
          background: radial-gradient(50% 55% at 50% 64%, rgba(150, 96, 232, 0.075), rgba(72, 96, 235, 0.04) 50%, transparent 76%);
          filter: blur(20px);
        }
        .ev-eyebrow {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 11.5px;
          font-weight: 650;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.42);
        }
        .ev-eyebrow span { width: 40px; height: 1px; background: rgba(244,244,239,0.25); }
        .ev-row {
          position: relative;
          display: flex;
          align-items: flex-end;
          gap: clamp(18px, 2.6vw, 42px);
          height: min(66vh, 720px);
          width: calc(100vw - clamp(48px, 9vw, 150px));
          max-width: 1560px;
        }
        .ev-col { position: relative; flex: 1; height: 100%; min-width: 0; }
        .ev-col:after {
          content: "";
          position: absolute;
          left: -20%;
          right: -20%;
          bottom: -12vh;
          height: 24vh;
          background: radial-gradient(50% 58% at 50% 38%, rgba(var(--ca), 0.16), transparent 72%);
          filter: blur(22px);
          opacity: var(--g, 0);
          pointer-events: none;
        }
        .ev-fill {
          position: absolute;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(180deg,
            rgba(var(--ca), 0.85) 0%,
            rgba(var(--ca), 0.42) 24%,
            rgba(var(--ca), 0.18) 54%,
            rgba(var(--ca), 0.08) 82%,
            rgba(var(--ca), 0.04) 100%);
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent);
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
        }
        .ev-crest {
          position: absolute;
          top: 0;
          left: 4%;
          right: 4%;
          height: 2.5px;
          border-radius: 99px;
          background: linear-gradient(90deg, transparent, var(--c) 12%, var(--c) 88%, transparent);
          box-shadow: 0 0 20px rgba(var(--ca), 0.95), 0 0 64px rgba(var(--ca), 0.5), 0 0 130px rgba(var(--ca), 0.25);
        }
        .ev-num {
          position: absolute;
          left: -10%;
          right: -10%;
          text-align: center;
          font-size: clamp(64px, 7.4vw, 124px);
          line-height: 1;
          font-weight: 470;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
          color: var(--c);
          will-change: bottom;
        }
        .ev-lab {
          position: absolute;
          top: calc(100% + 20px);
          left: -16%;
          right: -16%;
          text-align: center;
          font-size: 13px;
          font-weight: 650;
          letter-spacing: 1.5px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.55);
          opacity: var(--g, 0);
        }
        .ev-lab i {
          display: block;
          margin-top: 7px;
          font-style: normal;
          font-size: 11.5px;
          font-weight: 550;
          letter-spacing: 0.4px;
          text-transform: none;
          color: rgba(244,244,239,0.32);
        }
        .ev-base {
          position: absolute;
          left: -6%;
          right: -6%;
          bottom: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(244,244,239,0.22) 18%, rgba(244,244,239,0.22) 82%, transparent);
        }
        @media (max-width: 680px) {
          .ev { height: 200vh; }
          .ev-row { gap: 22px; width: calc(100vw - 40px); height: 44vh; }
          .ev-num { font-size: clamp(28px, 9vw, 44px); }
          .ev-lab { font-size: 9.5px; letter-spacing: 0.9px; left: -8%; right: -8%; }
        }

        /* ---- Cinematic narrative beats ---- */
        .lp-narrative {
          width: 100vw;
          min-height: 560vh;
          margin: 0 calc(50% - 50vw) 0;
          position: relative;
          z-index: 3;
          background: #050505;
        }

        .lp-narrative-stage {
          position: sticky;
          top: 0;
          z-index: 4;
          width: 100vw;
          min-height: 100vh;
          min-height: 100svh;
          display: grid;
          place-items: center;
          padding: 72px clamp(28px, 6vw, 90px);
          overflow: hidden;
        }

        .lp-narr-line {
          grid-area: 1 / 1;
          width: min(1040px, 100%);
          margin: 0;
          text-align: center;
          will-change: opacity, transform;
        }

        .cam-viewport {
          position: absolute;
          inset: 0;
          overflow: hidden;
          will-change: opacity;
        }

        .cam-stage {
          position: absolute;
          left: 0;
          top: 0;
          width: 1320px;
          text-align: center;
          font-size: 64px;
          line-height: 1.16;
          letter-spacing: -0.025em;
          font-weight: 500;
          color: #f4f4ef;
          transform-origin: 0 0;
          will-change: transform;
        }

        .cam-stage .cam-w {
          display: inline-block;
          color: rgba(244, 244, 239, 0.12);
          transition: color 140ms linear, text-shadow 140ms linear, transform 220ms cubic-bezier(.2,.8,.2,1);
        }

        .cam-stage .cam-w.is-past {
          color: rgba(244, 244, 239, 0.46);
        }

        .cam-stage .cam-w.is-now {
          color: #ffffff;
          text-shadow: 0 0 30px rgba(244, 244, 239, 0.45), 0 0 80px rgba(244, 244, 239, 0.18);
          transform: translateY(-0.015em);
        }

        .cam-stage.is-revealed .cam-w {
          color: #f4f4ef;
          text-shadow: none;
        }

        .cam-vignette {
          position: absolute;
          inset: -2%;
          pointer-events: none;
          opacity: var(--vg, 0);
          background: radial-gradient(70% 62% at 50% 50%, transparent 44%, rgba(5, 5, 5, 0.72) 84%, rgba(5, 5, 5, 0.95) 100%);
          transition: opacity 220ms linear;
        }

        @media (max-width: 980px) {
          .lp-narrative { min-height: 300vh; }
          .cam-viewport {
            position: relative;
            inset: auto;
            grid-area: 1 / 1;
            display: grid;
            place-items: center;
            overflow: visible;
            width: 100%;
          }
          .cam-stage {
            position: static;
            width: min(1040px, 100%);
            font-size: clamp(25px, 3.2vw, 47px);
            line-height: 1.2;
            letter-spacing: -0.02em;
            transform: none !important;
            padding: 0 8px;
          }
          .cam-vignette { display: none; }
        }

        .lp-narr-2 {
          font-size: clamp(25px, 3.2vw, 47px);
          line-height: 1.2;
          letter-spacing: -0.02em;
          font-weight: 500;
          color: #f4f4ef;
        }

        .lp-narr-2 span {
          color: rgba(244, 244, 239, 0.18);
          transition: color 130ms linear;
        }

        .lp-narr-2 span.is-lit {
          color: #f4f4ef;
        }

        .lp-narr-3 {
          position: relative;
          z-index: 2;
          font-size: clamp(50px, 7.4vw, 116px);
          line-height: 0.96;
          letter-spacing: -0.035em;
          font-weight: 600;
          color: #f4f4ef;
        }

        .lp-section--lead {
          padding-bottom: 0;
        }

        /* Post-narrative content rides up over the pinned finale */
        .lp-aftermath {
          position: relative;
          z-index: 10;
          background: #050505;
          border-radius: 36px 36px 0 0;
          box-shadow: 0 -36px 80px rgba(0, 0, 0, 0.62);
          margin-top: -22vh;
        }

        .lp-aftermath .lp-section--after {
          padding-top: clamp(64px, 7vw, 112px);
        }

        .lp-aftermath .lp-services {
          padding-top: 30px;
        }

        /* Over the white finale the free elements flip to ink */
        .lp-desktop-nav.is-light:before {
          background: linear-gradient(180deg, rgba(244, 244, 239, 0.5), rgba(244, 244, 239, 0.08) 70%, transparent);
        }

        .lp-desktop-nav.is-light .lp-brand-logo {
          background: #0a0a0a;
        }

        .lp-desktop-nav.is-light .lp-nav-live {
          color: rgba(46, 70, 160, 0.9);
        }

        .lp-desktop-nav.is-light .lp-desknav-item {
          color: rgba(10, 10, 10, 0.72);
        }

        .lp-desktop-nav.is-light .lp-desknav-item:hover,
        .lp-desktop-nav.is-light .lp-desknav-item.is-open {
          color: #0a0a0a;
        }

        .lp-desktop-nav.is-light .lp-desknav-item:after {
          background: rgba(10, 10, 10, 0.85);
        }

        .lp-services {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(320px, 384px);
          gap: clamp(52px, 6vw, 100px);
          align-items: start;
          padding-top: 96px;
          position: relative;
        }

        .lp-services:before {
          content: none;
        }

        .lp-services-main {
          display: flex;
          flex-direction: column;
        }

        .lp-services-eyebrow {
          display: flex;
          align-items: center;
          gap: 13px;
          margin-bottom: 24px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 1.9px;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.46);
        }

        .lp-services-eyebrow:before {
          content: "";
          width: 28px;
          height: 1px;
          background: rgba(244, 244, 239, 0.32);
        }

        .lp-service-list {
          display: flex;
          flex-direction: column;
          font-size: clamp(24px, 2.4vw, 34px);
          line-height: 1.05;
          letter-spacing: -0.025em;
          font-weight: 500;
        }

        .lp-service-list a {
          display: grid;
          grid-template-columns: 50px minmax(0, 1fr) auto;
          align-items: center;
          gap: 20px;
          width: 100%;
          padding: clamp(16px, 1.5vw, 23px) 2px;
          color: #f4f4ef;
          text-decoration: none;
          border-top: 1px solid rgba(244, 244, 239, 0.14);
          transition: color 200ms ease, padding-left 320ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-service-list a:last-child {
          border-bottom: 1px solid rgba(244, 244, 239, 0.14);
        }

        .lp-service-list a:before {
          content: attr(data-index);
          font-size: 14px;
          line-height: 1;
          font-weight: 600;
          letter-spacing: 0;
          color: rgba(244, 244, 239, 0.36);
          font-variant-numeric: tabular-nums;
          transition: color 200ms ease;
        }

        .lp-service-label {
          min-width: 0;
        }

        .lp-service-arrow {
          color: #6d3ee9;
          font-size: 0.46em;
          font-weight: 700;
          opacity: 0;
          transform: translateX(-12px);
          transition: opacity 200ms ease, transform 260ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-service-list a:hover {
          color: #6d3ee9;
          padding-left: 14px;
        }

        .lp-service-list a:hover:before,
        .lp-service-list a:focus-visible:before {
          color: #6d3ee9;
        }

        .lp-service-list a:hover .lp-service-arrow,
        .lp-service-list a:focus-visible .lp-service-arrow {
          opacity: 1;
          transform: translateX(0);
        }

        .lp-coverage {
          min-height: 0;
          border-radius: 20px;
          background: var(--brand-grad);
          padding: 32px 32px 36px;
          color: #050505;
          position: relative;
          top: auto;
          overflow: hidden;
          box-shadow: 0 24px 60px rgba(109,62,233,0.14);
          transition: transform 260ms cubic-bezier(.2,.8,.2,1), box-shadow 260ms ease;
        }

        .lp-coverage:hover {
          transform: translateY(-5px);
          box-shadow: 0 34px 84px rgba(109,62,233,0.16);
        }

        .lp-coverage:after {
          content: "*";
          position: absolute;
          right: 26px;
          top: 22px;
          font-size: 56px;
          line-height: 1;
          font-weight: 260;
          transform-origin: center;
          transition: transform 320ms cubic-bezier(.2,.8,.2,1);
        }

        .lp-coverage:hover:after {
          transform: rotate(28deg) scale(1.06);
        }

        .lp-coverage h2 {
          margin: 0 0 26px;
          font-size: clamp(32px, 2.6vw, 40px);
          line-height: 0.98;
          letter-spacing: -0.03em;
          font-weight: 600;
          color: #050505;
        }

        .lp-coverage ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: grid;
          gap: clamp(11px, 1.1vw, 15px);
          font-size: clamp(18px, 1.4vw, 21px);
          color: #050505;
          letter-spacing: -0.015em;
          font-weight: 500;
        }

        .lp-coverage li {
          color: #050505;
        }

        .lp-coverage a {
          color: #050505;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          width: fit-content;
          transition: transform 180ms ease, opacity 180ms ease;
        }

        .lp-coverage a:before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #050505;
          opacity: 0;
          transform: scale(0.4);
          transition: opacity 180ms ease, transform 180ms ease;
        }

        .lp-coverage a:hover {
          transform: translateX(8px);
          opacity: 0.72;
          text-decoration: none;
        }

        .lp-coverage a:hover:before,
        .lp-coverage a:focus-visible:before {
          opacity: 1;
          transform: scale(1);
        }

        .lp-work {
          padding: clamp(108px, 12vw, 178px) 0;
        }

        @keyframes lp-card-rise {
          from { opacity: 0; transform: translateY(32px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Approach — a scroll theater. Each step's word arrives from its own
           side with a glow that blooms at that edge and disperses past it. */
        .ap { display: flex; flex-direction: column; margin-top: 10px; }
        .ap-eyebrow {
          display: flex;
          align-items: center;
          gap: 14px;
          font-size: 11.5px;
          font-weight: 650;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.42);
        }
        .ap-eyebrow span { width: 40px; height: 1px; background: rgba(244,244,239,0.25); }

        .ap-row {
          position: relative;
          min-height: clamp(300px, 46vh, 480px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: clamp(28px, 5vw, 80px);
        }
        .ap-row.ap-left { flex-direction: row-reverse; }

        .ap-glow {
          position: absolute;
          top: 50%;
          width: 64vw;
          height: 160%;
          transform: translateY(-50%) scaleX(var(--gs, 1));
          opacity: var(--go, 0);
          filter: blur(34px);
          pointer-events: none;
        }
        .ap-right .ap-glow { right: max(-26vw, calc((100vw - 1100px) / -2 - 8vw)); transform-origin: right center; --gx: 80%; }
        .ap-left .ap-glow { left: max(-26vw, calc((100vw - 1100px) / -2 - 8vw)); transform-origin: left center; --gx: 20%; }

        /* two layers of slow, contained smoke in the row's own hues */
        .ap-glow:before,
        .ap-glow:after {
          content: "";
          position: absolute;
          inset: -8%;
          will-change: transform;
        }
        .ap-glow:before {
          background: radial-gradient(40% 44% at var(--gx, 80%) 48%, rgba(var(--ga), 0.4), transparent 72%);
          animation: ap-smoke-a 17s ease-in-out infinite alternate;
        }
        .ap-glow:after {
          background: radial-gradient(32% 38% at calc(var(--gx, 80%) + (var(--dir, 1) * -7%)) 58%, rgba(var(--gb), 0.26), transparent 70%);
          animation: ap-smoke-b 12s ease-in-out infinite alternate;
        }
        @keyframes ap-smoke-a {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(calc(var(--dir, 1) * -2.5%), -5%, 0) scale(1.13); }
        }
        @keyframes ap-smoke-b {
          from { transform: translate3d(0, 3%, 0) scale(0.95); }
          to { transform: translate3d(calc(var(--dir, 1) * 3.5%), -4%, 0) scale(1.1); }
        }

        .ap-word {
          position: relative;
          margin: 0;
          font-size: clamp(64px, 10.5vw, 158px);
          line-height: 0.92;
          font-weight: 560;
          letter-spacing: -0.025em;
          text-transform: uppercase;
          color: #f6f4f0;
          white-space: nowrap;
          transform: translateX(calc(var(--wx, 1) * var(--dir, 1) * 44vw));
          opacity: var(--wo, 0);
          will-change: transform, opacity;
        }
        .ap-right { --dir: 1; }
        .ap-left { --dir: -1; }

        .ap-copy {
          position: relative;
          display: flex;
          flex-direction: column;
          gap: 14px;
          max-width: 34ch;
          opacity: var(--co, 0);
          transform: translateY(calc((1 - var(--co, 0)) * 16px));
        }
        .ap-idx { font-size: 12.5px; font-weight: 600; color: rgba(244,244,239,0.35); font-variant-numeric: tabular-nums; }
        .ap-copy p { margin: 0; font-size: clamp(15px, 1.3vw, 18px); line-height: 1.52; color: rgba(244,244,239,0.55); }

        @media (max-width: 980px) {
          .ap-row, .ap-row.ap-left { flex-direction: column; justify-content: center; align-items: flex-start; gap: 22px; min-height: 320px; }
          .ap-right .ap-word { align-self: flex-end; }
          .ap-word { font-size: clamp(48px, 13vw, 96px); }
        }

        .lp-faq {
          padding: 48px 0 clamp(102px, 10vw, 152px);
        }

        .lp-faq-inner {
          width: min(1180px, calc(100vw - 160px));
          margin: 0 auto;
          display: grid;
          grid-template-columns: 260px minmax(0, 900px);
          gap: 64px;
          align-items: start;
          justify-content: center;
        }

        .lp-faq p {
          margin: 14px 0 0;
          color: rgba(244, 244, 239, 0.58);
          font-size: 19px;
          letter-spacing: 0;
        }

        /* FAQ — ruled editorial rows on the page itself, no card chrome */
        .lp-faq-list {
          width: 100%;
          max-width: 900px;
          margin: 0 auto;
        }

        .lp-faq-row {
          border-top: 1px solid rgba(244, 244, 239, 0.14);
          transition: border-color 240ms ease;
        }

        .lp-faq-row:last-child {
          border-bottom: 1px solid rgba(244, 244, 239, 0.14);
        }

        .lp-faq-row:hover,
        .lp-faq-row.is-open {
          border-top-color: rgba(109,62,233,0.5);
          border-image: var(--brand-grad) 1;
        }

        .lp-faq-button {
          width: 100%;
          border: 0;
          background: transparent;
          display: grid;
          grid-template-columns: 52px minmax(0, 1fr) auto;
          align-items: center;
          gap: 20px;
          padding: 24px 2px;
          cursor: pointer;
          text-align: left;
          color: #f4f4ef;
          font: inherit;
          font-size: clamp(19px, 1.8vw, 24px);
          letter-spacing: -0.015em;
          font-weight: 540;
          transition: color 200ms ease, padding-left 280ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-faq-button:before {
          content: attr(data-index);
          font-size: 14px;
          font-weight: 600;
          color: rgba(244, 244, 239, 0.36);
          font-variant-numeric: tabular-nums;
          transition: color 200ms ease;
        }

        .lp-faq-button:hover {
          color: #6d3ee9;
          padding-left: 10px;
        }

        .lp-faq-button:hover:before {
          color: #6d3ee9;
        }

        .lp-faq-button span:last-child {
          font-size: 26px;
          line-height: 0.8;
          font-weight: 400;
          color: #6d3ee9;
          transition: transform 320ms cubic-bezier(.2, .8, .2, 1);
        }

        .lp-faq-row.is-open .lp-faq-button span:last-child {
          transform: rotate(45deg);
        }

        .lp-faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows 300ms cubic-bezier(.2, .8, .2, 1), opacity 260ms ease;
          opacity: 0;
        }

        .lp-faq-row.is-open .lp-faq-answer {
          grid-template-rows: 1fr;
          opacity: 1;
        }

        .lp-faq-answer-inner {
          overflow: hidden;
        }

        .lp-faq-answer p {
          margin: 0;
          padding: 0 0 30px 72px;
          color: rgba(244, 244, 239, 0.62);
          font-size: 18px;
          line-height: 1.42;
          letter-spacing: -0.005em;
          max-width: 700px;
        }

        /* ===== Horizon footer — the page's closing shot ===== */
        .ft {
          position: relative;
          min-height: 100svh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: clamp(28px, 4vh, 44px);
          overflow: hidden;
          padding: clamp(64px, 10vh, 120px) 24px;
          background: #0a0a0c;
        }

        /* brand-recolored backdrop \u2014 layered radials + linear, per spec */
        .ft-backdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(120% 90% at 78% 108%, #d2494b 0%, rgba(210, 73, 75, 0) 46%),
            radial-gradient(120% 90% at 22% 100%, #a44197 0%, rgba(164, 65, 151, 0) 50%),
            linear-gradient(200deg, #07070b 8%, #241a5e 42%, #6d3ee9 78%, #b5468f 100%);
          opacity: 0.92;
        }

        .ft-vignette {
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            linear-gradient(180deg, #050505 0%, rgba(5, 5, 5, 0) 14%),
            radial-gradient(140% 120% at 50% 30%, transparent 40%, rgba(5, 5, 8, 0.55) 100%);
        }

        /* the glass pane */
        .ft-pane {
          position: relative;
          z-index: 2;
          width: min(920px, 100%);
          background: rgba(10, 10, 14, 0.52);
          -webkit-backdrop-filter: blur(26px) saturate(1.35);
          backdrop-filter: blur(26px) saturate(1.35);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 22px;
          box-shadow: 0 30px 90px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.14);
          overflow: hidden;
          opacity: 0;
          transform: translateY(18px);
          transition: opacity 700ms ease, transform 800ms cubic-bezier(.2,.8,.2,1);
        }

        .ft.is-on .ft-pane {
          opacity: 1;
          transform: translateY(0);
        }

        .ft-split {
          display: grid;
          grid-template-columns: 60fr 40fr;
        }

        /* left \u2014 identity */
        .ft-side-l { padding: 52px 46px 46px; }

        .ft-kicker {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 26px;
          font-family: var(--font-numeric);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.4);
        }

        .ft-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          background: var(--live);
          box-shadow: 0 0 10px var(--live);
        }

        .ft-headline {
          margin: 0;
          font-family: var(--font-display);
          font-weight: 700;
          letter-spacing: -0.025em;
          line-height: 0.98;
          font-size: clamp(40px, 5.4vw, 64px);
          color: #f4f4ef;
          text-wrap: balance;
        }

        .ft-cyc {
          color: transparent;
          background: var(--brand-grad);
          -webkit-background-clip: text;
          background-clip: text;
        }

        .ft-sub {
          margin: 20px 0 0;
          font-size: clamp(14px, 1.5vw, 16px);
          line-height: 1.5;
          color: rgba(244, 244, 239, 0.66);
          max-width: 34ch;
        }

        /* right \u2014 action */
        .ft-side-r {
          padding: 48px 42px 40px;
          border-left: 1px solid rgba(255, 255, 255, 0.11);
          display: flex;
          flex-direction: column;
          background: rgba(255, 255, 255, 0.03);
        }

        .ft-rlab {
          margin-bottom: 18px;
          font-family: var(--font-numeric);
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.45);
        }

        .ft-cta {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          text-decoration: none;
          font-family: var(--font-numeric);
          font-weight: 700;
          font-size: 16px;
          letter-spacing: -0.01em;
          color: #0a0a0c;
          background: #f4f4ef;
          padding: 16px 20px;
          border-radius: 14px;
          box-shadow: 0 14px 34px rgba(0,0,0,.4), 0 0 0 1px rgba(255,255,255,.1);
          transition: transform 250ms cubic-bezier(.2,.8,.2,1), box-shadow 250ms ease;
        }

        .ft-cta:hover {
          transform: translateY(-2px);
          box-shadow: 0 20px 44px rgba(0,0,0,.46), 0 0 0 1px rgba(255,255,255,.14);
        }

        .ft-arw {
          margin-left: auto;
          font-size: 18px;
          transition: transform 250ms cubic-bezier(.2,.8,.2,1);
        }

        .ft-cta:hover .ft-arw { transform: translateX(4px); }

        .ft-cta-addr {
          margin-top: 16px;
          font-family: var(--font-numeric);
          font-size: 11.5px;
          letter-spacing: 0.02em;
          color: rgba(244, 244, 239, 0.82);
          word-break: break-all;
        }

        .ft-cta-addr a { color: inherit; text-decoration: none; }
        .ft-cta-addr a:hover { color: #f4f4ef; }

        .ft-cta-note {
          margin-top: 12px;
          font-family: var(--font-numeric);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          line-height: 1.6;
          color: rgba(244, 244, 239, 0.4);
        }

        /* standalone bottom bar — outside the pane, like a standard site footer */
        .ft-rfoot {
          position: relative;
          z-index: 2;
          width: min(920px, 100%);
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 14px 28px;
          padding-top: 22px;
          background-image: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.16) 18%, rgba(255, 255, 255, 0.16) 82%, transparent);
          background-position: top;
          background-size: 100% 1px;
          background-repeat: no-repeat;
        }

        .ft-logo {
          display: block;
          height: 18px;
          width: 96px;
          flex-shrink: 0;
          opacity: 0.9;
          background: #f4f4ef;
          -webkit-mask: url(/tpsi-logo.svg) left center / contain no-repeat;
          mask: url(/tpsi-logo.svg) left center / contain no-repeat;
        }

        .ft-links2 {
          display: flex;
          flex-wrap: wrap;
          gap: 14px;
          margin-right: auto;
        }

        .ft-links2 a {
          font-family: var(--font-numeric);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(244, 244, 239, 0.66);
          text-decoration: none;
          transition: color 200ms ease;
        }

        .ft-links2 a:hover { color: #f4f4ef; }

        .ft-copy {
          font-family: var(--font-numeric);
          font-size: 10px;
          letter-spacing: 0.09em;
          color: rgba(244, 244, 239, 0.4);
        }

        @media (max-width: 680px) {
          .ft-split { grid-template-columns: 1fr; }
          .ft-side-l { padding: 38px 30px 8px; }
          .ft-rfoot { flex-direction: column; align-items: flex-start; gap: 12px; }
          .ft-links2 { margin-right: 0; }
          .ft-side-r {
            border-left: none;
            border-top: 1px solid rgba(255, 255, 255, 0.11);
            padding: 30px;
          }
        }


        /* ===== The desk — calm bento. One material, one accent. ===== */
        .dk {
          position: relative;
          width: 100vw;
          margin: 0 calc(50% - 50vw);
          padding: clamp(96px, 11vw, 170px) 0 clamp(90px, 10vw, 150px);
          background: #050505;
        }
        .dk-shell { position: relative; width: min(1240px, calc(100vw - 96px)); margin: 0 auto; }
        .dk-headrow {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 24px;
          margin-bottom: clamp(36px, 4vw, 56px);
        }
        .dk-eyebrow {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 18px;
          font-size: 11.5px;
          font-weight: 650;
          letter-spacing: 1.8px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.42);
        }
        .dk-eyebrow span { width: 40px; height: 1px; background: rgba(244,244,239,0.25); }
        .dk-title {
          margin: 0;
          font-size: clamp(42px, 4.8vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.03em;
          font-weight: 510;
        }
        .dk-live {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 8px;
          font-size: 11px;
          font-weight: 650;
          letter-spacing: 1.4px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.38);
          white-space: nowrap;
        }
        .dk-live i { width: 5px; height: 5px; border-radius: 999px; background: var(--brand-grad); animation: lp-dot-pulse 2.6s ease-in-out infinite; }

        /* ===== The exhibit wall — no containers, hairlines and feathered data ===== */
        .xw { display: flex; flex-direction: column; }
        .xw-duo { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0 clamp(32px, 4vw, 64px); align-items: stretch; }
        .xw-div { width: 1px; margin: 30px 0 44px; background: linear-gradient(180deg, rgba(244,244,239,0.13), rgba(244,244,239,0.03)); }

        .ex {
          position: relative;
          display: block;
          min-width: 0;
          text-decoration: none;
          color: #f4f4ef;
          padding: 24px 0 52px;
          transform: translate3d(0, calc((var(--p, 0.5) - 0.5) * var(--depth) * 1.5px), 0);
          opacity: 0;
        }
        .dk.is-in .ex { animation: lp-card-rise 800ms cubic-bezier(.2,.8,.2,1) both; }
        .dk.is-in .ex:nth-of-type(1) { animation-delay: 60ms; }
        .dk.is-in .ex:nth-of-type(2) { animation-delay: 140ms; }
        .dk.is-in .xw-duo .ex:first-child { animation-delay: 220ms; }
        .dk.is-in .xw-duo .ex:last-child { animation-delay: 300ms; }

        .ex-rule {
          position: absolute;
          top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, rgba(244,244,239,0.16), rgba(244,244,239,0.05) 62%, transparent);
        }

        .ex-meta {
          display: flex;
          align-items: baseline;
          gap: 16px;
          min-width: 0;
        }
        .ex-idx { font-size: 12px; font-weight: 600; color: rgba(244,244,239,0.32); font-variant-numeric: tabular-nums; }
        .ex-title { font-size: 12.5px; font-weight: 700; letter-spacing: 1.6px; text-transform: uppercase; color: rgba(244,244,239,0.62); white-space: nowrap; }
        .ex-sub { font-size: 12.5px; font-weight: 550; color: rgba(244,244,239,0.34); font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; }
        .ex-cta { margin-left: auto; display: inline-flex; align-items: center; gap: 7px; font-size: 12.5px; font-weight: 600; color: rgba(244,244,239,0.36); white-space: nowrap; transition: color 240ms ease; }
        .ex-cta i { font-style: normal; transition: transform 240ms cubic-bezier(.2,.8,.2,1); }
        .ex:hover .ex-cta { color: #f4f4ef; }
        .ex:hover .ex-cta i { transform: translateX(4px); }

        .ex-body { display: block; position: relative; margin-top: 22px; }
        .ex-stage { display: block; position: relative; }
        .ex-stage-tall { height: clamp(280px, 30vw, 400px); }
        .ex-stage-swarm { height: clamp(240px, 24vw, 320px); }
        .ex-stage-cell { display: flex; flex-direction: column; gap: 14px; min-height: 250px; }

        .ex-wash { position: absolute; inset: -10% -4%; filter: blur(28px); pointer-events: none; }
        .ex-chart { display: block; position: relative; width: 100%; height: 100%; }
        .ex-svg { width: 100%; height: 100%; display: block; overflow: visible; }
        .ex-chart-mini { height: 150px; margin-top: auto; }
        /* svgs must FILL the chart box — left to their viewBox aspect they
           render taller than the 150px mini slot and the lower line spills
           past the cell (the approval-line clip). */
        .ex-chart svg { width: 100%; height: 100%; display: block; }

        /* the feathered edges — data dissolves into the page */
        .ex-fade {
          -webkit-mask-image: radial-gradient(ellipse 94% 88% at 50% 50%, #000 52%, transparent 99%);
          mask-image: radial-gradient(ellipse 94% 88% at 50% 50%, #000 52%, transparent 99%);
        }
        .ex-fade-x {
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
          mask-image: linear-gradient(90deg, transparent, #000 9%, #000 91%, transparent);
        }
        .ex-fade-r {
          -webkit-mask-image: linear-gradient(90deg, #000 72%, transparent 100%);
          mask-image: linear-gradient(90deg, #000 72%, transparent 100%);
        }

        .ex-axis { font-size: 11px; font-weight: 650; letter-spacing: 0.9px; fill: rgba(244,244,239,0.3); font-family: inherit; }
        .ex-endlab { font-size: 11px; font-weight: 700; letter-spacing: 0.8px; text-transform: uppercase; font-family: inherit; opacity: 0.7; }
        .ex-endval { font-size: 15px; font-weight: 700; font-family: inherit; font-variant-numeric: tabular-nums; }

        /* the huge editorial numeral riding an exhibit */
        .ex-big {
          position: absolute;
          top: -8px;
          right: 0;
          text-align: right;
          font-size: clamp(54px, 5.2vw, 92px);
          line-height: 0.9;
          font-weight: 470;
          letter-spacing: -0.03em;
          font-variant-numeric: tabular-nums;
        }
        .ex-big i {
          display: block;
          margin-top: 10px;
          font-style: normal;
          font-size: 11.5px;
          font-weight: 650;
          letter-spacing: 1.2px;
          text-transform: uppercase;
          color: rgba(244,244,239,0.38);
        }
        .ex-big-pair b { font-weight: 470; }
        .ex-big-pair span { margin: 0 6px; color: rgba(244,244,239,0.3); }

        /* annotation callout with a leader line */
        .ex-ann {
          position: absolute;
          top: -4px;
          transform: translateX(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          pointer-events: none;
        }
        .ex-ann-text { font-size: 12.5px; font-weight: 550; color: rgba(244,244,239,0.55); white-space: nowrap; }
        .ex-ann-text b { font-weight: 700; color: #f4f4ef; }
        .ex-ann-line { width: 1px; height: 34px; background: linear-gradient(180deg, rgba(244,244,239,0.35), transparent); }

        /* cell exhibits */
        .ex-cellbig {
          font-size: clamp(56px, 5vw, 84px);
          line-height: 0.9;
          font-weight: 470;
          letter-spacing: -0.035em;
          font-variant-numeric: tabular-nums;
        }
        .ex-cellsub { font-size: 12.5px; font-weight: 560; color: rgba(244,244,239,0.4); font-variant-numeric: tabular-nums; }
        .ex-cellhead { font-size: clamp(19px, 1.7vw, 24px); font-weight: 640; letter-spacing: -0.015em; }
        .ex-cellhead i { font-style: normal; margin-left: 10px; font-size: 12px; font-weight: 600; color: rgba(244,244,239,0.38); letter-spacing: 0; }

        .ex-rows { display: flex; flex-direction: column; gap: 16px; margin-top: 6px; }
        .ex-rows-tight { gap: 12px; }
        .ex-row { display: grid; grid-template-columns: 110px 1fr 48px; align-items: center; gap: 14px; }
        .ex-row-name { font-size: 14px; font-weight: 620; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ex-row-name em { font-style: normal; font-size: 12px; color: #6d3ee9; margin-left: 8px; }
        .ex-row-bar { height: 8px; overflow: hidden; }
        .ex-row-bar i { display: block; height: 100%; border-radius: 99px; transform-origin: left; animation: lp-desk-grow 0.9s cubic-bezier(.16,1,.3,1) both; }
        .ex-row-pct { font-size: 15px; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }

        /* electoral map exhibit */
        .ex-map { display: block; flex: 1; min-height: 0; }
        .ex-map svg { width: 100%; height: 100%; max-height: 230px; }
        .ex-evwrap { position: relative; display: block; padding-top: 16px; }
        .ex-evtick { position: absolute; top: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 2px; font-size: 9.5px; font-weight: 700; letter-spacing: 0.7px; color: rgba(244,244,239,0.48); }
        .ex-evtick i { display: block; width: 1px; height: 5px; background: rgba(244,244,239,0.4); }
        .ex-evbar { display: flex; gap: 2px; height: 5px; border-radius: 99px; overflow: hidden; }
        .ex-evbar i { display: block; height: 100%; }
        .ex-evcaps { display: flex; justify-content: space-between; margin-top: 9px; font-size: 12px; font-weight: 650; font-variant-numeric: tabular-nums; color: rgba(244,244,239,0.38); }

        .pvb-tagtext { font-size: 11px; font-weight: 750; fill: #0b0b0d; font-family: inherit; font-variant-numeric: tabular-nums; }

        @keyframes lp-desk-grow { from { transform: scaleX(0); opacity: 0; } to { transform: scaleX(1); opacity: 1; } }

        @media (max-width: 1080px) {
          .xw-duo { grid-template-columns: 1fr; gap: 0; }
          .xw-div { display: none; }
          .ex-big { font-size: clamp(44px, 7vw, 64px); }
        }
        @media (max-width: 680px) {
          .dk-shell { width: calc(100vw - 32px); }
          .dk-headrow { flex-direction: column; align-items: flex-start; gap: 14px; }
          .ex { padding: 20px 0 40px; }
          .ex-meta { flex-wrap: wrap; row-gap: 4px; }
          .ex-sub { display: none; }
          .ex-stage-tall { height: 240px; }
          .ex-stage-swarm { height: 210px; }
          .ex-big { position: static; text-align: left; margin-top: 14px; }
          .ex-ann { display: none; }
          .ex-row { grid-template-columns: 92px 1fr 44px; gap: 10px; }
        }

        @keyframes lp-rise {
          from { opacity: 0; transform: translateY(26px); filter: blur(8px); }
          to { opacity: 1; transform: translateY(0); filter: blur(0); }
        }

        @keyframes lp-dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.62); opacity: 0.55; }
        }

        @keyframes lp-gallery-slide {
          from { transform: translateX(0); }
          to { transform: translateX(calc(-50% - 11px)); }
        }

        @media (prefers-reduced-motion: reduce) {
          *,
          *:before,
          *:after {
            animation-duration: 1ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 1ms !important;
          }
        }

        @media (max-width: 980px) {
          .lp-shell {
            width: min(100% - 96px, 1280px);
          }

          .lp-hero {
            padding: 96px 0 104px;
          }

          .lp-nav {
            align-items: flex-start;
            gap: 24px;
            margin-bottom: 46px;
          }

          .lp-nav-links {
            display: none;
          }

          .lp-services,
          .lp-faq-inner {
            grid-template-columns: 1fr;
          }

          .lp-services {
            gap: 52px;
          }

          .lp-services:before {
            display: none;
          }

          .lp-section-title h2,
          .lp-work h2,
          .lp-faq h2 {
            font-size: 58px;
          }

          .lp-proof h2 {
            font-size: 64px;
            max-width: min(780px, calc(100vw - 96px));
          }

          .lp-service-list,
          .lp-coverage h2 {
            font-size: 44px;
          }

          .lp-coverage {
            position: relative;
            top: auto;
          }

          .lp-topbar {
            display: flex;
          }

          .lp-mobile-menu {
            display: flex;
          }

          .lp-desktop-nav,
          .lp-navstrip {
            display: none;
          }

          .lp-hero .lp-nav {
            display: none;
          }

          .lp-hero-nav-in {
            width: min(100% - 48px, 1280px);
          }

          .lp-hero {
            padding-top: 88px;
          }

          .lp-hero-foot {
            width: min(100% - 96px, 1280px);
          }
        }

        @media (max-width: 680px) {
          .lp-shell {
            width: min(100% - 28px, 1240px);
          }

          .lp-faq-inner {
            width: min(100% - 28px, 1240px);
            gap: 32px;
          }

          .lp-hero {
            padding: 84px 0 96px;
          }

          .lp-hero-nav-in {
            width: min(100% - 28px, 1240px);
          }

          .lp-hero-veil {
            background:
              linear-gradient(180deg, rgba(5, 5, 5, 0.55), rgba(5, 4, 9, 0.3) 26%, rgba(5, 4, 9, 0.34) 58%, rgba(5, 5, 5, 0.62) 86%, #050505 100%);
          }

          .lp-hero-foot {
            width: calc(100vw - 28px);
          }

          .lp-hero-sim {
            display: none;
          }

          .lp-nav {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin: 0 0 42px;
            padding: 7px 7px 7px 13px;
            min-height: 42px;
            border-radius: 999px;
            border: 1px solid rgba(255, 255, 255, 0.11);
            background: rgba(255, 255, 255, 0.055);
            box-shadow: 0 18px 46px rgba(0, 0, 0, 0.28);
            backdrop-filter: blur(18px);
          }

          .lp-wordmark {
            font-size: 18px;
            color: #f4f4ef;
            gap: 0;
          }

          .lp-wordmark span {
            display: none;
          }

          .lp-nav-links {
            display: flex;
            align-items: center;
            gap: 2px;
            color: rgba(244, 244, 239, 0.72);
            font-size: 12px;
            overflow-x: auto;
            scrollbar-width: none;
          }

          .lp-nav-links::-webkit-scrollbar {
            display: none;
          }

          .lp-nav-links a {
            flex: 0 0 auto;
            padding: 8px 10px;
            border-radius: 999px;
            color: inherit;
            line-height: 1;
          }

          .lp-nav-links a:hover,
          .lp-nav-links a:focus-visible {
            color: #050505;
            background: var(--brand-grad);
            transform: none;
          }

          .lp-nav-links a:nth-child(4) {
            display: none;
          }

          .lp-actions {
            flex-wrap: wrap;
          }

          .lp-dot {
            margin-left: 10px;
          }

          .lp-dot:after {
            width: 22px;
          }

          .lp-gallery-band {
            padding: 24px 0 28px;
          }

          .lp-gallery-card {
            width: min(400px, 90vw);
            min-height: 0;
            padding: 0;
          }

          .lp-gallery-track {
            margin-left: 54px;
            animation-duration: 96s;
            animation-delay: 1.2s;
          }

          .lp-gallery-window:before,
          .lp-gallery-window:after {
            width: 64px;
            backdrop-filter: blur(7px);
            -webkit-backdrop-filter: blur(7px);
          }

          .lp-gallery-window:before {
            background: linear-gradient(90deg, #050505 0%, #050505 26%, rgba(5, 5, 5, 0.55) 60%, transparent 100%);
          }

          .lp-gallery-window:after {
            background: linear-gradient(270deg, #050505 0%, #050505 26%, rgba(5, 5, 5, 0.55) 60%, transparent 100%);
          }

          .lp-art {
            min-height: 286px;
            padding: 18px;
          }

          .lp-art-thumbnail {
            min-height: 0;
            padding: 0;
          }

          .lp-poll-grid,
          .lp-art-ratings,
          .lp-art-results {
            grid-template-columns: 1fr;
          }

          .lp-poll-hero strong,
          .lp-rating-title strong,
          .lp-map-title strong {
            font-size: 30px;
          }

          .lp-poll-hero b {
            font-size: 48px;
          }

          .lp-poll-source-stack {
            display: none;
          }

          .lp-result-console h4 {
            font-size: 32px;
          }

          .lp-result-row {
            grid-template-columns: 104px 1fr 46px;
          }

          .lp-card-head {
            align-items: flex-start;
            flex-direction: column;
          }

          .lp-services {
            padding-top: 54px;
            gap: 18px;
          }

          .lp-service-list {
            display: flex;
            flex-direction: column;
            gap: 0;
            font-size: clamp(23px, 6.6vw, 30px);
            line-height: 1.1;
            font-weight: 520;
          }

          .lp-service-list a {
            width: 100%;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 16px;
            padding: 17px 2px;
            border: 0;
            border-radius: 0;
            background: none;
            box-shadow: none;
            border-bottom: 1px solid rgba(255, 255, 255, 0.1);
            transform: none;
          }

          .lp-service-list a:first-child {
            padding-top: 2px;
          }

          .lp-service-list a:before {
            position: static;
            opacity: 1;
            transform: none;
            color: rgba(244, 244, 239, 0.4);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            font-variant-numeric: tabular-nums;
          }

          .lp-service-label {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .lp-service-arrow {
            margin-left: 0;
            opacity: 0.9;
            transform: none;
            color: #6d3ee9;
            font-size: 19px;
            font-weight: 700;
            vertical-align: 0;
            transition: transform 220ms cubic-bezier(.2,.8,.2,1);
          }

          .lp-service-list a:hover,
          .lp-service-list a:focus-visible,
          .lp-service-list a:active {
            color: #6d3ee9;
            transform: none;
            background: none;
            border-color: rgba(109,62,233,0.4);
          }

          .lp-service-list a:active .lp-service-arrow {
            transform: translateX(5px);
          }

          .lp-coverage {
            min-height: 0;
            padding: 28px 24px;
            border-radius: 18px;
            box-shadow: 0 26px 70px rgba(109,62,233,0.14);
          }

          .lp-coverage h2 {
            font-size: 38px;
            margin-bottom: 22px;
          }

          .lp-coverage ul {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 13px 18px;
            font-size: 16px;
            font-weight: 560;
          }

          .lp-coverage a {
            width: fit-content;
            justify-content: flex-start;
            min-height: 0;
            padding: 0;
            border: 0;
            border-radius: 0;
            background: none;
            text-align: left;
            gap: 9px;
          }

          .lp-coverage a:before {
            display: inline-block;
            opacity: 0.5;
            transform: scale(1);
          }

          .lp-coverage a:hover,
          .lp-coverage a:focus-visible,
          .lp-coverage a:active {
            opacity: 1;
            transform: translateX(4px);
            background: none;
            color: #050505;
          }

          .lp-coverage a:active:before {
            opacity: 1;
          }

          .lp-process-row {
            grid-template-columns: 36px minmax(0, 1fr);
            row-gap: 10px;
            padding: 22px 0;
          }

          .lp-process-row p {
            grid-column: 2;
            font-size: 15px;
            line-height: 1.38;
          }

          .lp-faq-button {
            font-size: 18px;
            grid-template-columns: 32px minmax(0, 1fr) auto;
            gap: 12px;
          }

          .lp-faq-answer p {
            padding-left: 44px;
            font-size: 15.5px;
          }

          .lp-section-title h2,
          .lp-work h2,
          .lp-faq h2 {
            font-size: 44px;
          }

          .lp-proof h2 {
            font-size: 46px;
            max-width: min(360px, calc(100vw - 28px));
            line-height: 1;
          }

          .lp-proof {
            min-height: 190vh;
            margin: 0 calc(50% - 50vw) 18px;
          }

          .lp-narrative {
            min-height: 280vh;
          }

          .lp-narrative-stage {
            padding: 42px 22px;
          }

          .lp-proof-stage {
            padding: 42px 0;
            min-height: 100vh;
            min-height: 100svh;
          }

        }
      `}</style>

      <div className="lp-root">
        <section className="lp-hero">
          <DotField className="lp-hero-glass" />
          <div className="lp-hero-blooms" aria-hidden="true" />
          <div className="lp-hero-veil" aria-hidden="true" />

          <div className="lp-hero-nav">
            <div className="lp-hero-nav-in">
              <DarkNav />
            </div>
          </div>

          <div className="lp-shell lp-hero-inner">
            <div className="lp-hero-copy">
              <div className="lp-hero-eyebrow">
                <span className="lp-hero-eyebrow-live"><i aria-hidden="true" />LIVE DESK</span> &middot; THE PUBLIC SENTIMENT INSTITUTE
              </div>
              <h1>Polling averages and forecasts for <span className="g">live election results</span>.</h1>
              <p>Track voter sentiment, race ratings, and election night returns from one transparent data desk.</p>
              <div className="lp-actions">
                <Link href="/polling" className="lp-pill"><span>Explore the polling</span><i aria-hidden="true">&rarr;</i></Link>
                <Link href="/forecastratings" className="lp-pill lp-pill-dark"><span>See the forecast</span><i aria-hidden="true">&rarr;</i></Link>
              </div>
            </div>
          </div>

          <div className="lp-hero-foot" aria-hidden="true">
            <span className="lp-hero-scroll"><i />scroll</span>
            <span className="lp-hero-sim">field simulation · <b>move your cursor</b></span>
          </div>
        </section>

        <DeskWall stats={stats} />

        <section className="lp-section lp-section--lead">
          <div className="lp-shell">
            <div
              ref={proofRef}
              style={proofStyle}
              className={`lp-proof${proofProgress > 0.02 ? " is-visible" : ""}${
                proofProgress > 0.72 ? " is-settling" : ""
              }`}
            >
              <div className="lp-proof-stage">
                <h2 aria-label={proofText}>
                  {proofText.split("").map((char, index) => {
                    const ratio = index / Math.max(proofText.length - 1, 1);
                    return (
                      <span
                        key={`${char}-${index}`}
                        aria-hidden="true"
                        className={ratio <= proofLetterProgress ? "is-lit" : undefined}
                      >
                        {char}
                      </span>
                    );
                  })}
                </h2>
              </div>
            </div>

            <EvidenceBars stats={stats} />

            <div ref={narrativeRef} className="lp-narrative" style={{ background: narrativeBg }}>
              <div className="lp-narrative-stage">
                <div
                  ref={camVpRef}
                  className="cam-viewport"
                  style={{ opacity: narr2Opacity }}
                  role="text"
                  aria-label={narrativeStatement}
                >
                  <div ref={camStageRef} className={`cam-stage${camRevealed ? " is-revealed" : ""}`}>
                    {NARR_PHRASES.map((phrase, pi) => {
                      const words = phrase.split(" ");
                      return (
                        <span className="cam-phrase" key={pi}>
                          {words.map((word, wi) => {
                            const gi = NARR_OFFSETS[pi] + wi;
                            const cls = gi < camNowIdx ? "cam-w is-past" : gi === camNowIdx ? "cam-w is-now" : "cam-w";
                            return (
                              <React.Fragment key={`${word}-${wi}`}>
                                <span aria-hidden="true" className={cls}>{word}</span>
                                <span aria-hidden="true" className="cam-sp">{" "}</span>
                              </React.Fragment>
                            );
                          })}
                        </span>
                      );
                    })}
                  </div>
                  <span className="cam-vignette" aria-hidden="true" />
                </div>
                <p
                  className="lp-narr-line lp-narr-3"
                  style={{ opacity: narr3Opacity, transform: `translateY(${narr3Y}px)`, color: narr3Color }}
                  aria-hidden={narr3Opacity < 0.5}
                >
                  That&apos;s why we are here.
                </p>
              </div>
            </div>
          </div>
        </section>

        <div className="lp-aftermath">
          <SentimentGlobe />

          <PublishDeck stats={stats} />

        <section className="lp-work">
          <div className="lp-shell">
            <ApproachTheater />
          </div>
        </section>

        <section className="lp-faq">
          <div className="lp-faq-inner">
            <div>
              <h2>FAQ</h2>
              <p>Common questions about PSI data</p>
            </div>
            <div className="lp-faq-list">
              {faqs.map((faq, index) => {
                const open = index === openFaq;
                return (
                  <div key={faq.question} className={`lp-faq-row${open ? " is-open" : ""}`}>
                    <button
                      type="button"
                      className="lp-faq-button"
                      data-index={String(index + 1).padStart(2, "0")}
                      aria-expanded={open}
                      onClick={() => setOpenFaq(open ? -1 : index)}
                    >
                      <span>{faq.question}</span>
                      <span aria-hidden="true">+</span>
                    </button>
                    <div className="lp-faq-answer">
                      <div className="lp-faq-answer-inner">
                        <p>{faq.answer}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <HorizonFooter />
        </div>
      </div>
    </>
  );
}
