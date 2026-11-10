"use client";
// Shared pieces for Campaign 2028: the game state, saves, small widgets, the horse race and the trend chart.
import React, { useEffect, useRef } from "react";
import * as E from "./engine28";
import { figure, paintGrid, seedOf } from "../px/sprites";
import { portrait28, figure28 } from "./sprites28";
import { cls } from "../px/ui";

export type Mode = "primary" | "full" | "general";
export type Phase = "primary" | "convention" | "vp" | "general" | "night" | "recount" | "hundred" | "over";
export type Game = { v: 28; mode: Mode; phase: Phase; party: E.Party; me: string; diff: E.Diff; seed: number; rng: number; third: string | null; op?: string; opVp?: string | null;
  P?: E.PrimS; Gn?: E.GenS; seen: string[]; log: E.LogItem[]; lost?: string; night?: E.NightRes; trophies?: string[]; mgr?: E.Mgr; len?: number; plong?: boolean;
  scen?: string; hard?: boolean; iron?: boolean; daily?: number; legacy?: number; speech?: string; hund?: import("./more28").Hundred; logged?: boolean };
const KEY = "opp_play28_v3";
export function load28(): Game | null { try { const j = localStorage.getItem(KEY); return j ? (JSON.parse(j) as Game) : null; } catch { return null; } }
export function save28(g: Game | null) { try { if (g) localStorage.setItem(KEY, JSON.stringify(g)); else localStorage.removeItem(KEY); } catch { /* storage blocked */ } }
export const FEMALE = new Set(["Harris", "Ocasio-Cortez", "Whitmer", "Crockett", "Hinojosa", "Klobuchar", "Haley", "Huckabee Sanders", "Greene", "Noem", "Stefanik", "Candace Owens"]);
export const pct = (p: number) => `${Math.round(p * 100)}%`;
export const ptsLead = (m: number, me: string, op: string) => (Math.abs(m) < 0.05 ? "Even" : m > 0 ? `${me} +${m.toFixed(1)}` : `${op} +${Math.abs(m).toFixed(1)}`);
export const short = (s: string, n = 140) => (s.length > n ? s.slice(0, n - 1).replace(/[ ,;]+\S*$/, "") + "…" : s);
export const firstSentence = (s: string) => (s.split(/(?<=\.)\s/)[0] ?? s);

export function Pips({ n, max, tone }: { n: number; max: number; tone?: string }) {
  return <b className="px-pips">{Array.from({ length: max }, (_, i) => <i key={i} className={i < n ? cls("f", tone) : ""} />)}</b>;
}
export function DaysBar({ n }: { n: number }) {
  return <b className="px-days" aria-label={`${E.DAYS - n} of ${E.DAYS} half days used`}>{Array.from({ length: E.DAYS / 2 }, (_, d) => <span key={d}>{[0, 1].map((h) => <i key={h} className={d * 2 + h < n ? "f" : ""} />)}</span>)}</b>;
}
/** The delegate race: a stacked bar by candidate, with the majority line. */
export function DelBar({ d, P }: { d: E.Data; P: E.PrimS }) {
  const tot = d.primary[P.party].total; const col = (n: string) => d.cands[P.party].find((c) => c.n === n)?.c ?? "#888";
  const rows = P.field.slice().sort((a, b) => b.del - a.del);
  return (
    <div className="y28-delbar" aria-label="Delegates won">
      <div className="bar">{rows.map((r) => r.del > 0 ? <i key={r.n} style={{ width: `${(100 * r.del) / tot}%`, background: col(r.n) }} title={`${r.n} ${r.del}`} /> : null)}<em style={{ left: "50%" }} aria-hidden="true" /></div>
      <span className="px-k">{Math.floor(tot / 2) + 1} delegates to win · {tot.toLocaleString()} pledged</span>
    </div>
  );
}
/** The electoral college bar: your states from the left, theirs from the right, shaded by how safe. */
export function EVBar({ d, ms, me, op, mine }: { d: E.Data; ms: number[]; me: string; op: string; mine: E.Party }) {
  const tiers = [15, 7, 3, 0]; const sum = (f: (m: number) => boolean) => d.states.reduce((a, x, i) => a + (f(ms[i]) ? x.ev : 0), 0);
  const my = tiers.map((t, k) => sum((m) => m > t && (k === 0 || m <= tiers[k - 1])));
  const th = tiers.map((t, k) => sum((m) => -m >= t && (k === 0 || -m < tiers[k - 1]) && m !== 0));
  const cm = mine === "D" ? ["#13308f", "#2a5ee8", "#5b8cff", "#a9c2ff"] : ["#8f1028", "#e0284b", "#ff6f8a", "#ffbdc9"];
  const co = mine === "D" ? ["#8f1028", "#e0284b", "#ff6f8a", "#ffbdc9"] : ["#13308f", "#2a5ee8", "#5b8cff", "#a9c2ff"];
  const a = my.reduce((x, y) => x + y, 0), b = th.reduce((x, y) => x + y, 0);
  return (
    <div className="y28-evbar">
      <div className="lab"><b>{me} {a}</b><span>270 to win</span><b>{b} {op}</b></div>
      <div className="bar">{my.map((v, k) => <i key={`a${k}`} style={{ width: `${(100 * v) / 538}%`, background: cm[k] }} />)}<span className="gap" />{th.slice().reverse().map((v, k) => <i key={`b${k}`} style={{ width: `${(100 * v) / 538}%`, background: co[3 - k] }} />)}<em aria-hidden="true" /></div>
    </div>
  );
}
/** The horse race: every candidate runs down a track, as far along as their share of the delegates needed. */
export function HorseRace({ d, P }: { d: E.Data; P: E.PrimS }) {
  const cv = useRef<HTMLCanvasElement>(null); const live = useRef(P); useEffect(() => { live.current = P; });
  useEffect(() => {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!; let raf = 0;
    const W = 160, need = Math.floor(d.primary[P.party].total / 2) + 1;
    const frames = new Map<string, (string | null)[][][]>();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop); const S = live.current; const rows = S.field; const H = 10 + rows.length * 16;
      if (c.height !== H) c.height = H;
      g.fillStyle = "#1d1238"; g.fillRect(0, 0, W, H);
      rows.forEach((r, k) => {
        const y = 4 + k * 16; g.fillStyle = k % 2 ? "#26184a" : "#2f1f5a"; g.fillRect(0, y, W, 16);
        g.fillStyle = "#4a3a80"; for (let x = 0; x < W; x += 6) g.fillRect(x, y + 15, 3, 1);
        const col = d.cands[S.party].find((x) => x.n === r.n)?.c ?? "#888";
        if (!frames.has(r.n)) { const h = seedOf(r.n); frames.set(r.n, [figure(h, S.party, 0), figure(h, S.party, 1)]); }
        const x = 6 + Math.min(1, r.del / need) * (W - 26); const fr = frames.get(r.n)!;
        g.fillStyle = col; g.fillRect(2, y + 2, 2, 12);
        if (!r.alive) g.globalAlpha = 0.35;
        paintGrid(g, fr[r.alive && Math.floor(t / 180 + k) % 2 ? 1 : 0], Math.round(x), y + 1);
        g.globalAlpha = 1;
      });
      g.fillStyle = "#ffcc4d"; g.fillRect(W - 12, 0, 2, H); for (let y = 0; y < H; y += 4) { g.fillStyle = (y / 4) % 2 ? "#000" : "#fff6e0"; g.fillRect(W - 10, y, 2, 2); }
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [d, P.party]);
  return <canvas ref={cv} width={160} height={10 + P.field.length * 16} className="y28-race" aria-hidden="true" />;
}
/** Win chance and electoral votes across the weeks, in pixels. */
export function Trend({ pts, h = 60 }: { pts: { w: number; p: number; ev: number }[]; h?: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = cv.current; if (!c) return; const g = c.getContext("2d")!; const W = 160, H = h;
    g.fillStyle = "#1d1238"; g.fillRect(0, 0, W, H);
    g.fillStyle = "#4a3a80"; for (let x = 0; x < W; x += 3) g.fillRect(x, Math.round(H / 2), 1, 1);
    const X = (w: number) => 4 + (w / 10) * (W - 8);
    const draw = (f: (q: { p: number; ev: number }) => number, col: string) => { g.fillStyle = col; for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k]; const n = 12; for (let j = 0; j <= n; j++) { const x = X(a.w + ((b.w - a.w) * j) / n), y = f(a) + (f(b) - f(a)) * (j / n); g.fillRect(Math.round(x), Math.round(H - 3 - y * (H - 6)), 2, 2); } } };
    draw((q) => q.p, "#ffcc4d"); draw((q) => q.ev / 538, "#41e08f");
  }, [pts, h]);
  return <canvas ref={cv} width={160} height={h} className="y28-trend" aria-label="Your win chance in gold and electoral votes in green, week by week" role="img" />;
}
/** The cable news crawl across the top of headquarters. */
export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const line = items.map((s) => s.replace(/\s+/g, " ")).join("   ·   ");
  return <div className="y28-ticker" aria-label="Latest news"><b>Live</b><div className="crawl"><span>{line}   ·   {line}</span></div></div>;
}

/** The 2028 portrait: 40 by 40, shaded, blinking and talking. */
export function Face28({ seed, party, size = 64, female, talking = false, role = "cand", className }: { seed: number; party: string; size?: number; female?: boolean; talking?: boolean; role?: "cand" | "staff" | "moderator"; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null); const talk = useRef(talking);
  useEffect(() => { talk.current = talking; }, [talking]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const g = cv.getContext("2d")!;
    const frames = [0, 1, 2].map((f) => portrait28(seed, party, f, female, role)); let raf = 0, last = -1;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); const blink = t % 3700 < 130; const mouth = talk.current && Math.floor(t / 120) % 2 === 1; const f = blink ? 2 : mouth ? 1 : 0; if (f === last) return; last = f; g.clearRect(0, 0, 40, 40); paintGrid(g, frames[f], 0, 0); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [seed, party, female, role]);
  return <canvas ref={ref} width={40} height={40} className={cls("px-portrait y28-face", className)} style={{ width: size, height: size }} aria-hidden="true" />;
}
/** The 2028 debate stage figure: 16 by 32. */
export function Body28({ seed, party, female, talking = false, scale = 4, flip = false }: { seed: number; party: string; female?: boolean; talking?: boolean; scale?: number; flip?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null); const talk = useRef(talking);
  useEffect(() => { talk.current = talking; }, [talking]);
  useEffect(() => {
    const cv = ref.current; if (!cv) return; const g = cv.getContext("2d")!;
    const fr = [figure28(seed, party, 0, female), figure28(seed, party, 1, female)]; let raf = 0, last = -1;
    const loop = (t: number) => { raf = requestAnimationFrame(loop); const f = talk.current && Math.floor(t / 220) % 2 ? 1 : 0; if (f === last) return; last = f; g.clearRect(0, 0, 16, 32); paintGrid(g, fr[f], 0, 0, flip); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [seed, party, female, flip]);
  return <canvas ref={ref} width={16} height={32} className="px-fig" style={{ width: 16 * scale, height: 32 * scale }} aria-hidden="true" />;
}
