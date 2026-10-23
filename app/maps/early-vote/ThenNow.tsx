"use client";
// Then and now: the 2026 early vote against the same day before Election Day in 2022 and 2024. Ballots in and the
// registered party split of those ballots, reported where a state published them and modeled where it did not, from
// public/earlyvote-history-model.json, built by scripts/earlyvote/build_history_model.py.
//
// Read top to bottom: one sentence that says how 2026 compares, a ballot race between the three years, a tug of war
// for the party lead, then one big chart you can hover day by day (ballots, party lead, or pace against a past year),
// and for the nation a table of every state with its gap drawn in.
import React, { useEffect, useMemo, useRef, useState } from "react";
import Count from "@/app/components/opp/Count";
import type { EvConsole, EvRow } from "./consoleData";

type YrM = { n: (number | null)[]; nRep: number[]; d: (number | null)[]; r: (number | null)[]; pRep: number[] };
type HM = {
  meta: { fit: Record<"2022" | "2024", { countErrorByDay: number[]; partyErrorByDay: (number | null)[] }> };
  us2022: { daily: [number, number, number, number, number | null, number | null, number | null][]; partyStates: string[]; source: string; url: string };
  us2024?: { daily: [number, number, number | null, number | null, number | null, number | null][]; source: string };
  states: Record<string, Record<"2022" | "2024", YrM>>;
};
type Y = "2022" | "2024";
type P = { d: number; r: number };
type Pt = [number, number];

let hmP: Promise<HM | null> | null = null;
const getHM = () => (hmP ??= fetch("/earlyvote-history-model.json").then((r) => (r.ok ? r.json() : null)).catch(() => null));

const commas = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (n: number) => { const a = Math.abs(n); return a >= 1e6 ? `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M` : a >= 1e4 ? `${Math.round(n / 1e3)}K` : commas(n); };
const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const mLab = (m: number) => (Math.abs(m) < 0.05 ? "Even" : `${m < 0 ? "D" : "R"} +${Math.abs(m).toFixed(1)}`);
const chg = (r: number) => `${r >= 1 ? "+" : ""}${((r - 1) * 100).toFixed(0)}%`;
const margin = (p: P | null | undefined) => (p ? (p.r - p.d) * 100 : null);
const lerp = (pts: Pt[], d: number): number | null => {
  const s = [...pts].sort((a, b) => b[0] - a[0]);
  if (!s.length || d > s[0][0] || d < s[s.length - 1][0]) return null;
  for (let i = 0; i < s.length - 1; i++) { const a = s[i], b = s[i + 1]; if (d <= a[0] && d >= b[0]) return a[0] === b[0] ? a[1] : a[1] + ((a[0] - d) / (a[0] - b[0])) * (b[1] - a[1]); }
  return s[s.length - 1][1];
};
const leaderWord = (m: number) => (m < 0 ? "Democrats" : "Republicans");

/** a value on a fractional day from the national daily rows, read between the two nearest */
function natAt(rows: HM["us2022"]["daily"], d: number, col: number): number | null {
  return lerp(rows.filter((x) => x[col] != null).map((x) => [x[0], x[col] as number]), d);
}

type Cmp = { st: string; name: string; now: number; n22: number | null; n24: number | null; m22: boolean; m24: boolean;
  pNow: { d: number; r: number; est: boolean } | null; p22: { d: number; r: number; rep: boolean } | null; p24: { d: number; r: number; rep: boolean } | null };

function partyNow(r: EvRow): Cmp["pNow"] {
  if (r.pm) return { d: r.pm.d, r: r.pm.r, est: r.pm.est > 0.5 };
  const t = r.dem + r.rep + r.ind;
  return r.partyShare > 0.5 && t ? { d: r.dem / t, r: r.rep / t, est: false } : null;
}

function compare(r: EvRow, hm: HM, day: number): Cmp {
  const h = hm.states[r.st];
  const yr = (y: Y) => {
    const x = h?.[y]; if (!x) return { n: null, m: false, p: null };
    const n = x.n[day] ?? null, dd = x.d[day], rr = x.r[day];
    return { n, m: !x.nRep[day], p: dd != null && rr != null ? { d: dd, r: rr, rep: !!x.pRep[day] } : null };
  };
  const a = yr("2022"), b = yr("2024");
  return { st: r.st, name: r.name, now: r.total, n22: a.n, n24: b.n, m22: a.m, m24: b.m, pNow: partyNow(r), p22: a.p, p24: b.p };
}

// One view of a place, nation or state, on one scale for every graphic below.
export type View = {
  name: string; day: number;
  now: number; n22: number | null; n24: number | null; mod22: number; mod24: number;
  p26: P | null; p22: P | null; p24: P | null; p26Mod: boolean; p22Mod: boolean; p24Mod: boolean;
  c22: Pt[]; c24: Pt[]; c26: Pt[]; m22: Pt[]; m24: Pt[]; tally22?: Pt[]; tally24?: Pt[];
  partyNote?: string;
};

/** Fires once when the element first scrolls into view, so the graphics animate where they are seen. */
function useSeen<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null); const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (typeof IntersectionObserver === "undefined") { setSeen(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } }, { threshold: 0.25 });
    io.observe(el); return () => io.disconnect();
  }, []);
  return [ref, seen];
}

// ── the sentence at the top ──────────────────────────────────────────────────────────────────────────────────────────
function Verdict({ v }: { v: View }) {
  const part = (n: number | null, y: Y) => {
    if (!n) return null;
    const r = v.now / n, up = r >= 1;
    return <span className={`tn-hl ${up ? "up" : "dn"}`} key={y}>{Math.abs((r - 1) * 100).toFixed(0)}% {up ? "ahead of" : "behind"} {y}</span>;
  };
  const a = part(v.n22, "2022"), b = part(v.n24, "2024");
  const m26 = margin(v.p26), m22 = margin(v.p22);
  const sh = m26 != null && m22 != null ? m26 - m22 : null;
  return (
    <div className="tn-verdict">
      <div className="eye">{v.day} days before Election Day · same day in past cycles</div>
      <h2>
        {v.name === "Nationwide" ? "Nationwide, 2026 is" : `${v.name} is`} {a}{a && b ? " and " : ""}{b}{!a && !b ? "on its own, with no past count to compare" : ""}.
        {m26 != null ? <> {leaderWord(m26)} lead the ballots by <span className={`tn-hl ${m26 < 0 ? "d" : "r"}`}>{Math.abs(m26).toFixed(1)} points</span>{sh != null ? (Math.abs(sh) < 0.05 ? <>, the same as at this point in 2022</> : <>, a <span className={`tn-hl ${sh < 0 ? "d" : "r"}`}>{Math.abs(sh).toFixed(1)} point swing toward {sh < 0 ? "Democrats" : "Republicans"}</span> from this point in 2022</>) : null}.</> : null}
      </h2>
    </div>
  );
}

// ── a race between the three years ───────────────────────────────────────────────────────────────────────────────────
function BallotRace({ v }: { v: View }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const rows = ([["2026", v.now, 0], ["2022", v.n22, v.mod22], ["2024", v.n24, v.mod24]] as [string, number | null, number][]).filter((r) => r[1] != null) as [string, number, number][];
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <div className="tn-card tn-race" ref={ref}>
      <div className="tn-ch"><h3>Ballots in by today</h3><span>2026 against the same day</span></div>
      <div className="tn-bars">
        {rows.map(([y, n, mod], i) => (
          <div key={y} className={`tn-bar y${y}`}>
            <div className="lab"><b>{y}</b>{mod > 0.5 ? <em>modeled</em> : mod > 0 ? <em>{pct(mod, 0)} modeled</em> : null}</div>
            <div className="track">
              <i className="fill" style={{ width: seen ? `${(100 * n) / max}%` : "0%", transitionDelay: `${0.15 + i * 0.18}s` }} />
              {y === "2026" ? rows.filter((r) => r[0] !== "2026").map(([yy, nn]) => <s key={yy} className={`ghost y${yy}`} style={{ left: `${(100 * nn) / max}%`, opacity: seen ? 1 : 0 }} title={`${yy}: ${commas(nn)}`} />) : null}
              {n / max > 0.72
                ? <span className="num in" style={{ right: `calc(${100 - (100 * n) / max}% + 12px)`, opacity: seen ? 1 : 0 }}>{seen ? <Count value={n} /> : "0"}</span>
                : <span className="num" style={{ left: seen ? `calc(${(100 * n) / max}% + 10px)` : "10px" }}>{seen ? <Count value={n} /> : "0"}</span>}
            </div>
          </div>
        ))}
      </div>
      <div className="tn-deltas">
        {rows.filter((r) => r[0] !== "2026").map(([y, n]) => {
          const d = v.now - n, r = v.now / n;
          return (
            <div key={y} className={`tn-delta ${d >= 0 ? "up" : "dn"}`}>
              <span className="arrow" aria-hidden="true">{d >= 0 ? "▲" : "▼"}</span>
              <div><b>{chg(r)}</b><span>vs {y} · {d >= 0 ? "+" : "−"}{short(Math.abs(d))} ballots</span></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── a tug of war for the party lead ──────────────────────────────────────────────────────────────────────────────────
function PartyTug({ v }: { v: View }) {
  const [ref, seen] = useSeen<HTMLDivElement>();
  const pts = ([["2022", margin(v.p22), v.p22Mod], ["2024", margin(v.p24), v.p24Mod], ["2026", margin(v.p26), v.p26Mod]] as [string, number | null, boolean][]).filter((p) => p[1] != null) as [string, number, boolean][];
  if (!pts.length) return <div className="tn-card tn-tug"><div className="tn-ch"><h3>Party lead of the ballots</h3></div><p className="evc-note">No party split for {v.name} in any of these years.</p></div>;
  const R = Math.max(10, Math.ceil((Math.max(...pts.map((p) => Math.abs(p[1]))) + 4) / 5) * 5);
  const X = (m: number) => 50 + (m / R) * 50;
  const m26 = margin(v.p26), m22 = margin(v.p22), m24 = margin(v.p24);
  const shift = (a: number | null, b: number | null) => (a != null && b != null ? a - b : null);
  const s22 = shift(m26, m22), s24 = shift(m26, m24);
  return (
    <div className="tn-card tn-tug" ref={ref}>
      <div className="tn-ch"><h3>Party lead of the ballots</h3><span>by party registration, not votes</span></div>
      <div className="tn-rope">
        <div className="side d">Democrats lead</div><div className="side r">Republicans lead</div>
        <div className="axis">
          <i className="half d" /><i className="half r" />
          {[-R, -R / 2, 0, R / 2, R].map((t) => <span key={t} className="tick" style={{ left: `${X(t)}%` }}><em>{t === 0 ? "Even" : `${t < 0 ? "D" : "R"} +${Math.abs(t)}`}</em></span>)}
          {m22 != null && m26 != null ? <span className={`arrow ${m26 < m22 ? "d" : "r"}`} style={{ left: `${Math.min(X(m22), X(m26))}%`, width: seen ? `${Math.abs(X(m26) - X(m22))}%` : "0%" }} /> : null}
          {pts.map(([y, m, mod], i) => (
            <div key={y} className={`pin y${y} ${y === "2026" ? "hi" : y === "2024" && m22 != null && m24 != null && Math.abs(X(m24) - X(m22)) < 32 ? "lo2" : "lo"}`} style={{ left: seen ? `${X(m)}%` : "50%", transitionDelay: `${0.2 + i * 0.15}s` }}>
              <i /><b>{y}</b><span>{mLab(m)}{mod ? " · model" : ""}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="tn-deltas">
        {([["2022", s22], ["2024", s24]] as [string, number | null][]).filter((x) => x[1] != null).map(([y, s]) => (
          <div key={y} className={`tn-delta ${(s as number) < 0 ? "d" : "r"}`}>
            <span className="arrow" aria-hidden="true">{(s as number) < 0 ? "◀" : "▶"}</span>
            <div><b>{Math.abs(s as number) < 0.05 ? "No change" : `${(s as number) < 0 ? "D" : "R"} +${Math.abs(s as number).toFixed(1)}`}</b><span>moved since {y}</span></div>
          </div>
        ))}
      </div>
      {v.partyNote ? <p className="evc-note">{v.partyNote}</p> : null}
    </div>
  );
}

// ── the big chart ───────────────────────────────────────────────────────────────────────────────────────────────────
type Tab = "ballots" | "party" | "pace";
function BigChart({ v }: { v: View }) {
  const [tab, setTab] = useState<Tab>("ballots");
  const [base, setBase] = useState<Y>(v.n22 ? "2022" : "2024");
  const [hov, setHov] = useState<number | null>(null);
  const [ref, seen] = useSeen<HTMLDivElement>();
  const W = 1000, H = 380, P = { l: 66, r: 128, t: 22, b: 40 };
  const has26 = v.c26.length > 0;
  const dMax = Math.min(40, Math.max(21, ...v.c26.map((p) => p[0] + 6), ...(tab === "ballots" ? [] : [])));
  const x = (d: number) => P.l + ((dMax - Math.min(dMax, Math.max(0, d))) / dMax) * (W - P.l - P.r);
  const cBase = base === "2022" ? v.c22 : v.c24;
  // 2026 on its pace: today's ratio to the base year, carried along the base year's own curve to Election Day
  const nowRatio = cBase.length ? (() => { const b = lerp(cBase, v.day); return b ? v.now / b : null; })() : null;
  const proj: Pt[] = nowRatio ? cBase.filter((p) => p[0] <= v.day).map((p) => [p[0], p[1] * nowRatio]) : [];
  const paceSeries = (c: Pt[]): Pt[] => v.c26.map(([d, n]) => { const b = lerp(c, d); return b ? [d, (n / b) * 100] as Pt : null; }).filter(Boolean) as Pt[];
  const p22 = paceSeries(v.c22), p24 = paceSeries(v.c24);

  type S = { k: string; cls: string; pts: Pt[]; dash?: boolean; label: string; end?: boolean };
  let series: S[] = [], lo = 0, hi = 1, fmt = (n: number) => short(n), zeroLine: number | null = null;
  if (tab === "ballots") {
    series = [
      ...(v.c24.length ? [{ k: "24", cls: "y2024", pts: v.c24.filter((p) => p[0] <= dMax), label: "2024", end: true }] : []),
      ...(v.c22.length ? [{ k: "22", cls: "y2022", pts: v.c22.filter((p) => p[0] <= dMax), label: "2022", end: true }] : []),
      ...(v.tally22?.length ? [{ k: "tl", cls: "y2022 faint", pts: v.tally22.filter((p) => p[0] <= dMax), dash: true, label: "2022 tally" }] : []),
      ...(v.tally24?.length ? [{ k: "tl4", cls: "y2024 faint", pts: v.tally24.filter((p) => p[0] <= dMax), dash: true, label: "2024 tally" }] : []),
      ...(proj.length ? [{ k: "pj", cls: "y2026 proj", pts: proj, dash: true, label: "2026 on pace", end: true }] : []),
      ...(has26 ? [{ k: "26", cls: "y2026", pts: v.c26, label: "2026" }] : []),
    ];
    hi = Math.max(1, ...series.flatMap((s) => s.pts.map((p) => p[1]))) * 1.08;
  } else if (tab === "party") {
    const m26 = margin(v.p26);
    series = [
      ...(v.m24.length ? [{ k: "24", cls: "y2024", pts: v.m24.filter((p) => p[0] <= dMax), label: "2024", end: true }] : []),
      ...(v.m22.length ? [{ k: "22", cls: "y2022", pts: v.m22.filter((p) => p[0] <= dMax), label: "2022", end: true }] : []),
      ...(m26 != null ? [{ k: "26", cls: "y2026", pts: [[v.day, m26]] as Pt[], label: "2026" }] : []),
    ];
    const vals = series.flatMap((s) => s.pts.map((p) => p[1]));
    const R = Math.max(6, Math.ceil((Math.max(...vals.map(Math.abs), 1) + 3) / 5) * 5);
    lo = -R; hi = R; fmt = (m) => mLab(m); zeroLine = 0;
  } else {
    series = [
      ...(p24.length ? [{ k: "24", cls: "y2024", pts: p24, label: "vs 2024", end: true }] : []),
      ...(p22.length ? [{ k: "22", cls: "y2022", pts: p22, label: "vs 2022", end: true }] : []),
    ];
    const vals = series.flatMap((s) => s.pts.map((p) => p[1]));
    lo = Math.min(50, ...vals) - 8; hi = Math.max(150, ...vals) + 8; fmt = (n) => `${Math.round(n)}%`; zeroLine = 100;
  }
  // the party chart puts Democratic leads up top, Republican leads below
  const flip = tab === "party";
  const y = (val: number) => { const t = (val - lo) / (hi - lo || 1); return P.t + (flip ? t : 1 - t) * (H - P.t - P.b); };
  const path = (L: Pt[]) => [...L].sort((a, b) => b[0] - a[0]).map((p, i) => `${i ? "L" : "M"}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join("");
  const area = (L: Pt[]) => { const s = [...L].sort((a, b) => b[0] - a[0]); return s.length > 1 ? `${path(s)}L${x(s[s.length - 1][0]).toFixed(1)},${y(lo).toFixed(1)}L${x(s[0][0]).toFixed(1)},${y(lo).toFixed(1)}Z` : ""; };
  // the gap between 2026 and the base year, shaded green where 2026 is ahead and orange where it is behind
  const gap = tab === "ballots" && has26 && cBase.length ? (() => {
    const s = [...v.c26].sort((a, b) => b[0] - a[0]).filter((p) => lerp(cBase, p[0]) != null);
    if (s.length < 1) return null;
    const top = s.map((p) => `${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`);
    const bot = [...s].reverse().map((p) => `${x(p[0]).toFixed(1)},${y(lerp(cBase, p[0]) as number).toFixed(1)}`);
    const b = lerp(cBase, v.day) ?? 0;
    return { d: `M${top.join("L")}L${bot.join("L")}Z`, up: v.now >= b };
  })() : null;
  // round gridlines: 1, 2, 2.5 or 5 times a power of ten, about four of them
  const nice = (a: number, b: number) => {
    const raw = (b - a) / 4, p10 = Math.pow(10, Math.floor(Math.log10(raw || 1)));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * p10).find((m) => m >= raw) ?? raw;
    const out: number[] = []; for (let t = Math.ceil(a / step) * step; t <= b + 1e-9; t += step) out.push(+t.toFixed(6)); return out;
  };
  const ticks = tab === "party" ? [lo, lo / 2, 0, hi / 2, hi] : nice(lo, hi);
  const days = [40, 30, 21, 14, 7, 0].filter((d) => d <= dMax);

  // hover: the day under the pointer and every line's value on it
  const svgRef = useRef<SVGSVGElement>(null);
  const onMove = (e: React.MouseEvent) => {
    const r = svgRef.current?.getBoundingClientRect(); if (!r) return;
    const px = ((e.clientX - r.left) / r.width) * W;
    const d = Math.round(dMax - ((px - P.l) / (W - P.l - P.r)) * dMax);
    setHov(d < 0 || d > dMax ? null : d);
  };
  const hv = hov != null ? series.map((s) => ({ s, val: lerp(s.pts, hov) })).filter((q) => q.val != null) as { s: S; val: number }[] : [];
  const hb = hov != null && tab === "ballots" ? { n26: lerp(v.c26, hov), b: lerp(cBase, hov) } : null;

  const title = tab === "ballots" ? "Ballots cast before Election Day" : tab === "party" ? "Party lead of the ballots, day by day" : "2026 as a share of the same day in past years";
  return (
    <div className="tn-card tn-big" ref={ref}>
      <div className="tn-bigh">
        <div><span className="eye">Day by day</span><h3>{title}</h3></div>
        <div className="tn-tabs" role="tablist" aria-label="Chart">
          {(["ballots", "party", "pace"] as Tab[]).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); setHov(null); }}>{t === "ballots" ? "Ballots" : t === "party" ? "Party lead" : "Pace"}</button>)}
        </div>
        {tab === "ballots" && v.n22 && v.n24 ? <div className="tn-tabs sm" role="group" aria-label="Compare with">{(["2022", "2024"] as Y[]).map((b) => <button key={b} className={base === b ? "on" : ""} onClick={() => setBase(b)}>Gap vs {b}</button>)}</div> : null}
      </div>
      <div className="tn-plot" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
        <svg ref={svgRef} key={`${tab}-${base}-${seen}`} className={`tn-svg${seen ? " go" : ""}`} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${v.name}: ${title}`}>
          <defs>
            <linearGradient id="tn-a26" x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="s26a" /><stop offset="1" className="s26b" /></linearGradient>
            <linearGradient id="tn-a22" x1="0" x2="0" y1="0" y2="1"><stop offset="0" className="s22a" /><stop offset="1" className="s22b" /></linearGradient>
          </defs>
          {tab === "party" ? <><rect x={P.l} y={P.t} width={W - P.l - P.r} height={y(0) - P.t} className="band d" /><rect x={P.l} y={y(0)} width={W - P.l - P.r} height={H - P.b - y(0)} className="band r" />
            <text x={P.l + 10} y={P.t + 18} className="bandlab d">Democrats lead</text><text x={P.l + 10} y={H - P.b - 10} className="bandlab r">Republicans lead</text></> : null}
          {tab === "pace" ? <><rect x={P.l} y={P.t} width={W - P.l - P.r} height={y(100) - P.t} className="band up" /><rect x={P.l} y={y(100)} width={W - P.l - P.r} height={H - P.b - y(100)} className="band dn" />
            <text x={P.l + 10} y={P.t + 18} className="bandlab up">Ahead of the past year</text><text x={P.l + 10} y={H - P.b - 10} className="bandlab dn">Behind it</text></> : null}
          {ticks.map((t) => <g key={t}><line x1={P.l} x2={W - P.r} y1={y(t)} y2={y(t)} className="grid" /><text x={P.l - 10} y={y(t) + 4} className="ytick">{fmt(t)}</text></g>)}
          {zeroLine != null ? <line x1={P.l} x2={W - P.r} y1={y(zeroLine)} y2={y(zeroLine)} className="zero" /> : null}
          {days.map((d) => <text key={d} x={x(d)} y={H - 12} className="xtick">{d === 0 ? "Election Day" : `${d} days out`}</text>)}
          {tab === "ballots" && v.c22.length ? <path d={area(v.c22.filter((p) => p[0] <= dMax))} className="area a22" /> : null}
          {tab === "ballots" && has26 ? <path d={area(v.c26)} className="area a26" /> : null}
          {gap ? <path d={gap.d} className={`gap ${gap.up ? "up" : "dn"}`} /> : null}
          <line x1={x(v.day)} x2={x(v.day)} y1={P.t} y2={H - P.b} className="today" />
          <text x={x(v.day)} y={P.t - 6} className="todaylab">Today</text>
          {series.map((s, i) => s.pts.length > 1 ? <path key={s.k} d={path(s.pts)} pathLength={1} className={`ln ${s.cls}${s.dash ? " dash" : ""}`} style={{ animationDelay: `${0.1 + i * 0.25}s` }} /> : null)}
          {series.filter((s) => s.end && s.pts.length).map((s) => { const e = [...s.pts].sort((a, b) => a[0] - b[0])[0]; return (
            <g key={"e" + s.k} className={`endlab ${s.cls}`}><circle cx={x(e[0])} cy={y(e[1])} r={4.5} /><text x={x(e[0]) + 10} y={y(e[1]) + 4}>{s.label} · {fmt(e[1])}</text></g>); })}
          {tab !== "pace" ? (() => { const s26 = series.find((s) => s.k === "26"); if (!s26) return null; const e = [...s26.pts].sort((a, b) => a[0] - b[0])[0]; return (
            <g className="now"><circle cx={x(e[0])} cy={y(e[1])} r={14} className="halo" /><circle cx={x(e[0])} cy={y(e[1])} r={7} className="dot" />
              <g transform={`translate(${x(e[0]) - 12},${y(e[1]) - 20})`}><rect x={-120} y={-24} width={120} height={30} rx={8} className="flag" /><text x={-60} y={-4} className="flagt">2026 · {fmt(e[1])}</text></g></g>); })() : null}
          {tab === "pace" ? series.map((s) => { const e = [...s.pts].sort((a, b) => a[0] - b[0])[0]; return e ? <circle key={"p" + s.k} cx={x(e[0])} cy={y(e[1])} r={7} className={`pacept ${s.cls}`} /> : null; }) : null}
          {hov != null ? <g className="hov"><line x1={x(hov)} x2={x(hov)} y1={P.t} y2={H - P.b} />{hv.map((q) => <circle key={q.s.k} cx={x(hov)} cy={y(q.val)} r={5} className={q.s.cls} />)}</g> : null}
        </svg>
        {hov != null && hv.length ? (
          <div className="tn-tip" style={{ left: `${(x(hov) / W) * 100}%`, transform: `translateX(${x(hov) > W * 0.6 ? "calc(-100% - 14px)" : "14px"})` }}>
            <h4>{hov === 0 ? "Election Day eve" : `${hov} days out`}</h4>
            {hv.map((q) => <div key={q.s.k} className={`r ${q.s.cls}`}><i /><span>{q.s.label}</span><b>{tab === "ballots" ? commas(q.val) : fmt(q.val)}</b></div>)}
            {hb?.n26 && hb.b ? <div className={`gapline ${hb.n26 >= hb.b ? "up" : "dn"}`}>2026 {chg(hb.n26 / hb.b)} vs {base}</div> : null}
          </div>
        ) : null}
      </div>
      <div className="tn-legend">
        <span className="y2026"><i />2026{tab === "ballots" && proj.length ? ", dashed on its current pace against " + base : ""}</span>
        {v.c22.length || v.m22.length ? <span className="y2022"><i />2022</span> : null}
        {v.c24.length || v.m24.length ? <span className="y2024"><i />2024</span> : null}
        {tab === "ballots" && v.tally22?.length ? <span className="y2022 faint"><i />2022 and 2024 as tallied that day, all reporting states</span> : null}
        {tab === "ballots" && gap ? <span className={`gapk ${gap.up ? "up" : "dn"}`}><i />Gap: 2026 {gap.up ? "ahead of" : "behind"} {base}</span> : null}
        <span className="hint">Hover the chart for any day</span>
      </div>
      {tab === "ballots" && nowRatio && cBase.length ? <p className="evc-note">At its current pace against {base}, {v.name === "Nationwide" ? "these states" : v.name} would reach about <b>{short((cBase.find((p) => p[0] === 0)?.[1] ?? [...cBase].sort((a, b) => a[0] - b[0])[0][1]) * nowRatio)}</b> ballots before Election Day.</p> : null}
    </div>
  );
}

// ── a cell with its gap drawn in ────────────────────────────────────────────────────────────────────────────────────
function GapCell({ val, cap, kind, text }: { val: number | null; cap: number; kind: "pace" | "party"; text: string }) {
  if (val == null) return <span className="tn-gc none">n/a</span>;
  const w = Math.min(50, (Math.abs(val) / cap) * 50);
  const cls = kind === "pace" ? (val >= 0 ? "up" : "dn") : val < 0 ? "d" : "r";
  return (
    <span className={`tn-gc ${cls}`}>
      <span className="gt"><i className="mid" /><i className="gb" style={{ width: `${w}%`, [val >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span>
      <b>{text}</b>
    </span>
  );
}

// ── the section ───────────────────────────────────────────────────────────────────────────────────────────────────
/** The then and now view of a place, nation or state, shared by the console hero and the section below it. */
export function useEvView(data: EvConsole, scope: string): { hm: HM | null; view: View | null; day: number } {
  const [hm, setHm] = useState<HM | null>(null);
  useEffect(() => { getHM().then(setHm); }, []);
  const day = Math.min(45, data.daysOut);
  const view = useMemo<View | null>(() => {
    if (!hm) return null;
    const curve = (h: Record<Y, YrM>, y: Y) => h[y].n.map((v, i) => [i, v] as [number, number | null]).filter((p): p is Pt => p[1] != null);
    const mcurve = (h: Record<Y, YrM>, y: Y) => h[y].d.map((v, i) => [i, v != null && h[y].r[i] != null ? ((h[y].r[i] as number) - v) * 100 : null] as [number, number | null]).filter((p): p is Pt => p[1] != null);
    if (scope !== "US") {
      const row = data.rows.find((r) => r.st === scope), h = hm.states[scope];
      if (!row || !h) return null;
      const c = compare(row, hm, day);
      return { name: row.name, day, now: row.total, n22: c.n22, n24: c.n24, mod22: c.m22 ? 1 : 0, mod24: c.m24 ? 1 : 0,
        p26: c.pNow, p22: c.p22, p24: c.p24, p26Mod: !!c.pNow?.est, p22Mod: !c.p22?.rep, p24Mod: !c.p24?.rep,
        c22: curve(h, "2022"), c24: curve(h, "2024"), c26: row.s26, m22: mcurve(h, "2022"), m24: mcurve(h, "2024") };
    }
    const inSet = data.rows.map((r) => r.st);
    const sumY = (y: Y, d: number) => {
      let n = 0, md = 0, mr = 0, w = 0, mod = 0;
      for (const st of inSet) {
        const h = hm.states[st]; if (!h) continue;
        const v = h[y].n[d]; if (v == null) continue; n += v; if (!h[y].nRep[d]) mod += v;
        const dd = h[y].d[d], rr = h[y].r[d]; if (dd != null && rr != null) { md += dd * v; mr += rr * v; w += v; }
      }
      return { n, mod: n ? mod / n : 0, p: w ? { d: md / w, r: mr / w } : null };
    };
    const s22 = sumY("2022", day), s24 = sumY("2024", day);
    const nat = hm.us2022.daily;
    const D22 = natAt(nat, day, 4), R22 = natAt(nat, day, 5), O22 = natAt(nat, day, 6);
    const P22r = D22 != null && R22 != null && O22 != null ? { d: D22 / (D22 + R22 + O22), r: R22 / (D22 + R22 + O22) } : null;
    const P26r = data.partyTotal ? { d: data.dem / data.partyTotal, r: data.rep / data.partyTotal } : null;
    // 2024 reported party share in the party states, read between the dated national tallies that carry one
    const P24r = (() => { const pts = (hm.us2024?.daily ?? []).filter((r) => r[4] != null && r[5] != null).map((r) => [r[0], ((r[5] as number) - (r[4] as number)) * 100] as Pt); if (!pts.length) return null; const s0 = [...pts].sort((a, b) => b[0] - a[0]); return lerp(pts, day) ?? (day > s0[0][0] ? s0[0][1] : s0[s0.length - 1][1]); })();
    const days = Array.from({ length: 41 }, (_, d) => d);
    return { name: "Nationwide", day, now: data.total, n22: s22.n || null, n24: s24.n || null, mod22: s22.mod, mod24: s24.mod,
      p26: data.pm ? { d: data.pm.d, r: data.pm.r } : null, p22: s22.p, p24: s24.p, p26Mod: true, p22Mod: true, p24Mod: true,
      c22: days.map((d) => [d, sumY("2022", d).n] as Pt).filter((p) => p[1] > 0), c24: days.map((d) => [d, sumY("2024", d).n] as Pt).filter((p) => p[1] > 0), c26: data.s26,
      m22: days.map((d) => { const p = sumY("2022", d).p; return [d, p ? (p.r - p.d) * 100 : NaN] as Pt; }).filter((p) => isFinite(p[1])),
      m24: days.map((d) => { const p = sumY("2024", d).p; return [d, p ? (p.r - p.d) * 100 : NaN] as Pt; }).filter((p) => isFinite(p[1])),
      tally22: nat.map((r) => [r[0], r[1]] as Pt), tally24: (hm.us2024?.daily ?? []).map((r) => [r[0], r[1]] as Pt),
      partyNote: P22r && P26r ? `Every state on one scale, modeled where a state reports no party. In the states that register by party, as reported: 2022 ${mLab(margin(P22r) as number)} on this day${P24r != null ? `, 2024 about ${mLab(P24r)}` : ""}, 2026 ${mLab(margin(P26r) as number)}.` : undefined };
  }, [hm, scope, data, day]);
  return { hm, view, day };
}

export default function ThenNow({ data, scope, onOpen }: { data: EvConsole; scope: string; onOpen: (st: string) => void }) {
  const [sort, setSort] = useState<"most" | "ahead" | "behind" | "tod" | "tor">("most");
  const [base, setBase] = useState<Y>("2022");
  const [all, setAll] = useState(false);
  const { hm, view, day } = useEvView(data, scope);
  const rows = useMemo(() => (hm ? data.rows.map((r) => compare(r, hm, day)) : []), [hm, data.rows, day]);



  if (!hm || !view) return <section className="tn2 card"><div className="evc-load sx-skel" style={{ height: 320 }} /></section>;
  const errN = hm.meta.fit["2022"].countErrorByDay[day] ?? 0, errP = hm.meta.fit["2022"].partyErrorByDay[day] ?? null;

  const sorted = [...rows].sort((a, b) => {
    const ref = (c: Cmp) => (base === "2022" ? c.n22 : c.n24), pr = (c: Cmp) => (base === "2022" ? c.p22 : c.p24);
    const ratio = (c: Cmp) => (ref(c) ? c.now / (ref(c) as number) : null);
    const sh = (c: Cmp) => { const a = margin(c.pNow), b = margin(pr(c)); return a != null && b != null ? a - b : null; };
    if (sort === "ahead") return (ratio(b) ?? -1) - (ratio(a) ?? -1);
    if (sort === "behind") return (ratio(a) ?? 99) - (ratio(b) ?? 99);
    if (sort === "tod") return (sh(a) ?? 999) - (sh(b) ?? 999);
    if (sort === "tor") return (sh(b) ?? -999) - (sh(a) ?? -999);
    return b.now - a.now;
  });
  const LIMIT = 15, shown = all ? sorted.length : Math.min(LIMIT, sorted.length);
  const anyModeled = view.mod22 > 0 || view.mod24 > 0 || view.p22Mod || view.p24Mod;

  return (
    <section className="tn2" aria-labelledby="tn2-h">
      <div className="tn2-head" id="tn2-h"><Verdict v={view} /></div>
      <div className="tn2-row"><BallotRace v={view} /><PartyTug v={view} /></div>
      <BigChart key={scope} v={view} />

      {scope === "US" ? (
        <div className="tn-card tn-states">
          <div className="tn-bigh">
            <div><span className="eye">Every reporting state</span><h3>Ahead or behind, and which way the ballots moved</h3></div>
            <div className="tn-tabs sm" role="group" aria-label="Compare with">{(["2022", "2024"] as Y[]).map((y) => <button key={y} className={base === y ? "on" : ""} onClick={() => setBase(y)}>Against {y}</button>)}</div>
          </div>
          <div className="evc-chips tn-sorts" role="group" aria-label="Sort">
            {([["most", "Most ballots"], ["ahead", "Furthest ahead"], ["behind", "Furthest behind"], ["tod", "Moved most to D"], ["tor", "Moved most to R"]] as [typeof sort, string][]).map(([k, l]) => <button key={k} className={sort === k ? "on" : ""} onClick={() => setSort(k)}>{l}</button>)}
          </div>
          <div className="evc-tw">
            <table>
              <thead><tr><th>State</th><th className="n">2026 ballots</th><th className="n">{base} same day</th><th className="c">Ballots vs {base}</th><th className="n">Party lead now</th><th className="n">{base} lead</th><th className="c">Moved since {base}</th></tr></thead>
              <tbody>{sorted.slice(0, shown).map((c) => {
                const n = base === "2022" ? c.n22 : c.n24, mod = base === "2022" ? c.m22 : c.m24, p = base === "2022" ? c.p22 : c.p24;
                const a = margin(c.pNow), b = margin(p), sh = a != null && b != null ? a - b : null, r = n ? c.now / n - 1 : null;
                return (
                  <tr key={c.st} onClick={() => onOpen(c.st)}>
                    <td><b>{c.name}</b></td>
                    <td className="n mono">{commas(c.now)}</td>
                    <td className="n mono">{n != null ? <>{commas(n)}{mod ? <small>modeled</small> : null}</> : "n/a"}</td>
                    <td className="c"><GapCell val={r == null ? null : r * 100} cap={100} kind="pace" text={r == null ? "n/a" : chg(r + 1)} /></td>
                    <td className={`n mono ${(a ?? 0) < 0 ? "d" : "r"}`}>{a != null ? <>{mLab(a)}{c.pNow?.est ? <small>modeled</small> : null}</> : "n/a"}</td>
                    <td className={`n mono ${(b ?? 0) < 0 ? "d" : "r"}`}>{b != null ? <>{mLab(b)}{!p?.rep ? <small>modeled</small> : null}</> : "n/a"}</td>
                    <td className="c"><GapCell val={sh} cap={15} kind="party" text={sh == null ? "n/a" : Math.abs(sh) < 0.05 ? "No change" : `${sh < 0 ? "D" : "R"} +${Math.abs(sh).toFixed(1)}`} /></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
          {sorted.length > LIMIT ? <div className="evc-more"><button className="btn" onClick={() => setAll((v) => !v)}>{all ? "Show fewer" : `Show all ${sorted.length}`}</button></div> : null}
        </div>
      ) : null}

      <p className="evc-note tn-foot">{scope === "US" ? `Past years are added up over the same ${data.rows.length} states that report in 2026. ` : ""}{anyModeled ? `A state that published no count for a past day, or no party split, is modeled: its ballots from its own final early vote and mail and in person mix on the national early vote clocks, lined up with the states that did publish, and its party split from its 2026 split moved by how much the publishing states shifted between that year and today, more where the state leans further. On this day the model misses a published count by about ${Math.round(errN * 100)} percent and a party lead by about ${errP ?? "n/a"} points, so read modeled numbers as direction more than decimals. ` : ""}Party is registration, not votes. 2022 tallies of the day are from the US Elections Project.</p>
    </section>
  );
}
