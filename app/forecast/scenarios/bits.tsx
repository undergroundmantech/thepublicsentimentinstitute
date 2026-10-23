"use client";
// Small animated pieces for the within a state scenarios: counting numbers, the statewide bar, the call badge
// and the tug of war of net votes by county.
import React, { useEffect, useRef, useState } from "react";
import { clamp, n0, short, type CountyOut } from "./engine";

const reduced = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export function useTween(v: number, ms = 520) {
  const [x, setX] = useState(v);
  const from = useRef(v), raf = useRef(0);
  useEffect(() => {
    const dur = reduced() ? 0 : ms;
    const a = from.current, t0 = performance.now();
    cancelAnimationFrame(raf.current);
    const step = (t: number) => {
      const k = dur ? Math.min(1, (t - t0) / dur) : 1, e = 1 - Math.pow(1 - k, 3);
      const cur = a + (v - a) * e; setX(cur); from.current = cur;
      if (k < 1) raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [v, ms]);
  return x;
}
export function Num({ v, f = n0, ms }: { v: number; f?: (x: number) => string; ms?: number }) { const x = useTween(v, ms); return <>{f(x)}</>; }

/** the statewide bar: Democratic share from the left, Republican from the right, the forecast as a tick */
export function StateBar({ d, r, o, d0, r0, o0, dColor, label }: { d: number; r: number; o: number; d0: number; r0: number; o0: number; dColor: string; label: string }) {
  const t = d + r + o || 1, t0 = d0 + r0 + o0 || 1;
  const ds = (100 * d) / t, rs = (100 * r) / t;
  // the forecast tick marks where the Democratic share ended in the forecast
  const tick = clamp((100 * d0) / t0, 0, 100);
  return (
    <div className="sl-bar" role="img" aria-label={label}>
      <i className="dd" style={{ width: `${ds}%`, background: dColor }} />
      <i className="oo" style={{ left: `${ds}%`, width: `${Math.max(0, 100 - ds - rs)}%` }} />
      <i className="rr" style={{ width: `${rs}%` }} />
      <s className="half" />
      <s className="was" style={{ left: `${tick}%` }} title="The forecast" />
    </div>
  );
}

/** net votes by county, Democratic counties from the center out to the left, Republican to the right */
export function Tug({ rows, dColor, L, unit, hot, onPick, onHover }: { rows: CountyOut[]; dColor: string; L: string; unit: string; hot: string | null; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const a = rows.filter((x) => x.D > x.R).map((x) => ({ id: x.id, name: x.name, v: x.D - x.R })).sort((p, q) => q.v - p.v);
  const b = rows.filter((x) => x.R >= x.D).map((x) => ({ id: x.id, name: x.name, v: x.R - x.D })).sort((p, q) => q.v - p.v);
  const aS = a.reduce((s, x) => s + x.v, 0), bS = b.reduce((s, x) => s + x.v, 0), span = Math.max(aS, bS) || 1;
  const renderSeg = (side: "a" | "b", x: { id: string; name: string; v: number }) => (
    <button key={x.id} type="button" className={`sl-seg ${side}${hot === x.id ? " hot" : ""}`} style={{ width: `${(100 * x.v) / span}%`, background: side === "a" ? dColor : "var(--gop)" }}
      title={`${x.name}: ${side === "a" ? L : "R"} +${n0(x.v)} net votes`} aria-label={`${x.name}, ${side === "a" ? L : "R"} plus ${n0(x.v)} net votes`}
      onClick={() => onPick(x.id)} onMouseEnter={() => onHover(x.id)} onMouseLeave={() => onHover(null)} />
  );
  const net = aS - bS;
  return (
    <div className="sl-tugw">
      <div className="sl-tug">
        <div className="half a">{a.map((x) => renderSeg("a", x))}</div>
        <div className="half b">{b.map((x) => renderSeg("b", x))}</div>
        <span className="mid" />
      </div>
      <div className="sl-tug-lab">
        <span><b style={{ color: dColor }}>{L} +{short(aS)}</b> from {a.length} {unit}</span>
        <span className="c">{Math.abs(net) < 1 ? "Tied" : <>Net <b style={{ color: net > 0 ? dColor : "var(--gop)" }}>{net > 0 ? L : "R"} +{n0(Math.abs(net))}</b> votes</>}</span>
        <span className="r"><b style={{ color: "var(--gop)" }}>R +{short(bS)}</b> from {b.length} {unit}</span>
      </div>
    </div>
  );
}
