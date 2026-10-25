"use client";
// Debate night on a pixel stage. Four questions, most of them the real issues of this race from the research. For each:
// pick an answer, then deliver it (stop the cursor in the sweet spot, which prep widens), hear the other candidate's
// line, which comes from their real ads and message, and choose a comeback. A live dial of undecided voters runs along
// the bottom, and a snap poll decides who won.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as E from "../engine";
import { debateRounds, type DRound } from "../events";
import { figure, paintGrid, partyCol, PAL, seedOf } from "./sprites";
import { sfx, music } from "./sound";
import { Type, cls, sur, fxs } from "./ui";

type Stage = "intro" | "q" | "pick" | "deliver" | "landed" | "opp" | "rebut" | "rebutted" | "snap";

export default function Debate({ r, s, onDone }: { r: E.RaceFile; s: E.State; onDone: (x: E.State) => void }) {
  const c = useMemo(() => E.ctx(r, s.side), [r, s.side]);
  const x = useRef<E.State>(structuredClone(s));
  const rounds = useMemo<DRound[]>(() => debateRounds(c, x.current), [c]);
  const [k, setK] = useState(0);
  const [stage, setStage] = useState<Stage>("intro");
  const [pick, setPick] = useState<number | null>(null);
  const [last, setLast] = useState<{ fx: number; dl: number; t: string } | null>(null);
  const [reb, setReb] = useState<{ fx: number; good: boolean; t: string } | null>(null);
  const [dial, setDial] = useState<number[]>([50]);
  const [tot, setTot] = useState({ me: 0, op: 0 });
  const [snap, setSnap] = useState<{ won: boolean; snap: number; fx: number } | null>(null);
  const speaker = useRef<"me" | "op" | "mod" | null>("mod");
  const cheer = useRef(0);
  const meP = c.me.party, opP = c.op.party, deb = r.research?.debates?.[0];
  const q = rounds[k];
  useEffect(() => { music("debate"); return () => music("trail"); }, []);
  useEffect(() => { speaker.current = stage === "q" || stage === "intro" || stage === "snap" ? "mod" : stage === "opp" ? "op" : stage === "landed" || stage === "deliver" || stage === "rebutted" ? "me" : null; }, [stage]);

  // ------------------------------------------------------------ the stage, drawn on a small canvas
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = cv.current?.getContext("2d"); if (!g) return;
    const W = 192, H = 108;
    const meF = [figure(seedOf(c.me.name), meP, 0), figure(seedOf(c.me.name), meP, 1)], opF = [figure(seedOf(c.op.name), opP, 0), figure(seedOf(c.op.name), opP, 1)], modF = [figure(seedOf("moderator" + r.id), "", 0, "moderator"), figure(seedOf("moderator" + r.id), "", 1, "moderator")];
    const heads = Array.from({ length: 34 }, (_, i) => ({ x: 2 + i * 5.6, c: ["#e8b48f", "#a8693f", "#7a4a2a", "#f6d3b3", "#d39a6a"][i % 5], h: ["#1b1b1b", "#6b4423", "#bdbdbd", "#3b2a1a"][(i * 7) % 4] }));
    let raf = 0, lt = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); if (t - lt < 70) return; lt = t;
      for (let y = 0; y < H; y++) { g.fillStyle = y < 70 ? (y % 6 < 3 ? "#2a1450" : "#24113f") : "#160b2a"; g.fillRect(0, y, W, 1); }
      // backdrop screen with stars and stripes of the debate set
      g.fillStyle = "#0e1a4a"; g.fillRect(56, 8, 80, 30); g.fillStyle = PAL.gold; g.fillRect(56, 8, 80, 1); g.fillRect(56, 37, 80, 1);
      for (let i = 0; i < 12; i++) { g.fillStyle = (Math.floor(t / 400) + i) % 3 ? "#ffffff" : "#ffcc4d"; g.fillRect(60 + i * 6.3, 14 + (i % 2) * 3, 1, 1); }
      g.fillStyle = "#b8213a"; for (let i = 0; i < 5; i++) g.fillRect(62, 24 + i * 2.4, 68, 1);
      g.fillStyle = (Math.floor(t / 500) % 2) ? "#ff3b5c" : "#7a1020"; g.fillRect(4, 4, 4, 4);
      // spotlight
      const sp = speaker.current; const sx = sp === "me" ? 40 : sp === "op" ? 152 : sp === "mod" ? 96 : -99;
      if (sx > 0) { g.fillStyle = "#fff6e012"; for (let y = 0; y < 80; y++) g.fillRect(sx - 4 - y * 0.22, y, 8 + y * 0.44, 1); }
      // podiums and candidates
      const pod = (x0: number, col: string) => { g.fillStyle = "#3a2a5a"; g.fillRect(x0, 62, 22, 18); g.fillStyle = col; g.fillRect(x0, 62, 22, 3); g.fillStyle = "#ffffff22"; g.fillRect(x0 + 2, 67, 18, 1); };
      const talk = (who: "me" | "op" | "mod") => (sp === who && Math.floor(t / 160) % 2 ? 1 : 0);
      paintGrid(g, meF[talk("me")], 32, 34, false, 2); pod(29, partyCol(meP));
      paintGrid(g, opF[talk("op")], 144, 34, true, 2); pod(141, partyCol(opP));
      paintGrid(g, modF[talk("mod")], 88, 42, false, 2); g.fillStyle = "#4a3a6a"; g.fillRect(84, 66, 24, 12); g.fillStyle = PAL.gold; g.fillRect(84, 66, 24, 1);
      // audience
      const ch = cheer.current; cheer.current = Math.max(0, ch - 0.06);
      for (const [i, h] of heads.entries()) { const bob = ch > 0.05 && (Math.floor(t / 110) + i) % 2 ? -2 : 0; const y = 92 + (i % 2) * 4 + bob; g.fillStyle = h.h; g.fillRect(h.x, y, 4, 2); g.fillStyle = h.c; g.fillRect(h.x, y + 2, 4, 3); g.fillStyle = "#1a1030"; g.fillRect(h.x - 1, y + 5, 6, 8); if (ch > 0.4 && i % 3 === 0) { g.fillStyle = h.c; g.fillRect(h.x - 1, y - 3 + (Math.floor(t / 90) % 2), 1, 2); g.fillRect(h.x + 4, y - 3 + (Math.floor(t / 90) % 2), 1, 2); } }
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [c.me.name, c.op.name, meP, opP, r.id]);

  // ------------------------------------------------------------ delivery mini game
  const [cur, setCur] = useState(0);
  const zone = useRef({ at: 0.5, w: 0.14 });
  const curRef = useRef(0);
  const deliver = () => {
    if (stage !== "deliver" || pick == null) return;
    const d = Math.abs(curRef.current - zone.current.at), w = zone.current.w / 2;
    const dl = d <= w ? 0.78 + 0.22 * (1 - d / w) : Math.max(0, 0.7 - (d - w) * 2.2);
    const res = E.debateAnswer(c, x.current, q.opts[pick].st, q.opts.map((o) => o.st), dl);
    const word = dl > 0.9 ? "Perfect delivery" : dl > 0.7 ? "Strong delivery" : dl > 0.4 ? "Shaky delivery" : "Stumbled";
    setLast({ fx: res.fx, dl, t: word }); setTot((t) => ({ ...t, me: t.me + res.fx }));
    setDial((a) => [...a, Math.max(5, Math.min(95, a[a.length - 1] + res.fx * 160))]);
    cheer.current = res.fx > 0 ? 1 : 0.2; sfx(res.fx > 0.02 ? "crowd" : res.fx < -0.02 ? "boo" : "click");
    setStage("landed");
  };
  useEffect(() => {
    if (stage !== "deliver") return;
    zone.current = { at: 0.2 + Math.random() * 0.6, w: 0.1 + 0.03 * Math.min(4, x.current.prep) };
    const speed = 0.0011 * (x.current.stamina < 35 ? 1.5 : 1);
    let raf = 0; const t0 = performance.now();
    const loop = (t: number) => { const p = ((t - t0) * speed) % 2; const v = p > 1 ? 2 - p : p; curRef.current = v; setCur(v); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    const key = (e: KeyboardEvent) => { if (e.code === "Space" || e.code === "Enter") { e.preventDefault(); deliver(); } };
    window.addEventListener("keydown", key);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("keydown", key); };
  }, [stage]); // eslint-disable-line react-hooks/exhaustive-deps

  const oppTurn = () => {
    const ofx = 0.02 + E.gauss(x.current) * 0.04 + (E.DIFF[x.current.diff].opp - 1) * 0.06;
    setTot((t) => ({ ...t, op: t.op + ofx }));
    setDial((a) => [...a, Math.max(5, Math.min(95, a[a.length - 1] - ofx * 160))]);
    setStage("opp");
  };
  const rebut = (kind: "counter" | "zinger" | "calm") => {
    const rr = E.rebuttal(c, x.current, kind);
    setReb(rr); setTot((t) => ({ ...t, me: t.me + rr.fx }));
    setDial((a) => [...a, Math.max(5, Math.min(95, a[a.length - 1] + rr.fx * 160))]);
    cheer.current = rr.good ? (kind === "zinger" ? 1.4 : 0.7) : 0; sfx(rr.good ? (kind === "zinger" ? "crowd" : "good") : "boo");
    setStage("rebutted");
  };
  const next = () => {
    setPick(null); setLast(null); setReb(null);
    if (k + 1 < rounds.length) { setK(k + 1); setStage("q"); sfx("bell"); }
    else { const res = E.finishDebate(c, x.current, tot.me, tot.op); setSnap(res); setStage("snap"); sfx(res.won ? "fanfare" : "lose"); cheer.current = res.won ? 1.5 : 0; }
  };

  const dialPath = dial.map((v, i) => `${i ? "L" : "M"}${(i * 300) / Math.max(8, dial.length - 1)} ${60 - (v - 50) * 1.1}`).join(" ");
  return (
    <div className="px-debate">
      <div className="px-dhead"><span className="px-live"><i />Live</span><b>{deb ? `${deb.where} debate` : `${r.state} debate`}</b><span>{deb ? deb.date : `Week ${s.week}`} · Question {Math.min(k + 1, rounds.length)} of {rounds.length}</span></div>
      <div className="px-stage"><canvas ref={cv} width={192} height={108} className="px-stagecv" aria-label="The debate stage" />
        <div className="px-names"><span className={meP.toLowerCase()}>{sur(c.me.name)}</span><span className={opP.toLowerCase()}>{sur(c.op.name)}</span></div>
      </div>
      <div className="px-dbox">
        {stage === "intro" ? (
          <div className="px-say"><b className="who">Moderator</b><p><Type text={`Good evening and welcome to the ${deb?.where ?? r.state} debate for ${r.name}. ${c.me.name} and ${c.op.name}, you each get one answer and one comeback per question. Let us begin.`} /></p>
            <button type="button" className="px-btn go" onClick={() => { setStage("q"); sfx("bell"); }}>Take the stage</button></div>
        ) : null}
        {stage === "q" && q ? (
          <div className="px-say"><b className="who">Moderator{q.real ? <em className="px-real">Real issue</em> : null}</b><p><Type key={k} text={q.q} onDone={() => {}} /></p>
            <button type="button" className="px-btn go" onClick={() => setStage("pick")}>Answer</button></div>
        ) : null}
        {stage === "pick" && q ? (
          <div className="px-opts">{q.opts.map((o, i) => <button key={i} type="button" className="px-opt" onClick={() => { setPick(i); setStage("deliver"); sfx("card"); }}><b>{o.label}</b><span>{o.say}</span></button>)}</div>
        ) : null}
        {stage === "deliver" && q && pick != null ? (
          <div className="px-deliver">
            <p className="px-k">Delivery: stop the cursor in the gold zone. Space bar or click. Prep {x.current.prep} widens the zone{x.current.stamina < 35 ? "; you are tired, so it moves faster" : ""}.</p>
            <button type="button" className="px-meter" onClick={deliver} aria-label="Deliver the answer">
              <i className="zone" style={{ left: `${(zone.current.at - zone.current.w / 2) * 100}%`, width: `${zone.current.w * 100}%` }} />
              <i className="cur" style={{ left: `${cur * 100}%` }} />
            </button>
          </div>
        ) : null}
        {stage === "landed" && last && q && pick != null ? (
          <div className="px-say"><b className="who me">{c.me.name}</b><p>&quot;{q.opts[pick].say}&quot;</p>
            <div className="px-verdict"><span className={last.dl > 0.7 ? "up" : last.dl < 0.4 ? "dn" : ""}>{last.t}</span><b className={last.fx >= 0 ? "up" : "dn"}>{fxs(last.fx)}</b></div>
            <button type="button" className="px-btn go" onClick={oppTurn}>{sur(c.op.name)} responds</button></div>
        ) : null}
        {stage === "opp" && q ? (
          <div className="px-say"><b className="who op">{c.op.name}</b><p><Type text={`"${q.opp}"`} /></p>
            <button type="button" className="px-btn go" onClick={() => setStage("rebut")}>Your comeback</button></div>
        ) : null}
        {stage === "rebut" ? (
          <div className="px-opts">
            <button type="button" className="px-opt" onClick={() => rebut("counter")}><b>Counter with facts</b><span>Safe and solid{x.current.staff.oppo ? ", and your opposition research gives you the exact vote" : ""}.</span></button>
            <button type="button" className="px-opt hot" onClick={() => rebut("zinger")}><b>Go for the zinger</b><span>Big if it lands. A clip that haunts you if it does not. Prep and research help.</span></button>
            <button type="button" className="px-opt" onClick={() => rebut("calm")}><b>Stay above it</b><span>Look steady and let it pass.</span></button>
          </div>
        ) : null}
        {stage === "rebutted" && reb ? (
          <div className="px-say"><b className="who me">{c.me.name}</b><p>{reb.t}</p>
            <div className="px-verdict"><span className={reb.good ? "up" : "dn"}>{reb.good ? "Landed" : "Backfired"}</span><b className={reb.fx >= 0 ? "up" : "dn"}>{fxs(reb.fx)}</b></div>
            <button type="button" className="px-btn go" onClick={next}>{k + 1 < rounds.length ? "Next question" : "Closing statements"}</button></div>
        ) : null}
        {stage === "snap" && snap ? (
          <div className="px-say center"><b className="who">Snap poll: who won the debate?</b>
            <div className="px-snap"><span className={meP.toLowerCase()} style={{ width: `${Math.max(8, Math.min(92, snap.snap))}%` }}>{sur(c.me.name)} {snap.snap}%</span><span className={opP.toLowerCase()}>{sur(c.op.name)} {100 - snap.snap}%</span></div>
            <p>{snap.won ? "The spin room is yours. Expect a bump and a fired up base." : "A rough night. Your team is already working the spin room."} <b className={snap.fx >= 0 ? "up" : "dn"}>{fxs(snap.fx)} points</b></p>
            <button type="button" className="px-btn go" onClick={() => onDone(x.current)}>Back to the trail</button></div>
        ) : null}
      </div>
      <div className="px-dial" aria-label="Live dial of undecided voters">
        <span className="px-k">Undecided voters, live dial</span>
        <svg viewBox="0 0 300 120" preserveAspectRatio="none"><line x1="0" x2="300" y1="60" y2="60" className="mid" /><path d={dialPath} className={cls("ln", dial[dial.length - 1] >= 50 ? "up" : "dn")} /></svg>
      </div>
    </div>
  );
}
