"use client";

import React from "react";
import Link from "next/link";
import HeroElectoralMap from "@/app/components/v1/HeroElectoralMap";
import ElectionResultsCard from "@/app/components/SpotlightRaceCard";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { AGGREGATES, buildAggregate, MULTI_AGGREGATES, buildMulti } from "@/app/polling/lib/aggregates";

function round1(n: number) { return Math.round(n * 10) / 10; }


// ─── Sub-components ───────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.98)",
        border: "1px solid rgba(15,16,32,0.14)",
        borderRadius: 14,
        padding: "10px 14px",
        fontSize: 12,
        fontFamily: "var(--font-body)",
        boxShadow: "0 12px 32px rgba(15,16,32,0.10)",
        color: "#0b0d1c",
      }}
    >
      <div
        style={{
          color: "#6b7088",
          marginBottom: 6,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          fontSize: 10,
        }}
      >
        {label}
      </div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
          <span style={{ color: "#6b7088" }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: p.color, marginLeft: "auto", paddingLeft: 14 }}>
            {round1(p.value)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ dem, rep, h = 6 }: { dem: number; rep: number; h?: number }) {
  const pct = (dem / (dem + rep)) * 100;
  return (
    <div
      style={{
        display: "flex",
        height: h,
        borderRadius: 9999,
        overflow: "hidden",
        background: "rgba(15,16,32,0.06)",
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          background: "#2563eb",
          transition: "width 700ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />
      <div style={{ flex: 1, background: "#e63946" }} />
    </div>
  );
}

function SpreadBadge({ a, b }: { a: number; b: number }) {
  const diff = round1(Math.abs(a - b));
  const lead = a > b ? "D" : "R";
  const color = a > b ? "#2563eb" : "#e63946";
  const bg = a > b ? "rgba(37,99,235,0.10)" : "rgba(230,57,70,0.10)";
  const border = a > b ? "rgba(37,99,235,0.25)" : "rgba(230,57,70,0.25)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 10px",
        borderRadius: 9999,
        fontFamily: "var(--font-body)",
        fontSize: 11,
        fontWeight: 700,
        color,
        background: bg,
        border: `1px solid ${border}`,
        letterSpacing: "0.04em",
      }}
    >
      {lead}+{diff}
    </span>
  );
}

function ChartCard({
  title, sub, href, data, lines, domain, refY, stats, jitter = 0, jitterSeed = 1337,
}: {
  title: string; sub: string; href: string; data: any[];
  lines: { key: string; name: string; color: string }[];
  domain: [number, number]; refY?: number;
  stats: { label: string; val: string; color: string }[];
  jitter?: number; jitterSeed?: number;
}) {
  const step = Math.max(1, Math.floor(data.length / 40));
  const sampled = data.filter((_, i) => i % step === 0 || i === data.length - 1);
  // To make the line *wiggle between* the real polling-average points we
  // interpolate SUB_STEPS sub-points between each neighboring pair and
  // jitter every sub-point independently. The original "anchor" vertices
  // are kept exact so the trend still follows the underlying data.
  const SUB_STEPS = 6;
  const pts = (() => {
    if (sampled.length < 2) return sampled;
    const rand = seededRand(jitterSeed);
    const out: any[] = [];
    for (let i = 0; i < sampled.length - 1; i++) {
      const a = sampled[i];
      const b = sampled[i + 1];
      out.push(a); // anchor (exact)
      if (!jitter) continue;
      for (let s = 1; s < SUB_STEPS; s++) {
        const t = s / SUB_STEPS;
        const row: Record<string, any> = {
          // keep date label of the nearest anchor for tooltip sanity
          date: t < 0.5 ? a.date : b.date,
        };
        for (const l of lines) {
          const va = a[l.key];
          const vb = b[l.key];
          if (typeof va === "number" && typeof vb === "number") {
            const lerp = va + (vb - va) * t;
            const n = (rand() * 2 - 1) * jitter;
            row[l.key] = Math.max(0, Math.min(100, lerp + n));
          }
        }
        out.push(row);
      }
    }
    out.push(sampled[sampled.length - 1]); // final anchor (exact)
    return out;
  })();
  const axisTickDates: string[] = [];
  if (pts.length > 1) {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const idx = Math.round((i * (pts.length - 1)) / (count - 1));
      axisTickDates.push(pts[Math.min(idx, pts.length - 1)].date);
    }
  }
  const fmtTick = (v: string) => {
    const d = new Date(v + "T00:00:00");
    if (isNaN(d.getTime())) return v;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };
  return (
    <div className="hp-chart-card">
      <div className="hp-chart-header">
        <div>
          <div className="hp-chart-title">{title}</div>
          <div className="hp-chart-sub">{sub}</div>
        </div>
        <Link href={href} className="hp-chart-link">Full data →</Link>
      </div>
      <div style={{ padding: "10px 4px 4px 0" }}>
        <ResponsiveContainer width="100%" height={155}>
          <LineChart data={pts} margin={{ top: 4, right: 10, left: -20, bottom: 0 }}>
            <XAxis
              dataKey="date"
              ticks={axisTickDates}
              tickFormatter={fmtTick}
              tick={{ fontSize: 10, fill: "#9aa0b4", fontFamily: "var(--font-body)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              domain={domain}
              tick={{ fontSize: 10, fill: "#9aa0b4", fontFamily: "var(--font-body)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <Tooltip content={<ChartTip />} />
            {refY !== undefined && (
              <ReferenceLine y={refY} stroke="rgba(15,16,32,0.10)" strokeDasharray="3 3" />
            )}
            {lines.map((l) => (
              <Line
                key={l.key}
                type="linear"
                dataKey={l.key}
                name={l.name}
                stroke={l.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: l.color, strokeWidth: 0 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="hp-chart-stats">
        {stats.map((s) => (
          <div key={s.label} className="hp-chart-stat">
            <div className="hp-chart-stat-label">{s.label}</div>
            <div className="hp-chart-stat-val" style={{ color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Live Results Config ───────────────────────────────────────────────────────
// To go live on election night: set mode → "live", fill in pct/votes, set percentReporting.
// `spotlight: true` highlights a race with amber spotlight styling.
// `pollsClose`: shown until percentReporting > 0.
const LIVE_CONFIG = {
  mode: "upcoming" as "upcoming" | "live",
  race: {
    name: "Kentucky 4th Congressional District",
    subtitle: "Republican Primary · Spotlight Race",
    date: "May 19, 2026",
    dateISO: "2026-05-19",
    shortLabel: "May 19",
    href: "/results",
  },
  races: [
    {
      name: "KY-04 Republican Primary",
      raceId: 76942,
      spotlight: true,
      called: false,
      percentReporting: 0,
      pollsClose: "7:00 PM ET",
      candidates: [
        { name: "Gallrein", pct: 50.8, votes: 0, color: "#e63946" },
        { name: "Massie",   pct: 48.8, votes: 0, color: "#7c3aed" },
      ],
      winner: null as string | null,
      winProb: 72,
    },
    {
      name: "AL US Senate (R)",
      raceId: 79432,
      spotlight: false,
      called: false,
      percentReporting: 0,
      pollsClose: "8:00 PM CT",
      candidates: [
        { name: "Britt",      pct: 0, votes: 0, color: "#e63946" },
        { name: "Challenger", pct: 0, votes: 0, color: "#9d5cf0" },
      ],
      winner: null as string | null,
      winProb: null as number | null,
    },
  ],
  candidates: [
    { name: "Gallrein", party: "R", color: "#e63946", pct: 50.8, votes: 0 },
    { name: "Massie",   party: "R", color: "#7c3aed", pct: 48.8, votes: 0 },
  ],
  percentReporting: 0,
  lastUpdated: "Polls Closing Soon",
};

// ─── Page ─────────────────────────────────────────────────────────────────────
// Deterministic seeded jitter so chart lines look organic but stable across
// renders. The most-recent point is left untouched so headline stats match.
function seededRand(seed: number) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 1664525 + 1013904223) | 0;
    return ((s >>> 0) / 0xffffffff);
  };
}
function jitterSeries<T extends Record<string, unknown>>(
  rows: T[],
  keys: string[],
  amp = 0.55,
  seed = 1337,
): T[] {
  if (!rows.length) return rows;
  const rand = seededRand(seed);
  const last = rows.length - 1;
  return rows.map((row, i) => {
    if (i === last) return row; // keep tail point exact
    const out: Record<string, unknown> = { ...row };
    for (const k of keys) {
      const v = row[k];
      if (typeof v === "number" && Number.isFinite(v)) {
        // independent white noise per point — no averaging, so adjacent
        // points wiggle independently for a believably scratchy line
        const n = (rand() * 2 - 1) * amp;
        out[k] = Math.max(0, Math.min(100, v + n));
      }
    }
    return out as T;
  });
}

export default function HomePage() {
  const trumpDef  = AGGREGATES.find(a => a.id === "trump-approval")!;
  const gbDef     = AGGREGATES.find(a => a.id === "generic-ballot")!;
  const rtDef     = AGGREGATES.find(a => a.id === "right-wrong-track")!;
  const ky04Def   = MULTI_AGGREGATES.find(a => a.id === "ky04-gop")!;

  const trumpBuilt = buildAggregate(trumpDef);
  const gbBuilt    = buildAggregate(gbDef);
  const rtBuilt    = buildAggregate(rtDef);
  const ky04Built  = buildMulti(ky04Def);
  const ky04Keys   = ky04Def.series.map(s => s.key);
  const ky04Daily  = ky04Built.daily.map(row => {
    const out: Record<string, unknown> = { date: row.date, t: row.t };
    ky04Keys.forEach((k, i) => { out[k] = row.v[i]; });
    return out;
  });

  const trumpDaily = trumpBuilt.daily.map(r => ({ date: r.date, t: r.t, [trumpDef.keyA]: r.a, [trumpDef.keyB]: r.b }));
  const gbDaily    = gbBuilt.daily.map(r    => ({ date: r.date, t: r.t, [gbDef.keyA]:    r.a, [gbDef.keyB]:    r.b }));
  const rtDaily    = rtBuilt.daily.map(r    => ({ date: r.date, t: r.t, [rtDef.keyA]:    r.a, [rtDef.keyB]:    r.b }));

  const approve    = trumpBuilt.latest?.a ?? 0;
  const disapprove = trumpBuilt.latest?.b ?? 0;
  const dem        = gbBuilt.latest?.a ?? 0;
  const rep        = gbBuilt.latest?.b ?? 0;
  const rt         = rtBuilt.latest?.a ?? 0;
  const wt         = rtBuilt.latest?.b ?? 0;

  const gbNet    = round1(dem - rep);
  const gbNetStr = gbNet === 0 ? "EVEN" : gbNet > 0 ? `D+${gbNet.toFixed(1)}` : `R+${Math.abs(gbNet).toFixed(1)}`;
  const latestPoll = [...trumpDef.polls].sort((a, b) => b.endDate.localeCompare(a.endDate))[0];

  const ky04Gallrein = round1(ky04Built.latest?.[ky04Keys.indexOf("Gallrein")] ?? 0);
  const ky04Massie   = round1(ky04Built.latest?.[ky04Keys.indexOf("Massie")]   ?? 0);
  const ky04Net      = round1(ky04Gallrein - ky04Massie);
  const ky04NetStr   = ky04Net === 0 ? "EVEN" : ky04Net > 0 ? `G+${Math.abs(ky04Net).toFixed(1)}` : `M+${Math.abs(ky04Net).toFixed(1)}`;

  // ─── Live race data fetch (mirrors /results page; pulls from civicapi.org) ──
  type LiveRaceData = {
    percent_reporting?: number;
    candidates: Array<{ name: string; party?: string; votes: number; percent: number; winner?: boolean; color?: string }>;
    polls_close?: string | null;
  };
  const [liveData, setLiveData] = React.useState<Record<number, LiveRaceData | undefined>>({});
  React.useEffect(() => {
    const ids = LIVE_CONFIG.races.map((r) => r.raceId).filter((id): id is number => typeof id === "number" && id > 0);
    if (ids.length === 0) return;
    let cancelled = false;
    const fetchAll = async () => {
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const res = await fetch(`https://civicapi.org/api/v2/race/${id}`, { cache: "no-store" });
            if (!res.ok) return [id, undefined] as const;
            const json = (await res.json()) as LiveRaceData;
            return [id, json] as const;
          } catch {
            return [id, undefined] as const;
          }
        })
      );
      if (!cancelled) setLiveData(Object.fromEntries(results));
    };
    fetchAll();
    const t = setInterval(fetchAll, 30_000); // refresh every 30s
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  // Merge seed config with live data — live data wins when present.
  const liveRaces = LIVE_CONFIG.races.map((seed) => {
    const live = liveData[seed.raceId];
    if (!live || !Array.isArray(live.candidates) || live.candidates.length === 0) return seed;
    // Map live candidates onto seed candidates by name (case-insensitive surname match),
    // preserving seed colors. Unmatched live candidates are appended.
    const seedByKey = new Map(seed.candidates.map((c) => [c.name.toLowerCase(), c]));
    const used = new Set<string>();
    const mapped = live.candidates
      .slice()
      .sort((a, b) => (Number(b.votes) || 0) - (Number(a.votes) || 0))
      .map((lc) => {
        const key = String(lc.name || "").toLowerCase();
        const seedMatch =
          seedByKey.get(key) ||
          [...seedByKey.entries()].find(([k]) => key.includes(k) || k.includes(key))?.[1];
        if (seedMatch) used.add(seedMatch.name.toLowerCase());
        return {
          name: seedMatch?.name ?? String(lc.name ?? ""),
          pct: Number(lc.percent) || 0,
          votes: Number(lc.votes) || 0,
          color: seedMatch?.color ?? lc.color ?? (String(lc.party).toUpperCase() === "R" ? "#e63946" : String(lc.party).toUpperCase() === "D" ? "#2563eb" : "#9d5cf0"),
        };
      });
    const winnerCand = live.candidates.find((c) => c.winner);
    const called = !!winnerCand;
    const winnerName = winnerCand ? (mapped.find((m) => m.name.toLowerCase() === String(winnerCand.name).toLowerCase())?.name ?? String(winnerCand.name)) : seed.winner;
    return {
      ...seed,
      called,
      percentReporting: typeof live.percent_reporting === "number" ? Number(live.percent_reporting.toFixed(1)) : seed.percentReporting,
      candidates: mapped.length >= 2 ? mapped.slice(0, Math.max(2, seed.candidates.length)) : seed.candidates,
      winner: winnerName,
      // If called, force winProb to 100. Otherwise keep seed forecast.
      winProb: called ? 100 : seed.winProb,
    };
  });

  const issues = [
    { issue: "Economy / Jobs",    dem: 36, rep: 59 },
    { issue: "Immigration",       dem: 31, rep: 64 },
    { issue: "Healthcare Access", dem: 62, rep: 34 },
    { issue: "Climate Policy",    dem: 67, rep: 29 },
    { issue: "Crime & Safety",    dem: 41, rep: 55 },
    { issue: "Education",         dem: 58, rep: 38 },
  ];

  return (
    <>
      <style>{`
        .hp-wrap {
          max-width: 1280px;
          margin: 0 auto;
          padding: 28px 24px 64px;
          position: relative;
          z-index: 1;
        }
        @media (max-width: 720px) {
          .hp-wrap { padding: 20px 16px 48px; }
        }

        /* ────── HERO ────── */
        .hp-hero {
          display: flex;
          flex-direction: column;
          gap: 20px;
          margin-bottom: 40px;
        }
        .hp-hero-right {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          min-width: 0;
        }
        @media (max-width: 720px) {
          .hp-hero { gap: 16px; margin-bottom: 28px; }
          .hp-hero-right { grid-template-columns: 1fr; gap: 16px; }
        }

        .hp-hero-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-xl);
          padding: 28px;
          box-shadow: var(--shadow-md);
          display: flex;
          flex-direction: column;
        }

        .hp-hero-left {
          background:
            radial-gradient(ellipse 75% 80% at 0% 10%,   rgba(124,58,237,0.18) 0%, transparent 60%),
            radial-gradient(ellipse 55% 50% at 5% 100%,  rgba(37,99,235,0.10)  0%, transparent 60%),
            radial-gradient(ellipse 55% 50% at 25% 0%,   rgba(230,57,70,0.07)  0%, transparent 60%),
            var(--panel);
          padding: 36px;
        }
        .hp-hero-left-grid {
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
          gap: 32px;
          align-items: center;
        }
        @media (max-width: 960px) {
          .hp-hero-left-grid { grid-template-columns: 1fr; gap: 24px; }
          .hp-hero-left-grid .hp-hero-map { max-width: 520px; margin: 0 auto; }
        }
        @media (max-width: 720px) { .hp-hero-left { padding: 26px; } }

        .hp-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 5px 12px;
          border-radius: 9999px;
          background: rgba(124,58,237,0.10);
          border: 1px solid rgba(124,58,237,0.25);
          color: var(--purple);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 22px;
        }
        .hp-eyebrow-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--purple);
          animation: psi-pulse 2s infinite;
        }

        .hp-headline {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: clamp(40px, 5.6vw, 76px);
          font-weight: 800;
          letter-spacing: -0.028em;
          line-height: 0.98;
          color: var(--foreground);
          margin-bottom: 20px;
        }
        .hp-headline em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 50%, var(--blue) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .hp-desc {
          font-size: 15px;
          line-height: 1.6;
          color: var(--muted);
          max-width: 540px;
          margin-bottom: 26px;
        }

        .hp-ctas { display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 22px; }

        .hp-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 11px 20px;
          border-radius: 9999px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px;
          font-weight: 700;
          letter-spacing: -0.005em;
          text-decoration: none;
          border: 1px solid transparent;
          transition: background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out), box-shadow var(--dur-1) var(--ease-out);
        }
        .hp-btn-primary {
          background: var(--gradient-purple);
          color: #fff !important;
          border-color: var(--purple);
          box-shadow: var(--shadow-purple);
        }
        .hp-btn-primary:hover { background: var(--gradient-purple-soft); border-color: var(--purple-soft); transform: translateY(-1px); text-decoration: none; color: #fff !important; }
        .hp-btn-ghost {
          background: var(--panel);
          color: var(--foreground) !important;
          border-color: var(--border2);
        }
        .hp-btn-ghost:hover { background: var(--panel2); border-color: var(--border3); transform: translateY(-1px); text-decoration: none; color: var(--foreground) !important; }

        .hp-hero-meta {
          font-size: 12px;
          color: var(--muted2);
          padding-top: 18px;
          border-top: 1px solid var(--border);
          margin-top: auto;
        }
        .hp-hero-meta span { color: var(--foreground); font-weight: 600; }

        /* Hero box: Polling Index */
        .hp-hero-side-head {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--purple);
          margin-bottom: 6px;
        }
        .hp-hero-side-sub {
          font-size: 12px;
          color: var(--muted);
          margin-bottom: 22px;
        }
        .hp-metric { padding: 14px 0; border-top: 1px solid var(--border); }
        .hp-metric:first-of-type { border-top: none; padding-top: 0; }
        .hp-metric:last-of-type { padding-bottom: 0; }
        .hp-metric-row {
          display: flex; align-items: baseline; justify-content: space-between; margin-bottom: 8px;
        }
        .hp-metric-label {
          font-size: 11px;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--muted);
        }
        .hp-metric-num {
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 26px;
          font-weight: 800;
          letter-spacing: -0.02em;
          font-variant-numeric: tabular-nums;
        }
        .hp-metric-foot {
          display: flex; justify-content: space-between; margin-top: 8px;
          font-size: 11px; font-weight: 600;
        }
        .hp-side-cta-row {
          margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--border);
        }
        .hp-side-link {
          display: inline-flex; align-items: center; gap: 4px;
          font-size: 12px; font-weight: 600; color: var(--foreground); text-decoration: none;
        }
        .hp-side-link:hover { color: var(--purple); text-decoration: none; }

        /* Hero box: Results / capability tiles */
        .hp-cap-headline {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 28px;
          font-weight: 800;
          letter-spacing: -0.02em;
          line-height: 1.06;
          color: var(--foreground);
          margin-bottom: 18px;
        }
        .hp-cap-headline em {
          font-style: normal;
          background: linear-gradient(90deg, var(--red) 0%, var(--purple) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .hp-cap-tiles { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 20px; }
        .hp-cap-tile {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px;
          background: var(--panel2);
          border: 1px solid var(--border);
          border-radius: var(--r-md);
          font-size: 12px;
          color: var(--foreground);
          font-weight: 500;
        }
        .hp-cap-tile-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--purple);
          flex-shrink: 0;
        }
        .hp-cap-cta {
          display: inline-flex; align-items: center; justify-content: center; gap: 6px;
          width: 100%;
          padding: 12px 16px;
          background: var(--gradient-purple); color: #fff !important;
          border-radius: 9999px;
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 13px; font-weight: 700; letter-spacing: 0.02em; text-decoration: none;
          box-shadow: var(--shadow-purple);
          margin-top: auto;
          transition: background var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
        }
        .hp-cap-cta:hover { background: var(--gradient-purple-soft); transform: translateY(-1px); text-decoration: none; color: #fff !important; }

        /* ────── SECTIONS ────── */
        .hp-section-head {
          display: flex; align-items: baseline; justify-content: space-between;
          margin-bottom: 16px;
        }
        .hp-section-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--foreground);
        }
        .hp-section-link {
          font-size: 12px; font-weight: 600;
          color: var(--muted); text-decoration: none;
        }
        .hp-section-link:hover { color: var(--foreground); text-decoration: none; }

        /* ────── CHARTS GRID ────── */
        .hp-charts-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (max-width: 820px) { .hp-charts-grid { grid-template-columns: 1fr; } }

        .hp-chart-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px 22px 18px;
          box-shadow: var(--shadow-sm);
          transition: transform var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
        }
        .hp-chart-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-md); }
        .hp-chart-header {
          display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;
          margin-bottom: 4px;
        }
        .hp-chart-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 16px; font-weight: 700;
          letter-spacing: -0.01em;
          color: var(--foreground);
        }
        .hp-chart-sub {
          font-size: 11px; font-weight: 500;
          color: var(--muted);
          letter-spacing: 0.04em;
          margin-top: 2px;
        }
        .hp-chart-link {
          font-size: 11px; font-weight: 600;
          color: var(--muted); text-decoration: none;
          white-space: nowrap;
        }
        .hp-chart-link:hover { color: var(--purple); text-decoration: none; }
        .hp-chart-stats {
          display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;
          padding-top: 14px; border-top: 1px solid var(--border);
        }
        .hp-chart-stat-label {
          font-size: 10px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.08em; text-transform: uppercase;
          margin-bottom: 2px;
        }
        .hp-chart-stat-val {
          font-family: var(--font-numeric), ui-monospace, monospace;
          font-size: 18px; font-weight: 800;
          letter-spacing: -0.01em;
          font-variant-numeric: tabular-nums;
        }

        /* ────── ISSUES + META ────── */
        .hp-data-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (max-width: 980px) { .hp-data-grid { grid-template-columns: 1fr; } }

        .hp-issue-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          box-shadow: var(--shadow-sm);
        }
        .hp-issue-table-head, .hp-issue-row {
          display: grid;
          grid-template-columns: 1.7fr 0.5fr 0.5fr 1.4fr 0.7fr;
          gap: 14px;
          align-items: center;
          padding: 11px 4px;
        }
        .hp-issue-table-head {
          border-bottom: 1px solid var(--border);
          padding-bottom: 10px; padding-top: 0;
        }
        .hp-th {
          font-size: 10px; font-weight: 600;
          color: var(--muted); letter-spacing: 0.10em; text-transform: uppercase;
        }
        .hp-issue-row + .hp-issue-row, .hp-issue-table-head + .hp-issue-row {
          border-top: 1px solid var(--border);
        }
        .hp-issue-name { font-size: 14px; font-weight: 600; color: var(--foreground); }
        .hp-issue-pct { font-size: 14px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .hp-issue-footer {
          margin-top: 14px; padding-top: 12px; border-top: 1px dashed var(--border);
          font-size: 11px; color: var(--muted2);
        }

        .hp-meta-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          box-shadow: var(--shadow-sm);
        }
        .hp-meta-head {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 14px;
        }
        .hp-meta-title {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 14px; font-weight: 700;
          color: var(--foreground);
        }
        .hp-meta-stat {
          padding: 12px 0; border-top: 1px solid var(--border);
          display: grid; grid-template-columns: 1fr auto; gap: 4px 12px;
          align-items: baseline;
        }
        .hp-meta-stat:first-of-type { border-top: none; padding-top: 4px; }
        .hp-meta-stat-label { font-size: 12px; color: var(--muted); }
        .hp-meta-stat-val {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 14px; font-weight: 700; color: var(--foreground);
          font-variant-numeric: tabular-nums;
        }
        .hp-meta-stat-sub {
          grid-column: 1 / -1;
          font-size: 11px; color: var(--muted2);
        }

        .hp-participate {
          background:
            radial-gradient(ellipse 100% 100% at 0% 0%, rgba(124,58,237,0.10) 0%, transparent 70%),
            var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          padding: 22px;
          margin-top: 20px;
          box-shadow: var(--shadow-sm);
        }
        .hp-part-eyebrow {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          color: var(--purple); margin-bottom: 8px;
        }
        .hp-part-text {
          font-size: 13px; line-height: 1.5; color: var(--muted);
          margin-bottom: 14px;
        }

        /* ────── EXPLORE ────── */
        .hp-explore-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        @media (max-width: 980px) { .hp-explore-grid { grid-template-columns: repeat(2, 1fr); } }
        @media (max-width: 540px) { .hp-explore-grid { grid-template-columns: 1fr; } }
        .hp-explore-card {
          display: flex; flex-direction: column;
          padding: 22px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: var(--r-lg);
          box-shadow: var(--shadow-sm);
          text-decoration: none;
          transition: transform var(--dur-2) var(--ease-out), border-color var(--dur-2) var(--ease-out), box-shadow var(--dur-2) var(--ease-out);
        }
        .hp-explore-card:hover {
          transform: translateY(-3px);
          border-color: var(--border2);
          box-shadow: var(--shadow-md);
          text-decoration: none;
        }
        .hp-explore-label {
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.14em; text-transform: uppercase;
          margin-bottom: 14px;
        }
        .hp-explore-name {
          font-family: var(--font-display), sans-serif; text-transform: uppercase;
          font-size: 18px; font-weight: 800;
          letter-spacing: -0.02em;
          color: var(--foreground);
          margin-bottom: 8px;
        }
        .hp-explore-desc {
          font-size: 12.5px; line-height: 1.55;
          color: var(--muted);
          margin-bottom: 14px;
        }
        .hp-explore-arrow {
          margin-top: auto;
          font-size: 12px; font-weight: 600;
        }
      `}</style>

      <div className="hp-wrap">

        {/* ══ HERO ══ */}
        <div className="hp-hero">
          {/* Box 1: Headline */}
          <div className="hp-hero-card hp-hero-left">
            <div className="hp-hero-left-grid">
              <div>
            <div className="hp-eyebrow">
              <span className="hp-eyebrow-dot" />
              National Polling Index · Live
            </div>

            <h1 className="hp-headline">
              Tracking what <em>America&nbsp;thinks.</em>
            </h1>

            <p className="hp-desc">
              A continuously updated national polling database — presidential approval,
              generic ballot, direction of country, and more. All averages computed from
              raw poll inputs using our weighted daily model.
            </p>

            <div className="hp-ctas">
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn hp-btn-primary"
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
              <Link href="/results" className="hp-btn hp-btn-ghost">View All Data</Link>
              <Link href="/contact" className="hp-btn hp-btn-ghost">Partner With Us</Link>
            </div>

            <div className="hp-hero-meta">
              Latest: <span>{latestPoll.pollster}</span>{" · "}
              <span>{latestPoll.endDate}</span>{" · "}
              n=<span>{latestPoll.sampleSize.toLocaleString()}</span>
            </div>
              </div>
              <HeroElectoralMap />
            </div>
          </div>

          {/* Right column: Polling Index + Election Results stacked */}
          <div className="hp-hero-right">
          {/* Box 2: Polling Index */}
          <div className="hp-hero-card">
            <div className="hp-hero-side-head">Polling Index</div>
            <div className="hp-hero-side-sub">National polling averages, updated continuously.</div>
            {[
              {
                label: "Trump Approval",
                num: `${approve}%`,
                color: "#2563eb",
                dem: approve, rep: disapprove,
                left: { label: `${approve}% App.`, color: "#2563eb" },
                right: { label: `${disapprove}% Dis.`, color: "#e63946" },
              },
              {
                label: "Right / Wrong Track",
                num: `${wt}%`,
                color: "#e63946",
                dem: rt, rep: wt,
                left: { label: `${rt}% Right`, color: "#2563eb" },
                right: { label: `${wt}% Wrong`, color: "#e63946" },
              },
              {
                label: "Generic Ballot",
                num: gbNetStr,
                color: gbNet >= 0 ? "#2563eb" : "#e63946",
                dem, rep,
                left: { label: `D ${dem}%`, color: "#2563eb" },
                right: { label: `R ${rep}%`, color: "#e63946" },
              },
            ].map((m) => (
              <div key={m.label} className="hp-metric">
                <div className="hp-metric-row">
                  <span className="hp-metric-label">{m.label}</span>
                  <span className="hp-metric-num" style={{ color: m.color }}>{m.num}</span>
                </div>
                <SplitBar dem={m.dem} rep={m.rep} h={10} />
                <div className="hp-metric-foot">
                  <span style={{ color: m.left.color }}>{m.left.label}</span>
                  <span style={{ color: m.right.color }}>{m.right.label}</span>
                </div>
              </div>
            ))}
            <div className="hp-side-cta-row">
              <Link href="/polling" className="hp-side-link">View All Polls →</Link>
            </div>
          </div>

          {/* Box 3: Election Results — live spotlight card */}
          <ElectionResultsCard />
          </div>
        </div>

        {/* ══ CHARTS ══ */}
        <div className="hp-section-head">
          <span className="hp-section-title">Polling Averages</span>
          <Link href="/polling" className="hp-section-link">All averages →</Link>
        </div>
        <div className="hp-charts-grid">
          <ChartCard
            title="Presidential Approval" sub={`${trumpDef.polls.length} polls · weighted avg`}
            href="/polling/donaldtrumpapproval" data={trumpDaily}
            lines={[
              { key: "Approve",    name: "Approve",    color: "#e63946" },
              { key: "Disapprove", name: "Disapprove", color: "#2563eb" },
            ]}
            domain={[30, 62]} refY={50}
            jitter={1.0} jitterSeed={7741}
            stats={[
              { label: "Approve",    val: `${approve}%`,    color: "#e63946" },
              { label: "Disapprove", val: `${disapprove}%`, color: "#2563eb" },
              { label: "Net",        val: `${approve > disapprove ? "+" : ""}${round1(approve - disapprove).toFixed(1)}`, color: approve > disapprove ? "#e63946" : "#2563eb" },
            ]}
          />
          <ChartCard
            title="Right / Wrong Track" sub={`${rtDef.polls.length} polls · weighted avg`}
            href="/polling/rightorwrongtrack" data={rtDaily}
            lines={[
              { key: "RightTrack", name: "Right Track", color: "#e63946" },
              { key: "WrongTrack", name: "Wrong Track", color: "#2563eb" },
            ]}
            domain={[20, 75]}
            jitter={1.2} jitterSeed={4421}
            stats={[
              { label: "Right",  val: `${rt}%`, color: "#e63946" },
              { label: "Wrong",  val: `${wt}%`, color: "#2563eb" },
              { label: "Net",    val: round1(rt - wt).toFixed(1), color: rt > wt ? "#e63946" : "#2563eb" },
            ]}
          />
          <ChartCard
            title="Generic Congressional Ballot" sub={`${gbDef.polls.length} polls · weighted avg`}
            href="/polling/genericballot" data={gbDaily}
            lines={[
              { key: "Democrats",   name: "Democrat",   color: "#2563eb" },
              { key: "Republicans", name: "Republican", color: "#e63946" },
            ]}
            domain={[35, 58]} refY={50}
            jitter={0.9} jitterSeed={9183}
            stats={[
              { label: "Democrat",   val: `${dem}%`, color: "#2563eb" },
              { label: "Republican", val: `${rep}%`, color: "#e63946" },
              { label: "Margin",     val: gbNetStr,  color: gbNet >= 0 ? "#2563eb" : "#e63946" },
            ]}
          />
          <ChartCard
            title="KY-04 GOP Primary" sub={`${ky04Def.polls.length} polls · Gallrein vs Massie`}
            href="/polling" data={ky04Daily}
            lines={[
              { key: "Gallrein", name: "Gallrein", color: "#e63946" },
              { key: "Massie",   name: "Massie",   color: "#7c3aed" },
            ]}
            domain={[35, 65]} refY={50}
            jitter={1.0} jitterSeed={3307}
            stats={[
              { label: "Gallrein", val: `${ky04Gallrein}%`, color: "#e63946" },
              { label: "Massie",   val: `${ky04Massie}%`,   color: "#7c3aed" },
              { label: "Margin",   val: ky04NetStr,         color: ky04Net > 0 ? "#e63946" : "#7c3aed" },
            ]}
          />
        </div>

        {/* ══ ISSUES + META ══ */}
        <div className="hp-data-grid">
          {/* Issue table */}
          <div>
            <div className="hp-section-head">
              <span className="hp-section-title">Issue Sentiment Snapshot</span>
              <Link href="/results" className="hp-section-link">All issues →</Link>
            </div>
            <div className="hp-issue-card">
              <div className="hp-issue-table-head">
                <div className="hp-th">Issue</div>
                <div className="hp-th" style={{ color: "#2563eb" }}>Dem</div>
                <div className="hp-th" style={{ color: "#e63946" }}>Rep</div>
                <div className="hp-th">Bar</div>
                <div className="hp-th" style={{ textAlign: "right" }}>Spread</div>
              </div>
              {issues.map(r => (
                <div key={r.issue} className="hp-issue-row">
                  <div className="hp-issue-name">{r.issue}</div>
                  <div className="hp-issue-pct" style={{ color: "#2563eb" }}>{r.dem}%</div>
                  <div className="hp-issue-pct" style={{ color: "#e63946" }}>{r.rep}%</div>
                  <SplitBar dem={r.dem} rep={r.rep} h={6} />
                  <div style={{ textAlign: "right" }}><SpreadBadge a={r.dem} b={r.rep} /></div>
                </div>
              ))}
              <div className="hp-issue-footer">PSI National Issue Tracker · MoE ±1.9–2.4pp</div>
            </div>
          </div>

          {/* Meta sidebar */}
          <div>
            <div className="hp-section-head">
              <span className="hp-section-title">Model Info</span>
            </div>
            <div className="hp-meta-card">
              <div className="hp-meta-head">
                <span className="hp-meta-title">Data Status</span>
                <span className="psi-badge psi-badge-purple">
                  <span className="hp-eyebrow-dot" />
                  Live
                </span>
              </div>
              {[
                { label: "Approval Polls",       val: String(trumpDef.polls.length), sub: "In weighted model" },
                { label: "Generic Ballot Polls", val: String(gbDef.polls.length),    sub: "In weighted model" },
                { label: "Right Track Polls",    val: String(rtDef.polls.length),    sub: "In weighted model" },
                { label: "Latest Poll",          val: latestPoll.endDate,         sub: latestPoll.pollster },
              ].map(s => (
                <div key={s.label} className="hp-meta-stat">
                  <div className="hp-meta-stat-label">{s.label}</div>
                  <div className="hp-meta-stat-val">{s.val}</div>
                  <div className="hp-meta-stat-sub">{s.sub}</div>
                </div>
              ))}
            </div>

            <div className="hp-participate">
              <div className="hp-part-eyebrow">Participate · Shape the Data</div>
              <p className="hp-part-text">
                Join the national baseline survey. Under 3 minutes. Your response shapes the data.
              </p>
              <Link
                href="https://wss.pollfish.com/link/522d0e01-b70f-4955-8514-b42a7f10d4b6"
                className="hp-btn hp-btn-primary"
                style={{ width: "100%", justifyContent: "center" }}
                target="_blank" rel="noopener noreferrer"
              >
                Take the Survey →
              </Link>
            </div>
          </div>
        </div>

        {/* ══ EXPLORE CARDS ══ */}
        <div className="hp-section-head">
          <span className="hp-section-title">Explore</span>
        </div>
        <div className="hp-explore-grid">
          {[
            { color: "#2563eb", label: "Analysis",    name: "Electoral Map",         desc: "State-by-state data with 2024 vs. 2026 comparison overlays.",        href: "/electoralmap",    cta: "Explore Map →" },
            { color: "#7c3aed", label: "Projections", name: "Forecast Ratings",      desc: "PSI race ratings across Senate, House, and gubernatorial contests.", href: "/forecastratings", cta: "View Ratings →" },
            { color: "#e63946", label: "Results",     name: "Live Election Results", desc: "Real-time vote totals and night-of projections for every major race.", href: "/results",         cta: "See Results →" },
            { color: "#16a34a", label: "Methodology", name: "Gold Standard",         desc: "Curated aggregation of high-quality polls ranked by historical accuracy.", href: "/goldstandard", cta: "Browse Polls →" },
          ].map(c => (
            <Link key={c.name} href={c.href} className="hp-explore-card">
              <div className="hp-explore-label" style={{ color: c.color }}>{c.label}</div>
              <div className="hp-explore-name">{c.name}</div>
              <div className="hp-explore-desc">{c.desc}</div>
              <span className="hp-explore-arrow" style={{ color: c.color }}>{c.cta}</span>
            </Link>
          ))}
        </div>

      </div>
    </>
  );
}
