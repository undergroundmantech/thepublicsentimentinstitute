"use client";
// Within a state: county scenarios for every Senate and governor race. Two tools share one engine and one map.
// The county what if (on /what-if) moves any county, or any area of the state, in margin and turnout. The
// demographic swingometer (on /swingometer) moves groups of voters, and each county moves by how many of
// them live there. The statewide margin is the sum of every county's votes, and the win chance moves along
// the race's own forecast range. With nothing changed, every number is the published forecast.
import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { RATE, RATING_LABEL, RAMP_CSS, RAMP_IND_CSS, rating, raceHref } from "@/app/lib/opp";
import StateMap, { CHANGE_RAMP, CHANGE_RAMP_IND, type Path, type View } from "./StateMap";
import { Num, StateBar, Tug } from "./bits";
import {
  EMPTY, clamp, compute, decodeScen, editZero, encodeScen, fmM, fmShift, groupZero, lastName, memberships, n0, pct, scenZero, short,
  type CountyOut, type Edit, type Index, type IndexRace, type RaceFile, type Scen, similarity, LINK_MAX, type Sim,
  exactEdit, groupState, shareToTurnout, marginToShift, parseMargin,
} from "./engine";
import { ev, evSettled } from "@/app/lib/ev";
import "./scenarios.css";

export type Tool = "counties" | "groups";

const cache = new Map<string, Promise<unknown>>();
const load = <T,>(u: string): Promise<T> => {
  if (!cache.has(u)) cache.set(u, fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(u)))).catch((e) => { cache.delete(u); throw e; }));
  return cache.get(u) as Promise<T>;
};
const COMPETITIVE = (m: number) => Math.abs(m) < 6;
const ALL_DIMS = ["Race", "Education", "Age", "Party", "2024 vote", "Turnout propensity", "Trump approval"];

export default function StateLab({ tool, base, crumbs = false, bootSearch }: { tool: Tool; base: string; crumbs?: boolean; bootSearch?: string }) {
  const [idx, setIdx] = useState<Index | null>(null);
  const [err, setErr] = useState(false);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [rf, setRf] = useState<RaceFile | null>(null);
  const [paths, setPaths] = useState<Path[] | null>(null);
  const [all, setAll] = useState(false);
  // the page's own tool may rewrite the address before this mounts, so the switch hands over the first one
  const [boot] = useState(() => {
    const q = new URLSearchParams(bootSearch ?? (typeof window !== "undefined" ? window.location.search : ""));
    return { race: q.get("race"), x: q.get("x") };
  });

  useEffect(() => {
    load<Index>("/forecast/scenarios/index.json").then((d) => {
      setIdx(d);
      const want = boot.race;
      const hit = want ? d.races.find((r) => r.id === want) : null;
      const first = d.races.filter((r) => r.office === "senate" && COMPETITIVE(r.m)).sort((a, b) => Math.abs(a.m) - Math.abs(b.m))[0] ?? d.races[0];
      setRaceId(hit ? hit.id : first?.id ?? null);
      if (hit && !COMPETITIVE(hit.m)) setAll(true);
    }).catch(() => setErr(true));
  }, [boot]);
  useEffect(() => {
    if (!raceId) return;
    let on = true;
    const st = raceId.split("-")[1];
    Promise.all([load<RaceFile>(`/forecast/scenarios/${raceId}.json`), load<{ counties: Path[] }>(`/forecast/states/${st}.json`)])
      .then(([r, g]) => { if (!on) return; const ids = new Map(g.counties.map((p) => [p.id, p.d])); setPaths(r.c.filter((c) => ids.has(c[0])).map((c) => ({ id: c[0], d: ids.get(c[0])! }))); setRf(r); })
      .catch(() => { if (on) setErr(true); });
    return () => { on = false; };
  }, [raceId]);

  const head = (
    <header className="sl-head">
      {crumbs ? <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href={base}>{tool === "counties" ? "What if" : "Swingometer"}</Link><span className="sep">/</span><span>Within a state</span></nav> : null}
      <div className="eye g">{tool === "counties" ? "County what if" : "Swingometer inside a state"} · {idx ? `${idx.races.length} statewide races` : "Senate and governor"}</div>
      <h1>{tool === "counties" ? <>What if <em>these counties move?</em></> : <>Move the voters, <em>county by county</em></>}</h1>
      <p className="lede">{tool === "counties"
        ? "Pick a Senate or governor race and change any county: its margin, its turnout, or a whole area of the state at once. Counties like the one you change move with it, matched on party, 2024 vote, Trump approval, turnout, financial strain and more, and the statewide vote, margin and win chance add up live from every county."
        : "Pick a Senate or governor race and shift how a group of voters votes or how many of them turn out. Every county moves by how many of those voters live there, so the map recolors where the change lands."}</p>
    </header>
  );
  if (err) return <section className="sl">{head}<div className="card sl-load">The county scenarios could not load. Refresh to try again.</div></section>;
  return (
    <section className="sl" aria-label="Within a state scenarios">
      {head}
      <RacePicker idx={idx} raceId={raceId} all={all} setAll={setAll} onPick={(id) => { setRaceId(id); ev("Scenario race", { race: id, tool }); }} />
      {rf && paths && rf.id === raceId ? <Lab key={rf.id} rf={rf} paths={paths} tool={tool} base={base} bootX={boot.race === rf.id ? boot.x : null} />
        : <div className="card sl-load"><span />Loading every county in the race</div>}
    </section>
  );
}

function RacePicker({ idx, raceId, all, setAll, onPick }: { idx: Index | null; raceId: string | null; all: boolean; setAll: (b: boolean) => void; onPick: (id: string) => void }) {
  if (!idx) return <div className="card sl-picker sl-skel" />;
  const comp = idx.races.filter((r) => COMPETITIVE(r.m));
  const list = all ? idx.races : idx.races.filter((r) => COMPETITIVE(r.m) || r.id === raceId);
  const chip = (r: IndexRace) => {
    const rt = rating(r.m, r.ind), L = r.ind ? "I" : "D", on = r.id === raceId;
    return (
      <button key={r.id} type="button" className={`sl-chip${on ? " on" : ""}`} aria-pressed={on} onClick={() => onPick(r.id)} title={`${r.state} ${r.office === "senate" ? "Senate" : "governor"}: ${lastName(r.dem)} vs ${lastName(r.gop)}, ${RATING_LABEL[rt]}`}>
        <i style={{ background: RATE[rt] }} /><b>{r.st}</b><span className="mono">{fmM(r.m, L)}</span>
      </button>
    );
  };
  return (
    <div className="card sl-picker">
      <div className="card-h">
        <h3>Pick a race</h3>
        <div className="seg" role="group" aria-label="Which races">
          <button type="button" className={!all ? "on" : undefined} aria-pressed={!all} onClick={() => setAll(false)}>Lean and toss up · {comp.length}</button>
          <button type="button" className={all ? "on" : undefined} aria-pressed={all} onClick={() => setAll(true)}>Every <span className="sl-long">statewide </span>race · {idx.races.length}</button>
        </div>
      </div>
      <div className="card-b sl-picker-b">
        {(["senate", "governor"] as const).map((o) => {
          const rs = list.filter((r) => r.office === o);
          return rs.length ? (
            <div key={o} className="sl-prow"><span className="eye">{o === "senate" ? "Senate" : "Governor"}</span><div className="sl-chips">{rs.map(chip)}</div></div>
          ) : null;
        })}
      </div>
    </div>
  );
}

type Preset = { key: string; label: string; moves: [string, number, "m" | "t", number][] };
const PRESETS: Preset[] = [
  { key: "latr", label: "Latino voters swing right", moves: [["race", 2, "m", -8]] },
  { key: "latl", label: "Latino voters swing left", moves: [["race", 2, "m", 8]] },
  { key: "blku", label: "Black turnout surges", moves: [["race", 1, "t", 12]] },
  { key: "blkd", label: "Black turnout drops", moves: [["race", 1, "t", -12]] },
  { key: "coll", label: "College graduates move left", moves: [["edu", 0, "m", 5]] },
  { key: "ncol", label: "Voters without a degree move right", moves: [["edu", 1, "m", -4]] },
  { key: "yhome", label: "Young voters stay home", moves: [["age", 0, "t", -25]] },
  { key: "senl", label: "Seniors swing left", moves: [["age", 3, "m", 5]] },
  { key: "indr", label: "Independents break right", moves: [["party", 2, "m", -10]] },
  { key: "indl", label: "Independents break left", moves: [["party", 2, "m", 10]] },
  { key: "lowh", label: "Low propensity voters stay home", moves: [["prop", 1, "t", -15], ["prop", 2, "t", -30]] },
  { key: "lows", label: "Low propensity voters surge", moves: [["prop", 1, "t", 15], ["prop", 2, "t", 30]] },
  { key: "trsour", label: "Trump voters sour", moves: [["vote24", 0, "m", 5]] },
  { key: "nonv", label: "2024 nonvoters show up", moves: [["vote24", 3, "t", 40]] },
];

function Lab({ rf, paths, tool, base, bootX }: { rf: RaceFile; paths: Path[]; tool: Tool; base: string; bootX: string | null }) {
  const [sc, setSc] = useState<Scen>(() => (bootX ? decodeScen(bootX, rf) : null) ?? EMPTY);
  const [sel, setSel] = useState<string | null>(null);
  const [hot, setHot] = useState<string | null>(null);
  const [view, setView] = useState<View>("margin");
  const [region, setRegion] = useState("all");
  const [dim, setDim] = useState(rf.dims[0]?.k ?? "");
  const [preset, setPreset] = useState("");
  const [toast, setToast] = useState("");
  const [pulse, setPulse] = useState<{ ids: string[]; k: number }>({ ids: [], k: 0 });
  const mem = useMemo(() => memberships(rf), [rf]);
  const live = useDeferredValue(sc);
  const S = useMemo(() => (tool === "counties" ? similarity(rf) : null), [rf, tool]);
  const out = useMemo(() => compute(rf, live, mem, undefined, S), [rf, live, mem, S]);
  const byId = useMemo(() => new Map(out.rows.map((r) => [r.id, r])), [out]);
  const L = rf.ind ? "I" : "D";
  const dColor = rf.ind ? "var(--ind)" : "var(--dem)";
  const one = rf.unit === "parishes" ? "parish" : rf.unit === "boroughs" ? "borough" : "county";
  const zero = scenZero(sc);
  const rank = useMemo(() => Object.fromEntries(rf.c.map((c, i) => [c[0], i + 1])), [rf]);

  // the address bar carries the race and the scenario, so a link opens on it
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const x = encodeScen(sc);
        window.history.replaceState(window.history.state, "", `${base}?mode=state&race=${rf.id}${x ? `&x=${x}` : ""}${window.location.hash}`);
      } catch { /* history unavailable */ }
    }, 250);
    return () => clearTimeout(t);
  }, [sc, rf.id, base]);

  // counties that just moved pulse once, after the change settles
  const settled = useRef<Map<string, number> | null>(null);
  useEffect(() => {
    const t = setTimeout(() => {
      const prev = settled.current, now = new Map(out.rows.map((r) => [r.id, r.M]));
      if (prev) {
        const moved = out.rows.map((r) => ({ id: r.id, d: Math.abs(r.M - (prev.get(r.id) ?? r.M)) })).filter((x) => x.d >= 0.25).sort((a, b) => b.d - a.d).slice(0, 48).map((x) => x.id);
        if (moved.length) setPulse((p) => ({ ids: moved, k: p.k + 1 }));
      }
      settled.current = now;
    }, 260);
    return () => clearTimeout(t);
  }, [out]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); }, [toast]);

  // edits
  const setC = (id: string, f: (e: Edit) => Edit) => { setPreset(""); evSettled(`c${rf.id}`, "Scenario edit", { race: rf.id, what: tool === "counties" ? "county" : "county in groups" }); setSc((s) => { const e = f(s.c[id] ?? { m: 0, t: 0 }); const c = { ...s.c }; if (editZero(e)) delete c[id]; else c[id] = { m: clamp(e.m, -100, 100), t: clamp(e.t, -95, 400) }; return { ...s, c }; }); };
  const setR = (k: string, f: (e: Edit) => Edit) => { setPreset(""); evSettled(`r${rf.id}${k}`, "Scenario edit", { race: rf.id, what: `area ${k}` }); setSc((s) => { const e = f(s.r[k] ?? { m: 0, t: 0 }); const r = { ...s.r }; if (editZero(e)) delete r[k]; else r[k] = { m: clamp(e.m, -30, 30), t: clamp(e.t, -50, 50) }; return { ...s, r }; }); };
  const setG = (k: string, gi: number, field: "m" | "t", v: number) => { setPreset(""); evSettled(`g${rf.id}${k}${gi}${field}`, "Scenario edit", { race: rf.id, what: `${k} group ${gi + 1} ${field === "m" ? "margin" : "turnout"}` }); setSc((s) => {
    const d = rf.dims.find((x) => x.k === k)!; const cur = s.g[k] ?? { m: d.g.map(() => 0), t: d.g.map(() => 0) };
    const nx = { ...cur, [field]: cur[field].map((x, i) => (i === gi ? v : x)) }; const g = { ...s.g }; if (groupZero(nx)) delete g[k]; else g[k] = nx; return { ...s, g };
  }); };
  const resetAll = () => { setSc(EMPTY); setPreset(""); ev("Scenario reset", { race: rf.id, tool }); };
  const applyPreset = (p: Preset) => {
    const g: Scen["g"] = {};
    for (const [k, gi, f, v] of p.moves) { const d = rf.dims.find((x) => x.k === k); if (!d) continue; g[k] ??= { m: d.g.map(() => 0), t: d.g.map(() => 0) }; g[k][f][gi] = v; }
    setSc({ ...EMPTY, g }); setPreset(p.key); setDim(p.moves[0][0]); ev("Scenario preset", { preset: p.label, race: rf.id });
  };
  const copy = async () => { ev("Scenario shared", { race: rf.id, tool }); try { await navigator.clipboard.writeText(window.location.href); setToast("Link copied. It opens on this scenario."); } catch { setToast("Copy the address bar to share this scenario."); } };
  const pick = (id: string) => {
    ev("Scenario county opened", { race: rf.id, tool });
    setSel((s) => (s === id && tool === "groups" ? null : id));
    // on a phone the editor sits under the map, so bring it up
    if (typeof window !== "undefined" && window.innerWidth < 1100) {
      const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => document.querySelector(".sl-rail")?.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" }), 60);
    }
  };

  // statewide numbers
  const D0 = out.rows.reduce((a, r) => a + r.D0, 0), R0 = out.rows.reduce((a, r) => a + r.R0, 0), O0 = out.rows.reduce((a, r) => a + r.O0, 0);
  const dWin = out.pD >= 0.5, dWin0 = rf.pD >= 0.5, flipped = dWin !== dWin0;
  const rtNow = rating(out.M, rf.ind);
  const fav = dWin ? lastName(rf.dem) : lastName(rf.gop);
  const fp = dWin ? out.pD : 1 - out.pD;
  const callWord = fp >= 0.95 ? "Safe" : fp >= 0.8 ? "Likely" : fp >= 0.6 ? "Leans" : "Tilts";

  const movers = useMemo(() => out.rows.map((r) => ({ r, dn: (r.R - r.D) - (r.R0 - r.D0) })).filter((x) => Math.abs(x.dn) >= 1).sort((a, b) => Math.abs(b.dn) - Math.abs(a.dn)).slice(0, 10), [out]);
  const maxMove = Math.max(1, ...movers.map((x) => Math.abs(x.dn)));
  const edited = useMemo(() => new Set(Object.keys(sc.c)), [sc.c]);

  const tip = (id: string) => {
    const r = byId.get(id); if (!r) return null;
    const ch = r.M - r.M0;
    return (
      <>
        <h4>{r.name}</h4>
        <div className="r"><span>Forecast</span><b className={r.M0 < 0 ? "d" : "rr"}>{fmM(r.M0, L)}</b></div>
        <div className="r"><span>Your scenario</span><b className={r.M < 0 ? "d" : "rr"}>{fmM(r.M, L)}</b></div>
        {Math.abs(ch) >= 0.05 ? <div className="r"><span>Moved</span><b className={ch < 0 ? "d" : "rr"}>{fmShift(-ch, L)}</b></div> : null}
        <div className="r"><span>Votes, forecast</span><b>{n0(r.T0)}</b></div>
        {Math.abs(r.T - r.T0) >= 1 ? <div className="r"><span>Votes, scenario</span><b>{n0(r.T)}</b></div> : null}
        <div className="r"><span>Share of the state</span><b>{((100 * r.T) / (out.T || 1)).toFixed(1)}%</b></div>
        <div className="cta">{tool === "counties" ? `Click to change this ${one}` : `Click to see this ${one}'s voters`}</div>
      </>
    );
  };

  const selRow = sel ? byId.get(sel) ?? null : null;
  const otherHref = `${tool === "counties" ? "/swingometer" : "/what-if"}?mode=state&race=${rf.id}`;

  return (
    <div className="sl-lab">
      {/* the statewide scoreboard */}
      <section className={`card sl-score${flipped ? " flipped" : ""}`} aria-live="polite">
        <div className="sl-score-l">
          <div className="eye">{rf.name} · {rf.c.length} {rf.unit}</div>
          <h2><Link href={raceHref(rf.id)}>{lastName(rf.dem)} <span>vs</span> {lastName(rf.gop)}</Link></h2>
          <div className="sl-callw">
            <span key={dWin ? "d" : "r"} className={`sl-call ${dWin ? (rf.ind ? "i" : "d") : "r"}`}><small>{callWord}</small>{fav}</span>
            <span className="sl-rt" style={{ ["--rt" as string]: RATE[rtNow] } as React.CSSProperties}><i />{RATING_LABEL[rtNow]}</span>
            {flipped ? <span className="sl-flipnote">Flipped from the forecast</span> : null}
          </div>
        </div>
        <div className="sl-score-m">
          <div className="sl-cands">
            <div><b style={{ color: dColor }}>{rf.dem}</b><span className="mono"><Num v={(100 * out.D) / (out.T || 1)} f={(x) => `${x.toFixed(1)}%`} /></span><small className="mono"><Num v={out.D} /> votes</small></div>
            <div className="rt"><b style={{ color: "var(--gop)" }}>{rf.gop}</b><span className="mono"><Num v={(100 * out.R) / (out.T || 1)} f={(x) => `${x.toFixed(1)}%`} /></span><small className="mono"><Num v={out.R} /> votes</small></div>
          </div>
          <StateBar d={out.D} r={out.R} o={out.O} d0={D0} r0={R0} o0={O0} dColor={dColor} label={`${rf.dem} ${((100 * out.D) / (out.T || 1)).toFixed(1)} percent, ${rf.gop} ${((100 * out.R) / (out.T || 1)).toFixed(1)} percent`} />
          <div className="sl-bar-lab"><span>The tick marks the forecast</span><span>50%</span><span>{out.O > 0 ? `Other candidates ${((100 * out.O) / (out.T || 1)).toFixed(1)}%` : ""}</span></div>
        </div>
        <div className="sl-score-r">
          <div className="sl-kpi"><span>Margin</span><b className={`mono ${out.M < 0 ? "d" : "rr"}`}><Num v={out.M} f={(x) => fmM(x, L)} /></b>
            <small className={Math.abs(out.dM) < 0.05 ? "" : out.dM < 0 ? "d" : "rr"}>{Math.abs(out.dM) < 0.05 ? `Forecast ${fmM(rf.m, L)}` : `${fmShift(-out.dM, L)} from the forecast`}</small></div>
          <div className="sl-kpi"><span>Win chance</span><b className={`mono ${dWin ? "d" : "rr"}`}><Num v={fp * 100} f={(x) => `${x > 99.5 ? ">99" : x < 0.5 ? "<1" : Math.round(x)}%`} /></b>
            <small>{fav} · forecast {pct(dWin ? rf.pD : 1 - rf.pD)}</small></div>
          <div className="sl-kpi"><span>Expected votes</span><b className="mono"><Num v={out.T} f={short} /></b>
            <small>{Math.abs(out.T - out.T0) < 1 ? `${short(Math.abs(out.net) / 2)} votes switching sides flips it` : `${out.T > out.T0 ? "+" : "−"}${short(Math.abs(out.T - out.T0))} from the forecast`}</small></div>
        </div>
      </section>

      <div className="sl-grid">
        <section className="card sl-mapcard" aria-label={`${rf.state} ${one} map`}>
          <div className="card-h">
            <h3>{rf.state} by {one}</h3>
            <div className="seg" role="group" aria-label="Map view">
              <button type="button" className={view === "margin" ? "on" : undefined} aria-pressed={view === "margin"} onClick={() => setView("margin")}>Scenario margin</button>
              <button type="button" className={view === "change" ? "on" : undefined} aria-pressed={view === "change"} onClick={() => setView("change")}>Change from forecast</button>
            </div>
          </div>
          <div className="card-b sl-mapb">
            <StateMap paths={paths} rows={out.rows} view={view} ind={rf.ind} sel={sel} hot={hot} edited={edited} pulse={pulse} onPick={pick} onHover={setHot} tip={tip} raceKey={rf.id} label={`${rf.name} by ${one}, shaded by ${view === "margin" ? "your scenario's margin" : "the change from the forecast"}`} />
            <div className="sl-legend">
              {view === "margin" ? <><span>{L} +40</span><i className="ramp" style={{ background: rf.ind ? RAMP_IND_CSS : RAMP_CSS }} /><span>R +40</span></>
                : <><span>Moved {L} 10</span><i className="ramp" style={{ background: rf.ind ? CHANGE_RAMP_IND : CHANGE_RAMP }} /><span>Moved R 10</span></>}
              <span className="k"><i className="pul" />Just moved</span>
              {tool === "counties" ? <span className="k"><i className="dot" />You changed it</span> : null}
            </div>
          </div>
        </section>

        <aside className="sl-rail" aria-label="Scenario controls">
          {tool === "counties"
            ? <CountyRail rf={rf} sc={sc} S={S} mem={mem} setL={(v) => setSc((x) => ({ ...x, L: v }))} sel={selRow} setSel={setSel} setC={setC} setR={setR} region={region} setRegion={setRegion} rank={rank} out={out} L={L} one={one} zero={zero} resetAll={resetAll} copy={copy} />
            : <GroupRail rf={rf} sc={sc} setSc={setSc} dim={dim} setDim={setDim} setG={setG} preset={preset} applyPreset={applyPreset} sel={selRow} setSel={setSel} mem={mem} L={L} zero={zero} resetAll={resetAll} copy={copy} setPreset={setPreset} />}
          <Link className="sl-other" href={otherHref}>{tool === "counties" ? `Move groups of voters in ${rf.state} instead` : `Change single counties in ${rf.state} instead`}</Link>
        </aside>
      </div>

      <div className="sl-grid2">
        <section className="card sl-tugcard" aria-label="Where the margin is won">
          <div className="card-h"><h3>Where the margin is won</h3><span className="eye" style={{ marginLeft: "auto" }}>Net votes by {one}</span></div>
          <div className="card-b"><Tug rows={out.rows} dColor={dColor} L={L} unit={rf.unit} hot={hot ?? sel} onPick={pick} onHover={setHot} /></div>
        </section>
        <section className="card sl-movers" aria-label="Biggest movers">
          <div className="card-h"><h3>Biggest movers</h3><span className="eye" style={{ marginLeft: "auto" }}>{zero ? "Nothing moved yet" : "Net votes changed"}</span></div>
          {movers.length ? (
            <ol className="sl-mv">
              {movers.map(({ r, dn }, i) => (
                <li key={r.id}>
                  <button type="button" onClick={() => setSel(r.id)} onMouseEnter={() => setHot(r.id)} onMouseLeave={() => setHot(null)} aria-current={sel === r.id}>
                    <span className="rk mono">{i + 1}</span>
                    <span className="nm"><b>{r.name}</b><small className="mono">{fmM(r.M0, L)} to {fmM(r.M, L)}</small></span>
                    <span className="bar"><i className={dn < 0 ? "d" : "r"} style={{ width: `${(100 * Math.abs(dn)) / maxMove}%`, background: dn < 0 ? dColor : "var(--gop)" }} /></span>
                    <b className={`mono ${dn < 0 ? "d" : "rr"}`}>{dn < 0 ? L : "R"} +{short(Math.abs(dn))}</b>
                  </button>
                </li>
              ))}
            </ol>
          ) : <div className="card-b sl-empty">{tool === "counties" ? `Change a ${one} or an area and the ${rf.unit} that move the state most appear here.` : `Move a group and the ${rf.unit} that move the state most appear here.`}</div>}
        </section>
      </div>

      <div className="callout sl-how">
        <div className="eye">What this assumes</div>
        {tool === "counties"
          ? <>Each {one} starts at its forecast. A margin change moves that {one} by the points you set, measured on the whole vote, and a turnout change grows or shrinks every candidate&apos;s vote there by the same share. Area changes stack with {one} changes. The state margin is the sum of every {one}&apos;s votes, and the win chance moves along this race&apos;s own forecast range, so a lightly polled race moves more than a heavily polled one on the same shift.</>
          : <>Each {one} keeps its forecast electorate. Moving a group&apos;s margin moves a {one} by that shift times the group&apos;s share of its voters, and a turnout change grows or shrinks the group&apos;s share. Breakdowns add together, and the same voter sits in several of them. White voters split by education are not published {one} by {one}, so race and education move on their own.{rf.prof ? ` The group mix here comes from the ${rf.prof.startsWith("sen") ? "Senate" : "governor"} forecast run in ${rf.state}, with each ${one}'s group margins moved together to match this race.` : ""}</>}
        {" "}<Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>Forecast methodology</Link>.
      </div>
      {toast ? <div className="sl-toast" role="status">{toast}</div> : null}
    </div>
  );
}

/** A typed number that commits on Enter or when it loses focus; anything it cannot read snaps back. */
function NumField({ race, id, label, value, show, parse, onCommit, hint, wide }: { race: string; id: string; label: string; value: number; show: (v: number) => string; parse: (s: string) => number | null; onCommit: (v: number) => void; hint?: string; wide?: boolean }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft == null) return; const v = parse(draft); setDraft(null); if (v != null && Number.isFinite(v) && draft.trim() !== show(value)) { onCommit(v); ev("Exact number typed", { field: label, race }); } };
  return (
    <label className={`sl-num${wide ? " w" : ""}`} htmlFor={id}>
      <span>{label}</span>
      <input id={id} inputMode="decimal" value={draft ?? show(value)} onFocus={(e) => { const el = e.currentTarget; setDraft((d) => d ?? show(value)); requestAnimationFrame(() => { if (document.activeElement === el) el.select(); }); }} onChange={(e) => setDraft(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") { commit(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") { setDraft(null); (e.target as HTMLInputElement).blur(); } }} />
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}
const parseNum = (s: string) => { const v = Number(s.replace(/[,%\s]/g, "")); return Number.isFinite(v) ? v : null; };

function Slider({ id, label, v, min, max, step, kind, out, onChange }: { id: string; label: string; v: number; min: number; max: number; step: number; kind: "m" | "t"; out: string; onChange: (v: number) => void }) {
  const fill = ((v - min) / (max - min)) * 100;
  return (
    <div className="sl-sl">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="range" className={`sl-range ${kind}`} min={min} max={max} step={step} value={v} aria-valuetext={out}
        style={{ ["--p" as string]: `${fill}%` } as React.CSSProperties} onChange={(e) => onChange(Number(e.target.value))} />
      <output htmlFor={id} className={`mono ${kind === "m" ? (v > 0 ? "d" : v < 0 ? "rr" : "") : ""}`}>{out}</output>
    </div>
  );
}

function CountyRail({ rf, sc, S, mem, setL, sel, setSel, setC, setR, region, setRegion, rank, out, L, one, zero, resetAll, copy }: {
  rf: RaceFile; sc: Scen; S: Sim | null; mem: string[][]; setL: (v: number) => void; sel: CountyOut | null; setSel: (id: string | null) => void; setC: (id: string, f: (e: Edit) => Edit) => void; setR: (k: string, f: (e: Edit) => Edit) => void;
  region: string; setRegion: (k: string) => void; rank: Record<string, number>; out: ReturnType<typeof compute>; L: string; one: string; zero: boolean; resetAll: () => void; copy: () => void;
}) {
  const ce = sel ? sc.c[sel.id] ?? { m: 0, t: 0 } : null;
  const re = sc.r[region] ?? { m: 0, t: 0 };
  const regs = [{ k: "all", l: `Every ${one}`, i: rf.c.map((_, i) => i) }, ...rf.regions];
  const reg = regs.find((r) => r.k === region) ?? regs[0];
  const regVotes = reg.i.reduce((a, i) => a + (out.rows[i]?.T0 ?? 0), 0);
  const changes = [...Object.entries(sc.r).map(([k, e]) => ({ k, l: regs.find((r) => r.k === k)?.l ?? k, e, reg: true })), ...Object.entries(sc.c).map(([k, e]) => ({ k, l: rf.c.find((c) => c[0] === k)?.[1] ?? k, e, reg: false }))];
  const fmt = (e: Edit) => [e.m ? fmShift(e.m, L) : "", e.t ? `turnout ${e.t > 0 ? "+" : "−"}${Math.abs(e.t)}%` : ""].filter(Boolean).join(", ");
  const findId = `sl-find-${rf.id}`;
  // how much one point in this county moves the state
  const perPt = sel ? (sel.T / (out.T || 1)) : 0;
  const link = sc.L ?? 1;
  // the counties most like the open one, with how far they follow and why
  const twins = useMemo(() => {
    if (!S || !sel) return [] as { id: string; name: string; w: number; why: string[] }[];
    const i = sel.i, n = S.n;
    return Array.from({ length: n }, (_, j) => j).filter((j) => j !== i).map((j) => ({ j, w: S.W[i * n + j] * LINK_MAX * link }))
      .sort((a, b) => b.w - a.w).slice(0, 6).filter((x) => x.w >= 0.05)
      .map(({ j, w }) => ({ id: rf.c[j][0], name: rf.c[j][1], w, why: S.why(i, j) }));
  }, [S, sel, link, rf]);
  const linkedN = useMemo(() => {
    if (!S || link <= 0) return 0;
    const ed = Object.keys(sc.c).map((id) => rf.c.findIndex((c) => c[0] === id)).filter((i) => i >= 0);
    if (!ed.length) return 0;
    let k = 0; for (let j = 0; j < S.n; j++) { if (ed.includes(j)) continue; if (ed.some((i) => S.W[i * S.n + j] * LINK_MAX * link >= 0.25)) k++; }
    return k;
  }, [S, sc.c, link, rf]);
  return (
    <>
      {S ? (
        <section className="card sl-box sl-link" aria-label={`Linked ${rf.unit}`}>
          <div className="card-h"><h3>Linked {rf.unit}</h3><span className={`pill ${link > 0 ? "d" : "t"}`} style={{ marginLeft: "auto" }}>{link > 0 ? "On" : "Off"}</span></div>
          <div className="card-b">
            <p className="sl-hint">Change one {one} and the {rf.unit} like it move too, the way states move together in the statewide what if. Likeness comes from each {one}&apos;s forecast margin and 2020 to 2024 shift, party, 2024 vote, Trump approval, turnout propensity, financial strain, education, race, age, density, gas prices and data centers.</p>
            <Slider id={`sl-link-${rf.id}`} label="How closely they follow" v={Math.round(link * 100)} min={0} max={100} step={5} kind="t" out={link > 0 ? `${Math.round(link * 100)}%` : "Off, only the county you change moves"} onChange={(v) => { evSettled(`l${rf.id}`, "Linked counties set", { strength: v, race: rf.id }); setL(v / 100); }} />
            {linkedN ? <p className="sl-fine">{linkedN} more {linkedN === 1 ? one : rf.unit} follow your changes by a quarter or more.</p> : null}
          </div>
        </section>
      ) : null}
      <section className="card sl-box" aria-label={`Change a ${one}`}>
        <div className="card-h"><h3>Change a {one}</h3>
          <input className="sl-find" list={findId} placeholder={`Find a ${one}`} aria-label={`Find a ${one}`}
            onChange={(e) => { const v = e.target.value.toLowerCase(); const hit = rf.c.find((c) => c[1].toLowerCase() === v); if (hit) { setSel(hit[0]); e.target.value = ""; e.target.blur(); } }} />
          <datalist id={findId}>{rf.c.map((c) => <option key={c[0]} value={c[1]} />)}</datalist>
        </div>
        <div className="card-b">
          {sel && ce ? (
            <div className="sl-county" key={sel.id}>
              <div className="sl-county-h">
                <div><span className="eye">#{rank[sel.id]} of {rf.c.length} by votes · {((100 * sel.T0) / (out.T0 || 1)).toFixed(1)}% of the state</span><h4>{sel.name}</h4></div>
                <button type="button" className="sl-x" onClick={() => setSel(null)} aria-label="Close">Close</button>
              </div>
              <div className="sl-county-s">
                <div><span>Forecast</span><b className={`mono ${sel.M0 < 0 ? "d" : "rr"}`}>{fmM(sel.M0, L)}</b></div>
                <div><span>Scenario</span><b className={`mono ${sel.M < 0 ? "d" : "rr"}`}><Num v={sel.M} f={(x) => fmM(x, L)} /></b></div>
                <div><span>Votes</span><b className="mono"><Num v={sel.T} f={short} /></b></div>
              </div>
              <div className="sl-nums sl-cx">
                <NumField race={rf.id} id={`sl-cd-${sel.id}`} label={`${rf.ind ? "Independent" : "Democratic"} votes`} value={sel.D} show={n0} parse={parseNum} hint={`Forecast ${n0(sel.D0)}`}
                  onCommit={(v) => setC(sel.id, () => exactEdit(rf, sc, mem, S, sel.id, Math.max(0, v), sel.R))} />
                <NumField race={rf.id} id={`sl-cr-${sel.id}`} label="Republican votes" value={sel.R} show={n0} parse={parseNum} hint={`Forecast ${n0(sel.R0)}`}
                  onCommit={(v) => setC(sel.id, () => exactEdit(rf, sc, mem, S, sel.id, sel.D, Math.max(0, v)))} />
                <NumField race={rf.id} id={`sl-cmx-${sel.id}`} label="Margin" value={sel.M} show={(v) => fmM(v, L)} parse={(t) => parseMargin(t, L)} hint={`Forecast ${fmM(sel.M0, L)}`}
                  onCommit={(v) => { const tp = sel.D + sel.R, T = sel.T || 1, mt = clamp(v, -99, 99); const R = clamp((tp + (mt / 100) * T) / 2, 0, tp); setC(sel.id, () => exactEdit(rf, sc, mem, S, sel.id, tp - R, R)); }} />
                <NumField race={rf.id} id={`sl-ctx-${sel.id}`} label="Total votes" value={sel.T} show={n0} parse={parseNum} hint={`Forecast ${n0(sel.T0)}`}
                  onCommit={(v) => { const k = Math.max(0.01, v) / Math.max(1, sel.T); setC(sel.id, () => exactEdit(rf, sc, mem, S, sel.id, sel.D * k, sel.R * k)); }} />
              </div>
              <p className="sl-fine">Type a number and press Enter, or move the sliders below. Typed numbers land this {one} exactly there, with area and linked moves counted in.</p>
              <Slider id={`sl-cm-${sel.id}`} label="Margin" v={ce.m} min={-30} max={30} step={0.5} kind="m" out={fmShift(ce.m, L)} onChange={(v) => setC(sel.id, (e) => ({ ...e, m: v }))} />
              <Slider id={`sl-ct-${sel.id}`} label="Turnout" v={ce.t} min={-50} max={50} step={1} kind="t" out={ce.t ? `${ce.t > 0 ? "+" : "−"}${Math.abs(ce.t)}%` : "Forecast"} onChange={(v) => setC(sel.id, (e) => ({ ...e, t: v }))} />
              <div className="sl-quick" role="group" aria-label="Quick changes">
                <button type="button" className="d" onClick={() => setC(sel.id, (e) => ({ ...e, m: e.m + 5 }))}>+5 {L}</button>
                <button type="button" className="r" onClick={() => setC(sel.id, (e) => ({ ...e, m: e.m - 5 }))}>+5 R</button>
                <button type="button" onClick={() => setC(sel.id, (e) => ({ ...e, t: e.t + 10 }))}>Turnout +10%</button>
                <button type="button" onClick={() => setC(sel.id, (e) => ({ ...e, t: e.t - 10 }))}>Turnout −10%</button>
                <button type="button" className="z" disabled={editZero(sc.c[sel.id])} onClick={() => setC(sel.id, () => ({ m: 0, t: 0 }))}>Reset</button>
              </div>
              <p className="sl-fine">One point here moves the statewide margin about {(perPt).toFixed(2)} points{link > 0 ? `, before the ${rf.unit} like it follow` : ""}.</p>
              {S && link > 0 && twins.length ? (
                <div className="sl-twins">
                  <div className="sl-twins-h"><b>Moves with it</b><span>How far each follows a change here</span></div>
                  <ol>
                    {twins.map((t) => (
                      <li key={t.id}><button type="button" onClick={() => setSel(t.id)}><span className="nm">{t.name}</span><span className="bar"><i style={{ width: `${Math.round(t.w * 100)}%` }} /></span><b className="mono">{Math.round(t.w * 100)}%</b></button>
                        {t.why.length ? <small>Alike in {t.why.join(", ")}</small> : null}</li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : <p className="sl-hint">Click any {one} on the map, or find one above, to change its margin or turnout.</p>}
        </div>
      </section>

      <section className="card sl-box" aria-label="Swing an area">
        <div className="card-h"><h3>Swing an area</h3><span className="eye" style={{ marginLeft: "auto" }}>{reg.i.length} {reg.i.length === 1 ? one : rf.unit} · {((100 * regVotes) / (out.T0 || 1)).toFixed(0)}% of the vote</span></div>
        <div className="card-b">
          <div className="sl-regs" role="group" aria-label="Area">
            {regs.map((r) => <button key={r.k} type="button" className={`${region === r.k ? "on" : ""}${editZero(sc.r[r.k]) ? "" : " has"}`} aria-pressed={region === r.k} onClick={() => setRegion(r.k)}>{r.l}</button>)}
          </div>
          <Slider id={`sl-rm-${region}`} label="Margin" v={re.m} min={-20} max={20} step={0.5} kind="m" out={fmShift(re.m, L)} onChange={(v) => setR(region, (e) => ({ ...e, m: v }))} />
          <Slider id={`sl-rt-${region}`} label="Turnout" v={re.t} min={-40} max={40} step={1} kind="t" out={re.t ? `${re.t > 0 ? "+" : "−"}${Math.abs(re.t)}%` : "Forecast"} onChange={(v) => setR(region, (e) => ({ ...e, t: v }))} />
          <div className="sl-quick" role="group" aria-label="Quick area changes">
            <button type="button" className="d" onClick={() => setR(region, (e) => ({ ...e, m: e.m + 2 }))}>+2 {L}</button>
            <button type="button" className="r" onClick={() => setR(region, (e) => ({ ...e, m: e.m - 2 }))}>+2 R</button>
            <button type="button" onClick={() => setR(region, (e) => ({ ...e, t: e.t + 10 }))}>Turnout +10%</button>
            <button type="button" onClick={() => setR(region, (e) => ({ ...e, t: e.t - 10 }))}>Turnout −10%</button>
          </div>
        </div>
      </section>

      <section className="card sl-box" aria-label="Your changes">
        <div className="card-h"><h3>Your changes</h3><span className={`pill ${zero ? "t" : "d"}`} style={{ marginLeft: "auto" }}>{zero ? "Forecast" : `${changes.length} ${changes.length === 1 ? "change" : "changes"}`}</span></div>
        <div className="card-b">
          {changes.length ? (
            <ul className="sl-chg">
              {changes.map((c) => (
                <li key={`${c.reg ? "r" : "c"}${c.k}`}>
                  <button type="button" className="nm" onClick={() => (c.reg ? setRegion(c.k) : setSel(c.k))}><b>{c.l}</b><small>{fmt(c.e)}</small></button>
                  <button type="button" className="sl-x" aria-label={`Clear ${c.l}`} onClick={() => (c.reg ? setR(c.k, () => ({ m: 0, t: 0 })) : setC(c.k, () => ({ m: 0, t: 0 })))}>Clear</button>
                </li>
              ))}
            </ul>
          ) : <p className="sl-hint">No changes yet. The map shows the forecast.</p>}
          <div className="sl-acts">
            <button type="button" className="btn sm" onClick={resetAll} disabled={zero}>Back to the forecast</button>
            <button type="button" className="btn sm g" onClick={copy} disabled={zero}>Share this scenario</button>
          </div>
        </div>
      </section>
    </>
  );
}

function GroupRail({ rf, sc, setSc, dim, setDim, setG, preset, applyPreset, sel, setSel, mem, L, zero, resetAll, copy, setPreset }: {
  rf: RaceFile; sc: Scen; setSc: React.Dispatch<React.SetStateAction<Scen>>; dim: string; setDim: (k: string) => void; setG: (k: string, gi: number, f: "m" | "t", v: number) => void;
  preset: string; applyPreset: (p: Preset) => void; sel: CountyOut | null; setSel: (id: string | null) => void; mem: string[][]; L: string; zero: boolean; resetAll: () => void; copy: () => void; setPreset: (k: string) => void;
}) {
  const d = rf.dims.find((x) => x.k === dim) ?? rf.dims[0];
  const [exact, setExact] = useState(false);
  const gs = useMemo(() => (d ? groupState(rf, sc, d.k) : []), [rf, sc, d]);
  // each group statewide: share of the expected vote and its margin, from the counties
  const state = useMemo(() => {
    const o: Record<string, [number, number][]> = {};
    for (const dd of rf.dims) {
      const acc = dd.g.map(() => [0, 0]);
      rf.c.forEach((c, i) => { const row = rf.x[dd.k]?.[i]; if (!row) return; const T = c[2] + c[3] + c[4]; dd.g.forEach((_, gi) => { const w = (T * row[2 * gi]) / 100; acc[gi][0] += w; acc[gi][1] += w * row[2 * gi + 1]; }); });
      const tot = rf.c.reduce((a, c, i) => a + (rf.x[dd.k]?.[i] ? c[2] + c[3] + c[4] : 0), 0) || 1;
      o[dd.k] = acc.map(([w, wm]) => [(100 * w) / tot, w ? wm / w : 0]);
    }
    return o;
  }, [rf]);
  const parts = useMemo(() => {
    const p: [string, number][] = [];
    if (sc.o) p.push(["Every voter", -compute(rf, sc, mem, { overall: true }).dM]);
    for (const dd of rf.dims) if (!groupZero(sc.g[dd.k])) p.push([dd.l, -compute(rf, sc, mem, { dim: dd.k }).dM]);
    return p.filter(([, v]) => Math.abs(v) >= 0.05);
  }, [rf, sc, mem]);
  const maxP = Math.max(0.5, ...parts.map(([, v]) => Math.abs(v)));
  const active = (k: string) => !groupZero(sc.g[k]);
  const missing = ALL_DIMS.filter((l) => !rf.dims.some((x) => x.l === l));
  const presets = PRESETS.filter((p) => p.moves.every(([k]) => rf.dims.some((x) => x.k === k)));
  if (!d) return <section className="card sl-box"><div className="card-b sl-hint">Voter groups are not published county by county in {rf.state}, so this race has no group sliders. The county what if still works here.</div></section>;
  const ci = sel ? rf.c.findIndex((c) => c[0] === sel.id) : -1;
  const crow = ci >= 0 ? rf.x[d.k]?.[ci] : null;
  return (
    <>
      <section className="card sl-box" aria-label="Move the voters">
        <div className="card-h"><h3>Move the voters in {rf.state}</h3><span className={`pill ${zero ? "t" : "d"}`} style={{ marginLeft: "auto" }}>{zero ? "Forecast" : "Your scenario"}</span></div>
        <div className="card-b sl-gb">
          <div className="sl-every">
            <Slider id="sl-every" label="Every voter" v={sc.o} min={-15} max={15} step={0.5} kind="m" out={fmShift(sc.o, L)} onChange={(v) => { setPreset(""); setSc((s) => ({ ...s, o: v })); }} />
          </div>
          <div className="sl-dims" role="tablist" aria-label="Breakdown">
            {rf.dims.map((x) => <button key={x.k} type="button" role="tab" aria-selected={d.k === x.k} className={d.k === x.k ? "on" : undefined} onClick={() => setDim(x.k)}>{x.l}{active(x.k) ? <i aria-label="has changes" /> : null}</button>)}
          </div>
          <div className="sl-mode" role="group" aria-label="How to change the groups">
            <button type="button" className={!exact ? "on" : undefined} aria-pressed={!exact} onClick={() => { setExact(false); ev("Exact entry mode", { on: false, race: rf.id }); }}>Shift with sliders</button>
            <button type="button" className={exact ? "on" : undefined} aria-pressed={exact} onClick={() => { setExact(true); ev("Exact entry mode", { on: true, race: rf.id }); }}>Type exact numbers</button>
          </div>
          {exact ? (
            <div className="sl-groups sl-exact" key={`x-${d.k}`}>
              <p className="sl-fine">Type each group&apos;s share of {rf.state} voters and how it votes, like 35 and D +12. The other groups keep their own turnout, so their shares make up the rest.</p>
              {d.g.map((g, gi) => {
                const cur = gs[gi]; if (!cur) return null;
                const live = (sc.g[d.k]?.m[gi] ?? 0) || (sc.g[d.k]?.t[gi] ?? 0);
                return (
                  <div key={g} className={`sl-g sl-gx${live ? " live" : ""}`}>
                    <div className="sl-g-h"><b>{g}</b></div>
                    <div className="sl-nums">
                      <NumField race={rf.id} id={`sl-x-${d.k}-${gi}-s`} label="Share of voters" value={cur.share} show={(v) => `${v.toFixed(1)}%`} parse={parseNum}
                        hint={`Forecast ${cur.share0.toFixed(1)}%`} onCommit={(v) => setG(d.k, gi, "t", shareToTurnout(rf, sc, d.k, gi, v))} />
                      <NumField race={rf.id} id={`sl-x-${d.k}-${gi}-m`} label="Margin" value={cur.m} show={(v) => fmM(v, L)} parse={(t) => parseMargin(t, L)}
                        hint={`Forecast ${fmM(cur.m0, L)}`} onCommit={(v) => setG(d.k, gi, "m", marginToShift(rf, sc, d.k, gi, v))} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="sl-groups" key={d.k} hidden={exact}>
            {d.g.map((g, gi) => {
              const [share, mg] = state[d.k][gi];
              const sm = sc.g[d.k]?.m[gi] ?? 0, st = sc.g[d.k]?.t[gi] ?? 0;
              return (
                <div key={g} className={`sl-g${sm || st ? " live" : ""}`} style={{ animationDelay: `${gi * 0.04}s` }}>
                  <div className="sl-g-h"><b>{g}</b><span className="mono">{share.toFixed(0)}% of voters</span><span className={`mono ${mg < 0 ? "d" : "rr"}`}>{fmM(mg, L)}</span></div>
                  <Slider id={`sl-${d.k}-${gi}-m`} label="Margin" v={sm} min={-20} max={20} step={0.5} kind="m" out={fmShift(sm, L)} onChange={(v) => setG(d.k, gi, "m", v)} />
                  <Slider id={`sl-${d.k}-${gi}-t`} label="Turnout" v={st} min={-40} max={40} step={1} kind="t" out={st ? `${st > 0 ? "+" : "−"}${Math.abs(st)}%` : "Forecast"} onChange={(v) => setG(d.k, gi, "t", v)} />
                </div>
              );
            })}
          </div>
          {missing.length ? <p className="sl-fine">Not published county by county in {rf.state}: {missing.join(", ").toLowerCase()}.</p> : null}
          <div className="sl-acts">
            <button type="button" className="btn sm" onClick={() => { setPreset(""); setSc((s) => { const g = { ...s.g }; delete g[d.k]; return { ...s, g }; }); }} disabled={!active(d.k)}>Reset {d.l.toLowerCase()}</button>
            <button type="button" className="btn sm" onClick={resetAll} disabled={zero}>Back to the forecast</button>
            <button type="button" className="btn sm g" onClick={copy} disabled={zero}>Share this scenario</button>
          </div>
        </div>
      </section>

      <section className="card sl-box" aria-label="Try a scenario">
        <div className="card-h"><h3>Try a scenario</h3></div>
        <div className="card-b"><div className="sl-presets">{presets.map((p) => <button key={p.key} type="button" className={preset === p.key ? "on" : undefined} aria-pressed={preset === p.key} onClick={() => applyPreset(p)}>{p.label}</button>)}</div></div>
      </section>

      <section className="card sl-box" aria-label="What moved this race">
        <div className="card-h"><h3>What moved this race</h3></div>
        <div className="card-b">
          {parts.length ? parts.map(([k, v]) => (
            <div key={k} className="sl-part"><span>{k}</span><span className="bar"><i className={v > 0 ? "d" : "r"} style={{ width: `${(Math.abs(v) / maxP) * 50}%`, [v > 0 ? "right" : "left"]: "50%" } as React.CSSProperties} /></span><b className={`mono ${v > 0 ? "d" : "rr"}`}>{fmShift(v, L)}</b></div>
          )) : <p className="sl-hint">Move a slider and each breakdown&apos;s part of the change shows here.</p>}
        </div>
      </section>

      {sel ? (
        <section className="card sl-box" aria-label={`${sel.name} voters`}>
          <div className="card-h"><h3>{sel.name}</h3><button type="button" className="sl-x" style={{ marginLeft: "auto" }} onClick={() => setSel(null)}>Close</button></div>
          <div className="card-b">
            <div className="sl-county-s">
              <div><span>Forecast</span><b className={`mono ${sel.M0 < 0 ? "d" : "rr"}`}>{fmM(sel.M0, L)}</b></div>
              <div><span>Scenario</span><b className={`mono ${sel.M < 0 ? "d" : "rr"}`}><Num v={sel.M} f={(x) => fmM(x, L)} /></b></div>
              <div><span>Votes</span><b className="mono"><Num v={sel.T} f={short} /></b></div>
            </div>
            {crow ? (
              <div className="sl-mix">
                <div className="eye">{d.l}, this {rf.unit === "parishes" ? "parish" : rf.unit === "boroughs" ? "borough" : "county"} against the state</div>
                {d.g.map((g, gi) => (
                  <div key={g} className="sl-mixr">
                    <span>{g}</span>
                    <span className="bars"><i style={{ width: `${crow[2 * gi]}%` }} /><s style={{ left: `${state[d.k][gi][0]}%` }} /></span>
                    <b className="mono">{crow[2 * gi].toFixed(0)}%</b>
                  </div>
                ))}
                <p className="sl-fine">The bar is this {rf.unit === "parishes" ? "parish" : rf.unit === "boroughs" ? "borough" : "county"}&apos;s share of its voters, the tick is the state&apos;s.</p>
              </div>
            ) : <p className="sl-hint">No {d.l.toLowerCase()} profile for this {rf.unit === "parishes" ? "parish" : "county"}.</p>}
          </div>
        </section>
      ) : null}
    </>
  );
}
