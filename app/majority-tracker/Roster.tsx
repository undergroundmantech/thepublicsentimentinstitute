"use client";
// The whole caucus as trading cards: a cartoon, the projected vote, how sure we are and why. Search, filter and sort
// in place; every card is plain text underneath, so the page still reads without the pictures.
import { useMemo, useState } from "react";
import { CAND, TIER, TIERS, type Pick, type Senator, type Tier } from "./data";
import Toon from "./Toon";

type Sort = "pick" | "name" | "st";

export default function Roster({ rows }: { rows: Senator[] }) {
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

  return (
    <section className="mt-roster" aria-labelledby="mt-all">
      <div className="mt-sec-h">
        <p className="eye">The whole caucus</p>
        <h2 id="mt-all">Every senator, every call</h2>
      </div>
      <div className="mt-tools">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a senator or state" aria-label="Find a senator or state" />
        <div className="mt-seg" role="group" aria-label="Projected vote">
          {(["all", "S", "V"] as const).map((k) => (
            <button key={k} type="button" aria-pressed={pick === k} className={`${pick === k ? "on" : ""}${k !== "all" ? " p-" + k : ""}`} onClick={() => setPick(k)}>{k === "all" ? "Both" : CAND[k].name}</button>
          ))}
        </div>
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} aria-label="Position">
          <option value="all">Every position</option><option value="record">On record</option><option value="estimate">Our estimates</option>
          {TIERS.map((t) => <option key={t} value={t}>{TIER[t].label}</option>)}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
          <option value="pick">Sort by side</option><option value="name">Sort by name</option><option value="st">Sort by state</option>
        </select>
        <span className="mt-count">{list.length} of {rows.length}</span>
      </div>
      <ul className="mt-cards">
        {list.map((r) => (
          <li key={r.name} className={`mt-tc p-${r.pick} t-${r.tier}`}>
            <Toon name={r.name} side={r.pick} size={84} className="mt-tc-face" uid="r" />
            <div className="mt-tc-b">
              <div className="mt-tc-n"><b>{r.name.replace(", if seated", "")}</b><span>{r.st}</span></div>
              <div className="mt-tc-t">
                <span className={`mt-pk p-${r.pick}`}>{CAND[r.pick].name}</span>
                <span className={`mt-tier ${TIER[r.tier].estimate ? "est" : "rec"}`}>{TIER[r.tier].estimate ? `${TIER[r.tier].short} confidence` : TIER[r.tier].label}</span>
                {r.ifSeated ? <span className="mt-tier est">If seated</span> : null}
              </div>
              <p>{r.note}</p>
            </div>
          </li>
        ))}
        {!list.length && <li className="mt-none">No senator matches.</li>}
      </ul>
    </section>
  );
}
