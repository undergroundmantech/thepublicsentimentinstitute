// Server drawn SVG charts for the accuracy report and the final forecast archive. Every mark is placed by one scale per
// axis, every label names a value the chart reaches, and colors come from the site tokens through classes in acc.css.
import type { Cal, Chamber } from "./data";

const ticks = (lo: number, hi: number, step: number) => { const t: number[] = []; for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) t.push(Math.round(v * 100) / 100); return t; };

/** The forecast's seat distribution, its 80 percent range, the majority line and where the count landed. */
export function SeatHist({ c, label }: { c: Chamber; label: string }) {
  // the model stores the Republican seat distribution; turn it into Democratic seats
  const h = (c.hist ?? []).map(([s, p]) => [c.seats - s, p] as [number, number]).sort((a, b) => a[0] - b[0]);
  if (!h.length) return null;
  const W = 520, H = 170, L = 8, R = 8, T = 26, B = 26;
  // trim the empty tails so the bars have room
  const mass = h.filter(([, p]) => p >= 0.0004);
  const lo = Math.min(mass[0][0], c.actualD, c.projD) - 1, hi = Math.max(mass[mass.length - 1][0], c.actualD, c.projD) + 1;
  const x = (s: number) => L + ((s - lo) / (hi - lo)) * (W - L - R);
  const top = Math.max(...h.map(([, p]) => p));
  const y = (p: number) => T + (1 - p / top) * (H - T - B);
  const bw = Math.max(1, (W - L - R) / (hi - lo) - 0.6);
  const step = hi - lo > 120 ? 20 : hi - lo > 50 ? 10 : hi - lo > 20 ? 4 : 2;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="acc-chart" role="img" aria-label={`${label}: the forecast called ${c.projD} Democratic seats, the count has ${c.actualD}`}>
      <rect x={x(c.p10) - bw / 2} y={T} width={x(c.p90) - x(c.p10) + bw} height={H - T - B} className="band" />
      {h.filter(([s]) => s >= lo && s <= hi).map(([s, p]) => (
        <rect key={s} x={x(s) - bw / 2} y={y(p)} width={bw} height={H - B - y(p)} className={s >= c.majority ? "bar d" : "bar r"} />
      ))}
      <line x1={x(c.majority) - bw / 2} x2={x(c.majority) - bw / 2} y1={T - 6} y2={H - B} className="maj" />
      <text x={x(c.majority) - bw / 2 + 4} y={T - 10} className="lab">Majority {c.majority}</text>
      <line x1={x(c.projD)} x2={x(c.projD)} y1={T + 18} y2={H - B + 4} className="proj" />
      {c.projD !== c.actualD ? <text x={x(c.projD) + (x(c.projD) < x(c.actualD) ? -6 : 6)} y={T + 44} textAnchor={x(c.projD) < x(c.actualD) ? "end" : "start"} className="lab gold">Called {c.projD}</text> : null}
      <line x1={x(c.actualD)} x2={x(c.actualD)} y1={T - 2} y2={H - B + 4} className="act" />
      <circle cx={x(c.actualD)} cy={T - 2} r={4} className="actdot" />
      <text x={x(c.actualD) + (x(c.actualD) > W * 0.7 ? -8 : 8)} y={T + 12} textAnchor={x(c.actualD) > W * 0.7 ? "end" : "start"} className="lab hi">Count {c.actualD} D</text>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} className="axis" />
      {ticks(lo + 1, hi - 1, step).map((t) => <text key={t} x={x(t)} y={H - 8} textAnchor="middle">{t}</text>)}
    </svg>
  );
}

/** Forecast chance for the favorite against how often the favorite won, one dot per bin sized by races. */
export function Calibration({ fed, leg }: { fed: Cal[]; leg: Cal[] }) {
  const W = 520, H = 360, L = 46, R = 16, T = 16, B = 42;
  const x = (v: number) => L + ((v - 50) / 50) * (W - L - R);
  const y = (v: number) => T + (1 - (v - 50) / 50) * (H - T - B);
  const rad = (n: number, max: number) => 4 + 12 * Math.sqrt(n / max);
  const mx = Math.max(...fed.map((c) => c.n), ...leg.map((c) => c.n));
  const line = (cs: Cal[]) => cs.map((c) => `${x(c.expected)},${y(Math.max(50, c.won))}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="acc-chart" role="img" aria-label="Calibration: forecast chance for the favorite against how often the favorite won">
      {ticks(50, 100, 10).map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 8} y={y(t) + 4} textAnchor="end">{t}%</text><text x={x(t)} y={H - B + 18} textAnchor="middle">{t}%</text></g>)}
      <line x1={x(50)} y1={y(50)} x2={x(100)} y2={y(100)} className="diag" />
      <text x={x(76)} y={y(76) - 10} className="lab" transform={`rotate(-34 ${x(76)} ${y(76) - 10})`}>Perfect calibration</text>
      <polyline points={line(leg)} className="cl leg" />
      <polyline points={line(fed)} className="cl fed" />
      {leg.map((c) => <circle key={"l" + c.lo} cx={x(c.expected)} cy={y(Math.max(50, c.won))} r={rad(c.n, mx)} className="cd leg"><title>{`Legislative districts, ${c.lo} to ${c.hi}%: ${c.n} races, favorites won ${c.won}%`}</title></circle>)}
      {fed.map((c) => <circle key={"f" + c.lo} cx={x(c.expected)} cy={y(Math.max(50, c.won))} r={rad(c.n, mx)} className="cd fed"><title>{`Senate, House and governor, ${c.lo} to ${c.hi}%: ${c.n} races, favorites won ${c.won}%`}</title></circle>)}
      <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" className="ax">Forecast chance for the favorite</text>
      <text x={14} y={(T + H - B) / 2} textAnchor="middle" className="ax" transform={`rotate(-90 14 ${(T + H - B) / 2})`}>How often the favorite won</text>
    </svg>
  );
}

/** Race misses, result minus forecast, stacked by office. Left is toward Democrats. */
export function ErrHist({ edges, counts }: { edges: number[]; counts: Record<"senate" | "governor" | "house", number[]> }) {
  const W = 560, H = 200, L = 30, R = 10, T = 14, B = 34;
  const n = edges.length - 1;
  const tot = Array.from({ length: n }, (_, i) => counts.senate[i] + counts.governor[i] + counts.house[i]);
  const top = Math.max(...tot);
  const x = (v: number) => L + ((v - edges[0]) / (edges[n] - edges[0])) * (W - L - R);
  const y = (v: number) => T + (1 - v / top) * (H - T - B);
  const bw = (W - L - R) / n - 2;
  const yt = ticks(0, top, top > 80 ? 20 : top > 40 ? 10 : 5);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="acc-chart" role="img" aria-label="How far each race landed from the forecast">
      {yt.map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
      {tot.map((_, i) => {
        let base = 0;
        return (["house", "governor", "senate"] as const).map((o) => {
          const v = counts[o][i]; const y0 = y(base), y1 = y(base + v); base += v;
          return v ? <rect key={o + i} x={x(edges[i]) + 1} y={y1} width={bw} height={y0 - y1} className={`eb ${o}`}><title>{`${edges[i]} to ${edges[i + 1]}: ${v} ${o} races`}</title></rect> : null;
        });
      })}
      <line x1={x(0)} x2={x(0)} y1={T - 4} y2={H - B} className="maj" />
      {[-20, -10, 0, 10, 20].filter((t) => t >= edges[0] && t <= edges[n]).map((t) => <text key={t} x={x(t)} y={H - B + 16} textAnchor="middle">{t === 0 ? "On target" : `${t < 0 ? "D" : "R"} ${Math.abs(t)}`}</text>)}
      <text x={L} y={H - 4} className="ax">Democrats ran ahead</text>
      <text x={W - R} y={H - 4} textAnchor="end" className="ax">Republicans ran ahead</text>
    </svg>
  );
}

/** Average miss by forecast lean, one diverging bar per band. */
export function LeanBars({ rows }: { rows: { lo: number; hi: number; n: number; bias: number; share: number }[] }) {
  const W = 560, rowH = 26, T = 8, L = 116, R = 70;
  const H = T + rows.length * rowH + 30;
  const m = Math.max(8, ...rows.map((r) => Math.abs(r.bias)));
  const x = (v: number) => L + ((v + m) / (2 * m)) * (W - L - R);
  const lab = (lo: number, hi: number) => (hi === 0 ? `Up to D +${-lo}` : lo === 0 ? `Up to R +${hi}` : hi < 0 ? (lo <= -100 ? `D +${-hi} or more` : `D +${-hi} to ${-lo}`) : lo >= 0 ? (hi >= 100 ? `R +${lo} or more` : `R +${lo} to ${hi}`) : "Even");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="acc-chart" role="img" aria-label="Average miss by how the district leaned in the forecast">
      {ticks(-m, m, m > 12 ? 5 : 2).map((t) => <g key={t}><line x1={x(t)} x2={x(t)} y1={T} y2={H - 26} className={t === 0 ? "maj" : "grid"} /><text x={x(t)} y={H - 10} textAnchor="middle">{t === 0 ? "0" : `${t < 0 ? "D" : "R"} ${Math.abs(t)}`}</text></g>)}
      {rows.map((r, i) => {
        const yy = T + i * rowH;
        return (
          <g key={r.lo}>
            <text x={L - 10} y={yy + 17} textAnchor="end" className="rl">{lab(r.lo, r.hi)}</text>
            <rect x={Math.min(x(0), x(r.bias))} y={yy + 5} width={Math.abs(x(r.bias) - x(0))} height={rowH - 10} rx={3} className={r.bias < 0 ? "lb d" : "lb r"} />
            <text x={W - R + 8} y={yy + 17} className="rl mono">{r.bias < 0 ? "D" : "R"} {Math.abs(r.bias).toFixed(1)}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Democratic chance of control on every archived forecast day. */
export function PathChart({ days }: { days: { date: string; sen: number; house: number; gov: number }[] }) {
  const W = 1180, H = 300, L = 44, R = 130, T = 14, B = 30;
  const t0 = new Date(days[0].date).getTime(), t1 = new Date(days[days.length - 1].date).getTime();
  const x = (d: string) => L + ((new Date(d).getTime() - t0) / Math.max(1, t1 - t0)) * (W - L - R);
  const lo = 50;
  const y = (v: number) => T + (1 - (v - lo) / (100 - lo)) * (H - T - B);
  const ser = [["sen", "Senate", "p-sen"], ["house", "House", "p-house"], ["gov", "Governors", "p-gov"]] as const;
  const mid = days[Math.floor(days.length / 2)].date;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="acc-chart" role="img" aria-label="Democratic chance of control on each forecast day">
      {ticks(lo, 100, 10).map((t) => <g key={t}><line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" /><text x={L - 6} y={y(t) + 4} textAnchor="end">{t}%</text></g>)}
      {[days[0].date, mid, days[days.length - 1].date].map((d) => <text key={d} x={x(d)} y={H - 8} textAnchor="middle">{new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</text>)}
      {ser.map(([k, l, c]) => {
        const last = days[days.length - 1];
        // keep the end labels apart when two chambers finish close together
        const ends = ser.map(([kk]) => ({ kk, v: y(Math.max(lo, last[kk])) })).sort((a, b) => a.v - b.v);
        for (let i = 1; i < ends.length; i++) if (ends[i].v - ends[i - 1].v < 13) ends[i].v = ends[i - 1].v + 13;
        const ly = ends.find((e) => e.kk === k)!.v;
        return (
          <g key={k}>
            <polyline points={days.map((d) => `${x(d.date)},${y(Math.max(lo, d[k]))}`).join(" ")} className={`pl ${c}`} />
            <circle cx={x(last.date)} cy={y(Math.max(lo, last[k]))} r={3.5} className={`pd ${c}`} />
            <text x={x(last.date) + 8} y={ly + 4} className={`rl ${c}`}>{l} {Math.round(last[k])}%</text>
          </g>
        );
      })}
    </svg>
  );
}

/** A share as a ring that fills once on load, with the share in the middle. */
export function Ring({ pct, size = 64, label, text }: { pct: number; size?: number; label?: string; text?: string }) {
  const r = 26, c = 2 * Math.PI * r, f = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="acc-ring" role="img" aria-label={label ?? `${pct.toFixed(0)} percent`}>
      <circle cx="32" cy="32" r={r} className="rt" />
      <circle cx="32" cy="32" r={r} className="rf" style={{ strokeDasharray: `${c * f} ${c}`, ["--c" as string]: `${c}` }} transform="rotate(-90 32 32)" />
      <text x="32" y="36.5" textAnchor="middle">{text ?? `${Math.round(pct)}%`}</text>
    </svg>
  );
}
