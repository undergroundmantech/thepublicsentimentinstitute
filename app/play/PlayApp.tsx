"use client";
// Campaign 2026, the game. Pick a close Senate or governor race, pick a side and a year, and run the last eight weeks of
// the campaign: raise the money, work the counties, staff up, fight the air war, build the turnout operation and answer
// what the week throws at you, much of it real, from the race research. Voters respond the way the site's own data says
// they would: the forecast, the county map, the voter group estimates, the polls, the money books, the donor map and the
// people files. Then election night, county by county.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { marginColor, marginColorInd, raceHref } from "@/app/lib/opp";
import { fit, pathsBox, type CountyPath } from "@/app/components/home/countyGeo";
import { ev as track } from "@/app/lib/ev";
import * as E from "./engine";
import { dealWeek, resolve, testEvent, type Outcome } from "./events";

export type PIndex = { asOf: string; election: string; races: { id: string; office: string; st: string; state: string; name: string; m: number; p: number; c: [string, string, boolean][] }[] };
type Save = { s: E.State };
const KEY = "opp_play_v1";
const DIFFS: E.Diff[] = ["safe", "lean", "tossup", "wave"];
const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };
const sur = (n: string) => n.replace(/,?\s+(Jr\.?|Sr\.?|II|III|IV)$/i, "").split(" ").slice(-1)[0];
const initials = (n: string) => n.split(" ").filter((x) => /^[A-Z]/.test(x)).map((x) => x[0]).slice(0, 2).join("");
const pct = (p: number) => `${Math.round(p * 100)}%`;
const fxs = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2)}`;
const cls = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(" ");

function load(): Save | null { try { const j = localStorage.getItem(KEY); return j ? (JSON.parse(j) as Save) : null; } catch { return null; } }
function store(x: Save | null) { try { if (x) localStorage.setItem(KEY, JSON.stringify(x)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

/** A number that rolls to its new value. */
function Roll({ v, fmt = (x: number) => Math.round(x).toLocaleString() }: { v: number; fmt?: (x: number) => string }) {
  const [d, setD] = useState(v); const from = useRef(v);
  useEffect(() => {
    const a = from.current, b = v; if (a === b) return;
    let raf = 0; const t0 = performance.now();
    const step = (t: number) => { const k = Math.min(1, (t - t0) / 650); const e = 1 - Math.pow(1 - k, 3); setD(a + (b - a) * e); if (k < 1) raf = requestAnimationFrame(step); else from.current = b; };
    raf = requestAnimationFrame(step);
    return () => { cancelAnimationFrame(raf); from.current = b; };
  }, [v]);
  return <>{fmt(d)}</>;
}

// ============================================================ map geometry
type Geo = { paths: CountyPath[]; box: { sc: number; ox: number; oy: number }; cen: Map<string, [number, number]> };
const W = 760, H = 470;
function useGeo(paths: CountyPath[] | null): Geo | null {
  return useMemo(() => {
    if (!paths || !paths.length) return null;
    const box = fit(pathsBox(paths), W, H, 24, 24);
    const cen = new Map<string, [number, number]>();
    const re = /(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g;
    for (const p of paths) {
      let x = 0, y = 0, n = 0, m: RegExpExecArray | null; re.lastIndex = 0;
      while ((m = re.exec(p.d))) { x += +m[1]; y += +m[2]; n++; }
      if (n) cen.set(p.id, [x / n, y / n]);
    }
    return { paths, box, cen };
  }, [paths]);
}

type Fx = { id: number; f: string; kind: "rally" | "hall" | "office" | "knock" | "opp" };
type Layer = "margin" | "regions" | "ground";
function StateMap({ r, s, geo, sel, onSel, mode, fxs: effects, layer = "margin", shown }: { r: E.RaceFile; s: E.State; geo: Geo | null; sel: string | null; onSel: (f: string) => void; mode: "plan" | "night" | "preview"; fxs?: Fx[]; layer?: Layer; shown?: Set<string> }) {
  const byF = useMemo(() => new Map(r.counties.map((c, i) => [c[0], i])), [r]);
  const regionOf = useMemo(() => { const m = new Map<string, number>(); (r.research?.regions ?? []).forEach((g, k) => g.f.forEach((f) => m.set(f, k))); return m; }, [r]);
  const ind = r.cands[0].party === "I";
  if (!geo) return <div className="pg-map-ph"><span className="pg-spin" />Loading {r.state}</div>;
  const { box, cen } = geo, sc = box.sc;
  const g = E.globalShift(s);
  const night = mode === "night" && s.result ? new Map(s.result.counties.map((x) => [x.f, x])) : null;
  const col = (pm: number) => (ind ? marginColorInd : marginColor)(s.side === "R" ? pm : -pm);
  const REG = ["#ffb547", "#7fd1ff", "#b78cff", "#5ee0a0", "#ff8fb0", "#f4e06b"];
  return (
    <svg className={cls("pg-map", mode === "night" && "night")} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Map of ${r.state}'s counties`}>
      <defs>
        <radialGradient id="pg-glow"><stop offset="0%" stopColor="#fff" stopOpacity=".9" /><stop offset="100%" stopColor="#fff" stopOpacity="0" /></radialGradient>
      </defs>
      <g transform={`translate(${box.ox},${box.oy}) scale(${sc})`}>
        {geo.paths.map((p) => {
          const i = byF.get(p.id);
          let fill = "var(--pg-none)";
          if (i != null) {
            if (night) { const x = night.get(p.id); fill = x && (!shown || shown.has(p.id)) ? col(x.m) : "var(--pg-none)"; }
            else if (layer === "regions") { const k = regionOf.get(p.id); fill = k == null ? "var(--pg-none)" : REG[k % REG.length]; }
            else if (layer === "ground") { const v = (s.visits[p.id] ?? 0) + (s.offices.includes(p.id) ? 2 : 0); fill = v ? `rgba(255,181,71,${Math.min(0.9, 0.2 + v * 0.18)})` : "var(--pg-none)"; }
            else { const v = E.countyVotes(r, s, i, g); fill = col((100 * (v.me - v.op)) / Math.max(1, v.t)); }
          }
          return <path key={p.id} d={p.d} fill={fill} className={cls("pg-c", sel === p.id && "sel", night && shown?.has(p.id) && "in")} strokeWidth={(sel === p.id ? 2.4 : 0.6) / sc}
            onClick={() => i != null && mode === "plan" && onSel(p.id)} />;
        })}
        {mode === "plan" ? s.offices.map((f) => { const c = cen.get(f); return c ? <g key={"o" + f} transform={`translate(${c[0]},${c[1]}) scale(${1 / sc})`} className="pg-flag"><path d="M0 0 V-16 L11 -12 L0 -8" /><circle r="2.2" /></g> : null; }) : null}
        {mode === "plan" ? Object.entries(s.oppVisits).map(([f]) => { const c = cen.get(f); return c ? <circle key={"x" + f} cx={c[0]} cy={c[1]} r={5 / sc} className="pg-oppdot" /> : null; }) : null}
        {mode === "plan" && layer === "regions" ? (r.research?.regions ?? []).map((reg, k) => {
          const pts = reg.f.map((f) => cen.get(f)).filter(Boolean) as [number, number][]; if (!pts.length) return null;
          const x = pts.reduce((a, p) => a + p[0], 0) / pts.length, y = pts.reduce((a, p) => a + p[1], 0) / pts.length;
          return <text key={"r" + k} x={x} y={y} textAnchor="middle" className="pg-reglabel" style={{ fontSize: 12 / sc, strokeWidth: 3 / sc }}>{reg.name}</text>;
        }) : null}
        {(effects ?? []).map((e) => { const c = cen.get(e.f); return c ? <g key={e.id} transform={`translate(${c[0]},${c[1]}) scale(${1 / sc})`} className={cls("pg-burst", e.kind)}><circle r="10" /><circle r="10" className="b2" /><circle r="4" className="core" /></g> : null; })}
      </g>
    </svg>
  );
}

// ============================================================ title and lobby
function Title({ onGo, saved, onResume, savedLabel }: { onGo: () => void; saved: boolean; onResume: () => void; savedLabel: string }) {
  return (
    <section className="pg-title">
      <div className="pg-title-bg" aria-hidden="true"><i /><i /><i /></div>
      <div className="pg-logo"><span className="a">CAMPAIGN</span><span className="b">2026</span></div>
      <p className="pg-tag">Eight weeks. One race. Every vote is real data.</p>
      <div className="pg-title-acts">
        <button type="button" className="pg-press" onClick={onGo}>New campaign</button>
        {saved ? <button type="button" className="pg-press ghost" onClick={onResume}>Continue: {savedLabel}</button> : null}
      </div>
      <ul className="pg-ticker" aria-hidden="true"><li>FUNDRAISE</li><li>RALLY</li><li>POLL</li><li>ADVERTISE</li><li>KNOCK DOORS</li><li>DEBATE</li><li>WIN</li></ul>
    </section>
  );
}

function Bar({ v, max, label, val, tone }: { v: number; max: number; label: string; val: string; tone?: string }) {
  return (
    <div className="pg-stat-bar"><span>{label}</span><span className="bar"><i className={tone} style={{ width: `${Math.max(3, Math.min(100, (100 * v) / Math.max(1e-9, max)))}%` }} /></span><b>{val}</b></div>
  );
}

function Lobby({ idx, onStart }: { idx: PIndex; onStart: (r: E.RaceFile, side: E.Side, d: E.Diff) => void }) {
  const [office, setOffice] = useState<"all" | "senate" | "governor">("all");
  const [pick, setPick] = useState<string | null>(null);
  const [rf, setRf] = useState<E.RaceFile | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [side, setSide] = useState<E.Side | null>(null);
  const [diff, setDiff] = useState<E.Diff>("lean");
  const geo = useGeo(paths);
  const list = idx.races.filter((r) => office === "all" || r.office === office);
  const race = idx.races.find((r) => r.id === pick);
  useEffect(() => {
    if (!pick) return; let live = true; setRf(null); setPaths(null);
    fetch(`/play/r/${pick}.json`).then((x) => x.json()).then((j: E.RaceFile) => { if (!live) return; setRf(j); fetch(`/forecast/states/${j.st}.json`).then((x) => x.json()).then((g) => live && setPaths(g.counties)).catch(() => live && setPaths([])); }).catch(() => {});
    return () => { live = false; };
  }, [pick]);
  const preview = useMemo(() => (rf ? E.newGame(rf, "D", "lean", 1) : null), [rf]);
  return (
    <div className="pg-lobby">
      <section className="pg-step">
        <div className="pg-sh"><span className="pg-n">1</span><h2>Choose your battleground</h2>
          <div className="pg-chips" role="group" aria-label="Office">{(["all", "senate", "governor"] as const).map((o) => <button key={o} type="button" aria-pressed={office === o} className={office === o ? "on" : ""} onClick={() => setOffice(o)}>{o === "all" ? "All" : o === "senate" ? "Senate" : "Governor"}</button>)}</div>
        </div>
        <div className="pg-sel-grid">
          <div className="pg-races">
            {list.map((r, k) => {
              const ind = r.c.some((x) => x[1] === "I"), close = Math.max(0, 1 - Math.abs(r.m) / 15);
              return (
                <button key={r.id} type="button" className={cls("pg-race", pick === r.id && "on")} aria-pressed={pick === r.id} onClick={() => { setPick(r.id); setSide(null); }} style={{ animationDelay: `${Math.min(k, 20) * 25}ms` }}>
                  <span className="k">{r.office === "senate" ? "Senate" : "Governor"} · {r.st}</span>
                  <b>{r.state}</b>
                  <span className="who"><i className={(r.c[0][1] || "D").toLowerCase()}>{sur(r.c[0][0])}</i> vs <i className={(r.c[1][1] || "R").toLowerCase()}>{sur(r.c[1][0])}</i></span>
                  <span className="heat" aria-label={`Closeness ${Math.round(close * 100)} of 100`}><i style={{ width: `${close * 100}%` }} /></span>
                  <span className="m" style={{ color: r.m > 0 ? "var(--gop2)" : ind ? "#b78cff" : "var(--dem2)" }}>{Math.abs(r.m) < 0.05 ? "Even" : r.m > 0 ? `R +${r.m.toFixed(1)}` : `${r.c[0][1]} +${Math.abs(r.m).toFixed(1)}`}</span>
                </button>
              );
            })}
          </div>
          <aside className="pg-preview glass">
            {race && rf && preview ? (
              <>
                <span className="pg-k">{race.office === "senate" ? "Senate" : "Governor"} · scouting report</span>
                <h3>{race.state}</h3>
                <div className="pg-prev-map"><StateMap r={rf} s={preview} geo={geo} sel={null} onSel={() => {}} mode="preview" /></div>
                {rf.research?.summary ? <p className="pg-note">{rf.research.summary}</p> : null}
                {rf.research?.issues?.length ? <div className="pg-issues">{rf.research.issues.slice(0, 5).map((x) => <span key={x.issue} title={x.why}>{x.issue}</span>)}</div> : null}
              </>
            ) : <div className="pg-prev-empty"><b>Pick a race</b><span>The scouting report, the map and the issues show up here.</span></div>}
          </aside>
        </div>
      </section>
      {race && rf ? (
        <section className="pg-step">
          <div className="pg-sh"><span className="pg-n">2</span><h2>Choose your candidate</h2></div>
          <div className="pg-fight">
            {rf.cands.map((cd, k) => {
              const sd: E.Side = k === 0 ? "D" : "R"; const o = rf.cands[1 - k];
              const odds = sd === "R" ? rf.est.prob : 1 - rf.est.prob;
              const dn = cd.donors;
              const mx = (a: number | null | undefined, b: number | null | undefined) => Math.max(a ?? 0, b ?? 0, 1);
              return (
                <button key={cd.name} type="button" className={cls("pg-fighter", cd.party.toLowerCase(), side === sd && "on")} aria-pressed={side === sd} onClick={() => setSide(sd)}>
                  <span className="pg-avatar" aria-hidden="true">{initials(cd.name)}</span>
                  <span className="k">{PARTY[cd.party] ?? cd.party}{cd.inc ? " · incumbent" : ""}</span>
                  <b>{cd.name}</b>
                  <span className="odds">Chance to win <strong>{pct(odds)}</strong></span>
                  <span className="pg-stats">
                    <Bar label="Cash on hand" v={cd.money.cash ?? 0} max={mx(cd.money.cash, o.money.cash)} val={E.usd(cd.money.cash ?? 0)} tone="gold" />
                    <Bar label="Raised" v={dn?.raised ?? cd.money.receipts ?? 0} max={mx(dn?.raised ?? cd.money.receipts, o.donors?.raised ?? o.money.receipts)} val={E.usd(dn?.raised ?? cd.money.receipts ?? 0)} />
                    <Bar label="Donations" v={dn?.donations ?? 0} max={mx(dn?.donations, o.donors?.donations)} val={dn?.donations ? dn.donations.toLocaleString() : "n/a"} />
                    <Bar label="Small dollar share" v={dn?.small ?? 0} max={1} val={dn?.small != null ? pct(dn.small) : "n/a"} tone="green" />
                    <Bar label="From home state" v={dn?.home ?? 0} max={1} val={dn?.home != null ? pct(dn.home) : "n/a"} tone="green" />
                    <Bar label="Outside air cover" v={cd.money.outside_for ?? 0} max={mx(cd.money.outside_for, o.money.outside_for)} val={E.usd(cd.money.outside_for ?? 0)} />
                    <Bar label="Campaign health" v={cd.health ?? 0} max={100} val={cd.health != null ? String(cd.health) : "n/a"} tone="green" />
                  </span>
                </button>
              );
            })}
            <span className="pg-vs" aria-hidden="true">VS</span>
          </div>
          <p className="pg-note">Money from the FEC and state filings; donations, small dollar and home state shares from the On Point donor map through September 30; health from the War Room.</p>
        </section>
      ) : null}
      {race && rf && side ? (
        <section className="pg-step">
          <div className="pg-sh"><span className="pg-n">3</span><h2>Choose the year you are running in</h2></div>
          <div className="pg-diffs">
            {DIFFS.map((d, i) => (
              <button key={d} type="button" className={cls("pg-diff", diff === d && "on")} aria-pressed={diff === d} onClick={() => setDiff(d)}>
                <span className="pg-bars" aria-hidden="true">{[0, 1, 2, 3].map((j) => <i key={j} className={j <= i ? "f" : ""} />)}</span>
                <b>{E.DIFF[d].name}</b><small>{E.DIFF[d].blurb}</small>
              </button>
            ))}
          </div>
          <div className="pg-go">
            <button type="button" className="pg-press" onClick={() => onStart(rf, side, diff)}>Launch the campaign</button>
            <span className="pg-note">Labor Day to Election Day. Six days on the trail a week. Debate week {E.debateWeek(rf)}.</span>
          </div>
        </section>
      ) : null}
    </div>
  );
}

// ============================================================ small parts
function Parts({ parts }: { parts: E.Part[] }) {
  const max = Math.max(0.01, ...parts.map((p) => Math.abs(p.fx)));
  return (
    <ul className="pg-parts">
      {parts.slice(0, 6).map((p, i) => (
        <li key={i} style={{ animationDelay: `${i * 70}ms` }}>
          <span className="l">{p.label} <small>{Math.round(p.share)}% of voters{p.lean ? `, lean ${p.lean > 0 ? "R" : "D"} +${Math.round(Math.abs(p.lean) * 100)}` : ""}</small></span>
          <span className="bar"><i className={p.fx >= 0 ? "up" : "dn"} style={{ width: `${(50 * Math.abs(p.fx)) / max}%`, [p.fx >= 0 ? "left" : "right"]: "50%", animationDelay: `${i * 70 + 120}ms` } as React.CSSProperties} /></span>
          <b className={p.fx >= 0 ? "up" : "dn"}>{fxs(p.fx)}</b>
        </li>
      ))}
    </ul>
  );
}

function PollChart({ s, me, op }: { s: E.State; me: string; op: string }) {
  const Wc = 520, Hc = 190, P = 34;
  const ps = s.polls;
  const vals = [...ps.map((p) => p.m), 0];
  const lo = Math.min(-4, ...vals) - 1, hi = Math.max(4, ...vals) + 1;
  const X = (w: number) => P + (w * (Wc - 2 * P)) / E.WEEKS, Y = (m: number) => 10 + ((hi - m) * (Hc - 34)) / (hi - lo);
  const avg: { w: number; m: number }[] = [];
  for (let w = 0; w < s.week; w++) { const near = ps.filter((p) => p.w <= w && p.w >= w - 2); if (near.length) avg.push({ w, m: near.reduce((a, p) => a + p.m * (p.internal ? 1.6 : 1), 0) / near.reduce((a, p) => a + (p.internal ? 1.6 : 1), 0) }); }
  return (
    <svg className="pg-pc" viewBox={`0 0 ${Wc} ${Hc}`} role="img" aria-label="Polls of the race by week">
      <rect x={P} y={Y(hi)} width={Wc - 2 * P} height={Y(0) - Y(hi)} className="zone me" /><rect x={P} y={Y(0)} width={Wc - 2 * P} height={Y(lo) - Y(0)} className="zone op" />
      <line x1={P} x2={Wc - P} y1={Y(0)} y2={Y(0)} className="z" />
      <text x={4} y={Y(hi - 1) + 4} className="ax">{sur(me)} +{Math.round(hi - 1)}</text>
      <text x={4} y={Y(lo + 1)} className="ax">{sur(op)} +{Math.round(-(lo + 1))}</text>
      {Array.from({ length: E.WEEKS + 1 }, (_, w) => <text key={w} x={X(w)} y={Hc - 4} textAnchor="middle" className="ax">{w === 0 ? "Start" : `W${w}`}</text>)}
      {avg.length > 1 ? <path d={avg.map((a, i) => `${i ? "L" : "M"}${X(a.w).toFixed(1)} ${Y(a.m).toFixed(1)}`).join(" ")} className="avg" pathLength={1} /> : null}
      {ps.map((p, i) => <circle key={i} cx={X(p.w) + ((i * 7) % 11) - 5} cy={Y(p.m)} r={p.internal ? 4.5 : 3.2} className={p.internal ? "int" : "pub"}><title>{`${p.src}: ${E.lead(p.m, sur(me), sur(op))}`}</title></circle>)}
    </svg>
  );
}

function Meter({ label, v, tone }: { label: string; v: number; tone: string }) {
  return <div className="pg-meter"><span>{label}</span><b className={cls("pg-mbar", tone)}><i style={{ width: `${Math.max(0, Math.min(100, v))}%` }} /></b></div>;
}

// ============================================================ headquarters
type Tab = "trail" | "air" | "staff" | "ground" | "polls" | "intel" | "log";
const TABS: [Tab, string][] = [["trail", "Campaign"], ["air", "Air war"], ["staff", "Staff"], ["ground", "Turnout"], ["polls", "Polls"], ["intel", "Intel"], ["log", "Wire"]];

function HQ({ r, s, commit, paths, onNight, quit }: { r: E.RaceFile; s: E.State; commit: (x: E.State) => void; paths: CountyPath[] | null; onNight: () => void; quit: () => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const geo = useGeo(paths);
  const [sel, setSel] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trail");
  const [layer, setLayer] = useState<Layer>("margin");
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [out, setOut] = useState<{ ev: E.Ev; o: Outcome; choice: number } | null>(null);
  const [week, setWeek] = useState<{ items: E.LogItem[]; before: { avg: number | null; cash: number; buzz: number; vol: number } } | null>(null);
  const [banner, setBanner] = useState<number | null>(s.week);
  const [effects, setEffects] = useState<Fx[]>([]);
  const [tone, setTone] = useState<"positive" | "contrast" | "attack">("contrast");
  const [resW, setResW] = useState(Math.min(E.WEEKS, s.week + 2));
  const [dg, setDg] = useState<string>("");
  const fxId = useRef(1);
  useEffect(() => { if (s.evw < s.week && !s.done) { const x = structuredClone(s); dealWeek(c, x); commit(x); } }, [s, c, commit]);
  useEffect(() => { if (banner == null) return; const id = setTimeout(() => setBanner(null), 1700); return () => clearTimeout(id); }, [banner]);
  const burst = (f: string, kind: Fx["kind"]) => { const id = fxId.current++; setEffects((e) => [...e, { id, f, kind }]); setTimeout(() => setEffects((e) => e.filter((x) => x.id !== id)), 1400); };
  const run = (f: (x: E.State) => E.ActResult, evName?: string, at?: { f: string; kind: Fx["kind"] }) => {
    const x = structuredClone(s); const res = f(x);
    if (res.ok) { commit(x); if (at) burst(at.f, at.kind); }
    setToast({ t: res.t, ok: res.ok, k: Date.now() }); if (res.ok && evName) track("Play action", { a: evName, race: r.id });
  };
  const ci = sel ? r.counties.findIndex((x) => x[0] === sel) : -1;
  const co = ci >= 0 ? r.counties[ci] : null;
  const avg = E.polledAvg(s);
  const me = c.me, op = c.op;
  const pend = s.cur[0];
  const debate = pend?.kind === "debate";
  const rate = E.RATE[Math.min(E.WEEKS, s.week) - 1] ?? 1;
  const tvSteps = [0.25, 0.5, 1, 2].map((k) => Math.round((k * c.cost) / 50000) * 50000).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const digGroups = c.groups.filter((g) => !["Party ID", "2024 presidential vote", "Trump job approval", "Direction of the country", "Race and gender", "Race and education"].includes(g.dim) && g.share >= 5);
  const regionOfSel = co ? (r.research?.regions ?? []).find((g) => g.f.includes(co[0])) : null;
  const endWeek = () => {
    const before = { avg, cash: s.cash, buzz: s.buzz, vol: s.volunteers };
    const x = structuredClone(s); const items = E.endWeek(c, x); commit(x);
    setWeek({ items, before }); track("Play week", { race: r.id, week: s.week });
  };
  const choose = (i: number) => {
    const x = structuredClone(s); const e = x.cur.shift()!; const o = resolve(c, x, e, i, e.kind === "debate"); commit(x);
    setOut({ ev: e, o, choice: i });
  };
  const test = () => { const x = structuredClone(s); const r2 = testEvent(c, x, x.cur[0]); if (r2) { commit(x); track("Play action", { a: "test", race: r.id }); } else setToast({ t: s.staff.pollster ? "Not enough cash to test." : "Hire a pollster to test messages.", ok: false, k: Date.now() }); };
  const tests = pend ? s.tests[pend.id] : undefined;
  const wire = [...s.log].reverse().slice(0, 14);
  return (
    <div className="pg-hq">
      {banner != null && !s.done ? <div className="pg-banner" aria-live="polite"><span>Week {banner}</span><b>{E.weekLabel(Math.min(banner, E.WEEKS))}</b>{banner === s.dweek ? <em>Debate week</em> : banner >= E.EARLY_FROM ? <em>Early voting is open</em> : null}</div> : null}
      <header className="pg-top">
        <div className={cls("pg-id", me.party.toLowerCase())}>
          <span className="pg-avatar sm" aria-hidden="true">{initials(me.name)}</span>
          <div><span className="pg-k">{r.name} · {E.DIFF[s.diff].name}</span><b>{me.name}</b></div>
        </div>
        <div className="pg-stat"><span>Week {Math.min(s.week, E.WEEKS)} / {E.WEEKS}</span><b>{E.weekLabel(Math.min(s.week, E.WEEKS)).split(" to ")[0]}</b></div>
        <div className="pg-stat"><span>Days</span><b className="pg-days" aria-label={`${s.days} days left`}>{Array.from({ length: E.DAYS }, (_, i) => <i key={i} className={i < s.days ? "f" : ""} />)}</b></div>
        <div className="pg-stat"><span>War chest</span><b className={s.cash < 0 ? "dn" : "cash"}><Roll v={s.cash} fmt={E.usd} /></b></div>
        <div className="pg-stat"><span>Volunteers</span><b><Roll v={s.volunteers} /></b></div>
        <div className="pg-stat wide"><Meter label="Energy" v={s.stamina} tone={s.stamina < 30 ? "lo" : s.stamina < 60 ? "md" : "hi"} /><Meter label="Buzz" v={s.buzz} tone="buzz" /></div>
        <div className="pg-stat"><span>Poll average</span><b className={avg == null ? "" : avg >= 0 ? "up" : "dn"}>{avg == null ? "No poll" : E.lead(avg, sur(me.name), sur(op.name))}</b></div>
        <div className="pg-acts">
          <button type="button" className="pg-press sm" onClick={endWeek} disabled={!!pend}>{s.week >= E.WEEKS ? "Election Day" : "End week"}</button>
          <button type="button" className="pg-ghost" onClick={quit}>Menu</button>
        </div>
      </header>

      <div className="pg-main">
        <section className="pg-mapw">
          <div className="pg-mh">
            <b>{r.state}</b>
            <div className="pg-chips" role="group" aria-label="Map layer">
              {([["margin", "Where you stand"], ["regions", "Regions"], ["ground", "Your ground game"]] as [Layer, string][]).map(([k, l]) => <button key={k} type="button" className={layer === k ? "on" : ""} aria-pressed={layer === k} onClick={() => setLayer(k)} disabled={k === "regions" && !(r.research?.regions ?? []).length}>{l}</button>)}
            </div>
          </div>
          <StateMap r={r} s={s} geo={geo} sel={sel} onSel={setSel} mode="plan" fxs={effects} layer={layer} />
          <div className="pg-legend"><span><i className="flag" />Your field office</span><span><i className="opp" />{sur(op.name)} has campaigned there</span><span className="pg-note">Click a county to campaign.</span></div>
          {co ? (
            <div className="pg-county" key={co[0]}>
              <div className="pg-ch"><b>{co[1]}</b>{regionOfSel ? <span className="pg-chip">{regionOfSel.name}</span> : null}
                <span>{((100 * co[5]) / c.total).toFixed(1)}% of the vote · forecast {E.lead(c.sign * co[2] + s.pers[ci], sur(me.name), sur(op.name))}{co[6] != null ? ` · 2024 president ${co[6] > 0 ? "R" : "D"} +${Math.abs(co[6]).toFixed(1)}` : ""}</span>
                <span>Your visits {s.visits[co[0]] ?? 0} · theirs {s.oppVisits[co[0]] ?? 0}{s.offices.includes(co[0]) ? " · field office open" : ""}</span>
                {regionOfSel?.note ? <span className="pg-note">{regionOfSel.note}</span> : null}</div>
              <div className="pg-cacts">
                <button type="button" className="pg-btn" disabled={s.days < 1} onClick={() => run((x) => E.rally(c, x, co[0]), "rally", { f: co[0], kind: "rally" })}>Rally <small>1 day · $35K</small></button>
                <button type="button" className="pg-btn" disabled={s.days < 1} onClick={() => run((x) => E.townHall(c, x, co[0]), "town hall", { f: co[0], kind: "hall" })}>Town hall <small>1 day · $12K</small></button>
                <button type="button" className="pg-btn" disabled={s.offices.includes(co[0])} onClick={() => run((x) => E.openOffice(c, x, co[0]), "office", { f: co[0], kind: "office" })}>Field office <small>$60K</small></button>
              </div>
            </div>
          ) : null}
        </section>

        <section className="pg-side">
          <div className="pg-tabs" role="tablist">
            {TABS.map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{l}</button>)}
          </div>
          <div className="pg-pane" key={tab}>
            {tab === "trail" ? (
              <div className="pg-grid">
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "call"), "call")}><b>Call time</b><span>1 day. Dial donors for about {E.usd(c.weekly * 0.38 * E.DIFF[s.diff].fund)}.</span></button>
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "donors"), "donors")}><b>Big dollar fundraiser</b><span>1 day. {pct(c.bigShare)} of your money comes in gifts of $2,500 and up. {Math.round(c.costsHard)}% of voters say daily costs are hard to afford, so a bad photo can hurt.</span></button>
                <button type="button" className="pg-act" disabled={s.fatigue >= 3} onClick={() => run((x) => E.fundraise(c, x, "email"), "email")}><b>Small dollar blast</b><span>No days. {pct(c.smallShare)} of your money comes in gifts under $200; buzz makes blasts pay more. Each blast in a week brings in less.</span></button>
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.media(c, x), "media")}><b>Media tour</b><span>1 day. Local TV, talk radio and podcasts. Raises buzz.</span></button>
                {s.week <= s.dweek ? <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.debatePrep(c, x), "prep")}><b>Debate prep</b><span>1 day. The debate is week {s.dweek}; prep sessions so far: {s.prep}.</span></button> : null}
                <button type="button" className="pg-act" disabled={s.days < 1} onClick={() => run((x) => E.rest(x))}><b>Day off</b><span>1 day. Restores energy. Below 30 the candidate starts making mistakes.</span></button>
              </div>
            ) : null}
            {tab === "air" ? (
              <div className="pg-air">
                <p className="pg-note">A week of statewide television in {r.state} runs about {E.usd(c.cost)} at September rates; this week stations charge {rate > 1 ? `${Math.round((rate - 1) * 100)}% more` : "the base rate"}. A normal campaign with your money would run about {E.usd(s.weekCash * E.SCHED[Math.min(E.WEEKS, s.week) - 1])} this week. Booked: {E.usd(s.tvWeek)}{s.reserved.length ? `; reserved ahead: ${s.reserved.map((x) => `week ${x.w} ${E.usd(x.amt)}`).join(", ")}` : ""}.</p>
                <div className="pg-row"><span className="pg-k">Tone</span>{(["positive", "contrast", "attack"] as const).map((t) => <button key={t} type="button" className={cls("chip", tone === t && "on")} aria-pressed={tone === t} onClick={() => setTone(t)}>{t === "positive" ? "Positive bio" : t === "contrast" ? "Contrast" : "Attack"}</button>)}</div>
                <div className="pg-row"><span className="pg-k">Air it now</span>{tvSteps.map((v) => <button key={v} type="button" className="pg-btn" disabled={s.cash < v} onClick={() => run((x) => E.buyTV(c, x, v, tone), "tv")}>{E.usd(v)}</button>)}</div>
                {s.week < E.WEEKS ? <div className="pg-row"><span className="pg-k">Reserve week</span>
                  <select className="pg-sel sm" value={resW} onChange={(e) => setResW(Number(e.target.value))} aria-label="Week to reserve">{Array.from({ length: E.WEEKS - s.week }, (_, k) => s.week + 1 + k).map((w) => <option key={w} value={w}>Week {w}, saves {Math.round(((E.RATE[w - 1] ?? 1) - 1) * 100)}%</option>)}</select>
                  {tvSteps.slice(0, 3).map((v) => <button key={v} type="button" className="pg-btn" disabled={s.cash < v} onClick={() => run((x) => E.reserveTV(c, x, Math.max(resW, s.week + 1), v, tone), "reserve")}>{E.usd(v)}</button>)}</div> : null}
                <p className="pg-note">Attack ads hit hardest but can draw a fact check unless you have an opposition research firm. Outside groups spend for both sides on their own: {E.usd(c.outMe)} a week for you, {E.usd(c.outOp)} for {sur(op.name)}.</p>
                <div className="pg-sep" />
                <span className="pg-k">Targeted digital</span>
                <div className="pg-row">
                  <select className="pg-sel" value={dg} onChange={(e) => setDg(e.target.value)} aria-label="Voter group to target">
                    <option value="">Pick a voter group</option>
                    {digGroups.map((g) => <option key={g.dim + g.label} value={g.label}>{g.label}: {Math.round(g.share)}% of voters, {Math.round(g.d)} D to {Math.round(g.r)} R</option>)}
                  </select>
                  {[100000, 250000].map((v) => <button key={v} type="button" className="pg-btn" disabled={!dg || s.cash < v} onClick={() => run((x) => E.buyDigital(c, x, v, dg), "digital")}>{E.usd(v)}</button>)}
                </div>
              </div>
            ) : null}
            {tab === "staff" ? (
              <div className="pg-grid">
                <div className="pg-act static"><b>Pollster</b><span>{s.staff.pollster ? `${E.POLLSTERS[s.staff.pollster]!.name}, ${E.usd(E.POLLSTERS[s.staff.pollster]!.wk)} a poll each week. Shows every voter group and region, and lets you test messages before you answer.` : "None. You only see public polls, when they come out, and you cannot test messages."}</span>
                  <span className="pg-row">{([1, 2, 3] as const).map((t) => <button key={t} type="button" className={cls("chip", s.staff.pollster === t && "on")} onClick={() => run((x) => E.hire(c, x, "pollster", t), "pollster")}>{["C", "B", "A"][t - 1]} rated, {E.usd(E.POLLSTERS[t]!.wk)}/wk</button>)}</span></div>
                {(Object.keys(E.STAFF_COST) as (keyof typeof E.STAFF_COST)[]).map((k) => (
                  <button key={k} type="button" className={cls("pg-act", s.staff[k] && "done")} disabled={s.staff[k]} onClick={() => run((x) => E.hire(c, x, k), k)}>
                    <b>{E.STAFF_COST[k].name}{s.staff[k] ? ", on staff" : ""}</b><span>{E.STAFF_COST[k].what} {E.usd(E.STAFF_COST[k].hire)} to hire{E.STAFF_COST[k].wk ? `, ${E.usd(E.STAFF_COST[k].wk)} a week` : ""}.</span>
                  </button>
                ))}
              </div>
            ) : null}
            {tab === "ground" ? (
              <div className="pg-air">
                <p className="pg-note">{r.earlyVote ? `${r.earlyVote.ballots.toLocaleString()} ballots were already cast in ${r.state} by ${r.earlyVote.date} in real life. ` : ""}Early voting opens in week {E.EARLY_FROM}; from then every dollar of turnout work also banks votes, which protects you from a late polling miss.</p>
                <div className="pg-bank"><span className="pg-k">Votes banked</span><span className="bar"><i style={{ width: `${Math.round(s.banked * 100)}%` }} /></span><b>{Math.round(s.banked * 100)}%</b></div>
                <button type="button" className="pg-act wide" disabled={s.days < 1 || !s.offices.length} onClick={() => run((x) => E.canvass(c, x), "knock", s.offices[0] ? { f: s.offices[0], kind: "knock" } : undefined)}><b>Door knocking weekend</b><span>1 day. Your {s.volunteers.toLocaleString()} volunteers knock doors in the counties with field offices. {s.knocks ? `${s.knocks.toLocaleString()} doors so far.` : ""}{!s.offices.length ? " Open a field office first." : ""}</span></button>
                <div className="pg-row"><span className="pg-k">Turnout program</span>{[0.15, 0.4, 0.8].map((k) => { const v = Math.round((k * c.total) / 10000) * 10000; return <button key={k} type="button" className="pg-btn" disabled={s.cash < v} onClick={() => run((x) => E.fundGotv(c, x, v), "gotv")}>{E.usd(v)}</button>; })}</div>
                <p className="pg-note">Paid canvassers, rides to the polls and ballot chase in the counties you win. It pays out at the end of the week; a field director makes it go 40 percent further. Field offices: {s.offices.length ? s.offices.map((f) => r.counties.find((x) => x[0] === f)?.[1]).join(", ") : "none yet, open them from the map"}.</p>
              </div>
            ) : null}
            {tab === "polls" ? (
              <div className="pg-air">
                <PollChart s={s} me={me.name} op={op.name} />
                <ul className="pg-plist">{[...s.polls].reverse().slice(0, 8).map((p, i) => <li key={i} className={p.internal ? "int" : ""}><span>{p.w === 0 ? "Before you started" : `Week ${p.w}`}</span><span>{p.src}</span><b className={p.m >= 0 ? "up" : "dn"}>{E.lead(p.m, sur(me.name), sur(op.name))}</b></li>)}</ul>
                {s.polls.filter((p) => p.internal).slice(-1).map((p) => (
                  <div key="x"><span className="pg-k">Your internal crosstabs, week {p.w}</span>
                    <ul className="pg-plist">{(p.groups ?? []).map((g) => <li key={g.label}><span>{g.label.replace(/^Region: /, "")}</span><span>{g.label.startsWith("Region: ") ? "Region" : "Group"}</span><b className={g.m >= 0 ? "up" : "dn"}>{E.lead(g.m, sur(me.name), sur(op.name))}</b></li>)}</ul></div>
                ))}
                {!s.staff.pollster ? <p className="pg-note">Hire a pollster to see a poll every week, every group and region, and to test messages.</p> : null}
              </div>
            ) : null}
            {tab === "intel" ? (
              <div className="pg-air">
                {r.research?.summary ? <div className="pg-intel"><span className="pg-k">The race, from the research</span><p className="pg-note">{r.research.summary}</p></div> : null}
                {[me, op].map((x) => (
                  <div key={x.side} className="pg-intel">
                    <span className="pg-k">{x === me ? "Your candidate" : "The opponent"}: {x.name}</span>
                    <ul>{x.intel.slice(0, 4).map((it, i) => <li key={i}>{it.l ? <b>{it.l}. </b> : null}{it.t} {it.u ? <a href={it.u} target="_blank" rel="noopener noreferrer">Source</a> : null}</li>)}</ul>
                    {!x.intel.length ? <p className="pg-note">No researched file yet.</p> : null}
                    <small className="pg-note">Raised {E.usd(x.donors?.raised ?? x.money.receipts ?? 0)}, cash {E.usd(x.money.cash ?? 0)}{x.money.as_of ? ` as of ${x.money.as_of}` : ""}, outside groups {E.usd(x.money.outside_for ?? 0)}{x.donors?.donations ? `, ${x.donors.donations.toLocaleString()} donations` : ""}.{x.file ? <> <Link href={`/watchdog/people/${x.file}`}>People file</Link></> : null}</small>
                  </div>
                ))}
                {(r.research?.ads ?? []).length ? <div className="pg-intel"><span className="pg-k">Real ads in this race</span><ul>{r.research!.ads.map((a, i) => <li key={i}><b>{a.by}</b>: {a.theme} <a href={a.src} target="_blank" rel="noopener noreferrer">Source</a></li>)}</ul></div> : null}
                <Link className="pg-note" href={`/watchdog/war-room/${r.id}`}>Open this race in the War Room</Link>
              </div>
            ) : null}
            {tab === "log" ? (
              <ul className="pg-log">{[...s.log].reverse().slice(0, 40).map((l, i) => <li key={i} className={l.kind}><span>W{l.w}</span><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
            ) : null}
          </div>
        </section>
      </div>

      <div className="pg-wire" aria-hidden="true"><span className="lbl">Campaign wire</span><div className="run">{wire.concat(wire).map((l, i) => <span key={i} className={l.kind}>{l.t}</span>)}</div></div>
      {toast ? <div key={toast.k} className={cls("pg-toast", !toast.ok && "bad")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}

      {pend && !out ? (
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-ev-h">
          <div className={cls("pg-card", "ev", pend.kind)}>
            <div className="pg-evtags">
              <span className={cls("pg-tagx", debate ? "debate" : pend.kind === "attack" ? "hot" : pend.kind === "flash" ? "news" : pend.kind === "scenario" ? "sc" : "")}>{debate ? `Debate night · question ${4 - s.cur.filter((x) => x.kind === "debate").length} of 3` : pend.kind === "attack" ? "Incoming" : pend.kind === "opening" ? "Opportunity" : pend.kind === "flash" ? (pend.helps === "you" ? "Breaking, good news" : pend.helps === "them" ? "Breaking, bad news" : "Breaking") : pend.kind === "scenario" ? "Scenario" : pend.kind === "endorse" ? "Endorsement" : pend.kind === "quarter" ? "Deadline" : `Week ${s.week} decision`}</span>
              {pend.real ? <span className="pg-tagx real">Real{pend.date ? `, ${pend.date}` : ""}</span> : null}
              {s.cur.length > 1 ? <span className="pg-tagx dim">{s.cur.length - 1} more this week</span> : null}
            </div>
            <h3 id="pg-ev-h">{pend.title}</h3>
            <p>{pend.prompt} {pend.src ? (pend.src.startsWith("/") ? <Link href={pend.src}>Read it</Link> : <a href={pend.src} target="_blank" rel="noopener noreferrer">Source</a>) : null}</p>
            {debate ? <p className="pg-note">Prep sessions: {s.prep}. Answers count half again as much on a debate stage, and prep sharpens them.</p> : null}
            {pend.opts.some((o) => o.st) ? (
              tests ? <p className="pg-note">Your pollster&apos;s message test is in: the bars under each answer show how it tested, with the pollster&apos;s margin of error.</p>
                : <button type="button" className="pg-ghost" onClick={test} disabled={!s.staff.pollster}>Test the answers with your pollster, $25K{!s.staff.pollster ? ", hire one first" : ""}</button>
            ) : null}
            <div className="pg-opts">
              {pend.opts.map((o, i) => {
                const blocked = (o.need === "oppo" && !s.staff.oppo) || (o.cash != null && s.cash < o.cash) || (o.days != null && s.days < o.days);
                const tv = tests?.[i];
                return (
                  <button key={i} type="button" className="pg-opt" disabled={blocked} onClick={() => choose(i)} style={{ animationDelay: `${i * 60}ms` }}>
                    <b>{o.label}</b><span>{o.say}{o.cash ? ` ${E.usd(o.cash)}.` : ""}{o.days ? ` ${o.days} day.` : ""}{o.need === "oppo" && !s.staff.oppo ? " Needs an opposition research firm." : ""}</span>
                    {tv != null && !Number.isNaN(tv) ? <span className="pg-test"><i className={tv >= 0 ? "up" : "dn"} style={{ width: `${Math.min(50, Math.abs(tv) * 120)}%`, [tv >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /><em className={tv >= 0 ? "up" : "dn"}>{fxs(tv)}</em></span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {out ? (
        <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-out-h">
          <div className="pg-card">
            <span className="pg-tagx">How it played</span>
            <h3 id="pg-out-h">{out.ev.opts[out.choice].label}</h3>
            <div className={cls("pg-bigfx", out.o.fx >= 0 ? "up" : "dn")}><Roll v={out.o.fx} fmt={(x) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`} /><small>points</small></div>
            <p>{out.o.t}</p>
            {out.o.parts.length ? <><span className="pg-k">Who moved, from {r.state}&apos;s voter data</span><Parts parts={out.o.parts} /></> : null}
            <button type="button" className="pg-press sm" onClick={() => setOut(null)}>{s.cur.length ? "Next" : "Back to work"}</button>
          </div>
        </div>
      ) : null}
      {week ? (() => {
        const na = E.polledAvg(s);
        const d = (a: number, b: number) => a - b;
        return (
          <div className="pg-modal" role="dialog" aria-modal="true" aria-labelledby="pg-wk-h">
            <div className="pg-card report">
              <span className="pg-tagx">{s.done ? "The polls are closed" : `Week ${s.week - 1} report`}</span>
              <h3 id="pg-wk-h">{s.done ? "Election Day is here" : "The week in review"}</h3>
              <div className="pg-deltas">
                <div><span>Poll average</span><b className={na == null ? "" : na >= 0 ? "up" : "dn"}>{na == null ? "n/a" : E.lead(na, sur(me.name), sur(op.name))}</b>{na != null && week.before.avg != null ? <small className={na - week.before.avg >= 0 ? "up" : "dn"}>{fxs(na - week.before.avg)}</small> : null}</div>
                <div><span>War chest</span><b>{E.usd(s.cash)}</b><small className={d(s.cash, week.before.cash) >= 0 ? "up" : "dn"}>{d(s.cash, week.before.cash) >= 0 ? "+" : "−"}{E.usd(Math.abs(d(s.cash, week.before.cash)))}</small></div>
                <div><span>Buzz</span><b>{Math.round(s.buzz)}</b><small className={s.buzz - week.before.buzz >= 0 ? "up" : "dn"}>{s.buzz - week.before.buzz >= 0 ? "+" : "−"}{Math.abs(Math.round(s.buzz - week.before.buzz))}</small></div>
                <div><span>Volunteers</span><b>{s.volunteers.toLocaleString()}</b><small className={s.volunteers - week.before.vol >= 0 ? "up" : "dn"}>{s.volunteers - week.before.vol >= 0 ? "+" : "−"}{Math.abs(s.volunteers - week.before.vol).toLocaleString()}</small></div>
              </div>
              <ul className="pg-log">{week.items.map((l, i) => <li key={i} className={l.kind} style={{ animationDelay: `${i * 60}ms` }}><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
              {(() => { const p = s.polls.filter((x) => x.w === s.week - 1); return p.length ? <p>New polling: {p.map((x) => `${x.src}, ${E.lead(x.m, sur(me.name), sur(op.name))}`).join("; ")}.</p> : <p className="pg-note">No new polls this week{s.staff.pollster ? "" : "; you do not have a pollster"}.</p>; })()}
              <button type="button" className="pg-press sm" onClick={() => { setWeek(null); if (s.done) onNight(); else setBanner(s.week); }}>{s.done ? "Watch the returns" : `On to week ${s.week}`}</button>
            </div>
          </div>
        );
      })() : null}
    </div>
  );
}

// ============================================================ election night
function Night({ r, s, paths, again, menu }: { r: E.RaceFile; s: E.State; paths: CountyPath[] | null; again: () => void; menu: () => void }) {
  const res = s.result!;
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const geo = useGeo(paths);
  const [n, setN] = useState(0);
  const total = res.order.length;
  useEffect(() => {
    if (n >= total) return;
    const id = setTimeout(() => setN((x) => Math.min(total, x + Math.max(1, Math.ceil(total / 70)))), 150);
    return () => clearTimeout(id);
  }, [n, total]);
  const shown = useMemo(() => new Set(res.order.slice(0, n)), [res.order, n]);
  const tally = useMemo(() => {
    let me = 0, op = 0, t = 0;
    for (const x of res.counties) if (shown.has(x.f)) { me += (x.t * (1 + x.m / 100)) / 2; op += (x.t * (1 - x.m / 100)) / 2; t += x.t; }
    return { me, op, t };
  }, [shown, res.counties]);
  const allT = res.counties.reduce((a, x) => a + x.t, 0) || 1;
  const rep = tally.t / allT;
  const lead = tally.me - tally.op;
  const called = n >= total || (rep > 0.55 && Math.abs(lead) / allT > (1 - rep) * 0.35 && (lead > 0) === res.win);
  const g = E.grade(s);
  const done = n >= total;
  const share = `I ran ${c.me.name}'s campaign for ${r.name} on ${E.DIFF[s.diff].name} and ${res.win ? "won" : "lost"} by ${Math.abs(res.m).toFixed(1)} points. Grade: ${g.letter}. Play at onpointpolitics.com/play`;
  const [copied, setCopied] = useState(false);
  const latest = res.order.slice(Math.max(0, n - 4), n).map((f) => res.counties.find((x) => x.f === f)).filter(Boolean).reverse();
  useEffect(() => { if (done) track("Play finished", { race: r.id, side: s.side, diff: s.diff, win: res.win, m: Math.round(res.m * 10) / 10 }); }, [done]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="pg-night">
      {called && res.win ? <div className="pg-confetti" aria-hidden="true">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 9) * 0.12}s`, background: ["#ffb547", "#3d7bff", "#ff3b5c", "#5ee0a0", "#b78cff"][i % 5] }} />)}</div> : null}
      <div className="pg-nh">
        <span className="pg-k pg-live"><i />Election night · {r.state}</span>
        <h2>{called ? (res.win ? `${c.me.name} wins` : `${c.op.name} wins`) : "Too early to call"}</h2>
        {called ? <span className={cls("pg-stamp", res.win ? "win" : "loss")}>{res.win ? "Projected winner" : "Race called"}</span> : null}
      </div>
      <div className="pg-nmain">
        <section className="pg-mapw"><StateMap r={r} s={s} geo={geo} sel={null} onSel={() => {}} mode="night" shown={shown} /></section>
        <section className="pg-tally">
          <span className="pg-k">{Math.round(rep * 100)}% of the vote counted</span>
          <span className="pg-rep"><i style={{ width: `${rep * 100}%` }} /></span>
          {[{ n: c.me.name, v: tally.me, p: c.me.party, me: true }, { n: c.op.name, v: tally.op, p: c.op.party, me: false }].sort((a, b) => b.v - a.v).map((x) => (
            <div key={x.n} className={cls("pg-tl", x.p.toLowerCase())}>
              <div><b>{x.n}{called && ((x.me && res.win) || (!x.me && !res.win)) ? " ✓" : ""}</b><span><Roll v={x.v} /></span></div>
              <span className="bar"><i style={{ width: `${tally.t ? (100 * x.v) / tally.t : 0}%` }} /></span>
              <small>{tally.t ? ((100 * x.v) / tally.t).toFixed(1) : "0.0"}%</small>
            </div>
          ))}
          {!done ? <ul className="pg-feed">{latest.map((x) => x && <li key={x.f}><span>{r.counties.find((k) => k[0] === x.f)?.[1]}</span><b className={x.m >= 0 ? "up" : "dn"}>{E.lead(x.m, sur(c.me.name), sur(c.op.name))}</b></li>)}</ul> : null}
          {done ? (
            <div className="pg-final">
              <div className="pg-grade"><b>{g.letter}</b><span>{res.win ? "You won" : "You lost"} by {Math.abs(res.m).toFixed(1)} points. {g.line}</span></div>
              <dl>
                <div><dt>The forecast had you at</dt><dd>{E.lead(res.forecast, sur(c.me.name), sur(c.op.name))}</dd></div>
                <div><dt>You started at</dt><dd>{E.lead(res.start, sur(c.me.name), sur(c.op.name))}</dd></div>
                <div><dt>Raised and spent</dt><dd>{E.usd(s.raised)} · {E.usd(s.spent)}</dd></div>
                <div><dt>Counties visited, doors knocked</dt><dd>{Object.keys(s.visits).length} · {s.knocks.toLocaleString()}</dd></div>
              </dl>
              <div className="pg-row">
                <button type="button" className="pg-btn" onClick={() => { navigator.clipboard?.writeText(share).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy your result"}</button>
                <button type="button" className="pg-press sm" onClick={again}>Run it again</button>
                <button type="button" className="pg-btn" onClick={menu}>Pick another race</button>
              </div>
              <p className="pg-note">Now watch the real one: <Link href={raceHref(r.id)}>the {r.name} forecast</Link> · <Link href={`/watchdog/war-room/${r.id}`}>War Room</Link> · <Link href="/results">results desk on November 3</Link></p>
            </div>
          ) : <button type="button" className="pg-ghost" onClick={() => setN(total)}>Skip to the end</button>}
        </section>
      </div>
    </div>
  );
}

// ============================================================ the app
export default function PlayApp({ idx }: { idx: PIndex }) {
  const [screen, setScreen] = useState<"title" | "lobby" | "intro" | "hq" | "night">("title");
  const [race, setRace] = useState<E.RaceFile | null>(null);
  const [st, setSt] = useState<E.State | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [saved, setSaved] = useState<Save | null>(null);
  const [err, setErr] = useState("");
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => { setSaved(load()); }, []);
  useEffect(() => { if (st) store({ s: st }); }, [st]);
  const loadPaths = (r: E.RaceFile) => { setPaths(null); fetch(`/forecast/states/${r.st}.json`).then((x) => x.json()).then((j) => setPaths(j.counties as CountyPath[])).catch(() => setPaths([])); };
  const start = (r: E.RaceFile, side: E.Side, d: E.Diff) => {
    setRace(r); loadPaths(r); setSt(E.newGame(r, side, d)); setScreen("intro"); track("Play start", { race: r.id, side, diff: d });
    top.current?.scrollIntoView({ behavior: "smooth" });
  };
  const resume = async () => {
    if (!saved) return;
    try { const r = (await fetch(`/play/r/${saved.s.race}.json`).then((x) => x.json())) as E.RaceFile; setRace(r); loadPaths(r); setSt(E.migrate(saved.s, r)); setScreen(saved.s.done ? "night" : "hq"); }
    catch { setErr("The saved campaign could not load."); }
  };
  const commit = useCallback((x: E.State) => setSt(x), []);
  const menu = () => { setScreen("lobby"); setSaved(load()); };
  const sr = saved ? idx.races.find((r) => r.id === saved.s.race) : null;
  useEffect(() => { if (screen !== "intro") return; const id = setTimeout(() => setScreen("hq"), 4200); return () => clearTimeout(id); }, [screen]);
  const meC = race && st ? race.cands[st.side === "D" ? 0 : 1] : null;
  return (
    <div ref={top} className="pg-app">
      {err ? <p className="pg-err" role="alert">{err}</p> : null}
      {screen === "title" ? <Title onGo={() => setScreen("lobby")} saved={!!(saved && sr && !saved.s.done)} onResume={resume} savedLabel={saved && sr ? `${sr.c[saved.s.side === "D" ? 0 : 1][0]}, week ${saved.s.week}` : ""} /> : null}
      {screen === "lobby" ? <Lobby idx={idx} onStart={start} /> : null}
      {screen === "intro" && race && st && meC ? (
        <button type="button" className="pg-intro" onClick={() => setScreen("hq")}>
          <span className="pg-k">Labor Day · September 7, 2026</span>
          <b>You are running {meC.name}&apos;s campaign for {race.name}.</b>
          <span>The race starts at {E.lead(E.margin(race, st), sur(meC.name), sur(race.cands[st.side === "D" ? 1 : 0].name))}. You have {E.usd(st.cash)} in the bank and eight weeks.</span>
          <em>Click to start</em>
        </button>
      ) : null}
      {screen === "hq" && race && st ? <HQ r={race} s={st} commit={commit} paths={paths} onNight={() => setScreen("night")} quit={menu} /> : null}
      {screen === "night" && race && st?.result ? <Night r={race} s={st} paths={paths} again={() => start(race, st.side, st.diff)} menu={() => { store(null); menu(); }} /> : null}
    </div>
  );
}
