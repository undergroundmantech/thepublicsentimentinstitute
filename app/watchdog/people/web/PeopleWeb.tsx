"use client";
// The people web: one person at the center, the things that tie them to others on the first ring (their race,
// their committees, their state delegation, their donor blocs and their named donors), and the people on the other
// end of each tie on the outer ring. Click anyone to put them at the center; click a tie to list everyone on it.
// People who share more than one tie with the center are drawn once and wired to every tie they share.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ev, evSettled } from "@/app/lib/ev";
import { fileHref } from "../PersonFile";

export type WebNode = [string, string, string, string, string, string, number, string, number, string];
export type WebHub = { k: "c" | "s" | "b" | "m"; n: string; m: number[]; r?: Record<string, string> };
export type WebData = { asOf: string; nodes: WebNode[]; hubs: WebHub[]; races: [number, number][] };
type Kind = "race" | WebHub["k"];

const KIND: Record<Kind, { label: string; plural: string; note: string }> = {
  race: { label: "Race", plural: "Race", note: "The opponent on the ballot" },
  c: { label: "Committee", plural: "Committees", note: "Members of the same committee" },
  s: { label: "Delegation", plural: "State delegation", note: "Sitting members and nominees from the same state" },
  b: { label: "Donor bloc", plural: "Donor blocs", note: "The same top donor bloc in a researched file" },
  m: { label: "Donor", plural: "Shared donors", note: "The same named donor, PAC or party committee in two researched files" },
};
const OFFICE: Record<string, string> = { S: "Senate", G: "Governor", H: "House" };
const W = 820, H = 660, CX = W / 2, CY = H / 2, R1 = 150, R2 = 278, PER = 7, MAXH = 12;
const rd = (v: number) => Math.round(v * 10) / 10;
const short = (s: string, n = 26) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const lastName = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];
const where = (x: WebNode) => (x[4] === "H" && x[5] ? `${x[3]}-${x[5]}` : x[3]);
const hubName = (h: WebHub) => (h.k === "s" ? `${h.n} delegation` : h.n.replace(/^(House|Senate) Committee on /, "$1 ").replace(/^(House|Senate) (Select|Special|Permanent Select) Committee on /, "$1 $2 "));

type Ring1 = { key: string; kind: Kind; name: string; full: string; members: number[]; role?: string; a: number; x: number; y: number };
type Ring2 = { i: number; a: number; x: number; y: number; hubs: string[] };

export default function PeopleWeb({ data, start }: { data: WebData; start: string }) {
  const N = data.nodes;
  const byId = useMemo(() => new Map(N.map((x, i) => [x[0], i])), [N]);
  const hubsOf = useMemo(() => {
    const m = new Map<number, number[]>();
    data.hubs.forEach((h, hi) => h.m.forEach((i) => { const a = m.get(i) ?? []; a.push(hi); m.set(i, a); }));
    return m;
  }, [data.hubs]);
  const oppOf = useMemo(() => {
    const m = new Map<number, number[]>();
    data.races.forEach(([a, b]) => { m.set(a, [...(m.get(a) ?? []), b]); m.set(b, [...(m.get(b) ?? []), a]); });
    return m;
  }, [data.races]);
  const [focus, setFocus] = useState<number>(byId.get(start) ?? 0);
  const [on, setOn] = useState<Record<Kind, boolean>>({ race: true, c: true, s: true, b: true, m: true });
  const [hubSel, setHubSel] = useState<string | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [q, setQ] = useState("");

  // a link to this view carries the person: /watchdog/people/web?p=OH-jon-husted
  useEffect(() => {
    try { const p = new URLSearchParams(window.location.search).get("p"); if (p && byId.has(p)) setFocus(byId.get(p)!); } catch { /* no query */ }
  }, [byId]);
  const go = (i: number, from: string) => {
    setFocus(i); setHubSel(null); setHover(null); setQ("");
    try { const u = new URL(window.location.href); u.searchParams.set("p", N[i][0]); window.history.replaceState(null, "", u.toString()); } catch { /* ignore */ }
    ev("People web focus", { id: N[i][0], from });
  };

  const layout = useMemo(() => {
    const r1: Omit<Ring1, "a" | "x" | "y">[] = [];
    const opp = oppOf.get(focus) ?? [];
    if (on.race && opp.length) r1.push({ key: "race", kind: "race", name: "Race", full: `${OFFICE[N[focus][4]] ?? ""} race`.trim(), members: opp });
    const mine = (hubsOf.get(focus) ?? []).map((hi) => ({ hi, h: data.hubs[hi] })).filter(({ h }) => on[h.k]);
    const ord: Record<string, number> = { c: 0, m: 1, b: 2, s: 3 };
    mine.sort((a, b) => ord[a.h.k] - ord[b.h.k] || a.h.m.length - b.h.m.length);
    for (const { hi, h } of mine.slice(0, MAXH - r1.length)) {
      r1.push({ key: String(hi), kind: h.k, name: short(hubName(h)), full: hubName(h), members: h.m.filter((i) => i !== focus), role: h.r?.[String(focus)] });
    }
    const n1 = r1.length || 1;
    const ring1: Ring1[] = r1.map((h, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / n1; return { ...h, a, x: rd(CX + R1 * Math.cos(a)), y: rd(CY + R1 * Math.sin(a)) }; });
    // how many ties each person shares with the center: they rank the outer ring and the list on the right
    const shared = new Map<number, string[]>();
    for (const h of ring1) for (const i of h.members) shared.set(i, [...(shared.get(i) ?? []), h.key]);
    const placed = new Map<number, Ring2>();
    const more: Record<string, number> = {};
    ring1.forEach((h) => {
      const span = (2 * Math.PI) / n1;
      const pick = [...h.members].sort((a, b) => (shared.get(b)!.length - shared.get(a)!.length) || (N[b][6] - N[a][6]) || (N[b][8] - N[a][8]) || N[a][1].localeCompare(N[b][1]))
        .filter((i) => !placed.has(i)).slice(0, PER);
      more[h.key] = h.members.length - h.members.filter((i) => placed.has(i)).length - pick.length;
      pick.forEach((i, k) => {
        const a = h.a + (pick.length === 1 ? 0 : (-0.5 + k / (pick.length - 1)) * span * 0.82);
        const rr = R2 + (k % 2 ? 26 : 0);
        placed.set(i, { i, a, x: rd(CX + rr * Math.cos(a)), y: rd(CY + rr * Math.sin(a)), hubs: shared.get(i)! });
      });
    });
    const close = [...shared.entries()].sort((a, b) => b[1].length - a[1].length || N[b[0]][6] - N[a[0]][6]).slice(0, 12);
    return { ring1, ring2: [...placed.values()], more, close, shared };
  }, [focus, on, N, data.hubs, hubsOf, oppOf]);

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase(); if (t.length < 2) return [];
    return N.map((x, i) => ({ x, i })).filter(({ x }) => x[1].toLowerCase().includes(t) || where(x).toLowerCase() === t).sort((a, b) => b.x[6] - a.x[6] || b.x[8] - a.x[8]).slice(0, 8);
  }, [q, N]);
  useEffect(() => { if (q.trim().length >= 2) evSettled("pw-q", "People web search", { q: q.trim().slice(0, 60).toLowerCase(), hits: hits.length }); }, [q, hits.length]);

  const f = N[focus];
  const hl = hover != null ? new Set([...(layout.shared.get(hover) ?? [])]) : null;
  const sel = hubSel ? layout.ring1.find((h) => h.key === hubSel) : null;
  const featured = useMemo(() => N.map((x, i) => ({ x, i })).filter(({ x }) => x[6]).slice(0, 40), [N]);

  return (
    <div className="pw">
      <div className="pw-side card">
        <label htmlFor="pw-q" className="pw-k">Put someone at the center</label>
        <div className="pw-search">
          <input id="pw-q" className="wd-input" placeholder="A name, state or district" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
          {hits.length ? <ul className="pw-hits">{hits.map(({ x, i }) => <li key={x[0]}><button type="button" onClick={() => go(i, "search")}><i className={`pf-dot ${x[2].toLowerCase()}`} />{x[1]} <small>{OFFICE[x[4]] ?? ""} {where(x)}</small></button></li>)}</ul> : null}
        </div>
        <div className="pw-k">Show ties</div>
        <div className="pw-kinds">
          {(Object.keys(KIND) as Kind[]).map((k) => (
            <label key={k} className={`pw-kind ${k}`}><input type="checkbox" checked={on[k]} onChange={() => setOn((o) => ({ ...o, [k]: !o[k] }))} /><i />{KIND[k].plural}</label>
          ))}
        </div>
        <div className="pw-k">Researched files</div>
        <div className="pw-feat">{featured.map(({ x, i }) => <button key={x[0]} type="button" className={`${x[2].toLowerCase()}${i === focus ? " on" : ""}`} onClick={() => go(i, "featured")}>{lastName(x[1])} <small>{x[3]}</small></button>)}</div>
      </div>

      <div className="pw-stage card">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${f[1]} and the people tied to them through ${layout.ring1.length} connections`}>
          <circle cx={CX} cy={CY} r={R1} className="pw-orbit" /><circle cx={CX} cy={CY} r={R2} className="pw-orbit" />
          {layout.ring1.map((h) => <line key={"l" + h.key} x1={CX} y1={CY} x2={h.x} y2={h.y} className={`pw-e1 ${h.kind}${hl && !hl.has(h.key) ? " dim" : ""}`} />)}
          {layout.ring2.map((p) => p.hubs.map((hk) => { const h = layout.ring1.find((z) => z.key === hk)!; const lit = hover === p.i || hubSel === hk; return <line key={`e${p.i}-${hk}`} x1={h.x} y1={h.y} x2={p.x} y2={p.y} className={`pw-e2 ${h.kind}${lit ? " lit" : ""}${(hover != null && hover !== p.i) || (hubSel && hubSel !== hk) ? " dim" : ""}`} />; }))}
          {layout.ring2.map((p) => {
            const x = N[p.i], right = Math.cos(p.a) >= 0, dim = (hover != null && hover !== p.i) || (hubSel && !p.hubs.includes(hubSel));
            return (
              <g key={x[0]} className={`pw-p ${x[2].toLowerCase()}${dim ? " dim" : ""}`} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}
                tabIndex={0} role="button" aria-label={`${x[1]}, ${p.hubs.length} shared tie${p.hubs.length > 1 ? "s" : ""}. Put at the center`}
                onClick={() => go(p.i, "graph")} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(p.i, "graph"); } }}
                onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(p.i)} onBlur={() => setHover(null)}>
                <circle r={5 + Math.min(4, p.hubs.length * 1.4)} className={x[6] ? "hand" : ""} />
                <text x={right ? 11 : -11} y={4} textAnchor={right ? "start" : "end"}>{lastName(x[1])}{p.hubs.length > 1 ? ` ×${p.hubs.length}` : ""}</text>
              </g>
            );
          })}
          {layout.ring1.map((h) => {
            const right = Math.cos(h.a) >= -0.01, more = layout.more[h.key];
            return (
              <g key={"h" + h.key} className={`pw-h ${h.kind}${hubSel === h.key ? " on" : ""}${hl && !hl.has(h.key) ? " dim" : ""}`} style={{ transform: `translate(${h.x}px, ${h.y}px)` }}
                tabIndex={0} role="button" aria-label={`${h.full}: ${h.members.length} ${h.members.length === 1 ? "person" : "people"}. List them`}
                onClick={() => setHubSel((s) => (s === h.key ? null : h.key))} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setHubSel((s) => (s === h.key ? null : h.key)); } }}>
                <rect x={-7} y={-7} width={14} height={14} transform="rotate(45)" />
                <text x={right ? 12 : -12} y={-2} textAnchor={right ? "start" : "end"} className="nm">{h.name}</text>
                <text x={right ? 12 : -12} y={10} textAnchor={right ? "start" : "end"} className="sub">{KIND[h.kind].label}{h.role ? `, ${h.role}` : ""} · {h.members.length}{more > 0 ? `, ${more} more` : ""}</text>
              </g>
            );
          })}
          <g className={`pw-c ${f[2].toLowerCase()}`} style={{ transform: `translate(${CX}px, ${CY}px)` }}>
            <circle r={30} /><text y={-2} textAnchor="middle" className="nm">{short(lastName(f[1]), 14)}</text><text y={13} textAnchor="middle" className="sub">{OFFICE[f[4]] ?? ""} {where(f)}</text>
          </g>
          {!layout.ring1.length ? <text x={CX} y={CY + 64} textAnchor="middle" className="pw-empty">No ties on file for the ties you have switched on.</text> : null}
        </svg>
        <p className="pw-cap">Diamonds are ties, circles are people. A bigger circle shares more ties with the center, and a filled ring marks a researched file. Click a diamond to list everyone on it; click a person to move them to the center.</p>
      </div>

      <div className="pw-info card">
        <div className={`pw-who ${f[2].toLowerCase()}`}>
          <span className="pw-k">{OFFICE[f[4]] ? `${OFFICE[f[4]]} · ${where(f)}` : f[3]}</span>
          <b>{f[1]}</b>
          <small>{f[9] && f[9] !== "none" ? `Now: ${f[9]}` : "Not in office"}{f[7] ? ` · ${f[7]}` : ""}</small>
          <div className="pw-acts">
            <Link className="wd-btn" href={fileHref(f[0], !!f[6])}>{f[6] ? "Open the full file" : "Open the file"}</Link>
          </div>
        </div>
        {sel ? (
          <div className="pw-list">
            <div className="pw-k">{KIND[sel.kind].label}: {sel.full}</div>
            <small className="pf-mute">{KIND[sel.kind].note}. {sel.members.length} {sel.members.length === 1 ? "person" : "people"} besides {lastName(f[1])}.</small>
            <ul>{sel.members.slice().sort((a, b) => N[b][6] - N[a][6] || N[a][1].localeCompare(N[b][1])).map((i) => <li key={i}><button type="button" onClick={() => go(i, "hub list")}><i className={`pf-dot ${N[i][2].toLowerCase()}`} />{N[i][1]}<small>{OFFICE[N[i][4]] ?? ""} {where(N[i])}</small></button></li>)}</ul>
            <button type="button" className="wd-btn" onClick={() => setHubSel(null)}>Back to closest ties</button>
          </div>
        ) : (
          <div className="pw-list">
            <div className="pw-k">Most connected to {lastName(f[1])}</div>
            {layout.close.length ? <ul>{layout.close.map(([i, ks]) => (
              <li key={i}><button type="button" onClick={() => go(i, "closest")} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
                <i className={`pf-dot ${N[i][2].toLowerCase()}`} />{N[i][1]}
                <small>{ks.map((k) => (k === "race" ? "Opponent" : short(hubName(data.hubs[Number(k)]), 30))).join(" · ")}</small>
              </button></li>
            ))}</ul> : <small className="pf-mute">No ties on file yet. Files marked roster and levers gain donor ties as the FEC pipeline runs.</small>}
          </div>
        )}
      </div>
    </div>
  );
}
