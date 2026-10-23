"use client";
// The people files index: everyone in the On Point Watchdog Database, searchable by name, state or district, with
// filters for office, party and how deep the research goes. Each row opens that person's file.
import React, { useMemo, useState } from "react";
import Link from "next/link";
import type { PRow } from "../data";
import { fileHref } from "./PersonFile";

const OFFICE: [string, string][] = [["all", "Everyone"], ["Governor", "Governors"], ["U.S. Senate", "Senate"], ["U.S. House", "House"]];
const PARTY: [string, string][] = [["all", "Any party"], ["D", "Democrats"], ["R", "Republicans"], ["I", "Independents"]];
const PN: Record<string, string> = { D: "D", R: "R", I: "I", O: "O" };
const officeOf = (p: PRow) => (p.office.startsWith("U.S. Senate") ? "U.S. Senate" : p.office);
const where = (p: PRow) => (p.office === "U.S. House" && p.district ? `${p.st}-${p.district}` : p.st);
const LIMIT = 60;

export default function PeopleIndex({ people }: { people: PRow[] }) {
  const [q, setQ] = useState("");
  const [office, setOffice] = useState("all");
  const [party, setParty] = useState("all");
  const [st, setSt] = useState("all");
  const [deep, setDeep] = useState(false);
  const [n, setN] = useState(LIMIT);
  const states = useMemo(() => [...new Set(people.map((p) => p.st))].sort(), [people]);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return people.filter((p) => (office === "all" || officeOf(p) === office) && (party === "all" || p.party === party) && (st === "all" || p.st === st) && (!deep || p.hand)
      && (!t || p.name.toLowerCase().includes(t) || where(p).toLowerCase() === t || p.st.toLowerCase() === t || p.current.toLowerCase().includes(t)));
  }, [people, q, office, party, st, deep]);
  const reset = () => setN(LIMIT);
  return (
    <section className="pf-ix card" aria-label="Every person on file">
      <div className="pf-tools">
        <label className="pf-q" htmlFor="pf-q"><span className="sr">Find a person</span>
          <input id="pf-q" className="wd-input" placeholder="Find a person, state or district, like Ramaswamy, OH or TX-28" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </label>
        <div className="wd-chips" role="group" aria-label="Office">{OFFICE.map(([k, l]) => <button key={k} type="button" className={office === k ? "on" : ""} aria-pressed={office === k} onClick={() => { setOffice(k); reset(); }}>{l}</button>)}</div>
        <div className="wd-chips" role="group" aria-label="Party">{PARTY.map(([k, l]) => <button key={k} type="button" className={party === k ? "on" : ""} aria-pressed={party === k} onClick={() => { setParty(k); reset(); }}>{l}</button>)}</div>
        <select id="pf-st" className="wd-input pf-st" value={st} onChange={(e) => { setSt(e.target.value); reset(); }} aria-label="State">
          <option value="all">Every state</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div className="wd-chips" role="group" aria-label="Research"><button type="button" className={deep ? "on" : ""} aria-pressed={deep} onClick={() => { setDeep((x) => !x); reset(); }}>Full research files only</button></div>
      </div>
      <div className="pf-count">{list.length.toLocaleString()} {list.length === 1 ? "person" : "people"}</div>
      <div className="pf-tw">
        <table className="pf-t pf-list">
          <thead><tr><th>Name</th><th>Running for</th><th>Now</th><th>Race</th><th>File</th><th className="n">Money ties</th></tr></thead>
          <tbody>
            {list.slice(0, n).map((p) => (
              <tr key={p.id}>
                <td><Link href={fileHref(p.id, p.hand)} className="pf-nm"><i className={`pf-dot ${PN[p.party].toLowerCase()}`} />{p.name}</Link></td>
                <td>{p.office || "n/a"} <span className="pf-mute">{where(p)}</span></td>
                <td className="pf-mute">{p.current && p.current !== "none" ? p.current : "Not in office"}</td>
                <td className="pf-mute">{p.rating || p.race || "n/a"}</td>
                <td>{p.hand ? <span className="wd-pill g">{p.tier.startsWith("Tier 1") ? "Full file" : "Researched"}</span> : <span className="wd-pill">Roster and levers</span>}</td>
                <td className="n mono">{p.edges || ""}</td>
              </tr>
            ))}
            {!list.length ? <tr><td colSpan={6} className="wd-empty">No one matches. Try a last name or a state code.</td></tr> : null}
          </tbody>
        </table>
      </div>
      {list.length > n ? <div className="pf-more"><button type="button" className="wd-btn" onClick={() => setN((x) => x + 120)}>Show {Math.min(120, list.length - n)} more</button></div> : null}
    </section>
  );
}
