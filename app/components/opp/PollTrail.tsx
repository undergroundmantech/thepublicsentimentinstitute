// PollTrail: every poll of a race as a dot on a margin over time chart, with a kernel smoothed trend line and band.
// Pure SVG with no hooks, so server pages and client components can both draw it. Margins come in as R minus D,
// the model's convention, and are drawn with Democrats up. compact draws a sparkline for tooltips and cards.
import React from "react";
import "./polltrail.css";

export type TrailPoll = { age: number; margin: number; n?: number; pollster?: string; op?: boolean };

const fmt = (v: number, ind?: boolean) => (Math.abs(v) < 0.05 ? "Even" : `${v > 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(v).toFixed(1)}`);
const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h).toString(36); };

export function smoothTrail(polls: TrailPoll[], span = 120) {
  const ps = polls.filter((p) => Number.isFinite(p.margin) && Number.isFinite(p.age) && p.age <= span);
  if (!ps.length) return { ps, line: [] as { t: number; v: number; s: number }[], minT: -30 };
  const oldest = Math.max(...ps.map((p) => p.age));
  const minT = -Math.max(21, Math.min(span, oldest + 4));
  const bw = Math.max(7, Math.min(16, (-minT) / 7));
  const line: { t: number; v: number; s: number }[] = [];
  for (let t = minT; t <= 0; t += 1) {
    let sw = 0, sv = 0;
    const ws = ps.map((p) => { const w = Math.exp(-0.5 * ((t + p.age) / bw) ** 2) * Math.sqrt(Math.max(200, p.n ?? 600)); sw += w; sv += w * -p.margin; return w; });
    if (sw < 1e-6) continue;
    const v = sv / sw;
    let ss = 0; ps.forEach((p, i) => { ss += ws[i] * (-p.margin - v) ** 2; });
    const eff = sw * sw / ws.reduce((a, w) => a + w * w, 0);
    line.push({ t, v, s: Math.sqrt(ss / sw) / Math.sqrt(Math.max(1, eff)) * 1.6 + 0.6 });
  }
  return { ps, line, minT };
}

export default function PollTrail({ polls, avg, asOf, ind, dem = "Democrat", gop = "Republican", compact = false, width = 680, height = 240, uid, span = 120 }:
  { polls: TrailPoll[]; avg?: number | null; asOf?: string; ind?: boolean; dem?: string; gop?: string; compact?: boolean; width?: number; height?: number; uid?: string; span?: number }) {
  const { ps, line, minT } = smoothTrail(polls, span);
  if (ps.length < 1) return compact ? null : <div className="ptr-empty">No public polls of this race yet.</div>;
  const id = uid ?? "t" + hash(ps.map((p) => `${p.age}${p.margin}`).join(","));
  const W = width, H = compact ? 46 : height;
  const L = compact ? 2 : 44, R = compact ? 2 : 108, T = compact ? 3 : 14, B = compact ? 3 : 26;
  const vals = [...ps.map((p) => -p.margin), ...line.map((l) => l.v + l.s), ...line.map((l) => l.v - l.s), 0, ...(avg != null ? [-avg] : [])];
  let hi = Math.max(...vals), lo = Math.min(...vals);
  const pad = Math.max(1.5, (hi - lo) * 0.08); hi += pad; lo -= pad;
  if (!compact) { hi = Math.ceil(hi / 2) * 2; lo = Math.floor(lo / 2) * 2; }
  const x = (t: number) => L + ((t - minT) / (0 - minT)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const y0 = y(0);
  const dCol = ind ? "#b78cff" : "#3d7bff", rCol = "#ff3b5c";
  const pathD = line.map((l, i) => `${i ? "L" : "M"}${x(l.t).toFixed(1)},${y(l.v).toFixed(1)}`).join("");
  const band = line.length ? `M${line.map((l) => `${x(l.t).toFixed(1)},${y(l.v + l.s).toFixed(1)}`).join("L")}L${[...line].reverse().map((l) => `${x(l.t).toFixed(1)},${y(l.v - l.s).toFixed(1)}`).join("L")}Z` : "";
  const end = line[line.length - 1];
  const ticks: number[] = []; if (!compact) { const step = hi - lo > 24 ? 10 : hi - lo > 12 ? 4 : 2; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v); }
  const base = asOf ? new Date(asOf + "T12:00:00") : null;
  const xt: { t: number; l: string }[] = [];
  if (!compact && base) {
    const d = new Date(base); d.setDate(1);
    for (let k = 0; k < 8; k++) { const t = Math.round((d.getTime() - base.getTime()) / 864e5); if (t >= minT && t <= 0) xt.unshift({ t, l: d.toLocaleDateString("en-US", { month: "short" }) }); d.setMonth(d.getMonth() - 1); }
    if (-minT <= 45) { xt.length = 0; for (let t = 0; t >= minT; t -= 7) { const dd = new Date(base.getTime() + t * 864e5); xt.unshift({ t, l: `${dd.getMonth() + 1}/${dd.getDate()}` }); } }
  }
  const rad = (n?: number) => (compact ? 1.8 : Math.max(2.6, Math.min(6.5, Math.sqrt((n ?? 600) / 40))));
  return (
    <svg className={`ptr${compact ? " cmp" : ""}`} viewBox={`0 0 ${W} ${H}`} width="100%" preserveAspectRatio={compact ? "none" : "xMidYMid meet"} role="img"
      aria-label={`${ps.length} polls, trend ${end ? fmt(end.v, ind) : "unavailable"}${avg != null ? `, On Point average ${fmt(-avg, ind)}` : ""}`}>
      <defs>
        <clipPath id={`${id}u`}><rect x="0" y="0" width={W} height={Math.max(0, y0)} /></clipPath>
        <clipPath id={`${id}d`}><rect x="0" y={y0} width={W} height={Math.max(0, H - y0)} /></clipPath>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#fff" stopOpacity="0" /><stop offset=".12" stopColor="#fff" stopOpacity="1" /></linearGradient>
        <mask id={`${id}m`}><rect width={W} height={H} fill={`url(#${id}g)`} /></mask>
      </defs>
      {!compact ? <>
        <rect x={L} y={T} width={W - L - R} height={Math.max(0, y0 - T)} fill={dCol} opacity=".05" />
        <rect x={L} y={y0} width={W - L - R} height={Math.max(0, H - B - y0)} fill={rCol} opacity=".05" />
        {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" opacity={v === 0 ? 0.35 : 0.08} strokeDasharray={v === 0 ? "4 4" : undefined} />
          <text x={L - 8} y={y(v) + 3.5} textAnchor="end" className="ptr-ax">{v === 0 ? "Even" : `${v > 0 ? (ind ? "I" : "D") : "R"}+${Math.abs(v)}`}</text></g>)}
        {xt.map((t) => <text key={t.t} x={x(t.t)} y={H - 8} textAnchor="middle" className="ptr-ax">{t.l}</text>)}
        <text x={L + 8} y={T + 14} className="ptr-side" fill={dCol}>{dem} ahead</text>
        <text x={L + 8} y={H - B - 8} className="ptr-side" fill={rCol}>{gop} ahead</text>
      </> : <line x1={0} x2={W} y1={y0} y2={y0} stroke="currentColor" opacity=".25" strokeDasharray="3 3" />}
      {band ? <g mask={`url(#${id}m)`}><path d={band} fill={dCol} opacity=".16" clipPath={`url(#${id}u)`} /><path d={band} fill={rCol} opacity=".16" clipPath={`url(#${id}d)`} /></g> : null}
      {ps.map((p, i) => {
        const cx = x(-p.age), cy = y(-p.margin), c = p.margin < 0 ? dCol : rCol;
        return p.op && !compact
          ? <g key={i}><rect x={cx - 5.5} y={cy - 5.5} width="11" height="11" transform={`rotate(45 ${cx} ${cy})`} fill={c} stroke="#e7b341" strokeWidth="2" /><title>{`${p.pollster ?? "On Point Polling"}, ${fmt(-p.margin, ind)}, ${p.age} days ago`}</title></g>
          : <circle key={i} cx={cx} cy={cy} r={rad(p.n)} fill={c} opacity={compact ? 0.55 : 0.5} className="ptr-dot"><title>{`${p.pollster ?? "Poll"}${p.n ? `, ${p.n.toLocaleString()}` : ""}, ${fmt(-p.margin, ind)}, ${p.age} days ago`}</title></circle>;
      })}
      {pathD ? <g className="ptr-line"><path d={pathD} fill="none" stroke={dCol} strokeWidth={compact ? 2 : 3} strokeLinecap="round" clipPath={`url(#${id}u)`} /><path d={pathD} fill="none" stroke={rCol} strokeWidth={compact ? 2 : 3} strokeLinecap="round" clipPath={`url(#${id}d)`} /></g> : null}
      {end ? <circle cx={x(0)} cy={y(end.v)} r={compact ? 2.6 : 5} fill={end.v >= 0 ? dCol : rCol} stroke="#0a0711" strokeWidth="2" className="ptr-end" /> : null}
      {!compact && end ? <g>
        <text x={W - R + 10} y={y(end.v) + (avg != null && Math.abs(y(end.v) - y(-avg)) < 30 ? (y(end.v) <= y(-avg) ? -6 : 18) : 5)} className="ptr-end-l" fill={end.v >= 0 ? dCol : rCol}>{fmt(end.v, ind)}<tspan className="ptr-ax" x={W - R + 10} dy="13">poll trend</tspan></text>
        {avg != null ? <g><path d={`M${x(0) + 1},${y(-avg)} l7,-5 v10 z`} fill="#e7b341" />
          <text x={W - R + 10} y={y(-avg) + (Math.abs(y(end.v) - y(-avg)) < 30 ? (y(end.v) <= y(-avg) ? 26 : -22) : 4)} className="ptr-end-l" fill="#e7b341">{fmt(-avg, ind)}<tspan className="ptr-ax" x={W - R + 10} dy="13">average</tspan></text></g> : null}
      </g> : null}
    </svg>
  );
}
