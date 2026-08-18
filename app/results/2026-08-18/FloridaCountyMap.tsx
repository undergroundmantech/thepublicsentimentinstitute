"use client";

// Florida county choropleth. Geometry is baked SVG lifted from the TPSI Florida
// scenario engine, so it renders with no fetch and no projection math.
//
// This is a four-way race, so the Michigan two-colour divergent ramp does not
// apply: fill is the LEADER's colour and intensity is their margin over the
// runner-up. Counties whose interval crosses zero are hatched, which is most of
// them — the county baselines are demographic estimates, not local polling, and
// we never name a county winner off them.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FL_COUNTY_PATHS, FL_MAP_VIEWBOX } from "../_data/flCountyGeo";
import {
  CANDIDATE_ORDER,
  CANDIDATE_LAST,
  type CandidateKey,
} from "../_data/flCountyForecast";
import type { CountyProjection, LiveCounty } from "./countyForecast";

export type MapView = "forecast" | "results";
export type ForecastMode = "margin" | "turnout";

type RGB = [number, number, number];

/** Light/dark pair per candidate. Light is used near a tie, dark at a blowout.
 *  Both ends are derived from the --k1..--k5 hexes so the fills, the legend and
 *  the scenario engine stay the same colour. */
const CAND_RGB: Record<CandidateKey, [RGB, RGB]> = {
  donalds: [[209, 137, 130], [110, 36, 29]],   // #B23A2E
  fishback: [[120, 168, 182], [19, 68, 83]],   // #1E6E86
  collins: [[167, 147, 192], [68, 47, 93]],    // #6D4B96
  renner: [[203, 172, 115], [104, 73, 14]],    // #A87516
  other: [[185, 190, 196], [86, 91, 97]],      // #8A929C
};

export const CAND_CSS: Record<CandidateKey, string> = {
  donalds: "var(--k1)",
  fishback: "var(--k2)",
  collins: "var(--k3)",
  renner: "var(--k4)",
  other: "var(--k5)",
};

const MID_DARK: RGB = [58, 58, 66];
const MID_LIGHT: RGB = [232, 232, 226];
const T1_DARK: RGB = [30, 30, 36];
const T1_LIGHT: RGB = [237, 237, 231];
const T2: RGB = [15, 95, 85];

/** Margin at which a county's fill reaches full saturation. */
const MARGIN_MAX = 12;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

/** Leader's hue, deepening with their margin over the runner-up. */
function cLeader(leader: CandidateKey, margin: number, mid: RGB): string {
  const [light, dark] = CAND_RGB[leader] ?? CAND_RGB.other;
  const d = clamp(margin, 0, MARGIN_MAX) / MARGIN_MAX;
  return rgb(d < 0.5 ? mix(mid, light, d * 2) : mix(light, dark, (d - 0.5) * 2));
}

/** Sequential turnout ramp, power-scaled so small counties stay legible. */
const cVotes = (v: number, vmax: number, t1: RGB) =>
  rgb(mix(t1, T2, Math.pow(v / vmax, 0.42)));

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

const [VB_X, VB_Y, VB_W, VB_H] = FL_MAP_VIEWBOX.split(/\s+/).map(Number);
const MIN_K = 1;
const MAX_K = 12;

const TIP_W = 250;
const TIP_H = 190;
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
  liveCounties?: Record<string, LiveCounty>;
}

export default function FloridaCountyMap({ view, mode, counties, liveCounties }: Props) {
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
    if ((e.target as Element).closest(".fl-zoom")) return;
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
      className={`fl-map-wrap${dragging ? " dragging" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerLeave={() => setHover(null)}
    >
      <svg
        ref={svgRef}
        viewBox={FL_MAP_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className="fl-map"
        role="img"
        aria-label="Florida counties"
      >
        <defs>
          <pattern id="fl-hatch" width="6" height="6" patternUnits="userSpaceOnUse"
                   patternTransform="rotate(45)">
            <line className="fl-hatch-line" x1="0" y1="0" x2="0" y2="6" strokeWidth="1.4" />
          </pattern>
        </defs>
        <g transform={`translate(${t.x} ${t.y}) scale(${t.k})`}>
          {Object.entries(FL_COUNTY_PATHS).map(([key, d]) => {
            const c = counties[key];
            if (!c) return null;

            let fill: string;
            if (view === "results") {
              const lc = liveCounties?.[key];
              if (!lc || lc.total <= 0) {
                fill = "var(--map-blank)";
              } else {
                const ordered = CANDIDATE_ORDER.map(
                  (k) => [k, lc.votes[k] / lc.total] as [CandidateKey, number]
                ).sort((a, b) => b[1] - a[1]);
                fill = cLeader(ordered[0][0], (ordered[0][1] - ordered[1][1]) * 100, mid);
              }
            } else {
              fill =
                mode === "turnout"
                  ? cVotes(c.projectedTurnout, vmax, t1)
                  : cLeader(c.leader, c.margin, mid);
            }

            return (
              <g key={key}>
                <path
                  className="fl-cty"
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
                  <path className="fl-cty-hatch" d={d} fill="url(#fl-hatch)" />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="fl-zoom" role="group" aria-label="Zoom map">
        <button type="button" aria-label="Zoom in" disabled={t.k >= MAX_K}
                onClick={() => zoomAt(1.5)}>+</button>
        <button type="button" aria-label="Zoom out" disabled={t.k <= MIN_K}
                onClick={() => zoomAt(1 / 1.5)}>−</button>
        <button type="button" className="reset" aria-label="Reset zoom" disabled={t.k === 1}
                onClick={() => setT(IDENTITY)}>RESET</button>
      </div>

      {hover && (
        <div
          className="fl-tip"
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
            live && live.total > 0 ? (
              <>
                {CANDIDATE_ORDER.map((k) => (
                  <div className="fl-tip-row" key={k}>
                    <span style={{ color: CAND_CSS[k] }}>{CANDIDATE_LAST[k]}</span>
                    <b>
                      {((live.votes[k] / live.total) * 100).toFixed(1)}% ·{" "}
                      {fmtInt(live.votes[k])}
                    </b>
                  </div>
                ))}
                <div className="fl-tip-sub">
                  {fmtInt(live.total)} counted · {live.reporting.toFixed(0)}% reporting
                </div>
              </>
            ) : (
              <div className="fl-tip-sub">No votes reported</div>
            )
          ) : (
            <>
              {CANDIDATE_ORDER.map((k) => (
                <div className="fl-tip-row" key={k}>
                  <span style={{ color: CAND_CSS[k] }}>{CANDIDATE_LAST[k]}</span>
                  <b>{hover.c.shares[k].toFixed(1)}%</b>
                </div>
              ))}
              <div className="fl-tip-sub">
                {CANDIDATE_LAST[hover.c.leader]} +{hover.c.margin.toFixed(1)} [
                {hover.c.ci90[0].toFixed(0)} to {hover.c.ci90[1].toFixed(0)}]
              </div>
              <div className="fl-tip-sub">
                {fmtInt(hover.c.projectedTurnout)} projected ballots ·{" "}
                {hover.c.reporting > 0
                  ? `${hover.c.reporting.toFixed(0)}% reporting`
                  : "no returns yet"}
              </div>
              {hover.c.tooCloseToCall && <div className="fl-tip-flag">Too close to call</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
}
