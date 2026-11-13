"use client";
import { useMemo, useState } from "react";
import { CAND, TIER, TIERS, type Pick, type Senator, type Tier } from "./data";

type Sort = "pick" | "name" | "st";

export default function TrackerTable({ rows }: { rows: Senator[] }) {
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<"all" | Pick>("all");
  const [kind, setKind] = useState<"all" | "record" | "estimate" | Tier>("all");
  const [sort, setSort] = useState<Sort>("pick");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const out = rows.filter((r) =>
      (pick === "all" || r.pick === pick) &&
      (kind === "all" || (kind === "record" ? !TIER[r.tier].estimate : kind === "estimate" ? TIER[r.tier].estimate : r.tier === kind)) &&
      (!s || `${r.name} ${r.st} ${r.note}`.toLowerCase().includes(s)));
    const key = (r: Senator) => sort === "name" ? r.last : sort === "st" ? r.st + r.last : `${r.pick}${TIERS.indexOf(r.tier)}`;
    return sort === "pick" ? out : [...out].sort((a, b) => key(a).localeCompare(key(b)));
  }, [rows, q, pick, kind, sort]);
  const th = (k: Sort, label: string) => (
    <th scope="col" aria-sort={sort === k ? "ascending" : "none"}><button type="button" onClick={() => setSort(k)}>{label}</button></th>
  );
  return (
    <section className="card mt-table" aria-labelledby="mt-all">
      <div className="card-h">
        <h3 id="mt-all">All {rows.length} senators</h3>
        <span className="sp" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a senator or state" aria-label="Find a senator or state" />
        <select value={pick} onChange={(e) => setPick(e.target.value as "all" | Pick)} aria-label="Projected vote">
          <option value="all">Both candidates</option><option value="S">Schumer</option><option value="V">Van Hollen</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Position">
          <option value="all">Every position</option><option value="record">On record</option><option value="estimate">Our estimates</option>
          {TIERS.map((t) => <option key={t} value={t}>{TIER[t].label}</option>)}
        </select>
      </div>
      <div className="mt-scroll">
        <table>
          <thead><tr>{th("name", "Senator")}{th("st", "State")}{th("pick", "Projected vote")}<th scope="col">Position</th><th scope="col">Why</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.name}>
                <td className="nm">{r.name}</td>
                <td className="st">{r.st}</td>
                <td><span className={`mt-pk p-${r.pick}`}><i className={`mt-sw p-${r.pick}`} />{CAND[r.pick].name}</span></td>
                <td><span className={`mt-tier ${TIER[r.tier].estimate ? "est" : "rec"}`}>{TIER[r.tier].label}</span></td>
                <td className="why">{r.note}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={5} className="none">No senator matches.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}
