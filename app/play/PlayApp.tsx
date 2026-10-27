"use client";
// Campaign 2026, pixel edition. Pick a close Senate or governor race, pick a side, a year, a campaign length and a
// campaign manager, and run the race from summer or from Labor Day: work the counties from a campaign bus, meet the people who matter, fight the air war, build a real turnout
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
import Podcast from "./px/Podcast";
import PollChart from "./px/PollChart";
import * as N from "./net";
import { adviceFor, memoFor, mgrName, mgrSeed } from "./px/mgr";
import { Portrait, Type, Roll, cls, sur, fxs } from "./px/ui";
import { seedOf, partyCol } from "./px/sprites";
import { sfx, music, setSound, soundState, unlock } from "./px/sound";
import { spinChaos, chaos as chaosCards } from "./cards";
import { checkTrophies, saveTrophies, trophyCase, type Trophy } from "./achieve";
import { useTwitch, loadCfg, saveCfg, voteOf, isChaos, isHype, DEF_CFG, type StreamCfg, type ChatMsg } from "./stream";
import { RivalPanel, RivalMoveCard, ChatVote, CrisisClock, Breaking, isLoud, ChaosWheel, Splash, TrophyToasts, TrophyCase, ChatBox, Meters, StreamPane, RivalBadge, type SplashKind } from "./px/Stream";

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
  const [have, setHave] = useState<string[]>([]);
  useEffect(() => { setHave(trophyCase()); }, []);
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
        <p className="px-tag2">Eight to sixteen weeks. One race. Every vote is real data.</p>
        <div className="px-title-acts">
          <button type="button" className="px-press blink" onClick={() => { unlock(); sfx("coin"); onGo(); }}>Press start</button>
          {saved ? <button type="button" className="px-press ghost" onClick={() => { unlock(); sfx("click"); onResume(); }}>Continue: {savedLabel}</button> : null}
        </div>
        <ul className="px-feat" aria-label="What is new"><li>Rival war room</li><li>Crises</li><li>Chaos wheel</li><li>Twitch chat votes</li><li>Viral rallies</li><li>Hot streaks</li><li>Trophies</li><li>Debate stage</li><li>Long election night</li></ul>
        <TrophyCase have={have} />
      </div>
    </section>
  );
}

// ============================================================ lobby
function Bar({ v, max, label, val, tone }: { v: number; max: number; label: string; val: string; tone?: string }) {
  const n = Math.max(1, Math.min(10, Math.round((10 * v) / Math.max(1e-9, max))));
  return <div className="px-stat"><span>{label}</span><span className="px-pips">{Array.from({ length: 10 }, (_, i) => <i key={i} className={i < n ? cls("f", tone) : ""} />)}</span><b>{val}</b></div>;
}
function Lobby({ idx, onStart }: { idx: PIndex; onStart: (r: E.RaceFile, side: E.Side, d: E.Diff, seed?: number, len?: number, mgr?: E.Mgr) => void }) {
  const [len, setLen] = useState(8);
  const [mgr, setMgr] = useState<E.Mgr>("vet");
  const [office, setOffice] = useState<"all" | "senate" | "governor">("all");
  const [pick, setPick] = useState<string | null>(null);
  const [rf, setRf] = useState<E.RaceFile | null>(null);
  const [paths, setPaths] = useState<CountyPath[] | null>(null);
  const [side, setSide] = useState<E.Side | null>(null);
  const [diff, setDiff] = useState<E.Diff>("lean");
  const [seed, setSeed] = useState("");
  const step3 = useRef<HTMLElement>(null);
  useEffect(() => { if (side) step3.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, [side]);
  const go = () => { if (!rf || !side) return; unlock(); sfx("fanfare"); onStart(rf, side, diff, seed && /^\d+$/.test(seed) ? Number(seed) : undefined, len, mgr); };
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
                  <RivalBadge r={rf} side={sd} />
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
        <section className="px-step" ref={step3}>
          <div className="px-sh"><span className="px-n">3</span><h2>Choose the year you are running in</h2></div>
          <div className="px-diffs">
            {DIFFS.map((d, i) => (
              <button key={d} type="button" className={cls("px-diff", diff === d && "on")} aria-pressed={diff === d} onClick={() => { setDiff(d); sfx("click"); }}>
                <span className="px-pips">{[0, 1, 2, 3].map((j) => <i key={j} className={j <= i ? "f hot" : ""} />)}</span>
                <b>{E.DIFF[d].name}</b><small>{E.DIFF[d].blurb}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {race && rf && side ? (
        <section className="px-step">
          <div className="px-sh"><span className="px-n">4</span><h2>How long is your campaign?</h2></div>
          <div className="px-diffs len" role="radiogroup" aria-label="Campaign length">
            {E.LENGTHS.map((L) => (
              <button key={L.w} type="button" role="radio" aria-checked={len === L.w} className={cls("px-diff", len === L.w && "on")} onClick={() => { setLen(L.w); sfx("click"); }}>
                <span className="px-weeks" aria-hidden="true">{Array.from({ length: L.w }, (_, i) => <i key={i} className={i < L.w - 8 ? "su" : "fa"} />)}</span>
                <b>{L.w} weeks · {L.name}</b><small>{L.blurb}</small>
                <span className="px-tip" role="tooltip">{L.w === 8 ? "Starts Sep 8. Debate, early voting and the money deadline come fast." : `Starts ${E.weekLabel(9 - L.w).split(" to ")[0]}. Summer weeks: TV is cheap but voters are half listening, registration is open, door programs and fundraising build up for the fall. Starting cash is lower; you raise the rest.`}</span>
              </button>
            ))}
          </div>
          <div className="px-sh"><span className="px-n">5</span><h2>Hire your campaign manager</h2></div>
          <div className="px-mgrs" role="radiogroup" aria-label="Campaign manager">
            {(Object.keys(E.MGR) as E.Mgr[]).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={mgr === k} className={cls("px-mgr", mgr === k && "on")} onClick={() => { setMgr(k); sfx("card"); }}>
                <Portrait seed={mgrSeed(rf, k)} role="staff" party={rf.cands[side === "D" ? 0 : 1].party} size={72} talking={mgr === k} />
                <span><em>{E.MGR[k].title}</em><b>{mgrName(rf, k)}</b><small>{E.MGR[k].blurb}</small><small className="perk">{E.MGR[k].perk}</small></span>
              </button>
            ))}
          </div>
          <div className="px-go">
            <label className="px-seed" htmlFor="px-seed-in">Seed <input id="px-seed-in" inputMode="numeric" placeholder="random" value={seed} onChange={(e) => setSeed(e.target.value.replace(/\D/g, "").slice(0, 10))} /></label>
            <span className="px-note">Debate in week {E.debateWeek(rf) + len - 8}. Registration closes after week {E.REG_DEADLINE + len - 8}. Early voting opens week {E.EARLY_FROM + len - 8}. Every week has twelve half days: a rally takes a full day, call time or a town hall half of one.</span>
          </div>
        </section>
      ) : null}
      {race && rf && side ? (
        <div className="px-gobar" role="region" aria-label="Launch">
          <span><b>{rf.cands[side === "D" ? 0 : 1].name}</b> · {race.state} · {E.DIFF[diff].name} · {len} weeks · {E.MGR[mgr].title}</span>
          <button type="button" className="px-press" onClick={go}>Launch the campaign</button>
        </div>
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
      <span className="px-tag">Week {s.week} · {E.weekLabel(E.cal(s))}</span>
      <b className="px-cut-h">The news cycle</b>
      <span className={cls("px-slot", stop && "stop")}>{stop ? land : items[i % items.length]}</span>
      {stop ? <em>{flash ? (flash.helps === "you" ? "Breaking: good news for you" : flash.helps === "them" ? "Breaking: trouble" : "Breaking") : s.week === s.dweek ? "Debate week" : E.cal(s) >= E.EARLY_FROM ? "Early voting is open" : E.cal(s) <= 0 ? "Summer on the trail" : "The week begins"}</em> : <em>Rolling</em>}
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

// ============================================================ the campaign calendar and your campaign manager
function Calendar({ s }: { s: E.State }) {
  const L = E.lenOf(s);
  const marks = (w: number) => { const k = E.cal(s, w); return [
    k === -7 ? "Q2 reports public" : null,
    k <= 0 && k >= -3 ? "State fair season" : null,
    k === 1 ? "After Labor Day" : null,
    k <= E.REG_DEADLINE ? (k === E.REG_DEADLINE ? "Registration closes" : k <= 0 ? null : "Register voters") : null,
    k === 4 ? "Q3 money deadline" : null,
    w === s.dweek ? "Debate" : null,
    k >= E.EARLY_FROM ? (k === E.EARLY_FROM ? "Early voting opens" : "Early voting") : null,
    w === L ? "Election Day next" : null,
  ].filter(Boolean) as string[]; };
  return (
    <ol className={cls("px-cal", L > 8 && "long")} aria-label="The campaign calendar">
      {Array.from({ length: L }, (_, k) => k + 1).map((w) => (
        <li key={w} className={cls(w === s.week && "now", w < s.week && "past", w === s.dweek && "deb", E.cal(s, w) <= 0 && "su")}>
          <b>W{w}</b><span>{E.weekLabel(E.cal(s, w)).split(" to ")[0]}</span>{marks(w).slice(0, 2).map((m) => <em key={m}>{m}</em>)}
        </li>
      ))}
    </ol>
  );
}
function Advisor({ r, s, c }: { r: E.RaceFile; s: E.State; c: E.Ctx }) {
  const tip = adviceFor(r, s, c); const m = s.mgr ?? "vet";
  return (
    <div className="px-advisor">
      <Portrait seed={mgrSeed(r, m)} role="staff" party={c.me.party} size={64} talking />
      <div className="px-bubble"><span className="px-k">{mgrName(r, m)} · {E.MGR[m].title}</span><p><Type key={tip} text={tip} speed={14} sound={false} /></p><small>Click a county to send the bus there.</small></div>
    </div>
  );
}

// ============================================================ headquarters
type Tab = "trail" | "money" | "net" | "meet" | "air" | "ground" | "staff" | "polls" | "intel" | "log" | "stream";
const TABS: [Tab, string][] = [["trail", "Trail"], ["money", "Money"], ["net", "Network"], ["meet", "Meetings"], ["air", "Air war"], ["ground", "Field"], ["staff", "Staff"], ["polls", "Polls"], ["intel", "Intel"], ["log", "Wire"], ["stream", "Stream"]];
const H = (n: number) => E.halfTxt(n);
/** The week's time as twelve half day blocks, two to a day. */
function Days({ n }: { n: number }) {
  return <b className="px-days" aria-label={`${H(n)} left`}>{Array.from({ length: E.DAYS / 2 }, (_, d) => <span key={d}>{[0, 1].map((h) => <i key={h} className={d * 2 + h < n ? "f" : ""} />)}</span>)}</b>;
}

function HQ({ r, s, commit, geo, onNight, onDebate, quit, immersive, toggleFull, rolled, setRolled, clear, setClear }: { r: E.RaceFile; s: E.State; commit: (x: E.State) => void; geo: ReturnType<typeof useMapGeo>; onNight: () => void; onDebate: () => void; quit: () => void; immersive: boolean; toggleFull: () => void; rolled: number; setRolled: (w: number) => void; clear: boolean; setClear: (v: boolean) => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const [sel, setSel] = useState<string | null>(null);
  const [hov, setHov] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("trail");
  const [layer, setLayer] = useState<Layer>("read");
  const [names, setNames] = useState(true);
  const [busy, setBusyS] = useState(false);
  useEffect(() => { try { setBusyS(localStorage.getItem("opp_play_busy") === "1"); } catch { /* storage blocked */ } }, []);
  const setBusy = (v: boolean) => { setBusyS(v); try { localStorage.setItem("opp_play_busy", v ? "1" : "0"); } catch { /* storage blocked */ } };
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
  const L = E.lenOf(s), K = E.cal(s);
  const [resW, setResW] = useState(Math.min(L, s.week + 2));
  const [pod, setPod] = useState<E.Meet | null>(null);
  const [preg, setPreg] = useState(0);
  const [pkind, setPkind] = useState<"pers" | "gotv">("pers");
  const selfInfo = useMemo(() => E.selfCap(c), [c]);
  const selfSteps = E.selfSteps(c, s);
  const [more, setMore] = useState<string[]>([]);
  const [dg, setDg] = useState("");
  const [snd, setSnd] = useState(soundState());
  const fxId = useRef(1);
  // stream mode: config, the Twitch chat, the vote, the meters, the loud overlays
  const [cfg, setCfgS] = useState<StreamCfg>(DEF_CFG);
  useEffect(() => { setCfgS(loadCfg()); }, []);
  const setCfg = (x: StreamCfg) => { setCfgS(x); saveCfg(x); };
  const [vote, setVote] = useState<{ id: string; ends: number; total: number; tally: Record<string, number> } | null>(null);
  const [voted, setVoted] = useState<string[]>([]);
  const [chaosM, setChaosM] = useState(0);
  const [hype, setHype] = useState(0);
  const [brk, setBrk] = useState<E.Ev | null>(null);
  const [wheel, setWheel] = useState<{ titles: string[]; land: string } | null>(null);
  const [splash, setSplash] = useState<SplashKind | null>(null);
  const [clock, setClock] = useState<{ id: string; ends: number } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const seen = useRef(new Set<string>());
  const last = useRef<Record<string, number>>({});
  const voteRef = useRef(vote);
  useEffect(() => { voteRef.current = vote; }, [vote]);
  const onChat = useCallback((m: ChatMsg) => {
    const v = voteRef.current; const key = m.user.toLowerCase();
    if (v) { const k = voteOf(m.text, 9); if (k != null) { setVote((x) => (x ? { ...x, tally: { ...x.tally, [key]: k } } : x)); return; } }
    const t = Date.now();
    if (isChaos(m.text) && t - (last.current["c:" + key] ?? 0) > 20000) { last.current["c:" + key] = t; setChaosM((x) => Math.min(100, x + 10)); }
    else if (isHype(m.text) && t - (last.current["h:" + key] ?? 0) > 8000) { last.current["h:" + key] = t; setHype((x) => Math.min(100, x + 6)); }
  }, []);
  const tw = useTwitch(cfg.channel, cfg.on, onChat);
  useEffect(() => { if (!s.done && (s.evw < s.week || s.invw < s.week)) { const x = structuredClone(s); dealWeek(c, x); dealInvites(c, x); commit(x); } }, [s, c, commit]);
  useEffect(() => { music("trail"); }, []);
  const burst = (k: MapFx["kind"], f?: string, fs?: string[]) => { const id = fxId.current++; setFx((e) => [...e.filter((x) => performance.now() - x.t0 < 2500), { id, kind: k, f, fs, t0: performance.now() }]); };
  const run = (fn: (x: E.State) => E.ActResult, name?: string, at?: { f?: string; kind: MapFx["kind"]; fs?: string[] }, snd2: Parameters<typeof sfx>[0] = "good") => {
    const x = structuredClone(s); const res = fn(x);
    if (res.ok) { commit(x); if (res.big) setSplash(res.big); if (at) { burst(at.kind, at.f, at.fs); if (at.f && (at.kind === "rally" || at.kind === "hall" || at.kind === "reg")) setBus(at.f); } sfx(res.t.includes("Running on fumes") ? "bad" : snd2); }
    else sfx("buzz");
    setToast({ t: res.t, ok: res.ok, k: Date.now() }); if (res.ok && name) track("Play action", { a: name, race: r.id });
  };
  const ci = sel ? r.counties.findIndex((x) => x[0] === sel) : -1;
  const co = ci >= 0 ? r.counties[ci] : null;
  const rd = co ? E.readOf(s, co[0]) : null;
  const avg = E.polledAvg(s);
  const odds = E.winOdds(s);
  const mods = E.activeMods(s);
  const me = c.me, op = c.op;
  const pend = s.cur[0];
  const regs = useMemo(() => E.regionsOf(r), [r]);
  const regOfSel = co ? regs.findIndex((g) => g.f.includes(co[0])) : -1;
  const debateNow = s.week === s.dweek && s.debated == null && !s.used.includes("chair") && !s.cur.some((e) => e.kind === "chair");
  const rate = E.rateAt(K);
  const net = useMemo(() => N.networkOf(c, s), [c, s]);
  const tvSteps = [0.25, 0.5, 1, 2].map((k) => Math.round((k * c.cost) / 50000) * 50000).filter((v, i, a) => v > 0 && a.indexOf(v) === i);
  const digGroups = c.groups.filter((g) => !["Party ID", "2024 presidential vote", "Trump job approval", "Direction of the country", "Race and gender", "Race and education"].includes(g.dim) && g.share >= 5);
  const endWeek = () => {
    if (s.week >= L && !s.final) { setF72(true); return; }
    const before = { avg, cash: s.cash, buzz: s.buzz, vol: s.volunteers };
    const x = structuredClone(s); const items = E.endWeek(c, x); commit(x);
    setWeek({ items, before }); track("Play week", { race: r.id, week: s.week }); sfx("whoosh");
    if (!x.done) setReplay(true);
  };
  const choose = (i: number, chat = false) => { const x = structuredClone(s); const e = x.cur.shift()!; if (chat) x.chatN = (x.chatN ?? 0) + 1; const o = resolve(c, x, e, i); commit(x); setOut({ ev: e, o, choice: i }); setVote(null); setClock(null); sfx(o.fx > 0.03 ? "good" : o.fx < -0.03 ? "bad" : "click"); };
  const isBlocked = (o: E.Ev["opts"][number]) => { const dd = Math.round(((o.days ?? 0) + (o.out?.days ?? 0)) * 2); return (o.need === "oppo" && !s.staff.oppo) || (o.cash != null && s.cash < o.cash) || (o.out?.cash != null && o.out.cash < 0 && s.cash < -o.out.cash) || s.days < dd; };
  const modalBusy = !!(out || meet || pod || week || replay || f72 || roll || wheel || brk);
  const cardUp = !!pend && !modalBusy;
  const startVote = () => { if (!pend) return; setVote({ id: pend.id, ends: Date.now() + cfg.voteSec * 1000, total: cfg.voteSec, tally: {} }); setVoted((v) => [...v, pend.id]); setClock(null); sfx("bell"); };
  const counts = pend ? pend.opts.map((_, i) => Object.values(vote?.tally ?? {}).filter((k) => k === i).length) : [];
  const endVote = () => {
    if (!pend || !vote) { setVote(null); return; }
    const n = counts.reduce((a, b) => a + b, 0);
    let best = -1; pend.opts.forEach((o, i) => { if (!isBlocked(o) && (best < 0 || counts[i] > counts[best])) best = i; });
    if (!n || best < 0) { setVote(null); setToast({ t: "Chat was quiet. Your call.", ok: false, k: Date.now() }); return; }
    setToast({ t: `Chat picked: ${pend.opts[best].label}, ${counts[best]} of ${n} votes.`, ok: true, k: Date.now() });
    choose(best, true);
  };
  const canSpin = !pend && !modalBusy && !s.done && (s.chaosW ?? 0) < s.week;
  const spin = (free = false) => {
    if (pend || modalBusy || s.done) return;
    const x = structuredClone(s); const titles = chaosCards(c, x).map((e) => e.title); const e = spinChaos(c, x);
    if (!e) { setToast({ t: "The wheel is out of cards this campaign.", ok: false, k: Date.now() }); return; }
    if (!free) x.chaosW = x.week;
    seen.current.add(e.id); commit(x); setWheel({ titles, land: e.title }); track("Play chaos", { race: r.id, free });
  };
  // a tick for the clocks
  useEffect(() => { if (!vote && !clock) return; const id = window.setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, [vote, clock]);
  // loud cards get the BREAKING banner first
  useEffect(() => { if (pend && !roll && !out && !week && !replay && isLoud(pend.kind) && !seen.current.has(pend.id)) { seen.current.add(pend.id); setBrk(pend); } }, [pend, roll, out, week, replay]);
  // the crisis clock
  useEffect(() => { if (cardUp && pend!.kind === "crisis" && cfg.on && cfg.crisisSec > 0 && !vote && clock?.id !== pend!.id) setClock({ id: pend!.id, ends: Date.now() + cfg.crisisSec * 1000 }); }, [cardUp, pend, cfg.on, cfg.crisisSec, vote, clock]);
  useEffect(() => {
    if (clock && pend && clock.id === pend.id && cardUp && !vote && now >= clock.ends) {
      const i = pend.opts.findIndex((o) => !isBlocked(o)); setClock(null);
      if (i >= 0) { setToast({ t: "Too slow: the campaign put out a flat denial for you.", ok: false, k: Date.now() }); choose(i); }
    }
  });
  // the vote clock, and chat voting on every card when asked
  useEffect(() => { if (vote && now >= vote.ends) endVote(); });
  useEffect(() => { if (cardUp && cfg.on && cfg.auto && tw.status === "live" && !vote && pend && !voted.includes(pend.id)) startVote(); });
  useEffect(() => { if (vote && pend?.id !== vote.id) setVote(null); }, [vote, pend]);
  // keys 1 to 9 add a vote from the room while a vote is open
  useEffect(() => {
    if (!vote) return;
    const h = (e: KeyboardEvent) => { const k = Number(e.key) - 1; if (k >= 0 && k < (pend?.opts.length ?? 0) && !(e.target instanceof HTMLInputElement)) setVote((x) => (x ? { ...x, tally: { ...x.tally, ["room" + Math.random()]: k } } : x)); };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [vote, pend]);
  // the chat meters: a full chaos meter spins the wheel for free, a full hype train pays out once a week
  useEffect(() => { if (chaosM >= 100 && !pend && !modalBusy && !s.done) { setChaosM(0); spin(true); } });
  useEffect(() => {
    if (hype >= 100 && (s.hypeW ?? 0) < s.week && !s.done) {
      const x = structuredClone(s); const v = 60 + Math.round(x.volunteers * 0.04);
      x.buzz = Math.min(100, x.buzz + 6); x.volunteers += v; x.hypeW = x.week; x.hypeN = (x.hypeN ?? 0) + 1;
      x.log.push({ w: x.week, kind: "you", t: `Hype train: the live chat flooded in. Buzz up and ${v.toLocaleString()} new volunteers signed up.` });
      setHype(0); commit(x); setSplash("hype");
    }
  });
  const test = () => { const x = structuredClone(s); const r2 = testEvent(c, x, x.cur[0]); if (r2) { commit(x); sfx("coin"); } else setToast({ t: s.staff.pollster ? "Not enough cash to test." : "Hire a pollster to test messages.", ok: false, k: Date.now() }); };
  const tests = pend ? s.tests[pend.id] : undefined;
  const ticker = useMemo(() => [...(r.media ?? []).map((m) => `${m.who}: ${m.what}`), ...(r.research?.storylines ?? []).map((x) => `${x.date}: ${x.title}`)], [r]);
  const wire = [...s.log].reverse().slice(0, 8).map((l) => l.t);
  const hoverCo = hov ? r.counties.find((x) => x[0] === hov) : null; const hoverRd = hov ? E.readOf(s, hov) : null;
  const flipSnd = (k: "sfx" | "music") => { const n = { ...snd, [k]: !snd[k] }; setSnd(n); setSound(n); if (k === "music" && n.music) music("trail"); };
  return (
    <div className={cls("px-hq", clear && "clear")} data-phase={E.phaseOf(s)} style={{ "--px-me": partyCol(me.party), "--px-op": partyCol(op.party) } as React.CSSProperties}>
      <div className="px-atmo" aria-hidden="true" />
      <header className="px-hud">
        <div className={cls("px-id", me.party.toLowerCase())}>
          <Portrait seed={seedOf(me.name)} role="cand" party={me.party} size={40} />
          <div><span className="px-k">{r.name} · {E.DIFF[s.diff].name}</span><b>{me.name}</b></div>
        </div>
        <div className="px-hs"><span>Week</span><b>{Math.min(s.week, L)}/{L}</b><small>{E.weekLabel(E.cal(s, Math.min(s.week, L))).split(" to ")[0]}{K <= 0 ? " · summer" : ""}</small></div>
        <div className="px-hs"><span>Time left</span><Days n={s.days} /><small>{H(s.days)}</small></div>
        <div className="px-hs"><span>Cash</span><b className={s.cash < 0 ? "dn" : "cash"}><Roll v={s.cash} fmt={E.usd} /></b></div>
        <div className="px-hs"><span>Volunteers</span><b><Roll v={s.volunteers} /></b></div>
        <div className="px-hs meters"><Meter label="Energy" v={s.stamina} tone={s.stamina < 30 ? "hot" : "green"} /><Meter label="Base" v={s.enth[0]} tone="gold" /><Meter label="Buzz" v={s.buzz} tone="pink" /></div>
        <div className="px-hs"><span>Poll avg</span><b className={avg == null ? "" : avg >= 0 ? "up" : "dn"}>{avg == null ? "None" : E.lead(avg, sur(me.name), sur(op.name))}</b>{odds ? <small>{Math.round(odds.p * 100)}% to win, your read</small> : null}{(s.streak ?? 0) >= 2 ? <small className="px-streak hot">Hot streak · {s.streak} wk</small> : (s.streak ?? 0) <= -2 ? <small className="px-streak cold">Slump · {-(s.streak ?? 0)} wk</small> : null}</div>
        <div className="px-hacts">
          {debateNow ? <button type="button" className="px-press sm hot" onClick={() => { sfx("alarm"); onDebate(); }}>Debate night</button>
            : <button type="button" className="px-press sm" onClick={endWeek} disabled={!!pend}>{s.week >= L ? "Election eve" : "End week"}</button>}
          <button type="button" className="px-icon chaos" onClick={() => spin(false)} disabled={!canSpin} title={canSpin ? "Spin the chaos wheel: once a week" : pend ? "Answer the card first" : "Spun this week. A full chaos meter in chat spins it again."}>SPIN</button>
          <button type="button" className={cls("px-icon", cfg.on && "on live")} onClick={() => { setTab("stream"); sfx("click"); }} title="Stream mode and Twitch chat">{cfg.on ? (tw.status === "live" ? "LIVE" : "STRM") : "LIVE"}</button>
          <button type="button" className={cls("px-icon", clear && "on")} onClick={() => setClear(!clear)} aria-pressed={clear} title="Clear view: no scanlines or dither, higher contrast">{clear ? "CRT" : "CLR"}</button>
          <button type="button" className={cls("px-icon", !snd.sfx && "off")} onClick={() => flipSnd("sfx")} aria-label="Sound effects" title="Sound effects">SFX</button>
          <button type="button" className={cls("px-icon", !snd.music && "off")} onClick={() => flipSnd("music")} aria-label="Music" title="Music">MUS</button>
          <button type="button" className="px-icon" onClick={toggleFull} aria-label="Full screen" title="Full screen">{immersive ? "WIN" : "FULL"}</button>
          <button type="button" className="px-icon" onClick={quit} aria-label="Menu">MENU</button>
        </div>
      </header>
      <Calendar s={s} />
      <RivalPanel s={s} c={c} />
      {mods.length || (s.staff.oppo && !s.dumped) ? (
        <div className="px-world" aria-label="What is happening in the world">
          <span className="px-k">In the world</span>
          {mods.map((m) => <span key={m.id} className={cls("px-wchip", m.good ? "good" : m.nat && m.nat < 0 ? "bad" : "")} title={[m.econ && m.econ !== 1 ? `cost of living answers count ${m.econ > 1 ? "more" : "less"}` : "", m.tv && m.tv < 1 ? "ads reach fewer voters" : "", m.block ? "some counties in recovery" : "", m.fund && m.fund < 1 ? "donors are nervous" : ""].filter(Boolean).join("; ")}>{m.label}<em>{m.until - s.week + 1} wk</em></span>)}
          {s.staff.oppo && !s.dumped ? <span className="px-wchip file">Oppo file: {Math.round(s.dirt ?? 0)} wk of research</span> : null}
        </div>
      ) : null}

      <div className="px-main">
        <section className="px-mapw">
          <div className="px-mh">
            <b>{r.state}</b>
            <div className="px-chips" role="group" aria-label="Map layer">
              {([["read", "Your read"], ["regions", "Regions"], ["ground", "Ground game"], ["rival", "Their stops"]] as [Layer, string][]).map(([k, l]) => <button key={k} type="button" className={layer === k ? "on" : ""} aria-pressed={layer === k} onClick={() => { setLayer(k); sfx("click"); }}>{l}</button>)}
              <button type="button" className={names ? "on" : ""} aria-pressed={names} onClick={() => setNames((v) => !v)}>Names</button>
              <button type="button" className={busy ? "on" : ""} aria-pressed={busy} onClick={() => setBusy(!busy)} title="Show walking volunteers, every rival stop and the full effects">Busy map</button>
            </div>
          </div>
          <div className="px-mapbox">
            <PixelMap r={r} s={s} geo={geo} mode="plan" layer={layer} sel={sel} onSel={(f) => { setSel(f); sfx("click"); }} hover={hov} onHover={setHov} fx={fx} bus={bus} labels={names ? (busy ? 7 : 5) : 0} clear={clear} detail={busy ? "full" : "clean"} />
            {hoverCo && !co ? <div className="px-hover">{hoverCo[1]} · {hoverRd ? `${E.readLabel(hoverRd.est, hoverRd.sd)}, ${E.confLabel(hoverRd.sd).toLowerCase()}` : "no read"}</div> : null}
          </div>
          <div className="px-legend"><span><i className="me" />Leans you</span><span><i className="toss" />Toss up</span><span><i className="op" />Leans them</span><span><i className="fog" />{clear ? "Faded means a fuzzy read" : "Dither means a fuzzy read"}</span><span><i className="office" />Field office</span></div>
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
                {E.blockedBy(s, co[0]) ? <button type="button" className="px-btn relief" disabled={s.days < E.COST.rally || !!s.visits["relief:" + co[0]]} onClick={() => run((x) => E.reliefDay(c, x, co[0]), "relief", { f: co[0], kind: "hall" }, "good")}>Relief day<small>{s.visits["relief:" + co[0]] ? "done" : "1 day · in recovery"}</small></button> : null}
                <button type="button" className="px-btn" disabled={s.days < E.COST.rally} onClick={() => run((x) => E.rally(c, x, co[0]), "rally", { f: co[0], kind: "rally" }, "crowd")}>Bus tour rally<small>1 day · $35K</small></button>
                <button type="button" className="px-btn" disabled={s.days < E.COST.hall} onClick={() => run((x) => E.townHall(c, x, co[0]), "town hall", { f: co[0], kind: "hall" })}>Town hall<small>Half day · $12K</small></button>
                <button type="button" className="px-btn" disabled={s.offices.includes(co[0])} onClick={() => run((x) => E.openOffice(c, x, co[0]), "office", { f: co[0], kind: "office" }, "coin")}>Field office<small>$60K</small></button>
                <button type="button" className="px-btn" disabled={s.days < E.COST.reg || K > E.REG_DEADLINE} onClick={() => run((x) => E.regDrive(c, x, co[0]), "register", { f: co[0], kind: "reg" })}>Register voters<small>{K > E.REG_DEADLINE ? "closed" : "Half day · $15K"}</small></button>
                {regOfSel >= 0 ? <button type="button" className="px-btn" onClick={() => run((x) => E.regionPoll(c, x, regOfSel), "region poll", { kind: "poll", fs: regs[regOfSel].f }, "coin")}>Poll this region<small>$30K</small></button> : null}
              </div>
            </div>
          ) : <Advisor r={r} s={s} c={c} />}
        </section>

        <section className="px-side">
          <div className="px-tabs" role="tablist">
            {TABS.map(([k, l]) => <button key={k} role="tab" type="button" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); sfx("click"); }}>{l}{k === "meet" && s.invites.length ? <i className="px-badge">{s.invites.length}</i> : null}</button>)}
          </div>
          <div className="px-pane" key={tab}>
            {tab === "trail" ? (
              <div className="px-grid">
                <p className="px-note full">Pick a county on the map for rallies, town halls, offices and registration. Everything else is here and in the other tabs.{K <= 0 ? " Summer: voters are half listening, so persuasion counts about half; building money and field counts in full." : ""}</p>
                <button type="button" className="px-act" disabled={s.days < E.COST.call} onClick={() => run((x) => E.fundraise(c, x, "call"), "call", { kind: "money" }, "coin")}><b>Call time</b><span>Half day. About {E.usd(c.weekly * 0.38 * E.DIFF[s.diff].fund)}.</span></button>
                <button type="button" className="px-act" disabled={s.days < E.COST.media} onClick={() => run((x) => E.media(c, x), "media")}><b>Media hits</b><span>Half day. Local TV and radio. Raises buzz.</span></button>
                {s.week <= s.dweek && s.debated == null ? <button type="button" className="px-act" disabled={s.days < E.COST.prep} onClick={() => run((x) => E.debatePrep(c, x), "prep")}><b>Debate prep</b><span>1 day. Widens your delivery zone. Sessions: {s.prep}. Debate in week {s.dweek}.</span></button> : null}
                <button type="button" className="px-act" disabled={s.days < E.COST.nap} onClick={() => run((x) => E.rest(x, true), "nap", undefined, "click")}><b>Afternoon off</b><span>Half day. A little energy back.</span></button>
                <button type="button" className="px-act" disabled={s.days < E.COST.rest} onClick={() => run((x) => E.rest(x), "rest", undefined, "click")}><b>Day off</b><span>1 day. Restores energy. Below 30 the candidate slips.</span></button>
              </div>
            ) : null}
            {tab === "money" ? (
              <div className="px-grid">
                <div className="px-act static wide"><b>Raised {E.usd(s.raised)} · spent {E.usd(s.spent)}</b><span>Weekly money from your donor base runs about {E.usd(c.weekly * 0.55 * (s.jfc ? 1.15 : 1))}{s.jfc ? ", with the joint committee" : ""}. {pct(c.smallShare)} of your itemized money comes in gifts under $200 and {pct(c.bigShare)} in gifts of $2,500 and up.</span></div>
                <button type="button" className="px-act" disabled={s.days < E.COST.call} onClick={() => run((x) => E.fundraise(c, x, "call"), "call", { kind: "money" }, "coin")}><b>Call time</b><span>Half day. About {E.usd(c.weekly * 0.38 * E.DIFF[s.diff].fund)}.</span></button>
                <button type="button" className="px-act" disabled={s.fatigue >= 3} onClick={() => run((x) => E.fundraise(c, x, "email"), "email", { kind: "money" }, "coin")}><b>Small dollar blast</b><span>No time. Buzz pays; the list tires after three a week.</span></button>
                <button type="button" className="px-act" disabled={s.days < E.COST.virtual || (s.vfat ?? 0) >= 2} onClick={() => run((x) => E.fundraise(c, x, "virtual"), "virtual", { kind: "money" }, "coin")}><b>Video call fundraiser</b><span>Half day. Grassroots donors on a video call. Two a week at most.</span></button>
                <button type="button" className="px-act" disabled={s.days < E.COST.donors} onClick={() => run((x) => E.fundraise(c, x, "donors"), "donors", { kind: "money" }, "coin")}><b>Big dollar fundraiser</b><span>1 day. A bad photo can hurt with voters who find costs hard.</span></button>
                <button type="button" className="px-act" disabled={s.days < E.COST.celeb || s.week - (s.celebW ?? -9) < 3} onClick={() => run((x) => E.fundraise(c, x, "celeb"), "celeb", { kind: "money" }, "coin")}><b>Celebrity fundraiser</b><span>1 day. Big money and buzz; a leaked menu can sting. Every three weeks.</span></button>
                <button type="button" className="px-act" disabled={!!s.merch || s.cash < 25000} onClick={() => run((x) => E.openMerch(c, x), "merch", undefined, "coin")}><b>Merch store{s.merch ? ", open" : ""}</b><span>$25K once. Hats and yard signs earn a little each week, more with buzz.</span></button>
                <button type="button" className="px-act" disabled={!!s.jfc || s.days < E.COST.jfc} onClick={() => run((x) => E.setupJFC(c, x), "jfc", undefined, "coin")}><b>Joint fundraising committee{s.jfc ? ", running" : ""}</b><span>1 day, once. Big donors give one check split with the party; weekly money up 15%.</span></button>
                <div className="px-act static wide"><b>Write yourself a check</b><span>No time. Past $1 million it becomes a story about buying the seat. {selfInfo.why} You can put in up to {E.usd(selfInfo.cap)}{s.selfIn ? `; ${E.usd(s.selfIn)} in so far` : ""}.{me.worth?.src ? <> <a href={me.worth.src} target="_blank" rel="noopener noreferrer">Source</a></> : null}</span>
                  {selfSteps.length ? <span className="px-row wrap">{selfSteps.map((v) => <button key={v} type="button" className="px-btn sm" onClick={() => run((x) => E.selfFund(c, x, v), "self", { kind: "money" }, "coin")}>{E.usd(v)}</button>)}</span> : <span className="px-note">Tapped out.</span>}</div>
              </div>
            ) : null}
            {tab === "net" ? (
              <div className="px-net">
                <p className="px-note">Everyone here comes from the Watchdog&apos;s connections for {r.name}: who endorsed, funded and rallied for each side. Real entries link to sources. Each one can be worked once unless it says otherwise.</p>
                <div className="px-row"><span className="px-k">Redbox your allies</span>
                  {(["contrast", "positive"] as const).map((t) => <button key={t} type="button" className="px-btn sm" onClick={() => run((x) => N.sendRedbox(c, x, t), "redbox", undefined, "coin")}>{t === "contrast" ? "Hit their record" : "Push your plan"}</button>)}
                  <small className="px-note">A public box on your site telling super PACs what to run, the legal way to steer them. Allied ads hit harder for two weeks; once every three weeks.</small></div>
                {([["endorser", "Endorsers"], ["surrogate", "Surrogates"], ["donor", "Donors"], ["party", "The party"], ["group", "Allied groups"]] as [N.NetKind, string][]).map(([k, l]) => {
                  const all = net.mine.filter((x) => x.kind === k); if (!all.length) return null;
                  const xs = more.includes(k) ? all : all.slice(0, 5);
                  return (
                    <div key={k} className="px-netg"><span className="px-k">{l} · {all.length}</span>
                      <ul>{xs.map((it) => (
                        <li key={it.id} className={cls(it.used && "used")}><span className="who"><b>{it.name}</b>{it.real ? <em className="px-real">Real</em> : null}<small>{it.sub}</small></span>
                          <button type="button" className="px-btn sm" disabled={it.used} onClick={() => run((x) => N.workNet(c, x, it), "net " + k, undefined, "coin")}>{it.used ? (it.why ?? "Done") : it.act}<small>{it.cost}</small></button>
                          {it.src ? <a className="src" href={it.src} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${it.name}`}>src</a> : null}</li>
                      ))}</ul>{all.length > 5 ? <button type="button" className="px-ghost sm" onClick={() => setMore((m) => (m.includes(k) ? m.filter((y) => y !== k) : [...m, k]))}>{more.includes(k) ? "Show fewer" : `Show all ${all.length}`}</button> : null}</div>
                  );
                })}
                {net.theirs.length ? <div className="px-netg theirs"><span className="px-k">{op.name}&apos;s money</span>
                  <ul>{net.theirs.map((it) => (
                    <li key={it.id} className={cls(it.used && "used")}><span className="who"><b>{it.name}</b><em className="px-real">Real</em><small>{it.sub}</small></span>
                      <button type="button" className="px-btn sm hot" disabled={it.used || s.cash < 150000} onClick={() => run((x) => N.workNet(c, x, it), "net hit", undefined, "airstrike")}>{it.used ? "Done" : it.act}<small>{it.cost}</small></button>
                      {it.src ? <a className="src" href={it.src} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${it.name}`}>src</a> : null}</li>
                  ))}</ul></div> : null}
                {net.att.length ? <div className="px-netg"><span className="px-k">Who is watching this race</span>
                  <ul>{net.att.map((a, i) => <li key={i} className="att"><span className="who"><b>{a.who}</b><small>{a.role}{a.side === "D" ? ", left" : a.side === "R" ? ", right" : ""}: {a.notes[0]}</small></span>{a.src ? <a className="src" href={a.src} target="_blank" rel="noopener noreferrer" aria-label={`Source for ${a.who}`}>src</a> : null}</li>)}</ul>
                  <small className="px-note">Hosts on this list send show invitations to your Meetings tab.</small></div> : null}
              </div>
            ) : null}
            {tab === "meet" ? (
              <div className="px-meets">
                {s.invites.length ? s.invites.map((m) => (
                  <button key={m.id} type="button" className={cls("px-invite", m.pod && "pod")} disabled={s.days < (m.pod ? E.COST.podcast : 1)} onClick={() => { if (m.pod) setPod(m); else setMeet(m); sfx("card"); }}>
                    <Portrait seed={m.seed} role={m.role} party={m.pod ? (m.pod.lean === "O" ? "" : m.pod.lean) : m.role === "chair" || m.role === "endorser" ? me.party : m.role === "mole" ? op.party : ""} size={48} />
                    <span><em>{m.pod ? `On air · ${m.pod.lean === s.side ? "friendly" : m.pod.lean === "O" ? "new audience" : "hostile"}` : ROLE_NAME[m.role]}{m.real ? " · Real" : ""}</em><b>{m.title}</b><small>{m.who}</small></span>
                  </button>
                )) : <p className="px-note">No more invitations this week. New ones come Monday.</p>}
                <p className="px-note">A meeting usually takes half a day; a show takes a full one. Some pay off in volunteers, money or endorsements; some leak.</p>
              </div>
            ) : null}
            {tab === "air" ? (
              <div className="px-air">
                <p className="px-note">Statewide TV runs about {E.usd(c.cost)} a week; this week stations charge {rate > 1 ? `${Math.round((rate - 1) * 100)}% more` : rate < 1 ? "summer rates, 15% less, though half the voters are not watching" : "the base rate"}. A normal campaign with your money runs about {E.usd(s.weekCash * E.schedAt(K))} now. Booked: {E.usd(s.tvWeek)}.</p>
                <div className="px-chips">{(["positive", "contrast", "attack"] as const).map((t) => <button key={t} type="button" className={tone === t ? "on" : ""} onClick={() => setTone(t)}>{t === "positive" ? "Positive" : t === "contrast" ? "Contrast" : "Attack"}</button>)}</div>
                <div className="px-row"><span className="px-k">Air it</span>{tvSteps.map((v) => <button key={v} type="button" className="px-btn" disabled={s.cash < v} onClick={() => run((x) => E.buyTV(c, x, v, tone), "tv", { kind: "air", fs: r.counties.slice(0, 30).map((k) => k[0]) }, "airstrike")}>{E.usd(v)}</button>)}</div>
                {s.week < L ? <div className="px-row"><span className="px-k">Reserve</span>
                  <select className="px-sel" value={resW} onChange={(e) => setResW(Number(e.target.value))} aria-label="Week to reserve">{Array.from({ length: L - s.week }, (_, k) => s.week + 1 + k).map((w) => <option key={w} value={w}>Week {w}, saves {Math.max(0, Math.round((E.rateAt(E.cal(s, w)) / rate - 1) * 100))}%</option>)}</select>
                  {tvSteps.slice(0, 3).map((v) => <button key={v} type="button" className="px-btn" disabled={s.cash < v} onClick={() => run((x) => E.reserveTV(c, x, Math.max(resW, s.week + 1), v, tone), "reserve", undefined, "coin")}>{E.usd(v)}</button>)}</div> : null}
                <span className="px-k">Targeted digital</span>
                <div className="px-row">
                  <select className="px-sel" value={dg} onChange={(e) => setDg(e.target.value)} aria-label="Voter group to target"><option value="">Pick a voter group</option>{digGroups.map((g) => <option key={g.dim + g.label} value={g.label}>{g.label}: {Math.round(g.share)}%, {Math.round(g.d)}D {Math.round(g.r)}R</option>)}</select>
                  {[100000, 250000].map((v) => <button key={v} type="button" className="px-btn" disabled={!dg || s.cash < v} onClick={() => run((x) => E.buyDigital(c, x, v, dg), "digital")}>{E.usd(v)}</button>)}
                </div>
                <div className="px-act static wide"><b>The opposition file{s.dumped ? ", dropped" : ""}</b><span>{!s.staff.oppo ? "Hire an opposition research firm and it builds a file on " + op.name + " every week." : s.dumped ? "You used it. Every campaign gets one." : `${Math.round(s.dirt ?? 0)} weeks of research on ${op.name}. Drop it once: the bigger the file the harder it hits, and in the last three weeks they have no time to answer. Sometimes it turns out to be old news.`}</span>
                  {s.staff.oppo && !s.dumped ? <span className="px-row"><button type="button" className="px-btn hot" disabled={(s.dirt ?? 0) < 2 || s.cash < 200000} onClick={() => run((x) => E.dropOppo(c, x), "oppo drop", { kind: "air", fs: r.counties.slice(0, 30).map((k) => k[0]) }, "airstrike")}>Drop the file<small>$200K{(s.dirt ?? 0) < 2 ? " · needs 2 weeks" : ""}</small></button></span> : null}</div>
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
                <p className="px-note">Enthusiasm moves turnout on each side. Registration closes after week {E.REG_DEADLINE + L - 8}; {s.regs.toLocaleString()} new voters so far. Early voting opens week {E.EARLY_FROM + L - 8}, and banked ballots are safe from rain and late news.{r.earlyVote ? ` In real life ${r.earlyVote.ballots.toLocaleString()} ballots were cast in ${r.state} by ${r.earlyVote.date}.` : ""}</p>
                <span className="px-k">Door knocking programs · {(s.programs ?? []).length}/{E.maxPrograms(s)}</span>
                <p className="px-note">A program runs every week on its own: your volunteers, plus any paid crews, work one region. Persuasion talks to swing voters and pays most early; turnout chases your own voters and pays most once ballots go out. An office in the region nearly doubles volunteer doors. {(s.contacts ?? 0) > 0 ? `${Math.round(s.contacts ?? 0).toLocaleString()} conversations so far.` : ""}</p>
                <ul className="px-progs">{(s.programs ?? []).map((p, k) => { const y = E.programYield(c, s, p, (s.programs ?? []).length); return (
                  <li key={k} className={p.kind}><span className="who"><b>{regs[p.reg]?.name ?? "Region"}</b><em>{p.kind === "pers" ? "Persuasion" : "Turnout"}</em><small>{y.doors.toLocaleString()} doors, {y.talks.toLocaleString()} talks, about {Math.round(y.votes).toLocaleString()} net votes a week{y.office ? "" : " · no office here"}</small></span>
                    <span className="crews"><button type="button" className="px-btn sm" disabled={!p.crews} onClick={() => run((x) => E.setCrews(x, k, p.crews - 1), "crews", undefined, "click")}>-</button><b>{p.crews} crew{p.crews === 1 ? "" : "s"}</b><button type="button" className="px-btn sm" disabled={p.crews >= 8} onClick={() => run((x) => E.setCrews(x, k, p.crews + 1), "crews", undefined, "coin")}>+</button></span>
                    <button type="button" className="px-ghost sm" onClick={() => run((x) => E.dropProgram(x, k), "drop", undefined, "click")}>Stop</button></li>
                ); })}</ul>
                <div className="px-row wrap"><select className="px-sel" value={preg} onChange={(e) => setPreg(Number(e.target.value))} aria-label="Region for a new program">{regs.map((g, k) => <option key={g.name} value={k}>{g.name}</option>)}</select>
                  <div className="px-chips">{(["pers", "gotv"] as const).map((k) => <button key={k} type="button" className={pkind === k ? "on" : ""} onClick={() => setPkind(k)}>{k === "pers" ? "Persuasion" : "Turnout"}</button>)}</div>
                  <button type="button" className="px-btn" disabled={(s.programs ?? []).length >= E.maxPrograms(s) || s.cash < E.CREW.setup} onClick={() => run((x) => E.addProgram(c, x, preg, pkind), "program", { kind: "knock", fs: regs[preg]?.f }, "coin")}>Start program<small>$20K setup</small></button></div>
                <p className="px-note">Paid canvass crews: {E.CREW.doors.toLocaleString()} doors a week each for {E.usd(E.CREW.wk)}.</p>
                <button type="button" className="px-act wide" disabled={!!s.voterFile || s.cash < 40000} onClick={() => run((x) => E.buyVoterFile(x), "voter file", undefined, "coin")}><b>Voter file and canvass app{s.voterFile ? ", bought" : ""}</b><span>$40K. Better targets and more conversations per door for every program.</span></button>
                <button type="button" className="px-act wide" disabled={s.days < E.COST.canvass || !s.offices.length} onClick={() => run((x) => E.canvass(c, x), "knock", s.offices[0] ? { f: s.offices[0], kind: "knock" } : undefined)}><b>Knock doors with your volunteers</b><span>1 day of the candidate&apos;s time. A weekend blitz in field office counties. {s.knocks.toLocaleString()} doors so far.{!s.offices.length ? " Open a field office first." : ""}</span></button>
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
            {tab === "stream" ? <StreamPane cfg={cfg} setCfg={setCfg} status={tw.status} recent={tw.recent} chaos={chaosM} hype={hype} hypeUsed={(s.hypeW ?? 0) >= s.week} canSpin={canSpin} spin={() => spin(false)} /> : null}
            {tab === "log" ? <ul className="px-log">{[...s.log].reverse().slice(0, 40).map((l, i) => <li key={i} className={l.kind}><span>W{l.w}</span><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul> : null}
          </div>
        </section>
      </div>
      <div className="px-ticker" aria-hidden="true"><span className="lbl">On the wire</span><div className="run">{[...wire, ...ticker].concat([...wire, ...ticker]).map((t, i) => <span key={i}>{t}</span>)}</div></div>
      {toast ? <div key={toast.k} className={cls("px-toast", !toast.ok && "bad")} role="status" onAnimationEnd={() => setToast(null)}>{toast.t}</div> : null}
      {cfg.on && cfg.chatBox && cfg.channel ? <div className="px-chatdock"><ChatBox recent={tw.recent} status={tw.status} channel={cfg.channel} /><Meters chaos={chaosM} hype={hype} hypeUsed={(s.hypeW ?? 0) >= s.week} /></div> : null}
      {splash ? <Splash kind={splash} onDone={() => setSplash(null)} /> : null}
      {brk ? <Breaking ev={brk} onDone={() => setBrk(null)} /> : null}
      {wheel ? <ChaosWheel titles={wheel.titles} land={wheel.land} onDone={() => setWheel(null)} /> : null}

      {roll && !s.done && !week && !replay && !f72 ? <NewsRoll r={r} s={s} onDone={() => setRoll(false)} /> : null}
      {cardUp ? (
        <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-ev-h">
          <div className={cls("px-card", "ev", pend.kind)}>
            <div className="px-evtags">
              <span className={cls("px-tag", pend.kind === "attack" || pend.kind === "fringe" || pend.kind === "osurprise" || pend.kind === "crisis" ? "hot" : pend.kind === "chaos" ? "chaos" : pend.kind === "shock" ? "news" : pend.kind === "flash" ? "news" : "")}>{pend.kind === "attack" ? "Incoming" : pend.kind === "opening" ? "Opportunity" : pend.kind === "flash" ? (pend.helps === "you" ? "Breaking, good news" : pend.helps === "them" ? "Breaking, bad news" : "Breaking") : pend.kind === "scenario" ? "Scenario" : pend.kind === "fringe" ? "An unwanted fan" : pend.kind === "shock" ? "The world moves" : pend.kind === "osurprise" ? "October surprise" : pend.kind === "star" ? "Celebrity" : pend.kind === "endorse" ? "Endorsement" : pend.kind === "quarter" ? "Deadline" : pend.kind === "crisis" ? "Crisis" : pend.kind === "chaos" ? "Chaos wheel" : `Week ${s.week} card`}</span>
              {pend.real ? <span className="px-tag real">Real{pend.date ? `, ${pend.date}` : ""}</span> : null}
              {s.cur.length > 1 ? <span className="px-tag dim">{s.cur.length - 1} more</span> : null}
            </div>
            <h3 id="px-ev-h">{pend.title}</h3>
            {pend.mod ? <p className="px-modnote">Whatever you say, for the next {Math.max(1, (E.activeMods(s).find((m) => m.id === pend.mod!.id)?.until ?? s.week) - s.week + 1)} week{(E.activeMods(s).find((m) => m.id === pend.mod!.id)?.until ?? s.week) > s.week ? "s" : ""}: {[pend.mod.block ? "rallies in the hit counties are off" : "", pend.mod.tv && pend.mod.tv < 1 ? "ads reach fewer voters" : "", pend.mod.econ && pend.mod.econ > 1 ? "cost of living answers count more" : "", pend.mod.fund && pend.mod.fund < 1 ? "donors give less" : "", pend.mod.nat ? (pend.mod.nat > 0 ? "the national mood drifts your way" : "the national mood drifts against you") : "", pend.mod.enth ? "turnout enthusiasm shifts" : ""].filter(Boolean).join(", ") || "the race feels it"}.</p> : null}
            <p><Type key={pend.id} text={pend.prompt} speed={12} /> {pend.src ? (pend.src.startsWith("/") ? <Link href={pend.src}>Read it</Link> : <a href={pend.src} target="_blank" rel="noopener noreferrer">Source</a>) : null}</p>
            {pend.opts.some((o) => o.st) ? (tests ? <p className="px-note">Your pollster tested the answers: bars show how each tested, with error.</p> : <button type="button" className="px-ghost" onClick={test} disabled={!s.staff.pollster}>Test the answers, $25K{!s.staff.pollster ? ": hire a pollster" : ""}</button>) : null}
            {clock && clock.id === pend.id && !vote ? <CrisisClock left={Math.max(0, Math.ceil((clock.ends - now) / 1000))} total={cfg.crisisSec} /> : null}
            {cfg.on ? (vote && vote.id === pend.id
              ? <ChatVote labels={pend.opts.map((o) => o.label)} blocked={pend.opts.map(isBlocked)} counts={counts} left={Math.max(0, Math.ceil((vote.ends - now) / 1000))} total={vote.total} onEnd={endVote} />
              : <button type="button" className="px-ghost chatgo" onClick={startVote}>Let chat decide · {cfg.voteSec}s{tw.status !== "live" ? " · chat not connected, keys 1 to 4 vote" : ""}</button>) : null}
            <div className="px-opts">
              {pend.opts.map((o, i) => {
                const dd = Math.round(((o.days ?? 0) + (o.out?.days ?? 0)) * 2);
                const blocked = isBlocked(o);
                const tv = tests?.[i];
                return (
                  <button key={i} type="button" className={cls("px-opt", vote && vote.id === pend.id && counts[i] === Math.max(...counts) && counts[i] > 0 && "lead")} disabled={blocked} onClick={() => choose(i)}>
                    <b>{cfg.on ? <i className="px-num">{i + 1}</i> : null}{o.label}</b><span>{o.say}{o.cash ? ` ${E.usd(o.cash)}.` : ""}{o.out?.cash != null && o.out.cash < 0 ? ` ${E.usd(-o.out.cash)}.` : ""}{dd ? ` ${H(dd)}.` : ""}{o.need === "oppo" && !s.staff.oppo ? " Needs opposition research." : ""}</span>
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
      {pod ? <Podcast r={r} s={s} m={pod} onClose={() => setPod(null)} onDone={(x, f) => { commit(x); setPod(null); setToast({ t: f >= 0 ? "Good show." : "Rough show.", ok: f >= 0, k: Date.now() }); }} /> : null}
      {meet ? <Meeting r={r} s={s} m={meet} onClose={() => setMeet(null)} onDone={(x, res) => { commit(x); setMeet(null); setToast({ t: res.caught ? (res.fx >= 0 ? "A lucky break." : "It leaked.") : "Meeting done.", ok: res.fx >= 0, k: Date.now() }); }} /> : null}
      {replay && week ? <OppReplay r={r} s={s} geo={geo} onDone={() => { setReplay(false); sfx("click"); }} /> : null}
      {!replay && week ? (() => {
        const na = E.polledAvg(s);
        return (
          <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-wk-h">
            <div className="px-card report">
              <span className="px-tag">{s.done ? "The polls are closed" : `Week ${s.week - 1} report`}</span>
              <h3 id="px-wk-h">{s.done ? "Election Day is here" : "The week in review"}</h3>
              <div className="px-wrep"><div className="px-wrep-l">
              <RivalMoveCard s={s} c={c} />
              <div className="px-deltas">
                <div><span>Poll avg</span><b className={na == null ? "" : na >= 0 ? "up" : "dn"}>{na == null ? "n/a" : E.lead(na, sur(me.name), sur(op.name))}</b>{na != null && week.before.avg != null ? <small className={na - week.before.avg >= 0 ? "up" : "dn"}>{fxs(na - week.before.avg)}</small> : null}</div>
                <div><span>Cash</span><b>{E.usd(s.cash)}</b><small className={s.cash - week.before.cash >= 0 ? "up" : "dn"}>{s.cash - week.before.cash >= 0 ? "+" : "-"}{E.usd(Math.abs(s.cash - week.before.cash))}</small></div>
                <div><span>Buzz</span><b>{Math.round(s.buzz)}</b><small className={s.buzz - week.before.buzz >= 0 ? "up" : "dn"}>{s.buzz - week.before.buzz >= 0 ? "+" : "-"}{Math.abs(Math.round(s.buzz - week.before.buzz))}</small></div>
                <div><span>Volunteers</span><b>{s.volunteers.toLocaleString()}</b><small className={s.volunteers - week.before.vol >= 0 ? "up" : "dn"}>{s.volunteers - week.before.vol >= 0 ? "+" : "-"}{Math.abs(s.volunteers - week.before.vol).toLocaleString()}</small></div>
              </div>
              {!s.done && s.polls.length > 1 ? <PollChart s={s} me={me.name} op={op.name} compact /> : null}
              </div><div className="px-wrep-r">
              {!s.done ? <div className="px-memo"><Portrait seed={mgrSeed(r, s.mgr ?? "vet")} role="staff" party={me.party} size={48} talking /><p><span className="px-k">Memo from {mgrName(r, s.mgr ?? "vet")}</span>{memoFor(s, week.before, na)}</p></div> : null}
              <ul className="px-log">{week.items.filter((l) => !(l.t.startsWith("Rival move") && s.rival?.moves.at(-1)?.w === s.week - 1)).map((l, i) => <li key={i} className={l.kind}><p>{l.t}</p>{l.fx != null && Math.abs(l.fx) >= 0.01 ? <b className={l.fx >= 0 ? "up" : "dn"}>{fxs(l.fx)}</b> : null}</li>)}</ul>
              </div></div>
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
  const [clear, setClearS] = useState(false);
  useEffect(() => { try { setClearS(localStorage.getItem("opp_play_clear") === "1"); } catch { /* storage blocked */ } }, []);
  const setClear = (v: boolean) => { setClearS(v); try { localStorage.setItem("opp_play_clear", v ? "1" : "0"); } catch { /* storage blocked */ } };
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
  const start = (r: E.RaceFile, side: E.Side, d: E.Diff, seed?: number, len = 8, mgr: E.Mgr = "vet") => { setRace(r); loadPaths(r); setRolled(0); setSt(E.newGame(r, side, d, seed, len, mgr)); setScreen("intro"); goImm(true); track("Play start", { race: r.id, side, diff: d, len }); };
  const resume = async () => {
    if (!saved) return;
    try { const r = (await fetch(`/play/r/${saved.s.race}.json`).then((x) => x.json())) as E.RaceFile; setRace(r); loadPaths(r); setSt(E.migrate(saved.s, r)); setScreen(saved.s.done ? "night" : "hq"); goImm(true); }
    catch { setErr("The saved campaign could not load."); }
  };
  const raceRef = useRef<E.RaceFile | null>(null);
  useEffect(() => { raceRef.current = race; }, [race]);
  const [troph, setTroph] = useState<Trophy[]>([]);
  const commit = useCallback((x: E.State) => {
    const rr = raceRef.current;
    if (rr) { const got = checkTrophies(x, rr); if (got.length) { saveTrophies(got.map((t) => t.id)); setTroph((q) => [...q, ...got]); got.forEach((t) => track("Play trophy", { t: t.id, race: rr.id })); } }
    setSt(x);
  }, []);
  const menu = () => { setScreen("lobby"); setSaved(load()); music("off"); };
  const sr = saved ? idx.races.find((r) => r.id === saved.s.race) : null;
  const meC = race && st ? race.cands[st.side === "D" ? 0 : 1] : null, opC = race && st ? race.cands[st.side === "D" ? 1 : 0] : null;
  return (
    <div ref={root} className={cls("px-app", imm && screen !== "title" && "imm", clear && "clear")}>
      {err ? <p className="px-err" role="alert">{err}</p> : null}
      {screen === "title" ? <Title onGo={() => setScreen("lobby")} saved={!!(saved && sr)} onResume={resume} savedLabel={saved && sr ? (saved.s.done ? `rewatch ${sr.state} election night` : `${sr.c[saved.s.side === "D" ? 0 : 1][0]}, week ${saved.s.week} of ${saved.s.len ?? 8}`) : ""} /> : null}
      {screen === "lobby" ? <Lobby idx={idx} onStart={start} /> : null}
      {screen === "intro" && race && st && meC && opC ? (
        <button type="button" className="px-cut intro" onClick={() => { setScreen("hq"); sfx("click"); }}>
          <div className="px-vsrow"><Portrait seed={seedOf(meC.name)} role="cand" party={meC.party} size={120} talking /><b className="px-vsb">VS</b><Portrait seed={seedOf(opC.name)} role="cand" party={opC.party} size={120} /></div>
          <span className="px-tag">{E.lenOf(st) === 8 ? "Labor Day · September 7, 2026" : `Summer · week of ${E.weekLabel(E.cal(st)).split(" to ")[0]}, 2026`}</span>
          <b className="px-cut-h">{meC.name}: {race.name}</b>
          <span><Type text={`You start at ${E.lead(E.margin(race, st), sur(meC.name), sur(opC.name))} with ${E.usd(st.cash)} in the bank, ${E.lenOf(st)} weeks, a campaign bus and ${mgrName(race, st.mgr ?? "vet")} running the show. ${E.lenOf(st) > 8 ? "Summer is for building: money, staff, offices and door knocking crews. " : ""}Your county map is only as good as your polling, so keep it fresh.`} /></span>
          <RivalBadge r={race} side={st.side} />
          <em>Click to begin</em>
        </button>
      ) : null}
      {screen === "hq" && race && st ? <HQ r={race} s={st} commit={commit} geo={geo} onNight={() => setScreen("night")} onDebate={() => setScreen("debate")} quit={() => { goImm(false); menu(); }} immersive={imm} toggleFull={() => goImm(!imm)} rolled={rolled} setRolled={setRolled} clear={clear} setClear={setClear} /> : null}
      {screen === "debate" && race && st ? <Debate r={race} s={st} onDone={(x) => { commit(x); setScreen("hq"); }} /> : null}
      {screen === "night" && race && st?.result ? <Night r={race} s={st} geo={geo} again={() => start(race, st.side, st.diff, undefined, st.len ?? 8, st.mgr ?? "vet")} menu={() => { store(null); goImm(false); menu(); }} /> : null}
      <TrophyToasts list={troph} onDone={(id) => setTroph((q) => q.filter((t) => t.id !== id))} />
      {imm && screen !== "title" && screen !== "hq" ? <button type="button" className="px-exit" onClick={() => goImm(false)} aria-label="Leave full screen">WIN</button> : null}
    </div>
  );
}
