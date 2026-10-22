"use client";

import { useMemo, useState } from "react";
import type { MediaPerson } from "../data";
import PersonToken from "../PersonToken";

const LEAN: Record<string, string> = { R: "Right", D: "Left", other: "Independent minded", nonpartisan: "Nonpartisan" };
const ROLE: Record<string, string> = { podcaster: "Podcaster", reporter: "Reporter", commentator: "Commentator", streamer: "Streamer", analyst: "Analyst", host: "Host" };
const party = (l: string) => (l === "R" ? "R" : l === "D" ? "D" : "O");

export default function MediaWatch({ people }: { people: MediaPerson[] }) {
  const [lean, setLean] = useState("all");
  const [role, setRole] = useState("all");
  const [st, setSt] = useState("");
  const [q, setQ] = useState("");
  const states = useMemo(() => [...new Set(people.flatMap((p) => p.items.map((i) => i.st)))].filter(Boolean).sort(), [people]);
  const roles = useMemo(() => [...new Set(people.map((p) => p.role))].filter(Boolean), [people]);
  const byRace = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of people) for (const i of p.items) m.set(i.race, (m.get(i.race) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [people]);
  const shown = people
    .filter((p) => (lean === "all" || (lean === "O" ? !["R", "D"].includes(p.lean) : p.lean === lean)) && (role === "all" || p.role === role))
    .map((p) => ({ ...p, items: p.items.filter((i) => (!st || i.st === st) && (!q || `${p.name} ${p.show ?? ""} ${i.race} ${i.what}`.toLowerCase().includes(q.toLowerCase()))) }))
    .filter((p) => p.items.length);

  return (
    <div className="mw">
      <section className="card mw-hot">
        <div className="card-h"><h3>The races getting the most airtime</h3></div>
        <div className="mw-hotrow">
          {byRace.map(([race, n]) => (
            <button key={race} type="button" className={`mw-hotb${q === race ? " on" : ""}`} onClick={() => setQ(q === race ? "" : race)}>
              <b>{race}</b><span className="wd-bar"><i style={{ width: `${(n / byRace[0][1]) * 100}%`, background: "linear-gradient(90deg,#e7b341,#ffd98a)" }} /></span><small className="mono">{n}</small>
            </button>
          ))}
        </div>
      </section>
      <div className="en-bar mw-bar">
        <div className="wd-chips" role="group" aria-label="Lean">
          {[["all", "Everyone"], ["R", "Right"], ["D", "Left"], ["O", "Other and nonpartisan"]].map(([k, l]) => <button key={k} type="button" className={lean === k ? "on" : ""} aria-pressed={lean === k} onClick={() => setLean(k)}>{l}</button>)}
        </div>
        <div className="wd-chips" role="group" aria-label="Kind">
          <button type="button" className={role === "all" ? "on" : ""} onClick={() => setRole("all")}>All kinds</button>
          {roles.map((r) => <button key={r} type="button" className={role === r ? "on" : ""} aria-pressed={role === r} onClick={() => setRole(r)}>{ROLE[r] ?? r}</button>)}
        </div>
        <select className="wd-input en-st-sel" value={st} onChange={(e) => setSt(e.target.value)} aria-label="State"><option value="">Every state</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select>
        <input className="wd-input en-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search a name, show or race" aria-label="Search media watch" />
      </div>
      <div className="mw-grid">
        {shown.map((p, k) => (
          <article key={p.name} className="card mw-card" style={{ animationDelay: `${Math.min(k, 16) * 0.035}s` }}>
            <div className="mw-h">
              <PersonToken ini={p.ini || p.name.slice(0, 2).toUpperCase()} party={party(p.lean)} role={p.role === "reporter" || p.role === "analyst" ? "reporter" : "surrogate"} size={46} />
              <div className="mw-id"><b>{p.name}</b><small>{ROLE[p.role] ?? p.role}{p.show ? ` · ${p.show}` : ""}</small></div>
              <span className={`wd-pill ${p.lean === "R" ? "r" : p.lean === "D" ? "d" : ""}`}>{LEAN[p.lean] ?? p.lean}</span>
            </div>
            <ol className="mw-items">
              {p.items.map((i, j) => (
                <li key={j}>
                  <span className="mw-when mono">{i.when ? i.when.slice(5).replace("-", "/") : ""}</span>
                  <div><span className="mw-race">{i.race}</span><p>{i.what}</p>{i.src ? <a href={i.src} target="_blank" rel="noreferrer">source</a> : null}</div>
                </li>
              ))}
            </ol>
          </article>
        ))}
        {!shown.length ? <div className="wd-empty">Nothing matches those filters.</div> : null}
      </div>
    </div>
  );
}
