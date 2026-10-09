"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useElectionIndex } from "../onpoint/lib/electionIndex.js";
import { candColor, leaderOf } from "../onpoint/electionLib.js";
import { fmtInt, partyTag, isNP } from "../onpoint/resultRow.jsx";
import { classifyRaceTier } from "../_data/raceCapabilities";

const CIVIC_BASE = "https://civicapi.org";
const REFRESH_MS = 30_000;
const MAX_POLL = 80; // don't hammer civicAPI for a whole season's worth of races

type CivicCandidate = {
  name: string;
  party?: string;
  votes?: number;
  percent?: number;
  winner?: boolean;
  color?: string;
};
type CivicRace = {
  id: number;
  province?: string;
  district?: string;
  election_name?: string;
  election_type?: string;
  election_date?: string;
  percent_reporting?: number;
  candidates?: CivicCandidate[];
};

function isBallotMeasure(cands: CivicCandidate[]) {
  const names = cands.map((c) => String(c.name || "").trim().toLowerCase());
  return names.includes("yes") && names.includes("no");
}

function statusOf(cands: CivicCandidate[], reporting: number) {
  const started = reporting > 0 || cands.some((c) => (c.votes || 0) > 0);
  const winner = cands.find((c) => c.winner);
  if (isBallotMeasure(cands)) {
    if (winner && started) {
      const yes = cands.find((c) => /^yes$/i.test(c.name || ""));
      const passed = winner === yes || /^yes$/i.test(winner.name || "");
      return passed ? "Measure passes" : "Measure fails";
    }
    return started ? "Decision pending" : "Awaiting results";
  }
  if (winner && started) return "Projected winner";
  return started ? "Leader" : "Awaiting results";
}

function updatedLabel(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function LocalCard({ race }: { race: CivicRace }) {
  const cands = [...(race.candidates || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const reporting = Number(race.percent_reporting) || 0;
  const leaderInfo = leaderOf(cands as any);
  const leader = leaderInfo?.cand;
  const runnerUp = cands[1];
  const status = statusOf(cands, reporting);
  const measure = isBallotMeasure(cands);
  const jurisdiction = race.province || "";

  return (
    <article className="lb-card">
      <header className="lb-head">
        <div className="lb-kicker">
          <span>{jurisdiction}</span>
          <span>{reporting > 0 ? `${reporting.toFixed(0)}% reporting` : "not yet reporting"}</span>
        </div>
        <h2>{race.election_name || race.election_type || "Race"}</h2>
        <div className="lb-status">{status}</div>
      </header>
      <div className="lb-cands">
        {cands.slice(0, measure ? 2 : 4).map((c, i) => {
          const color = candColor(c);
          const tag = measure ? "" : isNP(c.party) ? "Nonpartisan" : partyTag(c.party) || c.party || "";
          return (
            <div className="lb-cand" key={i}>
              <i className="lb-swatch" style={{ background: color }} />
              <div className="lb-name">
                <strong>{c.name}</strong>
                {tag ? <small>{tag}</small> : null}
              </div>
              <div className="lb-result">
                <strong>{(c.percent ?? 0).toFixed(1)}%</strong>
                <small>{fmtInt(c.votes || 0)} votes</small>
              </div>
            </div>
          );
        })}
      </div>
      <footer className="lb-foot">
        <span className="lb-leader">
          {leader && runnerUp && leader !== runnerUp
            ? `${String(leader.name || "").split(/\s+/).slice(-1)[0]} leads by ${fmtInt(
                (leader.votes || 0) - (runnerUp.votes || 0)
              )}`
            : leader
            ? `${String(leader.name || "").split(/\s+/).slice(-1)[0]} leading`
            : "—"}
        </span>
        <span>Updated {updatedLabel()}</span>
      </footer>
    </article>
  );
}

export default function LocalBoard() {
  const { index } = useElectionIndex(true) as { index: any };
  const [q, setQ] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [live, setLive] = useState<Record<number, CivicRace>>({});
  const pollIdsRef = useRef<number[]>([]);

  const localDocs = useMemo(() => {
    if (!index) return [];
    // Deliberately the complement of the 24-race coverage gate: this page's
    // whole purpose is down-ballot/local races the desk (isCoveredId) excludes.
    return index.docs.filter((d: any) => classifyRaceTier(d.contest, d.office) <= 2);
  }, [index]);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const d of localDocs) if (d.date) set.add(d.date);
    return [...set].sort().reverse();
  }, [localDocs]);

  const [date, setDate] = useState("");
  useEffect(() => {
    if (!date && dates.length) setDate(dates[0]);
  }, [dates, date]);

  const states = useMemo(() => {
    const set = new Set<string>();
    for (const d of localDocs) if (d.province) set.add(d.province);
    return [...set].sort();
  }, [localDocs]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return localDocs
      .filter((d: any) => (date ? d.date === date : true))
      .filter((d: any) => (stateFilter ? d.province === stateFilter : true))
      .filter((d: any) => {
        if (!query) return true;
        const hay = `${d.contest} ${d.province} ${d.stateName} ${d.office}`.toLowerCase();
        return hay.includes(query);
      })
      .sort((a: any, b: any) => b.totalVotes - a.totalVotes)
      .slice(0, 120);
  }, [localDocs, date, stateFilter, q]);

  // Direct CivicAPI passthrough: fetch on load + a 30s refresh for the races
  // currently on screen. No storage, no snapshots — just the live JSON.
  useEffect(() => {
    const ids = filtered.slice(0, MAX_POLL).map((d: any) => d.id);
    pollIdsRef.current = ids;
    let alive = true;

    async function fetchAll() {
      await Promise.all(
        pollIdsRef.current.map(async (id) => {
          try {
            const res = await fetch(`${CIVIC_BASE}/api/v2/race/${id}`, { cache: "no-store" });
            if (!res.ok) return;
            const d = await res.json();
            if (alive) setLive((prev) => ({ ...prev, [id]: d }));
          } catch {}
        })
      );
    }
    fetchAll();
    const t = setInterval(fetchAll, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [filtered]);

  return (
    <div className="lb-wrap">
      <style>{LB_CSS}</style>
      <div className="lb-header">
        <div className="lb-eyebrow">Local results desk</div>
        <h1>Local race board</h1>
        <p className="lb-intro">
          A compact scan of reported results for contests that do not receive forecasting, county
          modeling, or expanded analytical coverage.
        </p>
        <div className="lb-controls">
          <input
            className="lb-search"
            placeholder="Search jurisdiction, office, or candidate…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select className="lb-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="">All states</option>
            {states.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select className="lb-select" value={date} onChange={(e) => setDate(e.target.value)}>
            {dates.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      </div>
      {!index ? (
        <div className="lb-empty">Loading local races…</div>
      ) : filtered.length === 0 ? (
        <div className="lb-empty">No local races match this filter.</div>
      ) : (
        <section className="lb-board">
          {filtered.map((d: any) => {
            const race = live[d.id] || d.race;
            return <LocalCard key={d.id} race={{ ...race, id: d.id, province: d.province }} />;
          })}
        </section>
      )}
    </div>
  );
}

const LB_CSS = `
.lb-wrap{max-width:1280px;margin:0 auto;padding:34px 24px 56px;color:var(--ink);}
.lb-eyebrow{font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-mute);}
.lb-header h1{font-size:31px;line-height:1.05;margin:8px 0 8px;letter-spacing:-.035em;}
.lb-intro{max-width:680px;margin:0 0 20px;color:var(--ink-mute);font-size:13px;line-height:1.55;}
.lb-controls{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:22px;}
.lb-search{flex:1;min-width:220px;padding:10px 12px;border:1px solid var(--rule);border-radius:8px;background:var(--wash);color:var(--ink);font-size:13px;}
.lb-select{padding:10px 12px;border:1px solid var(--rule);border-radius:8px;background:var(--wash);color:var(--ink);font-size:13px;}
.lb-empty{padding:40px 0;color:var(--ink-mute);font-size:13px;text-align:center;}
.lb-board{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;}
.lb-card{background:var(--page);border:1px solid var(--rule);border-radius:12px;overflow:hidden;}
.lb-head{padding:14px 15px 11px;border-bottom:1px solid var(--rule);}
.lb-kicker{display:flex;justify-content:space-between;gap:10px;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-mute);font-weight:750;}
.lb-head h2{font-size:15px;margin:7px 0 2px;letter-spacing:-.015em;}
.lb-status{font-size:10px;color:#15866b;font-weight:750;}
.lb-cands{padding:7px 15px 10px;}
.lb-cand{display:grid;grid-template-columns:5px 1fr auto;gap:9px;align-items:center;padding:9px 0;border-bottom:1px solid var(--rule-soft);}
.lb-cand:last-child{border-bottom:0;}
.lb-swatch{width:4px;height:29px;border-radius:4px;}
.lb-name strong{display:block;font-size:11px;}
.lb-name small{font-size:9px;color:var(--ink-mute);}
.lb-result{text-align:right;}
.lb-result strong{display:block;font-size:15px;letter-spacing:-.03em;}
.lb-result small{font-size:9px;color:var(--ink-mute);}
.lb-foot{display:flex;justify-content:space-between;gap:10px;padding:9px 15px;background:var(--wash);font-size:9px;color:var(--ink-mute);}
.lb-leader{color:var(--ink);font-weight:750;}
@media(max-width:950px){.lb-board{grid-template-columns:repeat(2,minmax(0,1fr));}}
@media(max-width:560px){.lb-board{grid-template-columns:1fr;}.lb-wrap{padding:26px 14px;}}
`;
