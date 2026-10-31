"use client";
// Every November 3 race in one sortable list: the forecast's expected result next to civicAPI's returns.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { useSearchParams } from "next/navigation";
import { STN, KIND_LABEL, expMargin, fmtK, fmtM, forecastHref, isInd, resultsHref, sides, type Kind, type XRace } from "./live";
import { useIndex, useLive } from "./useLive";
import { useSharedLive } from "./LiveProvider";

const KINDS: (Kind | "all")[] = ["all", "sen", "gov", "house", "state", "measure", "leg", "other"];
const SETS = { all: ["fed", "state", "ballot", "leg"], sen: ["fed"], gov: ["fed"], house: ["fed"], state: ["state"], measure: ["ballot"], leg: ["leg"], other: ["state"] } as const;

export default function RacesHub({ embedded = false }: { embedded?: boolean }) {
  const sp = useSearchParams();
  // inside the national page the read is shared with the dashboard; standalone it subscribes on its own
  const shared = useSharedLive();
  const ownIx = useIndex();
  const ix = shared ? shared.ix : ownIx;
  const [k, setK] = useState<Kind | "all">((sp.get("k") as Kind) || "all");
  const [st, setSt] = useState<string>((sp.get("st") || "").toUpperCase());
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"close" | "in" | "name" | "votes">("close");
  // the national dashboard's category links change ?k= in place
  const kq = sp.get("k");
  const [seenK, setSeenK] = useState(kq);
  if (kq !== seenK) { setSeenK(kq); if (kq && KINDS.includes(kq as Kind)) setK(kq as Kind); }
  const sets = useMemo(() => [...SETS[k]], [k]);
  const ownLive = useLive(shared ? null : ix, sets as never);
  const live = shared ? shared.live : ownLive;
  const list = useMemo(() => {
    let L = (ix?.races ?? []).filter((r) => (k === "all" || r.k === k) && (!st || r.st === st));
    const s = q.trim().toLowerCase();
    if (s) L = L.filter((r) => `${r.nm} ${r.off} ${(r.c ?? []).map((x) => x[0]).join(" ")}`.toLowerCase().includes(s));
    const lm = (r: XRace) => { const c = live.byId[r.id]; if (!c) return null; const x = sides(r, c.c); return x.t ? { m: (100 * (x.b - x.a)) / x.t, pr: c.pr } : null; };
    const rows = L.map((r) => ({ r, e: expMargin(r), l: lm(r), c: live.byId[r.id] }));
    rows.sort((a, b) => sort === "name" ? a.r.nm.localeCompare(b.r.nm) : sort === "votes" ? (b.r.tot ?? 0) - (a.r.tot ?? 0) : sort === "in" ? (b.l?.pr ?? -1) - (a.l?.pr ?? -1) : Math.abs(a.e ?? 999) - Math.abs(b.e ?? 999));
    return rows;
  }, [ix, k, st, q, sort, live.byId]);
  const counts = useMemo(() => { const m: Record<string, number> = { all: ix?.races.length ?? 0 }; for (const r of ix?.races ?? []) if (!st || r.st === st) m[r.k] = (m[r.k] ?? 0) + 1; if (st) m.all = Object.entries(m).filter(([x]) => x !== "all").reduce((s, [, v]) => s + v, 0); return m; }, [ix, st]);
  const linked = Object.keys(live.byId).length, rep = Object.values(live.byId).filter((c) => c.pr > 0 || c.c.some((x) => x[2] > 0)).length;

  return (
    <div className={`opp rh${embedded ? " rh-embed" : ""}`} id="rh">
      {embedded ? (
        <header className="rh-head">
          <div><div className="eye">Every race · {ix?.races.length ?? "…"} on the ballot</div><h2>Every race, <em>expected and reported.</em></h2></div>
          <div className="rh-stat"><div><b>{linked}</b><span>linked to civicAPI</span></div><div><b>{rep}</b><span>reporting</span></div></div>
        </header>
      ) : (
        <>
          <nav className="crumbs" aria-label="Breadcrumb"><Link href="/results">Results</Link><span className="sep">/</span><span>November 3, 2026</span></nav>
          <header className="rh-head">
            <div>
              <div className="eye">November 3, 2026 · {ix?.races.length ?? "…"} races</div>
              <h1>Every race, <em>expected and reported.</em></h1>
              <p className="lede">The On Point Politics forecast for every race it covers, county by county where it has counties, next to live returns from civicAPI. Open any race for its county table, its map and an estimate of the final count as votes come in.</p>
            </div>
            <div className="rh-stat">
              <div><b>{linked}</b><span>linked to civicAPI</span></div>
              <div><b>{rep}</b><span>reporting</span></div>
              <Link className="btn g" href="/results/monitor">Open the situation monitor</Link>
            </div>
          </header>
        </>
      )}
      <div className="rh-bar">
        <div className="rl-seg" role="group" aria-label="Race type">{KINDS.map((x) => <button key={x} aria-pressed={k === x} onClick={() => setK(x)}>{x === "all" ? "All" : KIND_LABEL[x]} <em>{counts[x] ?? 0}</em></button>)}</div>
        <select id="rh-st" className="rh-in" value={st} onChange={(e) => setSt(e.target.value)} aria-label="State"><option value="">Every state</option>{Object.entries(STN).map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
        <input id="rh-q" className="rh-in" placeholder="Find a race or candidate" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a race or candidate" />
        <select id="rh-sort" className="rh-in" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} aria-label="Sort"><option value="close">Closest expected</option><option value="in">Most reported</option><option value="votes">Most votes</option><option value="name">A to Z</option></select>
      </div>
      {live.error ? <p className="rh-note">{live.error}</p> : null}
      <div className="card rl-tbl"><div className="rl-tw"><table className="rh-t">
        <thead><tr><th>Race</th><th>Type</th><th>Expected</th><th>Chance</th><th>Expected votes</th><th>Returns</th><th>In</th><th /></tr></thead>
        <tbody>{list.slice(0, 600).map(({ r, e, l, c }) => {
          const ind = isInd(r);
          const chance = r.k === "measure" ? (r.pPass != null ? `${Math.round(r.pPass * 100)}% pass` : "") : r.k === "leg" ? (r.pD != null ? `${Math.round(r.pD * 100)}% D control` : "") : r.pR != null ? `${Math.round((r.pR >= 0.5 ? r.pR : 1 - r.pR) * 100)}% ${r.pR >= 0.5 ? "R" : ind ? "I" : "D"}` : "";
          return (
            <tr key={r.id}>
              <td><Link href={resultsHref(r.id)}><b>{r.k === "house" ? `${STN[r.st]} ${Number(r.id.split("-")[2])}` : r.nm}</b></Link>{r.k === "measure" ? <small>{r.off}</small> : r.c?.length && r.k !== "leg" ? <small>{r.c.slice(0, 2).map((x) => x[0]).join(" v ")}</small> : null}</td>
              <td>{KIND_LABEL[r.k]}</td>
              <td className={e == null ? "" : e < 0 ? "d" : "r"}>{r.k === "leg" ? `D ${r.dS?.toFixed(0)}, R ${r.rS?.toFixed(0)}` : fmtM(e, r.k, ind)}</td>
              <td>{chance}</td>
              <td>{r.tot ? fmtK(r.tot) : ""}</td>
              <td className={!l ? "" : l.m < 0 ? "d" : "r"}>{l ? fmtM(l.m, r.k, ind) : c ? "None yet" : ""}</td>
              <td>{c ? `${c.pr.toFixed(0)}%` : ""}</td>
              <td className="lk"><Link href={resultsHref(r.id)}>Results</Link><Link href={forecastHref(r)}>Forecast</Link></td>
            </tr>
          );
        })}</tbody>
      </table></div>{list.length > 600 ? <p className="rh-note">Showing 600 of {list.length}. Pick a state or a race type to see the rest.</p> : null}</div>
    </div>
  );
}
