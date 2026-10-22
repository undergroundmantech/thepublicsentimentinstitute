"use client";
// The 2026 map maker, built the way map makers are used: a palette of nine ratings, Safe, Likely, Lean and Tilt for
// each party plus Toss up, a big map you paint by clicking or dragging, a seat chart that fills as you go, and buttons
// to start from the On Point forecast or from a blank map. Clicking a unit already in the selected party walks it
// through that party's strengths; right click clears one unit. The address bar carries the map so it can be shared.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import "./electoral.css";

type Office = "senate" | "governor" | "house";
type Race = { id: string; office: string; st: string; state: string; name: string; dem: string; gop: string; district: number; est: { margin: number; prob: number } };
type Model = { meta: { updated: string; senNotUpD: number; senNotUpR: number; govNotUpD: number; govNotUpR: number }; races: Race[] };
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string } | string>;
  hexStates: Record<string, [number, number]>; hexHouse: Record<string, [number, number]>; hexStatesR: number; hexHouseR: number };

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
const OFFICES: { key: Office; label: string; total: number; control: number }[] = [
  { key: "senate", label: "Senate", total: 100, control: 51 },
  { key: "governor", label: "Governors", total: 50, control: 26 },
  { key: "house", label: "House", total: 435, control: 218 },
];
const fm = (m: number) => (Math.abs(m) >= 99 ? "Unopposed" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);

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
type Board = Record<string, number>;

export default function ElectoralBoard() {
  const [model, setModel] = useState<Model | null>(null);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [office, setOffice] = useState<Office>("senate");
  const [kind, setKind] = useState<"geo" | "hex">("geo");
  const [boards, setBoards] = useState<Partial<Record<Office, Board>>>({});
  const [brush, setBrush] = useState(0);
  const [tip, setTip] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null);
  const [drag, setDrag] = useState(false);
  const fromUrl = useRef(false);

  useEffect(() => {
    fetch("/forecast/model.json").then((r) => r.json()).then(setModel).catch(() => {});
    fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {});
  }, []);
  const races = useMemo(() => (model ? model.races.filter((r) => r.office === office) : []), [model, office]);
  const ids = useMemo(() => races.map((r) => r.id).sort(), [races]);
  const forecast = useCallback(() => Object.fromEntries(races.map((r) => [r.id, bandOf(r)])) as Board, [races]);
  const board = useMemo(() => boards[office] ?? {}, [boards, office]);
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
      }
      const packed = q.get(office);
      if (packed && packed.length === ids.length) [...packed].forEach((ch, i) => { const v = parseInt(ch, 10); if (v >= 0 && v <= BLANK) b[ids[i]] = v; });
    } catch { /* no window */ }
    setBoards((o) => ({ ...o, [office]: b }));
  }, [races, ids, office, boards, forecast]);
  useEffect(() => {
    if (!ids.length || !boards[office]) return;
    try { const u = new URL(window.location.href); u.searchParams.set("o", office); u.searchParams.set(office, ids.map((id) => String(boards[office]![id] ?? BLANK)).join("")); window.history.replaceState(null, "", u.toString()); } catch { /* history unavailable */ }
  }, [boards, office, ids]);

  const paint = useCallback((id: string, back = false, force = false) => setBoard((b) => {
    const cur = b[id] ?? BLANK;
    if (force || brush === TOSS || brush === BLANK || cur === BLANK || cur === TOSS || isD(brush) !== isD(cur)) return { ...b, [id]: brush };
    // same party: walk Safe, Likely, Lean, Tilt
    const s = isD(cur) ? cur : 8 - cur, ns = (s + (back ? 3 : 1)) % 4;
    return { ...b, [id]: isD(cur) ? ns : 8 - ns };
  }), [brush, setBoard]);
  const clearOne = (id: string) => setBoard((b) => ({ ...b, [id]: BLANK }));
  const fill = (v: number) => setBoard(() => Object.fromEntries(races.map((r) => [r.id, v])));
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const n = Number(e.key); if (n >= 1 && n <= 9) setBrush(n - 1);
      if (e.key === "0") setBrush(BLANK);
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, []);
  useEffect(() => { const up = () => setDrag(false); window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  const cfg = OFFICES.find((o) => o.key === office)!;
  const meta = model?.meta;
  const nuD = office === "senate" ? meta?.senNotUpD ?? 0 : office === "governor" ? meta?.govNotUpD ?? 0 : 0;
  const nuR = office === "senate" ? meta?.senNotUpR ?? 0 : office === "governor" ? meta?.govNotUpR ?? 0 : 0;
  const counts = useMemo(() => { const c = new Array(10).fill(0); for (const r of races) c[board[r.id] ?? BLANK]++; return c; }, [races, board]);
  const dTot = nuD + counts[0] + counts[1] + counts[2] + counts[3], rTot = nuR + counts[5] + counts[6] + counts[7] + counts[8];
  const verdict = dTot >= cfg.control ? `Democrats win ${office === "governor" ? "most governorships" : `the ${cfg.label}`}` : rTot >= cfg.control ? `Republicans win ${office === "governor" ? "most governorships" : `the ${cfg.label}`}`
    : office === "senate" && dTot === 50 && rTot === 50 ? "50 to 50, the vice president breaks the tie" : `Neither side at ${cfg.control} yet`;
  const byId = useMemo(() => new Map(races.map((r) => [r.id, r])), [races]);

  if (!model || !geo) return <div className="opp emk"><div className="emk-load sx-skel" /></div>;
  const [W, H] = geo.frame;
  const house = office === "house";
  const raceOf = (st: string) => races.find((r) => r.st === st);
  const units = house
    ? Object.entries(geo.districts).map(([id, v]) => ({ id, d: typeof v === "string" ? v : v.d })).filter((u) => u.d && byId.has(u.id))
    : Object.entries(geo.states).map(([st, d]) => ({ id: raceOf(st)?.id ?? `none-${st}`, d }));
  const tipR = tip ? byId.get(tip.id) : null;
  const seg = (n: number, c: string, label: string, i?: number) => (n > 0 ? <i key={label} style={{ flexGrow: n, background: c }} title={`${label}: ${n}`} className={i != null && i === brush ? "sel" : ""}>{n >= (house ? 9 : 2) ? n : ""}</i> : null);
  const onMove = (id: string) => (e: React.MouseEvent<SVGElement>) => { const b = ((e.currentTarget as SVGElement).ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ id, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); };
  const handlers = (id: string) => ({
    onMouseDown: (e: React.MouseEvent) => { if (e.button === 0) paint(id, e.shiftKey); },
    onMouseEnter: () => { if (drag) paint(id, false, true); },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); clearOne(id); },
    onMouseMove: onMove(id),
  });

  return (
    <div className="opp emk">
      <ForecastNav />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/maps">Maps</Link><span className="sep">/</span><span>Map maker</span></nav>
      <header className="emk-head">
        <div>
          <div className="eye g">2026 map maker · forecast updated {new Date(model.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
          <h1>Make your own <em>2026 map</em></h1>
        </div>
        <div className="emk-tabs" role="tablist" aria-label="Office">
          {OFFICES.map((o) => <button key={o.key} role="tab" aria-selected={office === o.key} className={office === o.key ? "on" : ""} onClick={() => { setOffice(o.key); setTip(null); }}>{o.label}</button>)}
        </div>
      </header>

      <section className="emk-chart" aria-label="Seat count">
        <div className="side d"><b>{dTot}</b><span>Democrats</span></div>
        <div className="mid">
          <div className="emk-bar">
            {seg(nuD, "#16306f", "Democratic seats not up")}
            {[0, 1, 2, 3].map((i) => seg(counts[i], BANDS[i].c, BANDS[i].k, i))}
            {seg(counts[TOSS], BANDS[TOSS].c, "Toss up", TOSS)}
            {seg(counts[BLANK], BLANK_C, "Not filled in")}
            {[5, 6, 7, 8].map((i) => seg(counts[i], BANDS[i].c, BANDS[i].k, i))}
            {seg(nuR, "#6e0f24", "Republican seats not up")}
            <em className="maj" style={{ left: `${(cfg.control / cfg.total) * 100}%` }}><span>{cfg.control} to win</span></em>
          </div>
          <div className="emk-verdict">{verdict}{counts[TOSS] ? ` · ${counts[TOSS]} toss up${counts[TOSS] > 1 ? "s" : ""}` : ""}{counts[BLANK] ? ` · ${counts[BLANK]} not filled in` : ""}{nuD + nuR ? ` · ${nuD + nuR} not on the ballot` : ""}</div>
        </div>
        <div className="side r"><b>{rTot}</b><span>Republicans</span></div>
      </section>

      <div className="emk-stage">
        <div className="emk-tools">
          <div className="emk-pal" role="radiogroup" aria-label="Rating to paint">
            {BANDS.map((b, i) => (
              <button key={b.k} role="radio" aria-checked={brush === i} className={brush === i ? "on" : ""} style={{ background: b.c, color: ink(i) }} onClick={() => setBrush(i)}>
                <span>{b.k}</span><small>{counts[i]}</small><kbd>{i + 1}</kbd>
              </button>
            ))}
            <button role="radio" aria-checked={brush === BLANK} className={`blank${brush === BLANK ? " on" : ""}`} onClick={() => setBrush(BLANK)}><span>Eraser</span><small>{counts[BLANK]}</small><kbd>0</kbd></button>
          </div>
          <div className="emk-acts">
            <button className="btn g" onClick={() => setBoard(() => forecast())}>On Point forecast</button>
            <button className="btn" onClick={() => fill(BLANK)}>Clear map</button>
            <button className="btn" onClick={() => fill(TOSS)}>All toss up</button>
            <button className="btn" onClick={() => fill(0)}>All Safe D</button>
            <button className="btn" onClick={() => fill(8)}>All Safe R</button>
            <div className="emk-kind" role="group" aria-label="Map style">
              <button className={kind === "geo" ? "on" : ""} onClick={() => setKind("geo")}>Map</button>
              <button className={kind === "hex" ? "on" : ""} onClick={() => setKind("hex")}>Hex</button>
            </div>
          </div>
          <p className="emk-help">Pick a rating, then click or drag across {house ? "districts" : "states"}. Clicking one already in that party walks it through Safe, Likely, Lean and Tilt. Right click clears one. Keys 1 to 9 pick a rating, 0 the eraser. The address bar saves your map, so copy it to share.</p>
        </div>

        <div className="emk-mapcard" onMouseLeave={() => setTip(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} className={`emk-map${house ? " hs" : ""}`} role="img" aria-label={`${cfg.label} map maker`} onMouseDown={() => setDrag(true)}>
            {kind === "geo" ? units.map((u) => {
              const live = byId.has(u.id), v = board[u.id] ?? BLANK;
              return <path key={u.id} d={u.d} className={live ? "live" : "off"} style={live ? { fill: v === BLANK ? BLANK_C : BANDS[v].c } : undefined} {...(live ? handlers(u.id) : {})} />;
            }) : (house ? Object.entries(geo.hexHouse) : Object.entries(geo.hexStates)).map(([key, pt]) => {
              const id = house ? key : raceOf(key)?.id; const live = !!id && byId.has(id); const v = id ? board[id] ?? BLANK : BLANK;
              const rr = (house ? geo.hexHouseR : geo.hexStatesR) * 0.94, [cx, cy] = pt;
              const hex = Array.from({ length: 6 }, (_, k) => { const a = (Math.PI / 3) * k + Math.PI / 6; return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`; }).join(" ");
              return (
                <g key={key}>
                  <polygon points={hex} className={live ? "live" : "off"} style={live ? { fill: v === BLANK ? BLANK_C : BANDS[v].c } : undefined} {...(live ? handlers(id!) : {})} />
                  {!house ? <text x={cx} y={cy + 4} className="hx" style={{ fill: live ? ink(v) : "rgba(255,255,255,.35)" }}>{key}</text> : null}
                </g>
              );
            })}
            {kind === "geo" && !house ? Object.entries(geo.states).map(([st, d]) => {
              const lb = geo.labels?.[st]; const b = lb ? null : bboxOf(d); const x = lb ? lb[0] : (b![0] + b![2]) / 2, y = lb ? lb[1] : (b![1] + b![3]) / 2, w = lb ? lb[2] : b![2] - b![0];
              if (w < 34) return null; const r = raceOf(st), v = r ? board[r.id] ?? BLANK : -1;
              return <text key={st} x={x} y={y + 4} className={r ? "lb" : "lb off"} style={r ? { fill: ink(v) } : undefined}>{st}</text>;
            }) : null}
          </svg>
          {tipR ? (
            <div className="emk-tip" style={{ left: tip!.x, top: tip!.y, transform: `translate(${tip!.x > tip!.w - 280 ? "calc(-100% - 16px)" : "16px"}, ${tip!.y > tip!.h - 200 ? "calc(-100% - 12px)" : "12px"})` }}>
              <h4>{tipR.name}</h4>
              <div className="r"><span className="d">{tipR.dem}</span><span className="r2">{tipR.gop}</span></div>
              <div className="r"><span>Your call</span><b>{(board[tipR.id] ?? BLANK) === BLANK ? "Not filled in" : BANDS[board[tipR.id]].k}</b></div>
              <div className="r"><span>On Point forecast</span><b>{BANDS[bandOf(tipR)].k} · {fm(tipR.est.margin)}</b></div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="emk-foot">
        <Link href="/forecast/what-if" className="emk-link"><span className="eye g">Go further</span><b>What if</b><small>Pick winners and watch the model move every other race with them</small></Link>
        <Link href="/forecast" className="emk-link"><span className="eye">The forecast</span><b>Every race</b><small>Odds, maps and every race in one place</small></Link>
      </div>
    </div>
  );
}
