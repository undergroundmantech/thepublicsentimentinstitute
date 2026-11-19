"use client";
// The promo's map moves, for any SVG map on the site:
//   InkDefs     the wobbling ink filter, the pencil hatch, and the lift shadow, sized to the map's own viewBox
//   useBoil     ticks the wobble at 8 frames a second like stop motion, paused for reduced motion and hidden tabs
//   useInView   holds every animation until the map scrolls into view
//   sweepDelays a delay per shape so a map fills in from left to right like a pen crossing the page
//   InkOutline  the thick hand drawn outline that traces itself in
//   Slab3D      a state as a thick 3D paper cutout that tilts and floats, the promo's state close up
// Every shape keeps its own fill and hover, these only add layers on top and below.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from "react";

/** the middle of a path, from up to 400 of its points */
export function centerOf(d: string): [number, number] {
  const re = /(-?\d*\.?\d+)[ ,](-?\d*\.?\d+)/g; let m: RegExpExecArray | null, sx = 0, sy = 0, n = 0;
  while ((m = re.exec(d)) && n < 400) { sx += +m[1]; sy += +m[2]; n++; }
  return n ? [sx / n, sy / n] : [0, 0];
}

/** seconds of delay per key so the map fills in from the left */
export function sweepDelays(items: [string, string][], span = 0.9): Record<string, string> {
  const xs = items.map(([k, d]) => [k, centerOf(d)[0]] as const);
  const lo = Math.min(...xs.map((x) => x[1])), hi = Math.max(...xs.map((x) => x[1]));
  const out: Record<string, string> = {};
  for (const [k, x] of xs) out[k] = `${(((x - lo) / Math.max(1e-6, hi - lo)) * span).toFixed(3)}s`;
  return out;
}

/** the viewBox width over 1000, a first guess at line sizes before the map is measured */
export function vbScale(viewBox: string) { const w = +viewBox.split(/[ ,]+/)[2]; return (w || 1000) / 1000; }

/** map units per screen pixel, measured, so a tall state like Maine gets the same weight of line as a wide one */
export function usePxScale(ref: RefObject<SVGSVGElement | null>, viewBox: string) {
  const [s, setS] = useState(() => vbScale(viewBox));
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const [, , vw, vh] = viewBox.split(/[ ,]+/).map(Number);
    const upd = () => { const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) setS(Math.max(vw / r.width, vh / r.height) * 0.95); };
    upd();
    if (!("ResizeObserver" in window)) return;
    const ro = new ResizeObserver(upd); ro.observe(el); return () => ro.disconnect();
  }, [ref, viewBox]);
  return s;
}

export function InkDefs({ id, scale = 1, wobble = 1 }: { id: string; scale?: number; wobble?: number }) {
  const s = scale;
  return (
    <defs>
      <filter id={`${id}-boil`} x="-4%" y="-4%" width="108%" height="108%" filterUnits="objectBoundingBox">
        <feTurbulence type="fractalNoise" baseFrequency={(0.03 / s).toFixed(5)} numOctaves={2} seed={1} data-boil="" />
        <feDisplacementMap in="SourceGraphic" scale={(4.2 * s * wobble).toFixed(3)} xChannelSelector="R" yChannelSelector="G" />
      </filter>
      <pattern id={`${id}-pen`} width={5.5 * s} height={5.5 * s} patternUnits="userSpaceOnUse" patternTransform="rotate(38)">
        <line x1="0" y1="0" x2="0" y2={5.5 * s} stroke="#141218" strokeOpacity=".2" strokeWidth={1.05 * s} />
      </pattern>
      <pattern id={`${id}-pen2`} width={7 * s} height={7 * s} patternUnits="userSpaceOnUse" patternTransform="rotate(-42)">
        <line x1="0" y1="0" x2="0" y2={7 * s} stroke="#141218" strokeOpacity=".1" strokeWidth={0.9 * s} />
      </pattern>
      <filter id={`${id}-lift`} x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx={3.5 * s} dy={4.5 * s} stdDeviation="0" floodColor="#141218" floodOpacity="1" />
      </filter>
    </defs>
  );
}

/** pencil hatching for the eight ratings, the same densities as the kit's state maps: safe heavy, likely mid, lean light */
export const HATCH: Record<string, [number, string, number, number, string]> = {
  SD: [40, "#1f3fd1", 3.4, 5, "rgba(31,63,209,.46)"], LD: [40, "#1f3fd1", 2, 6.5, "rgba(31,63,209,.14)"], ND: [40, "#3d64e6", 1.2, 9, "rgba(61,100,230,.07)"],
  TD: [40, "#8a4cf0", 1.6, 7, "rgba(138,76,240,.14)"], TR: [-40, "#8a4cf0", 1.6, 7, "rgba(138,76,240,.14)"],
  NR: [-40, "#e05454", 1.2, 9, "rgba(224,84,84,.07)"], LR: [-40, "#d42a2a", 2, 6.5, "rgba(212,42,42,.14)"], SR: [-40, "#d42a2a", 3.4, 5, "rgba(212,42,42,.46)"],
};
export function HatchDefs({ id, scale = 1 }: { id: string; scale?: number }) {
  return (
    <defs>
      {Object.entries(HATCH).map(([k, [a, c, w, g, bg]]) => (
        <pattern key={k} id={`${id}-h-${k}`} width={g * scale} height={g * scale} patternUnits="userSpaceOnUse" patternTransform={`rotate(${a})`}>
          <rect width={g * scale} height={g * scale} fill={bg} /><line x1="0" y1="0" x2="0" y2={g * scale} stroke={c} strokeWidth={w * scale} />
        </pattern>
      ))}
    </defs>
  );
}

/** the flat ink wash for counties and districts: pale for close, deep for safe, five steps a side, lavender for even */
export const WASH_D = ["#d5dcf6", "#a9b7ee", "#7388e2", "#3f5bd6", "#1a34b0"];
export const WASH_R = ["#f6d7d2", "#eeaba5", "#e27a74", "#d64540", "#b21f1f"];
export const WASH_T = "#d9c6fb";
export const WASH_CUTS = [1, 6, 14, 26, 40];
export function washStep(m: number) { const a = Math.abs(m); return a < WASH_CUTS[0] ? 0 : a < WASH_CUTS[1] ? 1 : a < WASH_CUTS[2] ? 2 : a < WASH_CUTS[3] ? 3 : a < WASH_CUTS[4] ? 4 : 5; }
/** margins are Republican minus Democrat, so a negative margin is a Democratic lead */
export function washColor(m: number) { const s = washStep(m); return s === 0 ? WASH_T : (m < 0 ? WASH_D : WASH_R)[s - 1]; }
export function washInk(m: number) { return washStep(m) >= 4 ? "#fff" : "#141218"; }

const reduced = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** ticks every wobble filter inside the element */
export function useBoil(ref: RefObject<Element | null>, fps = 8) {
  useEffect(() => {
    if (reduced()) return;
    let seed = 1;
    const t = window.setInterval(() => {
      if (document.hidden || !ref.current) return;
      seed = (seed % 97) + 1;
      ref.current.querySelectorAll("[data-boil]").forEach((f) => f.setAttribute("seed", String(seed)));
    }, 1000 / fps);
    return () => window.clearInterval(t);
  }, [ref, fps]);
}

/** true once the element is on screen, and after two and a half seconds either way */
export function useInView(ref: RefObject<Element | null>) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (go) return;
    const el = ref.current; if (!el) return;
    const t = window.setTimeout(() => setGo(true), 2500);
    if (!("IntersectionObserver" in window)) { setGo(true); return () => window.clearTimeout(t); }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setGo(true); io.disconnect(); } }, { threshold: 0.15 });
    io.observe(el);
    return () => { io.disconnect(); window.clearTimeout(t); };
  }, [ref, go]);
  return go;
}

/** the outline that traces itself in; pass the same delays as the fills */
export function InkOutline({ id, shapes, width = 1.6, delays, scale = 1 }: { id: string; shapes: [string, string][]; width?: number; delays?: Record<string, string>; scale?: number }) {
  return (
    <g className="sk-map-ink" filter={`url(#${id}-boil)`} aria-hidden="true">
      {shapes.map(([k, d]) => <path key={k} d={d} pathLength={1} strokeWidth={width * scale} style={{ "--d": delays?.[k] ?? "0s" } as CSSProperties} />)}
    </g>
  );
}

/** one shape lifted off the page with a highlighter ring, drawn above everything, for the hovered state or county */
export function Lift({ id, d, fill, scale = 1 }: { id: string; d: string | null; fill: string; scale?: number }) {
  if (!d) return null;
  return (
    <g className="sk-map-lift" key={d.length + d.slice(0, 24)} aria-hidden="true">
      <path className="sk-map-marker" d={d} fill="none" stroke="#f5c518" strokeOpacity=".9" strokeWidth={9 * scale} strokeLinejoin="round" />
      <path d={d} fill={fill} filter={`url(#${id}-lift)`} stroke="#141218" strokeWidth={2.4 * scale} strokeLinejoin="round" />
      <path d={d} fill={`url(#${id}-pen)`} />
    </g>
  );
}

/** a state as a thick paper cutout with a hatched top, floating and tilted in 3D */
export function Slab3D({ d, viewBox, fill, depth = 12, className = "" }: { d: string; viewBox: string; fill: string; depth?: number; className?: string }) {
  const id = useMemo(() => "slab" + Math.abs(d.length * 31 + d.charCodeAt(4) * 7), [d]);
  const ref = useRef<HTMLDivElement>(null);
  const top = useRef<SVGSVGElement>(null);
  const s = usePxScale(top, viewBox);
  useBoil(ref);
  const layers = Array.from({ length: depth }, (_, i) => depth - i);
  const [, , vw, vh] = viewBox.split(/[ ,]+/).map(Number);
  return (
    <div ref={ref} data-sk-nohatch="" data-sk-noring="" className={`sk-slab ${className}`} style={{ "--ar": (vw / vh).toFixed(3) } as CSSProperties} aria-hidden="true">
      <div className="sk-slab-rig">
        {layers.map((i) => (
          <svg key={i} viewBox={viewBox} style={{ transform: `translateZ(${-i * 4.2}px)` }}>
            <path d={d} fill={i < 3 ? "#3a1a78" : "#24103f"} stroke={i < 3 ? "#3a1a78" : "#24103f"} strokeWidth={2.4 * s} strokeLinejoin="round" />
          </svg>
        ))}
        <svg ref={top} viewBox={viewBox} style={{ transform: "translateZ(1px)" }}>
          <InkDefs id={id} scale={s} wobble={1.3} />
          <path d={d} fill={fill} />
          <path d={d} fill={`url(#${id}-pen)`} />
          <path d={d} fill={`url(#${id}-pen2)`} />
          <g filter={`url(#${id}-boil)`}><path className="sk-slab-ol" d={d} pathLength={1} fill="none" stroke="#141218" strokeWidth={4.4 * s} strokeLinejoin="round" /></g>
        </svg>
      </div>
      <i className="sk-slab-shadow" />
    </div>
  );
}
