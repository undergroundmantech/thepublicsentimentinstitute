"use client";
// Every member of Congress on one sortable, filterable board. Index columns first, the ideological scorecards
// after a divider so they read as context, never as part of the score.
import React, { useMemo, useState } from "react";
import Link from "next/link";

export type Row = {
  slug: string; name: string; last: string; ch: "S" | "H"; st: string; seat: string; party: "D" | "R" | "I";
  index: number | null; grade: string | null; rank: number | null; cov: number; parts: Partial<Record<"lobby" | "pac" | "trading" | "cross", number>>; imputed: string[];
  lobby: number | null; lobbyNote: string | null; pacShare: number | null; trades: number; vol: number | null;
  cross: number | null; sL: number | null; sR: number | null;
};
type Key = "index" | "name" | "lobby" | "pacShare" | "trades" | "cross" | "sL" | "sR" | "st";
const PK = ["lobby", "pac", "trading", "cross"] as const;
/** The four part scores as one bar: each segment's length is the part score. */
export function PartBar({ parts, imputed }: { parts: Row["parts"]; imputed?: string[] }) {
  return <span className="ax-pb" aria-hidden="true">{PK.map((k) => <i key={k} className={`p-${k}${imputed?.includes(k) ? " imp" : ""}`}><u style={{ width: `${parts[k] ?? 0}%` }} /></i>)}</span>;
}
const AFF_ORDER: Record<string, number> = { "A+": 13, A: 12, "A-": 11, "B+": 10, B: 9, "B-": 8, "C+": 7, C: 6, "C-": 5, "D+": 4, D: 3, "D-": 2, F: 1, Ungraded: 0 };

export const fmtMoney = (n: number | null) => n == null ? "" : n >= 1e6 ? `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`;

export function Grade({ g, big }: { g: string | null; big?: boolean }) {
  return <span className={`ax-g g-${g ?? "na"}${big ? " big" : ""}`}>{g ?? "Not rated"}</span>;
}
export function Meter({ v }: { v: number | null }) {
  return <span className="ax-meter" aria-hidden="true"><i style={{ width: `${v ?? 0}%` }} /></span>;
}

export default function AxTable({ rows, states }: { rows: Row[]; states: string[] }) {
  const [q, setQ] = useState("");
  const [ch, setCh] = useState<"all" | "S" | "H">("all");
  const [party, setParty] = useState<"all" | "D" | "R" | "I">("all");
  const [st, setSt] = useState("all");
  const [grade, setGrade] = useState("all");
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "index", dir: -1 });
  const [n, setN] = useState(60);

  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    let r = rows.filter((x) => (ch === "all" || x.ch === ch) && (party === "all" || x.party === party) && (st === "all" || x.st === st) && (grade === "all" || x.grade === grade) && (!t || x.name.toLowerCase().includes(t) || x.seat.toLowerCase().includes(t)));
    const val = (x: Row): number | string | null => sort.k === "name" ? x.last : sort.k === "st" ? x.seat : false ? null : (x as unknown as Record<string, number | null>)[sort.k];
    r = [...r].sort((a, b) => {
      const A = val(a), B = val(b);
      if (A == null && B == null) return 0; if (A == null) return 1; if (B == null) return -1;
      return (typeof A === "string" ? A.localeCompare(B as string) : (A as number) - (B as number)) * sort.dir;
    });
    return r;
  }, [rows, q, ch, party, st, grade, sort]);

  const th = (k: Key, label: string, title?: string, first: 1 | -1 = -1) => (
    <th scope="col" aria-sort={sort.k === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"} title={title}>
      <button onClick={() => setSort((s) => (s.k === k ? { k, dir: (s.dir * -1) as 1 | -1 } : { k, dir: first }))}>{label}{sort.k === k ? <i className={sort.dir === 1 ? "up" : "dn"} /> : null}</button>
    </th>
  );

  return (
    <section className="ax-board" aria-labelledby="ax-board-h">
      <div className="ax-sec-h"><h2 id="ax-board-h">Every member of Congress</h2><span className="eye">{list.length} of {rows.length} shown</span></div>
      <div className="ax-filters">
        <label className="ax-search"><span className="sr">Search members</span><input id="ax-q" type="search" placeholder="Search a name or seat, like TX-23" value={q} onChange={(e) => { setQ(e.target.value); setN(60); }} /></label>
        <div className="ax-seg" role="group" aria-label="Chamber">{([["all", "Both chambers"], ["S", "Senate"], ["H", "House"]] as const).map(([k, l]) => <button key={k} aria-pressed={ch === k} onClick={() => setCh(k)}>{l}</button>)}</div>
        <div className="ax-seg" role="group" aria-label="Party">{([["all", "Every party"], ["D", "Democrats"], ["R", "Republicans"], ["I", "Independents"]] as const).map(([k, l]) => <button key={k} aria-pressed={party === k} onClick={() => setParty(k)}>{l}</button>)}</div>
        <div className="ax-seg" role="group" aria-label="Grade">{["all", "A", "B", "C", "D", "F"].map((g) => <button key={g} aria-pressed={grade === g} onClick={() => setGrade(g)}>{g === "all" ? "Every grade" : g}</button>)}</div>
        <label className="ax-sel"><span className="sr">State</span><select id="ax-st" value={st} onChange={(e) => setSt(e.target.value)}><option value="all">Every state</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
      </div>
      <div className="ax-tw">
        <table className="ax-t">
          <thead>
            <tr className="grp"><th colSpan={3} /><th colSpan={5} className="g1">The index and what goes into it</th><th colSpan={2} className="g2">The eight scorecards, rescaled</th></tr>
            <tr>
              <th scope="col" className="rk">Rank</th>
              {th("name", "Member", undefined, 1)}
              {th("st", "Seat", undefined, 1)}
              {th("index", "Index", "0 to 100, higher is more independent")}
              {th("lobby", "Lobby money", "TrackAIPAC career Israel Lobby Total")}
              {th("pacShare", "PAC share", "Share of this cycle's receipts from PACs and other committees")}
              {th("trades", "Trades", "Stock trades reported in the last year")}
              {th("cross", "Aisle", "Crossing the aisle: left and right scorecards, averaged so neither party starts ahead")}
              {th("sL", "Left cards", "LCV, ProgressivePunch, AFL-CIO and HRC, rescaled so the average Democrat is 100 and the average Republican 0")}
              {th("sR", "Right cards", "Heritage Action, CPAC, Club for Growth and America First Foundation, rescaled so the average Republican is 100 and the average Democrat 0")}
            </tr>
          </thead>
          <tbody>
            {list.slice(0, n).map((x) => (
              <tr key={x.slug}>
                <td className="rk">{x.rank ?? ""}</td>
                <td className="nm"><Link href={`/accountability/${x.slug}`}><span className={`pt p-${x.party}`}>{x.party}</span><b>{x.name}</b></Link></td>
                <td className="seat">{x.seat}</td>
                <td className="ix">{x.index != null ? <><b>{x.index.toFixed(1)}</b><Grade g={x.grade} /><PartBar parts={x.parts} imputed={x.imputed} /></> : <span className="na">Not enough data</span>}{x.imputed.length && x.index != null ? <em title="A measure is missing and takes the median">partial</em> : null}</td>
                <td className="num">{x.lobby == null ? <span className="na">{x.lobbyNote ?? "Not listed"}</span> : x.lobby === 0 ? "$0" : fmtMoney(x.lobby)}</td>
                <td className="num">{x.pacShare == null ? <span className="na">None filed</span> : `${Math.round(x.pacShare * 100)}%`}</td>
                <td className="num">{x.trades ? <>{x.trades.toLocaleString()}{x.vol ? <small>{fmtMoney(x.vol)}</small> : null}</> : <span className="na">None listed</span>}</td>
                <td className="num">{x.cross != null ? x.cross.toFixed(1) : <span className="na">None</span>}</td>
                <td className="sc">{x.sL != null ? Math.round(x.sL) : <span className="na">None</span>}</td>
                <td className="sc">{x.sR != null ? Math.round(x.sR) : <span className="na">None</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {list.length > n ? <button className="ax-more" onClick={() => setN(n + 120)}>Show {Math.min(120, list.length - n)} more of {list.length - n} left</button> : null}
      {!list.length ? <p className="ax-note">No member matches those filters.</p> : null}
    </section>
  );
}
