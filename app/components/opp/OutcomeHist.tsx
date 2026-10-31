// Every simulated outcome as a histogram, for pages whose model publishes a center and an 80 percent range rather than
// the raw simulation counts: statewide offices, ballot measures and legislative chambers. The bars are the normal curve
// that range implies, split at the line that decides the race.
import React from "react";

export default function OutcomeHist({ center, p10, p90, line, below, above, fmt, title, eye, note, lo: loIn, hi: hiIn }: {
  center: number; p10: number; p90: number; line: number; below: string; above: string; fmt: (x: number) => string;
  title: string; eye?: string; note?: React.ReactNode; lo?: number; hi?: number;
}) {
  const sd = Math.max(0.3, Math.abs(p90 - p10) / 2.563);
  const lo = loIn ?? center - 3.2 * sd, hi = hiIn ?? center + 3.2 * sd;
  const N = 48, w = (hi - lo) / N;
  const dens = Array.from({ length: N }, (_, i) => { const x = lo + (i + 0.5) * w; return Math.exp(-0.5 * ((x - center) / sd) ** 2); });
  const mx = Math.max(...dens);
  const X = (x: number) => 20 + ((x - lo) / (hi - lo)) * 560;
  const share = (() => { let a = 0, t = 0; dens.forEach((d, i) => { t += d; if (lo + (i + 0.5) * w >= line) a += d; }); return t ? a / t : 0; })();
  return (
    <div className="card">
      <div className="card-h"><h3>{title}</h3>{eye ? <span className="eye" style={{ marginLeft: "auto" }}>{eye}</span> : null}</div>
      <div className="card-b">
        <svg className="hist" viewBox="0 0 600 150" role="img" aria-label={`Range of outcomes, 80 percent between ${fmt(p10)} and ${fmt(p90)}`}>
          {dens.map((d, i) => {
            const h = (d / mx) * 110, x = lo + (i + 0.5) * w;
            return <rect key={i} x={X(lo + i * w)} y={120 - h} width={Math.max(1, 560 / N - 1.5)} height={h} rx={1.5} fill={x >= line ? above : below} opacity={x >= Math.min(p10, p90) && x <= Math.max(p10, p90) ? 0.95 : 0.45} />;
          })}
          {line > lo && line < hi ? <line x1={X(line)} x2={X(line)} y1={4} y2={124} stroke="var(--hi)" strokeWidth={1.5} opacity={0.8} /> : null}
          <text x={20} y={142} style={{ font: "500 10px var(--font-m)", fill: "#8e86a3" }}>{fmt(lo)}</text>
          <text x={X(center)} y={142} textAnchor="middle" style={{ font: "700 10px var(--font-m)", fill: "#f3eff8" }}>{fmt(center)}</text>
          <text x={580} y={142} textAnchor="end" style={{ font: "500 10px var(--font-m)", fill: "#8e86a3" }}>{fmt(hi)}</text>
        </svg>
        <p style={{ fontSize: 13, marginTop: 8 }}>{note ?? <>80 percent of simulations fall between {fmt(Math.min(p10, p90))} and {fmt(Math.max(p10, p90))}; {Math.round(share * 100)} percent land past the line.</>}</p>
      </div>
    </div>
  );
}
