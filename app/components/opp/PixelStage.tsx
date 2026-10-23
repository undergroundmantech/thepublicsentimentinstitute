"use client";
// The race stage: the state built from square pixels in each county's forecast color, floating under a spotlight
// over a glossy floor, with dust drifting through the beam. Pixels fly in and lock into place on load, the state
// bobs slowly, and hovering a pixel lifts its whole county and names it. One canvas, paused when off screen,
// a still frame under reduced motion.
import { useEffect, useRef, useState } from "react";
import { canvasDpr, frameGap } from "@/app/lib/lite";
import { useThemeRef } from "@/app/lib/useSiteTheme";

type P = { id: string; d: string };
export type StageLabel = { t: string; s: string; c: string };

const parse = (c: string): [number, number, number] => {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  const h = c.replace("#", "");
  if (/^[0-9a-f]{6}$/i.test(h)) return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  return [90, 84, 110];
};
const bboxOf = (d: string): [number, number, number, number] => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
};

export default function PixelStage({ paths, fills, labels, beam = "#d9ccff", side = 300, label, focus }: {
  paths: P[]; fills: Record<string, string>; labels?: Record<string, StageLabel>; beam?: string; side?: number; label: string; focus?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const ref = useRef<HTMLCanvasElement>(null);
  const hovRef = useRef<string | null>(null);
  const themeRef = useThemeRef();
  const [tip, setTip] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const cv = ref.current, box = wrap.current; if (!cv || !box || !paths.length) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = canvasDpr(), gap = frameGap();
    let raf = 0, alive = true, visible = true, t0 = performance.now(), last = t0, lastF = 0;
    let W = 0, H = 0, step = 8, gx0 = 0, gy0 = 0, floorY = 0, stW = 0, stCx = 0, stBottom = 0;
    let px: { x: number; y: number; sx: number; sy: number; dl: number; id: string; c: string; hc: string; col: number; row: number }[] = [];
    let grid = new Map<number, number>();
    let motes: { x: number; y: number; s: number; v: number; a: number; ph: number }[] = [];
    const [br0, bg0, bb0] = parse(beam);
    const ctx = cv.getContext("2d"); if (!ctx) return;

    const build = () => {
      W = box.clientWidth; H = box.clientHeight; if (!W || !H) return false;
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); cv.style.width = W + "px"; cv.style.height = H + "px";
      const sideRes = W > 1060 ? side : 0;
      const rw = W - sideRes * 2.1, rh = H * 0.72, rx = sideRes * 1.05, ry = H * 0.08;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      const bbs = paths.map((p) => { const b = bboxOf(p.d); if (b[0] < x0) x0 = b[0]; if (b[1] < y0) y0 = b[1]; if (b[2] > x1) x1 = b[2]; if (b[3] > y1) y1 = b[3]; return b; });
      const sc = Math.min((rw * 0.92) / (x1 - x0 || 1), (rh * 0.92) / (y1 - y0 || 1));
      const ox = rx + (rw - (x1 - x0) * sc) / 2 - x0 * sc, oy = ry + (rh - (y1 - y0) * sc) / 2 - y0 * sc;
      step = Math.max(5, Math.round(Math.min((x1 - x0) * sc, (y1 - y0) * sc) / (W < 700 ? 38 : 62)));
      const off = document.createElement("canvas").getContext("2d"); if (!off) return false;
      off.setTransform(sc, 0, 0, sc, ox, oy);
      const p2 = paths.map((p) => new Path2D(p.d));
      gx0 = ox + x0 * sc; gy0 = oy + y0 * sc;
      const cols = Math.ceil(((x1 - x0) * sc) / step), rows = Math.ceil(((y1 - y0) * sc) / step);
      px = []; grid = new Map();
      for (let row = 0; row < rows; row++) for (let col = 0; col < cols; col++) {
        const x = gx0 + col * step + step / 2, y = gy0 + row * step + step / 2;
        const ux = (x - ox) / sc, uy = (y - oy) / sc;
        let hit = -1;
        for (let i = 0; i < paths.length; i++) { const b = bbs[i]; if (ux < b[0] || ux > b[2] || uy < b[1] || uy > b[3]) continue; if (off.isPointInPath(p2[i], x, y)) { hit = i; break; } }
        if (hit < 0) continue;
        const id = paths[hit].id;
        const [r, g, b] = parse(fills[id] ?? "#5a5470");
        // static light from the beam above: brighter toward the top middle of the state
        const lit = 1 + 0.22 * Math.max(0, 1 - Math.hypot((x - W / 2) / (W * 0.35), (y - gy0) / (rows * step))) ;
        const L = (v: number) => Math.min(255, Math.round(v * lit));
        const H2 = (v: number) => Math.min(255, Math.round(v * 1.25 + 40));
        grid.set(row * 10000 + col, px.length);
        px.push({ x: x - step / 2, y: y - step / 2, sx: (Math.random() - 0.5) * W * 0.9, sy: -H * (0.35 + Math.random() * 0.6), dl: Math.random() * 520 + (col / cols) * 380,
          id, c: `rgb(${L(r)},${L(g)},${L(b)})`, hc: `rgb(${H2(r)},${H2(g)},${H2(b)})`, col, row });
      }
      stW = cols * step; stCx = gx0 + stW / 2; stBottom = gy0 + rows * step; floorY = Math.min(H - 18, stBottom + 26);
      const n = Math.round(Math.min(160, W / 9));
      motes = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.8 ? 2 : 3, v: 6 + Math.random() * 16, a: 0.15 + Math.random() * 0.45, ph: Math.random() * 6.28 }));
      return true;
    };

    const ease = (k: number) => 1 - Math.pow(1 - k, 3);
    const draw = (now: number) => {
      if (gap && now - lastF < gap) { if (alive && visible && !reduce) raf = requestAnimationFrame(draw); return; }
      lastF = now;
      const t = now - t0, dt = Math.min(64, now - last) / 1000; last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      const bob = reduce ? 0 : Math.sin(t / 1500) * 7;
      const sway = reduce ? 0 : Math.sin(t / 2300) * 18;
      // the beam: added light on the dark stage, a soft lavender wash by day
      const LT = themeRef.current === "light";
      const [br, bg, bb] = LT ? [124, 92, 240] : [br0, bg0, bb0];
      ctx.globalCompositeOperation = LT ? "multiply" : "lighter";
      const topX = stCx + sway, half = Math.max(160, stW * 0.6);
      const g = ctx.createLinearGradient(0, 0, 0, floorY);
      g.addColorStop(0, `rgba(${br},${bg},${bb},.20)`); g.addColorStop(0.55, `rgba(${br},${bg},${bb},.07)`); g.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(topX - 34, -10); ctx.lineTo(topX + 34, -10); ctx.lineTo(stCx + half, floorY); ctx.lineTo(stCx - half, floorY); ctx.closePath(); ctx.fill();
      const g2 = ctx.createLinearGradient(0, 0, 0, floorY);
      g2.addColorStop(0, LT ? "rgba(124,92,240,.10)" : `rgba(255,255,255,.16)`); g2.addColorStop(1, LT ? "rgba(124,92,240,0)" : "rgba(255,255,255,0)");
      ctx.fillStyle = g2; ctx.beginPath(); ctx.moveTo(topX - 8, -10); ctx.lineTo(topX + 8, -10); ctx.lineTo(stCx + half * 0.35, floorY); ctx.lineTo(stCx - half * 0.35, floorY); ctx.closePath(); ctx.fill();
      // the pool of light on the floor
      ctx.save(); ctx.translate(stCx, floorY); ctx.scale(1, 0.16);
      const pool = ctx.createRadialGradient(0, 0, 0, 0, 0, half * 1.05);
      pool.addColorStop(0, `rgba(${br},${bg},${bb},.32)`); pool.addColorStop(1, `rgba(${br},${bg},${bb},0)`);
      ctx.fillStyle = pool; ctx.beginPath(); ctx.arc(0, 0, half * 1.05, 0, 6.283); ctx.fill(); ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      // the shadow, tighter when the state rises
      ctx.save(); ctx.translate(stCx, floorY); ctx.scale(1, 0.12);
      const sh = ctx.createRadialGradient(0, 0, 0, 0, 0, stW * 0.42);
      sh.addColorStop(0, `rgba(${LT ? "40,20,80" : "0,0,0"},${(LT ? 0.3 : 0.55) - bob * 0.02})`); sh.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(0, 0, stW * 0.42 * (1 + bob / 70), 0, 6.283); ctx.fill(); ctx.restore();

      // the pixels
      const hov = hovRef.current, s = step - 1;
      let settled = true;
      for (const p of px) {
        let k = reduce ? 1 : Math.max(0, Math.min(1, (t - p.dl) / 900)); if (k < 1) settled = false;
        if (k <= 0) continue; k = ease(k);
        const lift = hov && p.id === hov ? -4 : 0;
        const x = p.x + p.sx * (1 - k), y = p.y + p.sy * (1 - k) + bob + lift;
        ctx.globalAlpha = focus && p.id !== focus && p.id !== hov ? k * 0.32 : k;
        ctx.fillStyle = hov && p.id === hov ? p.hc : p.c;
        ctx.fillRect(x, y, s, s);
      }
      // a reflection on the floor, fading out
      if (settled || reduce) {
        const refl = Math.min(1, (t - 1500) / 800);
        if (refl > 0 || reduce) {
          for (const p of px) {
            const dy = stBottom - (p.y + step);
            if (dy > step * 12) continue;
            const a = 0.16 * (1 - dy / (step * 12)) * (reduce ? 1 : refl);
            ctx.globalAlpha = a; ctx.fillStyle = p.c;
            ctx.fillRect(p.x, floorY + 3 + dy * 0.5 - bob * 0.3, s, Math.max(1, s * 0.5));
          }
        }
      }
      // sparkles: a few pixels catch the light
      if (!reduce && settled && px.length) {
        for (let i = 0; i < 6; i++) {
          const p = px[(Math.floor(t / 140) * 7919 + i * 104729) % px.length];
          ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t / 90 + i); ctx.fillStyle = "#fff"; ctx.fillRect(p.x + s * 0.3, p.y + bob + s * 0.3, s * 0.4, s * 0.4);
        }
      }
      // dust in the beam
      for (const m of motes) {
        if (!reduce) { m.y -= m.v * dt; m.x += Math.sin(t / 1300 + m.ph) * 6 * dt; if (m.y < -4) { m.y = H + 4; m.x = Math.random() * W; } }
        const rel = (m.y + 10) / (floorY + 10), hw = 34 + (half - 34) * Math.max(0, Math.min(1, rel)), cx = topX + (stCx - topX) * rel;
        const inBeam = Math.abs(m.x - cx) < hw && m.y < floorY;
        ctx.globalAlpha = m.a * (inBeam ? 1.6 : 0.45) * (0.7 + 0.3 * Math.sin(t / 700 + m.ph));
        ctx.fillStyle = inBeam && !LT ? "#fff" : `rgb(${br},${bg},${bb})`;
        ctx.fillRect(m.x, m.y, m.s, m.s);
      }
      ctx.globalAlpha = 1;
      if (alive && visible && !reduce) raf = requestAnimationFrame(draw);
    };

    const start = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(draw); };
    if (build()) start();
    const ro = new ResizeObserver(() => { if (build()) { if (reduce) draw(performance.now()); else start(); } });
    ro.observe(box);
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible && !reduce) start(); }, { threshold: 0 });
    io.observe(box);

    const onMove = (e: PointerEvent) => {
      const r = box.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      const col = Math.floor((x - gx0) / step), row = Math.floor((y - gy0 - Math.sin((performance.now() - t0) / 1500) * 7) / step);
      const i = grid.get(row * 10000 + col);
      const id = i != null ? px[i].id : null;
      hovRef.current = id;
      setTip(id ? { id, x, y } : null);
      if (reduce) draw(performance.now());
    };
    const onLeave = () => { hovRef.current = null; setTip(null); if (reduce) draw(performance.now()); };
    box.addEventListener("pointermove", onMove); box.addEventListener("pointerleave", onLeave);
    return () => { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); box.removeEventListener("pointermove", onMove); box.removeEventListener("pointerleave", onLeave); };
  }, [paths, fills, beam, side, focus]);

  const L = tip && labels?.[tip.id];
  return (
    <div ref={wrap} className="ps-wrap">
      <canvas ref={ref} className="ps-cv" role="img" aria-label={label} />
      {L ? (
        <div className="ps-tip" style={{ left: tip!.x, top: tip!.y }}>
          <b>{L.t}</b><span style={{ color: L.c }}>{L.s}</span>
        </div>
      ) : null}
    </div>
  );
}
