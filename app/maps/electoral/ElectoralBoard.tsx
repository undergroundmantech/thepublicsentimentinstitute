"use client";
// The 2026 map maker, built for making videos as much as for making maps. A palette of nine ratings, Safe, Likely,
// Lean and Tilt for each party plus Toss up; a map you paint by clicking or dragging; a seat chart that counts up as
// you go; undo and redo; and a studio: the map full screen in a 16:9, 9:16 or square frame with your title, a call
// banner for every state you paint, a play the night mode that calls the states in poll closing order, backgrounds
// for green screen, a control dock that hides itself while you record, and a picture of the frame to download.
// The address bar carries the map so it can be shared.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { Pointy } from "@/app/components/home/Mascot";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { ev } from "@/app/lib/ev";
import "./electoral.css";

type Office = "senate" | "governor" | "house";
type Race = { id: string; office: string; st: string; state: string; name: string; dem: string; gop: string; district: number; est: { margin: number; prob: number } };
type Model = { meta: { updated: string; senNotUpD: number; senNotUpR: number; govNotUpD: number; govNotUpR: number }; races: Race[] };
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string } | string>;
  hexStates: Record<string, [number, number]>; hexHouse: Record<string, [number, number]>; hexStatesR: number; hexHouseR: number };
type Board = Record<string, number>;
type Aspect = "16:9" | "9:16" | "1:1";
type Bg = "night" | "day" | "green" | "blue";

// index 0 Safe D … 3 Tilt D, 4 Toss up, 5 Tilt R … 8 Safe R, 9 blank
const BANDS = [
  { k: "Safe D", c: "#1c3fae" }, { k: "Likely D", c: "#3d7bff" }, { k: "Lean D", c: "#8fb0ff" }, { k: "Tilt D", c: "#b9c6e8" },
  { k: "Toss up", c: "#e7b341" },
  { k: "Tilt R", c: "#e9bcc4" }, { k: "Lean R", c: "#ff97a8" }, { k: "Likely R", c: "#ff3b5c" }, { k: "Safe R", c: "#aa1434" },
] as const;
const BLANK = 9, TOSS = 4;
const BLANK_C = "#615a74";
const isD = (i: number) => i < TOSS, isR = (i: number) => i > TOSS && i < BLANK;
const ink = (i: number) => (i === 0 || i === 1 || i === 7 || i === 8 || i === BLANK ? "#fff" : "#16092a");
const fillOf = (v: number) => (v === BLANK ? BLANK_C : BANDS[v].c);
const OFFICES: { key: Office; label: string; total: number; control: number }[] = [
  { key: "senate", label: "Senate", total: 100, control: 51 },
  { key: "governor", label: "Governors", total: 50, control: 26 },
  { key: "house", label: "House", total: 435, control: 218 },
];
const fm = (m: number) => (Math.abs(m) >= 99 ? "Unopposed" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
// when the last polls close in each state, in hours after noon Eastern time, for play the night
const CLOSE: Record<string, number> = {
  GA: 7, VT: 7, VA: 7, SC: 7, IN: 7, KY: 7, NC: 7.5, OH: 7.5, WV: 7.5,
  AL: 8, CT: 8, DE: 8, FL: 8, IL: 8, ME: 8, MD: 8, MA: 8, MS: 8, MO: 8, NH: 8, NJ: 8, OK: 8, PA: 8, RI: 8, TN: 8, TX: 8, DC: 8, AR: 8.5,
  AZ: 9, CO: 9, KS: 9, LA: 9, MI: 9, MN: 9, NE: 9, NM: 9, NY: 9, ND: 9, SD: 9, WI: 9, WY: 9, IA: 9,
  MT: 10, NV: 10, UT: 10, ID: 11, OR: 11, CA: 11, WA: 11, HI: 12, AK: 13,
};
const clockOf = (h: number) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); const H = hh > 12 ? hh - 12 : hh; return `${H}:${String(mm).padStart(2, "0")} ${hh >= 12 && hh < 24 ? (hh === 12 ? "AM" : "AM") : "PM"} ET`; };
const ASPECT: Record<Aspect, number> = { "16:9": 16 / 9, "9:16": 9 / 16, "1:1": 1 };
const BG_LABEL: Record<Bg, string> = { night: "Night", day: "Day", green: "Green screen", blue: "Blue screen" };

function bandOf(r: Race) {
  const m = r.est.margin, a = Math.abs(m);
  if (a < 1) return TOSS;
  const s = a >= 12 ? 0 : a >= 6 ? 1 : a >= 2 ? 2 : 3;
  return m < 0 ? s : 8 - s;
}
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A number that counts to its value. */
function Roll({ v }: { v: number }) {
  const [x, setX] = useState(v); const from = useRef(v);
  useEffect(() => {
    const a = from.current; if (a === v) return; const t0 = performance.now(); let raf = 0;
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 450), e = 1 - Math.pow(1 - k, 3); setX(Math.round(a + (v - a) * e)); if (k < 1) raf = requestAnimationFrame(step); else from.current = v; };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [v]);
  return <>{x}</>;
}

export default function ElectoralBoard() {
  const [model, setModel] = useState<Model | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("senate");
  const [kind, setKind] = useState<"geo" | "hex">("geo");
  const [boards, setBoards] = useState<Partial<Record<Office, Board>>>({});
  const [brush, setBrush] = useState(0);
  const [tip, setTip] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const [labels, setLabels] = useState(true);
  const [banners, setBanners] = useState(true);
  const [call, setCall] = useState<{ id: string; v: number; k: number } | null>(null);
  const [flash, setFlash] = useState<{ id: string; k: number } | null>(null);
  const [studio, setStudio] = useState(false);
  const [aspect, setAspect] = useState<Aspect>("16:9");
  const [bg, setBg] = useState<Bg>("night");
  const [title, setTitle] = useState("");
  const [sub, setSub] = useState("");
  const [idle, setIdle] = useState(false);
  const [dockHidden, setDockHidden] = useState(false);
  const [play, setPlay] = useState<{ order: string[]; i: number; on: boolean; speed: number } | null>(null);
  const [toast, setToast] = useState("");
  const hist = useRef<Partial<Record<Office, { past: Board[]; future: Board[] }>>>({});
  const [, setHv] = useState(0);
  const fromUrl = useRef(false);

  useEffect(() => {
    fetch("/forecast/model.json").then((r) => r.json()).then(setModel).catch(() => {});
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
  }, []);
  const races = useMemo(() => (model ? model.races.filter((r) => r.office === office) : []), [model, office]);
  const ids = useMemo(() => races.map((r) => r.id).sort(), [races]);
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);
  const forecast = useCallback(() => Object.fromEntries(races.map((r) => [r.id, bandOf(r)])) as Board, [races]);
  const board = useMemo(() => boards[office] ?? {}, [boards, office]);
  const cfg = OFFICES.find((o) => o.key === office)!;
  const defTitle = `My 2026 ${office === "governor" ? "governor" : cfg.label} map`;

  // history: one step per stroke or button, so undo takes back a whole drag
  const commit = useCallback(() => {
    const h = (hist.current[office] ??= { past: [], future: [] });
    h.past.push({ ...(boards[office] ?? {}) }); if (h.past.length > 80) h.past.shift(); h.future = []; setHv((x) => x + 1);
  }, [boards, office]);
  const undo = useCallback(() => { const h = hist.current[office]; if (!h?.past.length) return; h.future.push({ ...(boards[office] ?? {}) }); const b = h.past.pop()!; setBoards((o) => ({ ...o, [office]: b })); setHv((x) => x + 1); }, [boards, office]);
  const redo = useCallback(() => { const h = hist.current[office]; if (!h?.future.length) return; h.past.push({ ...(boards[office] ?? {}) }); const b = h.future.pop()!; setBoards((o) => ({ ...o, [office]: b })); setHv((x) => x + 1); }, [boards, office]);
  const setBoard = useCallback((f: (b: Board) => Board) => setBoards((o) => ({ ...o, [office]: f(o[office] ?? {}) })), [office]);

  // start each office from the forecast, or from a shared link the first time
  useEffect(() => {
    if (!races.length || boards[office]) return;
    const b = forecast();
    try {
      const q = new URLSearchParams(window.location.search);
      if (!fromUrl.current) {
        fromUrl.current = true;
        const o = q.get("o") as Office | null;
        if (o && o !== office && OFFICES.some((x) => x.key === o)) { setOffice(o); return; }
        const t = q.get("t"); if (t) setTitle(t.slice(0, 80));
      }
      const packed = q.get(office);
      if (packed && packed.length === ids.length) [...packed].forEach((ch, i) => { const v = parseInt(ch, 10); if (v >= 0 && v <= BLANK) b[ids[i]] = v; });
    } catch { /* no window */ }
    setBoards((o) => ({ ...o, [office]: b }));
  }, [races, ids, office, boards, forecast]);
  useEffect(() => {
    if (!ids.length || !boards[office]) return;
    try { const u = new URL(window.location.href); u.searchParams.set("o", office); u.searchParams.set(office, ids.map((id) => String(boards[office]![id] ?? BLANK)).join("")); if (title) u.searchParams.set("t", title); else u.searchParams.delete("t"); window.history.replaceState(null, "", u.toString()); } catch { /* history unavailable */ }
  }, [boards, office, ids, title]);

  const announce = useCallback((id: string, v: number) => {
    setFlash((f) => ({ id, k: (f?.k ?? 0) + 1 }));
    if (banners && v !== BLANK) setCall((c) => ({ id, v, k: (c?.k ?? 0) + 1 }));
  }, [banners]);
  useEffect(() => { if (!call) return; const t = window.setTimeout(() => setCall(null), 2600); return () => window.clearTimeout(t); }, [call]);
  useEffect(() => { if (!toast) return; const t = window.setTimeout(() => setToast(""), 2400); return () => window.clearTimeout(t); }, [toast]);

  const paint = useCallback((id: string, back = false, force = false) => setBoard((b) => {
    const cur = b[id] ?? BLANK;
    let nv: number;
    if (force || brush === TOSS || brush === BLANK || cur === BLANK || cur === TOSS || isD(brush) !== isD(cur)) nv = brush;
    else { const s = isD(cur) ? cur : 8 - cur, ns = (s + (back ? 3 : 1)) % 4; nv = isD(cur) ? ns : 8 - ns; } // same party: walk Safe, Likely, Lean, Tilt
    if (!force) window.setTimeout(() => announce(id, nv), 0);
    return { ...b, [id]: nv };
  }), [brush, setBoard, announce]);
  const clearOne = (id: string) => { commit(); setBoard((b) => ({ ...b, [id]: BLANK })); };
  const fill = (v: number) => { commit(); setBoard(() => Object.fromEntries(races.map((r) => [r.id, v]))); };
  const useForecast = () => { commit(); setBoard(() => forecast()); };

  // play the night: every race called in the order its state's polls close
  const startPlay = () => {
    const order = races.slice().sort((a, b) => (CLOSE[a.st] ?? 10) - (CLOSE[b.st] ?? 10) || Math.abs(b.est.margin) - Math.abs(a.est.margin)).map((r) => r.id);
    setPlay({ order, i: 0, on: true, speed: play?.speed ?? 1 }); ev("Map maker play", { office, studio });
  };
  useEffect(() => {
    if (!play?.on) return;
    if (play.i >= play.order.length) { setPlay((p) => (p ? { ...p, on: false } : p)); return; }
    const per = (office === "house" ? 260 : 1150) / play.speed;
    const t = window.setTimeout(() => { const id = play.order[play.i]; const v = board[id] ?? BLANK; announce(id, v); setPlay((p) => (p ? { ...p, i: p.i + 1 } : p)); }, play.i === 0 ? 500 : per);
    return () => window.clearTimeout(t);
  }, [play, office, board, announce]);
  const shown = useMemo(() => {
    if (!play) return board;
    const on = new Set(play.order.slice(0, play.i)); const out: Board = {};
    for (const id of ids) out[id] = on.has(id) ? board[id] ?? BLANK : BLANK;
    return out;
  }, [play, board, ids]);
  const playClock = play && play.i > 0 ? clockOf(CLOSE[byId.get(play.order[Math.min(play.i, play.order.length) - 1])?.st ?? ""] ?? 7) : play ? "7:00 PM ET" : "";

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "y") { e.preventDefault(); redo(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = Number(e.key); if (n >= 1 && n <= 9) setBrush(n - 1);
      if (e.key === "0") setBrush(BLANK);
      const key = e.key.toLowerCase();
      if (key === "s") setStudio((x) => !x);
      if (key === "l") setLabels((x) => !x);
      if (key === "h") setDockHidden((x) => !x);
      if (key === "p") { if (play?.on) setPlay((p) => (p ? { ...p, on: false } : p)); else startPlay(); }
      if (e.key === "Escape") { if (play) setPlay(null); else setStudio(false); }
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  useEffect(() => { const up = () => setDrag(false); window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  // studio: the site's chrome steps aside, and the dock and cursor hide while the mouse is still
  useEffect(() => {
    if (!studio) return;
    const root = document.documentElement; root.classList.add("emk-studio"); document.body.style.overflow = "hidden";
    let t = 0; const wake = () => { setIdle(false); window.clearTimeout(t); t = window.setTimeout(() => setIdle(true), 2600); };
    wake(); window.addEventListener("mousemove", wake); window.addEventListener("keydown", wake);
    ev("Map maker studio", { office, aspect });
    return () => { root.classList.remove("emk-studio"); document.body.style.overflow = ""; window.removeEventListener("mousemove", wake); window.removeEventListener("keydown", wake); window.clearTimeout(t); };
  }, [studio]); // eslint-disable-line react-hooks/exhaustive-deps

  const meta = model?.meta;
  const nuD = office === "senate" ? meta?.senNotUpD ?? 0 : office === "governor" ? meta?.govNotUpD ?? 0 : 0;
  const nuR = office === "senate" ? meta?.senNotUpR ?? 0 : office === "governor" ? meta?.govNotUpR ?? 0 : 0;
  const counts = useMemo(() => { const c = new Array(10).fill(0); for (const r of races) c[shown[r.id] ?? BLANK]++; return c; }, [races, shown]);
  const dTot = nuD + counts[0] + counts[1] + counts[2] + counts[3], rTot = nuR + counts[5] + counts[6] + counts[7] + counts[8];
  const winner = dTot >= cfg.control ? "D" : rTot >= cfg.control ? "R" : office === "senate" && dTot === 50 && rTot === 50 ? "tie" : null;
  const verdict = winner === "D" ? `Democrats win ${office === "governor" ? "most governorships" : `the ${cfg.label}`}` : winner === "R" ? `Republicans win ${office === "governor" ? "most governorships" : `the ${cfg.label}`}`
    : winner === "tie" ? "50 to 50, the vice president breaks the tie" : `Neither side at ${cfg.control} yet`;

  if (!model || !geo) return <div className="opp emk"><div className="emk-load sx-skel" /></div>;
  const [W, H] = geo.frame;
  const house = office === "house";
  const raceOf = (st: string) => races.find((r) => r.st === st);
  const units = house
    ? Object.entries(geo.districts).map(([id, v]) => ({ id, d: typeof v === "string" ? v : v.d })).filter((u) => u.d && byId.has(u.id))
    : Object.entries(geo.states).map(([st, d]) => ({ id: raceOf(st)?.id ?? `none-${st}`, d }));
  const tipR = tip ? byId.get(tip.id) : null;
  const callR = call ? byId.get(call.id) : null;

  const seg = (n: number, c: string, label: string, i?: number, big = false) => (n > 0 ? <i key={label} style={{ flexGrow: n, background: c, color: i != null ? ink(i) : "#fff" }} title={`${label}: ${n}`} className={i != null && i === brush && !big ? "sel" : ""}>{n >= (house ? (big ? 14 : 9) : 2) ? n : ""}</i> : null);
  const bar = (big = false) => (
    <div className={`emk-bar${big ? " big" : ""}`}>
      {seg(nuD, "#16306f", "Democratic seats not up", undefined, big)}
      {[0, 1, 2, 3].map((i) => seg(counts[i], BANDS[i].c, BANDS[i].k, i, big))}
      {seg(counts[TOSS], BANDS[TOSS].c, "Toss up", TOSS, big)}
      {seg(counts[BLANK], BLANK_C, "Not called", undefined, big)}
      {[5, 6, 7, 8].map((i) => seg(counts[i], BANDS[i].c, BANDS[i].k, i, big))}
      {seg(nuR, "#6e0f24", "Republican seats not up", undefined, big)}
      <em className="maj" style={{ left: `${(cfg.control / cfg.total) * 100}%` }}><span>{cfg.control} to win</span></em>
    </div>
  );
  const onMove = (id: string) => (e: React.MouseEvent<SVGElement>) => { if (studio) return; const b = ((e.currentTarget as SVGElement).ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); };
  const handlers = (id: string) => ({
    onMouseDown: (e: React.MouseEvent) => { if (e.button === 0) { if (play) setPlay(null); commit(); paint(id, e.shiftKey); } },
    onMouseEnter: () => { if (drag) paint(id, false, true); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clearOne(id); },
    onMouseMove: onMove(id),
  });

  const mapSvg = (big = false) => (
    <svg viewBox={`0 0 ${W} ${H}`} className={`emk-map${house ? " hs" : ""}${big ? " big" : ""}`} role="img" aria-label={`${cfg.label} map maker`} onMouseDown={() => setDrag(true)}>
      {kind === "geo" ? units.map((u) => {
        const live = byId.has(u.id), v = shown[u.id] ?? BLANK, fl = flash?.id === u.id;
        return <path key={fl ? `${u.id}-${flash!.k}` : u.id} d={u.d} className={`${live ? "live" : "off"}${fl ? " fl" : ""}`} style={live ? { fill: fillOf(v) } : undefined} {...(live ? handlers(u.id) : {})} />;
      }) : (house ? Object.entries(geo.hexHouse) : Object.entries(geo.hexStates)).map(([key, pt]) => {
        const id = house ? key : raceOf(key)?.id; const live = !!id && byId.has(id); const v = id ? shown[id] ?? BLANK : BLANK; const fl = !!id && flash?.id === id;
        const rr = (house ? geo.hexHouseR : geo.hexStatesR) * 0.94, [cx, cy] = pt;
        const hex = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
        return (
          <g key={fl ? `${key}-${flash!.k}` : key} className={fl ? "fl" : undefined}>
            <polygon points={hex} className={live ? "live" : "off"} style={live ? { fill: fillOf(v) } : undefined} {...(live ? handlers(id!) : {})} />
            {!house && labels ? <text x={cx} y={cy + 4} className="hx" style={{ fill: live ? ink(v) : "rgba(255,255,255,.35)" }}>{key}</text> : null}
          </g>
        );
      })}
      {kind === "geo" && !house && labels ? Object.entries(geo.states).map(([st, d]) => {
        const lb = geo.labels?.[st]; const b = lb ? null : bboxOf(d); const x = lb ? lb[0] : (b![0] + b![2]) / 2, y = lb ? lb[1] : (b![1] + b![3]) / 2, w = lb ? lb[2] : b![2] - b![0];
        if (w < 34) return null; const r = raceOf(st), v = r ? shown[r.id] ?? BLANK : -1;
        return <text key={st} x={x} y={y + 4} className={r ? "lb" : "lb off"} style={r ? { fill: ink(v) } : undefined}>{st}</text>;
      }) : null}
    </svg>
  );
  const callBanner = callR && call ? (
    <div key={call.k} className={`emk-call ${isD(call.v) ? "d" : isR(call.v) ? "r" : "t"}`} role="status">
      <span className="k">{call.v === TOSS ? "Too close to call" : play ? "Projected" : "Your call"}</span>
      <b>{callR.name}</b>
      <span className="w" style={{ background: fillOf(call.v), color: ink(call.v) }}>{BANDS[call.v]?.k ?? ""}</span>
      <span className="who">{isD(call.v) ? callR.dem : isR(call.v) ? callR.gop : `${callR.dem} vs ${callR.gop}`}</span>
    </div>
  ) : null;

  // a picture of the frame, drawn from the board, for thumbnails and posts
  const exportPng = () => {
    const A = ASPECT[aspect], FW = A >= 1 ? 1920 : 1080, FH = Math.round(FW / A);
    const bgc = bg === "green" ? "#00b140" : bg === "blue" ? "#0047bb" : bg === "day" ? "#f4f1fb" : "#0b0716";
    const fg = bg === "day" ? "#140b24" : "#ffffff", mute = bg === "day" ? "#5b5372" : "#b9b2d0";
    const t = esc(title || defTitle), s2 = esc(sub || "Make your own at onpointpolitics.us/maps/electoral");
    const fs = Math.round(FW * (A >= 1 ? 0.034 : 0.06));
    const pad = Math.round(FW * 0.045), titleY = pad + fs, subY = titleY + Math.round(fs * 0.75), numY = subY + Math.round(fs * 1.55);
    const barY = numY + Math.round(fs * 0.5), barH = Math.round(FH * (A >= 1 ? 0.035 : 0.022)), topH = barY + barH;
    const tot = cfg.total, bw = FW - pad * 2; let x = pad; const segs: string[] = [];
    const add = (n: number, c: string) => { if (!n) return; const w = (bw * n) / tot; segs.push(`<rect x="${x.toFixed(1)}" y="${barY}" width="${Math.max(0, w - 2).toFixed(1)}" height="${barH}" rx="4" fill="${c}"/>`); x += w; };
    add(nuD, "#16306f"); [0, 1, 2, 3].forEach((i) => add(counts[i], BANDS[i].c)); add(counts[TOSS], BANDS[TOSS].c); add(counts[BLANK], BLANK_C); [5, 6, 7, 8].forEach((i) => add(counts[i], BANDS[i].c)); add(nuR, "#6e0f24");
    const mx = pad + (bw * cfg.control) / tot;
    const mapTop = topH + Math.round(FH * 0.03), mapH = FH - mapTop - Math.round(FH * 0.08), sc = Math.min(bw / W, mapH / H), ox = (FW - W * sc) / 2, oy = mapTop + (mapH - H * sc) / 2;
    const shapes = kind === "geo" ? units.map((u) => `<path d="${u.d}" fill="${byId.has(u.id) ? fillOf(shown[u.id] ?? BLANK) : bg === "day" ? "#e4dff0" : bg === "night" ? "#221a36" : "#2a2340"}" stroke="${bgc}" stroke-width="${house ? 0.4 : 1}"/>`).join("")
      : (house ? Object.entries(geo.hexHouse) : Object.entries(geo.hexStates)).map(([key, [cx, cy]]) => { const id = house ? key : raceOf(key)?.id; const rr = (house ? geo.hexHouseR : geo.hexStatesR) * 0.94; const pts = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(" "); return `<polygon points="${pts}" fill="${id && byId.has(id) ? fillOf(shown[id] ?? BLANK) : "#221a36"}"/>`; }).join("");
    const labs = labels && !house ? (kind === "geo" ? Object.entries(geo.states) : []).map(([st, d]) => { const lb = geo.labels?.[st]; const b = lb ? null : bboxOf(d); const lx = lb ? lb[0] : (b![0] + b![2]) / 2, ly = lb ? lb[1] : (b![1] + b![3]) / 2, w = lb ? lb[2] : b![2] - b![0]; if (w < 34) return ""; const r = raceOf(st); return `<text x="${lx}" y="${ly + 4}" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="11" text-anchor="middle" fill="${r ? ink(shown[r.id] ?? BLANK) : "rgba(255,255,255,.35)"}">${st}</text>`; }).join("") : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${FW}" height="${FH}" viewBox="0 0 ${FW} ${FH}"><rect width="100%" height="100%" fill="${bgc}"/>
<text x="${pad}" y="${titleY}" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${fs}" fill="${fg}">${t}</text>
<text x="${pad}" y="${subY}" font-family="Arial,Helvetica,sans-serif" font-weight="600" font-size="${Math.round(fs * 0.42)}" fill="${mute}">${s2}</text>
<text x="${pad}" y="${numY}" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${Math.round(fs * 1.1)}" fill="#5b8cff">${dTot}</text>
<text x="${FW - pad}" y="${numY}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${Math.round(fs * 1.1)}" fill="#ff4d6a">${rTot}</text>
<text x="${FW / 2}" y="${numY - Math.round(fs * 0.15)}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-weight="700" font-size="${Math.round(fs * 0.42)}" fill="${fg}">${esc(verdict)}</text>
${segs.join("")}<rect x="${mx - 1.5}" y="${barY - 8}" width="3" height="${barH + 16}" fill="${fg}"/>
<g transform="translate(${ox.toFixed(1)} ${oy.toFixed(1)}) scale(${sc.toFixed(4)})">${shapes}${labs}</g>
<text x="${FW - pad}" y="${FH - Math.round(pad * 0.55)}" text-anchor="end" font-family="Arial,Helvetica,sans-serif" font-weight="800" font-size="${Math.round(fs * 0.45)}" fill="${fg}" letter-spacing="2">ON POINT POLITICS</text>
<text x="${pad}" y="${FH - Math.round(pad * 0.55)}" font-family="Arial,Helvetica,sans-serif" font-weight="600" font-size="${Math.round(fs * 0.38)}" fill="${mute}">onpointpolitics.us</text></svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas"); c.width = FW; c.height = FH; const g = c.getContext("2d"); if (!g) return; g.drawImage(img, 0, 0);
      c.toBlob((bl) => { if (!bl) return; const a = document.createElement("a"); a.href = URL.createObjectURL(bl); a.download = `on-point-${office}-map-${aspect.replace(":", "x")}.png`; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(a.href), 4000); setToast("Picture saved"); }, "image/png");
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    ev("Map maker export", { office, aspect });
  };
  const copyLink = async () => { try { await navigator.clipboard.writeText(window.location.href); setToast("Link copied. It opens on this map."); } catch { setToast("Copy the address bar to share this map."); } ev("Map maker shared", { office }); };
  const h = hist.current[office];

  const palette = (compact = false) => (
    <div className={`emk-pal${compact ? " mini" : ""}`} role="radiogroup" aria-label="Rating to paint">
      {BANDS.map((b, i) => (
        <button key={b.k} role="radio" aria-checked={brush === i} className={brush === i ? "on" : ""} style={{ background: b.c, color: ink(i) }} onClick={() => setBrush(i)} title={`${b.k}, key ${i + 1}`}>
          <span>{compact ? b.k.replace(" up", "") : b.k}</span>{compact ? null : <small>{counts[i]}</small>}<kbd>{i + 1}</kbd>
        </button>
      ))}
      <button role="radio" aria-checked={brush === BLANK} className={`blank${brush === BLANK ? " on" : ""}`} onClick={() => setBrush(BLANK)} title="Eraser, key 0"><span>Eraser</span>{compact ? null : <small>{counts[BLANK]}</small>}<kbd>0</kbd></button>
    </div>
  );
  const tools = (
    <div className="emk-bar2" role="toolbar" aria-label="Map tools">
      <button type="button" onClick={undo} disabled={!h?.past.length} title="Undo, Ctrl Z">Undo</button>
      <button type="button" onClick={redo} disabled={!h?.future.length} title="Redo, Ctrl Shift Z">Redo</button>
      <span className="sep" />
      <button type="button" aria-pressed={labels} onClick={() => setLabels((x) => !x)} title="State labels, L">Labels</button>
      <button type="button" aria-pressed={banners} onClick={() => setBanners((x) => !x)}>Call banners</button>
      <span className="sep" />
      {play?.on ? <button type="button" className="hot" onClick={() => setPlay((p) => (p ? { ...p, on: false } : p))}>Pause</button>
        : play ? <button type="button" className="hot" onClick={() => setPlay((p) => (p ? { ...p, on: true } : p))}>Resume</button>
        : <button type="button" className="hot" onClick={startPlay} title="Call every race in poll closing order, P">Play the night</button>}
      {play ? <><button type="button" onClick={() => setPlay((p) => (p ? { ...p, speed: p.speed >= 4 ? 1 : p.speed * 2 } : p))}>{play.speed}x</button><button type="button" onClick={() => setPlay(null)}>Stop</button></> : null}
      <span className="sep" />
      <button type="button" className="gold" onClick={() => setStudio(true)} title="Full screen frame for recording, S">Studio</button>
      <button type="button" onClick={exportPng}>Save picture</button>
      <button type="button" onClick={copyLink}>Copy link</button>
    </div>
  );

  const studioView = studio ? createPortal(
    <div className={`opp emk-studio-root bg-${bg}${idle ? " idle" : ""}`} onMouseLeave={() => setTip(null)}>
      <div className={`emk-frame a-${aspect.replace(":", "x")}`} style={{ ["--ar" as string]: String(ASPECT[aspect]) }}>
        <div className="emk-f-top">
          <div className="emk-f-title">
            <b contentEditable suppressContentEditableWarning spellCheck={false} onBlur={(e) => setTitle((e.currentTarget.textContent || "").trim().slice(0, 80))}>{title || defTitle}</b>
            <span contentEditable suppressContentEditableWarning spellCheck={false} onBlur={(e) => setSub((e.currentTarget.textContent || "").trim().slice(0, 120))}>{sub || "Make your own at onpointpolitics.us/maps/electoral"}</span>
          </div>
          {play ? <div className="emk-f-clock"><span>Polls closed by</span><b>{playClock}</b></div> : null}
        </div>
        <div className="emk-f-count">
          <div className="side d"><b><Roll v={dTot} /></b><span>Democrats</span></div>
          <div className="mid">{bar(true)}<div className={`emk-verdict${winner ? ` w-${winner}` : ""}`}>{verdict}</div></div>
          <div className="side r"><b><Roll v={rTot} /></b><span>Republicans</span></div>
        </div>
        <div className="emk-f-map">{mapSvg(true)}{callBanner}</div>
        <div className="emk-f-foot"><span className="brand"><i />On Point Politics</span><span>onpointpolitics.us</span></div>
      </div>
      <div className={`emk-dock${dockHidden ? " gone" : ""}`} role="toolbar" aria-label="Studio controls">
        {palette(true)}
        <div className="row">
          <button type="button" onClick={undo} disabled={!h?.past.length}>Undo</button>
          <button type="button" onClick={redo} disabled={!h?.future.length}>Redo</button>
          {play?.on ? <button type="button" className="hot" onClick={() => setPlay((p) => (p ? { ...p, on: false } : p))}>Pause</button> : <button type="button" className="hot" onClick={play ? () => setPlay((p) => (p ? { ...p, on: true } : p)) : startPlay}>{play ? "Resume" : "Play the night"}</button>}
          {play ? <button type="button" onClick={() => setPlay(null)}>Stop</button> : null}
          <button type="button" onClick={useForecast}>Forecast</button>
          <button type="button" onClick={() => fill(BLANK)}>Blank</button>
          <select value={aspect} onChange={(e) => setAspect(e.target.value as Aspect)} aria-label="Frame">{(Object.keys(ASPECT) as Aspect[]).map((a) => <option key={a} value={a}>{a === "16:9" ? "16:9 video" : a === "9:16" ? "9:16 shorts" : "1:1 square"}</option>)}</select>
          <select value={bg} onChange={(e) => setBg(e.target.value as Bg)} aria-label="Background">{(Object.keys(BG_LABEL) as Bg[]).map((b) => <option key={b} value={b}>{BG_LABEL[b]}</option>)}</select>
          <select value={office} onChange={(e) => { setOffice(e.target.value as Office); setPlay(null); }} aria-label="Office">{OFFICES.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}</select>
          <button type="button" aria-pressed={labels} onClick={() => setLabels((x) => !x)}>Labels</button>
          <button type="button" aria-pressed={banners} onClick={() => setBanners((x) => !x)}>Banners</button>
          <button type="button" onClick={exportPng}>Save picture</button>
          <button type="button" onClick={() => setDockHidden(true)} title="Hide the dock, H">Hide</button>
          <button type="button" className="gold" onClick={() => setStudio(false)} title="Leave the studio, Esc">Done</button>
        </div>
        <p>Click the title to edit it. The dock and cursor hide while the mouse is still. Keys: 1 to 9 and 0 paint, P plays, H hides the dock, Esc leaves.</p>
      </div>
      {dockHidden ? <button type="button" className="emk-dock-show" onClick={() => setDockHidden(false)}>Show controls</button> : null}
      {toast ? <div className="emk-toast" role="status">{toast}</div> : null}
    </div>, document.body) : null;

  return (
    <div className="opp emk">
      <ForecastNav />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span><span>Map maker</span></nav>
      <header className="emk-head">
        <Pointy className="cam-hero cam-top pty-side" pose="point" prop="pointer" size={96} look={-1} flip say={<>Paint the map, then press Studio to record it full screen.</>} />
        <div>
          <div className="eye g">2026 map maker · forecast updated {new Date(model.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          <h1>Make your own <em>2026 map</em></h1>
        </div>
        <div className="emk-tabs" role="tablist" aria-label="Office">
          {OFFICES.map((o) => <button key={o.key} role="tab" aria-selected={office === o.key} className={office === o.key ? "on" : ""} onClick={() => { setOffice(o.key); setTip(null); setPlay(null); }}>{o.label}</button>)}
        </div>
      </header>

      <section className="emk-chart" aria-label="Seat count">
        <div className="side d"><b><Roll v={dTot} /></b><span>Democrats</span></div>
        <div className="mid">
          {bar()}
          <div className={`emk-verdict${winner ? ` w-${winner}` : ""}`}>{verdict}{counts[TOSS] ? ` · ${counts[TOSS]} toss up${counts[TOSS] > 1 ? "s" : ""}` : ""}{counts[BLANK] ? ` · ${counts[BLANK]} not called` : ""}{nuD + nuR ? ` · ${nuD + nuR} not on the ballot` : ""}</div>
        </div>
        <div className="side r"><b><Roll v={rTot} /></b><span>Republicans</span></div>
      </section>

      <div className="emk-stage">
        <div className="emk-tools">
          {palette()}
          <div className="emk-acts">
            <button className="btn g" onClick={useForecast}>On Point forecast</button>
            <button className="btn" onClick={() => fill(BLANK)}>Clear map</button>
            <button className="btn" onClick={() => fill(TOSS)}>All toss up</button>
            <button className="btn" onClick={() => fill(0)}>All Safe D</button>
            <button className="btn" onClick={() => fill(8)}>All Safe R</button>
            <div className="emk-kind" role="group" aria-label="Map style">
              <button className={kind === "geo" ? "on" : ""} onClick={() => setKind("geo")}>Map</button>
              <button className={kind === "hex" ? "on" : ""} onClick={() => setKind("hex")}>Hex</button>
            </div>
          </div>
          <div className="emk-titles">
            <label htmlFor="emk-t">Title for the studio and pictures</label>
            <input id="emk-t" value={title} placeholder={defTitle} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
            <label htmlFor="emk-s">Subtitle</label>
            <input id="emk-s" value={sub} placeholder="Make your own at onpointpolitics.us/maps/electoral" maxLength={120} onChange={(e) => setSub(e.target.value)} />
          </div>
          <p className="emk-help">Pick a rating, then click or drag across {house ? "districts" : "states"}. Clicking one already in that party walks it through Safe, Likely, Lean and Tilt. Right click clears one. Keys 1 to 9 pick a rating and 0 the eraser; Ctrl Z undoes. Play the night calls every race in the order polls close, and Studio puts the map full screen in a frame for recording. The address bar saves your map, so copy it to share.</p>
        </div>

        <div className="emk-main">
          {tools}
          <div className="emk-mapcard" onMouseLeave={() => setTip(null)}>
            {play ? <div className="emk-clock"><span>Polls closed by</span><b>{playClock}</b><small>{Math.min(play.i, play.order.length)} of {play.order.length} called</small></div> : null}
            {mapSvg()}
            {callBanner}
            {tipR ? (
              <div className="emk-tip" style={{ left: tip!.x, top: tip!.y, transform: `translate(${tip!.x > tip!.w - 280 ? "calc(-100% - 16px)" : "16px"}, ${tip!.y > tip!.h - 200 ? "calc(-100% - 12px)" : "12px"})` }}>
                <h4>{tipR.name}</h4>
                <div className="r"><span className="d">{tipR.dem}</span><span className="r2">{tipR.gop}</span></div>
                <div className="r"><span>Your call</span><b>{(board[tipR.id] ?? BLANK) === BLANK ? "Not called" : BANDS[board[tipR.id]].k}</b></div>
                <div className="r"><span>On Point forecast</span><b>{BANDS[bandOf(tipR)].k} · {fm(tipR.est.margin)}</b></div>
                <div className="r"><span>Polls close</span><b>{clockOf(CLOSE[tipR.st] ?? 8)}</b></div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="emk-foot">
        <Link href="/what-if" className="emk-link"><span className="eye g">Go further</span><b>What if</b><small>Pick winners and watch the model move every other race with them</small></Link>
        <Link href="/forecast" className="emk-link"><span className="eye">The forecast</span><b>Every race</b><small>Odds, maps and every race in one place</small></Link>
      </div>
      {toast && !studio ? <div className="emk-toast" role="status">{toast}</div> : null}
      {studioView}
    </div>
  );
}
