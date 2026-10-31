"use client";
// Race history on the election-night race page: one history load shared by the results charts (votes, reporting,
// counted margin), the forecast charts (win probability, modeled final margin) and a panel that reads every metric at
// the shared cursor. Recorded values only; a value holds until the next recorded one and nothing is interpolated.
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import "./studio.css";
import "./raceHistory.css";
import { cursorSnapshot, fmtLead, fmtProb, fmtShift, fmtStamp, fmtVotes, lastName, lastUpdated, type ChartId, type PreparedHistory } from "@/app/lib/intelligence/raceHistory";
import { pctPoints } from "@/app/lib/fmtPct";

const RaceHistory = dynamic(() => import("./RaceHistory"), { ssr: false, loading: () => null });

export type HistoryState = { s: "idle" } | { s: "ready"; history: PreparedHistory; nowMs: number } | { s: "error" };

const REFRESH_MS = 60_000;

/** Loads /api/race-history/{id} and refreshes it while the tab is visible. Pass null to load nothing. */
export function useRaceHistory(raceId: string | null): HistoryState {
  const [st, setSt] = useState<HistoryState>({ s: "idle" });
  useEffect(() => {
    if (!raceId) return;
    let live = true;
    const load = () =>
      fetch(`/api/race-history/${encodeURIComponent(raceId)}`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((j: { history: PreparedHistory; nowMs: number }) => { if (live) setSt({ s: "ready", history: j.history, nowMs: j.nowMs }); })
        .catch(() => { if (live) setSt((p) => (p.s === "ready" ? p : { s: "error" })); });
    load();
    const id = setInterval(() => { if (document.visibilityState === "visible") load(); }, REFRESH_MS);
    return () => { live = false; clearInterval(id); };
  }, [raceId]);
  return st;
}

export function HistoryPane({ state, charts, title, cursor, onCursor, height = 260 }: { state: HistoryState; charts: ChartId[]; title: string; cursor: number | null; onCursor: (t: number | null) => void; height?: number }) {
  if (state.s !== "ready") {
    return <p role="status" className="rhd-wait">{state.s === "error" ? "Race history is unavailable right now. The rest of this page is unaffected." : "Loading race history\u2026"}</p>;
  }
  return <div className="rhd-pane"><RaceHistory history={state.history} nowMs={state.nowMs} title={title} charts={charts} height={height} cursor={cursor} onCursor={onCursor} /></div>;
}

export function CursorPanel({ state, cursor, onClear }: { state: HistoryState; cursor: number | null; onClear: () => void }) {
  const h = state.s === "ready" ? state.history : null;
  const t = cursor ?? (h ? lastUpdated(h) : null);
  const snap = useMemo(() => (h && t !== null ? cursorSnapshot(h, t) : null), [h, t]);
  if (!snap) return null;
  const ref = snap.reference;
  const tz = "America/New_York";
  const rows: [string, ReactNode][] = [
    ["Counted votes", snap.votes.length ? snap.votes.map((v) => `${lastName(v.label)} ${fmtVotes(v.value)}`).join(" · ") : "No votes recorded"],
    ["Reporting", snap.providerReporting || snap.modelCounted ? <>
      {snap.providerReporting ? <span title={snap.providerReporting.definition}>{pctPoints(snap.providerReporting.pct)} provider</span> : null}
      {snap.providerReporting && snap.modelCounted ? " · " : null}
      {snap.modelCounted ? <span title={snap.modelCounted.definition}>{pctPoints(snap.modelCounted.pct)} est. of final vote counted</span> : null}
    </> : "Not recorded"],
    ["Counted margin", snap.countedMargin === null ? "No votes recorded" : `${fmtLead(snap.countedMargin, ref)} counted`],
    ["Win probability", snap.winProbability.length ? `${snap.winProbability.map((w) => `${lastName(w.label)} ${fmtProb(w.pct)}`).join(" · ")}${snap.winProbability[0].phase === "FROZEN" ? " (pre-election forecast)" : ""}` : "Not published"],
    ["Modeled final margin", snap.modeledMargin ? `${fmtLead(snap.modeledMargin.pp, ref)}${snap.modeledMargin.band ? ` (${fmtLead(snap.modeledMargin.band[0], ref)} to ${fmtLead(snap.modeledMargin.band[1], ref)})` : ""}${snap.modeledMargin.phase === "FROZEN" ? " (pre-election forecast)" : ""}` : "Not published"],
    // the change is taken between the two figures as shown, so the line's arithmetic reads true
    ["vs. pre-election forecast", snap.forecastShift !== null && snap.preElectionMargin !== null && snap.modeledMargin ? `${fmtLead(snap.preElectionMargin, ref)} → ${fmtLead(snap.modeledMargin.pp, ref)} = ${fmtShift(+snap.modeledMargin.pp.toFixed(1) - +snap.preElectionMargin.toFixed(1), ref)}` : snap.preElectionMargin !== null ? `${fmtLead(snap.preElectionMargin, ref)} forecast; no live projection yet` : "No pre-election forecast"],
  ];
  return (
    <div className="rhd-snap" aria-live="polite">
      <div className="rhd-snap-h">
        <strong>{cursor === null ? "Latest recorded" : "At the cursor"}</strong>
        <span>{fmtStamp(snap.t, tz)}</span>
        {cursor !== null ? <button type="button" onClick={onClear}>Back to latest</button> : null}
      </div>
      <dl>{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      <p>Each figure is the last recorded value at or before this time. Margins in percentage points{ref ? `, ${lastName(ref.plus.name)} minus ${lastName(ref.minus.name)}` : ""}.</p>
    </div>
  );
}
