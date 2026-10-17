"use client";
// Every state legislative district in the country on one map, house or senate, colored by the forecast.
// The district shapes are estimates drawn from where each district's voters are, not the official lines.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RATE } from "@/app/lib/opp";
import { districtFill, MODE_LABEL, type LegisMode } from "./legisColor";
import "./usl.css";

export type USChamber = {
  id: string; st: string; chamber: "house" | "senate"; name: string; demControl: number;
  d: [string, number, number | null, number | null, (string | null)?][]; holdD?: [string, string][];
};
type USMap = { frame: [number, number]; chambers: Record<string, Record<string, string>> };
type GeoStates = { frame: [number, number]; states: Record<string, string> };

const cache = new Map<string, Promise<unknown>>();
const getJson = <T,>(u: string) => { if (!cache.has(u)) cache.set(u, fetch(u).then((r) => r.json())); return cache.get(u) as Promise<T>; };
const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const cssVar = (el: Element, v: string, fb: string) => getComputedStyle(el).getPropertyValue(v).trim() || fb;

type Cell = { key: string; ch: USChamber; d: string; seats: number; p: number | null; m: number | null; last: string | null; hold?: string; path: Path2D; bb: [number, number, number, number] };

function bboxOf(s: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const re = /(-?\d+\.?\d*),(-?\d+\.?\d*)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

export default function USLegisMap({ chambers, height }: { chambers: USChamber[]; height?: number }) {
  const router = useRouter();
  const wrap = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const [W, setW] = useState(0);
  const [map, setMap] = useState<USMap | null>(null);
  const [geo, setGeo] = useState<GeoStates | null>(null);
  const [which, setWhich] = useState<"house" | "senate">("house");
  const [mode, setMode] = useState<LegisMode>("odds");
  const [hover, setHover] = useState<{ c: Cell; x: number; y: number } | null>(null);
  // zoom and pan, in screen pixels: screen = view.s * k * frame + (view.x, view.y)
  const [view, setView] = useState({ s: 1, x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);

  useEffect(() => { getJson<USMap>("/forecast/statehouse_map_us.json").then(setMap).catch(() => {}); getJson<GeoStates>("/forecast/geo.json").then(setGeo).catch(() => {}); }, []);
  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.floor(e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const cells = useMemo<Cell[]>(() => {
    if (!map) return [];
    const out: Cell[] = [];
    for (const ch of chambers) {
      if (ch.chamber !== which) continue;
      const paths = map.chambers[ch.id] ?? {};
      const row = new Map(ch.d.map((x) => [x[0], x]));
      const hold = new Map(ch.holdD ?? []);
      for (const [d, s] of Object.entries(paths)) {
        if (!s) continue;
        const r = row.get(d);
        out.push({ key: `${ch.id}:${d}`, ch, d, seats: r?.[1] ?? 1, p: r ? r[2] : null, m: r ? r[3] : null, last: (r?.[4] as string | null) ?? null, hold: r ? undefined : hold.get(d) ?? "O", path: new Path2D(s), bb: bboxOf(s) });
      }
    }
    return out;
  }, [map, chambers, which]);

  const frame = map?.frame ?? [1950, 1220];
  const k = W ? W / frame[0] : 1;
  const H = Math.round(frame[1] * k);
  const states = useMemo(() => (geo ? Object.entries(geo.states).map(([st, d]) => ({ st, path: new Path2D(d) })) : []), [geo]);
  const upStates = useMemo(() => new Set(chambers.filter((c) => c.chamber === which).map((c) => c.st)), [chambers, which]);
  const stats = useMemo(() => {
    const cs = chambers.filter((c) => c.chamber === which);
    let seats = 0, dFav = 0, flipD = 0, flipR = 0;
    for (const c of cs) for (const x of c.d) {
      seats += x[1];
      if ((x[2] ?? 0) > 0.5) dFav += x[1];
      if (x[4] === "R" && (x[2] ?? 0) > 0.5) flipD += x[1];
      if (x[4] === "D" && (x[2] ?? 1) < 0.5) flipR += x[1];
    }
    return { chambers: cs.length, seats, dFav, flipD, flipR };
  }, [chambers, which]);

  const base = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = cv.current;
    if (!c || !W || !map) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    c.width = W * dpr; c.height = H * dpr; c.style.height = `${H}px`;
    const off = base.current ?? (base.current = document.createElement("canvas"));
    off.width = W * dpr; off.height = H * dpr;
    const ctx = off.getContext("2d")!;
    const bg = cssVar(c, "--bg", "#000"), line = cssVar(c, "--line2", "rgba(255,255,255,.16)");
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, off.width, off.height);
    const ks = k * view.s;
    ctx.setTransform(dpr * ks, 0, 0, dpr * ks, dpr * view.x, dpr * view.y);
    // hatch for states with no race in this chamber and for seats not up this year
    const hatch = (col: string, base: string) => {
      const p = document.createElement("canvas"); p.width = p.height = 8;
      const g = p.getContext("2d")!; g.fillStyle = base; g.fillRect(0, 0, 8, 8); g.strokeStyle = col; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 8); g.lineTo(8, 0); g.moveTo(-2, 2); g.lineTo(2, -2); g.moveTo(6, 10); g.lineTo(10, 6); g.stroke();
      return ctx.createPattern(p, "repeat")!;
    };
    const none = hatch("rgba(140,130,160,.28)", "rgba(140,130,160,.05)");
    const holdP = { D: hatch("rgba(61,123,255,.55)", "rgba(61,123,255,.10)"), R: hatch("rgba(255,59,92,.55)", "rgba(255,59,92,.10)"), O: hatch("rgba(183,140,255,.5)", "rgba(183,140,255,.1)") } as Record<string, CanvasPattern>;
    ctx.save(); ctx.scale(2, 2);
    for (const s of states) { ctx.fillStyle = upStates.has(s.st) ? "rgba(140,130,160,.10)" : none; ctx.fill(s.path); }
    ctx.restore();
    for (const cl of cells) {
      ctx.fillStyle = cl.hold ? holdP[cl.hold] ?? holdP.O : districtFill(mode, cl.p, cl.m, cl.last);
      ctx.fill(cl.path);
    }
    ctx.strokeStyle = bg; ctx.lineWidth = Math.max(0.25 / view.s, 0.7 / ks); ctx.globalAlpha = 0.8;
    for (const cl of cells) ctx.stroke(cl.path);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.scale(2, 2); ctx.strokeStyle = line; ctx.lineWidth = 1.2 / (ks * 2);
    for (const s of states) ctx.stroke(s.path);
    ctx.restore();
    const vis = c.getContext("2d")!; vis.setTransform(1, 0, 0, 1, 0, 0); vis.clearRect(0, 0, c.width, c.height); vis.drawImage(off, 0, 0);
  }, [W, H, k, map, cells, states, upStates, mode, frame, view]);
  useEffect(() => {
    const c = cv.current, off = base.current;
    if (!c || !off || !W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const vis = c.getContext("2d")!;
    vis.setTransform(1, 0, 0, 1, 0, 0); vis.clearRect(0, 0, c.width, c.height); vis.drawImage(off, 0, 0);
    if (hover) { const ks = k * view.s; vis.setTransform(dpr * ks, 0, 0, dpr * ks, dpr * view.x, dpr * view.y); vis.strokeStyle = cssVar(c, "--hi", "#fff"); vis.lineWidth = 2.2 / ks; vis.stroke(hover.c.path); }
  }, [hover, W, k, view]);
  const zoomAt = (f: number, px: number, py: number) => setView((v) => {
    const s2 = Math.max(1, Math.min(14, v.s * f));
    if (s2 === 1) return { s: 1, x: 0, y: 0 };
    const r = s2 / v.s;
    return clampView({ s: s2, x: px - (px - v.x) * r, y: py - (py - v.y) * r });
  });
  const clampView = (v: { s: number; x: number; y: number }) => {
    const mw = W * v.s, mh = H * v.s;
    return { s: v.s, x: Math.min(0, Math.max(W - mw, v.x)), y: Math.min(0, Math.max(H - mh, v.y)) };
  };
  useEffect(() => { setView({ s: 1, x: 0, y: 0 }); }, [W]);

  // hit testing runs in map coordinates on a canvas the size of the map frame
  const probe = useMemo(() => {
    if (typeof document === "undefined") return null;
    const pc = document.createElement("canvas"); pc.width = frame[0]; pc.height = frame[1];
    return pc.getContext("2d");
  }, [frame]);
  const hit = (e: React.MouseEvent): Cell | null => {
    if (!cv.current || !probe) return null;
    const b = cv.current.getBoundingClientRect();
    const fx = (e.clientX - b.left - view.x) / (k * view.s), fy = (e.clientY - b.top - view.y) / (k * view.s);
    for (const cl of cells) {
      const [x0, y0, x1, y1] = cl.bb;
      if (fx < x0 || fx > x1 || fy < y0 || fy > y1) continue;
      if (probe.isPointInPath(cl.path, fx, fy)) return cl;
    }
    return null;
  };

  const tipLeft = hover ? Math.min(hover.x + 14, (typeof window !== "undefined" ? window.innerWidth : 1200) - 260) : 0;
  return (
    <div className="usl">
      <div className="usl-bar">
        <div className="seg" aria-label="Chamber">
          <button className={which === "house" ? "on" : ""} onClick={() => setWhich("house")}>State houses</button>
          <button className={which === "senate" ? "on" : ""} onClick={() => setWhich("senate")}>State senates</button>
        </div>
        <div className="seg" aria-label="Color by">
          {(["odds", "margin", "flips"] as LegisMode[]).map((m) => <button key={m} className={mode === m ? "on" : ""} onClick={() => setMode(m)}>{MODE_LABEL[m]}</button>)}
        </div>
        <div className="usl-stats">
          <span><b className="mono">{stats.seats.toLocaleString()}</b> seats up in {stats.chambers} chambers</span>
          <span><b className="mono d">{stats.dFav.toLocaleString()}</b> favor Democrats</span>
          <span><b className="mono d">{stats.flipD}</b> flip to D</span>
          <span><b className="mono r">{stats.flipR}</b> flip to R</span>
        </div>
      </div>
      <div ref={wrap} className="usl-stage" style={height ? { maxWidth: height * (frame[0] / frame[1]) } : undefined}>
        {!map ? <div className="usl-loading">Drawing {which === "house" ? "every state house" : "every state senate"} district</div> : null}
        <canvas ref={cv} style={{ width: "100%", display: "block", touchAction: view.s > 1 ? "none" : "auto" }} role="img" aria-label={`Every state ${which} district on the 2026 ballot, colored by ${MODE_LABEL[mode].toLowerCase()}`}
          onMouseDown={(e) => { drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false }; }}
          onMouseUp={() => { setTimeout(() => { drag.current = null; }, 0); }}
          onMouseMove={(e) => {
            const dr = drag.current;
            if (dr && e.buttons === 1 && view.s > 1) {
              const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
              if (Math.abs(dx) + Math.abs(dy) > 4) dr.moved = true;
              if (dr.moved) { setHover(null); setView((v) => clampView({ s: v.s, x: dr.vx + dx, y: dr.vy + dy })); if (cv.current) cv.current.style.cursor = "grabbing"; return; }
            }
            const c = hit(e); setHover(c ? { c, x: e.clientX, y: e.clientY } : null); if (cv.current) cv.current.style.cursor = c ? "pointer" : view.s > 1 ? "grab" : "default";
          }}
          onMouseLeave={() => { setHover(null); drag.current = null; }}
          onDoubleClick={(e) => { const b = cv.current!.getBoundingClientRect(); zoomAt(2.2, e.clientX - b.left, e.clientY - b.top); }}
          onClick={(e) => { if (drag.current?.moved || e.detail > 1) return; const c = hit(e); if (c) router.push(`/forecast/legislatures/${c.ch.st.toLowerCase()}/${c.ch.chamber}#d-${encodeURIComponent(c.d)}`); }} />
        {map ? (
          <div className="usl-zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => zoomAt(1.8, W / 2, H / 2)} aria-label="Zoom in">+</button>
            <button type="button" onClick={() => zoomAt(1 / 1.8, W / 2, H / 2)} aria-label="Zoom out">&minus;</button>
            {view.s > 1 ? <button type="button" className="txt" onClick={() => setView({ s: 1, x: 0, y: 0 })}>Reset</button> : null}
            <div className="usl-regions">
              {([["Northeast", 0.84, 0.3, 3.2], ["Great Lakes", 0.64, 0.33, 2.8], ["Southeast", 0.76, 0.66, 2.6], ["Texas", 0.46, 0.8, 2.6], ["West", 0.16, 0.45, 2.1]] as [string, number, number, number][]).map(([n, fx, fy, s2]) => (
                <button key={n} type="button" className="txt" onClick={() => setView(clampView({ s: s2, x: W / 2 - fx * W * s2, y: H / 2 - fy * H * s2 }))}>{n}</button>
              ))}
            </div>
          </div>
        ) : null}
        {view.s === 1 && map ? <div className="usl-hint">Double click to zoom · drag to move</div> : null}
      </div>
      <div className="usl-legend">
        {mode === "odds" ? (
          <span className="usl-ramp"><b>Democrats favored</b>{[RATE.safeD, RATE.likelyD, RATE.leanD, RATE.toss, RATE.leanR, RATE.likelyR, RATE.safeR].map((c) => <i key={c} style={{ background: c }} />)}<b>Republicans favored</b></span>
        ) : mode === "margin" ? (
          <span className="usl-ramp"><b>D +40</b><i className="wide" style={{ background: "linear-gradient(90deg,#10288c,#3d7bff,#d6e2ff,#ffdce4,#ff3b5c,#8c0a28)" }} /><b>R +40</b></span>
        ) : (
          <span className="usl-ramp"><i style={{ background: "#3d7bff" }} /><b>Flips to Democrats</b><i style={{ background: "#ff3b5c" }} /><b>Flips to Republicans</b><i style={{ background: "rgba(140,130,160,.3)" }} /><b>Held</b></span>
        )}
        <span className="usl-note"><i className="hatch" />Not up in 2026 or no partisan race · District shapes are estimated from where each district&apos;s voters are</span>
      </div>
      {hover ? (
        <div className="hub-tip usl-tip" style={{ left: tipLeft, top: hover.y + 14 }}>
          <div className="eye">{hover.c.ch.name}</div>
          <b>District {hover.c.d}{hover.c.seats > 1 ? ` · ${hover.c.seats} seats` : ""}</b>
          {hover.c.hold ? <div className="hub-tip-row"><span style={{ color: "var(--mute)" }}>Not on the 2026 ballot, held by {hover.c.hold === "D" ? "Democrats" : hover.c.hold === "R" ? "Republicans" : "another party"}</span></div> : (
            <>
              <div className="hub-tip-row"><span className="d mono">D {pct(hover.c.p ?? 0)}</span>{hover.c.m != null && Math.abs(hover.c.m) < 99 ? <span className={`mono ${hover.c.m < 0 ? "d" : "r"}`}>{hover.c.m < 0 ? "D" : "R"} +{Math.abs(hover.c.m).toFixed(1)}</span> : <span style={{ color: "var(--mute)" }}>Unopposed</span>}<span className="r mono">R {pct(1 - (hover.c.p ?? 0))}</span></div>
              <i className="hub-tip-bar"><s style={{ width: `${(hover.c.p ?? 0) * 100}%` }} /></i>
              {hover.c.last ? <div className="hub-tip-row"><span style={{ color: "var(--mute)" }}>Won last time by {hover.c.last === "D" ? "Democrats" : hover.c.last === "R" ? "Republicans" : "another party"}</span></div> : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
