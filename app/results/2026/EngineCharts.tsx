"use client";
// Election-night charts, in the manner of The New York Times' live results graphics: a plain white (or dark) field,
// hairline horizontal gridlines, no frame, small grey axis type, lines labelled directly at their ends instead of a
// legend, a quiet shaded band for the model's range, and a thin rule at the moment being shown.
//
// Honesty rules, every chart:
//   - every point is a stored engine state (or a provider report inside one); nothing is drawn between observations
//     except a held value: a figure stands until the next observation replaces it (a step);
//   - a stretch with no observation longer than GAP_MIN is shaded and labelled, not drawn through;
//   - reported figures are solid and dark; modeled figures are coloured with their range; each chart names its source,
//     its mode (SIMULATED is said in words) and the time of its last observation.
import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import type { NationalPoint, RacePoint } from "@/app/lib/engine/recorder";

const ET = "America/New_York";
const GAP_MIN = 45;
const hourLabel = (ms: number) => { const s = new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", timeZone: ET }); return s.replace(" AM", " a.m.").replace(" PM", " p.m."); };
const clock = (ms: number) => new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }).replace(" AM", " a.m.").replace(" PM", " p.m.");
export const marginText = (m: number | null | undefined) => (m == null || !Number.isFinite(m) ? "—" : Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"}+${Math.abs(m).toFixed(1)}`);
export const probText = (p: number | null | undefined) => (p == null ? "—" : p >= 0.995 ? ">99%" : p <= 0.005 ? "<1%" : `${Math.round(100 * p)}%`);

export type Pt = { t: number; v: number | null };
export type Series = { id: string; label: string; color: string; pts: Pt[]; band?: { t: number; lo: number; hi: number }[]; weight?: number; dash?: string; endLabel?: (v: number) => string };
type Ref = { v: number; label: string };

/**
 * The chart is drawn at the size of its container, in real pixels: the type and the line weights stay the same size
 * whether the chart sits in a narrow column or across the page. (It used to be one 640-unit drawing scaled to fit,
 * which shrank a chart in a 370-pixel column to type too small to read.) `tall` gives a chart the room of a headline
 * graphic; `height` fixes it outright.
 */
export function TimeChart({ title, sub, series, y, yFmt, refs = [], now, gapsFrom, source, height, tall, empty, rightPad = 96 }: {
  title: string; sub?: React.ReactNode; series: Series[]; y: [number, number]; yFmt: (v: number) => string; refs?: Ref[]; now?: number | null;
  gapsFrom: number[]; source: string; height?: number; tall?: boolean; empty?: string; rightPad?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const fig = useRef<HTMLElement>(null); const [bw, setBw] = useState(0);
  useEffect(() => {
    const el = fig.current; if (!el) return; const read = () => setBw(Math.round(el.clientWidth));
    read(); if (typeof ResizeObserver === "undefined") return; const ro = new ResizeObserver(read); ro.observe(el); return () => ro.disconnect();
  }, []);
  const W = bw > 0 ? Math.max(280, bw) : 640;
  const H = height ?? Math.round(tall ? Math.min(460, Math.max(280, W * 0.5)) : Math.min(340, Math.max(220, W * 0.44)));
  const L = 2, R = W < 420 ? Math.min(rightPad, 84) : rightPad, T = 16, B = 26;
  const times = gapsFrom;
  const [hover, setHover] = useState<number | null>(null);
  const all = series.flatMap((s) => s.pts.map((p) => p.t));
  const t0 = Math.min(...all, ...(now ? [now] : [])), t1 = Math.max(...all, ...(now ? [now] : []), t0 + 60_000);
  const x = (t: number) => L + ((W - L - R) * (t - t0)) / Math.max(1, t1 - t0);
  const yy = (v: number) => T + ((H - T - B) * (y[1] - Math.min(y[1], Math.max(y[0], v)))) / (y[1] - y[0]);
  const gaps = useMemo(() => { const g: [number, number][] = []; for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] > GAP_MIN * 60_000) g.push([times[i - 1], times[i]]); return g; }, [times]);
  const inGap = (a: number, b: number) => gaps.some(([g0, g1]) => a >= g0 && b <= g1 && b - a > GAP_MIN * 60_000);
  const stepPath = (pts: Pt[]) => {
    let d = ""; let pen = false;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i]; if (p.v == null) { pen = false; continue; }
      const nx = i + 1 < pts.length ? pts[i + 1].t : now ?? p.t;
      if (!pen) { d += `M${x(p.t).toFixed(1)},${yy(p.v).toFixed(1)}`; pen = true; } else d += `V${yy(p.v).toFixed(1)}`;
      if (inGap(p.t, nx)) { pen = false; continue; }
      d += `H${x(Math.max(p.t, Math.min(nx, t1))).toFixed(1)}`;
    }
    return d;
  };
  const bandPath = (b: NonNullable<Series["band"]>) => {
    const parts: string[] = [];
    for (let i = 0; i < b.length; i++) {
      const p = b[i], nx = i + 1 < b.length ? b[i + 1].t : now ?? p.t; if (inGap(p.t, nx)) continue;
      const x0 = x(p.t), x1 = x(Math.max(p.t, nx)); parts.push(`M${x0.toFixed(1)},${yy(p.hi).toFixed(1)}H${Math.max(x0 + 1, x1).toFixed(1)}V${yy(p.lo).toFixed(1)}H${x0.toFixed(1)}Z`);
    }
    return parts.join("");
  };
  // horizontal grid: four or five round values
  const ticks = useMemo(() => { const span = y[1] - y[0], raw = span / 4, mag = 10 ** Math.floor(Math.log10(raw)), st = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= 5) ?? raw; const out: number[] = []; for (let v = Math.ceil(y[0] / st) * st; v <= y[1] + 1e-9; v += st) out.push(Math.round(v * 1e6) / 1e6); return out; }, [y]);
  // hour labels, thinned to what the width can hold (about 64 pixels a label); past a day the labels are days
  const hours = useMemo(() => {
    const out: number[] = []; const span = (t1 - t0) / 3_600_000, room = Math.max(2, Math.floor((W - L - R) / 64));
    const stepH = [1, 2, 3, 4, 6, 12, 24, 48].find((s) => span / s <= room) ?? 72;
    // ticks fall on round Eastern hours (UTC-5 in November), so a multi-day chart is marked at midnight and noon
    const off = 5 * 3_600_000, st = 3_600_000 * stepH, h0 = Math.ceil((t0 - off) / st) * st + off; for (let t = h0; t <= t1; t += st) out.push(t); return out;
  }, [t0, t1, W, R]);
  const longSpan = t1 - t0 > 30 * 3_600_000;
  const tickLabel = (t: number) => { if (!longSpan) return hourLabel(t); const h = Number(new Date(t).toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone: ET }).replace(/\D/g, "")) % 24; return h === 0 ? new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET }) : hourLabel(t); };
  // direct labels at line ends, nudged apart
  const ends = series.map((s) => { const last = [...s.pts].reverse().find((p) => p.v != null); return last ? { s, v: last.v as number, y: yy(last.v as number) } : null; }).filter(Boolean) as { s: Series; v: number; y: number }[];
  ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 15) ends[i].y = ends[i - 1].y + 15;
  const hasData = series.some((s) => s.pts.some((p) => p.v != null));
  const onMove = (e: React.PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); const px = ((e.clientX - r.left) / r.width) * W; const t = t0 + ((px - L) / (W - L - R)) * (t1 - t0); let best = -1; for (let i = 0; i < times.length; i++) if (times[i] <= t) best = i; setHover(best >= 0 ? times[best] : null); };
  const readAt = (s: Series, t: number) => { let v: number | null = null; for (const p of s.pts) { if (p.t <= t) v = p.v; else break; } return v; };
  return (
    <figure className={`ec${tall ? " ec-tall" : ""}`} ref={fig}>
      <figcaption className="ec-h"><b>{title}</b>{sub ? <span>{sub}</span> : null}</figcaption>
      {!hasData ? <div className="ec-empty">{empty ?? "No observations yet."}</div> : (
        <div className="ec-plot">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${series.map((s) => { const e = ends.find((q) => q.s === s); return e ? `${s.label}: ${(s.endLabel ?? yFmt)(e.v)}` : ""; }).filter(Boolean).join("; ")}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
            <defs><pattern id={`gap${uid}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="6" className="ec-hatch" /></pattern></defs>
            {ticks.map((v) => <g key={v}><line x1={L} x2={W - R} y1={yy(v)} y2={yy(v)} className="ec-grid" /><text x={L} y={yy(v) - 3} className="ec-ax">{yFmt(v)}</text></g>)}
            {refs.map((r) => <g key={r.label || r.v}><line x1={L} x2={W - R} y1={yy(r.v)} y2={yy(r.v)} className="ec-ref" />{r.label ? <text x={W - R - 2} y={yy(r.v) - 4} textAnchor="end" className="ec-reft">{r.label}</text> : null}</g>)}
            {gaps.map(([a, b]) => <g key={a}><rect x={x(a)} y={T} width={Math.max(0, x(b) - x(a))} height={H - T - B} fill={`url(#gap${uid})`} className="ec-gap" /><text x={(x(a) + x(b)) / 2} y={H - B - 6} textAnchor="middle" className="ec-gapt">{Math.round((b - a) / 3_600_000 * 10) / 10} hours with no observations</text></g>)}
            {series.map((s) => (s.band ? <path key={`b${s.id}`} d={bandPath(s.band)} fill={s.color} className="ec-band" /> : null))}
            {series.map((s) => <path key={s.id} d={stepPath(s.pts)} stroke={s.color} strokeWidth={(s.weight ?? 2) * (tall ? 1.25 : 1.1)} strokeDasharray={s.dash} className="ec-line" />)}
            {hours.map((t) => <text key={t} x={x(t)} y={H - 7} textAnchor={x(t) > W - R - 22 ? "end" : x(t) < L + 22 ? "start" : "middle"} className="ec-ax">{tickLabel(t)}</text>)}
            {now != null ? <line x1={x(now)} x2={x(now)} y1={T - 4} y2={H - B} className="ec-now" /> : null}
            {hover != null ? <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="ec-hover" /> : null}
            {ends.map((e) => <text key={e.s.id} x={W - R + 6} y={e.y + 4} className="ec-end" fill={e.s.color}><tspan className="ec-endl">{e.s.label}</tspan> {(e.s.endLabel ?? yFmt)(e.v)}</text>)}
          </svg>
          {hover != null ? <div className="ec-read" aria-live="off"><b>{clock(hover)}</b>{series.map((s) => { const v = readAt(s, hover); return v == null ? null : <span key={s.id} style={{ color: s.color }}>{s.label} {(s.endLabel ?? yFmt)(v)}</span>; })}</div> : null}
        </div>
      )}
      <div className="ec-src">{source}</div>
    </figure>
  );
}

// ---- the national charts --------------------------------------------------------------------------------------------
const DEM = "var(--dem)", GOP = "var(--gop)", INK = "var(--hi, #111)";
const srcLine = (mode: string, pts: { t: string }[]) => `Source: civicAPI returns; On Point model (uncalibrated)${mode === "SIMULATED" ? " · SIMULATED DATA, NOT ACTUAL RESULTS" : mode === "HISTORICAL" ? " · replay of recorded observations" : ""}${pts.length ? ` · last observation ${clock(Date.parse(pts[pts.length - 1].t))} ET` : ""}`;

export type NationalChartKey = "house-control" | "senate-control" | "house-seats" | "senate-seats" | "gov-seats" | "vote";
const NAT_GROUPS: Record<"control" | "seats" | "vote", NationalChartKey[]> = { control: ["house-control", "senate-control"], seats: ["house-seats", "senate-seats", "gov-seats"], vote: ["vote"] };
export const NATIONAL_CHART_LABEL: Record<NationalChartKey, string> = { "house-control": "House control", "senate-control": "Senate control", "house-seats": "House seats", "senate-seats": "Senate seats", "gov-seats": "Governors", vote: "Popular vote" };

/** `only`: groups ("control", "seats", "vote") or single charts by key. `tall`: headline size. `stack`: one chart per row. */
export function NationalCharts({ pts, now, mode, only, tall, stack, height }: { pts: NationalPoint[]; now?: number | null; mode: string; only?: ("control" | "seats" | "vote" | NationalChartKey)[]; tall?: boolean; stack?: boolean; /** a fixed chart height in pixels (the monitor's dock) */ height?: number }) {
  const times = pts.map((p) => Date.parse(p.t));
  const keys = new Set<NationalChartKey>((only ?? (["control", "seats", "vote"] as const)).flatMap((k) => (k in NAT_GROUPS ? NAT_GROUPS[k as "control" | "seats" | "vote"] : [k as NationalChartKey])));
  const show = (k: NationalChartKey) => keys.has(k);
  const S = (f: (p: NationalPoint) => number | null) => pts.map((p) => ({ t: Date.parse(p.t), v: f(p) }));
  const B = (f: (p: NationalPoint) => [number, number, number]) => pts.map((p) => { const [lo, , hi] = f(p); return { t: Date.parse(p.t), lo, hi }; });
  const pctFmt = (v: number) => `${Math.round(v)}%`;
  // the axis always contains the whole range band, so a band is never cut off at the edge
  const fit = (k: "house" | "sen" | "gov", base: [number, number], step: number): [number, number] => { const v = pts.flatMap((p) => [p[k].d[0], p[k].d[2], p[k].r[0], p[k].r[2]]); return [Math.min(base[0], Math.floor(Math.min(...v) / step) * step), Math.max(base[1], Math.ceil(Math.max(...v) / step) * step)]; };
  const seatsChart = (k: "house" | "sen" | "gov", title: string, y: [number, number], maj: Ref) => (
    <TimeChart key={k} tall={tall} height={height} title={title} sub={pts.some((p) => p[k].calledD + p[k].calledR > 0) ? "Projected final seats, with the model's 80% range. Dotted: seats On Point has called." : "Projected final seats, with the model's 80% range, including seats not up this year."} y={y} yFmt={(v) => String(Math.round(v))} refs={[maj]} now={now} gapsFrom={times} source={srcLine(mode, pts)}
      series={[
        { id: "d", label: "Dem.", color: DEM, pts: S((p) => p[k].d[1]), band: B((p) => p[k].d), endLabel: (v) => v.toFixed(0) },
        { id: "r", label: "Rep.", color: GOP, pts: S((p) => p[k].r[1]), band: B((p) => p[k].r), endLabel: (v) => v.toFixed(0) },
        ...(pts.some((p) => p[k].calledD + p[k].calledR > 0) ? [
          { id: "dc", label: "D called", color: DEM, pts: S((p) => p[k].calledD), weight: 1, dash: "2 3", endLabel: (v: number) => v.toFixed(0) },
          { id: "rc", label: "R called", color: GOP, pts: S((p) => p[k].calledR), weight: 1, dash: "2 3", endLabel: (v: number) => v.toFixed(0) }] : []),
      ]} />
  );
  return (
    <div className={`ec-grid2${stack ? " ec-stack" : ""}`}>
      {show("house-control") ? <TimeChart tall={tall} height={height} title="Chance of controlling the House" sub="Modeled from the returns at each moment. A probability, not a call." y={[0, 100]} yFmt={pctFmt} refs={[{ v: 50, label: "" }]} now={now} gapsFrom={times} source={srcLine(mode, pts)}
          series={[{ id: "d", label: "Dem.", color: DEM, pts: S((p) => 100 * p.house.pD), endLabel: (v) => probText(v / 100) }, { id: "r", label: "Rep.", color: GOP, pts: S((p) => 100 * p.house.pR), endLabel: (v) => probText(v / 100) }]} /> : null}
      {show("senate-control") ? <TimeChart tall={tall} height={height} title="Chance of controlling the Senate" sub="51 seats, or 50 with the Vice President. Independents are counted with the Democratic caucus (an assumption)." y={[0, 100]} yFmt={pctFmt} refs={[{ v: 50, label: "" }]} now={now} gapsFrom={times} source={srcLine(mode, pts)}
          series={[{ id: "d", label: "Dem.", color: DEM, pts: S((p) => 100 * p.sen.pD), endLabel: (v) => probText(v / 100) }, { id: "r", label: "Rep.", color: GOP, pts: S((p) => 100 * p.sen.pR), endLabel: (v) => probText(v / 100) }]} /> : null}
      {show("house-seats") ? seatsChart("house", "Projected House seats", fit("house", [150, 290], 10), { v: 218, label: "218 for control" }) : null}
      {show("senate-seats") ? seatsChart("sen", "Projected Senate seats", fit("sen", [40, 60], 2), { v: 50.5, label: "51 for control" }) : null}
      {show("gov-seats") ? seatsChart("gov", "Projected governorships", fit("gov", [10, 40], 2), { v: 25.5, label: "26 for a majority" }) : null}
      {show("vote") ? (
        <TimeChart tall={tall} height={height} title="National House popular vote" sub="Black: margin of the votes counted so far. Colour: projected final margin, with its 80% range." y={(() => { const v = pts.flatMap((p) => [p.hpv.proj[0], p.hpv.proj[2], p.hpv.obs ?? 0]); return [Math.floor(Math.min(-20, ...v) / 5) * 5, Math.ceil(Math.max(5, ...v) / 5) * 5] as [number, number]; })()} yFmt={(v) => marginText(v)} refs={[{ v: 0, label: "Even" }]} now={now} gapsFrom={times} source={srcLine(mode, pts)}
          series={[{ id: "obs", label: "Counted", color: INK, pts: S((p) => p.hpv.obs), weight: 1.6, endLabel: marginText }, { id: "proj", label: "Projected", color: "var(--accent, #7a5cff)", pts: S((p) => p.hpv.proj[1]), band: B((p) => p.hpv.proj), endLabel: marginText }]} />
      ) : null}
    </div>
  );
}

// ---- one race ------------------------------------------------------------------------------------------------------
const partyColor = (p: string | null, i: number) => { const s = (p ?? "").toLowerCase(); return s.startsWith("dem") || s === "d" ? DEM : s.startsWith("rep") || s === "r" ? GOP : ["#8a63d2", "#2f9e8f", "#c77d2b", "#6b7280"][i % 4]; };
/** `obsTimes`: when every update was taken (a race's history keeps only the updates where its figures changed, so gaps are judged on these, not on its points). */
export type RaceChartKey = "prob" | "margin" | "votes";
/** A race that needs a majority (a runoff is possible): the model gives no chance of winning, only of finishing first. */
export const firstRoundOnly = (pts: RacePoint[]): boolean => !pts.some((p) => Object.values(p.probs).some((v) => v != null)) && pts.some((p) => p.probability != null && p.leaderId != null);
export function RaceCharts({ pts, now, mode, obsTimes, only, tall, stack, lead, height }: { pts: RacePoint[]; now?: number | null; mode: string; obsTimes?: number[]; only?: RaceChartKey[]; tall?: boolean; stack?: boolean; /** the first chart across the full width at headline size, the rest beneath */ lead?: boolean; height?: number }) {
  const show = (k: RaceChartKey) => !only || only.includes(k);
  if (!pts.length) return <div className="ec-empty">No engine history for this race yet.</div>;
  const times = obsTimes?.length ? obsTimes : pts.map((p) => Date.parse(p.t)), last = pts[pts.length - 1];
  const ids = Object.keys(last.names).sort((a, b) => (last.shares[b] ?? 0) - (last.shares[a] ?? 0)).slice(0, 4);
  const short = (id: string) => (last.names[id]?.[0] ?? id).split(/\s+/).filter((w) => !/^(jr\.?|sr\.?|ii|iii|iv)$/i.test(w)).pop() ?? id;
  const [a, b] = last.top2 ?? [ids[0], ids[1]];
  const marg = pts.map((p) => {
    const t = Date.parse(p.t);
    if (p.top2 && p.margin) { const same = p.top2[0] === a && p.top2[1] === b, flip = p.top2[0] === b && p.top2[1] === a; if (same) return { t, v: p.margin[1], lo: p.margin[0], hi: p.margin[2] }; if (flip) return { t, v: -p.margin[1], lo: -p.margin[2], hi: -p.margin[0] }; }
    return { t, v: (p.shares[a] ?? 0) - (p.shares[b] ?? 0), lo: NaN, hi: NaN };
  });
  const repM = pts.map((p) => { const va = p.votes[a], vb = p.votes[b]; const tot = Object.values(p.votes).reduce((s: number, v) => s + (v ?? 0), 0); return { t: Date.parse(p.t), v: va != null && vb != null && tot > 0 ? (100 * (va - vb)) / tot : null }; });
  const mm = Math.max(10, ...marg.flatMap((m) => [Math.abs(m.v), Number.isFinite(m.hi) ? Math.abs(m.hi) : 0, Number.isFinite(m.lo) ? Math.abs(m.lo) : 0]), ...repM.map((m) => Math.abs(m.v ?? 0)));
  const lim = Math.ceil(mm / 5) * 5; const maxV = Math.max(1, ...pts.flatMap((p) => Object.values(p.votes).map((v) => v ?? 0)), last.expectedFinal ? last.expectedFinal * 0.6 : 0);
  const src = srcLine(mode, pts);
  const firstOnly = firstRoundOnly(pts);
  return (
    <div className={`ec-grid2${stack ? " ec-stack" : ""}${lead ? " ec-lead" : ""}`}>
      {show("prob") ? (firstOnly
        // a race that needs a majority (a runoff is possible) has no single chance of winning: the model's figure is the
        // chance of finishing first in this round, and it is drawn for whoever holds it at each update
        ? <TimeChart tall={tall || lead} height={height} title="Chance of finishing first" sub="This race needs a majority to be won outright, so a runoff is possible. The line is the model's chance that the candidate finishes first in this round; it is not a chance of winning the seat, and not a call." y={[0, 100]} yFmt={(v) => `${Math.round(v)}%`} refs={[{ v: 50, label: "" }]} now={now} gapsFrom={times} source={src}
            series={ids.filter((id) => pts.some((p) => p.leaderId === id && p.probability != null)).map((id, i) => ({ id, label: short(id), color: partyColor(last.names[id]?.[1] ?? null, i), pts: pts.map((p) => ({ t: Date.parse(p.t), v: p.leaderId === id && p.probability != null ? 100 * Math.min(0.995, Math.max(0.005, p.probability)) : null })), endLabel: (v: number) => probText(v / 100) }))} />
        : <TimeChart tall={tall || lead} height={height} title="Chance of winning" sub="The model's probability at each update. A probability is not a call; 100% is never shown for a race On Point has not called." y={[0, 100]} yFmt={(v) => `${Math.round(v)}%`} refs={[{ v: 50, label: "" }]} now={now} gapsFrom={times} source={src}
        series={ids.filter((id) => pts.some((p) => p.probs[id] != null)).map((id, i) => ({ id, label: short(id), color: partyColor(last.names[id]?.[1] ?? null, i), pts: pts.map((p) => ({ t: Date.parse(p.t), v: p.probs[id] == null ? null : 100 * Math.min(0.995, Math.max(0.005, p.probs[id] as number)) })), endLabel: (v: number) => probText(v / 100) }))} />) : null}
      {show("margin") ? <TimeChart tall={tall} height={height} title={`Projected final margin, ${short(a)} v ${short(b)}`} sub="Colour: projected final margin and 80% range. Black: margin of the votes counted so far." y={[-lim, lim]} yFmt={(v) => (Math.abs(v) < 0.01 ? "Even" : `${v > 0 ? short(a) : short(b)} +${Math.abs(v).toFixed(0)}`)} refs={[{ v: 0, label: "" }]} now={now} gapsFrom={times} source={src} rightPad={150}
        series={[{ id: "rep", label: "Counted", color: INK, pts: repM, weight: 1.6, endLabel: (v) => `${v >= 0 ? short(a) : short(b)} +${Math.abs(v).toFixed(1)}` },
          { id: "proj", label: "Projected", color: partyColor(last.names[a]?.[1] ?? null, 0), pts: marg.map((m) => ({ t: m.t, v: m.v })), band: marg.filter((m) => Number.isFinite(m.lo)).map((m) => ({ t: m.t, lo: m.lo, hi: m.hi })), endLabel: (v) => `${v >= 0 ? short(a) : short(b)} +${Math.abs(v).toFixed(1)}` }]} /> : null}
      {show("votes") ? <TimeChart tall={tall} height={height} title="Votes counted" sub="Reported by civicAPI. A count can go down when a county corrects it; it is drawn as reported." y={[0, maxV * 1.08]} yFmt={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${Math.round(v / 1000)}K`)} now={now} gapsFrom={times} source={src}
        series={ids.map((id, i) => ({ id, label: short(id), color: partyColor(last.names[id]?.[1] ?? null, i), pts: pts.map((p) => ({ t: Date.parse(p.t), v: p.votes[id] ?? null })), weight: 1.8, endLabel: (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : `${Math.round(v / 1000)}K`) }))} /> : null}
    </div>
  );
}

export const CHART_CSS = `
.ec{margin:0;padding:14px 0 6px;border-top:1px solid color-mix(in srgb,currentColor 14%,transparent);min-width:0;color:var(--hi)}
.ec-h{display:flex;flex-direction:column;gap:2px;margin-bottom:6px}
.ec-h b{font:700 16px/1.25 var(--font-d,inherit);color:var(--hi);letter-spacing:-.01em}
.ec-h span{font-size:12.5px;line-height:1.4;color:color-mix(in srgb,currentColor 64%,transparent)}
.ec-tall .ec-h b{font-size:19px}.ec-tall .ec-h span{font-size:13px}
.ec-plot{position:relative}
.ec svg{display:block;width:100%;height:auto;overflow:visible;touch-action:pan-y}
.ec-grid{stroke:currentColor;stroke-opacity:.13;stroke-width:1}
.ec-ref{stroke:currentColor;stroke-opacity:.5;stroke-width:1;stroke-dasharray:3 3}
.ec-reft{font:600 11px var(--font-b,inherit);fill:currentColor;fill-opacity:.66}
.ec-ax{font:500 11px var(--font-b,inherit);fill:currentColor;fill-opacity:.62;font-variant-numeric:tabular-nums}
.ec-line{fill:none;stroke-linejoin:round;stroke-linecap:round}
.ec-band{opacity:.14;stroke:none}
.ec-now{stroke:var(--hi);stroke-width:1.2}
.ec-hover{stroke:currentColor;stroke-opacity:.5;stroke-width:1}
.ec-end{font:700 12.5px var(--font-b,inherit);font-variant-numeric:tabular-nums}.ec-endl{font-weight:500}
.ec-gap{opacity:.5}.ec-hatch{stroke:currentColor;stroke-opacity:.25;stroke-width:2}
.ec-gapt{font:600 10.5px var(--font-b,inherit);fill:currentColor;fill-opacity:.66}
.ec-read{position:absolute;top:-2px;left:8px;display:flex;flex-wrap:wrap;gap:4px 12px;font:600 12px var(--font-b,inherit);background:rgb(var(--bg2-rgb,255,255,255));padding:3px 8px;border-radius:6px;box-shadow:0 1px 0 rgba(var(--line-rgb),.15);pointer-events:none;font-variant-numeric:tabular-nums}
.ec-read b{color:var(--hi)}
.ec-src{font-size:11px;color:color-mix(in srgb,currentColor 60%,transparent);margin-top:4px;letter-spacing:.01em}
.ec-empty{font-size:13px;color:color-mix(in srgb,currentColor 60%,transparent);padding:18px 0}
.ec-grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr));gap:4px 36px}
.ec-grid2.ec-stack{grid-template-columns:1fr}
.ec-grid2.ec-lead>.ec:first-child{grid-column:1/-1}
`;
