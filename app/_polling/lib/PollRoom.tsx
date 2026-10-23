"use client";

/**
 * PollRoom: the way into every polling average, drawn as an analyst's room. A dry erase
 * whiteboard fills the wall under a picture light. Tabs written across the top switch between
 * the House, Senate, governor, national and archive averages; map groups draw the marker map
 * with every race in a list beside it, other groups show sticky notes. The page that opens an
 * average writes that average on the same board, below the line.
 */

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import StateRaceMap, { INK, type MapRow } from "./StateRaceMap";
import { Pointy } from "@/app/components/home/Mascot";

export type RoomItem = { id: string; label: string; value: string; color: string; spark: number[]; n: number; last?: string | null; href?: string; sub?: string; st?: string; margin?: number | null; fresh?: number };

const FONT_HREF = "https://fonts.googleapis.com/css2?family=Kalam:wght@400;700&family=Permanent+Marker&display=swap";
const NOTE = ["#fff3a6", "#ffd9e4", "#d7f0ff", "#dff7cf", "#ffe2bf"];

export function inkOf(color: string) {
  const c = (color || "").toLowerCase();
  if (c.includes("dem")) return INK.D;
  if (c.includes("gop") || c.includes("rep")) return INK.R;
  if (c.includes("disapprove")) return "#b0306a";
  if (c.includes("approve")) return "#13804a";
  if (c.includes("7a4bb0") || c.includes("purple")) return INK.I;
  if (c.startsWith("#")) return color;
  return INK[""];
}

function Spark({ data, color, h = 26 }: { data: number[]; color: string; h?: number }) {
  if (data.length < 2) return <svg className="wbr-spark" aria-hidden style={{ height: h }} />;
  const w = 100;
  const lo = Math.min(...data), hi = Math.max(...data), span = hi - lo || 1;
  const d = data.map((v, i) => `${i ? "L" : "M"}${((i / (data.length - 1)) * w).toFixed(1)},${(h - 2 - ((v - lo) / span) * (h - 4)).toFixed(1)}`).join("");
  return <svg className="wbr-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ height: h }} aria-hidden><path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" /></svg>;
}

function Item({ it, onPick, active, className, children, style }: { it: RoomItem; onPick?: (id: string) => void; active: boolean; className: string; children: React.ReactNode; style?: React.CSSProperties }) {
  const cls = `${className}${active ? " on" : ""}`;
  if (it.href && (!onPick || it.href.startsWith("/forecast"))) return <Link href={it.href} className={cls} style={style}>{children}</Link>;
  return <button type="button" className={cls} style={style} onClick={() => onPick?.(it.id)}>{children}</button>;
}

export default function PollRoom({
  groups, group, onGroup, items, allItems, activeId, onPick, mapRows, office, onMapPick, notes = true, listTitle, active, tray, children, intro,
}: {
  groups: { id: string; label: string; count: number }[];
  group: string;
  onGroup: (g: string) => void;
  items: RoomItem[];
  allItems: { id: string; label: string; group: string; href?: string }[];
  activeId: string;
  onPick?: (id: string) => void;
  mapRows: MapRow[];
  office: string | null;
  onMapPick?: (id: string) => void;
  notes?: boolean;
  listTitle?: string;
  active: { title: string; value: string; color: string; polls: number } | null;
  tray?: React.ReactNode;
  children?: React.ReactNode;
  intro?: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"close" | "polls" | "az">("close");
  const [stFilter, setStFilter] = useState<string | null>(null);
  useEffect(() => {
    if (typeof document === "undefined" || document.querySelector("link[data-wb-font]")) return;
    const l = document.createElement("link");
    l.rel = "stylesheet"; l.href = FONT_HREF; l.setAttribute("data-wb-font", "1");
    document.head.appendChild(l);
  }, []);
  useEffect(() => { import("./usStatePaths").catch(() => {}); }, []);
  useEffect(() => { setStFilter(null); setQ(""); }, [group]);

  const showMap = !!office;
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const rows = items.filter((x) => (!stFilter || x.st === stFilter) && (!t || `${x.label} ${x.sub ?? ""} ${x.st ?? ""}`.toLowerCase().includes(t)));
    const m = (x: RoomItem) => (x.margin == null ? 999 : Math.abs(x.margin));
    return [...rows].sort((a, b) => sort === "close" ? m(a) - m(b) : sort === "polls" ? b.n - a.n : a.label.localeCompare(b.label));
  }, [items, q, sort, stFilter]);

  const pickMap = (id: string) => {
    if (onMapPick) { onMapPick(id); const st = mapRows.find((r) => r.id === id)?.abbr ?? null; setStFilter((s) => (s === st ? null : st)); return; }
    const it = items.find((x) => x.id === id);
    if (onPick) onPick(id); else if (it?.href && typeof window !== "undefined") window.location.href = it.href;
  };
  const jump = (id: string) => {
    const x = allItems.find((a) => a.id === id);
    if (onPick && !x?.href?.startsWith("/forecast")) onPick(id); else if (x?.href && typeof window !== "undefined") window.location.href = x.href;
  };

  return (
    <section className="wbroom" aria-label="Find a polling average">
      <style>{CSS}</style>
      <div className="wbr-wall" aria-hidden="true" />
      <div className="wbr-lamp" aria-hidden="true"><i className="arm" /><i className="bar" /><i className="glow" /></div>
      <div className="wbr-board">
        <div className="wbr-frame">
          <div className="wbr-surface">
            {intro ? <div className="wbr-intro">{intro}</div> : null}
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
                <select value={allItems.some((x) => x.id === activeId) ? activeId : ""} onChange={(e) => e.target.value && jump(e.target.value)} aria-label="Jump to any average">
                  {!allItems.some((x) => x.id === activeId) ? <option value="">Pick a race</option> : null}
                  {groups.map((g) => (
                    <optgroup key={g.id} label={g.label}>
                      {allItems.filter((x) => x.group === g.id).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </label>
            </div>

            <div className={`wbr-body${showMap ? " map" : ""}`}>
              {showMap ? (
                <div className="wbr-map">
                  <p className="wbr-how">{onMapPick ? "Tap a state to list its polled districts. Colour is the district polling average, closest first." : "Tap a state, a sticky note or a race in the list. Colour is the current On Point average: pale when close, deep when safe."}</p>
                  <StateRaceMap rows={mapRows} activeId={onMapPick ? (stFilter ? mapRows.find((r) => r.abbr === stFilter)?.id ?? "" : "") : activeId} onPick={pickMap} office={office!} notes={notes} hint={onMapPick ? "Click to list its districts" : "Click to open this average"} />
                </div>
              ) : null}
              <div className={`wbr-list${showMap ? "" : " wide"}`}>
                <div className="wbr-lh">
                  <b>{listTitle ?? "Every race"}{stFilter ? <> in {stFilter} <button type="button" className="wbr-x" onClick={() => setStFilter(null)} aria-label="Show every state">erase</button></> : null}</b>
                  <span>{list.length}</span>
                </div>
                <div className="wbr-tools">
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a state, race or candidate" aria-label="Find a race" />
                  <div className="wbr-sort">{([["close", "Closest"], ["polls", "Most polls"], ["az", "A to Z"]] as const).map(([k, l]) => <button key={k} type="button" className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}</div>
                </div>
                {showMap ? (
                  <ol className="wbr-rows">
                    {list.map((it) => {
                      const ink = inkOf(it.color);
                      return (
                        <li key={it.id}>
                          <Item it={it} onPick={onPick} active={it.id === activeId} className="wbr-row">
                            {it.st ? <span className="st">{it.st}</span> : null}
                            <span className="nm"><b>{it.label}</b>{it.sub ? <small>{it.sub}</small> : null}</span>
                            <span className="v" style={{ color: ink }}>{it.value || "…"}</span>
                            <Spark data={it.spark} color={ink} h={18} />
                            <span className="n">{it.n ? `${it.n} polls` : ""}{it.fresh ? <em> · {it.fresh} new</em> : null}</span>
                          </Item>
                        </li>
                      );
                    })}
                    {!list.length ? <li className="wbr-empty">Nothing written here yet.</li> : null}
                  </ol>
                ) : (
                  <div className="wbr-cards">
                    {list.map((it, i) => {
                      const ink = inkOf(it.color);
                      return (
                        <Item key={it.id} it={it} onPick={onPick} active={it.id === activeId} className="wbr-card"
                          style={{ "--rot": `${[-1.6, 1.1, -0.8, 1.5, -1.1, 0.7][i % 6]}deg`, "--ink": ink, "--note": NOTE[i % NOTE.length], animationDelay: `${Math.min(i, 24) * 30}ms` } as React.CSSProperties}>
                          <span className="t">{it.label}</span>
                          <span className="v">{it.value || "…"}</span>
                          <Spark data={it.spark} color={ink} />
                          <span className="s">{it.n ? `${it.n} polls` : ""}{it.fresh ? ` · ${it.fresh} new` : ""}</span>
                        </Item>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {active && active.value ? (
              <div className="wbr-now" aria-live="polite">
                <span className="lbl">Below the line</span>
                <b>{active.title}</b>
                <span className="v" style={{ color: inkOf(active.color) }}>{active.value}</span>
                <span className="n">{active.polls} polls</span>
              </div>
            ) : null}
            {children ? <div className="wbr-below">{children}</div> : null}
          </div>
        </div>
        <div className="wbr-tray">
          <span className="mk b" aria-hidden="true" /><span className="mk r" aria-hidden="true" /><span className="mk k" aria-hidden="true" /><span className="mk g" aria-hidden="true" />
          <span className="eraser" aria-hidden="true" />
          {tray ? <div className="wbr-tray-ctl">{tray}</div> : null}
        </div>
      </div>
      <div className="wbr-floor" aria-hidden="true" />
      {active && active.value ? (
        <Pointy className="wbr-pty" pose="point" prop="pointer" size={92} flip
          say={<><b>{active.value}</b><br /><span style={{ opacity: .8 }}>{active.polls} polls in the average</span></>} />
      ) : null}
    </section>
  );
}

const CSS = `
.wbroom { --font-mark: "Permanent Marker", "Marker Felt", "Comic Sans MS", cursive; --font-hand: "Kalam", "Segoe Print", "Bradley Hand", "Comic Sans MS", cursive;
  position: relative; isolation: isolate; margin: 0 calc(50% - 50vw) 0; padding: 50px max(16px, calc(50vw - 50%)) 54px; min-height: calc(100vh - 110px); overflow: hidden; }
.wbr-wall { position: absolute; inset: 0; z-index: -2;
  background: radial-gradient(60% 40% at 50% 0%, rgba(255,214,150,.16), transparent 70%), repeating-linear-gradient(90deg, rgba(255,255,255,.018) 0 1px, transparent 1px 160px), linear-gradient(180deg, #2b2733 0%, #26222d 70%, #1e1b24 100%); }
.wbr-floor { position: absolute; left: 0; right: 0; bottom: 0; height: 40px; z-index: -1;
  background: linear-gradient(180deg, #4b3a2c 0 6px, #2c2119 6px 9px, transparent 9px), repeating-linear-gradient(90deg, #3a2b20 0 120px, #34261c 120px 240px); box-shadow: inset 0 10px 18px rgba(0,0,0,.45); }
.wbr-lamp { position: absolute; left: 50%; top: -8px; width: min(520px, 56vw); height: 58px; transform: translateX(-50%); pointer-events: none; z-index: 3; }
.wbr-lamp .arm { position: absolute; left: 50%; top: 0; width: 6px; height: 30px; transform: translateX(-50%); background: linear-gradient(90deg, #7a6440, #c9a86a, #7a6440); border-radius: 3px; }
.wbr-lamp .bar { position: absolute; left: 10%; right: 10%; top: 26px; height: 16px; border-radius: 8px 8px 12px 12px; background: linear-gradient(180deg, #d6b778, #8c7346); box-shadow: 0 6px 14px rgba(0,0,0,.45); }
.wbr-lamp .glow { position: absolute; left: 12%; right: 12%; top: 40px; height: 6px; border-radius: 3px; background: #fff3cf; box-shadow: 0 0 22px 8px rgba(255,226,160,.55); }
.wbr-board { position: relative; width: 100%; max-width: 1900px; margin: 0 auto; }
.wbr-board::before { content: ""; position: absolute; left: -10%; right: -10%; top: -70px; height: 60%; z-index: -1; pointer-events: none; background: radial-gradient(50% 55% at 50% 0%, rgba(255,222,160,.28), rgba(255,222,160,.08) 55%, transparent 75%); }
.wbr-frame { position: relative; padding: 10px; border-radius: 10px; background: linear-gradient(180deg, #d9dde3, #9aa1ab 50%, #c4c9d0); box-shadow: 0 30px 60px -28px rgba(0,0,0,.85), 0 2px 0 rgba(255,255,255,.4) inset; }
.wbr-surface { --ink: #1f2127; --ink2: #454852; --mute: #6b6f78; --hi: #14161b; position: relative; border-radius: 4px; padding: 18px 22px 18px; color: #23252b; overflow: hidden;
  background: radial-gradient(80% 50% at 50% 0%, rgba(255,246,222,.75), rgba(255,246,222,0) 70%), linear-gradient(112deg, transparent 58%, rgba(255,255,255,.28) 66%, transparent 74%), radial-gradient(120% 120% at 50% 10%, #efeee8 40%, #dedcd3 100%);
  box-shadow: inset 0 0 0 1px rgba(0,0,0,.08), inset 0 -30px 60px rgba(0,0,0,.05); }
.wbr-intro { margin: 0 0 8px; }
.wbr-intro h1 { margin: 0; font: 400 clamp(30px, 3.4vw, 52px)/1.05 var(--font-mark); color: #1f57c8; transform: rotate(-.8deg); transform-origin: left; }
.wbr-intro h1 em { font-style: normal; color: #d3243c; }
.wbr-intro p { margin: 6px 0 0; max-width: 820px; font: 400 17px/1.35 var(--font-hand); color: #3d4048; }
.wbr-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 18px; }
.wbr-title { font: 400 28px/1 var(--font-mark); color: #1f57c8; transform: rotate(-1.5deg); }
.wbr-tabs { display: flex; flex-wrap: wrap; gap: 4px 6px; }
.wbr-tabs button { appearance: none; border: 0; background: none; cursor: pointer; padding: 4px 10px 6px; font: 700 19px/1.1 var(--font-hand); color: #34373e; position: relative; border-radius: 6px; }
.wbr-tabs button small { font: 700 10px var(--font-m); margin-left: 5px; color: #7a7e86; }
.wbr-tabs button:hover { background: rgba(31,87,200,.07); }
.wbr-tabs button.on { color: #c21f37; }
.wbr-tabs button.on::after { content: ""; position: absolute; left: 8px; right: 8px; bottom: 1px; height: 4px; border-radius: 3px; background: rgba(194,31,55,.75); transform: rotate(-1deg); }
.wbr-tabs button:focus-visible { outline: 2px solid #1f57c8; outline-offset: 1px; }
.wbr-jump { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; font: 700 15px var(--font-hand); color: #34373e; }
.wbr-jump span { white-space: nowrap; }
.wbr-jump select { max-width: 260px; font: 600 13px var(--font-b); color: #23252b; background: #fffdf6; border: 2px solid #2a2d33; border-radius: 8px; padding: 6px 10px; }
.wbr-how { margin: 4px 0 2px; font: 400 15px/1.35 var(--font-hand); color: #50545c; }
.wbr-body { display: grid; grid-template-columns: 1fr; gap: 18px; margin-top: 6px; }
.wbr-body.map { grid-template-columns: minmax(0, 1fr) minmax(300px, 400px); align-items: start; }
.wbr-map { min-width: 0; --wbm-max: calc(100vh - 250px); }
.wbr-list { min-width: 0; display: flex; flex-direction: column; max-height: calc(100vh - 210px); border-left: 2px dashed rgba(42,45,51,.18); padding-left: 16px; }
.wbr-list.wide { max-height: none; border-left: 0; padding-left: 0; }
.wbr-lh { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.wbr-lh b { font: 400 20px var(--font-mark); color: #2a2d33; } .wbr-lh span { font: 700 12px var(--font-m); color: #6b6f78; }
.wbr-x { appearance: none; border: 0; background: none; color: #c21f37; font: 700 14px var(--font-hand); text-decoration: underline; cursor: pointer; margin-left: 6px; }
.wbr-tools { display: grid; gap: 6px; margin: 8px 0 6px; }
.wbr-tools input { font: 700 15px var(--font-hand); color: #23252b; background: transparent; border: 0; border-bottom: 2px solid #2a2d33; padding: 6px 2px; outline: none; }
.wbr-tools input::placeholder { color: #8a8d94; }
.wbr-sort { display: flex; gap: 4px; flex-wrap: wrap; }
.wbr-sort button { appearance: none; border: 0; background: none; cursor: pointer; font: 700 14px var(--font-hand); color: #50545c; padding: 2px 8px; border-radius: 5px; }
.wbr-sort button.on { color: #1f57c8; background: rgba(31,87,200,.09); }
.wbr-rows { list-style: none; margin: 0; padding: 0 4px 0 0; overflow-y: auto; flex: 1; scrollbar-width: thin; }
.wbr-row { display: grid; grid-template-columns: 32px minmax(0, 1fr) auto; grid-template-areas: "st nm v" "st sp n"; gap: 0 10px; align-items: center; padding: 7px 6px; border-bottom: 1px dashed rgba(42,45,51,.16); color: inherit; text-decoration: none; width: 100%; text-align: left; background: none; border-top: 0; border-left: 0; border-right: 0; cursor: pointer; font: inherit; border-radius: 6px; }
.wbr-row:hover, .wbr-row:focus-visible { background: rgba(255,214,80,.2); outline: none; }
.wbr-row.on { background: rgba(27,158,90,.12); }
.wbr-row .st { grid-area: st; font: 800 11px var(--font-m); color: #2a2d33; border: 2px solid #2a2d33; border-radius: 6px; text-align: center; padding: 2px 0; }
.wbr-row .nm { grid-area: nm; min-width: 0; } .wbr-row .nm b { display: block; font: 700 15px/1.15 var(--font-hand); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; } .wbr-row .nm small { display: block; font: 600 10.5px var(--font-m); color: #6b6f78; }
.wbr-row .v { grid-area: v; font: 700 18px var(--font-hand); white-space: nowrap; }
.wbr-row .wbr-spark { grid-area: sp; width: 100%; height: 18px; }
.wbr-row .n { grid-area: n; font: 600 10px var(--font-m); color: #6b6f78; white-space: nowrap; } .wbr-row .n em { font-style: normal; color: #1b9e5a; font-weight: 800; }
.wbr-empty { padding: 18px 4px; font: 400 16px var(--font-hand); color: #6b6f78; }
.wbr-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 18px 16px; padding: 10px 2px 6px; }
.wbr-card { position: relative; display: grid; gap: 2px; text-align: left; padding: 16px 14px 12px; border: 0; cursor: pointer; color: #23252b; text-decoration: none; font: inherit;
  background: var(--note); box-shadow: 0 10px 16px -12px rgba(0,0,0,.55), 0 1px 0 rgba(0,0,0,.05); clip-path: polygon(0 0, 100% 0, 100% 88%, 92% 100%, 0 100%); transform: rotate(var(--rot)); transition: transform .2s, box-shadow .2s; animation: wb-drop .45s cubic-bezier(.2,1.2,.4,1) both; }
.wbr-card:hover, .wbr-card:focus-visible { transform: rotate(0) translateY(-2px) scale(1.02); outline: none; }
.wbr-card.on { box-shadow: 0 0 0 3px #1b9e5a, 0 10px 18px -12px rgba(0,0,0,.6); }
.wbr-card .t { font: 700 16px/1.15 var(--font-hand); }
.wbr-card .v { font: 700 25px/1.1 var(--font-hand); color: var(--ink); }
.wbr-card .s { font: 600 9.5px var(--font-m); letter-spacing: .06em; text-transform: uppercase; color: #5f5a48; }
.wbr-spark { display: block; width: 100%; }
.wbr-now { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; margin-top: 14px; padding-top: 12px; border-top: 3px solid rgba(42,45,51,.55); border-image: none; }
.wbr-now .lbl { font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: #6b6f78; }
.wbr-now b { font: 400 20px var(--font-mark); }
.wbr-now .v { font: 700 22px var(--font-hand); }
.wbr-now .n { margin-left: auto; font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: #6b6f78; }
.wbr-below { margin-top: 10px; }
.wbr-tray { position: relative; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin: 0 2%; padding: 8px 18px 10px; border-radius: 0 0 8px 8px; background: linear-gradient(180deg, #b8bec6, #8b929c); box-shadow: 0 12px 20px -12px rgba(0,0,0,.8); }
.wbr-tray .mk { display: block; width: 58px; height: 12px; border-radius: 6px 3px 3px 6px; background: linear-gradient(90deg, var(--c) 0 26%, #f4f4f2 26% 92%, #ddd 92%); box-shadow: 0 2px 2px rgba(0,0,0,.3); }
.wbr-tray .mk.b { --c: #1f57c8; } .wbr-tray .mk.r { --c: #d3243c; transform: rotate(4deg); } .wbr-tray .mk.k { --c: #2a2d33; } .wbr-tray .mk.g { --c: #1b9e5a; transform: rotate(-3deg); }
.wbr-tray .eraser { width: 70px; height: 20px; border-radius: 4px; background: linear-gradient(180deg, #2c3e66 0 58%, #6b6f78 58%); box-shadow: 0 3px 4px rgba(0,0,0,.35); }
.wbr-tray-ctl { margin-left: auto; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: #1e2026; }
.wbr-tray-ctl .eye { color: #2a2d33; }
.wbr-tray-ctl .seg { background: rgba(255,255,255,.55); border-color: rgba(0,0,0,.15); }
.wbr-tray-ctl .seg button { color: #2a2d33; } .wbr-tray-ctl .seg button.on { background: #2a2d33; color: #fff; }
.wbr-tray-ctl .btn { background: #fffdf6; color: #23252b; border-color: rgba(0,0,0,.25); }
.wbroom .wbr-pty { position: absolute; right: 18px; bottom: 30px; z-index: 4; }
@media (max-width: 1500px) { .wbroom .wbr-pty { display: none; } }
@media (max-width: 1100px) { .wbr-body.map { grid-template-columns: 1fr; } .wbr-list { max-height: 520px; border-left: 0; padding-left: 0; border-top: 2px dashed rgba(42,45,51,.18); padding-top: 12px; } .wbr-map { --wbm-max: none; } }
@media (max-width: 700px) {
  .wbroom { padding: 46px 8px 46px; min-height: 0; }
  .wbr-frame { padding: 6px; } .wbr-surface { padding: 12px 10px; }
  .wbr-title { font-size: 22px; }
  .wbr-tabs { flex-wrap: nowrap; overflow-x: auto; max-width: 100%; } .wbr-tabs button { font-size: 16px; white-space: nowrap; }
  .wbr-jump { margin-left: 0; width: 100%; } .wbr-jump select { flex: 1; max-width: none; }
  .wbr-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 10px; }
  .wbr-tray .mk, .wbr-tray .eraser { display: none; }
  .wbr-tray-ctl { margin-left: 0; }
}
@media (prefers-reduced-motion: reduce) { .wbr-card { animation: none; } }
/* light theme: the same board on a pale painted wall over a light oak floor */
html[data-theme="light"] .wbr-wall { background: radial-gradient(60% 40% at 50% 0%, rgba(255,214,150,.30), transparent 70%), repeating-linear-gradient(90deg, rgba(60,40,90,.035) 0 1px, transparent 1px 160px), linear-gradient(180deg, #ebe8f0 0%, #e4e0ea 70%, #d9d4e1 100%); }
html[data-theme="light"] .wbr-floor { background: linear-gradient(180deg, #a98a66 0 6px, #8c6f50 6px 9px, transparent 9px), repeating-linear-gradient(90deg, #d2b48c 0 120px, #c8a97f 120px 240px); box-shadow: inset 0 10px 18px rgba(80,50,20,.25); }
html[data-theme="light"] .wbr-lamp .bar { box-shadow: 0 6px 14px rgba(80,60,30,.3); }
html[data-theme="light"] .wbr-frame { box-shadow: 0 30px 60px -30px rgba(40,20,80,.45), 0 2px 0 rgba(255,255,255,.6) inset; }
`;
