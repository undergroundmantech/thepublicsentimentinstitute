"use client";
// Connections: a map of who is tied to whom in the 2026 midterms, built so anyone can read it.
//
// One name sits in the middle and everyone tied to it gathers around. Every line is one tie, and every kind of tie
// has its own color and line style, named in the key under the map with a real example sentence. Hover or focus a
// line or a name and its direct ties light up while the rest fades, with a card that says the tie in a sentence.
// Click a name to put it in the middle; the panel beside the map lists all of its ties as sentences, grouped and
// sorted by size, and each one jumps to the other name. The first view opens on a guided story that traces a chain
// of money from a donor to the race it lands in.
//
// Oct 23 2026: rebuilt for readers who have never seen a network map. Labels only show for the center's own ties,
// the story and the biggest names, the rest on hover, and the layout gives every shown label its own box.
import FloatTip, { WD_SCOPE } from "@/app/components/opp/FloatTip";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/Link";
import PersonToken, { PARTY_COLOR } from "../PersonToken";
import type { Graph, GNode, GEdge } from "../data";
import { ev } from "@/app/lib/ev";

/* ---------------------------------------------------------------- words */
const usd = (n: number | null | undefined) => (n == null ? "" : n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const KIND: Record<string, string> = { race: "Race", candidate: "Candidate", group: "Outside group", donor: "Donor", vendor: "Firm", person: "Public figure", committee: "Campaign committee" };
const ST: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const raceName = (s: string) => { const m = /^([A-Z]{2})\s+(.*)$/.exec(s); return m && ST[m[1]] ? `${ST[m[1]]} ${m[2]}` : s; };
const disp = (n: GNode | undefined, id = "") => (n ? (n.kind === "race" ? `the ${raceName(n.name)} race` : n.name) : id.replace(/^\w:/, ""));
const label = (n: GNode | undefined) => (!n ? "" : n.kind === "race" ? raceName(n.name) : n.name);
const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };
const SIDE: Record<string, string> = { D: "backs Democrats", R: "backs Republicans", I: "backs an independent" };
const ROLE = (r?: string) => (!r ? "" : r === "group" ? "Group or organization" : r === "surrogate" ? "Campaign surrogate" : r[0].toUpperCase() + r.slice(1));
function about(n: GNode) {
  const side = n.side && PARTY[n.side];
  if (n.kind === "candidate") return [KIND.candidate, side, n.race ? `${raceName(n.race)} race` : ""].filter(Boolean).join(", ");
  if (n.kind === "group") return [KIND.group, n.side && SIDE[n.side]].filter(Boolean).join(", ");
  if (n.kind === "person") return [ROLE(n.role) || KIND.person, side].filter(Boolean).join(", ");
  if (n.kind === "vendor") return n.what && n.what !== "other" ? `Firm, ${n.what}` : "Firm paid by campaigns or groups";
  if (n.kind === "race") return "Race on the 2026 ballot";
  return KIND[n.kind] ?? "";
}
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return "source"; } };
const niceDate = (s: string) => s.replace(/(\d{4})-(\d{2})-(\d{2})/g, (_, y, m, d) => new Date(`${y}-${m}-${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }));
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

/* ---------------------------------------------------------------- the kinds of ties */
type TieKey = "gave" | "support" | "oppose" | "paid" | "rally" | "endorse" | "attention" | "runs" | "campaign";
type TieType = { k: TieKey; label: string; money: boolean; dash?: string; what: string };
const TIES: TieType[] = [
  { k: "gave", label: "Money given", money: true, what: "A donor or group gave money to a group or campaign." },
  { k: "support", label: "Spent supporting", money: true, what: "An outside group spent money to help a candidate win." },
  { k: "oppose", label: "Spent opposing", money: true, dash: "11 5", what: "An outside group spent money to help a candidate lose." },
  { k: "paid", label: "Paid a firm", money: true, dash: "7 3 1.5 3", what: "A campaign or group paid a firm for ads, mail, polling or advice." },
  { k: "rally", label: "Campaign appearance", money: false, dash: "5 4", what: "A national figure held a rally or event for a candidate." },
  { k: "endorse", label: "Endorsement", money: false, dash: "1.5 4.5", what: "A public statement of support. No money moves." },
  { k: "attention", label: "Media attention", money: false, dash: "1.5 3.5 6 3.5", what: "A host, podcaster or public figure put a race in front of their audience." },
  { k: "runs", label: "Running in a race", money: false, what: "The candidate is on the ballot in that race." },
  { k: "campaign", label: "Own campaign", money: false, what: "The committee is the candidate's own campaign." },
];
const TIE = Object.fromEntries(TIES.map((t) => [t.k, t])) as Record<TieKey, TieType>;
const MONEY = new Set<string>(["gave", "paid", "support", "oppose"]);
const ekey = (e: GEdge) => `${e.s}|${e.t}|${e.k}`;
const sideColor = (s: string | null | undefined) => (s && PARTY_COLOR[s]) || "#9a93ad";

/** One tie as a sentence, in pieces so names can be bold and the amount can stand out. */
type Part = string | { id: string } | { amt: number };
function sentence(e: GEdge): Part[] {
  const S = { id: e.s }, T = { id: e.t }, A = e.v ? { amt: e.v } : null;
  switch (e.k) {
    case "gave": return A ? [S, " gave ", A, " to ", T] : [S, " gave money to ", T];
    case "support": return A ? [S, " spent ", A, " supporting ", T] : [S, " spent money supporting ", T];
    case "oppose": return A ? [S, " spent ", A, " opposing ", T] : [S, " spent money opposing ", T];
    case "paid": return A ? [S, " paid ", A, " to ", T] : [S, " paid ", T];
    case "rally": return [S, " campaigned for ", T, e.n > 1 ? `, ${e.n} stops` : ", 1 stop"];
    case "endorse": return [S, " endorsed ", T];
    case "attention": return [S, " put attention on ", T];
    case "runs": return [S, " is running in ", T];
    case "campaign": return [S, " is the campaign committee of ", T];
    default: return [S, ` ${e.k} `, T];
  }
}
const stop = (s: string) => (/[.!?]$/.test(s) ? s : s + ".");
const plainOf = (e: GEdge, byId: Map<string, GNode>) => stop(sentence(e).map((p) => (typeof p === "string" ? p : "id" in p ? disp(byId.get(p.id), p.id) : usd(p.amt))).join(""));
function Say({ e, byId, me }: { e: GEdge; byId: Map<string, GNode>; me?: string }) {
  const parts = sentence(e), last = parts[parts.length - 1];
  const ends = (typeof last === "string" ? last : "id" in last ? disp(byId.get(last.id), last.id) : "").trim();
  return <>{parts.map((p, i) => (typeof p === "string" ? <React.Fragment key={i}>{p}</React.Fragment> : "id" in p ? <b key={i} className={p.id === me ? "me" : undefined}>{disp(byId.get(p.id), p.id)}</b> : <em key={i} className="amt">{usd(p.amt)}</em>))}{/[.!?]$/.test(ends) ? "" : "."}</>;
}
/** The detail worth reading on a tie: where and when the stops were, what a host said, when an endorsement came. */
function detail(e: GEdge): string[] {
  if (e.k === "rally") return e.notes.slice(0, 4).map((x) => cap(niceDate(x)));
  if (e.k === "attention") return e.notes.slice(0, 2);
  if (e.k === "endorse") { const d = e.notes.join(" ").match(/\d{4}-\d{2}-\d{2}/); return d ? [`Reported ${niceDate(d[0])}`] : []; }
  return [];
}
function Source({ e }: { e: GEdge }) {
  if (e.src && /^https?:/.test(e.src)) return <a className="cx-src" href={e.src} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Source: {host(e.src)}</a>;
  if (e.src === "Ledger") return <span className="cx-src">Source: FEC filings, via Ledger</span>;
  if (MONEY.has(e.k)) return <span className="cx-src">Source: FEC filings</span>;
  return null;
}
/** A short sample of a line style, for the key, the cards and the panel headers. */
function Swatch({ k, w = 34 }: { k: TieKey; w?: number }) {
  const t = TIE[k];
  return <svg className={`cx-sw t-${k}`} width={w} height="10" viewBox={`0 0 ${w} 10`} aria-hidden="true"><path d={`M1 5 H${w - 1}`} strokeDasharray={t.dash} strokeWidth={t.money ? 3 : 2} strokeLinecap={k === "endorse" || k === "attention" ? "round" : "butt"} />{t.money ? <path d={`M${w / 2 - 3} 1.5 L${w / 2 + 2.5} 5 L${w / 2 - 3} 8.5`} className="chev" /> : null}</svg>;
}

/* ---------------------------------------------------------------- the Ledger snapshot, merged in when it is on the site */
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
  const edges = new Map(graph.edges.map((e) => [ekey(e), e]));
  const candByName = new Map<string, string>();
  for (const n of graph.nodes) if (n.kind === "candidate") candByName.set(normName(n.name), n.id);
  const idOf = new Map<string, string>();
  for (const n of web.nodes) {
    const lab = titleCase(n.label || "");
    if (!lab || /^fec:/i.test(lab)) continue;
    let id: string;
    if (n.kind === "candidate") id = candByName.get(normName(lab)) ?? `c:${lab}`;
    else if (n.kind === "committee") id = `k:${lab}`;
    else if (n.kind === "vendor") id = `v:${lab}`;
    else id = `d:${lab}`;
    idOf.set(n.key, id);
    if (!nodes.has(id)) nodes.set(id, { id, kind: n.kind === "candidate" ? "candidate" : n.kind === "committee" ? "committee" : n.kind === "vendor" ? "vendor" : "donor", name: lab, side: sideOf(n.side) } as GNode);
  }
  const K: Record<string, string> = { runs: "campaign", gave: "gave", paid: "paid", for: "support", against: "oppose" };
  for (const e of web.edges) {
    const s = idOf.get(e.source), t = idOf.get(e.target), k = K[e.kind];
    if (!s || !t || !k || s === t) continue;
    const key = `${s}|${t}|${k}`;
    if (edges.has(key)) continue;
    edges.set(key, { s, t, k, v: e.value || null, n: 1, notes: [], src: "Ledger" } as GEdge);
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/* ---------------------------------------------------------------- who joins the map */
type Caps = { first: number; people: number; ring: number; per: number };
function ego(idx: Map<string, GEdge[]>, byId: Map<string, GNode>, focus: string, focus2: string | null, on: Set<string>, caps: Caps, force: GEdge[]) {
  const keep = new Map<string, number>();
  keep.set(focus, 0); if (focus2) keep.set(focus2, 0);
  const edges: GEdge[] = [];
  const otherOf = (e: GEdge, id: string) => (e.s === id ? e.t : e.s);
  const add = (id: string, depth: number, cap: number, capPeople: number) => {
    const es = (idx.get(id) ?? []).filter((e) => on.has(e.k));
    // the campaign committee and the money first, biggest first, then the busiest people
    const rank = (e: GEdge) => (e.k === "campaign" ? 1e15 : MONEY.has(e.k) ? 1e12 + (e.v ?? 0) : e.k === "runs" ? 1e11 : (idx.get(otherOf(e, id))?.length ?? 0) + (e.k === "rally" ? 500 + e.n : 0));
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
  add(focus, 1, caps.first, caps.people); if (focus2) add(focus2, 1, Math.round(caps.first * 0.7), Math.round(caps.people * 0.6));
  const first = [...keep.entries()].filter(([, d]) => d === 1).map(([id]) => id);
  for (const id of first) if (byId.get(id)?.kind === "committee") add(id, 2, caps.per + 3, 0);
  const scored = first.filter((id) => byId.get(id)?.kind !== "person" && byId.get(id)?.kind !== "committee")
    .map((id) => ({ id, w: (idx.get(id) ?? []).filter((e) => on.has(e.k)).reduce((a, e) => a + (e.v ?? 0), 0) })).filter((x) => x.w > 0).sort((a, b) => b.w - a.w).slice(0, caps.ring);
  for (const { id } of scored) add(id, 2, caps.per, 0);
  // a guided story can reach one step further than the map would on its own
  for (const e of force) { for (const id of [e.s, e.t]) if (!keep.has(id)) keep.set(id, 2); edges.push(e); }
  const ids = new Set(keep.keys());
  const uniq = new Map<string, GEdge>();
  for (const e of edges) if (ids.has(e.s) && ids.has(e.t)) uniq.set(ekey(e), e);
  return { ids, depth: keep, edges: [...uniq.values()] };
}

/* ---------------------------------------------------------------- layout: sectors by kind, then label boxes that never overlap */
type LNode = GNode & { x: number; y: number; vx: number; vy: number; r: number; weight: number; fixed?: boolean; bw: number; bh: number; lines: string[]; showLabel: boolean };
type Pt = { x: number; y: number };
const SECTOR: Record<string, number> = { committee: -0.5, vendor: -0.15, group: 0.25, donor: 0.6, race: 1.0, candidate: 1.35, person: 2.3 };
function wrap(s: string, max = 17): string[] {
  const t = s.length > 44 ? s.slice(0, 42) + "…" : s;
  if (t.length <= max) return [t];
  const words = t.split(" "); let a = "";
  for (const w of words) { if ((a + " " + w).trim().length > Math.max(max, t.length / 2 + 2) && a) break; a = (a + " " + w).trim(); }
  const b = t.slice(a.length).trim();
  return b ? [a, b.length > max + 8 ? b.slice(0, max + 6) + "…" : b] : [a];
}
function layout(nodes: LNode[], edges: GEdge[], focus: string, focus2: string | null, W: number, H: number, depth: Map<string, number>) {
  const by = new Map(nodes.map((n) => [n.id, n]));
  const cx = W / 2, cy = H / 2, R = Math.min(W * 0.46, H * 0.62), wide = W / H > 1.3 ? 1.25 : 1;
  const groups = new Map<string, LNode[]>();
  for (const n of nodes) { if (n.id === focus || n.id === focus2) continue; const k = n.kind + "|" + (depth.get(n.id) ?? 1); (groups.get(k) ?? groups.set(k, []).get(k)!).push(n); }
  for (const n of nodes) {
    if (n.id === focus) { n.x = focus2 ? cx - W * 0.16 : cx; n.y = cy; n.fixed = true; }
    if (n.id === focus2) { n.x = cx + W * 0.16; n.y = cy; n.fixed = true; }
  }
  for (const [k, list] of groups) {
    // a crowded kind fans out wider and over more rows, biggest nearest the middle
    const [kind, d] = k.split("|"), base = SECTOR[kind] ?? 0, many = list.length > 10;
    const spread = kind === "person" ? 1.5 : Math.min(1.05, 0.55 + Math.max(0, list.length - 6) * 0.03), rowsN = many ? 4 : 3;
    list.sort((a, b) => b.weight - a.weight);
    list.forEach((n, i) => {
      const a = base * Math.PI + (list.length > 1 ? (i / (list.length - 1) - 0.5) * spread * Math.PI : 0);
      const rr = R * (Number(d) === 2 ? 0.97 : 0.56) * (0.84 + (i % rowsN) * (many ? 0.09 : 0.08));
      n.x = cx + Math.cos(a) * rr * wide; n.y = cy + Math.sin(a) * rr * 0.82;
    });
  }
  const N = 240;
  for (let it = 0; it < N; it++) {
    const alpha = 1 - it / N;
    for (const e of edges) {
      const a = by.get(e.s), b = by.get(e.t); if (!a || !b) continue;
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy)), want = R * 0.42 + (a.r + b.r);
      const f = ((d - want) / d) * 0.02 * alpha;
      if (!a.fixed) { a.vx += dx * f; a.vy += dy * f; } if (!b.fixed) { b.vx -= dx * f; b.vy -= dy * f; }
    }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      const ox = (a.bw + b.bw) / 2 + 8 - Math.abs(b.x - a.x), oy = (a.bh + b.bh) / 2 + 6 - Math.abs(b.y - a.y);
      if (ox > 0 && oy > 0) {   // two label boxes overlap: push them apart along the shorter way out
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
      // the box hangs below the shape (the label sits under it), so keep the whole box on the stage
      n.x = Math.max(n.bw / 2 + 6, Math.min(W - n.bw / 2 - 6, n.x)); n.y = Math.max(n.r + 8, Math.min(H - (n.bh - n.r) - 30, n.y));
    }
  }
}

/* ---------------------------------------------------------------- guided stories */
type Story = { id: string; title: string; focus: string; path: [string, string, string][]; only?: TieKey[] };
const STORIES: Story[] = [
  { id: "talarico", title: "Who is spending to beat James Talarico?", focus: "c:James Talarico", path: [["d:Elon Musk", "g:Senate Leadership Fund", "gave"], ["g:Senate Leadership Fund", "g:Texas PAC", "gave"], ["g:Texas PAC", "c:James Talarico", "oppose"]] },
  { id: "musk", title: "Where did Elon Musk's money go?", focus: "d:Elon Musk", path: [["d:Elon Musk", "g:America PAC", "gave"], ["g:America PAC", "c:James Talarico", "oppose"]] },
  { id: "crypto", title: "How does crypto money reach a Senate race?", focus: "g:Fairshake", path: [["d:Ripple Labs Inc.", "g:Fairshake", "gave"], ["g:Fairshake", "g:Defend American Jobs", "gave"], ["g:Defend American Jobs", "c:Jon Husted", "support"]] },
  { id: "brown", title: "Who paid to stop Sherrod Brown?", focus: "c:Sherrod Brown", path: [["d:Elon Musk", "g:Senate Leadership Fund", "gave"], ["g:Senate Leadership Fund", "c:Sherrod Brown", "oppose"]] },
  { id: "loop", title: "Which firm is paid by the group it funds?", focus: "g:America PAC", path: [["d:United States of America Inc.", "g:America PAC", "gave"], ["g:America PAC", "v:United States of America Inc.", "paid"]] },
  { id: "trump", title: "Where is Trump campaigning?", focus: "p:Donald Trump", path: [["p:Donald Trump", "c:Ken Paxton", "rally"]], only: ["rally", "endorse"] },
];

type Hot = { node: string } | { edge: string } | null;
const ALL_ON = new Set<string>(TIES.map((t) => t.k));

export default function Connections({ graph: graph0, initial = "c:James Talarico" }: { graph: Graph; initial?: string }) {
  const [web, setWeb] = useState<LWeb | null>(null);
  useEffect(() => { fetch("/watchdog/ledger-data/web_all.json").then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.nodes?.length) setWeb(j); }).catch(() => {}); }, []);
  const graph = useMemo(() => (web ? mergeLedger(graph0, web) : graph0), [graph0, web]);
  const idx = useMemo(() => { const m = new Map<string, GEdge[]>(); for (const e of graph.edges) { (m.get(e.s) ?? m.set(e.s, []).get(e.s)!).push(e); (m.get(e.t) ?? m.set(e.t, []).get(e.t)!).push(e); } return m; }, [graph]);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const byKey = useMemo(() => new Map(graph.edges.map((e) => [ekey(e), e])), [graph]);
  const stories = useMemo(() => STORIES.filter((s) => byId.has(s.focus) && s.path.every(([a, b, k]) => byKey.has(`${a}|${b}|${k}`))), [byId, byKey]);

  const [focus, setFocus] = useState(initial);
  const [focus2, setFocus2] = useState<string | null>(null);
  const [trail, setTrail] = useState<string[]>([]);
  const [story, setStory] = useState<string | null>("talarico");      // the story the reading card tells
  const [storyBase, setStoryBase] = useState<string | null>("talarico"); // the story whose names stay on the map
  const [pin, setPin] = useState<string | null>(null);
  const [on, setOn] = useState<Set<string>>(ALL_ON);
  const [hot, setHot] = useState<Hot>(null);
  const [tipAt, setTipAt] = useState<Pt | null>(null);
  const [q, setQ] = useState(""), [q2, setQ2] = useState(""), [qi, setQi] = useState(0);
  const [reduce, setReduce] = useState(false);
  const [flow, setFlow] = useState(true);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [pos, setPos] = useState<Record<string, Pt>>({});
  const [size, setSize] = useState({ W: 1100, H: 720 });
  const [fitTick, setFitTick] = useState(0);
  const [openG, setOpenG] = useState<Set<string>>(new Set());
  const prev = useRef<Record<string, Pt>>({});
  const svgRef = useRef<SVGSVGElement>(null), stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string | null; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const moved = useRef(false);

  const pathOf = useCallback((id: string | null) => { const s = stories.find((x) => x.id === id); return s ? s.path.map(([a, b, k]) => byKey.get(`${a}|${b}|${k}`)!).filter(Boolean) : []; }, [stories, byKey]);
  const st = stories.find((s) => s.id === story) ?? null;
  const storyEdges = useMemo(() => pathOf(story), [pathOf, story]);
  const forced = useMemo(() => { const s = stories.find((x) => x.id === storyBase); return s && s.focus === focus ? pathOf(storyBase) : []; }, [stories, storyBase, focus, pathOf]);

  // first view: a name from the link, or else the guided story
  useEffect(() => {
    try { const p = new URLSearchParams(window.location.search).get("name"); if (p && byId.has(p)) { setFocus(p); setStory(null); setStoryBase(null); } } catch { /* no window */ }
    try { const m = window.matchMedia("(prefers-reduced-motion: reduce)"); setReduce(m.matches); setFlow(!m.matches); } catch { /* old browser */ }
  }, [byId]);
  useEffect(() => {
    const el = stageRef.current; if (!el) return;
    const ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); setSize({ W: Math.max(300, Math.round(r.width)), H: Math.max(400, Math.round(r.height)) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const { W, H } = size;
  const compact = W < 720;
  const [big, setBig] = useState(false);
  useEffect(() => {
    if (!big) return;
    // the page wrappers keep an identity transform from their entry animation, which would trap a fixed element
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setBig(false); };
    window.addEventListener("keydown", k); document.body.style.overflow = "hidden"; document.documentElement.classList.add("cx-fs");
    return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; document.documentElement.classList.remove("cx-fs"); };
  }, [big]);
  const setUrl = (id: string | null) => { try { const u = new URL(window.location.href); if (id) u.searchParams.set("name", id); else u.searchParams.delete("name"); window.history.replaceState(null, "", u.toString()); } catch { /* no window */ } };

  /** Put a name in the middle. Leaves the story and keeps a trail so the reader can step back. */
  const go = (id: string) => {
    if (!byId.has(id)) return;
    { const n = byId.get(id)!; ev("Connections focus", { who: n.name, kind: n.kind }); }
    if (id !== focus) setTrail((t) => [...t.filter((x) => x !== id), focus].slice(-6));
    setFocus(id); setStory(null); setStoryBase(null); setPin(null); setHot(null); setTipAt(null); setOpenG(new Set());
    if (focus2 === id) setFocus2(null);
    setUrl(id);
  };
  const playStory = (s: Story | undefined) => {
    if (!s) return;
    ev("Connections story", { story: s.id });
    if (s.focus !== focus) setTrail((t) => [...t.filter((x) => x !== s.focus), focus].slice(-6));
    setFocus(s.focus); setStory(s.id); setStoryBase(s.id); setPin(null); setHot(null); setFocus2(null); setOpenG(new Set());
    setOn(s.only ? new Set<string>([...s.only, "runs", "campaign"]) : ALL_ON);
    setUrl(null);
  };
  const back = () => { const t = [...trail]; const id = t.pop(); if (!id) return; setTrail(t); setFocus(id); setStory(null); setStoryBase(null); setPin(null); setHot(null); setUrl(id); };

  // a name with dozens of ties gets fewer second step names and a taller map, so nothing piles up
  const degree = useMemo(() => (idx.get(focus) ?? []).filter((e) => on.has(e.k)).length, [idx, focus, on]);
  const busy = degree > 30;
  const net = useMemo(() => {
    const caps: Caps = compact ? { first: 10, people: 5, ring: 2, per: 2 }
      : big ? { first: 30, people: 16, ring: busy ? 5 : 8, per: 3 }
      : busy ? { first: 18, people: 10, ring: 2, per: 2 } : { first: 20, people: 12, ring: 6, per: 3 };
    const e = ego(idx, byId, focus, focus2, on, caps, forced);
    const wt = new Map<string, number>();
    for (const x of e.edges) { wt.set(x.s, (wt.get(x.s) ?? 0) + (x.v ?? 0)); wt.set(x.t, (wt.get(x.t) ?? 0) + (x.v ?? 0)); }
    const maxW = Math.max(1, ...wt.values());
    // labels: the center, the names tied straight to it, the story, and the biggest of the rest
    const storyIds = new Set(forced.flatMap((x) => [x.s, x.t]));
    const d1 = [...e.ids].filter((id) => e.depth.get(id) === 1).sort((a, b) => (wt.get(b) ?? 0) - (wt.get(a) ?? 0));
    const d2 = [...e.ids].filter((id) => e.depth.get(id) === 2).sort((a, b) => (wt.get(b) ?? 0) - (wt.get(a) ?? 0));
    const lab = new Set<string>([focus, ...(focus2 ? [focus2] : []), ...storyIds, ...d1.slice(0, compact ? 8 : big ? 46 : 40), ...d2.slice(0, compact || busy ? 0 : big ? 8 : 4)]);
    const charW = compact ? 6.5 : 6.9;
    const nodes: LNode[] = [...e.ids].map((id) => {
      const n = byId.get(id)!; const w = wt.get(id) ?? 0, isF = id === focus || id === focus2;
      const r = isF ? (compact ? 22 : 28) : n.kind === "person" ? (compact ? 13 : 16) : (compact ? 7 : 9) + Math.sqrt(w / maxW) * (compact ? 11 : 15);
      const showLabel = lab.has(id);
      const lines = wrap(label(n), isF ? 22 : compact ? 15 : 17);
      const lw = Math.max(...lines.map((l) => l.length)) * (isF ? charW * 1.2 : charW);
      return { ...n, x: 0, y: 0, vx: 0, vy: 0, r, weight: w, showLabel, lines,
        bw: showLabel ? Math.max(r * 2 + 6, lw + 8) : r * 2 + 8, bh: showLabel ? r * 2 + 8 + lines.length * (isF ? 16 : 13) : r * 2 + 8 };
    });
    layout(nodes, e.edges, focus, focus2, W, H, e.depth);
    return { nodes, edges: e.edges };
  }, [idx, byId, focus, focus2, on, W, H, compact, forced, big, busy]);

  // glide from the last layout to the new one
  useEffect(() => {
    const from = prev.current, to: Record<string, Pt> = {};
    for (const n of net.nodes) to[n.id] = { x: n.x, y: n.y };
    const start = performance.now(); let raf = 0;
    const step = (now: number) => {
      const k = reduce ? 1 : Math.min(1, (now - start) / 850), ez = 1 - Math.pow(1 - k, 3);
      const cur: Record<string, Pt> = {};
      for (const n of net.nodes) { const a = from[n.id] ?? from[focus] ?? { x: W / 2, y: H / 2 }; cur[n.id] = { x: a.x + (to[n.id].x - a.x) * ez, y: a.y + (to[n.id].y - a.y) * ez }; }
      setPos(cur);
      if (k < 1) raf = requestAnimationFrame(step); else prev.current = to;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [net, focus, W, H, reduce, fitTick]);

  /* dragging names, panning and zooming */
  const toSvg = useCallback((cx: number, cy: number) => {
    const svg = svgRef.current; if (!svg) return { x: 0, y: 0 };
    const r = svg.getBoundingClientRect();
    return { x: ((cx - r.left) / r.width) * W, y: ((cy - r.top) / r.height) * H };
  }, [W, H]);
  const onDown = (ev: React.PointerEvent, id: string | null) => {
    if (ev.button > 0) return;
    ev.stopPropagation();
    const p = toSvg(ev.clientX, ev.clientY);
    drag.current = { id, sx: p.x, sy: p.y, ox: id ? pos[id]?.x ?? 0 : view.x, oy: id ? pos[id]?.y ?? 0 : view.y, moved: false };
    moved.current = false;
  };
  const onMove = (ev: React.PointerEvent) => {
    const d = drag.current; if (!d) return;
    const p = toSvg(ev.clientX, ev.clientY), dx = p.x - d.sx, dy = p.y - d.sy;
    if (!d.moved && Math.abs(dx) + Math.abs(dy) > 5) { d.moved = true; moved.current = true; try { svgRef.current?.setPointerCapture(ev.pointerId); } catch { /* gone */ } setTipAt(null); }
    if (!d.moved) return;
    if (d.id) { const id = d.id, x = d.ox + dx / view.k, y = d.oy + dy / view.k; setPos((cur) => ({ ...cur, [id]: { x, y } })); prev.current = { ...prev.current, [id]: { x, y } }; }
    else setView((v) => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
  };
  const onUp = (ev: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (d && d.id && !d.moved) go(d.id);
    try { svgRef.current?.releasePointerCapture(ev.pointerId); } catch { /* not captured */ }
  };
  const zoomBy = (f: number) => setView((v) => { const k = Math.max(0.5, Math.min(3, v.k * f)), r = k / v.k; return { k, x: W / 2 - (W / 2 - v.x) * r, y: H / 2 - (H / 2 - v.y) * r }; });
  const onWheel = (ev: React.WheelEvent) => {
    if (!ev.ctrlKey && !ev.metaKey) return;
    const p = toSvg(ev.clientX, ev.clientY), f = ev.deltaY < 0 ? 1.12 : 1 / 1.12;
    setView((v) => { const k = Math.max(0.5, Math.min(3, v.k * f)), r = k / v.k; return { k, x: p.x - (p.x - v.x) * r, y: p.y - (p.y - v.y) * r }; });
  };
  useEffect(() => { const el = stageRef.current; if (!el) return; const stop = (e: WheelEvent) => { if (e.ctrlKey || e.metaKey) e.preventDefault(); }; el.addEventListener("wheel", stop, { passive: false }); return () => el.removeEventListener("wheel", stop); }, []);
  const fit = () => { setView({ k: 1, x: 0, y: 0 }); setFitTick((x) => x + 1); };

  /* what is lit: a hovered name or line first, then a line the reader clicked, then the story */
  const lit = useMemo(() => {
    const edges = new Set<string>(), nodes = new Set<string>();
    let mode: "hot" | "pin" | "story" | null = null;
    if (hot && "node" in hot) { mode = "hot"; nodes.add(hot.node); for (const e of net.edges) if (e.s === hot.node || e.t === hot.node) { edges.add(ekey(e)); nodes.add(e.s); nodes.add(e.t); } }
    else if (hot && "edge" in hot) { const e = byKey.get(hot.edge); if (e) { mode = "hot"; edges.add(hot.edge); nodes.add(e.s); nodes.add(e.t); } }
    else if (pin) { const e = byKey.get(pin); if (e) { mode = "pin"; edges.add(pin); nodes.add(e.s); nodes.add(e.t); } }
    else if (storyEdges.length) { mode = "story"; for (const e of storyEdges) { edges.add(ekey(e)); nodes.add(e.s); nodes.add(e.t); } }
    return { edges, nodes, mode };
  }, [hot, pin, storyEdges, net.edges, byKey]);
  const order = useMemo(() => new Map(storyEdges.map((e, i) => [ekey(e), i])), [storyEdges]);

  /* search */
  const sugg = (s: string) => { const k = s.trim().toLowerCase(); if (k.length < 2) return [] as GNode[]; return graph.nodes.filter((n) => n.name.toLowerCase().includes(k) || (n.kind === "race" && raceName(n.name).toLowerCase().includes(k))).sort((a, b) => (a.name.toLowerCase().startsWith(k) ? 0 : 1) - (b.name.toLowerCase().startsWith(k) ? 0 : 1) || (idx.get(b.id)?.length ?? 0) - (idx.get(a.id)?.length ?? 0)).slice(0, 8); };
  const found = sugg(q), found2 = sugg(q2);
  const onSearchKey = (ev: React.KeyboardEvent, list: GNode[], pick: (n: GNode) => void, clear: () => void) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setQi((i) => Math.min(list.length - 1, i + 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setQi((i) => Math.max(0, i - 1)); }
    else if (ev.key === "Enter" && list.length) { ev.preventDefault(); pick(list[Math.min(qi, list.length - 1)]); }
    else if (ev.key === "Escape") clear();
  };

  /* the name in the middle, in words */
  const f = byId.get(focus) ?? graph.nodes[0];
  const fTies = useMemo(() => idx.get(focus) ?? [], [idx, focus]);
  const onMap = useMemo(() => new Set(net.edges.map(ekey)), [net.edges]);
  const groups = useMemo(() => {
    const m = new Map<string, { k: TieKey; dir: "out" | "in"; list: GEdge[]; total: number }>();
    for (const e of fTies) {
      if (!on.has(e.k) || !TIE[e.k as TieKey]) continue;
      const dir = e.s === focus ? "out" : "in", key = `${e.k}:${dir}`;
      const g = m.get(key) ?? { k: e.k as TieKey, dir, list: [], total: 0 };
      g.list.push(e); g.total += e.v ?? 0; m.set(key, g);
    }
    const rank = (g: { k: TieKey; total: number; list: GEdge[] }) => (g.k === "campaign" ? 4e15 : g.k === "runs" ? 3e15 : MONEY.has(g.k) ? 1e12 + g.total : g.k === "rally" ? 3e3 : g.k === "endorse" ? 2e3 : 1e3) + g.list.length;
    const other = (e: GEdge) => (e.s === focus ? e.t : e.s);
    for (const g of m.values()) g.list.sort((a, b) => (b.v ?? 0) - (a.v ?? 0) || b.n - a.n || (idx.get(other(b))?.length ?? 0) - (idx.get(other(a))?.length ?? 0));
    return [...m.values()].sort((a, b) => rank(b) - rank(a));
  }, [fTies, focus, on, idx]);
  const hiddenByFilter = fTies.filter((e) => !on.has(e.k)).length;
  const notDrawn = fTies.filter((e) => on.has(e.k) && !onMap.has(ekey(e))).length;
  const moneyIn = fTies.filter((e) => e.t === focus && MONEY.has(e.k)).reduce((a, e) => a + (e.v ?? 0), 0);
  const moneyOut = fTies.filter((e) => e.s === focus && MONEY.has(e.k)).reduce((a, e) => a + (e.v ?? 0), 0);
  const inWords = f.kind === "candidate" ? "spent by outside groups for or against" : f.kind === "vendor" ? "paid to this firm" : "given to it";
  const outWords = f.kind === "donor" ? "given to the groups we track" : "given or spent";
  const gTitle = (g: { k: TieKey; dir: "out" | "in" }) => {
    const nm = f.kind === "race" ? "this race" : f.name;
    const T: Record<string, string> = {
      "gave:out": `Money ${nm} gave`, "gave:in": `Money given to ${nm}`,
      "support:out": "Spent supporting candidates", "support:in": `Outside money spent supporting ${nm}`,
      "oppose:out": "Spent opposing candidates", "oppose:in": `Outside money spent opposing ${nm}`,
      "paid:out": `Payments ${nm} made`, "paid:in": `Who paid ${nm}`,
      "rally:out": `Candidates ${nm} campaigned for`, "rally:in": `Who campaigned for ${nm}`,
      "endorse:out": `Candidates ${nm} endorsed`, "endorse:in": `Who endorsed ${nm}`,
      "attention:out": `Races ${nm} put attention on`, "attention:in": `Who put attention on ${nm}`,
      "runs:out": "The race", "runs:in": "Candidates in this race",
      "campaign:out": "The candidate", "campaign:in": "Own campaign committee",
    };
    return T[`${g.k}:${g.dir}`] ?? TIE[g.k].label;
  };
  const shared = useMemo(() => {
    if (!focus2) return [] as string[];
    const a = new Set((idx.get(focus) ?? []).map((e) => (e.s === focus ? e.t : e.s))), b = new Set((idx.get(focus2) ?? []).map((e) => (e.s === focus2 ? e.t : e.s)));
    return [...a].filter((x) => b.has(x));
  }, [focus, focus2, idx]);

  /* the key: one real example of every kind of tie, the biggest there is */
  const examples = useMemo(() => {
    const out: Partial<Record<TieKey, GEdge>> = {};
    const score = (x: GEdge) => (x.v ?? 0) * 10 + x.n * 1000 + (x.s === "p:Donald Trump" || x.s === "p:Barack Obama" ? 5e3 : 0) + (x.s === "c:James Talarico" || x.t === "c:James Talarico" ? 2e3 : 0);
    for (const e of graph.edges) { const k = e.k as TieKey; if (!TIE[k]) continue; const cur = out[k]; if (!cur || score(e) > score(cur)) out[k] = e; }
    return out;
  }, [graph.edges]);
  const onMapCount = useMemo(() => { const m = new Map<string, number>(); for (const e of net.edges) m.set(e.k, (m.get(e.k) ?? 0) + 1); return m; }, [net.edges]);
  const toggle = (k: string) => setOn((cur) => { const n = new Set(cur); if (n.has(k)) n.delete(k); else n.add(k); return n.size ? n : ALL_ON; });

  /* drawing helpers */
  const maxV = Math.max(1, ...net.edges.map((e) => e.v ?? 0));
  const ctrl = (a: Pt, b: Pt, bend = 0.12) => { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, dx = b.x - a.x, dy = b.y - a.y; return { x: mx - dy * bend, y: my + dx * bend }; };
  const curve = (a: Pt, b: Pt) => { const c = ctrl(a, b); return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${c.x.toFixed(1)},${c.y.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`; };
  const scr = (p: Pt) => { const el = stageRef.current, r = el?.getBoundingClientRect(); const s = { x: p.x * view.k + view.x, y: p.y * view.k + view.y }; return { x: (r?.left ?? 0) + (s.x / W) * (el?.clientWidth ?? W), y: (r?.top ?? 0) + (s.y / H) * (el?.clientHeight ?? H) }; };
  const hotNode = hot && "node" in hot ? byId.get(hot.node) : null;
  const hotEdge = hot && "edge" in hot ? byKey.get(hot.edge) : null;
  const pinEdge = pin ? byKey.get(pin) : null;
  const motion = flow && !reduce;

  const nodeTip = (n: GNode) => {
    const es = net.edges.filter((e) => e.s === n.id || e.t === n.id).sort((a, b) => (b.v ?? 0) - (a.v ?? 0) || b.n - a.n);
    const all = (idx.get(n.id) ?? []).length;
    return (
      <>
        <div className="tt-k">{about(n)}</div>
        <h4>{label(n)}</h4>
        <ul className="tt-l">{es.slice(0, 3).map((e) => <li key={ekey(e)}><Swatch k={e.k as TieKey} w={18} /><span><Say e={e} byId={byId} me={n.id} /></span></li>)}</ul>
        <p className="tt-n">{all} {all === 1 ? "tie" : "ties"} in all{es.length < all ? `, ${es.length} drawn here` : ""}.</p>
        <div className="tt-h">{n.id === focus ? "This name is in the middle of the map." : `Click to put ${label(n)} in the middle.`}</div>
      </>
    );
  };
  const edgeTip = (e: GEdge) => (
    <>
      <div className="tt-k"><Swatch k={e.k as TieKey} w={22} /> {TIE[e.k as TieKey]?.label ?? e.k}</div>
      <p className="tt-s"><Say e={e} byId={byId} /></p>
      {detail(e).slice(0, 2).map((d, i) => <p key={i} className="tt-d">{d}</p>)}
      <div className="tt-h">Click the line to keep this open with its source.</div>
    </>
  );
  const row = (e: GEdge) => {
    const o = e.s === focus ? e.t : e.s, k = ekey(e), drawn = onMap.has(k), dt = detail(e);
    return (
      <li key={k} className={`cx-row${drawn ? "" : " off"}${lit.mode === "hot" && lit.edges.has(k) && hotEdge ? " lit" : ""}`}>
        <button type="button" onClick={() => go(o)} onMouseEnter={() => { if (drawn) setHot({ edge: k }); }} onMouseLeave={() => setHot(null)} onFocus={() => { if (drawn) setHot({ edge: k }); }} onBlur={() => setHot(null)}
          aria-label={`${plainOf(e, byId)} Go to ${disp(byId.get(o), o)}.`}>
          <span className="s"><Say e={e} byId={byId} me={focus} /></span>
          {dt.length ? <span className="d">{dt.slice(0, 2).join(". ")}</span> : null}
        </button>
        <Source e={e} />
      </li>
    );
  };

  return (
    <div className={`cx${compact ? " compact" : ""}`}>
      <ol className="cx-how3" aria-label="How to read this map">
        <li><b>1</b><span><strong>Pick a name</strong> or a story. It goes in the middle, with everyone tied to it around it.</span></li>
        <li><b>2</b><span><strong>Read the lines.</strong> Color and pattern show the kind of tie. Thicker means more money.</span></li>
        <li><b>3</b><span><strong>Point or tap</strong> to read any tie as a sentence. Click a name to see all its ties.</span></li>
      </ol>

      <div className="cx-stories" role="group" aria-label="Guided stories">
        <span className="cx-stories-l">Start with a story</span>
        <div className="wd-chips">
          {stories.map((s) => <button key={s.id} type="button" className={story === s.id ? "on" : ""} aria-pressed={story === s.id} onClick={() => playStory(s)}>{s.title}</button>)}
        </div>
      </div>

      <div className="cx-bar">
        <div className="cx-search">
          <label className="sr" htmlFor="cx-q">Search for a name</label>
          <svg className="cx-mag" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.6-3.6" /></svg>
          <input id="cx-q" className="wd-input" placeholder="Search a name, like Elon Musk, Ken Paxton or Fairshake" value={q} autoComplete="off"
            onChange={(e) => { setQ(e.target.value); setQi(0); }} onKeyDown={(ev) => onSearchKey(ev, found, (n) => { go(n.id); setQ(""); }, () => setQ(""))}
            role="combobox" aria-expanded={found.length > 0} aria-controls="cx-q-list" aria-autocomplete="list" />
          {found.length ? <div className="cx-sugg" id="cx-q-list" role="listbox">{found.map((n, i) => <button key={n.id} type="button" role="option" aria-selected={i === qi} className={i === qi ? "on" : ""} onMouseEnter={() => setQi(i)} onClick={() => { go(n.id); setQ(""); }}><span className={`cx-kind k-${n.kind}`}>{KIND[n.kind]}</span><span className="nm">{label(n)}</span><small>{(idx.get(n.id) ?? []).length} ties</small></button>)}</div> : null}
        </div>
        <div className="cx-tools">
          <button type="button" className="wd-btn" onClick={() => zoomBy(1.25)} aria-label="Zoom in">+</button>
          <button type="button" className="wd-btn" onClick={() => zoomBy(1 / 1.25)} aria-label="Zoom out">−</button>
          <button type="button" className={`wd-btn${big ? " on" : ""}`} aria-pressed={big} onClick={() => { ev("Connections full screen", { on: !big, who: byId.get(focus)?.name ?? null }); setBig((b) => !b); setTimeout(fit, 60); }}>{big ? "Close full screen" : "Full screen"}</button>
          <button type="button" className="wd-btn" onClick={fit}>Fit to screen</button>
          <button type="button" className="wd-btn" onClick={() => { setFocus2(null); setTrail([]); fit(); playStory(stories[0]); }}>Start over</button>
          {!reduce ? <button type="button" className="wd-btn" aria-pressed={!flow} onClick={() => setFlow((x) => !x)}>{flow ? "Pause motion" : "Play motion"}</button> : null}
        </div>
      </div>

      <div className="cx-body">
        <div className="cx-mapcol">
          <div className={`cx-stage card${big ? " cx-big" : ""}${busy && !big ? " cx-tall" : ""}`} ref={stageRef} onWheel={onWheel}>
            {big ? <button type="button" className="wd-btn cx-bigx" onClick={() => setBig(false)}>Close full screen</button> : null}
            <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Map of everyone tied to ${label(f)}. The same ties are listed in words beside the map.`}
              onPointerDown={(e) => onDown(e, null)} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={() => { if (!drag.current) { setHot(null); setTipAt(null); } }}
              className={`${lit.mode ? `has-${lit.mode}` : ""}${motion ? " moving" : ""}`}>
              <defs><radialGradient id="cxglow"><stop offset="0" className="g0" /><stop offset="1" className="g1" /></radialGradient></defs>
              <g transform={`translate(${view.x.toFixed(1)},${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`}>
                <g className="cx-rings" aria-hidden="true">{[0.3, 0.52, 0.74].map((k) => <circle key={k} cx={pos[focus]?.x ?? W / 2} cy={pos[focus]?.y ?? H / 2} r={Math.min(W, H) * k} />)}</g>
                <g aria-hidden="true">
                  {net.edges.map((e) => {
                    const a = pos[e.s], b = pos[e.t]; if (!a || !b) return null;
                    const k = ekey(e), t = TIE[e.k as TieKey], money = MONEY.has(e.k);
                    const d = curve(a, b), w = money && e.v ? 1.4 + Math.sqrt(e.v / maxV) * 6.5 : e.k === "campaign" || e.k === "runs" ? 1.6 : 1.8;
                    const isLit = lit.edges.has(k), dim = !!lit.mode && !isLit;
                    const c = ctrl(a, b), mx = 0.25 * a.x + 0.5 * c.x + 0.25 * b.x, my = 0.25 * a.y + 0.5 * c.y + 0.25 * b.y, ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
                    const dur = Math.max(1.8, Math.hypot(b.x - a.x, b.y - a.y) / 95);
                    const step = order.get(k);
                    return (
                      <g key={k} className={`cx-e t-${e.k}${isLit ? " lit" : ""}${dim ? " dim" : ""}`}>
                        <path className="ln" d={d} strokeWidth={isLit ? w + 1 : w} strokeDasharray={t?.dash} />
                        {isLit ? <path key={`tr-${lit.mode}`} className="tr" d={d} pathLength={1} strokeWidth={w + 3} style={{ animationDelay: lit.mode === "story" && step != null ? `${0.25 + step * 0.75}s` : "0s" }} /> : null}
                        {money ? <path className="chev" d="M-5,-4.2 L2.6,0 L-5,4.2" transform={`translate(${mx.toFixed(1)},${my.toFixed(1)}) rotate(${ang.toFixed(1)}) scale(${(0.85 + w / 9).toFixed(2)})`} /> : null}
                        {money && motion && !dim ? [0, 0.5].slice(0, e.v && e.v > maxV * 0.1 ? 2 : 1).map((off) => (
                          <circle key={off} className="mote" r={Math.min(4.2, 1.8 + w * 0.32)}><animateMotion dur={`${dur}s`} begin={`${off * dur}s`} repeatCount="indefinite" path={d} /></circle>
                        )) : null}
                        <path className="hit" d={d} onPointerEnter={(ev) => { if (!drag.current) { setHot({ edge: k }); setTipAt({ x: ev.clientX, y: ev.clientY }); } }}
                          onPointerMove={(ev) => { if (!drag.current) setTipAt({ x: ev.clientX, y: ev.clientY }); }} onPointerLeave={() => { setHot(null); setTipAt(null); }}
                          onClick={() => { if (moved.current) return; setPin(k); setStory(null); setHot(null); setTipAt(null); }} />
                      </g>
                    );
                  })}
                </g>
                {net.nodes.map((n) => {
                  const p = pos[n.id]; if (!p) return null;
                  const isF = n.id === focus || n.id === focus2, isLit = lit.nodes.has(n.id), dim = !!lit.mode && !isLit, c = sideColor(n.side);
                  const showLabel = n.showLabel || isLit;
                  return (
                    <g key={n.id} className={`cx-n k-${n.kind}${isF ? " f" : ""}${isLit ? " lit" : ""}${dim ? " dim" : ""}${showLabel ? "" : " nolab"}`} transform={`translate(${p.x.toFixed(1)},${p.y.toFixed(1)})`}
                      onPointerEnter={() => { if (!drag.current) { setHot({ node: n.id }); setTipAt(scr(p)); } }} onPointerLeave={() => { if (!drag.current) { setHot(null); setTipAt(null); } }}
                      onPointerDown={(e) => onDown(e, n.id)}
                      onFocus={() => { setHot({ node: n.id }); setTipAt(scr(p)); }} onBlur={() => { setHot(null); setTipAt(null); }}
                      tabIndex={0} role="button" aria-label={`${label(n)}, ${about(n)}. ${isF ? "In the middle of the map." : "Press Enter to put it in the middle."}`}
                      onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(n.id); } }}>
                      {isF ? <circle r={n.r * 2.5} fill="url(#cxglow)" className="cx-halo" /> : null}
                      <circle r={n.r + 10} className="cx-hitn" />
                      {n.kind === "person" ? <g transform={`translate(${isF ? -20 : -n.r * 0.85},${isF ? -34 : -n.r * 1.45})`}><PersonToken ini={n.name.split(" ").map((w) => w[0]).slice(0, 2).join("")} party={n.side ?? "O"} role={n.role} size={isF ? 52 : n.r * 2.15} /></g>
                        : n.kind === "candidate" ? <rect x={-n.r * 0.8} y={-n.r * 0.8} width={n.r * 1.6} height={n.r * 1.6} transform="rotate(45)" rx="3" fill={c} className="cx-shape" />
                        : n.kind === "group" ? <rect x={-n.r} y={-n.r} width={n.r * 2} height={n.r * 2} rx="5" fill={c} className="cx-shape" />
                        : n.kind === "vendor" ? <path d={`M0,${-n.r * 1.15} L${n.r},${n.r * 0.75} L${-n.r},${n.r * 0.75} Z`} className="cx-shape cx-vend" />
                        : n.kind === "race" ? <path d={hex(n.r)} strokeWidth="1.6" className="cx-shape cx-hex" />
                        : n.kind === "committee" ? <g className="cx-shape"><rect x={-n.r} y={-n.r * 0.8} width={n.r * 2} height={n.r * 1.6} rx="3" fill={c} /><path d={`M${-n.r * 0.55},0 H${n.r * 0.55} M0,${-n.r * 0.45} V${n.r * 0.45}`} className="cx-cross" strokeWidth="2" /></g>
                        : <circle r={n.r} fill={n.side ? c : undefined} className={`cx-shape${n.side ? "" : " cx-don"}`} />}
                      <text y={n.r + (isF ? 18 : 14)} textAnchor="middle" className="cx-l">{n.lines.map((l, i) => <tspan key={i} x="0" dy={i ? (isF ? 16 : 13) : 0}>{l}</tspan>)}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
            {net.edges.length === 0 ? <div className="cx-empty">No ties of the kinds you picked. Turn more kinds on in the key below the map.</div> : null}
            {notDrawn > 0 ? <span className="cx-more">{notDrawn} more {notDrawn === 1 ? "tie is" : "ties are"} listed in the panel</span> : null}
            <span className="cx-zoomhint" aria-hidden="true">Drag a name to move it. Hold Ctrl and scroll to zoom.</span>
          </div>

          {/* the reading card: the story, or the line the reader clicked */}
          <div className={`cx-read card${pinEdge ? " pinned" : st ? " story" : ""}`} aria-live="polite">
            {pinEdge ? (
              <>
                <div className="cx-read-k"><Swatch k={pinEdge.k as TieKey} /> <span className="tag">{TIE[pinEdge.k as TieKey]?.label}</span> <span className="what">{TIE[pinEdge.k as TieKey]?.what}</span></div>
                <p className="cx-read-s"><Say e={pinEdge} byId={byId} /></p>
                {detail(pinEdge).length ? <p className="cx-read-d">{detail(pinEdge).join(". ")}</p> : null}
                <div className="cx-read-a"><Source e={pinEdge} />
                  {[pinEdge.s, pinEdge.t].filter((id) => id !== focus).map((id) => <button key={id} type="button" className="wd-btn" onClick={() => go(id)}>Put {label(byId.get(id))} in the middle</button>)}
                  <button type="button" className="wd-btn" onClick={() => setPin(null)}>Close</button>
                </div>
              </>
            ) : st ? (
              <>
                <div className="cx-read-k"><span className="tag">The story</span> <span className="ttl">{st.title}</span></div>
                <ol className="cx-steps">
                  {storyEdges.map((e, i) => (
                    <li key={`${st.id}-${ekey(e)}`} style={{ animationDelay: reduce ? "0s" : `${0.25 + i * 0.75}s` }} onMouseEnter={() => setHot({ edge: ekey(e) })} onMouseLeave={() => setHot(null)}>
                      <i className="n">{i + 1}</i><Swatch k={e.k as TieKey} w={26} /><span><Say e={e} byId={byId} /> <Source e={e} /></span>
                    </li>
                  ))}
                </ol>
                <div className="cx-read-a">
                  <span className="cx-read-hint">The bright lines on the map are this story. Point at any other line to read it.</span>
                  {stories.length > 1 ? <button type="button" className="wd-btn" onClick={() => { const i = stories.findIndex((s) => s.id === st.id); playStory(stories[(i + 1) % stories.length]); }}>Next story</button> : null}
                  <button type="button" className="wd-btn" onClick={() => setStory(null)}>Explore on my own</button>
                </div>
              </>
            ) : (
              <p className="cx-read-hint">Point at or tap any line on the map and it is spelled out in a sentence. Click a line to keep it here with its source.</p>
            )}
          </div>

          {/* the key, which is also the filter */}
          <section className="cx-key card" aria-labelledby="cx-key-h">
            <div className="cx-key-h">
              <h3 id="cx-key-h">What the lines mean</h3>
              <p>Tap a kind of tie to hide it or bring it back.</p>
              <div className="cx-key-q">
                <button type="button" className="wd-btn" onClick={() => setOn(ALL_ON)}>Show all</button>
                <button type="button" className="wd-btn" onClick={() => setOn(new Set(["gave", "support", "oppose", "paid", "campaign", "runs"]))}>Money only</button>
                <button type="button" className="wd-btn" onClick={() => setOn(new Set(["rally", "endorse", "attention", "runs"]))}>People only</button>
              </div>
            </div>
            <ul className="cx-key-l">
              {TIES.map((t) => { const ex = examples[t.k]; const isOn = on.has(t.k); return (
                <li key={t.k}>
                  <button type="button" className={`cx-kt t-${t.k}${isOn ? " on" : ""}`} aria-pressed={isOn} onClick={() => toggle(t.k)}>
                    <span className="box" aria-hidden="true" />
                    <span className="nm"><Swatch k={t.k} /><span>{t.label}</span><small>{onMapCount.get(t.k) ?? 0} on the map</small></span>
                    <span className="ex">{ex ? <>Example: {plainOf(ex, byId)}</> : t.what}</span>
                  </button>
                </li>
              ); })}
            </ul>
            <div className="cx-shapes" aria-label="What the shapes mean">
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-4.5" y="-4.5" width="9" height="9" transform="rotate(45)" rx="1" fill="#3d7bff" /></svg>Candidate</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-6" y="-6" width="12" height="12" rx="3" fill="#ff3b5c" /></svg>Outside group</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="6" className="cx-don" /></svg>Donor</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><path d="M0,-6.5 L6,4.5 L-6,4.5Z" className="cx-vend" /></svg>Firm</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><path d={hex(6)} className="cx-hex" strokeWidth="1.4" /></svg>Race</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><rect x="-6" y="-5" width="12" height="10" rx="2" fill="#3d7bff" /><path d="M-3,0 H3 M0,-2.6 V2.6" className="cx-cross" strokeWidth="1.6" /></svg>Campaign committee</span>
              <span><svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle cy="-1.5" r="4" fill="#b78cff" /><path d="M-5.5,6.5 q0,-5 5.5,-5 q5.5,0 5.5,5z" fill="#b78cff" /></svg>Public figure</span>
              <span className="party"><i className="d" />Blue means the Democratic side</span><span className="party"><i className="r" />Red means the Republican side</span>
              <span>Bigger shapes and thicker lines mean more money</span>
            </div>
          </section>
        </div>

        {/* the name in the middle and every tie it has */}
        <aside className="cx-side card" aria-label={`All ties for ${label(f)}`}>
          <div className="cx-side-h">
            {trail.length ? <button type="button" className="cx-back" onClick={back}>Back to {label(byId.get(trail[trail.length - 1]))}</button> : null}
            <span className={`cx-kind k-${f.kind}`}>{KIND[f.kind]}</span>
            <h2>{label(f)}</h2>
            <p className="cx-about">{about(f)}</p>
            <div className="cx-tots">
              <span><b>{fTies.length}</b> {fTies.length === 1 ? "tie" : "ties"} in all</span>
              {moneyIn ? <span><b>{usd(moneyIn)}</b> {inWords}</span> : null}
              {moneyOut ? <span><b>{usd(moneyOut)}</b> {outWords}</span> : null}
            </div>
            {f.href ? <Link className="wd-btn cx-fc" href={f.href}>Open the race forecast</Link> : f.kind === "candidate" && f.race && byId.get(`r:${f.race}`)?.href ? <Link className="wd-btn cx-fc" href={byId.get(`r:${f.race}`)!.href!}>Open the {raceName(f.race)} forecast</Link> : null}
          </div>
          <div className="cx-side-b">
            <p className="cx-side-hint">Every tie, biggest first. Click one to put that name in the middle.</p>
            {groups.length === 0 ? <p className="cx-none">No ties of the kinds you picked. Turn more kinds on in the key.</p> : null}
            {groups.map((g) => {
              const gk = `${g.k}:${g.dir}`, open = openG.has(gk), n = compact ? 4 : 6, list = open ? g.list : g.list.slice(0, n);
              return (
                <section key={gk} className={`cx-grp t-${g.k}`}>
                  <h3><Swatch k={g.k} w={24} /><span>{gTitle(g)}</span><small>{g.total ? usd(g.total) : g.list.length}</small></h3>
                  <ul>{list.map(row)}</ul>
                  {g.list.length > n ? <button type="button" className="cx-all" aria-expanded={open} onClick={() => setOpenG((s) => { const x = new Set(s); if (x.has(gk)) x.delete(gk); else x.add(gk); return x; })}>{open ? "Show fewer" : `Show all ${g.list.length}`}</button> : null}
                </section>
              );
            })}
            {hiddenByFilter ? <p className="cx-none">{hiddenByFilter} more {hiddenByFilter === 1 ? "tie is" : "ties are"} hidden by the key. <button type="button" className="cx-all" onClick={() => setOn(ALL_ON)}>Show every kind</button></p> : null}
            <div className="cx-compare">
              <h3>Compare with another name</h3>
              <div className="cx-search">
                <label className="sr" htmlFor="cx-q2">Pick a second name to compare</label>
                <input id="cx-q2" className="wd-input" placeholder={focus2 ? label(byId.get(focus2)) : "Pick a second name"} value={q2} autoComplete="off" onChange={(e) => { setQ2(e.target.value); setQi(0); }}
                  onKeyDown={(ev) => onSearchKey(ev, found2, (n) => { setFocus2(n.id === focus ? null : n.id); setQ2(""); setStory(null); }, () => setQ2(""))} />
                {found2.length ? <div className="cx-sugg up">{found2.map((n, i) => <button key={n.id} type="button" className={i === qi ? "on" : ""} onMouseEnter={() => setQi(i)} onClick={() => { setFocus2(n.id === focus ? null : n.id); setQ2(""); setStory(null); }}><span className={`cx-kind k-${n.kind}`}>{KIND[n.kind]}</span><span className="nm">{label(n)}</span></button>)}</div> : null}
              </div>
              {focus2 ? <p className="cx-shared">{label(f)} and {label(byId.get(focus2))} share <b>{shared.length}</b> {shared.length === 1 ? "tie" : "ties"}{shared.length ? ": " : "."}{shared.slice(0, 8).map((id, i) => <React.Fragment key={id}>{i ? ", " : ""}<button type="button" className="cx-link" onClick={() => go(id)}>{disp(byId.get(id), id)}</button></React.Fragment>)}{shared.length ? "." : ""} <button type="button" className="cx-all" onClick={() => setFocus2(null)}>Stop comparing</button></p>
                : <p className="cx-none">The two names sit side by side on the map, and anyone tied to both shows up between them.</p>}
            </div>
          </div>
        </aside>
      </div>

      {(hotNode || hotEdge) && tipAt ? <FloatTip scope={WD_SCOPE} x={tipAt.x} y={tipAt.y} className="wd-tip cx-tip">{hotNode ? nodeTip(hotNode) : hotEdge ? edgeTip(hotEdge) : null}</FloatTip> : null}
    </div>
  );
}

function hex(r: number) { const p = []; for (let i = 0; i < 6; i++) { const a = Math.PI / 6 + (i * Math.PI) / 3; p.push(`${(Math.cos(a) * r).toFixed(1)},${(Math.sin(a) * r).toFixed(1)}`); } return `M${p.join("L")}Z`; }
