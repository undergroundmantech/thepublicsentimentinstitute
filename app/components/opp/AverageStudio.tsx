"use client";
// AverageStudio: the interactive On Point polling average chart, used on every average page and every forecast race
// page. One line, the average itself: a robust local trend fit (LOWESS) on polls weighted by recency, sample,
// screen and pollster grade. Scrub the line for any day's average, hover a poll for its weight in today's average,
// switch between the margin and each side's share, and zoom from the last 30 days to the whole cycle.
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./studio.css";

export type StudioDaily = { t: number; a: number; b: number; net: number };
export type StudioPoll = { pollster: string; t: number; a: number; b: number; margin: number; sampleSize: number; sampleType: string; grade: string; share?: number; op?: boolean; rLean?: number };
type Side = { label: string; color: string; party?: string };
type Range = "30" | "60" | "90" | "180" | "all";
const DAY = 86400000;
const RANGES: { k: Range; l: string; d: number }[] = [{ k: "30", l: "30D", d: 30 }, { k: "60", l: "60D", d: 60 }, { k: "90", l: "90D", d: 90 }, { k: "180", l: "6M", d: 182 }, { k: "all", l: "All", d: 1e5 }];
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const fmtDate = (t: number, y = false) => new Date(t).toLocaleDateString("en-US", y ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
const pc = (x: number) => (x >= 0.995 ? ">99%" : x < 0.005 ? "<1%" : `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`);

export function defaultFmt(a: Side, b: Side, marginLabel: string) {
  const race = marginLabel === "Margin";
  return (n: number) => {
    if (Math.abs(n) < 0.05) return race ? "Even" : "0.0";
    if (!race) return `${n > 0 ? "+" : "-"}${Math.abs(n).toFixed(1)}`;
    return `${n > 0 ? a.label : b.label} +${Math.abs(n).toFixed(1)}`;
  };
}

export default function AverageStudio({ daily, polls, seriesA, seriesB, marginLabel = "Margin", unit = "%", fmtMargin, height = 380, animKey, defaultRange, title }:
  { daily: StudioDaily[]; polls: StudioPoll[]; seriesA: Side; seriesB: Side; marginLabel?: string; unit?: string; fmtMargin?: (n: number) => string; height?: number; animKey?: string; defaultRange?: Range; title?: string }) {
  const fm = useMemo(() => fmtMargin ?? defaultFmt(seriesA, seriesB, marginLabel), [fmtMargin, seriesA, seriesB, marginLabel]);
  const isRace = marginLabel === "Margin";
  const spanDays = daily.length ? (daily[daily.length - 1].t - daily[0].t) / DAY : 0;
  const [view, setView] = useState<"margin" | "share">("margin");
  const [range, setRange] = useState<Range>(defaultRange ?? (spanDays > 200 ? "180" : "all"));
  const [sized, setSized] = useState(true);
  const [hover, setHover] = useState<{ t: number; x: number } | null>(null);
  const [dot, setDot] = useState<{ p: StudioPoll; x: number; y: number } | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(320, el.clientWidth))); ro.observe(el); setW(Math.max(320, el.clientWidth)); return () => ro.disconnect(); }, []);

  const H = height, L = 46, R = W < 560 ? 64 : 118, T = 16, B = 30;
  const lastT = daily.length ? daily[daily.length - 1].t : Date.now();
  const rd = RANGES.find((r) => r.k === range)!.d;
  const minT = Math.max(daily.length ? daily[0].t : lastT - 30 * DAY, lastT - rd * DAY);
  const D = daily.filter((d) => d.t >= minT);
  const P = polls.filter((p) => p.t >= minT && p.t <= lastT + DAY);
  const maxShare = Math.max(0.0001, ...polls.map((p) => p.share ?? 0));

  // y scale
  const vals = view === "margin" ? [...D.map((d) => d.net), ...P.map((p) => p.margin), 0] : [...D.flatMap((d) => [d.a, d.b]), ...P.flatMap((p) => [p.a, p.b])];
  let lo = Math.min(...vals), hi = Math.max(...vals);
  if (!Number.isFinite(lo)) { lo = -5; hi = 5; }
  const pad = Math.max(1.5, (hi - lo) * 0.08); lo -= pad; hi += pad;
  const step = hi - lo > 40 ? 10 : hi - lo > 20 ? 5 : hi - lo > 10 ? 2 : 1;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = (t: number) => L + ((t - minT) / Math.max(DAY, lastT - minT)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const yt: number[] = []; for (let v = lo; v <= hi + 1e-9; v += step) yt.push(Math.round(v * 10) / 10);
  const xt = useMemo(() => {
    const out: { t: number; l: string }[] = []; const days = (lastT - minT) / DAY;
    if (days <= 70) { for (let t = lastT; t >= minT; t -= 7 * DAY) out.unshift({ t, l: fmtDate(t) }); return out; }
    const d = new Date(minT); d.setDate(1); d.setMonth(d.getMonth() + 1);
    while (d.getTime() <= lastT) { out.push({ t: d.getTime(), l: d.toLocaleDateString("en-US", { month: "short" }) + (d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : "") }); d.setMonth(d.getMonth() + 1); }
    const k = Math.ceil(out.length / 8); return out.filter((_, i) => i % k === 0);
  }, [minT, lastT]);

  const path = (f: (d: StudioDaily) => number) => D.map((d, i) => `${i ? "L" : "M"}${x(d.t).toFixed(1)},${y(f(d)).toFixed(1)}`).join("");
  const netPath = path((d) => d.net), aPath = path((d) => d.a), bPath = path((d) => d.b);
  const y0 = y(0);
  const area = D.length ? `${netPath}L${x(D[D.length - 1].t).toFixed(1)},${y0}L${x(D[0].t).toFixed(1)},${y0}Z` : "";
  const shareArea = D.length ? `${aPath}L${[...D].reverse().map((d) => `${x(d.t).toFixed(1)},${y(d.b).toFixed(1)}`).join("L")}Z` : "";
  const last = D[D.length - 1];
  const uid = useMemo(() => "s" + Math.random().toString(36).slice(2, 8), []);

  // scrub
  const hv = hover ? D.reduce((best, d) => (Math.abs(d.t - hover.t) < Math.abs(best.t - hover.t) ? d : best), D[0]) : null;
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - b.left) / b.width) * W;
    if (px < L || px > W - R + 4) { setHover(null); return; }
    setHover({ t: minT + ((px - L) / (W - L - R)) * (lastT - minT), x: px });
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (!D.length) return;
    const cur = hv?.t ?? lastT;
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const t = clamp(cur + (e.key === "ArrowLeft" ? -DAY : DAY), minT, lastT); setHover({ t, x: x(t) }); }
    if (e.key === "Escape") setHover(null);
  };
  const dayPolls = hv ? polls.filter((p) => Math.abs(p.t - hv.t) < DAY / 2) : [];
  const r = (p: StudioPoll) => (sized && p.share != null ? 2.4 + Math.sqrt((p.share ?? 0) / maxShare) * 7.5 : 3.6);
  const colOf = (m: number) => (m > 0 ? seriesA.color : m < 0 ? seriesB.color : "#a79fbd");
  const lead = last ? (last.net >= 0 ? seriesA : seriesB) : seriesA;

  return (
    <div className="stu" ref={wrap}>
      <div className="stu-bar">
        {title ? <span className="stu-t">{title}</span> : null}
        <div className="stu-seg" role="group" aria-label="Chart view">
          <button className={view === "margin" ? "on" : ""} aria-pressed={view === "margin"} onClick={() => setView("margin")}>{marginLabel}</button>
          <button className={view === "share" ? "on" : ""} aria-pressed={view === "share"} onClick={() => setView("share")}>{isRace ? "Each candidate" : "Each side"}</button>
        </div>
        <div className="stu-seg" role="group" aria-label="Time range">
          {RANGES.filter((q) => q.k === "all" || q.d < spanDays + 5).map((q) => <button key={q.k} className={range === q.k ? "on" : ""} aria-pressed={range === q.k} onClick={() => setRange(q.k)}>{q.l}</button>)}
        </div>
        <label className="stu-tg"><input type="checkbox" checked={sized} onChange={(e) => setSized(e.target.checked)} /> Size dots by weight</label>
      </div>
      <div className="stu-plot">
        <svg key={`${animKey ?? ""}${view}${range}`} viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" tabIndex={0} onKeyDown={onKey}
          aria-label={last ? `${title ?? "Polling average"}: ${fm(last.net)} on ${fmtDate(last.t, true)}, from ${polls.length} polls. Use the arrow keys to read any day.` : "Polling average"}
          onPointerMove={onMove} onPointerLeave={() => { setHover(null); }}>
          <defs>
            <clipPath id={`${uid}u`}><rect x="0" y="0" width={W} height={Math.max(0, y0)} /></clipPath>
            <clipPath id={`${uid}d`}><rect x="0" y={y0} width={W} height={Math.max(0, H - y0)} /></clipPath>
            <linearGradient id={`${uid}ga`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={seriesA.color} stopOpacity=".32" /><stop offset="1" stopColor={seriesA.color} stopOpacity="0" /></linearGradient>
            <linearGradient id={`${uid}gb`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopColor={seriesB.color} stopOpacity=".32" /><stop offset="1" stopColor={seriesB.color} stopOpacity="0" /></linearGradient>
          </defs>
          {yt.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={view === "margin" && v === 0 ? "stu-zero" : "stu-grid"} />
              <text x={L - 8} y={y(v) + 3.5} textAnchor="end" className="stu-ax">{view === "margin" ? (v === 0 ? (isRace ? "Even" : "0") : isRace ? `${v > 0 ? (seriesA.party ?? seriesA.label).slice(0, 1) : (seriesB.party ?? seriesB.label).slice(0, 1)}+${Math.abs(v)}` : `${v > 0 ? "+" : ""}${v}`) : `${v}${unit === "%" ? "%" : ""}`}</text>
            </g>
          ))}
          {xt.map((q) => <text key={q.t} x={x(q.t)} y={H - 9} textAnchor="middle" className="stu-ax">{q.l}</text>)}
          {view === "margin" ? (
            <>
              <path d={area} fill={`url(#${uid}ga)`} clipPath={`url(#${uid}u)`} />
              <path d={area} fill={`url(#${uid}gb)`} clipPath={`url(#${uid}d)`} />
              {P.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.margin)} r={r(p)} fill={colOf(p.margin)} className={`stu-dot${p.op ? " op" : ""}`} style={{ animationDelay: `${Math.min(1.2, i * 0.008)}s` }}
                onPointerEnter={() => setDot({ p, x: x(p.t), y: y(p.margin) })} onPointerLeave={() => setDot(null)} />)}
              <path d={netPath} className="stu-line" stroke={seriesA.color} clipPath={`url(#${uid}u)`} />
              <path d={netPath} className="stu-line" stroke={seriesB.color} clipPath={`url(#${uid}d)`} />
            </>
          ) : (
            <>
              <path d={shareArea} fill="rgba(255,255,255,.04)" />
              {P.map((p, i) => <g key={i}>
                <circle cx={x(p.t)} cy={y(p.a)} r={r(p) * 0.8} fill={seriesA.color} className="stu-dot" onPointerEnter={() => setDot({ p, x: x(p.t), y: y(p.a) })} onPointerLeave={() => setDot(null)} />
                <circle cx={x(p.t)} cy={y(p.b)} r={r(p) * 0.8} fill={seriesB.color} className="stu-dot" onPointerEnter={() => setDot({ p, x: x(p.t), y: y(p.b) })} onPointerLeave={() => setDot(null)} />
              </g>)}
              <path d={aPath} className="stu-line" stroke={seriesA.color} />
              <path d={bPath} className="stu-line" stroke={seriesB.color} />
            </>
          )}
          {last ? (view === "margin" ? (
            <g className="stu-end"><circle cx={x(last.t)} cy={y(last.net)} r="6" fill={colOf(last.net)} /><circle cx={x(last.t)} cy={y(last.net)} r="11" fill="none" stroke={colOf(last.net)} className="stu-pulse" />
              <text x={W - R + 12} y={y(last.net) + 5} className="stu-endl" fill={colOf(last.net)}>{fm(last.net)}</text></g>
          ) : (
            <g className="stu-end">
              {[["a", last.a, seriesA], ["b", last.b, seriesB]].map(([k, v, s]) => {
                const yy = y(v as number), other = y((k === "a" ? last.b : last.a));
                const dy = Math.abs(yy - other) < 18 ? (yy < other ? -8 : 10) : 0;
                return <g key={k as string}><circle cx={x(last.t)} cy={yy} r="5" fill={(s as Side).color} /><text x={W - R + 12} y={yy + 5 + dy} className="stu-endl" fill={(s as Side).color}>{(v as number).toFixed(1)}<tspan className="stu-ax" dx="6">{(s as Side).label}</tspan></text></g>;
              })}
            </g>
          )) : null}
          {hv ? (
            <g className="stu-scrub" pointerEvents="none">
              <line x1={x(hv.t)} x2={x(hv.t)} y1={T} y2={H - B} />
              {view === "margin" ? <circle cx={x(hv.t)} cy={y(hv.net)} r="5" fill="#fff" stroke={colOf(hv.net)} strokeWidth="2.5" />
                : <><circle cx={x(hv.t)} cy={y(hv.a)} r="4.5" fill="#fff" stroke={seriesA.color} strokeWidth="2.5" /><circle cx={x(hv.t)} cy={y(hv.b)} r="4.5" fill="#fff" stroke={seriesB.color} strokeWidth="2.5" /></>}
            </g>
          ) : null}
        </svg>
        {hv ? (
          <div className="stu-read" style={{ left: `${(x(hv.t) / W) * 100}%`, transform: x(hv.t) > W * 0.62 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }}>
            <div className="d">{fmtDate(hv.t, true)}</div>
            <div className="m" style={{ color: colOf(hv.net) }}>{fm(hv.net)}</div>
            <div className="r"><i style={{ background: seriesA.color }} />{seriesA.label}<b>{hv.a.toFixed(1)}</b></div>
            <div className="r"><i style={{ background: seriesB.color }} />{seriesB.label}<b>{hv.b.toFixed(1)}</b></div>
            {dayPolls.length ? <div className="p">{dayPolls.slice(0, 3).map((p, i) => <span key={i}>{p.pollster} <b style={{ color: colOf(p.margin) }}>{fm(p.margin)}</b></span>)}{dayPolls.length > 3 ? <span>and {dayPolls.length - 3} more</span> : null}</div> : null}
          </div>
        ) : null}
        {dot ? (
          <div className="stu-dtip" style={{ left: `${(dot.x / W) * 100}%`, top: dot.y, transform: dot.x > W * 0.62 ? "translate(calc(-100% - 12px), -50%)" : "translate(12px, -50%)" }}>
            <b>{dot.p.pollster}</b><span className="g">{dot.p.grade}</span>{dot.p.rLean ? <span className="g rl">R lean</span> : null}
            <div>{fmtDate(dot.p.t, true)} · {dot.p.sampleSize > 0 ? dot.p.sampleSize.toLocaleString() : "n/a"} {dot.p.sampleType}</div>
            <div>{seriesA.label} {dot.p.a} · {seriesB.label} {dot.p.b} · <b style={{ color: colOf(dot.p.margin) }}>{fm(dot.p.margin)}</b></div>
            {dot.p.rLean ? <div className="w">Republican leaning firm: moved {dot.p.rLean.toFixed(1)} points toward the Democrat before averaging</div> : null}
            {dot.p.share != null ? <div className="w">Weight in today&apos;s average: <b>{pc(dot.p.share)}</b></div> : null}
          </div>
        ) : null}
      </div>
      <div className="stu-foot">
        <span><i className="ln" style={{ background: lead.color }} />The line is the On Point average: a robust local trend fit through the polls, weighted by recency, sample, voter screen and pollster grade</span>
        {sized ? <span><i className="dt" />Dot size is each poll&apos;s weight today</span> : null}
        <span className="k">Hover or use the arrow keys to read any day</span>
      </div>
    </div>
  );
}

/** What moves the average: the polls carrying the most weight today. */
export function WeightBars({ polls, seriesA, seriesB, fmtMargin, marginLabel = "Margin", limit = 8 }: { polls: StudioPoll[]; seriesA: Side; seriesB: Side; fmtMargin?: (n: number) => string; marginLabel?: string; limit?: number }) {
  const fm = fmtMargin ?? defaultFmt(seriesA, seriesB, marginLabel);
  const top = [...polls].filter((p) => (p.share ?? 0) > 0.001).sort((a, b) => (b.share ?? 0) - (a.share ?? 0)).slice(0, limit);
  if (!top.length) return null;
  const mx = top[0].share ?? 1;
  const rest = polls.reduce((a, p) => a + (p.share ?? 0), 0) - top.reduce((a, p) => a + (p.share ?? 0), 0);
  return (
    <div className="stu-wb">
      {top.map((p, i) => (
        <div className="row" key={i}>
          <span className="who"><b>{p.pollster}</b><small>{fmtDate(p.t)} · {p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "n/a"} {p.sampleType} · {p.grade}{p.rLean ? ` · R lean, ${p.rLean.toFixed(1)} off` : ""}</small></span>
          <span className="bar"><i style={{ width: `${((p.share ?? 0) / mx) * 100}%`, background: p.margin >= 0 ? seriesA.color : seriesB.color, animationDelay: `${i * 0.05}s` }} /></span>
          <span className="pc mono">{pc(p.share ?? 0)}</span>
          <span className="mg mono" style={{ color: p.margin >= 0 ? seriesA.color : seriesB.color }}>{fm(p.margin)}</span>
        </div>
      ))}
      {rest > 0.005 ? <div className="rest">Every other poll together: {pc(rest)}</div> : null}
    </div>
  );
}
