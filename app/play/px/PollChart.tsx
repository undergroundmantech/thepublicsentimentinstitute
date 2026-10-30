"use client";
// The polling room: every poll as a dot sized by its sample, with its margin of error, the campaign's running average
// with a band for how far off polls can be, a cone forward to Election Day that narrows as the weeks run out, and the
// campaign's own odds. The band is the honest part: polls in every race share an error, and you only learn its size
// on election night.
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as E from "../engine";
import { cls, sur } from "./ui";
import { grid, line as pline, box, band as pband, at } from "./pxdraw";

// the chart is painted on a half resolution pixel grid and scaled up, so lines step and bands dither; the labels and
// the hover targets sit in a transparent layer on top, in the game's pixel font
const S = 2;
const C = { me: "#0f2620", op: "#2a0f1d", g: "#21173f", z: "#4a3a80", band: "#7a6326", bandIn: "#a8862e", cone: "#3a3166", avg: "#ffcc4d", fut: "#c98f1c", int: "#ffcc4d", pub: "#fff6e0", err: "#6f63a3", ed: "#ffcc4d", on: "#41e08f" };

const W = 340, H = 168, PL = 30, PR = 10, PT = 12, PB = 22;

export default function PollChart({ s, me, op, compact = false }: { s: E.State; me: string; op: string; compact?: boolean }) {
  const L = E.lenOf(s), now = Math.min(s.week, L + 1);
  const [hov, setHov] = useState<number | null>(null);
  const odds = E.winOdds(s);
  // the running average at each week, from the polls of the three weeks before it, newest weighted most
  const avg = useMemo(() => {
    const out: { w: number; m: number; sd: number }[] = [];
    for (let w = 0; w < now; w++) {
      const ps = s.polls.filter((p) => p.w <= w && p.w >= w - 3);
      if (!ps.length) continue;
      let a = 0, k = 0, n = 0;
      for (const p of ps) { const q = (p.internal ? 1.6 : 1) * Math.pow(0.7, w - p.w); a += q * p.m; k += q; n += p.n; }
      const sampling = 196 / Math.sqrt(Math.max(300, n)) / 1.96; // one standard error of the pooled margin
      out.push({ w, m: a / k, sd: Math.sqrt(sampling ** 2 + 2.4 ** 2) });
    }
    return out;
  }, [s.polls, now]);
  const vals = [...s.polls.map((p) => p.m), ...avg.map((a) => a.m + 1.3 * a.sd), ...avg.map((a) => a.m - 1.3 * a.sd), 0];
  const lo = Math.floor(Math.min(-6, ...vals) - 1), hi = Math.ceil(Math.max(6, ...vals) + 1);
  const X = (w: number) => PL + (w * (W - PL - PR)) / (L + 1), Y = (m: number) => PT + ((hi - m) * (H - PT - PB)) / (hi - lo);
  const last = avg[avg.length - 1];
  // the cone ahead: today's average, with uncertainty that shrinks to the shared polling error on Election Day
  const cone = last ? Array.from({ length: L + 2 - last.w }, (_, j) => { const w = last.w + j; const left = Math.max(0, L + 1 - w); return { w, m: last.m, sd: Math.sqrt(2.4 ** 2 + 0.55 * left + (last.sd ** 2 - 2.4 ** 2)) }; }) : [];
  const ticks = Array.from({ length: L + 2 }, (_, w) => w).filter((w) => L <= 8 || w % 2 === 0 || w === L + 1);
  const grid0 = [lo, ...[-10, -5, 0, 5, 10].filter((v) => v > lo && v < hi), hi].filter((v, i, a) => a.indexOf(v) === i);
  const hp = hov != null ? s.polls[hov] : null;
  const cv = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const gw = W / S, gh = H / S, g = grid(cv.current, gw, gh); if (!g) return;
    const x = (w: number) => X(w) / S, y = (m: number) => Y(m) / S, l = PL / S, rr = (W - PR) / S;
    box(g, 0, 0, gw, gh, "#0b0619");
    box(g, l, y(hi), rr - l, y(0) - y(hi), C.me); box(g, l, y(0), rr - l, y(lo) - y(0), C.op);
    for (const v of grid0) pline(g, l, y(v), rr, y(v), v === 0 ? C.z : C.g, v === 0 ? [2, 2] : undefined);
    const P = (pts: { w: number; m: number; sd: number }[], z: number): [[number, number][], [number, number][]] => [pts.map((p) => [x(p.w), y(p.m + z * p.sd)]), pts.map((p) => [x(p.w), y(p.m - z * p.sd)])];
    if (cone.length > 1) { const [t, b] = P(cone, 1.96); pband(g, x(cone[0].w), x(cone[cone.length - 1].w), (c) => at(t, c), (c) => at(b, c), C.cone, true); }
    if (avg.length > 1) { const [t, b] = P(avg, 1.96), [ti, bi] = P(avg, 1); pband(g, x(avg[0].w), x(avg[avg.length - 1].w), (c) => at(t, c), (c) => at(b, c), C.band, true); pband(g, x(avg[0].w), x(avg[avg.length - 1].w), (c) => at(ti, c), (c) => at(bi, c), C.bandIn, true); }
    pline(g, x(L + 1), PT / S, x(L + 1), (H - PB) / S, C.ed, [1, 1]);
    for (let i = 1; i < avg.length; i++) pline(g, x(avg[i - 1].w), y(avg[i - 1].m), x(avg[i].w), y(avg[i].m), C.avg);
    for (let i = 1; i < cone.length; i++) pline(g, x(cone[i - 1].w), y(cone[i - 1].m), x(cone[i].w), y(cone[i].m), C.fut, [1, 1]);
    s.polls.forEach((p, i) => {
      const px0 = (X(p.w) + ((i * 7) % 11) - 5) / S, e = moe(p.n), r = Math.max(1, Math.min(2, Math.round(Math.sqrt(p.n) / 18)));
      pline(g, px0, y(p.m + e), px0, y(p.m - e), hov === i ? C.on : C.err, [1, 1]);
      box(g, px0 - r + 0.5, y(p.m) - r + 0.5, r * 2, r * 2, hov === i ? C.on : p.internal ? C.int : C.pub);
    });
  });
  const moe = (n: number) => 196 / Math.sqrt(Math.max(100, n)); // margin of error on the lead, about twice the share's
  return (
    <div className={cls("px-pollroom", compact && "compact")}>
      <div className="px-pr-head">
        <div><span className="px-k">Your poll average</span><b className={last ? (last.m >= 0 ? "up" : "dn") : ""}>{last ? E.lead(last.m, sur(me), sur(op)) : "No polls"}</b>{last ? <small>±{(1.96 * last.sd).toFixed(1)} pts, 95% of the time</small> : null}</div>
        {odds ? (
          <div className="px-odds" aria-label={`Your campaign's odds: ${Math.round(odds.p * 100)} percent`}>
            <span className="px-k">Your odds, as your team sees it</span>
            <span className="bar"><i style={{ width: `${Math.round(odds.p * 100)}%` }} /></span>
            <b className={odds.p >= 0.5 ? "up" : "dn"}>{Math.round(odds.p * 100)}%</b>
          </div>
        ) : null}
      </div>
      <div className="px-pcwrap">
        <canvas ref={cv} className="px-pcv" aria-hidden="true" />
        <svg className="px-pc2 top" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Polls of the race by week, with the average and its uncertainty" onMouseLeave={() => setHov(null)}>
          {grid0.map((v) => <text key={v} x={PL - 4} y={Y(v) + 2} textAnchor="end" className="ax">{v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`}</text>)}
          {ticks.map((w) => <text key={w} x={X(w)} y={H - 8} textAnchor="middle" className={cls("ax", w === s.week && "now")}>{w === 0 ? "S" : w === L + 1 ? "ED" : w}</text>)}
          {s.polls.map((p, i) => { const x = X(p.w) + ((i * 7) % 11) - 5, y = Y(p.m); return <rect key={i} x={x - 6} y={y - 8} width={12} height={16} fill="transparent" onMouseEnter={() => setHov(i)} />; })}
          {last ? <text x={X(last.w) + 4} y={Y(last.m) - 5} className="lbl">{last.m >= 0 ? sur(me) : sur(op)} +{Math.abs(last.m).toFixed(1)}</text> : null}
        </svg>
      </div>
      {!compact ? (
        <div className="px-pr-foot">
          {hp ? <span className="px-pr-hov"><b>{hp.src}</b>, {hp.w === 0 ? "before the campaign" : `week ${hp.w}`}: {E.lead(hp.m, sur(me), sur(op))}, {hp.n.toLocaleString()} voters, margin of error ±{moe(hp.n).toFixed(1)} on the lead{hp.internal ? ". Your own poll." : "."}</span>
            : <span className="px-pr-hov">Point at a poll. Gold squares are your pollster, white are public polls; the size is the sample.</span>}
          <span className="px-pr-leg"><span><i className="sw-avg" />Average</span><span><i className="sw-band" />Where the race could really be</span><span><i className="sw-cone" />Range on Election Day</span></span>
          <small className="px-note">Polls in a race tend to miss together, by 2 to 3 points on average and sometimes by much more, and nobody knows which way until the votes are counted. The band includes that shared miss, which no amount of polling removes. Your canvassers and field offices are not polls, so their county reads do not share it.</small>
        </div>
      ) : null}
    </div>
  );
}
