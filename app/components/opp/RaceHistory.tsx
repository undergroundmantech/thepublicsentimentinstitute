"use client";
// RaceHistory: win probability, expected margin and vote totals over time, in the polling-average chart's visual language
// (studio.css). It draws only what it is given: published model outputs and reported votes from raceHistory.ts. A gap stays
// a gap, a published value is drawn as standing until the next one (step-after), and nothing is interpolated or generated.
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./studio.css";
import "./raceHistory.css";
import {
  buildChart, candidateColor, decimate, defaultRange, fmtLead, fmtProb, fmtStamp, fmtVotes, heldAt, lastName, lastUpdated, PARTY_COLOR, RANGE_LABEL, rangeHasData, rangeWindow,
  readoutAt, SHADOW_COLOR, stepTime, timeTicks, windowSeries, ZONE_LABEL, zoneName,
  type ChartData, type ChartId, type Freshness, type HistoryCandidate, type PreparedHistory, type RangeId, type ReadoutRow, type Series, type SeriesPoint, type Tick, type ZoneId,
} from "@/app/lib/intelligence/raceHistory";

const TABS: { id: ChartId; label: string }[] = [{ id: "prob", label: "WIN PROBABILITY" }, { id: "margin", label: "EXPECTED MARGIN" }, { id: "votes", label: "VOTE TOTALS" }];
const RANGES: RangeId[] = ["NIGHT", "24H", "7D", "ALL"];
const ZONES: ZoneId[] = ["ET", "UTC", "LOCAL"];
const CLASS_LABEL = { FROZEN_FORECAST: "Frozen pre-election forecast", LIVE_PROJECTION: "Published live projection", SHADOW_MODEL: "Shadow model, not published", RESULT_FEED: "Reported votes" } as const;
const STATUS_NOTE = { LIVE: null, TEST: "TEST", SYNTHETIC: "SYNTHETIC", NOT_PROVIDED: "STATUS NOT STATED" } as const;

const compact = (n: number) => (n >= 1e6 ? `${+(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}K` : String(Math.round(n)));
const axisTag = (c: HistoryCandidate) => (c.party && c.party.length <= 3 ? c.party : lastName(c.name).slice(0, 4));
const lineClass = (s: Pick<Series, "phase" | "dash">) => (s.phase === "SHADOW" ? "shadow" : s.phase === "FROZEN" ? "frozen" : s.dash === "DASHED" ? "dashed" : "live");

interface Step { a: number; b: number; q: SeriesPoint }

/** Step-after segments. A null value, a silence longer than the series allows, or the series' end closes a segment. */
function stepsOf(s: Series, pts: SeriesPoint[], endT: number, t0: number): Step[][] {
  const segs: Step[][] = [];
  let seg: Step[] | null = null;
  for (let i = 0; i < pts.length; i++) {
    const q = pts[i];
    if (q.v === null) { seg = null; continue; }
    if (q.carried && s.extendTo !== null && s.extendTo <= t0 && i === pts.length - 1) continue;
    const next = pts[i + 1];
    let b: number, brk = false;
    if (next) {
      b = next.t;
      if (s.breakAfterMs !== null && next.t - (q.until ?? q.t) > s.breakAfterMs) { b = q.until ?? q.t; brk = true; }
    } else b = s.extendTo !== null ? Math.min(s.extendTo, endT) : s.breakAfterMs !== null ? q.until ?? q.t : endT;
    if (!seg) { seg = []; segs.push(seg); }
    seg.push({ a: q.t, b: Math.max(q.t, b), q });
    if (brk) seg = null;
  }
  return segs;
}

export interface RaceHistoryProps {
  history: PreparedHistory;
  title?: string;
  /** Server time when the page was built. Model values are held to here; without it, to the last observation. */
  nowMs?: number;
  height?: number;
  initialChart?: ChartId;
  /** Preview only: offer the shadow model as a labelled overlay. Ignored on a public surface. */
  allowShadowOverlay?: boolean;
}

export default function RaceHistory({ history: h, title = "Race history", nowMs, height = 360, initialChart = "prob", allowShadowOverlay = false }: RaceHistoryProps) {
  const [chart, setChart] = useState<ChartId>(initialChart);
  const [rangeSel, setRange] = useState<RangeId | null>(null);
  const [zone, setZone] = useState<ZoneId>("ET");
  const [cursor, setCursor] = useState<number | null>(null);
  const [overlay, setOverlay] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(900);
  useEffect(() => { const el = wrap.current; if (!el) return; const ro = new ResizeObserver(() => setW(Math.max(300, el.clientWidth))); ro.observe(el); setW(Math.max(300, el.clientWidth)); return () => ro.disconnect(); }, []);

  const shadowOk = allowShadowOverlay && h.surface === "PREVIEW" && h.shadow.length > 0;
  const charts = useMemo(() => {
    const o = { overlayShadow: shadowOk && overlay };
    return { prob: buildChart(h, "prob", o), margin: buildChart(h, "margin", o), votes: buildChart(h, "votes", o) } as Record<ChartId, ChartData>;
  }, [h, shadowOk, overlay]);
  const data = charts[chart];
  const range: RangeId = rangeSel && rangeHasData(data, rangeSel, h.bounds, nowMs) ? rangeSel : defaultRange(data, h.bounds, nowMs);
  const [t0, t1] = rangeWindow(range, h.bounds, nowMs);
  const endT = Math.min(t1, Math.max(h.bounds?.[1] ?? t1, nowMs ?? 0));
  const tz = zoneName(zone);
  const narrow = W < 560;

  const H = height, L = narrow ? 42 : 56, R = narrow ? 66 : 116, T = 24, B = 30;
  const pw = W - L - R;
  const x = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * pw;
  const [ylo, yhi] = data.yDomain;
  const clampV = (v: number) => Math.min(yhi, Math.max(ylo, v));
  const y = (v: number) => T + ((yhi - clampV(v)) / Math.max(1e-9, yhi - ylo)) * (H - T - B);
  const ref = data.reference;
  const plusColor = ref ? candidateColor(ref.plus, h.candidates.indexOf(ref.plus)) : PARTY_COLOR.R;
  const minusColor = ref ? candidateColor(ref.minus, h.candidates.indexOf(ref.minus)) : PARTY_COLOR.D;

  const yTicks = useMemo(() => {
    if (chart === "prob") return [0, 25, 50, 75, 100];
    if (chart === "votes") { const st = [4, 5, 2].map((n) => yhi / n).find((s) => Number.isInteger(s / Math.pow(10, Math.floor(Math.log10(s)) - 1))) ?? yhi / 4; const out: number[] = []; for (let v = 0; v <= yhi + 1e-6; v += st) out.push(v); return out; }
    const step = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50].find((s) => (2 * yhi) / s <= (narrow ? 6 : 8)) ?? 50;
    const out: number[] = []; for (let v = -Math.floor(yhi / step) * step; v <= yhi + 1e-9; v += step) out.push(Math.round(v * 100) / 100); return out;
  }, [chart, yhi, narrow]);
  const yLabel = (v: number) => (chart === "prob" ? `${v}%` : chart === "votes" ? compact(v) : Math.abs(v) < 1e-9 ? "Even" : ref ? `${axisTag(v > 0 ? ref.plus : ref.minus)}+${Math.abs(v)}` : `${v > 0 ? "+" : "−"}${Math.abs(v)}`);
  // at most one label per ~86px (66px narrow); day labels win over hour labels, and no two labels may overlap
  const xTicks = useMemo(() => {
    const px = (t: number) => L + ((t - t0) / Math.max(1, t1 - t0)) * pw;
    const wOf = (s: string) => s.length * 6.4 + 12;
    const kept: Tick[] = [];
    const fits = (q: Tick) => { const a = px(q.t), w = wOf(q.label); return a - w / 2 >= 2 && a + w / 2 <= W - 2 && kept.every((k) => Math.abs(px(k.t) - a) >= (wOf(k.label) + w) / 2); };
    const all = timeTicks(t0, t1, tz, Math.max(2, Math.floor(pw / (narrow ? 66 : 86))));
    for (const q of all) if (q.major && fits(q)) kept.push(q);
    for (const q of all) if (!q.major && fits(q)) kept.push(q);
    return kept.sort((a, b) => a.t - b.t);
  }, [t0, t1, tz, narrow, pw, L, W]);

  // geometry is rebuilt when the data, window or size change, never on cursor movement
  const drawn = useMemo(() => data.series.map((s) => {
    const pts = decimate(windowSeries(s, t0, t1), t0, t1, Math.max(50, Math.round(pw)));
    const segs = stepsOf(s, pts, endT, t0);
    const cv = (v: number) => Math.min(yhi, Math.max(ylo, v));
    const X = (t: number) => (L + ((t - t0) / Math.max(1, t1 - t0)) * pw).toFixed(1), Y = (v: number) => (T + ((yhi - cv(v)) / Math.max(1e-9, yhi - ylo)) * (H - T - B)).toFixed(1);
    let line = "", band = "", area = "";
    const iso: { t: number; v: number }[] = [];
    // runs beyond the scale: drawn along the edge and marked with the true value
    const off: { t: number; v: number; up: boolean }[] = [];
    for (const seg of segs) {
      let run: { t: number; v: number; up: boolean } | null = null;
      for (const st of seg) {
        const v = st.q.v as number, up = v > yhi;
        if (up || v < ylo) { if (!run || run.up !== up) { run = { t: Math.max(st.a, t0), v, up }; off.push(run); } else if (Math.abs(v) > Math.abs(run.v)) run.v = v; } else run = null;
      }
      if (seg.length === 1 && seg[0].a === seg[0].b) { iso.push({ t: seg[0].a, v: seg[0].q.v as number }); continue; }
      let d = `M${X(seg[0].a)},${Y(seg[0].q.v as number)}H${X(seg[0].b)}`;
      for (let k = 1; k < seg.length; k++) d += `V${Y(seg[k].q.v as number)}H${X(seg[k].b)}`;
      line += d;
      if (chart === "margin" && s.phase !== "SHADOW" && s.source === "MODEL") area += `${d}V${Y(0)}H${X(seg[0].a)}Z`;
      if (s.band) for (const st of seg) if (st.q.lo != null && st.q.hi != null && st.b > st.a) band += `M${X(st.a)},${Y(st.q.hi)}H${X(st.b)}V${Y(st.q.lo)}H${X(st.a)}Z`;
    }
    const obs = s.source === "RESULT" && pts.length <= 160 ? pts.filter((q) => q.v !== null && !q.carried && q.v <= yhi && q.v >= ylo) : [];
    const flags = pts.filter((q) => q.flag && q.v !== null && !q.carried);
    return { s, line, band, area, iso, obs, flags, off };
  }), [data, t0, t1, pw, endT, chart, L, T, H, B, yhi, ylo]);

  const markers = data.markers.filter((m) => m.t >= t0 && m.t <= t1);
  const liveStart = data.markers.find((m) => m.kind === "LIVE_START")?.t ?? null;
  const preEnd = liveStart !== null ? Math.min(Math.max(liveStart, t0), t1) : null;

  // end labels: one per candidate (or margin kind), preferring reported, then live, then frozen
  const ends = useMemo(() => {
    const rankOf = (s: Series) => (s.source === "RESULT" ? 0 : s.phase === "LIVE" ? 1 : 2);
    const best = new Map<string, { s: Series; v: number }>();
    for (const s of data.series) {
      if (s.phase === "SHADOW") continue;
      const key = chart === "margin" ? (s.source === "RESULT" ? "counted" : "proj") : s.candidateId ?? s.key;
      const held = heldAt(s, endT);
      if (!held || held.point.v === null) continue;
      const cur = best.get(key);
      if (!cur || rankOf(s) < rankOf(cur.s)) best.set(key, { s, v: held.point.v });
    }
    const gap = narrow ? 26 : 15, floor = H - B - (narrow ? 14 : 4);
    const list = [...best.values()].map((e) => ({ ...e, off: e.v > yhi ? 1 : e.v < ylo ? -1 : 0, y: T + ((yhi - Math.min(yhi, Math.max(ylo, e.v))) / Math.max(1e-9, yhi - ylo)) * (H - T - B) })).sort((a, b) => a.y - b.y);
    for (let i = 1; i < list.length; i++) if (list[i].y - list[i - 1].y < gap) list[i].y = list[i - 1].y + gap;
    for (let i = list.length - 1; i >= 0; i--) list[i].y = Math.min(list[i].y, i === list.length - 1 ? floor : list[i + 1].y - gap);
    return list;
  }, [data, chart, endT, T, H, B, yhi, ylo, narrow]);
  const fmtEnd = (v: number) => (chart === "prob" ? fmtProb(v) : chart === "votes" ? compact(v) : fmtLead(v, ref));
  const endTag = (s: Series) => (chart === "margin" ? (s.source === "RESULT" ? "counted" : "") : lastName(s.label.replace(/ \(estimated final\)$/, "")));
  const colorAt = (s: Series, v: number) => (chart === "margin" && s.phase !== "SHADOW" ? (v >= 0 ? plusColor : minusColor) : s.color);

  // cursor: snapped to the nearest observation time in the window, shared by all three charts
  const inWin = useMemo(() => data.times.filter((t) => t >= t0 && t <= t1), [data.times, t0, t1]);
  const snap = (t: number) => {
    if (!inWin.length) return t;
    let lo = 0, hi = inWin.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (inWin[m] < t) lo = m + 1; else hi = m; }
    return lo > 0 && Math.abs(inWin[lo - 1] - t) <= Math.abs(inWin[lo] - t) ? inWin[lo - 1] : inWin[lo];
  };
  const ct = cursor !== null && cursor >= t0 && cursor <= t1 ? cursor : null;
  const readout = ct !== null ? readoutAt(data, h, ct) : null;
  const cross = ct !== null ? TABS.filter((c) => c.id !== chart).map((c) => crossLine(c.id, charts[c.id], h, ct)).filter((s): s is string => !!s) : [];
  const updated = lastUpdated(h);
  const onPoint = (e: React.PointerEvent<SVGSVGElement>) => {
    const b = e.currentTarget.getBoundingClientRect(), px = ((e.clientX - b.left) / b.width) * W;
    if (px < L - 4 || px > W - R + 4) { if (e.pointerType === "mouse") setCursor(null); return; }
    setCursor(snap(t0 + ((px - L) / pw) * (t1 - t0)));
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); const n = stepTime(inWin, ct, e.key === "ArrowRight" ? 1 : -1); if (n !== null) setCursor(n); }
    else if (e.key === "Home" && inWin.length) { e.preventDefault(); setCursor(inWin[0]); }
    else if (e.key === "End" && inWin.length) { e.preventDefault(); setCursor(inWin[inWin.length - 1]); }
    else if (e.key === "Escape") setCursor(null);
  };

  const statuses = new Set([...h.models, ...h.results].map((p) => p.status));
  const uid = "rh" + React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const y0 = chart === "margin" ? y(0) : 0;
  const empty = data.emptyReason;
  const summary = empty ?? ends.map((e) => `${e.s.label}: ${fmtEnd(e.v)}${chart === "margin" && e.s.source === "RESULT" ? " counted" : ""}`).join("; ");

  return (
    <div className="stu rh" ref={wrap}>
      <div className="stu-bar">
        <span className="stu-t">{title}</span>
        {statuses.has("SYNTHETIC") ? <span className="rh-badge">Synthetic data</span> : null}
        {statuses.has("TEST") ? <span className="rh-badge">Test data</span> : null}
        {shadowOk && overlay ? <span className="rh-badge sh">Shadow overlay</span> : null}
        {updated !== null ? <span className="rh-upd">Last updated {fmtStamp(updated, tz)}</span> : null}
      </div>
      <div className="stu-bar">
        <div className="stu-seg rh-tabs" role="group" aria-label="Chart">
          {TABS.map((c) => <button key={c.id} className={chart === c.id ? "on" : ""} aria-pressed={chart === c.id} onClick={() => setChart(c.id)}>{c.label}</button>)}
        </div>
        <div className="stu-seg" role="group" aria-label="Time range">
          {RANGES.map((r) => { const ok = r === "ALL" || rangeHasData(data, r, h.bounds, nowMs); return <button key={r} disabled={!ok} className={range === r ? "on" : ""} aria-pressed={range === r} onClick={() => setRange(r)} title={ok ? undefined : "No observations in this range"}>{narrow && r === "NIGHT" ? "Night" : RANGE_LABEL[r]}</button>; })}
        </div>
        <div className="stu-seg" role="group" aria-label="Time zone">
          {ZONES.map((z) => <button key={z} className={zone === z ? "on" : ""} aria-pressed={zone === z} onClick={() => setZone(z)}>{ZONE_LABEL[z]}</button>)}
        </div>
        {shadowOk ? <label className="stu-tg"><input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} /> Overlay shadow model (not published)</label> : null}
      </div>
      <div className="stu-plot">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" tabIndex={0} onKeyDown={onKey} onPointerMove={onPoint} onPointerDown={onPoint}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") setCursor(null); }}
          aria-label={`${title}, ${TABS.find((c) => c.id === chart)!.label.toLowerCase()}: ${summary}. Use the left and right arrow keys to step through observations.`}>
          <defs>
            <clipPath id={`${uid}p`}><rect x={L} y={T - 2} width={Math.max(0, pw)} height={Math.max(0, H - T - B + 4)} /></clipPath>
            <clipPath id={`${uid}u`}><rect x={L} y={0} width={Math.max(0, pw)} height={Math.max(0, y0)} /></clipPath>
            <clipPath id={`${uid}d`}><rect x={L} y={y0} width={Math.max(0, pw)} height={Math.max(0, H - y0)} /></clipPath>
            <linearGradient id={`${uid}ga`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopOpacity=".26" style={{ stopColor: plusColor }} /><stop offset="1" stopOpacity="0" style={{ stopColor: plusColor }} /></linearGradient>
            <linearGradient id={`${uid}gb`} x1="0" y1="1" x2="0" y2="0"><stop offset="0" stopOpacity=".26" style={{ stopColor: minusColor }} /><stop offset="1" stopOpacity="0" style={{ stopColor: minusColor }} /></linearGradient>
          </defs>
          {h.outages.map((o, i) => { const a = Math.max(x(o.from), L), b = Math.min(x(o.to ?? endT), W - R); return b > a ? <g key={`u${i}`} className="rh-out"><rect x={a} y={T} width={b - a} height={H - T - B} /><title>{`Results source unavailable${o.provider !== "*" ? ` (${o.provider})` : ""}: ${o.reason}`}</title></g> : null; })}
          {preEnd !== null && preEnd > t0 ? <g><rect className="rh-pre" x={L} y={T} width={x(preEnd) - L} height={H - T - B} />{x(preEnd) - L > 120 ? <text className="rh-cap" x={L + 8} y={T + 13}>Pre-election forecast</text> : null}</g> : null}
          {preEnd !== null && preEnd < t1 && W - R - x(preEnd) > 70 ? <text className="rh-cap" x={x(preEnd) + 8} y={T + 13}>Live</text> : null}
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className={chart === "margin" && Math.abs(v) < 1e-9 ? "stu-zero" : "stu-grid"} />
              <text x={L - 8} y={y(v) + 3.5} textAnchor="end" className="stu-ax">{yLabel(v)}</text>
            </g>
          ))}
          {chart === "prob" ? <line x1={L} x2={W - R} y1={y(50)} y2={y(50)} className="rh-ref" /> : null}
          {xTicks.map((q) => <text key={q.t} x={x(q.t)} y={H - 9} textAnchor="middle" className="stu-ax" fontWeight={q.major ? 800 : undefined}>{q.label}</text>)}
          {markers.map((m, i) => (
            <g key={`${m.kind}${m.t}`} className="rh-mk">
              <line x1={x(m.t)} x2={x(m.t)} y1={T} y2={H - B} />
              {!narrow && (i === 0 || x(m.t) - x(markers[i - 1].t) > 90) && x(m.t) < W - R - 40 ? <text x={x(m.t) + 4} y={T - 8}>{m.label}</text> : null}
            </g>
          ))}
          <g clipPath={`url(#${uid}p)`}>
            {drawn.map(({ s, band }) => band ? <path key={`b${s.key}`} d={band} className="rh-band" style={{ fill: chart === "margin" && s.phase !== "SHADOW" ? "var(--rh-neutral)" : s.color }} /> : null)}
            {chart === "margin" ? drawn.map(({ s, area }) => area ? <g key={`a${s.key}`} opacity={s.phase === "FROZEN" ? 0.5 : 1}><path d={area} fill={`url(#${uid}ga)`} clipPath={`url(#${uid}u)`} /><path d={area} fill={`url(#${uid}gb)`} clipPath={`url(#${uid}d)`} /></g> : null) : null}
            {drawn.map(({ s, line, iso, obs }) => {
              const cls = `rh-line ${lineClass(s)}`;
              const split = chart === "margin" && s.phase !== "SHADOW";
              return (
                <g key={s.key}>
                  {line ? (split ? <><path d={line} className={cls} style={{ stroke: plusColor }} clipPath={`url(#${uid}u)`} /><path d={line} className={cls} style={{ stroke: minusColor }} clipPath={`url(#${uid}d)`} /></> : <path d={line} className={cls} style={{ stroke: s.color }} />) : null}
                  {iso.map((q, i) => <circle key={`i${i}`} className="rh-iso" cx={x(q.t)} cy={y(q.v)} r={3.4} style={{ fill: colorAt(s, q.v) }} />)}
                  {obs.map((q, i) => <circle key={`o${i}`} className="rh-obs" cx={x(q.t)} cy={y(q.v as number)} r={1.9} style={{ fill: colorAt(s, q.v as number) }} />)}
                </g>
              );
            })}
            {drawn.flatMap(({ s, flags }) => flags.map((q, i) => <circle key={`f${s.key}${i}`} className="rh-flag" cx={x(q.t)} cy={y(q.v as number)} r={5.5}><title>{q.flag === "DECREASE" ? "Reported total went down" : q.flag === "CORRECTION" ? "Correction" : q.flag === "REVISION" ? "Revised publication" : "Source time older than an earlier reading"}</title></circle>))}
          </g>
          {drawn.flatMap(({ s, off }) => off.slice(0, 6).map((o, i) => {
            const cx = Math.max(L + 6, x(o.t)), cy = o.up ? T - 1 : H - B + 1, c = colorAt(s, o.v);
            return (
              <g key={`x${s.key}${i}`} className="rh-off">
                <path d={o.up ? `M${cx - 5},${cy + 7}L${cx},${cy}L${cx + 5},${cy + 7}Z` : `M${cx - 5},${cy - 7}L${cx},${cy}L${cx + 5},${cy - 7}Z`} style={{ fill: c }} />
                {i === 0 && !narrow ? <text x={cx + 9} y={o.up ? cy + 8 : cy - 1} style={{ fill: c }}>{fmtEnd(o.v)} · off scale</text> : null}
                <title>{`${s.label}: ${fmtEnd(o.v)}, beyond the chart's scale`}</title>
              </g>
            );
          }))}
          {ends.map((e) => (
            <g key={`e${e.s.key}`}>
              <circle cx={x(endT)} cy={y(e.v)} r={4} style={{ fill: colorAt(e.s, e.v) }} />
              <text x={W - R + 10} y={e.y + 4.5} className="stu-endl" style={{ fontSize: narrow ? 11.5 : 13, fill: colorAt(e.s, e.v) }}>
                {e.off ? (e.off > 0 ? "\u25B2" : "\u25BC") : null}{fmtEnd(e.v)}
                {endTag(e.s) ? (narrow ? <tspan className="stu-ax" x={W - R + 10} dy="12" style={{ fontSize: 9.5 }}>{endTag(e.s).slice(0, 9)}</tspan> : <tspan className="stu-ax" dx="5">{endTag(e.s)}</tspan>) : null}
                {e.off ? <title>Beyond the chart&apos;s scale</title> : null}
              </text>
            </g>
          ))}
          {ct !== null && readout ? (
            <g className="stu-scrub" pointerEvents="none">
              <line x1={x(ct)} x2={x(ct)} y1={T} y2={H - B} />
              {readout.rows.map((r) => (r.value !== null ? <circle key={r.seriesKey} className="rh-dot" cx={x(ct)} cy={y(r.value)} r={4} strokeWidth={2.2} style={{ stroke: chart === "margin" && r.phase !== "SHADOW" ? (r.value >= 0 ? plusColor : minusColor) : r.color }} /> : null))}
            </g>
          ) : null}
        </svg>
        {empty ? <div className="rh-empty"><div><b>{chart === "votes" ? "No votes yet" : "Nothing published"}</b>{empty}{chart === "votes" ? " Reported totals appear here as results arrive." : ""}</div></div> : null}
        {readout && !narrow ? <Readout readout={readout} data={data} chart={chart} tz={tz} sides={[plusColor, minusColor]} cross={cross} style={{ left: `${(x(readout.t) / W) * 100}%`, transform: x(readout.t) > W * 0.55 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }} /> : null}
      </div>
      {readout && narrow ? <Readout readout={readout} data={data} chart={chart} tz={tz} sides={[plusColor, minusColor]} cross={cross} dock /> : null}
      <Legend data={data} chart={chart} narrow={narrow} outages={h.outages.length > 0} />
    </div>
  );
}

/** One line per other chart at the cursor time, so the three metrics read together. */
function crossLine(id: ChartId, d: ChartData, h: PreparedHistory, t: number): string | null {
  const rows = readoutAt(d, h, t).rows.map((r, i) => ({ r, s: d.series[i] })).filter(({ r }) => r.value !== null && r.phase !== "SHADOW");
  if (!rows.length) return null;
  const rank = (s: Series) => (s.source === "RESULT" ? 0 : s.phase === "LIVE" ? 1 : 2);
  if (id === "margin") {
    const proj = rows.filter(({ s }) => s.source === "MODEL").sort((a, b) => rank(a.s) - rank(b.s))[0];
    const cnt = rows.find(({ s }) => s.source === "RESULT");
    return `Margin: ${[proj ? `${fmtLead(proj.r.value, d.reference)} ${proj.s.phase === "FROZEN" ? "forecast" : "projected"}` : null, cnt ? `${fmtLead(cnt.r.value, d.reference)} counted` : null].filter(Boolean).join(" · ")}`;
  }
  const reported = id === "votes" && rows.some(({ s }) => s.source === "RESULT");
  const best = new Map<string, { r: ReadoutRow; s: Series }>();
  for (const e of rows) {
    if (id === "votes" && (e.s.source === "RESULT") !== reported) continue;
    const k = e.s.candidateId ?? e.s.key, cur = best.get(k);
    if (!cur || rank(e.s) < rank(cur.s)) best.set(k, e);
  }
  const parts = [...best.values()].map(({ r, s }) => `${lastName(s.label.replace(/ \(estimated final\)$/, ""))} ${id === "prob" ? fmtProb(r.value) : compact(r.value as number)}`);
  return `${id === "prob" ? "Win chance" : reported ? "Reported votes" : "Est. final votes"}: ${parts.join(" · ")}`;
}

function fmtValue(chart: ChartId, v: number, ref: ChartData["reference"]): string {
  if (chart === "prob") return v > 0 && v < 0.1 ? "<0.1%" : v > 99.9 && v < 100 ? ">99.9%" : `${v.toFixed(1)}%`;
  if (chart === "margin") return fmtLead(v, ref);
  return fmtVotes(v);
}

function sourceLine(r: ReadoutRow, tz: string | undefined): { text: string; tag: string | null } {
  const src = r.source;
  if (!src) return { text: "", tag: null };
  const tag = STATUS_NOTE[src.status];
  const asOf = r.asOf !== null ? `as of ${fmtStamp(r.asOf, tz)}` : "";
  const st = src.sourceTimestamp ? `source time ${fmtStamp(Date.parse(src.sourceTimestamp), tz)}` : "no source time given";
  if (src.kind === "MODEL_OUTPUT") {
    const v = src.model.version === "UNVERSIONED" ? "unversioned" : `v${src.model.version}`;
    const pub = src.publication;
    const when = pub && pub.class !== "PUBLISHED" ? `committed ${asOf.replace("as of ", "")}, never verified as published` : `published ${asOf.replace("as of ", "")}${pub?.revertedBy ? ", later reverted" : ""}`;
    return { text: `${CLASS_LABEL[src.sourceClass]} · ${src.model.id} ${v}, snapshot ${src.model.snapshot} · ${when}`, tag: tag ?? (pub && pub.class !== "PUBLISHED" ? pub.class : null) };
  }
  const rep = src.reporting?.pct != null ? ` · ${src.reporting.pct}% reporting (${src.reporting.definition.replace(/\.$/, "").toLowerCase()})` : "";
  return { text: `${CLASS_LABEL.RESULT_FEED} · ${src.provider} · first seen ${asOf.replace("as of ", "")} · ${st}${rep}`, tag };
}

function freshText(f: Freshness, tz: string | undefined): string {
  if (f.kind === "NEW") return "New reading at this time.";
  if (f.kind === "CONFIRMED") return `Re-confirmed unchanged at ${fmtStamp(f.at, tz)}.`;
  if (f.kind === "NO_NEW") return "No new result since this reading.";
  return `Source unavailable since ${fmtStamp(f.since, tz)} (${f.reason}). Last reported values shown.`;
}

function Readout({ readout, data, chart, tz, sides, cross, style, dock }: { readout: ReturnType<typeof readoutAt>; data: ChartData; chart: ChartId; tz: string | undefined; sides: [string, string]; cross: string[]; style?: React.CSSProperties; dock?: boolean }) {
  const byKey = new Map(data.series.map((s) => [s.key, s]));
  // a live model series that has started but has no value here is shown as a gap, so a missing probability is never mistaken for zero
  const rows = readout.rows.filter((r) => r.value !== null || (r.phase === "LIVE" && byKey.get(r.seriesKey)?.source === "MODEL" && (byKey.get(r.seriesKey)?.pts[0]?.t ?? Infinity) <= readout.t));
  const groups = new Map<string, { head: ReturnType<typeof sourceLine>; rows: ReadoutRow[]; flag: string | null; fresh: Freshness | null }>();
  for (const r of rows) {
    const k = r.source?.pointId ?? `none:${r.phase}`;
    let g = groups.get(k);
    if (!g) { g = { head: sourceLine(r, tz), rows: [], flag: null, fresh: r.freshness }; groups.set(k, g); }
    g.rows.push(r);
    if (r.flag && !g.flag) g.flag = r.flag === "DECREASE" ? "Reported total went down at this reading; kept as reported." : r.flag === "CORRECTION" ? `Correction${r.source?.revision.note ? `: ${r.source.revision.note}` : ""}.` : r.flag === "REVISION" ? `Revision of an earlier publication${r.source?.revision.note ? `: ${r.source.revision.note}` : ""}.` : "Source time is older than an earlier reading.";
  }
  return (
    <div className={`stu-read${dock ? " dock" : ""}`} style={style} aria-live="polite">
      <div className="d">{fmtStamp(readout.t, tz, true)}</div>
      {tz !== "UTC" ? <div className="u">{new Date(readout.t).toISOString().replace(".000Z", "Z")}</div> : null}
      {[...groups.values()].map((g, i) => (
        <div className="g" key={i}>
          {g.head.text ? <div className="s">{g.head.text}{g.head.tag ? <em>{g.head.tag}</em> : null}</div> : <div className="s">No publication at this time</div>}
          {g.rows.map((r) => (
            <div key={r.seriesKey} className={`r${r.value === null ? " na" : ""}`}>
              <i className={lineClass({ phase: r.phase, dash: r.dash })} style={{ color: chart === "margin" && r.phase !== "SHADOW" && r.value !== null ? sides[r.value >= 0 ? 0 : 1] : r.color }} />
              <span>{r.label}{chart === "margin" && r.band ? <small>{fmtLead(r.band[0], data.reference)} to {fmtLead(r.band[1], data.reference)}</small> : null}</span>
              <b>{r.value === null ? (chart === "prob" ? "not published" : "no value") : fmtValue(chart, r.value, data.reference)}</b>
            </div>
          ))}
          {g.flag ? <div className="f">{g.flag}</div> : null}
          {g.fresh ? <div className={`fr${g.fresh.kind === "SOURCE_UNAVAILABLE" ? " out" : ""}`}>{freshText(g.fresh, tz)}</div> : null}
        </div>
      ))}
      {!rows.length ? <div className="s">No published value at this time.</div> : null}
      {cross.length ? <div className="x">{cross.map((c) => <div key={c}>{c}</div>)}</div> : null}
    </div>
  );
}

function Legend({ data, chart, narrow, outages }: { data: ChartData; chart: ChartId; narrow: boolean; outages: boolean }) {
  const has = (f: (s: Series) => boolean) => data.series.some(f);
  const band = data.series.find((s) => s.band);
  const ref = data.reference;
  return (
    <div className="stu-foot">
      {chart === "prob" ? <>
        {has((s) => s.phase === "LIVE") ? <span><i className="ln live" />Published live projection</span> : null}
        {has((s) => s.phase === "FROZEN") ? <span><i className="ln frozen" />Frozen pre-election forecast</span> : null}
      </> : null}
      {chart === "margin" ? <>
        {ref ? <span>Margin is {lastName(ref.plus.name)} minus {lastName(ref.minus.name)}, in points of the total vote</span> : null}
        {has((s) => s.phase === "LIVE" && s.source === "MODEL") ? <span><i className="ln live" />Projected final margin</span> : null}
        {has((s) => s.phase === "FROZEN") ? <span><i className="ln frozen" />Frozen pre-election forecast</span> : null}
        {has((s) => s.source === "RESULT") ? <span><i className="ln dashed" />Counted-vote margin: votes counted so far, not a projection</span> : null}
        {band ? <span><i className="bd" />Shaded band: the interval the model published, shown only where it published one</span> : null}
      </> : null}
      {chart === "votes" ? <>
        {has((s) => s.source === "RESULT") ? <span><i className="ln live" />Reported votes</span> : null}
        {has((s) => s.dash === "DASHED" && s.phase === "LIVE") ? <span><i className="ln dashed" />Estimated final votes (model, not reported)</span> : null}
        {has((s) => s.phase === "FROZEN") ? <span><i className="ln frozen" />Frozen pre-election estimate of the final vote</span> : null}
      </> : null}
      {has((s) => s.phase === "SHADOW") ? <span><i className="ln shadow" style={{ color: SHADOW_COLOR }} />Shadow model: research only, not published</span> : null}
      {has((s) => s.pts.some((q) => q.flag)) ? <span><i className="rg" />Correction, decrease or revision, kept as recorded</span> : null}
      {outages ? <span><i className="ou" />Results source unavailable: nothing new could be read</span> : null}
      <span>Each value stands until the next update. A break means a value is known to be missing; nothing is filled in</span>
      <span className="k">{narrow ? "Tap the chart to read any update" : "Hover, tap or use the arrow keys to read any update"}</span>
      {data.notShown.length ? <span className="ns">{data.notShown.map((n) => `${n.name}: ${n.reason}`).join(" · ")}</span> : null}
    </div>
  );
}
