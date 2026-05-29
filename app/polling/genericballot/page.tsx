"use client";

import React, { useEffect, useMemo, useState } from "react";
import AggregatePollChart from "@/app/components/AggregatePollChart";
import MultiCandidateChart from "@/app/components/MultiCandidateChart";
import {
  AGGREGATES, MULTI_AGGREGATES, buildAggregate, buildMulti,
  type BuiltAggregate, type BuiltMulti, type AggregateDef, type MultiAggregateDef,
} from "@/app/polling/lib/aggregates";
import { getPollsterEntry } from "@/app/polling/lib/buildDailyModel";

const round0 = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;
const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const gradeIsHigh = (g: string) => ["Gold", "A++", "A+", "A"].some((x) => g.startsWith(x));
const csvEscape = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const leaderIdx = (v: number[]) => v.reduce((best, x, i) => (Number.isFinite(x) && x > (v[best] ?? -Infinity) ? i : best), 0);

const GROUP_OF = (cat: string) =>
  cat === "2024 President" ? "2024 President"
  : cat === "2025 Governor" ? "2025 Races"
  : cat === "2026 Senate" ? "2026 Senate"
  : "National";

type Item = { id: string; label: string; group: string; kind: "h2h" | "multi" };
const H2H_BY_ID: Record<string, AggregateDef> = Object.fromEntries(AGGREGATES.map((d) => [d.id, d]));
const MULTI_BY_ID: Record<string, MultiAggregateDef> = Object.fromEntries(MULTI_AGGREGATES.map((d) => [d.id, d]));
const CATALOG: Item[] = [
  ...AGGREGATES.map((d) => ({ id: d.id, label: d.label, group: GROUP_OF(d.category), kind: "h2h" as const })),
  ...MULTI_AGGREGATES.map((d) => ({ id: d.id, label: d.label, group: d.group, kind: "multi" as const })),
];
const GROUPS = CATALOG.reduce<string[]>((acc, c) => (acc.includes(c.group) ? acc : [...acc, c.group]), []);

function sample(arr: number[], n: number): number[] {
  if (arr.length <= n) return arr;
  const out: number[] = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)]);
  return out;
}

function Sparkline({ data, color, h = 28 }: { data: number[]; color: string; h?: number }) {
  if (data.length < 2) return <svg style={{ width: "100%", height: h, display: "block" }} aria-hidden />;
  const w = 100;
  const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const step = w / (data.length - 1);
  const pts = data.map((v, i) => [+(i * step).toFixed(2), +(h - 2 - ((v - min) / span) * (h - 4)).toFixed(2)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: h, display: "block", overflow: "visible" }} aria-hidden>
      <path d={line} fill="none" stroke={color} strokeWidth={1.25} strokeOpacity={0.9} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function PollingAveragesPage() {
  const [id, setId] = useState(CATALOG[0].id);
  const [group, setGroup] = useState(CATALOG[0].group);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });

  // deep-link support: /polling/genericballot?race=<id> selects that aggregate
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("race");
    if (!r) return;
    const it = CATALOG.find((c) => c.id === r);
    if (it) { setId(it.id); setGroup(it.group); }
  }, []);

  const item = useMemo(() => CATALOG.find((c) => c.id === id) ?? CATALOG[0], [id]);
  const isMulti = item.kind === "multi";
  const h2hDef = isMulti ? null : (H2H_BY_ID[item.id] ?? null);
  const multiDef = isMulti ? (MULTI_BY_ID[item.id] ?? null) : null;

  const selfH2H = useMemo(() => (h2hDef ? buildAggregate(h2hDef) : null), [h2hDef]);
  const selfMulti = useMemo(() => (multiDef ? buildMulti(multiDef) : null), [multiDef]);

  // build everything after first paint (tile sparklines + instant switching)
  const [allBuilt, setAllBuilt] = useState<Record<string, BuiltAggregate>>({});
  const [allMulti, setAllMulti] = useState<Record<string, BuiltMulti>>({});
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      const a: Record<string, BuiltAggregate> = {}; for (const d of AGGREGATES) a[d.id] = buildAggregate(d);
      const m: Record<string, BuiltMulti> = {}; for (const d of MULTI_AGGREGATES) m[d.id] = buildMulti(d);
      if (!cancelled) { setAllBuilt(a); setAllMulti(m); }
    }, 0);
    return () => { cancelled = true; clearTimeout(t); };
  }, []);

  const builtH2H = h2hDef ? (allBuilt[item.id] ?? selfH2H) : null;
  const builtMulti = multiDef ? (allMulti[item.id] ?? selfMulti) : null;

  const tiles = useMemo(() => CATALOG.filter((c) => c.group === group), [group]);

  // head-to-head derived
  const hLatest = builtH2H?.latest ?? null;
  const leadColor = hLatest && h2hDef ? (hLatest.net >= 0 ? h2hDef.seriesA.color : h2hDef.seriesB.color) : "var(--muted)";
  const scaleMax = hLatest ? Math.max(10, Math.ceil((Math.abs(hLatest.net) + 3) / 5) * 5) : 10;
  const knobPct = hLatest ? 50 - clampN(hLatest.net / scaleMax, -1, 1) * 50 : 50;
  const meterTicks: number[] = []; for (let k = 5; k < scaleMax; k += 5) meterTicks.push(k);

  // poll lists (filter + sort)
  const toggleSort = (key: string) => setSort((s) => (s.key === key ? { key, dir: s.dir === "desc" ? "asc" : "desc" } : { key, dir: key === "pollster" ? "asc" : "desc" }));
  const sortVal = (p: Record<string, unknown> & { t: number; v?: number[] }, key: string): number | string => {
    if (key === "date") return p.t;
    if (key === "sample") return (p.sampleSize as number) || 0;
    if (key === "pollster") return String(p.pollster).toLowerCase();
    if (key === "margin") return (p.margin as number) ?? 0;
    if (key === "a") return (p.a as number) ?? 0;
    if (key === "b") return (p.b as number) ?? 0;
    if (key.startsWith("c")) { const i = +key.slice(1); const v = p.v?.[i]; return Number.isFinite(v) ? (v as number) : -Infinity; }
    return 0;
  };
  function applySort<T extends { t: number }>(arr: T[]): T[] {
    const mul = sort.dir === "asc" ? 1 : -1;
    return arr.slice().sort((a, b) => {
      const av = sortVal(a as never, sort.key), bv = sortVal(b as never, sort.key);
      if (av < bv) return -1 * mul;
      if (av > bv) return 1 * mul;
      return b.t - a.t;
    });
  }
  const qx = query.trim().toLowerCase();
  const h2hPolls = builtH2H?.polls ?? [];
  const multiPolls = builtMulti?.polls ?? [];
  const visH2H = applySort(h2hPolls.filter((p) => !qx || p.pollster.toLowerCase().includes(qx)));
  const visMulti = applySort(multiPolls.filter((p) => !qx || p.pollster.toLowerCase().includes(qx)));

  const sortHead = (k: string, label: string, cls = "r") => (
    <th key={k} className={cls}>
      <button type="button" className={`pa-sort ${sort.key === k ? "is-active" : ""}`} onClick={() => toggleSort(k)}>
        {label}<span className="pa-sort-ind">{sort.key === k ? (sort.dir === "desc" ? "↓" : "↑") : ""}</span>
      </button>
    </th>
  );
  const maxAbsMargin = Math.max(8, ...h2hPolls.map((p) => Math.abs(p.margin)));
  const totalPolls = isMulti ? multiPolls.length : h2hPolls.length;
  const visCount = isMulti ? visMulti.length : visH2H.length;

  const dailyArr = isMulti ? (builtMulti?.daily ?? []) : (builtH2H?.daily ?? []);
  const updated = dailyArr.length ? dailyArr[dailyArr.length - 1].date : null;

  function pickGroup(g: string) { setGroup(g); const first = CATALOG.find((c) => c.group === g); if (first) { setId(first.id); setQuery(""); } }
  function pickAgg(aid: string) { setId(aid); setQuery(""); }

  function downloadCSV() {
    let header: (string | number)[] = [], rows: (string | number)[][] = [], fname = "psi-polls.csv";
    if (isMulti && multiDef && builtMulti) {
      header = ["Pollster", "Date", "Sample", "Type", "Grade", ...multiDef.series.map((s) => s.label)];
      rows = builtMulti.polls.slice().sort((a, b) => b.t - a.t).map((p) => [p.pollster, p.date, p.sampleSize || "", p.sampleType, getPollsterEntry(p.pollster).grade, ...p.v.map((x) => (Number.isFinite(x) ? round1(x) : ""))]);
      fname = `psi-${multiDef.id}-polls.csv`;
    } else if (h2hDef && builtH2H) {
      header = ["Pollster", "Date", "Sample", "Type", "Grade", h2hDef.seriesA.label, h2hDef.seriesB.label, h2hDef.marginLabel];
      rows = builtH2H.polls.slice().sort((a, b) => b.t - a.t).map((p) => [p.pollster, p.date, p.sampleSize || "", p.sampleType, getPollsterEntry(p.pollster).grade, p.a, p.b, round1(p.margin)]);
      fname = `psi-${h2hDef.id}-polls.csv`;
    } else return;
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="pa">
        {/* ── top selector ── */}
        <div className="pa-select">
          <div className="pa-cats">
            {GROUPS.map((g) => (
              <button key={g} className={`pa-cat ${g === group ? "is-active" : ""}`} onClick={() => pickGroup(g)}>{g}</button>
            ))}
          </div>
          <div className="pa-tiles">
            {tiles.map((it) => {
              let color = "rgba(255,255,255,0.4)", valueText = "·", spark: number[] = [];
              if (it.kind === "h2h") {
                const b = allBuilt[it.id]; const d = H2H_BY_ID[it.id];
                if (b?.latest) { color = b.latest.net >= 0 ? d.seriesA.color : d.seriesB.color; valueText = d.fmtMargin(b.latest.net); spark = b.daily.map((x) => x.net); }
              } else {
                const b = allMulti[it.id]; const d = MULTI_BY_ID[it.id];
                if (b?.latest) { const li = leaderIdx(b.latest); color = d.series[li].color; valueText = b.latest[li].toFixed(1); spark = b.daily.map((x) => x.v[li]); }
              }
              return (
                <button key={it.id} className={`pa-tile ${it.id === id ? "is-active" : ""}`} onClick={() => pickAgg(it.id)}>
                  <span className="pa-tile-bar" style={{ background: color }} />
                  <div className="pa-tile-top"><span className="pa-tile-name">{it.label}</span><span className="pa-tile-val" style={{ color }}>{valueText}</span></div>
                  <div className="pa-tile-spark">{spark.length ? <Sparkline data={sample(spark, 48)} color={color} /> : <div className="pa-tile-skel" />}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── header ── */}
        <header className="pa-head">
          <div className="pa-eyebrow">{isMulti ? "2026 Primary" : (h2hDef?.category ?? "")}<span className="pa-live"><span className="pa-live-dot" /> Live</span></div>
          <h1 className="pa-title">{isMulti ? multiDef?.title : h2hDef?.title}</h1>
          <p className="pa-sub">{isMulti ? multiDef?.subtitle : h2hDef?.subtitle} <span className="pa-sub-dim">{totalPolls} polls{updated ? ` · updated ${new Date(updated + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}` : ""}</span></p>
        </header>

        {/* head-to-head: key numbers + spread meter */}
        {!isMulti && hLatest && h2hDef && (
          <div className="pa-board">
            <div className="pa-stats">
              <div className="pa-stat">
                <div className="pa-stat-label"><span className="pa-dot" style={{ background: h2hDef.seriesA.color }} />{h2hDef.seriesA.label}</div>
                <div className="pa-stat-num" style={{ color: h2hDef.seriesA.color }}>{hLatest.a.toFixed(1)}<small>{h2hDef.unit}</small></div>
              </div>
              <div className="pa-stat">
                <div className="pa-stat-label"><span className="pa-dot" style={{ background: h2hDef.seriesB.color }} />{h2hDef.seriesB.label}</div>
                <div className="pa-stat-num" style={{ color: h2hDef.seriesB.color }}>{hLatest.b.toFixed(1)}<small>{h2hDef.unit}</small></div>
              </div>
            </div>
            <div className="pa-meter" aria-label={`${h2hDef.marginLabel} ${h2hDef.fmtMargin(hLatest.net)}`}>
              <div className="pa-meter-valrow">
                <div className="pa-meter-val" style={{ left: `${clampN(knobPct, 7, 93)}%`, color: leadColor }}>
                  <span className="pa-meter-num">{h2hDef.fmtMargin(hLatest.net)}</span>
                  <span className="pa-meter-eye">{h2hDef.marginLabel}</span>
                  <span className="pa-meter-caret" style={{ borderTopColor: leadColor }} />
                </div>
              </div>
              <div className="pa-meter-beam">
                <span className="pa-meter-track" />
                <span className="pa-meter-fill" style={hLatest.net >= 0
                  ? { right: "50%", width: `${50 - knobPct}%`, background: leadColor }
                  : { left: "50%", width: `${knobPct - 50}%`, background: leadColor }} />
                {meterTicks.map((k) => (
                  <React.Fragment key={k}>
                    <span className="pa-meter-tick" style={{ left: `${50 + (k / scaleMax) * 50}%` }} />
                    <span className="pa-meter-tick" style={{ left: `${50 - (k / scaleMax) * 50}%` }} />
                  </React.Fragment>
                ))}
                <span className="pa-meter-tie" />
                <span className="pa-meter-knob" style={{ left: `${knobPct}%`, background: leadColor, color: leadColor }} />
              </div>
              <div className="pa-meter-foot">
                <span className="pa-meter-end" style={{ color: hLatest.net > 0.05 ? h2hDef.seriesA.color : undefined }}>{h2hDef.seriesA.label}</span>
                <span className="pa-meter-even">even</span>
                <span className="pa-meter-end" style={{ color: hLatest.net < -0.05 ? h2hDef.seriesB.color : undefined }}>{h2hDef.seriesB.label}</span>
              </div>
            </div>
          </div>
        )}

        {/* multi: ranked standings */}
        {isMulti && builtMulti?.latest && multiDef && (
          <div className="pa-rank">
            {(() => {
              const lv = builtMulti.latest!;
              const ranked = multiDef.series.map((s, i) => ({ s, v: lv[i] })).filter((r) => Number.isFinite(r.v)).sort((a, b) => b.v - a.v);
              const maxV = ranked.length ? ranked[0].v || 1 : 1;
              return ranked.map(({ s, v }) => (
                <div className="pa-rank-row" key={s.key}>
                  <span className="pa-rank-dot" style={{ background: s.color }} />
                  <span className="pa-rank-name">{s.label}</span>
                  <span className="pa-rank-bar"><span className="pa-rank-fill" style={{ width: `${(v / maxV) * 100}%`, background: s.color }} /></span>
                  <span className="pa-rank-val" style={{ color: s.color }}>{v.toFixed(1)}<small>%</small></span>
                </div>
              ));
            })()}
          </div>
        )}

        {/* chart */}
        <div className="pa-panel">
          <div className="pa-panel-head">
            <h2 className="pa-panel-title">Average over time</h2>
            <span className="pa-panel-meta">Each dot is one poll · sized by sample</span>
          </div>
          {isMulti && builtMulti && multiDef ? (
            <MultiCandidateChart animKey={multiDef.id} daily={builtMulti.daily} polls={builtMulti.polls} series={multiDef.series} unit={multiDef.unit} />
          ) : builtH2H && h2hDef ? (
            <AggregatePollChart animKey={h2hDef.id} daily={builtH2H.daily} polls={builtH2H.polls} seriesA={h2hDef.seriesA} seriesB={h2hDef.seriesB} fmtMargin={h2hDef.fmtMargin} marginLabel={h2hDef.marginLabel} unit={h2hDef.unit} />
          ) : null}
        </div>

        {/* all polls */}
        <section className="pa-polls">
          <div className="pa-polls-head">
            <h2 className="pa-polls-h">All polls <span>{visCount} of {totalPolls}</span></h2>
            <div className="pa-polls-actions">
              <input className="pa-search" placeholder="Filter by pollster…" value={query} onChange={(e) => setQuery(e.target.value)} />
              <button className="pa-csv" onClick={downloadCSV}>
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 1.5v8.5m0 0L4.5 6.5M8 10l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
                CSV
              </button>
            </div>
          </div>
          <div className="pa-table-wrap">
            <div className="pa-table-min">
              {isMulti && multiDef ? (
                <table className="pa-table">
                  <thead>
                    <tr>
                      {sortHead("pollster", "Pollster", "")}
                      {sortHead("date", "Date")}
                      {sortHead("sample", "Sample")}
                      {multiDef.series.map((s, i) => sortHead(`c${i}`, s.label, "r"))}
                    </tr>
                  </thead>
                  <tbody>
                    {visMulti.map((p, i) => {
                      const entry = getPollsterEntry(p.pollster);
                      const mi = leaderIdx(p.v);
                      return (
                        <tr key={`${p.pollster}-${p.date}-${i}`}>
                          <td><span className="pa-pollster">{p.pollster}</span><span className={`pa-grade ${gradeIsHigh(entry.grade) ? "hi" : ""}`}>{entry.grade}</span></td>
                          <td className="r">{new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}</td>
                          <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}<span className="pa-type">{p.sampleType}</span></td>
                          {multiDef.series.map((s, ci) => (
                            <td key={s.key} className="r" style={ci === mi ? { color: s.color, fontWeight: 600 } : undefined}>{Number.isFinite(p.v[ci]) ? round0(p.v[ci]) : "—"}</td>
                          ))}
                        </tr>
                      );
                    })}
                    {visMulti.length === 0 && <tr><td colSpan={3 + multiDef.series.length} className="pa-empty">No pollsters match “{query}”.</td></tr>}
                  </tbody>
                </table>
              ) : h2hDef ? (
                <table className="pa-table">
                  <thead>
                    <tr>
                      {sortHead("pollster", "Pollster", "")}
                      {sortHead("date", "Date")}
                      {sortHead("sample", "Sample")}
                      {sortHead("a", h2hDef.seriesA.label)}
                      {sortHead("b", h2hDef.seriesB.label)}
                      {sortHead("margin", h2hDef.marginLabel, "pa-mhead")}
                    </tr>
                  </thead>
                  <tbody>
                    {visH2H.map((p, i) => {
                      const entry = getPollsterEntry(p.pollster);
                      const pct = Math.min(50, (Math.abs(p.margin) / maxAbsMargin) * 50);
                      const mColor = p.margin > 0 ? h2hDef.seriesA.color : p.margin < 0 ? h2hDef.seriesB.color : "rgba(255,255,255,0.5)";
                      return (
                        <tr key={`${p.pollster}-${p.date}-${i}`}>
                          <td><span className="pa-pollster">{p.pollster}</span><span className={`pa-grade ${gradeIsHigh(entry.grade) ? "hi" : ""}`}>{entry.grade}</span></td>
                          <td className="r">{new Date(p.t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" })}</td>
                          <td className="r">{p.sampleSize > 0 ? p.sampleSize.toLocaleString() : "—"}<span className="pa-type">{p.sampleType}</span></td>
                          <td className="r" style={{ color: h2hDef.seriesA.color }}>{round0(p.a)}</td>
                          <td className="r" style={{ color: h2hDef.seriesB.color }}>{round0(p.b)}</td>
                          <td className="pa-mcell">
                            <span className="pa-mbar"><span className="pa-mbar-fill" style={p.margin >= 0 ? { left: "50%", width: `${pct}%`, background: mColor } : { right: "50%", width: `${pct}%`, background: mColor }} /></span>
                            <span className="pa-mnum" style={{ color: mColor }}>{h2hDef.fmtMargin(round1(p.margin))}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {visH2H.length === 0 && <tr><td colSpan={6} className="pa-empty">No pollsters match “{query}”.</td></tr>}
                  </tbody>
                </table>
              ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

const CSS = `
  html, body { background: #000 !important; }

  .pa {
    --line: rgba(255,255,255,0.08); --line2: rgba(255,255,255,0.05);
    --ink: #ededed; --muted: rgba(255,255,255,0.56); --muted2: rgba(255,255,255,0.4); --faint: rgba(255,255,255,0.26);
    --panel: rgba(255,255,255,0.018);
    color: var(--ink); display: flex; flex-direction: column;
  }
  .pa * { box-sizing: border-box; }
  @keyframes pa-in { from { opacity:0; transform: translateY(8px); } to { opacity:1; transform:none; } }

  /* ── top selector ── */
  .pa-select { border-bottom: 1px solid var(--line); padding-bottom: 18px; margin-bottom: 30px; }
  .pa-cats { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 16px; }
  .pa-cat { appearance: none; cursor: pointer; background: transparent; border: 0; border-radius: 8px; padding: 7px 12px; line-height: 1; font-family: var(--font-body), monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted2); transition: color 140ms ease, background 140ms ease; }
  .pa-cat:hover { color: #fff; background: rgba(255,255,255,0.04); }
  .pa-cat.is-active { color: #000; background: #fafafa; }

  /* one cohesive "aggregate index" strip — cells flex to fill width, hairline-divided */
  .pa-tiles { display: flex; flex-wrap: nowrap; gap: 0; overflow-x: auto; overflow-y: hidden; border: 1px solid var(--line); border-radius: 12px; background: rgba(255,255,255,0.012); scrollbar-width: thin; }
  .pa-tile { position: relative; flex: 1 1 0; min-width: 156px; text-align: left; cursor: pointer; appearance: none; background: transparent; border: 0; padding: 13px 16px 12px; overflow: hidden; transition: background 150ms ease; }
  .pa-tile::after { content: ""; position: absolute; right: 0; top: 24%; bottom: 24%; width: 1px; background: var(--line); }
  .pa-tile:last-child::after { display: none; }
  .pa-tile:hover { background: rgba(255,255,255,0.035); }
  .pa-tile.is-active { background: rgba(255,255,255,0.05); }
  .pa-tile.is-active::after, .pa-tile.is-active + .pa-tile::after { display: none; }
  .pa-tile-bar { position: absolute; left: 0; right: 0; top: 0; height: 1.5px; opacity: 0; transition: opacity 150ms ease; }
  .pa-tile.is-active .pa-tile-bar { opacity: 0.85; }
  .pa-tile-top { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; margin-bottom: 11px; }
  .pa-tile-name { font-family: var(--font-body), monospace; font-size: 12px; font-weight: 500; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pa-tile:hover .pa-tile-name { color: var(--ink); }
  .pa-tile.is-active .pa-tile-name { color: #fff; }
  .pa-tile-val { font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; font-variant-numeric: tabular-nums; flex-shrink: 0; opacity: 0.85; }
  .pa-tile.is-active .pa-tile-val { opacity: 1; }
  .pa-tile-spark { height: 26px; opacity: 0.4; transition: opacity 150ms ease; }
  .pa-tile:hover .pa-tile-spark { opacity: 0.7; }
  .pa-tile.is-active .pa-tile-spark { opacity: 1; }
  .pa-tile-skel { height: 28px; border-radius: 4px; background: linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06), rgba(255,255,255,0.03)); }

  /* ── header ── */
  .pa-head { padding: 0; animation: pa-in 480ms cubic-bezier(0.16,1,0.3,1) both; }
  .pa-eyebrow { display: inline-flex; align-items: center; gap: 12px; font-family: var(--font-body), monospace; font-size: 11px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--muted2); margin-bottom: 14px; }
  .pa-live { display: inline-flex; align-items: center; gap: 6px; color: var(--muted); }
  .pa-live-dot { width: 5px; height: 5px; border-radius: 50%; background: #3fb27f; opacity: 0.9; }
  .pa-title { font-family: var(--font-body), "Geist Mono", monospace; font-weight: 600; letter-spacing: -0.02em; line-height: 1.08; font-size: clamp(25px, 3.2vw, 37px); color: #fff; margin: 0 0 13px; text-transform: none; }
  .pa-sub { font-family: var(--font-body), monospace; font-size: 13px; line-height: 1.65; color: var(--muted); max-width: 74ch; margin: 0; }
  .pa-sub-dim { color: var(--faint); }

  /* ── key numbers ── */
  .pa-board { margin: 28px 0 0; }
  .pa-stats { display: flex; align-items: flex-start; gap: clamp(38px, 6vw, 80px); }
  .pa-stat { display: flex; flex-direction: column; gap: 10px; }
  .pa-stat-label { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-body), monospace; font-size: 10.5px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: var(--muted2); }
  .pa-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .pa-stat-num { font-family: var(--font-body), monospace; font-weight: 600; font-size: clamp(31px, 3.3vw, 43px); line-height: 0.95; font-variant-numeric: tabular-nums; letter-spacing: -0.025em; }
  .pa-stat-num small { font-size: 0.4em; font-weight: 500; color: var(--faint); margin-left: 2px; }

  /* spread meter */
  .pa-meter { position: relative; margin-top: 26px; }
  .pa-meter-valrow { position: relative; height: 46px; }
  .pa-meter-val { position: absolute; bottom: 0; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 3px; white-space: nowrap; transition: left 360ms cubic-bezier(0.16,1,0.3,1); }
  .pa-meter-num { font-family: var(--font-body), monospace; font-weight: 700; font-size: clamp(20px, 2.4vw, 26px); line-height: 1; font-variant-numeric: tabular-nums; letter-spacing: -0.01em; }
  .pa-meter-eye { font-family: var(--font-body), monospace; font-size: 8px; font-weight: 600; letter-spacing: 0.2em; text-transform: uppercase; color: var(--faint); }
  .pa-meter-caret { width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid; margin-top: 4px; }
  .pa-meter-beam { position: relative; height: 16px; }
  .pa-meter-track { position: absolute; top: 50%; left: 0; right: 0; height: 3px; transform: translateY(-50%); background: rgba(255,255,255,0.08); border-radius: 2px; }
  .pa-meter-fill { position: absolute; top: 50%; height: 3px; transform: translateY(-50%); border-radius: 2px; transition: width 360ms cubic-bezier(0.16,1,0.3,1); }
  .pa-meter-tick { position: absolute; top: 50%; width: 1px; height: 7px; transform: translate(-50%, -50%); background: rgba(255,255,255,0.16); }
  .pa-meter-tie { position: absolute; left: 50%; top: 50%; width: 2px; height: 16px; transform: translate(-50%, -50%); background: rgba(255,255,255,0.32); border-radius: 1px; }
  .pa-meter-knob { position: absolute; top: 50%; width: 13px; height: 13px; border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 3.5px #000, 0 0 14px -2px currentColor; transition: left 360ms cubic-bezier(0.16,1,0.3,1); }
  .pa-meter-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 11px; font-family: var(--font-body), monospace; font-size: 9px; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; }
  .pa-meter-end { color: var(--faint); max-width: 16ch; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pa-meter-even { color: var(--muted2); letter-spacing: 0.22em; }

  /* ── ranked standings (multi) ── */
  .pa-rank { margin: 28px 0 0; display: flex; flex-direction: column; gap: 13px; max-width: 580px; }
  .pa-rank-row { display: grid; grid-template-columns: 12px minmax(94px, 150px) 1fr auto; align-items: center; gap: 14px; }
  .pa-rank-dot { width: 9px; height: 9px; border-radius: 50%; }
  .pa-rank-name { font-family: var(--font-body), monospace; font-size: 13px; font-weight: 600; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .pa-rank-bar { position: relative; height: 8px; border-radius: 4px; background: rgba(255,255,255,0.05); overflow: hidden; }
  .pa-rank-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; transition: width 380ms cubic-bezier(0.16,1,0.3,1); }
  .pa-rank-val { font-family: var(--font-body), monospace; font-size: 20px; font-weight: 600; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
  .pa-rank-val small { font-size: 0.5em; color: var(--faint); margin-left: 1px; }

  /* ── chart panel ── */
  .pa-panel { margin-top: 40px; border: 1px solid var(--line); border-radius: 14px; background: #000; padding: 20px 20px 18px; }
  .pa-panel-head { display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 20px; }
  .pa-panel-title { font-family: var(--font-body), monospace; font-weight: 600; font-size: 13px; letter-spacing: 0.04em; text-transform: uppercase; color: #f3f3f5; margin: 0; }
  .pa-panel-meta { font-family: var(--font-body), monospace; font-size: 11px; color: var(--faint); }

  /* ── polls ── */
  .pa-polls { margin-top: 48px; }
  .pa-polls-head { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px; margin-bottom: 16px; }
  .pa-polls-h { font-family: var(--font-body), monospace; font-weight: 600; font-size: 14px; letter-spacing: 0.04em; text-transform: uppercase; color: #f3f3f5; margin: 0; display: flex; align-items: baseline; gap: 12px; }
  .pa-polls-h span { font-size: 11px; font-weight: 600; color: var(--faint); letter-spacing: 0.04em; }
  .pa-polls-actions { display: flex; align-items: center; gap: 8px; }
  .pa-search { appearance: none; background: var(--panel); border: 1px solid var(--line); border-radius: 9px; color: var(--ink); font-family: var(--font-body), monospace; font-size: 12.5px; padding: 9px 13px; width: 200px; max-width: 44vw; transition: border-color 160ms ease, background 160ms ease; }
  .pa-search::placeholder { color: var(--faint); }
  .pa-search:focus { outline: none; border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.03); }
  .pa-csv { display: inline-flex; align-items: center; gap: 7px; cursor: pointer; appearance: none; background: var(--panel); border: 1px solid var(--line); border-radius: 9px; color: var(--muted); font-family: var(--font-body), monospace; font-size: 12px; font-weight: 600; letter-spacing: 0.04em; padding: 9px 13px; transition: color 150ms ease, border-color 150ms ease, background 150ms ease; }
  .pa-csv:hover { color: #fff; border-color: rgba(255,255,255,0.22); background: rgba(255,255,255,0.04); }

  .pa-table { width: 100%; border-collapse: collapse; }
  .pa-table thead th { position: sticky; top: 0; z-index: 1; text-align: left; background: #000; font-family: var(--font-body), monospace; font-size: 10px; font-weight: 600; letter-spacing: 0.13em; text-transform: uppercase; color: var(--faint); padding: 0 16px 12px; border-bottom: 1px solid var(--line); white-space: nowrap; }
  .pa-table thead th.r { text-align: right; }
  .pa-table thead th.pa-mhead { text-align: left; padding-left: 26px; }
  .pa-sort { appearance: none; background: transparent; border: 0; cursor: pointer; font: inherit; color: inherit; letter-spacing: inherit; text-transform: inherit; padding: 0; display: inline-flex; align-items: center; gap: 4px; transition: color 140ms ease; }
  .pa-sort:hover { color: var(--muted); }
  .pa-sort.is-active { color: var(--ink); }
  .pa-sort-ind { font-size: 9px; min-width: 6px; display: inline-block; }
  .pa-table tbody td { font-family: var(--font-body), monospace; font-size: 13px; padding: 12px 16px; border-bottom: 1px solid var(--line2); color: var(--muted); vertical-align: middle; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .pa-table tbody td.r { text-align: right; }
  .pa-table tbody tr { transition: background 120ms ease; }
  .pa-table tbody tr:hover td { background: rgba(255,255,255,0.022); }
  .pa-pollster { color: #e7e7ea; font-weight: 500; }
  .pa-grade { display: inline-block; margin-left: 9px; padding: 1.5px 6px; border: 1px solid var(--line); border-radius: 5px; font-size: 9.5px; font-weight: 600; letter-spacing: 0.05em; color: var(--muted2); }
  .pa-grade.hi { border-color: rgba(91,140,240,0.4); color: #9cc0ff; }
  .pa-type { color: var(--faint); margin-left: 6px; }
  .pa-mcell { display: flex; align-items: center; gap: 14px; }
  .pa-mbar { position: relative; width: 72px; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.05); flex-shrink: 0; }
  .pa-mbar::before { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: rgba(255,255,255,0.16); }
  .pa-mbar-fill { position: absolute; top: 0; bottom: 0; border-radius: 3px; }
  .pa-mnum { font-weight: 600; min-width: 56px; }
  .pa-table-wrap { overflow-x: auto; }
  .pa-table-min { min-width: 660px; }
  .pa-empty { padding: 40px 16px; text-align: center; color: var(--faint); font-family: var(--font-body), monospace; font-size: 13px; }

  @media (prefers-reduced-motion: reduce) { .pa-head { animation: none !important; } .pa-live-dot { animation: none !important; } }
`;
