"use client";
// Where the outside money lands: each state's Senate race as a bubble sized by outside spending, split by which
// side it helps, with gold coins falling into it. Click a state for its race below.
import React, { useEffect, useMemo, useState } from "react";
import type { RaceMoney } from "../data";

type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]> };
const usd = (n: number | null) => (n == null ? "n/a" : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : `$${Math.round(n / 1e3)}K`);

export default function MoneyMap({ races, onPick, picked }: { races: RaceMoney[]; onPick: (k: string) => void; picked: string | null }) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  const bySt = useMemo(() => { const m: Record<string, RaceMoney> = {}; for (const r of races) if (!m[r.st] || (r.total ?? 0) > (m[r.st].total ?? 0)) m[r.st] = r; return m; }, [races]);
  const max = Math.max(1, ...races.map((r) => r.total ?? 0));
  if (!geo) return <div className="mm-load sx-skel" />;
  const [W, H] = geo.frame;
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => { const p = (a: number) => [cx + r * Math.sin(a), cy - r * Math.cos(a)]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `M${cx},${cy} L${x0},${y0} A${r},${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1},${y1} Z`; };
  return (
    <div className="mm">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Outside money by state">
        {Object.entries(geo.states).map(([s, d]) => <path key={s} d={d} className={`mm-st${bySt[s] ? " live" : ""}${picked && bySt[s]?.key === picked ? " on" : ""}`} onClick={() => bySt[s] && onPick(bySt[s].key)} />)}
        {Object.values(bySt).map((r, i) => {
          const lb = geo.labels?.[r.st]; if (!lb || !r.total) return null;
          const rad = 8 + Math.sqrt(r.total / max) * 46, [cx, cy] = lb, fd = r.forD && r.total ? r.forD / ((r.forD ?? 0) + (r.forR ?? 0)) : 0.5;
          return (
            <g key={r.key} className={`mm-b${hov === r.key || picked === r.key ? " on" : ""}`} onMouseEnter={() => setHov(r.key)} onMouseLeave={() => setHov(null)} onClick={() => onPick(r.key)} role="button" tabIndex={0} aria-label={`${r.key}: ${usd(r.total)} outside money`} onKeyDown={(e) => { if (e.key === "Enter") onPick(r.key); }}>
              <circle cx={cx} cy={cy} r={rad + 6} className="mm-halo" style={{ animationDelay: `${i * 0.2}s` }} />
              <path d={arc(cx, cy, rad, 0, fd * Math.PI * 2)} fill="#3d7bff" opacity=".85" />
              <path d={arc(cx, cy, rad, fd * Math.PI * 2, Math.PI * 2 - 0.0001)} fill="#ff3b5c" opacity=".85" />
              <circle cx={cx} cy={cy} r={rad} fill="none" stroke="#ffd98a" strokeWidth="1.5" />
              {Array.from({ length: Math.max(2, Math.round((r.total / max) * 7)) }, (_, k) => (
                <circle key={k} cx={cx + ((k * 37) % (rad * 1.4)) - rad * 0.7} cy={cy - rad * 0.2} r="2.6" className="mm-coin" style={{ animationDelay: `${(k * 0.43 + i * 0.17) % 2.6}s` }} />
              ))}
              <text x={cx} y={cy + rad + 14} textAnchor="middle" className="mm-t">{r.st} <tspan className="g">{usd(r.total)}</tspan></text>
            </g>
          );
        })}
      </svg>
      <div className="mm-legend"><span><i style={{ background: "#3d7bff" }} />Helps the Democrat or independent</span><span><i style={{ background: "#ff3b5c" }} />Helps the Republican</span><span>Bubble size is total outside money</span></div>
    </div>
  );
}
