"use client";
// A 2028 presidential primary: every candidate any national poll has named, the On Point average for each, the line
// over time and every poll. Candidates share a party, so they are told apart by shades of that party's color.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import type { PrimaryBuilt } from "./build";

const fmt = (iso: string, o: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", o);
const W = 900, H = 340, PL = 34, PR = 112, PT = 14, PB = 28;

function Chart({ b, on }: { b: PrimaryBuilt; on: boolean[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const t0 = new Date(b.daily[0].date).getTime(), t1 = new Date(b.daily[b.daily.length - 1].date).getTime();
  const vis = b.cands.map((_, i) => i).filter((i) => on[i]);
  const top = Math.max(10, ...b.daily.flatMap((d) => vis.map((i) => d.v[i] ?? 0)));
  const yMax = Math.ceil(top / 10) * 10;
  const X = (iso: string) => PL + ((new Date(iso).getTime() - t0) / Math.max(1, t1 - t0)) * (W - PL - PR);
  const Y = (v: number) => PT + (1 - v / yMax) * (H - PT - PB);
  const path = (i: number) => {
    let d = "", pen = false;
    for (const r of b.daily) { const v = r.v[i]; if (v == null) { pen = false; continue; } d += `${pen ? "L" : "M"}${X(r.date).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; }
    return d;
  };
  // end labels, nudged apart so they do not sit on each other
  const ends = vis.map((i) => { const last = [...b.daily].reverse().find((r) => r.v[i] != null); return { i, y: last ? Y(last.v[i]!) : -99, v: last?.v[i] ?? null, cur: last === b.daily[b.daily.length - 1] }; })
    .filter((e) => e.v != null && e.cur).sort((a, c) => a.y - c.y);
  for (let k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
  const ticks = Array.from({ length: yMax / 10 + 1 }, (_, k) => k * 10);
  const years: string[] = [];
  for (let y = new Date(b.daily[0].date).getFullYear() + 1; y <= new Date(b.daily[b.daily.length - 1].date).getFullYear(); y++) years.push(`${y}-01-01`);
  const hv = hover != null ? b.daily[hover] : null;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W;
    let best = 0, bd = 1e9; b.daily.forEach((d, k) => { const dx = Math.abs(X(d.date) - x); if (dx < bd) { bd = dx; best = k; } }); setHover(best);
  };
  return (
    <div className="pf-chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${b.title}, On Point average over time`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((t) => <g key={t}><line x1={PL} x2={W - PR} y1={Y(t)} y2={Y(t)} className="g" /><text x={PL - 6} y={Y(t) + 4} className="ax" textAnchor="end">{t}</text></g>)}
        {years.map((y) => <g key={y}><line x1={X(y)} x2={X(y)} y1={PT} y2={H - PB} className="yr" /><text x={X(y) + 4} y={H - 9} className="ax">{y.slice(0, 4)}</text></g>)}
        {vis.slice().reverse().map((i) => <path key={i} d={path(i)} stroke={b.cands[i].color} className={`ln${i < 3 ? " lead" : ""}`} />)}
        {ends.map((e) => <text key={e.i} x={W - PR + 8} y={e.y + 4} className="end" fill={b.cands[e.i].color}>{b.cands[e.i].key} {e.v!.toFixed(1)}</text>)}
        {hv ? <line x1={X(hv.date)} x2={X(hv.date)} y1={PT} y2={H - PB} className="cross" /> : null}
      </svg>
      {hv ? (
        <div className="pf-tip" style={{ left: `${Math.min(70, Math.max(2, (X(hv.date) / W) * 100 - 14))}%` }}>
          <b>{fmt(hv.date)}</b>
          {vis.filter((i) => hv.v[i] != null).sort((a, c) => (hv.v[c] ?? 0) - (hv.v[a] ?? 0)).slice(0, 8).map((i) => <span key={i}><i style={{ background: b.cands[i].color }} />{b.cands[i].key}<em>{hv.v[i]!.toFixed(1)}</em></span>)}
        </div>
      ) : null}
    </div>
  );
}

export default function PrimaryField({ b, other }: { b: PrimaryBuilt; other: { href: string; label: string } }) {
  const current = b.cands.filter((c) => c.now != null);
  const [on, setOn] = useState<boolean[]>(() => b.cands.map((c, i) => i < 6 && c.now != null));
  const [all, setAll] = useState(false);
  const [rows, setRows] = useState(20);
  const leader = current[0], second = current[1];
  const max = Math.max(...current.map((c) => c.now ?? 0), 1);
  const cols = useMemo(() => b.cands.map((c) => c.key), [b]);
  const toggle = (i: number) => setOn((o) => o.map((x, k) => (k === i ? !x : x)));
  const showAll = () => { const next = !all; setAll(next); setOn(b.cands.map((c, i) => (next ? c.now != null : i < 6 && c.now != null))); };
  const partyWord = b.party === "R" ? "Republican" : "Democratic";
  return (
    <div className={`opp pf pf-${b.party}`}>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span>
        <Link href="/polls/2028">2028</Link><span className="sep">/</span><span>{b.short}</span>
      </nav>
      <header className="ph">
        <div className="eye g">2028 presidential primary · national</div>
        <h1>The {partyWord} <em>field</em></h1>
        <p className="lede">{leader ? <>{leader.key} leads at {leader.now!.toFixed(1)} percent{second ? <>, {(leader.now! - second.now!).toFixed(1)} points ahead of {second.key}</> : null}, in the On Point average of {b.polls.length} national polls from {b.pollsters} pollsters. Every candidate any poll has named is below.</> : "No current polling."}</p>
        <div className="pmeta"><span><b className="mono">{b.polls.length}</b> polls</span><span>Latest poll <b>{fmt(b.updated)}</b></span><span><b className="mono">{b.cands.length}</b> candidates named</span><Link className="pill" href={other.href}>{other.label}</Link></div>
      </header>

      <section className="card pf-board" aria-labelledby="pf-board-h">
        <div className="card-h"><h3 id="pf-board-h">Every candidate</h3><span className="eye" style={{ marginLeft: "auto" }}>On Point average today</span></div>
        <ol className="pf-list">
          {b.cands.map((c, i) => (
            <li key={c.key} className={c.now == null ? "off" : ""}>
              <span className="rk">{c.now == null ? "" : i + 1}</span>
              <button type="button" className={`nm${on[i] ? " on" : ""}`} onClick={() => toggle(i)} disabled={c.now == null} aria-pressed={on[i]} title={c.now == null ? undefined : on[i] ? "Hide on the chart" : "Show on the chart"}>
                <i style={{ background: c.color }} />{c.key}
              </button>
              <span className="bar">{c.now != null ? <s style={{ width: `${(c.now / max) * 100}%`, background: c.color }} /> : null}</span>
              <b className="v">{c.now != null ? `${c.now.toFixed(1)}%` : "n/a"}</b>
              <span className="meta">{c.polls} {c.polls === 1 ? "poll" : "polls"}{c.now == null ? ` · last asked ${fmt(c.lastAsked, { month: "short", year: "numeric" })}` : ` · peak ${c.peak.toFixed(1)}`}</span>
            </li>
          ))}
        </ol>
        <p className="pf-note">A candidate gets an average once polls ask about them, and keeps it while a poll in the last 150 days has asked. Names no recent poll has asked about are listed with when they were last asked.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>The average over time</h3><button type="button" className="btn sm" style={{ marginLeft: "auto" }} onClick={showAll} aria-pressed={all}>{all ? "Leaders only" : `Show all ${current.length}`}</button></div>
        <div className="card-b"><Chart b={b} on={on} /></div>
        <p className="pf-note">Tap a name in the list to add or remove its line.</p>
      </section>

      <section className="card">
        <div className="card-h"><h3>Every poll</h3><span className="eye" style={{ marginLeft: "auto" }}>Newest first · as published</span></div>
        <div className="tblwrap">
          <table className="tbl pf-tbl">
            <thead><tr><th>Pollster</th><th>Grade</th><th className="n">Dates</th><th className="n">Sample</th>{cols.map((k) => <th key={k} className="n">{k}</th>)}</tr></thead>
            <tbody>
              <tr className="avg"><td>On Point average</td><td /><td className="n">{fmt(b.updated)}</td><td className="n">{b.polls.length} polls</td>{b.cands.map((c) => <td key={c.key} className="n">{c.now != null ? c.now.toFixed(1) : ""}</td>)}</tr>
              {b.polls.slice(0, rows).map((p, r) => {
                const vals = cols.map((k) => p.v[k]);
                const top = Math.max(...vals.filter((x) => Number.isFinite(x)) as number[]);
                return (
                  <tr key={`${p.pollster}-${p.end}-${r}`}>
                    <td className="who">{p.pollster}{p.gold ? <span className="gs">Gold</span> : null}</td>
                    <td className="mono">{p.grade}</td>
                    <td className="n">{p.start && p.start !== p.end ? `${fmt(p.start, { month: "short", day: "numeric" })} to ` : ""}{fmt(p.end)}</td>
                    <td className="n">{p.imputed ? <span title="Not published with the listing; the pollster's usual sample is used">~{p.n.toLocaleString("en-US")}</span> : p.n.toLocaleString("en-US")}<span className="ty">{p.type}</span></td>
                    {vals.map((v, k) => <td key={cols[k]} className={`n${v === top ? " top" : ""}`}>{Number.isFinite(v) ? v : ""}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {b.polls.length > rows ? <div className="pf-fold"><button type="button" className="btn sm" onClick={() => setRows(b.polls.length)}>Show all {b.polls.length} polls</button></div> : null}
      </section>

      <aside className="callout">
        <div className="eye">How this average works</div>
        The same method as every On Point average: each poll is weighted by recency, sample size, voter screen, pollster grade from the 2026 ratings and a discount for repeat releases, Gold Standard pollsters carry a larger effective sample, and each candidate&apos;s line is a robust LOWESS fit through the polls that asked about them, refit so outliers count for less. One change for a field this large: a poll that leaves part of its sample on names it did not list is discounted far less than in a two way race, at the tracker strength of 0.6, because nearly every primary poll leaves a share unassigned. A sample shown with a tilde was not in the listing and uses the pollster&apos;s usual sample. <Link href="/polls/ratings" style={{ textDecoration: "underline" }}>Pollster ratings</Link>.
      </aside>
    </div>
  );
}
