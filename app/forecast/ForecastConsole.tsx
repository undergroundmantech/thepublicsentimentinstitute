"use client";
// The forecast console: the one place to read every 2026 forecast. Six layer tiles across the top switch the
// whole console between the Senate, the House, governors, statewide offices, state legislatures and ballot
// measures. Each layer gets the same three parts so the page reads one way everywhere: a large map, a readout
// with the odds, a pixel line of every seat and the closest races, then a searchable table of every race in it.
// Clicking a state or district opens its full race page.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import DaysOut from "@/app/components/DaysOut";
import PollTrail from "@/app/components/opp/PollTrail";
import { Pointy } from "@/app/components/home/Mascot";
import { useRouter } from "next/navigation";
import { RATE, RATING_LABEL, rating, ratingPill, STATE_NAME, type Rating } from "@/app/lib/opp";
import USLegisMap, { type USChamber } from "@/app/components/opp/USLegisMap";
import SpendingTracker, { SPENDING_CSS } from "./Spending";
import Ambient from "@/app/components/opp/Ambient";
import SeatBars from "./SeatBars";
import "./console.css";

export type Layer = "senate" | "house" | "governor" | "statewide" | "legis" | "measures";
export type CRace = { id: string; st: string; state: string; d: number; name: string; dem: string; gop: string; m: number; p: number; ind: boolean; href: string; open: boolean; p10: number; p90: number; office?: string; officeLabel?: string; pl?: [number, number, number, number][] };
export type CChamber = { demControl: number; demSeats: number; median: number; seatsTotal: number; p10: number; p90: number; majority: number; trend: number[]; notUpD: number; notUpR: number; notUpI?: number };
export type CLeg = { id: string; st: string; state: string; chamber: "house" | "senate"; name: string; seats: number; up: number; majority: number; demControl: number; gopControl: number; demSeats: number; gopSeats: number; p10: number; p90: number; href: string };
export type CMeas = { st: string; label: string; title: string; yes: number; prob: number; thr: number; href: string };
export type ConsoleData = {
  senate: CRace[]; governor: CRace[]; house: CRace[]; statewide: CRace[]; legis: CLeg[]; measures: CMeas[];
  ch: Record<"senate" | "governor" | "house", CChamber>; updated: string; daysOut: number; sims: number; generic: number | null; ev: { ballots: number; states: number } | null;
};
type Geo = { frame: [number, number]; states: Record<string, string>; labels?: Record<string, [number, number, number]>; districts: Record<string, { d: string } | string> };

const LAYERS: { k: Layer; label: string; q: string }[] = [
  { k: "senate", label: "Senate", q: "senate" }, { k: "house", label: "House", q: "house" }, { k: "governor", label: "Governors", q: "governor" },
  { k: "statewide", label: "Statewide offices", q: "statewide" }, { k: "legis", label: "State legislatures", q: "legislatures" }, { k: "measures", label: "Ballot measures", q: "measures" },
];
const pc = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);
const last = (n: string) => n.replace(/\s+(Jr\.|Sr\.|II|III|IV)$/, "").split(" ").slice(-1)[0];
const unc = (r: CRace) => Math.abs(r.m) >= 99;
const fm = (m: number, ind = false) => (Math.abs(m) >= 99 ? "Unopposed" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? (ind ? "I" : "D") : "R"} +${Math.abs(m).toFixed(1)}`);
const rateOf = (r: CRace): Rating => (unc(r) ? (r.m < 0 ? "safeD" : "safeR") : rating(r.m, r.ind));
const dColor = (ind: boolean) => (ind ? "#b78cff" : "#7fa6ff");
function probFill(pD: number) {
  if (pD >= 0.95) return RATE.safeD; if (pD >= 0.8) return RATE.likelyD; if (pD >= 0.6) return RATE.leanD; if (pD > 0.4) return RATE.toss;
  if (pD > 0.2) return RATE.leanR; if (pD > 0.05) return RATE.likelyR; return RATE.safeR;
}
const mix = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(",")})`;
const passFill = (p: number) => (p >= 0.5 ? mix([200, 238, 226], [14, 120, 94], Math.min(1, (p - 0.5) * 2)) : mix([252, 222, 208], [168, 62, 18], Math.min(1, (0.5 - p) * 2)));
function bboxOf(d: string): [number, number, number, number] {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; const re = /(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g; let m: RegExpExecArray | null;
  while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}

// ── small pieces ─────────────────────────────────────────────────────────────
function Spark({ v, color }: { v: number[]; color: string }) {
  if (v.length < 2) return null;
  const W = 260, H = 54, x = (i: number) => (i / (v.length - 1)) * W, y = (p: number) => H - 4 - p * (H - 8);
  const d = v.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p).toFixed(1)}`).join("");
  return (
    <svg className="fcx-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={W} y1={y(0.5)} y2={y(0.5)} className="mid" />
      <path d={`${d}L${W},${H}L0,${H}Z`} fill={color} opacity=".12" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function Pixels({ cells, cols, mark, label }: { cells: { c: string; t: string; dim?: boolean }[]; cols: number; mark?: number; label: string }) {
  return (
    <div className="fcx-px" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }} role="img" aria-label={label}>
      {cells.map((x, i) => <i key={i} title={x.t} className={`${x.dim ? "dim" : ""}${mark != null && i === mark ? " mk" : ""}`} style={{ background: x.c, animationDelay: `${Math.min(1.2, (i % cols) * 0.018 + Math.floor(i / cols) * 0.04)}s` }} />)}
    </div>
  );
}

function ChanceBar({ pD, ind }: { pD: number; ind: boolean }) {
  return (
    <span className="fcx-cb" aria-label={`${pc(pD)} ${ind ? "independent" : "Democratic"}, ${pc(1 - pD)} Republican`}>
      <i style={{ width: `${pD * 100}%`, background: ind ? "#b78cff" : "#3d7bff" }} /><s style={{ width: `${(1 - pD) * 100}%` }} />
    </span>
  );
}

// ── the console ──────────────────────────────────────────────────────────────
// keep a tooltip on screen: open it to the left of the pointer near the right edge, and above it near the bottom
const tipFlip = (t: { x: number; y: number; w?: number; h?: number }): React.CSSProperties => ({ transform: `translate(${t.w && t.x > t.w - 290 ? "calc(-100% - 16px)" : "16px"}, ${t.h && t.y > t.h - 230 ? "calc(-100% - 12px)" : "12px"})` });

const trailOf = (r: CRace) => (r.pl ?? []).map(([age, margin, n, op]) => ({ age, margin, n, op: !!op }));

export default function ForecastConsole({ data, initial, initialOffice }: { data: ConsoleData; initial: Layer; initialOffice?: string }) {
  const router = useRouter();
  const [layer, setLayer] = useState<Layer>(initial);
  const [geo, setGeo] = useState<Geo | null>(null);
  const [legisFull, setLegisFull] = useState<USChamber[] | null>(null);
  const [office, setOffice] = useState<string>(initialOffice && data.statewide.some((r) => r.office === initialOffice) ? initialOffice : "all");
  const [chamber, setChamber] = useState<"house" | "senate">("house");
  const [mst, setMst] = useState<string | null>(null);
  const [tip, setTip] = useState<{ k: string; x: number; y: number; w?: number; h?: number } | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"close" | "d" | "r" | "az">("close");
  const [all, setAll] = useState(false);

  useEffect(() => { setLayer(initial); }, [initial]);
  // ?office= picks the layer the console opens on, so old desk links still land in the right place
  useEffect(() => {
    let q = "";
    try { q = (new URLSearchParams(window.location.search).get("office") ?? "").toLowerCase(); } catch { return; }
    if (!q) return;
    const l: Layer = q === "house" ? "house" : q === "governor" || q === "governors" || q === "gov" ? "governor" : q === "legislatures" || q === "legislature" || q === "sl" ? "legis"
      : q === "measures" || q === "ballot-measures" ? "measures" : q === "statewide" || q.includes("-") ? "statewide" : "senate";
    setLayer(l);
    if (q.includes("-") && data.statewide.some((r) => r.office === q)) setOffice(q);
  }, [data.statewide]);
  useEffect(() => { fetch("/forecast/geo.json").then((r) => r.json()).then(setGeo).catch(() => {}); }, []);
  useEffect(() => {
    if (layer !== "legis" || legisFull) return;
    fetch("/forecast/statehouse_hub.json").then((r) => r.json()).then((j) => setLegisFull(j.chambers)).catch(() => {});
  }, [layer, legisFull]);
  const choose = (k: Layer) => {
    setLayer(k); setTip(null); setQ(""); setAll(false); setMst(null);
    try { const u = new URL(window.location.href); u.searchParams.set("office", LAYERS.find((l) => l.k === k)!.q); u.hash = ""; window.history.replaceState(null, "", u.toString()); } catch { /* history unavailable */ }
  };

  // races on the current map layer
  const offices = useMemo(() => {
    const c = new Map<string, { label: string; n: number }>();
    for (const r of data.statewide) if (r.office) { const o = c.get(r.office) ?? { label: r.officeLabel ?? r.office, n: 0 }; o.n++; c.set(r.office, o); }
    return [...c.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [data.statewide]);
  const races: CRace[] = useMemo(() => layer === "senate" ? data.senate : layer === "house" ? data.house : layer === "governor" ? data.governor
    : layer === "statewide" ? data.statewide.filter((r) => office === "all" || r.office === office) : [], [layer, office, data]);
  const byKey = useMemo(() => { const m: Record<string, CRace[]> = {}; for (const r of races) (m[layer === "house" ? r.id : r.st] ??= []).push(r); return m; }, [races, layer]);
  const measBySt = useMemo(() => { const m: Record<string, CMeas[]> = {}; for (const x of data.measures) (m[x.st] ??= []).push(x); return m; }, [data.measures]);

  // tiles
  const ch = data.ch;
  const govFav = data.governor.filter((r) => r.m < 0).length;
  const swLive = data.statewide.filter((r) => !unc(r));
  const swFav = data.statewide.filter((r) => r.m < 0).length;
  const lgFav = data.legis.filter((c) => c.demControl > c.gopControl).length;
  const msPass = data.measures.filter((x) => x.prob > 0.5).length;
  const tiles: Record<Layer, { big: string; unit: string; sub: string; bar: number; teal?: boolean }> = {
    senate: { big: pc(ch.senate.demControl), unit: "D control", sub: `${Math.round(ch.senate.median)} D seats, 51 to win`, bar: ch.senate.demControl },
    house: { big: pc(ch.house.demControl), unit: "D control", sub: `${Math.round(ch.house.median)} D seats, 218 to win`, bar: ch.house.demControl },
    governor: { big: `${govFav} of ${data.governor.length}`, unit: "lean D", sub: `${pc(ch.governor.demControl)} for most governorships`, bar: govFav / data.governor.length },
    statewide: { big: `${swFav} of ${data.statewide.length}`, unit: "lean D", sub: `${offices.length} offices in ${new Set(data.statewide.map((r) => r.st)).size} states`, bar: swFav / data.statewide.length },
    legis: { big: `${lgFav} of ${data.legis.length}`, unit: "lean D", sub: `${data.legis.reduce((a, c) => a + c.up, 0).toLocaleString()} seats up`, bar: lgFav / data.legis.length },
    measures: { big: `${msPass} of ${data.measures.length}`, unit: "pass", sub: `${new Set(data.measures.map((x) => x.st)).size} states vote on questions`, bar: msPass / data.measures.length, teal: true },
  };

  // the map
  const shapes = useMemo(() => {
    if (!geo) return [] as { key: string; d: string; x: number }[];
    if (layer === "house") return Object.entries(geo.districts).map(([id, v]) => { const d = typeof v === "string" ? v : v.d; return { key: id, d, x: bboxOf(d)[0] }; });
    return Object.entries(geo.states).map(([st, d]) => ({ key: st, d, x: bboxOf(d)[0] }));
  }, [geo, layer]);
  const labels = useMemo(() => (geo && layer !== "house" ? Object.entries(geo.states).map(([st, d]) => { const b = bboxOf(d), lb = geo.labels?.[st]; return { st, x: lb ? lb[0] : (b[0] + b[2]) / 2, y: lb ? lb[1] : (b[1] + b[3]) / 2, w: lb ? lb[2] : b[2] - b[0] }; }).filter((l) => l.w > 36) : []), [geo, layer]);
  const [W, H] = geo?.frame ?? [975, 610];
  const fillOf = (k: string): string | null => {
    if (layer === "measures") { const L = measBySt[k]; if (!L) return null; return passFill(L.filter((x) => x.prob > 0.5).length / L.length * 0.9 + 0.05); }
    const rs = byKey[k]; if (!rs?.length) return null;
    if (rs.length === 1) return RATE[rateOf(rs[0])];
    return probFill(rs.reduce((a, r) => a + (1 - r.p), 0) / rs.length);
  };
  const clickKey = (k: string) => {
    if (layer === "measures") { if (measBySt[k]) setMst(k); return; }
    const rs = byKey[k]; if (!rs?.length) return;
    const r = [...rs].sort((a, b) => Math.abs(a.m) - Math.abs(b.m))[0];
    router.push(r.href);
  };

  // readout
  const chamberOf = layer === "senate" || layer === "house" || layer === "governor" ? ch[layer] : null;
  const readout = useMemo(() => {
    const cellsOf = (rs: CRace[]) => [...rs].sort((a, b) => a.m - b.m).map((r) => ({ c: RATE[rateOf(r)], t: `${r.name}: ${fm(r.m, r.ind)}` }));
    if (layer === "senate" || layer === "governor") {
      const c = ch[layer], rs = layer === "senate" ? data.senate : data.governor;
      const nu = (n: number, col: string, who: string) => Array.from({ length: n }, () => ({ c: col, t: `${who} seat not up in 2026`, dim: true }));
      const cells = [...nu(c.notUpD, RATE.safeD, "Democratic"), ...nu(c.notUpI ?? 0, dColor(true), "Independent"), ...cellsOf(rs), ...nu(c.notUpR, RATE.safeR, "Republican")];
      const dWin = c.demControl >= 0.5;
      return {
        verdict: layer === "senate"
          ? <>{dWin ? "Democrats win the Senate" : "Republicans hold the Senate"} in <b className={dWin ? "d" : "r"}>{Math.round((dWin ? c.demControl : 1 - c.demControl) * 100)} of 100</b> simulations</>
          : <>Democrats are favored in <b className="d">{govFav} of {rs.length}</b> governor races and lead most governorships in <b className="d">{pc(c.demControl)}</b> of simulations</>,
        cells, cols: 25, mark: layer === "senate" ? 50 : 25, markLabel: layer === "senate" ? "51 for control" : "26 for most",
        stats: [[layer === "senate" ? "Average D seats" : "Average D governors", c.demSeats.toFixed(1)], ["80 percent range", `${c.p10} to ${c.p90}`], ["Toss ups", String(rs.filter((r) => rateOf(r) === "toss").length)]] as [string, string][],
      };
    }
    if (layer === "house") {
      const c = ch.house, dWin = c.demControl >= 0.5;
      return { verdict: <>{dWin ? "Democrats win the House" : "Republicans hold the House"} in <b className={dWin ? "d" : "r"}>{Math.round((dWin ? c.demControl : 1 - c.demControl) * 100)} of 100</b> simulations</>,
        cells: cellsOf(data.house), cols: 29, mark: 217, markLabel: "218 for control",
        stats: [["Average D seats", c.demSeats.toFixed(1)], ["80 percent range", `${c.p10} to ${c.p90}`], ["Toss ups", String(data.house.filter((r) => rateOf(r) === "toss").length)]] as [string, string][] };
    }
    if (layer === "statewide") {
      const rs = races, fav = rs.filter((r) => r.m < 0).length;
      return { verdict: <>Democrats are favored in <b className="d">{fav} of {rs.length}</b> {office === "all" ? "statewide office races" : `${(offices.find(([k]) => k === office)?.[1].label ?? "").toLowerCase()} races`}</>,
        cells: cellsOf(rs), cols: Math.min(25, Math.max(10, Math.ceil(Math.sqrt(rs.length * 3)))), mark: undefined, markLabel: "",
        stats: [["Races", String(rs.length)], ["Toss ups", String(rs.filter((r) => rateOf(r) === "toss").length)], ["Expected D wins", rs.reduce((a, r) => a + (1 - r.p), 0).toFixed(1)]] as [string, string][] };
    }
    if (layer === "legis") {
      const cs = data.legis.filter((c) => c.chamber === chamber), fav = cs.filter((c) => c.demControl > c.gopControl).length;
      return { verdict: <>Democrats are favored to control <b className="d">{fav} of {cs.length}</b> state {chamber === "house" ? "houses" : "senates"} on the ballot</>,
        cells: [...cs].sort((a, b) => b.demControl - a.demControl).map((c) => ({ c: probFill(c.demControl), t: `${c.name}: D ${pc(c.demControl)}` })), cols: 15, mark: undefined, markLabel: "",
        stats: [["Seats up", cs.reduce((a, c) => a + c.up, 0).toLocaleString()], ["Expected D chambers", cs.reduce((a, c) => a + c.demControl, 0).toFixed(1)], ["Close chambers", String(cs.filter((c) => Math.abs(c.demControl - 0.5) < 0.2).length)]] as [string, string][] };
    }
    const ms = mst ? data.measures.filter((x) => x.st === mst) : data.measures, pass = ms.filter((x) => x.prob > 0.5).length;
    return { verdict: <><b className="t">{pass} of {ms.length}</b> {mst ? `${STATE_NAME[mst] ?? mst} measures are` : "statewide ballot measures are"} favored to pass</>,
      cells: [...ms].sort((a, b) => b.prob - a.prob).map((x) => ({ c: passFill(x.prob), t: `${x.st} ${x.label}: ${pc(x.prob)} to pass` })), cols: mst ? Math.max(6, ms.length) : 25, mark: undefined, markLabel: "",
      stats: [["Questions", String(ms.length)], ["States", String(new Set(ms.map((x) => x.st)).size)], ["Close calls", String(ms.filter((x) => x.prob > 0.35 && x.prob < 0.65).length)]] as [string, string][] };
  }, [layer, data, ch, races, office, offices, chamber, mst, govFav]);

  const closest = useMemo(() => {
    if (layer === "legis") return data.legis.filter((c) => c.chamber === chamber).sort((a, b) => Math.abs(a.demControl - 0.5) - Math.abs(b.demControl - 0.5)).slice(0, 7)
      .map((c) => ({ key: c.id, href: c.href, name: c.name, sub: `${c.up} seats up, ${c.majority} for a majority`, val: c.demControl >= c.gopControl ? `D ${pc(c.demControl)}` : `R ${pc(c.gopControl)}`, cls: c.demControl >= c.gopControl ? "d" : "r", pD: c.demControl, ind: false }));
    if (layer === "measures") return (mst ? data.measures.filter((x) => x.st === mst) : [...data.measures].sort((a, b) => Math.abs(a.prob - 0.5) - Math.abs(b.prob - 0.5))).slice(0, mst ? 12 : 7)
      .map((x) => ({ key: x.href, href: x.href, name: `${x.st} ${x.label}`, sub: x.title, val: `${x.yes.toFixed(1)}% yes`, cls: x.prob > 0.5 ? "y" : "no", pD: x.prob, ind: false }));
    return [...races].filter((r) => !unc(r)).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 7)
      .map((r) => ({ key: r.id, href: r.href, name: r.name, sub: `${last(r.dem)} vs ${last(r.gop)}`, val: fm(r.m, r.ind), cls: r.m < 0 ? (r.ind ? "i" : "d") : "r", pD: 1 - r.p, ind: r.ind }));
  }, [layer, races, data, chamber, mst]);

  // table
  const tableRows = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (layer === "legis") {
      let L = data.legis.filter((c) => c.chamber === chamber && (!s || `${c.name} ${c.state}`.toLowerCase().includes(s)));
      L = L.sort((a, b) => sort === "close" ? Math.abs(a.demControl - 0.5) - Math.abs(b.demControl - 0.5) : sort === "d" ? b.demControl - a.demControl : sort === "r" ? a.demControl - b.demControl : a.name.localeCompare(b.name));
      return { kind: "legis" as const, rows: L };
    }
    if (layer === "measures") {
      let L = data.measures.filter((x) => (!mst || x.st === mst) && (!s || `${x.st} ${STATE_NAME[x.st] ?? ""} ${x.label} ${x.title}`.toLowerCase().includes(s)));
      L = L.sort((a, b) => sort === "close" ? Math.abs(a.prob - 0.5) - Math.abs(b.prob - 0.5) : sort === "d" ? b.prob - a.prob : sort === "r" ? a.prob - b.prob : `${a.st}${a.label}`.localeCompare(`${b.st}${b.label}`));
      return { kind: "meas" as const, rows: L };
    }
    let L = races.filter((r) => !s || `${r.name} ${r.state} ${r.dem} ${r.gop}`.toLowerCase().includes(s));
    L = [...L].sort((a, b) => sort === "close" ? Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5) || Math.abs(a.m) - Math.abs(b.m) : sort === "d" ? a.m - b.m : sort === "r" ? b.m - a.m : a.name.localeCompare(b.name, "en", { numeric: true }));
    return { kind: "race" as const, rows: L };
  }, [layer, data, races, q, sort, chamber, mst]);
  const LIMIT = 18, shown = all ? tableRows.rows.length : Math.min(LIMIT, tableRows.rows.length);

  const layerLabel = LAYERS.find((l) => l.k === layer)!.label;
  const tipKey = tip?.k;
  const tipRaces = tipKey ? byKey[tipKey] ?? [] : [];
  const tipMeas = tipKey && layer === "measures" ? measBySt[tipKey] ?? [] : [];
  const mapTitle = layer === "house" ? "All 435 districts" : layer === "senate" ? `${data.senate.length} Senate seats on the ballot` : layer === "governor" ? `${data.governor.length} governor races`
    : layer === "statewide" ? (office === "all" ? `${data.statewide.length} statewide races` : `${races.length} ${(offices.find(([k]) => k === office)?.[1].label ?? "").toLowerCase()} races`)
    : layer === "legis" ? `Every state ${chamber} district` : `${data.measures.length} questions in ${Object.keys(measBySt).length} states`;

  return (
    <section className="fcx" aria-labelledby="fcx-h">
      <Ambient />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Forecast</span></nav>
      <header className="fcx-head">
          <Pointy key={layer} className="fcx-pty pty-side" pose={layer === "measures" ? "think" : "point"} prop="none" size={92} look={-1} flip cap
            say={closest[0] ? <>Closest {layer === "legis" ? "chamber" : layer === "measures" ? "measure" : "race"}: <b>{closest[0].name}</b>, <span className={closest[0].cls === "r" || closest[0].cls === "no" ? "r" : "d"}>{closest[0].val}</span></> : undefined} />
        <div>
          <div className="eye g">2026 midterm forecast · <DaysOut initial={data.daysOut} suffix=" days out" /></div>
          <h1 id="fcx-h">Every 2026 race, <em>in one place.</em></h1>
          <p className="lede">Pick a layer to see its map, its odds and its closest races. Click any state or district to open the full forecast for that race.</p>
        </div>
        <dl className="fcx-meta">
          <div><dt>Updated</dt><dd>{new Date(data.updated + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</dd></div>
          <div><dt>Simulations</dt><dd>{data.sims.toLocaleString()}</dd></div>
          {data.generic != null ? <div><dt>Generic ballot</dt><dd className={data.generic < 0 ? "d" : "r"}>{data.generic < 0 ? "D" : "R"} +{Math.abs(data.generic).toFixed(1)}</dd></div> : null}
          {data.ev ? <div><dt>Early ballots</dt><dd><Link href="/maps/early-vote">{(data.ev.ballots / 1e6).toFixed(1)}M</Link></dd></div> : null}
        </dl>
      </header>

      <SeatBars ch={ch} data={data} onPick={choose} active={layer} />

      <div className="fcx-tiles" role="tablist" aria-label="Forecast layer">
        {LAYERS.map((l, i) => {
          const t = tiles[l.k];
          return (
            <button key={l.k} role="tab" aria-selected={layer === l.k} className={`fcx-tile${layer === l.k ? " on" : ""}`} onClick={() => choose(l.k)} style={{ animationDelay: `${i * 0.05}s` }}>
              <span className="lb">{l.label}</span>
              <span className="bg"><b>{t.big}</b><small>{t.unit}</small></span>
              <span className={`br${t.teal ? " teal" : ""}`}><i style={{ width: `${t.bar * 100}%` }} /></span>
              <span className="sb">{t.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="fcx-stage" id="fcx-map">
        <div className="fcx-mapcard">
          <div className="fcx-maphead">
            <div><span className="eye">{layerLabel}</span><h2>{mapTitle}</h2></div>
            {layer === "statewide" ? (
              <div className="fcx-chips" role="group" aria-label="Office">
                <button className={office === "all" ? "on" : ""} onClick={() => setOffice("all")}>All offices</button>
                {offices.map(([k, o]) => <button key={k} className={office === k ? "on" : ""} onClick={() => setOffice(k)}>{o.label} <em>{o.n}</em></button>)}
              </div>
            ) : layer === "legis" ? (
              <div className="fcx-chips" role="group" aria-label="Chamber">
                <button className={chamber === "house" ? "on" : ""} onClick={() => setChamber("house")}>State houses</button>
                <button className={chamber === "senate" ? "on" : ""} onClick={() => setChamber("senate")}>State senates</button>
              </div>
            ) : layer === "measures" && mst ? (
              <div className="fcx-chips"><button className="on" onClick={() => setMst(null)}>{STATE_NAME[mst] ?? mst} · show every state</button></div>
            ) : null}
          </div>
          {layer === "legis" ? (
            <div className="fcx-legis">{legisFull ? <USLegisMap chambers={legisFull} which={chamber} bare /> : <div className="fcx-load sx-skel" />}</div>
          ) : (
            <div className="fcx-mapwrap" onMouseLeave={() => setTip(null)}>
              {geo ? (
                <svg key={`${layer}-${office}`} className={`fcx-map${layer === "house" ? " hs" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${layerLabel} forecast map`}>
                  {shapes.map((s) => {
                    const f = fillOf(s.key);
                    return (
                      <path key={s.key} d={s.d} className={f ? "live" : "off"} style={{ fill: f ?? undefined, animationDelay: `${((s.x / W) * 0.55).toFixed(2)}s` }}
                        tabIndex={f ? 0 : -1} role={f ? "button" : undefined} aria-label={f ? (layer === "measures" ? `${STATE_NAME[s.key] ?? s.key} ballot measures` : (byKey[s.key] ?? []).map((r) => `${r.name} ${fm(r.m, r.ind)}`).join(", ")) : undefined}
                        onMouseMove={f ? (e) => { const b = (e.currentTarget.ownerSVGElement!.parentElement as HTMLElement).getBoundingClientRect(); setTip({ k: s.key, x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); } : undefined}
                        onClick={f ? () => clickKey(s.key) : undefined} onKeyDown={f ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); clickKey(s.key); } } : undefined} />
                    );
                  })}
                  {labels.map((l) => <text key={l.st} x={l.x} y={l.y + 4} className={fillOf(l.st) ? "" : "off"}>{l.st}</text>)}
                </svg>
              ) : <div className="fcx-load sx-skel" />}
              {tip && (tipRaces.length || tipMeas.length) ? (
                <div className="fcx-tip" style={{ left: tip.x, top: tip.y , ...tipFlip(tip!) }}>
                  {layer === "measures" ? (
                    <><h4>{STATE_NAME[tip.k] ?? tip.k}</h4>{tipMeas.slice(0, 6).map((x) => <div className="r" key={x.href}><span>{x.label}</span><b style={{ color: x.prob > 0.5 ? "#2fbf9b" : "#e8794a" }}>{pc(x.prob)}</b></div>)}<div className="cta">Click to list this state&apos;s measures</div></>
                  ) : tipRaces.length === 1 ? (() => { const r = tipRaces[0]; return (
                    <><h4>{r.name}</h4>
                      <div className="r"><span style={{ color: dColor(r.ind) }}>{r.dem}</span><b>{pc(1 - r.p)}</b></div>
                      <div className="r"><span style={{ color: "#ff8399" }}>{r.gop}</span><b>{pc(r.p)}</b></div>
                      <div className="r"><span>{RATING_LABEL[rateOf(r)]}</span><b>{fm(r.m, r.ind)}</b></div>
                      {r.pl?.length ? <div className="fcx-tptr"><div className="eye">{r.pl.length} {r.pl.length === 1 ? "poll" : "polls"}, Democrats up</div><PollTrail polls={trailOf(r)} compact width={220} ind={r.ind} uid={`tp${r.id}`} /></div> : null}
                      <div className="cta">Click for the full race</div></>); })() : (
                    <><h4>{STATE_NAME[tip.k] ?? tip.k}</h4>{tipRaces.slice(0, 6).map((r) => <div className="r" key={r.id}><span>{r.officeLabel ?? r.name}</span><b style={{ color: r.m < 0 ? "#7fa6ff" : "#ff8399" }}>{fm(r.m)}</b></div>)}<div className="cta">Click for the closest one</div></>
                  )}
                </div>
              ) : null}
            </div>
          )}
          <div className="fcx-legend">
            {layer === "measures" ? (
              <><span><i style={{ background: passFill(0.05) }} />Most fail</span><span><i style={{ background: passFill(0.5) }} />Even</span><span><i style={{ background: passFill(0.95) }} />Most pass</span><span><i className="off" />No measures</span></>
            ) : layer === "legis" ? <span className="eye">District shapes are estimated from where each district&apos;s voters live</span> : (
              <>{(["safeD", "likelyD", "leanD", "toss", "leanR", "likelyR", "safeR"] as Rating[]).map((k) => <span key={k}><i style={{ background: RATE[k] }} />{RATING_LABEL[k]}</span>)}{layer === "senate" ? <span><i style={{ background: RATE.ind }} />Lean I</span> : null}<span><i className="off" />No race</span></>
            )}
          </div>
        </div>

        <aside className="fcx-read" aria-live="polite">
          <div className="fcx-verdict">{readout.verdict}</div>
          <div className="fcx-pxwrap">
            <Pixels key={`${layer}-${office}-${chamber}-${mst}`} cells={readout.cells} cols={readout.cols} mark={readout.mark} label={`Every ${layerLabel.toLowerCase()} seat as one square, colored by the forecast`} />
            {readout.markLabel ? <div className="fcx-mk">{readout.markLabel}</div> : null}
          </div>
          <div className="fcx-stats">{readout.stats.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          {chamberOf && chamberOf.trend.length > 2 ? (
            <div className="fcx-trend"><div className="eye">Democratic chance over the last {chamberOf.trend.length} updates</div><Spark v={chamberOf.trend} color="#7fa6ff" /></div>
          ) : null}
          <div className="fcx-close">
            <div className="eye">{layer === "measures" && mst ? `${STATE_NAME[mst] ?? mst} measures` : layer === "legis" ? "Closest chambers" : layer === "measures" ? "Closest measures" : "Closest races"}</div>
            {closest.map((c) => (
              <Link key={c.key} href={c.href} className="fcx-row">
                <span className="nm"><b>{c.name}</b><small>{c.sub}</small></span>
                <span className="vl"><b className={c.cls}>{c.val}</b>{layer === "measures" ? <span className="fcx-cb ms"><i style={{ width: `${c.pD * 100}%` }} /></span> : <ChanceBar pD={c.pD} ind={c.ind} />}</span>
              </Link>
            ))}
          </div>
          <a className="btn g fcx-cta" href="#fcx-table">Every {layer === "legis" ? "chamber" : layer === "measures" ? "measure" : "race"} in this layer</a>
        </aside>
      </div>

      <div className="fcx-table card" id="fcx-table">
        <div className="card-h">
          <h3>Every {layerLabel.toLowerCase()} {layer === "legis" ? "chamber" : layer === "measures" ? "question" : "race"}</h3>
          <span className="eye" style={{ marginLeft: "auto" }}>{tableRows.rows.length} shown</span>
        </div>
        <div className="fcx-tools">
          <input id="fcx-q" type="search" placeholder={layer === "measures" ? "Search a state or measure" : layer === "legis" ? "Search a state" : "Search a race, state or candidate"} value={q} onChange={(e) => { setQ(e.target.value); setAll(false); }} aria-label="Search this layer" />
          <div className="fcx-chips" role="group" aria-label="Sort">
            {([["close", "Closest"], ["d", layer === "measures" ? "Most likely to pass" : "Most Democratic"], ["r", layer === "measures" ? "Most likely to fail" : "Most Republican"], ["az", "A to Z"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
          </div>
        </div>
        <div className="fcx-tw">
          <table>
            <thead>
              {tableRows.kind === "race" ? <tr><th>Race</th><th>Candidates</th><th className="n">Margin</th><th className="fcx-pcol">Polls</th><th>Chance</th><th>Rating</th></tr>
                : tableRows.kind === "legis" ? <tr><th>Chamber</th><th className="n">Seats up</th><th className="n">Majority</th><th className="n">Expected D seats</th><th>Control</th></tr>
                : <tr><th>Measure</th><th>What it does</th><th className="n">Yes</th><th>Chance to pass</th></tr>}
            </thead>
            <tbody>
              {tableRows.kind === "race" ? tableRows.rows.slice(0, shown).map((r) => { const rt = rateOf(r); return (
                <tr key={r.id} onClick={() => router.push(r.href)}>
                  <td><Link href={r.href}><b>{r.name}</b></Link><small>{r.open ? "Open seat" : "Incumbent running"}</small></td>
                  <td><span style={{ color: dColor(r.ind) }}>{r.dem}</span><span className="vs">vs</span><span style={{ color: "#ff8399" }}>{r.gop}</span></td>
                  <td className={`n mono ${r.m < 0 ? (r.ind ? "i" : "d") : "r"}`}>{fm(r.m, r.ind)}</td>
                  <td className="fcx-pcol">{r.pl?.length ? <span className="fcx-spk"><PollTrail polls={trailOf(r)} compact width={120} ind={r.ind} uid={`tr${r.id}`} /><small className="mono">{r.pl.length}</small></span> : <small className="mono" style={{ opacity: .5 }}>none</small>}</td>
                  <td><ChanceBar pD={1 - r.p} ind={r.ind} /><small className="mono">{r.m < 0 ? pc(1 - r.p) : pc(r.p)}</small></td>
                  <td><span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span></td>
                </tr>); })
              : tableRows.kind === "legis" ? tableRows.rows.slice(0, shown).map((c) => (
                <tr key={c.id} onClick={() => router.push(c.href)}>
                  <td><Link href={c.href}><b>{c.name}</b></Link><small>{c.seats} seats</small></td>
                  <td className="n mono">{c.up}</td><td className="n mono">{c.majority}</td><td className="n mono">{c.demSeats.toFixed(1)}</td>
                  <td><ChanceBar pD={c.demControl} ind={false} /><small className={`mono ${c.demControl >= c.gopControl ? "d" : "r"}`}>{c.demControl >= c.gopControl ? `D ${pc(c.demControl)}` : `R ${pc(c.gopControl)}`}</small></td>
                </tr>))
              : tableRows.rows.slice(0, shown).map((x) => (
                <tr key={x.href} onClick={() => router.push(x.href)}>
                  <td><Link href={x.href}><b>{STATE_NAME[x.st] ?? x.st} {x.label}</b></Link></td>
                  <td className="ttl">{x.title}</td>
                  <td className="n mono">{x.yes.toFixed(1)}%<small>needs {(x.thr * 100).toFixed(0)}%</small></td>
                  <td><span className="fcx-cb ms"><i style={{ width: `${x.prob * 100}%` }} /></span><small className={`mono ${x.prob > 0.5 ? "y" : "no"}`}>{pc(x.prob)}</small></td>
                </tr>))}
            </tbody>
          </table>
        </div>
        {tableRows.rows.length > LIMIT ? <div className="fcx-more"><button className="btn" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${tableRows.rows.length}`}</button></div> : null}
      </div>

      {layer === "senate" || layer === "house" ? (
        <div className="fcx-money"><style>{SPENDING_CSS}</style><SpendingTracker office={layer} onPick={(id) => { const r = (layer === "senate" ? data.senate : data.house).find((x) => x.id === id); if (r) router.push(r.href); }} /></div>
      ) : null}

      <div className="fcx-links">
        <Link href="/what-if"><span className="eye g">New</span><b>What if</b><small>Pick winners in any race and watch every other race move with them</small></Link>
        <Link href="/swingometer"><span className="eye">Try it</span><b>Swingometer</b><small>Move any group of voters and watch every race move with them</small></Link>
        <Link href="/maps/early-vote"><span className="eye">Live</span><b>Early vote tracker</b><small>Ballots cast so far, by state, party and method</small></Link>
        <Link href="/forecast/other"><span className="eye">Down ballot</span><b>Every other race</b><small>Mayors, courts and local races we are watching</small></Link>
        <Link href="/forecast/methodology"><span className="eye">How it works</span><b>Methodology</b><small>Fundamentals, polls, early vote and 2,000 simulations</small></Link>
      </div>
    </section>
  );
}
