"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import AggregatePollChart from "@/app/components/AggregatePollChart";
import MultiCandidateChart from "@/app/components/MultiCandidateChart";
import { pollHref } from "@/app/polls/registry";
import {
  AGGREGATES, MULTI_AGGREGATES, buildAggregate, buildMulti,
  type BuiltAggregate, type BuiltMulti, type AggregateDef, type MultiAggregateDef,
} from "@/app/_polling/lib/aggregates";
import { getPollsterEntry } from "@/app/_polling/lib/buildDailyModel";
import StateRaceMap, { type MapRow } from "@/app/_polling/lib/StateRaceMap";
import TrendPanel from "@/app/_polling/lib/TrendPanel";
import { RATING_LABEL, STATE_NAME, fmtM, rating, ratingPill } from "@/app/lib/opp";

/** A forecast race page the averages page can link to, keyed `sen-GA` or `gov-GA`. */
export type ForecastLink = { href: string; m: number; ind?: boolean };

const DAY = 86400000;
const round0 = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;
const clampN = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const gradeIsHigh = (g: string) => ["Gold", "A++", "A+", "A"].some((x) => g.startsWith(x));
const csvEscape = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const leaderIdx = (v: number[]) => v.reduce((best, x, i) => (Number.isFinite(x) && x > (v[best] ?? -Infinity) ? i : best), 0);
const fmtDay = (t: number) => new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
const fmtIso = (iso: string, year = true) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", year ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
const signed = (n: number) => (Math.abs(n) < 0.05 ? "0.0" : `${n > 0 ? "+" : "−"}${Math.abs(n).toFixed(1)}`);

// sample type (voter screen) filter: collapses every raw label to one of three buckets
type SampleFilter = "all" | "LV" | "RV" | "A";
const SAMPLE_OPTS: { val: SampleFilter; label: string; full: string }[] = [
  { val: "all", label: "All", full: "All polls" },
  { val: "LV", label: "LV", full: "Likely voters" },
  { val: "RV", label: "RV", full: "Registered voters" },
  { val: "A", label: "Adults", full: "All adults" },
];
function canonType(t: string): "LV" | "RV" | "A" | null {
  const s = (t || "").trim().toUpperCase();
  if (s.startsWith("LV") || s.includes("LIKELY")) return "LV";
  if (s.startsWith("RV") || s.includes("REGISTERED")) return "RV";
  if (s === "A" || s.startsWith("ADULT")) return "A";
  return null;
}

const GROUP_OF = (cat: string) =>
  cat === "2024 President" ? "2024 President"
  : cat === "2025 Governor" ? "2025 Races"
  : cat === "2026 Senate" ? "2026 Senate"
  : cat === "2026 Governor" ? "2026 Governor"
  : "National";
const GROUP_TITLE: Record<string, string> = {
  National: "National", "2026 Senate": "2026 Senate", "2026 Governor": "2026 governor",
  "2025 Races": "2025 races", "2024 President": "2024 president", Primaries: "Primaries",
};
const GROUP_HREF: Record<string, string> = { "2026 Senate": "/polls/senate", "2026 Governor": "/polls/governor" };
const NATIONAL_HEAD: Record<string, string> = {
  "generic-ballot": "Generic ballot", "trump-approval": "Trump approval", "vance-favorability": "JD Vance favorability",
  "right-wrong-track": "Right track, wrong track", "2028-vance-newsom": "2028 presidential",
};

type Item = { id: string; label: string; group: string; kind: "h2h" | "multi" };
const H2H_BY_ID: Record<string, AggregateDef> = Object.fromEntries(AGGREGATES.map((d) => [d.id, d]));
const MULTI_BY_ID: Record<string, MultiAggregateDef> = Object.fromEntries(MULTI_AGGREGATES.map((d) => [d.id, d]));
const CATALOG: Item[] = [
  ...AGGREGATES.map((d) => ({ id: d.id, label: d.label, group: GROUP_OF(d.category), kind: "h2h" as const })),
  ...MULTI_AGGREGATES.map((d) => ({ id: d.id, label: d.label, group: d.group, kind: "multi" as const })),
];
const GROUP_ORDER = ["National", "2026 Senate", "2026 Governor", "Primaries", "2025 Races", "2024 President"];
const GROUPS = CATALOG.reduce<string[]>((acc, c) => (acc.includes(c.group) ? acc : [...acc, c.group]), [])
  .sort((a, b) => (GROUP_ORDER.indexOf(a) + 99) % 99 - (GROUP_ORDER.indexOf(b) + 99) % 99);

/** Short, dash free label for a picker option or a tile. */
function shortLabel(it: Item): string {
  const d = H2H_BY_ID[it.id];
  if (!d) return it.label;
  if (d.stateAbbr) return `${STATE_NAME[d.stateAbbr] ?? d.stateAbbr}: ${d.seriesA.label} vs. ${d.seriesB.label}`;
  if (NATIONAL_HEAD[d.id]) return NATIONAL_HEAD[d.id];
  if (d.category === "2025 Governor") return d.label.replace(/ Governor$/, " governor");
  return d.label;
}

/** Page words for one average: crumb, eyebrow and the h1 lead (the h1 ends in "average"). */
function heads(it: Item, d: AggregateDef | null, m: MultiAggregateDef | null) {
  if (m) return { crumb: m.label, eyebrow: "2026 primary", h1: m.label };
  if (!d) return { crumb: it.label, eyebrow: "Polling average", h1: it.label };
  if (d.stateAbbr) {
    const st = STATE_NAME[d.stateAbbr] ?? d.stateAbbr;
    const sen = d.category === "2026 Senate";
    return { crumb: st, eyebrow: sen ? "2026 Senate" : "2026 governor", h1: `${st} ${sen ? "Senate" : "governor"}` };
  }
  if (d.category === "2024 President") return { crumb: d.label, eyebrow: "2024 archive", h1: d.id === "2024-national" ? "2024 national presidential" : `2024 ${d.label} presidential` };
  if (d.category === "2025 Governor") { const st = d.label.replace(/ Governor$/, ""); return { crumb: d.label.replace(/ Governor$/, " governor"), eyebrow: "2025 archive", h1: `${st} 2025 governor` }; }
  return { crumb: NATIONAL_HEAD[d.id] ?? d.label, eyebrow: d.category, h1: NATIONAL_HEAD[d.id] ?? d.label };
}

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
      <path d={line} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  if (!dir) return <span className="pa-sort-ind" aria-hidden />;
  return (
    <svg className="pa-sort-ind" width="8" height="8" viewBox="0 0 8 8" aria-hidden style={{ transform: dir === "asc" ? "rotate(180deg)" : undefined }}>
      <path d="M1 2.5 4 5.5 7 2.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function PollingAveragesPage({ initialId, forecast }: { initialId?: string; forecast?: Record<string, ForecastLink> } = {}) {
  const initial = (initialId && CATALOG.find((c) => c.id === initialId)) || CATALOG[0];
  const [id, setId] = useState(initial.id);
  const [group, setGroup] = useState(initial.group);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" }>({ key: "date", dir: "desc" });
  const [sampleFilter, setSampleFilter] = useState<SampleFilter>("all");
  // view: "focus" = one average; "board" = every average on one page
  const [view, setView] = useState<"focus" | "board">("focus");
  const [showAllPolls, setShowAllPolls] = useState(false);
  const booted = useRef(false);

  // deep link support: ?race=<id> selects an average, ?view=board opens the full board
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const r = sp.get("race");
    const v = sp.get("view");
    const it = r ? CATALOG.find((c) => c.id === r) : null;
    const raf = requestAnimationFrame(() => {
      if (it) { setId(it.id); setGroup(it.group); }
      if (v === "board" && !it) setView("board");
      booted.current = true;
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  // keep the URL shareable as the view changes: every average has its own canonical route
  useEffect(() => {
    if (!booted.current) return;
    if (view === "board") { window.history.replaceState(null, "", "/polls/generic-ballot?view=board"); return; }
    const href = pollHref(id);
    if (window.location.pathname + window.location.search !== href) window.history.replaceState(null, "", href);
  }, [view, id]);

  useEffect(() => { setShowAllPolls(false); }, [id, sampleFilter]);

  const item = useMemo(() => CATALOG.find((c) => c.id === id) ?? CATALOG[0], [id]);
  const isMulti = item.kind === "multi";
  const h2hDef = isMulti ? null : (H2H_BY_ID[item.id] ?? null);
  const multiDef = isMulti ? (MULTI_BY_ID[item.id] ?? null) : null;

  // unfiltered builds of the active average: the "All" view, and the source of the sample counts
  const baseH2H = useMemo(() => (h2hDef ? buildAggregate(h2hDef) : null), [h2hDef]);
  const baseMulti = useMemo(() => (multiDef ? buildMulti(multiDef) : null), [multiDef]);

  // build everything after first paint (board tiles, the state map and instant switching)
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

  // sample type counts for the active average (drive the filter control and disable empty buckets)
  const typeCounts = useMemo(() => {
    const polls = (isMulti ? baseMulti?.polls : baseH2H?.polls) ?? [];
    const c: Record<"LV" | "RV" | "A", number> = { LV: 0, RV: 0, A: 0 };
    for (const p of polls) { const t = canonType(p.sampleType); if (t) c[t]++; }
    return c;
  }, [isMulti, baseH2H, baseMulti]);
  const baseCount = (isMulti ? baseMulti?.polls.length : baseH2H?.polls.length) ?? 0;

  // if the chosen sample type has no polls in the newly selected average, fall back to All
  useEffect(() => {
    if (sampleFilter !== "all" && (typeCounts[sampleFilter] ?? 0) === 0) {
      const raf = requestAnimationFrame(() => setSampleFilter("all"));
      return () => cancelAnimationFrame(raf);
    }
  }, [typeCounts, sampleFilter]);

  // the displayed builds: the full set for "all", otherwise rebuilt from just the chosen sample type
  const builtH2H = useMemo<BuiltAggregate | null>(() => {
    if (!h2hDef) return null;
    if (sampleFilter === "all") return baseH2H;
    const polls = h2hDef.polls.filter((p) => canonType(p.sampleType) === sampleFilter);
    if (!polls.length) return { daily: [], polls: [], latest: null };
    return buildAggregate({ ...h2hDef, polls });
  }, [h2hDef, baseH2H, sampleFilter]);
  const builtMulti = useMemo<BuiltMulti | null>(() => {
    if (!multiDef) return null;
    if (sampleFilter === "all") return baseMulti;
    const polls = multiDef.polls.filter((p) => canonType(p.sampleType) === sampleFilter);
    if (!polls.length) return { daily: [], polls: [], latest: null };
    return buildMulti({ ...multiDef, polls });
  }, [multiDef, baseMulti, sampleFilter]);

  const options = useMemo(() => CATALOG.filter((c) => c.group === group), [group]);

  // map rows for the 2026 Senate and governor groups: one per state with a public poll of that office
  const mapOffice = group === "2026 Senate" ? "U.S. Senate" : group === "2026 Governor" ? "Governor" : null;
  const mapRows = useMemo<MapRow[]>(() => {
    if (!mapOffice) return [];
    const best: Record<string, MapRow> = {};
    for (const def of AGGREGATES) {
      if (!def.stateAbbr || GROUP_OF(def.category) !== group) continue;
      const b = allBuilt[def.id];
      if (!b?.latest) continue;
      const net = b.latest.net;
      const lead = net >= 0 ? def.seriesA : def.seriesB;
      const row: MapRow = {
        abbr: def.stateAbbr,
        id: def.id,
        title: `${STATE_NAME[def.stateAbbr] ?? def.stateAbbr} ${def.category === "2026 Senate" ? "Senate" : "governor"}: ${def.seriesA.label} vs. ${def.seriesB.label}`,
        leader: lead.label,
        color: lead.color,
        margin: Math.abs(net),
        marginText: def.fmtMargin(net),
        polls: b.polls.length,
        party: lead.party ? lead.party[0] : undefined,
      };
      // Texas carries two Senate matchups; the map shows the better polled one,
      // and both stay reachable from the picker.
      const prev = best[def.stateAbbr];
      if (!prev || row.polls > prev.polls) best[def.stateAbbr] = row;
    }
    return Object.values(best).sort((a, z) => a.abbr.localeCompare(z.abbr));
  }, [mapOffice, group, allBuilt]);

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
  const POLL_FOLD = 12;
  const rowsH2H = showAllPolls ? visH2H : visH2H.slice(0, POLL_FOLD);
  const rowsMulti = showAllPolls ? visMulti : visMulti.slice(0, POLL_FOLD);

  const sortHead = (k: string, label: string, num = true) => (
    <th key={k} className={num ? "n" : ""} aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" className={`pa-sort${sort.key === k ? " on" : ""}`} onClick={() => toggleSort(k)}>
        {label}<SortIcon dir={sort.key === k ? sort.dir : null} />
      </button>
    </th>
  );
  const maxAbsMargin = Math.max(8, ...h2hPolls.map((p) => Math.abs(p.margin)));
  const totalPolls = isMulti ? multiPolls.length : h2hPolls.length;
  const visCount = isMulti ? visMulti.length : visH2H.length;

  const dailyArr = isMulti ? (builtMulti?.daily ?? []) : (builtH2H?.daily ?? []);
  const updated = dailyArr.length ? dailyArr[dailyArr.length - 1].date : null;
  const allPolls: { pollster: string; t: number }[] = isMulti ? multiPolls : h2hPolls;
  const pollsterCount = useMemo(() => new Set(allPolls.map((p) => p.pollster)).size, [allPolls]);
  const newestT = allPolls.length ? Math.max(...allPolls.map((p) => p.t)) : null;

  // head to head derived
  const hLatest = builtH2H?.latest ?? null;
  const leadColor = hLatest && h2hDef ? (hLatest.net >= 0 ? h2hDef.seriesA.color : h2hDef.seriesB.color) : "var(--ink)";
  const hDaily = builtH2H?.daily ?? [];
  const change30 = useMemo(() => {
    if (hDaily.length < 2) return null;
    const last = hDaily[hDaily.length - 1];
    const past = [...hDaily].reverse().find((d) => d.t <= last.t - 30 * DAY);
    return past ? last.net - past.net : null;
  }, [hDaily]);

  const words = heads(item, h2hDef, multiDef);
  const isMatchup = !!h2hDef && h2hDef.marginLabel === "Margin";
  let reading = "";
  if (h2hDef && hLatest) {
    const lead = hLatest.net >= 0 ? h2hDef.seriesA.label : h2hDef.seriesB.label;
    const verb = /^(Democrats|Republicans)$/.test(lead) ? "lead" : "leads";
    reading = isMatchup
      ? (Math.abs(hLatest.net) < 0.05 ? "The race is even" : `${lead} ${verb} by ${Math.abs(hLatest.net).toFixed(1)} points`)
      : `${h2hDef.marginLabel} stands at ${h2hDef.fmtMargin(hLatest.net)}`;
    reading += ` in the OnPoint average of ${totalPolls} public poll${totalPolls === 1 ? "" : "s"}, weighted by recency, sample size, voter screen and pollster grade.`;
  } else if (multiDef && builtMulti?.latest) {
    const li = leaderIdx(builtMulti.latest);
    reading = `${multiDef.series[li].label} leads the field at ${builtMulti.latest[li].toFixed(1)} percent in the OnPoint average of ${totalPolls} public polls.`;
  }
  const lede = `${isMatchup && h2hDef ? `${h2hDef.seriesA.label} vs. ${h2hDef.seriesB.label}. ` : ""}${reading}`;

  const fcKey = h2hDef?.stateAbbr ? `${h2hDef.category === "2026 Senate" ? "sen" : "gov"}-${h2hDef.stateAbbr}` : null;
  const fc = fcKey && forecast ? forecast[fcKey] : undefined;
  const fcRating = fc ? rating(fc.m, fc.ind) : null;

  const reduceMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  function pickGroup(g: string) { setGroup(g); const first = CATALOG.find((c) => c.group === g); if (first) { setId(first.id); setQuery(""); } }
  function openFocus(it: Item) { setView("focus"); setGroup(it.group); setId(it.id); setQuery(""); window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); }
  function pickAgg(aid: string) { setId(aid); setQuery(""); }
  function pickFromMap(aid: string) { pickAgg(aid); window.scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" }); }

  function downloadCSV() {
    let header: (string | number)[] = [], rows: (string | number)[][] = [], fname = "onpoint-polls.csv";
    if (isMulti && multiDef && builtMulti) {
      header = ["Pollster", "Date", "Sample", "Type", "Grade", ...multiDef.series.map((s) => s.label)];
      rows = builtMulti.polls.slice().sort((a, b) => b.t - a.t).map((p) => [p.pollster, p.date, p.sampleSize || "", p.sampleType, getPollsterEntry(p.pollster).grade, ...p.v.map((x) => (Number.isFinite(x) ? round1(x) : ""))]);
      fname = `onpoint-${multiDef.id}-polls.csv`;
    } else if (h2hDef && builtH2H) {
      header = ["Pollster", "Date", "Sample", "Type", "Grade", h2hDef.seriesA.label, h2hDef.seriesB.label, h2hDef.marginLabel];
      rows = builtH2H.polls.slice().sort((a, b) => b.t - a.t).map((p) => [p.pollster, p.date, p.sampleSize || "", p.sampleType, getPollsterEntry(p.pollster).grade, p.a, p.b, round1(p.margin)]);
      fname = `onpoint-${h2hDef.id}-polls.csv`;
    } else return;
    const csv = [header, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fname;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  const pollsterCell = (name: string) => {
    const entry = getPollsterEntry(name);
    return <td className="pa-who"><span>{name}</span><span className={`pa-grade${gradeIsHigh(entry.grade) ? " hi" : ""}`}>{entry.grade}</span></td>;
  };
  const sampleCell = (n: number, type: string) => <td className="n">{n > 0 ? n.toLocaleString("en-US") : "n/a"}<span className="pa-type">{type}</span></td>;

  /* ------------------------------ the full board ------------------------------ */
  if (view === "board") {
    return (
      <div className="opp pa">
        <style>{CSS}</style>
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span>Full board</span>
        </nav>
        <header className="ph">
          <div className="eye g">Polling averages</div>
          <h1>The full <em>board</em></h1>
          <p className="lede">Every average OnPoint Politics tracks, with its latest reading and trend. Open any tile for the chart, the trend lines and every poll.</p>
          <div className="pmeta">
            <span><b>{CATALOG.length}</b> averages</span>
            <span>Weighted by recency, sample size, voter screen and pollster grade</span>
            <button type="button" className="btn sm" onClick={() => setView("focus")}>Back to {shortLabel(item)}</button>
          </div>
        </header>
        {GROUPS.map((g) => {
          const items = CATALOG.filter((c) => c.group === g);
          return (
            <section className="sec" key={g} style={{ paddingBlock: "14px" }}>
              <div className="sec-h"><h2 style={{ fontSize: 22 }}>{GROUP_TITLE[g] ?? g}</h2><span className="eye" style={{ marginLeft: "auto" }}>{items.length} averages</span></div>
              <div className="tiles">
                {items.map((it) => {
                  let color = "var(--ink2)", valueText = "", spark: number[] = [], n = 0, last: string | null = null;
                  if (it.kind === "h2h") {
                    const b = allBuilt[it.id]; const d = H2H_BY_ID[it.id];
                    if (b?.latest) { color = b.latest.net >= 0 ? d.seriesA.color : d.seriesB.color; valueText = d.fmtMargin(b.latest.net); spark = b.daily.map((x) => x.net); }
                    if (b) { n = b.polls.length; last = b.daily.length ? b.daily[b.daily.length - 1].date : null; }
                  } else {
                    const b = allMulti[it.id]; const d = MULTI_BY_ID[it.id];
                    if (b?.latest) { const li = leaderIdx(b.latest); color = d.series[li].color; valueText = `${d.series[li].label} ${b.latest[li].toFixed(1)}`; spark = b.daily.map((x) => x.v[li]); }
                    if (b) { n = b.polls.length; last = b.daily.length ? b.daily[b.daily.length - 1].date : null; }
                  }
                  return (
                    <a key={it.id} href={pollHref(it.id)} className="card tile"
                      onClick={(e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; e.preventDefault(); openFocus(it); }}>
                      <span className="t">{shortLabel(it)}</span>
                      {valueText ? <span className="v mono" style={{ color }}>{valueText}</span> : <span className="pa-skel" aria-hidden />}
                      {spark.length ? <Sparkline data={sample(spark, 60)} color={color} /> : <span className="pa-skel sm" aria-hidden />}
                      <span className="s">{n ? `${n} polls` : ""}{last ? ` · through ${fmtIso(last, false)}` : ""}</span>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    );
  }

  /* ------------------------------ one average ------------------------------ */
  const optionIdx = options.findIndex((o) => o.id === id);
  return (
    <div className="opp pa">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span>
        <Link href={GROUP_HREF[item.group] ?? "/polls"}>{GROUP_TITLE[item.group] ?? item.group}</Link><span className="sep">/</span><span>{words.crumb}</span>
      </nav>
      <header className="ph">
        <div className="eye g">{words.eyebrow}</div>
        <h1>{words.h1} <em>average</em></h1>
        <p className="lede">{lede}</p>
        <div className="pmeta">
          <span><b className="mono">{totalPolls}</b> polls</span>
          {updated && <span>Updated <b>{fmtIso(updated)}</b></span>}
          {sampleFilter !== "all" && <span className="pill pa-flt">{SAMPLE_OPTS.find((o) => o.val === sampleFilter)?.full} only</span>}
          {h2hDef && <a className="btn sm" href={`/api/polls/${h2hDef.id}`}>Public JSON</a>}
        </div>
      </header>

      {/* switch averages: group, then the race; the URL follows through pollHref */}
      <div className="card pa-switch">
        <div className="seg pa-groups" role="tablist" aria-label="Average group">
          {GROUPS.map((g) => (
            <button key={g} type="button" role="tab" aria-selected={g === group} className={g === group ? "on" : ""} onClick={() => pickGroup(g)}>{GROUP_TITLE[g] ?? g}</button>
          ))}
        </div>
        <label className="pa-pick">
          <span className="sr-only">Choose an average</span>
          <select value={optionIdx >= 0 ? id : ""} onChange={(e) => e.target.value && pickAgg(e.target.value)}>
            {optionIdx < 0 && <option value="">Choose an average</option>}
            {options.map((it) => <option key={it.id} value={it.id}>{shortLabel(it)}</option>)}
          </select>
        </label>
        <div className="pa-switch-r">
          <span className="eye">Voter sample</span>
          <div className="seg" role="group" aria-label="Filter polls by sample type">
            {SAMPLE_OPTS.map((o) => {
              const n = o.val === "all" ? baseCount : (typeCounts[o.val] ?? 0);
              const disabled = o.val !== "all" && n === 0;
              return (
                <button key={o.val} type="button" className={sampleFilter === o.val ? "on" : ""} disabled={disabled} aria-pressed={sampleFilter === o.val}
                  title={disabled ? `No ${o.full.toLowerCase()} polls for this race` : o.full} onClick={() => setSampleFilter(o.val)}>
                  {o.label}<small>{n}</small>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn sm" onClick={() => setView("board")}>Full board</button>
        </div>
      </div>

      <div className="layout">
        <div className="pa-main">
          <section className="card">
            <div className="card-h"><h3>Average over time</h3><span className="eye" style={{ marginLeft: "auto" }}>Each dot is one poll</span></div>
            <div className="card-b">
              {dailyArr.length === 0 ? (
                <div className="empty">No {(SAMPLE_OPTS.find((o) => o.val === sampleFilter)?.full ?? "matching").toLowerCase()} polls for this average.</div>
              ) : isMulti && builtMulti && multiDef ? (
                <MultiCandidateChart animKey={`${multiDef.id}:${sampleFilter}`} daily={builtMulti.daily} polls={builtMulti.polls} series={multiDef.series} unit={multiDef.unit} />
              ) : builtH2H && h2hDef ? (
                <AggregatePollChart animKey={`${h2hDef.id}:${sampleFilter}`} daily={builtH2H.daily} polls={builtH2H.polls} seriesA={h2hDef.seriesA} seriesB={h2hDef.seriesB} fmtMargin={h2hDef.fmtMargin} marginLabel={h2hDef.marginLabel} unit={h2hDef.unit} />
              ) : null}
            </div>
          </section>

          {!isMulti && h2hDef ? (
            <section className="card">
              <div className="card-h"><h3>Trend lines</h3><span className="eye" style={{ marginLeft: "auto" }}>LOWESS, each poll counts once</span></div>
              <div className="card-b">
                <TrendPanel key={`${h2hDef.id}:${sampleFilter}`} def={h2hDef}
                  polls={sampleFilter === "all" ? h2hDef.polls : h2hDef.polls.filter((p) => canonType(p.sampleType) === sampleFilter)} />
              </div>
            </section>
          ) : null}

          <section className="card">
            <div className="card-h">
              <h3>All polls</h3><span className="eye">{visCount} of {totalPolls}</span>
              <div className="pa-tools">
                <input className="pa-search" type="search" placeholder="Filter by pollster" aria-label="Filter by pollster" value={query} onChange={(e) => setQuery(e.target.value)} />
                <button type="button" className="btn sm" onClick={downloadCSV}>
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden><path d="M8 1.5v8.5m0 0L4.5 6.5M8 10l3.5-3.5M2.5 13.5h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  CSV
                </button>
              </div>
            </div>
            <div className="tblwrap">
              {isMulti && multiDef ? (
                <table className="tbl pa-tbl">
                  <thead>
                    <tr>
                      {sortHead("pollster", "Pollster", false)}
                      {sortHead("date", "Date")}
                      {sortHead("sample", "Sample")}
                      {multiDef.series.map((s, i) => sortHead(`c${i}`, s.label))}
                    </tr>
                  </thead>
                  <tbody>
                    {builtMulti?.latest && (
                      <tr className="avg">
                        <td>OnPoint average</td><td className="n">{updated ? fmtIso(updated) : ""}</td><td className="n">{totalPolls} polls</td>
                        {multiDef.series.map((s, ci) => <td key={s.key} className="n" style={{ color: s.color }}>{Number.isFinite(builtMulti.latest![ci]) ? builtMulti.latest![ci].toFixed(1) : ""}</td>)}
                      </tr>
                    )}
                    {rowsMulti.map((p, i) => {
                      const mi = leaderIdx(p.v);
                      return (
                        <tr key={`${p.pollster}-${p.date}-${i}`}>
                          {pollsterCell(p.pollster)}
                          <td className="n">{fmtDay(p.t)}</td>
                          {sampleCell(p.sampleSize, p.sampleType)}
                          {multiDef.series.map((s, ci) => (
                            <td key={s.key} className="n" style={ci === mi ? { color: s.color, fontWeight: 700 } : undefined}>{Number.isFinite(p.v[ci]) ? round0(p.v[ci]) : ""}</td>
                          ))}
                        </tr>
                      );
                    })}
                    {visMulti.length === 0 && <tr><td colSpan={3 + multiDef.series.length} className="empty">No pollsters match &ldquo;{query}&rdquo;.</td></tr>}
                  </tbody>
                </table>
              ) : h2hDef ? (
                <table className="tbl pa-tbl">
                  <thead>
                    <tr>
                      {sortHead("pollster", "Pollster", false)}
                      {sortHead("date", "Date")}
                      {sortHead("sample", "Sample")}
                      {sortHead("a", h2hDef.seriesA.label)}
                      {sortHead("b", h2hDef.seriesB.label)}
                      {sortHead("margin", h2hDef.marginLabel)}
                    </tr>
                  </thead>
                  <tbody>
                    {hLatest && (
                      <tr className="avg">
                        <td>OnPoint average</td>
                        <td className="n">{updated ? fmtIso(updated) : ""}</td>
                        <td className="n">{totalPolls} polls</td>
                        <td className="n" style={{ color: h2hDef.seriesA.color }}>{hLatest.a.toFixed(1)}</td>
                        <td className="n" style={{ color: h2hDef.seriesB.color }}>{hLatest.b.toFixed(1)}</td>
                        <td className="n" style={{ color: leadColor }}>{h2hDef.fmtMargin(hLatest.net)}</td>
                      </tr>
                    )}
                    {rowsH2H.map((p, i) => {
                      const pct = Math.min(50, (Math.abs(p.margin) / maxAbsMargin) * 50);
                      const mColor = p.margin > 0 ? h2hDef.seriesA.color : p.margin < 0 ? h2hDef.seriesB.color : "var(--mute)";
                      return (
                        <tr key={`${p.pollster}-${p.date}-${i}`}>
                          {pollsterCell(p.pollster)}
                          <td className="n">{fmtDay(p.t)}</td>
                          {sampleCell(p.sampleSize, p.sampleType)}
                          <td className="n">{round0(p.a)}</td>
                          <td className="n">{round0(p.b)}</td>
                          <td className="n">
                            <span className="pa-mcell">
                              <span className="pa-mbar" aria-hidden><span style={p.margin >= 0 ? { left: "50%", width: `${pct}%`, background: mColor } : { right: "50%", width: `${pct}%`, background: mColor }} /></span>
                              <span className="pa-mnum" style={{ color: mColor }}>{h2hDef.fmtMargin(round1(p.margin))}</span>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {visH2H.length === 0 && <tr><td colSpan={6} className="empty">No pollsters match &ldquo;{query}&rdquo;.</td></tr>}
                  </tbody>
                </table>
              ) : null}
            </div>
            {visCount > POLL_FOLD && (
              <div className="pa-fold">
                <button type="button" className="btn sm" onClick={() => setShowAllPolls((s) => !s)}>
                  {showAllPolls ? "Show the latest twelve" : `Show all ${visCount} polls`}
                </button>
              </div>
            )}
          </section>

          {mapOffice && (
            <section className="card">
              <div className="card-h"><h3>Every 2026 {mapOffice === "Governor" ? "governor" : "Senate"} average</h3><span className="eye" style={{ marginLeft: "auto" }}>Click a state</span></div>
              <div className="card-b">
                {mapRows.length ? <StateRaceMap rows={mapRows} activeId={id} onPick={pickFromMap} office={mapOffice} /> : <div className="empty">Building state averages</div>}
              </div>
            </section>
          )}
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>Current average</h3><span className="eye" style={{ marginLeft: "auto" }}>{sampleFilter === "all" ? "All polls" : SAMPLE_OPTS.find((o) => o.val === sampleFilter)?.label}</span></div>
            {!isMulti && h2hDef && hLatest ? (
              <>
                <div className="stat">
                  <div className="k">{h2hDef.seriesA.label}{h2hDef.seriesA.party ? `, ${h2hDef.seriesA.party}` : ""}</div>
                  <div className="v mono-n" style={{ color: h2hDef.seriesA.color }}>{hLatest.a.toFixed(1)}{h2hDef.unit === "%" ? "%" : ""}</div>
                </div>
                <div className="stat">
                  <div className="k">{h2hDef.seriesB.label}{h2hDef.seriesB.party ? `, ${h2hDef.seriesB.party}` : ""}</div>
                  <div className="v mono-n" style={{ color: h2hDef.seriesB.color }}>{hLatest.b.toFixed(1)}{h2hDef.unit === "%" ? "%" : ""}</div>
                </div>
                <div className="stat">
                  <div className="k">{h2hDef.marginLabel}</div>
                  <div className="v mono-n" style={{ color: leadColor }}>{h2hDef.fmtMargin(hLatest.net)}</div>
                  <div className="pa-split" aria-hidden>
                    <i style={{ width: `${clampN((hLatest.a / Math.max(1, hLatest.a + hLatest.b)) * 100, 0, 100)}%`, background: h2hDef.seriesA.color }} />
                    <i style={{ flex: 1, background: h2hDef.seriesB.color }} />
                  </div>
                </div>
              </>
            ) : isMulti && multiDef && builtMulti?.latest ? (
              <div className="stat">
                <div className="k">Standings</div>
                {multiDef.series.map((s, i) => ({ s, v: builtMulti.latest![i] })).filter((r) => Number.isFinite(r.v)).sort((a, b) => b.v - a.v).map(({ s, v }) => (
                  <div className="cand" key={s.key}><i style={{ background: s.color }} /><span>{s.label}</span><span className="p">{v.toFixed(1)}%</span></div>
                ))}
              </div>
            ) : (
              <div className="empty">No polls in this view.</div>
            )}
            <div className="stat">
              <div className="k">The numbers</div>
              <div className="kv"><span>Polls in the average</span><span>{totalPolls}</span></div>
              <div className="kv"><span>Pollsters</span><span>{pollsterCount}</span></div>
              {newestT != null && <div className="kv"><span>Newest poll</span><span>{fmtDay(newestT)}</span></div>}
              {change30 != null && <div className="kv"><span>Change, 30 days</span><span>{signed(change30)}</span></div>}
            </div>
          </div>

          {fc && fcRating && (
            <div className="card">
              <div className="card-h"><h3>The forecast</h3><span className={`pill ${ratingPill(fcRating)}`} style={{ marginLeft: "auto" }}>{RATING_LABEL[fcRating]}</span></div>
              <div className="card-b">
                <div className="kv"><span>Model margin</span><span>{fmtM(fc.m, fc.ind)}</span></div>
                <p className="pa-note">The model blends this average with partisan lean and fundamentals, then simulates the race thousands of times.</p>
                <Link className="btn sm" href={fc.href}>Open the race forecast</Link>
              </div>
            </div>
          )}

          <div className="callout">
            <div className="eye">Methodology</div>
            The OnPoint average weights every public poll by recency, sample size, voter screen and pollster grade, and is rebuilt every day. TPSI polls are fielded by The Public Sentiment Institute. <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>How the average works</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.pa .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
.pa .pa-switch { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; padding: 10px 12px; margin-bottom: 16px; }
.pa .pa-switch .seg { margin-left: 0; flex-wrap: wrap; }
.pa .seg button:disabled { opacity: .35; cursor: not-allowed; }
.pa .seg button:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pa .seg button small { font: 600 10px var(--font-m); margin-left: 5px; opacity: .65; font-variant-numeric: tabular-nums; }
.pa .pa-pick select { appearance: none; -webkit-appearance: none; cursor: pointer; max-width: min(340px, 100%); border: 1px solid var(--line2); border-radius: 999px; color: #fff; font: 600 13px var(--font-b); padding: 8px 34px 8px 14px;
  background: var(--glass2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'%3E%3Cpath d='M2 3.5 5 6.5 8 3.5' fill='none' stroke='%23c9c2d6' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") no-repeat right 13px center; }
.pa .pa-pick select:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pa .pa-pick option { background: #160a24; color: #fff; }
.pa .pa-pick { min-width: 0; max-width: 100%; }
.pa .pa-switch-r { margin-left: auto; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.pa .pa-main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
.pa .pa-main > * { min-width: 0; }
.pa .pa-who { white-space: normal !important; min-width: 180px; }
.pa .pa-tools { margin-left: auto; display: flex; gap: 8px; align-items: center; }
.pa .pa-search { background: var(--glass); border: 1px solid var(--line2); border-radius: 999px; color: #fff; font: 500 13px var(--font-b); padding: 7px 14px; width: 190px; max-width: 46vw; }
.pa .pa-search::placeholder { color: var(--mute); }
.pa .pa-search:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
.pa .pa-tbl { min-width: 640px; }
.pa .pa-tbl th.n { text-align: right; }
.pa .pa-tbl td { white-space: nowrap; }
.pa .pa-tbl td.empty { text-align: center; white-space: normal; }
.pa .pa-sort { appearance: none; background: none; border: 0; padding: 0; cursor: pointer; font: inherit; letter-spacing: inherit; text-transform: inherit; color: inherit; display: inline-flex; align-items: center; gap: 4px; }
.pa .pa-sort:hover, .pa .pa-sort.on { color: #fff; }
.pa .pa-sort:focus-visible { outline: 2px solid #fff; outline-offset: 2px; border-radius: 3px; }
.pa .pa-sort-ind { display: inline-block; width: 8px; }
.pa .pa-who span:first-child { color: var(--ink); font-weight: 600; }
.pa .pa-grade { display: inline-block; margin-left: 8px; padding: 1px 5px; border: 1px solid var(--line2); border-radius: 5px; font: 600 10px var(--font-m); color: var(--mute); }
.pa .pa-grade.hi { color: var(--ink); border-color: rgba(255,255,255,.35); }
.pa .pa-type { color: var(--mute); margin-left: 6px; }
.pa .pa-mcell { display: inline-flex; align-items: center; justify-content: flex-end; gap: 10px; }
.pa .pa-mbar { position: relative; width: 64px; height: 6px; border-radius: 3px; background: rgba(255,255,255,.06); flex-shrink: 0; }
.pa .pa-mbar::before { content: ""; position: absolute; left: 50%; top: -2px; bottom: -2px; width: 1px; background: rgba(255,255,255,.2); }
.pa .pa-mbar span { position: absolute; top: 0; bottom: 0; border-radius: 3px; }
.pa .pa-mnum { font-weight: 700; min-width: 64px; text-align: right; }
.pa .pa-fold { display: flex; justify-content: center; padding: 14px; }
.pa .stat .v.mono-n { font-variant-numeric: tabular-nums; }
.pa .pa-split { display: flex; height: 6px; border-radius: 99px; overflow: hidden; background: rgba(255,255,255,.08); margin-top: 8px; gap: 2px; }
.pa .pa-split i { display: block; height: 100%; }
.pa .pa-flt { background: var(--glass2); color: var(--ink); }
.pa .pa-note { font-size: 12.5px; color: var(--mute); margin: 10px 0 12px; line-height: 1.5; }
.pa .tile { color: inherit; }
.pa .tile .v.mono { font-family: var(--font-m); font-size: 22px; letter-spacing: -.01em; }
.pa .pa-skel { display: block; height: 22px; border-radius: 6px; background: rgba(255,255,255,.05); }
.pa .pa-skel.sm { height: 28px; }
@media (max-width: 960px) { .pa .pa-switch-r { margin-left: 0; } }
@media (max-width: 600px) { .pa .pa-tools { margin-left: 0; width: 100%; } .pa .pa-search { flex: 1; max-width: none; } }
`;
