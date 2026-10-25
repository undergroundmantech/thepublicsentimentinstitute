"use client";
// Campaign 2026, pixel edition. Pick a close Senate or governor race, pick a side and a year, and run the last eight
// weeks: work the counties from a campaign bus, meet the people who matter, fight the air war, build a real turnout
// operation, take the debate stage and sweat out a long election night. You never see the true county numbers, only
// your campaign's read of them, as foggy as your polling and your ground team. Voters respond the way the site's own
// data says they would, and much of what happens is real, from the race research.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { CountyPath } from "@/app/components/home/countyGeo";
import { ev as track } from "@/app/lib/ev";
import * as E from "./engine";
import { dealWeek, dealInvites, resolve, testEvent, ROLE_NAME, type Outcome } from "./events";
import PixelMap, { useMapGeo, type MapFx, type Layer } from "./px/PixelMap";
import Debate from "./px/Debate";
import Meeting from "./px/Meeting";
import Night from "./px/Night";
import { Portrait, Type, Roll, cls, sur, fxs } from "./px/ui";
import { seedOf, partyCol } from "./px/sprites";
import { sfx, music, setSound, soundState, unlock } from "./px/sound";

export type PIndex = { asOf: string; election: string; races: { id: string; office: string; st: string; state: string; name: string; m: number; p: number; c: [string, string, boolean][] }[] };
type Save = { s: E.State };
const KEY = "opp_play_v2";
const DIFFS: E.Diff[] = ["safe", "lean", "tossup", "wave"];
const PARTY: Record<string, string> = { D: "Democrat", R: "Republican", I: "Independent" };
const pct = (p: number) => `${Math.round(p * 100)}%`;
function load(): Save | null { try { const j = localStorage.getItem(KEY); return j ? (JSON.parse(j) as Save) : null; } catch { return null; } }
function store(x: Save | null) { try { if (x) localStorage.setItem(KEY, JSON.stringify(x)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }

// ============================================================ title
function Title({ onGo, saved, onResume, savedLabel }: { onGo: () => void; saved: boolean; onResume: () => void; savedLabel: string }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = cv.current?.getContext("2d"); if (!g) return;
    const W = 200, H = 90; let raf = 0, lt = 0;
    const stars = Array.from({ length: 60 }, (_, i) => [(i * 53) % W, (i * 29) % 50, i % 3]);
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - lt < 80) return; lt = t;
      for (let y = 0; y < H; y++) { g.fillStyle = y < 30 ? "#0b0716" : y < 55 ? "#1a0f36" : "#2a1450"; g.fillRect(0, y, W, 1); }
      for (const [x, y, k] of stars) { g.fillStyle = (Math.floor(t / 300) + k) % 3 ? "#fff6e0" : "#6a5aa8"; g.fillRect((x - t / (60 + k * 40)) % W < 0 ? W + ((x - t / (60 + k * 40)) % W) : (x - t / (60 + k * 40)) % W, y, 1, 1); }
      // the capitol dome
      g.fillStyle = "#e8e0f8"; for (let y = 0; y < 16; y++) { const w = Math.round(Math.sqrt(Math.max(0, 256 - (16 - y) ** 2)) * 1.1); g.fillRect(100 - w, 44 + y, w * 2, 1); }
      g.fillRect(98, 34, 4, 10); g.fillRect(99, 30, 2, 4); g.fillStyle = "#c8bce8"; g.fillRect(70, 60, 60, 10); for (let i = 0; i < 9; i++) { g.fillStyle = "#a89cd0"; g.fillRect(73 + i * 6.5, 62, 2, 8); }
      // skyline and searchlights
      for (let i = 0; i < 20; i++) { const h = 8 + ((i * 37) % 22); const x = i * 10 - (i > 6 && i < 13 ? 999 : 0); g.fillStyle = "#140c26"; g.fillRect(x, 70 - h, 9, h + 20); for (let w = 0; w < h / 4; w++) { g.fillStyle = (w + i + Math.floor(t / 900)) % 4 ? "#ffcc4d" : "#3a2a5a"; g.fillRect(x + 2, 72 - h + w * 4, 1, 1); g.fillRect(x + 6, 72 - h + w * 4, 1, 1); } }
      g.fillStyle = "#3d7bff22"; const a = Math.sin(t / 1400) * 30; for (let y = 0; y < 60; y++) g.fillRect(40 + a * (y / 60) - y * 0.1, 70 - y, 2 + y * 0.12, 1);
      g.fillStyle = "#ff3b5c22"; const b = Math.cos(t / 1600) * 30; for (let y = 0; y < 60; y++) g.fillRect(160 + b * (y / 60) - y * 0.1, 70 - y, 2 + y * 0.12, 1);
      g.fillStyle = "#1a1030"; g.fillRect(0, 78, W, 12);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section className="px-title">
      <canvas ref={cv} width={200} height={90} className="px-title-cv" aria-hidden="true" />
      <div className="px-title-in">
        <div className="px-logo"><span className="a">CAMPAIGN</span><span className="b">2026</span></div>
        <p className="px-tag2">Eight weeks. One race. Every vote is real data.</p>
        <div className="px-title-acts">
          <button type="button" className="px-press blink" onClick={() => { unlock(); sfx("coin"); onGo(); }}>Press start</button>
          {saved ? <button type="button" className="px-press ghost" onClick={() => { unlock(); sfx("click"); onResume(); }}>Continue: {savedLabel}</button> : null}
        </div>
        <ul className="px-feat" aria-label="What is new"><li>Campaign bus</li><li>Debate stage</li><li>Meetings</li><li>Fog of war</li><li>Real turnout</li><li>Long election night</li><li>Sound</li></ul>
      </div>
    </section>
  );
}

// ============================================================ lobby
function Bar({ v, max, label, val, tone }: { v: number; max: number; label: string; val: string; tone?: string }) {
  const n = Math.max(1, Math.min(10, Math.round((10 * v) / Math.max(1e-9, max))));
  return <div className="px-stat"><span>{label}</span><span className="px-pips">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? cls("f", tone) : ""} />)}</span><b>{val}</b></div>;
}
function Lobby({ idx, onStart }: { idx: PIndex; onStart: (r: E.RaceFile, side: E.Side, d: E.Diff, seed?: number) => void }) {
  const [office, setOffice] = useState<"all" | "senate" | "governor">("all");
  const [pick, setPick] = useState<string | null>(null);
  const [rf, setRf] = useState<E.RaceFile | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [side, setSide] = useState<E.Side | null>(null);
  const [diff, setDiff] = useState<E.Diff>("lean");
  const [seed, setSeed] = useState("");
  const geo = useMapGeo(paths, 160, 110);
  const list = idx.races.filter((r) => office === "all" || r.office === office);
  const race = idx.races.find((r) => r.id === pick);
  useEffect(() => {
    if (!pick) return; let live = true; setRf(null); setPaths(null);
    fetch(`/play/r/${pick}.json`).then((x) => x.json()).then((j: E.RaceFile) => { if (!live) return; setRf(j); fetch(`/forecast/states/${j.st}.json`).then((x) => x.json()).then((g) => live && setPaths(g.counties)).catch(() => live && setPaths([])); }).catch(() => {});
    return () => { live = false; };
  }, [pick]);
  const preview = useMemo(() => (rf ? E.newGame(rf, "D", "lean", 1) : null), [rf]);
  return (
    <div className="px-lobby">
      <section className="px-step">
        <div className="px-sh"><span className="px-n">1</span><h2>Choose your battleground</h2>
          <div className="px-chips" role="group" aria-label="Office">{(["all", "senate", "governor"] as const).map((o) => <button key={o} type="button" aria-pressed={office === o} className={office === o ? "on" : ""} onClick={() => { setOffice(o); sfx("click"); }}>{o === "all" ? "All" : o === "senate" ? "Senate" : "Governor"}</button>)}</div>
        </div>
        <div className="px-sel-grid">
          <div className="px-races">
            {list.map((r) => {
              const close = Math.max(0, 1 - Math.abs(r.m) / 15);
              return (
                <button key={r.id} type="button" className={cls("px-race", pick === r.id && "on")} aria-pressed={pick === r.id} onClick={() => { setPick(r.id); setSide(null); sfx("card"); }}>
                  <span className="k">{r.office === "senate" ? "SEN" : "GOV"} {r.st}</span>
                  <b>{r.state}</b>
                  <span className="who"><i className={(r.c[0][1] || "D").toLowerCase()}>{sur(r.c[0][0])}</i> v <i className={(r.c[1][1] || "R").toLowerCase()}>{sur(r.c[1][0])}</i></span>
                  <span className="heat" aria-label={`Closeness ${Math.round(close * 100)} of 100`}>{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < Math.round(close * 5) ? "f" : ""} />)}</span>
                </button>
              );
            })}
          </div>
          <aside className="px-preview">
            {race && rf && preview ? (
              <>
                <span className="px-k">{race.office === "senate" ? "Senate" : "Governor"} scouting report</span>
                <h3>{race.state}</h3>
                <PixelMap r={rf} s={preview} geo={geo} mode="preview" layer="regions" />
                {rf.research?.summary ? <p className="px-note">{rf.research.summary}</p> : null}
                {rf.research?.issues?.length ? <div className="px-issues">{rf.research.issues.slice(0, 5).map((x) => <span key={x.issue} title={x.why}>{x.issue}</span>)}</div> : null}
              </>
            ) : <div className="px-prev-empty"><b>Pick a race</b><span>The scouting report shows up here.</span></div>}
          </aside>
        </div>
      </section>
      {race && rf ? (
        <section className="px-step">
          <div className="px-sh"><span className="px-n">2</span><h2>Choose your candidate</h2></div>
          <div className="px-fight">
            {rf.cands.map((cd, k) => {
              const sd: E.Side = k === 0 ? "D" : "R"; const o = rf.cands[1 - k];
              const odds = sd === "R" ? rf.est.prob : 1 - rf.est.prob; const dn = cd.donors;
              const mx = (a: number | null | undefined, b: number | null | undefined) => Math.max(a ?? 0, b ?? 0, 1);
              return (
                <button key={cd.name} type="button" className={cls("px-fighter", cd.party.toLowerCase(), side === sd && "on")} aria-pressed={side === sd} onClick={() => { setSide(sd); sfx("coin"); }}>
                  <Portrait seed={seedOf(cd.name)} role="cand" party={cd.party} size={96} talking={side === sd} />
                  <span className="k">{PARTY[cd.party] ?? cd.party}{cd.inc ? ", incumbent" : ""}</span>
                  <b>{cd.name}</b>
                  <span className="odds">Chance to win <strong>{pct(odds)}</strong></span>
                  <span className="px-stats">
                    <Bar label="Cash" v={cd.money.cash ?? 0} max={mx(cd.money.cash, o.money.cash)} val={E.usd(cd.money.cash ?? 0)} tone="gold" />
                    <Bar label="Raised" v={dn?.raised ?? cd.money.receipts ?? 0} max={mx(dn?.raised ?? cd.money.receipts, o.donors?.raised ?? o.money.receipts)} val={E.usd(dn?.raised ?? cd.money.receipts ?? 0)} tone="gold" />
                    <Bar label="Donors" v={dn?.donations ?? 0} max={mx(dn?.donations, o.donors?.donations)} val={dn?.donations ? dn.donations.toLocaleString() : "n/a"} tone="green" />
                    <Bar label="Small $" v={dn?.small ?? 0} max={1} val={dn?.small != null ? pct(dn.small) : "n/a"} tone="green" />
                    <Bar label="Air cover" v={cd.money.outside_for ?? 0} max={mx(cd.money.outside_for, o.money.outside_for)} val={E.usd(cd.money.outside_for ?? 0)} />
                  </span>
                </button>
              );
            })}
            <span className="px-vs" aria-hidden="true">VS</span>
          </div>
        </section>
      ) : null}
      {race && rf && side ? (
        <section className="px-step">
          <div className="px-sh"><span className="px-n">3</span><h2>Choose the year you are running in</h2></div>
          <div className="px-diffs">
            {DIFFS.map((d, i) => (
              <button key={d} type="button" className={cls("px-diff", diff === d && "on")} aria-pressed={diff === d} onClick={() => { setDiff(d); sfx("click"); }}>
                <span className="px-pips">{[0, 1, 2, 3].map((j) => <i key={j} className={j <= i ? "f hot" : ""} />)}</span>
                <b>{E.DIFF[d].name}</b><small>{E.DIFF[d].blurb}</small>
              </button>
            ))}
          </div>
          <div className="px-go">
            <button type="button" className="px-press" onClick={() => { unlock(); sfx("fanfare"); onStart(rf, side, diff, seed && /^\d+$/.test(seed) ? Number(seed) : undefined); }}>Launch the campaign</button>
            <label className="px-seed" htmlFor="px-seed-in">Seed <input id="px-seed-in" inputMode="numeric" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
            <span className="px-note">Debate in week {E.debateWeek(rf)}. Registration closes after week {E.REG_DEADLINE}. Early voting opens week {E.EARLY_FROM}.</span>
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
    <ul className="px-parts">
      {parts.slice(0, 5).map((p, i) => (
        <li key={i}><span className="l">{p.label}</span>
          <span className="bar"><i className={p.fx >= 0 ? "up" : "dn"} style={{ width: `${(50 * Math.abs(p.fx)) / max}%`, [p.fx >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span>
          <b className={p.fx >= 0 ? "up" : "dn"}>{fxs(p.fx)}</b></li>
      ))}
    </ul>
  );
}
function PollChart({ s, me, op }: { s: E.State; me: string; op: string }) {
  const Wc = 300, Hc = 120, P = 18; const ps = s.polls; const vals = [...ps.map((p) => p.m), 0];
  const lo = Math.min(-4, ...vals) - 1, hi = Math.max(4, ...vals) + 1;
  const X = (w: number) => P + (w * (Wc - 2 * P)) / E.WEEKS, Y = (m: number) => 6 + ((hi - m) * (Hc - 22)) / (hi - lo);
  return (
    <svg className="px-pc" viewBox={`0 0 ${Wc} ${Hc}`} role="img" aria-label="Polls of the race by week" shapeRendering="crispEdges">
      <rect x={P} y={Y(hi)} width={Wc - 2 * P} height={Y(0) - Y(hi)} className="zone me" /><rect x={P} y={Y(0)} width={Wc - 2 * P} height={Y(lo) - Y(0)} className="zone op" />
      <line x1={P} x2={Wc - P} y1={Y(0)} y2={Y(0)} className="z" />
      <text x={2} y={12} className="ax">{sur(me)}</text><text x={2} y={Hc - 14} className="ax">{sur(op)}</text>
      {Array.from({ length: E.WEEKS + 1 }, (_, w) => <text key={w} x={X(w)} y={Hc - 2} textAnchor="middle" className="ax">{w === 0 ? "S" : w}</text>)}
      {ps.map((p, i) => <rect key={i} x={X(p.w) + ((i * 7) % 9) - 4} y={Y(p.m) - 2} width={p.internal ? 5 : 4} height={p.internal ? 5 : 4} className={p.internal ? "int" : "pub"}><title>{`${p.src}: ${E.lead(p.m, sur(me), sur(op))}`}</title></rect>)}
    </svg>
  );
}
function Meter({ label, v, tone }: { label: string; v: number; tone: string }) {
  const n = Math.round(Math.max(0, Math.min(100, v)) / 10);
  return <div className="px-meter2"><span>{label}</span><b className="px-pips">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? cls("f", tone) : ""} />)}</b></div>;
}

// ============================================================ cutscenes
function NewsRoll({ r, s, onDone }: { r: E.RaceFile; s: E.State; onDone: () => void }) {
  const items = useMemo(() => {
    const out: string[] = [];
    for (const x of r.research?.storylines ?? []) out.push(x.title);
    for (const m of r.media ?? []) out.push(`${m.who}: ${m.what.slice(0, 80)}`);
    for (const n of r.news ?? []) out.push(n.title);
    return out.length ? out : ["Quiet week on the trail"];
  }, [r]);
  const flash = s.cur.find((e) => e.kind === "flash");
  const land = flash?.title ?? items[(s.week * 7) % items.length];
  const [i, setI] = useState(0); const [stop, setStop] = useState(false);
  useEffect(() => {
    if (stop) return; let n = 0; let id = 0;
    const tick = () => { n++; setI((x) => x + 1); sfx("tick"); if (n < 16) id = window.setTimeout(tick, 60 + n * 14); else { setStop(true); sfx(flash ? "alarm" : "bell"); } };
    id = window.setTimeout(tick, 80); return () => clearTimeout(id);
  }, [stop, flash]);
  useEffect(() => { if (!stop) return; const id = setTimeout(onDone, 2600); return () => clearTimeout(id); }, [stop, onDone]);
  return (
    <button type="button" className="px-cut news" onClick={onDone}>
      <span className="px-tag">Week {s.week} · {E.weekLabel(s.week)}</span>
      <b className="px-cut-h">The news cycle</b>
      <span className={cls("px-slot", stop && "stop")}>{stop ? land : items[i % items.length]}</span>
      {stop ? <em>{flash ? (flash.helps === "you" ? "Breaking: good news for you" : flash.helps === "them" ? "Breaking: trouble" : "Breaking") : s.week === s.dweek ? "Debate week" : s.week >= E.EARLY_FROM ? "Early voting is open" : "The week begins"}</em> : <em>Rolling</em>}
    </button>
  );
}
function OppReplay({ r, s, geo, onDone }: { r: E.RaceFile; s: E.State; geo: ReturnType<typeof useMapGeo>; onDone: () => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const o = s.oppLast; const path = useMemo(() => (o ? [...o.base, ...o.stops] : []), [o]);
  const [t0] = useState(() => performance.now());
  const [fx, setFx] = useState<MapFx[]>([]);
  useEffect(() => {
    const ids: number[] = [];
    path.forEach((_, k) => ids.push(window.setTimeout(() => sfx("step"), k * 1300 + 200)));
    ids.push(window.setTimeout(() => { sfx("airstrike"); setFx([{ id: 1, kind: "opp", fs: E.regionsOf(r)[0]?.f.concat(E.regionsOf(r)[1]?.f ?? []) ?? [], t0: performance.now() }]); }, path.length * 1300 + 300));
    return () => ids.forEach(clearTimeout);
  }, [path, r]);
  const names = [...new Set(path.map((f) => r.counties.find((x) => x[0] === f)?.[1]).filter(Boolean))];
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-opp-h">
      <div className="px-card opp">
        <div className="px-row"><Portrait seed={seedOf(c.op.name)} role="cand" party={c.op.party} size={56} talking /><div><span className="px-tag">Meanwhile</span><h3 id="px-opp-h">{c.op.name}&apos;s week</h3></div></div>
        <PixelMap r={r} s={s} geo={geo} mode="plan" layer="rival" oppPath={path} oppT0={t0} fx={fx} />
        <p>Their bus stopped in {names.length ? names.join(", ") : "no counties you could track"}. {o?.tv ? `They ran about ${E.usd(o.tv)} of television.` : ""} {o?.ad ? <><br /><b>On the air:</b> {o.ad}</> : null}</p>
        <button type="button" className="px-btn go" onClick={onDone}>See your week report</button>
      </div>
    </div>
  );
}
function Final72({ r, s, onDone }: { r: E.RaceFile; s: E.State; onDone: (x: E.State) => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const cand = useMemo(() => r.counties.map((co) => ({ f: co[0], n: co[1], v: (s.side === "R" ? co[4] : co[3]), rd: E.readOf(s, co[0]) })).sort((a, b) => b.v - a.v).slice(0, 8), [r, s]);
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(cand.slice(0, 4).map((x) => [x.f, 2])));
  const [closing, setClosing] = useState<"positive" | "contrast" | "attack" | "base">("contrast");
  const [law, setLaw] = useState(s.lawyers);
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  const go = () => { const x = structuredClone(s); if (law && !x.lawyers) E.hireLawyers(x); E.finalPush(c, x, alloc, closing); sfx("fanfare"); onDone(x); };
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-f72-h">
      <div className="px-card wide">
        <span className="px-tag">Election eve</span><h3 id="px-f72-h">The final 72 hours</h3>
        <p className="px-note">Put your {s.volunteers.toLocaleString()} volunteers on shifts. Shifts work your own lists, so they pay most where you have the most voters to turn out. Ten shifts to place.</p>
        <ul className="px-alloc">{cand.map((x) => (
          <li key={x.f}><span>{x.n}<small>{x.rd ? `${E.readLabel(x.rd.est, x.rd.sd)}, ${E.confLabel(x.rd.sd).toLowerCase()}` : "no read"}</small></span>
            <button type="button" className="px-btn sm" disabled={!alloc[x.f]} onClick={() => { setAlloc((a) => ({ ...a, [x.f]: Math.max(0, (a[x.f] ?? 0) - 1) })); sfx("click"); }}>-</button>
            <b className="px-pips">{Array.from({ length: 5 }, (_, i) => <i key={i} className={i < (alloc[x.f] ?? 0) ? "f gold" : ""} />)}</b>
            <button type="button" className="px-btn sm" disabled={total >= 10 || (alloc[x.f] ?? 0) >= 5} onClick={() => { setAlloc((a) => ({ ...a, [x.f]: (a[x.f] ?? 0) + 1 })); sfx("click"); }}>+</button></li>
        ))}</ul>
        <span className="px-k">Closing message</span>
        <div className="px-chips">{([["positive", "Positive"], ["contrast", "Contrast"], ["attack", "Last minute attack"], ["base", "Fire up the base"]] as const).map(([k, l]) => <button key={k} type="button" className={closing === k ? "on" : ""} onClick={() => setClosing(k)}>{l}</button>)}</div>
        <label className="px-check" htmlFor="px-law"><input id="px-law" type="checkbox" checked={law} disabled={s.lawyers || s.cash < 150000} onChange={(e) => setLaw(e.target.checked)} />Voter protection team, $150K: lawyers and poll watchers so long lines do not cost you votes{s.lawyers ? " (hired)" : ""}</label>
        <button type="button" className="px-press" onClick={go} disabled={total === 0}>Polls open</button>
      </div>
    </div>
  );
}

// ============================================================ headquarters
type Tab = "trail" | "meet" | "air" | "ground" | "staff" | "polls" | "intel" | "log";
const TABS: [Tab, string][] = [["trail", "Trail"], ["meet", "Meetings"], ["air", "Air war"], ["ground", "Turnout"], ["staff", "Staff"], ["polls", "Polls"], ["intel", "Intel"], ["log", "Wire"]];

function HQ({ r, s, commit, geo, onNight, onDebate, quit, immersive, toggleFull, rolled, setRolled }: { r: E.RaceFile; s: E.State; commit: (x: E.State) => void; geo: ReturnType<typeof useMapGeo>; onNight: () => void; onDebate: () => void; quit: () => void; immersive: boolean; toggleFull: () => void; rolled: number; setRolled: (w: number) => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trail");
  const [layer, setLayer] = useState<Layer>("read");
  const [toast, setToast] = useState<{ t: string; ok: boolean; k: number } | null>(null);
  const [out, setOut] = useState<{ ev: E.Ev; o: Outcome; choice: number } | null>(null);
  const [week, setWeek] = useState<{ items: E.LogItem[]; before: { avg: number | null; cash: number; buzz: number; vol: number } } | null>(null);
  const roll = rolled < s.week; const setRoll = (v: boolean) => setRolled(v ? s.week - 1 : s.week);
  const [replay, setReplay] = useState(false);
  const [meet, setMeet] = useState<E.Meet | null>(null);
  const [f72, setF72] = useState(false);
  const [fx, setFx] = useState<MapFx[]>([]);
  const [bus, setBus] = useState<string | null>(null);
  const [tone, setTone] = useState<"positive" | "contrast" | "attack">("contrast");
  const [resW, setResW] = useState(Math.min(E.WEEKS, s.week + 2));
  const [dg, setDg] = useState("");
  const [snd, setSnd] = useState(soundState());
  const fxId = useRef(1);
  useEffect(() => { if (!s.done && (s.evw < s.week || s.invw < s.week)) { const x = structuredClone(s); dealWeek(c, x); dealInvites(c, x); commit(x); } }, [s, c, commit]);
  useEffect(() => { music("trail"); }, []);
  const burst = (k: MapFx["kind"], f?: string, fs?: string[]) => { const id = fxId.current++; setFx((e) => [...e.filter((x) => performance.now() - x.t0 < 2500), { id, kind: k, f, fs, t0: performance.now() }]); };
  const run = (fn: (x: E.State) => E.ActResult, name?: string, at?: { f?: string; kind: MapFx["kind"]; fs?: string[] }, snd2: Parameters<typeof sfx>[0] = "good") => {
    const x = structuredClone(s); const res = fn(x);
    if (res.ok) { commit(x); if (at) { burst(at.kind, at.f, at.fs); if (at.f && (at.kind === "rally" || at.kind === "hall" || at.kind === "reg")) setBus(at.f); } sfx(res.t.includes("Running on fumes") ? "bad" : snd2); }
    else sfx("buzz");
    setToast({ t: res.t, ok: res.ok, k: Date.now() }); if (res.ok && name) track("Play action", { a: name, race: r.id });
  };
  const ci = sel ? r.counties.findIndex((x) => x[0] === sel) : -1;
  const co = ci >= 0 ? r.counties[ci] : null;
  const rd = co ? E.readOf(s, co[0]) : null;
  const avg = E.polledAvg(s);
  const me = c.me, op = c.op;
  const pend = s.cur[0];
  const regs = useMemo(() => E.regionsOf(r), [r]);
  const regOfSel = co ? regs.findIndex((g) => g.f.includes(co[0])) : -1;
  const debateNow = s.week === s.dweek && s.debated == null && !s.used.includes("chair") && !s.cur.some((e) => e.kind === "chair");
  const rate = E.RATE[Math.min(E.WEEKS, s.week) - 1] ?? 1;
  const tvSteps = [0.25, 0.5, 1, 2].map((k) => Math.round((k * c.cost) / 50000) * 50000).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const digGroups = c.groups.filter((g) => !["Party ID", "2024 presidential vote", "Trump job approval", "Direction of the country", "Race and gender", "Race and education"].includes(g.dim) && g.share >= 5);
  const endWeek = () => {
    if (s.week >= E.WEEKS && !s.final) { setF72(true); return; }
    const before = { avg, cash: s.cash, buzz: s.buzz, vol: s.volunteers };
    const x = structuredClone(s); const items = E.endWeek(c, x); commit(x);
    setWeek({ items, before }); track("Play week", { race: r.id, week: s.week }); sfx("whoosh");
    if (!x.done) setReplay(true);
  };
  const choose = (i: number) => { const x = structuredClone(s); const e = x.cur.shift()!; const o = resolve(c, x, e, i); commit(x); setOut({ ev: e, o, choice: i }); sfx(o.fx > 0.03 ? "good" : o.fx < -0.03 ? "bad" : "click"); };
  const test = () => { const x = structuredClone(s); const r2 = testEvent(c, x, x.cur[0]); if (r2) { commit(x); sfx("coin"); } else setToast({ t: s.staff.pollster ? "Not enough cash to test." : "Hire a pollster to test messages.", ok: false, k: Date.now() }); };
  const tests = pend ? s.tests[pend.id] : undefined;
  const ticker = useMemo(() => [...(r.media ?? []).map((m) => `${m.who}: ${m.what}`), ...(r.research?.storylines ?? []).map((x) => `${x.date}: ${x.title}`)], [r]);
  const wire = [...s.log].reverse().slice(0, 8).map((l) => l.t);
  const hoverCo = hov ? r.counties.find((x) => x[0] === hov) : null; const hoverRd = hov ? E.readOf(s, hov) : null;
  const flipSnd = (k: "sfx" | "music") => { const n = { ...snd, [k]: !snd[k] }; setSnd(n); setSound(n); if (k === "music" && n.music) music("trail"); };
  return (
    <div className="px-hq" style={{ "--px-me": partyCol(me.party), "--px-op": partyCol(op.party) } as React.CSSProperties}>
      <header className="px-hud">
        <div className={cls("px-id", me.party.toLowerCase())}>
          <Portrait seed={seedOf(me.name)} role="cand" party={me.party} size={40} />
          <div><span className="px-k">{r.name} · {E.DIFF[s.diff].name}</span><b>{me.name}</b></div>
        </div>
        <div className="px-hs"><span>Week</span><b>{Math.min(s.week, E.WEEKS)}/{E.WEEKS}</b><small>{E.weekLabel(Math.min(s.week, E.WEEKS)).split(" to ")[0]}</small></div>
        <div className="px-hs"><span>Days</span><b className="px-pips days">{Array.from({ length: E.DAYS }, (_, i) => <i key={i} className={i < s.days ? "f gold" : ""} />)}</b></div>
        <div className="px-hs"><span>Cash</span><b className={s.cash < 0 ? "dn" : "cash"}><Roll v={s.cash} fmt={E.usd} /></b></div>
        <div className="px-hs"><span>Volunteers</span><b><Roll v={s.volunteers} /></b></div>
        <div className="px-hs meters"><Meter label="Energy" v={s.stamina} tone={s.stamina < 30 ? "hot" : "green"} /><Meter label="Base" v={s.enth[0]} tone="gold" /><Meter label="Buzz" v={s.buzz} tone="pink" /></div>
        <div className="px-hs"><span>Poll avg</span><b className={avg == null ? "" : avg >= 0 ? "up" : "dn"}>{avg == null ? "None" : E.lead(avg, sur(me.name), sur(op.name))}</b></div>
        <div className="px-hacts">
          {debateNow ? <button type="button" className="px-press sm hot" onClick={() => { sfx("alarm"); onDebate(); }}>Debate night</button>
            : <button type="button" className="px-press sm" onClick={endWeek} disabled={!!pend}>{s.week >= E.WEEKS ? "Election eve" : "End week"}</button>}
          <button type="button" className={cls("px-icon", !snd.sfx && "off")} onClick={() => flipSnd("sfx")} aria-label="Sound effects" title="Sound effects">SFX</button>
          <button type="button" className={cls("px-icon", !snd.music && "off")} onClick={() => flipSnd("music")} aria-label="Music" title="Music">MUS</button>
          <button type="button" className="px-icon" onClick={toggleFull} aria-label="Full screen" title="Full screen">{immersive ? "WIN" : "FULL"}</button>
          <button type="button" className="px-icon" onClick={quit} aria-label="Menu">MENU</button>
        </div>
      </header>

      <div className="px-main">
        <section className="px-mapw">
          <div className="px-mh">
            <b>{r.state}</b>
            <div className="px-chips" role="group" aria-label="Map layer">
              {([["read", "Your read"], ["regions", "Regions"], ["ground", "Ground game"], ["rival", "Their stops"]] as [Layer, string][]).map(([k, l]) => <button key={k} type="button" className={layer === k ? "on" : ""} aria-pressed={layer === k} onClick={() => { setLayer(k); sfx("click"); }}>{l}</button>)}
            </div>
          </div>
          <div className="px-mapbox">
            <PixelMap r={r} s={s} geo={geo} mode="plan" layer={layer} sel={sel} onSel={(f) => { setSel(f); sfx("click"); }} hover={hov} onHover={setHov} fx={fx} bus={bus} />
            {hoverCo && !co ? <div className="px-hover">{hoverCo[1]} · {hoverRd ? `${E.readLabel(hoverRd.est, hoverRd.sd)}, ${E.confLabel(hoverRd.sd).toLowerCase()}` : "no read"}</div> : null}
          </div>
          <div className="px-legend"><span><i className="me" />Leans you</span><span><i className="toss" />Toss up</span><span><i className="op" />Leans them</span><span><i className="fog" />Dither means a fuzzy read</span></div>
          {co ? (
            <div className="px-county" key={co[0]}>
              <div className="px-ch">
                <b>{co[1]}</b>{regOfSel >= 0 ? <span className="px-chip">{regs[regOfSel].name}</span> : null}
                <span>{((100 * co[5]) / c.total).toFixed(1)}% of the state&apos;s vote{co[6] != null ? ` · 2024 president ${co[6] > 0 ? "R" : "D"} +${Math.abs(co[6]).toFixed(0)}` : ""}</span>
                <span className="px-read">Your read: <b className={rd ? (rd.est >= 0 ? "up" : "dn") : ""}>{rd ? E.readLabel(rd.est, rd.sd) : "No idea"}</b> · {rd ? `${E.confLabel(rd.sd)}, from ${rd.src.toLowerCase()}${rd.w ? `, week ${rd.w}` : ""}` : "send someone"}</span>
                <span>Your stops {s.visits[co[0]] ?? 0} · theirs {s.oppVisits[co[0]] ?? 0}{s.offices.includes(co[0]) ? " · field office" : ""}</span>
                {regOfSel >= 0 && regs[regOfSel].note ? <span className="px-note">{regs[regOfSel].note}</span> : null}
              </div>
              <div className="px-cacts">
                <button type="button" className="px-btn" disabled={s.days < 1} onClick={() => run((x) => E.rally(c, x, co[0]), "rally", { f: co[0], kind: "rally" }, "crowd")}>Bus tour rally<small>1 day · $35K</small></button>
                <button type="button" className="px-btn" disabled={s.days < 1} onClick={() => run((x) => E.townHall(c, x, co[0]), "town hall", { f: co[0], kind: "hall" })}>Town hall<small>1 day · $12K</small></button>
                <button type="button" className="px-btn" disabled={s.offices.includes(co[0])} onClick={() => run((x) => E.openOffice(c, x, co[0]), "office", { f: co[0], kind: "office" }, "coin")}>Field office<small>$60K</small></button>
                <button type="button" className="px-btn" disabled={s.days < 1 || s.week > E.REG_DEADLINE} onClick={() => run((x) => E.regDrive(c, x, co[0]), "register", { f: co[0], kind: "reg" })}>Register voters<small>{s.week > E.REG_DEADLINE ? "closed" : "1 day · $15K"}</small></button>
                {regOfSel >= 0 ? <button type="button" className="px-btn" onClick={() => run((x) => E.regionPoll(c, x, regOfSel), "region poll", { kind: "poll", fs: regs[regOfSel].f }, "coin")}>Poll this region<small>$30K</small></button> : null}
              </div>
            </div>
          ) : <p className="px-note pad">Click a county to send the bus. You only see your campaign&apos;s read of each county: polls and ground teams sharpen it, and it goes stale.</p>}
        </section>

        <section className="px-side">
          <div className="px-tabs" role="tablist">
            {TABS.map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); sfx("click"); }}>{l}{k === "meet" && s.invites.length ? <i className="px-badge">{s.invites.length}</i> : null}</button>)}
          </div>
          <div className="px-pane" key={tab}>
            {tab === "trail" ? (
              <div className="px-grid">
                <button type="button" className="px-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "call"), "call", { kind: "money" }, "coin")}><b>Call time</b><span>1 day. About {E.usd(c.weekly * 0.38 * E.DIFF[s.diff].fund)}.</span></button>
                <button type="button" className="px-act" disabled={s.days < 1} onClick={() => run((x) => E.fundraise(c, x, "donors"), "donors", { kind: "money" }, "coin")}><b>Big dollar fundraiser</b><span>1 day. {pct(c.bigShare)} of your money is $2,500 and up. A bad photo can hurt.</span></button>
                <button type="button" className="px-act" disabled={s.fatigue >= 3} onClick={() => run((x) => E.fundraise(c, x, "email"), "email", { kind: "money" }, "coin")}><b>Small dollar blast</b><span>No days. {pct(c.smallShare)} of your money is under $200; buzz pays.</span></button>
                <button type="button" className="px-act" disabled={s.days < 1} onClick={() => run((x) => E.media(c, x), "media")}><b>Media tour</b><span>1 day. Local TV and podcasts. Raises buzz.</span></button>
                {s.week <= s.dweek && s.debated == null ? <button type="button" className="px-act" disabled={s.days < 1} onClick={() => run((x) => E.debatePrep(c, x), "prep")}><b>Debate prep</b><span>1 day. Widens your delivery zone. Sessions: {s.prep}. Debate in week {s.dweek}.</span></button> : null}
                <button type="button" className="px-act" disabled={s.days < 1} onClick={() => run((x) => E.rest(x), "rest", undefined, "click")}><b>Day off</b><span>1 day. Restores energy. Below 30 the candidate slips.</span></button>
              </div>
            ) : null}
            {tab === "meet" ? (
              <div className="px-meets">
                {s.invites.length ? s.invites.map((m) => (
                  <button key={m.id} type="button" className="px-invite" disabled={s.days < 1} onClick={() => { setMeet(m); sfx("card"); }}>
                    <Portrait seed={m.seed} role={m.role} party={m.role === "chair" || m.role === "endorser" ? me.party : m.role === "mole" ? op.party : ""} size={48} />
                    <span><em>{ROLE_NAME[m.role]}{m.real ? " · Real" : ""}</em><b>{m.title}</b><small>{m.who}</small></span>
                  </button>
                )) : <p className="px-note">No more invitations this week. New ones come Monday.</p>}
                <p className="px-note">Each meeting costs a day. Some pay off in volunteers, money or endorsements; some leak.</p>
              </div>
            ) : null}
            {tab === "air" ? (
              <div className="px-air">
                <p className="px-note">Statewide TV runs about {E.usd(c.cost)} a week; this week stations charge {rate > 1 ? `${Math.round((rate - 1) * 100)}% more` : "the base rate"}. A normal campaign with your money runs about {E.usd(s.weekCash * E.SCHED[Math.min(E.WEEKS, s.week) - 1])} now. Booked: {E.usd(s.tvWeek)}.</p>
                <div className="px-chips">{(["positive", "contrast", "attack"] as const).map((t) => <button key={t} type="button" className={tone === t ? "on" : ""} onClick={() => setTone(t)}>{t === "positive" ? "Positive" : t === "contrast" ? "Contrast" : "Attack"}</button>)}</div>
                <div className="px-row"><span className="px-k">Air it</span>{tvSteps.map((v) => <button key={v} type="button" className="px-btn" disabled={s.cash < v} onClick={() => run((x) => E.buyTV(c, x, v, tone), "tv", { kind: "air", fs: r.counties.slice(0, 30).map((k) => k[0]) }, "airstrike")}>{E.usd(v)}</button>)}</div>
                {s.week < E.WEEKS ? <div className="px-row"><span className="px-k">Reserve</span>
                  <select className="px-sel" value={resW} onChange={(e) => setResW(Number(e.target.value))} aria-label="Week to reserve">{Array.from({ length: E.WEEKS - s.week }, (_, k) => s.week + 1 + k).map((w) => <option key={w} value={w}>Week {w}, saves {Math.round(((E.RATE[w - 1] ?? 1) - 1) * 100)}%</option>)}</select>
                  {tvSteps.slice(0, 3).map((v) => <button key={v} type="button" className="px-btn" disabled={s.cash < v} onClick={() => run((x) => E.reserveTV(c, x, Math.max(resW, s.week + 1), v, tone), "reserve", undefined, "coin")}>{E.usd(v)}</button>)}</div> : null}
                <span className="px-k">Targeted digital</span>
                <div className="px-row">
                  <select className="px-sel" value={dg} onChange={(e) => setDg(e.target.value)} aria-label="Voter group to target"><option value="">Pick a voter group</option>{digGroups.map((g) => <option key={g.dim + g.label} value={g.label}>{g.label}: {Math.round(g.share)}%, {Math.round(g.d)}D {Math.round(g.r)}R</option>)}</select>
                  {[100000, 250000].map((v) => <button key={v} type="button" className="px-btn" disabled={!dg || s.cash < v} onClick={() => run((x) => E.buyDigital(c, x, v, dg), "digital")}>{E.usd(v)}</button>)}
                </div>
                <p className="px-note">Attack ads hit hardest but can draw a fact check without opposition research. Outside groups add {E.usd(c.outMe)} a week for you, {E.usd(c.outOp)} for {sur(op.name)}.</p>
              </div>
            ) : null}
            {tab === "ground" ? (
              <div className="px-air">
                <div className="px-turnout">
                  <div><span className="px-k">Your base</span><Meter label="" v={s.enth[0]} tone="gold" /></div>
                  <div><span className="px-k">Their base, your read</span><Meter label="" v={Math.round(s.enth[1] / 10) * 10} tone="hot" /></div>
                  <div><span className="px-k">Ballots banked</span><Meter label="" v={s.banked * 100} tone="green" /></div>
                </div>
                <p className="px-note">Enthusiasm moves turnout on each side. Registration closes after week {E.REG_DEADLINE}; {s.regs.toLocaleString()} new voters so far. Early voting opens week {E.EARLY_FROM}, and banked ballots are safe from rain and late news.{r.earlyVote ? ` In real life ${r.earlyVote.ballots.toLocaleString()} ballots were cast in ${r.state} by ${r.earlyVote.date}.` : ""}</p>
                <button type="button" className="px-act wide" disabled={s.days < 1 || !s.offices.length} onClick={() => run((x) => E.canvass(c, x), "knock", s.offices[0] ? { f: s.offices[0], kind: "knock" } : undefined)}><b>Door knocking weekend</b><span>1 day. Volunteers knock in field office counties. {s.knocks.toLocaleString()} doors so far.{!s.offices.length ? " Open a field office first." : ""}</span></button>
                <div className="px-row"><span className="px-k">Turnout program</span>{[0.15, 0.4, 0.8].map((k) => { const v = Math.round((k * c.total) / 10000) * 10000; return <button key={k} type="button" className="px-btn" disabled={s.cash < v} onClick={() => run((x) => E.fundGotv(c, x, v), "gotv", undefined, "coin")}>{E.usd(v)}</button>; })}</div>
                <button type="button" className="px-act wide" disabled={s.lawyers} onClick={() => run((x) => E.hireLawyers(x), "lawyers", undefined, "coin")}><b>Voter protection team{s.lawyers ? ", hired" : ""}</b><span>$150K. Lawyers and poll watchers, so long lines in a big county on Election Day do not cost you.</span></button>
              </div>
            ) : null}
            {tab === "staff" ? (
              <div className="px-grid">
                <div className="px-act static"><b>Pollster</b><span>{s.staff.pollster ? `${E.POLLSTERS[s.staff.pollster]!.name}: a poll every week with regions, which sharpens your county read.` : "None. Your county read only comes from your ground team, and it goes stale."}</span>
                  <span className="px-row">{([1, 2, 3] as const).map((t) => <button key={t} type="button" className={cls("px-chipb", s.staff.pollster === t && "on")} onClick={() => run((x) => E.hire(c, x, "pollster", t), "pollster", undefined, "coin")}>{["C", "B", "A"][t - 1]} {E.usd(E.POLLSTERS[t]!.wk)}/wk</button>)}</span></div>
                {(Object.keys(E.STAFF_COST) as (keyof typeof E.STAFF_COST)[]).map((k) => (
                  <button key={k} type="button" className={cls("px-act", s.staff[k] && "done")} disabled={s.staff[k]} onClick={() => run((x) => E.hire(c, x, k), k, undefined, "coin")}><b>{E.STAFF_COST[k].name}{s.staff[k] ? ", hired" : ""}</b><span>{E.STAFF_COST[k].what} {E.usd(E.STAFF_COST[k].hire)}{E.STAFF_COST[k].wk ? ` plus ${E.usd(E.STAFF_COST[k].wk)}/wk` : ""}.</span></button>
                ))}
              </div>
            ) : null}
            {tab === "polls" ? (
              <div className="px-air">
                <PollChart s={s} me={me.name} op={op.name} />
                <ul className="px-plist">{[...s.polls].reverse().slice(0, 6).map((p, i) => <li key={i} className={p.internal ? "int" : ""}><span>{p.w === 0 ? "Start" : `W${p.w}`}</span><span>{p.src}</span><b className={p.m >= 0 ? "up" : "dn"}>{E.lead(p.m, sur(me.name), sur(op.name))}</b></li>)}</ul>
                <span className="px-k">Regional polls, $30K each</span>
                <div className="px-row wrap">{regs.map((g, k) => <button key={g.name} type="button" className="px-btn sm" onClick={() => run((x) => E.regionPoll(c, x, k), "region poll", { kind: "poll", fs: g.f }, "coin")}>{g.name}</button>)}</div>
              </div>
            ) : null}
            {tab === "intel" ? (
              <div className="px-air">
                {r.research?.summary ? <p className="px-note">{r.research.summary}</p> : null}
                {[me, op].map((x) => (
                  <div key={x.side} className="px-intel"><span className="px-k">{x === me ? "You" : "Them"}: {x.name}</span>
                    <ul>{x.intel.slice(0, 3).map((it, i) => <li key={i}>{it.l ? <b>{it.l}. </b> : null}{it.t} {it.u ? <a href={it.u} target="_blank" rel="noopener noreferrer">Source</a> : null}</li>)}</ul></div>
                ))}
                {(r.research?.ads ?? []).length ? <div className="px-intel"><span className="px-k">Real ads in this race</span><ul>{r.research!.ads.slice(0, 6).map((a, i) => <li key={i}><b>{a.by}</b>: {a.theme}</li>)}</ul></div> : null}
                <Link className="px-note" href={`/watchdog/war-room/${r.id}`}>This race in the War Room</Link>
              </div>
            ) : null}
            {tab === "log" ? <ul className="px-log">{[...s.log].reverse().slice(0, 40).map((l, i) => <li key={i} className={l.kind}><span>W{l.w}</span><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul> : null}
          </div>
        </section>
      </div>
      <div className="px-ticker" aria-hidden="true"><span className="lbl">On the wire</span><div className="run">{[...wire, ...ticker].concat([...wire, ...ticker]).map((t, i) => <span key={i}>{t}</span>)}</div></div>
      {toast ? <div key={toast.k} className={cls("px-toast", !toast.ok && "bad")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}

      {roll && !s.done && !week && !replay && !f72 ? <NewsRoll r={r} s={s} onDone={() => setRoll(false)} /> : null}
      {!roll && pend && !out && !meet && !week && !replay && !f72 ? (
        <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-ev-h">
          <div className={cls("px-card", "ev", pend.kind)}>
            <div className="px-evtags">
              <span className={cls("px-tag", pend.kind === "attack" ? "hot" : pend.kind === "flash" ? "news" : "")}>{pend.kind === "attack" ? "Incoming" : pend.kind === "opening" ? "Opportunity" : pend.kind === "flash" ? (pend.helps === "you" ? "Breaking, good news" : pend.helps === "them" ? "Breaking, bad news" : "Breaking") : pend.kind === "scenario" ? "Scenario" : pend.kind === "endorse" ? "Endorsement" : pend.kind === "quarter" ? "Deadline" : `Week ${s.week} card`}</span>
              {pend.real ? <span className="px-tag real">Real{pend.date ? `, ${pend.date}` : ""}</span> : null}
              {s.cur.length > 1 ? <span className="px-tag dim">{s.cur.length - 1} more</span> : null}
            </div>
            <h3 id="px-ev-h">{pend.title}</h3>
            <p><Type key={pend.id} text={pend.prompt} speed={12} /> {pend.src ? (pend.src.startsWith("/") ? <Link href={pend.src}>Read it</Link> : <a href={pend.src} target="_blank" rel="noopener noreferrer">Source</a>) : null}</p>
            {pend.opts.some((o) => o.st) ? (tests ? <p className="px-note">Your pollster tested the answers: bars show how each tested, with error.</p> : <button type="button" className="px-ghost" onClick={test} disabled={!s.staff.pollster}>Test the answers, $25K{!s.staff.pollster ? ": hire a pollster" : ""}</button>) : null}
            <div className="px-opts">
              {pend.opts.map((o, i) => {
                const blocked = (o.need === "oppo" && !s.staff.oppo) || (o.cash != null && s.cash < o.cash) || (o.days != null && s.days < o.days);
                const tv = tests?.[i];
                return (
                  <button key={i} type="button" className="px-opt" disabled={blocked} onClick={() => choose(i)}>
                    <b>{o.label}</b><span>{o.say}{o.cash ? ` ${E.usd(o.cash)}.` : ""}{o.days ? ` ${o.days} day.` : ""}{o.need === "oppo" && !s.staff.oppo ? " Needs opposition research." : ""}</span>
                    {tv != null && !Number.isNaN(tv) ? <span className="px-test"><i className={tv >= 0 ? "up" : "dn"} style={{ width: `${Math.min(50, Math.abs(tv) * 120)}%`, [tv >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /><em className={tv >= 0 ? "up" : "dn"}>{fxs(tv)}</em></span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
      {out ? (
        <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-out-h">
          <div className="px-card">
            <span className="px-tag">How it played</span>
            <h3 id="px-out-h">{out.ev.opts[out.choice].label}</h3>
            <div className={cls("px-big", out.o.fx >= 0 ? "up" : "dn")}><Roll v={out.o.fx} fmt={(x) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`} /><small>points</small></div>
            <p>{out.o.t}</p>
            {out.o.parts.length ? <Parts parts={out.o.parts} /> : null}
            <button type="button" className="px-btn go" onClick={() => { setOut(null); sfx("click"); }}>{s.cur.length ? "Next card" : "Back to work"}</button>
          </div>
        </div>
      ) : null}
      {meet ? <Meeting r={r} s={s} m={meet} onClose={() => setMeet(null)} onDone={(x, res) => { commit(x); setMeet(null); setToast({ t: res.caught ? (res.fx >= 0 ? "A lucky break." : "It leaked.") : "Meeting done.", ok: res.fx >= 0, k: Date.now() }); }} /> : null}
      {replay && week ? <OppReplay r={r} s={s} geo={geo} onDone={() => { setReplay(false); sfx("click"); }} /> : null}
      {!replay && week ? (() => {
        const na = E.polledAvg(s);
        return (
          <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-wk-h">
            <div className="px-card report">
              <span className="px-tag">{s.done ? "The polls are closed" : `Week ${s.week - 1} report`}</span>
              <h3 id="px-wk-h">{s.done ? "Election Day is here" : "The week in review"}</h3>
              <div className="px-deltas">
                <div><span>Poll avg</span><b className={na == null ? "" : na >= 0 ? "up" : "dn"}>{na == null ? "n/a" : E.lead(na, sur(me.name), sur(op.name))}</b>{na != null && week.before.avg != null ? <small className={na - week.before.avg >= 0 ? "up" : "dn"}>{fxs(na - week.before.avg)}</small> : null}</div>
                <div><span>Cash</span><b>{E.usd(s.cash)}</b><small className={s.cash - week.before.cash >= 0 ? "up" : "dn"}>{s.cash - week.before.cash >= 0 ? "+" : "-"}{E.usd(Math.abs(s.cash - week.before.cash))}</small></div>
                <div><span>Buzz</span><b>{Math.round(s.buzz)}</b><small className={s.buzz - week.before.buzz >= 0 ? "up" : "dn"}>{s.buzz - week.before.buzz >= 0 ? "+" : "-"}{Math.abs(Math.round(s.buzz - week.before.buzz))}</small></div>
                <div><span>Volunteers</span><b>{s.volunteers.toLocaleString()}</b><small className={s.volunteers - week.before.vol >= 0 ? "up" : "dn"}>{s.volunteers - week.before.vol >= 0 ? "+" : "-"}{Math.abs(s.volunteers - week.before.vol).toLocaleString()}</small></div>
              </div>
              <ul className="px-log">{week.items.map((l, i) => <li key={i} className={l.kind}><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
              <button type="button" className="px-btn go" onClick={() => { setWeek(null); if (s.done) onNight(); else { setRoll(true); sfx("bell"); } }}>{s.done ? "Watch the returns" : `On to week ${s.week}`}</button>
            </div>
          </div>
        );
      })() : null}
      {f72 ? <Final72 r={r} s={s} onDone={(x) => { setF72(false); const before = { avg, cash: x.cash, buzz: x.buzz, vol: x.volunteers }; const items = E.endWeek(c, x); commit(x); setWeek({ items, before }); }} /> : null}
    </div>
  );
}

// ============================================================ the app
export default function PlayApp({ idx }: { idx: PIndex }) {
  const [screen, setScreen] = useState<"title" | "lobby" | "intro" | "hq" | "debate" | "night">("title");
  const [race, setRace] = useState<E.RaceFile | null>(null);
  const [st, setSt] = useState<E.State | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [saved, setSaved] = useState<Save | null>(null);
  const [err, setErr] = useState("");
  const [imm, setImm] = useState(false);
  const [rolled, setRolled] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const geo = useMapGeo(paths);
  useEffect(() => { setSaved(load()); }, []);
  useEffect(() => { if (st) store({ s: st }); }, [st]);
  useEffect(() => { if (!imm) return; const o = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = o; }; }, [imm]);
  const goImm = (on: boolean) => {
    setImm(on);
    try { if (on && root.current?.requestFullscreen && !document.fullscreenElement) root.current.requestFullscreen().catch(() => {}); else if (!on && document.fullscreenElement) document.exitFullscreen().catch(() => {}); } catch { /* not allowed */ }
  };
  const loadPaths = (r: E.RaceFile) => { setPaths(null); fetch(`/forecast/states/${r.st}.json`).then((x) => x.json()).then((j) => setPaths(j.counties as CountyPath[])).catch(() => setPaths([])); };
  const start = (r: E.RaceFile, side: E.Side, d: E.Diff, seed?: number) => { setRace(r); loadPaths(r); setSt(E.newGame(r, side, d, seed)); setScreen("intro"); goImm(true); track("Play start", { race: r.id, side, diff: d }); };
  const resume = async () => {
    if (!saved) return;
    try { const r = (await fetch(`/play/r/${saved.s.race}.json`).then((x) => x.json())) as E.RaceFile; setRace(r); loadPaths(r); setSt(E.migrate(saved.s, r)); setScreen(saved.s.done ? "night" : "hq"); goImm(true); }
    catch { setErr("The saved campaign could not load."); }
  };
  const commit = useCallback((x: E.State) => setSt(x), []);
  const menu = () => { setScreen("lobby"); setSaved(load()); music("off"); };
  const sr = saved ? idx.races.find((r) => r.id === saved.s.race) : null;
  const meC = race && st ? race.cands[st.side === "D" ? 0 : 1] : null, opC = race && st ? race.cands[st.side === "D" ? 1 : 0] : null;
  return (
    <div ref={root} className={cls("px-app", imm && screen !== "title" && "imm")}>
      {err ? <p className="px-err" role="alert">{err}</p> : null}
      {screen === "title" ? <Title onGo={() => setScreen("lobby")} saved={!!(saved && sr && !saved.s.done)} onResume={resume} savedLabel={saved && sr ? `${sr.c[saved.s.side === "D" ? 0 : 1][0]}, week ${saved.s.week}` : ""} /> : null}
      {screen === "lobby" ? <Lobby idx={idx} onStart={start} /> : null}
      {screen === "intro" && race && st && meC && opC ? (
        <button type="button" className="px-cut intro" onClick={() => { setScreen("hq"); sfx("click"); }}>
          <div className="px-vsrow"><Portrait seed={seedOf(meC.name)} role="cand" party={meC.party} size={120} talking /><b className="px-vsb">VS</b><Portrait seed={seedOf(opC.name)} role="cand" party={opC.party} size={120} /></div>
          <span className="px-tag">Labor Day · September 7, 2026</span>
          <b className="px-cut-h">{meC.name}: {race.name}</b>
          <span><Type text={`You start at ${E.lead(E.margin(race, st), sur(meC.name), sur(opC.name))} with ${E.usd(st.cash)} in the bank, eight weeks, and a campaign bus. Your county map is only as good as your polling, so keep it fresh.`} /></span>
          <em>Click to begin</em>
        </button>
      ) : null}
      {screen === "hq" && race && st ? <HQ r={race} s={st} commit={commit} geo={geo} onNight={() => setScreen("night")} onDebate={() => setScreen("debate")} quit={() => { goImm(false); menu(); }} immersive={imm} toggleFull={() => goImm(!imm)} rolled={rolled} setRolled={setRolled} /> : null}
      {screen === "debate" && race && st ? <Debate r={race} s={st} onDone={(x) => { commit(x); setScreen("hq"); }} /> : null}
      {screen === "night" && race && st?.result ? <Night r={race} s={st} geo={geo} again={() => start(race, st.side, st.diff)} menu={() => { store(null); goImm(false); menu(); }} /> : null}
      {imm && screen !== "title" && screen !== "hq" ? <button type="button" className="px-exit" onClick={() => goImm(false)} aria-label="Leave full screen">WIN</button> : null}
    </div>
  );
}
