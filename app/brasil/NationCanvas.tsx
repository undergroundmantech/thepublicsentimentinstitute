"use client";
// All 5,500 municipalities of Brazil on one canvas, with the state lines drawn over them. Drag to move, scroll or
// pinch to zoom, click a municipality to pick it. The page decides the colors, so the explorer and the control room
// both use it. Municipalities that just reported can be made to flash.
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from "react";
import FloatTip from "@/app/components/opp/FloatTip";
import { keyOf, pathBounds, type MunRow } from "./lib";
import { useFmt } from "./i18n";

export type Muni = { uf: string; key: string; row: MunRow; p: Path2D; b: readonly [number, number, number, number] };
export type CanvasHandle = { fly: (uf: string | null) => void; zoom: (k: number) => void };
type View = { x: number; y: number; k: number };
const all = new Map<string, MunRow[]>();

export function useAllMun(ufs: string[]) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let dead = false;
    ufs.forEach((uf, i) => {
      if (all.has(uf)) { setN((x) => x + 1); return; }
      setTimeout(() => fetch(`/brasil/mun/${uf}.json`).then((r) => r.json()).then((j) => { all.set(uf, j.rows); if (!dead) setN((x) => x + 1); }).catch(() => {}), i * 15);
    });
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return useMemo(() => {
    const out: Muni[] = [];
    if (typeof Path2D === "undefined") return out;
    for (const uf of ufs) for (const r of all.get(uf) ?? []) if (r[5]) out.push({ uf, key: keyOf(r[1]), row: r, p: new Path2D(r[5]), b: pathBounds(r[5]) });
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [n]);
}

type Props = {
  munis: Muni[]; borders: { uf: string; d: string }[]; fill: (m: Muni) => string; tip?: (m: Muni) => React.ReactNode;
  onPick?: (m: Muni) => void; glow?: Map<string, number>; sel?: string | null; border?: string; ctrlWheel?: boolean; inset?: { l: number; r: number; t?: number; b?: number };
};

const NationCanvas = forwardRef<CanvasHandle, Props>(function NationCanvas({ munis, borders, fill, tip, onPick, glow, sel, border = "rgba(255,255,255,.75)", ctrlWheel = false, inset }, ref) {
  const wrap = useRef<HTMLDivElement>(null), cv = useRef<HTMLCanvasElement>(null);
  const tr = useFmt().t;
  const [size, setSize] = useState({ w: 800, h: 600 });
  const bp = useMemo(() => (typeof Path2D === "undefined" ? [] : borders.map((b) => ({ uf: b.uf, p: new Path2D(b.d), b: pathBounds(b.d) }))), [borders]);
  const world = useMemo(() => {
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const b of bp) { x0 = Math.min(x0, b.b[0]); y0 = Math.min(y0, b.b[1]); x1 = Math.max(x1, b.b[2]); y1 = Math.max(y1, b.b[3]); }
    return [x0, y0, x1, y1] as const;
  }, [bp]);
  // the panels over the map take the sides on a wide screen, so the map fits in the space between them
  const ins = size.w >= 1100 && inset ? inset : { l: 0, r: 0, t: 0, b: 0 };
  const fit = useCallback((b: readonly [number, number, number, number], pad = 0.08): View => {
    const W = Math.max(200, size.w - ins.l - ins.r), Hh = Math.max(200, size.h - (ins.t ?? 0) - (ins.b ?? 0));
    const w = b[2] - b[0], h = b[3] - b[1], k = Math.min(W / (w * (1 + 2 * pad)), Hh / (h * (1 + 2 * pad)));
    return { k, x: ins.l + W / 2 - k * (b[0] + w / 2), y: (ins.t ?? 0) + Hh / 2 - k * (b[1] + h / 2) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, ins.l, ins.r, ins.t, ins.b]);
  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const vref = useRef(view); vref.current = view;
  const anim = useRef<number | null>(null);
  const flyTo = useCallback((to: View, ms = 900) => {
    if (anim.current) cancelAnimationFrame(anim.current);
    const from = vref.current, t0 = performance.now();
    const step = (t: number) => {
      const u = Math.min(1, (t - t0) / ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      const lk = Math.log(from.k) + (Math.log(to.k) - Math.log(from.k)) * e, k = Math.exp(lk);
      // keep the screen point under the target moving smoothly while zooming on a log scale
      setView({ k, x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e });
      if (u < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, []);
  useImperativeHandle(ref, () => ({
    fly: (uf) => { const b = uf ? bp.find((x) => x.uf === uf)?.b : world; if (b) flyTo(fit(b, uf ? 0.12 : 0.04)); },
    zoom: (f) => { const v = vref.current, cx = size.w / 2, cy = size.h / 2, k = Math.min(400, Math.max(fit(world, 0.04).k * 0.6, v.k * f)); flyTo({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k }, 300); },
  }), [bp, world, fit, flyTo, size]);

  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el); setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);
  const fitted = useRef(false);
  useEffect(() => { if (bp.length && size.w > 10) { setView(fit(world, 0.04)); fitted.current = true; } }, [bp.length, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // draw
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== size.w * dpr) { c.width = size.w * dpr; c.height = size.h * dpr; }
    const g = c.getContext("2d")!; g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, size.w, size.h);
    g.save(); g.translate(view.x, view.y); g.scale(view.k, view.k);
    const vx0 = -view.x / view.k, vy0 = -view.y / view.k, vx1 = vx0 + size.w / view.k, vy1 = vy0 + size.h / view.k;
    const now = performance.now(); let live = false;
    g.lineJoin = "round";
    for (const m of munis) {
      if (m.b[2] < vx0 || m.b[0] > vx1 || m.b[3] < vy0 || m.b[1] > vy1) continue;
      g.fillStyle = fill(m); g.fill(m.p);
    }
    if (view.k > 2.2) { g.strokeStyle = "rgba(6,5,16,.55)"; g.lineWidth = 0.6 / view.k; for (const m of munis) { if (m.b[2] < vx0 || m.b[0] > vx1 || m.b[3] < vy0 || m.b[1] > vy1) continue; g.stroke(m.p); } }
    if (glow && glow.size) {
      for (const m of munis) {
        const t = glow.get(m.uf + ":" + m.key); if (t == null) continue;
        const a = 1 - (now - t) / 2600; if (a <= 0) continue; live = true;
        g.save(); g.shadowColor = `rgba(255,255,255,${a})`; g.shadowBlur = 18 * a; g.fillStyle = `rgba(255,255,255,${0.75 * a})`; g.fill(m.p); g.restore();
      }
    }
    g.strokeStyle = border; g.lineWidth = 1.1 / view.k; for (const b of bp) g.stroke(b.p);
    if (sel) { const b = bp.find((x) => x.uf === sel); if (b) { g.save(); g.shadowColor = "#ffd98a"; g.shadowBlur = 14; g.strokeStyle = "#ffd98a"; g.lineWidth = 2.2 / view.k; g.stroke(b.p); g.restore(); } }
    g.restore();
    if (live) { const id = requestAnimationFrame(() => setTick((x) => x + 1)); return () => cancelAnimationFrame(id); }
  }, [munis, bp, view, size, fill, glow, sel, border, tick]);

  // interaction
  const drag = useRef<{ x: number; y: number; v: View; moved: boolean } | null>(null);
  const [hov, setHov] = useState<{ m: Muni; x: number; y: number } | null>(null);
  const hit = (cx: number, cy: number) => {
    const c = cv.current!, r = c.getBoundingClientRect(), v = vref.current;
    const wx = (cx - r.left - v.x) / v.k, wy = (cy - r.top - v.y) / v.k;
    const g = c.getContext("2d")!;
    for (const m of munis) if (wx >= m.b[0] && wx <= m.b[2] && wy >= m.b[1] && wy <= m.b[3] && g.isPointInPath(m.p, wx, wy)) return m;
    return null;
  };
  useEffect(() => {
    const c = cv.current; if (!c) return;
    const wh = (e: WheelEvent) => {
      if (ctrlWheel && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault(); const r = c.getBoundingClientRect(), v = vref.current, cx = e.clientX - r.left, cy = e.clientY - r.top;
      const k = Math.min(400, Math.max(fit(world, 0.04).k * 0.6, v.k * Math.exp(-e.deltaY * 0.0018)));
      if (anim.current) cancelAnimationFrame(anim.current);
      setView({ k, x: cx - ((cx - v.x) * k) / v.k, y: cy - ((cy - v.y) * k) / v.k });
    };
    c.addEventListener("wheel", wh, { passive: false }); return () => c.removeEventListener("wheel", wh);
  }, [fit, world, ctrlWheel]);
  const pts = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ d: number; v: View; cx: number; cy: number } | null>(null);
  return (
    <div ref={wrap} style={{ position: "absolute", inset: 0 }}>
      <canvas ref={cv} style={{ width: size.w, height: size.h }} aria-label={tr("Map of Brazil by municipality", "Mapa do Brasil por município")} role="img"
        onPointerDown={(e) => { (e.target as Element).setPointerCapture(e.pointerId); pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); drag.current = { x: e.clientX, y: e.clientY, v: vref.current, moved: false };
          if (pts.current.size === 2) { const [a, b] = [...pts.current.values()]; const r = cv.current!.getBoundingClientRect(); pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), v: vref.current, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top }; } }}
        onPointerMove={(e) => {
          if (pts.current.has(e.pointerId)) pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          const p = pinch.current;
          if (p && pts.current.size === 2) { const [a, b] = [...pts.current.values()]; const k = p.v.k * Math.hypot(a.x - b.x, a.y - b.y) / p.d; setView({ k, x: p.cx - ((p.cx - p.v.x) * k) / p.v.k, y: p.cy - ((p.cy - p.v.y) * k) / p.v.k }); if (drag.current) drag.current.moved = true; return; }
          const d = drag.current;
          if (d && e.buttons === 1) { const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true; if (d.moved) { if (anim.current) cancelAnimationFrame(anim.current); setView({ ...d.v, x: d.v.x + dx, y: d.v.y + dy }); setHov(null); } return; }
          if (e.pointerType === "mouse") { const m = hit(e.clientX, e.clientY); setHov(m ? { m, x: e.clientX, y: e.clientY } : null); }
        }}
        onPointerUp={(e) => { pts.current.delete(e.pointerId); if (pts.current.size < 2) pinch.current = null; const d = drag.current; drag.current = null; if (d && !d.moved) { const m = hit(e.clientX, e.clientY); if (m) { onPick?.(m); if (e.pointerType !== "mouse") setHov({ m, x: e.clientX, y: e.clientY }); } } }}
        onPointerLeave={() => setHov(null)} />
      {hov && tip && <FloatTip x={hov.x} y={hov.y} className="br-tip" scope="opp br">{tip(hov.m)}</FloatTip>}
    </div>
  );
});
export default NationCanvas;
