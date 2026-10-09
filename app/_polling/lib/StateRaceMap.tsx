"use client";

/**
 * StateRaceMap: the clickable 2026 map on the polling averages pages.
 *
 * Each state with at least one public poll of the office is filled on the OnPoint
 * rating ramp (pale for close, deep for solid, lavender when an independent leads),
 * using the current OnPoint average margin. States with no public poll stay flat and
 * are not clickable: the map shows where polling exists, not where a race exists.
 *
 * The nine states too small to hit with a cursor (VT through DC) are repeated as chips
 * down the right hand side. Both the shape and the chip select the race.
 *
 * Geometry is projected once at build time into usStatePaths.ts and pulled in with a
 * dynamic import, so the map costs nothing on pages that never show it.
 */

import React, { useEffect, useMemo, useState } from "react";
import { RATE, RATING_LABEL, darkLabel, rating, type Rating } from "@/app/lib/opp";

export type MapRow = {
  abbr: string;
  id: string;          // aggregate id, handed back on click
  title: string;       // race title
  leader: string;      // leading candidate's short name
  color: string;       // that candidate's series colour
  margin: number;      // absolute points
  marginText: string;  // "Ossoff+3.2"
  polls: number;
  /** Party of the leader: D, R or I. Derived from `color` when absent. */
  party?: string;
};

// Too small to click at this projection scale, repeated as chips on the right.
const CHIP_ORDER = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
const NO_LABEL = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "HI"]);

const CHIP_X = 646;
const CHIP_TOP = 62;
const CHIP_SIZE = 26;
const CHIP_GAP = 6;

type Geo = { MAP_W: number; MAP_H: number; US_STATE_PATHS: Record<string, { d: string; c: [number, number] }> };

function partyOf(r: MapRow): "D" | "R" | "I" | "" {
  const p = (r.party || "").toUpperCase();
  if (p.startsWith("D")) return "D";
  if (p.startsWith("R")) return "R";
  if (p.startsWith("I")) return "I";
  const c = r.color.toLowerCase();
  if (c.includes("dem")) return "D";
  if (c.includes("gop") || c.includes("rep")) return "R";
  if (c.includes("ind") || c === "#7a4bb0" || c.includes("purple")) return "I";
  return "";
}

/** Rating band for a map row, on the same bands as the forecast. */
export function rowRating(r: MapRow): Rating {
  const p = partyOf(r);
  if (p === "I") return "ind";
  if (p === "D") return rating(-r.margin);
  if (p === "R") return rating(r.margin);
  return "none";
}

const LEGEND: Rating[] = ["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR", "ind"];

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
  const [tip, setTip] = useState<{ abbr: string; x: number; y: number } | null>(null);

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

  // hide the tooltip on scroll, it is positioned against the viewport
  useEffect(() => {
    if (!tip) return;
    const off = () => setTip(null);
    window.addEventListener("scroll", off, { passive: true });
    return () => window.removeEventListener("scroll", off);
  }, [tip]);

  const shapes = useMemo(() => (geo ? Object.entries(geo.US_STATE_PATHS).map(([abbr, v]) => ({ abbr, d: v.d, c: v.c })) : null), [geo]);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const chips = CHIP_ORDER.filter((a) => byAbbr[a]);
  const tipRow = tip ? byAbbr[tip.abbr] : null;

  const move = (abbr: string) => (e: React.MouseEvent) => setTip({ abbr, x: e.clientX, y: e.clientY });
  const focusTip = (abbr: string) => (e: React.FocusEvent<SVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setTip({ abbr, x: b.left + b.width / 2, y: b.top + b.height / 2 });
  };
  const keyPick = (id: string) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } };

  let tipStyle: React.CSSProperties | undefined;
  if (tip && typeof window !== "undefined") {
    const flipX = tip.x > window.innerWidth - 230, flipY = tip.y > window.innerHeight - 140;
    tipStyle = { left: flipX ? tip.x - 14 : tip.x + 14, top: flipY ? tip.y - 14 : tip.y + 14, transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"})` };
  }

  return (
    <div className="srm">
      <style>{CSS}</style>
      <div className="srm-stage">
        <svg viewBox={`0 0 ${geo?.MAP_W ?? 760} ${geo?.MAP_H ?? 440}`} className="srm-svg" role="img" aria-label={`${office} polling averages by state`}>
          {shapes?.map((s, i) => {
            const r = byAbbr[s.abbr];
            const rt = r ? rowRating(r) : "none";
            const isActive = !!r && r.id === activeId;
            return (
              <path
                key={s.abbr}
                d={s.d}
                fill={RATE[rt]}
                className={`srm-state${r ? " is-live" : ""}${isActive ? " is-on" : ""}`}
                style={{ animationDelay: `${i * 12}ms` }}
                tabIndex={r ? 0 : -1}
                role={r ? "button" : undefined}
                aria-label={r ? `${r.title}, ${r.marginText}` : undefined}
                onMouseMove={r ? move(s.abbr) : undefined}
                onMouseLeave={() => setTip(null)}
                onFocus={r ? focusTip(s.abbr) : undefined}
                onBlur={() => setTip(null)}
                onClick={() => r && onPick(r.id)}
                onKeyDown={r ? keyPick(r.id) : undefined}
              />
            );
          })}
          {shapes?.filter((s) => !NO_LABEL.has(s.abbr)).map((s) => {
            const r = byAbbr[s.abbr];
            const rt = r ? rowRating(r) : "none";
            return <text key={`t-${s.abbr}`} x={s.c[0]} y={s.c[1] + 3} className="srm-lab" style={darkLabel(rt) ? { fill: "#1a1030" } : r ? undefined : { fill: "rgba(255,255,255,.35)" }}>{s.abbr}</text>;
          })}

          {chips.map((abbr, i) => {
            const r = byAbbr[abbr]!;
            const rt = rowRating(r);
            const isActive = r.id === activeId;
            const y = CHIP_TOP + i * (CHIP_SIZE + CHIP_GAP);
            return (
              <g key={`chip-${abbr}`} className={`srm-chip${isActive ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`${r.title}, ${r.marginText}`}
                onMouseMove={move(abbr)} onMouseLeave={() => setTip(null)} onFocus={focusTip(abbr)} onBlur={() => setTip(null)}
                onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
                <rect x={CHIP_X} y={y} width={CHIP_SIZE} height={CHIP_SIZE} rx={6} fill={RATE[rt]} />
                <text x={CHIP_X + CHIP_SIZE / 2} y={y + CHIP_SIZE / 2 + 3} className="srm-chip-txt" style={darkLabel(rt) ? { fill: "#1a1030" } : undefined}>{abbr}</text>
                <text x={CHIP_X + CHIP_SIZE + 8} y={y + CHIP_SIZE / 2 + 3} className="srm-chip-val">{r.marginText}</text>
              </g>
            );
          })}

          {!shapes && !failed && <text x={380} y={220} className="srm-load" textAnchor="middle">Loading map</text>}
          {failed && <text x={380} y={220} className="srm-load" textAnchor="middle">Map geometry unavailable. Use the race picker above.</text>}
        </svg>
      </div>

      <div className="srm-legend">
        {LEGEND.map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)}
        <span><i style={{ background: RATE.none, border: "1px solid var(--line2)" }} />No public poll</span>
      </div>

      {active && (
        <div className="srm-readout" aria-live="polite">
          <span className="srm-ro-abbr">{active.abbr}</span>
          <span className="srm-ro-title">{active.title.replace(/\s+[—–]\s+/g, ": ")}</span>
          <span className="srm-ro-val" style={{ color: active.color }}>{active.marginText}</span>
          <span className="srm-ro-n">{active.polls} poll{active.polls === 1 ? "" : "s"}</span>
        </div>
      )}

      <p className="srm-foot">
        {rows.length} of the 2026 {office === "Governor" ? "governor" : "Senate"} races carry at least one public poll. Shading is the
        current OnPoint average margin on the forecast rating bands: pale when close, deep past 12 points. A state with no public
        poll is left flat rather than filled in from a model.
      </p>

      {tipRow && tipStyle && (
        <div className="srm-tip" style={tipStyle} role="tooltip">
          <b>{tipRow.title.replace(/\s+[—–]\s+/g, ": ")}</b>
          <div className="row"><span>Leader</span><span style={{ color: tipRow.color }}>{tipRow.leader}</span></div>
          <div className="row"><span>OnPoint average</span><span>{tipRow.marginText}</span></div>
          <div className="row"><span>Rating band</span><span>{RATING_LABEL[rowRating(tipRow)]}</span></div>
          <div className="row"><span>Polls</span><span>{tipRow.polls}</span></div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.srm { position: relative; }
.srm-stage { position: relative; }
.srm-svg { display: block; width: 100%; height: auto; }
.srm-state { stroke: var(--bg); stroke-width: .8; transition: fill .5s, filter .2s; outline: none; opacity: 0; animation: srm-in .6s ease forwards; }
.srm-state.is-live { cursor: pointer; }
.srm-state.is-live:hover, .srm-state.is-live:focus-visible { filter: brightness(1.25); stroke: var(--hi); stroke-width: 1.2; }
.srm-state.is-on { stroke: var(--hi); stroke-width: 2; }
.srm-lab { font: 600 8.5px var(--font-m); fill: rgba(255,255,255,.85); pointer-events: none; text-anchor: middle; }
.srm-chip { cursor: pointer; outline: none; }
.srm-chip rect { stroke: var(--line2); stroke-width: .8; transition: filter .2s; }
.srm-chip:hover rect, .srm-chip:focus-visible rect { filter: brightness(1.25); stroke: #fff; }
.srm-chip.is-on rect { stroke: #fff; stroke-width: 2; }
.srm-chip-txt { font: 700 9.5px var(--font-m); text-anchor: middle; fill: rgba(255,255,255,.9); pointer-events: none; }
.srm-chip-val { font: 600 10px var(--font-m); fill: var(--mute); pointer-events: none; }
.srm-load { font: 600 11px var(--font-m); letter-spacing: .1em; text-transform: uppercase; fill: var(--mute); }
.srm-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 12px; color: var(--mute); margin-top: 12px; }
.srm-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; }
.srm-readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.srm-ro-abbr { font: 700 13px var(--font-m); color: var(--ink2); }
.srm-ro-title { font-size: 13px; color: var(--ink); min-width: 0; }
.srm-ro-val { font: 700 13px var(--font-m); font-variant-numeric: tabular-nums; }
.srm-ro-n { font: 600 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); margin-left: auto; }
.srm-foot { margin: 10px 0 0; font-size: 12px; line-height: 1.55; color: var(--mute); }
.srm-tip { position: fixed; z-index: 80; pointer-events: none; background: rgba(var(--bg2-rgb),.94); border: 1px solid var(--line2); border-radius: 10px; padding: 10px 12px; font-size: 12.5px; color: var(--ink2); box-shadow: 0 12px 40px rgba(0,0,0,.5); min-width: 200px; max-width: 280px; backdrop-filter: blur(10px); }
.srm-tip b { color: var(--hi); display: block; font: 700 13px var(--font-d); margin-bottom: 4px; }
.srm-tip .row { display: flex; justify-content: space-between; gap: 12px; }
.srm-tip .row span:last-child { font-family: var(--font-m); font-weight: 600; font-variant-numeric: tabular-nums; }
@keyframes srm-in { to { opacity: 1; } }
@media (prefers-reduced-motion: reduce) { .srm-state { animation: none; opacity: 1; transition: none; } }
`;
