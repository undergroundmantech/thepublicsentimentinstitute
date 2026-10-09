"use client";
import { useEffect, useRef, useState } from "react";

/** Counts up from 0 to the target once on mount, with a cubic ease out, keeping the target's decimals. */
export function CountUp({ value, prefix = "", suffix = "", decimals }: { value: number; prefix?: string; suffix?: string; decimals?: number }) {
  const dec = decimals ?? ((String(value).split(".")[1] || "").length);
  const [v, setV] = useState(value);
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return; done.current = true;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0, t0 = 0;
    const step = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min(1, (ts - t0) / 1400);
      setV(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    setV(0); raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{prefix}{v.toFixed(dec)}{suffix}</>;
}

/** A bar segment whose width grows from 0 to w percent once, 150ms after mount. */
export function Grow({ w, color, className }: { w: number; color?: string; className?: string }) {
  const [on, setOn] = useState(false);
  useEffect(() => { const t = setTimeout(() => setOn(true), 150); return () => clearTimeout(t); }, []);
  return <i className={className} style={{ background: color, width: on ? `${w}%` : 0 }} />;
}

/** Shared tooltip: fixed, 14px from the cursor, flips near the right and bottom edges, hides on scroll. */
export type TipState = { html: React.ReactNode; x: number; y: number } | null;
export function useTip() {
  const [tip, setTip] = useState<TipState>(null);
  useEffect(() => {
    const hide = () => setTip(null);
    window.addEventListener("scroll", hide, { passive: true });
    return () => window.removeEventListener("scroll", hide);
  }, []);
  const show = (html: React.ReactNode, e: { clientX: number; clientY: number }) => setTip({ html, x: e.clientX, y: e.clientY });
  const hide = () => setTip(null);
  return { tip, show, hide };
}
export function Tip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  let x = tip.x + 14, y = tip.y + 14;
  if (typeof window !== "undefined") {
    if (x + 240 > window.innerWidth) x = tip.x - 250;
    if (y + 140 > window.innerHeight) y = tip.y - 140;
  }
  return <div className="tip" style={{ display: "block", left: x, top: y }}>{tip.html}</div>;
}
