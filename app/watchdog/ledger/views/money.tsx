"use client";

import Link from "@/app/components/Link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AutoTable, Bar, CAT_LABEL, Card, EntityLink, Gate, Head, KIND_LABEL, Kpis, SideSplit, Tape, Table, day, hasPage, href, int, pct, safeName, side, usd, useLedger, useMeta, type Row } from "../lib";

const TIER: Record<string, string> = { mega: "Mega donor", major: "Major donor", mid: "Mid donor", small: "Small donor" };

export function CommitteesView() {
  const r = useLedger<{ id: string; name: string; kind: string | null; party: string | null }[]>("committees.json");
  const [qq, setQ] = useState("");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Committees," em="super PACs and campaigns." lede="Every committee in the snapshot with its own page: what it raised, from whom, whom it spent for and against, which firms it paid, and how open it is about its donors." />
      <div className="en-bar"><input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a committee" aria-label="Search committees" /></div>
      <Gate r={r}>{(rows) => (
        <div className="lg-tiles">{rows.filter((c) => !qq || c.name.toLowerCase().includes(qq.toLowerCase())).map((c) => (
          <Link key={c.id} href={href.committee(c.id)} className={`card lg-tile ${side(c.party)}`}><b>{c.name}</b><small>{KIND_LABEL[c.kind ?? ""] ?? (c.kind ?? "Committee").replace(/_/g, " ")}{c.party ? ` · ${c.party}` : ""}</small></Link>
        ))}</div>
      )}</Gate>
    </>
  );
}

export function CommitteeView() {
  const id = useSearchParams().get("id") ?? "";
  const r = useLedger<Row>(id ? `committee/${safeName(id)}.json` : null);
  return (
    <Gate r={r} what="This committee">{(d) => {
      const data = (d.data ?? {}) as Row;
      const c = (data.committee ?? {}) as Row;
      const t = (data.totals ?? {}) as Row;
      const tr = (d.transparency ?? null) as { grade: string; reason: string; darkness: number } | null;
      const sp = (d.spending ?? {}) as { byCategory?: { category: string; total: number }[]; topVendors?: Row[] };
      const maxC = Math.max(1, ...(sp.byCategory ?? []).map((x) => Number(x.total)));
      return (
        <>
          <Head eye={`Watchdog · Ledger · ${KIND_LABEL[String(c.kind)] ?? "Committee"}`} title={String(c.name ?? id)} lede={[data.lean ? `Spends mostly to help ${data.lean === "DEM" ? "Democrats" : data.lean === "REP" ? "Republicans" : String(data.lean)}` : null, c.state ? `based in ${c.state}` : null].filter(Boolean).join(", ")}
            right={<div className="lg-btns"><Link className="btn sm" href={href.web(`committee:${id}`)}>Trace the money web</Link>{/^fec:C/.test(id) ? <a className="btn sm" href={`https://www.fec.gov/data/committee/${id.replace(/^fec:/, "")}/`} target="_blank" rel="noreferrer">FEC page</a> : null}</div>} />
          <Kpis items={[
            { k: "Raised", v: usd(t.raised), s: `${int(t.donors)} donors · ${usd(t.raised_30)} in 30 days` },
            { k: "Outside spending", v: usd(t.spent_ie), s: "for and against candidates" },
            { k: "Donor transparency", v: tr?.grade ?? "n/a", s: tr?.reason ?? "" },
            { k: "Hidden money share", v: tr ? pct(tr.darkness) : "n/a", s: "from groups that do not name donors" },
          ]} />
          <div className="lg-grid2">
            <Card title="Who it spent for and against">
              <Table rows={(data.targets ?? []) as Row[]} initial="support" cols={[
                { key: "candidate_name", label: "Candidate", render: (x) => <EntityLink kind="candidate" id={x.candidate_id as string} className={side(x.party)}>{String(x.candidate_name)}</EntityLink> },
                { key: "support", label: "For", num: true, render: (x) => usd(x.support) },
                { key: "oppose", label: "Against", num: true, render: (x) => usd(x.oppose) },
              ]} />
            </Card>
            <Card title="Top donors">
              <Table rows={(data.topDonors ?? []) as Row[]} initial="total" cols={[
                { key: "donor_name", label: "Donor", render: (x) => <EntityLink kind="donor" id={x.donor_id as string}>{String(x.donor_name)}</EntityLink> },
                { key: "employer", label: "Employer" },
                { key: "total", label: "Gave", num: true, render: (x) => usd(x.total) },
              ]} />
            </Card>
          </div>
          <div className="lg-grid2">
            <Card title="Where its money goes">
              <ul className="lg-bars">{(sp.byCategory ?? []).map((x) => <li key={x.category}><span>{CAT_LABEL[x.category] ?? x.category}</span><Bar v={Number(x.total)} max={maxC} cls="g" /><b className="mono">{usd(x.total)}</b></li>)}</ul>
              <h4 className="lg-h4">Firms it paid</h4>
              <Table rows={sp.topVendors ?? []} initial="total" limit={12} cols={[
                { key: "name", label: "Firm", render: (x) => <EntityLink kind="vendor" id={x.vendor_id as string}>{String(x.name)}</EntityLink> },
                { key: "category", label: "Work", render: (x) => CAT_LABEL[String(x.category)] ?? String(x.category ?? "") },
                { key: "total", label: "Paid", num: true, render: (x) => usd(x.total) },
              ]} />
            </Card>
            <Card title="On the tape"><Tape items={(d.tape ?? []) as Row[]} limit={20} /></Card>
          </div>
          {((data.filings ?? []) as Row[]).length ? <Card title="Filings"><AutoTable rows={data.filings as Row[]} prefer={["form_type", "title", "at"]} /></Card> : null}
        </>
      );
    }}</Gate>
  );
}

export function DonorsView() {
  const r = useLedger<{ rows: Row[]; tiers: Record<string, { n: number; total: number }> | null; recent: Row[] }>("donors.json");
  const meta = useMeta();
  const [tier, setTier] = useState("all");
  const [qq, setQ] = useState("");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="The donors," em="tier by tier." lede="People and companies ranked by what they have given this cycle, federal and state, with which side their money helps. ActBlue and WinRed pass throughs and memo lines are not double counted." />
      <Gate r={r}>{(d) => (
        <>
          <Kpis items={["mega", "major", "mid"].map((k) => ({ k: TIER[k] ?? k, v: int(d.tiers?.[k]?.n), s: `${usd(d.tiers?.[k]?.total)} given` })).concat([{ k: "In the snapshot", v: int(d.rows.length), s: "the biggest givers" }])} />
          <div className="en-bar">
            <div className="wd-chips" role="group" aria-label="Tier">{["all", "mega", "major", "mid"].map((t) => <button key={t} type="button" className={tier === t ? "on" : ""} aria-pressed={tier === t} onClick={() => setTier(t)}>{t === "all" ? "Every tier" : TIER[t]}</button>)}</div>
            <input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a donor or employer" aria-label="Search donors" />
          </div>
          <Card title="Donors">
            <Table rows={d.rows.filter((x) => (tier === "all" || x.tier === tier) && (!qq || `${x.name} ${x.employer ?? ""}`.toLowerCase().includes(qq.toLowerCase())))} initial="total" limit={80} cols={[
              { key: "name", label: "Donor", render: (x) => hasPage(meta.data, "donor", String(x.id)) ? <EntityLink kind="donor" id={String(x.id)}>{String(x.name)}</EntityLink> : String(x.name) },
              { key: "employer", label: "Employer or kind", render: (x) => String(x.employer ?? (x.kind === "organization" ? "Organization" : "")) },
              { key: "state", label: "State" },
              { key: "tier", label: "Tier", render: (x) => TIER[String(x.tier)] ?? String(x.tier ?? "") },
              { key: "total", label: "Given", num: true, render: (x) => usd(x.total) },
              { key: "txn_count", label: "Gifts", num: true },
              { key: "last_date", label: "Latest", render: (x) => day(x.last_date) },
            ]} />
          </Card>
        </>
      )}</Gate>
    </>
  );
}

export function DonorView() {
  const id = useSearchParams().get("id") ?? "";
  const r = useLedger<Row>(id ? `donor/${safeName(id)}.json` : null);
  return (
    <Gate r={r} what="This donor">{(d) => {
      const data = (d.data ?? {}) as Row;
      const x = (data.donor ?? {}) as Row;
      const s = (data.side ?? {}) as Record<string, number>;
      const monthly = (data.monthly ?? []) as { month: string; total: number }[];
      const maxM = Math.max(1, ...monthly.map((m) => Number(m.total)));
      return (
        <>
          <Head eye={`Watchdog · Ledger · ${TIER[String(x.tier)] ?? "Donor"}`} title={String(x.name ?? id)} lede={[x.occupation, x.employer, [x.city, x.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            right={<Link className="btn sm" href={href.web(`donor:${id}`)}>Trace the money web</Link>} />
          <Kpis items={[
            { k: "Given", v: usd(x.total), s: `${int(x.txn_count)} gifts since ${day(x.first_date)}` },
            { k: "Federal", v: usd(x.federal_total), s: "FEC filings" },
            { k: "State", v: usd(x.state_total), s: "state campaign finance feeds" },
            { k: "Helping", v: Number(s.DEM ?? 0) > Number(s.REP ?? 0) * 1.5 ? "Democrats" : Number(s.REP ?? 0) > Number(s.DEM ?? 0) * 1.5 ? "Republicans" : "Both sides", s: <SideSplit dem={Number(s.DEM ?? 0)} rep={Number(s.REP ?? 0)} other={Number(s.OTHER ?? 0) + Number(s.UNKNOWN ?? 0)} /> },
          ]} />
          <div className="lg-grid2">
            <Card title="Where the money went">
              <Table rows={(data.byRecipient ?? []) as Row[]} initial="total" cols={[
                { key: "recipient_name", label: "Recipient", render: (y) => <EntityLink kind="committee" id={y.recipient_id as string} className={side(y.party)}>{String(y.recipient_name)}</EntityLink> },
                { key: "kind", label: "Kind", render: (y) => KIND_LABEL[String(y.kind)] ?? String(y.kind ?? "") },
                { key: "jurisdiction", label: "Where" },
                { key: "total", label: "Gave", num: true, render: (y) => usd(y.total) },
                { key: "last", label: "Latest", render: (y) => day(y.last) },
              ]} />
            </Card>
            <Card title="By month">
              <div className="lg-months">{monthly.map((m) => <span key={m.month} title={`${m.month}: ${usd(m.total)}`}><i style={{ height: `${(Number(m.total) / maxM) * 100}%` }} /><small>{String(m.month).slice(5)}</small></span>)}</div>
            </Card>
          </div>
        </>
      );
    }}</Gate>
  );
}

export function VendorsView() {
  const r = useLedger<{ rows: Row[]; categories: { category: string; total: number; vendors: number }[] | null }>("vendors.json");
  const meta = useMeta();
  const [cat, setCat] = useState("all");
  const [qq, setQ] = useState("");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="The vendors," em="paid by both sides." lede="Every firm and person committees pay, by kind of work: TV and radio, digital, mail, signs and printing, production, polling, consulting, field, texts and calls, data, travel and staff. Each page shows every client and which party pays them." />
      <Gate r={r}>{(d) => {
        const maxC = Math.max(1, ...(d.categories ?? []).map((c) => Number(c.total)));
        return (
          <>
            <Card title="By kind of work">
              <ul className="lg-bars">{(d.categories ?? []).map((c) => <li key={c.category}><button type="button" className={`lg-barbtn${cat === c.category ? " on" : ""}`} onClick={() => setCat(cat === c.category ? "all" : c.category)}>{CAT_LABEL[c.category] ?? c.category}</button><Bar v={Number(c.total)} max={maxC} cls="g" /><b className="mono">{usd(c.total)}<small> · {int(c.vendors)} firms</small></b></li>)}</ul>
            </Card>
            <div className="en-bar"><input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a firm" aria-label="Search vendors" />{cat !== "all" ? <button type="button" className="wd-btn" onClick={() => setCat("all")}>Every kind</button> : null}</div>
            <Card title="Vendors">
              <Table rows={d.rows.filter((v) => (cat === "all" || v.category === cat) && (!qq || String(v.name).toLowerCase().includes(qq.toLowerCase())))} initial="total" limit={80} cols={[
                { key: "name", label: "Firm", render: (v) => hasPage(meta.data, "vendor", String(v.id)) ? <EntityLink kind="vendor" id={String(v.id)}>{String(v.name)}</EntityLink> : String(v.name) },
                { key: "category", label: "Work", render: (v) => CAT_LABEL[String(v.category)] ?? String(v.category ?? "") },
                { key: "where", label: "Where", render: (v) => [v.city, v.state].filter(Boolean).join(", "), sort: (v) => String(v.state ?? "") },
                { key: "total", label: "Paid", num: true, render: (v) => usd(v.total) },
                { key: "clients", label: "Clients", num: true },
                { key: "top_client", label: "Biggest client" },
              ]} />
            </Card>
          </>
        );
      }}</Gate>
    </>
  );
}

export function VendorView() {
  const id = useSearchParams().get("id") ?? "";
  const r = useLedger<Row>(id ? `vendor/${safeName(id)}.json` : null);
  return (
    <Gate r={r} what="This vendor">{(d) => {
      const data = (d.data ?? {}) as Row;
      const v = (data.vendor ?? {}) as Row;
      const s = (data.side ?? {}) as Record<string, number>;
      return (
        <>
          <Head eye={`Watchdog · Ledger · ${CAT_LABEL[String(v.category)] ?? "Vendor"}`} title={String(v.name ?? id)} lede={`${[v.city, v.state].filter(Boolean).join(", ")}${v.first_date ? ` · paid since ${day(v.first_date)}` : ""}`}
            right={<Link className="btn sm" href={href.web(`vendor:${id}`)}>Trace the money web</Link>} />
          <Kpis items={[
            { k: "Paid", v: usd(v.total), s: `${int(v.payments)} payments` },
            { k: "From Democrats", v: usd(s.DEM), s: "campaigns and allied groups" },
            { k: "From Republicans", v: usd(s.REP), s: "campaigns and allied groups" },
            { k: "Split", v: Number(s.DEM ?? 0) && Number(s.REP ?? 0) ? "Both sides" : Number(s.DEM ?? 0) ? "Democrats" : Number(s.REP ?? 0) ? "Republicans" : "n/a", s: <SideSplit dem={Number(s.DEM ?? 0)} rep={Number(s.REP ?? 0)} other={Number(s.OTHER ?? 0) + Number(s.UNKNOWN ?? 0)} /> },
          ]} />
          <div className="lg-grid2">
            <Card title="Clients">
              <Table rows={(data.clients ?? []) as Row[]} initial="total" cols={[
                { key: "name", label: "Client", render: (x) => <EntityLink kind="committee" id={x.recipient_id as string} className={side(x.side)}>{String(x.name)}</EntityLink> },
                { key: "kind", label: "Kind", render: (x) => KIND_LABEL[String(x.kind)] ?? String(x.kind ?? "") },
                { key: "total", label: "Paid", num: true, render: (x) => usd(x.total) },
                { key: "last", label: "Latest", render: (x) => day(x.last) },
              ]} />
              {((data.purposes ?? []) as Row[]).length ? <><h4 className="lg-h4">What for</h4><AutoTable rows={data.purposes as Row[]} prefer={["description", "total", "n"]} /></> : null}
            </Card>
            <Card title="On the tape"><Tape items={(d.tape ?? []) as Row[]} limit={20} /></Card>
          </div>
        </>
      );
    }}</Gate>
  );
}

export function GroupsView() {
  const r = useLedger<Row[]>("groups.json");
  const meta = useMeta();
  const [tag, setTag] = useState("all");
  const tags = useMemo(() => [...new Set((r.data ?? []).flatMap((g) => (g.tags as string[] | undefined) ?? []))].sort(), [r.data]);
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Nonprofits, unions" em="and trade groups." lede="Politically active groups across the spectrum, each matched to its IRS 990 filings, the committees it runs, the committees it gives to and its lobbying, with a donor transparency grade." />
      <Gate r={r}>{(rows) => rows.length ? (
        <>
          <div className="en-bar"><div className="wd-chips">{["all", ...tags].map((t) => <button key={t} type="button" className={tag === t ? "on" : ""} onClick={() => setTag(t)}>{t === "all" ? "Every group" : t}</button>)}</div></div>
          <Card title="Groups">
            <Table rows={rows.filter((g) => tag === "all" || ((g.tags as string[]) ?? []).includes(tag))} initial="revenue" cols={[
              { key: "name", label: "Group", render: (g) => hasPage(meta.data, "group", String(g.id)) ? <EntityLink kind="group" id={String(g.id)}>{String(g.name)}</EntityLink> : String(g.name) },
              { key: "subsection", label: "Type", render: (g) => g.subsection ? `501(c)(${g.subsection})` : "" },
              { key: "state", label: "State" },
              { key: "revenue", label: "Revenue", num: true, render: (g) => usd(g.revenue) },
              { key: "assets", label: "Assets", num: true, render: (g) => usd(g.assets) },
              { key: "tags", label: "Tags", render: (g) => ((g.tags as string[]) ?? []).join(", ") },
            ]} />
          </Card>
        </>
      ) : <div className="card lg-missing"><b>No groups in this snapshot.</b><p>Open the Groups page in Ledger once to load the starter list of about fifty groups, then export again.</p></div>}</Gate>
    </>
  );
}

export function GroupView() {
  const id = useSearchParams().get("id") ?? "";
  const r = useLedger<Row>(id ? `group/${safeName(id)}.json` : null);
  return (
    <Gate r={r} what="This group">{(d) => {
      const data = (d.data ?? {}) as Row;
      const g = (data.group ?? {}) as Row;
      const grade = (data.grade ?? null) as { grade?: string; reason?: string } | null;
      return (
        <>
          <Head eye="Watchdog · Ledger · Group" title={String(g.name ?? id)} lede={[g.subsection ? `501(c)(${g.subsection})` : null, g.ein ? `EIN ${g.ein}` : null, [g.city, g.state].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}
            right={<Link className="btn sm" href={href.web(`group:${id}`)}>Trace the money web</Link>} />
          <Kpis items={[
            { k: "Revenue", v: usd(g.revenue), s: g.tax_period ? `tax period ${g.tax_period}` : "" },
            { k: "Assets", v: usd(g.assets), s: "" },
            { k: "Donor transparency", v: grade?.grade ?? "n/a", s: grade?.reason ?? "" },
            { k: "Committees run", v: int(((data.committees ?? []) as Row[]).length), s: "" },
          ]} />
          <div className="lg-grid2">
            <Card title="IRS filings"><AutoTable rows={data.filings as Row[]} prefer={["tax_year", "form", "revenue", "expenses", "contributions"]} /></Card>
            <Card title="Committees it runs"><AutoTable rows={data.committees as Row[]} prefer={["name", "kind", "raised", "spent", "ie"]} /></Card>
          </div>
          <div className="lg-grid2">
            <Card title="Candidates it spent on"><AutoTable rows={data.targets as Row[]} prefer={["name", "party", "so", "total"]} /></Card>
            <Card title="Lobbying"><AutoTable rows={data.lobbying as Row[]} prefer={["registrant", "year", "period", "expenses", "income"]} /></Card>
          </div>
          <Card title="Gifts to political committees"><AutoTable rows={data.gave as Row[]} prefer={["name", "kind", "total"]} /></Card>
        </>
      );
    }}</Gate>
  );
}
