"use client";

import React from "react";
import Link from "next/link";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart,
} from "recharts";

/* ───────────────────────────────────────────────────────────
   PSI · UI v2 (Reference Page)
   Aesthetic: Modern fintech / SaaS — soft surfaces, rounded
   cards, generous whitespace, restrained accent color.
   Same palette (red/blue/purple), same fonts. No new deps.
─────────────────────────────────────────────────────────── */

// ─── Placeholder data (mirrors home-page shape) ──────────────
const TODAY = "May 27, 2026";

const approve = 41.8;
const disapprove = 55.6;
const rt = 28.4;
const wt = 64.1;
const dem = 46.2;
const rep = 45.9;
const gbNet = +(dem - rep).toFixed(1);

const series = (base: number, n = 60, vol = 1.2) =>
  Array.from({ length: n }, (_, i) => ({
    d: i,
    a: +(base + Math.sin(i / 6) * vol + (Math.random() - 0.5) * 0.6).toFixed(2),
    b: +(100 - base + Math.cos(i / 6) * vol + (Math.random() - 0.5) * 0.6).toFixed(2),
  }));

const trumpSeries = series(approve);
const rtSeries = series(rt);
const gbSeries = series(dem, 60, 0.9);
const ky04Series = series(48, 60, 1.4);

const issues = [
  { issue: "Economy",       dem: 38, rep: 54 },
  { issue: "Immigration",   dem: 34, rep: 59 },
  { issue: "Healthcare",    dem: 56, rep: 36 },
  { issue: "Crime",         dem: 39, rep: 52 },
  { issue: "Foreign Policy",dem: 47, rep: 44 },
  { issue: "Education",     dem: 52, rep: 38 },
];

// ─── Small UI atoms ──────────────────────────────────────────
function Eyebrow({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "red" | "blue" | "purple" }) {
  const colors: Record<string, string> = {
    neutral: "text-slate-500",
    red:     "text-red-600",
    blue:    "text-blue-600",
    purple:  "text-violet-600",
  };
  return (
    <span className={`v2-eyebrow ${colors[tone]}`}>{children}</span>
  );
}

function StatPill({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "red" | "blue" | "purple" | "green" }) {
  return (
    <div className={`v2-stat v2-stat-${tone}`}>
      <div className="v2-stat-label">{label}</div>
      <div className="v2-stat-value">{value}</div>
    </div>
  );
}

function SplitBar({ a, b, aColor = "#1d5fc4", bColor = "#c22f3b" }: { a: number; b: number; aColor?: string; bColor?: string }) {
  const total = a + b || 1;
  const ap = (a / total) * 100;
  return (
    <div className="v2-splitbar">
      <div style={{ width: `${ap}%`, background: aColor }} />
      <div style={{ width: `${100 - ap}%`, background: bColor }} />
    </div>
  );
}

function MiniSpark({ data, dataKey, color }: { data: Array<Record<string, number>>; dataKey: string; color: string }) {
  return (
    <div style={{ height: 44, marginTop: 8 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={`g-${dataKey}-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.75} fill={`url(#g-${dataKey}-${color.replace('#','')})`} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Chart card ──────────────────────────────────────────────
function V2ChartCard({
  title, sub, href, data, lines, domain, refY, stats,
}: {
  title: string;
  sub: string;
  href: string;
  data: Array<Record<string, number>>;
  lines: { key: string; name: string; color: string }[];
  domain?: [number, number];
  refY?: number;
  stats: { label: string; val: string; color: string }[];
}) {
  return (
    <div className="v2-card v2-chartcard">
      <div className="v2-chartcard-head">
        <div>
          <div className="v2-chartcard-title">{title}</div>
          <div className="v2-chartcard-sub">{sub}</div>
        </div>
        <Link href={href} className="v2-link-small">Full data →</Link>
      </div>

      <div style={{ height: 220, marginTop: 4 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="d" hide />
            <YAxis domain={domain ?? ["auto", "auto"]} tickLine={false} axisLine={false} width={36} tick={{ fill: "var(--v2-muted)", fontSize: 10 }} />
            {refY !== undefined && (
              <ReferenceLine y={refY} stroke="rgba(15,16,32,0.10)" strokeDasharray="3 3" />
            )}
            <Tooltip
              contentStyle={{
                background: "rgba(255,255,255,0.98)",
                border: "1px solid var(--v2-border)",
                borderRadius: 12,
                boxShadow: "0 10px 30px rgba(15,16,32,0.10)",
                fontSize: 12,
              }}
              labelStyle={{ display: "none" }}
            />
            {lines.map(l => (
              <Line key={l.key} type="monotone" dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={2} dot={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="v2-chartcard-stats">
        {stats.map(s => (
          <div key={s.label} className="v2-chartcard-stat">
            <div className="v2-chartcard-stat-label">{s.label}</div>
            <div className="v2-chartcard-stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PAGE ────────────────────────────────────────────────────
export default function HomeV2() {
  return (
    <>
      <style jsx global>{`
        :root {
          --v2-bg:       #f7f7f4;
          --v2-bg-2:     #eef0f6;
          --v2-surface:  #ffffff;
          --v2-surface-2:#fbfbfd;
          --v2-ink:      #17171b;
          --v2-ink-2:    #2b2f44;
          --v2-muted:    #6b7088;
          --v2-muted-2:  #9aa0b4;
          --v2-border:   rgba(15, 16, 32, 0.08);
          --v2-border-2: rgba(15, 16, 32, 0.14);
          --v2-red:      #c22f3b;
          --v2-blue:     #1d5fc4;
          --v2-purple:   #6d3ee9;
          --v2-green:    #16a34a;
          --v2-shadow-sm: 0 1px 2px rgba(15,16,32,0.04), 0 1px 4px rgba(15,16,32,0.04);
          --v2-shadow-md: 0 4px 12px rgba(15,16,32,0.05), 0 12px 32px rgba(15,16,32,0.07);
          --v2-shadow-lg: 0 6px 16px rgba(15,16,32,0.05), 0 24px 64px rgba(15,16,32,0.10);
        }

        body { background: var(--v2-bg); color: var(--v2-ink); }
      `}</style>

      <style jsx>{`
        .v2-page {
          min-height: 100vh;
          background:
            radial-gradient(ellipse 70% 50% at 0% 0%, rgba(109, 62, 233,0.06) 0%, transparent 60%),
            radial-gradient(ellipse 60% 40% at 100% 0%, rgba(29, 95, 196,0.06) 0%, transparent 60%),
            var(--v2-bg);
          color: var(--v2-ink);
          padding: 48px 24px 96px;
          font-family: var(--font-body);
        }
        .v2-wrap { max-width: 1240px; margin: 0 auto; display: flex; flex-direction: column; gap: 56px; }

        /* HERO */
        .v2-hero {
          display: grid;
          grid-template-columns: 1.35fr 1fr;
          gap: 32px;
          align-items: stretch;
        }
        @media (max-width: 960px) { .v2-hero { grid-template-columns: 1fr; } }

        .v2-hero-left {
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 28px;
          padding: 44px 44px 36px;
          box-shadow: var(--v2-shadow-md);
          position: relative;
          overflow: hidden;
        }
        .v2-hero-left::before {
          content: "";
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 60% 80% at 100% 100%, rgba(109, 62, 233,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        .v2-hero-eyebrow {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(109, 62, 233,0.10);
          color: var(--v2-purple);
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase;
        }
        .v2-hero-eyebrow .dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--v2-purple);
          box-shadow: 0 0 0 4px rgba(109, 62, 233,0.18);
          animation: v2pulse 2.4s ease-in-out infinite;
        }
        @keyframes v2pulse { 0%,100% {opacity:1;} 50% {opacity:.45;} }

        .v2-hero-title {
          font-family: var(--font-display), sans-serif;
          font-size: clamp(40px, 5.5vw, 72px);
          line-height: 0.98;
          letter-spacing: -0.02em;
          font-weight: 800;
          color: var(--v2-ink);
          margin: 20px 0 18px;
          text-transform: none;
        }
        .v2-hero-title em {
          font-style: normal;
          background: linear-gradient(90deg, var(--v2-red) 0%, var(--v2-purple) 50%, var(--v2-blue) 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .v2-hero-lede {
          font-size: 17px;
          line-height: 1.55;
          color: var(--v2-muted);
          max-width: 56ch;
          margin: 0 0 28px;
        }

        .v2-hero-ctas { display: flex; gap: 12px; flex-wrap: wrap; }

        .v2-btn {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 12px 20px;
          border-radius: 999px;
          font-size: 14px; font-weight: 600;
          transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
        }
        .v2-btn-primary {
          background: var(--v2-ink);
          color: #fff;
          box-shadow: var(--v2-shadow-md);
        }
        .v2-btn-primary:hover { transform: translateY(-1px); background: #1a1d34; opacity: 1; }

        .v2-btn-secondary {
          background: var(--v2-surface);
          color: var(--v2-ink);
          border: 1px solid var(--v2-border-2);
        }
        .v2-btn-secondary:hover { background: var(--v2-surface-2); opacity: 1; }

        .v2-hero-meta {
          margin-top: 28px;
          padding-top: 20px;
          border-top: 1px solid var(--v2-border);
          font-size: 12px; color: var(--v2-muted);
          display: flex; gap: 18px; flex-wrap: wrap;
        }
        .v2-hero-meta b { color: var(--v2-ink); font-weight: 600; }

        /* HERO RIGHT — polling index */
        .v2-hero-right {
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 28px;
          padding: 32px;
          box-shadow: var(--v2-shadow-md);
          display: flex; flex-direction: column; gap: 18px;
        }

        .v2-card-head {
          display: flex; justify-content: space-between; align-items: baseline;
        }
        .v2-card-title { font-size: 15px; font-weight: 700; color: var(--v2-ink); letter-spacing: -0.01em; }
        .v2-card-sub { font-size: 12px; color: var(--v2-muted); }

        .v2-metric { padding: 16px 0; border-bottom: 1px solid var(--v2-border); }
        .v2-metric:last-of-type { border-bottom: none; }
        .v2-metric-top { display: flex; justify-content: space-between; align-items: baseline; }
        .v2-metric-label { font-size: 12px; color: var(--v2-muted); font-weight: 500; }
        .v2-metric-value { font-size: 28px; font-weight: 700; letter-spacing: -0.02em; }

        .v2-splitbar {
          display: flex; height: 4px; border-radius: 999px; overflow: hidden; margin-top: 8px;
          background: var(--v2-bg-2);
        }
        .v2-splitbar > div { transition: width 400ms ease; }

        .v2-metric-foot {
          display: flex; justify-content: space-between;
          font-size: 11px; margin-top: 6px;
          font-weight: 500;
        }

        /* SECTION HEADER */
        .v2-section-head {
          display: flex; justify-content: space-between; align-items: end;
          margin-bottom: 20px;
        }
        .v2-section-title {
          font-family: var(--font-display), sans-serif;
          font-size: 28px; font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--v2-ink);
          text-transform: none;
          margin: 0;
        }
        .v2-section-sub { font-size: 13px; color: var(--v2-muted); margin-top: 4px; }
        .v2-link-small {
          font-size: 13px; font-weight: 600; color: var(--v2-ink);
          padding: 8px 14px;
          border: 1px solid var(--v2-border-2);
          border-radius: 999px;
          transition: background 160ms ease;
        }
        .v2-link-small:hover { background: var(--v2-surface-2); opacity: 1; }

        /* CARDS */
        .v2-card {
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 24px;
          padding: 24px;
          box-shadow: var(--v2-shadow-sm);
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
        }
        .v2-card:hover {
          transform: translateY(-2px);
          box-shadow: var(--v2-shadow-md);
          border-color: var(--v2-border-2);
        }

        .v2-charts {
          display: grid; gap: 20px;
          grid-template-columns: repeat(2, 1fr);
        }
        @media (max-width: 820px) { .v2-charts { grid-template-columns: 1fr; } }

        .v2-chartcard-head { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
        .v2-chartcard-title { font-size: 15px; font-weight: 700; color: var(--v2-ink); letter-spacing: -0.01em; }
        .v2-chartcard-sub { font-size: 12px; color: var(--v2-muted); margin-top: 2px; }
        .v2-chartcard-stats {
          display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 12px; margin-top: 8px;
          padding-top: 16px;
          border-top: 1px solid var(--v2-border);
        }
        .v2-chartcard-stat-label { font-size: 11px; color: var(--v2-muted); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 500; }
        .v2-chartcard-stat-val { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-top: 2px; }

        /* ISSUE GRID */
        .v2-issues-grid {
          display: grid; gap: 20px;
          grid-template-columns: 2fr 1fr;
        }
        @media (max-width: 960px) { .v2-issues-grid { grid-template-columns: 1fr; } }

        .v2-issue-table {
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 24px;
          overflow: hidden;
        }
        .v2-issue-row {
          display: grid;
          grid-template-columns: 1.4fr 0.6fr 0.6fr 2fr 0.7fr;
          align-items: center;
          gap: 16px;
          padding: 16px 24px;
          border-bottom: 1px solid var(--v2-border);
        }
        .v2-issue-row:last-child { border-bottom: none; }
        .v2-issue-row.v2-issue-head {
          background: var(--v2-surface-2);
          font-size: 11px; color: var(--v2-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600;
        }
        .v2-issue-name { font-weight: 600; font-size: 14px; }
        .v2-issue-pct { font-weight: 600; font-size: 14px; text-align: right; font-variant-numeric: tabular-nums; }
        .v2-issue-spread {
          display: inline-flex; padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700;
          font-variant-numeric: tabular-nums;
        }

        /* SIDE STACK */
        .v2-side { display: flex; flex-direction: column; gap: 20px; }

        .v2-cta-card {
          background: linear-gradient(135deg, var(--v2-ink) 0%, #1a1d34 100%);
          color: #fff;
          border-radius: 24px;
          padding: 28px;
          box-shadow: var(--v2-shadow-lg);
          position: relative;
          overflow: hidden;
        }
        .v2-cta-card::before {
          content: "";
          position: absolute; inset: 0;
          background:
            radial-gradient(ellipse 80% 60% at 100% 0%, rgba(109, 62, 233,0.30) 0%, transparent 55%),
            radial-gradient(ellipse 70% 50% at 0% 100%, rgba(29, 95, 196,0.18) 0%, transparent 60%);
          pointer-events: none;
        }
        .v2-cta-card > * { position: relative; }
        .v2-cta-title {
          font-family: var(--font-display), sans-serif;
          font-size: 24px; font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.05;
          margin: 8px 0 12px;
          text-transform: none;
          color: #fff;
        }
        .v2-cta-text { color: rgba(255,255,255,0.72); font-size: 14px; line-height: 1.5; margin-bottom: 20px; }
        .v2-cta-btn {
          display: inline-flex; align-items: center; gap: 8px;
          background: #fff; color: var(--v2-ink);
          padding: 11px 18px; border-radius: 999px;
          font-size: 13px; font-weight: 600;
          transition: transform 160ms ease;
        }
        .v2-cta-btn:hover { transform: translateY(-1px); opacity: 1; }

        /* META CARD */
        .v2-meta-card {
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 24px;
          padding: 24px;
          box-shadow: var(--v2-shadow-sm);
        }
        .v2-meta-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 10px 0;
          border-bottom: 1px solid var(--v2-border);
        }
        .v2-meta-row:last-child { border-bottom: none; }
        .v2-meta-row-label { font-size: 12px; color: var(--v2-muted); }
        .v2-meta-row-value { font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; }

        /* EXPLORE */
        .v2-explore {
          display: grid; gap: 20px;
          grid-template-columns: repeat(4, 1fr);
        }
        @media (max-width: 1100px) { .v2-explore { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 560px)  { .v2-explore { grid-template-columns: 1fr; } }

        .v2-explore-card {
          display: block;
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 24px;
          padding: 24px;
          color: var(--v2-ink);
          transition: transform 200ms ease, box-shadow 200ms ease, border-color 200ms ease;
          position: relative;
          overflow: hidden;
        }
        .v2-explore-card:hover {
          transform: translateY(-3px);
          box-shadow: var(--v2-shadow-md);
          border-color: var(--v2-border-2);
          opacity: 1;
        }
        .v2-explore-tag {
          display: inline-flex; padding: 4px 10px;
          border-radius: 999px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 18px;
        }
        .v2-explore-name {
          font-family: var(--font-display), sans-serif;
          font-size: 22px; font-weight: 800;
          letter-spacing: -0.01em;
          color: var(--v2-ink);
          text-transform: none;
          margin-bottom: 8px;
        }
        .v2-explore-desc { font-size: 13px; color: var(--v2-muted); line-height: 1.5; margin-bottom: 18px; }
        .v2-explore-arrow {
          font-size: 13px; font-weight: 600;
          display: inline-flex; align-items: center; gap: 6px;
        }

        /* eyebrow util */
        .v2-eyebrow {
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.08em; text-transform: uppercase;
        }

        /* stat util */
        .v2-stat {
          padding: 14px 16px;
          background: var(--v2-surface);
          border: 1px solid var(--v2-border);
          border-radius: 16px;
          min-width: 130px;
        }
        .v2-stat-label { font-size: 11px; color: var(--v2-muted); font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; }
        .v2-stat-value { font-size: 22px; font-weight: 700; letter-spacing: -0.02em; margin-top: 4px; }
        .v2-stat-red    .v2-stat-value { color: var(--v2-red); }
        .v2-stat-blue   .v2-stat-value { color: var(--v2-blue); }
        .v2-stat-purple .v2-stat-value { color: var(--v2-purple); }
        .v2-stat-green  .v2-stat-value { color: var(--v2-green); }
      `}</style>

      <div className="v2-page">
        <div className="v2-wrap">

          {/* ─── HERO ─── */}
          <section className="v2-hero">
            <div className="v2-hero-left">
              <div className="v2-hero-eyebrow"><span className="dot" /> NATIONAL POLLING INDEX · LIVE</div>
              <h1 className="v2-hero-title">
                Tracking what <em>America</em> thinks — daily.
              </h1>
              <p className="v2-hero-lede">
                A continuously updated database of presidential approval, the generic ballot, direction of country, and every major race.
                All averages derived from raw poll inputs through our weighted daily model.
              </p>
              <div className="v2-hero-ctas">
                <Link href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6" target="_blank" rel="noopener noreferrer" className="v2-btn v2-btn-primary">
                  Take the Survey →
                </Link>
                <Link href="/results" className="v2-btn v2-btn-secondary">Live Results</Link>
                <Link href="/forecastratings" className="v2-btn v2-btn-secondary">Forecast Ratings</Link>
              </div>
              <div className="v2-hero-meta">
                <span>Latest poll: <b>Emerson</b></span>
                <span>Date: <b>{TODAY}</b></span>
                <span>n=<b>1,000</b></span>
              </div>
            </div>

            <div className="v2-hero-right">
              <div className="v2-card-head">
                <div>
                  <div className="v2-card-title">Polling Index</div>
                  <div className="v2-card-sub">National averages · updated continuously</div>
                </div>
                <Link href="/polling" className="v2-link-small">All polls →</Link>
              </div>

              {[
                { label: "Trump Approval",        value: `${approve}%`, color: "#1d5fc4", a: approve, b: disapprove, la: `${approve}% App`, lb: `${disapprove}% Dis` },
                { label: "Right / Wrong Track",   value: `${wt}%`,      color: "#c22f3b", a: rt, b: wt, la: `${rt}% Right`, lb: `${wt}% Wrong` },
                { label: "Generic Ballot",        value: `${gbNet >= 0 ? "D+" : "R+"}${Math.abs(gbNet).toFixed(1)}`, color: gbNet >= 0 ? "#1d5fc4" : "#c22f3b", a: dem, b: rep, la: `D ${dem}%`, lb: `R ${rep}%` },
              ].map(m => (
                <div key={m.label} className="v2-metric">
                  <div className="v2-metric-top">
                    <span className="v2-metric-label">{m.label}</span>
                    <span className="v2-metric-value" style={{ color: m.color }}>{m.value}</span>
                  </div>
                  <SplitBar a={m.a} b={m.b} />
                  <div className="v2-metric-foot">
                    <span style={{ color: "#1d5fc4" }}>{m.la}</span>
                    <span style={{ color: "#c22f3b" }}>{m.lb}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── CHARTS ─── */}
          <section>
            <div className="v2-section-head">
              <div>
                <h2 className="v2-section-title">Polling averages</h2>
                <div className="v2-section-sub">Weighted daily model across all qualifying public polls.</div>
              </div>
              <Link href="/polling" className="v2-link-small">All averages →</Link>
            </div>

            <div className="v2-charts">
              <V2ChartCard
                title="Presidential Approval" sub="weighted national average"
                href="/polling/donaldtrumpapproval" data={trumpSeries}
                lines={[
                  { key: "a", name: "Approve",    color: "#c22f3b" },
                  { key: "b", name: "Disapprove", color: "#1d5fc4" },
                ]}
                domain={[30, 65]} refY={50}
                stats={[
                  { label: "Approve",    val: `${approve}%`,    color: "#c22f3b" },
                  { label: "Disapprove", val: `${disapprove}%`, color: "#1d5fc4" },
                  { label: "Net",        val: `${(approve - disapprove).toFixed(1)}`, color: approve > disapprove ? "#c22f3b" : "#1d5fc4" },
                ]}
              />
              <V2ChartCard
                title="Right / Wrong Track" sub="national consumer sentiment"
                href="/polling/rightorwrongtrack" data={rtSeries}
                lines={[
                  { key: "a", name: "Right Track", color: "#c22f3b" },
                  { key: "b", name: "Wrong Track", color: "#1d5fc4" },
                ]}
                domain={[20, 80]}
                stats={[
                  { label: "Right", val: `${rt}%`, color: "#c22f3b" },
                  { label: "Wrong", val: `${wt}%`, color: "#1d5fc4" },
                  { label: "Net",   val: `${(rt - wt).toFixed(1)}`, color: rt > wt ? "#c22f3b" : "#1d5fc4" },
                ]}
              />
              <V2ChartCard
                title="Generic Congressional Ballot" sub="who voters back for U.S. House"
                href="/polling/genericballot" data={gbSeries}
                lines={[
                  { key: "a", name: "Democrat",   color: "#1d5fc4" },
                  { key: "b", name: "Republican", color: "#c22f3b" },
                ]}
                domain={[35, 58]} refY={50}
                stats={[
                  { label: "Democrat",   val: `${dem}%`, color: "#1d5fc4" },
                  { label: "Republican", val: `${rep}%`, color: "#c22f3b" },
                  { label: "Margin",     val: `${gbNet >= 0 ? "D+" : "R+"}${Math.abs(gbNet).toFixed(1)}`, color: gbNet >= 0 ? "#1d5fc4" : "#c22f3b" },
                ]}
              />
              <V2ChartCard
                title="TX Senate GOP Runoff" sub="Paxton vs Cornyn · May 26"
                href="/results" data={ky04Series}
                lines={[
                  { key: "a", name: "Paxton", color: "#c22f3b" },
                  { key: "b", name: "Cornyn", color: "#6d3ee9" },
                ]}
                domain={[35, 70]} refY={50}
                stats={[
                  { label: "Paxton", val: "58%", color: "#c22f3b" },
                  { label: "Cornyn", val: "42%", color: "#6d3ee9" },
                  { label: "Margin", val: "R+16",  color: "#c22f3b" },
                ]}
              />
            </div>
          </section>

          {/* ─── ISSUES + CTA + META ─── */}
          <section>
            <div className="v2-section-head">
              <div>
                <h2 className="v2-section-title">Issue sentiment</h2>
                <div className="v2-section-sub">Which party voters trust most on each issue · ±2.0 pp MoE.</div>
              </div>
              <Link href="/results" className="v2-link-small">All issues →</Link>
            </div>

            <div className="v2-issues-grid">
              <div className="v2-issue-table">
                <div className="v2-issue-row v2-issue-head">
                  <div>Issue</div>
                  <div style={{ textAlign: "right" }}>Dem</div>
                  <div style={{ textAlign: "right" }}>Rep</div>
                  <div>Share</div>
                  <div style={{ textAlign: "right" }}>Lean</div>
                </div>
                {issues.map(r => {
                  const lean = r.rep - r.dem;
                  const sign = lean >= 0 ? "R+" : "D+";
                  const color = lean >= 0 ? "var(--v2-red)" : "var(--v2-blue)";
                  const bg    = lean >= 0 ? "rgba(194, 47, 59,0.10)" : "rgba(29, 95, 196,0.10)";
                  return (
                    <div key={r.issue} className="v2-issue-row">
                      <div className="v2-issue-name">{r.issue}</div>
                      <div className="v2-issue-pct" style={{ color: "var(--v2-blue)" }}>{r.dem}%</div>
                      <div className="v2-issue-pct" style={{ color: "var(--v2-red)" }}>{r.rep}%</div>
                      <SplitBar a={r.dem} b={r.rep} />
                      <div style={{ textAlign: "right" }}>
                        <span className="v2-issue-spread" style={{ background: bg, color }}>{sign}{Math.abs(lean)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="v2-side">
                <div className="v2-cta-card">
                  <Eyebrow tone="purple">Participate</Eyebrow>
                  <div className="v2-cta-title">Shape the next data release.</div>
                  <div className="v2-cta-text">
                    Join the national baseline survey. Under three minutes. Your response is weighted into our daily model.
                  </div>
                  <Link href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6" target="_blank" rel="noopener noreferrer" className="v2-cta-btn">
                    Take the Survey →
                  </Link>
                </div>

                <div className="v2-meta-card">
                  <div className="v2-card-head" style={{ marginBottom: 12 }}>
                    <div className="v2-card-title">Model status</div>
                    <Eyebrow tone="purple">Live</Eyebrow>
                  </div>
                  {[
                    { l: "Approval polls",      v: "162" },
                    { l: "Generic ballot polls", v: "84" },
                    { l: "Right-track polls",    v: "73" },
                    { l: "Latest update",        v: TODAY },
                  ].map(r => (
                    <div key={r.l} className="v2-meta-row">
                      <span className="v2-meta-row-label">{r.l}</span>
                      <span className="v2-meta-row-value">{r.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* ─── EXPLORE ─── */}
          <section>
            <div className="v2-section-head">
              <div>
                <h2 className="v2-section-title">Explore</h2>
                <div className="v2-section-sub">Everything PSI publishes, in one place.</div>
              </div>
            </div>
            <div className="v2-explore">
              {[
                { tag: "Analysis",    name: "Electoral Map",          desc: "State-by-state data with 2024 vs 2026 overlays.",  href: "/electoralmap",    tone: "blue"   },
                { tag: "Projections", name: "Forecast Ratings",        desc: "Race ratings across Senate, House and governors.", href: "/forecastratings", tone: "purple" },
                { tag: "Results",     name: "Live Election Results",   desc: "Real-time vote totals and night-of projections.",  href: "/results",         tone: "red"    },
                { tag: "Methodology", name: "Gold-Standard Polls",     desc: "Curated aggregation ranked by historical accuracy.", href: "/goldstandard",  tone: "neutral"},
              ].map(c => {
                const toneColors: Record<string, { text: string; bg: string }> = {
                  blue:    { text: "var(--v2-blue)",    bg: "rgba(29, 95, 196,0.10)" },
                  red:     { text: "var(--v2-red)",     bg: "rgba(194, 47, 59,0.10)" },
                  purple:  { text: "var(--v2-purple)",  bg: "rgba(109, 62, 233,0.10)" },
                  neutral: { text: "var(--v2-ink-2)",   bg: "rgba(15,16,32,0.06)"  },
                };
                const tc = toneColors[c.tone];
                return (
                  <Link key={c.name} href={c.href} className="v2-explore-card">
                    <span className="v2-explore-tag" style={{ color: tc.text, background: tc.bg }}>{c.tag}</span>
                    <div className="v2-explore-name">{c.name}</div>
                    <div className="v2-explore-desc">{c.desc}</div>
                    <span className="v2-explore-arrow" style={{ color: tc.text }}>{c.tag === "Results" ? "See results" : c.tag === "Methodology" ? "Browse polls" : "Open"} →</span>
                  </Link>
                );
              })}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}
