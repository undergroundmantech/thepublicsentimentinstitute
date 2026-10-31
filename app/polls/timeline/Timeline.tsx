"use client";
// A polling average told as a story: scroll and the line draws itself day by day, Pointy jogs along it, and the
// page stops at each event of the term to show where the average stood that day and two weeks later. The chart
// stays pinned while the page scrolls under it; the rail at the bottom jumps to any event.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "@/app/components/Link";
import Mascot from "@/app/components/home/Mascot";
import { KIND_LABEL, type TEvent } from "./events";
import "./timeline.css";

export type TLSeries = { label: string; color: string };
export type TLData = {
  id: string; title: string; kicker: string; lede: string; kind: "approval" | "generic"; avgHref: string; updated: string;
  a: TLSeries; b: TLSeries;
  daily: [number, number, number][]; // day (ms), side a, side b
  polls: [number, number, number][];
  events: TEvent[];
};

const DAY = 86400000;
const TRAVEL_MIN = 0.4, HOLD = 1.1, VH_PER_UNIT = 30;
const fmtDate = (t: number, long = true) => new Date(t).toLocaleDateString("en-US", { month: long ? "long" : "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const tsOf = (d: string) => Date.parse(d + "T00:00:00Z");

/** The value of the line on a day, read between the two nearest days. */
function valueAt(daily: TLData["daily"], t: number): [number, number] {
  if (!daily.length) return [0, 0];
  if (t <= daily[0][0]) return [daily[0][1], daily[0][2]];
  const last = daily[daily.length - 1]; if (t >= last[0]) return [last[1], last[2]];
  let lo = 0, hi = daily.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (daily[m][0] <= t) lo = m; else hi = m; }
  const a = daily[lo], b = daily[hi], k = (t - a[0]) / (b[0] - a[0] || 1);
  return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}

type Seg = { kind: "travel" | "hold"; t0: number; t1: number; w: number; ev: number; c0: number };

export default function Timeline({ data, embedded = false }: { data: TLData; embedded?: boolean }) {
  const { daily, polls } = data;
  const T0 = daily[0]?.[0] ?? 0, T1 = daily[daily.length - 1]?.[0] ?? 1;
  const events = useMemo(() => data.events.map((e) => ({ ...e, t: tsOf(e.date) })).filter((e) => e.t >= T0 - DAY && e.t <= T1), [data.events, T0, T1]);
  const isApp = data.kind === "approval";
  const fmtNet = useCallback((n: number) => (isApp ? `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}` : Math.abs(n) < 0.05 ? "Even" : `${n > 0 ? "D" : "R"} +${Math.abs(n).toFixed(1)}`), [isApp]);
  const netWord = isApp ? "Net approval" : "Generic ballot";

  // the scroll is cut into stretches: travel between events, weighted by the days between them, and a stop at each
  const segs = useMemo(() => {
    const out: Seg[] = []; let c = 0, prev = T0;
    events.forEach((e, i) => {
      const gap = Math.max(0, e.t - prev) / DAY;
      if (gap > 0) { const w = Math.max(TRAVEL_MIN, gap / 30); out.push({ kind: "travel", t0: prev, t1: e.t, w, ev: i, c0: c }); c += w; }
      out.push({ kind: "hold", t0: e.t, t1: e.t, w: HOLD, ev: i, c0: c }); c += HOLD; prev = e.t;
    });
    const tail = Math.max(0, T1 - prev) / DAY;
    out.push({ kind: "travel", t0: prev, t1: T1, w: Math.max(TRAVEL_MIN, tail / 30), ev: events.length, c0: c }); c += out[out.length - 1].w;
    out.push({ kind: "hold", t0: T1, t1: T1, w: HOLD, ev: events.length, c0: c }); c += HOLD;
    return { list: out, total: c };
  }, [events, T0, T1]);

  const wrap = useRef<HTMLElement>(null);
  const [p, setP] = useState(0);
  const [moving, setMoving] = useState<0 | 1 | 2>(0); // still, walking, jogging
  const [dir, setDir] = useState(1);
  useEffect(() => {
    let raf = 0, lastY = window.scrollY, lastT = performance.now(), still = 0;
    const read = () => {
      raf = 0; const el = wrap.current; if (!el) return;
      const r = el.getBoundingClientRect(), span = el.offsetHeight - window.innerHeight;
      const np = Math.max(0, Math.min(1, -r.top / (span || 1)));
      setP(np);
      const now = performance.now(), dy = window.scrollY - lastY, dt = Math.max(16, now - lastT); lastY = window.scrollY; lastT = now;
      const v = Math.abs(dy) / dt; // pixels per millisecond
      if (dy) setDir(dy > 0 ? 1 : -1);
      setMoving(v > 1.6 ? 2 : v > 0.05 ? 1 : 0);
      window.clearTimeout(still); still = window.setTimeout(() => setMoving(0), 160);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(read); };
    read(); window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); window.clearTimeout(still); };
  }, []);

  // where the scroll is: the day on the line, the stretch, and the event in view
  const at = useMemo(() => {
    const c = p * segs.total;
    const s = segs.list.find((x) => c >= x.c0 && c < x.c0 + x.w) ?? segs.list[segs.list.length - 1];
    const k = Math.min(1, Math.max(0, (c - s.c0) / s.w));
    const e = s.kind === "travel" ? 0.5 - 0.5 * Math.cos(Math.PI * k) : k; // ease in and out of every stop
    const t = s.kind === "travel" ? s.t0 + (s.t1 - s.t0) * e : s.t0;
    const active = s.kind === "hold" ? s.ev : s.ev - 1;
    return { t, hold: s.kind === "hold", active, k };
  }, [p, segs]);
  const [va, vb] = valueAt(daily, at.t);

  const jump = (ev: number) => {
    const el = wrap.current; if (!el) return;
    const s = segs.list.find((x) => x.kind === "hold" && x.ev === ev); if (!s) return;
    const span = el.offsetHeight - window.innerHeight, top = el.getBoundingClientRect().top + window.scrollY;
    const smooth = !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: top + ((s.c0 + s.w * 0.45) / segs.total) * span, behavior: smooth ? "smooth" : "auto" });
  };

  // the chart, sized to its box
  const box = useRef<HTMLDivElement>(null);
  const [sz, setSz] = useState({ w: 1000, h: 420 });
  useEffect(() => {
    const el = box.current; if (!el) return;
    const ro = new ResizeObserver(([en]) => { const r = en.contentRect; setSz({ w: Math.max(280, r.width), h: Math.max(200, r.height) }); });
    ro.observe(el); return () => ro.disconnect();
  }, []);
  const PAD = useMemo(() => ({ l: 44, r: 18, t: 54, b: 30 }), []);
  const lo = useMemo(() => Math.floor(Math.min(...daily.map((d) => Math.min(d[1], d[2]))) - 3), [daily]);
  const hi = useMemo(() => Math.ceil(Math.max(...daily.map((d) => Math.max(d[1], d[2]))) + 3), [daily]);
  const X = useCallback((t: number) => PAD.l + ((t - T0) / (T1 - T0 || 1)) * (sz.w - PAD.l - PAD.r), [T0, T1, sz.w, PAD.l, PAD.r]);
  const Y = useCallback((v: number) => PAD.t + ((hi - v) / (hi - lo || 1)) * (sz.h - PAD.t - PAD.b), [hi, lo, sz.h, PAD.t, PAD.b]);
  const paths = useMemo(() => {
    const line = (i: 1 | 2) => daily.map((d, j) => `${j ? "L" : "M"}${X(d[0]).toFixed(1)},${Y(d[i]).toFixed(1)}`).join("");
    const gap = `${daily.map((d, j) => `${j ? "L" : "M"}${X(d[0]).toFixed(1)},${Y(d[1]).toFixed(1)}`).join("")}${[...daily].reverse().map((d) => `L${X(d[0]).toFixed(1)},${Y(d[2]).toFixed(1)}`).join("")}Z`;
    const ticks: number[] = []; const step = hi - lo > 24 ? 10 : 5; for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const months: { t: number; lab: string; yr: boolean }[] = [];
    const d0 = new Date(T0); for (let y = d0.getUTCFullYear(), m = d0.getUTCMonth() + 1; ; m++) { if (m > 11) { m = 0; y++; } const t = Date.UTC(y, m, 1); if (t > T1) break; months.push({ t, lab: m === 0 ? String(y) : new Date(t).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }), yr: m === 0 }); }
    return { a: line(1), b: line(2), gap, ticks, months };
  }, [daily, X, Y, hi, lo, T0, T1]);
  // the heavy layers are built once per size, so scrolling only moves the cursor, the clip and Pointy
  const layers = useMemo(() => ({
    axes: <>
      {paths.ticks.map((v) => <g key={v}><line x1={PAD.l} x2={sz.w - PAD.r} y1={Y(v)} y2={Y(v)} className="tl-grid" /><text x={PAD.l - 8} y={Y(v) + 4} className="tl-ax" textAnchor="end">{v}%</text></g>)}
      {paths.months.map((m) => <g key={m.t}><line x1={X(m.t)} x2={X(m.t)} y1={sz.h - PAD.b} y2={sz.h - PAD.b + (m.yr ? 8 : 4)} className="tl-tk" />{sz.w > 640 || m.yr || new Date(m.t).getUTCMonth() % 3 === 0 ? <text x={X(m.t)} y={sz.h - 8} className={`tl-ax${m.yr ? " yr" : ""}`} textAnchor="middle">{m.lab}</text> : null}</g>)}
      <path d={paths.a} className="tl-ghost" stroke={data.a.color} /><path d={paths.b} className="tl-ghost" stroke={data.b.color} />
    </>,
    walked: <>
      <path d={paths.gap} fill={`url(#tlg-${data.id})`} />
      <g className="tl-dots">{polls.map((q, i) => <g key={i}><circle cx={X(q[0])} cy={Y(q[1])} r={2} fill={data.a.color} /><circle cx={X(q[0])} cy={Y(q[2])} r={2} fill={data.b.color} /></g>)}</g>
      <path d={paths.a} className="tl-line" stroke={data.a.color} /><path d={paths.b} className="tl-line" stroke={data.b.color} />
    </>,
  }), [paths, polls, X, Y, sz.w, sz.h, data.a.color, data.b.color, data.id, PAD.l, PAD.r, PAD.b]);

  const cx = X(at.t), ya = Y(va), yb = Y(vb), top = Math.min(ya, yb);
  const ev = at.active >= 0 && at.active < events.length ? events[at.active] : null;
  const evStats = useMemo(() => events.map((e) => { const [a0, b0] = valueAt(daily, e.t), [a1, b1] = valueAt(daily, Math.min(T1, e.t + 14 * DAY)); return { n0: a0 - b0, n1: a1 - b1, later: e.t + 14 * DAY <= T1 }; }), [events, daily, T1]);
  const pose = moving ? "walk" : at.hold && ev ? "point" : "idle";
  const first = daily[0], last = daily[daily.length - 1];
  const best = useMemo(() => daily.reduce((m, d) => (d[1] - d[2] > m[1] - m[2] ? d : m), daily[0]), [daily]);
  const worst = useMemo(() => daily.reduce((m, d) => (d[1] - d[2] < m[1] - m[2] ? d : m), daily[0]), [daily]);
  const runnerX = Math.max(30, Math.min(sz.w - 30, cx));

  return (
    <div className={`opp tl${embedded ? " tl-emb" : ""}`}>
      {embedded ? null : <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><Link href={data.avgHref}>{data.title}</Link><span className="sep">/</span><span>Timeline</span></nav>}
      <header className="tl-hero">
        <div>
          <div className="eye g">{data.kicker}</div>
          {embedded ? <h2>{data.title}, <em>the story so far.</em></h2> : <h1>{data.title}, <em>the story so far.</em></h1>}
          <p className="lede">{data.lede}</p>
          <p className="tl-cue"><span aria-hidden="true" className="tl-mouse"><i /></span>Scroll to walk the line with Pointy. Every stop is a moment that made news; the numbers show where the average stood that day and two weeks later.</p>
        </div>
        <dl className="tl-stats">
          <div><dt>Now</dt><dd>{fmtNet(last[1] - last[2])}</dd><span>{fmtDate(last[0], false)}</span></div>
          <div><dt>At the start</dt><dd>{fmtNet(first[1] - first[2])}</dd><span>{fmtDate(first[0], false)}</span></div>
          <div><dt>{isApp ? "High" : "Best for Democrats"}</dt><dd>{fmtNet(best[1] - best[2])}</dd><span>{fmtDate(best[0], false)}</span></div>
          <div><dt>{isApp ? "Low" : "Best for Republicans"}</dt><dd>{fmtNet(worst[1] - worst[2])}</dd><span>{fmtDate(worst[0], false)}</span></div>
        </dl>
      </header>

      <section ref={wrap} className="tl-scroll" style={{ height: `calc(${Math.round(segs.total * (embedded ? VH_PER_UNIT * 0.6 : VH_PER_UNIT))}vh + 100vh)` }} aria-label={`${data.title} timeline`}>
        <div className="tl-stick">
          <div className="tl-read">
            <div className="tl-date"><span>{at.hold && ev ? "Stop" : "On the trail"}</span><b>{fmtDate(at.t)}</b></div>
            <div className="tl-vals">
              <div style={{ color: data.a.color }}><span>{data.a.label}</span><b>{va.toFixed(1)}<small>%</small></b></div>
              <div style={{ color: data.b.color }}><span>{data.b.label}</span><b>{vb.toFixed(1)}<small>%</small></b></div>
              <div className="net"><span>{netWord}</span><b>{fmtNet(va - vb)}</b></div>
            </div>
          </div>

          <div className="tl-chart" ref={box}>
            <svg width={sz.w} height={sz.h} viewBox={`0 0 ${sz.w} ${sz.h}`} role="img" aria-label={`${data.title} from ${fmtDate(T0)} to ${fmtDate(T1)}`}>
              <defs>
                <clipPath id={`tlc-${data.id}`}><rect x="0" y="0" width={Math.max(0, cx)} height={sz.h} /></clipPath>
                <linearGradient id={`tlg-${data.id}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={data.a.color} stopOpacity=".16" /><stop offset="1" stopColor={data.b.color} stopOpacity=".16" /></linearGradient>
              </defs>
              {/* the road ahead, faint, and the road walked, bright */}
              {layers.axes}
              <g clipPath={`url(#tlc-${data.id})`}>{layers.walked}</g>
              {events.map((e, i) => {
                const x = X(e.t), on = i === at.active && at.hold, past = e.t <= at.t;
                return (
                  <g key={e.date + i} className={`tl-pin${past ? " past" : ""}${on ? " on" : ""}`} onClick={() => jump(i)}>
                    <line x1={x} x2={x} y1={22} y2={sz.h - PAD.b} />
                    <circle cx={x} cy={18} r={on ? 11 : 8} />
                    <text x={x} y={21.5} textAnchor="middle">{i + 1}</text>
                    <title>{`${fmtDate(e.t)}: ${e.title}`}</title>
                  </g>
                );
              })}
              <line x1={cx} x2={cx} y1={PAD.t - 10} y2={sz.h - PAD.b} className="tl-cur" />
              <circle cx={cx} cy={ya} r={5.5} fill={data.a.color} className="tl-head" /><circle cx={cx} cy={yb} r={5.5} fill={data.b.color} className="tl-head" />
            </svg>
            <div className={`tl-runner${moving === 2 ? " jog" : ""}`} data-motion-ok="" style={{ transform: `translate(${runnerX}px, ${top}px)` }} aria-hidden="true">
              <div style={{ transform: `translate(-50%, -100%) scaleX(${dir})` }}><Mascot size={moving === 2 ? 92 : 86} pose={pose} prop={pose === "point" ? "pointer" : "clipboard"} look={1} /></div>
            </div>
          </div>

          <div className="tl-card-slot">
            {ev ? (
              <article key={at.active} className={`tl-card k-${ev.kind}${at.hold ? " on" : ""}`}>
                <div className="tl-card-h"><span className="tl-kind">{KIND_LABEL[ev.kind]}</span><span className="tl-n">Stop {at.active + 1} of {events.length}</span><time>{fmtDate(ev.t)}</time></div>
                <h2>{ev.title}</h2>
                <p>{ev.text}</p>
                <div className="tl-move">
                  <span>{netWord} that day <b>{fmtNet(evStats[at.active].n0)}</b></span>
                  {evStats[at.active].later ? <span>Two weeks later <b>{fmtNet(evStats[at.active].n1)}</b> <em className={(evStats[at.active].n1 - evStats[at.active].n0) * (isApp ? 1 : 1) >= 0 ? "up" : "dn"}>{(evStats[at.active].n1 - evStats[at.active].n0) >= 0 ? "+" : "−"}{Math.abs(evStats[at.active].n1 - evStats[at.active].n0).toFixed(1)}</em></span> : <span>Two weeks later: not yet</span>}
                  <a href={ev.source} target="_blank" rel="noopener noreferrer">Source</a>
                </div>
              </article>
            ) : (
              <article className="tl-card intro"><h2>{fmtDate(T0)}</h2><p>The first day of the average. Keep scrolling: Pointy walks the line one day at a time and stops at each of {events.length} events.</p></article>
            )}
          </div>

          <div className="tl-rail" aria-label="Jump to an event">
            <div className="tl-rail-bar"><i style={{ width: `${(100 * (at.t - T0)) / (T1 - T0 || 1)}%` }} /></div>
            {events.map((e, i) => <button key={e.date + i} type="button" className={`k-${e.kind}${e.t <= at.t ? " past" : ""}${i === at.active && at.hold ? " on" : ""}`} style={{ left: `${(100 * (e.t - T0)) / (T1 - T0 || 1)}%` }} onClick={() => jump(i)} aria-label={`${fmtDate(e.t)}: ${e.title}`} title={`${fmtDate(e.t, false)}: ${e.title}`} />)}
          </div>
        </div>
      </section>

      <section className="tl-all" aria-label="Every event">
        <div className="sec-h"><h2>Every stop on the timeline</h2><span className="eye">{events.length} events</span></div>
        <p className="tl-note">The change is the move in the average over the two weeks after each event. Polls move for many reasons at once, so a move after an event is not proof the event caused it.</p>
        <ol className="tl-grid-list">
          {events.map((e, i) => { const s = evStats[i], d = s.n1 - s.n0; return (
            <li key={e.date + i} className={`k-${e.kind}`}>
              <button type="button" onClick={() => jump(i)}>
                <span className="tl-kind">{KIND_LABEL[e.kind]}</span><time>{fmtDate(e.t, false)}</time>
                <b>{e.title}</b>
                <span className="tl-mv">{fmtNet(s.n0)}{s.later ? <> then {fmtNet(s.n1)} <em className={d >= 0 ? "up" : "dn"}>{d >= 0 ? "+" : "−"}{Math.abs(d).toFixed(1)}</em></> : null}</span>
              </button>
            </li>); })}
        </ol>
        <p className="tl-src">The line is the On Point Politics polling average, updated {data.updated}, from every public poll weighted by recency, sample, voter screen and pollster grade. <Link href={data.avgHref}>Open the full average with every poll</Link>.</p>
      </section>
    </div>
  );
}
