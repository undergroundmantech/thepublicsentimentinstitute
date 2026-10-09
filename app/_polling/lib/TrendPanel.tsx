"use client";

/* =============================================================================
   TrendPanel: the OnPoint LOWESS trend lines and the Election Day polling average
   for one head-to-head aggregate. Every poll is a dot at its field midpoint;
   three robust LOWESS lines run through them; a flat projection and its 80%
   range run from the newest poll to Election Day. The method and its backtest
   live in lowessTrend.ts.
============================================================================= */

import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AggregateDef } from "@/app/_polling/lib/aggregates";
import { buildTrends, electionDayFor, SPANS, EDAY_WEIGHTS, type SpanKey, type TrendResult } from "@/app/_polling/lib/lowessTrend";

const DAY = 86400000;
type Range = "3M" | "6M" | "All";
const LINES: { key: SpanKey; name: string; dash?: string; width: number }[] = [
  { key: "recent", name: "Recent trend", width: 2.4 },
  { key: "balanced", name: "Balanced trend", width: 2 },
  { key: "long", name: "Long-term trend", dash: "7 5", width: 2 },
];
const shortDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const longDate = (t: number) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

function valueAt(curve: { t: number; v: number }[], t: number): number | null {
  if (!curve.length || t < curve[0].t || t > curve[curve.length - 1].t) return null;
  let lo = 0, hi = curve.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (curve[m].t <= t) lo = m; else hi = m; }
  const a = curve[lo], b = curve[hi];
  return b.t === a.t ? a.v : a.v + ((t - a.t) * (b.v - a.v)) / (b.t - a.t);
}

export default function TrendPanel({ def, polls }: { def: AggregateDef; polls: AggregateDef["polls"] }) {
  const eday = useMemo(() => electionDayFor(def.category, def.id), [def]);
  const tr: TrendResult | null = useMemo(() => buildTrends(polls as never, def.keyA, def.keyB, eday), [polls, def, eday]);
  const [range, setRange] = useState<Range>("6M");
  const [hover, setHover] = useState<{ t: number; px: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(760);
  // Poll dates are parsed in the viewer's time zone, so the server and the browser can place
  // the same poll a few hours apart. The chart is drawn after mount to keep hydration exact.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const el = wrap.current; if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el); return () => ro.disconnect();
  }, [mounted]);

  if (!mounted) return <div className="tr-root" style={{ minHeight: 420 }} aria-busy="true" />;
  if (!tr) {
    return (
      <div className="tr-root tr-empty">
        Trend lines need at least 6 polls of this matchup. {def.polls.length === 0 ? "" : "Check back as more polls come in."}
      </div>
    );
  }

  const fmt = def.fmtMargin;
  const endT = tr.eday ? tr.eday.t : tr.latestT;
  const span = range === "3M" ? 92 * DAY : range === "6M" ? 183 * DAY : Infinity;
  const startT = Math.max(tr.points[0].t, endT - span - (tr.eday ? 0 : 7 * DAY));
  const vis = tr.points.filter((p) => p.t >= startT);
  const H = 300, padL = 44, padR = 16, padT = 16, padB = 28;
  const iw = w - padL - padR, ih = H - padT - padB;
  const xs = (t: number) => padL + ((t - startT) / Math.max(DAY, endT - startT)) * iw;

  // y domain from what is on screen: polls, the three lines and the projection range
  const ys: number[] = vis.map((p) => p.margin);
  for (const l of LINES) for (const c of tr.curves[l.key]) if (c.t >= startT) ys.push(c.v);
  if (tr.eday) ys.push(tr.eday.lo, tr.eday.hi);
  let yMin = Math.min(0, ...ys), yMax = Math.max(0, ...ys);
  const padY = Math.max(2, (yMax - yMin) * 0.08); yMin -= padY; yMax += padY;
  const yy = (v: number) => padT + ((yMax - v) / (yMax - yMin)) * ih;
  const step = (yMax - yMin) > 40 ? 10 : (yMax - yMin) > 16 ? 5 : 2;
  const yTicks: number[] = []; for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);
  const xTicks: number[] = [];
  { const d = new Date(startT); d.setDate(1); d.setMonth(d.getMonth() + 1); while (d.getTime() <= endT) { xTicks.push(d.getTime()); d.setMonth(d.getMonth() + 1); } }
  const xTickShown = xTicks.filter((_, i) => i % Math.ceil(xTicks.length / Math.max(2, Math.floor(iw / 90))) === 0);

  // each line enters from the left edge: keep the last fitted point before the window, clipped
  const path = (k: SpanKey) => {
    const c = tr.curves[k]; const first = c.findIndex((p) => p.t >= startT);
    const seg = first > 0 ? c.slice(first - 1) : c;
    return seg.map((p, i) => `${i ? "L" : "M"}${xs(p.t).toFixed(1)},${yy(p.v).toFixed(1)}`).join("");
  };
  const clipId = `trclip-${def.id}`;

  // direct labels just before the newest poll, stacked so they never overlap
  const labels = LINES.map((l) => ({ ...l, y: yy(tr.latest[l.key]) - 7, v: tr.latest[l.key] })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < labels.length; i++) if (labels[i].y - labels[i - 1].y < 13) labels[i].y = labels[i - 1].y + 13;
  for (const l of labels) l.y = Math.max(padT + 22, Math.min(padT + ih - 4, l.y));
  const lx = xs(tr.latestT);

  // projection range: its half width grows with days from the newest poll
  let band = "";
  if (tr.eday) {
    const pts: [number, number, number][] = [];
    for (let k = 0; k <= 12; k++) {
      const t = tr.latestT + ((tr.eday.t - tr.latestT) * k) / 12;
      const d = (t - tr.latestT) / DAY; const h = Math.sqrt(12.37 + 0.1708 * d);
      pts.push([xs(t), yy(tr.eday.value + h), yy(tr.eday.value - h)]);
    }
    band = `M${pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("L")}L${[...pts].reverse().map((p) => `${p[0].toFixed(1)},${p[2].toFixed(1)}`).join("L")}Z`;
  }

  const readingText = tr.reading === "confirming"
    ? `The newest polling is confirming the broader trend: the recent line sits within ${Math.abs(tr.divergence).toFixed(1)} points of the long-term line.`
    : `The newest polling is moving toward ${tr.reading === "toward-a" ? def.seriesA.label : def.seriesB.label}: the recent line runs ${Math.abs(tr.divergence).toFixed(1)} points to that side of the long-term line.`;
  const readingColor = tr.reading === "toward-a" ? def.seriesA.color : tr.reading === "toward-b" ? def.seriesB.color : "var(--muted)";

  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const r = (e.currentTarget as SVGRectElement).getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * iw;
    setHover({ t: startT + (px / iw) * (endT - startT), px: padL + px });
  };
  const hv = hover ? LINES.map((l) => ({ ...l, v: valueAt(tr.curves[l.key], hover.t) })) : null;
  const nearPoll = hover ? vis.reduce<{ p: (typeof vis)[number]; d: number } | null>((best, p) => {
    const d = Math.abs(xs(p.t) - hover.px); return d < 10 && (!best || d < best.d) ? { p, d } : best;
  }, null) : null;
  const inProj = hover && tr.eday && hover.t > tr.latestT;

  return (
    <div className="tr-root">
      <style>{CSS}</style>
      <div className="tr-bar">
        <div className="tr-legend" aria-label="Legend">
          {LINES.map((l) => (
            <span key={l.key} className="tr-key">
              <svg width="26" height="10" aria-hidden><line x1="1" y1="5" x2="25" y2="5" stroke={`var(--tr-${l.key})`} strokeWidth={l.width} strokeDasharray={l.dash} strokeLinecap="round" /></svg>
              {l.name}<em>{SPANS[l.key].toFixed(2)}</em>
            </span>
          ))}
          {tr.eday ? <span className="tr-key"><i className="tr-band-sw" />Election Day range, 80%</span> : null}
        </div>
        <div className="tr-seg" role="group" aria-label="Time range">
          {(["3M", "6M", "All"] as Range[]).map((r) => (
            <button key={r} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>

      <div className="tr-chart" ref={wrap}>
        <svg width={w} height={H} role="img" aria-label={`${def.title}: LOWESS trend lines of every poll's margin${tr.eday ? " and the projected Election Day polling average" : ""}`}>
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={padL + iw} y1={yy(v)} y2={yy(v)} className={v === 0 ? "tr-zero" : "tr-grid"} />
              <text x={padL - 8} y={yy(v) + 3.5} className="tr-ytick">{v === 0 ? "Even" : fmt(v).replace(/^[^+]*\+/, "+")}</text>
            </g>
          ))}
          <text x={padL + 6} y={padT + 11} className="tr-side">{def.seriesA.label} ahead</text>
          <text x={padL + 6} y={padT + ih - 6} className="tr-side">{def.seriesB.label} ahead</text>
          {xTickShown.map((t) => <text key={t} x={xs(t)} y={H - 8} className="tr-xtick">{new Date(t).toLocaleDateString(undefined, { month: "short" })}</text>)}

          {tr.eday ? (
            <g>
              <path d={band} className="tr-band" />
              <line x1={lx} x2={xs(tr.eday.t)} y1={yy(tr.eday.value)} y2={yy(tr.eday.value)} className="tr-proj" />
              <line x1={xs(tr.eday.t)} x2={xs(tr.eday.t)} y1={padT} y2={padT + ih} className="tr-eday" />
              <text x={xs(tr.eday.t) - 4} y={padT + 11} className="tr-eday-lab">Election Day</text>
              <rect x={xs(tr.eday.t) - 5} y={yy(tr.eday.value) - 5} width={10} height={10} transform={`rotate(45 ${xs(tr.eday.t)} ${yy(tr.eday.value)})`} className="tr-diamond" />
            </g>
          ) : null}

          {vis.map((p, i) => (
            <circle key={i} cx={xs(p.t)} cy={yy(p.margin)} r={3.6}
              fill={p.margin >= 0 ? def.seriesA.color : def.seriesB.color} className="tr-dot" />
          ))}
          <defs><clipPath id={clipId}><rect x={padL} y={padT} width={Math.max(0, iw)} height={ih} /></clipPath></defs>
          {LINES.map((l) => (
            <path key={l.key} d={path(l.key)} clipPath={`url(#${clipId})`} fill="none" stroke={`var(--tr-${l.key})`} strokeWidth={l.width}
              strokeDasharray={l.dash} strokeLinejoin="round" strokeLinecap="round" className="tr-line" />
          ))}
          {labels.map((l) => (
            <text key={l.key} x={lx - 6} y={l.y} className="tr-dlabel">{l.name.replace(" trend", "")}</text>
          ))}

          {hover ? <line x1={hover.px} x2={hover.px} y1={padT} y2={padT + ih} className="tr-cross" /> : null}
          <rect x={padL} y={padT} width={Math.max(0, iw)} height={ih} fill="transparent" onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        </svg>
        {hover && hv ? (
          <div className="tr-tip" style={{ left: Math.min(Math.max(8, hover.px + 12), w - 230) }}>
            <b>{longDate(hover.t)}</b>
            {inProj && tr.eday ? (
              <span className="row"><i className="tr-band-sw" />Election Day average<span>{fmt(tr.eday.value)}</span></span>
            ) : hv.map((l) => l.v === null ? null : (
              <span key={l.key} className="row"><i style={{ background: `var(--tr-${l.key})` }} />{l.name}<span>{fmt(l.v)}</span></span>
            ))}
            {nearPoll ? <span className="poll">{nearPoll.p.pollster}: {fmt(nearPoll.p.margin)}{nearPoll.p.imputed ? ", midpoint estimated" : ""}</span> : null}
          </div>
        ) : null}
      </div>

      <div className="tr-cards">
        {LINES.map((l) => (
          <div key={l.key} className="tr-card">
            <span className="lab"><i style={{ background: `var(--tr-${l.key})` }} />{l.name} <em style={{ fontStyle: "normal", color: "var(--mute2)" }}>{SPANS[l.key].toFixed(2)}</em></span>
            <b>{fmt(tr.latest[l.key])}</b>
            <span className="sub">{l.key === "recent" ? "Leans on the newest polls" : l.key === "long" ? "Looks across most of the polling" : "The middle ground"}</span>
          </div>
        ))}
        <div className="tr-card eday">
          <span className="lab"><i className="tr-band-sw" />Election Day polling average</span>
          {tr.eday ? (
            <>
              <b>{fmt(tr.eday.value)}</b>
              <span className="sub">80% range {fmt(tr.eday.lo)} to {fmt(tr.eday.hi)}, {tr.eday.days} days from the newest poll</span>
            </>
          ) : (
            <>
              <b>None</b>
              <span className="sub">{eday === null ? "No election to project to" : eday <= tr.latestT ? "Polling ran through Election Day" : "Needs at least 8 polls"}</span>
            </>
          )}
        </div>
      </div>

      <p className="tr-reading"><i style={{ background: readingColor }} />{readingText}</p>

      <details className="tr-method">
        <summary>How the trend lines work</summary>
        <p>
          Every individual poll is one observation, placed at the midpoint of its field dates, with the margin as{" "}
          {def.seriesA.label} minus {def.seriesB.label}. No poll is weighted by sample size or pollster rating, and published
          polling averages are left out so no poll counts twice. Each line is a robust LOWESS: a local straight-line fit across
          the nearest {Math.round(SPANS.recent * 100)}%, {Math.round(SPANS.balanced * 100)}% or {Math.round(SPANS.long * 100)}% of the
          polls, then three robust passes that shrink the pull of any poll far off the line. The OnPoint average above weights polls by
          recency, size and pollster grade; these lines deliberately do not.
        </p>
        <p>
          A LOWESS line cannot see past its last poll, so the Election Day figure does not extend it. It is{" "}
          {Math.round(EDAY_WEIGHTS.recent * 100)}% of the recent trend plus {Math.round(EDAY_WEIGHTS.long * 100)}% of the long-term trend
          as they stand today, carried flat to Election Day. That blend was chosen on a backtest of this site&apos;s own polls, 1,018 cut
          points across 31 races projected 14 to 42 days ahead. It missed the later polling by 2.6 points on average, against 4.6 for
          the latest single poll; carrying the recent slope forward made every horizon worse. The shaded range holds 80% of the
          backtest misses at each horizon, about 4.3 points at five weeks. This is a forecast of the final polling average, not of the
          result.
        </p>
        <p className="tr-counts">
          {tr.n} polls{tr.excluded ? ` · ${tr.excluded} published average${tr.excluded === 1 ? "" : "s"} left out` : ""}
          {tr.imputed ? ` · ${tr.imputed} midpoint${tr.imputed === 1 ? "" : "s"} placed 1.5 days before the end date, because the poll lists no start date` : ""}
          {tr.recentWindow <= 4 ? ` · with ${tr.n} polls the recent trend rests on ${tr.recentWindow} polls at a time, so it tracks individual polls closely` : ""}
        </p>
      </details>
    </div>
  );
}

const CSS = `
.tr-root { --tr-recent: #f3eff8; --tr-balanced: #a79fbd; --tr-long: #8e86a3; position: relative; }
.tr-empty { padding: 26px 4px; font-size: 13.5px; color: var(--mute); }
.tr-bar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 16px; margin-bottom: 10px; }
.tr-legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12px; color: var(--ink2); }
.tr-key { display: inline-flex; align-items: center; gap: 7px; }
.tr-key em { font-style: normal; font: 500 11px var(--font-m); color: var(--mute); }
.tr-band-sw { display: inline-block; width: 14px; height: 10px; border-radius: 3px; background: rgba(255,255,255,.1); border: 1px dashed rgba(255,255,255,.4); }
.tr-seg { display: inline-flex; gap: 2px; padding: 3px; background: rgba(255,255,255,.06); border-radius: 999px; }
.tr-seg button { appearance: none; border: 0; background: none; cursor: pointer; padding: 6px 12px; border-radius: 999px; font: 700 12px var(--font-b); color: var(--mute); transition: .15s; }
.tr-seg button:hover { color: #fff; }
.tr-seg button.on { background: #fff; color: var(--bg); }
.tr-seg button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.tr-chart { position: relative; width: 100%; overflow: hidden; }
.tr-grid { stroke: var(--line); }
.tr-zero { stroke: rgba(255,255,255,.35); stroke-width: 1; stroke-dasharray: 3 4; }
.tr-ytick { font: 500 10px var(--font-m); fill: var(--mute); text-anchor: end; }
.tr-xtick { font: 500 10px var(--font-m); fill: var(--mute); text-anchor: middle; }
.tr-side { font: 600 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; fill: var(--mute2); }
.tr-dot { opacity: .35; }
.tr-band { fill: rgba(255,255,255,.07); stroke: rgba(255,255,255,.3); stroke-dasharray: 3 3; }
.tr-proj { stroke: #fff; stroke-width: 1.6; stroke-dasharray: 2 4; stroke-linecap: round; }
.tr-eday { stroke: rgba(255,255,255,.25); stroke-dasharray: 2 3; }
.tr-eday-lab { font: 600 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; fill: var(--mute); text-anchor: end; }
.tr-diamond { fill: #fff; stroke: var(--bg); stroke-width: 2; }
.tr-dlabel { font: 600 10.5px var(--font-m); fill: var(--ink); text-anchor: end; paint-order: stroke; stroke: var(--bg); stroke-width: 3px; stroke-linejoin: round; }
.tr-cross { stroke: rgba(255,255,255,.4); }
.tr-tip { position: absolute; top: 8px; width: 218px; pointer-events: none; display: grid; gap: 5px; padding: 10px 12px; border-radius: 10px;
  background: rgba(17,0,25,.94); border: 1px solid var(--line2); box-shadow: 0 12px 40px rgba(0,0,0,.5); backdrop-filter: blur(10px); font-size: 12.5px; color: var(--ink2); }
.tr-tip b { color: #fff; font: 700 13px var(--font-d); }
.tr-tip .row { display: flex; align-items: center; gap: 7px; }
.tr-tip .row i { width: 10px; height: 3px; border-radius: 2px; flex-shrink: 0; }
.tr-tip .row span { margin-left: auto; font: 600 12px var(--font-m); color: #fff; font-variant-numeric: tabular-nums; }
.tr-tip .poll { padding-top: 5px; border-top: 1px solid var(--line); color: var(--ink); }
.tr-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-top: 14px; }
.tr-card { display: flex; flex-direction: column; gap: 5px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 12px; background: var(--glass); }
.tr-card .lab { display: inline-flex; align-items: center; gap: 7px; font: 700 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); }
.tr-card .lab i { width: 12px; height: 3px; border-radius: 2px; }
.tr-card b { font: 800 22px var(--font-d); letter-spacing: -.03em; color: var(--ink); font-variant-numeric: tabular-nums; }
.tr-card .sub { font-size: 12px; color: var(--mute); line-height: 1.45; }
.tr-card.eday { border-color: var(--line2); background: var(--glass2); }
.tr-reading { display: flex; align-items: flex-start; gap: 9px; margin: 14px 0 0; font-size: 13.5px; line-height: 1.55; color: var(--ink2); }
.tr-reading i { width: 9px; height: 9px; border-radius: 99px; margin-top: 6px; flex-shrink: 0; }
.tr-method { margin-top: 12px; font-size: 13px; line-height: 1.6; color: var(--mute); }
.tr-method summary { cursor: pointer; font-weight: 700; color: var(--ink); }
.tr-method p { margin: 8px 0 0; max-width: 78ch; }
.tr-counts { font-family: var(--font-m); font-size: 11.5px; color: var(--mute2); }
`;
