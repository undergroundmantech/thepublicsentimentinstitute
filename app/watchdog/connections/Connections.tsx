"use client";
// Connections: every name tied to the one you pick by money, campaign stops or endorsements. Gold motes travel the way
// the money moved, from donors to groups to the candidates they spent for or against and the firms they paid.
// Click any body to trace its own web; pick a second name to see what the two share.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import PersonToken, { PARTY_COLOR } from "../PersonToken";
import { Pointy } from "@/app/components/home/Mascot";
import type { Graph, GNode, GEdge } from "../data";

const usd = (n: number | null | undefined) => (n == null ? "" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const KIND: Record<string, string> = { race: "Race", candidate: "Candidate", group: "Outside group", donor: "Donor", vendor: "Firm paid", person: "Person", committee: "Campaign committee" };
const VERB: Record<string, string> = { gave: "gave", paid: "paid", support: "spent for", oppose: "spent against", endorse: "endorsed", rally: "campaigned for", attention: "put attention on", runs: "runs in", campaign: "is the campaign of" };
const MONEY = new Set(["gave", "paid", "support", "oppose"]);
const sideColor = (s: string | null | undefined) => (s && PARTY_COLOR[s]) || "#c9c2d6";
const W = 1000, H = 720;

type LNode = GNode & { x: number; y: number; vx: number; vy: number; r: number; deg: number; weight: number; fixed?: boolean };

function ego(graph: Graph, idx: Map<string, GEdge[]>, focus: string, focus2: string | null) {
  const keep = new Map<string, number>(); // id -> depth
  keep.set(focus, 0); if (focus2) keep.set(focus2, 0);
  const edges: GEdge[] = [];
  const add = (id: string, depth: number, cap: number) => {
    const es = [...(idx.get(id) ?? [])].sort((a, b) => (b.v ?? 0) - (a.v ?? 0));
    let n = 0;
    for (const e of es) {
      const o = e.s === id ? e.t : e.s;
      if (!keep.has(o)) { if (n >= cap) continue; keep.set(o, depth); n++; }
      edges.push(e);
    }
  };
  add(focus, 1, 34); if (focus2) add(focus2, 1, 26);
  // second ring: the strongest money ties of the first ring
  const first = [...keep.entries()].filter(([, d]) => d === 1).map(([id]) => id);
  const scored = first.map((id) => ({ id, w: (idx.get(id) ?? []).reduce((a, e) => a + (e.v ?? 0), 0) })).sort((a, b) => b.w - a.w).slice(0, 8);
  for (const { id } of scored) add(id, 2, 4);
  const ids = new Set(keep.keys());
  const uniq = new Map<string, GEdge>();
  for (const e of edges) if (ids.has(e.s) && ids.has(e.t)) uniq.set(`${e.s}|${e.t}|${e.k}`, e);
  return { ids, depth: keep, edges: [...uniq.values()] };
}

function layout(nodes: LNode[], edges: GEdge[], focus: string, focus2: string | null) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const cx = W / 2, cy = H / 2;
  nodes.forEach((n, i) => {
    if (n.id === focus) { n.x = focus2 ? cx - 150 : cx; n.y = cy; n.fixed = true; return; }
    if (n.id === focus2) { n.x = cx + 150; n.y = cy; n.fixed = true; return; }
    const a = (i * 2.399963) % (Math.PI * 2), rr = 140 + (i % 5) * 45;
    n.x = cx + Math.cos(a) * rr; n.y = cy + Math.sin(a) * rr * 0.8;
  });
  for (let it = 0; it < 320; it++) {
    const alpha = 1 - it / 320;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]; let dx = b.x - a.x, dy = b.y - a.y; const d2 = Math.max(60, dx * dx + dy * dy), d = Math.sqrt(d2);
      const f = (2600 / d2) * alpha * 6; dx /= d; dy /= d;
      if (!a.fixed) { a.vx -= dx * f; a.vy -= dy * f; } if (!b.fixed) { b.vx += dx * f; b.vy += dy * f; }
      const min = a.r + b.r + 26; if (d < min) { const push = (min - d) * 0.5; if (!a.fixed) { a.x -= dx * push; a.y -= dy * push; } if (!b.fixed) { b.x += dx * push; b.y += dy * push; } }
    }
    for (const e of edges) {
      const a = by.get(e.s), b = by.get(e.t); if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), want = 150 + (a.r + b.r);
      const f = ((d - want) / d) * 0.04 * alpha;
      if (!a.fixed) { a.vx += dx * f; a.vy += dy * f; } if (!b.fixed) { b.vx -= dx * f; b.vy -= dy * f; }
    }
    for (const n of nodes) {
      if (n.fixed) continue;
      n.vx += (cx - n.x) * 0.002 * alpha; n.vy += (cy - n.y) * 0.003 * alpha;
      n.x += n.vx; n.y += n.vy; n.vx *= 0.55; n.vy *= 0.55;
      n.x = Math.max(40, Math.min(W - 40, n.x)); n.y = Math.max(40, Math.min(H - 40, n.y));
    }
  }
}

export default function Connections({ graph, initial = "c:James Talarico" }: { graph: Graph; initial?: string }) {
  const idx = useMemo(() => { const m = new Map<string, GEdge[]>(); for (const e of graph.edges) { (m.get(e.s) ?? m.set(e.s, []).get(e.s)!).push(e); (m.get(e.t) ?? m.set(e.t, []).get(e.t)!).push(e); } return m; }, [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const [focus, setFocus] = useState(initial);
  const [focus2, setFocus2] = useState<string | null>(null);
  const [q, setQ] = useState(""), [q2, setQ2] = useState("");
  const [hov, setHov] = useState<string | null>(null);
  const [flow, setFlow] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({});
  const prev = useRef<Record<string, { x: number; y: number }>>({});
  const svgRef = useRef<SVGSVGElement>(null);
  useEffect(() => { try { const p = new URLSearchParams(window.location.search).get("name"); if (p && byId.has(p)) setFocus(p); } catch { /* no window */ } }, [byId]);

  const net = useMemo(() => {
    const e = ego(graph, idx, focus, focus2);
    const deg = new Map<string, number>(); const wt = new Map<string, number>();
    for (const x of e.edges) { deg.set(x.s, (deg.get(x.s) ?? 0) + 1); deg.set(x.t, (deg.get(x.t) ?? 0) + 1); wt.set(x.s, (wt.get(x.s) ?? 0) + (x.v ?? 0)); wt.set(x.t, (wt.get(x.t) ?? 0) + (x.v ?? 0)); }
    const maxW = Math.max(1, ...wt.values());
    const nodes: LNode[] = [...e.ids].map((id) => { const n = byId.get(id)!; const w = wt.get(id) ?? 0; const base = id === focus || id === focus2 ? 26 : n.kind === "person" ? 16 : 9 + Math.sqrt(w / maxW) * 14;
      return { ...n, x: 0, y: 0, vx: 0, vy: 0, r: base, deg: deg.get(id) ?? 0, weight: w }; });
    layout(nodes, e.edges, focus, focus2);
    return { nodes, edges: e.edges, depth: e.depth };
  }, [graph, idx, byId, focus, focus2]);

  // animate from the previous layout to the new one
  useEffect(() => {
    const from = prev.current, to: Record<string, { x: number; y: number }> = {};
    for (const n of net.nodes) to[n.id] = { x: n.x, y: n.y };
    const start = performance.now(); let raf = 0;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const step = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - start) / 900), e = 1 - Math.pow(1 - k, 3);
      const cur: Record<string, { x: number; y: number }> = {};
      for (const n of net.nodes) { const a = from[n.id] ?? from[focus] ?? { x: W / 2, y: H / 2 }; cur[n.id] = { x: a.x + (to[n.id].x - a.x) * e, y: a.y + (to[n.id].y - a.y) * e }; }
      setPos(cur);
      if (k < 1) raf = requestAnimationFrame(step); else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [net, focus]);

  const near = useMemo(() => { if (!hov) return null; const s = new Set([hov]); for (const e of net.edges) { if (e.s === hov) s.add(e.t); if (e.t === hov) s.add(e.s); } return s; }, [hov, net.edges]);
  const shared = useMemo(() => {
    if (!focus2) return [] as string[];
    const a = new Set((idx.get(focus) ?? []).map((e) => (e.s === focus ? e.t : e.s))), b = new Set((idx.get(focus2) ?? []).map((e) => (e.s === focus2 ? e.t : e.s)));
    return [...a].filter((x) => b.has(x));
  }, [focus, focus2, idx]);

  const sugg = (s: string) => { const k = s.trim().toLowerCase(); if (k.length < 2) return [] as GNode[]; return graph.nodes.filter((n) => n.name.toLowerCase().includes(k)).sort((a, b) => (idx.get(b.id)?.length ?? 0) - (idx.get(a.id)?.length ?? 0)).slice(0, 8); };
  const f = byId.get(focus)!;
  const words = useMemo(() => plain(f, idx, byId), [f, idx, byId]);
  const maxV = Math.max(1, ...net.edges.map((e) => e.v ?? 0));

  const curve = (a: { x: number; y: number }, b: { x: number; y: number }, bend = 0.12) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${(mx - dy * bend).toFixed(1)},${(my + dx * bend).toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`; };
  const hovNode = hov ? byId.get(hov) : null;
  const hovPos = hov ? pos[hov] : null;

  return (
    <div className="cx">
      <aside className="cx-panel card">
        <div className="card-b">
          <div className="eye gold">Trace a name</div>
          <div className="cx-pick">
            <span className={`cx-kind k-${f.kind}`}>{KIND[f.kind]}</span><b>{f.name}</b>
          </div>
          <div className="cx-search">
            <input id="cx-q" className="wd-input" placeholder="Search a candidate, group, donor or firm" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search a name to trace" />
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
            {["c:Ken Paxton", "g:Senate Leadership Fund", "d:Elon Musk", "g:Fairshake", "p:Donald Trump", "c:Sherrod Brown", "v:Smart Media Group LLC", "p:Nick Fuentes"].filter((id) => byId.has(id)).map((id) => <button key={id} className={focus === id ? "on" : ""} onClick={() => setFocus(id)}>{byId.get(id)!.name}</button>)}
          </div>
        </div>
        <Pointy className="cx-pty keep" pose="think" prop="magnifier" size={96} look={1} detective say={<>Follow the gold: it moves the way the money moved.</>} />
      </aside>

      <div className="cx-stage card">
        <svg ref={svgRef} viewBox={`${(W - W / zoom) / 2} ${(H - H / zoom) / 2} ${W / zoom} ${H / zoom}`} role="img" aria-label={`Everyone tied to ${f.name}`} onMouseLeave={() => setHov(null)}>
          <defs>
            <radialGradient id="cxglow"><stop offset="0" stopColor="#ffd98a" stopOpacity=".55" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" /></radialGradient>
            <filter id="cxblur"><feGaussianBlur stdDeviation="2.2" /></filter>
          </defs>
          <g className="cx-rings" aria-hidden="true">{[120, 230, 330].map((r) => <circle key={r} cx={pos[focus]?.x ?? W / 2} cy={pos[focus]?.y ?? H / 2} r={r} />)}</g>
          {net.edges.map((e) => {
            const a = pos[e.s], b = pos[e.t]; if (!a || !b) return null;
            const d = curve(a, b), money = MONEY.has(e.k), w = money && e.v ? 0.8 + Math.sqrt(e.v / maxV) * 5 : 1;
            const col = e.k === "oppose" ? "#ff9a5c" : e.k === "support" ? sideColor(byId.get(e.s)?.side) : e.k === "gave" || e.k === "paid" ? "#e7b341" : "rgba(200,190,230,.5)";
            const dim = near && !(near.has(e.s) && near.has(e.t));
            const dur = Math.max(1.6, Math.hypot(b.x - a.x, b.y - a.y) / 90);
            return (
              <g key={`${e.s}|${e.t}|${e.k}`} className={`cx-e${dim ? " dim" : ""}`}>
                <path d={d} stroke={col} strokeWidth={w} fill="none" strokeDasharray={money ? undefined : "3 5"} opacity={money ? 0.55 : 0.45} />
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
            const label = isF || n.r > 15 || near?.has(n.id) || net.nodes.length < 26;
            return (
              <g key={n.id} className={`cx-n k-${n.kind}${isF ? " f" : ""}${dim ? " dim" : ""}`} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
                onMouseEnter={() => setHov(n.id)} onMouseLeave={() => setHov(null)} onClick={() => { if (n.id !== focus) setFocus(n.id); }} tabIndex={0} role="button" aria-label={`${KIND[n.kind]}: ${n.name}`}
                onKeyDown={(ev) => { if (ev.key === "Enter") setFocus(n.id); }}>
                {isF ? <circle r={n.r * 2.6} fill="url(#cxglow)" className="cx-halo" /> : null}
                {n.kind === "person" ? <g transform="translate(-14,-24)"><PersonToken ini={n.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} party={n.side ?? "O"} role={n.role} size={isF ? 52 : 36} /></g>
                  : n.kind === "candidate" ? <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} transform="rotate(45)" rx="3" fill={c} className="cx-shape" />
                  : n.kind === "group" ? <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} rx="5" fill={c} className="cx-shape" />
                  : n.kind === "vendor" ? <path d={`M0,${-n.r * 1.15} L${n.r},${n.r * 0.75} L${-n.r},${n.r * 0.75} Z`} fill="#c9c2d6" className="cx-shape" />
                  : n.kind === "race" ? <path d={hex(n.r)} fill="rgba(255,255,255,.12)" stroke="#ffd98a" strokeWidth="1.6" className="cx-shape" />
                  : n.kind === "committee" ? <rect x={-n.r * 0.8} y={-n.r * 0.8} width={n.r * 1.6} height={n.r * 1.6} rx="2" fill={c} className="cx-shape" />
                  : <circle r={n.r} fill={n.side ? c : "#e7b341"} className="cx-shape" />}
                {label ? <text y={n.r + 15} textAnchor="middle" className="cx-l">{n.name.length > 30 ? n.name.slice(0, 28) + "…" : n.name}</text> : null}
              </g>
            );
          })}
        </svg>
        {hovNode && hovPos ? (
          <div className="wd-tip" style={{ left: `${((hovPos.x - (W - W / zoom) / 2) / (W / zoom)) * 100}%`, top: `${((hovPos.y - (H - H / zoom) / 2) / (H / zoom)) * 100}%`, transform: hovPos.x > W * 0.6 ? "translate(calc(-100% - 18px), -50%)" : "translate(18px, -50%)" }}>
            <h4>{hovNode.name}</h4>
            <div style={{ opacity: .75 }}>{KIND[hovNode.kind]}{hovNode.race ? ` · ${hovNode.race}` : ""}</div>
            {(idx.get(hovNode.id) ?? []).filter((e) => net.edges.includes(e)).sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 4).map((e, i) => <div key={i}>{line(e, byId)}</div>)}
            <div style={{ marginTop: 4, color: "#ffd98a" }}>Click to trace this name</div>
          </div>
        ) : null}
        <div className="cx-tools">
          <button className="wd-btn" onClick={() => setZoom((z) => Math.min(2.4, z * 1.25))} aria-label="Zoom in">+</button>
          <button className="wd-btn" onClick={() => setZoom((z) => Math.max(0.7, z / 1.25))} aria-label="Zoom out">−</button>
          <button className="wd-btn" onClick={() => setZoom(1)}>Fit</button>
          <button className="wd-btn" onClick={() => setFlow((x) => !x)}>{flow ? "Pause flow" : "Play flow"}</button>
        </div>
        <div className="cx-legend">
          <span><i className="lg cand" />Candidate</span><span><i className="lg grp" />Outside group</span><span><i className="lg don" />Donor</span><span><i className="lg ven" />Firm paid</span><span><i className="lg race" />Race</span>
          <span><i className="lg dd" />D side</span><span><i className="lg rr" />R side</span><span><i className="ln gold" />Money moving</span><span><i className="ln opp" />Spent against</span><span><i className="ln dash" />Stops and endorsements</span>
        </div>
      </div>

      <aside className="cx-words card">
        <div className="card-h"><h3>The same ties in words</h3></div>
        <div className="card-b">
          <div className="cx-wh"><span className={`cx-kind k-${f.kind}`}>{KIND[f.kind]}</span><h4>{f.name}</h4><small>{idx.get(focus)?.length ?? 0} ties</small></div>
          <ul>{words.map((w, i) => <li key={i}>{w}</li>)}</ul>
          <div className="eye gold" style={{ marginTop: 12 }}>Biggest ties</div>
          {(idx.get(focus) ?? []).slice().sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, 8).map((e, i) => {
            const o = byId.get(e.s === focus ? e.t : e.s)!;
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
  return `${s} ${VERB[e.k] ?? e.k} ${t}${amt}`;
}
function plain(f: GNode, idx: Map<string, GEdge[]>, byId: Map<string, GNode>): string[] {
  const es = idx.get(f.id) ?? [], out: string[] = [];
  const nm = (id: string) => byId.get(id)?.name ?? id;
  const sum = (xs: GEdge[]) => xs.reduce((a, e) => a + (e.v ?? 0), 0);
  const top = (xs: GEdge[], other: (e: GEdge) => string, n = 2) => xs.sort((a, b) => (b.v ?? 0) - (a.v ?? 0)).slice(0, n).map((e) => `${nm(other(e))} ${usd(e.v)}`).join(" and ");
  if (f.kind === "candidate") {
    const run = es.find((e) => e.k === "runs"); if (run) out.push(`${f.name} is running in the ${nm(run.t)} race.`);
    const forE = es.filter((e) => e.t === f.id && e.k === "support"), ag = es.filter((e) => e.t === f.id && e.k === "oppose");
    if (forE.length) out.push(`Outside groups spent ${usd(sum(forE))} supporting ${f.name}, led by ${top(forE, (e) => e.s)}.`);
    if (ag.length) out.push(`Groups spent ${usd(sum(ag))} opposing ${f.name}, led by ${top(ag, (e) => e.s)}.`);
    const camp = es.find((e) => e.k === "campaign"); if (camp) { const paid = (idx.get(camp.s) ?? []).filter((e) => e.k === "paid"); if (paid.length) out.push(`${f.name}'s campaign, ${nm(camp.s)}, paid ${top(paid, (e) => e.t, 3)}.`); }
    const en = es.filter((e) => e.k === "endorse"); if (en.length) out.push(`Endorsed by ${en.map((e) => nm(e.s)).join(", ")}.`);
    const ra = es.filter((e) => e.k === "rally"); if (ra.length) out.push(`${ra.map((e) => `${nm(e.s)}${e.n > 1 ? ` ${e.n} times` : ""}`).join(", ")} campaigned for ${f.name}.`);
  } else if (f.kind === "group" || f.kind === "committee") {
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
