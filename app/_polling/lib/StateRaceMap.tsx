"use client";

/**
 * StateRaceMap: the states drawn in dry erase marker on the analyst's whiteboard.
 *
 * Rendered inside PollRoom, which draws the room, the lamp and the board. Every state with a
 * public poll of the office is coloured in marker on the On Point rating ramp from the current
 * On Point average and carries its margin written in marker. States with no public poll stay
 * bare board. Nothing is pinned: it is a dry erase board, so the closest races are sticky notes
 * with a marker arrow to their state, the small northeastern states are a handwritten list down
 * the side, and the race you pick is circled in green marker.
 */

import React, { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { RATE, RATING_LABEL, rating, type Rating } from "@/app/lib/opp";

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
  /** The leader's margin over recent weeks, oldest first, for the note sparkline. */
  trend?: number[];
  /** Text written on the state in place of the margin, for the House board ("3 polled"). */
  label?: string;
};

const CHIP_ORDER = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
const NO_LABEL = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "HI"]);
const NUDGE: Record<string, [number, number]> = { FL: [14, 6], MI: [10, 14], LA: [-8, 0], KY: [4, 2], ID: [0, 12], CA: [-8, 4], AK: [6, 4], HI: [8, 6] };

const BW = 920;
const MAP_X = 10, MAP_Y = 6;
const LIST_X = 784, LIST_Y = 30, LIST_H = 25;
const NOTE_Y = 462, NOTE_W = 176, NOTE_H = 84;

type Geo = { MAP_W: number; MAP_H: number; US_STATE_PATHS: Record<string, { d: string; c: [number, number] }> };

export function partyOf(r: Pick<MapRow, "party" | "color">): "D" | "R" | "I" | "" {
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

// dry erase marker inks
export const INK: Record<string, string> = { D: "#1f57c8", R: "#d3243c", I: "#7b3fd0", "": "#2a2d33" };
const NOTE: string[] = ["#fff3a6", "#ffd9e4", "#d7f0ff", "#dff7cf"];
const LEGEND: Rating[] = ["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR", "ind"];

function scribble(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const pts: string[] = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = -0.5 + (i / n) * Math.PI * 2.2;
    const wob = 1 + 0.05 * Math.sin(i * 1.7 + seed) + 0.04 * Math.cos(i * 0.9 + seed * 2);
    const grow = 1 + (i / n) * 0.1;
    pts.push(`${(cx + Math.cos(t) * rx * wob * grow).toFixed(1)},${(cy + Math.sin(t) * ry * wob * grow).toFixed(1)}`);
  }
  return "M" + pts.join(" L");
}

function spark(vals: number[], w: number, h: number) {
  if (vals.length < 2) return null;
  const lo = Math.min(0, ...vals), hi = Math.max(1, ...vals);
  const sx = (i: number) => (i / (vals.length - 1)) * w;
  const sy = (v: number) => h - ((v - lo) / (hi - lo || 1)) * h;
  return { d: vals.map((v, i) => `${i ? "L" : "M"}${sx(i).toFixed(1)},${sy(v).toFixed(1)}`).join(""), zero: sy(0) };
}

const shortTitle = (t: string) => t.replace(/\s+[—–]\s+/g, ": ").split(":")[0];

export default function StateRaceMap({ rows, activeId, onPick, office, notes = true, hint = "Click to open this average" }: {
  rows: MapRow[]; activeId: string; onPick: (id: string) => void; office: string; notes?: boolean; hint?: string;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ abbr: string; x: number; y: number } | null>(null);
  const [compact, setCompact] = useState(false);
  const [mounted, setMounted] = useState(false);

  const byAbbr = useMemo(() => { const m: Record<string, MapRow> = {}; for (const r of rows) m[r.abbr] = r; return m; }, [rows]);

  useEffect(() => {
    let dead = false;
    setMounted(true);
    import("./usStatePaths").then((m) => { if (!dead) setGeo(m as unknown as Geo); }).catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, []);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setCompact(mq.matches);
    on(); mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, []);
  useEffect(() => {
    if (!tip) return;
    const off = () => setTip(null);
    window.addEventListener("scroll", off, { passive: true });
    return () => window.removeEventListener("scroll", off);
  }, [tip]);

  const shapes = useMemo(() => (geo ? Object.entries(geo.US_STATE_PATHS).map(([abbr, v]) => ({ abbr, d: v.d, c: v.c })) : null), [geo]);
  const active = rows.find((r) => r.id === activeId) ?? null;
  const chips = useMemo(() => CHIP_ORDER.filter((a) => byAbbr[a]), [byAbbr]);
  const tipRow = tip ? byAbbr[tip.abbr] : null;

  const anchors = useMemo(() => {
    const a: Record<string, [number, number]> = {};
    chips.forEach((abbr, i) => { a[abbr] = [LIST_X - 8, LIST_Y + i * LIST_H + 10]; });
    if (geo) for (const [abbr, v] of Object.entries(geo.US_STATE_PATHS)) {
      if (a[abbr] || !byAbbr[abbr]) continue;
      const n = NUDGE[abbr] ?? [0, 0];
      a[abbr] = [MAP_X + v.c[0] + n[0], MAP_Y + v.c[1] + n[1] + 4];
    }
    return a;
  }, [geo, byAbbr, chips]);

  const cards = useMemo(() => {
    if (!notes) return [];
    const pool = rows.filter((r) => r.polls >= 2 && anchors[r.abbr]).sort((x, y) => x.margin - y.margin).slice(0, 4);
    pool.sort((x, y) => anchors[x.abbr][0] - anchors[y.abbr][0]);
    return pool.map((r, i) => ({ r, x: 16 + i * (NOTE_W + 14), rot: [-2.4, 1.6, -1.2, 2.2][i % 4], col: NOTE[i % 4] }));
  }, [rows, anchors, notes]);

  const boardH = compact || !notes ? 458 : 560;
  const move = (abbr: string) => (e: React.MouseEvent) => setTip({ abbr, x: e.clientX, y: e.clientY });
  const focusTip = (abbr: string) => (e: React.FocusEvent<SVGElement>) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ abbr, x: b.left + b.width / 2, y: b.top + b.height / 2 }); };
  const keyPick = (id: string) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } };
  const hover = (abbr: string) => ({ onMouseMove: move(abbr), onMouseLeave: () => setTip(null), onFocus: focusTip(abbr), onBlur: () => setTip(null) });

  let tipStyle: React.CSSProperties | undefined;
  if (tip && typeof window !== "undefined") {
    const flipX = tip.x > window.innerWidth - 260, flipY = tip.y > window.innerHeight - 170;
    tipStyle = { left: tip.x + (flipX ? -14 : 14), top: tip.y + (flipY ? -14 : 14), transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"}) rotate(-1.2deg)` };
  }
  const activeAnchor = active ? anchors[active.abbr] : undefined;
  const activeSmall = !!active && CHIP_ORDER.includes(active.abbr);
  const F = (k: string) => `url(#${uid}-${k})`;

  return (
    <div className="wbm">
      <style>{CSS}</style>
      <svg viewBox={`0 0 ${BW} ${boardH}`} className="wbm-svg" role="img" aria-label={`${office} polling by state, drawn on a whiteboard`}>
        <defs>
          <filter id={`${uid}-hand`} x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          <filter id={`${uid}-ink`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.22" numOctaves="2" seed="9" result="s" />
            <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="sa" />
            <feComposite in="SourceGraphic" in2="sa" operator="in" />
          </filter>
          <filter id={`${uid}-note`} x="-15%" y="-15%" width="130%" height="150%">
            <feDropShadow dx="1" dy="4" stdDeviation="2.6" floodColor="#1a1c22" floodOpacity=".22" />
          </filter>
          <marker id={`${uid}-arrow`} viewBox="0 0 10 10" refX="7" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M1 1 L9 5 L1 9" fill="none" stroke="#d3243c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        <g transform={`translate(${MAP_X} ${MAP_Y})`}>
          <g filter={F("ink")}>
            {shapes?.map((s, i) => {
              const r = byAbbr[s.abbr];
              if (!r) return null;
              return <path key={`f-${s.abbr}`} d={s.d} fill={RATE[rowRating(r)]} className="wbm-fill" style={{ animationDelay: `${500 + i * 12}ms` }} />;
            })}
          </g>
          <g filter={F("hand")}>
            {shapes?.map((s, i) => (
              <path key={`o-${s.abbr}`} d={s.d} pathLength={1} className={`wbm-line${byAbbr[s.abbr] ? " live" : ""}`} style={{ animationDelay: `${i * 12}ms` }} />
            ))}
          </g>
          {shapes?.map((s) => {
            const r = byAbbr[s.abbr];
            const on = !!r && r.id === activeId;
            return (
              <path key={s.abbr} d={s.d} className={`srm-state${r ? " is-live" : ""}${on ? " is-on" : ""}`}
                tabIndex={r ? 0 : -1} role={r ? "button" : undefined} aria-label={r ? `${r.title}, ${r.label ?? r.marginText}` : undefined}
                {...(r ? hover(s.abbr) : {})} onClick={() => r && onPick(r.id)} onKeyDown={r ? keyPick(r.id) : undefined} />
            );
          })}
          <g className="wbm-labs">
            {shapes?.filter((s) => !NO_LABEL.has(s.abbr)).map((s) => {
              const r = byAbbr[s.abbr];
              const n = NUDGE[s.abbr] ?? [0, 0];
              if (!r) return <text key={`t-${s.abbr}`} x={s.c[0]} y={s.c[1] + 3} className="wbm-lab bare">{s.abbr}</text>;
              const p = partyOf(r);
              return (
                <g key={`t-${s.abbr}`} onMouseMove={move(s.abbr)} onMouseLeave={() => setTip(null)} onClick={() => onPick(r.id)} style={{ cursor: "pointer" }}>
                  <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 1} className="wbm-lab">{s.abbr}</text>
                  <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 15} className="wbm-mg" style={{ fill: INK[p] }}>{r.label ?? (p ? `${p}+${r.margin.toFixed(1)}` : r.marginText)}</text>
                </g>
              );
            })}
          </g>
        </g>

        {/* the small states, written down the side */}
        {chips.length > 0 && <text x={LIST_X} y={LIST_Y - 10} className="wbm-note">Small states</text>}
        {chips.map((abbr, i) => {
          const r = byAbbr[abbr]!;
          const on = r.id === activeId;
          const y = LIST_Y + i * LIST_H;
          return (
            <g key={`chip-${abbr}`} className={`srm-chip wbm-row${on ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`${r.title}, ${r.label ?? r.marginText}`}
              style={{ animationDelay: `${900 + i * 50}ms` }} {...hover(abbr)} onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
              <rect x={LIST_X - 4} y={y - 4} width={130} height={LIST_H - 2} rx={4} className="wbm-rowhit" />
              <rect x={LIST_X} y={y + 1} width={10} height={10} rx={2} fill={RATE[rowRating(r)]} filter={F("ink")} />
              <text x={LIST_X + 16} y={y + 10} className="wbm-row-ab">{abbr}</text>
              <text x={LIST_X + 38} y={y + 12} className="wbm-row-v" style={{ fill: INK[partyOf(r)] }}>{r.label ?? r.marginText}</text>
            </g>
          );
        })}

        {!compact && (
          <g transform={`translate(${LIST_X} ${LIST_Y + Math.max(chips.length, 5) * LIST_H + 26})`} className="wbm-key">
            <text x="0" y="0" className="wbm-note">Key</text>
            {LEGEND.map((k, i) => (
              <g key={k} transform={`translate(${(i % 2) * 62} ${16 + Math.floor(i / 2) * 19})`}>
                <rect x="0" y="-9" width="13" height="11" fill={RATE[k]} rx="2" opacity=".85" filter={F("ink")} />
                <text x="18" y="1" className="wbm-key-t">{RATING_LABEL[k]}</text>
              </g>
            ))}
          </g>
        )}

        {/* marker arrows from each sticky note to its state */}
        {!compact && cards.map(({ r, x }, i) => {
          const a = anchors[r.abbr];
          const sx = x + NOTE_W / 2, sy = NOTE_Y - 2;
          const ty = a[1] + 14;
          const mx = (sx + a[0]) / 2 + (i % 2 ? 22 : -22), my = (sy + ty) / 2 + 24;
          return <path key={`s-${r.abbr}`} d={`M${sx},${sy} Q${mx},${my} ${a[0]},${ty}`} pathLength={1} markerEnd={F("arrow")}
            className={`wbm-link${r.id === activeId ? " is-on" : ""}`} style={{ animationDelay: `${1300 + i * 160}ms` }} filter={F("hand")} />;
        })}

        {/* sticky notes for the closest races */}
        {!compact && cards.map(({ r, x, rot, col }, i) => {
          const p = partyOf(r);
          const sp = r.trend ? spark(r.trend, 56, 16) : null;
          const on = r.id === activeId;
          return (
            <g key={`c-${r.abbr}`} className={`wbm-card${on ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`Close race: ${r.title}, ${r.marginText}`}
              style={{ animationDelay: `${1100 + i * 120}ms` }} onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)} {...hover(r.abbr)}>
              <g transform={`rotate(${rot} ${x + NOTE_W / 2} ${NOTE_Y + NOTE_H / 2})`}>
                <path d={`M${x},${NOTE_Y} h${NOTE_W} v${NOTE_H - 10} q-3,8 -14,10 h-${NOTE_W - 14} z`} fill={col} className="wbm-notep" filter={F("note")} />
                <rect x={x} y={NOTE_Y} width={NOTE_W} height="12" fill="rgba(0,0,0,.05)" />
                <text x={x + 10} y={NOTE_Y + 28} className="wbm-card-t">{shortTitle(r.title)}</text>
                <text x={x + 10} y={NOTE_Y + 56} className="wbm-card-m" style={{ fill: INK[p] }}>{r.marginText}</text>
                <text x={x + 10} y={NOTE_Y + 74} className="wbm-card-n">{r.polls} polls · {RATING_LABEL[rowRating(r)]}</text>
                {sp && (
                  <g transform={`translate(${x + NOTE_W - 66} ${NOTE_Y + 58})`}>
                    <line x1="0" x2="56" y1={sp.zero} y2={sp.zero} className="wbm-sp0" />
                    <path d={sp.d} className="wbm-sp" style={{ stroke: INK[p] }} />
                  </g>
                )}
              </g>
            </g>
          );
        })}
        {!compact && cards.length > 0 && <text x="18" y={NOTE_Y - 14} className="wbm-note">Closest races</text>}

        {active && activeAnchor && (
          <g key={`ring-${activeId}`} className="wbm-ring" filter={F("hand")}>
            <path d={scribble(activeAnchor[0] + (activeSmall ? 62 : 0), activeAnchor[1] + (activeSmall ? -2 : 4), activeSmall ? 74 : 34, activeSmall ? 15 : 26, active.abbr.charCodeAt(0))} pathLength={1} />
          </g>
        )}

        {!shapes && !failed && <text x={BW / 2} y={240} className="wbm-load" textAnchor="middle">Drawing the map</text>}
        {failed && <text x={BW / 2} y={240} className="wbm-load" textAnchor="middle">Map unavailable. Use the race list on the board.</text>}
      </svg>

      {compact && cards.length > 0 && (
        <div className="wbm-mcards">
          {cards.map(({ r, col }) => (
            <button type="button" key={r.abbr} className={`wbm-mcard${r.id === activeId ? " is-on" : ""}`} style={{ background: col }} onClick={() => onPick(r.id)}>
              <b>{shortTitle(r.title)}</b>
              <span style={{ color: INK[partyOf(r)] }}>{r.marginText}</span>
              <small>{r.polls} polls</small>
            </button>
          ))}
        </div>
      )}

      {mounted && tipRow && tipStyle ? createPortal(
        <div className="wbm-tip" style={tipStyle} role="tooltip">
          <b>{tipRow.title.replace(/\s+[—–]\s+/g, ": ")}</b>
          {tipRow.label ? <div className="row"><span>Polled</span><span>{tipRow.label}</span></div> : <>
            <div className="row"><span>Leader</span><span>{tipRow.leader}</span></div>
            <div className="row"><span>On Point average</span><span>{tipRow.marginText}</span></div>
            <div className="row"><span>Rating band</span><span>{RATING_LABEL[rowRating(tipRow)]}</span></div>
            <div className="row"><span>Polls</span><span>{tipRow.polls}</span></div>
          </>}
          <div className="hint">{hint}</div>
          <style>{TIP_CSS}</style>
        </div>, document.body) : null}
    </div>
  );
}

const TIP_CSS = `
.wbm-tip { position: fixed; z-index: 9999; pointer-events: none; background: #fde27a; color: #3a3015; border-radius: 2px; padding: 12px 14px 10px; font: 500 12.5px var(--font-b, system-ui); box-shadow: 0 14px 30px -10px rgba(0,0,0,.6); min-width: 210px; max-width: 280px; }
.wbm-tip b { display: block; font: 700 18px/1.1 "Kalam", "Segoe Print", "Comic Sans MS", cursive; margin-bottom: 6px; color: #2a2208; }
.wbm-tip .row { display: flex; justify-content: space-between; gap: 12px; }
.wbm-tip .row span:last-child { font-family: var(--font-m, monospace); font-weight: 700; font-variant-numeric: tabular-nums; }
.wbm-tip .hint { margin-top: 6px; font: 600 10px var(--font-m, monospace); letter-spacing: .08em; text-transform: uppercase; opacity: .65; }
`;

const CSS = `
.wbm { position: relative; }
.wbm-svg { display: block; width: 100%; height: auto; max-height: var(--wbm-max, none); margin: 0 auto; }
.wbm-fill { fill-opacity: .55; opacity: 0; animation: wb-fade .7s ease forwards; }
.wbm-line { fill: none; stroke: rgba(42,45,51,.28); stroke-width: .9; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw 1s ease-out forwards; }
.wbm-line.live { stroke: rgba(30,33,40,.78); stroke-width: 1.25; }
.wbm .srm-state { fill: transparent; stroke: none; outline: none; }
.wbm .srm-state.is-live { cursor: pointer; }
.wbm .srm-state.is-live:hover, .wbm .srm-state.is-live:focus-visible { fill: rgba(255,214,80,.22); stroke: #1b1d22; stroke-width: 1.6; }
.wbm .srm-state.is-on { fill: rgba(27,158,90,.10); }
.wbm-lab { font: 700 8.5px var(--font-m); fill: rgba(28,30,36,.85); text-anchor: middle; letter-spacing: .04em; paint-order: stroke; stroke: rgba(247,247,243,.8); stroke-width: 2.2px; }
.wbm-lab.bare { fill: rgba(28,30,36,.3); stroke: none; pointer-events: none; }
.wbm-mg { font: 700 13.5px var(--font-hand); text-anchor: middle; paint-order: stroke; stroke: rgba(247,247,243,.85); stroke-width: 3px; }
.wbm-labs { opacity: 0; animation: wb-fade .5s .9s ease forwards; }
.wbm-note { font: 400 17px var(--font-mark); fill: #2a2d33; }
.wbm-load { font: 400 22px var(--font-mark); fill: #2a2d33; }
.wbm-link { fill: none; stroke: rgba(211,36,60,.6); stroke-width: 1.8; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw .9s ease-in-out forwards; }
.wbm-link.is-on { stroke: #d3243c; stroke-width: 2.6; }
.wbm-row, .wbm-card { cursor: pointer; outline: none; opacity: 0; animation: wb-drop .5s cubic-bezier(.2,1.2,.4,1) forwards; }
.wbm-rowhit { fill: transparent; }
.wbm-row:hover .wbm-rowhit, .wbm-row:focus-visible .wbm-rowhit { fill: rgba(255,214,80,.22); }
.wbm-row.is-on .wbm-rowhit { fill: rgba(27,158,90,.12); }
.wbm-row-ab { font: 800 10px var(--font-m); fill: #3a3d44; }
.wbm-row-v { font: 700 14px var(--font-hand); }
.wbm-key-t { font: 600 9.5px var(--font-m); fill: #3a3d44; }
.wbm-card:hover .wbm-notep, .wbm-card:focus-visible .wbm-notep { filter: brightness(1.04); }
.wbm-card.is-on .wbm-notep { stroke: #1b9e5a; stroke-width: 2.2; }
.wbm-card-t { font: 700 16px var(--font-hand); fill: #23252b; }
.wbm-card-m { font: 700 22px var(--font-hand); }
.wbm-card-n { font: 600 8.5px var(--font-m); fill: #5f5a48; letter-spacing: .04em; text-transform: uppercase; }
.wbm-sp { fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.wbm-sp0 { stroke: rgba(0,0,0,.2); stroke-dasharray: 2 2; }
.wbm-ring path { fill: none; stroke: #1b9e5a; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw .6s ease-out forwards; }
.wbm-mcards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.wbm-mcard { appearance: none; text-align: left; display: grid; gap: 2px; padding: 10px 12px; border: 0; color: #23252b; cursor: pointer; box-shadow: 0 4px 10px -6px rgba(0,0,0,.5); font: inherit; }
.wbm-mcard.is-on { outline: 2px solid #1b9e5a; }
.wbm-mcard b { font: 700 16px var(--font-hand); } .wbm-mcard span { font: 700 20px var(--font-hand); } .wbm-mcard small { font: 600 10px var(--font-m); color: #5f5a48; text-transform: uppercase; }
@keyframes wb-draw { to { stroke-dashoffset: 0; } }
@keyframes wb-fade { to { opacity: 1; } }
@keyframes wb-drop { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
@media (max-width: 700px) { .wbm-mg { font-size: 16px; } .wbm-lab { font-size: 10px; } }
@media (prefers-reduced-motion: reduce) {
  .wbm-fill, .wbm-labs, .wbm-row, .wbm-card { animation: none !important; opacity: 1 !important; }
  .wbm-line, .wbm-link, .wbm-ring path { animation: none !important; stroke-dashoffset: 0 !important; }
}
`;
