"use client";
// The polling room: every poll as a dot sized by its sample, with its margin of error, the campaign's running average
// with a band for how far off polls can be, a cone forward to Election Day that narrows as the weeks run out, and the
// campaign's own odds. The band is the honest part: polls in every race share an error, and you only learn its size
// on election night.
import React, { useMemo, useState } from "react";
import * as E from "../engine";
import { cls, sur } from "./ui";

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
  const band = (pts: { w: number; m: number; sd: number }[], z: number) => pts.length ? `M${pts.map((p) => `${X(p.w).toFixed(1)},${Y(p.m + z * p.sd).toFixed(1)}`).join("L")}L${[...pts].reverse().map((p) => `${X(p.w).toFixed(1)},${Y(p.m - z * p.sd).toFixed(1)}`).join("L")}Z` : "";
  const line = (pts: { w: number; m: number }[]) => (pts.length ? `M${pts.map((p) => `${X(p.w).toFixed(1)},${Y(p.m).toFixed(1)}`).join("L")}` : "");
  const ticks = Array.from({ length: L + 2 }, (_, w) => w).filter((w) => L <= 8 || w % 2 === 0 || w === L + 1);
  const grid = [lo, ...[-10, -5, 0, 5, 10].filter((v) => v > lo && v < hi), hi].filter((v, i, a) => a.indexOf(v) === i);
  const hp = hov != null ? s.polls[hov] : null;
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
      <svg className="px-pc2" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Polls of the race by week, with the average and its uncertainty" shapeRendering="crispEdges" onMouseLeave={() => setHov(null)}>
        <defs>
          <pattern id="px-hatch" width="4" height="4" patternUnits="userSpaceOnUse"><rect width="4" height="4" fill="transparent" /><rect width="1" height="1" className="hatch" /></pattern>
        </defs>
        <rect x={PL} y={Y(hi)} width={W - PL - PR} height={Y(0) - Y(hi)} className="zone me" />
        <rect x={PL} y={Y(0)} width={W - PL - PR} height={Y(lo) - Y(0)} className="zone op" />
        {grid.map((v) => <g key={v}><line x1={PL} x2={W - PR} y1={Y(v)} y2={Y(v)} className={v === 0 ? "z" : "g"} /><text x={PL - 4} y={Y(v) + 2} textAnchor="end" className="ax">{v === 0 ? "0" : `${v > 0 ? "+" : ""}${v}`}</text></g>)}
        {ticks.map((w) => <text key={w} x={X(w)} y={H - 8} textAnchor="middle" className={cls("ax", w === s.week && "now")}>{w === 0 ? "S" : w === L + 1 ? "ED" : w}</text>)}
        <line x1={X(L + 1)} x2={X(L + 1)} y1={PT} y2={H - PB} className="ed" />
        {cone.length > 1 ? <path d={band(cone, 1.96)} className="cone" /> : null}
        {cone.length > 1 ? <path d={band(cone, 1.96)} fill="url(#px-hatch)" /> : null}
        <path d={band(avg, 1.96)} className="band" />
        <path d={band(avg, 1)} className="band in" />
        <path d={line(avg)} className="avg" />
        {cone.length > 1 ? <path d={line(cone)} className="avg fut" /> : null}
        {s.polls.map((p, i) => {
          const x = X(p.w) + ((i * 7) % 11) - 5, y = Y(p.m), r = Math.max(1.6, Math.min(4, Math.sqrt(p.n) / 9)), e = moe(p.n);
          return (
            <g key={i} onMouseEnter={() => setHov(i)} className={cls("pt", p.internal ? "int" : "pub", hov === i && "on")}>
              <line x1={x} x2={x} y1={Y(p.m + e)} y2={Y(p.m - e)} className="err" />
              <rect x={x - r} y={y - r} width={r * 2} height={r * 2} />
              <rect x={x - 6} y={y - 8} width={12} height={16} fill="transparent" />
            </g>
          );
        })}
        {last ? <text x={X(last.w) + 4} y={Y(last.m) - 4} className="lbl">{last.m >= 0 ? sur(me) : sur(op)} +{Math.abs(last.m).toFixed(1)}</text> : null}
      </svg>
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
