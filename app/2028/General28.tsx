"use client";
// The 2028 general election in the overview's own format: the scoreboard with both nominees, the ribbon of electoral
// votes by rating, the paper cutout map beside the path to 270 and the closest states as race cards. Above the map sits
// the ticket builder from the forecast dashboard: pick any Democrat and Republican, add running mates, and add or
// remove a third party, a named independent, a nominee running outside their party, or a custom independent built from
// lanes with a home state and a share. Plain pairings read the forecast's own grid; anything else runs the county engine
// in the browser, 4,000 simulations, and every state is the sum of its counties.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent } from "react";
import Pointy from "@/onpoint-sketchbook/react/Pointy";
import { HatchDefs, InkDefs, InkOutline, Lift, sweepDelays, useBoil, useInView } from "@/onpoint-sketchbook/react/SketchMap";
import Link from "@/app/components/Link";
import Toon from "@/app/majority-tracker/Toon";
import { X, STATE_NAME, fmtK, fmtMg, fmtPct, fmtSh, genRes, last, probColor, shiftColor, two, type GenFile, type Res, type StatesGeo } from "./lib";
import { useJSON, useTicket, type Ticket } from "./useX";
import { RATE, RATES, rateOf, type Rate } from "./rate28";
import { RateTip, StateTip, Tip, type At } from "./Tips28";
import type { CandOpt, Grid } from "./Matchup";

const T3 = "#f2b705";
const LANES = ["Right populist", "Libertarian", "Centrist", "Progressive left", "Anti establishment", "Working class"];
const SMALL = ["DE", "RI", "CT", "NJ", "MD", "MA", "VT", "NH", "DC", "HI"];
const slug = (st: string) => `/2028/${st.toLowerCase().split("-")[0]}`;
const nameOf = (k: string) => STATE_NAME[k] ?? (k === "NE-1" ? "Nebraska 1st District" : k === "NE-3" ? "Nebraska 3rd District" : k === "ME-1" ? "Maine 1st District" : k === "ME-2" ? "Maine 2nd District" : k === "NE-2" ? "Nebraska 2nd District" : k);
const ink = (hex: string) => { if (!hex.startsWith("#") && !hex.startsWith("rgb")) return "#141218"; const c = hex.replace(/^rgb\(|\)$/g, ""); const v = hex.startsWith("#") ? [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) : c.split(",").map(Number); return v[0] * 0.3 + v[1] * 0.59 + v[2] * 0.11 > 150 ? "#1b1328" : "#fff"; };
const parseLanes = (s: string) => { const o: Record<string, number> = {}; (s || "").split(";").filter(Boolean).forEach((x) => { const i = x.lastIndexOf("="); o[decodeURIComponent(x.slice(0, i))] = Number(x.slice(i + 1)); }); return o; };
const joinLanes = (o: Record<string, number>) => Object.entries(o).map(([k, v]) => `${encodeURIComponent(k)}=${v}`).join(";");

type Full = Required<Pick<Ticket, "dp" | "rp">> & { dvp: string; rvp: string; tp: string; tps: number | null; tname: string; thome: string; tlanes: string };
type Mode = "rate" | "prob" | "shift";
type Hover = { at: At; kind: "st"; st: string } | { at: At; kind: "band"; k: Rate | "I" } | null;
type Unit = { k: string; m: number; pD: number; pR: number; pI: number; sD: number; sR: number; sI: number; ev: number; lead: "D" | "R" | "I" };

export default function General28({ base, cands, grid, names, a24 }: { base: Res; cands: CandOpt[]; grid: Grid[]; names: { D: string[]; R: string[] }; a24: Record<string, number | null> }) {
  const [t, setT] = useState<Full>({ dp: base.D, rp: base.R, dvp: "", rvp: "", tp: "", tps: null, tname: "", thome: "", tlanes: "" });
  const plain = !t.dvp && !t.rvp && !t.tp;
  const G = useJSON<GenFile>(plain && !(t.dp === base.D && t.rp === base.R) ? `${X}/gen.json` : null);
  const rg = useMemo(() => (plain && G ? genRes(G, t.dp, t.rp) : null), [plain, G, t.dp, t.rp]);
  const eng = useTicket(t, null, plain);
  const isBase = plain && t.dp === base.D && t.rp === base.R;
  const fresh: Res | null = isBase ? base : plain ? rg : eng.res;
  // keep the last answer on screen while the next one runs
  const held = useRef<Res>(base);
  if (fresh) held.current = fresh;
  const res = fresh ?? held.current;
  const busy = !fresh;

  // /2028/general?d=Harris&r=Vance&tp=I|Andrew Yang opens a matchup
  useEffect(() => {
    const id = setTimeout(() => { try {
      const q = new URLSearchParams(window.location.search); const d = q.get("d"), r = q.get("r"), tp = q.get("tp");
      const c = tp ? cands.find((x) => `${x.party}|${x.name}` === tp) : null;
      if (d || r || tp) setT((o) => ({ ...o, dp: d && names.D.includes(d) ? d : o.dp, rp: r && names.R.includes(r) ? r : o.rp, ...(tp && (c || tp === "X|Custom") ? { tp, tps: c?.third ?? 5 } : {}) }));
    } catch { /* no query */ } }, 0);
    return () => clearTimeout(id);
  }, [cands, names]);

  const set = (p: Partial<Full>) => setT((o) => ({ ...o, ...p }));
  const geo = useJSON<StatesGeo>(`${X}/states.json`);
  const [mode, setMode] = useState<Mode>("rate");
  const [hov, setHov] = useState<Hover>(null);
  const [lit, setLit] = useState<string | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const go = useInView(stage); useBoil(stage);
  const shapes = useMemo(() => (geo ? Object.entries(geo.states) : []) as [string, string][], [geo]);
  const delays = useMemo(() => sweepDelays(shapes), [shapes]);
  const allD = useMemo(() => shapes.map(([, d]) => d).join(""), [shapes]);
  const T = res.T;

  // every electoral unit with its leader; Nebraska's 1st and 3rd districts vote with the state
  const units = useMemo(() => {
    const u: Record<string, Unit> = {};
    for (const [k, s] of Object.entries(res.states)) {
      const tot = s.D + s.R + s.I + s.O || 1; const m = two(s.D, s.R);
      u[k] = { k, m, pD: s.pD, pR: s.pR, pI: s.pI, sD: s.D / tot, sR: s.R / tot, sI: s.I / tot, ev: s.ev, lead: T && s.I > s.D && s.I > s.R ? "I" : m <= 0 ? "D" : "R" };
    }
    if (u.NE && (u.NE.ev ?? 0) <= 2) for (const k of ["NE-1", "NE-3"]) if (!u[k]) u[k] = { ...u.NE, k, ev: 1 };
    return u;
  }, [res, T]);
  const list = useMemo(() => Object.values(units).filter((x) => x.ev > 0), [units]);
  const evMap = useMemo(() => { const e = { D: 0, R: 0, I: 0 }; for (const x of list) e[x.lead] += x.ev; return e; }, [list]);
  const rk = (x: Unit): Rate | "I" => (x.lead === "I" ? "I" : rateOf(x.m));
  const ladder = useMemo(() => {
    const rows0 = [...list].sort((a, b) => (a.lead === "I" ? 0 : a.m) - (b.lead === "I" ? 0 : b.m));
    let run = 0; const rows = rows0.map((u) => { if (u.lead === "D") run += u.ev; return { ...u, run }; });
    const cross = rows.find((r) => r.run >= 270)?.k ?? null;
    const band: Partial<Record<Rate | "I", { ev: number; states: [string, number, number][] }>> = {};
    for (const r of rows) { const k = rk(r); (band[k] ??= { ev: 0, states: [] }).ev += r.ev; band[k]!.states.push([r.k, r.ev, r.m]); }
    return { rows, cross, band };
  }, [list]);
  const bands: (Rate | "I")[] = T ? ["SD", "LD", "ND", "TD", "I", "TR", "NR", "LR", "SR"] : RATES.map((r) => r.k);
  const bandStyle = (k: Rate | "I") => (k === "I" ? { label: `${last(T ?? "Third party")} leads`, color: T3, ink: "#1b1328" } : { label: RATE[k].label, color: RATE[k].color, ink: RATE[k].ink });
  const ci = ladder.cross ? ladder.rows.findIndex((r) => r.k === ladder.cross) : Math.floor(ladder.rows.length / 2);
  const win = ladder.rows.slice(Math.max(0, ci - 8), ci + 9);
  const above = ladder.rows.slice(0, Math.max(0, ci - 8)), below = ladder.rows.slice(ci + 9);
  const sum = (rs: typeof ladder.rows) => rs.reduce((a, r) => a + r.ev, 0);
  const flips = list.filter((x) => !x.k.includes("-") && a24[x.k] != null && (x.lead === "I" || Math.sign(a24[x.k]!) !== Math.sign(x.m))).length;
  const closest = [...list].filter((r) => r.k !== "NE-1" && r.k !== "NE-3").sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).slice(0, 5);
  const counts = useMemo(() => { const c: Partial<Record<Rate | "I", number>> = {}; for (const x of list) if (!x.k.includes("-")) { const r = rk(x); c[r] = (c[r] ?? 0) + 1; } return c; }, [list]);
  const all = res.VD + res.VR + res.VI + res.VO;
  const nat = res.natM ?? two(res.VD, res.VR);
  const sims = res.sims ?? 4000;
  const dLead = evMap.D >= 270, rLead = evMap.R >= 270;
  const hatched = mode === "rate";

  const fill = (st: string) => {
    const v = units[st]; if (!v) return "#2a2438";
    if (v.lead === "I") return T3;
    if (mode === "prob") return probColor(v.pD / Math.max(1e-6, v.pD + v.pR));
    if (mode === "shift") return a24[st] != null ? shiftColor(v.m - a24[st]!, 16) : "#2a2438";
    return `url(#g28-h-${rateOf(v.m)})`;
  };
  const point = (e: MouseEvent, st: string) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "st", st });
  const stTip = (st: string) => {
    const v = units[st] ?? (st.startsWith("NE-") ? units.NE : undefined); if (!v) return null;
    return <StateTip name={nameOf(st)} ev={v.ev} m={v.m} pD={v.pD} d={res.D} r={res.R} m24={a24[st] ?? null}
      t={T ? { name: T, sD: v.sD, sR: v.sR, sI: v.sI, pR: v.pR, pI: v.pI } : undefined}
      note={st === res.tip ? "The tipping point in the simulations" : st.length === 2 ? "Click for its counties" : undefined} />;
  };

  // the ticket builder
  const dl = cands.filter((c) => c.party === "D"), rl = cands.filter((c) => c.party === "R"), il = cands.filter((c) => c.party === "I");
  const chips = [...grid].filter((g) => g.odds != null).sort((a, b) => (b.odds ?? 0) - (a.odds ?? 0)).slice(0, 6);
  const tpOpts: [string, string][] = [["X|Custom", "Custom independent, build from lanes"], ...il.map((c) => [`I|${c.name}`, c.name] as [string, string]),
    ...[...dl, ...rl].filter((c) => !c.name.startsWith("Generic")).map((c) => [`${c.party}|${c.name}`, `${c.name} as an independent, from the ${c.party === "D" ? "Democratic" : "Republican"} side`] as [string, string])];
  const pickTp = (v: string) => { const c = cands.find((x) => `${x.party}|${x.name}` === v); set({ tp: v, tps: c?.third ?? 5 }); };
  const custom = t.tp === "X|Custom";
  const lanes = parseLanes(t.tlanes); const hasLanes = Object.keys(lanes).length > 0;
  const laneVal = (l: string) => (hasLanes ? lanes[l] ?? 0 : l === "Anti establishment" || l === "Centrist" ? 50 : 0);
  const setLane = (l: string, v: number) => { const o: Record<string, number> = hasLanes ? { ...lanes } : { "Anti establishment": 50, Centrist: 50 }; o[l] = v; set({ tlanes: joinLanes(o) }); };
  const tpName = t.tp ? (custom ? t.tname || "Custom independent" : t.tp.split("|")[1]) : "";

  return (
    <div className="h28 g28">
      {/* the scoreboard */}
      <header className="h28-board">
        <div className="h28-board-top">
          <p className="h28-count"><i />2028 general election · {sims.toLocaleString("en-US")} simulations · every state the sum of its counties</p>
          {busy ? <span className="g28-busy" role="status">Running {T || t.tp ? "the county engine" : "the matchup"}</span> : null}
        </div>
        <div className="h28-face-off">
          <div className={`h28-side d${dLead ? " lead" : ""}`}>
            <Toon name={res.D} side="D" size={112} className="h28-big-face" uid="gb" />
            <div><span className="h28-party">Democrat{t.dvp ? ` · with ${t.dvp}` : ""}</span><b className="h28-nm">{res.D}</b><span className="h28-ev"><b key={res.D + res.R + T} className="h28-slam">{evMap.D}</b> electoral votes</span><span className="h28-sub">{fmtPct(res.pD)} to win · {Math.round(res.evD)} in the average simulation</span></div>
          </div>
          <div className="h28-mid">
            <h1 className="h28-h1">The <em>2028</em> race</h1>
            <div className="h28-kpis">
              <span><em>Popular vote</em><b className={nat < 0 ? "d" : "r"}>{fmtMg(nat)}</b></span>
              <span><em>Tipping point</em><b>{res.tip ? <Link href={slug(res.tip)}>{STATE_NAME[res.tip] ?? res.tip}</Link> : "None"}</b></span>
              <span><em>Flips from 2024</em><b>{flips} states</b></span>
            </div>
          </div>
          <div className={`h28-side r${rLead ? " lead" : ""}`}>
            <div><span className="h28-party">Republican{t.rvp ? ` · with ${t.rvp}` : ""}</span><b className="h28-nm">{res.R}</b><span className="h28-ev"><b key={res.R + res.D + T} className="h28-slam">{evMap.R}</b> electoral votes</span><span className="h28-sub">{fmtPct(res.pR)} to win · {Math.round(res.evR)} in the average simulation</span></div>
            <Toon name={res.R} side="R" size={112} className="h28-big-face" uid="gb" />
          </div>
        </div>
        {T ? (
          <div className="g28-third" style={{ "--t3": T3 } as CSSProperties}>
            <Toon name={T} side="U" size={58} uid="gt" />
            <div><span className="h28-party">Third party</span><b>{T}</b></div>
            <span><em>Popular vote</em><b>{fmtSh(res.VI / all)}</b></span>
            <span><em>Wins the presidency</em><b>{fmtPct(res.pI)}</b></span>
            <span><em>States led on the map</em><b>{counts.I ?? 0} · {evMap.I} EV</b></span>
            <span><em>No one reaches 270</em><b>{fmtPct(res.pNone)}</b></span>
            <button type="button" className="g28-x" onClick={() => set({ tp: "", tps: null })}>Remove third party</button>
          </div>
        ) : null}
        <div className="h28-ribbon" aria-label="Electoral votes by rating">
          <div className="bar" onMouseLeave={() => setHov(null)}>
            {bands.map((k) => { const n = ladder.band[k]?.ev ?? 0; return n ? <i key={k} style={{ flexGrow: n, ...(k === "I" ? { background: T3 } : {}) }} className={`h28-hz ${k}${hov?.kind === "band" && hov.k === k ? " on" : ""}`} onMouseMove={(e) => setHov({ at: { x: e.clientX, y: e.clientY }, kind: "band", k })}>{n >= 20 ? n : ""}</i> : null; })}
            <em style={{ left: `${(270 / 538) * 100}%` }}><span>270</span></em>
          </div>
          <div className="keys">{bands.map((k) => { const b = bandStyle(k); return <span key={k}><i className={`h28-hz ${k}`} style={k === "I" ? { background: T3 } : undefined} />{b.label} <b>{ladder.band[k]?.ev ?? 0}</b></span>; })}</div>
        </div>
      </header>

      {/* the ticket builder */}
      <section className="g28-build" aria-labelledby="g28-b">
        <div className="g28-bh"><h2 id="g28-b">Build the matchup</h2><span>Any two nominees from the forecast, running mates and a third party, the same options as the forecast dashboard</span></div>
        <div className="g28-row">
          <label className="g28-f d"><span>Democrat</span><select value={t.dp} onChange={(e) => set({ dp: e.target.value })}>{names.D.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f r"><span>Republican</span><select value={t.rp} onChange={(e) => set({ rp: e.target.value })}>{names.R.map((n) => <option key={n} value={n}>{n}</option>)}</select></label>
          <label className="g28-f"><span>Democratic running mate</span><select value={t.dvp} onChange={(e) => set({ dvp: e.target.value })}><option value="">None</option>{dl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.dp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
          <label className="g28-f"><span>Republican running mate</span><select value={t.rvp} onChange={(e) => set({ rvp: e.target.value })}><option value="">None</option>{rl.filter((c) => !c.name.startsWith("Generic") && c.name !== t.rp).map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}</select></label>
        </div>
        <div className="g28-chips"><span className="eye">Likeliest matchups</span>
          {chips.map((g) => <button type="button" key={g.d + g.r} aria-pressed={t.dp === g.d && t.rp === g.r} onClick={() => set({ dp: g.d, rp: g.r })}>{last(g.d)} v {last(g.r)}<em>{fmtPct(g.odds ?? 0)} likely</em></button>)}
          <button type="button" aria-pressed={t.dp === "Generic Democrat" && t.rp === "Vance"} onClick={() => set({ dp: "Generic Democrat", rp: "Vance" })}>Generic D v Vance<em>headline</em></button>
        </div>
        <div className={`g28-tp${t.tp ? " on" : ""}`}>
          {!t.tp ? (
            <div className="g28-add">
              <button type="button" className="g28-plus" onClick={() => pickTp(il[0] ? `I|${il[0].name}` : "X|Custom")}><b>+</b> Add a third party</button>
              <span>A named independent, a nominee running outside their party, or a custom independent you build. Without one, other candidates take a share built from each county&apos;s past third party vote.</span>
            </div>
          ) : (
            <>
              <div className="g28-row">
                <label className="g28-f i wide"><span>Third party candidate</span><select value={t.tp} onChange={(e) => pickTp(e.target.value)}>{tpOpts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="g28-f sm"><span>Share of the vote, %</span>
                  <div className="g28-slide"><input type="range" min={0} max={40} step={0.5} value={t.tps ?? 5} onChange={(e) => set({ tps: Number(e.target.value) })} aria-label="Third party share" /><input type="number" min={0} max={40} step={0.5} value={t.tps ?? 5} onChange={(e) => { const v = Number(e.target.value); if (isFinite(v)) set({ tps: Math.max(0, Math.min(40, v)) }); }} aria-label="Third party share, number" /></div>
                </label>
                <button type="button" className="g28-x" onClick={() => set({ tp: "", tps: null })}>Remove third party</button>
              </div>
              {custom ? (
                <div className="g28-custom">
                  <div className="g28-row">
                    <label className="g28-f"><span>Name</span><input type="text" maxLength={40} value={t.tname} placeholder="Custom independent" onChange={(e) => set({ tname: e.target.value.slice(0, 40) })} /></label>
                    <label className="g28-f"><span>Home state</span><select value={t.thome} onChange={(e) => set({ thome: e.target.value })}><option value="">No home state</option>{Object.entries(STATE_NAME).filter(([k]) => k.length === 2).sort((a, b) => a[1].localeCompare(b[1])).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select></label>
                  </div>
                  <p className="g28-lh">Lanes: how much of the candidate&apos;s appeal comes from each kind of voter. They are weights, so only their proportions matter.</p>
                  <div className="g28-lanes">{LANES.map((l) => (
                    <label key={l}><span>{l}</span><input type="range" min={0} max={100} step={5} value={laneVal(l)} onChange={(e) => setLane(l, Number(e.target.value))} /><b>{laneVal(l)}</b></label>
                  ))}</div>
                </div>
              ) : null}
              <p className="g28-note">{tpName} takes {t.tps ?? 5}% nationally, spread county by county through the voter types the candidate appeals to{t.tp.startsWith("D|") || t.tp.startsWith("R|") ? ", drawing from their own party's side first" : ""}. The engine reruns every county and 4,000 simulations.</p>
            </>
          )}
        </div>
      </section>

      <div className="h28-body">
        {/* the map */}
        <section className="h28-map" aria-label="2028 general election map">
          <div className="h28-modes">
            <div className="sk-seg" role="radiogroup" aria-label="Color the map by">
              {([["rate", "Rating"], ["prob", "Win chance"], ["shift", "Change from 2024"]] as [Mode, string][]).map(([k, l]) => <button key={k} type="button" role="radio" aria-checked={mode === k} className={mode === k ? "on" : ""} onClick={() => setMode(k)}>{l}</button>)}
            </div>
            <span className="h28-closest">Closest: {closest.map((r, i) => <span key={r.k} onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}><Link href={slug(r.k)}>{r.k} {fmtMg(r.m)}</Link>{i < closest.length - 1 ? "," : ""}</span>)}</span>
          </div>
          <div ref={stage} className={`h28-stage ${go ? "sk-map-go" : "sk-map-wait"}${busy ? " g28-dim" : ""}`} onMouseLeave={() => setHov(null)}>
            <span className="sk-tape tl" aria-hidden="true" /><span className="sk-tape br" aria-hidden="true" />
            {!geo ? <div className="h28-load">Sketching the map</div> : (
              <svg viewBox="-20 -10 1015 630" role="img" aria-label={`2028 map, ${res.D} against ${res.R}${T ? ` and ${T}` : ""}`} className="sk-map-extrude" data-sk-nohatch="" data-sk-noring="">
                <InkDefs id="g28" /><HatchDefs id="g28" />
                <path className="h28-base" d={allD} fill="#fbfaf6" aria-hidden="true" />
                <g className="h28-states sk-map-flip" key={`${mode}|${res.D}|${res.R}|${T}|${res.VD}`}>
                  {shapes.map(([st, d]) => (
                    <a key={st} href={slug(st)} aria-label={`${STATE_NAME[st] ?? st} 2028 forecast`}>
                      <path d={d} fill={fill(st)} style={{ "--d": delays[st] } as CSSProperties} className={(hov?.kind === "st" && hov.st === st) || lit === st ? "hov" : lit || (hov?.kind === "band" && units[st] && rk(units[st]) !== hov.k) ? "fade" : undefined} onMouseMove={(e) => point(e, st)} />
                    </a>
                  ))}
                </g>
                {hatched ? null : <path className="h28-tex" d={allD} fill="url(#g28-pen)" aria-hidden="true" />}
                <InkOutline id="g28" shapes={shapes} width={1.5} delays={delays} />
                <Lift id="g28" d={hov?.kind === "st" && geo.states[hov.st.split("-")[0]] ? geo.states[hov.st.split("-")[0]] : lit && geo.states[lit.split("-")[0]] ? geo.states[lit.split("-")[0]] : null} fill={hov?.kind === "st" ? fill(hov.st.split("-")[0]) : lit ? fill(lit.split("-")[0]) : "none"} />
                <g className="h28-labels" aria-hidden="true">
                  {Object.entries(geo.labels).map(([st, [x, y]]) => !SMALL.includes(st) ? <text key={st} x={x} y={y} fill={hatched && units[st]?.lead !== "I" ? "#141218" : ink(fill(st))} className={hatched ? "halo" : undefined}>{st}</text> : null)}
                </g>
              </svg>
            )}
            <Pointy pose="point-pointer" size={112} className="h28-pointy" />
          </div>
          <div className="h28-under">
            {list.filter((x) => x.k.includes("-") || x.k === "DC").map((x) => { const k = rk(x); return <span key={x.k} onMouseMove={(e) => point(e, x.k)} onMouseLeave={() => setHov(null)}><Link href={slug(x.k)} className={`h28-chip h28-hz ${k}`} style={k === "I" ? { background: T3 } : undefined}>{x.k === "DC" ? "D.C." : x.k}</Link></span>; })}
            {mode === "rate" ? <div className="sk-maplegend h28-legend">{bands.map((k) => { const b = bandStyle(k); return <span key={k}><i className={`h28-hz ${k}`} style={k === "I" ? { background: T3 } : undefined} />{b.label} <b>{counts[k] ?? 0}</b></span>; })}<em>states, by the forecast margin: Tilt under 2 points, Lean 2 to 6, Likely 6 to 12, Safe 12 and up</em></div>
              : mode === "prob" ? <span className="h28-scale"><em>{last(res.D)} certain</em><i className="pr" /><em>{last(res.R)} certain</em></span>
              : <span className="h28-scale"><em>Bluer than 2024</em><i className="sh" /><em>Redder than 2024</em></span>}
          </div>
        </section>

        {/* the path to 270 */}
        <aside className="h28-ladder" aria-labelledby="g28-lad">
          <div className="h28-lad-h"><h2 id="g28-lad">The path to 270</h2><span>Every state from the bluest to the reddest</span></div>
          {above.length ? <div className="h28-lad-fold d">{above.length} safer {last(res.D)} states · <b>{sum(above)}</b> votes</div> : null}
          <ol onMouseLeave={() => { setHov(null); setLit(null); }}>
            {win.map((r) => {
              const k = rk(r), b = bandStyle(k), isX = r.k === ladder.cross, isTp = r.k === res.tip;
              return (
                <li key={r.k} className={isX ? "tip" : undefined} onMouseEnter={() => setLit(r.k.split("-")[0])} onMouseMove={(e) => point(e, r.k)}>
                  <Link href={slug(r.k)}>
                    <span className="ab">{r.k}{isTp ? <i className="tp">TP</i> : null}</span>
                    <span className="mg"><i style={{ width: `${Math.min(100, (Math.abs(r.m) / 20) * 100)}%`, background: b.color, marginLeft: r.m <= 0 ? "auto" : undefined }} /></span>
                    <span className="mv" style={{ color: k === "I" ? "#8a6200" : RATE[k as Rate].text ?? b.color }}>{r.lead === "I" ? `${last(T!)} ${fmtSh(r.sI, 0)}` : fmtMg(r.m)}</span>
                    <span className="ev">{r.ev}</span>
                    <span className="run">{r.run}</span>
                  </Link>
                  {isX ? <em>{last(res.D)} passes 270 here</em> : null}
                </li>
              );
            })}
          </ol>
          {below.length ? <div className="h28-lad-fold r">{below.length} safer {last(res.R)} states · <b>{sum(below)}</b> votes</div> : null}
          <p className="h28-lad-n">The last column adds up {last(res.D)}&apos;s electoral votes from the top.{ladder.cross ? "" : ` ${last(res.D)} does not reach 270 on the map.`} TP marks the tipping point across all {sims.toLocaleString("en-US")} simulations.</p>
        </aside>
      </div>

      {/* the closest states */}
      <section className="h28-close" aria-labelledby="g28-cl">
        <div className="h28-dock-h"><h2 id="g28-cl">The closest states</h2><span>{last(res.D)} against {last(res.R)}{T ? ` and ${last(T)}` : ""}</span></div>
        <div className="h28-races">
          {closest.map((r) => {
            const was = a24[r.k] ?? null, flip = was != null && (r.lead === "I" || Math.sign(was) !== Math.sign(r.m)), wn = r.lead === "I" ? T! : r.lead === "D" ? res.D : res.R;
            const pw = r.lead === "I" ? r.pI : r.lead === "D" ? r.pD : r.pR;
            return (
              <Link key={r.k} href={slug(r.k)} className={`sk-race ${r.lead === "R" ? "r" : "d"}`}>
                <span className="st" onMouseEnter={() => setLit(r.k)} onMouseLeave={() => setLit(null)}>{nameOf(r.k)}</span>
                <span className={`sk-tag${flip ? " flip" : ""}`}>{flip ? "Flip" : "Hold"}</span>
                <span className="m"><b>{fmtMg(r.m)}</b><span>{last(wn)} {fmtPct(pw)}</span></span>
                <span className="vs">{r.ev} electoral vote{r.ev === 1 ? "" : "s"}{was != null ? ` · ${fmtMg(was)} in 2024` : ""}{T ? ` · ${last(T)} ${fmtSh(r.sI, 1)}` : ""}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* every state, and the spread of outcomes */}
      <div className="g28-two">
        <section className="s28-card" aria-labelledby="g28-h">
          <h2 id="g28-h">Electoral votes across {sims.toLocaleString("en-US")} simulations</h2>
          <Hist h={res.hist} />
          <p className="s28-say">{last(res.D)} wins {fmtPct(res.pD)}, {last(res.R)} {fmtPct(res.pR)}{T ? `, ${last(T)} ${fmtPct(res.pI)}` : ""}{res.pNone > 0.005 ? `, and no one reaches 270 in ${fmtPct(res.pNone)}` : ""}. {fmtK(all)} votes projected.</p>
        </section>
        <section className="s28-card g28-tbl" aria-labelledby="g28-t">
          <h2 id="g28-t">Every state</h2>
          <div className="g28-scroll"><table>
            <thead><tr><th>State</th><th>EV</th><th>{last(res.D)}</th><th>{last(res.R)}</th>{T ? <th>{last(T)}</th> : null}<th>Margin</th><th>Leader wins</th></tr></thead>
            <tbody>{[...list].sort((a, b) => Math.abs(a.m) - Math.abs(b.m)).map((x) => (
              <tr key={x.k}><td><Link href={slug(x.k)}>{nameOf(x.k)}</Link></td><td>{x.ev}</td><td>{fmtSh(x.sD)}</td><td>{fmtSh(x.sR)}</td>{T ? <td>{fmtSh(x.sI)}</td> : null}
                <td className={x.lead === "I" ? "i" : x.m < 0 ? "d" : "r"}>{x.lead === "I" ? `${last(T!)} leads` : fmtMg(x.m)}</td><td>{fmtPct(x.lead === "I" ? x.pI : x.lead === "D" ? x.pD : x.pR)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
      </div>

      <nav className="h28-go" aria-label="More of the 2028 forecast">
        {res.tip ? <Link href={slug(res.tip)}><b>{STATE_NAME[res.tip]}</b><span>The tipping point, county by county</span></Link> : null}
        <Link href="/2028"><b>The 2028 overview</b><span>The map for every likely matchup</span></Link>
        <Link href="/2028/primaries"><b>Play the primaries</b><span>Every state, every candidate</span></Link>
        <a href="/play" className="hot"><b>Play Campaign 2028</b><span>Run for president on this map</span></a>
      </nav>

      <Tip at={hov?.at ?? null}>
        {hov?.kind === "st" ? stTip(hov.st) : hov?.kind === "band" ? (() => { const b = bandStyle(hov.k); const x = ladder.band[hov.k]; return <RateTip label={b.label} color={b.color} ink={b.ink} states={x?.states ?? []} ev={x?.ev ?? 0} />; })() : null}
      </Tip>
    </div>
  );
}

function Hist({ h }: { h: number[] }) {
  const mx = Math.max(...h, 0.001); const W = 560, H = 160;
  return (
    <svg viewBox={`0 0 ${W} ${H + 26}`} className="g28-hist" role="img" aria-label="Distribution of Democratic electoral votes">
      {h.map((v, k) => { const x = 10 + (k / h.length) * (W - 20), w = (W - 20) / h.length - 2, y = H - (v / mx) * (H - 10); return <rect key={k} x={x} y={y} width={w} height={H - y} rx={2} fill={k * 20 + 10 >= 270 ? "#1f3fd1" : "#d42a2a"} stroke="#141218" strokeWidth={1.2} />; })}
      <line x1={10 + (270 / 540) * (W - 20)} x2={10 + (270 / 540) * (W - 20)} y1={0} y2={H} stroke="#141218" strokeWidth={2} strokeDasharray="5 4" />
      {[0, 100, 200, 270, 300, 400, 500].map((e) => <text key={e} x={10 + (e / 540) * (W - 20)} y={H + 18} textAnchor="middle" fill="#55505e" fontSize={11} fontFamily="JetBrains Mono, monospace">{e}</text>)}
    </svg>
  );
}
