"use client";

/* =============================================================================
   PrimaryAverage: the page body for a same party primary tracked outside the
   averages engine (Florida governor GOP, Texas Senate GOP and Democratic, Maine
   Senate Democratic). Each primary page passes its polls and, once the votes are
   in, the result; this renders the OnPoint inner template around them: header,
   chart, the average against the result, the poll table with the average pinned,
   and the side cards.

   Candidates in one primary share a party, so they are told apart by shades of
   that party's color (vivid, pale, deep, dusty) in order of the current average.
============================================================================= */

import React, { useMemo, useState } from "react";
import Link from "next/link";
import MultiCandidateChart from "@/app/components/MultiCandidateChart";
import type { MultiDaily, MultiPollPoint, MultiSeries } from "@/app/_polling/lib/aggregates";
import { buildDailyWeightedSeries, getCandidateList, getDateRange, getPollsterEntry, type Poll } from "@/app/_polling/lib/buildDailyModel";

export type PrimaryResult = {
  /** Candidate to share of the vote, in percent. */
  results: Record<string, number>;
  date: string;          // ISO election day
  votes: string;         // total votes counted, display text
  reporting: string;     // "More than 95% reporting"
  source: string;        // one sentence on where the returns come from
};

export type PrimaryConfig = {
  state: string;                 // "Texas"
  office: "Senate" | "Governor";
  party: "R" | "D";
  polls: Poll[];
  crumb: string;                 // "Texas Senate"
  result?: PrimaryResult;
  forecastHref?: string;         // the general election forecast page
  generalHref?: string;          // the general election polling average
  note?: string;                 // extra methodology sentence
};

const PALETTE: Record<"R" | "D", string[]> = {
  R: ["#ff3b5c", "#ffb3c0", "#b0163a", "#d9798a", "#ff8399"],
  D: ["#3d7bff", "#a6c2ff", "#1a3fb0", "#7d93c9", "#7fa6ff"],
};
const DAY_MS = 86400000;
const round1 = (n: number) => Math.round(n * 10) / 10;
const ts = (iso: string) => new Date(iso + "T00:00:00").getTime();
const fmtIso = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", opts);
const pct = (n: number) => (Number.isFinite(n) && n > 0 ? `${n}%` : "");

export default function PrimaryAverage({ cfg }: { cfg: PrimaryConfig }) {
  const { state, office, party, polls, result } = cfg;
  const partyWord = party === "R" ? "Republican" : "Democratic";
  const [showAll, setShowAll] = useState(false);

  const model = useMemo(() => {
    const keys = getCandidateList(polls).sort((a, b) => a.localeCompare(b));
    const range = getDateRange(polls);
    const rows = buildDailyWeightedSeries(polls, keys, range.start, range.end);
    const lastRow = rows[rows.length - 1];
    const latest: Record<string, number> = {};
    for (const k of keys) latest[k] = lastRow ? round1(Number(lastRow[k] ?? 0)) : 0;
    // order candidates by the current average; colors follow that order
    const ordered = keys.slice().sort((a, b) => latest[b] - latest[a]);
    const series: MultiSeries[] = ordered.map((k, i) => ({ key: k, label: k, color: PALETTE[party][i % PALETTE[party].length] }));
    const daily: MultiDaily[] = rows.map((r) => ({ date: r.date, t: ts(r.date), v: ordered.map((k) => round1(Number(r[k] ?? 0))) }));
    const points: MultiPollPoint[] = polls.map((p) => ({
      pollster: p.pollster.replace(/\*\*/g, "").trim(),
      date: p.endDate,
      t: ts(p.endDate),
      v: ordered.map((k) => { const v = Number(p.results[k]); return Number.isFinite(v) && v > 0 ? v : NaN; }),
      sampleSize: p.sampleSize,
      sampleType: p.sampleType,
      grade: getPollsterEntry(p.pollster).grade,
    }));
    return { series, daily, points, latest, updated: lastRow ? String(lastRow.date) : null };
  }, [polls, party]);

  const { series, daily, points, latest, updated } = model;
  const color = (k: string) => series.find((s) => s.key === k)?.color ?? "var(--mute)";
  const leader = series[0];
  const runner = series[1];

  const sorted = useMemo(() => [...polls].sort((a, b) => (a.endDate < b.endDate ? 1 : a.endDate > b.endDate ? -1 : 0)), [polls]);
  const shown = showAll ? sorted : sorted.slice(0, 15);
  const internal = polls.filter((p) => p.pollster.includes("**")).length;
  const pollsters = new Set(polls.map((p) => p.pollster.replace(/\*\*/g, "").trim())).size;

  // the average against the result
  const acc = useMemo(() => {
    if (!result) return null;
    const rows = Object.entries(result.results).map(([name, actual]) => {
      const avg = latest[name] ?? 0;
      return { name, avg: round1(avg), actual, error: round1(avg - actual) };
    }).sort((a, b) => b.actual - a.actual);
    const mae = round1(rows.reduce((s, r) => s + Math.abs(r.error), 0) / rows.length);
    const winner = rows[0]?.name, second = rows[1]?.name;
    const correct = leader?.key === winner;
    const actualMargin = winner && second ? round1(result.results[winner] - result.results[second]) : 0;
    const avgMargin = winner && second ? round1((latest[winner] ?? 0) - (latest[second] ?? 0)) : 0;
    return { rows, mae, winner, second, correct, actualMargin, avgMargin };
  }, [result, latest, leader]);

  const lede = result && acc
    ? `${acc.winner} won the ${fmtIso(result.date, { month: "long", day: "numeric", year: "numeric" })} primary with ${result.results[acc.winner!].toFixed(1)} percent. The final OnPoint average of ${polls.length} public polls had ${leader.label} ahead at ${latest[leader.key].toFixed(1)} percent.`
    : `${leader?.label} leads the field at ${latest[leader?.key ?? ""]?.toFixed(1)} percent in the OnPoint average of ${polls.length} public polls, weighted by recency, sample size and voter screen.`;

  return (
    <div className="opp pp">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span>
        <Link href="/polls">Primaries</Link><span className="sep">/</span><span>{cfg.crumb}</span>
      </nav>
      <header className="ph">
        <div className="eye g">2026 {partyWord} primary</div>
        <h1>{state} {office === "Senate" ? "Senate" : "governor"} {partyWord} primary <em>average</em></h1>
        <p className="lede">{lede}</p>
        <div className="pmeta">
          <span><b className="mono">{polls.length}</b> polls</span>
          {updated && <span>Last poll <b>{fmtIso(updated)}</b></span>}
          {result && <span>Primary <b>{fmtIso(result.date)}</b></span>}
          {result && <span className="pill pp-called">Result in</span>}
        </div>
      </header>

      <div className="layout">
        <div className="pp-main">
          <section className="card">
            <div className="card-h"><h3>Average over time</h3><span className="eye" style={{ marginLeft: "auto" }}>Each dot is one poll</span></div>
            <div className="card-b">
              <MultiCandidateChart animKey={`${state}-${office}-${party}`} daily={daily} polls={points} series={series} unit="%" />
            </div>
          </section>

          {result && acc && (
            <section className="card">
              <div className="card-h">
                <h3>The average against the result</h3>
                <span className={`pill ${acc.correct ? "pp-called" : "pp-miss"}`} style={{ marginLeft: "auto" }}>{acc.correct ? "Winner called" : "Winner missed"}</span>
              </div>
              <div className="tblwrap">
                <table className="tbl pp-tbl">
                  <thead><tr><th>Candidate</th><th className="n">Average</th><th className="n">Result</th><th className="n">Error</th><th style={{ width: "34%" }}>Average and result</th></tr></thead>
                  <tbody>
                    {acc.rows.map((r) => (
                      <tr key={r.name}>
                        <td><span className="pp-sw" style={{ background: color(r.name) }} />{r.name}</td>
                        <td className="n">{r.avg.toFixed(1)}%</td>
                        <td className="n" style={{ color: "var(--hi)", fontWeight: 700 }}>{r.actual.toFixed(2)}%</td>
                        <td className="n" style={{ color: Math.abs(r.error) <= 2 ? "var(--win)" : "var(--ink)" }}>{r.error > 0 ? "+" : r.error < 0 ? "−" : ""}{Math.abs(r.error).toFixed(1)}</td>
                        <td>
                          <div className="pp-cmp" aria-label={`Average ${r.avg.toFixed(1)}, result ${r.actual.toFixed(2)}`}>
                            <i style={{ width: `${Math.min(100, (r.actual / 60) * 100)}%`, background: color(r.name) }} />
                            <b style={{ left: `${Math.min(100, (r.avg / 60) * 100)}%` }} />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pp-stats">
                <div><span>Winner</span><b>{acc.winner}</b></div>
                <div><span>Mean absolute error</span><b>{acc.mae.toFixed(1)} pts</b></div>
                <div><span>Result margin</span><b>{acc.winner} +{acc.actualMargin.toFixed(2)}</b></div>
                <div><span>Average margin</span><b>{acc.avgMargin >= 0 ? `${acc.winner} +${acc.avgMargin.toFixed(1)}` : `${acc.second} +${Math.abs(acc.avgMargin).toFixed(1)}`}</b></div>
              </div>
              <p className="pp-foot">Bars show the result; the white tick marks the final average. {result.reporting}. {result.source}</p>
            </section>
          )}

          <section className="card">
            <div className="card-h">
              <h3>All polls</h3><span className="eye">{polls.length} polls</span>
              {internal > 0 && <span className="eye" style={{ marginLeft: "auto" }}><span className="pp-int">Internal</span> partisan or internal poll</span>}
            </div>
            <div className="tblwrap">
              <table className="tbl pp-tbl">
                <thead>
                  <tr>
                    <th>Pollster</th><th className="n">End date</th><th className="n">Sample</th>
                    {series.map((s) => <th key={s.key} className="n"><span className="pp-sw" style={{ background: s.color }} />{s.label}</th>)}
                    <th className="n">Spread</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="avg">
                    <td>OnPoint average</td><td className="n">{updated ? fmtIso(updated) : ""}</td><td className="n">{polls.length} polls</td>
                    {series.map((s) => <td key={s.key} className="n">{latest[s.key].toFixed(1)}%</td>)}
                    <td className="n">{leader && runner ? `${leader.label} +${(latest[leader.key] - latest[runner.key]).toFixed(1)}` : ""}</td>
                  </tr>
                  {result && acc && (
                    <tr className="avg pp-res">
                      <td>Result <span className="pp-int" style={{ color: "var(--win)", borderColor: "rgba(61,220,151,.4)" }}>{result.reporting}</span></td>
                      <td className="n">{fmtIso(result.date)}</td><td className="n">{result.votes} votes</td>
                      {series.map((s) => <td key={s.key} className="n">{result.results[s.key] != null ? `${result.results[s.key].toFixed(2)}%` : ""}</td>)}
                      <td className="n">{acc.winner} +{acc.actualMargin.toFixed(2)}</td>
                    </tr>
                  )}
                  {shown.map((p, i) => {
                    const vals = series.map((s) => Number(p.results[s.key] ?? 0));
                    const listed = vals.filter((v) => v > 0).sort((a, b) => b - a);
                    const top = listed[0] ?? 0, second = listed[1] ?? 0;
                    const topName = series[vals.indexOf(top)]?.label ?? "";
                    const partisan = p.pollster.includes("**");
                    return (
                      <tr key={`${p.pollster}-${p.endDate}-${i}`}>
                        <td className="pp-who">{p.pollster.replace(/\*\*/g, "")}{partisan && <span className="pp-int">Internal</span>}</td>
                        <td className="n">{fmtIso(p.endDate)}</td>
                        <td className="n">{p.sampleSize > 0 ? p.sampleSize.toLocaleString("en-US") : "n/a"}<span className="pp-type">{p.sampleType}</span></td>
                        {vals.map((v, ci) => <td key={series[ci].key} className="n" style={v === top && v > 0 ? { color: "var(--hi)", fontWeight: 700 } : { color: "var(--ink2)" }}>{pct(v)}</td>)}
                        <td className="n" style={{ fontWeight: 700 }}>{top > 0 ? `${topName} +${round1(top - second).toFixed(1)}` : ""}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {sorted.length > 15 && (
              <div className="pp-fold"><button type="button" className="btn sm" onClick={() => setShowAll((s) => !s)}>{showAll ? "Show the latest fifteen" : `Show all ${sorted.length} polls`}</button></div>
            )}
          </section>
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>{result ? "Final average" : "Current average"}</h3><span className="eye" style={{ marginLeft: "auto" }}>OnPoint</span></div>
            <div className="stat">
              <div className="k">Leader</div>
              <div className="v" style={{ color: party === "R" ? "var(--gop2)" : "var(--dem2)" }}>{leader ? `${leader.label} ${latest[leader.key].toFixed(1)}%` : "No polls"}</div>
            </div>
            <div className="stat">
              <div className="k">The field</div>
              {series.map((s) => (
                <div className="cand" key={s.key}><i style={{ background: s.color }} /><span>{s.label}</span><span className="p">{latest[s.key].toFixed(1)}%</span></div>
              ))}
            </div>
            <div className="stat">
              <div className="k">The numbers</div>
              <div className="kv"><span>Polls in the average</span><span>{polls.length}</span></div>
              <div className="kv"><span>Pollsters</span><span>{pollsters}</span></div>
              {internal > 0 && <div className="kv"><span>Internal polls</span><span>{internal}</span></div>}
              {updated && <div className="kv"><span>Polling window</span><span>{Math.round((ts(updated) - ts(getDateRange(polls).start)) / DAY_MS)} days</span></div>}
            </div>
          </div>

          {result && acc && (
            <div className="card">
              <div className="card-h"><h3>Result</h3><span className="eye" style={{ marginLeft: "auto" }}>{fmtIso(result.date, { month: "short", day: "numeric" })}</span></div>
              <div className="card-b">
                {acc.rows.map((r, i) => (
                  <div className="res-row" key={r.name}>
                    <i style={{ background: color(r.name) }} />
                    <span>{r.name}{i === 0 && <b className="chk" aria-label="winner">&#10003;</b>}</span>
                    <span className="pct">{r.actual.toFixed(1)}%</span>
                    <span className="votes" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {(cfg.forecastHref || cfg.generalHref) && (
            <div className="card">
              <div className="card-h"><h3>The general election</h3></div>
              <div className="card-b pp-links">
                {cfg.generalHref && <Link className="btn sm" href={cfg.generalHref}>General election polling average</Link>}
                {cfg.forecastHref && <Link className="btn sm" href={cfg.forecastHref}>{state} {office === "Senate" ? "Senate" : "governor"} forecast</Link>}
              </div>
            </div>
          )}

          <div className="callout">
            <div className="eye">Methodology</div>
            The OnPoint average is rebuilt daily from every public poll, with recency decay, a square root sample size adjustment and voter screen weighting. Polls marked internal are partisan or sponsored and may carry less weight. A candidate left off a poll is left out of that poll&apos;s spread.{cfg.note ? ` ${cfg.note}` : ""} <Link href="/tpsi/methodology" style={{ textDecoration: "underline" }}>How the average works</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.pp .pp-main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; min-width: 0; }
.pp .pp-main > * { min-width: 0; }
.pp .pp-tbl { min-width: 620px; }
.pp .pp-tbl th.n { text-align: right; }
.pp .pp-tbl td { white-space: nowrap; }
.pp .pp-who { color: var(--ink); font-weight: 600; white-space: normal !important; min-width: 170px; }
.pp .pp-type { color: var(--mute); margin-left: 6px; }
.pp .pp-sw { display: inline-block; width: 9px; height: 9px; border-radius: 3px; margin-right: 7px; vertical-align: 0; }
.pp .pp-int { display: inline-block; margin-left: 8px; padding: 1px 6px; border: 1px solid var(--line2); border-radius: 5px; font: 700 9.5px var(--font-m); letter-spacing: .08em; text-transform: uppercase; color: var(--mute); vertical-align: 1px; }
.pp .pp-res td { background: rgba(61,220,151,.06); }
.pp .pill.pp-called { background: rgba(61,220,151,.16); color: var(--win); }
.pp .pill.pp-miss { background: var(--glass2); color: var(--ink2); }
.pp .pp-cmp { position: relative; height: 8px; border-radius: 99px; background: rgba(var(--line-rgb),.06); }
.pp .pp-cmp i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 99px; opacity: .75; }
.pp .pp-cmp b { position: absolute; top: -4px; bottom: -4px; width: 2px; margin-left: -1px; background: var(--hi); border-radius: 1px; }
.pp .pp-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-top: 1px solid var(--line); }
.pp .pp-stats div { padding: 12px 18px; display: grid; gap: 4px; border-left: 1px solid var(--line); }
.pp .pp-stats div:first-child { border-left: 0; }
.pp .pp-stats span { font: 700 10.5px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--mute); }
.pp .pp-stats b { font: 700 15px var(--font-m); color: var(--ink); font-variant-numeric: tabular-nums; }
@media (max-width: 700px) { .pp .pp-stats { grid-template-columns: 1fr 1fr; } .pp .pp-stats div:nth-child(3) { border-left: 0; } }
.pp .pp-foot { margin: 0; padding: 10px 18px 14px; border-top: 1px solid var(--line); font-size: 12.5px; color: var(--mute); }
.pp .pp-fold { display: flex; justify-content: center; padding: 14px; }
.pp .pp-links { display: grid; gap: 8px; justify-items: start; }
.pp .res-row { grid-template-columns: 14px 1fr 64px 0; }
`;
