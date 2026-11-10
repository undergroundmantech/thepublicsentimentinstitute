"use client";
// The set pieces of Campaign 2028: the title, issue moments, the debate stage, the running mate, the convention,
// election night and the morning after.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as E from "./engine28";
import { DEBATE_Q, debateLines } from "./cards28";
import { TROPHIES } from "./trophies28";
import TileMap28, { shade } from "./TileMap28";
import { FEMALE, pct, short, firstSentence } from "./ui28";
import { Portrait, Figure, Type, Roll, cls, sur } from "../px/ui";
import { seedOf } from "../px/sprites";
import { sfx, music } from "../px/sound";

// ============================================================ title
export function Title28({ onNew, onResume, saved, onClassic }: { onNew: () => void; onResume: () => void; saved: string | null; onClassic: () => void }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = cv.current?.getContext("2d"); if (!g) return; const W = 240, H = 110; let raf = 0, lt = 0;
    const stars = Array.from({ length: 80 }, (_, i) => [(i * 71) % W, (i * 37) % 56, i % 3]);
    type P = { x: number; y: number; vx: number; vy: number; c: string; life: number };
    let parts: P[] = [];
    const cols = ["#3d7bff", "#ff3b5c", "#ffcc4d", "#fff6e0", "#41e08f", "#b78cff"];
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - lt < 60) return; lt = t;
      for (let y = 0; y < H; y++) { g.fillStyle = y < 34 ? "#0b0716" : y < 64 ? "#160c30" : "#24124a"; g.fillRect(0, y, W, 1); }
      for (const [x, y, k] of stars) { g.fillStyle = (Math.floor(t / 400) + k) % 4 ? "#fff6e0" : "#5a4a98"; g.fillRect(x, y, 1, 1); }
      // fireworks
      if (Math.random() < 0.09) { const x = 20 + Math.random() * 200, y = 10 + Math.random() * 30, c = cols[Math.floor(Math.random() * cols.length)]; for (let k = 0; k < 22; k++) { const a = (k / 22) * Math.PI * 2, v = 0.6 + Math.random() * 0.8; parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c, life: 14 + Math.random() * 8 }); } }
      parts = parts.filter((p) => p.life > 0); for (const p of parts) { p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.life -= 1; g.fillStyle = p.life > 6 ? p.c : "#5a4a98"; g.fillRect(Math.round(p.x), Math.round(p.y), 1, 1); }
      // the White House: lawn, wings, portico, columns, roof and flag
      g.fillStyle = "#123a24"; g.fillRect(0, 92, W, 18); g.fillStyle = "#1a5232"; for (let x = 0; x < W; x += 3) g.fillRect(x, 92 + ((x / 3) % 2), 2, 1);
      g.fillStyle = "#e9e4f6"; g.fillRect(60, 66, 120, 26); g.fillStyle = "#cfc6ea"; g.fillRect(60, 64, 120, 3);
      g.fillStyle = "#f6f2ff"; g.fillRect(100, 58, 40, 34); for (let y = 0; y < 8; y++) g.fillRect(104 - y + 8, 50 + y, 32 - 2 * (8 - y) + 16 - 16 + 2 * y, 1);
      g.fillStyle = "#b9b0d8"; for (let i = 0; i < 6; i++) g.fillRect(103 + i * 6.5, 62, 2, 30);
      g.fillStyle = "#3a2a5a"; for (let i = 0; i < 9; i++) { g.fillRect(64 + i * 4, 72, 2, 3); g.fillRect(64 + i * 4, 82, 2, 3); g.fillRect(146 + i * 4, 72, 2, 3); g.fillRect(146 + i * 4, 82, 2, 3); }
      const lit = Math.floor(t / 700); g.fillStyle = "#ffcc4d"; g.fillRect(64 + (lit % 9) * 4, 72, 2, 3); g.fillRect(146 + ((lit + 4) % 9) * 4, 82, 2, 3);
      g.fillStyle = "#8a80b0"; g.fillRect(119, 38, 1, 13); const wave = Math.floor(t / 200) % 2;
      for (let y = 0; y < 5; y++) { g.fillStyle = y % 2 ? "#fff6e0" : "#ff3b5c"; g.fillRect(120, 38 + y, 8 + (y % 2 ? wave : 1 - wave), 1); } g.fillStyle = "#3d7bff"; g.fillRect(120, 38, 3, 3);
      // searchlights in the party colors
      g.fillStyle = "#3d7bff20"; const a = Math.sin(t / 1500) * 34; for (let y = 0; y < 70; y++) g.fillRect(30 + a * (y / 70) - y * 0.12, 92 - y, 2 + y * 0.14, 1);
      g.fillStyle = "#ff3b5c20"; const b = Math.cos(t / 1700) * 34; for (let y = 0; y < 70; y++) g.fillRect(210 + b * (y / 70) - y * 0.12, 92 - y, 2 + y * 0.14, 1);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <section className="px-title y28-title">
      <canvas ref={cv} width={240} height={110} className="px-title-cv" aria-hidden="true" />
      <div className="px-title-in">
        <div className="px-logo"><span className="a">CAMPAIGN</span><span className="b">2028</span></div>
        <p className="px-tag2">The road to 270. Run the primaries, win the nomination, take the White House. Every vote is real model data.</p>
        <div className="px-title-acts">
          <button type="button" className="px-press blink" onClick={() => { sfx("coin"); onNew(); }}>New campaign</button>
          {saved ? <button type="button" className="px-press ghost" onClick={() => { sfx("click"); onResume(); }}>Continue: {saved}</button> : null}
        </div>
        <ul className="px-feat" aria-label="What is new">
          <li>Primaries and delegates</li><li>Dropout deals</li><li>Contested convention</li><li>Running mates</li><li>Campaign managers</li><li>Scandals and the October surprise</li>
          <li>Opposition research</li><li>Ad tone and backfires</li><li>Internal polls and fog of war</li><li>Super PACs</li><li>Turnout drives by vote history</li><li>Third party spoilers</li>
          <li>Debate timing meter</li><li>Election Day weather</li><li>Election night calls</li><li>Trophies</li>
        </ul>
        <button type="button" className="px-btn sm y28-classic" onClick={() => { sfx("click"); onClassic(); }}>Play the 2026 midterm edition</button>
      </div>
    </section>
  );
}

// ============================================================ an issue moment
export function CardModal({ card, me, party, onPick }: { card: E.Card; me: string; party: E.Party; onPick: (i: number) => void }) {
  useEffect(() => { sfx("alarm"); }, []);
  useEffect(() => { const h = (e: KeyboardEvent) => { const k = Number(e.key) - 1; if (k >= 0 && k < card.opts.length) { e.preventDefault(); onPick(k); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-card-h">
      <div className="px-card ev y28-ev">
        <div className="px-row"><Portrait seed={seedOf(me)} role="cand" party={party} size={56} female={FEMALE.has(me)} talking /><div><span className="px-tag hot">Breaking</span><h3 id="y28-card-h">{card.title}</h3></div></div>
        <p><Type text={card.prompt} speed={12} /></p>
        <div className="y28-opts">{card.opts.map((o, i) => (
          <button key={o.label} type="button" className="px-btn" onClick={() => { sfx("card"); onPick(i); }}>
            <small>{i + 1} · {o.label}</small><span>“{o.say}”</span>
          </button>
        ))}</div>
        {card.src ? <a className="px-k" href={card.src} target="_blank" rel="noreferrer">What is really happening</a> : null}
      </div>
    </div>
  );
}
/** A scandal or attack: pick an answer, knowing how risky each one is. */
export function CrisisModal({ c, me, party, onPick }: { c: E.Crisis; me: string; party: E.Party; onPick: (i: number) => void }) {
  useEffect(() => { sfx("alarm"); }, []);
  const risk = (r: number) => (r < 0.18 ? "Safe" : r < 0.36 ? "Some risk" : "Risky");
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-cr-h">
      <div className="px-card ev y28-ev y28-crisis">
        <div className="px-row"><Portrait seed={seedOf(me)} role="cand" party={party} size={56} female={FEMALE.has(me)} /><div><span className="px-tag hot">{c.sev > 1.3 ? "October surprise" : "Crisis"}</span><h3 id="y28-cr-h">{c.title}</h3></div></div>
        <p><Type text={c.prompt} speed={12} /></p>
        <div className="y28-opts">{c.opts.map((o, i) => (
          <button key={o.label} type="button" className="px-btn" onClick={() => { sfx("card"); onPick(i); }}>
            <small>{i + 1} · {o.label} · <em className={o.risk < 0.18 ? "safe" : o.risk < 0.36 ? "mid" : "hot"}>{risk(o.risk)}</em></small><span>“{o.say}”</span>
          </button>
        ))}</div>
        <span className="px-k">Safe answers cost a little for sure. Risky ones can win the news cycle or blow up.</span>
      </div>
    </div>
  );
}
export function FxCard({ title, lines, onDone }: { title: string; lines: { l: string; v: number; unit?: string }[]; onDone: () => void }) {
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-fx-h">
      <div className="px-card">
        <h3 id="y28-fx-h">{title}</h3>
        <ul className="px-parts">{lines.map((x) => <li key={x.l}><span className="l">{x.l}</span><span className="bar"><i className={x.v >= 0 ? "up" : "dn"} style={{ width: `${Math.min(50, Math.abs(x.v) * 120)}%`, [x.v >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span><b className={x.v >= 0 ? "up" : "dn"}>{x.v >= 0 ? "+" : ""}{x.v.toFixed(2)}{x.unit ?? ""}</b></li>)}</ul>
        <button type="button" className="px-btn go" onClick={onDone}>Back to the trail</button>
      </div>
    </div>
  );
}

// ============================================================ the debate stage
type DQ = { k: number; q: string; lines: { label: string; pos: number }[] };
export function Debate28({ me, op, party, opParty, title, n = 3, seed, onDone }: { me: string; op: string; party: E.Party; opParty: E.Party; title: string; n?: number; seed: number; onDone: (answers: { k: number; pos: number; mult: number }[]) => void }) {
  const qs: DQ[] = useMemo(() => { const g = { rng: seed }; const pool = DEBATE_Q.slice(); const out: DQ[] = []; while (out.length < n && pool.length) { const i = Math.floor(E.rand(g) * pool.length); const x = pool.splice(i, 1)[0]; out.push({ ...x, lines: debateLines(x.k) }); } return out; }, [seed, n]);
  const [i, setI] = useState(0); const [pick, setPick] = useState<number | null>(null); const [ans, setAns] = useState<{ k: number; pos: number; mult: number }[]>([]);
  const [meter, setMeter] = useState(0); const [stopped, setStopped] = useState<number | null>(null); const raf = useRef(0); const t0 = useRef(0);
  const [dial, setDial] = useState(50);
  useEffect(() => { music("debate"); return () => music("trail"); }, []);
  useEffect(() => {
    if (pick == null || stopped != null) return; t0.current = performance.now();
    const step = (t: number) => { const x = ((t - t0.current) / 900) % 2; setMeter(x < 1 ? x : 2 - x); raf.current = requestAnimationFrame(step); };
    raf.current = requestAnimationFrame(step); return () => cancelAnimationFrame(raf.current);
  }, [pick, stopped]);
  const deliver = () => {
    if (pick == null || stopped != null) return; cancelAnimationFrame(raf.current); setStopped(meter);
    const off = Math.abs(meter - 0.5); const mult = off < 0.06 ? 1.45 : off < 0.16 ? 1.15 : off < 0.3 ? 0.85 : 0.55;
    sfx(mult >= 1.15 ? "crowd" : mult < 0.7 ? "boo" : "good");
    setDial((v) => Math.max(5, Math.min(95, v + (mult - 0.9) * 18)));
    setAns((a) => [...a, { k: qs[i].k, pos: qs[i].lines[pick].pos, mult }]);
  };
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.code === "Space" && pick != null && stopped == null) { e.preventDefault(); deliver(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); });
  const next = () => { if (i + 1 >= qs.length) { onDone(ans); return; } setI(i + 1); setPick(null); setStopped(null); setMeter(0); };
  const q = qs[i]; const grade = stopped == null ? null : Math.abs(stopped - 0.5) < 0.06 ? "Perfect delivery" : Math.abs(stopped - 0.5) < 0.16 ? "Strong" : Math.abs(stopped - 0.5) < 0.3 ? "Shaky" : "Flubbed it";
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-deb-h">
      <div className="px-card wide y28-debate">
        <span className="px-tag hot">{title}</span>
        <div className="y28-stage">
          <div className="pod"><Figure seed={seedOf(me)} party={party} talking={pick != null && stopped == null} scale={6} /><b>{sur(me)}</b></div>
          <div className="mod"><Portrait seed={seedOf("moderator2028")} role="moderator" party="O" size={56} talking={pick == null} /><span className="px-k">Moderator</span></div>
          <div className="pod"><Figure seed={seedOf(op)} party={opParty} flip scale={6} /><b>{sur(op)}</b></div>
        </div>
        <div className="y28-dial" aria-label="Live focus group dial"><span>Focus group</span><i style={{ width: `${dial}%` }} /><b>{Math.round(dial)}</b></div>
        <h3 id="y28-deb-h">Question {i + 1} of {qs.length}</h3>
        <p><Type key={q.q} text={q.q} speed={14} /></p>
        {pick == null ? (
          <div className="y28-opts">{q.lines.map((l, k) => <button key={k} type="button" className="px-btn" onClick={() => { setPick(k); sfx("click"); }}><span>“{l.label}”</span></button>)}</div>
        ) : (
          <div className="y28-meter-wrap">
            <span className="px-k">Land the line: stop the marker in the gold</span>
            <div className="y28-meter"><span className="zone" /><span className="zone2" /><i style={{ left: `${(stopped ?? meter) * 100}%` }} /></div>
            {stopped == null ? <button type="button" className="px-press" onClick={deliver}>Deliver (space)</button> : <div className="px-row"><b className="y28-grade">{grade}</b><button type="button" className="px-btn go" onClick={next}>{i + 1 >= qs.length ? "Closing statements" : "Next question"}</button></div>}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================ the running mate
export function VPPick({ d, party, me, onPick, promised }: { d: E.Data; party: E.Party; me: string; onPick: (vp: string, st: string | null) => void; promised?: string }) {
  const list = d.cands[party].filter((c) => c.n !== me).slice(0, 18);
  if (promised && !list.some((c) => c.n === promised)) { const c = d.cands[party].find((x) => x.n === promised); if (c) list.unshift(c); }
  const [sel, setSel] = useState<string | null>(promised ?? null);
  useEffect(() => { music("trail"); }, []);
  const help = (n: string) => { const fx = E.vpEffect(d, party, n); const sg = party === "R" ? 1 : -1; const best = d.states.map((x, i) => ({ st: x.st, v: fx[i] * sg })).sort((a, b) => b.v - a.v).slice(0, 3).filter((x) => x.v > 0.05); return best; };
  return (
    <div className="px-lobby">
      <section className="px-step">
        <div className="px-sh"><span className="px-n">VP</span><h2>Pick your running mate</h2></div>
        <p className="px-note">A running mate brings a home state edge and half their regional pull from the model. They campaign on their own every week, and they take the vice presidential debate.</p>
        {promised ? <p className="px-note"><b>You promised the spot to {promised}</b> to win their endorsement. Picking anyone else is a broken promise, and the press will say so.</p> : null}
        <div className="y28-cands">{list.map((c) => { const h = help(c.n); return (
          <button key={c.n} type="button" className={cls("y28-cand", sel === c.n && "on")} aria-pressed={sel === c.n} onClick={() => { setSel(c.n); sfx("card"); }} style={{ ["--cc" as string]: c.c } as React.CSSProperties}>
            <Portrait seed={seedOf(c.n)} role="cand" party={party} size={64} female={FEMALE.has(c.n)} talking={sel === c.n} />
            <b>{c.n}</b><small>{short(firstSentence(c.lane), 90)}</small>
            <span className="px-k">{h.length ? `Helps in ${h.map((x) => `${x.st} +${x.v.toFixed(1)}`).join(", ")}` : "No home state edge"}</span>
          </button>
        ); })}</div>
      </section>
      <div className="px-gobar"><span>{sel ? <><b>{sel}</b> on the ticket</> : "Choose a running mate"}</span><button type="button" className="px-press" disabled={!sel} onClick={() => sel && onPick(sel, null)}>Announce the ticket</button></div>
    </div>
  );
}

// ============================================================ a contested convention
export function Convention({ d, P, onDone }: { d: E.Data; P: E.PrimS; onDone: (won: boolean, note: string) => void }) {
  const rows = P.field.slice().sort((a, b) => b.del - a.del); const me = P.field[0]; const tot = d.primary[P.party].total; const need = Math.floor(tot / 2) + 1;
  const [deal, setDeal] = useState<string | null>(null);
  const odds = (k: string) => { const lead = me.del / Math.max(1, rows[0].del); const base = 0.15 + 0.6 * Math.min(1, lead) ** 2; return Math.max(0.03, Math.min(0.92, base + (k === "vp" ? 0.18 : k === "plank" ? 0.1 : k === "floor" ? 0.02 : 0))); };
  const go = () => { if (!deal) return; const g = { rng: P.t * 977 + me.del }; const win = E.rand(g) < odds(deal); sfx(win ? "fanfare" : "lose"); onDone(win, win ? "The floor broke your way on the second ballot." : "The party went another way on the third ballot."); };
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="y28-conv-h">
      <div className="px-card wide">
        <span className="px-tag hot">Contested convention</span><h3 id="y28-conv-h">Nobody has {need.toLocaleString()} delegates</h3>
        <ul className="y28-convlist">{rows.map((r) => <li key={r.n}><b>{r.n}</b><span>{r.del.toLocaleString()}</span></li>)}</ul>
        <p className="px-note">The first ballot fails. Pledged delegates are free on the second. Make your play.</p>
        <div className="y28-opts">
          {[["vp", `Offer ${rows.find((r) => r.n !== me.n)?.n ?? "your rival"} the vice presidency`], ["plank", "Give the other wing a platform plank"], ["floor", "Whip a floor fight on the rules"]].map(([k, l]) => (
            <button key={k} type="button" className={cls("px-btn", deal === k && "on")} onClick={() => { setDeal(k); sfx("click"); }}><span>{l}</span><small>About {pct(odds(k))} to win the floor</small></button>
          ))}
        </div>
        <button type="button" className="px-press" disabled={!deal} onClick={go}>Call the roll</button>
      </div>
    </div>
  );
}

// ============================================================ election night
export function Night28({ d, s, res, onDone }: { d: E.Data; s: E.GenS; res: E.NightRes; onDone: () => void }) {
  const [clock, setClock] = useState(18.8); const [speed, setSpeed] = useState(1);
  useEffect(() => { music("night"); }, []);
  useEffect(() => {
    let raf = 0, lt = performance.now();
    const step = (t: number) => { const dt = (t - lt) / 1000; lt = t; setClock((c) => Math.min(32, c + dt * 0.55 * speed)); raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [speed]);
  const called = res.calls.filter((c) => c.at <= clock);
  const meEV = called.filter((c) => c.win).reduce((a, c) => a + c.ev, 0), opEV = called.filter((c) => !c.win).reduce((a, c) => a + c.ev, 0);
  const last = useRef(0);
  useEffect(() => { if (called.length > last.current) { const c = called[called.length - 1]; sfx(c.win ? "good" : "bad"); last.current = called.length; } }, [called]);
  const decided = meEV >= 270 || opEV >= 270 || called.length === res.calls.length;
  const callMap = new Map(called.map((c) => [c.st, c]));
  const marks = called.slice(-3).map((c) => ({ st: c.st, kind: "call" as const, t0: performance.now() - (clock - c.at) * 1800 }));
  const hh = Math.floor(clock), mm = Math.floor((clock - hh) * 60); const ampm = hh % 24 >= 12 ? "PM" : "AM"; const h12 = ((hh % 24) + 11) % 12 + 1;
  const myP = s.party, sg = myP === "R" ? 1 : -1;
  return (
    <div className="y28-night">
      <div className="y28-night-top"><span className="px-tag hot">Election night</span><b className="y28-clock">{h12}:{String(mm).padStart(2, "0")} {ampm} ET</b>
        <div className="px-chips">{[1, 3, 8].map((k) => <button key={k} type="button" className={speed === k ? "on" : ""} onClick={() => setSpeed(k)}>{k}x</button>)}<button type="button" onClick={() => setClock(32)}>Skip</button></div></div>
      <div className="y28-night-ev">
        <div className="side me"><Portrait seed={seedOf(s.me)} role="cand" party={myP} size={56} female={FEMALE.has(s.me)} talking={meEV > opEV} /><b><Roll v={meEV} /></b><span>{s.me}</span></div>
        <div className="bar"><i className={myP.toLowerCase()} style={{ width: `${(meEV / 538) * 100}%` }} /><i className={(myP === "D" ? "r" : "d") + " right"} style={{ width: `${(opEV / 538) * 100}%` }} /><em /></div>
        <div className="side op"><Portrait seed={seedOf(s.op)} role="cand" party={myP === "D" ? "R" : "D"} size={56} female={FEMALE.has(s.op)} talking={opEV > meEV} /><b><Roll v={opEV} /></b><span>{s.op}</span></div>
      </div>
      <TileMap28 states={d.states.map((x) => x.st)} title="States called so far" fill={(st) => { const c = callMap.get(st); return c ? shade(sg * c.m) : "#2f1f5a"; }} marks={marks} dim={(st) => !callMap.has(st)} />
      {res.events?.length ? <div className="y28-wx">{res.events.map((e) => <span key={e}>{e}</span>)}</div> : null}
      <div className="y28-calls">{called.slice(-6).reverse().map((c) => <span key={c.st} className={cls("call", c.win ? "me" : "op")}>{E.nameOf(d, c.st)} · {c.ev} · {c.win ? sur(s.me) : sur(s.op)} +{c.close.toFixed(1)}</span>)}</div>
      {decided ? <button type="button" className="px-press" onClick={onDone}>{meEV >= 270 ? "Victory speech" : opEV >= 270 ? "Concede" : "See the results"}</button> : <span className="px-note">Too close to call: {res.calls.filter((c) => c.at > clock && c.at < clock + 6).map((c) => c.st).slice(0, 8).join(", ") || "polls still open"}</span>}
    </div>
  );
}
export function Result28({ d, s, res, onAgain, onMenu, start, trophies = [] }: { d: E.Data; s: E.GenS; res: E.NightRes; onAgain: () => void; onMenu: () => void; start: { p: number; ev: number }; trophies?: string[] }) {
  useEffect(() => { sfx(res.win ? "fanfare" : "lose"); }, [res.win]);
  const sg = s.party === "R" ? 1 : -1; const byI = new Map(res.calls.map((c) => [c.st, c]));
  const flips = res.calls.filter((c) => { const x = d.states[c.i]; return x.p24 != null && (sg * x.p24 > 0) !== c.win; });
  const tip = res.calls.slice().sort((a, b) => b.m - a.m); let acc = 0; let tp = tip[0]; for (const c of tip) { acc += c.ev; if (acc >= 270) { tp = c; break; } }
  return (
    <div className="px-lobby y28-result">
      <section className="px-step">
        <span className={cls("px-tag", res.win ? "real" : "hot")}>{res.win ? "Elected" : "Defeated"}</span>
        <h2 className="y28-big">{res.win ? `President elect ${s.me}` : `${s.op} wins`}</h2>
        <p className="px-note">{res.ev} to {res.opEv} electoral votes. Popular vote {res.pop >= 0 ? `${sur(s.me)} +${res.pop.toFixed(1)}` : `${sur(s.op)} +${Math.abs(res.pop).toFixed(1)}`}. The tipping point state was {E.nameOf(d, tp.st)}, {tp.win ? "yours" : "theirs"} by {tp.close.toFixed(1)}. You started with a {pct(start.p)} chance and {start.ev} electoral votes.</p>
        <TileMap28 states={d.states.map((x) => x.st)} title="The final map" fill={(st) => { const c = byI.get(st); return c ? shade(sg * c.m) : "#2f1f5a"; }} />
        <Trophies ids={trophies} />
        {flips.length ? <p className="px-note">Flipped from 2024: {flips.map((c) => `${E.nameOf(d, c.st)} to ${c.win ? sur(s.me) : sur(s.op)}`).join(", ")}.</p> : null}
        <div className="px-row"><button type="button" className="px-press" onClick={onAgain}>Run again</button><button type="button" className="px-press ghost" onClick={onMenu}>Main menu</button></div>
      </section>
    </div>
  );
}

/** The trophies a run earned. */
export function Trophies({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <div className="y28-trophies"><span className="px-k">Trophies earned</span>
      <ul>{ids.map((id) => { const t = TROPHIES.find((x) => x.id === id); return t ? <li key={id}><b>{t.name}</b><small>{t.how}</small></li> : null; })}</ul>
    </div>
  );
}
