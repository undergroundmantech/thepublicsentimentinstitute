"use client";
// The donor coalition of one race at a time: each nominee's money by size and source, how much comes from home, where in
// the state the donors live next to where the voters are, and the model's reading.
import React, { useEffect, useMemo, useState } from "react";
import Link from "@/app/components/Link";
import { raceHref } from "@/app/lib/opp";

type Cand = { id: string; name: string; party: string; raised: number | null; itemized: number | null; donations: number | null; home: number | null; status: string; through: string | null;
  sources: Record<string, number> | null; bands: number[] | null; instate_mapped: number | null; coverage: number | null; centroid: number | null };
type Grp = { g: string; donors: number; voters: number; votes: number; n: number; size?: boolean };
type Coal = { groups: Grp[]; top: { f: string; name: string; usd: number; bands: number[]; d2: number }[] } | null;
export type DRace = { id: string; office: string; st: string; name: string; pvi: number; m: number; D: Cand | null; R: Cand | null;
  sig: { z: number; parts: Record<string, number>; shift_logit: number; applies: boolean } | null; coalition?: { D: Coal; R: Coal } };

const usd = (n: number | null | undefined) => (n == null ? "n/a" : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
const pc = (x: number | null | undefined, d = 0) => (x == null ? "n/a" : `${(x * 100).toFixed(d)}%`);
const BAND = ["Under $200", "$200 to $999", "$1,000 to $2,499", "$2,500 and up"];
const SRC: [string, string][] = [["mapped", "Itemized individuals"], ["individuals_unmapped", "Other individuals"], ["pacs", "PACs"], ["party", "Party"], ["self_funding", "Self funding"], ["other", "Transfers and other"]];
const PART: Record<string, string> = { instate: "In state dollars", breadth: "Number of donations", small: "Small dollar share", reach: "Reach into the other side's counties" };
const label = (r: DRace) => (r.office === "senate" ? r.name : `${r.st} ${r.id.split("-")[2]} House`);

function Stack({ vals, names, cls }: { vals: number[]; names: string[]; cls: string }) {
  const t = vals.reduce((a, b) => a + Math.max(0, b), 0) || 1;
  return (
    <div className={`dn-stack ${cls}`}>
      <div className="bar">{vals.map((v, i) => <i key={i} className={`s${i}`} style={{ width: `${(100 * Math.max(0, v)) / t}%` }} title={`${names[i]}: ${pc(v / t)}`} />)}</div>
      <ul>{vals.map((v, i) => v > 0 ? <li key={i}><i className={`s${i}`} />{names[i]} <b>{pc(v / t)}</b></li> : null)}</ul>
    </div>
  );
}

function CandCard({ c, side }: { c: Cand | null; side: "D" | "R" }) {
  if (!c) return <div className="dn-cand glass"><p className="dn-note">No nominee on file with the FEC.</p></div>;
  return (
    <div className={`dn-cand glass ${c.party === "D" ? "d" : c.party === "R" ? "r" : "i"}`}>
      <span className="dn-k">{side === "D" ? (c.party === "D" ? "Democrat" : "Independent") : "Republican"}</span>
      <b className="nm">{c.name}</b>
      <dl>
        <div><dt>Raised through {c.through ?? "the last report"}</dt><dd>{usd(c.raised)}</dd></div>
        <div><dt>Itemized from individuals</dt><dd>{usd(c.itemized)}</dd></div>
        <div><dt>Donations</dt><dd>{c.donations?.toLocaleString() ?? "n/a"}</dd></div>
        <div><dt>From the home state</dt><dd>{pc(c.home)}</dd></div>
        {c.centroid != null ? <div><dt>Where in state donors live</dt><dd>{c.centroid >= 0.5 ? `D +${Math.round((c.centroid - 0.5) * 200)}` : `R +${Math.round((0.5 - c.centroid) * 200)}`} counties</dd></div> : null}
      </dl>
      {c.bands ? <><span className="dn-k">In state money by gift size</span><Stack vals={c.bands} names={BAND} cls="bands" /></> : null}
      {c.sources ? <><span className="dn-k">All money by source, through June 30</span><Stack vals={SRC.map(([k]) => c.sources![k] ?? 0)} names={SRC.map(([, l]) => l)} cls="srcs" /></> : null}
      {c.status !== "complete" ? <p className="dn-note">Reports incomplete: {c.status.replace(/_/g, " ")}.</p> : null}
    </div>
  );
}

function CoalTable({ r }: { r: DRace }) {
  const D = r.coalition?.D, R = r.coalition?.R;
  if (!D && !R) return null;
  const rows = (D ?? R)!.groups.map((g, i) => ({ g: g.g, voters: g.voters, size: g.size, dD: D?.groups[i]?.donors, dR: R?.groups[i]?.donors, vD: D?.groups[i]?.votes, vR: R?.groups[i]?.votes }));
  return (
    <div className="dn-coal glass">
      <div className="dn-sh"><h3>Donor coalition against voter coalition</h3><span>Counties grouped by the 2024 presidential vote and by size</span></div>
      <div className="dn-tw"><table>
        <thead><tr><th>Counties</th><th className="n">Share of voters</th><th className="n d">{r.D?.name.split(" ").slice(-1)[0]}: donor $</th><th className="n d">projected votes</th><th className="n r">{r.R?.name.split(" ").slice(-1)[0]}: donor $</th><th className="n r">projected votes</th></tr></thead>
        <tbody>{rows.map((x) => (
          <tr key={x.g} className={x.size ? "sz" : ""}><td>{x.g}</td><td className="n">{pc(x.voters)}</td>
            <td className="n">{pc(x.dD)}{x.dD != null && x.vD != null ? <small className={x.dD > x.vD ? "hi" : "lo"}>{x.dD > x.vD ? " over" : " under"}</small> : null}</td><td className="n">{pc(x.vD)}</td>
            <td className="n">{pc(x.dR)}{x.dR != null && x.vR != null ? <small className={x.dR > x.vR ? "hi" : "lo"}>{x.dR > x.vR ? " over" : " under"}</small> : null}</td><td className="n">{pc(x.vR)}</td></tr>
        ))}</tbody>
      </table></div>
      <p className="dn-note">Donor dollars are each nominee&apos;s in state money from the donor map, by county; projected votes are the nominee&apos;s votes in the forecast&apos;s county map. Over means the nominee&apos;s donors are more concentrated there than their voters.</p>
      <div className="dn-tops">
        {(["D", "R"] as const).map((s) => { const x = r.coalition?.[s]; return x ? (
          <div key={s}><span className="dn-k">Top donor counties, {(s === "D" ? r.D : r.R)?.name}</span>
            <ol>{x.top.slice(0, 6).map((t) => <li key={t.f}><span>{t.name}</span><b>{usd(t.usd)}</b><small>{t.d2 >= 0.5 ? `D +${Math.round((t.d2 - 0.5) * 200)}` : `R +${Math.round((0.5 - t.d2) * 200)}`} in 2024</small></li>)}</ol></div>
        ) : null; })}
      </div>
    </div>
  );
}

export default function DonorExplorer({ races }: { races: DRace[] }) {
  const sen = useMemo(() => races.filter((r) => r.office === "senate").sort((a, b) => Math.abs(a.m) - Math.abs(b.m)), [races]);
  const [id, setId] = useState(sen[0]?.id ?? races[0]?.id);
  const [q, setQ] = useState("");
  useEffect(() => {
    const read = () => { const h = window.location.hash.slice(1); if (h && races.some((r) => r.id === h)) setId(h); };
    read(); window.addEventListener("hashchange", read); return () => window.removeEventListener("hashchange", read);
  }, [races]);
  const r = races.find((x) => x.id === id) ?? races[0];
  const hits = useMemo(() => { const t = q.trim().toLowerCase(); if (t.length < 2) return []; return races.filter((x) => label(x).toLowerCase().includes(t) || x.D?.name.toLowerCase().includes(t) || x.R?.name.toLowerCase().includes(t)).slice(0, 10); }, [q, races]);
  const pick = (x: string) => { setId(x); setQ(""); try { history.replaceState(null, "", `#${x}`); } catch { /* ignore */ } };
  return (
    <section className="dn-sec dn-ex" id={r?.id}>
      <div className="dn-sh"><h2>Every race&apos;s donor coalition</h2><span>Senate races by closeness; search any House seat</span></div>
      <div className="dn-pick">{sen.map((x) => <button key={x.id} type="button" className={x.id === r?.id ? "on" : ""} onClick={() => pick(x.id)}>{x.st}</button>)}</div>
      <div className="dn-search">
        <input className="dn-in" placeholder="Find a House seat or candidate, like PA 7 or Bresnahan" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Find a race" />
        {hits.length ? <ul>{hits.map((x) => <li key={x.id}><button type="button" onClick={() => pick(x.id)}>{label(x)} <small>{x.D?.name} vs {x.R?.name}</small></button></li>)}</ul> : null}
      </div>
      {r ? (
        <div className="dn-race" key={r.id}>
          <div className="dn-rh"><h3>{label(r)}</h3><Link href={raceHref(r.id)}>Race forecast</Link></div>
          <div className="dn-cands"><CandCard c={r.D} side="D" /><CandCard c={r.R} side="R" /></div>
          {r.sig ? (
            <div className="dn-sig glass">
              <div><span className="dn-k">Model reading</span><b className={r.sig.applies ? (r.sig.shift_logit > 0 ? "d" : "r") : ""}>{r.sig.applies ? `Toward ${r.sig.shift_logit > 0 ? (r.D?.name ?? "the Democrat") : (r.R?.name ?? "the Republican")}, ${Math.abs(r.sig.shift_logit).toFixed(3)} logit` : "Inside the normal range, no shift"}</b><small>Score {r.sig.z > 0 ? "+" : ""}{r.sig.z.toFixed(2)} spreads, positive toward the Democrat</small></div>
              <ul>{Object.entries(r.sig.parts).map(([k, v]) => <li key={k}><span>{PART[k] ?? k}</span><i><em className={v >= 0 ? "d" : "r"} style={{ width: `${Math.min(50, Math.abs(v) * 16)}%`, [v >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></i><b>{v > 0 ? "+" : ""}{v.toFixed(2)}</b></li>)}</ul>
            </div>
          ) : <p className="dn-note">One of the nominees has no FEC money on file, so the model reads no donor score here.</p>}
          {r.office === "senate" ? <CoalTable r={r} /> : null}
        </div>
      ) : null}
    </section>
  );
}
