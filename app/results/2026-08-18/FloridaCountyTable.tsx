"use client";

// County-by-county board. FORECAST reads the TPSI baseline blended with the
// shrunk statewide swing (countyForecast.ts); RESULTS reads live CivicAPI
// county returns, which sit at zero until Florida reports below the statewide
// level.

import React, { useMemo, useState } from "react";
import {
  ALL_CANDIDATE_KEYS,
  CANDIDATE_ORDER,
  CANDIDATE_LAST,
  type CandidateKey,
} from "../_data/flCountyForecast";
import { CAND_CSS } from "./FloridaCountyMap";
import type { CountyProjection, LiveCounty } from "./countyForecast";

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

type SortKey = "turnout" | "az" | "margin" | CandidateKey;

interface Props {
  view: "forecast" | "results";
  counties: CountyProjection[];
  statewide: CountyProjection;
  liveCounties?: Record<string, LiveCounty>;
}

type Row = {
  c: CountyProjection;
  turnout: number;
  shares: Record<CandidateKey, number>;
  votes: Record<CandidateKey, number>;
  leader: CandidateKey;
  margin: number;
};

const EMPTY_SHARES = { donalds: 0, fishback: 0, collins: 0, renner: 0, other: 0 };

export default function FloridaCountyTable({ view, counties, statewide, liveCounties }: Props) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("turnout");

  const rows = useMemo<Row[]>(() => {
    const query = q.trim().toLowerCase();
    const list = query
      ? counties.filter((c) => c.name.toLowerCase().includes(query))
      : counties;

    return list
      .map((c): Row => {
        if (view !== "results") {
          return {
            c,
            turnout: c.projectedTurnout,
            shares: c.shares,
            votes: c.votes,
            leader: c.leader,
            margin: c.margin,
          };
        }
        const lc = liveCounties?.[c.name.toUpperCase()];
        const total = lc?.total ?? 0;
        const shares = total
          ? (Object.fromEntries(
              ALL_CANDIDATE_KEYS.map((k) => [k, ((lc!.votes[k] ?? 0) / total) * 100])
            ) as Record<CandidateKey, number>)
          : { ...EMPTY_SHARES };
        const ordered = CANDIDATE_ORDER.map((k) => [k, shares[k]] as [CandidateKey, number]).sort(
          (a, b) => b[1] - a[1]
        );
        return {
          c,
          turnout: total,
          shares,
          votes: (lc?.votes ?? { ...EMPTY_SHARES }) as Record<CandidateKey, number>,
          leader: ordered[0][0],
          margin: total ? ordered[0][1] - ordered[1][1] : 0,
        };
      })
      .sort((a, b) => {
        if (sort === "az") return a.c.name.localeCompare(b.c.name);
        if (sort === "margin") return b.margin - a.margin;
        if (sort === "turnout") return b.turnout - a.turnout || a.c.name.localeCompare(b.c.name);
        return b.shares[sort] - a.shares[sort];
      });
  }, [q, sort, view, counties, liveCounties]);

  const totals = useMemo<Row>(() => {
    if (view === "forecast") {
      return {
        c: statewide,
        turnout: statewide.projectedTurnout,
        shares: statewide.shares,
        votes: statewide.votes,
        leader: statewide.leader,
        margin: statewide.margin,
      };
    }
    const votes = { ...EMPTY_SHARES } as Record<CandidateKey, number>;
    let total = 0;
    for (const c of counties) {
      const lc = liveCounties?.[c.name.toUpperCase()];
      if (!lc) continue;
      total += lc.total;
      for (const k of ALL_CANDIDATE_KEYS) votes[k] += lc.votes[k] ?? 0;
    }
    const shares = (
      total
        ? Object.fromEntries(
            ALL_CANDIDATE_KEYS.map((k) => [k, (votes[k] / total) * 100])
          )
        : { ...EMPTY_SHARES }
    ) as Record<CandidateKey, number>;
    const ordered = CANDIDATE_ORDER.map((k) => [k, shares[k]] as [CandidateKey, number]).sort(
      (a, b) => b[1] - a[1]
    );
    return {
      c: statewide,
      turnout: total,
      shares,
      votes,
      leader: ordered[0][0],
      margin: total ? ordered[0][1] - ordered[1][1] : 0,
    };
  }, [view, counties, statewide, liveCounties]);

  // Turnout-weighted, so a finished Lafayette doesn't outweigh a lagging Miami-Dade.
  const statewideReporting = useMemo(() => {
    const w = counties.reduce((s, c) => s + c.projectedTurnout, 0);
    return w > 0
      ? counties.reduce((s, c) => s + c.reporting * c.projectedTurnout, 0) / w
      : 0;
  }, [counties]);

  const cell = (r: Row, k: CandidateKey) => (
    <td className="num" key={k}>
      <span className="rd-cand-cell">
        <b style={{ color: CAND_CSS[k] }}>{r.shares[k].toFixed(1)}%</b>
        <span className="rd-cand-votes">{fmtInt(r.votes[k])}</span>
      </span>
    </td>
  );

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
          {(
            [
              ["turnout", view === "results" ? "votes" : "turnout"],
              ["az", "a–z"],
              ["margin", "margin"],
              ...CANDIDATE_ORDER.map((k) => [k, CANDIDATE_LAST[k].toLowerCase()]),
            ] as [SortKey, string][]
          ).map(([key, label]) => (
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
        <table className="rd-county-table fl-county-table">
          <colgroup>
            <col style={{ width: "17%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "11%" }} />
            {CANDIDATE_ORDER.map((k) => (
              <col key={k} style={{ width: "14%" }} />
            ))}
            <col style={{ width: "6%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>county</th>
              <th className="num">reporting</th>
              <th className="num">{view === "results" ? "votes" : "turnout"}</th>
              {CANDIDATE_ORDER.map((k) => (
                <th className="num" key={k}>
                  {CANDIDATE_LAST[k].toLowerCase()}
                </th>
              ))}
              <th className="num">margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4 + CANDIDATE_ORDER.length} className="rd-county-loading">
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
                  {CANDIDATE_ORDER.map((k) => cell(r, k))}
                  <td className="num">
                    {r.turnout > 0 ? (
                      <span style={{ color: CAND_CSS[r.leader] }}>
                        +{r.margin.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 ? (
            <tfoot>
              <tr>
                <td className="rd-statewide-label">
                  <strong>Statewide</strong>
                  <small>{view === "forecast" ? "projected" : "counted"}</small>
                </td>
                <td className="num rd-statewide-dim">{statewideReporting.toFixed(0)}%</td>
                <td className="num rd-statewide-dim">{fmtInt(totals.turnout)}</td>
                {CANDIDATE_ORDER.map((k) => cell(totals, k))}
                <td className="num">
                  {totals.turnout > 0 ? (
                    <span className="rd-statewide-margin" style={{ color: CAND_CSS[totals.leader] }}>
                      {CANDIDATE_LAST[totals.leader]} +{totals.margin.toFixed(1)}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
