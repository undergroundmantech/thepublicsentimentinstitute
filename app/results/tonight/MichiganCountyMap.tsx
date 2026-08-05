"use client";

// Michigan county choropleth, ported from the DSMeridian forecast map reference
// build (changeorders/TPSI_Michigan_Election_Forecast_Map.html). Geometry is
// baked SVG, not topojson, so it renders with no fetch and no projection math.
//
// Forecast view paints the modeled two-way share (or projected turnout).
// Results view paints live CivicAPI county returns — Michigan currently reports
// statewide only, so those counties render as unreported until returns land.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MI_COUNTY_PATHS, MI_MAP_VIEWBOX } from "../_data/miCountyGeo";
import type { CountyProjection } from "./countyForecast";

export type MapView = "forecast" | "results";
export type ForecastMode = "margin" | "turnout";

type RGB = [number, number, number];

const EL: RGB = [47, 168, 148];
const ELD: RGB = [11, 95, 84];
const ST: RGB = [144, 112, 196];
const STD: RGB = [74, 47, 134];

// Ramp midpoints differ by theme so a 50/50 county reads as neutral surface
// rather than a dark blot on a white page.
const MID_DARK: RGB = [58, 58, 66];
const MID_LIGHT: RGB = [232, 232, 226];
const T1_DARK: RGB = [30, 30, 36];
const T1_LIGHT: RGB = [237, 237, 231];
const T2: RGB = [15, 95, 85];

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Two-way El-Sayed share → teal/purple divergent ramp, saturating at ±15 pts. */
function cMargin(twoWay: number, mid: RGB): string {
  const d = clamp(twoWay - 50, -15, 15) / 15;
  if (d >= 0) return rgb(d < 0.5 ? mix(mid, EL, d * 2) : mix(EL, ELD, (d - 0.5) * 2));
  const n = -d;
  return rgb(n < 0.5 ? mix(mid, ST, n * 2) : mix(ST, STD, (n - 0.5) * 2));
}

/** Sequential turnout ramp, power-scaled so small counties stay legible. */
const cVotes = (v: number, vmax: number, t1: RGB) =>
  rgb(mix(t1, T2, Math.pow(v / vmax, 0.42)));

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

const [VB_X, VB_Y, VB_W, VB_H] = MI_MAP_VIEWBOX.split(/\s+/).map(Number);
const MIN_K = 1;
const MAX_K = 10;

/** Tooltip box estimate, used only to decide which side of the cursor to sit on. */
const TIP_W = 240;
const TIP_H = 150;
const TIP_GAP = 12;
type Transform = { k: number; x: number; y: number };
const IDENTITY: Transform = { k: 1, x: 0, y: 0 };

/** Keeps the geometry covering the viewport at every zoom level. */
function clampT(t: Transform): Transform {
  const k = clamp(t.k, MIN_K, MAX_K);
  return {
    k,
    x: clamp(t.x, (VB_X + VB_W) * (1 - k), VB_X * (1 - k)),
    y: clamp(t.y, (VB_Y + VB_H) * (1 - k), VB_Y * (1 - k)),
  };
}

/** Follows the site's <html data-theme> so the ramps flip with everything else. */
function useSiteTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () =>
      setTheme(
        document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"
      );
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

interface Props {
  view: MapView;
  mode: ForecastMode;
  /** Live-blended county projections keyed by UPPERCASE county name. */
  counties: Record<string, CountyProjection>;
  /** Live county returns keyed by UPPERCASE county name, when CivicAPI has them. */
  liveCounties?: Record<string, { elSayedVotes: number; stevensVotes: number; reporting: number }>;
}

export default function MichiganCountyMap({ view, mode, counties, liveCounties }: Props) {
  // x/y are cursor coordinates relative to the map wrapper; w/h are its size.
  const [hover, setHover] = useState<
    { c: CountyProjection; x: number; y: number; w: number; h: number } | null
  >(null);
  const [t, setT] = useState<Transform>(IDENTITY);
  const [dragging, setDragging] = useState(false);

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const drag = useRef<{ id: number; x: number; y: number; moved: boolean } | null>(null);

  const theme = useSiteTheme();
  const mid = theme === "dark" ? MID_DARK : MID_LIGHT;
  const t1 = theme === "dark" ? T1_DARK : T1_LIGHT;

  const vmax = useMemo(
    () => Object.values(counties).reduce((m, c) => Math.max(m, c.projectedTurnout), 1),
    [counties]
  );

  // Client pixels → viewBox units, honouring the letterboxing that
  // preserveAspectRatio="xMidYMid meet" introduces.
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const r = svg.getBoundingClientRect();
    if (!r.width || !r.height) return null;
    const s = Math.min(r.width / VB_W, r.height / VB_H);
    return {
      x: VB_X + (clientX - r.left - (r.width - VB_W * s) / 2) / s,
      y: VB_Y + (clientY - r.top - (r.height - VB_H * s) / 2) / s,
    };
  }, []);

  const zoomAt = useCallback(
    (factor: number, clientX?: number, clientY?: number) => {
      setT((prev) => {
        const k = clamp(prev.k * factor, MIN_K, MAX_K);
        const anchor =
          clientX != null && clientY != null
            ? toViewBox(clientX, clientY)
            : { x: VB_X + VB_W / 2, y: VB_Y + VB_H / 2 };
        if (!anchor) return prev;
        const px = (anchor.x - prev.x) / prev.k;
        const py = (anchor.y - prev.y) / prev.k;
        return clampT({ k, x: anchor.x - px * k, y: anchor.y - py * k });
      });
    },
    [toViewBox]
  );

  // React attaches wheel passively, so the zoom listener is registered by hand.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      // Trackpad pinch arrives as a ctrlKey wheel; a mouse wheel does not.
      const step = e.ctrlKey ? 0.012 : 0.0022;
      zoomAt(Math.exp(-e.deltaY * step), e.clientX, e.clientY);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    // Capturing the pointer here would retarget pointerup and swallow the
    // control's click, so the zoom buttons opt out of panning entirely.
    if ((e.target as Element).closest(".mi-zoom")) return;
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const svg = svgRef.current;
    if (!svg) return;
    const r = svg.getBoundingClientRect();
    const s = Math.min(r.width / VB_W, r.height / VB_H) || 1;
    const dx = (e.clientX - d.x) / s;
    const dy = (e.clientY - d.y) / s;
    if (Math.abs(dx) + Math.abs(dy) > 1) d.moved = true;
    d.x = e.clientX;
    d.y = e.clientY;
    setT((prev) => clampT({ ...prev, x: prev.x + dx, y: prev.y + dy }));
    if (d.moved) setHover(null);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag.current?.id === e.pointerId) {
      drag.current = null;
      setDragging(false);
    }
  };

  const live = hover && liveCounties ? liveCounties[hover.c.name.toUpperCase()] : undefined;

  return (
    <div
      ref={wrapRef}
      className={`mi-map-wrap${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        ref={svgRef}
        viewBox={MI_MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className="mi-map"
        role="img"
        aria-label="Michigan counties"
      >
        <defs>
          <pattern id="mi-hatch" width="6" height="6" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <line className="mi-hatch-line" x1="0" y1="0" x2="0" y2="6" strokeWidth="1.4" />
          </pattern>
        </defs>
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {Object.entries(MI_COUNTY_PATHS).map(([key, d]) => {
            const c = counties[key];
            if (!c) return null;

            let fill: string;
            if (view === "results") {
              const lc = liveCounties?.[key];
              const total = (lc?.elSayedVotes ?? 0) + (lc?.stevensVotes ?? 0);
              fill =
                total > 0 ? cMargin((lc!.elSayedVotes / total) * 100, mid) : "var(--map-blank)";
            } else {
              fill =
                mode === "turnout"
                  ? cVotes(c.projectedTurnout, vmax, t1)
                  : cMargin(c.twoWayElSayed, mid);
            }

            return (
              <g key={key}>
                <path
                  className="mi-cty"
                  d={d}
                  fill={fill}
                  vectorEffect="non-scaling-stroke"
                  onPointerMove={(e) => {
                    if (drag.current) return;
                    const r = wrapRef.current?.getBoundingClientRect();
                    if (!r) return;
                    setHover({
                      c,
                      x: e.clientX - r.left,
                      y: e.clientY - r.top,
                      w: r.width,
                      h: r.height,
                    });
                  }}
                  onPointerLeave={() => setHover(null)}
                />
                {view === "forecast" && mode === "margin" && c.tooCloseToCall && (
                  <path className="mi-cty-hatch" d={d} fill="url(#mi-hatch)" />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="mi-zoom" role="group" aria-label="Zoom map">
        <button type="button" aria-label="Zoom in" disabled={t.k >= MAX_K}
                onClick={() => zoomAt(1.5)}>+</button>
        <button type="button" aria-label="Zoom out" disabled={t.k <= MIN_K}
                onClick={() => zoomAt(1 / 1.5)}>−</button>
        <button type="button" className="reset" aria-label="Reset zoom" disabled={t.k === 1}
                onClick={() => setT(IDENTITY)}>RESET</button>
      </div>

      {hover && (
        <div
          className="mi-tip"
          style={{
            left: hover.x,
            top: hover.y,
            // Percentage translate flips the tip across the cursor without measuring it.
            transform: `translate(${
              hover.x + TIP_GAP + TIP_W > hover.w ? `calc(-100% - ${TIP_GAP}px)` : `${TIP_GAP}px`
            }, ${
              hover.y + TIP_GAP + TIP_H > hover.h ? `calc(-100% - ${TIP_GAP}px)` : `${TIP_GAP}px`
            })`,
          }}
        >
          <strong>{titleCase(hover.c.name)}</strong>
          {view === "results" ? (
            live && live.elSayedVotes + live.stevensVotes > 0 ? (
              <>
                <div className="mi-tip-row">
                  <span style={{ color: "var(--dem)" }}>El-Sayed</span>
                  <b>{fmtInt(live.elSayedVotes)}</b>
                </div>
                <div className="mi-tip-row">
                  <span style={{ color: "var(--c2)" }}>Stevens</span>
                  <b>{fmtInt(live.stevensVotes)}</b>
                </div>
                {(() => {
                  const t = live.elSayedVotes + live.stevensVotes;
                  const m = ((live.elSayedVotes - live.stevensVotes) / t) * 100;
                  return (
                    <div className="mi-tip-sub">
                      {m >= 0 ? "+" : "−"}
                      {Math.abs(m).toFixed(1)} margin · {live.reporting.toFixed(0)}% reporting
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="mi-tip-sub">No votes reported</div>
            )
          ) : (
            <>
              <div className="mi-tip-row">
                <span style={{ color: "var(--dem)" }}>El-Sayed</span>
                <b>{hover.c.elSayed.toFixed(1)}%</b>
              </div>
              <div className="mi-tip-row">
                <span style={{ color: "var(--c2)" }}>Stevens</span>
                <b>{hover.c.stevens.toFixed(1)}%</b>
              </div>
              <div className="mi-tip-sub">
                {hover.c.twoWayElSayed.toFixed(1)}% two-way [{hover.c.ci90[0].toFixed(0)}–
                {hover.c.ci90[1].toFixed(0)}]
              </div>
              <div className="mi-tip-sub">
                {fmtInt(hover.c.projectedTurnout)} projected votes ·{" "}
                {hover.c.reporting > 0
                  ? `${hover.c.reporting.toFixed(0)}% reporting`
                  : "no returns yet"}
              </div>
              {hover.c.tooCloseToCall && <div className="mi-tip-flag">Too close to call</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
