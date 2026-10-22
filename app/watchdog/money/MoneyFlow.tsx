"use client";
// Money flow: the biggest donors, the outside groups they fund, and the races those groups spend in, as one river.
// Ribbons are drawn to scale; gold coins ride each ribbon, more of them on the bigger flows. Hover any band or name.
import React, { useMemo, useState } from "react";
import type { Money } from "../data";

const usd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : `$${Math.round(n / 1e3)}K`);
const SIDE: Record<string, string> = { D: "#3d7bff", R: "#ff3b5c", I: "#b78cff", other: "#a79fbd" };

export default function MoneyFlow({ flow }: { flow: Money["flow"] }) {
  const [hov, setHov] = useState<string | null>(null);
  const [tip, setTip] = useState<{ x: number; y: number; t: string } | null>(null);
  const W = 1100, H = 760, NW = 14, PAD = 7, X = [190, 545, 900];
  const L = useMemo(() => {
    const val: Record<string, { in: number; out: number }> = {};
    for (const l of flow.links) { (val[l.s] ??= { in: 0, out: 0 }).out += l.v; (val[l.t] ??= { in: 0, out: 0 }).in += l.v; }
    const col = (id: string) => (id.startsWith("d:") ? 0 : id.startsWith("g:") ? (flow.links.some((l) => l.t === id && l.s.startsWith("g:")) && !flow.links.some((l) => l.s === id && l.t.startsWith("r:")) ? 0 : 1) : 2);
    const cols: string[][] = [[], [], []];
    for (const n of flow.nodes) cols[col(n.id)].push(n.id);
    const v = (id: string) => Math.max(val[id]?.in ?? 0, val[id]?.out ?? 0);
    cols.forEach((c) => c.sort((a, b) => v(b) - v(a)));
    const scale = Math.min(...cols.map((c) => (H - 40 - PAD * (c.length - 1)) / Math.max(1, c.reduce((a, id) => a + v(id), 0))));
    const pos: Record<string, { x: number; y: number; h: number; col: number; so: number; to: number }> = {};
    cols.forEach((c, ci) => { const tot = c.reduce((a, id) => a + v(id) * scale, 0) + PAD * (c.length - 1); let y = (H - tot) / 2; for (const id of c) { const h = Math.max(2, v(id) * scale); pos[id] = { x: X[ci], y, h, col: ci, so: 0, to: 0 }; y += h + PAD; } });
    const links = [...flow.links].sort((a, b) => (pos[a.s].y - pos[b.s].y) || (pos[a.t].y - pos[b.t].y)).map((l) => {
      const a = pos[l.s], b = pos[l.t], w = Math.max(1, l.v * scale);
      const y0 = a.y + a.so + w / 2, y1 = b.y + b.to + w / 2; a.so += w; b.to += w;
      const x0 = a.x + NW, x1 = b.x, mx = (x0 + x1) / 2;
      return { ...l, w, d: `M${x0},${y0} C${mx},${y0} ${mx},${y1} ${x1},${y1}` };
    });
    return { pos, links, v };
  }, [flow]);
  const node = (id: string) => flow.nodes.find((n) => n.id === id)!;
  const colorOf = (id: string) => { const n = node(id); return id.startsWith("d:") ? "#e7b341" : id.startsWith("r:") ? "#ffd98a" : SIDE[n.side ?? "other"] ?? SIDE.other; };
  const on = (l: { s: string; t: string }) => !hov || l.s === hov || l.t === hov;
  const maxV = Math.max(...flow.links.map((l) => l.v));
  return (
    <div className="mf" onMouseLeave={() => { setHov(null); setTip(null); }}>
      <div className="mf-heads"><span style={{ left: `${(X[0] / W) * 100}%` }}>Donors</span><span style={{ left: `${(X[1] / W) * 100}%` }}>Outside groups</span><span style={{ left: `${(X[2] / W) * 100}%` }}>Races</span></div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Money flowing from the biggest donors through outside groups into 2026 races">
        <defs>
          {L.links.map((l, i) => <linearGradient key={i} id={`mfg${i}`} x1="0" x2="1"><stop offset="0" stopColor={colorOf(l.s)} /><stop offset="1" stopColor={colorOf(l.t)} /></linearGradient>)}
        </defs>
        {L.links.map((l, i) => (
          <g key={i} className={`mf-l${on(l) ? "" : " dim"}`} onMouseMove={(e) => { const b = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, t: `${node(l.s).name} to ${node(l.t).name}: ${usd(l.v)}` }); }} onMouseLeave={() => setTip(null)}>
            <path d={l.d} stroke={`url(#mfg${i})`} strokeWidth={l.w} fill="none" />
            {on(l) ? (() => { const cnt = Math.max(1, Math.round((l.v / maxV) * 5)); return Array.from({ length: cnt }, (_, k) => (
              <circle key={k} r={Math.min(4, 1.4 + l.w * 0.06)} className="mf-coin"><animateMotion dur={`${3.2 + (i % 5) * 0.4}s`} begin={`${(k / cnt) * 3.2}s`} repeatCount="indefinite" path={l.d} /></circle>
            )); })() : null}
          </g>
        ))}
        {Object.entries(L.pos).map(([id, p]) => {
          const n = node(id), lab = p.col === 0 ? "end" : "start", lx = p.col === 0 ? p.x - 8 : p.x + NW + 8;
          return (
            <g key={id} className={`mf-n${hov && hov !== id && !flow.links.some((l) => (l.s === hov && l.t === id) || (l.t === hov && l.s === id)) ? " dim" : ""}`} onMouseEnter={() => setHov(id)}>
              <rect x={p.x} y={p.y} width={NW} height={p.h} rx="3" fill={colorOf(id)} />
              {p.h > 9 || p.col === 1 ? <text x={lx} y={p.y + p.h / 2 + 4} textAnchor={lab} className="mf-t">{n.name.length > 34 ? n.name.slice(0, 32) + "…" : n.name}<tspan className="mf-v" dx="6">{usd(L.v(id))}</tspan></text> : null}
            </g>
          );
        })}
      </svg>
      {tip ? <div className="wd-tip" style={{ left: tip.x + 14, top: tip.y + 10 }}>{tip.t}</div> : null}
    </div>
  );
}
