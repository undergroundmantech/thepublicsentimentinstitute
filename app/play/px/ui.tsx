"use client";
// Small pieces shared by the scenes: animated portraits, typewriter text, rolling numbers.
import React, { useEffect, useRef, useState } from "react";
import { portrait, figure, paintGrid, type Who } from "./sprites";
import { sfx } from "./sound";

export function Portrait({ seed, role, party, talking = false, size = 96, female, className }: { seed: number; role: Who; party: string; talking?: boolean; size?: number; female?: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const talk = useRef(talking); useEffect(() => { talk.current = talking; }, [talking]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const g = cv.getContext("2d")!;
    const frames = [0, 1, 2].map((f) => portrait(seed, role, party, f, female));
    let raf = 0, last = -1;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      const blink = t % 3400 < 140; const mouth = talk.current && Math.floor(t / 130) % 2 === 1;
      const f = blink ? 2 : mouth ? 1 : 0; if (f === last) return; last = f;
      g.clearRect(0, 0, 24, 24); paintGrid(g, frames[f], 0, 0);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [seed, role, party, female]);
  return <canvas ref={ref} width={24} height={24} className={`px-portrait ${className ?? ""}`} style={{ width: size, height: size }} aria-hidden="true" />;
}

export function Figure({ seed, party, role = "cand", talking = false, scale = 6, flip = false }: { seed: number; party: string; role?: Who; talking?: boolean; scale?: number; flip?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const talk = useRef(talking); useEffect(() => { talk.current = talking; }, [talking]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const g = cv.getContext("2d")!;
    const fr = [figure(seed, party, 0, role), figure(seed, party, 1, role)];
    let raf = 0, last = -1;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); const f = talk.current && Math.floor(t / 160) % 2 ? 1 : 0; if (f === last) return; last = f; g.clearRect(0, 0, 8, 14); paintGrid(g, fr[f], 0, 0, flip); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [seed, party, role, flip]);
  return <canvas ref={ref} width={8} height={14} className="px-fig" style={{ width: 8 * scale, height: 14 * scale }} aria-hidden="true" />;
}

/** Text that types itself out, with a tick per letter. Click to finish. */
export function Type({ text, speed = 22, onDone, sound = true, className }: { text: string; speed?: number; onDone?: () => void; sound?: boolean; className?: string }) {
  const [n, setN] = useState(0);
  const done = useRef(onDone); useEffect(() => { done.current = onDone; }, [onDone]);
  useEffect(() => { setN(0); }, [text]);
  useEffect(() => {
    if (n >= text.length) { done.current?.(); return; }
    const id = setTimeout(() => { setN((x) => Math.min(text.length, x + 2)); if (sound && n % 6 === 0) sfx("type"); }, speed);
    return () => clearTimeout(id);
  }, [n, text, speed, sound]);
  return <span className={className} onClick={() => setN(text.length)}>{text.slice(0, n)}{n < text.length ? <i className="px-caret" /> : null}</span>;
}

/** A number that rolls to its new value. */
export function Roll({ v, fmt = (x: number) => Math.round(x).toLocaleString(), ms = 650 }: { v: number; fmt?: (x: number) => string; ms?: number }) {
  const [d, setD] = useState(v); const from = useRef(v);
  useEffect(() => {
    const a = from.current, b = v; if (a === b) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / ms); const e = 1 - Math.pow(1 - k, 3); setD(a + (b - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [v, ms]);
  return <>{fmt(d)}</>;
}

export const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");
export const sur = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];
export const fxs = (v: number) => `${v >= 0 ? "+" : "-"}${Math.abs(v).toFixed(2)}`;
