"use client";
// The county data center: every county in the country on one map. Color it by the 2024 result, the shift since 2020,
// the 2026 forecast, who lives there, or where the data centers are going. Pick a state to zoom in, search any
// county, click one for everything we have on it.
import FloatTip, { WD_SCOPE } from "@/app/components/opp/FloatTip";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/Link";
import { marginColor } from "@/app/lib/opp";
import { Pointy } from "@/app/components/home/Mascot";

type C = { n: string; st: string; area: number; r16?: number | null; r20?: number | null; r24?: number | null; v24?: number; pop?: { adults: number; cvap: number; wnh: number; bnh: number; his: number; oth: number }; fc?: [string, number][]; dc?: number };
type DC = { st: string; county: string; fips: string; place: string; company: string; name: string; mw: number | null; investment_usd: number | null; status: string; opposition: string; fight: string; updated: string; source: string };
type DCF = { projects: DC[]; policies: { st: string; county: string; kind: string; what: string; date: string; source: string }[]; polls: { st: string; pollster: string; date: string; finding: string; source: string }[] };
type Layer = "r24" | "shift" | "fc" | "gov" | "house" | "turn" | "ev" | "hiprop" | "lotrump" | "loharris" | "appr" | "gas" | "stops" | "his" | "bnh" | "wnh" | "dc";
const LAYERS: { k: Layer; l: string; g: string }[] = [
  { k: "r24", l: "2024 result", g: "Results" }, { k: "shift", l: "Shift since 2020", g: "Results" }, { k: "turn", l: "2024 turnout", g: "Results" },
  { k: "fc", l: "2026 Senate", g: "Forecast" }, { k: "gov", l: "2026 governor", g: "Forecast" }, { k: "house", l: "2026 House", g: "Forecast" }, { k: "ev", l: "Expected 2026 turnout", g: "Forecast" },
  { k: "lotrump", l: "Low propensity Trump voters", g: "Voters" }, { k: "loharris", l: "Low propensity Harris voters", g: "Voters" }, { k: "hiprop", l: "High propensity voters", g: "Voters" }, { k: "appr", l: "Trump approval", g: "Voters" },
  { k: "his", l: "Hispanic adults", g: "People" }, { k: "bnh", l: "Black adults", g: "People" }, { k: "wnh", l: "White adults", g: "People" }, { k: "gas", l: "Gas price", g: "People" },
  { k: "stops", l: "Campaign stops", g: "Watchdog" }, { k: "dc", l: "Data centers", g: "Watchdog" },
];
type GR = [number, number | null];
type Prof = { race?: string; ad?: number; ev?: number; to?: number; m?: number; prop?: [number, number, number | null][]; vp?: [number, number, number | null][]; pp?: GR[]; ap?: GR[]; age?: GR[]; race_?: GR[]; col?: GR[]; hist?: GR[]; appr?: [number, number, number, number, number]; gas?: number };
type Profiles = { meta: { gasDate: string | null; thresholds: { high: number; medium: number }; labels: Record<string, string[]> }; c: Record<string, Prof> };
const loTrump = (x?: Prof) => (x?.vp && x.ad ? (100 * x.vp[1][0]) / x.ad : null);
const loHarris = (x?: Prof) => (x?.vp && x.ad ? (100 * x.vp[3][0]) / x.ad : null);
const pct = (n: number | null | undefined, d = 1) => (n == null ? "n/a" : `${n.toFixed(d)}%`);
type Stop = { who: string; party: string; date: string; st: string; city: string; kind: string; for: string[]; src: string };
const fcOf = (c: C | undefined, o: string) => c?.fc?.find((x) => x[0].startsWith(o + "-"))?.[1];
const turnOf = (c: C | undefined) => (c?.v24 && c.pop?.cvap ? Math.min(100, (c.v24 / c.pop.cvap) * 100) : null);
const fd = (iso: string) => { const t = Date.parse(iso + "T12:00:00Z"); return Number.isFinite(t) ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" }) : iso; };
type SortK = "n" | "r24" | "shift" | "fc" | "gov" | "turn" | "adults" | "v24" | "lot" | "appr" | "gas";
const ST: Record<string, string> = { AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming" };
const STATUS: Record<string, string> = { announced: "#e7b341", construction: "#ff9a5c", operating: "#2fbf9b", paused: "#a79fbd", blocked: "#ff3b5c", withdrawn: "#6b6384" };
const fm = (m: number | null | undefined) => (m == null ? "n/a" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const raceName = (id: string) => { const [o, s] = id.split("-"); return `${ST[s] ?? s} ${o === "sen" ? "Senate" : o === "gov" ? "governor" : o}`; };
const raceHref = (id: string) => { const [o, s] = id.split("-"); return `/forecast/${s.toLowerCase()}/${o === "sen" ? "senate" : "governor"}`; };
const seq = (t: number, rgb: [number, number, number]) => `rgba(${rgb.join(",")},${(0.08 + 0.9 * Math.min(1, Math.max(0, t))).toFixed(3)})`;
function bbox(d: string) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; const re = /(-?\d+\.?\d*)[ ,](-?\d+\.?\d*)/g; let m; while ((m = re.exec(d))) { const x = +m[1], y = +m[2]; if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; } return [x0, y0, x1, y1] as const; }

export default function CountyCenter() {
  const [shapes, setShapes] = useState<[string, string, string][] | null>(null);
  const [data, setData] = useState<Record<string, C> | null>(null);
  const [dc, setDc] = useState<DCF | null>(null);
  const [layer, setLayer] = useState<Layer>("r24");
  const [st, setSt] = useState<string>("all");
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [tip, setTip] = useState<{ x: number; y: number; f: string } | null>(null);
  const [status, setStatus] = useState<string>("all");
  const [stops, setStops] = useState<Record<string, Stop[]>>({});
  const [prof, setProf] = useState<Profiles | null>(null);
  const [sort, setSort] = useState<{ k: SortK; d: 1 | -1 }>({ k: "v24", d: -1 });
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    Promise.all([fetch("/watchdog/us_counties.json").then((r) => r.json()), fetch("/watchdog/counties.json").then((r) => r.json()), fetch("/watchdog/datacenters.json").then((r) => r.json())])
      .then(([s, d, c]) => { setShapes(s); setData(d); setDc(c); }).catch(() => {});
    fetch("/watchdog/county_profiles.json").then((r) => r.json()).then(setProf).catch(() => {});
    // campaign stops from the trail, tied to the county of each stop's city
    Promise.all([fetch("/watchdog/trail.json").then((r) => r.json()), fetch("/watchdog/stop_counties.json").then((r) => (r.ok ? r.json() : {}))])
      .then(([t, sc]: [{ visits: Stop[] }, Record<string, string[]>]) => { const m: Record<string, Stop[]> = {}; for (const v of t.visits) for (const f of (v.city && sc[`${v.st}|${v.city}`]) || []) (m[f] ??= []).push(v); for (const k in m) m[k].sort((a, b) => b.date.localeCompare(a.date)); setStops(m); }).catch(() => {});
  }, []);
  useEffect(() => { try { const u = new URLSearchParams(window.location.search); const l = u.get("layer") as Layer | null; if (l && LAYERS.some((x) => x.k === l)) setLayer(l); const s = u.get("st"); if (s && ST[s.toUpperCase()]) setSt(s.toUpperCase()); } catch { /* no window */ } }, []);

  const view = useMemo(() => {
    if (!shapes || st === "all") return [0, 0, 975, 610];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const [, s, d] of shapes) if (s === st) { const b = bbox(d); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
    const pad = Math.max(x1 - x0, y1 - y0) * 0.06, w = x1 - x0 + pad * 2, h = y1 - y0 + pad * 2, k = Math.max(w / 975, h / 610);
    const W = 975 * k, H = 610 * k; return [x0 - pad - (W - w) / 2, y0 - pad - (H - h) / 2, W, H];
  }, [shapes, st]);
  const dcBy = useMemo(() => { const m: Record<string, DC[]> = {}; for (const p of dc?.projects ?? []) if (p.fips) (m[p.fips.padStart(5, "0")] ??= []).push(p); return m; }, [dc]);
  const centers = useMemo(() => { const m: Record<string, [number, number]> = {}; for (const [f, , d] of shapes ?? []) { if (!dcBy[f]) continue; const b = bbox(d); m[f] = [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2]; } return m; }, [shapes, dcBy]);
  const fill = (f: string) => {
    const c = data?.[f]; if (!c) return "rgba(var(--wd-e),.04)";
    if (layer === "r24") return c.r24 == null ? "rgba(var(--wd-e),.06)" : marginColor(c.r24);
    if (layer === "shift") { if (c.r24 == null || c.r20 == null) return "rgba(var(--wd-e),.06)"; const s = c.r24 - c.r20; return marginColor(s * 4); }
    if (layer === "fc" || layer === "gov" || layer === "house") { const m = fcOf(c, layer === "fc" ? "sen" : layer); return m == null ? "rgba(var(--wd-e),.05)" : marginColor(m); }
    if (layer === "turn") { const t = turnOf(c); return t == null ? "rgba(var(--wd-e),.05)" : seq((t - 35) / 45, [47, 191, 155]); }
    const pf = prof?.c[f];
    if (layer === "ev") return pf?.to == null ? "rgba(var(--wd-e),.05)" : seq((pf.to - 25) / 45, [47, 191, 155]);
    if (layer === "hiprop") return pf?.prop ? seq(pf.prop[0][0] / 55, [143, 176, 255]) : "rgba(var(--wd-e),.05)";
    if (layer === "lotrump") { const v = loTrump(pf); return v == null ? "rgba(var(--wd-e),.05)" : seq(v / 30, [255, 59, 92]); }
    if (layer === "loharris") { const v = loHarris(pf); return v == null ? "rgba(var(--wd-e),.05)" : seq(v / 30, [61, 123, 255]); }
    if (layer === "appr") return pf?.appr ? marginColor(pf.appr[3]) : "rgba(var(--wd-e),.05)";
    if (layer === "gas") return pf?.gas == null ? "rgba(var(--wd-e),.05)" : seq((pf.gas - 2.9) / 1.6, [231, 179, 65]);
    if (layer === "stops") { const n = stops[f]?.length ?? 0; return n ? seq(0.35 + Math.min(1, n / 6) * 0.65, [255, 217, 138]) : "rgba(var(--wd-e),.06)"; }
    if (layer === "dc") return dcBy[f] ? "rgba(231,179,65,.75)" : c.r24 == null ? "rgba(var(--wd-e),.05)" : "rgba(var(--wd-e),.07)";
    const v = c.pop?.[layer]; return v == null ? "rgba(var(--wd-e),.05)" : seq(v / (layer === "wnh" ? 100 : 60), layer === "his" ? [255, 154, 92] : layer === "bnh" ? [183, 140, 255] : [143, 176, 255]);
  };
  const legend = layer === "appr" ? ["Net disapprove 40", "Even", "Net approve 40"] : layer === "ev" ? ["25% of adults", "", "70% or more"] : layer === "hiprop" ? ["0% of adults", "", "55% or more"] : layer === "lotrump" || layer === "loharris" ? ["0% of adults", "", "30% or more"] : layer === "gas" ? ["$2.90", "", "$4.50 or more"] : layer === "r24" || layer === "fc" || layer === "gov" || layer === "house" ? ["D +40", "Even", "R +40"] : layer === "shift" ? ["Moved D 10", "No move", "Moved R 10"] : layer === "turn" ? ["35% of citizens", "", "80% or more"] : layer === "stops" ? ["1 stop", "", "6 or more"] : layer === "dc" ? ["", "", ""] : ["0%", "", layer === "wnh" ? "100%" : "60% or more"];
  // the state as a whole, from its counties weighted by 2024 votes, for the "compared with the state" line
  const stateM = useMemo(() => { const m: Record<string, number> = {}; if (!data) return m; const acc: Record<string, [number, number]> = {}; for (const c of Object.values(data)) if (c.r24 != null && c.v24) { const a = (acc[c.st] ??= [0, 0]); a[0] += c.r24 * c.v24; a[1] += c.v24; } for (const k in acc) m[k] = acc[k][0] / acc[k][1]; return m; }, [data]);
  const rows = useMemo(() => {
    if (!data) return [];
    const val = (f: string, c: C, k: SortK): number | string | null => k === "n" ? c.n : k === "r24" ? c.r24 ?? null : k === "shift" ? (c.r24 != null && c.r20 != null ? c.r24 - c.r20 : null) : k === "fc" ? fcOf(c, "sen") ?? null : k === "gov" ? fcOf(c, "gov") ?? null : k === "turn" ? turnOf(c) : k === "adults" ? c.pop?.adults ?? null : k === "lot" ? loTrump(prof?.c[f]) : k === "appr" ? prof?.c[f]?.appr?.[3] ?? null : k === "gas" ? prof?.c[f]?.gas ?? null : c.v24 ?? null;
    let list = Object.entries(data).filter(([, c]) => st === "all" || c.st === st);
    if (st === "all") list = list.sort((a, b) => (b[1].v24 ?? 0) - (a[1].v24 ?? 0)).slice(0, 60);
    return list.sort((a, b) => { const x = val(a[0], a[1], sort.k), y = val(b[0], b[1], sort.k); if (x == null) return 1; if (y == null) return -1; return (typeof x === "string" ? x.localeCompare(y as string) : (x as number) - (y as number)) * sort.d; });
  }, [data, st, sort, prof]);
  const th = (k: SortK, l: string) => <th aria-sort={sort.k === k ? (sort.d === 1 ? "ascending" : "descending") : "none"}><button onClick={() => setSort((o) => ({ k, d: o.k === k ? (o.d === 1 ? -1 : 1) : k === "n" ? 1 : -1 }))}>{l}</button></th>;
  const matches = useMemo(() => { const k = q.trim().toLowerCase(); if (!data || k.length < 2) return []; return Object.entries(data).filter(([, c]) => `${c.n} ${c.st} ${ST[c.st] ?? ""}`.toLowerCase().includes(k)).slice(0, 8); }, [q, data]);
  const c = sel && data ? data[sel] : null;
  const projects = (dc?.projects ?? []).filter((p) => (st === "all" || p.st === st) && (status === "all" || p.status === status));
  const pick = (f: string) => { setSel(f); const s = data?.[f]?.st; if (s && st !== s) setSt(s); };

  return (
    <div className="cc">
      <div className="cc-bar">
        <div className="cc-layers">{[...new Set(LAYERS.map((l) => l.g))].map((g) => (
          <div className="cc-lg" key={g} role="group" aria-label={`${g} layers`}><span>{g}</span><div className="wd-chips">{LAYERS.filter((l) => l.g === g).map((l) => <button key={l.k} className={layer === l.k ? "on" : ""} aria-pressed={layer === l.k} onClick={() => setLayer(l.k)}>{l.l}</button>)}</div></div>
        ))}</div>
        <select className="wd-input cc-st" value={st} onChange={(e) => { setSt(e.target.value); setSel(null); }} aria-label="State">
          <option value="all">Every state</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <div className="cc-search">
          <input id="cc-q" className="wd-input" placeholder="Find a county" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a county" />
          {matches.length ? <div className="cx-sugg">{matches.map(([f, m]) => <button key={f} onClick={() => { pick(f); setQ(""); }}>{m.n}, {m.st}</button>)}</div> : null}
        </div>
      </div>
      <div className="cc-stage">
        <div className="card cc-map" ref={wrap} onMouseLeave={() => setTip(null)}>
          {shapes && data ? (
            <svg viewBox={view.join(" ")} role="img" aria-label={`Every county, colored by ${LAYERS.find((l) => l.k === layer)?.l}`} className="cc-svg">
              <g className={`cc-g l-${layer}`}>
                {shapes.map(([f, s, d]) => (
                  <path key={f} d={d} className={`cc-c${sel === f ? " on" : ""}${st !== "all" && s !== st ? " off" : ""}`} style={{ fill: fill(f) }}
                    onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, f })} onClick={() => pick(f)} />
                ))}
              </g>
              {layer === "dc" ? Object.entries(centers).map(([f, [x, y]]) => {
                const ps = dcBy[f]; const s = ps.some((p) => p.status === "blocked" || p.opposition === "vote_failed") ? "blocked" : ps[0].status;
                const k = view[2] / 975;
                return <g key={f} className="cc-pin" transform={`translate(${x},${y})`} onClick={() => pick(f)}><circle r={9 * k} className="cc-pulse" style={{ stroke: STATUS[s] }} /><circle r={3.6 * k} fill={STATUS[s] ?? "#e7b341"} stroke="#0a0711" strokeWidth={k} /></g>;
              }) : null}
            </svg>
          ) : <div className="cc-load sx-skel" />}
          {tip && data?.[tip.f] ? (
            <FloatTip x={tip.x} y={tip.y} scope={WD_SCOPE}>
              <h4>{data[tip.f].n}, {data[tip.f].st}</h4>
              <div>2024: <b>{fm(data[tip.f].r24)}</b>{data[tip.f].r20 != null && data[tip.f].r24 != null ? ` · shift ${fm((data[tip.f].r24 as number) - (data[tip.f].r20 as number))}` : ""}</div>
              {data[tip.f].fc?.[0] ? <div>{raceName(data[tip.f].fc![0][0])} forecast: <b>{fm(data[tip.f].fc![0][1])}</b></div> : null}
              {data[tip.f].pop ? <div>{data[tip.f].pop!.adults.toLocaleString()} adults · {data[tip.f].pop!.his}% Hispanic · {data[tip.f].pop!.bnh}% Black</div> : null}
              {prof?.c[tip.f]?.vp ? <div>Low propensity Trump voters: <b>{prof.c[tip.f].vp![1][0].toLocaleString()}</b>, {pct(loTrump(prof.c[tip.f]))} of adults</div> : null}
              {prof?.c[tip.f]?.appr ? <div>Trump approval: <b>{prof.c[tip.f].appr![0]}%</b> approve, {prof.c[tip.f].appr![1]}% disapprove</div> : null}
              {prof?.c[tip.f]?.gas ? <div>Gas, regular: <b>${prof.c[tip.f].gas!.toFixed(2)}</b></div> : null}
              {turnOf(data[tip.f]) != null ? <div>2024 turnout: <b>{turnOf(data[tip.f])!.toFixed(0)}%</b> of voting age citizens</div> : null}
              {stops[tip.f]?.length ? <div className="g">{stops[tip.f].length} campaign {stops[tip.f].length === 1 ? "stop" : "stops"}: {[...new Set(stops[tip.f].map((v) => v.who))].slice(0, 3).join(", ")}</div> : null}
              {dcBy[tip.f] ? <div className="g">{dcBy[tip.f].length} data center {dcBy[tip.f].length === 1 ? "project" : "projects"}</div> : null}
            </FloatTip>
          ) : null}
          <div className="cc-legend">
            {layer === "dc" ? Object.entries(STATUS).map(([k, v]) => <span key={k}><i style={{ background: v, borderRadius: "50%" }} />{k[0].toUpperCase() + k.slice(1)}</span>)
              : <><span>{legend[0]}</span><i className={`cc-ramp r-${layer}`} /><span>{legend[2]}</span></>}
          </div>
          <Pointy className="cc-pty" pose="point" prop="magnifier" size={84} look={-1} flip detective say={layer === "dc" ? <>{dc?.projects.length ?? 0} projects tracked. Gold counties have one.</> : <>Click any county for everything on it.</>} />
        </div>

        <aside className="card cc-panel">
          {c && sel ? (
            <div className="card-b">
              <div className="eye gold">{ST[c.st] ?? c.st}</div>
              <h3 className="cc-h">{c.n}</h3>
              <div className="cc-kv"><span>Land area</span><b>{Math.round(c.area).toLocaleString()} sq mi</b></div>
              {c.v24 ? <div className="cc-kv"><span>2024 votes cast</span><b>{c.v24.toLocaleString()}</b></div> : null}
              {turnOf(c) != null ? <div className="cc-kv"><span>2024 turnout, voting age citizens</span><b>{turnOf(c)!.toFixed(1)}%</b></div> : null}
              {c.r24 != null && stateM[c.st] != null ? <div className="cc-kv"><span>Compared with {ST[c.st] ?? c.st}</span><b>{Math.abs(c.r24 - stateM[c.st]) < 0.5 ? "About the same" : `${Math.abs(c.r24 - stateM[c.st]).toFixed(1)} pts more ${c.r24 > stateM[c.st] ? "Republican" : "Democratic"}`}</b></div> : null}
              {sel && prof?.c[sel] ? <ProfilePanel p={prof.c[sel]} L={prof.meta.labels} gasDate={prof.meta.gasDate} /> : null}
              <div className="eye" style={{ marginTop: 12 }}>Presidential results</div>
              {(["r16", "r20", "r24"] as const).map((k, i) => { const m = c[k]; return m == null ? null : (
                <div key={k} className="cc-res"><span>{2016 + i * 4}</span><span className="cc-rb"><i style={{ left: m < 0 ? `${50 + m / 2}%` : "50%", width: `${Math.min(50, Math.abs(m) / 2)}%`, background: m < 0 ? "#3d7bff" : "#ff3b5c" }} /></span><b className={m < 0 ? "d" : "r"}>{fm(m)}</b></div>); })}
              {c.fc?.length ? <><div className="eye" style={{ marginTop: 12 }}>The 2026 forecast here</div>{c.fc.map(([id, m]) => <Link key={id} href={raceHref(id)} className="cc-fc"><span>{raceName(id)}</span><b className={m < 0 ? "d" : "r"}>{fm(m)}</b></Link>)}</> : null}
              {c.pop ? (
                <>
                  <div className="eye" style={{ marginTop: 12 }}>Who lives here, adults</div>
                  <div className="cc-kv"><span>Adults</span><b>{c.pop.adults.toLocaleString()}</b></div>
                  <div className="cc-kv"><span>Citizens of voting age</span><b>{c.pop.cvap.toLocaleString()}</b></div>
                  <div className="cc-stack">{([["wnh", "White", "#8fb0ff"], ["his", "Hispanic", "#ff9a5c"], ["bnh", "Black", "#b78cff"], ["oth", "Asian and other", "#2fbf9b"]] as const).map(([k, l, col]) => <i key={k} style={{ width: `${c.pop![k]}%`, background: col }} title={`${l} ${c.pop![k]}%`} />)}</div>
                  <div className="cc-keys">{([["wnh", "White", "#8fb0ff"], ["his", "Hispanic", "#ff9a5c"], ["bnh", "Black", "#b78cff"], ["oth", "Asian and other", "#2fbf9b"]] as const).map(([k, l, col]) => <span key={k}><i style={{ background: col }} />{l} {c.pop![k]}%</span>)}</div>
                </>
              ) : null}
              {stops[sel]?.length ? (
                <>
                  <div className="eye gold" style={{ marginTop: 12 }}>Campaign stops here</div>
                  {stops[sel].map((v, i) => <div key={i} className="cc-poll"><b>{v.who} · {fd(v.date)}{v.city ? `, ${v.city}` : ""}</b><small>{v.kind}{v.for?.length ? ` for ${v.for.join(", ")}` : ""}{v.src ? <> · <a href={v.src} target="_blank" rel="noreferrer">Source</a></> : null}</small></div>)}
                  <Link href="/watchdog/trail" className="cc-fc"><span>See the whole campaign trail</span><b>Trail</b></Link>
                </>
              ) : null}
              {dcBy[sel] ? (
                <>
                  <div className="eye gold" style={{ marginTop: 12 }}>Data centers</div>
                  {dcBy[sel].map((p, i) => <Project key={i} p={p} />)}
                </>
              ) : null}
              <button className="wd-btn" style={{ marginTop: 12 }} onClick={() => setSel(null)}>Close</button>
            </div>
          ) : (
            <div className="card-b">
              <div className="eye gold">The county data center</div>
              <h3 className="cc-h">{st === "all" ? "3,142 counties" : ST[st]}</h3>
              <p className="wd-note">Results since 2016, the 2026 forecast county by county, who lives there by race and ethnicity, and every data center project we track. Click a county to open it.</p>
              {dc ? (
                <>
                  <div className="eye" style={{ marginTop: 12 }}>What voters say about data centers</div>
                  {dc.polls.filter((p) => st === "all" || p.st === st).slice(0, 6).map((p, i) => <div key={i} className="cc-poll"><b>{p.st} · {p.pollster}</b><small>{p.finding}</small></div>)}
                  <div className="eye" style={{ marginTop: 12 }}>Moratoriums and ballot measures</div>
                  {dc.policies.filter((p) => st === "all" || p.st === st).slice(0, 8).map((p, i) => <div key={i} className="cc-poll"><b>{p.st}{p.county ? `, ${p.county}` : ""} · {p.kind}</b><small>{p.what}</small></div>)}
                </>
              ) : null}
            </div>
          )}
        </aside>
      </div>

      <section className="card cc-tbl">
        <div className="card-h"><h3>{st === "all" ? "The 60 biggest counties by 2024 vote" : `Every county in ${ST[st]}`}</h3><span className="eye">{rows.length} counties · click a row to open it</span></div>
        <div className="cc-tw">
          <table>
            <thead><tr>{th("n", "County")}{th("r24", "2024")}{th("shift", "Shift")}{th("fc", "2026 Senate")}{th("gov", "2026 governor")}{th("turn", "Turnout")}{th("v24", "Votes")}{th("adults", "Adults")}{th("lot", "Low prop Trump")}{th("appr", "Trump net approval")}{th("gas", "Gas")}<th><span className="cc-th">Stops</span></th></tr></thead>
            <tbody>{rows.map(([f, r]) => { const sh = r.r24 != null && r.r20 != null ? r.r24 - r.r20 : null, sn = fcOf(r, "sen"), gv = fcOf(r, "gov"), tu = turnOf(r); return (
              <tr key={f} className={sel === f ? "on" : ""} onClick={() => { pick(f); wrap.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>
                <td><b>{r.n}</b>{st === "all" ? <span>, {r.st}</span> : null}</td>
                <td className={r.r24 == null ? "" : r.r24 < 0 ? "d" : "r"}>{fm(r.r24)}</td>
                <td className={sh == null ? "" : sh < 0 ? "d" : "r"}>{sh == null ? "n/a" : `${sh < 0 ? "D" : "R"} +${Math.abs(sh).toFixed(1)}`}</td>
                <td className={sn == null ? "" : sn < 0 ? "d" : "r"}>{sn == null ? "" : fm(sn)}</td>
                <td className={gv == null ? "" : gv < 0 ? "d" : "r"}>{gv == null ? "" : fm(gv)}</td>
                <td>{tu == null ? "" : `${tu.toFixed(0)}%`}</td>
                <td>{r.v24 ? r.v24.toLocaleString() : ""}</td>
                <td>{r.pop?.adults ? r.pop.adults.toLocaleString() : ""}</td>
                <td>{loTrump(prof?.c[f]) == null ? "" : pct(loTrump(prof?.c[f]))}</td>
                <td className={prof?.c[f]?.appr ? (prof.c[f].appr![3] < 0 ? "d" : "r") : ""}>{prof?.c[f]?.appr ? `${prof.c[f].appr![3] > 0 ? "+" : ""}${prof.c[f].appr![3].toFixed(1)}` : ""}</td>
                <td>{prof?.c[f]?.gas ? `$${prof.c[f].gas!.toFixed(2)}` : ""}</td>
                <td>{stops[f]?.length ?? ""}</td>
              </tr>); })}</tbody>
          </table>
        </div>
      </section>

      <section className="card cc-dc">
        <div className="card-h"><h3>Data center buildouts {st !== "all" ? `in ${ST[st]}` : ""}</h3>
          <div className="wd-chips" style={{ marginLeft: "auto" }}>{["all", "announced", "construction", "operating", "paused", "blocked", "withdrawn"].map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>)}</div>
        </div>
        <div className="cc-dcgrid">{projects.length ? projects.map((p, i) => <Project key={i} p={p} onOpen={() => { if (p.fips) { pick(p.fips.padStart(5, "0")); setLayer("dc"); wrap.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} />) : <div className="wd-empty">No projects match.</div>}</div>
      </section>
    </div>
  );
}

const mg = (m: number | null) => (m == null ? "" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
function Rows({ title, labels, rows, note }: { title: string; labels: string[]; rows: GR[]; note?: string }) {
  return (
    <div className="cc-grp">
      <div className="eye">{title}</div>
      {rows.map(([sh, m], i) => (
        <div className="cc-gr" key={i}><span>{labels[i]}</span><span className="cc-sb"><i style={{ width: `${Math.min(100, sh)}%` }} /></span><b>{pct(sh, 0)}</b><em className={m == null ? "" : m < 0 ? "d" : "r"}>{mg(m)}</em></div>
      ))}
      {note ? <small className="cc-gn">{note}</small> : null}
    </div>
  );
}
function ProfilePanel({ p, L, gasDate }: { p: Prof; L: Record<string, string[]>; gasDate: string | null }) {
  return (
    <div className="cc-prof">
      {p.appr ? (
        <div className="cc-grp">
          <div className="eye gold">Trump approval, On Point Polling county estimate</div>
          <div className="cc-ap"><i className="r" style={{ width: `${p.appr[0]}%` }} /><i className="n" style={{ width: `${p.appr[2]}%` }} /><i className="d" style={{ width: `${p.appr[1]}%` }} /></div>
          <div className="cc-kv"><span>Approve {p.appr[0]}% · No opinion {p.appr[2]}% · Disapprove {p.appr[1]}%</span><b className={p.appr[3] < 0 ? "d" : "r"}>Net {p.appr[3] > 0 ? "+" : ""}{p.appr[3].toFixed(1)}</b></div>
          <small className="cc-gn">Give or take {p.appr[4].toFixed(1)} points on the net.</small>
        </div>
      ) : null}
      {p.gas ? <div className="cc-kv"><span>Gas, regular{gasDate ? `, AAA ${gasDate.slice(5).replace("-", "/")}` : ""}</span><b>${p.gas.toFixed(3)}</b></div> : null}
      {p.ev && p.ad ? (
        <>
          <div className="eye gold" style={{ marginTop: 12 }}>The 2026 electorate, simulated</div>
          <div className="cc-kv"><span>Expected 2026 voters</span><b>{p.ev.toLocaleString()}</b></div>
          <div className="cc-kv"><span>Expected turnout of adults</span><b>{pct(p.to)}</b></div>
          {p.vp ? (
            <div className="cc-grp">
              <div className="eye">2024 voters by turnout propensity</div>
              <div className="cc-vh"><span /><span>Adults</span><span>Expected to vote</span><span>Leans</span></div>
              {p.vp.map(([ad, ev, m], i) => (
                <div className={`cc-vr${i === 1 ? " hot" : ""}`} key={i}><span>{L.vp[i]}</span><b>{ad.toLocaleString()}</b><b>{ev.toLocaleString()} <small>{ad ? `${Math.round((100 * ev) / ad)}%` : ""}</small></b><em className={m == null ? "" : m < 0 ? "d" : "r"}>{mg(m)}</em></div>
              ))}
              <small className="cc-gn">High propensity means a modeled chance of voting of 80 percent or more. Lower propensity Trump voters are the ones Republicans most need to turn out.</small>
            </div>
          ) : null}
          {p.prop ? <Rows title="Turnout propensity, share of expected voters" labels={L.prop} rows={p.prop.map((x) => [x[1], x[2]] as GR)} note={`Share of adults: ${p.prop.map((x, i) => `${L.prop[i].split(" ")[0].toLowerCase()} ${x[0].toFixed(0)}%`).join(", ")}.`} /> : null}
          {p.pp ? <Rows title="Party and propensity" labels={L.pp} rows={p.pp} /> : null}
          {p.ap ? <Rows title="Trump approval in the electorate" labels={L.ap} rows={p.ap} /> : null}
          {p.age ? <Rows title="Age" labels={L.age} rows={p.age} /> : null}
          {p.race_ ? <Rows title="Race" labels={L.race_} rows={p.race_} /> : null}
          {p.col ? <Rows title="Education" labels={L.col} rows={p.col} /> : null}
          {p.hist ? <Rows title="Vote history" labels={L.hist} rows={p.hist} /> : null}
          <small className="cc-gn">From the forecast's simulated voter file for {p.race?.startsWith("sen") ? "the Senate race" : "the governor race"}: the share of expected 2026 voters in each group and how the group leans. This is the voter file step of the model, before the polling average and history are blended in, so its margins differ a little from the published forecast.</small>
        </>
      ) : <small className="cc-gn" style={{ display: "block", marginTop: 10 }}>No 2026 Senate or governor race here, so there is no simulated electorate for this county.</small>}
    </div>
  );
}

function Project({ p, onOpen }: { p: DC; onOpen?: () => void }) {
  const size = p.mw ? `${p.mw.toLocaleString()} MW` : p.investment_usd ? `$${(p.investment_usd / 1e9).toFixed(p.investment_usd >= 1e10 ? 0 : 1)}B` : "";
  return (
    <div className={`cc-pj${onOpen ? " click" : ""}`} onClick={onOpen} role={onOpen ? "button" : undefined} tabIndex={onOpen ? 0 : undefined} onKeyDown={onOpen ? (e) => { if (e.key === "Enter") onOpen(); } : undefined}>
      <div className="cc-pjt"><span className="cc-dot" style={{ background: STATUS[p.status] ?? "#e7b341" }} /><b>{p.name}</b>{size ? <span className="wd-pill g">{size}</span> : null}</div>
      <small>{p.company} · {p.place ? `${p.place}, ` : ""}{p.county} County, {p.st} · {p.status}{p.opposition && p.opposition !== "none" ? ` · ${p.opposition.replace("_", " ")}` : ""}</small>
      {p.fight ? <p>{p.fight}</p> : null}
      <a href={p.source} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>Source, {p.updated}</a>
    </div>
  );
}
