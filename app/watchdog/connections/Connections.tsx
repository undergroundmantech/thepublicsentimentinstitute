"use client";
// Connections: every name tied to the one you pick by money, campaign stops or endorsements. Gold motes travel the way
// the money moved, from donors to groups and campaign committees to the candidates they spent for or against and the
// firms they paid. Click any body to trace its own web, drag any body to make room, drag the background to pan and
// scroll to zoom; pick a second name to see what the two share.
//
// Oct 22 2026: the stage fills the screen and the layout gives every label its own box, so nothing sits on top of
// anything else. Every candidate's own campaign committee joins the web from the Ledger snapshot when it is on the
// site, with the committee's biggest donors and the firms it paid.
import FloatTip, { WD_SCOPE } from "@/app/components/opp/FloatTip";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PersonToken, { PARTY_COLOR } from "../PersonToken";
import { Pointy } from "@/app/components/home/Mascot";
import type { Graph, GNode, GEdge } from "../data";

const usd = (n: number | null | undefined) => (n == null ? "" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const KIND: Record<string, string> = { race: "Race", candidate: "Candidate", group: "Outside group", donor: "Donor", vendor: "Firm paid", person: "Person", committee: "Campaign committee" };
const VERB: Record<string, string> = { gave: "gave", paid: "paid", support: "spent for", oppose: "spent against", endorse: "endorsed", rally: "campaigned for", attention: "put attention on", runs: "runs in", campaign: "is the campaign committee of" };
const MONEY = new Set(["gave", "paid", "support", "oppose"]);
const sideColor = (s: string | null | undefined) => (s && PARTY_COLOR[s]) || "#c9c2d6";

type LNode = GNode & { x: number; y: number; vx: number; vy: number; r: number; deg: number; weight: number; fixed?: boolean; bw: number; bh: number };
type Pt = { x: number; y: number };

/* ---------------------------------------------------------------- the Ledger snapshot, merged in */
type LWeb = { nodes: { key: string; kind: string; label: string; side?: string | null; value?: number }[]; edges: { source: string; target: string; value?: number; kind: string }[] };
const normName = (s: string) => {
  let t = (s || "").replace(/\b(mr|mrs|ms|dr|jr|sr|ii|iii|iv)\b\.?/gi, " ").replace(/[^A-Za-z, ]+/g, " ").trim();
  if (t.includes(",")) { const [last, first] = t.split(",", 2); t = `${first} ${last}`; }
  const w = t.toLowerCase().split(/\s+/).filter(Boolean);
  return w.length ? `${w[0]} ${w[w.length - 1]}` : "";
};
const titleCase = (s: string) => (/[a-z]/.test(s) ? s : s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Pac|Llc|Inc|Usa)\b/g, (m) => m.toUpperCase()));
const sideOf = (s?: string | null) => (s ? (/^d/i.test(s) ? "D" : /^r/i.test(s) ? "R" : /^i/i.test(s) ? "I" : null) : null);
function mergeLedger(graph: Graph, web: LWeb): Graph {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const edges = new Map(graph.edges.map((e) => [`${e.s}|${e.t}|${e.k}`, e]));
  const candByName = new Map<string, string>();
  for (const n of graph.nodes) if (n.kind === "candidate") candByName.set(normName(n.name), n.id);
  const idOf = new Map<string, string>();
  for (const n of web.nodes) {
    const label = titleCase(n.label || "");
    if (!label || /^fec:/i.test(label)) continue;
    let id: string;
    if (n.kind === "candidate") id = candByName.get(normName(label)) ?? `c:${label}`;
    else if (n.kind === "committee") id = `k:${label}`;
    else if (n.kind === "vendor") id = `v:${label}`;
    else id = `d:${label}`;
    idOf.set(n.key, id);
    if (!nodes.has(id)) nodes.set(id, { id, kind: n.kind === "candidate" ? "candidate" : n.kind === "committee" ? "committee" : n.kind === "vendor" ? "vendor" : "donor", name: label, side: sideOf(n.side) } as GNode);
  }
  const K: Record<string, string> = { runs: "campaign", gave: "gave", paid: "paid", for: "support", against: "oppose" };
  for (const e of web.edges) {
    const s = idOf.get(e.source), t = idOf.get(e.target), k = K[e.kind];
    if (!s || !t || !k || s === t) continue;
    // an outside group in Ledger that spends for or against a candidate is a committee there and a group here
    const key = `${s}|${t}|${k}`;
    if (edges.has(key)) continue;
    edges.set(key, { s, t, k, v: e.value || null, n: 1, notes: [], src: "Ledger" } as GEdge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/* ---------------------------------------------------------------- who joins the web */
function ego(idx: Map<string, GEdge[]>, byId: Map<string, GNode>, focus: string, focus2: string | null) {
  const keep = new Map<string, number>();
  keep.set(focus, 0); if (focus2) keep.set(focus2, 0);
  const edges: GEdge[] = [];
  const otherOf = (e: GEdge, id: string) => (e.s === id ? e.t : e.s);
  const add = (id: string, depth: number, cap: number, capPeople: number) => {
    const es = [...(idx.get(id) ?? [])];
    // money and the campaign committee first, then the people, the busiest people first
    const rank = (e: GEdge) => (e.k === "campaign" ? 1e15 : MONEY.has(e.k) ? 1e12 + (e.v ?? 0) : (idx.get(otherOf(e, id))?.length ?? 0));
    es.sort((a, b) => rank(b) - rank(a));
    let n = 0, np = 0;
    for (const e of es) {
      const o = otherOf(e, id), isP = byId.get(o)?.kind === "person";
      if (!keep.has(o)) {
        if (e.k !== "campaign") { if (isP ? np >= capPeople : n >= cap) continue; }
        keep.set(o, depth); if (isP) np++; else n++;
      }
      edges.push(e);
    }
  };
  add(focus, 1, 26, 18); if (focus2) add(focus2, 1, 20, 12);
  // second ring: a candidate's campaign committee always brings its donors and firms, then the strongest money ties
  const first = [...keep.entries()].filter(([, d]) => d === 1).map(([id]) => id);
  for (const id of first) if (byId.get(id)?.kind === "committee") add(id, 2, 7, 0);
  const scored = first.filter((id) => byId.get(id)?.kind !== "person" && byId.get(id)?.kind !== "committee")
    .map((id) => ({ id, w: (idx.get(id) ?? []).reduce((a, e) => a + (e.v ?? 0), 0) })).sort((a, b) => b.w - a.w).slice(0, 8);
  for (const { id } of scored) add(id, 2, 4, 0);
  const ids = new Set(keep.keys());
  const uniq = new Map<string, GEdge>();
  for (const e of edges) if (ids.has(e.s) && ids.has(e.t)) uniq.set(`${e.s}|${e.t}|${e.k}`, e);
  return { ids, depth: keep, edges: [...uniq.values()] };
}

/* ---------------------------------------------------------------- layout: sectors by kind, then boxes that never overlap */
const SECTOR: Record<string, number> = { committee: -0.5, vendor: -0.15, group: 0.25, donor: 0.6, race: 1.0, candidate: 1.35, person: 2.3 };
function layout(nodes: LNode[], edges: GEdge[], focus: string, focus2: string | null, W: number, H: number, depth: Map<string, number>) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const cx = W / 2, cy = H / 2, R = Math.min(W * 0.46, H * 0.62);
  const groups = new Map<string, LNode[]>();
  for (const n of nodes) { if (n.id === focus || n.id === focus2) continue; const k = n.kind + "|" + (depth.get(n.id) ?? 1); (groups.get(k) ?? groups.set(k, []).get(k)!).push(n); }
  for (const n of nodes) {
    if (n.id === focus) { n.x = focus2 ? cx - W * 0.14 : cx; n.y = cy; n.fixed = true; }
    if (n.id === focus2) { n.x = cx + W * 0.14; n.y = cy; n.fixed = true; }
  }
  for (const [k, list] of groups) {
    const [kind, d] = k.split("|"), base = SECTOR[kind] ?? 0, spread = kind === "person" ? 1.5 : 0.55;
    list.forEach((n, i) => {
      const a = base * Math.PI + (list.length > 1 ? (i / (list.length - 1) - 0.5) * spread * Math.PI : 0);
      const rr = R * (Number(d) === 2 ? 0.95 : 0.55) * (0.88 + (i % 3) * 0.08);
      n.x = cx + Math.cos(a) * rr * (W / H > 1.3 ? 1.25 : 1); n.y = cy + Math.sin(a) * rr * 0.82;
    });
  }
  for (let it = 0; it < 260; it++) {
    const alpha = 1 - it / 260;
    for (const e of edges) {
      const a = by.get(e.s), b = by.get(e.t); if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), want = R * 0.42 + (a.r + b.r);
      const f = ((d - want) / d) * 0.02 * alpha;
      if (!a.fixed) { a.vx += dx * f; a.vy += dy * f; } if (!b.fixed) { b.vx -= dx * f; b.vy -= dy * f; }
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const ox = (a.bw + b.bw) / 2 + 10 - Math.abs(b.x - a.x), oy = (a.bh + b.bh) / 2 + 8 - Math.abs(b.y - a.y);
      if (ox > 0 && oy > 0) {   // the two label boxes overlap: push apart along the shorter way out
        const sx = b.x >= a.x ? 1 : -1, sy = b.y >= a.y ? 1 : -1;
        if (ox < oy) { const p = ox / 2 + 0.5; if (!a.fixed) a.x -= sx * p * (b.fixed ? 2 : 1); if (!b.fixed) b.x += sx * p * (a.fixed ? 2 : 1); }
        else { const p = oy / 2 + 0.5; if (!a.fixed) a.y -= sy * p * (b.fixed ? 2 : 1); if (!b.fixed) b.y += sy * p * (a.fixed ? 2 : 1); }
      } else if (alpha > 0.3) {
        const dx = b.x - a.x, dy = b.y - a.y, d2 = Math.max(400, dx * dx + dy * dy), f = (900 / d2) * alpha;
        if (!a.fixed) { a.vx -= dx * f; a.vy -= dy * f; } if (!b.fixed) { b.vx += dx * f; b.vy += dy * f; }
      }
    }
    for (const n of nodes) {
      if (n.fixed) continue;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.6; n.vy *= 0.6;
      n.x = Math.max(n.bw / 2 + 8, Math.min(W - n.bw / 2 - 8, n.x)); n.y = Math.max(n.bh / 2 + 8, Math.min(H - n.bh / 2 - 48, n.y));
    }
  }
}

export default function Connections({ graph: graph0, initial = "c:James Talarico" }: { graph: Graph; initial?: string }) {
  const [web, setWeb] = useState<LWeb | null>(null);
  useEffect(() => { fetch("/watchdog/ledger-data/web_all.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.nodes?.length) setWeb(j); }).catch(() => {}); }, []);
  const graph = useMemo(() => (web ? mergeLedger(graph0, web) : graph0), [graph0, web]);
  const idx = useMemo(() => { const m = new Map<string, GEdge[]>(); for (const e of graph.edges) { (m.get(e.s) ?? m.set(e.s, []).get(e.s)!).push(e); (m.get(e.t) ?? m.set(e.t, []).get(e.t)!).push(e); } return m; }, [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const [focus, setFocus] = useState(initial);
  const [focus2, setFocus2] = useState<string | null>(null);
  const [q, setQ] = useState(""), [q2, setQ2] = useState("");
  const [hov, setHov] = useState<string | null>(null);
  const [flow, setFlow] = useState(true);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const [size, setSize] = useState({ W: 1400, H: 820 });
  const prev = useRef<Record<string, Pt>>({});
  const svgRef = useRef<SVGSVGElement>(null), stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  useEffect(() => { try { const p = new URLSearchParams(window.location.search).get("name"); if (p && byId.has(p)) setFocus(p); } catch { /* no window */ } }, [byId]);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ W: Math.max(640, Math.round(r.width)), H: Math.max(560, Math.round(r.height)) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const { W, H } = size;

  const net = useMemo(() => {
    const e = ego(idx, byId, focus, focus2);
    const deg = new Map<string, number>(); const wt = new Map<string, number>();
    for (const x of e.edges) { deg.set(x.s, (deg.get(x.s) ?? 0) + 1); deg.set(x.t, (deg.get(x.t) ?? 0) + 1); wt.set(x.s, (wt.get(x.s) ?? 0) + (x.v ?? 0)); wt.set(x.t, (wt.get(x.t) ?? 0) + (x.v ?? 0)); }
    const maxW = Math.max(1, ...wt.values());
    const nodes: LNode[] = [...e.ids].map((id) => {
      const n = byId.get(id)!; const w = wt.get(id) ?? 0, isF = id === focus || id === focus2;
      const r = isF ? 28 : n.kind === "person" ? 17 : 10 + Math.sqrt(w / maxW) * 15;
      const lab = Math.min(30, n.name.length) * (isF ? 8.2 : 6.7);
      return { ...n, x: 0, y: 0, vx: 0, vy: 0, r, deg: deg.get(id) ?? 0, weight: w, bw: Math.max(r * 2 + 6, lab + 10), bh: r * 2 + 22 };
    });
    layout(nodes, e.edges, focus, focus2, W, H, e.depth);
    return { nodes, edges: e.edges, depth: e.depth };
  }, [idx, byId, focus, focus2, W, H]);

  // animate from the previous layout to the new one
  useEffect(() => {
    const from = prev.current, to: Record<string, Pt> = {};
    for (const n of net.nodes) to[n.id] = { x: n.x, y: n.y };
    const start = performance.now(); let raf = 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - start) / 900), ez = 1 - Math.pow(1 - k, 3);
      const cur: Record<string, Pt> = {};
      for (const n of net.nodes) { const a = from[n.id] ?? from[focus] ?? { x: W / 2, y: H / 2 }; cur[n.id] = { x: a.x + (to[n.id].x - a.x) * ez, y: a.y + (to[n.id].y - a.y) * ez }; }
      setPos(cur);
      if (k < 1) raf = requestAnimationFrame(step); else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [net, focus, W, H]);

  /* dragging bodies, panning the stage and zooming */
  const toSvg = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  }, [W, H]);
  const onDown = (ev: React.PointerEvent, id: string | null) => {
    ev.stopPropagation();
    const p = toSvg(ev.clientX, ev.clientY);
    drag.current = { id, sx: p.x, sy: p.y, ox: id ? pos[id]?.x ?? 0 : view.x, oy: id ? pos[id]?.y ?? 0 : view.y, moved: false };
    (ev.currentTarget as Element).setPointerCapture?.(ev.pointerId);
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = toSvg(ev.clientX, ev.clientY), dx = p.x - d.sx, dy = p.y - d.sy;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (!d.moved) return;
    if (d.id) { const id = d.id, x = d.ox + dx / view.k, y = d.oy + dy / view.k; setPos((cur) => ({ ...cur, [id]: { x, y } })); prev.current = { ...prev.current, [id]: { x, y } }; }
    else setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
  };
  const onUp = (ev: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (d && d.id && !d.moved && d.id !== focus) setFocus(d.id);
    (ev.currentTarget as Element).releasePointerCapture?.(ev.pointerId);
  };
  const onWheel = (ev: React.WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    const p = toSvg(ev.clientX, ev.clientY), f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => { const k = Math.max(0.5, Math.min(3, v.k * f)), r = k / v.k; return { k, x: p.x - (p.x - v.x) * r, y: p.y - (p.y - v.y) * r }; });
  };
  useEffect(() => { const el = stageRef.current; if (!el) return; const stop = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }; el.addEventListener("wheel", stop, { passive: false }); return () => el.removeEventListener("wheel", stop); }, []);

  const near = useMemo(() => { if (!hov) return null; const s = new Set([hov]); for (const e of net.edges) { if (e.s === hov) s.add(e.t); if (e.t === hov) s.add(e.s); } return s; }, [hov, net.edges]);
  const shared = useMemo(() => {
    if (!focus2) return [] as string[];
    const a = new Set((idx.get(focus) ?? []).map((e) => (e.s === focus ? e.t : e.s))), b = new Set((idx.get(focus2) ?? []).map((e) => (e.s === focus2 ? e.t : e.s)));
    return [...a].filter((x) => b.has(x));
  }, [focus, focus2, idx]);

  const sugg = (s: string) => { const k = s.trim().toLowerCase(); if (k.length < 2) return [] as GNode[]; return graph.nodes.filter((n) => n.name.toLowerCase().includes(k)).sort((a, b) => (idx.get(b.id)?.length ?? 0) - (idx.get(a.id)?.length ?? 0)).slice(0, 8); };
  const f = byId.get(focus) ?? graph.nodes[0];
  const words = useMemo(() => plain(f, idx, byId), [f, idx, byId]);
  const maxV = Math.max(1, ...net.edges.map((e) => e.v ?? 0));
  const hidden = (idx.get(focus)?.length ?? 0) - net.edges.filter((e) => e.s === focus || e.t === focus).length;

  const curve = (a: Pt, b: Pt, bend = 0.12) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - dy * bend).toFixed(1)},${(my + dx * bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`; };
  const hovNode = hov ? byId.get(hov) : null;
  const hovPos = hov ? pos[hov] : null;
  const scr = (p: Pt) => ({ x: p.x * view.k + view.x, y: p.y * view.k + view.y });

  return (
    <div className="cx">
      <aside className="cx-panel card">
        <div className="card-b">
          <div className="eye gold">Trace a name</div>
          <div className="cx-pick">
            <span className={`cx-kind k-${f.kind}`}>{KIND[f.kind]}</span><b>{f.name}</b>
          </div>
          <div className="cx-search">
            <input id="cx-q" className="wd-input" placeholder="Search a candidate, committee, group, donor or firm" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search a name to trace" />
            {sugg(q).length ? <div className="cx-sugg">{sugg(q).map((n) => <button key={n.id} onClick={() => { setFocus(n.id); setQ(""); }}><span className={`cx-kind k-${n.kind}`}>{KIND[n.kind]}</span>{n.name}</button>)}</div> : null}
          </div>
          <div className="eye gold" style={{ marginTop: 14 }}>Compare with</div>
          <div className="cx-search">
            <input id="cx-q2" className="wd-input" placeholder={focus2 ? byId.get(focus2)?.name : "Pick a second name"} value={q2} onChange={(e) => setQ2(e.target.value)} aria-label="Pick a second name to compare" />
            {sugg(q2).length ? <div className="cx-sugg">{sugg(q2).map((n) => <button key={n.id} onClick={() => { setFocus2(n.id === focus ? null : n.id); setQ2(""); }}><span className={`cx-kind k-${n.kind}`}>{KIND[n.kind]}</span>{n.name}</button>)}</div> : null}
          </div>
          {focus2 ? <div className="cx-shared"><b>{shared.length}</b> shared {shared.length === 1 ? "tie" : "ties"}{shared.length ? ": " : ""}{shared.slice(0, 6).map((id) => byId.get(id)?.name).join(", ")}<button className="wd-btn" onClick={() => setFocus2(null)}>Clear</button></div> : null}
          <div className="eye gold" style={{ marginTop: 14 }}>Try</div>
          <div className="wd-chips">
            {["c:Ken Paxton", "k:Talarico For Texas", "g:Senate Leadership Fund", "d:Elon Musk", "g:Fairshake", "p:Donald Trump", "c:Sherrod Brown", "v:Smart Media Group LLC", "p:Nick Fuentes"].filter((id) => byId.has(id)).map((id) => <button key={id} className={focus === id ? "on" : ""} onClick={() => setFocus(id)}>{byId.get(id)!.name}</button>)}
          </div>
          <p className="cx-how">Drag any body to move it, drag the background to pan, and pinch or hold Ctrl and scroll to zoom. Click a body to trace its own web.</p>
          {web ? <p className="cx-how">Campaign committees, their donors and the firms they paid come from the Ledger snapshot.</p> : null}
        </div>
        <Pointy className="cx-pty keep" pose="think" prop="magnifier" size={96} look={1} detective say={<>Follow the gold: it moves the way the money moved.</>} />
      </aside>

      <div className="cx-stage card" ref={stageRef} onWheel={onWheel}>
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Everyone tied to ${f.name}`} onMouseLeave={() => setHov(null)}
          onPointerDown={(e) => onDown(e, null)} onPointerMove={onMove} onPointerUp={onUp} style={{ cursor: drag.current && !drag.current.id ? "grabbing" : "grab" }}>
          <defs>
            <radialGradient id="cxglow"><stop offset="0" stopColor="#ffd98a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
            <filter id="cxblur"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          <g transform={`translate(${view.x.toFixed(1)},${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`}>
            <g className="cx-rings" aria-hidden="true">{[0.3, 0.52, 0.74].map((k) => <circle key={k} cx={pos[focus]?.x ?? W / 2} cy={pos[focus]?.y ?? H / 2} r={Math.min(W, H) * k} />)}</g>
            {net.edges.map((e) => {
              const a = pos[e.s], b = pos[e.t]; if (!a || !b) return null;
              const d = curve(a, b), money = MONEY.has(e.k), w = money && e.v ? 0.8 + Math.sqrt(e.v / maxV) * 5 : e.k === "campaign" ? 2.4 : 1;
              const col = e.k === "oppose" ? "#ff9a5c" : e.k === "support" ? sideColor(byId.get(e.s)?.side) : e.k === "gave" || e.k === "paid" ? "#e7b341" : e.k === "campaign" ? "#9fe3c1" : "rgba(200,190,230,.5)";
              const dim = near && !(near.has(e.s) && near.has(e.t));
              const dur = Math.max(1.6, Math.hypot(b.x - a.x, b.y - a.y) / 110);
              return (
                <g key={`${e.s}|${e.t}|${e.k}`} className={`cx-e${dim ? " dim" : ""}`}>
                  <path d={d} stroke={col} strokeWidth={w} fill="none" strokeDasharray={money || e.k === "campaign" ? undefined : "3 5"} opacity={money ? 0.55 : e.k === "campaign" ? 0.8 : 0.4} />
                  {money && flow && !dim ? [0, 0.5].slice(0, e.v && e.v > maxV * 0.08 ? 2 : 1).map((off) => (
                    <circle key={off} r={Math.min(4.2, 1.8 + w * 0.4)} fill="#ffe2a0" filter="url(#cxblur)">
                      <animateMotion dur={`${dur}s`} begin={`${off * dur}s`} repeatCount="indefinite" path={d} />
                    </circle>
                  )) : null}
                </g>
              );
            })}
            {net.nodes.map((n) => {
              const p = pos[n.id]; if (!p) return null;
              const isF = n.id === focus || n.id === focus2, dim = near && !near.has(n.id), c = sideColor(n.side);
              return (
                <g key={n.id} className={`cx-n k-${n.kind}${isF ? " f" : ""}${dim ? " dim" : ""}`} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
                  onMouseEnter={() => { if (!drag.current) setHov(n.id); }} onMouseLeave={() => setHov(null)}
                  onPointerDown={(e) => onDown(e, n.id)}
                  tabIndex={0} role="button" aria-label={`${KIND[n.kind]}: ${n.name}`} onKeyDown={(ev) => { if (ev.key === "Enter") setFocus(n.id); }}>
                  {isF ? <circle r={n.r * 2.6} fill="url(#cxglow)" className="cx-halo" /> : null}
                  {n.kind === "person" ? <g transform={`translate(${isF ? -20 : -14},${isF ? -34 : -24})`}><PersonToken ini={n.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} party={n.side ?? "O"} role={n.role} size={isF ? 52 : 36} /></g>
                    : n.kind === "candidate" ? <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} transform="rotate(45)" rx="3" fill={c} className="cx-shape" />
                    : n.kind === "group" ? <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} rx="5" fill={c} className="cx-shape" />
                    : n.kind === "vendor" ? <path d={`M0,${-n.r * 1.15} L${n.r},${n.r * 0.75} L${-n.r},${n.r * 0.75} Z`} className="cx-shape cx-vend" />
                    : n.kind === "race" ? <path d={hex(n.r)} strokeWidth="1.6" className="cx-shape cx-hex" />
                    : n.kind === "committee" ? <g className="cx-shape"><rect x={-n.r} y={-n.r * 0.8} width={n.r * 2} height={n.r * 1.6} rx="3" fill={c} /><path d={`M${-n.r * 0.55},0 H${n.r * 0.55} M0,${-n.r * 0.45} V${n.r * 0.45}`} stroke="rgba(10,6,18,.7)" strokeWidth="2" /></g>
                    : <circle r={n.r} fill={n.side ? c : "#e7b341"} className="cx-shape" />}
                  <text y={n.r + 15} textAnchor="middle" className="cx-l">{n.name.length > 30 ? n.name.slice(0, 28) + "…" : n.name}</text>
                </g>
              );
            })}
          </g>
        </svg>
        {hovNode && hovPos ? (() => { const s = scr(hovPos); return (
          <FloatTip scope={WD_SCOPE} x={(stageRef.current?.getBoundingClientRect().left ?? 0) + (s.x / W) * (stageRef.current?.clientWidth ?? W)} y={(stageRef.current?.getBoundingClientRect().top ?? 0) + (s.y / H) * (stageRef.current?.clientHeight ?? H)}>
            <h4>{hovNode.name}</h4>
            <div style={{ opacity: .75 }}>{KIND[hovNode.kind]}{hovNode.race ? ` · ${hovNode.race}` : ""}</div>
            {(idx.get(hovNode.id) ?? []).filter((e) => net.edges.includes(e)).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 4).map((e, i) => <div key={i}>{line(e, byId)}</div>)}
            <div className="cx-hint" style={{ marginTop: 4 }}>Click to trace, drag to move</div>
          </FloatTip>); })() : null}
        <div className="cx-tools">
          <button className="wd-btn" onClick={() => setView((v) => ({ k: Math.min(3, v.k * 1.25), x: W / 2 - (W / 2 - v.x) * 1.25, y: H / 2 - (H / 2 - v.y) * 1.25 }))} aria-label="Zoom in">+</button>
          <button className="wd-btn" onClick={() => setView((v) => ({ k: Math.max(0.5, v.k / 1.25), x: W / 2 - (W / 2 - v.x) / 1.25, y: H / 2 - (H / 2 - v.y) / 1.25 }))} aria-label="Zoom out">−</button>
          <button className="wd-btn" onClick={() => { setView({ k: 1, x: 0, y: 0 }); prev.current = {}; setPos((p) => ({ ...p })); }}>Fit</button>
          <button className="wd-btn" onClick={() => setFlow((x) => !x)}>{flow ? "Pause flow" : "Play flow"}</button>
          {hidden > 0 ? <span className="cx-more">+{hidden} more ties in the list</span> : null}
        </div>
        <div className="cx-legend">
          <span><i className="lg cand" />Candidate</span><span><i className="lg com" />Campaign committee</span><span><i className="lg grp" />Outside group</span><span><i className="lg don" />Donor</span><span><i className="lg ven" />Firm paid</span><span><i className="lg race" />Race</span>
          <span><i className="lg dd" />D side</span><span><i className="lg rr" />R side</span><span><i className="ln gold" />Money moving</span><span><i className="ln opp" />Spent against</span><span><i className="ln camp" />Own campaign</span><span><i className="ln dash" />Stops and endorsements</span>
        </div>
      </div>

      <aside className="cx-words card">
        <div className="card-h"><h3>The same ties in words</h3></div>
        <div className="card-b">
          <div className="cx-wh"><span className={`cx-kind k-${f.kind}`}>{KIND[f.kind]}</span><h4>{f.name}</h4><small>{idx.get(focus)?.length ?? 0} ties</small></div>
          <ul>{words.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <div className="eye gold" style={{ marginTop: 12 }}>Every tie</div>
          {(idx.get(focus) ?? []).slice().sort((a, b) => (MONEY.has(b.k) ? 1e12 : 0) + (b.v ?? 0) - ((MONEY.has(a.k) ? 1e12 : 0) + (a.v ?? 0))).map((e, i) => {
            const o = byId.get(e.s === focus ? e.t : e.s); if (!o) return null;
            return (
              <button key={i} className="cx-tie" onClick={() => setFocus(o.id)}>
                <b>{o.name}</b><small>{line(e, byId)}</small>{e.src && /^https?:/.test(e.src) ? <a href={e.src} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Source</a> : e.src === "Ledger" ? <em>Ledger, FEC filings</em> : null}
              </button>
            );
          })}
          {f.href ? <Link className="wd-btn" href={f.href} style={{ display: "inline-block", marginTop: 10 }}>Open the race forecast</Link> : null}
        </div>
      </aside>
    </div>
  );
}

function hex(r: number) { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; p.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`); } return `M${p.join("L")}Z`; }
function line(e: GEdge, byId: Map<string, GNode>) {
  const s = byId.get(e.s)?.name ?? e.s, t = byId.get(e.t)?.name ?? e.t;
  const amt = e.v ? ` ${usd(e.v)}` : "";
  if (e.k === "rally") return `${s} campaigned for ${t}${e.n > 1 ? `, ${e.n} stops` : ""}`;
  if (e.k === "attention") return e.notes[0] ?? `${s} put attention on ${t}`;
  if (e.k === "campaign") return `${s} is ${t}'s own campaign committee`;
  return `${s} ${VERB[e.k] ?? e.k} ${t}${amt}`;
}
function plain(f: GNode, idx: Map<string, GEdge[]>, byId: Map<string, GNode>): string[] {
  const es = idx.get(f.id) ?? [], out: string[] = [];
  const nm = (id: string) => byId.get(id)?.name ?? id;
  const sum = (xs: GEdge[]) => xs.reduce((a, e) => a + (e.v ?? 0), 0);
  const top = (xs: GEdge[], other: (e: GEdge) => string, n = 2) => xs.sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, n).map((e) => `${nm(other(e))} ${usd(e.v)}`).join(" and ");
  if (f.kind === "candidate") {
    const run = es.find((e) => e.k === "runs"); if (run) out.push(`${f.name} is running in the ${nm(run.t)} race.`);
    const camps = es.filter((e) => e.k === "campaign");
    for (const camp of camps) {
      const ce = idx.get(camp.s) ?? [], paid = ce.filter((e) => e.k === "paid" && e.s === camp.s), gifts = ce.filter((e) => e.k === "gave" && e.t === camp.s);
      out.push(`${f.name}'s own campaign committee is ${nm(camp.s)}.${gifts.length ? ` Its biggest donors: ${top(gifts, (e) => e.s, 3)}.` : ""}${paid.length ? ` It paid ${top(paid, (e) => e.t, 3)}.` : ""}`);
    }
    const forE = es.filter((e) => e.t === f.id && e.k === "support"), ag = es.filter((e) => e.t === f.id && e.k === "oppose");
    if (forE.length) out.push(`Outside groups spent ${usd(sum(forE))} supporting ${f.name}, led by ${top(forE, (e) => e.s)}.`);
    if (ag.length) out.push(`Groups spent ${usd(sum(ag))} opposing ${f.name}, led by ${top(ag, (e) => e.s)}.`);
    const en = es.filter((e) => e.k === "endorse"); if (en.length) out.push(`Endorsed by ${en.map((e) => nm(e.s)).join(", ")}.`);
    const ra = es.filter((e) => e.k === "rally"); if (ra.length) out.push(`${ra.map((e) => `${nm(e.s)}${e.n > 1 ? ` ${e.n} times` : ""}`).join(", ")} campaigned for ${f.name}.`);
  } else if (f.kind === "group" || f.kind === "committee") {
    const own = es.filter((e) => e.k === "campaign" && e.s === f.id); if (own.length) out.push(`The campaign committee of ${own.map((e) => nm(e.t)).join(" and ")}.`);
    const g = es.filter((e) => e.t === f.id && e.k === "gave"); if (g.length) out.push(`The biggest money in: ${top(g, (e) => e.s, 3)}.`);
    const sp = es.filter((e) => e.s === f.id && (e.k === "support" || e.k === "oppose")); if (sp.length) out.push(`It spent ${usd(sum(sp))} in races, the most on ${top(sp, (e) => e.t, 2)}.`);
    const pd = es.filter((e) => e.s === f.id && e.k === "paid"); if (pd.length) out.push(`It paid ${top(pd, (e) => e.t, 3)}.`);
    const gv = es.filter((e) => e.s === f.id && e.k === "gave"); if (gv.length) out.push(`It moved ${usd(sum(gv))} to ${top(gv, (e) => e.t, 2)}.`);
  } else if (f.kind === "donor") {
    const g = es.filter((e) => e.s === f.id); out.push(`${f.name} gave ${usd(sum(g))} to ${top(g, (e) => e.t, 3)}.`);
  } else if (f.kind === "vendor") {
    const g = es.filter((e) => e.t === f.id); out.push(`${f.name} was paid ${usd(sum(g))} by ${top(g, (e) => e.s, 3)}.`);
  } else if (f.kind === "person") {
    const ra = es.filter((e) => e.k === "rally"), en = es.filter((e) => e.k === "endorse"), at = es.filter((e) => e.k === "attention");
    if (ra.length) out.push(`Campaigned for ${ra.length} candidates: ${ra.slice(0, 6).map((e) => nm(e.t)).join(", ")}.`);
    if (en.length) out.push(`Endorsed ${en.slice(0, 8).map((e) => nm(e.t)).join(", ")}.`);
    at.forEach((e) => { if (e.notes[0]) out.push(e.notes[0]); });
  } else if (f.kind === "race") {
    const c = es.filter((e) => e.k === "runs"); out.push(`${c.map((e) => nm(e.s)).join(" vs ")}.`);
    const at = es.filter((e) => e.k === "attention"); at.forEach((e) => out.push(`${nm(e.s)}: ${e.notes[0] ?? ""}`));
  }
  if (!out.length) out.push(`${es.length} ties in the Watchdog file.`);
  return out;
}
