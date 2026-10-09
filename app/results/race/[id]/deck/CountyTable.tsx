"use client";

// CO-04 §3 Zone 5 / §0.3 — Results by County: searchable + sortable table.
// Two variants of ONE component (§0.3): countyModel:true adds the
// PROJ. MARGIN column (uniform-swing projection off the statewide needle);
// countyModel:false omits it entirely — never a mixed table with "—" cells.

import React, { useEffect, useMemo, useState } from "react";
import { fetchRace, candColor, tonePalette } from "../../../onpoint/electionLib.js";
import type { NeedleProjection } from "../../../components/needleModel";

const fmtInt = (n: number) => Math.round(Number(n) || 0).toLocaleString("en-US");

type SortKey = "total" | "reporting" | "az" | "margin";

interface CountyRow {
  name: string;
  reporting: number;
  total: number;
  leaderName: string;
  leaderColor: string;
  leaderPct: number;
  marginPp: number; // leader minus runner-up, this county's reported figures
}

export default function CountyTable({
  race,
  countyModel,
  needle,
}: {
  race: any;
  countyModel: boolean;
  needle: NeedleProjection | null;
}) {
  const [rows, setRows] = useState<CountyRow[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<SortKey>("total");

  useEffect(() => {
    let alive = true;
    const ac = new AbortController();
    (async () => {
      try {
        const detail = await fetchRace(race.id, ac.signal);
        if (!alive) return;
        const rr = detail?.region_results || {};
        const out: CountyRow[] = Object.keys(rr).map((k) => {
          const r = rr[k];
          const cs = [...(Array.isArray(r?.candidates) ? r.candidates : [])].sort(
            (a: any, b: any) => (b.votes || 0) - (a.votes || 0)
          );
          const tones = tonePalette(cs) as string[];
          const total = cs.reduce((s, c: any) => s + (Number(c.votes) || 0), 0);
          const leader = cs[0];
          const margin = (Number(leader?.percent) || 0) - (Number(cs[1]?.percent) || 0);
          return {
            name: r?.name || k,
            reporting: Math.max(0, Math.min(100, Number(r?.percent_reporting) || 0)),
            total,
            leaderName: leader?.name || "—",
            leaderColor: leader ? tones[0] || candColor(leader) : "var(--ink-dim)",
            leaderPct: Number(leader?.percent) || 0,
            marginPp: margin,
          };
        });
        setRows(out);
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      ac.abort();
    };
  }, [race?.id]);

  // Uniform-swing PROJ. MARGIN: apply the statewide projected-vs-current
  // margin shift to each county's own reported margin. No per-county model
  // exists yet, so this is the standard "swingometer" approximation used
  // when only a statewide forecast is available.
  const swingPp = needle ? needle.marginPp - needle.currentMarginPp : 0;

  const filtered = useMemo(() => {
    if (!rows) return [];
    const query = q.trim().toLowerCase();
    const list = query ? rows.filter((r) => r.name.toLowerCase().includes(query)) : rows;
    const sorted = [...list];
    if (sort === "total") sorted.sort((a, b) => b.total - a.total);
    else if (sort === "reporting") sorted.sort((a, b) => b.reporting - a.reporting);
    else if (sort === "az") sorted.sort((a, b) => a.name.localeCompare(b.name));
    else if (sort === "margin") sorted.sort((a, b) => Math.abs(b.marginPp) - Math.abs(a.marginPp));
    return sorted;
  }, [rows, q, sort]);

  if (failed || (rows && rows.length === 0)) return null;

  return (
    <div className="rd-county">
      <span className="rd-county-h">results by county</span>
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
            ["total", "total"],
            ["reporting", "reporting"],
            ["az", "a–z"],
            ["margin", "margin"],
          ] as [SortKey, string][]).map(([key, label]) => (
            <button key={key} type="button" className={sort === key ? "on" : ""} onClick={() => setSort(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="rd-county-tablewrap">
        <table className="rd-county-table">
          <thead>
            <tr>
              <th>county</th>
              <th>leader</th>
              <th className="num">reporting</th>
              <th className="num">total votes</th>
              <th className="num">margin</th>
              {countyModel ? <th className="num">proj. margin</th> : null}
            </tr>
          </thead>
          <tbody>
            {!rows ? (
              <tr>
                <td colSpan={countyModel ? 6 : 5} className="rd-county-loading">
                  loading counties…
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={countyModel ? 6 : 5} className="rd-county-loading">
                  no counties match “{q}”.
                </td>
              </tr>
            ) : (
              filtered.map((r) => {
                const proj = countyModel ? r.marginPp + swingPp : null;
                return (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>
                      <span className="rd-county-leader">
                        <i style={{ background: r.leaderColor }} aria-hidden />
                        {r.leaderName}
                        <b>{r.leaderPct.toFixed(1)}%</b>
                      </span>
                    </td>
                    <td className="num">{Math.round(r.reporting)}%</td>
                    <td className="num">{fmtInt(r.total)}</td>
                    <td className="num">{r.marginPp >= 0 ? "+" : ""}{r.marginPp.toFixed(1)}</td>
                    {countyModel ? (
                      <td className="num rd-county-proj">
                        {proj != null ? `${proj >= 0 ? "+" : ""}${proj.toFixed(1)}` : "—"}
                      </td>
                    ) : null}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
