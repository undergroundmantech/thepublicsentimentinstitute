"use client";

/**
 * StateRaceMap: the states drawn in dry erase marker on the analyst's whiteboard.
 *
 * Rendered inside PollRoom, which draws the room, the lamp and the board itself. Every
 * state with at least one public poll of the office is coloured in marker on the On Point
 * rating ramp from the current On Point average, and carries a magnet. States with no public
 * poll stay bare board and are not clickable: the board shows where polling exists, not
 * where a race exists.
 *
 * The four closest polled races are held up as index cards along the bottom, each with a
 * marker line to its state. The nine states too small to hit (VT through DC) are magnet tags
 * down the right. A shape, a magnet, a tag or a card all select the race, and the selected
 * race is circled in marker.
 */

import React, { useEffect, useId, useMemo, useState } from "react";
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
  /** The leader's margin over recent weeks, oldest first, for the card sparkline. */
  trend?: number[];
};

const CHIP_ORDER = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
const NO_LABEL = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "HI"]);
const PIN_NUDGE: Record<string, [number, number]> = { FL: [14, 6], MI: [10, 14], LA: [-8, 0], KY: [4, 2], ID: [0, 12], CA: [-8, 4], AK: [6, 4], HI: [8, 6] };

const BW = 920;
const MAP_X = 14, MAP_Y = 10;
const TAG_X = 790, TAG_Y = 34, TAG_W = 122, TAG_H = 25, TAG_GAP = 7;
const CARD_Y = 470, CARD_W = 184, CARD_H = 80;

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

export default function StateRaceMap({ rows, activeId, onPick, office }: { rows: MapRow[]; activeId: string; onPick: (id: string) => void; office: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ abbr: string; x: number; y: number } | null>(null);
  const [compact, setCompact] = useState(false);

  const byAbbr = useMemo(() => { const m: Record<string, MapRow> = {}; for (const r of rows) m[r.abbr] = r; return m; }, [rows]);

  useEffect(() => {
    let dead = false;
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
    chips.forEach((abbr, i) => { a[abbr] = [TAG_X + 11, TAG_Y + i * (TAG_H + TAG_GAP) + TAG_H / 2]; });
    if (geo) for (const [abbr, v] of Object.entries(geo.US_STATE_PATHS)) {
      if (a[abbr] || !byAbbr[abbr]) continue;
      const n = PIN_NUDGE[abbr] ?? [0, 0];
      a[abbr] = [MAP_X + v.c[0] + n[0], MAP_Y + v.c[1] + n[1] - 4];
    }
    return a;
  }, [geo, byAbbr, chips]);

  const cards = useMemo(() => {
    const pool = rows.filter((r) => r.polls >= 2 && anchors[r.abbr]).sort((x, y) => x.margin - y.margin).slice(0, 4);
    pool.sort((x, y) => anchors[x.abbr][0] - anchors[y.abbr][0]);
    return pool.map((r, i) => ({ r, x: 18 + i * (CARD_W + 12), rot: [-1.6, 1.1, -0.8, 1.5][i % 4] }));
  }, [rows, anchors]);

  const boardH = compact ? 465 : 560;
  const move = (abbr: string) => (e: React.MouseEvent) => setTip({ abbr, x: e.clientX, y: e.clientY });
  const focusTip = (abbr: string) => (e: React.FocusEvent<SVGElement>) => { const b = e.currentTarget.getBoundingClientRect(); setTip({ abbr, x: b.left + b.width / 2, y: b.top + b.height / 2 }); };
  const keyPick = (id: string) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } };
  const hover = (abbr: string) => ({ onMouseMove: move(abbr), onMouseLeave: () => setTip(null), onFocus: focusTip(abbr), onBlur: () => setTip(null) });

  let tipStyle: React.CSSProperties | undefined;
  if (tip && typeof window !== "undefined") {
    const flipX = tip.x > window.innerWidth - 240, flipY = tip.y > window.innerHeight - 160;
    tipStyle = { left: flipX ? tip.x - 16 : tip.x + 16, top: flipY ? tip.y - 16 : tip.y + 16, transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"}) rotate(-1.2deg)` };
  }
  const activeAnchor = active ? anchors[active.abbr] : undefined;
  const activeSmall = !!active && CHIP_ORDER.includes(active.abbr);
  const F = (k: string) => `url(#${uid}-${k})`;

  return (
    <div className="wbm">
      <style>{CSS}</style>
      <svg viewBox={`0 0 ${BW} ${boardH}`} className="wbm-svg" role="img" aria-label={`${office} polling averages by state, drawn on a whiteboard`}>
        <defs>
          {/* a faint wobble so lines read as hand drawn marker, not a printed map */}
          <filter id={`${uid}-hand`} x="-3%" y="-3%" width="106%" height="106%">
            <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="5" result="n" />
            <feDisplacementMap in="SourceGraphic" in2="n" scale="1.6" xChannelSelector="R" yChannelSelector="G" />
          </filter>
          {/* marker fill: streaks of ink along one direction, like a broad tip pressed across the state */}
          <filter id={`${uid}-ink`} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.012 0.22" numOctaves="2" seed="9" result="s" />
            <feColorMatrix in="s" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -0.9 1.25" result="sa" />
            <feComposite in="SourceGraphic" in2="sa" operator="in" />
          </filter>
          <filter id={`${uid}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="1.2" dy="2.6" stdDeviation="1.8" floodColor="#1a1c22" floodOpacity=".28" />
          </filter>
          <radialGradient id={`${uid}-mag`} cx="35%" cy="30%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity=".75" />
            <stop offset=".4" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        <g transform={`translate(${MAP_X} ${MAP_Y})`}>
          <g filter={F("ink")}>
            {shapes?.map((s, i) => {
              const r = byAbbr[s.abbr];
              if (!r) return null;
              return <path key={`f-${s.abbr}`} d={s.d} fill={RATE[rowRating(r)]} className="wbm-fill" style={{ animationDelay: `${700 + i * 12}ms` }} />;
            })}
          </g>
          <g filter={F("hand")}>
            {shapes?.map((s, i) => (
              <path key={`o-${s.abbr}`} d={s.d} pathLength={1} className={`wbm-line${byAbbr[s.abbr] ? " live" : ""}`} style={{ animationDelay: `${i * 14}ms` }} />
            ))}
          </g>
          {shapes?.map((s) => {
            const r = byAbbr[s.abbr];
            const on = !!r && r.id === activeId;
            return (
              <path key={s.abbr} d={s.d} className={`srm-state${r ? " is-live" : ""}${on ? " is-on" : ""}`}
                tabIndex={r ? 0 : -1} role={r ? "button" : undefined} aria-label={r ? `${r.title}, ${r.marginText}` : undefined}
                {...(r ? hover(s.abbr) : {})} onClick={() => r && onPick(r.id)} onKeyDown={r ? keyPick(r.id) : undefined} />
            );
          })}
          <g className="wbm-labs">
            {shapes?.filter((s) => !NO_LABEL.has(s.abbr)).map((s) => {
              const r = byAbbr[s.abbr];
              const n = PIN_NUDGE[s.abbr] ?? [0, 0];
              if (!r) return <text key={`t-${s.abbr}`} x={s.c[0]} y={s.c[1] + 3} className="wbm-lab bare">{s.abbr}</text>;
              const p = partyOf(r);
              return (
                <g key={`t-${s.abbr}`}>
                  <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 12} className="wbm-lab">{s.abbr}</text>
                  <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 24} className="wbm-mg" style={{ fill: INK[p] }}>{p ? `${p}+${r.margin.toFixed(1)}` : r.marginText}</text>
                </g>
              );
            })}
          </g>
        </g>

        {/* magnet tags for the small states */}
        {chips.length > 0 && <text x={TAG_X + 2} y={TAG_Y - 10} className="wbm-note">Small states</text>}
        {chips.map((abbr, i) => {
          const r = byAbbr[abbr]!;
          const on = r.id === activeId;
          const y = TAG_Y + i * (TAG_H + TAG_GAP);
          return (
            <g key={`chip-${abbr}`} className={`srm-chip wbm-tag${on ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`${r.title}, ${r.marginText}`}
              style={{ animationDelay: `${1100 + i * 50}ms` }} {...hover(abbr)} onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
              <rect x={TAG_X} y={y} width={TAG_W} height={TAG_H} rx={4} className="wbm-tagp" filter={F("shadow")} />
              <rect x={TAG_X + TAG_W - 7} y={y} width={7} height={TAG_H} fill={RATE[rowRating(r)]} />
              <text x={TAG_X + 20} y={y + TAG_H / 2 + 3.5} className="wbm-tag-ab">{abbr}</text>
              <text x={TAG_X + 40} y={y + TAG_H / 2 + 5} className="wbm-tag-v" style={{ fill: INK[partyOf(r)] }}>{r.marginText}</text>
            </g>
          );
        })}

        {!compact && (
          <g transform={`translate(${TAG_X} ${TAG_Y + Math.max(chips.length, 5) * (TAG_H + TAG_GAP) + 22})`} className="wbm-key">
            <text x="2" y="0" className="wbm-note">Key</text>
            {LEGEND.map((k, i) => (
              <g key={k} transform={`translate(${(i % 2) * 62} ${16 + Math.floor(i / 2) * 19})`}>
                <rect x="0" y="-9" width="13" height="11" fill={RATE[k]} rx="2" opacity=".8" />
                <text x="18" y="1" className="wbm-key-t">{RATING_LABEL[k]}</text>
              </g>
            ))}
          </g>
        )}

        {/* marker lines from each card to its state */}
        {!compact && cards.map(({ r, x }, i) => {
          const a = anchors[r.abbr];
          const sx = x + CARD_W / 2, sy = CARD_Y + 4;
          const mx = (sx + a[0]) / 2 + (i % 2 ? 18 : -18), my = (sy + a[1]) / 2 + 30;
          return <path key={`s-${r.abbr}`} d={`M${sx},${sy} Q${mx},${my} ${a[0]},${a[1] + 6}`} pathLength={1}
            className={`wbm-link${r.id === activeId ? " is-on" : ""}`} style={{ animationDelay: `${1500 + i * 160}ms` }} filter={F("hand")} />;
        })}

        {/* magnets */}
        {rows.filter((r) => anchors[r.abbr]).map((r, i) => {
          const [x, y] = anchors[r.abbr];
          const p = partyOf(r);
          const on = r.id === activeId;
          const rad = Math.min(7, 4 + Math.sqrt(r.polls) * 0.5);
          const small = CHIP_ORDER.includes(r.abbr);
          return (
            <g key={`p-${r.abbr}`} className={`wbm-mag${on ? " is-on" : ""}`} style={{ animationDelay: `${1000 + i * 26}ms` }}
              onClick={() => onPick(r.id)} {...(small ? {} : hover(r.abbr))}>
              <circle cx={x} cy={y} r={rad} fill={INK[p]} filter={F("shadow")} />
              <circle cx={x} cy={y} r={rad} fill={F("mag")} />
            </g>
          );
        })}

        {/* index cards for the closest races */}
        {!compact && cards.map(({ r, x, rot }, i) => {
          const p = partyOf(r);
          const sp = r.trend ? spark(r.trend, 56, 16) : null;
          const on = r.id === activeId;
          return (
            <g key={`c-${r.abbr}`} className={`wbm-card${on ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`Close race: ${r.title}, ${r.marginText}`}
              style={{ animationDelay: `${1300 + i * 120}ms` }} onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
              <g transform={`rotate(${rot} ${x + CARD_W / 2} ${CARD_Y + CARD_H / 2})`}>
                <rect x={x} y={CARD_Y} width={CARD_W} height={CARD_H} rx="3" className="wbm-cardp" filter={F("shadow")} />
                <line x1={x} y1={CARD_Y + 24} x2={x + CARD_W} y2={CARD_Y + 24} className="wbm-rule red" />
                <circle cx={x + CARD_W / 2} cy={CARD_Y + 4} r="6" fill={INK[p]} filter={F("shadow")} />
                <circle cx={x + CARD_W / 2} cy={CARD_Y + 4} r="6" fill={F("mag")} />
                <text x={x + 10} y={CARD_Y + 19} className="wbm-card-t">{shortTitle(r.title)}</text>
                <text x={x + 10} y={CARD_Y + 49} className="wbm-card-m" style={{ fill: INK[p] }}>{r.marginText}</text>
                <text x={x + 10} y={CARD_Y + 69} className="wbm-card-n">{r.polls} polls · {RATING_LABEL[rowRating(r)]}</text>
                {sp && (
                  <g transform={`translate(${x + CARD_W - 64} ${CARD_Y + 52})`}>
                    <line x1="0" x2="56" y1={sp.zero} y2={sp.zero} className="wbm-sp0" />
                    <path d={sp.d} className="wbm-sp" style={{ stroke: INK[p] }} />
                  </g>
                )}
              </g>
            </g>
          );
        })}
        {!compact && cards.length > 0 && <text x="20" y={CARD_Y - 12} className="wbm-note">Closest races</text>}

        {active && activeAnchor && (
          <g key={`ring-${activeId}`} className="wbm-ring" filter={F("hand")}>
            <path d={scribble(activeAnchor[0] + (activeSmall ? TAG_W / 2 - 11 : 0), activeAnchor[1] + (activeSmall ? 0 : 8), activeSmall ? 72 : 32, activeSmall ? 19 : 26, active.abbr.charCodeAt(0))} pathLength={1} />
          </g>
        )}

        {!shapes && !failed && <text x={BW / 2} y={240} className="wbm-load" textAnchor="middle">Drawing the map</text>}
        {failed && <text x={BW / 2} y={240} className="wbm-load" textAnchor="middle">Map unavailable. Use the race list on the board.</text>}
      </svg>

      {compact && cards.length > 0 && (
        <div className="wbm-mcards">
          {cards.map(({ r }) => (
            <button type="button" key={r.abbr} className={`wbm-mcard${r.id === activeId ? " is-on" : ""}`} onClick={() => onPick(r.id)}>
              <b>{shortTitle(r.title)}</b>
              <span style={{ color: INK[partyOf(r)] }}>{r.marginText}</span>
              <small>{r.polls} polls</small>
            </button>
          ))}
        </div>
      )}

      {tipRow && tipStyle && (
        <div className="srm-tip wbm-tip" style={tipStyle} role="tooltip">
          <b>{tipRow.title.replace(/\s+[—–]\s+/g, ": ")}</b>
          <div className="row"><span>Leader</span><span>{tipRow.leader}</span></div>
          <div className="row"><span>On Point average</span><span>{tipRow.marginText}</span></div>
          <div className="row"><span>Rating band</span><span>{RATING_LABEL[rowRating(tipRow)]}</span></div>
          <div className="row"><span>Polls</span><span>{tipRow.polls}</span></div>
          <div className="hint">Click to open this average</div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.wbm { position: relative; }
.wbm-svg { display: block; width: 100%; height: auto; }
.wbm-fill { fill-opacity: .55; opacity: 0; animation: wb-fade .7s ease forwards; }
.wbm-line { fill: none; stroke: rgba(42,45,51,.28); stroke-width: .9; stroke-linejoin: round; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw 1s ease-out forwards; }
.wbm-line.live { stroke: rgba(30,33,40,.78); stroke-width: 1.25; }
.wbm .srm-state { fill: transparent; stroke: none; outline: none; }
.wbm .srm-state.is-live { cursor: pointer; }
.wbm .srm-state.is-live:hover, .wbm .srm-state.is-live:focus-visible { fill: rgba(255,214,80,.18); stroke: #1b1d22; stroke-width: 1.6; }
.wbm .srm-state.is-on { fill: rgba(255,214,80,.14); }
.wbm-lab { font: 700 8.5px var(--font-m); fill: rgba(28,30,36,.85); text-anchor: middle; pointer-events: none; letter-spacing: .04em; paint-order: stroke; stroke: rgba(247,247,243,.8); stroke-width: 2.2px; }
.wbm-lab.bare { fill: rgba(28,30,36,.32); stroke: none; }
.wbm-mg { font: 700 13.5px var(--font-hand); text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: rgba(247,247,243,.85); stroke-width: 3px; }
.wbm-labs { opacity: 0; animation: wb-fade .5s 1s ease forwards; }
.wbm-note { font: 400 17px var(--font-mark); fill: #2a2d33; }
.wbm-load { font: 400 22px var(--font-mark); fill: #2a2d33; }
.wbm-mag { cursor: pointer; opacity: 0; animation: wb-mag .45s cubic-bezier(.3,1.5,.5,1) forwards; }
.wbm-mag:hover circle:first-child, .wbm-mag.is-on circle:first-child { stroke: #111; stroke-width: 1.6; }
.wbm-mag.is-on { animation: wb-mag .45s cubic-bezier(.3,1.5,.5,1) forwards, wb-bob 2.4s 1.6s ease-in-out infinite; }
.wbm-link { fill: none; stroke: rgba(211,36,60,.55); stroke-width: 1.8; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw .9s ease-in-out forwards; }
.wbm-link.is-on { stroke: #d3243c; stroke-width: 2.6; }
.wbm-tag, .wbm-card { cursor: pointer; outline: none; opacity: 0; animation: wb-drop .5s cubic-bezier(.2,1.2,.4,1) forwards; }
.wbm-tagp { fill: #fffdf6; stroke: rgba(0,0,0,.1); stroke-width: .6; }
.wbm-tag:hover .wbm-tagp, .wbm-tag:focus-visible .wbm-tagp, .wbm-tag.is-on .wbm-tagp { stroke: #e0a400; stroke-width: 2; }
.wbm-tag-ab { font: 800 10px var(--font-m); fill: #3a3326; }
.wbm-tag-v { font: 700 14px var(--font-hand); }
.wbm-key-t { font: 600 9.5px var(--font-m); fill: #3a3d44; }
.wbm-cardp { fill: #fffdf6; }
.wbm-card:hover .wbm-cardp, .wbm-card:focus-visible .wbm-cardp { fill: #fff; }
.wbm-card.is-on .wbm-cardp { fill: #fff8db; stroke: #e0a400; stroke-width: 2; }
.wbm-rule.red { stroke: rgba(211,36,60,.35); stroke-width: .8; }
.wbm-card-t { font: 700 16px var(--font-hand); fill: #23252b; }
.wbm-card-m { font: 700 22px var(--font-hand); }
.wbm-card-n { font: 600 8.5px var(--font-m); fill: #6b6f78; letter-spacing: .04em; text-transform: uppercase; }
.wbm-sp { fill: none; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.wbm-sp0 { stroke: rgba(0,0,0,.2); stroke-dasharray: 2 2; }
.wbm-ring path { fill: none; stroke: #1b9e5a; stroke-width: 3; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: wb-draw .6s ease-out forwards; }
.wbm-mcards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 10px; }
.wbm-mcard { appearance: none; text-align: left; display: grid; gap: 2px; padding: 10px 12px; border-radius: 4px; border: 0; background: #fffdf6; color: #23252b; cursor: pointer; box-shadow: 0 4px 10px -6px rgba(0,0,0,.5); font: inherit; }
.wbm-mcard.is-on { outline: 2px solid #e0a400; }
.wbm-mcard b { font: 700 16px var(--font-hand); } .wbm-mcard span { font: 700 20px var(--font-hand); } .wbm-mcard small { font: 600 10px var(--font-m); color: #6b6f78; text-transform: uppercase; }
.wbm-tip { position: fixed; z-index: 80; pointer-events: none; background: #fde27a; color: #3a3015; border-radius: 2px; padding: 12px 14px 10px; font-size: 12.5px; box-shadow: 0 14px 30px -10px rgba(0,0,0,.6); min-width: 210px; max-width: 280px; }
.wbm-tip b { display: block; font: 700 18px/1.1 var(--font-hand); margin-bottom: 6px; color: #2a2208; }
.wbm-tip .row { display: flex; justify-content: space-between; gap: 12px; }
.wbm-tip .row span:last-child { font-family: var(--font-m); font-weight: 700; font-variant-numeric: tabular-nums; }
.wbm-tip .hint { margin-top: 6px; font: 600 10px var(--font-m); letter-spacing: .08em; text-transform: uppercase; opacity: .65; }
@keyframes wb-draw { to { stroke-dashoffset: 0; } }
@keyframes wb-fade { to { opacity: 1; } }
@keyframes wb-mag { 0% { opacity: 0; transform: translateY(-18px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes wb-drop { 0% { opacity: 0; transform: translateY(-10px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes wb-bob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
@media (max-width: 700px) { .wbm-mg { font-size: 16px; } .wbm-lab { font-size: 10px; } }
@media (prefers-reduced-motion: reduce) {
  .wbm-fill, .wbm-labs, .wbm-mag, .wbm-tag, .wbm-card { animation: none !important; opacity: 1 !important; }
  .wbm-line, .wbm-link, .wbm-ring path { animation: none !important; stroke-dashoffset: 0 !important; }
}
`;
