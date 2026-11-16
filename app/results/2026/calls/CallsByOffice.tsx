"use client";
// The Calls Desk by office: the country, then each state's Senate and governor's races, then the House by state and
// district, then the ballot measures. Every row gives who On Point called and when. The calls are On Point's own (the
// engine's ledger); civicAPI supplies the count and its calls are not shown. All of it is read from the one engine
// state, so in a replay it is the record as of the replay clock.
import React, { useMemo, useState } from "react";
import Link from "@/app/components/Link";
import type { Moment } from "@/app/lib/engine/moments";
import type { RaceCallState } from "@/app/lib/engine/modelCalls";
import type { View } from "@/app/lib/engine/serve";
import { STN, type XRace } from "../live";

const ET = "America/New_York";
const NIGHT_END = Date.parse("2026-11-04T10:00:00Z");
const clock = (iso: string | null | undefined) => { if (!iso) return "—"; const ms = Date.parse(iso); const t = new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: ET });
  return ms > NIGHT_END ? `${new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: ET })}, ${t}` : t; };
const letter = (p: string | null | undefined) => { const s = (p ?? "").toLowerCase(); return s === "d" || s.startsWith("dem") ? "D" : s === "r" || s.startsWith("rep") ? "R" : s === "i" || s.startsWith("ind") ? "I" : ""; };
const pcls = (p: string | null | undefined) => { const l = letter(p); return l === "D" ? "p-D" : l === "R" ? "p-R" : "p-O"; };

export type OfficeRow = { r: XRace; s: RaceCallState | null };
type Lane = "standard" | "safe-seat" | "count-settled" | "uncontested";
type Cell = { id: string; nm: string; winner: string | null; party: string | null; at: string | null; lane: Lane | null; leader: string | null; leaderParty: string | null; pct: number | null; counted: number; alerts: number };

function cellOf(x: OfficeRow, v: View): Cell {
  const row = v.races[x.r.id], s = x.s, by = (cid: string | null | undefined) => row?.c.find((c) => c[0] === cid) ?? null;
  const mc = s?.modelCall ?? null, w = by(mc?.candidateId), lead = by(row?.leaderId);
  return { id: x.r.id, nm: x.r.nm, winner: mc?.name ?? null, party: w?.[2] ?? mc?.partyRaw ?? null, at: mc?.calledAt ?? null, lane: mc ? ((mc.lane as Lane | undefined) ?? "standard") : null,
    leader: lead?.[1] ?? null, leaderParty: lead?.[2] ?? null, pct: row?.providerPct ?? null, counted: row?.counted ?? 0, alerts: s?.alerts ?? 0 };
}
const LANE_NOTE: Record<Lane, string> = { standard: "", "safe-seat": "safe seat", "count-settled": "count settled", uncontested: "unopposed" };
const LANE_TITLE: Record<Lane, string> = {
  standard: "On Point's call: the model held above its threshold through every safeguard. A projection, not a certified result.",
  "safe-seat": "On Point's call in the safe-seat lane: the forecast's heavy favourite, confirmed on an early count. A projection, not a certified result.",
  "count-settled": "On Point's call on the count itself: it has stopped, or the lead is out of reach. A projection, not a certified result.",
  uncontested: "Unopposed: recorded when the polls closed.",
};

function CallCell({ c, measure }: { c: Cell | null; measure?: boolean }) {
  if (!c) return <span className="co-none">no race</span>;
  const href = `/results/2026/${encodeURIComponent(c.id)}`;
  if (!c.winner) return <span className="co-open"><Link href={href}>{c.leader ? <>{c.leader}{!measure && letter(c.leaderParty) ? <i className={`cb-p ${pcls(c.leaderParty)}`}>{letter(c.leaderParty)}</i> : null} leads</> : c.counted > 0 ? "counting" : "no returns yet"}</Link><small>not called{c.pct != null && c.counted > 0 ? ` · ${c.pct.toFixed(0)}% of precincts` : ""}</small></span>;
  return (
    <span className="co-call">
      <Link href={href}><b>{c.winner}</b>{!measure && letter(c.party) ? <i className={`cb-p ${pcls(c.party)}`}>{letter(c.party)}</i> : null}</Link>
      <small>
        <span className="mdl" title={LANE_TITLE[c.lane ?? "standard"]}>{c.lane === "uncontested" ? "Unopposed" : "On Point call"} · {clock(c.at)}{c.lane && c.lane !== "uncontested" && LANE_NOTE[c.lane] ? ` (${LANE_NOTE[c.lane]})` : ""}</span>
        {c.alerts ? <strong> · {c.alerts} alert{c.alerts > 1 ? "s" : ""}</strong> : null}
      </small>
    </span>
  );
}

const CHAMBERS: { k: "sen" | "house" | "gov"; key: "senate" | "house" | "governors"; label: string; need: string }[] = [
  { k: "sen", key: "senate", label: "Senate", need: "51 seats, or 50 with the Vice President" }, { k: "house", key: "house", label: "House", need: "218 seats" }, { k: "gov", key: "governors", label: "Governors", need: "36 on the ballot; 26 is a majority of the 50" }];

export default function CallsByOffice({ rows, v, moments }: { rows: OfficeRow[]; v: View; moments: Moment[] }) {
  const [sort, setSort] = useState<"state" | "time">("state"); const [openAll, setOpenAll] = useState(false); const [allMeasures, setAllMeasures] = useState(false);
  const cells = useMemo(() => new Map(rows.map((x) => [x.r.id, cellOf(x, v)])), [rows, v]);
  const of = (k: string) => rows.filter((x) => x.r.k === k);
  const states = useMemo(() => [...new Set(rows.filter((x) => x.r.k === "sen" || x.r.k === "gov").map((x) => x.r.st))].sort((a, b) => (STN[a] ?? a).localeCompare(STN[b] ?? b)), [rows]);
  const firstCall = (st: string) => Math.min(...rows.filter((x) => x.r.st === st && (x.r.k === "sen" || x.r.k === "gov")).map((x) => { const c = cells.get(x.r.id)!; return c.at ? Date.parse(c.at) : Infinity; }));
  const stOrder = sort === "state" ? states : [...states].sort((a, b) => firstCall(a) - firstCall(b));
  const houseStates = useMemo(() => { const m = new Map<string, OfficeRow[]>(); for (const x of of("house")) m.set(x.r.st, [...(m.get(x.r.st) ?? []), x]); for (const a of m.values()) a.sort((x, y) => x.r.id.localeCompare(y.r.id, "en", { numeric: true })); return [...m].sort((a, b) => (STN[a[0]] ?? a[0]).localeCompare(STN[b[0]] ?? b[0])); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const measures = useMemo(() => of("measure").sort((a, b) => (STN[a.r.st] ?? "").localeCompare(STN[b.r.st] ?? "") || a.r.nm.localeCompare(b.r.nm, "en", { numeric: true })), [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  // key measures: the ones that were in doubt before the count (10% to 90% to pass) or are within 10 points now
  const isKey = (x: OfficeRow) => { const p = x.r.pPass; const row = v.races[x.r.id]; return (p != null && p >= 0.1 && p <= 0.9) || (row?.pm?.rep != null && Math.abs(row.pm.rep) < 10 && row.counted > 0); };
  const shownMeasures = allMeasures ? measures : measures.filter(isKey);
  const decided = (ch: string) => moments.find((m) => m.kind === "CHAMBER_DECIDED" && m.chamber === ch && Date.parse(m.t) <= Date.parse(v.t));
  return (
    <div className="co">
      <section aria-labelledby="co-nat">
        <h2 id="co-nat">Nationwide</h2>
        <div className="co-nat">
          {CHAMBERS.map((ch) => {
            const n = v.national[ch.key], list = of(ch.k).map((x) => cells.get(x.r.id)!), called = list.filter((c) => c.winner);
            const times = called.filter((c) => c.lane !== "uncontested" && c.at).map((c) => Date.parse(c.at!)).sort((a, b) => a - b); const nu = (n as { notUp?: { D: number; R: number } }).notUp; const dec = decided(ch.k);
            const lanes = (l: Lane) => called.filter((c) => c.lane === l).length;
            return (
              <article key={ch.k} className="co-ch">
                <h3>{ch.label}</h3>
                <p className="co-seats"><b className="p-D">{n.called.D + (nu?.D ?? 0)}</b><span>Democrats</span><b className="p-R">{n.called.R + (nu?.R ?? 0)}</b><span>Republicans</span></p>
                <p className="co-sub">Seats on On Point&apos;s calls{nu && nu.D + nu.R > 0 ? `, with ${nu.D} Democratic and ${nu.R} Republican ${ch.k === "gov" ? "governorships" : "seats"} not up` : ""}. {ch.k === "gov" ? "" : "Control: "}{ch.need}.</p>
                <dl>
                  <div><dt>Called by On Point</dt><dd>{called.length} of {list.length}</dd></div>
                  <div><dt>Of those</dt><dd>{[lanes("safe-seat") ? `${lanes("safe-seat")} safe-seat` : "", lanes("count-settled") ? `${lanes("count-settled")} count-settled` : "", lanes("uncontested") ? `${lanes("uncontested")} unopposed` : ""].filter(Boolean).join(" · ") || "all on the standard rule"}</dd></div>
                  <div><dt>Not called</dt><dd>{list.length - called.length}</dd></div>
                  <div><dt>First call</dt><dd>{times.length ? clock(new Date(times[0]).toISOString()) : "—"}</dd></div>
                  <div><dt>Latest call</dt><dd>{times.length ? clock(new Date(times[times.length - 1]).toISOString()) : "—"}</dd></div>
                  {ch.k !== "gov" ? <div><dt>Control decided</dt><dd>{dec ? `${clock(dec.t)} · ${dec.title.includes("Democrats") ? "Democrats" : "Republicans"}` : "not yet, on calls"}</dd></div> : null}
                </dl>
              </article>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="co-st">
        <div className="co-hd"><h2 id="co-st">States: Senate and governor</h2>
          <div className="co-sort" role="group" aria-label="Order"><button type="button" aria-pressed={sort === "state"} onClick={() => setSort("state")}>A to Z</button><button type="button" aria-pressed={sort === "time"} onClick={() => setSort("time")}>By first call</button></div></div>
        <div className="co-table" role="table" aria-label="Senate and governor calls by state">
          <div className="co-row co-th" role="row"><span role="columnheader">State</span><span role="columnheader">Senate</span><span role="columnheader">Governor</span></div>
          {stOrder.map((st) => { const sen = rows.filter((x) => x.r.st === st && x.r.k === "sen"), gov = rows.find((x) => x.r.st === st && x.r.k === "gov");
            return (
              <div key={st} className="co-row" role="row">
                <span role="cell" className="st">{STN[st] ?? st}</span>
                <span role="cell">{sen.length ? sen.map((x) => <React.Fragment key={x.r.id}>{sen.length > 1 ? <small className="co-which">{x.r.nm}</small> : null}<CallCell c={cells.get(x.r.id) ?? null} /></React.Fragment>) : <CallCell c={null} />}</span>
                <span role="cell"><CallCell c={gov ? cells.get(gov.r.id) ?? null : null} /></span>
              </div>); })}
        </div>
      </section>

      <section aria-labelledby="co-ho">
        <div className="co-hd"><h2 id="co-ho">House, by state and district</h2><div className="co-sort"><button type="button" aria-pressed={openAll} onClick={() => setOpenAll(!openAll)}>{openAll ? "Collapse all" : "Open all"}</button></div></div>
        {houseStates.map(([st, list]) => { const cs = list.map((x) => cells.get(x.r.id)!); const called = cs.filter((c) => c.winner); const d = called.filter((c) => letter(c.party) === "D").length, r = called.filter((c) => letter(c.party) === "R").length;
          return (
            <details key={`${st}${openAll}`} className="co-st" open={openAll || undefined}>
              <summary><b>{STN[st] ?? st}</b><span>{list.length} district{list.length > 1 ? "s" : ""}</span><span className="mdl">{called.length} called by On Point</span>{called.length ? <span><i className="cb-p p-D">D</i> {d} <i className="cb-p p-R">R</i> {r}</span> : null}</summary>
              <div className="co-table" role="table" aria-label={`${STN[st] ?? st} House calls`}>
                {list.map((x) => <div key={x.r.id} className="co-row two" role="row"><span role="cell" className="st">{x.r.nm}</span><span role="cell"><CallCell c={cells.get(x.r.id) ?? null} /></span></div>)}
              </div>
            </details>); })}
      </section>

      <section aria-labelledby="co-bm">
        <div className="co-hd"><h2 id="co-bm">{allMeasures ? "Ballot measures" : "Key ballot measures"}</h2><div className="co-sort"><button type="button" aria-pressed={!allMeasures} onClick={() => setAllMeasures(false)}>Key ({measures.filter(isKey).length})</button><button type="button" aria-pressed={allMeasures} onClick={() => setAllMeasures(true)}>All ({measures.length})</button></div></div>
        <p className="cb-foot">Key measures are those in doubt before the count (a 10% to 90% chance of passing in the forecast) or within 10 points in the count now. Some measures need more than a simple majority; the race page gives each one&apos;s threshold.</p>
        <div className="co-table" role="table" aria-label="Ballot measure calls">
          <div className="co-row co-th" role="row"><span role="columnheader">Measure</span><span role="columnheader">Call</span><span role="columnheader">Count</span></div>
          {shownMeasures.map((x) => { const row = v.races[x.r.id]; const yes = row?.c.find((c) => /^yes$/i.test(c[1])), no = row?.c.find((c) => /^no$/i.test(c[1])); const tot = (yes?.[3] ?? 0) + (no?.[3] ?? 0);
            return (
              <div key={x.r.id} className="co-row" role="row">
                <span role="cell" className="st"><Link href={`/results/2026/${encodeURIComponent(x.r.id)}`}>{x.r.nm}</Link>{x.r.off ? <small>{x.r.off}</small> : null}</span>
                <span role="cell"><CallCell c={cells.get(x.r.id) ?? null} measure /></span>
                <span role="cell" className="num">{tot > 0 ? <>Yes {((100 * (yes?.[3] ?? 0)) / tot).toFixed(1)}%<small>{row?.providerPct != null ? `${row.providerPct.toFixed(0)}% of precincts` : ""}</small></> : "no returns yet"}</span>
              </div>); })}
          {!shownMeasures.length ? <p className="cb-empty" role="status">No measures in this view.</p> : null}
        </div>
      </section>
    </div>
  );
}

export const CALLS_BY_OFFICE_CSS = `
.co{display:grid;gap:30px;margin-top:18px}
.co h2{font:700 20px var(--font-d);margin:0}
.co-hd{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.co-sort{display:inline-flex;gap:3px;padding:3px;border-radius:10px;border:1px solid var(--line2);background:var(--glass2)}
.co-sort button{font:700 11.5px var(--font-b);color:var(--ink2);background:none;border:0;border-radius:7px;padding:5px 10px;cursor:pointer}
.co-sort button[aria-pressed="true"]{color:var(--hi);background:rgba(var(--line-rgb),.14)}
.co-nat{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:10px}
.co-ch{border:1px solid var(--line2);border-radius:14px;padding:14px 16px;background:var(--glass2)}
.co-ch h3{font:700 11px var(--font-m);letter-spacing:.12em;text-transform:uppercase;color:var(--mute);margin:0 0 6px}
.co-seats{display:flex;align-items:baseline;gap:6px 8px;margin:0;flex-wrap:wrap}
.co-seats b{font:800 34px var(--font-d);letter-spacing:-.02em}.co-seats b.p-D{color:var(--dem)}.co-seats b.p-R{color:var(--gop);margin-left:12px}
.co-seats span{font:600 12px var(--font-b);color:var(--ink2)}
.co-sub{font-size:11.5px;color:var(--mute);margin:4px 0 10px}
.co-ch dl{margin:0;display:grid;gap:3px}.co-ch dl div{display:flex;justify-content:space-between;gap:10px;font-size:12.5px;border-top:1px solid rgba(var(--line-rgb),.08);padding-top:3px}
.co-ch dt{color:var(--mute)}.co-ch dd{margin:0;font-weight:700;color:var(--hi);font-variant-numeric:tabular-nums;text-align:right}
.co-table{border-top:1px solid var(--line2);font-size:13px}
.co-row{display:grid;grid-template-columns:minmax(120px,.7fr) 1.5fr 1.5fr;gap:14px;align-items:start;padding:8px 4px;border-bottom:1px solid rgba(var(--line-rgb),.08)}
.co-row.two{grid-template-columns:minmax(150px,.8fr) 2.2fr}
.co-th{font:700 10px var(--font-m);letter-spacing:.08em;text-transform:uppercase;color:var(--mute)}
.co-row .st{font-weight:700;color:var(--hi)}.co-row .st a{color:var(--hi)}
.co-row small{display:block;color:var(--mute);font-size:11.5px;font-weight:500;margin-top:1px}
.co-row .num{font-variant-numeric:tabular-nums}
.co-call a,.co-open a{color:var(--hi)}.co-call b{font-weight:700}.co-call .cb-p,.co-open .cb-p{margin-left:5px}
.co-call .mdl,.co-st .mdl{color:#7a5cff}.co-call em{font-style:normal}.co-call strong{color:#e0533d;font-weight:700}
.co-open a{font-weight:600;color:var(--ink2)}.co-none{color:var(--mute);font-size:12px}
.co-which{margin-bottom:2px}
.co-st{border-bottom:1px solid rgba(var(--line-rgb),.1)}
.co-st summary{display:flex;gap:6px 16px;align-items:baseline;flex-wrap:wrap;padding:9px 4px;cursor:pointer;font-size:12.5px;color:var(--ink2)}
.co-st summary b{font:700 14px var(--font-b);color:var(--hi);min-width:150px}
.co-st[open] summary{border-bottom:1px solid var(--line2)}
.co-st .co-table{border-top:0;padding-left:10px}
.cd-view{display:inline-flex;gap:3px;padding:3px;border-radius:12px;border:1px solid var(--line2);background:var(--glass2);margin-top:14px}
.cd-view button{font:700 12.5px var(--font-b);color:var(--ink2);background:none;border:0;border-radius:9px;padding:7px 14px;cursor:pointer}
.cd-view button[aria-pressed="true"]{color:var(--hi);background:rgba(var(--line-rgb),.14);box-shadow:inset 0 0 0 1px rgba(var(--accent-rgb),.45)}
@media (max-width:900px){.co-nat{grid-template-columns:1fr}.co-row,.co-row.two{grid-template-columns:1fr;gap:4px}.co-th{display:none}.co-st summary b{min-width:0;width:100%}}
`;
