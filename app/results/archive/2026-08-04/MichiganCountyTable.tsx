"use client";

// County-by-county board. FORECAST reads the static DSMeridian model
// (_data/miCountyForecast.ts); RESULTS reads live CivicAPI county returns —
// Michigan reports this race statewide only until returns land, so those
// columns sit at zero rather than being hidden.

import React, { useMemo, useState } from "react";
import type { CountyProjection } from "./countyForecast";

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

type SortKey = "turnout" | "az" | "margin" | "elSayed" | "stevens";

export type LiveCounty = { elSayedVotes: number; stevensVotes: number; reporting: number };

interface Props {
  view: "forecast" | "results";
  /** Live-blended county projections from projectCounties(). */
  counties: CountyProjection[];
  statewide: CountyProjection;
  liveCounties?: Record<string, LiveCounty>;
}

export default function MichiganCountyTable({ view, counties, statewide, liveCounties }: Props) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("turnout");

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? counties.filter((c) => c.name.toLowerCase().includes(query))
      : counties;

    return [...list]
      .map((c) => {
        const lc = liveCounties?.[c.name.toUpperCase()];
        const el = lc?.elSayedVotes ?? 0;
        const st = lc?.stevensVotes ?? 0;
        const total = el + st;
        return view === "results"
          ? {
              c,
              turnout: total,
              elPct: total > 0 ? (el / total) * 100 : 0,
              stPct: total > 0 ? (st / total) * 100 : 0,
              elVotes: el,
              stVotes: st,
              margin: total > 0 ? ((el - st) / total) * 100 : 0,
            }
          : {
              c,
              turnout: c.projectedTurnout,
              elPct: c.elSayed,
              stPct: c.stevens,
              elVotes: c.elSayedVotes,
              stVotes: c.stevensVotes,
              margin: c.margin,
            };
      })
      .sort((a, b) => {
        if (sort === "az") return a.c.name.localeCompare(b.c.name);
        if (sort === "margin") return Math.abs(b.margin) - Math.abs(a.margin);
        if (sort === "elSayed") return b.elPct - a.elPct;
        if (sort === "stevens") return b.stPct - a.stPct;
        return b.turnout - a.turnout || a.c.name.localeCompare(b.c.name);
      });
  }, [q, sort, view, counties, liveCounties]);

  const totals = useMemo(() => {
    if (view === "forecast") {
      return {
        turnout: statewide.projectedTurnout,
        elPct: statewide.elSayed,
        stPct: statewide.stevens,
        elVotes: statewide.elSayedVotes,
        stVotes: statewide.stevensVotes,
        margin: statewide.margin,
      };
    }
    let elVotes = 0;
    let stVotes = 0;
    for (const c of counties) {
      const lc = liveCounties?.[c.name.toUpperCase()];
      elVotes += lc?.elSayedVotes ?? 0;
      stVotes += lc?.stevensVotes ?? 0;
    }
    const total = elVotes + stVotes;
    return {
      turnout: total,
      elPct: total > 0 ? (elVotes / total) * 100 : 0,
      stPct: total > 0 ? (stVotes / total) * 100 : 0,
      elVotes,
      stVotes,
      margin: total > 0 ? ((elVotes - stVotes) / total) * 100 : 0,
    };
  }, [view, counties, statewide, liveCounties]);

  // Turnout-weighted, so a finished Alcona doesn't outweigh a lagging Wayne.
  const statewideReporting = useMemo(() => {
    const w = counties.reduce((s, c) => s + c.projectedTurnout, 0);
    return w > 0
      ? counties.reduce((s, c) => s + c.reporting * c.projectedTurnout, 0) / w
      : 0;
  }, [counties]);

  return (
    <div className="rd-county">
      <div className="rd-county-tools">
        <div className="rd-county-search">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M21 21l-4.3-4.3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            placeholder="search counties…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="rd-county-sorts" role="group" aria-label="Sort counties">
          {([
            ["turnout", view === "results" ? "votes" : "turnout"],
            ["az", "a–z"],
            ["margin", "margin"],
            ["elSayed", "el-sayed"],
            ["stevens", "stevens"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={sort === key ? "on" : ""}
              onClick={() => setSort(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="rd-county-tablewrap">
        <table className="rd-county-table">
          <colgroup>
            <col style={{ width: "22%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "13%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>county</th>
              <th className="num">reporting</th>
              <th className="num">{view === "results" ? "votes" : "turnout"}</th>
              <th className="num">el-sayed</th>
              <th className="num">stevens</th>
              <th className="num">margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="rd-county-loading">
                  no counties match “{q}”.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.c.fips}>
                  <td>
                    {r.c.name}
                    {view === "forecast" && r.c.tooCloseToCall ? (
                      <i className="rd-cand-tcc" title="Too close to call" aria-hidden />
                    ) : null}
                  </td>
                  <td className="num">{r.c.reporting.toFixed(0)}%</td>
                  <td className="num">{fmtInt(r.turnout)}</td>
                  <td className="num">
                    <span className="rd-cand-cell">
                      <b style={{ color: "var(--dem)" }}>{r.elPct.toFixed(1)}%</b>
                      <span className="rd-cand-votes">{fmtInt(r.elVotes)}</span>
                    </span>
                  </td>
                  <td className="num">
                    <span className="rd-cand-cell">
                      <b style={{ color: "var(--c2)" }}>{r.stPct.toFixed(1)}%</b>
                      <span className="rd-cand-votes">{fmtInt(r.stVotes)}</span>
                    </span>
                  </td>
                  <td className="num">
                    {r.margin >= 0 ? "+" : "−"}
                    {Math.abs(r.margin).toFixed(1)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <td>statewide{view === "forecast" ? " (projected)" : ""}</td>
                <td className="num">{statewideReporting.toFixed(0)}%</td>
                <td className="num">{fmtInt(totals.turnout)}</td>
                <td className="num">
                  <span className="rd-cand-cell">
                    <b style={{ color: "var(--dem)" }}>{totals.elPct.toFixed(1)}%</b>
                    <span className="rd-cand-votes">{fmtInt(totals.elVotes)}</span>
                  </span>
                </td>
                <td className="num">
                  <span className="rd-cand-cell">
                    <b style={{ color: "var(--c2)" }}>{totals.stPct.toFixed(1)}%</b>
                    <span className="rd-cand-votes">{fmtInt(totals.stVotes)}</span>
                  </span>
                </td>
                <td className="num">
                  {totals.margin >= 0 ? "+" : "−"}
                  {Math.abs(totals.margin).toFixed(1)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
