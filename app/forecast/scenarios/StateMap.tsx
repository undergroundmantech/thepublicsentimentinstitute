"use client";
// The county map for the within a state scenarios: counties recolor smoothly as the scenario moves, counties that
// just moved pulse once, edited counties carry a gold dot, and a tooltip follows the pointer.
import React, { useMemo, useRef, useState } from "react";
import { marginColor, marginColorInd } from "@/app/lib/opp";
import type { CountyOut } from "./engine";

export type Path = { id: string; d: string };
export type View = "margin" | "change";

function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
const mix = (c1: number[], c2: number[], t: number) => `rgb(${c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",")})`;
/** change from the forecast, R minus D: blue where the county moved toward Democrats, red toward Republicans */
export function changeFill(dm: number, ind = false, cap = 10) {
  if (Math.abs(dm) < 0.05) return "rgba(var(--line-rgb),.10)";
  const a = Math.min(cap, Math.abs(dm)) / cap;
  return dm < 0 ? (ind ? mix([226, 214, 255], [96, 52, 200], a) : mix([214, 226, 255], [24, 66, 200], a)) : mix([255, 214, 222], [176, 16, 52], a);
}
export const CHANGE_RAMP = "linear-gradient(90deg,#1842c8 0%,#d6e2ff 46%,rgba(127,127,127,.25) 50%,#ffd6de 54%,#b01034 100%)";
export const CHANGE_RAMP_IND = "linear-gradient(90deg,#6034c8 0%,#e2d6ff 46%,rgba(127,127,127,.25) 50%,#ffd6de 54%,#b01034 100%)";

export default function StateMap({ paths, rows, view, ind, sel, hot, edited, pulse, onPick, onHover, tip, raceKey, label }: {
  paths: Path[]; rows: CountyOut[]; view: View; ind: boolean; sel: string | null; hot: string | null; edited: Set<string>;
  pulse: { ids: string[]; k: number }; onPick: (id: string) => void; onHover: (id: string | null) => void;
  tip: (id: string) => React.ReactNode; raceKey: string; label: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const geo = useMemo(() => {
    const boxes = new Map(paths.map((p) => [p.id, bboxOf(p.d)]));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const b of boxes.values()) { if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; }
    const pw = (x1 - x0) * 0.025, ph = (y1 - y0) * 0.025;
    return { boxes, vb: [x0 - pw, y0 - ph, x1 - x0 + 2 * pw, y1 - y0 + 2 * ph] as [number, number, number, number], x0, w: x1 - x0 || 1 };
  }, [paths]);
  const fillOf = (r?: CountyOut) => {
    if (!r) return "rgba(var(--line-rgb),.08)";
    if (view === "change") return changeFill(r.M - r.M0, ind);
    return ind ? marginColorInd(r.M) : marginColor(r.M);
  };
  const dot = geo.vb[2] / 140;
  const focus = pos?.id ?? hot;
  const dOf = (id: string | null) => (id ? paths.find((p) => p.id === id)?.d : undefined);
  const move = (id: string) => (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return;
    const b = wrap.current?.getBoundingClientRect(); if (!b) return;
    setPos({ id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height });
    onHover(id);
  };
  return (
    <div className="sl-mapw" ref={wrap} onMouseLeave={() => { setPos(null); onHover(null); }}>
      <svg key={raceKey} className="sl-map" viewBox={geo.vb.join(" ")} preserveAspectRatio="xMidYMid meet" role="img" aria-label={label}>
        {paths.map((p) => {
          const r = byId.get(p.id), b = geo.boxes.get(p.id)!;
          return (
            <path key={p.id} d={p.d} className={`sl-c${sel === p.id ? " on" : ""}`} style={{ fill: fillOf(r), animationDelay: `${(((b[0] - geo.x0) / geo.w) * 0.55).toFixed(2)}s` }}
              tabIndex={0} role="button" aria-label={r ? r.name : p.id}
              onPointerMove={move(p.id)} onPointerEnter={move(p.id)} onClick={() => onPick(p.id)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(p.id); } }} />
          );
        })}
        {pulse.ids.map((id) => { const d = dOf(id); return d ? <path key={`${id}-${pulse.k}`} d={d} className="sl-pulse" /> : null; })}
        {[...edited].map((id) => { const b = geo.boxes.get(id); return b ? <circle key={`e${id}`} className="sl-edot" cx={(b[0] + b[2]) / 2} cy={(b[1] + b[3]) / 2} r={dot} /> : null; })}
        {focus && focus !== sel ? <path className="sl-hov" d={dOf(focus)} /> : null}
        {sel ? <path className="sl-sel" d={dOf(sel)} /> : null}
      </svg>
      {pos ? (
        <div className="sl-tip" style={{ left: pos.x, top: pos.y, transform: `translate(${pos.x > pos.w - 280 ? "calc(-100% - 14px)" : "14px"}, ${pos.y > pos.h - 200 ? "calc(-100% - 10px)" : "10px"})` }}>
          {tip(pos.id)}
        </div>
      ) : null}
    </div>
  );
}
