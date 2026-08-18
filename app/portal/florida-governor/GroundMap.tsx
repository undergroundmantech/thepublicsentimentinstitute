"use client";

/**
 * Where the tracked candidate has to find votes.
 *
 * Two views, both diverging around zero and neither of them a winner map:
 *   opportunity — net votes still available to him from each county's
 *                 outstanding ballots, at baseline shares. This is the "make up
 *                 ground here" view: depth is votes, not share, so a two-point
 *                 edge in Hillsborough outweighs a twenty-point edge in Liberty.
 *   performance — how his counted share compares with the pre-election
 *                 baseline. Counties with nothing counted stay blank rather
 *                 than being painted at zero.
 */

import React, { useCallback, useMemo, useState } from "react";
import { FL_COUNTY_PATHS, FL_MAP_VIEWBOX } from "../../results/_data/flCountyGeo";
import { CANDIDATE_LAST, type CandidateKey } from "../../results/_data/flCountyForecast";
import type { CountyGrade } from "./expectation";

export type GroundMode = "opportunity" | "performance";

const TARGET_RGB: [number, number, number] = [30, 110, 134]; // --k2
const RIVAL_RGB: [number, number, number] = [178, 58, 46]; // --k1

const int = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");
const signed = (n: number, d = 1) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(d)}`;

/** Perceptual midpoint of the ramp; deliberately low so small edges still read. */
const EASE = 0.55;

export default function GroundMap({
  grades,
  mode,
  rival,
  target,
}: {
  grades: CountyGrade[];
  mode: GroundMode;
  rival: CandidateKey;
  target: CandidateKey;
}) {
  const [hover, setHover] = useState<string | null>(null);

  const byName = useMemo(
    () => new Map(grades.map((g) => [g.name.toUpperCase(), g])),
    [grades],
  );

  const value = useCallback(
    (g: CountyGrade) => (mode === "opportunity" ? g.netAvailable : g.delta),
    [mode],
  );

  // Scale to the largest magnitude actually on the map, so the ramp uses its
  // full range on a quiet night as well as a blowout.
  const peak = useMemo(() => {
    let max = 0;
    for (const g of grades) {
      const v = value(g);
      if (v !== null) max = Math.max(max, Math.abs(v));
    }
    return max || 1;
  }, [grades, value]);

  const fill = (g: CountyGrade | undefined) => {
    if (!g) return "var(--map-blank)";
    const v = value(g);
    if (v === null) return "var(--map-blank)";
    const t = Math.pow(Math.min(Math.abs(v) / peak, 1), EASE);
    const [r, gr, b] = v >= 0 ? TARGET_RGB : RIVAL_RGB;
    return `color-mix(in srgb, rgb(${r},${gr},${b}) ${(t * 100).toFixed(1)}%, var(--ramp-lo))`;
  };

  const active = hover ? byName.get(hover) : null;
  const targetName = CANDIDATE_LAST[target];
  const rivalName = CANDIDATE_LAST[rival];

  return (
    <div className="gm">
      <svg viewBox={FL_MAP_VIEWBOX} role="img"
           aria-label={`Florida counties shaded by ${mode === "opportunity"
             ? `net votes still available to ${targetName}`
             : `${targetName} performance against baseline`}`}>
        {Object.entries(FL_COUNTY_PATHS).map(([name, d]) => {
          const g = byName.get(name);
          return (
            <path
              key={name}
              d={d}
              fill={fill(g)}
              className={hover === name ? "on" : undefined}
              onMouseEnter={() => setHover(name)}
              onMouseLeave={() => setHover((h) => (h === name ? null : h))}
            >
              <title>{g ? g.name : name}</title>
            </path>
          );
        })}
      </svg>

      <div className="gm-readout" aria-live="polite">
        {active ? (
          <>
            <div className="gm-readout-head">
              <strong>{active.name}</strong>
              <small>{active.region}</small>
            </div>
            <div className="gm-readout-grid">
              <div>
                <span>Outstanding</span>
                <b>{int(active.outstanding)}</b>
              </div>
              <div>
                <span>Net available</span>
                <b>{signed(active.netAvailable, 0)}</b>
              </div>
              <div>
                <span>Expected share</span>
                <b>{active.expected.toFixed(1)}%</b>
              </div>
              <div>
                <span>vs expectation</span>
                <b>{active.delta === null ? "—" : signed(active.delta)}</b>
              </div>
            </div>
          </>
        ) : (
          <p className="gm-hint">
            Hover a county.{" "}
            {mode === "opportunity"
              ? `Depth is net votes ${targetName} still stands to take out of the ballots not yet counted.`
              : `Depth is how far ${targetName} is running from his county baseline. Blank counties have not counted anything.`}
          </p>
        )}
      </div>

      <div className="gm-legend">
        <span className="gm-ramp" aria-hidden />
        <span className="gm-legend-lo">{rivalName} nets it</span>
        <span className="gm-legend-hi">{targetName} nets it</span>
      </div>
    </div>
  );
}
