"use client";
// Every municipality in one state. Pinch, Ctrl and scroll, or the buttons zoom; drag to move, double click to reset. The fill and the
// hover note come from the page, so the forecast and the live results share it.
import React, { useEffect, useMemo, useRef, useState } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { pathBounds, type MunRow } from "./lib";

const cache = new Map<string, MunRow[]>();
export function useMun(uf: string | null) {
  const [rows, setRows] = useState<MunRow[] | null>(uf ? cache.get(uf) ?? null : null);
  useEffect(() => {
    if (!uf) { setRows(null); return; }
    if (cache.has(uf)) { setRows(cache.get(uf)!); return; }
    let dead = false; setRows(null);
    fetch(`/brasil/mun/${uf}.json`).then((r) => r.json()).then((j) => { cache.set(uf, j.rows); if (!dead) setRows(j.rows); }).catch(() => {});
    return () => { dead = true; };
  }, [uf]);
  return rows;
}

export default function MunMap({ rows, fill, tip, sel, onPick, glow, stroke = "auto" }: {
  rows: MunRow[]; fill: (r: MunRow) => string; tip?: (r: MunRow) => React.ReactNode; sel?: number | null;
  onPick?: (r: MunRow) => void; glow?: (r: MunRow) => boolean; stroke?: "auto" | "none";
}) {
  const home = useMemo(() => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const r of rows) { if (!r[5]) continue; const b = pathBounds(r[5]); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const p = Math.max(x1 - x0, y1 - y0) * 0.03; return [x0 - p, y0 - p, x1 - x0 + 2 * p, y1 - y0 + 2 * p] as [number, number, number, number];
  }, [rows]);
  const [vb, setVb] = useState(home);
  useEffect(() => setVb(home), [home]);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; vb: typeof vb; moved: boolean } | null>(null);
  const [hov, setHov] = useState<{ r: MunRow; x: number; y: number } | null>(null);
  const zoomAt = (cx: number, cy: number, k: number) => setVb(([x, y, w, h]) => {
    const nw = Math.min(home[2] * 1.2, Math.max(home[2] / 40, w * k)), kk = nw / w, nh = h * kk;
    return [cx - (cx - x) * kk, cy - (cy - y) * kk, nw, nh];
  });
  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect(); const s = Math.max(vb[2] / r.width, vb[3] / r.height);
    const ox = (r.width * s - vb[2]) / 2, oy = (r.height * s - vb[3]) / 2;
    return [vb[0] - ox + (e.clientX - r.left) * s, vb[1] - oy + (e.clientY - r.top) * s];
  };
  useEffect(() => {
    const el = svg.current; if (!el) return;
    const wh = (e: WheelEvent) => { if (!e.ctrlKey && !e.metaKey) return; e.preventDefault(); const [x, y] = toSvg(e); zoomAt(x, y, Math.exp(e.deltaY * 0.0022)); };
    el.addEventListener("wheel", wh, { passive: false }); return () => el.removeEventListener("wheel", wh);
  });
  const sw = vb[2] / 900;
  const zoomed = vb[2] < home[2] * 0.98;
  return (
    <div className="mm">
      <svg ref={svg} viewBox={vb.join(" ")} role="img" aria-label="Mapa por município" style={{ ["--sw" as string]: stroke === "none" ? 0 : sw }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vb, moved: false }; }}
        onPointerMove={(e) => {
          const d = drag.current; if (!d || e.buttons !== 1) return;
          const r = svg.current!.getBoundingClientRect(); const s = Math.max(d.vb[2] / r.width, d.vb[3] / r.height);
          const dx = (e.clientX - d.x) * s, dy = (e.clientY - d.y) * s; if (Math.abs(dx) + Math.abs(dy) > sw * 3) d.moved = true;
          if (d.moved) setVb([d.vb[0] - dx, d.vb[1] - dy, d.vb[2], d.vb[3]]);
        }}
        onPointerUp={() => setTimeout(() => (drag.current = null), 0)} onDoubleClick={() => setVb(home)}>
        <g strokeWidth={stroke === "none" ? 0 : sw}>
          {rows.map((r) => r[5] && (
            <path key={r[0]} d={r[5]} fill={fill(r)} className={`mm-m${glow?.(r) ? " glow" : ""}`}
              onMouseMove={(e) => setHov({ r, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHov(null)}
              onClick={() => { if (!drag.current?.moved) onPick?.(r); }} />
          ))}
        </g>
        {sel != null && rows.find((r) => r[0] === sel)?.[5] && <path d={rows.find((r) => r[0] === sel)![5]} className="mm-sel" strokeWidth={sw * 3} />}
      </svg>
      <div className="mm-z">
        <button type="button" aria-label="Aproximar" onClick={() => zoomAt(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, 0.6)}>+</button>
        <button type="button" aria-label="Afastar" onClick={() => zoomAt(vb[0] + vb[2] / 2, vb[1] + vb[3] / 2, 1.6)}>−</button>
        {zoomed && <button type="button" className="t" onClick={() => setVb(home)}>Ver tudo</button>}
      </div>
      {hov && tip && <FloatTip x={hov.x} y={hov.y} className="br-tip" scope="opp br">{tip(hov.r)}</FloatTip>}
    </div>
  );
}
