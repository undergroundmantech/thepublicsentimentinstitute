"use client";
// Moments made for playing on camera. Work the crowd: after a rally the candidate delivers three applause lines, and
// you hit each one as the meter swings through the gold zone. The ad studio: pick the message, watch the spot play
// on a pixel TV while a focus group turns its dials, then decide to air it. Both feed the campaign through the engine.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as E from "../engine";
import { Portrait, Type, cls, sur } from "./ui";
import { seedOf, PAL, partyCol } from "./sprites";
import { sfx } from "./sound";
import { grid, box, line, steps, dot } from "./pxdraw";

const hash = (t: string) => { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; };

// ============================================================ work the crowd
export function CrowdWork({ r, s, f, name, onDone }: { r: E.RaceFile; s: E.State; f: string; name: string; onDone: (hits: number[]) => void }) {
  const me = r.cands[s.side === "D" ? 0 : 1];
  const issues = (r.research?.issues ?? []).map((x) => x.issue);
  const lines = useMemo(() => {
    const a = issues[0] ?? "the cost of living", b = issues[1] ?? "your family's future", c = issues[2] ?? "this state";
    return [`${name}, are you ready? On ${a.toLowerCase()}, we are done waiting!`, `They had their chance on ${b.toLowerCase()}. Now it's our turn!`, `Tell your neighbors: ${sur(me.name)} is fighting for ${c.toLowerCase()}!`];
  }, [issues, name, me.name]);
  const [k, setK] = useState(0);
  const [hits, setHits] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<string | null>(null);
  const t0 = useRef(performance.now());
  const zone = [0.22, 0.16, 0.11][Math.min(2, k)], speed = [1.1, 1.45, 1.8][Math.min(2, k)];
  const center = useMemo(() => 0.25 + hash(`${s.seed}${s.week}${f}${k}`) * 0.5, [s.seed, s.week, f, k]);
  useEffect(() => {
    if (k >= 3) return; let raf = 0;
    const loop = (t: number) => { const x = ((t - t0.current) / 1000) * speed; setPos(0.5 - 0.5 * Math.cos(x * Math.PI)); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [k, speed]);
  const hit = useCallback(() => {
    if (k >= 3) return;
    const d = Math.abs(pos - center), sc = d <= zone * 0.25 ? 2 : d <= zone / 2 ? 1 : 0;
    setHits((h) => [...h, sc]); setFlash(sc === 2 ? "PERFECT" : sc ? "GOOD" : "MISS"); sfx(sc === 2 ? "crowd" : sc ? "good" : "boo");
    window.setTimeout(() => setFlash(null), 650);
    t0.current = performance.now(); setK((x) => x + 1);
  }, [k, pos, center, zone]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.code === "Space" || e.key === "Enter") { e.preventDefault(); hit(); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [hit]);
  // the crowd on its feet: more of them jump the better it goes
  const cv = useRef<HTMLCanvasElement>(null);
  const score = hits.reduce((a, b) => a + b, 0);
  useEffect(() => {
    let raf = 0, lt = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - lt < 110) return; lt = t;
      const g = grid(cv.current, 96, 30); if (!g) return;
      box(g, 0, 0, 96, 30, "#140c26"); box(g, 0, 22, 96, 8, "#2a1a4a");
      // spotlights, the stage, the podium and the candidate, who waves when a line lands
      for (let y = 0; y < 13; y++) for (let x = 0; x < 6 + y; x++) if ((x + y + Math.floor(t / 300)) % 3 === 0) { dot(g, 40 - y / 2 + x * 0.6, y, "#3a2a6a"); dot(g, 56 + y / 2 - x * 0.6, y, "#3a2a6a"); }
      box(g, 30, 12, 36, 2, "#5a3b24"); box(g, 44, 8, 8, 5, "#2a1a10"); box(g, 45, 9, 6, 1, partyCol(me.party));
      const wave = flash === "PERFECT" || flash === "GOOD"; box(g, 46, 1, 4, 3, "#f2c9a0"); box(g, 45, 4, 6, 4, partyCol(me.party, 1)); box(g, 46, 0, 4, 1, "#3a2a1a");
      if (wave && Math.floor(t / 160) % 2) box(g, 51, 0, 1, 4, "#f2c9a0"); else box(g, 51, 4, 1, 3, "#f2c9a0");
      for (let i = 0; i < 24; i++) {
        const x = 2 + i * 4, up = (Math.floor(t / 160) + i) % 2 && (flash === "PERFECT" || (flash === "GOOD" && i % 2) || (k >= 3 && score >= 4 && i % 3 !== 0));
        const y = 15 - (up ? 3 : 0), skin = ["#f2c9a0", "#d9a273", "#a8714a", "#6b4526"][(i * 7) % 4];
        box(g, x, y, 2, 2, skin); box(g, x - 0.5, y + 2, 3, 4, i % 3 ? partyCol(me.party) : "#a69bd0");
        if (up) { box(g, x - 1, y - 1, 1, 2, skin); box(g, x + 2, y - 1, 1, 2, skin); }
      }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [flash, k, score, me.party]);
  const done = k >= 3;
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-cw-h">
      <div className="px-card px-crowd">
        <span className="px-tag">Work the crowd · {name}</span>
        <h3 id="px-cw-h">{done ? (score >= 5 ? "The crowd goes wild" : score >= 3 ? "A good night" : "Crickets") : `Applause line ${k + 1} of 3`}</h3>
        <canvas ref={cv} className="px-crowdcv" aria-hidden="true" />
        {!done ? (
          <>
            <p className="px-say"><Portrait seed={seedOf(me.name)} role="cand" party={me.party} size={40} talking /><span>&ldquo;{lines[k]}&rdquo;</span></p>
            <button type="button" className="px-meter" onClick={hit} aria-label="Hit the applause line">
              <i className="zone" style={{ left: `${(center - zone / 2) * 100}%`, width: `${zone * 100}%` }} />
              <i className="sweet" style={{ left: `${(center - zone / 8) * 100}%`, width: `${(zone / 4) * 100}%` }} />
              <i className="cur" style={{ left: `${pos * 100}%` }} />
            </button>
            <small className="px-note">Press SPACE or click when the marker is in the gold. Dead center is perfect.</small>
          </>
        ) : (
          <>
            <ul className="px-hits">{hits.map((h, i) => <li key={i} className={h === 2 ? "p" : h ? "g" : "m"}>{h === 2 ? "PERFECT" : h ? "GOOD" : "MISS"}</li>)}</ul>
            <button type="button" className="px-btn go" onClick={() => onDone(hits)}>{score >= 5 ? "Ride the wave" : score >= 3 ? "Back on the bus" : "Get out of here"}</button>
          </>
        )}
        {flash ? <b className={cls("px-hitflash", flash === "MISS" && "miss")}>{flash}</b> : null}
      </div>
    </div>
  );
}

// ============================================================ the ad studio
export type AdPlan = { amt: number; tone: "positive" | "contrast" | "attack" };
type Pitch = { key: string; title: string; blurb: string; lines: string[]; base: number; swing: number };
export function AdStudio({ r, s, plan, onAir, onCancel }: { r: E.RaceFile; s: E.State; plan: AdPlan; onAir: (mult: number, title: string) => void; onCancel: () => void }) {
  const me = r.cands[s.side === "D" ? 0 : 1], op = r.cands[s.side === "D" ? 1 : 0];
  const M = sur(me.name), O = sur(op.name), st = r.state, office = r.id.startsWith("gov") ? "Governor" : "Senate";
  const is = (r.research?.issues ?? []).map((x) => x.issue);
  const a = is[0] ?? "the cost of living", b = is[1] ?? "health care";
  const pitches: Pitch[] = useMemo(() => {
    const T = plan.tone;
    const mk = (key: string, title: string, blurb: string, lines: string[], base: number, swing: number) => ({ key, title, blurb, lines, base, swing });
    if (T === "positive") return [
      mk("top", `${a}`, "The issue voters here rank first.", [`${M} grew up knowing what ${a.toLowerCase()} means for a family.`, `Now ${M} has a plan to fix it.`, `${M} for ${office}. For ${st}.`], 1.12, 0.05),
      mk("bio", "The life story", "Warm, safe, forgettable.", [`Before politics, ${M} was one of us.`, `Long days. Hard work. Kept every promise.`, `${M}. One of us, for ${office}.`], 1.04, 0.04),
      mk("wild", "Dancing with the dog", "A spot built to go viral. It might.", [`${M} has one dance move.`, `It is terrible. So is ${a.toLowerCase()}.`, `One of these, ${M} can fix.`], 1.0, 0.3)];
    if (T === "contrast") return [
      mk("top", `${a}`, "Side by side on the top issue.", [`On ${a.toLowerCase()}, ${O} sided with insiders.`, `${M} sided with ${st}.`, `The choice is clear.`], 1.12, 0.06),
      mk("two", `${b}`, "The second issue, a softer target.", [`${O} talks about ${b.toLowerCase()}.`, `${M} has done something about it.`, `Compare the records.`], 1.06, 0.05),
      mk("wild", "The scoreboard", "Big graphics, loud music, a gamble.", [`${O}: ZERO wins for ${st}.`, `${M}: let's count them.`, `Your call, ${st}.`], 1.0, 0.28)];
    return [
      mk("top", `${a}`, "Hit them where voters hurt.", [`${O} said ${a.toLowerCase()} was not a crisis.`, `Families in ${st} disagree.`, `${O}: wrong for ${st}.`], 1.14, 0.08),
      mk("two", `${b}`, "Grainy footage, ominous strings.", [`What is ${O} hiding on ${b.toLowerCase()}?`, `Read the fine print.`, `${O}. Too risky.`], 1.06, 0.07),
      mk("wild", "The ex roommate", "A testimonial nobody can unsee. Backlash risk.", [`I lived with ${O} for two years.`, `${O} never once did the dishes.`, `If ${O} won't clean up a kitchen, imagine ${st}.`], 0.98, 0.35)];
  }, [plan.tone, a, b, M, O, st, office]);
  const [pick, setPick] = useState<Pitch | null>(null);
  const [beat, setBeat] = useState(0);
  const roll = pick ? hash(`${s.seed}:${s.week}:${s.tvWeek}:${s.spent}:${pick.key}:${plan.tone}`) : 0;
  const mult = pick ? Math.max(0.75, Math.min(1.3, pick.base + (roll * 2 - 1) * pick.swing)) : 1;
  // the focus group dial: a wandering line that lands on the spot's real score
  const dial = useMemo(() => { if (!pick) return []; const n = 28, end = 0.5 + (mult - 1) * 1.6; let v = 0.5; return Array.from({ length: n }, (_, i) => { const t = i / (n - 1); v = 0.5 + (end - 0.5) * t + Math.sin(i * 1.7 + roll * 9) * 0.06 * (1 - t); return [t, Math.max(0.04, Math.min(0.96, v))] as [number, number]; }); }, [pick, mult, roll]);
  useEffect(() => { if (!pick) return; setBeat(0); const id = window.setInterval(() => setBeat((x) => { if (x >= 3) { clearInterval(id); return x; } sfx("type"); return x + 1; }), 1300); return () => clearInterval(id); }, [pick]);
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = grid(cv.current, 90, 30); if (!g) return;
    box(g, 0, 0, 90, 30, "#0b0716"); line(g, 2, 15, 88, 15, "#4a3a80", [2, 2]);
    const shown = dial.slice(0, Math.max(2, Math.round((beat / 3) * dial.length)));
    steps(g, shown.map(([x, y]) => [2 + x * 86, 28 - y * 26]), mult >= 1.06 ? PAL.green : mult >= 0.97 ? PAL.gold : PAL.gop, 1);
  });
  const verdict = mult >= 1.15 ? "Focus group loved it" : mult >= 1.06 ? "Tested well" : mult >= 0.97 ? "Mixed dials" : "It backfired in the room";
  return (
    <div className="px-modal" role="dialog" aria-modal="true" aria-labelledby="px-ad-h">
      <div className="px-card px-adst">
        <span className="px-tag">Ad studio · {E.usd(plan.amt)} of {plan.tone} TV</span>
        <h3 id="px-ad-h">{pick ? pick.title : "What does the spot say?"}</h3>
        {!pick ? (
          <div className="px-opts">{pitches.map((p, i) => <button key={p.key} type="button" className="px-opt" onClick={() => { setPick(p); sfx("card"); }}><b><i className="px-num">{i + 1}</i>{p.title}</b><span>{p.blurb}</span></button>)}
            <button type="button" className="px-ghost" onClick={onCancel}>Cancel the buy</button></div>
        ) : (
          <>
            <div className="px-tv">
              <div className="scr">
                <Portrait seed={seedOf(plan.tone === "attack" ? op.name : me.name)} role="cand" party={plan.tone === "attack" ? op.party : me.party} size={72} talking={beat < 3} className={plan.tone === "attack" ? "grim" : ""} />
                <p key={beat}>{beat < 3 ? <Type text={pick.lines[beat]} speed={18} sound={false} /> : <b>PAID FOR BY {M.toUpperCase()} FOR {st.toUpperCase()}</b>}</p>
                <i className="scan" aria-hidden="true" />
              </div>
              <span className="knob" aria-hidden="true" /><span className="knob two" aria-hidden="true" />
            </div>
            <span className="px-k">Focus group dial</span>
            <canvas ref={cv} className="px-dialcv" aria-hidden="true" />
            {beat >= 3 ? (
              <div className="px-row wrap">
                <b className={mult >= 1.06 ? "up" : mult < 0.97 ? "dn" : ""}>{verdict}: {mult >= 1 ? "+" : ""}{Math.round((mult - 1) * 100)}% punch</b>
                <button type="button" className="px-btn go" onClick={() => onAir(mult, pick.title)}>Air it</button>
                <button type="button" className="px-btn" onClick={() => { setPick(null); sfx("click"); }}>Pick another cut</button>
                <button type="button" className="px-ghost" onClick={onCancel}>Scrap it</button>
              </div>
            ) : <small className="px-note">The room is watching…</small>}
          </>
        )}
      </div>
    </div>
  );
}
