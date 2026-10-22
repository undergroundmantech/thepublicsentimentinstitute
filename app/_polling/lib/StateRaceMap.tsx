"use client";

/**
 * StateRaceMap: the analyst's chalkboard on the polling averages pages.
 *
 * The states are chalked onto a slate in a frame. Every state with at least one public
 * poll of the office is shaded in chalk on the On Point rating ramp (pale for close, deep
 * for solid, lavender when an independent leads) from the current On Point average, and
 * gets a push pin. States with no public poll stay bare slate and are not clickable: the
 * board shows where polling exists, not where a race exists.
 *
 * The closest races are pinned as index cards along the bottom with red string run to
 * their state, the way an analyst keeps a board. The nine states too small to hit with a
 * cursor (VT through DC) hang as paper tags down the right hand side. A shape, a pin, a tag
 * or a card all select the race, and the selected race is circled in chalk.
 *
 * Geometry is projected once at build time into usStatePaths.ts and pulled in with a
 * dynamic import, so the map costs nothing on pages that never show it.
 */

import React, { useEffect, useId, useMemo, useState } from "react";
import { RATE, RATING_LABEL, rating, type Rating } from "@/app/lib/opp";
import { Pointy } from "@/app/components/home/Mascot";

// Caveat is loaded as a plain stylesheet so the build never has to reach Google Fonts; every use carries a handwriting fallback.
const CHALK_FONT_HREF = "https://fonts.googleapis.com/css2?family=Caveat:wght@500;700&display=swap";

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

// Too small to click at this projection scale, hung as paper tags on the right.
const CHIP_ORDER = ["VT", "NH", "MA", "RI", "CT", "NJ", "DE", "MD", "DC"];
const NO_LABEL = new Set(["DC", "RI", "DE", "CT", "NJ", "MD", "MA", "NH", "VT", "HI"]);
// Centroids that sit badly for a pin.
const PIN_NUDGE: Record<string, [number, number]> = { FL: [14, 6], MI: [10, 14], LA: [-8, 0], KY: [4, 2], ID: [0, 12], CA: [-8, 4], AK: [6, 4], HI: [8, 6] };

const BW = 920;              // board width in board units
const MAP_X = 14, MAP_Y = 44; // where the 760 by 440 map sits on the board
const TAG_X = 790, TAG_Y = 70, TAG_W = 122, TAG_H = 25, TAG_GAP = 6;
const CARD_Y = 506, CARD_W = 184, CARD_H = 80;

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

// chalk versions of the party colours, for writing on the slate
const CHALK: Record<string, string> = { D: "#9fc0ff", R: "#ff9cab", I: "#cdb3ff", "": "#efeadb" };
const PIN: Record<string, string> = { D: "#2f6bff", R: "#e8314f", I: "#9a6bff", "": "#d9d2c0" };

const LEGEND: Rating[] = ["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR", "ind"];

/** A hand drawn loop around a point: a little more than one turn with a wobbly radius. */
function scribble(cx: number, cy: number, rx: number, ry: number, seed: number) {
  const pts: string[] = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = -0.5 + (i / n) * Math.PI * 2.25;
    const wob = 1 + 0.07 * Math.sin(i * 1.7 + seed) + 0.05 * Math.cos(i * 0.9 + seed * 2);
    const grow = 1 + (i / n) * 0.12;
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
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [geo, setGeo] = useState<Geo | null>(null);
  const [failed, setFailed] = useState(false);
  const [tip, setTip] = useState<{ abbr: string; x: number; y: number } | null>(null);
  const [compact, setCompact] = useState(false);

  const byAbbr = useMemo(() => {
    const m: Record<string, MapRow> = {};
    for (const r of rows) m[r.abbr] = r;
    return m;
  }, [rows]);

  // the handwriting face, added once to the head; if it is blocked the fallback stack is used and nothing throws
  useEffect(() => {
    if (typeof document === "undefined" || document.querySelector(`link[data-chalk-font]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = CHALK_FONT_HREF; l.setAttribute("data-chalk-font", "1");
    document.head.appendChild(l);
  }, []);

  useEffect(() => {
    let dead = false;
    import("./usStatePaths")
      .then((m) => { if (!dead) setGeo(m as unknown as Geo); })
      .catch(() => { if (!dead) setFailed(true); });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 700px)");
    const on = () => setCompact(mq.matches);
    on();
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
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
  const chips = useMemo(() => CHIP_ORDER.filter((a) => byAbbr[a]), [byAbbr]);
  const tipRow = tip ? byAbbr[tip.abbr] : null;

  // where each live race's pin sits, in board units
  const anchors = useMemo(() => {
    const a: Record<string, [number, number]> = {};
    chips.forEach((abbr, i) => { a[abbr] = [TAG_X + 11, TAG_Y + i * (TAG_H + TAG_GAP) + TAG_H / 2]; });
    if (geo) {
      for (const [abbr, v] of Object.entries(geo.US_STATE_PATHS)) {
        if (a[abbr] || !byAbbr[abbr]) continue;
        const n = PIN_NUDGE[abbr] ?? [0, 0];
        a[abbr] = [MAP_X + v.c[0] + n[0], MAP_Y + v.c[1] + n[1] - 4];
      }
    }
    return a;
  }, [geo, byAbbr, chips]);

  // the closest races, pinned as cards with string to their state
  const cards = useMemo(() => {
    const pool = rows.filter((r) => r.polls >= 2 && anchors[r.abbr]);
    pool.sort((x, y) => x.margin - y.margin);
    const pick = pool.slice(0, 4);
    // lay cards out left to right in the order their states run, so strings cross less
    pick.sort((x, y) => anchors[x.abbr][0] - anchors[y.abbr][0]);
    return pick.map((r, i) => ({ r, x: 18 + i * (CARD_W + 12), rot: [-2.2, 1.4, -1, 2][i % 4] }));
  }, [rows, anchors]);

  const boardH = compact ? 500 : 600;

  const move = (abbr: string) => (e: React.MouseEvent) => setTip({ abbr, x: e.clientX, y: e.clientY });
  const focusTip = (abbr: string) => (e: React.FocusEvent<SVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect();
    setTip({ abbr, x: b.left + b.width / 2, y: b.top + b.height / 2 });
  };
  const keyPick = (id: string) => (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(id); } };
  const hover = (abbr: string) => ({
    onMouseMove: move(abbr), onMouseLeave: () => setTip(null), onFocus: focusTip(abbr), onBlur: () => setTip(null),
  });

  let tipStyle: React.CSSProperties | undefined;
  if (tip && typeof window !== "undefined") {
    const flipX = tip.x > window.innerWidth - 240, flipY = tip.y > window.innerHeight - 160;
    tipStyle = { left: flipX ? tip.x - 16 : tip.x + 16, top: flipY ? tip.y - 16 : tip.y + 16, transform: `translate(${flipX ? "-100%" : "0"}, ${flipY ? "-100%" : "0"}) rotate(-1.5deg)` };
  }

  const activeAnchor = active ? anchors[active.abbr] : undefined;
  const activeSmall = !!active && CHIP_ORDER.includes(active.abbr);
  const officeWord = office === "Governor" ? "governor" : "Senate";
  const F = (k: string) => `url(#${uid}-${k})`;

  return (
    <div className="srm cb">
      <style>{CSS}</style>
      <div className="cb-frame">
        <div className="cb-slate">
          <svg viewBox={`0 0 ${BW} ${boardH}`} className="srm-svg" role="img" aria-label={`${office} polling averages by state, drawn as an analyst's chalkboard`}>
            <defs>
              <filter id={`${uid}-chalk`} x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="4" result="n" />
                <feDisplacementMap in="SourceGraphic" in2="n" scale="2.4" xChannelSelector="R" yChannelSelector="G" result="d" />
                <feTurbulence type="fractalNoise" baseFrequency="1.4" numOctaves="1" seed="11" result="g" />
                <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -2.2 0 0 0 1.75" result="ga" />
                <feComposite in="d" in2="ga" operator="in" />
              </filter>
              <filter id={`${uid}-dust`} x="-10%" y="-10%" width="120%" height="120%">
                <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="2" result="g" />
                <feColorMatrix in="g" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  -1.7 0 0 0 1.55" result="ga" />
                <feComposite in="SourceGraphic" in2="ga" operator="in" />
              </filter>
              <filter id={`${uid}-smudge`} x="0" y="0" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.006 0.012" numOctaves="3" seed="7" />
                <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.11 -0.02" />
              </filter>
              <filter id={`${uid}-paper`} x="-10%" y="-10%" width="130%" height="140%">
                <feDropShadow dx="1.5" dy="3" stdDeviation="2.2" floodColor="#000" floodOpacity=".45" />
              </filter>
              <radialGradient id={`${uid}-head`} cx="35%" cy="30%" r="70%">
                <stop offset="0" stopColor="#fff" stopOpacity=".85" />
                <stop offset=".35" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* the slate: an old smudge of erased chalk and a few ghost notes */}
            <rect x="0" y="0" width={BW} height={boardH} filter={F("smudge")} />
            <g className="cb-ghost" filter={F("dust")}>
              <text x="610" y="470">270?</text>
              <text x="470" y="84" transform="rotate(-6 470 84)">turnout up</text>
              <text x="40" y="320" transform="rotate(4 40 320)">recheck n</text>
            </g>

            <g filter={F("chalk")}>
              <text x="22" y="30" className="cb-title">Where the 2026 {officeWord} polls stand</text>
              <path d="M22 37 q120 -5 300 1" className="cb-underline" pathLength={1} />
            </g>
            <text x={BW - 16} y="28" className="cb-sub" textAnchor="end" filter={F("dust")}>{rows.length} races with a public poll</text>

            {/* state shading, then chalk outlines on top */}
            <g transform={`translate(${MAP_X} ${MAP_Y})`}>
              <g filter={F("dust")}>
                {shapes?.map((s, i) => {
                  const r = byAbbr[s.abbr];
                  if (!r) return null;
                  const rt = rowRating(r);
                  return <path key={`f-${s.abbr}`} d={s.d} fill={RATE[rt]} className="cb-fill" style={{ animationDelay: `${900 + i * 14}ms` }} />;
                })}
              </g>
              <g filter={F("chalk")} className="cb-lines">
                {shapes?.map((s, i) => (
                  <path key={`o-${s.abbr}`} d={s.d} pathLength={1} className={`cb-line${byAbbr[s.abbr] ? " live" : ""}`} style={{ animationDelay: `${i * 16}ms` }} />
                ))}
              </g>
              {/* hit areas */}
              {shapes?.map((s) => {
                const r = byAbbr[s.abbr];
                const isActive = !!r && r.id === activeId;
                return (
                  <path
                    key={s.abbr}
                    d={s.d}
                    className={`srm-state${r ? " is-live" : ""}${isActive ? " is-on" : ""}`}
                    tabIndex={r ? 0 : -1}
                    role={r ? "button" : undefined}
                    aria-label={r ? `${r.title}, ${r.marginText}` : undefined}
                    {...(r ? hover(s.abbr) : {})}
                    onClick={() => r && onPick(r.id)}
                    onKeyDown={r ? keyPick(r.id) : undefined}
                  />
                );
              })}
              <g className="cb-labs">
                {shapes?.filter((s) => !NO_LABEL.has(s.abbr)).map((s) => {
                  const r = byAbbr[s.abbr];
                  const n = PIN_NUDGE[s.abbr] ?? [0, 0];
                  if (!r) return <text key={`t-${s.abbr}`} x={s.c[0]} y={s.c[1] + 3} className="cb-lab bare">{s.abbr}</text>;
                  const p = partyOf(r);
                  return (
                    <g key={`t-${s.abbr}`}>
                      <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 12} className="cb-lab">{s.abbr}</text>
                      <text x={s.c[0] + n[0]} y={s.c[1] + n[1] + 23} className="cb-mg" style={{ fill: CHALK[p] }}>{p ? `${p}+${r.margin.toFixed(1)}` : r.marginText}</text>
                    </g>
                  );
                })}
              </g>
            </g>

            {/* paper tags for the small states */}
            {chips.map((abbr, i) => {
              const r = byAbbr[abbr]!;
              const rt = rowRating(r);
              const isActive = r.id === activeId;
              const y = TAG_Y + i * (TAG_H + TAG_GAP);
              return (
                <g key={`chip-${abbr}`} className={`srm-chip cb-tag${isActive ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`${r.title}, ${r.marginText}`}
                  style={{ animationDelay: `${1300 + i * 60}ms` }}
                  {...hover(abbr)} onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
                  <g transform={`rotate(${i % 2 ? 1.2 : -1.4} ${TAG_X + TAG_W / 2} ${y + TAG_H / 2})`}>
                    <rect x={TAG_X} y={y} width={TAG_W} height={TAG_H} rx={3} className="cb-tagp" filter={F("paper")} />
                    <rect x={TAG_X + TAG_W - 8} y={y} width={8} height={TAG_H} fill={RATE[rt]} />
                    <text x={TAG_X + 20} y={y + TAG_H / 2 + 3.5} className="cb-tag-ab">{abbr}</text>
                    <text x={TAG_X + 40} y={y + TAG_H / 2 + 5} className="cb-tag-v">{r.marginText}</text>
                  </g>
                </g>
              );
            })}
            {chips.length > 0 && <text x={TAG_X + 2} y={TAG_Y - 12} className="cb-note" filter={F("dust")}>Small states</text>}

            {/* chalk key */}
            {!compact && (
              <g className="cb-key" transform={`translate(${TAG_X} ${TAG_Y + Math.max(chips.length, 6) * (TAG_H + TAG_GAP) + 26})`} filter={F("dust")}>
                <text x="2" y="0" className="cb-note">Key</text>
                {LEGEND.map((k, i) => (
                  <g key={k} transform={`translate(${(i % 2) * 62} ${14 + Math.floor(i / 2) * 18})`}>
                    <rect x="0" y="-8" width="12" height="10" fill={RATE[k]} rx="1.5" />
                    <text x="17" y="1" className="cb-key-t">{RATING_LABEL[k]}</text>
                  </g>
                ))}
              </g>
            )}

            {/* red string from each card to its state */}
            {!compact && cards.map(({ r, x }, i) => {
              const a = anchors[r.abbr];
              const sx = x + CARD_W / 2, sy = CARD_Y + 6;
              const mx = (sx + a[0]) / 2, my = Math.max(sy, a[1]) + 34;
              return (
                <g key={`s-${r.abbr}`} className={`cb-string${r.id === activeId ? " is-on" : ""}`}>
                  <path d={`M${sx},${sy} Q${mx},${my} ${a[0]},${a[1]}`} className="sh" />
                  <path d={`M${sx},${sy} Q${mx},${my} ${a[0]},${a[1]}`} className="yarn" pathLength={1} style={{ animationDelay: `${1800 + i * 180}ms` }} />
                </g>
              );
            })}

            {/* push pins */}
            {rows.filter((r) => anchors[r.abbr]).map((r, i) => {
              const [x, y] = anchors[r.abbr];
              const p = partyOf(r);
              const isActive = r.id === activeId;
              const rad = Math.min(6.4, 3.6 + Math.sqrt(r.polls) * 0.55);
              const small = CHIP_ORDER.includes(r.abbr);
              return (
                <g key={`p-${r.abbr}`} className={`cb-pin${isActive ? " is-on" : ""}`} style={{ animationDelay: `${1200 + i * 30}ms` }}
                  onClick={() => onPick(r.id)} {...(small ? {} : hover(r.abbr))}>
                  <ellipse cx={x + 3} cy={y + 5} rx={rad * 0.9} ry={rad * 0.45} className="cb-pin-sh" />
                  <line x1={x} y1={y} x2={x + 1.5} y2={y + 5} className="cb-pin-n" />
                  <circle cx={x} cy={y - 1} r={rad} fill={PIN[p]} className="cb-pin-h" />
                  <circle cx={x} cy={y - 1} r={rad} fill={F("head")} />
                </g>
              );
            })}

            {/* index cards for the closest races */}
            {!compact && cards.map(({ r, x, rot }, i) => {
              const p = partyOf(r);
              const sp = r.trend ? spark(r.trend, 56, 16) : null;
              const isActive = r.id === activeId;
              return (
                <g key={`c-${r.abbr}`} className={`cb-card${isActive ? " is-on" : ""}`} tabIndex={0} role="button" aria-label={`Close race: ${r.title}, ${r.marginText}`}
                  style={{ animationDelay: `${1500 + i * 140}ms` }}
                  onClick={() => onPick(r.id)} onKeyDown={keyPick(r.id)}>
                  <g transform={`rotate(${rot} ${x + CARD_W / 2} ${CARD_Y + CARD_H / 2})`}>
                    <rect x={x} y={CARD_Y} width={CARD_W} height={CARD_H} rx="2" className="cb-cardp" filter={F("paper")} />
                    <line x1={x} y1={CARD_Y + 24} x2={x + CARD_W} y2={CARD_Y + 24} className="cb-rule red" />
                    {[40, 54, 68].map((yy) => <line key={yy} x1={x} y1={CARD_Y + yy} x2={x + CARD_W} y2={CARD_Y + yy} className="cb-rule" />)}
                    <text x={x + 10} y={CARD_Y + 19} className="cb-card-t">{shortTitle(r.title)}</text>
                    <text x={x + 10} y={CARD_Y + 49} className="cb-card-m" style={{ fill: PIN[p] }}>{r.marginText}</text>
                    <text x={x + 10} y={CARD_Y + 69} className="cb-card-n">{r.polls} polls · {RATING_LABEL[rowRating(r)]}</text>
                    {sp && (
                      <g transform={`translate(${x + CARD_W - 64} ${CARD_Y + 52})`}>
                        <line x1="0" x2="56" y1={sp.zero} y2={sp.zero} className="cb-sp0" />
                        <path d={sp.d} className="cb-sp" style={{ stroke: PIN[p] }} />
                      </g>
                    )}
                  </g>
                </g>
              );
            })}
            {!compact && cards.length > 0 && <text x="22" y={CARD_Y - 10} className="cb-note" filter={F("dust")}>Closest races, pinned</text>}

            {/* the chalk circle around the selected race */}
            {active && activeAnchor && (
              <g key={`ring-${activeId}`} filter={F("chalk")} className="cb-ring">
                <path d={scribble(activeAnchor[0] + (activeSmall ? TAG_W / 2 - 11 : 0), activeAnchor[1] + (activeSmall ? 0 : 6), activeSmall ? 70 : 30, activeSmall ? 18 : 24, active.abbr.charCodeAt(0))} pathLength={1} />
                {!activeSmall && (() => {
                  const left = activeAnchor[0] > 560;
                  const tx = activeAnchor[0] + (left ? -40 : 40), ty = activeAnchor[1] - 26;
                  return (
                    <>
                      <path d={`M${activeAnchor[0] + (left ? -28 : 28)},${activeAnchor[1] - 8} Q${(activeAnchor[0] + tx) / 2},${ty - 6} ${tx},${ty + 2}`} pathLength={1} className="arrow" />
                      <text x={tx + (left ? -4 : 4)} y={ty} textAnchor={left ? "end" : "start"} className="cb-ring-t">{active.marginText}</text>
                    </>
                  );
                })()}
              </g>
            )}

            {!shapes && !failed && <text x={BW / 2} y={260} className="cb-load" textAnchor="middle">Chalking the map</text>}
            {failed && <text x={BW / 2} y={260} className="cb-load" textAnchor="middle">Map geometry unavailable. Use the race picker above.</text>}
          </svg>

          {active && !compact && (
            <Pointy className="cb-pty" pose="point" prop="pointer" size={96} flip
              say={<><b>{active.abbr}</b> {active.marginText}<br /><span style={{ opacity: .75 }}>{active.polls} poll{active.polls === 1 ? "" : "s"} in the average</span></>} />
          )}
        </div>
        <div className="cb-tray" aria-hidden="true">
          <i className="ch w" /><i className="ch y" /><i className="ch p" /><i className="ch b" /><span className="er" />
        </div>
      </div>

      {compact && cards.length > 0 && (
        <div className="cb-mcards">
          {cards.map(({ r }) => {
            const p = partyOf(r);
            return (
              <button type="button" key={r.abbr} className={`cb-mcard${r.id === activeId ? " is-on" : ""}`} onClick={() => onPick(r.id)}>
                <b>{shortTitle(r.title)}</b>
                <span style={{ color: PIN[p] }}>{r.marginText}</span>
                <small>{r.polls} polls</small>
              </button>
            );
          })}
        </div>
      )}

      <div className="srm-legend cb-legend">
        {LEGEND.map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)}
        <span><i style={{ background: "#2a4436", border: "1px solid rgba(255,255,255,.3)" }} />No public poll</span>
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
        {rows.length} of the 2026 {officeWord} races carry at least one public poll. Chalk shading is the current On Point average
        margin on the forecast rating bands: pale when close, deep past 12 points. Pin size grows with the number of polls, and the
        four closest polled races are pinned as cards. A state with no public poll is left as bare slate rather than filled in from a model.
      </p>

      {tipRow && tipStyle && (
        <div className="srm-tip cb-tip" style={tipStyle} role="tooltip">
          <b>{tipRow.title.replace(/\s+[—–]\s+/g, ": ")}</b>
          <div className="row"><span>Leader</span><span>{tipRow.leader}</span></div>
          <div className="row"><span>On Point average</span><span>{tipRow.marginText}</span></div>
          <div className="row"><span>Rating band</span><span>{RATING_LABEL[rowRating(tipRow)]}</span></div>
          <div className="row"><span>Polls</span><span>{tipRow.polls}</span></div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.srm { position: relative; }
.srm, .cb-tip { --font-chalk: "Caveat", "Segoe Print", "Bradley Hand", "Chalkboard SE", "Comic Sans MS"; }
.cb { --chalk: #f1ecdd; --slate: #1f3529; --slate2: #29473a; }
.cb .cb-frame { position: relative; border-radius: 14px; padding: 12px 12px 0; background:
  linear-gradient(90deg, rgba(0,0,0,.25), transparent 6%, transparent 94%, rgba(0,0,0,.25)),
  repeating-linear-gradient(92deg, #7a5230 0 7px, #6b4629 7px 11px, #845a35 11px 19px, #70492b 19px 24px);
  box-shadow: 0 22px 50px -24px #000, inset 0 1px 0 rgba(255,255,255,.18), inset 0 -2px 0 rgba(0,0,0,.35); }
.cb .cb-slate { position: relative; border-radius: 6px; overflow: hidden;
  background: radial-gradient(120% 90% at 45% 40%, var(--slate2), var(--slate) 70%, #172a20);
  box-shadow: inset 0 0 0 2px rgba(0,0,0,.45), inset 0 0 40px rgba(0,0,0,.55); }
.cb .srm-svg { display: block; width: 100%; height: auto; }
.cb .cb-tray { position: relative; height: 22px; margin: 0 -12px; border-radius: 0 0 14px 14px;
  background: linear-gradient(#8a5d36, #5b3b21); box-shadow: inset 0 3px 4px rgba(0,0,0,.45); display: flex; align-items: flex-start; gap: 10px; padding: 3px 34px 0; }
.cb .ch { display: block; width: 46px; height: 9px; border-radius: 3px; box-shadow: 0 2px 2px rgba(0,0,0,.4); }
.cb .ch.w { background: #f4f1e8; transform: rotate(-2deg); } .cb .ch.y { background: #f6dc7c; width: 30px; transform: rotate(3deg); }
.cb .ch.p { background: #f3a8b9; width: 38px; } .cb .ch.b { background: #a9c6ff; width: 24px; transform: rotate(-4deg); }
.cb .er { margin-left: auto; width: 74px; height: 14px; margin-top: -3px; border-radius: 3px; background: linear-gradient(#3a2a1c 0 55%, #d8d0c0 55%); box-shadow: 0 3px 4px rgba(0,0,0,.45); }

.cb-title { font: 700 27px var(--font-chalk), "Comic Sans MS", cursive; fill: var(--chalk); }
.cb-underline { fill: none; stroke: #f6dc7c; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: cb-draw .9s .5s ease-out forwards; }
.cb-sub { font: 500 17px var(--font-chalk), cursive; fill: rgba(241,236,221,.72); }
.cb-note { font: 700 17px var(--font-chalk), cursive; fill: #f6dc7c; }
.cb-ghost text { font: 500 30px var(--font-chalk), cursive; fill: rgba(241,236,221,.06); }
.cb-load { font: 700 22px var(--font-chalk), cursive; fill: var(--chalk); }

.cb-fill { fill-opacity: .62; opacity: 0; animation: cb-fade .8s ease forwards; }
.cb-line { fill: none; stroke: rgba(241,236,221,.38); stroke-width: .9; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: cb-draw 1.1s ease-out forwards; }
.cb-line.live { stroke: rgba(241,236,221,.85); stroke-width: 1.2; }
.cb .srm-state { fill: transparent; stroke: none; outline: none; }
.cb .srm-state.is-live { cursor: pointer; }
.cb .srm-state.is-live:hover, .cb .srm-state.is-live:focus-visible { fill: rgba(255,255,255,.12); stroke: #fff; stroke-width: 1.4; stroke-dasharray: 3 2; }
.cb .srm-state.is-on { fill: rgba(246,220,124,.12); }
.cb-lab { font: 700 8.5px var(--font-m); fill: rgba(241,236,221,.95); text-anchor: middle; pointer-events: none; letter-spacing: .04em; paint-order: stroke; stroke: rgba(18,32,25,.75); stroke-width: 2.4px; }
.cb-lab.bare { fill: rgba(241,236,221,.32); }
.cb-mg { font: 700 13px var(--font-chalk), cursive; text-anchor: middle; pointer-events: none; paint-order: stroke; stroke: rgba(18,32,25,.8); stroke-width: 3px; }
.cb-labs { opacity: 0; animation: cb-fade .6s 1.1s ease forwards; }

.cb-pin { cursor: pointer; opacity: 0; animation: cb-pin .55s cubic-bezier(.3,1.6,.5,1) forwards; }
.cb-pin-sh { fill: rgba(0,0,0,.45); }
.cb-pin-n { stroke: #c9cdd3; stroke-width: 1.2; stroke-linecap: round; }
.cb-pin-h { stroke: rgba(0,0,0,.35); stroke-width: .8; }
.cb-pin:hover .cb-pin-h, .cb-pin.is-on .cb-pin-h { stroke: #fff; stroke-width: 1.6; }
.cb-pin.is-on { animation: cb-pin .55s cubic-bezier(.3,1.6,.5,1) forwards, cb-wiggle 2.4s 1.8s ease-in-out infinite; transform-box: fill-box; transform-origin: 50% 100%; }

.cb-string .sh { fill: none; stroke: rgba(0,0,0,.35); stroke-width: 2.4; transform: translate(1.5px, 2.5px); opacity: 0; animation: cb-fade .4s 2.2s forwards; }
.cb-string .yarn { fill: none; stroke: #d2343f; stroke-width: 1.6; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: cb-draw .9s ease-in-out forwards; }
.cb-string.is-on .yarn { stroke: #ff5a64; stroke-width: 2.4; }

.cb-tag, .cb-card { cursor: pointer; outline: none; opacity: 0; animation: cb-drop .6s cubic-bezier(.2,1.3,.4,1) forwards; }
.cb-tagp { fill: #efe7d2; stroke: rgba(0,0,0,.15); stroke-width: .6; }
.cb-tag:hover .cb-tagp, .cb-tag:focus-visible .cb-tagp, .cb-tag.is-on .cb-tagp { fill: #fff6dc; stroke: #f6dc7c; stroke-width: 1.6; }
.cb-tag-ab { font: 800 10px var(--font-m); fill: #3a3326; }
.cb-tag-v { font: 700 14px var(--font-chalk), cursive; fill: #2c261b; }
.cb-key-t { font: 600 9.5px var(--font-m); fill: rgba(241,236,221,.85); }
.cb-cardp { fill: #f7f2e4; }
.cb-card:hover .cb-cardp, .cb-card:focus-visible .cb-cardp { fill: #fffaf0; }
.cb-card.is-on .cb-cardp { fill: #fff6d6; stroke: #f6dc7c; stroke-width: 2; }
.cb-rule { stroke: rgba(80,120,200,.25); stroke-width: .7; } .cb-rule.red { stroke: rgba(210,52,63,.45); }
.cb-card-t { font: 700 17px var(--font-chalk), cursive; fill: #2a2418; }
.cb-card-m { font: 700 21px var(--font-chalk), cursive; }
.cb-card-n { font: 600 8.5px var(--font-m); fill: #6c6250; letter-spacing: .04em; text-transform: uppercase; }
.cb-sp { fill: none; stroke-width: 1.6; stroke-linecap: round; stroke-linejoin: round; }
.cb-sp0 { stroke: rgba(0,0,0,.25); stroke-dasharray: 2 2; }

.cb-ring path { fill: none; stroke: #f6dc7c; stroke-width: 2.4; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 1; animation: cb-draw .7s ease-out forwards; }
.cb-ring path.arrow { stroke-width: 1.8; animation-delay: .55s; }
.cb-ring-t { font: 700 20px var(--font-chalk), cursive; fill: #f6dc7c; opacity: 0; animation: cb-fade .4s .9s forwards; }

.cb .cb-pty { right: 14px; bottom: 6px; }
.cb .cb-pty .pty-say { max-width: 170px; font-size: 12px; }

.cb-mcards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; margin-top: 12px; }
.cb-mcard { appearance: none; text-align: left; display: grid; gap: 2px; padding: 10px 12px; border-radius: 4px; border: 0; background: #f7f2e4; color: #2a2418; cursor: pointer; box-shadow: 0 6px 14px -8px #000; font: inherit; }
.cb-mcard:nth-child(odd) { transform: rotate(-1deg); } .cb-mcard:nth-child(even) { transform: rotate(1deg); }
.cb-mcard.is-on { outline: 2px solid #f6dc7c; }
.cb-mcard b { font: 700 17px var(--font-chalk), cursive; } .cb-mcard span { font: 700 20px var(--font-chalk), cursive; } .cb-mcard small { font: 600 10px var(--font-m); color: #6c6250; text-transform: uppercase; }

.srm-legend { display: flex; flex-wrap: wrap; gap: 8px 14px; font-size: 12px; color: var(--mute); margin-top: 14px; }
.srm-legend i { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -2px; margin-right: 6px; }
.srm-readout { display: flex; flex-wrap: wrap; align-items: baseline; gap: 6px 12px; margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
.srm-ro-abbr { font: 700 13px var(--font-m); color: var(--ink2); }
.srm-ro-title { font-size: 13px; color: var(--ink); min-width: 0; }
.srm-ro-val { font: 700 13px var(--font-m); font-variant-numeric: tabular-nums; }
.srm-ro-n { font: 600 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); margin-left: auto; }
.srm-foot { margin: 10px 0 0; font-size: 12px; line-height: 1.55; color: var(--mute); }
.cb-tip { position: fixed; z-index: 80; pointer-events: none; background: #fbe27a; color: #3a3015; border-radius: 2px; padding: 12px 14px 10px; font-size: 12.5px; box-shadow: 0 14px 30px -10px rgba(0,0,0,.7); min-width: 210px; max-width: 280px; }
.cb-tip::before { content: ""; position: absolute; left: 50%; top: -7px; width: 54px; height: 15px; transform: translateX(-50%) rotate(-3deg); background: rgba(255,255,255,.45); }
.cb-tip b { display: block; font: 700 19px/1.1 var(--font-chalk), cursive; margin-bottom: 6px; color: #2a2208; }
.cb-tip .row { display: flex; justify-content: space-between; gap: 12px; }
.cb-tip .row span:last-child { font-family: var(--font-m); font-weight: 700; font-variant-numeric: tabular-nums; }

@keyframes cb-draw { to { stroke-dashoffset: 0; } }
@keyframes cb-fade { to { opacity: 1; } }
@keyframes cb-pin { 0% { opacity: 0; transform: translateY(-26px); } 60% { opacity: 1; } 100% { opacity: 1; transform: translateY(0); } }
@keyframes cb-drop { 0% { opacity: 0; transform: translateY(-14px); } 100% { opacity: 1; transform: translateY(0); } }
@keyframes cb-wiggle { 0%, 100% { transform: rotate(0); } 50% { transform: rotate(-8deg); } }
@media (max-width: 700px) { .cb .cb-frame { padding: 8px 8px 0; } .cb .cb-tray { margin: 0 -8px; height: 16px; padding-left: 18px; } .cb .ch { height: 7px; } .cb-mg { font-size: 15px; } .cb-lab { font-size: 10px; } }
@media (prefers-reduced-motion: reduce) {
  .cb-fill, .cb-labs, .cb-pin, .cb-tag, .cb-card, .cb-ring-t, .cb-string .sh { animation: none !important; opacity: 1 !important; }
  .cb-line, .cb-underline, .cb-string .yarn, .cb-ring path { animation: none !important; stroke-dashoffset: 0 !important; }
}
`;
