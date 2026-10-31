// One person's Watchdog file. Plain markup with no data loading, so the static pages and the on demand viewer share it.
import Link from "@/app/components/Link";
import type { PEdge, PFile } from "../data";
import { PARTY_NAME, usd } from "./fmt";
import Md from "./md";

const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SrcLink = ({ s }: { s: string }) => {
  const u = (s.match(/https?:\/\/\S+/) ?? [])[0];
  return u ? <a href={u.replace(/[),.;]+$/, "")} target="_blank" rel="noopener noreferrer" className="pf-src">{host(u) || "source"}</a> : <span className="pf-mute">{s || "n/a"}</span>;
};
const STATUS: Record<string, string> = { Confirmed: "ok", Secondary: "sec", Provisional: "pro", Contested: "con" };
export function raceHref(st: string, office: string, district: string) {
  const s = st.toLowerCase();
  if (office.startsWith("U.S. Senate")) return `/forecast/${s}/senate`;
  if (office === "Governor") return `/forecast/${s}/governor`;
  if (office === "U.S. House" && district) return `/forecast/${s}/house-${Number(district) || 1}`;
  return null;
}

export type PFileX = PFile & { inGraph?: boolean; oppN?: [string, string, boolean][] };
export const fileHref = (id: string, hand: boolean) => (hand ? `/watchdog/people/${id}` : `/watchdog/people/view?id=${encodeURIComponent(id)}`);

export default function PersonFile({ p, war }: { p: PFileX; war?: string | null }) {
  const fc = raceHref(p.st, p.office, p.district);

  const inGraph = !!p.inGraph;
  const money = [...p.edgesRows].sort((a, b) => (Number(b.amount_usd) || 0) - (Number(a.amount_usd) || 0));
  const levers = p.leversRows.filter((l) => l.decision);
  const researchedLevers = levers.filter((l) => !l.source.startsWith("Template"));
  const blocs = [...new Set(money.map((e) => e.interest_bloc).filter(Boolean))];
  const row = (e: PEdge, i: number) => (
    <tr key={i} className={e.cumulative === "yes" ? "cum" : undefined}>
      <td><b>{e.donor_or_entity}</b><small>{e.type}{e.hop && e.hop !== "1" ? `, ${e.hop === "2" ? "one step back" : "two steps back"}` : ""}</small></td>
      <td className="n mono">{e.amount_usd ? usd(Number(e.amount_usd)) : e.amount || "n/a"}{e.cumulative === "yes" ? <small>running total</small> : null}</td>
      <td>{e.recipient_vehicle || "n/a"}</td>
      <td className="pf-mute">{e.interest_bloc}</td>
      <td className="pf-mute">{e.date_or_as_of}</td>
      <td><span className={`pf-st ${STATUS[e.status] ?? ""}`}>{e.status || "n/a"}</span></td>
      <td><SrcLink s={e.source} />{e.note ? <small>{e.note}</small> : null}</td>
    </tr>
  );
  return (
    <>
      <nav className="crumbs pf-crumbs" aria-label="Breadcrumb"><Link href="/watchdog">Watchdog</Link><span className="sep">/</span><Link href="/watchdog/people">People files</Link><span className="sep">/</span><span>{p.name}</span></nav>
      <header className={`pf-head ${p.party.toLowerCase()}`}>
        <div>
          <div className="eye gold">Watchdog file · {p.st}</div>
          <h1>{p.name}</h1>
          <p className="pf-sub">{PARTY_NAME[p.party]}{p.office ? `, running for ${p.office}${p.office === "U.S. House" && p.district ? ` in ${p.st}-${p.district}` : ""}` : ""}. {p.current && p.current !== "none" ? `Now ${p.current}.` : "Not in office now."}</p>
          <div className="pf-pills">
            <span className={`wd-pill ${p.hand ? "g" : ""}`}>{p.hand ? p.tier : "Roster and office levers"}</span>
            {p.rating ? <span className="wd-pill">{p.rating}</span> : null}
            {p.race ? <span className="wd-pill">{p.race}</span> : null}
            {p.priority ? <span className="wd-pill">Research priority {p.priority}</span> : null}
          </div>
        </div>
        <div className="pf-acts">
          {inGraph ? <Link className="wd-btn" href={`/watchdog/connections?name=${encodeURIComponent(`c:${p.name}`)}`}>See the Connections map</Link> : null}
          {fc ? <Link className="wd-btn" href={fc}>Race forecast</Link> : null}
          {war ? <Link className="wd-btn" href={`/watchdog/war-room/${war}`}>War Room</Link> : null}
          <Link className="wd-btn" href={`/watchdog/people/web?p=${p.id}`}>People web</Link>
          {p.board ? <a className="wd-btn" href={`/watchdog/people/boards/${p.id}.html`} target="_blank" rel="noopener">Open the full research board</a> : null}
          {(p.oppN ?? []).map(([oid, on, oh]) => <Link key={oid} className="wd-btn" href={fileHref(oid, oh)}>Opponent: {on}</Link>)}
        </div>
      </header>

      <div className="pf-kpis">
        <div><span>Money ties on file</span><b>{money.length}</b></div>
        <div><span>Researched decisions</span><b>{researchedLevers.length}</b><small>{levers.length - researchedLevers.length} more from office and committees</small></div>
        <div><span>Interest blocs</span><b>{blocs.length}</b></div>
        <div><span>Compiled</span><b>{String(p.meta.compiled ?? "2026-10-23")}</b></div>
      </div>

      <section className="pf-sec card"><div className="pf-body"><Md text={p.profile} /></div></section>

      {money.length ? (
        <section className="pf-sec card" aria-labelledby="pf-money">
          <div className="pf-sh"><h2 id="pf-money">Every money tie</h2><span className="pf-mute">{money.length} rows, biggest first. Running totals are shaded and should not be added to their parts.</span></div>
          <div className="pf-tw"><table className="pf-t pf-money">
            <thead><tr><th>Who</th><th className="n">Amount</th><th>Into</th><th>Interest</th><th>Date</th><th>Status</th><th>Source</th></tr></thead>
            <tbody>{money.slice(0, 40).map(row)}</tbody>
          </table></div>
          {money.length > 40 ? <details className="pf-rest"><summary>Show the other {money.length - 40}</summary><div className="pf-tw"><table className="pf-t pf-money"><tbody>{money.slice(40).map((e, i) => row(e, i + 40))}</tbody></table></div></details> : null}
        </section>
      ) : null}

      {levers.length ? (
        <section className="pf-sec card" aria-labelledby="pf-levers">
          <div className="pf-sh"><h2 id="pf-levers">Decisions on the desk</h2><span className="pf-mute">What this office controls and which interests care about it</span></div>
          <div className="pf-tw"><table className="pf-t">
            <thead><tr><th>Decision</th><th>Where it sits</th><th>When</th><th>Who cares</th><th>Stake</th><th>Position</th><th>Source</th></tr></thead>
            <tbody>{levers.map((l, i) => (
              <tr key={i} className={l.source.startsWith("Template") ? "tpl" : undefined}>
                <td><b>{l.decision}</b></td><td>{l.who_holds_it_now}</td><td className="pf-mute">{l.when || "n/a"}</td><td className="pf-mute">{l.which_donors_care}</td>
                <td className="pf-mute">{l.stake || "n/a"}</td><td>{l.subject_position}</td><td>{l.source.startsWith("Template") ? <span className="pf-mute">From the office</span> : <SrcLink s={l.source} />}</td>
              </tr>))}</tbody>
          </table></div>
        </section>
      ) : null}

      {p.notes ? <details className="pf-sec card pf-notes"><summary>Research notes: findings, inferences and gaps</summary><div className="pf-body"><Md text={p.notes} /></div></details> : null}

      <p className="wd-src">From the On Point Watchdog Database, compiled {String(p.meta.compiled ?? "2026-10-23")}. {p.hand ? "Researched by the Watchdog desk from sources read in full; rows marked Confirmed mostly rest on news reports rather than the filings themselves, so check a figure against the filing before quoting it." : "This file holds the roster facts and the office decisions so far; the money section fills in as the FEC pipeline runs."} {String(p.meta.next_filing ?? "")}</p>
    </>
  );
}
