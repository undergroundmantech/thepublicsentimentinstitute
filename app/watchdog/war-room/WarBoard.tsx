"use client";
// The War Room board: every Senate, governor and contested House race with both campaigns' health side by side.
// "Brief me as" turns the board around: pick the Democratic or the Republican side and every row reads as your
// candidate against theirs, with the edge in health and the odds from your chair.
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { WRow } from "./data";
import { OFFICE_NAME, healthTone, lead, pct, raceLabel, rating, surname, usd, warHref, winP } from "./fmt";
import { useLens, LensToggle } from "./lens";

type Sort = "close" | "edge" | "move" | "money" | "ev";
const SORTS: [Sort, string][] = [["close", "Closest"], ["edge", "Biggest health gap"], ["move", "Moved this week"], ["money", "Outside money"], ["ev", "Early vote shift"]];
const OFFICES: [string, string][] = [["all", "All races"], ["senate", "Senate"], ["governor", "Governor"], ["house", "House"]];
const LIMIT = 50;

export function HealthBar({ s, label, name, party, mine }: { s: number | null; label: string; name: string; party: string; mine?: boolean }) {
  return (
    <div className={`wr-hb ${party.toLowerCase()}${mine ? " mine" : ""}`}>
      <div className="wr-hb-t"><span className="nm">{name}</span><b className={`tone ${healthTone(s)}`}>{s == null ? "n/a" : s}</b></div>
      <div className="wr-hb-bar" role="img" aria-label={`${name} campaign health ${s == null ? "not enough data" : `${s} of 100, ${label}`}`}><i style={{ width: `${s ?? 0}%` }} /></div>
      <small>{label}</small>
    </div>
  );
}

export default function WarBoard({ rows }: { rows: WRow[] }) {
  const [side, setSide] = useLens();
  const [office, setOffice] = useState("all");
  const [close, setClose] = useState(true);
  const [sort, setSort] = useState<Sort>("close");
  const [q, setQ] = useState("");
  const [n, setN] = useState(LIMIT);
  useEffect(() => setN(LIMIT), [office, close, sort, q]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    const out = rows.filter((r) => (office === "all" || r.office === office) && (!close || (r.p > 0.1 && r.p < 0.9))
      && (!t || r.name.toLowerCase().includes(t) || r.dem.toLowerCase().includes(t) || r.gop.toLowerCase().includes(t) || r.st.toLowerCase() === t || raceLabel(r).toLowerCase() === t));
    const edge = (r: WRow) => (r.hD == null || r.hR == null ? -999 : side === "R" ? r.hR - r.hD : r.hD - r.hR);
    const key: Record<Sort, (r: WRow) => number> = {
      close: (r) => Math.abs(r.p - 0.5),
      edge: (r) => -Math.abs(edge(r) === -999 ? 0 : edge(r)),
      move: (r) => -Math.abs(r.d7 ?? 0),
      money: (r) => -(r.outside ?? 0),
      ev: (r) => -Math.abs(r.ev ?? 0),
    };
    return out.sort((a, b) => key[sort](a) - key[sort](b) || (a.office === "house" ? 1 : 0) - (b.office === "house" ? 1 : 0));
  }, [rows, office, close, sort, q, side]);
  return (
    <section className="wr-board card" aria-label="Every race">
      <div className="wr-tools">
        <LensToggle side={side} set={setSide} />
        <label className="wr-q" htmlFor="wr-q"><span className="sr">Find a race</span>
          <input id="wr-q" className="wd-input" placeholder="Find a race or candidate, like Ohio, Ossoff or PA-07" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      <div className="wr-tools">
        <div className="wd-chips" role="group" aria-label="Office">{OFFICES.map(([k, l]) => <button key={k} type="button" className={office === k ? "on" : ""} aria-pressed={office === k} onClick={() => setOffice(k)}>{l}</button>)}</div>
        <div className="wd-chips" role="group" aria-label="Competitiveness"><button type="button" className={close ? "on" : ""} aria-pressed={close} onClick={() => setClose((x) => !x)}>Competitive only</button></div>
        <label className="wr-sort" htmlFor="wr-sort">Sort
          <select id="wr-sort" className="wd-input" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        </label>
      </div>
      <div className="wr-count">{list.length} race{list.length === 1 ? "" : "s"} · {side === "N" ? "neutral view" : `read from the ${side === "D" ? "Democratic" : "Republican"} side`}</div>
      <ol className="wr-rows">
        {list.slice(0, n).map((r) => {
          const me: "D" | "R" = side === "R" ? "R" : "D";
          const A = { s: me === "D" ? r.hD : r.hR, l: me === "D" ? r.lD : r.lR, n: me === "D" ? r.dem : r.gop, p: me === "D" ? r.dP : "R" };
          const B = { s: me === "D" ? r.hR : r.hD, l: me === "D" ? r.lR : r.lD, n: me === "D" ? r.gop : r.dem, p: me === "D" ? "R" : r.dP };
          const gap = A.s != null && B.s != null ? A.s - B.s : null;
          const my = winP(r.p, me);
          return (
            <li key={r.id}>
              <Link href={warHref(r.id)} className="wr-row" data-ev="War Room race opened" data-ev-d={JSON.stringify({ id: r.id, from: "board" })}>
                <div className="wr-race">
                  <span className="k">{OFFICE_NAME[r.office]} · {r.st}</span>
                  <b>{raceLabel(r)}</b>
                  <span className={`wr-rate ${rating(r.p, r.dP).split(" ").pop()!.toLowerCase()}`}>{rating(r.p, r.dP)}</span>
                </div>
                <HealthBar s={A.s} label={A.l} name={surname(A.n)} party={A.p} mine={side !== "N"} />
                <HealthBar s={B.s} label={B.l} name={surname(B.n)} party={B.p} />
                <div className="wr-num">
                  <span className="k">Forecast</span><b>{lead(r.m, r.dP)}</b>
                  <small>{side === "N" ? `${surname(r.dem)} ${pct(1 - r.p)}` : `Your odds ${pct(my)}`}</small>
                </div>
                <div className="wr-num">
                  <span className="k">{side === "N" ? "Health gap" : "Your edge"}</span>
                  <b className={gap == null ? "" : side === "N" ? "" : gap >= 0 ? "up" : "down"}>{gap == null ? "n/a" : side === "N" ? `${Math.abs(gap)} pts ${gap >= 0 ? surname(r.dem) : surname(r.gop)}` : `${gap > 0 ? "+" : gap < 0 ? "−" : ""}${Math.abs(gap)}`}</b>
                  <small>{r.d7 == null ? "" : `7 days ${lead(r.d7, r.dP).replace("Even", "flat")}`}{r.ev ? ` · ballots ${lead(r.ev, r.dP)}` : ""}</small>
                </div>
                <div className="wr-num wr-hide-s">
                  <span className="k">Outside</span><b>{r.outside ? usd(r.outside) : "n/a"}</b>
                  <small>{r.files.length ? `${r.files.length} people file${r.files.length > 1 ? "s" : ""}` : ""}</small>
                </div>
              </Link>
            </li>
          );
        })}
        {!list.length ? <li className="wd-empty">No race matches. Try a state name, a last name or turn off Competitive only.</li> : null}
      </ol>
      {list.length > n ? <div className="pf-more"><button type="button" className="wd-btn" onClick={() => setN((x) => x + 100)}>Show {Math.min(100, list.length - n)} more</button></div> : null}
    </section>
  );
}
