"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type Pt = { t: number; v: number };
export type TableRow = { pollster: string; dates: string; sample: string; a: string; b: string; net: string; cls: string };

const RANGES = [["30d", 30], ["90d", 90], ["2026", 0]] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** One polling average card: header pill, range toggle, the chart (poll dots, the daily average
 *  line drawn once, a glow on the latest value) and the poll table with the average row pinned. */
export default function AveragePanel({ title, href, pill, pillCls, color, series, polls, fmt, cols, avgRow, rows }: {
  title: string; href: string; pill: string; pillCls: string; color: string;
  series: Pt[]; polls: Pt[]; fmt: "net" | "gb"; cols: [string, string, string]; avgRow: TableRow; rows: TableRow[];
}) {
  const [range, setRange] = useState<number>(0);
  const end = series.length ? series[series.length - 1].t : Date.now();
  const start = range ? end - range * 864e5 : new Date("2026-01-01T00:00:00").getTime();
  const s = useMemo(() => series.filter((p) => p.t >= start && Number.isFinite(p.v)), [series, start]);
  const d = useMemo(() => polls.filter((p) => p.t >= start && p.t <= end + 864e5 && Number.isFinite(p.v)), [polls, start, end]);
  const W = 600, H = 220, pl = 42, pr = 16, pt = 14, pb = 26;
  const vals = [...s.map((p) => p.v), ...d.map((p) => p.v), 0];
  let lo = Math.floor(Math.min(...vals) / 5) * 5 - 2, hi = Math.ceil(Math.max(...vals) / 5) * 5 + 2;
  if (hi - lo < 10) { lo -= 3; hi += 3; }
  const X = (t: number) => pl + ((t - start) / Math.max(1, end - start)) * (W - pl - pr);
  const Y = (v: number) => pt + ((hi - v) / (hi - lo)) * (H - pt - pb);
  const ticks: number[] = []; for (let v = Math.ceil(lo / 5) * 5; v <= hi; v += 5) ticks.push(v);
  const f = (v: number) => fmt === "gb" ? (v > 0 ? `D+${v}` : v === 0 ? "0" : `R+${-v}`) : v > 0 ? `+${v}` : `${v}`;
  const months: { x: number; l: string }[] = [];
  { const a = new Date(start); a.setDate(1); a.setMonth(a.getMonth() + 1);
    const step = range === 30 ? 1 : range === 90 ? 1 : 2;
    for (let m = new Date(a); m.getTime() <= end; m.setMonth(m.getMonth() + step)) months.push({ x: X(m.getTime()), l: MONTHS[m.getMonth()] }); }
  const line = s.map((p, i) => `${i ? "L" : "M"}${X(p.t).toFixed(1)},${Y(p.v).toFixed(1)}`).join("");
  const last = s[s.length - 1];
  return (
    <div className="card">
      <div className="card-h">
        <h3><Link href={href}>{title}</Link></h3>
        <span className={`pill ${pillCls}`}>{pill}</span>
        <div className="seg" role="tablist" aria-label="Range">
          {RANGES.map(([l, n]) => <button key={l} role="tab" aria-selected={range === n} className={range === n ? "on" : ""} onClick={() => setRange(n)}>{l}</button>)}
        </div>
      </div>
      <div className="card-b" style={{ padding: "8px 12px" }}>
        <svg key={range} className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title} average over time`}>
          {ticks.map((v) => (<g key={v}><line className="grid" x1={pl} x2={W - pr} y1={Y(v)} y2={Y(v)} /><text x={pl - 8} y={Y(v) + 3} textAnchor="end">{f(v)}</text></g>))}
          {months.map((m, i) => <text key={i} x={m.x} y={H - 8} textAnchor="middle">{m.l}</text>)}
          {lo < 0 && hi > 0 && <line x1={pl} x2={W - pr} y1={Y(0)} y2={Y(0)} stroke="rgba(255,255,255,.35)" strokeDasharray="3 4" />}
          {d.map((p, i) => <circle key={i} className="dot" cx={X(p.t)} cy={Y(p.v)} r={2.4} fill={color} opacity={0.3} style={{ animationDelay: `${Math.min(i, 200) * 8}ms` }} />)}
          {line && <path className="line" d={line} stroke={color} />}
          {last && (<>
            <circle className="end" cx={X(last.t)} cy={Y(last.v)} r={4.5} fill={color} style={{ color }} />
            <text x={X(last.t) - 8} y={Y(last.v) - 10} textAnchor="end" style={{ fontWeight: 700, fill: color, fontSize: 12 }}>{pill}</text>
          </>)}
        </svg>
      </div>
      <div className="tblwrap">
        <table className="tbl">
          <thead><tr><th>Pollster</th><th>Dates</th><th>Sample</th><th style={{ textAlign: "right" }}>{cols[0]}</th><th style={{ textAlign: "right" }}>{cols[1]}</th><th style={{ textAlign: "right" }}>{cols[2]}</th></tr></thead>
          <tbody>
            {[avgRow, ...rows].map((r, i) => (
              <tr key={i} className={i === 0 ? "avg" : undefined}>
                <td>{r.pollster}</td><td className="mono" style={{ color: "var(--ink2)", whiteSpace: "nowrap" }}>{r.dates}</td><td className="mono" style={{ color: "var(--ink2)", whiteSpace: "nowrap" }}>{r.sample}</td>
                <td className="n">{r.a}</td><td className="n">{r.b}</td><td className={`n ${r.cls}`}>{r.net}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
