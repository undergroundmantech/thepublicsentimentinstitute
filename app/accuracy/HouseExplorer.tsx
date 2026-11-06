"use client";
// Every House district, filterable: the misses first, then the close ones, the races still counting or all 435,
// with a search over state, district and candidate.
import { useMemo, useState } from "react";
import { STATE_NAME } from "@/app/lib/opp";
import { RaceTable } from "./RaceTable";
import type { Race } from "./data";

type F = "miss" | "close" | "counting" | "all";
const FILTERS: [F, string][] = [["miss", "Missed"], ["close", "Within 10 points"], ["counting", "Still counting"], ["all", "All 435"]];

export default function HouseExplorer({ rows }: { rows: Race[] }) {
  const [f, setF] = useState<F>("miss");
  const [q, setQ] = useState("");
  const count = useMemo(() => ({
    miss: rows.filter((r) => !r.right && !r.excl).length,
    close: rows.filter((r) => !r.excl && Math.abs(r.fm) < 10).length,
    counting: rows.filter((r) => !r.fin).length,
    all: rows.length,
  }), [rows]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    let out = rows.filter((r) => f === "miss" ? !r.right && !r.excl : f === "close" ? !r.excl && Math.abs(r.fm) < 10 : f === "counting" ? !r.fin : true);
    if (t) out = out.filter((r) => `${r.st} ${r.d} ${STATE_NAME[r.st] ?? ""} ${r.dn ?? r.dem ?? ""} ${r.rn ?? r.gop ?? ""}`.toLowerCase().includes(t));
    return f === "all" ? out.sort((a, b) => a.st.localeCompare(b.st) || a.d - b.d) : out.sort((a, b) => Math.abs(a.fm) - Math.abs(b.fm));
  }, [rows, f, q]);
  return (
    <div className="card hx">
      <div className="hx-bar">
        <div className="acc-seg" role="tablist" aria-label="Which House races">
          {FILTERS.map(([k, l]) => (
            <button key={k} type="button" role="tab" id={`hx-${k}`} aria-selected={f === k} className={f === k ? "on" : ""} onClick={() => setF(k)}>
              {l}<span className="ct">{count[k]}</span>
            </button>
          ))}
        </div>
        <label className="hx-q"><span className="sr">Search House races</span>
          <input id="hx-search" type="search" placeholder="Search a state, district or candidate" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>
      {shown.length ? <div className="hx-body"><RaceTable rows={shown} house /></div> : <p className="acc-note card-b">No House race matches that search.</p>}
    </div>
  );
}
