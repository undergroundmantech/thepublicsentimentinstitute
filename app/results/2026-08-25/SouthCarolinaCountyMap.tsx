"use client";

// South Carolina county map — RESULTS ONLY.
//
// There is no TPSI poll of this runoff and therefore no county model, so this
// map has no forecast layer. It paints counties from live returns and nothing
// else: grey until a county reports, then a Graham/Norman divergent ramp on the
// reported margin. Anything more would be inventing 46 county estimates out of
// a single statewide judgement call.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { SC_COUNTY_PATHS, SC_VIEWBOX, SC_TRANSLATE } from "../_data/scCountyGeo";
import { SC_CANDIDATE_ORDER, SC_CANDIDATE_LAST, type ScCandidateKey } from "../_data/scSenateForecast";

type RGB = [number, number, number];

const CAND_RGB: Record<ScCandidateKey, [RGB, RGB]> = {
  graham: [[209, 137, 130], [110, 36, 29]], // #B23A2E
  norman: [[120, 168, 182], [19, 68, 83]],  // #1E6E86
};

export const SC_CAND_CSS: Record<ScCandidateKey, string> = {
  graham: "var(--k1)",
  norman: "var(--k2)",
};

const MID_DARK: RGB = [58, 58, 66];
const MID_LIGHT: RGB = [232, 232, 226];

/** Runoff margins run wider than a primary plurality, so the ramp is scaled to
 *  20 points rather than the 12 the Oklahoma map uses. */
const MARGIN_MAX = 20;

const mix = (a: RGB, b: RGB, t: number): RGB => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];
const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

function cDiverge(signedMargin: number, mid: RGB): string {
  const key: ScCandidateKey = signedMargin >= 0 ? "graham" : "norman";
  const [light, dark] = CAND_RGB[key];
  const d = clamp(Math.abs(signedMargin), 0, MARGIN_MAX) / MARGIN_MAX;
  return rgb(d < 0.5 ? mix(mid, light, d * 2) : mix(light, dark, (d - 0.5) * 2));
}

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");
const titleCase = (s: string) =>
  s.toLowerCase().replace(/(^|[\s-])([a-z])/g, (_, p, c) => p + c.toUpperCase());

const TIP_W = 230;
const TIP_H = 140;
const TIP_GAP = 12;

function useSiteTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const read = () =>
      setTheme(document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

export type ScLiveCounty = {
  votes: Record<ScCandidateKey, number>;
  total: number;
  /** 0–100 */
  reporting: number;
};

interface Props {
  /** Live county returns keyed by UPPERCASE county name. */
  counties: Record<string, ScLiveCounty>;
}

export default function SouthCarolinaCountyMap({ counties }: Props) {
  const [hover, setHover] = useState<
    { key: string; x: number; y: number; w: number; h: number } | null
  >(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const theme = useSiteTheme();
  const mid = theme === "dark" ? MID_DARK : MID_LIGHT;

  const entries = useMemo(() => Object.entries(SC_COUNTY_PATHS), []);
  const lc = hover ? counties[hover.key] : undefined;

  return (
    <div ref={wrapRef} className="sc-map-wrap" onPointerLeave={() => setHover(null)}>
      <svg
        viewBox={SC_VIEWBOX}
        preserveAspectRatio="xMidYMid meet"
        className="sc-map"
        role="img"
        aria-label="South Carolina counties"
      >
        <g transform={SC_TRANSLATE}>
          {entries.map(([key, d]) => {
            const c = counties[key];
            const fill =
              !c || c.total <= 0
                ? "var(--map-blank)"
                : cDiverge(((c.votes.graham - c.votes.norman) / c.total) * 100, mid);
            return (
              <path
                key={key}
                className="sc-cty"
                d={d}
                fill={fill}
                vectorEffect="non-scaling-stroke"
                onPointerMove={(e) => {
                  const r = wrapRef.current?.getBoundingClientRect();
                  if (!r) return;
                  setHover({ key, x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
                }}
                onPointerLeave={() => setHover(null)}
              />
            );
          })}
        </g>
      </svg>

      {hover && (
        <div
          className="sc-tip"
          style={{
            left: hover.x,
            top: hover.y,
            transform: `translate(${
              hover.x + TIP_GAP + TIP_W > hover.w ? `calc(-100% - ${TIP_GAP}px)` : `${TIP_GAP}px`
            }, ${
              hover.y + TIP_GAP + TIP_H > hover.h ? `calc(-100% - ${TIP_GAP}px)` : `${TIP_GAP}px`
            })`,
          }}
        >
          <strong>{titleCase(hover.key)}</strong>
          {lc && lc.total > 0 ? (
            <>
              {SC_CANDIDATE_ORDER.map((k) => (
                <div className="sc-tip-row" key={k}>
                  <span style={{ color: SC_CAND_CSS[k] }}>{SC_CANDIDATE_LAST[k]}</span>
                  <b>
                    {((lc.votes[k] / lc.total) * 100).toFixed(1)}% · {fmtInt(lc.votes[k])}
                  </b>
                </div>
              ))}
              <div className="sc-tip-sub">
                {fmtInt(lc.total)} counted · {lc.reporting.toFixed(0)}% reporting
              </div>
            </>
          ) : (
            <div className="sc-tip-sub">No votes reported</div>
          )}
        </div>
      )}
    </div>
  );
}
