"use client";

/**
 * PollRoom: the way into every polling average. An analyst's room with a dry erase
 * whiteboard on the wall under a picture light. The tabs written across the top of the
 * board switch between groups of averages; Senate and governor show the marker map,
 * every other group shows its averages as index cards held up with magnets. A race list
 * on the board reaches any average directly, and the sample filter sits on the tray.
 */

import React, { useEffect } from "react";
import StateRaceMap, { INK, type MapRow } from "./StateRaceMap";
import { Pointy } from "@/app/components/home/Mascot";

export type RoomItem = { id: string; label: string; value: string; color: string; spark: number[]; n: number; last?: string | null };

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Permanent+Marker&display=swap";

function inkOf(color: string) {
  const c = (color || "").toLowerCase();
  if (c.includes("dem")) return INK.D;
  if (c.includes("gop") || c.includes("rep")) return INK.R;
  if (c.includes("disapprove")) return "#b0306a";
  if (c.includes("approve")) return "#13804a";
  if (c.includes("7a4bb0") || c.includes("purple")) return INK.I;
  if (c.startsWith("#")) return color;
  return INK[""];
}

function Spark({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return <svg className="wbr-spark" aria-hidden />;
  const w = 100, h = 26;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const d = data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join("");
  return <svg className="wbr-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

export default function PollRoom({
  groups, group, onGroup, items, allItems, activeId, onPick, mapRows, office, active, tray,
}: {
  groups: { id: string; label: string; count: number }[];
  group: string;
  onGroup: (g: string) => void;
  items: RoomItem[];
  allItems: { id: string; label: string; group: string }[];
  activeId: string;
  onPick: (id: string) => void;
  mapRows: MapRow[];
  office: string | null;
  active: { title: string; value: string; color: string; polls: number } | null;
  tray?: React.ReactNode;
}) {
  useEffect(() => {
    if (typeof document === "undefined" || document.querySelector("link[data-wb-font]")) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = FONT_HREF; l.setAttribute("data-wb-font", "1");
    document.head.appendChild(l);
  }, []);

  // fetch the state outlines as soon as the room mounts, so the map is ready before the averages finish
  useEffect(() => { import("./usStatePaths").catch(() => {}); }, []);
  const showMap = !!office;
  return (
    <section className="wbroom" aria-label="Find a polling average">
      <style>{CSS}</style>
      <div className="wbr-wall" aria-hidden="true" />
      <div className="wbr-lamp" aria-hidden="true"><i className="arm" /><i className="bar" /><i className="glow" /></div>
      <div className="wbr-board">
        <div className="wbr-frame">
          <div className="wbr-surface">
            <div className="wbr-head">
              <div className="wbr-title">Find a poll</div>
              <div className="wbr-tabs" role="tablist" aria-label="Groups of averages">
                {groups.map((g) => (
                  <button key={g.id} type="button" role="tab" aria-selected={g.id === group} className={g.id === group ? "on" : ""} onClick={() => onGroup(g.id)}>
                    {g.label}<small>{g.count}</small>
                  </button>
                ))}
              </div>
              <label className="wbr-jump">
                <span>Jump to</span>
                <select value={allItems.some((x) => x.id === activeId) ? activeId : ""} onChange={(e) => e.target.value && onPick(e.target.value)} aria-label="Jump to any average">
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {allItems.filter((x) => x.group === g.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>
            <p className="wbr-how">{showMap ? "Tap a state, a magnet or a card to open its average. Colour is the current On Point average: pale when close, deep when safe." : "Tap a card to open its average. The line on each card is the last stretch of the average."}</p>

            {showMap ? (
              <StateRaceMap rows={mapRows} activeId={activeId} onPick={onPick} office={office!} />
            ) : (
              <div className="wbr-cards">
                {items.map((it, i) => {
                  const ink = inkOf(it.color);
                  return (
                    <button key={it.id} type="button" className={`wbr-card${it.id === activeId ? " on" : ""}`} onClick={() => onPick(it.id)}
                      style={{ "--rot": `${[-1.2, 0.9, -0.6, 1.3, -0.9, 0.5][i % 6]}deg`, "--ink": ink, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                      <i className="mag" aria-hidden="true" />
                      <span className="t">{it.label}</span>
                      <span className="v">{it.value || "…"}</span>
                      <Spark data={it.spark} color={ink} />
                      <span className="s">{it.n ? `${it.n} polls` : ""}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {active && (
              <div className="wbr-now" aria-live="polite">
                <span className="lbl">Showing below</span>
                <b>{active.title}</b>
                <span className="v" style={{ color: inkOf(active.color) }}>{active.value}</span>
                <span className="n">{active.polls} polls</span>
              </div>
            )}
          </div>
        </div>
        <div className="wbr-tray">
          <span className="mk b" aria-hidden="true" /><span className="mk r" aria-hidden="true" /><span className="mk k" aria-hidden="true" /><span className="mk g" aria-hidden="true" />
          <span className="eraser" aria-hidden="true" />
          {tray ? <div className="wbr-tray-ctl">{tray}</div> : null}
        </div>
      </div>
      <div className="wbr-floor" aria-hidden="true" />
      {active ? (
        <Pointy className="wbr-pty" pose="point" prop="pointer" size={92} flip
          say={<><b>{active.value}</b><br /><span style={{ opacity: .8 }}>{active.polls} polls in the average</span></>} />
      ) : null}
    </section>
  );
}

const CSS = `
.wbroom { --font-mark: "Permanent Marker", "Marker Felt", "Comic Sans MS", cursive; --font-hand: "Kalam", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
  position: relative; isolation: isolate; margin: 0 calc(50% - 50vw) 22px; padding: 54px max(16px, calc(50vw - 640px)) 54px; overflow: hidden; }
.wbr-wall { position: absolute; inset: 0; z-index: -2;
  background:
    radial-gradient(60% 55% at 50% 18%, rgba(255,214,150,.16), transparent 70%),
    repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 160px),
    linear-gradient(180deg, #2b2733 0%, #26222d 70%, #1e1b24 100%); }
.wbr-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; z-index: -1;
  background: linear-gradient(180deg, #4b3a2c 0 6px, #2c2119 6px 9px, transparent 9px), repeating-linear-gradient(90deg, #3a2b20 0 120px, #34261c 120px 240px);
  box-shadow: inset 0 10px 18px rgba(0,0,0,.45); }
.wbr-lamp { position: absolute; left: 50%; top: -8px; width: min(460px, 56vw); height: 62px; transform: translateX(-50%); pointer-events: none; }
.wbr-lamp .arm { position: absolute; left: 50%; top: 0; width: 6px; height: 34px; transform: translateX(-50%); background: linear-gradient(90deg, #7a6440, #c9a86a, #7a6440); border-radius: 3px; }
.wbr-lamp .bar { position: absolute; left: 10%; right: 10%; top: 30px; height: 16px; border-radius: 8px 8px 12px 12px; background: linear-gradient(180deg, #d6b778, #8c7346); box-shadow: 0 6px 14px rgba(0,0,0,.45); }
.wbr-lamp .glow { position: absolute; left: 12%; right: 12%; top: 44px; height: 6px; border-radius: 3px; background: #fff3cf; box-shadow: 0 0 22px 8px rgba(255,226,160,.55); }
.wbr-board { position: relative; max-width: min(1180px, max(760px, calc((100vh - 300px) * 1.6))); margin: 0 auto; }
.wbr-board::before { content: ""; position: absolute; left: -12%; right: -12%; top: -70px; height: 120%; z-index: -1; pointer-events: none;
  background: radial-gradient(50% 55% at 50% 0%, rgba(255,222,160,.30), rgba(255,222,160,.09) 55%, transparent 75%); }
.wbr-frame { position: relative; padding: 10px; border-radius: 10px;
  background: linear-gradient(180deg, #d9dde3, #9aa1ab 50%, #c4c9d0); box-shadow: 0 30px 60px -28px rgba(0,0,0,.85), 0 2px 0 rgba(255,255,255,.4) inset; }
.wbr-surface { position: relative; border-radius: 4px; padding: 18px 20px 16px; color: #23252b; overflow: hidden;
  background:
    radial-gradient(80% 60% at 50% 0%, rgba(255,246,222,.75), rgba(255,246,222,0) 70%),
    linear-gradient(112deg, transparent 58%, rgba(255,255,255,.28) 66%, transparent 74%),
    radial-gradient(120% 120% at 50% 10%, #efeee8 40%, #dedcd3 100%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -30px 60px rgba(0,0,0,.05); }
.wbr-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.wbr-title { font: 400 28px/1 var(--font-mark); color: #1f57c8; transform: rotate(-1.5deg); }
.wbr-tabs { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.wbr-tabs button { appearance: none; border: 0; background: none; cursor: pointer; padding: 4px 10px 6px; font: 700 18px/1.1 var(--font-hand); color: #34373e; position: relative; border-radius: 6px; }
.wbr-tabs button small { font: 700 10px var(--font-m); margin-left: 5px; color: #7a7e86; }
.wbr-tabs button:hover { background: rgba(31,87,200,.07); }
.wbr-tabs button.on { color: #c21f37; }
.wbr-tabs button.on::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: 1px; height: 4px; border-radius: 3px; background: rgba(194,31,55,.75); transform: rotate(-1deg); }
.wbr-tabs button:focus-visible { outline: 2px solid #1f57c8; outline-offset: 1px; }
.wbr-jump { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font: 700 15px var(--font-hand); color: #34373e; }
.wbr-jump span { white-space: nowrap; }
.wbr-jump select { max-width: 240px; font: 600 13px var(--font-b); color: #23252b; background: #fffdf6; border: 2px solid #2a2d33; border-radius: 8px; padding: 6px 10px; }
.wbr-how { margin: 6px 0 4px; font: 400 15px/1.35 var(--font-hand); color: #50545c; }
.wbr-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 16px 14px; padding: 12px 2px 6px; }
.wbr-card { appearance: none; position: relative; display: grid; gap: 2px; text-align: left; padding: 16px 14px 10px; border: 0; border-radius: 3px; cursor: pointer; color: #23252b;
  background: #fffdf6; box-shadow: 0 8px 14px -10px rgba(0,0,0,.55), 0 1px 0 rgba(0,0,0,.05); transform: rotate(var(--rot)); transition: transform .2s, box-shadow .2s; animation: wb-drop .45s cubic-bezier(.2,1.2,.4,1) both; }
.wbr-card:hover, .wbr-card:focus-visible { transform: rotate(0) translateY(-2px); box-shadow: 0 14px 20px -12px rgba(0,0,0,.6); outline: none; }
.wbr-card.on { background: #fff8db; box-shadow: 0 0 0 2px #e0a400, 0 10px 18px -12px rgba(0,0,0,.6); }
.wbr-card .mag { position: absolute; left: 50%; top: -7px; width: 16px; height: 16px; margin-left: -8px; border-radius: 50%; background: radial-gradient(circle at 35% 30%, rgba(255,255,255,.8), transparent 45%), var(--ink); box-shadow: 0 2px 3px rgba(0,0,0,.35); }
.wbr-card .t { font: 700 16px/1.15 var(--font-hand); }
.wbr-card .v { font: 700 24px/1.1 var(--font-hand); color: var(--ink); }
.wbr-card .s { font: 600 9.5px var(--font-m); letter-spacing: .06em; text-transform: uppercase; color: #6b6f78; }
.wbr-spark { display: block; width: 100%; height: 26px; }
.wbr-now { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 10px; padding-top: 10px; border-top: 2px dashed rgba(42,45,51,.18); }
.wbr-now .lbl { font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: #6b6f78; }
.wbr-now b { font: 700 17px var(--font-hand); }
.wbr-now .v { font: 700 19px var(--font-hand); }
.wbr-now .n { margin-left: auto; font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: #6b6f78; }
.wbr-tray { position: relative; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 2%; padding: 8px 18px 10px; border-radius: 0 0 8px 8px;
  background: linear-gradient(180deg, #b8bec6, #8b929c); box-shadow: 0 12px 20px -12px rgba(0,0,0,.8); }
.wbr-tray .mk { display: block; width: 58px; height: 12px; border-radius: 6px 3px 3px 6px; background: linear-gradient(90deg, var(--c) 0 26%, #f4f4f2 26% 92%, #ddd 92%); box-shadow: 0 2px 2px rgba(0,0,0,.3); }
.wbr-tray .mk.b { --c: #1f57c8; } .wbr-tray .mk.r { --c: #d3243c; transform: rotate(4deg); } .wbr-tray .mk.k { --c: #2a2d33; } .wbr-tray .mk.g { --c: #1b9e5a; transform: rotate(-3deg); }
.wbr-tray .eraser { width: 70px; height: 20px; border-radius: 4px; background: linear-gradient(180deg, #2c3e66 0 58%, #6b6f78 58%); box-shadow: 0 3px 4px rgba(0,0,0,.35); }
.wbr-tray-ctl { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #1e2026; }
.wbr-tray-ctl .eye { color: #2a2d33; }
.wbr-tray-ctl .seg { background: rgba(255,255,255,.55); border-color: rgba(0,0,0,.15); }
.wbr-tray-ctl .seg button { color: #2a2d33; }
.wbr-tray-ctl .seg button.on { background: #2a2d33; color: #fff; }
.wbr-tray-ctl .btn { background: #fffdf6; color: #23252b; border-color: rgba(0,0,0,.25); }
.wbroom .wbr-pty { right: max(12px, calc(50vw - 760px)); bottom: 26px; z-index: 4; }
@media (max-width: 1400px) { .wbroom .wbr-pty { display: none; } }
@media (max-width: 700px) {
  .wbroom { padding: 52px 10px 46px; }
  .wbr-frame { padding: 6px; } .wbr-surface { padding: 12px 10px; }
  .wbr-title { font-size: 22px; }
  .wbr-tabs { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; } .wbr-tabs button { font-size: 16px; white-space: nowrap; }
  .wbr-jump { margin-left: 0; width: 100%; } .wbr-jump select { flex: 1; max-width: none; }
  .wbr-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
  .wbr-tray .mk, .wbr-tray .eraser { display: none; }
  .wbr-tray-ctl { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .wbr-card { animation: none; } }
`;
