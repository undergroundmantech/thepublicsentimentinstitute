"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AutoTable, Bar, CAT_LABEL, Card, EntityLink, Gate, Head, Kpis, Tape, Table, day, href, int, officeLabel, partyShort, pct, side, usd, useLedger, type Row } from "../lib";
import Connections from "../../connections/Connections";
import "../../connections/connections.css";
import type { Graph, GNode, GEdge } from "../../data";

/* ------------------------------------------------------------------ signals */
export function SignalsView() {
  const r = useLedger<{ president: Row[] | null; heat: Row[] | null; trouble: Row[] | null; sharedVendors: Row[] | null; donorMoves: { bothSides: Row[]; newMoney: Row[] } | null }>("signals.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Signals:" em="what happens next." lede="Money turned into leads. Every score is a sum of plain evidence with each reason shown: who is building toward 2028, which races are heating up, which campaigns are in money trouble, super PACs and campaigns sharing firms, and donors on the move." />
      <Gate r={r}>{(s) => (
        <>
          <Card title="2028 watch" right="Filings, early state spending, hires, momentum">
            <div className="lg-sig">{(s.president ?? []).map((p, i) => {
              const pr = (p.prospect ?? {}) as Row;
              return (
                <article key={i} className={`lg-sigc ${side(p.party)}`}>
                  <div className="lg-sigh"><b>{String(pr.name ?? "")}</b><span className="lg-score">{int(p.score)}<small>{String(p.label ?? "")}</small></span></div>
                  <div className="lg-sigk"><span>Raised in 90 days <b className="mono">{usd(p.raised90)}</b></span><span>Early state spending <b className="mono">{usd(p.earlyStateSpend)}</b></span></div>
                  <ul>{((p.reasons ?? []) as (string | Row)[]).slice(0, 6).map((x, k) => <li key={k}>{typeof x === "string" ? x : String(x.text ?? x.label ?? JSON.stringify(x))}</li>)}</ul>
                </article>
              );
            })}{!(s.president ?? []).length ? <div className="wd-empty">No 2028 prospects in the snapshot.</div> : null}</div>
          </Card>
          <div className="lg-grid2">
            <Card title="Races heating up" right="Outside money and how even the money is">
              <div className="lg-sig">{(s.heat ?? []).map((h, i) => (
                <article key={i} className="lg-sigc">
                  <div className="lg-sigh"><Link href={href.race(String(h.key))} className="lg-link"><b>{officeLabel(h.office, h.state, h.district)}</b></Link><span className="lg-score">{int(h.score)}</span></div>
                  <div className="lg-sigk"><span>Outside, 30 days <b className="mono">{usd(h.ie30)}</b></span><span>30 days before <b className="mono">{usd(h.iePrev30)}</b></span></div>
                  <ul>{((h.reasons ?? []) as string[]).slice(0, 4).map((x, k) => <li key={k}>{String(x)}</li>)}</ul>
                </article>
              ))}</div>
            </Card>
            <Card title="Money trouble" right="Debt above cash, falling cash, heavy burn">
              {(s.trouble ?? []).length ? <div className="lg-sig">{(s.trouble ?? []).map((t, i) => (
                <article key={i} className={`lg-sigc ${side(t.party)}`}><div className="lg-sigh"><EntityLink kind="candidate" id={String(t.id ?? t.candidate_id ?? "")}><b>{String(t.name ?? t.candidate_name ?? "")}</b></EntityLink><span className="lg-score">{int(t.score)}</span></div>
                  <ul>{((t.reasons ?? []) as string[]).slice(0, 4).map((x, k) => <li key={k}>{String(x)}</li>)}</ul></article>
              ))}</div> : <div className="wd-empty">No campaign shows the usual signs of money trouble.</div>}
            </Card>
          </div>
          <Card title="Shared vendors" right="A super PAC paying the same firm as the campaign it helps">
            <Table rows={s.sharedVendors ?? []} initial="support" limit={30} cols={[
              { key: "vendor", label: "Firm", render: (x) => <EntityLink kind="vendor" id={x.vendor_id as string}>{String(x.vendor)}</EntityLink> },
              { key: "category", label: "Work", render: (x) => CAT_LABEL[String(x.category)] ?? String(x.category ?? "") },
              { key: "spender", label: "Outside group", render: (x) => <EntityLink kind="committee" id={x.spender_id as string}>{String(x.spender)}</EntityLink> },
              { key: "candidate", label: "Campaign it helps", render: (x) => <EntityLink kind="candidate" id={x.candidate_id as string}>{String(x.candidate)}</EntityLink> },
              { key: "paid_by_spender", label: "Paid by group", num: true, render: (x) => usd(x.paid_by_spender) },
              { key: "paid_by_campaign", label: "Paid by campaign", num: true, render: (x) => usd(x.paid_by_campaign) },
            ]} />
          </Card>
          <div className="lg-grid2">
            {(["bothSides", "newMoney"] as const).map((k) => (
              <Card key={k} title={k === "bothSides" ? "Donors giving to both parties" : "Big new money, last 60 days"}>
                <Table rows={s.donorMoves?.[k] ?? []} initial="total" limit={15} cols={[
                  { key: "name", label: "Donor", render: (x) => <EntityLink kind="donor" id={x.id as string}>{String(x.name)}</EntityLink> },
                  { key: "employer", label: "Employer" },
                  { key: "dem", label: "To D", num: true, render: (x) => usd(x.dem) },
                  { key: "rep", label: "To R", num: true, render: (x) => usd(x.rep) },
                  { key: "total", label: "Total", num: true, render: (x) => usd(x.total) },
                ]} />
              </Card>
            ))}
          </div>
        </>
      )}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ scores */
export function ScoresView() {
  const r = useLedger<{ balance: { group: string; office: string; rows: Row[] }[] | null; all: Record<string, { health: number | null; healthLabel: string | null; ledger: number | null; grade: string | null }> }>("scores.json");
  const cands = useLedger<Row[]>("candidates.json");
  const names = useMemo(() => new Map((cands.data ?? []).map((c) => [String(c.id), c])), [cands.data]);
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Scores," em="side by side." lede="Campaign health, 0 to 100, says where a campaign stands today. The Ledger Score, 0 to 100 and higher when cleaner, flags patterns worth checking. The same formula runs on everyone; the balance table checks that neither party is scored harder." />
      <Gate r={r}>{(s) => {
        const rows = Object.entries(s.all).map(([id, v]) => ({ id, ...v, ...(names.get(id) ?? {}) })) as Row[];
        return (
          <>
            {(s.balance ?? []).length ? <Card title="Party balance" right="Average scores from the daily snapshots">{(s.balance ?? []).map((b, i) => <div key={i}><h4 className="lg-h4">{b.group} · {b.office}</h4><AutoTable rows={b.rows} /></div>)}</Card> : null}
            <Card title="Every scored candidate">
              <Table rows={rows.filter((x) => x.health != null || x.ledger != null)} initial="ledger" limit={100} empty="No candidate has enough data for a score yet." cols={[
                { key: "name", label: "Candidate", render: (x) => <EntityLink kind="candidate" id={String(x.id)} className={side(x.party)}>{String(x.name ?? x.id)}</EntityLink> },
                { key: "race", label: "Race", render: (x) => officeLabel(x.office, x.state, x.district) },
                { key: "health", label: "Health", num: true, render: (x) => x.health == null ? "n/a" : int(x.health) },
                { key: "healthLabel", label: "", render: (x) => String(x.healthLabel ?? "") },
                { key: "ledger", label: "Ledger Score", num: true, render: (x) => x.ledger == null ? "n/a" : int(x.ledger) },
                { key: "grade", label: "Grade", render: (x) => String(x.grade ?? "") },
              ]} />
            </Card>
          </>
        );
      }}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ foreign agents and cases */
export function ForeignView() {
  const r = useLedger<{ foreign: Row | null; sanctions: Row[] | null; enforcement: Row[] | null; doj: Row[] | null; stocks: Row[] | null }>("watchdog.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Foreign agents," em="cases and trades." lede="Foreign agent registrations by country, registrants who also lobby Congress, foreign owners on lobbying reports, gifts from foreign addresses, FEC enforcement cases, Justice Department corruption and foreign agent cases, House stock trade reports and sanctions list matches. Matches by name are leads to check, never proof." />
      <Gate r={r}>{(w) => {
        const f = (w.foreign ?? {}) as Row & { counts?: Row };
        const c = (f.counts ?? {}) as Row;
        return (
          <>
            <Kpis items={[
              { k: "Foreign agent registrants", v: int(c.registrants), s: `${int(c.principals)} foreign principals` },
              { k: "Countries", v: int(c.countries), s: "with registered agents" },
              { k: "FEC cases", v: int((w.enforcement ?? []).length), s: "recent enforcement" },
              { k: "Justice releases", v: int((w.doj ?? []).length), s: "corruption, campaign finance, foreign agents" },
            ]} />
            <div className="lg-grid2">
              <Card title="Foreign agents by country"><AutoTable rows={f.byCountry as Row[]} prefer={["country", "registrants", "principals"]} empty="Foreign agent filings are not loaded in this snapshot." /></Card>
              <Card title="Registrants who also lobby Congress"><AutoTable rows={f.dual as Row[]} empty="None found." /></Card>
            </div>
            <div className="lg-grid2">
              <Card title="Foreign principals"><AutoTable rows={f.principals as Row[]} empty="None loaded." /></Card>
              <Card title="Foreign owners named on lobbying reports"><AutoTable rows={f.lobbyForeign as Row[]} empty="None loaded." /></Card>
            </div>
            <div className="lg-grid2">
              <Card title="Gifts from foreign addresses"><AutoTable rows={f.foreignDonors as Row[]} empty="None found." /></Card>
              <Card title="Sanctions list matches" right="Leads to check by hand"><AutoTable rows={w.sanctions} empty="No matches." /></Card>
            </div>
            <Card title="FEC enforcement cases"><AutoTable rows={w.enforcement} prefer={["title", "case_no", "respondents", "penalty", "status", "date"]} empty="No cases loaded. They need a real FEC key in Ledger." /></Card>
            <Card title="Justice Department releases"><AutoTable rows={w.doj} prefer={["title", "date", "topic"]} empty="None loaded." /></Card>
            <Card title="House stock trade reports"><AutoTable rows={w.stocks} empty="None loaded." /></Card>
          </>
        );
      }}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ lobbying */
export function LobbyingView() {
  const r = useLedger<{ recent: Row[]; topClients: Row[]; topIssues: Row[]; contributions: Row[] }>("lobbying.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Lobbying," em="who pays to be heard." lede="Registrations and quarterly reports from lda.gov: the biggest clients, the issues they lobby on, the latest filings and lobbyists' own campaign gifts." />
      <Gate r={r}>{(l) => {
        const maxI = Math.max(1, ...l.topIssues.map((i) => Number(i.total)));
        return (
          <>
            <div className="lg-grid2">
              <Card title="Biggest clients"><Table rows={l.topClients} initial="total" cols={[
                { key: "client", label: "Client" }, { key: "total", label: "Spent", num: true, render: (x) => usd(x.total) }, { key: "filings", label: "Reports", num: true },
                { key: "issues", label: "Issues", render: (x) => ((x.issues as string[]) ?? []).slice(0, 3).join(", ") },
              ]} /></Card>
              <Card title="Top issues"><ul className="lg-bars">{l.topIssues.map((i) => <li key={String(i.issue)}><span>{String(i.issue)}</span><Bar v={Number(i.total)} max={maxI} cls="g" /><b className="mono">{usd(i.total)}</b></li>)}</ul></Card>
            </div>
            <Card title="Latest reports"><Table rows={l.recent} initial="" cols={[
              { key: "client", label: "Client" }, { key: "registrant", label: "Firm" },
              { key: "expenses", label: "Amount", num: true, render: (x) => usd(x.expenses ?? x.income) },
              { key: "issues", label: "Issues", render: (x) => ((x.issues as string[]) ?? []).join(", ") },
              { key: "period", label: "Period" }, { key: "posted_at", label: "Posted", render: (x) => day(x.posted_at) },
            ]} /></Card>
            <Card title="Lobbyist campaign gifts" right="Shown, not counted in donor totals"><AutoTable rows={l.contributions} empty="None in this snapshot." /></Card>
          </>
        );
      }}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ ads */
export function AdsView() {
  const r = useLedger<{ advertisers: Row[]; weekly: { week: string; spend: number }[]; states: { region: string; spend: number }[]; creatives: Row[] }>("ads.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Political ads," em="who is buying." lede="Google's political ad report: the biggest buyers, weekly spending, spending by state and the latest ads, matched to FEC committees where the names line up. TV contracts sit in station files the FCC does not index, so TV shows up through the media buyers on the Vendors page." />
      <Gate r={r}>{(a) => {
        const maxW = Math.max(1, ...a.weekly.map((w) => Number(w.spend)));
        const maxS = Math.max(1, ...a.states.map((s) => Number(s.spend)));
        return (
          <>
            <Card title="Weekly spending"><div className="lg-months wide">{a.weekly.map((w) => <span key={w.week} title={`${day(w.week)}: ${usd(w.spend)}`}><i style={{ height: `${(Number(w.spend) / maxW) * 100}%` }} /><small>{String(w.week).slice(5)}</small></span>)}</div></Card>
            <div className="lg-grid2">
              <Card title="Biggest buyers"><Table rows={a.advertisers} initial="spend_usd" cols={[
                { key: "name", label: "Advertiser", render: (x) => x.recipient_id ? <EntityLink kind="committee" id={String(x.recipient_id)}>{String(x.name)}</EntityLink> : String(x.name) },
                { key: "spend_usd", label: "Spent", num: true, render: (x) => usd(x.spend_usd) }, { key: "recent", label: "Recent", num: true, render: (x) => usd(x.recent) }, { key: "creatives", label: "Ads", num: true },
              ]} /></Card>
              <Card title="By state"><ul className="lg-bars">{a.states.map((s) => <li key={s.region}><span>{s.region}</span><Bar v={Number(s.spend)} max={maxS} cls="g" /><b className="mono">{usd(s.spend)}</b></li>)}</ul></Card>
            </div>
            <Card title="Latest ads"><Table rows={a.creatives} initial="" cols={[
              { key: "advertiser", label: "Advertiser" }, { key: "ad_type", label: "Type" },
              { key: "spend", label: "Spend", num: true, render: (x) => `${usd(x.spend_min)} to ${usd(x.spend_max)}`, sort: (x) => Number(x.spend_max ?? 0) },
              { key: "impressions", label: "Impressions" }, { key: "start_date", label: "Ran", render: (x) => `${day(x.start_date)} to ${day(x.end_date)}` },
              { key: "url", label: "", render: (x) => x.url ? <a className="lg-link" href={String(x.url)} target="_blank" rel="noreferrer">See the ad</a> : "" },
            ]} /></Card>
          </>
        );
      }}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ events */
export function EventsView() {
  const r = useLedger<{ upcoming: Row[] | null; past: Row[] | null; counts: Row[] | null }>("events.json");
  const [when, setWhen] = useState<"upcoming" | "past">("upcoming");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Events," em="where they show up." lede="Public organizing events from Mobilize, events campaigns and PACs paid for in their FEC filings, and anything logged by hand. Mobilize is used mostly by Democratic and progressive groups; campaign paid events cover both parties." />
      <div className="wd-chips lg-wins">{(["upcoming", "past"] as const).map((k) => <button key={k} type="button" className={when === k ? "on" : ""} onClick={() => setWhen(k)}>{k === "upcoming" ? "Coming up" : "Past"}</button>)}</div>
      <Gate r={r}>{(e) => (
        <Card title={when === "upcoming" ? "Coming up" : "Past events"}>
          <ul className="lg-events">{(e[when] ?? []).map((x, i) => (
            <li key={i}><span className="mono">{day(x.starts_at ?? x.date ?? x.start)}</span><div><b>{String(x.title ?? x.name ?? "")}</b><small>{[x.city, x.state].filter(Boolean).join(", ")}{x.source ? ` · ${String(x.source)}` : ""}{x.host ? ` · ${String(x.host)}` : ""}</small></div>{x.url ? <a className="lg-link" href={String(x.url)} target="_blank" rel="noreferrer">Details</a> : null}</li>
          ))}{!(e[when] ?? []).length ? <li className="wd-empty">No events in this snapshot.</li> : null}</ul>
        </Card>
      )}</Gate>
    </>
  );
}

/* ------------------------------------------------------------------ states */
export function StatesView() {
  const r = useLedger<{ metrics: Row[] | null; totals: Record<string, Row> | null }>("states.json");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Every state," em="money and races." lede="Money raised and outside money in each state's races, the committees and groups based there, its 2020 and 2024 results, the Senate and governor seats up this year, and state campaign finance where the state publishes a feed." />
      <Gate r={r}>{(s) => (
        <Card title="States">
          <Table rows={(s.metrics ?? []).map((m) => ({ ...m, stateMoney: Number(s.totals?.[String(m.code)]?.total ?? 0) }) as Row)} initial="outside" limit={60} cols={[
            { key: "name", label: "State", render: (x) => <Link className="lg-link" href={href.state(String(x.code))}>{String(x.name)}</Link> },
            { key: "raised", label: "Raised", num: true, render: (x) => usd(x.raised) },
            { key: "outside", label: "Outside money", num: true, render: (x) => usd(x.outside) },
            { key: "stateMoney", label: "State money", num: true, render: (x) => usd(x.stateMoney) },
            { key: "committees", label: "Committees", num: true },
            { key: "pres24", label: "2024", num: true, render: (x) => x.pres24 == null ? "" : Number(x.pres24) > 0 ? `R+${(Number(x.pres24) * 100).toFixed(1)}` : `D+${(-Number(x.pres24) * 100).toFixed(1)}` },
            { key: "seats", label: "Up in 2026", render: (x) => [x.sen ? "Senate" : null, x.gov ? "Governor" : null].filter(Boolean).join(", "), sort: (x) => Number(!!x.sen) + Number(!!x.gov) },
          ]} />
        </Card>
      )}</Gate>
    </>
  );
}

export function StateView() {
  const code = (useSearchParams().get("code") ?? "").toUpperCase();
  const r = useLedger<{ code: string; detail: Row | null; panel: Row | null; counties: Row[] | null; tape: Row[] | null }>(code ? `state/${code}.json` : null);
  return (
    <Gate r={r} what="This state">{(s) => {
      const p = (s.panel ?? {}) as Row;
      const det = (s.detail ?? {}) as Row;
      const fed = (det.federalFromState ?? {}) as Row;
      return (
        <>
          <Head eye="Watchdog · Ledger · State" title={String(p.name ?? code)} lede={`${usd(fed.total)} given to federal committees by ${int(fed.donors)} donors in the state.`}
            right={<div className="lg-btns"><Link className="btn sm" href={`/watchdog/counties`}>County data center</Link><Link className="btn sm" href={`/forecast/${code.toLowerCase()}/senate`}>Forecast</Link></div>} />
          <div className="lg-grid2">
            <Card title="Candidates with the most money"><Table rows={(p.topCandidates ?? []) as Row[]} initial="receipts" cols={[
              { key: "name", label: "Candidate", render: (x) => <EntityLink kind="candidate" id={String(x.id)} className={side(x.party)}>{String(x.name)}</EntityLink> },
              { key: "office", label: "Race", render: (x) => officeLabel(x.office, code, x.district) }, { key: "receipts", label: "Raised", num: true, render: (x) => usd(x.receipts) },
            ]} /></Card>
            <Card title="Races"><ul className="lg-chips">{((p.races ?? []) as Row[]).map((x) => <li key={String(x.key)}><Link className="lg-link" href={href.race(String(x.key))}>{String(x.label)}</Link><small>{usd(x.outside)} outside</small></li>)}</ul></Card>
          </div>
          <div className="lg-grid2">
            <Card title="Committees based here"><AutoTable rows={(p.topCommittees ?? []) as Row[]} empty="None in the snapshot." /></Card>
            <Card title="State campaign finance"><AutoTable rows={(det.topRecipients ?? []) as Row[]} empty="This state's own money feed is not loaded." /></Card>
          </div>
          <Card title="Counties" right="Results, shift and how far each voted from its profile">
            <Table rows={(s.counties ?? []) as Row[]} initial="" limit={40} cols={[
              { key: "name", label: "County" },
              { key: "r24", label: "2024", num: true, render: (x) => { const v = Number(((x.results ?? {}) as Row)["2024"] ?? NaN); return Number.isFinite(v) ? (v > 0 ? `R+${(v * 100).toFixed(1)}` : `D+${(-v * 100).toFixed(1)}`) : ""; }, sort: (x) => Number(((x.results ?? {}) as Row)["2024"] ?? 0) },
              { key: "shift", label: "Shift since 2020", num: true, render: (x) => x.shift == null ? "" : `${Number(x.shift) > 0 ? "R" : "D"} ${(Math.abs(Number(x.shift)) * 100).toFixed(1)}` },
              { key: "residual", label: "Off its profile", num: true, render: (x) => x.residual == null ? "" : pct(x.residual, 1) },
              { key: "donors", label: "Local donors", num: true, render: (x) => { const d = (x.donors ?? null) as Row | null; return d ? `${usd(d.dem)} D · ${usd(d.rep)} R` : ""; }, sort: (x) => Number(((x.donors ?? {}) as Row).dem ?? 0) + Number(((x.donors ?? {}) as Row).rep ?? 0) },
            ]} />
          </Card>
          <Card title="On the tape"><Tape items={s.tape ?? []} limit={20} /></Card>
        </>
      );
    }}</Gate>
  );
}

/* ------------------------------------------------------------------ the money web */
const KMAP: Record<string, GNode["kind"]> = { candidate: "candidate", committee: "committee", donor: "donor", vendor: "vendor", group: "group" };
const EMAP: Record<string, string> = { for: "support", against: "oppose", gave: "gave", pac_gift: "gave", paid: "paid", runs: "runs", sponsors: "runs", operates: "runs" };
function toGraph(g: { nodes: Row[]; edges: Row[] }): Graph {
  const sideOf = (s: unknown) => { const x = side(s); return x === "d" ? "D" : x === "r" ? "R" : x === "i" ? "I" : null; };
  const nodes: GNode[] = g.nodes.map((n) => ({ id: String(n.key), kind: KMAP[String(n.kind)] ?? "committee", name: String(n.label ?? n.id), side: sideOf(n.side) as GNode["side"], what: n.kind === "vendor" ? "vendor" : undefined }));
  const edges: GEdge[] = g.edges.map((e) => ({ s: String(e.source), t: String(e.target), k: EMAP[String(e.kind)] ?? String(e.kind), v: e.value == null ? null : Number(e.value), n: 1, notes: [], src: "Ledger" }));
  return { nodes, edges };
}
export function WebView() {
  const ref = useSearchParams().get("ref");
  const r = useLedger<{ nodes: Row[]; edges: Row[] }>("web_all.json");
  const webs = useLedger<{ ref: string; name: string | null }[]>("webs.json");
  const graph = useMemo(() => (r.data ? toGraph(r.data) : null), [r.data]);
  const first = ref && graph?.nodes.some((n) => n.id === ref) ? ref : (webs.data?.find((w) => graph?.nodes.some((n) => n.id === w.ref))?.ref ?? graph?.nodes[0]?.id);
  return (
    <>
      <Head eye="Watchdog · Ledger" title="The money" em="web." lede="Every donor, committee, candidate, vendor and group around any name in the Ledger snapshot, and how the money moved between them. Pick a name, then click any body to follow its own web." />
      <Gate r={r}>{() => graph && first ? <Connections key={first} graph={graph} initial={first} /> : <div className="wd-empty">No connection webs in this snapshot.</div>}</Gate>
      {webs.data?.length ? <Card title="Start from"><ul className="lg-chips">{webs.data.slice(0, 60).map((w) => <li key={w.ref}><Link className="lg-link" href={href.web(w.ref)}>{w.name ?? w.ref}</Link><small>{w.ref.split(":")[0]}</small></li>)}</ul></Card> : null}
    </>
  );
}
export { partyShort };
