"use client";
// The Calls Desk: every race the engine follows, where it stands against the call rule, and every On Point call.
// The calls shown are On Point's own (the engine's ledger, app/lib/engine/modelCalls.ts). civicAPI supplies the count;
// its own calls are not shown on these pages. It reads the same engine state as every other page, so in a replay it
// shows the night as of the replay clock, with the times each race first qualified and was called.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import type { RaceCallState } from "@/app/lib/engine/modelCalls";
import { STN, KIND_LABEL, type Kind, type XRace } from "../live";
import { useSharedLive } from "../LiveProvider";
import { useEngine } from "../engineClient";
import { ModeSwitch } from "../ReplayDock";
import { probText } from "../EngineCharts";
import CallsByOffice, { CALLS_BY_OFFICE_CSS } from "./CallsByOffice";

const ET = "America/New_York";
const clock = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET }) : "—");
const fmtV = (v: number | null | undefined) => (v == null ? "—" : v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e4 ? `${Math.round(v / 1e3)}K` : Math.round(v).toLocaleString("en-US"));
const pLetter = (p: string | null | undefined) => { const s = (p ?? "").toLowerCase(); return s.startsWith("dem") ? "D" : s.startsWith("rep") ? "R" : s.startsWith("ind") || s === "npa" || s.startsWith("no party") ? "I" : s ? p!.slice(0, 3) : "—"; };
const pClass = (p: string | null | undefined) => { const l = pLetter(p); return l === "D" ? "p-D" : l === "R" ? "p-R" : "p-O"; };

type Status = RaceCallState["status"];
type Row = { r: XRace; s: RaceCallState | null; counted: number; pct: number | null; leader: { name: string; party: string | null } | null; prob: number | null; se: number | null; margin: [number, number] | null; outstanding: number | null; outHi: number | null; flags: string[] };
const TABS: [string, string][] = [["all", "All monitored"], ["APPROACHING", "Approaching"], ["FIRST_QUALIFIED", "First qualified"], ["MODEL_CALLED", "Called by On Point"], ["ALERTS", "Alerts"]];
const STATUS_LABEL: Record<Status, string> = { MONITORING: "Monitoring", APPROACHING: "Approaching", FIRST_QUALIFIED: "First qualified", MODEL_CALLED: "On Point call", SETTLED_UNCONTESTED: "Unopposed" };
const LANE_TEXT: Record<string, string> = { "safe-seat": "safe seat", "count-settled": "count settled", uncontested: "unopposed" };
/** the log shows On Point's own record: the provider's calls are kept on the ledger for evaluation and are not displayed */
const shownEvent = (k: string) => !k.startsWith("OFFICIAL_") && k !== "ALERT_OFFICIAL_DISAGREES";
const EVENT_LABEL: Record<string, string> = { MODEL_CALLED: "On Point call", FIRST_QUALIFIED: "First qualified", RESET: "Reset", EDITORIAL_CALL: "Editorial call", ALERT_CONFIDENCE_DETERIORATED: "Alert: confidence fell", ALERT_MODEL_CONTRADICTS_CALL: "Alert: the model turned" };

export default function CallsDesk({ fallback }: { fallback: React.ReactNode }) {
  const e = useEngine(); const sh = useSharedLive(); const ix = sh?.ix ?? null;
  const [view, setView] = useState<"office" | "table">("office");
  const [tab, setTab] = useState("all"); const [kind, setKind] = useState<Kind | "all">("all"); const [q, setQ] = useState("");
  const v = e.view;
  const rows = useMemo<Row[]>(() => {
    if (!ix || !v) return [];
    return ix.races.flatMap((r) => {
      const row = v.races[r.id]; if (!row || row.dataState === "MISSING") return [];
      const s = v.ledger.races[r.id] ?? null; const lead = row.c.find((c) => c[0] === row.leaderId);
      return [{ r, s, counted: row.counted, pct: row.providerPct, leader: lead ? { name: lead[1], party: lead[2] } : null, prob: row.probability, se: s?.mcStdErr ?? null, margin: row.top2 ? [row.top2.lo, row.top2.hi] as [number, number] : null, outstanding: row.outstanding, outHi: row.outstandingHi, flags: row.flags }];
    });
  }, [ix, v]);
  // by office, every race is listed from the start of the night, with or without returns
  const officeRows = useMemo(() => (ix && v ? ix.races.filter((r) => r.k === "sen" || r.k === "gov" || r.k === "house" || r.k === "measure").map((r) => ({ r, s: v.ledger.races[r.id] ?? null })) : []), [ix, v]);
  if (!e.checked && !v) return <div className="cb-load sx-skel" />;
  if (!e.available || !v) return <>{fallback}</>;
  const cfg = v.ledger.config, sim = v.mode === "SIMULATED";
  const statusOf = (x: Row): Status => x.s?.status ?? "MONITORING";
  const ql = q.trim().toLowerCase();
  const shown = rows.filter((x) => (kind === "all" || x.r.k === kind) && (!ql || `${x.r.nm} ${STN[x.r.st] ?? ""} ${x.leader?.name ?? ""}`.toLowerCase().includes(ql)) &&
    (tab === "all" ? true : tab === "ALERTS" ? (x.s?.alerts ?? 0) > 0 : tab === "MODEL_CALLED" ? !!x.s?.modelCall : statusOf(x) === tab))
    .sort((a, b) => (b.s?.modelCall ? 1 : 0) - (a.s?.modelCall ? 1 : 0) || (b.prob ?? 0) - (a.prob ?? 0) || a.r.nm.localeCompare(b.r.nm));
  const n = { all: rows.length, APPROACHING: rows.filter((x) => statusOf(x) === "APPROACHING").length, FIRST_QUALIFIED: rows.filter((x) => statusOf(x) === "FIRST_QUALIFIED").length, MODEL_CALLED: rows.filter((x) => x.s?.modelCall).length, ALERTS: rows.filter((x) => (x.s?.alerts ?? 0) > 0).length } as Record<string, number>;
  const kinds = [...new Set(rows.map((x) => x.r.k))] as Kind[];
  const events = v.ledger.events.filter((ev) => shownEvent(ev.kind)).reverse().slice(0, 60);
  return (
    <section className="cb cd" aria-labelledby="cb-h">
      <header className="cb-head">
        <div>
          <span className="eye">Calls desk · {e.mode === "REPLAY" ? (sim ? "SIMULATED replay, not actual results" : "replay of recorded observations") : "live"}</span>
          <h1 id="cb-h">Every call, <em>and how it was made.</em></h1>
          <p>Every call on this site is On Point&apos;s own. A race is called when a candidate stands at or above <b>{(100 * cfg.threshold).toFixed(1)}%</b> in the model on {cfg.consecutive} consecutive updates with new data and every safeguard passes; a heavy favourite can be called on an early count (safe seat), a race with no forecast is called on the count itself, and an unopposed candidate is recorded when the polls close. civicAPI supplies the vote count; its own calls are not shown here. An On Point call is a projection, <b>not a certified result</b>, and the model is not yet calibrated against real election-night history.</p>
        </div>
        <div className="cd-side">
          <ModeSwitch />
          <dl className="cb-fresh" aria-live="polite"><div><dt>{e.mode === "REPLAY" ? "Replay time" : "Engine update"}</dt><dd>{clock(v.t)} ET</dd></div><div><dt>Events</dt><dd>{v.ledger.eventCount}</dd></div></dl>
        </div>
      </header>
      <div className="cd-view" role="group" aria-label="How the calls are arranged">
        <button type="button" aria-pressed={view === "office"} onClick={() => setView("office")}>By office and state</button>
        <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>Every race, by status</button>
      </div>
      {view === "office" ? <CallsByOffice rows={officeRows} v={v} moments={e.moments} /> : <>
      <div className="cb-tiles cd-tiles" role="tablist" aria-label="Call status">
        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={`t cd-t-${k}`} onClick={() => setTab(k)}><span>{l}</span><b>{n[k]}</b></button>)}
      </div>
      <div className="cb-filters" role="group" aria-label="Filters">
        <label><span>Kind</span><select value={kind} onChange={(x) => setKind(x.target.value as Kind | "all")}><option value="all">All</option>{kinds.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}</select></label>
        <label className="grow"><span>Search</span><input type="search" value={q} placeholder="Race, state or candidate" onChange={(x) => setQ(x.target.value)} /></label>
      </div>
      <div className="cd-table" role="table" aria-label="Races">
        <div className="cd-row cd-hd" role="row">{["Race", "Leader", "Chance", "Projected margin", "Reporting", "Counted · still out", "First qualified", "On Point call", "Notes"].map((h) => <span key={h} role="columnheader">{h}</span>)}</div>
        {shown.length === 0 ? <p className="cb-empty" role="status">No races in this view.</p> : null}
        {shown.slice(0, 400).map((x) => {
          const st = statusOf(x); const s = x.s;
          return (
            <div key={x.r.id} className={`cd-row s-${st}${s?.alerts ? " alert" : ""}`} role="row">
              <span role="cell" className="rc"><Link href={`/results/2026/${encodeURIComponent(x.r.id)}`}>{x.r.nm}</Link><small>{KIND_LABEL[x.r.k]} · <em className={`cd-chip c-${st}`}>{STATUS_LABEL[st]}</em></small></span>
              <span role="cell">{x.leader ? <><b>{x.leader.name}</b> {x.r.k !== "measure" && x.leader.party ? <i className={`cb-p ${pClass(x.leader.party)}`}>{pLetter(x.leader.party)}</i> : null}</> : "—"}</span>
              <span role="cell" className="num">{probText(x.prob)}{x.se != null && x.prob != null && x.prob > 0.9 ? <small> ±{(100 * 2 * x.se).toFixed(1)}</small> : null}</span>
              <span role="cell" className="num">{x.margin ? `${x.margin[0].toFixed(1)} to ${x.margin[1].toFixed(1)}` : "—"}</span>
              <span role="cell" className="num">{x.pct == null ? "—" : `${x.pct.toFixed(0)}%`}<small> precincts</small></span>
              <span role="cell" className="num">{fmtV(x.counted)}<small> · {fmtV(x.outstanding)}{x.outHi != null ? ` (up to ${fmtV(x.outHi)})` : ""}</small></span>
              <span role="cell" className="num">{clock(s?.modelCall ? s.firstQualifiedAt ?? null : s?.firstQualifiedAt)}</span>
              <span role="cell">{s?.modelCall ? <><b>{s.modelCall.name}</b><small> {clock(s.modelCall.calledAt)} · {s.modelCall.lane && LANE_TEXT[s.modelCall.lane] ? LANE_TEXT[s.modelCall.lane] : s.modelCall.probability == null ? "count settled" : s.modelCall.probability >= 0.9995 ? ">99.9%" : `${(100 * s.modelCall.probability).toFixed(1)}%`}</small></> : "—"}</span>
              <span role="cell" className="nt">{s?.alerts ? <b className="al">{s.alerts} alert{s.alerts > 1 ? "s" : ""}</b> : null}{s?.blockers?.length && !s.modelCall ? <small>{s.blockers[0]}</small> : x.flags.includes("COUNT_EXCEEDS_FORECAST") ? <small>count exceeds the forecast total</small> : null}</span>
            </div>
          );
        })}
      </div>
      </>}
      <section className="cd-log" aria-labelledby="cd-log-h">
        <h2 id="cd-log-h">Call log</h2>
        <p className="cb-foot">Newest first. Nothing is ever removed: a call that the model later doubts stays, with an alert beside it.</p>
        <ol>
          {events.map((ev) => <li key={ev.seq} className={`k-${ev.kind}`}><time>{clock(ev.at)}</time><b>{EVENT_LABEL[ev.kind] ?? ev.kind.replace(/_/g, " ").toLowerCase()}</b> <Link href={`/results/2026/${encodeURIComponent(ev.raceId)}`}>{ix?.races.find((r) => r.id === ev.raceId)?.nm ?? ev.raceId}</Link>{ev.name ? <> · {ev.name}</> : null}{ev.probability != null ? <> · {ev.probability >= 0.9995 ? ">99.9%" : ev.probability <= 0.0005 ? "<0.1%" : `${(100 * ev.probability).toFixed(1)}%`}</> : null}<small>{ev.detail}</small></li>)}
          {!events.length ? <li className="none">No events yet.</li> : null}
        </ol>
      </section>
    </section>
  );
}

export const CALLS_DESK_CSS = CALLS_BY_OFFICE_CSS + `
.cd .cb-head{display:flex;justify-content:space-between;gap:24px;align-items:flex-start}
.cd-side{display:flex;flex-direction:column;align-items:flex-end;gap:10px}
.cd-tiles{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}
.cd-tiles button{display:flex;flex-direction:column;align-items:flex-start;gap:4px;padding:10px 12px;border-radius:12px;border:1px solid var(--line2);background:var(--glass2);color:var(--ink2);cursor:pointer;font:700 11px var(--font-m);letter-spacing:.08em;text-transform:uppercase}
.cd-tiles button b{font:800 26px var(--font-d);letter-spacing:-.02em;color:var(--hi);text-transform:none}
.cd-tiles button[aria-selected="true"]{border-color:var(--hi);box-shadow:inset 0 0 0 1px var(--hi)}
.cd-t-MODEL_CALLED b{color:#7a5cff}.cd-t-ALERTS b{color:#e0533d}
.cd-table{margin-top:14px;border-top:1px solid var(--line2);font-size:13px}
.cd-row{display:grid;grid-template-columns:minmax(150px,1.5fr) minmax(120px,1.2fr) 70px 110px 90px 140px 80px minmax(150px,1.3fr) minmax(160px,1.6fr);gap:10px;align-items:center;padding:8px 4px;border-bottom:1px solid rgba(var(--line-rgb),.09)}
.cd-hd{font:700 10px var(--font-m);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.cd-row small{display:block;color:var(--mute);font-size:11px;font-weight:500}
.cd-row .num{font-variant-numeric:tabular-nums}
.cd-row .rc a{font-weight:700;color:var(--hi)}
.cd-row.alert{background:color-mix(in srgb,#e0533d 7%,transparent)}
.cd-chip{font-style:normal;font:700 9.5px var(--font-m);letter-spacing:.06em;text-transform:uppercase;padding:1px 6px;border-radius:999px;border:1px solid var(--line2)}
.cd-chip.c-MODEL_CALLED{color:#7a5cff;border-color:#7a5cff}.cd-chip.c-FIRST_QUALIFIED{color:#c77d2b;border-color:#c77d2b}.cd-chip.c-APPROACHING{color:var(--ink2)}
.cd-row .al{color:#e0533d;font-size:11.5px}
.cd-log{margin-top:28px}.cd-log h2{font:700 20px var(--font-d)}
.cd-log ol{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:2px;font-size:12.5px}
.cd-log li{padding:5px 0;border-bottom:1px solid rgba(var(--line-rgb),.07)}
.cd-log time{font:700 11px var(--font-m);color:var(--mute);margin-right:8px}
.cd-log li b{text-transform:capitalize;margin-right:4px}
.cd-log li small{display:block;color:var(--mute);margin-left:62px}
.cd-log .k-MODEL_CALLED b{color:#7a5cff}.cd-log .k-OFFICIAL_CALL_CHANGED b,.cd-log .k-OFFICIAL_CALL_WITHDRAWN b{color:#e0533d}.cd-log .k-OFFICIAL_CALL b{color:var(--hi)}.cd-log [class*="k-ALERT"] b{color:#e0533d}
@media (max-width:1100px){.cd-row{grid-template-columns:1.5fr 1.2fr 70px 1fr}.cd-row>span:nth-child(n+5){display:none}.cd-tiles{grid-template-columns:repeat(3,1fr)}}
`;
