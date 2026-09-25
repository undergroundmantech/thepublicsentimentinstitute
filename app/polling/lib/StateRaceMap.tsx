"use client";

/**
 * StateRaceMap — the clickable 2026 map on the Polling Averages page.
 *
 * One fill per state, taken from the leading candidate's own series colour so a
 * strong independent (Osborn, Bengs, Achilles, Bodnar) reads as itself rather
 * than as a weak major party. Opacity carries the margin. States with no public
 * poll of that office are drawn flat and are not clickable, which is the honest
 * reading: the map shows where polling exists, not where a race exists.
 *
 * The nine states too small to hit with a cursor (VT through DC) are repeated as
 * chips down the right-hand side. Both the shape and the chip select the race.
 *
 * Geometry is projected once at build time into usStatePaths.ts (see
 * scripts/polling/gen-state-paths.mjs) and pulled in with a dynamic import, so the
 * map costs nothing on the pages that never show it, needs no CDN at view time,
 * and cannot half-render because a third-party host was slow.
 */

import React, { useEffect, useMemo, useState } from "react";

export type MapRow = {
  abbr: string;
  id: string;          // aggregate id, handed back on click
  title: string;       // "Georgia · U.S. Senate — Ossoff vs. Collins"
  leader: string;      // leading candidate's short name
  color: string;       // that candidate's series colour
  margin: number;      // absolute points
  marginText: string;  // "Ossoff+3.2"
  polls: number;
};

// Too small to click at this projection scale — repeated as chips on the right.
const CHIP_ORDER = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];

const CHIP_X = 646;
const CHIP_TOP = 62;
const CHIP_SIZE = 26;
const CHIP_GAP = 6;

/** 0.26 at a dead heat, 0.92 at a 20-point lead. The tint is painted over a
 *  neutral base layer, so even the shallowest fill separates from the page in
 *  both themes rather than sinking into a dark background. */
function fillAlpha(margin: number) {
  const m = Math.min(Math.abs(margin), 20) / 20;
  return 0.26 + m * 0.66;
}

type Shape = { abbr: string; d: string };
type Geo = { MAP_W: number; MAP_H: number; US_STATE_PATHS: Record<string, { d: string; c: [number, number] }> };

export default function StateRaceMap({
  rows,
  activeId,
  onPick,
  office,
}: {
  rows: MapRow[];
  activeId: string;
  onPick: (id: string) => void;
  office: string;
}) {
  const [geo, setGeo] = useState<Geo | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  const byAbbr = useMemo(() => {
    const m: Record<string, MapRow> = {};
    for (const r of rows) m[r.abbr] = r;
    return m;
  }, [rows]);

  useEffect(() => {
    let dead = false;
    import("./usStatePaths")
      .then((m) => { if (!dead) setGeo(m as unknown as Geo); })
      .catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, []);

  const shapes: Shape[] | null = useMemo(() => {
    if (!geo) return null;
    return Object.entries(geo.US_STATE_PATHS).map(([abbr, v]) => ({ abbr, d: v.d }));
  }, [geo]);

  const hovered = hover ? byAbbr[hover] : null;
  const active = rows.find((r) => r.id === activeId) ?? null;
  const shown = hovered ?? active;

  // The chip column always renders, so the small states stay reachable even
  // while the geometry is still loading.
  const chips = CHIP_ORDER.filter((a) => byAbbr[a]);

  const paint = (r: MapRow | undefined, isActive: boolean) => {
    if (!r) return { fill: "rgba(var(--line-rgb),0.09)", stroke: "rgba(var(--line-rgb),0.22)", width: 0.6 };
    return {
      fill: r.color,
      opacity: fillAlpha(r.margin),
      stroke: isActive ? "var(--ink)" : "rgba(var(--line-rgb),0.3)",
      width: isActive ? 2 : 0.7,
    };
  };

  return (
    <div className="srm">
      <div className="srm-bar">
        <span className="srm-title">{office} · click a state</span>
        <span className="srm-legend">
          <span className="srm-key"><i style={{ background: "var(--dem)" }} />D lead</span>
          <span className="srm-key"><i style={{ background: "#7a4bb0" }} />Independent lead</span>
          <span className="srm-key"><i style={{ background: "var(--gop)" }} />R lead</span>
          <span className="srm-key"><i className="srm-none" />no public poll</span>
        </span>
      </div>

      <div className="srm-stage">
        <svg viewBox={`0 0 ${geo?.MAP_W ?? 760} ${geo?.MAP_H ?? 440}`} className="srm-svg" role="img"
             aria-label={`${office} polling averages by state`}>
          {/* neutral base: every shape gets a mid surface so the tints above it
              composite the same way in light and dark */}
          <g className="srm-base" aria-hidden>
            {shapes?.map((s) => (
              <path key={`b-${s.abbr}`} d={s.d} fill="rgba(var(--line-rgb),0.13)" stroke="none" />
            ))}
          </g>
          {shapes?.map((s) => {
            const r = byAbbr[s.abbr];
            const isActive = !!r && r.id === activeId;
            const p = paint(r, isActive);
            return (
              <path
                key={s.abbr}
                d={s.d}
                fill={p.fill}
                fillOpacity={p.opacity}
                stroke={p.stroke}
                strokeWidth={p.width}
                className={r ? "srm-state is-live" : "srm-state"}
                tabIndex={r ? 0 : -1}
                role={r ? "button" : undefined}
                aria-label={r ? `${r.title}, ${r.marginText}` : undefined}
                onMouseEnter={() => r && setHover(s.abbr)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => r && setHover(s.abbr)}
                onBlur={() => setHover(null)}
                onClick={() => r && onPick(r.id)}
                onKeyDown={(e) => { if (r && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onPick(r.id); } }}
              />
            );
          })}

          {/* small-state chips */}
          {chips.map((abbr, i) => {
            const r = byAbbr[abbr]!;
            const isActive = r.id === activeId;
            const y = CHIP_TOP + i * (CHIP_SIZE + CHIP_GAP);
            return (
              <g key={`chip-${abbr}`} className="srm-chip"
                 tabIndex={0} role="button" aria-label={`${r.title}, ${r.marginText}`}
                 onMouseEnter={() => setHover(abbr)} onMouseLeave={() => setHover(null)}
                 onFocus={() => setHover(abbr)} onBlur={() => setHover(null)}
                 onClick={() => onPick(r.id)}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.id); } }}>
                <rect x={CHIP_X} y={y} width={CHIP_SIZE} height={CHIP_SIZE} rx={5}
                      fill={r.color} fillOpacity={fillAlpha(r.margin)}
                      stroke={isActive ? "var(--ink)" : "rgba(var(--line-rgb),0.25)"}
                      strokeWidth={isActive ? 2 : 0.8} />
                <text x={CHIP_X + CHIP_SIZE / 2} y={y + CHIP_SIZE / 2 + 3.5}
                      className="srm-chip-txt">{abbr}</text>
                <text x={CHIP_X + CHIP_SIZE + 8} y={y + CHIP_SIZE / 2 + 3.5}
                      className="srm-chip-val">{r.marginText}</text>
              </g>
            );
          })}

          {!shapes && !failed && (
            <text x={300} y={220} className="srm-load">loading map…</text>
          )}
          {failed && (
            <text x={24} y={220} className="srm-load">
              Map geometry unavailable — use the tiles below.
            </text>
          )}
        </svg>

      </div>

      {shown && (
          <div className="srm-readout" aria-live="polite">
            <span className="srm-ro-abbr">{shown.abbr}</span>
            <span className="srm-ro-body">
              <span className="srm-ro-title">{shown.title}</span>
              <span className="srm-ro-val" style={{ color: shown.color }}>{shown.marginText}</span>
              <span className="srm-ro-n">{shown.polls} poll{shown.polls === 1 ? "" : "s"}</span>
            </span>
          </div>
      )}

      <p className="srm-foot">
        {rows.length} of the 2026 {office === "Governor" ? "governor's" : "Senate"} races carry at
        least one public poll. Shading is the current PSI average margin, deepening to 20 points.
        A state with no public poll is left flat rather than filled in from a model.
      </p>
    </div>
  );
}
