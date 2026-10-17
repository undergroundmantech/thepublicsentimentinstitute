"use client";
import { useMemo, useState } from "react";
import Link from "next/link";

export type BoardMeasure = { id: string; st: string; state: string; href: string; label: string; title: string; group: string; groupLabel: string; yes: number; p10: number; p90: number; prob: number; threshold: number; polled: boolean };

const pct = (p: number) => (p > 0.99 ? ">99%" : p < 0.01 ? "<1%" : `${Math.round(p * 100)}%`);

function Bar({ m }: { m: BoardMeasure }) {
  const x = (v: number) => `${Math.max(0, Math.min(100, ((v - 20) / 60) * 100))}%`;
  return (
    <div className="bm-bar" title={`Yes ${m.yes.toFixed(1)}%, 80% range ${m.p10.toFixed(0)} to ${m.p90.toFixed(0)}, needs ${Math.round(m.threshold * 1000) / 10}%`}>
      <i style={{ width: x(m.yes) }} />
      <u style={{ left: x(m.p10), width: `calc(${x(m.p90)} - ${x(m.p10)})` }} />
      <s style={{ left: x(m.threshold * 100) }} />
    </div>
  );
}

export default function MeasuresBoard({ measures, groups }: { measures: BoardMeasure[]; groups: [string, string, number][] }) {
  const [g, setG] = useState<string>("all");
  const [q, setQ] = useState("");
  const [view, setView] = useState<"state" | "close">("state");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return measures.filter((m) => (g === "all" || m.group === g) && (!s || `${m.state} ${m.st} ${m.label} ${m.title}`.toLowerCase().includes(s)));
  }, [measures, g, q]);
  const byState = useMemo(() => {
    const out = new Map<string, BoardMeasure[]>();
    for (const m of list) { if (!out.has(m.state)) out.set(m.state, []); out.get(m.state)!.push(m); }
    return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const close = useMemo(() => [...list].sort((a, b) => Math.abs(a.prob - 0.5) - Math.abs(b.prob - 0.5)), [list]);
  const row = (m: BoardMeasure, showState = false) => (
    <Link key={m.id} href={m.href} className="bm-row">
      <div><div className="t1">{showState ? `${m.st} ` : ""}{m.label}</div><div className="t2">{m.title}{m.polled ? " · polled" : ""}</div></div>
      <Bar m={m} />
      <div className={`pp ${m.prob >= 0.6 ? "cy" : m.prob <= 0.4 ? "cn" : "ct"}`}>{pct(m.prob)}</div>
    </Link>
  );
  return (
    <>
      <div className="bm-filters" role="group" aria-label="Filter by subject">
        <button className={g === "all" ? "on" : ""} onClick={() => setG("all")}>All<span className="mono">{measures.length}</span></button>
        {groups.map(([k, label, n]) => <button key={k} className={g === k ? "on" : ""} onClick={() => setG(g === k ? "all" : k)}>{label}<span className="mono">{n}</span></button>)}
        <input id="bm-search" type="search" placeholder="Search a state or a measure" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search measures" />
        <div className="seg" style={{ marginLeft: 0 }}>
          <button className={view === "state" ? "on" : ""} onClick={() => setView("state")}>By state</button>
          <button className={view === "close" ? "on" : ""} onClick={() => setView("close")}>Closest first</button>
        </div>
      </div>
      {view === "state" ? (
        <div className="bm-states">
          {byState.map(([state, ms]) => (
            <div className="card bm-state" key={state}>
              <div className="card-h"><h3>{state}</h3><span className="eye" style={{ marginLeft: "auto" }}>{ms.length} {ms.length === 1 ? "measure" : "measures"} · chance to pass</span></div>
              {ms.map((m) => row(m))}
            </div>
          ))}
        </div>
      ) : (
        <div className="card bm-state">
          <div className="card-h"><h3>Closest calls</h3><span className="eye" style={{ marginLeft: "auto" }}>Chance to pass</span></div>
          {close.map((m) => row(m, true))}
        </div>
      )}
      {!list.length ? <div className="card" style={{ padding: 24, color: "var(--mute)" }}>No measures match.</div> : null}
    </>
  );
}
