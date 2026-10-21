"use client";
// The state drawn as a field of dots in each county's forecast color, swept in from the center. A canvas, so a
// state with 254 counties still paints in one frame; it only decorates, the map below carries the data.
import { useEffect, useRef } from "react";

export default function DotState({ paths, fills, label }: { paths: { id: string; d: string }[]; fills: Record<string, string>; label: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv || !paths.length) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = cv.clientWidth, H = cv.clientHeight; if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    // bounding box of every path
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    for (const p of paths) { let m: RegExpExecArray | null; re.lastIndex = 0; while ((m = re.exec(p.d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    const sc = Math.min((W * 0.94) / (x1 - x0 || 1), (H * 0.94) / (y1 - y0 || 1));
    const ox = (W - (x1 - x0) * sc) / 2 - x0 * sc, oy = (H - (y1 - y0) * sc) / 2 - y0 * sc;
    // paint the counties to an offscreen canvas, then sample it on a grid
    const off = document.createElement("canvas"); off.width = W; off.height = H;
    const oc = off.getContext("2d", { willReadFrequently: true }); if (!oc) return;
    oc.setTransform(sc, 0, 0, sc, ox, oy);
    for (const p of paths) { oc.fillStyle = fills[p.id] ?? "#555"; oc.fill(new Path2D(p.d)); }
    const img = oc.getImageData(0, 0, W, H).data;
    const step = Math.max(5, Math.round(Math.min(W, H) / 70));
    const dots: { x: number; y: number; c: string; d: number }[] = [];
    const cx = W / 2, cy = H / 2;
    for (let y = step / 2; y < H; y += step) for (let x = step / 2; x < W; x += step) {
      const i = ((y | 0) * W + (x | 0)) * 4; if (img[i + 3] < 128) continue;
      dots.push({ x, y, c: `rgb(${img[i]},${img[i + 1]},${img[i + 2]})`, d: Math.hypot(x - cx, y - cy) });
    }
    const maxD = Math.max(1, ...dots.map((d) => d.d));
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let raf = 0; const t0 = performance.now();
    const draw = (t: number) => {
      const k = reduce ? 2 : Math.min(2, (t - t0) / 900);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        const e = Math.max(0, Math.min(1, k * 1.4 - (d.d / maxD) * 1.1)); if (e <= 0) continue;
        ctx.globalAlpha = 0.25 + 0.75 * e; ctx.fillStyle = d.c; ctx.beginPath(); ctx.arc(d.x, d.y, (step * 0.38) * (0.4 + 0.6 * e), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (k < 2) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [paths, fills]);
  return <div className="st-art" aria-hidden="true"><canvas ref={ref} aria-label={label} /></div>;
}
