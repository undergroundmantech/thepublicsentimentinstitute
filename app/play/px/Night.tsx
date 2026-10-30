"use client";
// Election night, the long version. The clock runs from poll closing past midnight. Votes come in batches: early and
// mail ballots, Election Day votes, and late mail, each county on its own schedule, so the lead can swing. A needle
// guesses where it ends up, an anchor calls the race when it is sure, and your war room reacts to every drop.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { raceHref } from "@/app/lib/opp";
import * as E from "../engine";
import PixelMap, { type useMapGeo } from "./PixelMap";
import { figure, paintGrid, partyCol, PAL, seedOf } from "./sprites";
import { sfx, music } from "./sound";
import { Roll, cls, sur, Portrait } from "./ui";
import { ev as track } from "@/app/lib/ev";

type Geo = ReturnType<typeof useMapGeo>;
type Feed = { k: number; t: string; tone?: "up" | "dn" | "hot" | "call" };
const KIND = ["early and mail ballots", "Election Day votes", "late mail ballots"];
const PHI = (z: number) => 1 / (1 + Math.exp(-1.702 * z));

export function achievements(r: E.RaceFile, s: E.State, call?: { me: boolean; tick: number } | null, calledAt?: number | null) {
  const res = s.result!; const c = E.ctx(r, s.side);
  const flips = res.counties.filter((x) => { const co = r.counties.find((k) => k[0] === x.f); return co && co[6] != null && x.m > 0 && c.sign * co[6] < 0; }).length;
  const odds = s.side === "R" ? r.est.prob : 1 - r.est.prob;
  const list: [string, string, boolean][] = [
    ["Underdog", "Win a race the forecast gave you under 35 percent", res.win && odds < 0.35],
    ["Comeback kid", "Win after trailing in the polls in October", res.win && s.low < 0],
    ["Landslide", "Win by 10 or more", res.m >= 10],
    ["Photo finish", "Finish within half a point", Math.abs(res.m) < 0.5],
    ["Flipper", "Win 3 counties that voted the other way for president", flips >= 3],
    ["Shoe leather", "Visit 15 counties", Object.keys(s.visits).filter((k) => !k.startsWith("reg:")).length >= 15],
    ["Door to door", "Knock 100,000 doors", s.knocks >= 100000],
    ["Registrar", "Register 10,000 new voters", s.regs >= 10000],
    ["Debate champ", "Win the debate", (s.debated ?? -1) > 0],
    ["Zinger", "Try a zinger on the debate stage", s.zingers > 0],
    ["Iron candidate", "Never take a day off", s.rested === 0],
    ["Coalition builder", "Meet 8 people who matter", s.met.length >= 8],
    ["War chest", "Raise $10 million in the game", s.raised >= 1e7],
    ["Beat the polls", "Win when your own poll average had you losing", res.win && res.pollAvg != null && res.pollAvg < 0],
    ["Storm chaser", "Spend a relief day in a county hit by disaster", Object.keys(s.visits).some((k) => k.startsWith("relief:"))],
    ["The file", "Drop your opposition file on the other side", !!s.dumped],
    ["Weathered it", "Win after an October surprise", res.win && s.used.includes("osurprise")],
    ["Ground war", "Have 50,000 real conversations at the door", (s.contacts ?? 0) >= 50000],
    ["Bootstrapped", "Win without writing yourself a check", res.win && !(s.selfIn ?? 0)],
    ["Called it", "Call the race yourself before the decision desk, and get it right", !!call && call.me === res.win && call.tick < (calledAt ?? 1e9)],
    ["Dewey defeats Truman", "Call the race yourself and get it wrong", !!call && call.me !== res.win],
    ["Beat the market", "Win when Kalshi opened you under 35 cents", res.win && !!s.mkt && s.mkt.open < 0.35],
  ];
  return list.map(([n, d, ok]) => ({ n, d, ok }));
}

export default function Night({ r, s, geo, again, menu }: { r: E.RaceFile; s: E.State; geo: Geo; again: () => void; menu: () => void }) {
  const res = s.result!;
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const T = res.ticks ?? E.NIGHT_TICKS; const B = useMemo(() => res.batches ?? [], [res.batches]);
  const tot = res.turnout ?? res.counties.reduce((a, x) => a + x.t, 0);
  const [tick, setTick] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [feed, setFeed] = useState<Feed[]>([]);
  const [speech, setSpeech] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // calling the race yourself, before the decision desk does
  const [myCall, setMyCall] = useState<{ me: boolean; tick: number; rep: number } | null>(null);
  const mood = useRef(0);
  const live = useRef(0.5);
  // cumulative tallies by tick
  const cum = useMemo(() => {
    const me = new Float64Array(T + 1), op = new Float64Array(T + 1); let a = 0, b = 0, j = 0;
    for (let t = 0; t <= T; t++) { while (j < B.length && B[j][0] <= t) { a += B[j][2]; b += B[j][3]; j++; } me[t] = a; op[t] = b; }
    return { me, op };
  }, [B, T]);
  // each county's final count, and what is in so far: [you, them, early and mail in, Election Day in, late mail in]
  const finals = useMemo(() => { const f = new Map<number, [number, number]>(); for (const b of B) { const v = f.get(b[1]) ?? [0, 0]; v[0] += b[2]; v[1] += b[3]; f.set(b[1], v); } return f; }, [B]);
  const { county, inc } = useMemo(() => {
    const m = new Map<string, number>(); const acc = new Map<number, number[]>();
    for (const b of B) { if (b[0] > tick) break; const v = acc.get(b[1]) ?? [0, 0, 0, 0, 0]; v[0] += b[2]; v[1] += b[3]; v[2 + b[4]] += b[2] + b[3]; acc.set(b[1], v); }
    for (const [i, v] of acc) if (v[0] + v[1] > 0) m.set(r.counties[i][0], (100 * (v[0] - v[1])) / (v[0] + v[1]));
    return { county: m, inc: acc };
  }, [B, tick, r.counties]);
  const flash = useMemo(() => [...new Set(B.filter((b) => b[0] <= tick && b[0] > tick - 2).map((b) => r.counties[b[1]][0]))], [B, tick, r.counties]);
  const [hov, setHov] = useState<string | null>(null);
  const [pin, setPin] = useState<string | null>(null);
  const focus = hov ?? pin;
  // the tooltip rides next to the mouse; a pinned county keeps it where you clicked
  type At = { x: number; y: number; w: number; h: number };
  const [mp, setMp] = useState<At | null>(null);
  const [pinAt, setPinAt] = useState<At | null>(null);
  const at = hov && mp ? mp : pin ? pinAt : null;
  const tipStyle = at ? ({ left: at.x, top: at.y, transform: `translate(${at.x > at.w * 0.55 ? "calc(-100% - 18px)" : "18px"}, ${at.y > at.h * 0.5 ? "calc(-100% - 14px)" : "14px"})` } as React.CSSProperties) : undefined;
  const fi = focus ? r.counties.findIndex((x) => x[0] === focus) : -1;
  // where the vote still out is: counties that lean each way by the 2024 presidential vote, as analysts would read it
  const out = useMemo(() => {
    let me = 0, op = 0;
    finals.forEach((v, i) => { const got = inc.get(i); const rem = v[0] + v[1] - (got ? got[0] + got[1] : 0); if (rem <= 0) return; const p24 = r.counties[i][6] ?? 0; if (c.sign * p24 >= 0) me += rem; else op += rem; });
    return { me, op };
  }, [finals, inc, r.counties, c.sign]);
  const keys = useMemo(() => [...r.counties.keys()].sort((a, b) => r.counties[b][5] - r.counties[a][5]).slice(0, 6), [r.counties]);
  const exit = useMemo(() => { let h = seedOf("exit" + r.id + s.seed); h = Math.sin(h) * 10000; const e = (h - Math.floor(h) - 0.5) * 6; const two = (100 * res.me) / Math.max(1, res.me + res.op); return Math.round((two + e) * 10) / 10; }, [r.id, s.seed, res.me, res.op]);
  // the needle: what is in, plus a guess about what is out that gets sharper as the count goes
  const bias = useMemo(() => { let h = seedOf(r.id + s.seed); h = Math.sin(h) * 10000; return (h - Math.floor(h) - 0.5) * 2; }, [r.id, s.seed]);
  const needle = (t: number) => {
    const inV = cum.me[t] + cum.op[t], rem = Math.max(0, 1 - inV / Math.max(1, tot));
    const finalLead = res.me - res.op, proj = finalLead + bias * rem * 0.05 * tot;
    const sd = rem * 0.035 * tot + 0.0015 * tot;
    return PHI(proj / sd);
  };
  const p = needle(tick);
  useEffect(() => { live.current = p; }, [p]);
  const inV = cum.me[tick] + cum.op[tick], rep = inV / Math.max(1, tot);
  const lead = cum.me[tick] - cum.op[tick];
  const calledAt = useMemo(() => { if (Math.abs(res.m) < 0.5) return null; for (let t = Math.round(T * 0.15); t <= T; t++) { const q = needle(t); const rp = (cum.me[t] + cum.op[t]) / Math.max(1, tot); if (rp >= 0.3 && (q > 0.995 || q < 0.005)) return t; } return T; }, [cum]); // eslint-disable-line react-hooks/exhaustive-deps
  const called = calledAt != null && tick >= calledAt;
  const done = tick >= T;
  const clock = (t: number) => { const h0 = res.close ?? 20; const mins = Math.round(h0 * 60 + (t * 390) / T); const h = Math.floor(mins / 60) % 24, m = mins % 60; return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h >= 12 && h < 24 ? "PM" : "AM"} ET`; };

  useEffect(() => { music("night"); return () => music("off"); }, []);
  useEffect(() => {
    if (done || speed === 0) return;
    const id = setTimeout(() => setTick((t) => Math.min(T, t + 1)), (T >= 300 ? 1500 : 4000) / speed);
    return () => clearTimeout(id);
  }, [tick, speed, done, T]);
  // the night's running commentary
  const told = useRef<Set<string>>(new Set());
  useEffect(() => {
    const add: Feed[] = []; const say = (key: string, t: string, tone?: Feed["tone"]) => { if (told.current.has(key)) return; told.current.add(key); add.push({ k: tick, t, tone }); };
    if (tick === 0) { say("open", `Polls are closed in ${r.state}. Weather today: ${(res.weather ?? "clear").toLowerCase()}.`); say("exit", `Early exit polls: ${c.me.name} ${exit}%, ${c.op.name} ${Math.round((100 - exit) * 10) / 10}%. Exit polls miss by a few points all the time.`); if (res.mailLate) say("ml", `${r.state} cannot count mail ballots before Election Day, so the big mail counts come late tonight.`); }
    if (tick === Math.round(T * 0.03) && res.lines) say("lines", `Long lines reported in ${res.lines} County as polls closed. Some voters gave up and went home.`, "dn");
    const now = B.filter((b) => b[0] === tick);
    for (const b of now) {
      const co = r.counties[b[1]]; const share = (b[2] + b[3]) / Math.max(1, tot);
      if (share > 0.012) { const m = (100 * (b[2] - b[3])) / Math.max(1, b[2] + b[3]); say(`b${b[0]}-${b[1]}-${b[4]}`, `${co[1]} reports ${Math.round(b[2] + b[3]).toLocaleString()} ${KIND[b[4]]}: ${E.lead(m, sur(c.me.name), sur(c.op.name))}.`, m >= 0 ? "up" : "dn"); }
    }
    if (inV > 0) say("first", "The first votes are in.");
    const prev = tick > 0 ? cum.me[tick - 1] - cum.op[tick - 1] : 0;
    if (tick > 2 && inV > tot * 0.02 && Math.sign(prev) !== Math.sign(lead) && Math.sign(prev) !== 0) { add.push({ k: tick, t: `LEAD CHANGE. ${lead > 0 ? c.me.name : c.op.name} moves ahead by ${Math.abs(Math.round(lead)).toLocaleString()} votes.`, tone: "hot" }); sfx("lead"); }
    for (const q of [25, 50, 75, 90, 99]) if (rep * 100 >= q) say(`q${q}`, `${q}% of the expected vote is counted.`);
    if (rep >= 0.7 && res.pollAvg != null && Math.abs(res.m - res.pollAvg) >= 2.5) say("miss", `SURPRISE. The count is running ${Math.abs(res.m - res.pollAvg).toFixed(1)} points ${res.m - res.pollAvg >= 0 ? `better for ${c.me.name}` : `better for ${c.op.name}`} than the final polls. Pollsters will be explaining this for weeks.`, "hot");
    const p0 = tick > 0 ? needle(tick - 1) : 0.5;
    if (p0 < 0.8 && p >= 0.8) say(`n80u${tick}`, `The needle now leans ${c.me.name}: ${Math.round(p * 100)}% to win.`, "up");
    if (p0 > 0.2 && p <= 0.2) say(`n20d${tick}`, `The needle swings to ${c.op.name}: ${Math.round((1 - p) * 100)}% to win.`, "dn");
    const every = Math.max(20, Math.round(T / 12)); const media = r.media ?? []; if (tick % every === Math.round(every / 2) && media.length) { const k = (tick / every | 0) % media.length; const m = media[k]; say(`m${k}`, `From the coverage this fall, ${m.who}: ${m.what}`); }
    if (called && calledAt === tick && myCall) add.push({ k: tick, t: myCall.me === res.win ? `YOU CALLED IT. Your war room called ${r.name} ${Math.max(0, calledAt - myCall.tick)} reports before the desk, with ${Math.round(myCall.rep * 100)}% counted.` : `BLOWN CALL. Your war room called it for ${myCall.me ? c.me.name : c.op.name} with ${Math.round(myCall.rep * 100)}% counted. The clip will live forever.`, tone: myCall.me === res.win ? "up" : "hot" });
    if (called && calledAt === tick) { add.push({ k: tick, t: `RACE CALL: ${res.win ? c.me.name : c.op.name} wins ${r.name}.`, tone: "call" }); sfx(res.win ? "fanfare" : "lose"); track("Play finished", { race: r.id, side: s.side, diff: s.diff, win: res.win, m: Math.round(res.m * 10) / 10 }); }
    if (done && calledAt == null) say("recount", `It is too close to call. ${r.name} is headed for a recount.`, "hot");
    if (add.length) setFeed((f) => [...add.reverse(), ...f].slice(0, 40));
    const d = lead - prev; mood.current = d > tot * 0.002 ? 1 : d < -tot * 0.002 ? -1 : 0;
    if (now.length && !add.some((a) => a.tone === "hot" || a.tone === "call")) sfx("tick");
  }, [tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // the war room
  const wr = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = wr.current?.getContext("2d"); if (!g) return;
    const staff = Array.from({ length: 7 }, (_, i) => [figure(seedOf("staff" + i + r.id), c.me.party, 0, "staff"), figure(seedOf("staff" + i + r.id), c.me.party, 1, "staff")]);
    let raf = 0, lt = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - lt < 90) return; lt = t;
      g.fillStyle = "#1a1030"; g.fillRect(0, 0, 120, 40); g.fillStyle = "#2a1a4a"; g.fillRect(0, 28, 120, 12);
      g.fillStyle = "#0e1a4a"; g.fillRect(40, 3, 40, 14); g.fillStyle = partyCol(c.me.party); g.fillRect(41, 4, Math.max(1, Math.round(38 * Math.min(1, Math.max(0, live.current)))), 3);
      for (let i = 0; i < 5; i++) { g.fillStyle = "#3a2a5a"; g.fillRect(4 + i * 24, 30, 18, 4); g.fillStyle = "#7fd1ff"; g.fillRect(9 + i * 24, 27, 6, 3); }
      const md = mood.current;
      staff.forEach((f, i) => { const jump = md > 0 && (Math.floor(t / 140) + i) % 2 ? -3 : 0; const slump = md < 0 ? 1 : 0; paintGrid(g, f[md > 0 ? 1 : 0], 6 + i * 16, 15 + jump + slump); });
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [c.me.party, r.id]);

  const g = E.grade(s);
  const ach = useMemo(() => (done ? achievements(r, s, myCall, calledAt) : []), [done, r, s, myCall, calledAt]);
  const share = `I ran ${c.me.name}'s campaign for ${r.name} on ${E.DIFF[s.diff].name} and ${res.win ? "won" : "lost"} by ${Math.abs(res.m).toFixed(1)} points. Grade ${g.letter}.${s.mkt ? ` Kalshi opened me at ${Math.round(s.mkt.open * 100)} cents.` : ""} ${myCall ? (myCall.me === res.win ? ` I called it with ${Math.round(myCall.rep * 100)}% counted.` : " I blew the call.") : ""} Seed ${s.seed}. Play at onpointpolitics.com/play`;
  const SPEECH = res.win ? [["Unity", "Thank both campaigns and promise to work for every voter, including the ones who did not pick you."], ["Victory lap", "Declare a mandate and rip the other side."], ["Thank the volunteers", "Bring the field team on stage."]] : [["Gracious", "Call your opponent, concede, and thank your volunteers."], ["Fight on", "Say the movement is just getting started."], ...(Math.abs(res.m) < 0.5 ? [["Demand a recount", "Say every vote must be counted, and lawyer up."]] : [])];
  const meName = sur(c.me.name), opName = sur(c.op.name);
  return (
    <div className="px-night" style={{ "--px-me": partyCol(c.me.party), "--px-op": partyCol(c.op.party) } as React.CSSProperties}>
      {called && res.win ? <div className="px-confetti" aria-hidden="true">{Array.from({ length: 48 }, (_, i) => <i key={i} style={{ left: `${(i * 37) % 100}%`, animationDelay: `${(i % 12) * 0.1}s`, background: [PAL.gold, partyCol(c.me.party), "#ffffff", PAL.green][i % 4] }} />)}</div> : null}
      <header className="px-nh">
        <span className="px-live"><i />Election night</span>
        <b className="px-clock">{clock(tick)}</b>
        <h2>{called ? (res.win ? `${c.me.name} wins` : `${c.op.name} wins`) : done ? "Too close to call" : "Too early to call"}</h2>
        <div className="px-speed" role="group" aria-label="Speed">{[[0, "Pause"], [1, "1x"], [2, "2x"], [4, "4x"], [8, "8x"]].map(([v, l]) => <button key={l} type="button" className={speed === v ? "on" : ""} onClick={() => { setSpeed(v as number); sfx("click"); }}>{l}</button>)}<button type="button" onClick={() => setTick(T)}>Skip</button></div>
      </header>
      <div className="px-ngrid">
        <section className="px-nmap">
          <div className="px-mapbox night" onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); setMp({ x: e.clientX - b.left, y: e.clientY - b.top, w: b.width, h: b.height }); }} onMouseLeave={() => setMp(null)}>
            <PixelMap r={r} s={s} geo={geo} mode="night" night={county} hover={focus} onHover={setHov} onSel={(f) => { setPin((x) => (x === f ? null : f)); setPinAt(mp); }} sel={pin} labels={5} flash={flash} />
            {fi >= 0 ? (() => {
              const co = r.counties[fi], v = inc.get(fi), fv = finals.get(fi), all = fv ? fv[0] + fv[1] : 0, got = v ? v[0] + v[1] : 0;
              return (
                <div className={cls("px-ntip", at && "follow")} role="status" style={tipStyle}>
                  <b>{co[1]}</b>
                  <span className="px-k">{all ? Math.round((100 * got) / all) : 0}% in{co[6] != null ? ` · 2024 ${co[6] > 0 ? "Trump" : "Harris"} +${Math.abs(co[6]).toFixed(0)}` : ""}</span>
                  {v && got ? (
                    <>
                      <div className={cls("row", c.me.party.toLowerCase())}><span>{meName}</span><b>{Math.round(v[0]).toLocaleString()}</b><em>{((100 * v[0]) / got).toFixed(1)}%</em></div>
                      <div className={cls("row", c.op.party.toLowerCase())}><span>{opName}</span><b>{Math.round(v[1]).toLocaleString()}</b><em>{((100 * v[1]) / got).toFixed(1)}%</em></div>
                      <span className="lead">{E.lead((100 * (v[0] - v[1])) / got, meName, opName)}</span>
                      <span className="px-k">Early and mail {Math.round(v[2]).toLocaleString()} · Election Day {Math.round(v[3]).toLocaleString()} · Late mail {Math.round(v[4]).toLocaleString()}</span>
                      <span className="px-k">About {Math.max(0, Math.round(all - got)).toLocaleString()} votes still to count</span>
                    </>
                  ) : <span>No votes reported yet. About {Math.round(all).toLocaleString()} expected.</span>}
                  {pin ? <small>Click the county again to let go</small> : <small>Click to pin</small>}
                </div>
              );
            })() : <div className="px-ntip hint">Point at a county for its count</div>}
          </div>
          <div className="px-legend"><span><i className="me" />{meName} counties</span><span><i className="op" />{opName} counties</span><span><i className="fog" />Not reporting yet</span><span><i className="flash" />Just reported</span></div>
          <div className="px-keys"><span className="px-k">Counties to watch</span>
            <ul>{keys.map((i) => { const v = inc.get(i), fv = finals.get(i), all = fv ? fv[0] + fv[1] : 0, got = v ? v[0] + v[1] : 0; return (
              <li key={i}><button type="button" onClick={() => setPin(r.counties[i][0])}><span>{r.counties[i][1]}</span><i><em style={{ width: `${all ? (100 * got) / all : 0}%` }} /></i><b className={got ? (v![0] >= v![1] ? "up" : "dn") : ""}>{got ? E.lead((100 * (v![0] - v![1])) / got, meName, opName) : "Waiting"}</b></button></li>
            ); })}</ul>
          </div>
        </section>
        <section className="px-ntally">
          <div className="px-rep"><span>{Math.round(rep * 100)}% counted</span><i style={{ width: `${rep * 100}%` }} /></div>
          {[{ n: c.me.name, v: cum.me[tick], p: c.me.party, me: true }, { n: c.op.name, v: cum.op[tick], p: c.op.party, me: false }].map((x) => (
            <div key={x.n} className={cls("px-tl", x.p.toLowerCase())}>
              <Portrait seed={seedOf(x.n)} role="cand" party={x.p} size={44} talking={false} />
              <div><b>{x.n}{called && (x.me === res.win) ? " ✓" : ""}</b><span><Roll v={x.v} ms={900} /></span></div>
              <small>{inV ? ((100 * x.v) / inV).toFixed(1) : "0.0"}%</small>
            </div>
          ))}
          <div className="px-needle"><span className="px-k">The needle</span>
            <svg viewBox="0 0 200 110"><path d="M10 100 A90 90 0 0 1 190 100" className="arc" /><path d="M10 100 A90 90 0 0 1 100 10" className={cls("half", c.op.party.toLowerCase())} /><path d="M100 10 A90 90 0 0 1 190 100" className={cls("half", c.me.party.toLowerCase())} />
              <line x1="100" y1="100" x2={100 + 82 * Math.cos(Math.PI * (1 - p))} y2={100 - 82 * Math.sin(Math.PI * (1 - p))} className="hand" /><circle cx="100" cy="100" r="5" className="hub" /></svg>
            <b>{p >= 0.5 ? `${meName} ${Math.round(p * 100)}%` : `${opName} ${Math.round((1 - p) * 100)}%`}</b></div>
          {s.mkt ? (() => { const kp = Math.max(0.01, Math.min(0.99, (1 - Math.min(1, rep * 1.4)) * s.mkt.p + Math.min(1, rep * 1.4) * p)); return <div className="px-nkx"><span className="px-k">Kalshi, live</span><b className={kp >= 0.5 ? "up" : "dn"}>{meName} {Math.round(kp * 100)}¢</b><small>opened the night at {Math.round(s.mkt.p * 100)}¢</small></div>; })() : null}
          {!called && !done ? (myCall ? <div className={cls("px-mycall", myCall.me ? "me" : "op")}><span className="px-k">Your call</span><b>{myCall.me ? meName : opName} wins</b><small>called at {clock(myCall.tick)} with {Math.round(myCall.rep * 100)}% in</small></div>
            : <div className="px-mycall ask" role="group" aria-label="Call the race yourself"><span className="px-k">Call it before the desk</span><div className="px-row"><button type="button" className="px-btn sm" disabled={inV <= 0} onClick={() => { setMyCall({ me: true, tick, rep }); sfx("bell"); }}>{meName} wins</button><button type="button" className="px-btn sm" disabled={inV <= 0} onClick={() => { setMyCall({ me: false, tick, rep }); sfx("bell"); }}>{opName} wins</button></div></div>) : null}
          <div className="px-outv"><span className="px-k">Vote still out</span>
            <div className="bar"><i className={c.me.party.toLowerCase()} style={{ width: `${(100 * out.me) / Math.max(1, out.me + out.op)}%` }} /><i className={c.op.party.toLowerCase()} style={{ width: `${(100 * out.op) / Math.max(1, out.me + out.op)}%` }} /></div>
            <small>{Math.round(out.me).toLocaleString()} in counties that lean {meName} · {Math.round(out.op).toLocaleString()} in counties that lean {opName}</small></div>
          <canvas ref={wr} width={120} height={40} className="px-warroom" aria-label="Your war room" />
        </section>
        <section className="px-feed"><span className="px-k">Decision desk</span>
          <ul>{feed.map((f, i) => <li key={i + "-" + f.k} className={f.tone}><span>{clock(f.k)}</span><p>{f.t}</p></li>)}</ul>
        </section>
      </div>
      {done ? (
        <div className="px-final">
          {!speech ? (
            <div className="px-card"><span className="px-tag">{res.win ? "Victory speech" : "The speech"}</span><h3>{res.win ? "The ballroom is waiting" : "Time to face the crowd"}</h3>
              <div className="px-opts">{SPEECH.map(([l, d]) => <button key={l} type="button" className="px-opt" onClick={() => { setSpeech(l); sfx(res.win ? "crowd" : "click"); }}><b>{l}</b><span>{d}</span></button>)}</div></div>
          ) : (
            <div className="px-card">
              <div className="px-grade"><b>{g.letter}</b><span>{res.win ? "You won" : "You lost"} by {Math.abs(res.m).toFixed(1)} points. {g.line}</span></div>
              <dl className="px-dl">
                <div><dt>Forecast had you at</dt><dd>{E.lead(res.forecast, meName, opName)}</dd></div>
                {res.pollAvg != null ? <div><dt>Your final poll average</dt><dd>{E.lead(res.pollAvg, meName, opName)}</dd></div> : null}
                {res.pollAvg != null ? <div className="miss"><dt>The polls missed by</dt><dd className={res.m - res.pollAvg >= 0 ? "up" : "dn"}>{Math.abs(res.m - res.pollAvg).toFixed(1)} points toward {res.m - res.pollAvg >= 0 ? meName : opName}</dd></div> : null}
                {res.late != null && Math.abs(res.late) >= 0.1 ? <div><dt>Late deciders broke</dt><dd>{Math.abs(res.late).toFixed(1)} points toward {res.late >= 0 ? meName : opName}</dd></div> : null}
                {s.mkt ? <div><dt>Kalshi opened you at</dt><dd>{Math.round(s.mkt.open * 100)}¢, closed at {Math.round(s.mkt.p * 100)}¢</dd></div> : null}
                <div><dt>Turnout</dt><dd>{(res.turnout ?? 0).toLocaleString()}</dd></div>
                <div><dt>Raised and spent</dt><dd>{E.usd(s.raised)} · {E.usd(s.spent)}</dd></div>
                <div><dt>Doors and new voters</dt><dd>{s.knocks.toLocaleString()} · {s.regs.toLocaleString()}</dd></div>
              </dl>
              <span className="px-k">Achievements {ach.filter((a) => a.ok).length} of {ach.length}</span>
              <ul className="px-ach">{ach.map((a) => <li key={a.n} className={a.ok ? "ok" : ""} title={a.d}><b>{a.n}</b><span>{a.d}</span></li>)}</ul>
              <div className="px-row">
                <button type="button" className="px-btn" onClick={() => { navigator.clipboard?.writeText(share).then(() => setCopied(true)).catch(() => {}); }}>{copied ? "Copied" : "Copy your result"}</button>
                <button type="button" className="px-btn go" onClick={again}>Run it again</button>
                <button type="button" className="px-btn" onClick={menu}>Pick another race</button>
              </div>
              <p className="px-k">Seed {s.seed}, share it so a friend can run the same campaign. Now watch the real one: <Link href={raceHref(r.id)}>the {r.name} forecast</Link> · <Link href="/results">the results desk on November 3</Link></p>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
