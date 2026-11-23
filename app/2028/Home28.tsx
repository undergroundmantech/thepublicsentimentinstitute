"use client";
// The 2028 home, On Point's own layout: a scoreboard across the top with the two nominees and a ribbon of every
// electoral vote by rating, the map beside the path to 270 (every state lined up from the bluest to the reddest), and
// a dock of matchups along the bottom. Every state, band and ladder row has a hover card. The map reads three ways:
// the rating, the win chance, or the change from 2024.
// Sketchbook look, Nov 19 2026: the map is a paper cutout, every state flips in from the left with its pencil outline
// tracing itself in, the hovered state pops off the page, and the lines wobble like stop motion.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import { InkDefs, Lift, sweepDelays, useInView } from "@/onpoint-sketchbook/react/SketchMap";
import Link from "@/app/components/Link";
import { PromoRail } from "@/app/components/PromoHub";
import Toon from "@/app/majority-tracker/Toon";
import { X, STATE_NAME, fmtMg, fmtPct, genRes, last, leaderColor, probColor, shiftColor, two, type CountiesGeo, type GenFile, type PrimFile, type StatesGeo } from "./lib";
import { WASH_CUTS, WASH_D, WASH_R, WASH_T, washColor } from "./lib";
import { CountyPaths28, CtyTip, ViewSeg, type View } from "./Cty28";
import { useJSON } from "./useX";
import { RATE, RATES, rateOf, type Rate } from "./rate28";
import { PrimTip, RateTip, StateTip, Tip, type At } from "./Tips28";
import type { Pair } from "./data28";

type Nom = Record<"D" | "R", { name: string; p: number; color: string }[]>;
type PrimSt = Record<"D" | "R", Record<string, { lead: string; color: string; share: number; win: number; top: [string, number, string][] }>>;
type Tab = "pres" | "D" | "R";
type Mode = "rate" | "prob" | "shift";
type Hover = { at: At; kind: "st"; st: string } | { at: At; kind: "band"; k: Rate } | { at: At; kind: "cty"; f: string } | null;
const SMALL = ["DE", "RI", "CT", "NJ", "MD", "MA", "VT", "NH", "DC", "HI"];
const slug = (st: string) => `/2028/${st.toLowerCase().split("-")[0]}`;
const nameOf = (k: string) => STATE_NAME[k] ?? (k === "NE-1" ? "Nebraska 1st District" : k === "NE-3" ? "Nebraska 3rd District" : k === "ME-2" ? "Maine 2nd District" : k);
const ink = (hex: string) => { const c = hex.replace(/^rgb\(|\)$/g, ""); const v = hex.startsWith("#") ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : c.split(",").map(Number); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#1b1328" : "#fff"; };

export default function Home28({ pairs, nom, prim, ev, days, a24, names }: { pairs: Pair[]; nom: Nom; prim: PrimSt; ev: Record<string, number>; days: number; a24: Record<string, number | null>; names: { D: string[]; R: string[] } }) {
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const [sel, setSel] = useState(pairs[0].id);
  // any pairing the forecast ran: the featured ones ship with the page, the rest load from the forecast file on demand
  const [want, setWant] = useState<string | null>(null);
  const [view, setView] = useState<View>("st");
  const G = useJSON<GenFile>(want || view === "co" ? `${X}/gen.json` : null);
  const extra = useMemo(() => {
    if (!want || !G) return null; const [d, r] = want.split("|"); const g = G.pairs.find((x) => x[0] === d && x[1] === r); if (!g) return null;
    const st: Pair["st"] = {}; G.keys.forEach((k, i) => { const v = g[11][i]; if (v) st[k] = [v[0], v[1]]; });
    let evMap = 0; for (const [k, v] of Object.entries(st)) if (v[0] <= 0) evMap += G.ev[k] ?? 0; if (st.NE && st.NE[0] <= 0) evMap += 2;
    return { id: want, d, r, pD: g[2], evD: g[3], ev10: g[4], ev90: g[5], nat: g[6], tip: g[7], odds: null, st, evMap } as Pair;
  }, [want, G]);
  const all = extra && !pairs.some((x) => x.id === extra.id) ? [...pairs, extra] : pairs;
  useEffect(() => { if (extra) setSel(extra.id); }, [extra]);
  const [pd, pr] = (want ?? sel).split("|");
  const pick = (d: string, r: string) => { const id = `${d}|${r}`; setTab("pres"); if (pairs.some((x) => x.id === id)) { setSel(id); setWant(null); } else setWant(id); };
  const loading = !!want && !extra;
  const [tab, setTab] = useState<Tab>("pres");
  const [mode, setMode] = useState<Mode>("rate");
  const [hov, setHov] = useState<Hover>(null);
  const [lit, setLit] = useState<string | null>(null);
  const p = all.find((x) => x.id === sel) ?? pairs[0];
  const stage = useRef<HTMLDivElement>(null);
  const go = useInView(stage);
  const shapes = useMemo(() => (geo ? Object.entries(geo.states) : []) as [string, string][], [geo]);
  const delays = useMemo(() => sweepDelays(shapes), [shapes]);
  const allD = useMemo(() => shapes.map(([, d]) => d).join(""), [shapes]);
  const upSt = hov?.kind === "st" ? hov.st.split("-")[0] : lit ? lit.split("-")[0] : null;
  const hatched = false;
  // states and D.C. per rating, for the map's legend
  const counts = useMemo(() => { const c: Partial<Record<Rate, number>> = {}; for (const [k, v] of Object.entries(p.st)) if (!k.includes("-")) { const r = rateOf(v[0]); c[r] = (c[r] ?? 0) + 1; } return c; }, [p]);
  const evR = 538 - p.evMap, dLead = p.evMap >= 270;

  // every electoral unit, lined up from the bluest to the reddest, with the running Democratic total
  const ladder = useMemo(() => {
    const units = Object.entries(p.st).map(([k, v]) => ({ k, m: v[0], pD: v[1], ev: ev[k] ?? 0 })).filter((u) => u.ev > 0);
    // Nebraska's 1st and 3rd districts are not modeled apart from the state, and vote with it
    if (p.st.NE) for (const k of ["NE-1", "NE-3"]) units.push({ k, m: p.st.NE[0], pD: p.st.NE[1], ev: 1 });
    units.sort((a, b) => a.m - b.m);
    let run = 0; const rows = units.map((u) => { run += u.ev; return { ...u, run }; });
    const cross = rows.find((r) => r.run >= 270)?.k ?? null;
    const band: Record<string, { ev: number; states: [string, number, number][] }> = {};
    for (const r of rows) { const k = rateOf(r.m); (band[k] ??= { ev: 0, states: [] }).ev += r.ev; band[k].states.push([r.k, r.ev, r.m]); }
    return { rows, cross, band };
  }, [p, ev]);
  const ci = ladder.rows.findIndex((r) => r.k === ladder.cross);
  const win = ladder.rows.slice(Math.max(0, ci - 8), ci + 9);
  const above = ladder.rows.slice(0, Math.max(0, ci - 8)), below = ladder.rows.slice(ci + 9);
  const sum = (rs: typeof ladder.rows) => rs.reduce((a, r) => a + r.ev, 0);
  const flips = Object.entries(p.st).filter(([k, v]) => !k.includes("-") && a24[k] != null && Math.sign(a24[k]!) !== Math.sign(v[0])).length;
  const closest = [...ladder.rows].filter((r) => !r.k.startsWith("NE-1") && !r.k.startsWith("NE-3")).sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 5);

  const fill = (st: string) => {
    if (tab !== "pres") { const s = prim[tab][st]; return s ? s.color : "#2a2438"; }
    const v = p.st[st]; if (!v) return "#2a2438";
    if (mode === "prob") return probColor(v[1]);
    if (mode === "shift") return a24[st] != null ? shiftColor(v[0] - a24[st]!, 16) : "#2a2438";
    return RATE[rateOf(v[0])].color;
  };
  const point = (e: MouseEvent, st: string) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "st", st });

  // the county view: the matchup's counties from the forecast file, or each primary's county leader
  const cg = useJSON<CountiesGeo>(view === "co" ? `${X}/counties.json` : null);
  const PF = useJSON<PrimFile>(view === "co" && tab !== "pres" ? `${X}/prim.json` : null);
  const gr = useMemo(() => (view === "co" && G ? genRes(G, p.d, p.r) : null), [view, G, p.d, p.r]);
  const c24 = useMemo(() => new Map((cg?.counties ?? []).map((c) => [c[0], c[4]])), [cg]);
  const pcol = useMemo(() => (tab === "pres" ? {} : Object.fromEntries(nom[tab].map((x) => [x.name, x.color]))), [tab, nom]);
  const pLead = (f: string) => { if (tab === "pres" || !PF) return null; const F = PF[tab]; const c = F.counties[f]; if (!c || c.length < 2) return null;
    const tot = (c[0] as number) + (c.slice(1) as [number, number][]).reduce((a, x) => a + x[1], 0); const [j, v] = c[1] as [number, number]; return { F, c, tot, name: F.names[j], color: pcol[F.names[j]] ?? F.colors[j] ?? "#8f8a99", sh: v / Math.max(1, tot) }; };
  const cFill = (f: string) => {
    if (tab !== "pres") { const l = pLead(f); return l ? leaderColor(l.color, Math.min(0.62, l.sh * 2.2)) : "#e6e0d3"; }
    const r = gr?.cty[f]; if (!r) return "#e6e0d3"; const m = two(r[0], r[1]);
    if (mode === "prob") return probColor(r[4]);
    if (mode === "shift") { const was = c24.get(f); return was != null ? shiftColor(m - was, 16) : "#e6e0d3"; }
    return washColor(m);
  };
  const cHover = (f: string, e: MouseEvent) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "cty", f });
  const cTip = (f: string) => {
    const g = cg?.counties.find((c) => c[0] === f); if (!g) return null;
    if (tab !== "pres") {
      const l = pLead(f); if (!l) return null;
      return <CtyTip name={g[2]} st={g[1]} rows={(l.c.slice(1, 5) as [number, number][]).map(([j, v]) => ({ name: l.F.names[j], side: "U" as const, v, c: pcol[l.F.names[j]] ?? l.F.colors[j] }))} other={l.tot - (l.c.slice(1, 5) as [number, number][]).reduce((a, x) => a + x[1], 0)} m24={null} m={null} />;
    }
    const r = gr?.cty[f]; if (!r) return null;
    return <CtyTip name={g[2]} st={g[1]} rows={[{ name: p.d, side: "D", v: r[0] }, { name: p.r, side: "R", v: r[1] }]} other={r[2] + r[3]} m24={g[4]} m={two(r[0], r[1])} />;
  };
  const cReady = !!cg && (tab === "pres" ? !!gr : !!PF);
  const cPaint = `${tab}|${mode}|${p.id}|${cReady ? 1 : 0}`;
  const stTip = (st: string) => {
    if (tab !== "pres") { const s = prim[tab][st]; return s ? <PrimTip name={nameOf(st)} party={tab} top={s.top} lead={s.lead} win={s.win} /> : null; }
    const v = p.st[st] ?? (st.startsWith("NE-") ? p.st.NE : undefined); if (!v) return null;
    return <StateTip name={nameOf(st)} ev={ev[st] ?? (st.startsWith("NE-") ? 1 : 0)} m={v[0]} pD={v[1]} d={p.d} r={p.r} m24={a24[st] ?? null} note={st === p.tip ? "The tipping point in the simulations" : st.length === 2 ? "Click for its counties" : undefined} />;
  };

  return (
    <div className="h28">
      {/* the scoreboard */}
      <header className="h28-board">
        <div className="h28-board-top">
          <p className="h28-count"><i />{days} days to Election Day · November 7, 2028</p>
          <div className="h28-race sk-tabsline" role="tablist" aria-label="Race">
            {([["pres", "President"], ["D", "Democratic primary"], ["R", "Republican primary"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>
            ))}
          </div>
        </div>
        {tab === "pres" ? (
          <div className="h28-any" role="group" aria-label="Pick any matchup">
            <label><span>Democrat</span><select value={pd} onChange={(e) => pick(e.target.value, pr)}>{names.D.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <label><span>Republican</span><select value={pr} onChange={(e) => pick(pd, e.target.value)}>{names.R.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
            <span>{loading ? "Loading the matchup" : `Any of the forecast's ${(names.D.length * names.R.length).toLocaleString("en-US")} matchups`}</span>
          </div>
        ) : null}
        {tab === "pres" ? (
          <div className="h28-face-off">
            <div className={`h28-side d${dLead ? " lead" : ""}`}>
              <Toon name={p.d} side="D" size={112} className="h28-big-face" uid="b" />
              <div><span className="h28-party">Democrat</span><b className="h28-nm">{p.d}</b><span className="h28-ev"><b key={p.id} className="h28-slam">{p.evMap}</b> electoral votes</span><span className="h28-sub">{fmtPct(p.pD)} to win · {Math.round(p.evD)} in the average simulation</span></div>
            </div>
            <div className="h28-mid">
              <h1 className="h28-h1">The <em>2028</em> forecast</h1>
              <div className="h28-kpis">
                <span><em>Popular vote</em><b className={p.nat < 0 ? "d" : "r"}>{fmtMg(p.nat)}</b></span>
                <span><em>Tipping point</em><b><Link href={slug(p.tip)}>{STATE_NAME[p.tip] ?? p.tip}</Link></b></span>
                <span><em>Flips from 2024</em><b>{flips} states</b></span>
              </div>
            </div>
            <div className={`h28-side r${!dLead ? " lead" : ""}`}>
              <div><span className="h28-party">Republican</span><b className="h28-nm">{p.r}</b><span className="h28-ev"><b key={p.id} className="h28-slam">{evR}</b> electoral votes</span><span className="h28-sub">{fmtPct(1 - p.pD)} to win · {538 - Math.round(p.evD)} in the average simulation</span></div>
              <Toon name={p.r} side="R" size={112} className="h28-big-face" uid="b" />
            </div>
          </div>
        ) : (
          <div className="h28-face-off prim">
            <div className="h28-mid wide">
              <h1 className="h28-h1">The <em>2028</em> {tab === "D" ? "Democratic" : "Republican"} primary</h1>
              <p>Chance of the nomination, with the whole field on every state&apos;s ballot and every county forecast</p>
            </div>
            <div className="h28-leaders">
              {nom[tab].slice(0, 4).map((x, i) => (
                <div key={x.name} className={i === 0 ? "first" : undefined}>
                  <Toon name={x.name} side={tab} size={i === 0 ? 92 : 64} uid="l" />
                  <b>{x.name}</b><span style={{ color: x.color }}>{fmtPct(x.p)}</span>
                  <i className="bar"><i style={{ width: `${x.p * 100}%`, background: x.color }} /></i>
                </div>
              ))}
            </div>
          </div>
        )}
        {tab === "pres" ? (
          <div className="h28-ribbon" aria-label="Electoral votes by rating">
            <div className="bar" onMouseLeave={() => setHov(null)}>
              {RATES.map((r) => { const n = ladder.band[r.k]?.ev ?? 0; return n ? <i key={r.k} style={{ flexGrow: n }} className={`h28-hz ${r.k}${hov?.kind === "band" && hov.k === r.k ? " on" : ""}`} onMouseMove={(e) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "band", k: r.k })}>{n >= 20 ? n : ""}</i> : null; })}
              <em style={{ left: `${(270 / 538) * 100}%` }}><span>270</span></em>
            </div>
            <div className="keys">{RATES.map((r) => <span key={r.k}><i className={`h28-hz ${r.k}`} />{r.label} <b>{ladder.band[r.k]?.ev ?? 0}</b></span>)}</div>
          </div>
        ) : null}
      </header>

      <div className="h28-body">
        {/* the map */}
        <section className="h28-map" aria-label="2028 forecast map">
          {tab === "pres" ? (
            <div className="h28-modes">
              <div className="sk-seg" role="radiogroup" aria-label="Color the map by">
                {([["rate", "Rating"], ["prob", "Win chance"], ["shift", "Change from 2024"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
              </div>
              <ViewSeg view={view} set={setView} busy={view === "co" && !cReady} />
              <span className="h28-closest">Closest: {closest.map((r, i) => <span key={r.k} onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}><Link href={slug(r.k)}>{r.k} {fmtMg(r.m)}</Link>{i < closest.length - 1 ? "," : ""}</span>)}</span>
            </div>
          ) : <div className="h28-modes"><ViewSeg view={view} set={setView} busy={view === "co" && !cReady} /><span className="h28-closest">{view === "co" ? "Each county colored by its primary leader, deeper with a bigger share" : "Each state colored by its primary leader"}</span></div>}
          <div ref={stage} className={`h28-stage ${go ? "sk-map-go" : "sk-map-wait"}`} onMouseLeave={() => setHov(null)}>
            {!geo ? <div className="h28-load">Sketching the map</div> : (
              <svg viewBox="-20 -10 1015 630" role="img" aria-label="United States map of the 2028 forecast" className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
                <InkDefs id="us28" />
                {/* a paper base under the states, so the hatching reads on paper and the cutout edge only shows at the coast */}
                <path className="h28-base" d={allD} fill="#1a1426" aria-hidden="true" />
                {view === "co" && cg && cReady ? <CountyPaths28 rows={cg.counties} fill={cFill} onHover={cHover} onLeave={() => setHov(null)} href={(st) => (tab === "pres" ? slug(st) : `/2028/primaries?st=${st}&party=${tab}`)} paint={cPaint} /> : null}
                {view === "co" ? (cReady ? null : <text x="487" y="300" textAnchor="middle" className="g28-cload">Drawing 3,100 counties</text>) : <g className="h28-states sk-map-flip" key={`${tab}|${mode}|${sel}`}>
                  {shapes.map(([st, d]) => (
                    <a key={st} href={tab === "pres" ? slug(st) : `/2028/primaries?st=${st}&party=${tab}`} aria-label={tab === "pres" ? `${STATE_NAME[st] ?? st} 2028 forecast` : `${STATE_NAME[st] ?? st} ${tab === "D" ? "Democratic" : "Republican"} primary by county`}>
                      <path d={d} fill={fill(st)} style={{ "--d": delays[st] } as CSSProperties} className={(hov?.kind === "st" && hov.st === st) || lit === st ? "hov" : lit || (hov?.kind === "band" && rateOf(p.st[st]?.[0] ?? 0) !== hov.k) ? "fade" : undefined} onMouseMove={(e) => point(e, st)} />
                    </a>
                  ))}
                </g>}
                <Lift id="us28" d={view !== "co" && upSt && geo.states[upSt] ? geo.states[upSt] : null} fill={upSt ? fill(upSt) : "none"} />
                <g className="h28-labels" aria-hidden="true" display={view === "co" ? "none" : undefined}>
                  {Object.entries(geo.labels).map(([st, [x, y]]) => !SMALL.includes(st) ? <text key={st} x={x} y={y} fill={hatched || view === "co" ? "#141218" : ink(fill(st))} className={hatched || view === "co" ? "halo" : undefined}>{st}</text> : null)}
                </g>
              </svg>
            )}
          </div>
          <div className="h28-under">
            {tab === "pres" ? <>
              {Object.keys(p.st).filter((k) => k.includes("-") || k === "DC").map((k) => { const v = p.st[k]; const r = RATE[rateOf(v[0])]; return <span key={k} onMouseMove={(e) => point(e, k)} onMouseLeave={() => setHov(null)}><Link href={slug(k)} className={`h28-chip h28-hz ${r.k}`}>{k === "DC" ? "D.C." : k}</Link></span>; })}
              {view === "co" && mode === "rate" ? <div className="sk-maplegend h28-legend g28-wash">{[4, 3, 2, 1, 0].map((i) => <i key={"d" + i} style={{ background: WASH_D[i] }} />)}<i style={{ background: WASH_T }} />{[0, 1, 2, 3, 4].map((i) => <i key={"r" + i} style={{ background: WASH_R[i] }} />)}<em>counties, from {last(p.d)} by {WASH_CUTS[4]} or more to {last(p.r)} by {WASH_CUTS[4]} or more, lavender within a point</em></div>
                : mode === "rate" ? <div className="sk-maplegend h28-legend">{RATES.map((r) => <span key={r.k}><i className={`h28-hz ${r.k}`} />{r.label} <b>{counts[r.k] ?? 0}</b></span>)}<em>states, by the forecast margin: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up</em></div>
                : mode === "prob" ? <span className="h28-scale"><em>{last(p.d)} certain</em><i className="pr" /><em>{last(p.r)} certain</em></span>
                : <span className="h28-scale"><em>Bluer than 2024</em><i className="sh" /><em>Redder than 2024</em></span>}
            </> : nom[tab].slice(0, 6).map((x) => <span key={x.name} className="h28-pk"><i style={{ background: x.color }} />{x.name}</span>)}
          </div>
          {/* the closest states, as election desk race cards: flip or hold against 2024 */}
          {tab === "pres" ? (
            <section className="h28-close" aria-labelledby="h28-cl">
              <div className="h28-dock-h"><h2 id="h28-cl">The closest states</h2><span>Within a few points in {last(p.d)} against {last(p.r)}</span></div>
              <div className="h28-races">
                {closest.map((r) => {
                  const was = a24[r.k] ?? null, flip = was != null && Math.sign(was) !== Math.sign(r.m), dW = r.m <= 0;
                  return (
                    <Link key={r.k} href={slug(r.k)} className={`sk-race ${dW ? "d" : "r"}`}>
                      <span className="st" onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}>{nameOf(r.k)}</span>
                      <span className={`sk-tag${flip ? " flip" : ""}`}>{flip ? "Flip" : "Hold"}</span>
                      <span className="m"><b>{fmtMg(r.m)}</b><span>{dW ? last(p.d) : last(p.r)} {fmtPct(Math.max(r.pD, 1 - r.pD))}</span></span>
                      <span className="vs">{r.ev} electoral vote{r.ev === 1 ? "" : "s"}{was != null ? ` · ${fmtMg(was)} in 2024` : ""}</span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}
        </section>

        {/* the path to 270, then the rail of everything else On Point runs */}
        <div className="h28-col">
        <aside className="h28-ladder" aria-labelledby="h28-lad">
          {tab === "pres" ? <>
            <div className="h28-lad-h"><h2 id="h28-lad">The path to 270</h2><span>Every state from the bluest to the reddest</span></div>
            {above.length ? <div className="h28-lad-fold d">{above.length} safer {last(p.d)} states · <b>{sum(above)}</b> votes</div> : null}
            <ol onMouseLeave={() => { setHov(null); setLit(null); }}>
              {win.map((r) => {
                const rt = RATE[rateOf(r.m)], isX = r.k === ladder.cross, isTp = r.k === p.tip;
                return (
                  <li key={r.k} className={isX ? "tip" : undefined} onMouseEnter={() => setLit(r.k.split("-")[0])} onMouseMove={(e) => point(e, r.k)}>
                    <Link href={slug(r.k)}>
                      <span className="ab">{r.k}{isTp ? <i className="tp">TP</i> : null}</span>
                      <span className="mg"><i style={{ width: `${Math.min(100, (Math.abs(r.m) / 20) * 100)}%`, background: rt.color, marginLeft: r.m <= 0 ? "auto" : undefined }} /></span>
                      <span className="mv" style={{ color: rt.text ?? rt.color }}>{fmtMg(r.m)}</span>
                      <span className="ev">{r.ev}</span>
                      <span className="run">{r.run}</span>
                    </Link>
                    {isX ? <em>{last(p.d)} passes 270 here</em> : null}
                  </li>
                );
              })}
            </ol>
            {below.length ? <div className="h28-lad-fold r">{below.length} safer {last(p.r)} states · <b>{sum(below)}</b> votes</div> : null}
            <p className="h28-lad-n">The last column adds up {last(p.d)}&apos;s electoral votes from the top. TP marks the tipping point across all 20,000 simulations.</p>
          </> : <>
            <div className="h28-lad-h"><h2 id="h28-lad">Who wins each state</h2><span>The primary leader in the most states</span></div>
            <ol className="h28-prim-l">
              {Object.entries(Object.values(prim[tab]).reduce<Record<string, number>>((a, s) => { a[s.lead] = (a[s.lead] ?? 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, c]) => (
                <li key={n}><Toon name={n} side={tab} size={34} uid="w" /><b>{n}</b><span>{c} states</span></li>
              ))}
            </ol>
            <Link href="/2028/primaries" className="h28-lad-more">Every state&apos;s primary</Link>
          </>}
        </aside>
        <PromoRail />
        </div>
      </div>


      {/* the matchup dock */}
      <section className="h28-dock" aria-labelledby="h28-mu">
        <div className="h28-dock-h"><h2 id="h28-mu">Pick the matchup</h2><span>The likeliest pairings by both parties&apos; nomination odds</span><Link href="/2028/general">Every matchup</Link></div>
        <ul>
          {pairs.map((x) => {
            const on = x.id === sel, w = x.pD >= 0.5;
            return (
              <li key={x.id}>
                <button type="button" className={`h28-mt${on ? " on" : ""}`} aria-pressed={on} onClick={() => { setSel(x.id); setTab("pres"); }}>
                  <span className="pair"><Toon name={x.d} side="D" size={46} uid="k" /><Toon name={x.r} side="R" size={46} uid="k" /></span>
                  <span className="t"><b>{last(x.d)} <i>v</i> {last(x.r)}</b><span>{x.odds != null ? `${fmtPct(x.odds)} likely` : "Generic headline"}</span></span>
                  <span className="sc"><b className="d">{x.evMap}</b><b className="r">{538 - x.evMap}</b></span>
                  <span className="mini"><i style={{ width: `${(x.evMap / 538) * 100}%` }} /></span>
                  <span className={`w ${w ? "d" : "r"}`}>{w ? last(x.d) : last(x.r)} {fmtPct(Math.max(x.pD, 1 - x.pD))} · {fmtMg(x.nat)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <nav className="h28-go" aria-label="More of the 2028 forecast">
        <Link href={slug(p.tip)}><b>{STATE_NAME[p.tip]}</b><span>The tipping point, county by county</span></Link>
        <Link href="/2028/primaries"><b>Play the primaries</b><span>Every state, every candidate</span></Link>
        <a href="/play" className="hot"><b>Play Campaign 2028</b><span>Run for president on this map</span></a>
        <Link href="/2028-presidential-candidates" className="hot"><b>Who is running in 2028</b><span>Every name, by party</span></Link>
      </nav>

      <Tip at={hov?.at ?? null}>
        {hov?.kind === "st" ? stTip(hov.st) : hov?.kind === "cty" ? cTip(hov.f) : hov?.kind === "band" ? (() => { const r = RATE[hov.k]; const b = ladder.band[hov.k]; return <RateTip label={r.label} color={r.color} ink={r.ink} states={b?.states ?? []} ev={b?.ev ?? 0} />; })() : null}
      </Tip>
    </div>
  );
}
