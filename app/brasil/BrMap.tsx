"use client";
// The 27 units of the federation on one map. Fill, hover note and link are passed in, so the forecast, the live
// results and the control room all draw the same map.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import FloatTip from "@/app/components/opp/FloatTip";
import { pathBounds, type BrState } from "./lib";

export type MapState = Pick<BrState, "uf" | "name" | "d" | "cx" | "cy">;

export default function BrMap({ states, fill, tip, href, sel, onPick, glow, labels = true, className = "" }: {
  states: MapState[]; fill: (uf: string) => string; tip?: (uf: string) => React.ReactNode; href?: (uf: string) => string;
  sel?: string | null; onPick?: (uf: string) => void; glow?: (uf: string) => boolean; labels?: boolean; className?: string;
}) {
  const [hov, setHov] = useState<{ uf: string; x: number; y: number } | null>(null);
  const shapes = useMemo(() => states.filter((s) => s.d), [states]);
  const vb = useMemo(() => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of shapes) { const b = pathBounds(s.d!); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const p = 8; return `${x0 - p} ${y0 - p} ${x1 - x0 + 2 * p} ${y1 - y0 + 2 * p}`;
  }, [shapes]);
  const body = (s: MapState) => (
    <path d={s.d!} fill={fill(s.uf)} className={`bm-st${sel === s.uf ? " on" : ""}${glow?.(s.uf) ? " glow" : ""}`}
      onMouseMove={(e) => setHov({ uf: s.uf, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)}
      onClick={onPick ? () => onPick(s.uf) : undefined} />
  );
  return (
    <div className={`bm ${className}`}>
      <svg viewBox={vb} role="img" aria-label="Mapa do Brasil por estado">
        <defs>
          <filter id="bm-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        {shapes.map((s) => href ? <Link key={s.uf} href={href(s.uf)} aria-label={s.name}>{body(s)}</Link> : <g key={s.uf}>{body(s)}</g>)}
        {sel && shapes.find((s) => s.uf === sel) && <path d={shapes.find((s) => s.uf === sel)!.d!} className="bm-sel" />}
        {labels && shapes.map((s) => s.cx != null && <text key={s.uf + "t"} x={s.cx} y={s.cy! + 4} className={`bm-lb${["DF", "SE", "AL", "PB", "RN", "ES", "RJ"].includes(s.uf) ? " sm" : ""}`}>{s.uf}</text>)}
      </svg>
      {hov && tip && <FloatTip x={hov.x} y={hov.y} className="br-tip" scope="opp br">{tip(hov.uf)}</FloatTip>}
    </div>
  );
}
