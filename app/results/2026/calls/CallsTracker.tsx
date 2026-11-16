"use client";
// The Calls Desk: one table of every race, with On Point's calls and the progress of everything not yet called.
// It does not make calls. The calls are the engine's (app/lib/engine/modelCalls.ts), read exactly as every other
// results page reads them; civicAPI supplies the count and its own calls are not shown. In a replay the table shows
// the night as of the replay clock. Pure rules and sorting: tracker.ts.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { STN, type XRace } from "../live";
import { useSharedLive } from "../LiveProvider";
import { useEngine } from "../engineClient";
import { useRecordedCalls } from "../useLive";
import { callsFromLedger, type CallBook } from "../onpointCalls";
import { probText } from "../EngineCharts";
import type { RaceRow } from "@/app/lib/engine/pipeline";
import { OFFICE_TABS, TRACK_LABEL, TRACK_ORDER, officeOf, trackCounts, trackPasses, trackRow, trackSort, type ModelRead, type OfficeTab, type SortKey, type TrackRow, type TrackStatus, type Who } from "./tracker";

const ET = "America/New_York";
const callTime = (iso: string | null) => {
  if (!iso) return "—"; const d = new Date(iso);
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET }), t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET });
  return `${t} · ${day}`;
};
const clock = (iso: string | Date | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }) : "—");
const votesText = (v: number) => (v > 0 ? Math.round(v).toLocaleString("en-US") : "—");
const letter = (p: string | null | undefined) => { const s = (p ?? "").toLowerCase(); return s === "d" || s.startsWith("dem") ? "D" : s === "r" || s.startsWith("rep") || s === "gop" ? "R" : s === "i" || s.startsWith("ind") || s === "npa" ? "I" : ""; };
const surname = (n: string) => { const w = n.replace(/,? (Jr\.?|Sr\.?|II|III|IV)$/i, "").trim().split(/\s+/); return w[w.length - 1] || n; };
const isMeasure = (r: XRace) => r.k === "measure";

function Name({ w, r, strong = false }: { w: Who | null; r: XRace; strong?: boolean }) {
  if (!w) return <span className="ct-none">—</span>;
  const l = isMeasure(r) ? "" : letter(w.party);
  return <span className={`ct-name${strong ? " strong" : ""}`}>{l ? <i className={`ct-p p-${l}`} aria-label={l === "D" ? "Democrat" : l === "R" ? "Republican" : "Independent"}>{l}</i> : <i className="ct-p p-none" aria-hidden />}{w.name}</span>;
}

/** the model's read of a race from the engine's row: the leader's chance and the projected final margin */
function engineRead(row: RaceRow | undefined): ModelRead | null {
  if (!row || row.dataState === "MISSING") return null;
  const by = (id: string | null | undefined): Who | null => { const c = id ? row.c.find((x) => x[0] === id) : null; return c ? { name: c[1], party: c[2] } : null; };
  const of = row.top2 ? by(row.top2.a) : null;
  return { prob: row.shown ?? row.probability, probOf: by(row.leaderId), proj: row.top2 && of ? { of, mean: row.top2.mean, lo: row.top2.lo, hi: row.top2.hi } : null, pre: false };
}
/** the pre-election forecast, for a page with no live model: the favourite's chance and forecast margin */
function preRead(r: XRace): ModelRead | null {
  if (isMeasure(r)) {
    if (r.pPass == null && r.yes == null) return null;
    const yes = (r.pPass ?? 0.5) >= 0.5; const of: Who = { name: yes ? "Yes" : "No", party: null };
    return { prob: r.pPass == null ? null : Math.max(r.pPass, 1 - r.pPass), probOf: of, proj: r.yes == null ? null : { of: { name: r.yes >= 50 ? "Yes" : "No", party: null }, mean: Math.abs(2 * r.yes - 100), lo: null, hi: null }, pre: true };
  }
  const a = r.c?.[0], b = r.c?.[1]; if (!a || !b || (r.pR == null && r.m == null)) return null;
  const fav = (x: boolean): Who => ({ name: (x ? b : a)[0], party: (x ? b : a)[1] });
  return { prob: r.pR == null ? null : Math.max(r.pR, 1 - r.pR), probOf: r.pR == null ? null : fav(r.pR >= 0.5), proj: r.m == null ? null : { of: fav(r.m > 0), mean: Math.abs(r.m), lo: null, hi: null }, pre: true };
}

const COLS: { k: SortKey; label: string; num?: boolean; first: 1 | -1; tip: string }[] = [
  { k: "race", label: "Race", first: 1, tip: "Office, then state" },
  { k: "status", label: "Status", first: 1, tip: "Called first" },
  { k: "leader", label: "Winner or leader", first: 1, tip: "By name" },
  { k: "margin", label: "Lead now", num: true, first: 1, tip: "The leader's lead in counted votes, in points" },
  { k: "pct", label: "% in", num: true, first: -1, tip: "Share of the expected vote counted, as civicAPI reports it" },
  { k: "votes", label: "Votes counted", num: true, first: -1, tip: "All votes counted so far" },
  { k: "prob", label: "Win probability", num: true, first: -1, tip: "The model's chance for the candidate it favours. A probability is not a call." },
  { k: "proj", label: "Forecast result", num: true, first: 1, tip: "The model's projected final margin, with its 80% range" },
  { k: "called", label: "Called at", num: true, first: -1, tip: "When On Point called it (Eastern time)" },
];
const PAGE = 150;

export default function CallsTracker() {
  const e = useEngine(); const sh = useSharedLive(); const ix = sh?.ix ?? null, live = sh?.live ?? null;
  const rec = useRecordedCalls();
  const [office, setOffice] = useState<OfficeTab>("all"); const [status, setStatus] = useState<TrackStatus | "all">("all");
  const [st, setSt] = useState<string>("all"); const [q, setQ] = useState("");
  const [sort, setSort] = useState<{ k: SortKey; dir: 1 | -1 }>({ k: "race", dir: 1 });
  const [all, setAll] = useState(false);
  const v = e.available ? e.view : null;
  const book: CallBook = useMemo(() => (v ? callsFromLedger(v.ledger.races) : rec ?? {}), [v, rec]);
  const rows = useMemo<TrackRow[]>(() => {
    if (!ix || !live) return [];
    return ix.races.filter((r) => r.k !== "leg").map((r) => trackRow(r, live.byId[r.id], book[r.id]?.at ?? null, v ? engineRead(v.races[r.id]) : preRead(r)));
  }, [ix, live, book, v]);
  const inOffice = useMemo(() => rows.filter((x) => trackPasses(x, { office, status: "all", st, q })), [rows, office, st, q]);
  const n = useMemo(() => trackCounts(inOffice), [inOffice]);
  const nOffice = useMemo(() => { const m: Record<string, number> = { all: rows.length }; for (const x of rows) { const o = officeOf(x.r.k); m[o] = (m[o] ?? 0) + 1; } return m; }, [rows]);
  const shown = useMemo(() => trackSort(inOffice.filter((x) => status === "all" || x.status === status), sort.k, sort.dir), [inOffice, status, sort]);
  const states = useMemo(() => [...new Set(rows.map((x) => x.r.st))].filter((s) => STN[s]).sort((a, b) => STN[a].localeCompare(STN[b])), [rows]);
  const replay = e.mode === "REPLAY", sim = v?.mode === "SIMULATED";
  const asOf = v ? v.t : live?.at ?? null;
  const filtered = office !== "all" || status !== "all" || st !== "all" || !!q.trim();
  const reset = () => { setOffice("all"); setStatus("all"); setSt("all"); setQ(""); };
  const head = (c: (typeof COLS)[number]) => {
    const on = sort.k === c.k;
    return (
      <th key={c.k} scope="col" className={`${c.num ? "num " : ""}c-${c.k}`} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button type="button" title={c.tip} onClick={() => setSort(on ? { k: c.k, dir: sort.dir === 1 ? -1 : 1 } : { k: c.k, dir: c.first })}>{c.label}<i aria-hidden>{on ? (sort.dir === 1 ? "▲" : "▼") : ""}</i></button>
      </th>
    );
  };
  const list = all ? shown : shown.slice(0, PAGE);
  return (
    <section className="ct" aria-labelledby="ct-h">
      <nav className="ct-nav" aria-label="Where you are">
        <Link className="ct-back" href="/results/2026"><svg width="12" height="12" viewBox="0 0 12 12" aria-hidden><path d="M7.5 1.5 3 6l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>2026 results</Link>
        <ol><li><span aria-current="page">Calls desk</span></li></ol>
        <span className="ct-nav-more"><Link href="/results/monitor">Situation Monitor</Link><Link href="/results/2026#rh">Every race, with maps</Link></span>
      </nav>
      <header className="ct-head">
        <div>
          <span className="eye">Calls desk · {replay ? (sim ? "SIMULATION / NOT ACTUAL RESULTS" : "election-night replay") : "November 3, 2026"}</span>
          <h1 id="ct-h">Every race, <em>in one table.</em></h1>
          <p>What On Point has called, and where every other race stands: votes in, the lead, the model&apos;s win probability and its forecast of the final result. Calls are On Point Politics&apos; own projections from its model and the count reported by civicAPI. They are unofficial until results are certified.</p>
        </div>
        <dl className="ct-asof" aria-live="polite">
          <div><dt>{replay ? "Replay time" : "Last update"}</dt><dd>{asOf ? `${clock(asOf)} ET` : live?.loading ? "Connecting" : "—"}</dd></div>
          <div><dt>Called</dt><dd>{trackCounts(rows).called}<small> of {rows.length}</small></dd></div>
        </dl>
      </header>
      {live?.error ? <p className="ct-warn" role="status">{live.error}</p> : null}
      <div className="ct-tabs" role="group" aria-label="Race type">
        {OFFICE_TABS.filter(([k]) => k === "all" || nOffice[k]).map(([k, l]) => <button key={k} type="button" aria-pressed={office === k} onClick={() => { setOffice(k); setAll(false); }}>{l}<b>{nOffice[k] ?? 0}</b></button>)}
      </div>
      <div className="ct-bar">
        <div className="ct-status" role="group" aria-label="Status">
          <button type="button" aria-pressed={status === "all"} onClick={() => setStatus("all")}>All<b>{n.all}</b></button>
          {TRACK_ORDER.map((k) => <button key={k} type="button" className={`s-${k}`} aria-pressed={status === k} onClick={() => { setStatus(k); setAll(false); }}><i aria-hidden />{TRACK_LABEL[k]}<b>{n[k]}</b></button>)}
        </div>
        <div className="ct-find">
          <select value={st} onChange={(x) => setSt(x.target.value)} aria-label="State"><option value="all">Every state</option>{states.map((s) => <option key={s} value={s}>{STN[s]}</option>)}</select>
          <input type="search" value={q} placeholder="Search a race or candidate" aria-label="Search a race or candidate" onChange={(x) => setQ(x.target.value)} />
          {filtered ? <button type="button" className="ct-reset" onClick={reset}>Clear</button> : null}
        </div>
      </div>
      <div className="ct-wrap" tabIndex={0} role="region" aria-label="Races">
        <table className="ct-table">
          <thead><tr>{COLS.map(head)}</tr></thead>
          <tbody>
            {list.map((x) => {
              const top = x.winner ?? x.leader; const m = x.model;
              return (
                <tr key={x.r.id} className={`s-${x.status}`}>
                  <th scope="row" className="c-race"><Link href={`/results/2026/${encodeURIComponent(x.r.id)}`}>{x.r.nm}</Link></th>
                  <td className="c-status"><span className={`ct-chip s-${x.status}`}>{x.status === "called" ? <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden><path d="M1.5 5.2 4 7.7l4.5-5.4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}{TRACK_LABEL[x.status]}</span></td>
                  <td className="c-leader"><Name w={top} r={x.r} strong={!!x.winner} />{!x.winner && x.second ? <small>over {surname(x.second.name)}</small> : null}</td>
                  <td className="num c-margin">{x.margin == null ? "—" : x.second ? `+${x.margin.toFixed(1)}` : "unopposed"}{x.leadShare != null && x.second ? <small>{x.leadShare.toFixed(1)}%</small> : null}</td>
                  <td className="num c-pct">{x.pct == null ? "—" : <><span>{x.pct >= 99.95 ? "100" : x.pct.toFixed(0)}%</span><i className="ct-meter" aria-hidden><i style={{ width: `${Math.min(100, x.pct)}%` }} /></i></>}</td>
                  <td className="num c-votes">{votesText(x.votes)}</td>
                  <td className="num c-prob">{x.status === "called" ? <span className="ct-done">called</span> : m?.prob == null ? "—" : <>{probText(m.prob)}{m.probOf ? <small>{surname(m.probOf.name)}{m.pre ? " · pre-election" : ""}</small> : null}</>}</td>
                  <td className="num c-proj">{m?.proj ? <>{surname(m.proj.of.name)} +{Math.abs(m.proj.mean).toFixed(1)}<small>{m.proj.lo != null && m.proj.hi != null ? `${m.proj.lo.toFixed(1)} to ${m.proj.hi.toFixed(1)}` : "pre-election forecast"}</small></> : "—"}</td>
                  <td className="num c-called">{x.calledAt ? callTime(x.calledAt) : x.status === "called" ? "called" : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length ? <p className="ct-empty" role="status">{live?.loading === false && ix ? "No races to show yet." : "Loading the races"}</p> : !shown.length ? <p className="ct-empty" role="status">No races match. <button type="button" className="ct-reset" onClick={reset}>Clear the filters</button></p> : null}
      </div>
      {shown.length > PAGE ? <p className="ct-more"><button type="button" onClick={() => setAll(!all)}>{all ? `Show the first ${PAGE}` : `Show all ${shown.length} races`}</button><span>Showing {list.length} of {shown.length}</span></p> : shown.length ? <p className="ct-more"><span>{shown.length} race{shown.length === 1 ? "" : "s"}</span></p> : null}
      <footer className="ct-key">
        <p><b>Called:</b> On Point Politics has projected a winner. <b>Too close to call:</b> at least 35% of the vote is counted and the lead is under 5 points, or nearly all of it is counted and the race still cannot be called. <b>Too early to call:</b> votes are in, but too few to say. These labels describe the count; they are not calls.</p>
        <p>Win probability and forecast result are the model&apos;s estimates{v ? "" : " (the pre-election forecast where no live model is running)"}, not results, and the model is uncalibrated. The range beside a forecast is where the final margin lands four times in five. Vote counts and % in are civicAPI&apos;s. All results are unofficial until certified; for official results see your state election office.</p>
      </footer>
    </section>
  );
}
