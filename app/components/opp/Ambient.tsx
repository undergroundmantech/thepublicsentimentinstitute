"use client";
// A fixed layer of slow pixel dust behind the race pages. It drifts upward, leans a little toward the pointer,
// pauses when the tab is hidden, and is a single still frame under reduced motion.
import { useEffect, useRef } from "react";
import { canvasDpr, isLite } from "@/app/lib/lite";

export default function Ambient({ tint = "#b8a4ff" }: { tint?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    // light rendering draws one still frame, like reduced motion
    const reduce = isLite() || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const dpr = canvasDpr();
    const h = tint.replace("#", ""); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    let W = 0, H = 0, raf = 0, last = performance.now(), mx = 0.5;
    let dots: { x: number; y: number; s: number; v: number; a: number; p: number }[] = [];
    const size = () => {
      W = window.innerWidth; H = window.innerHeight;
      cv.width = W * dpr; cv.height = H * dpr; cv.style.width = W + "px"; cv.style.height = H + "px";
      const n = Math.round(Math.min(110, (W * H) / 14000));
      dots = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() < 0.75 ? 2 : 3, v: 5 + Math.random() * 14, a: 0.08 + Math.random() * 0.3, p: Math.random() * 6.28 }));
    };
    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 1000; last = now;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
      for (const d of dots) {
        if (!reduce) { d.y -= d.v * dt; d.x += (Math.sin(now / 1800 + d.p) * 5 + (mx - 0.5) * 8) * dt; if (d.y < -4) { d.y = H + 4; d.x = Math.random() * W; } }
        ctx.globalAlpha = d.a * (0.6 + 0.4 * Math.sin(now / 900 + d.p));
        ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(d.x, d.y, d.s, d.s);
      }
      if (!reduce && !document.hidden) raf = requestAnimationFrame(draw);
    };
    const go = () => { cancelAnimationFrame(raf); last = performance.now(); raf = requestAnimationFrame(draw); };
    const onMove = (e: PointerEvent) => { mx = e.clientX / (W || 1); };
    const onVis = () => { if (!document.hidden && !reduce) go(); };
    // a phone fires resize as its address bar slides; only a real width change rebuilds the dust
    let lastW = -1;
    const onResize = () => { if (window.innerWidth === lastW && W) return; lastW = window.innerWidth; size(); go(); };
    onResize();
    window.addEventListener("resize", onResize); window.addEventListener("pointermove", onMove); document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); window.removeEventListener("pointermove", onMove); document.removeEventListener("visibilitychange", onVis); };
  }, [tint]);
  return <canvas ref={ref} className="amb-cv" aria-hidden="true" />;
}
