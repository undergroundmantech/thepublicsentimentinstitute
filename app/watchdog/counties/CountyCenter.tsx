"use client";
// The county data center: every county in the country on one map. Color it by the 2024 result, the shift since 2020,
// the 2026 forecast, who lives there, or where the data centers are going. Pick a state to zoom in, search any
// county, click one for everything we have on it.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { marginColor } from "@/app/lib/opp";
import { Pointy } from "@/app/components/home/Mascot";

type C = { n: string; st: string; area: number; r16?: number | null; r20?: number | null; r24?: number | null; v24?: number; pop?: { adults: number; cvap: number; wnh: number; bnh: number; his: number; oth: number }; fc?: [string, number][]; dc?: number };
type DC = { st: string; county: string; fips: string; place: string; company: string; name: string; mw: number | null; investment_usd: number | null; status: string; opposition: string; fight: string; updated: string; source: string };
type DCF = { projects: DC[]; policies: { st: string; county: string; kind: string; what: string; date: string; source: string }[]; polls: { st: string; pollster: string; date: string; finding: string; source: string }[] };
type Layer = "r24" | "shift" | "fc" | "his" | "bnh" | "wnh" | "dc";
const LAYERS: { k: Layer; l: string }[] = [{ k: "r24", l: "2024 result" }, { k: "shift", l: "Shift since 2020" }, { k: "fc", l: "2026 forecast" }, { k: "his", l: "Hispanic adults" }, { k: "bnh", l: "Black adults" }, { k: "wnh", l: "White adults" }, { k: "dc", l: "Data centers" }];
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
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => {
    Promise.all([fetch("/watchdog/us_counties.json").then((r) => r.json()), fetch("/watchdog/counties.json").then((r) => r.json()), fetch("/watchdog/datacenters.json").then((r) => r.json())])
      .then(([s, d, c]) => { setShapes(s); setData(d); setDc(c); }).catch(() => {});
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
    const c = data?.[f]; if (!c) return "rgba(255,255,255,.04)";
    if (layer === "r24") return c.r24 == null ? "rgba(255,255,255,.06)" : marginColor(c.r24);
    if (layer === "shift") { if (c.r24 == null || c.r20 == null) return "rgba(255,255,255,.06)"; const s = c.r24 - c.r20; return marginColor(s * 4); }
    if (layer === "fc") { const m = c.fc?.find((x) => x[0].startsWith("sen"))?.[1] ?? c.fc?.[0]?.[1]; return m == null ? "rgba(255,255,255,.05)" : marginColor(m); }
    if (layer === "dc") return dcBy[f] ? "rgba(231,179,65,.75)" : c.r24 == null ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.07)";
    const v = c.pop?.[layer]; return v == null ? "rgba(255,255,255,.05)" : seq(v / (layer === "wnh" ? 100 : 60), layer === "his" ? [255, 154, 92] : layer === "bnh" ? [183, 140, 255] : [143, 176, 255]);
  };
  const legend = layer === "r24" || layer === "fc" ? ["D +40", "Even", "R +40"] : layer === "shift" ? ["Moved D 10", "No move", "Moved R 10"] : layer === "dc" ? ["", "", ""] : ["0%", "", layer === "wnh" ? "100%" : "60% or more"];
  const matches = useMemo(() => { const k = q.trim().toLowerCase(); if (!data || k.length < 2) return []; return Object.entries(data).filter(([, c]) => `${c.n} ${c.st} ${ST[c.st] ?? ""}`.toLowerCase().includes(k)).slice(0, 8); }, [q, data]);
  const c = sel && data ? data[sel] : null;
  const projects = (dc?.projects ?? []).filter((p) => (st === "all" || p.st === st) && (status === "all" || p.status === status));
  const pick = (f: string) => { setSel(f); const s = data?.[f]?.st; if (s && st !== s) setSt(s); };

  return (
    <div className="cc">
      <div className="cc-bar">
        <div className="wd-chips" role="group" aria-label="Map layer">{LAYERS.map((l) => <button key={l.k} className={layer === l.k ? "on" : ""} aria-pressed={layer === l.k} onClick={() => setLayer(l.k)}>{l.l}</button>)}</div>
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
                    onMouseMove={(e) => { const b = wrap.current!.getBoundingClientRect(); setTip({ x: e.clientX - b.left, y: e.clientY - b.top, f }); }} onClick={() => pick(f)} />
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
            <div className="wd-tip" style={{ left: tip.x + 14, top: tip.y + 12, transform: tip.x > (wrap.current?.clientWidth ?? 0) - 300 ? "translateX(calc(-100% - 28px))" : undefined }}>
              <h4>{data[tip.f].n}, {data[tip.f].st}</h4>
              <div>2024: <b>{fm(data[tip.f].r24)}</b>{data[tip.f].r20 != null && data[tip.f].r24 != null ? ` · shift ${fm((data[tip.f].r24 as number) - (data[tip.f].r20 as number))}` : ""}</div>
              {data[tip.f].fc?.[0] ? <div>{raceName(data[tip.f].fc![0][0])} forecast: <b>{fm(data[tip.f].fc![0][1])}</b></div> : null}
              {data[tip.f].pop ? <div>{data[tip.f].pop!.adults.toLocaleString()} adults · {data[tip.f].pop!.his}% Hispanic · {data[tip.f].pop!.bnh}% Black</div> : null}
              {dcBy[tip.f] ? <div className="g">{dcBy[tip.f].length} data center {dcBy[tip.f].length === 1 ? "project" : "projects"}</div> : null}
            </div>
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

      <section className="card cc-dc">
        <div className="card-h"><h3>Data center buildouts {st !== "all" ? `in ${ST[st]}` : ""}</h3>
          <div className="wd-chips" style={{ marginLeft: "auto" }}>{["all", "announced", "construction", "operating", "paused", "blocked", "withdrawn"].map((s) => <button key={s} className={status === s ? "on" : ""} onClick={() => setStatus(s)}>{s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}</button>)}</div>
        </div>
        <div className="cc-dcgrid">{projects.length ? projects.map((p, i) => <Project key={i} p={p} onOpen={() => { if (p.fips) { pick(p.fips.padStart(5, "0")); setLayer("dc"); wrap.current?.scrollIntoView({ behavior: "smooth", block: "center" }); } }} />) : <div className="wd-empty">No projects match.</div>}</div>
      </section>
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
