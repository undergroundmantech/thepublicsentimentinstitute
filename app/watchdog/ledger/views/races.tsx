"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { AutoTable, Bar, Card, EntityLink, Gate, Head, Kpis, Meter, Missing, OFFICE, Tape, Table, day, hasPage, href, int, officeLabel, partyShort, pct, safeName, side, usd, useLedger, useMeta, type Row } from "../lib";

type Race = { key: string; label: string; office: string; state: string; district: string; candidates: { id: string; name: string; party: string | null; receipts: number; cash: number; nominee: boolean }[]; outside: number; raised: number; detail?: boolean };
const forecastHref = (office: string, st: string, d: string) => office === "S" ? `/forecast/${st.toLowerCase()}/senate` : office === "G" ? `/forecast/${st.toLowerCase()}/governor` : office === "H" ? `/forecast/${st.toLowerCase()}/house-${Number(d || 1)}` : null;

export function RacesView() {
  const r = useLedger<Race[]>("races.json");
  const [office, setOffice] = useState("S");
  const [qq, setQ] = useState("");
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Every race," em="by the money." lede="Every Senate and House race with money this cycle and all 36 governor races: who has raised what, who has cash left and how much outside money has come in. Open a race for the side by side health and Ledger Scores." />
      <div className="en-bar">
        <div className="wd-chips" role="group" aria-label="Office">{["S", "G", "H"].map((o) => <button key={o} type="button" className={office === o ? "on" : ""} aria-pressed={office === o} onClick={() => setOffice(o)}>{OFFICE[o]}</button>)}</div>
        <input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a state or candidate" aria-label="Search races" />
      </div>
      <Gate r={r}>{(races) => {
        const rows = races.filter((x) => x.office === office && (!qq || `${x.label} ${x.candidates.map((c) => c.name).join(" ")}`.toLowerCase().includes(qq.toLowerCase())));
        const max = Math.max(1, ...rows.map((x) => x.raised));
        return (
          <div className="lg-races">
            {rows.map((x) => {
              const top = x.candidates.slice(0, 3);
              return (
                <article key={x.key} className="card lg-race">
                  <div className="lg-rh">{x.detail ? <Link href={href.race(x.key)} className="lg-link"><b>{x.label}</b></Link> : <b>{x.label}</b>}<span className="mono">{usd(x.raised)} raised · {usd(x.outside)} outside</span></div>
                  <Bar v={x.raised} max={max} cls="g" />
                  <ul>{top.map((c) => (
                    <li key={c.id}><EntityLink kind="candidate" id={c.id} className={side(c.party)}>{c.name}</EntityLink>{c.nominee ? <span className="wd-pill g">Nominee</span> : null}<span className="mono">{usd(c.receipts)}<small> raised · {usd(c.cash)} cash</small></span></li>
                  ))}</ul>
                </article>
              );
            })}
            {!rows.length ? <div className="wd-empty">No races match.</div> : null}
          </div>
        );
      }}</Gate>
    </>
  );
}

type Score = { health: number | null; healthLabel: string | null; ledger: number | null; grade: string | null } | null;
export function RaceView() {
  const key = useSearchParams().get("key") ?? "";
  const r = useLedger<{ race: Race; field: Row[]; scores: Record<string, Score>; info: Row | null; earlyVote: Row | null }>(key ? `race/${safeName(key)}.json` : null);
  return (
    <Gate r={r} what="This race">{(d) => {
      const fc = forecastHref(d.race.office, d.race.state, d.race.district);
      const field = [...d.field].sort((a, b) => Number(b.nominee ?? 0) - Number(a.nominee ?? 0) || Number(b.receipts ?? 0) - Number(a.receipts ?? 0));
      const maxR = Math.max(1, ...field.map((c) => Number(c.receipts ?? 0)));
      return (
        <>
          <Head eye="Watchdog · Ledger · Race" title={d.race.label} lede={d.info ? <>Held by {String(d.info.incumbent ?? "no one")}{d.info.incumbent_party ? `, ${partyShort(d.info.incumbent_party)}` : ""}. {d.info.status === "open" || d.info.status === "term_limited" ? "Open seat." : ""} {String(d.info.note ?? "")}</> : `${usd(d.race.raised)} raised and ${usd(d.race.outside)} in outside money.`}
            right={fc ? <Link href={fc} className="btn sm">On Point forecast for this race</Link> : null} />
          <div className="lg-field">
            {field.map((c) => {
              const s = d.scores[String(c.id)];
              return (
                <article key={String(c.id)} className={`card lg-cand ${side(c.party)}`}>
                  <div className="lg-ch"><EntityLink kind="candidate" id={String(c.id)}><b>{String(c.name)}</b></EntityLink><span className="wd-pill">{partyShort(c.party)}{c.nominee ? " · nominee" : " · not on the ballot"}</span></div>
                  <div className="lg-meters"><Meter kind="health" score={s?.health} label={s?.healthLabel} /><Meter kind="ledger" score={s?.ledger} label={s?.grade} /></div>
                  <div className="lg-money"><span>Raised <b className="mono">{usd(c.receipts)}</b></span><span>Cash <b className="mono">{usd(c.cash_on_hand)}</b></span><span>Debt <b className="mono">{usd(c.debts)}</b></span></div>
                  <Bar v={Number(c.receipts ?? 0)} max={maxR} cls={side(c.party)} />
                  {c.money_url ? <a className="lg-src" href={String(c.money_url)} target="_blank" rel="noreferrer">State report</a> : null}
                </article>
              );
            })}
          </div>
          {d.earlyVote ? <Card title="Early vote in the state" right="civicAPI, party means registration"><AutoTable rows={[d.earlyVote]} /></Card> : null}
          <p className="wd-src">Health is a campaign&apos;s position today, not a forecast. Ledger Score is higher when cleaner, and flags patterns to check, not wrongdoing.</p>
        </>
      );
    }}</Gate>
  );
}

export function CandidatesView() {
  const r = useLedger<Row[]>("candidates.json");
  const meta = useMeta();
  const [office, setOffice] = useState("S");
  const [st, setSt] = useState("");
  const [qq, setQ] = useState("");
  const states = useMemo(() => [...new Set((r.data ?? []).map((c) => String(c.state ?? "")))].filter(Boolean).sort(), [r.data]);
  return (
    <>
      <Head eye="Watchdog · Ledger" title="Candidates," em="money first." lede="Every candidate with money on file: raised, spent, cash on hand, debt and outside money for and against them. Names with a page open to their health, Ledger Score, donors, outside groups and timeline." />
      <div className="en-bar">
        <div className="wd-chips" role="group" aria-label="Office">{["S", "G", "H", "P"].map((o) => <button key={o} type="button" className={office === o ? "on" : ""} aria-pressed={office === o} onClick={() => setOffice(o)}>{OFFICE[o]}</button>)}</div>
        <select className="wd-input en-st-sel" value={st} onChange={(e) => setSt(e.target.value)} aria-label="State"><option value="">Every state</option>{states.map((s) => <option key={s}>{s}</option>)}</select>
        <input className="wd-input en-q" value={qq} onChange={(e) => setQ(e.target.value)} placeholder="Search a name" aria-label="Search candidates" />
      </div>
      <Gate r={r}>{(rows) => (
        <Card title="Candidates" right="Sort any column">
          <Table rows={rows.filter((c) => c.office === office && (!st || c.state === st) && (!qq || String(c.name).toLowerCase().includes(qq.toLowerCase())))} initial="receipts" limit={80} cols={[
            { key: "name", label: "Candidate", render: (c) => hasPage(meta.data, "candidate", String(c.id)) ? <EntityLink kind="candidate" id={String(c.id)} className={side(c.party)}>{String(c.name)}</EntityLink> : <span className={side(c.party)}>{String(c.name)}</span>, sort: (c) => String(c.name) },
            { key: "race", label: "Race", render: (c) => officeLabel(c.office, c.state, c.district), sort: (c) => `${c.state}${c.district}` },
            { key: "receipts", label: "Raised", num: true, render: (c) => usd(c.receipts) },
            { key: "cash_on_hand", label: "Cash", num: true, render: (c) => usd(c.cash_on_hand) },
            { key: "debts", label: "Debt", num: true, render: (c) => usd(c.debts) },
            { key: "ie_support", label: "Outside for", num: true, render: (c) => usd(c.ie_support) },
            { key: "ie_oppose", label: "Outside against", num: true, render: (c) => usd(c.ie_oppose) },
          ]} />
        </Card>
      )}</Gate>
    </>
  );
}

type Part = { key: string; label: string; value: number | null; weight: number; reasons: string[] };
export function CandidateView() {
  const id = useSearchParams().get("id") ?? "";
  const r = useLedger<Row>(id ? `candidate/${safeName(id)}.json` : null);
  return (
    <Gate r={r} what="This candidate">{(d) => {
      const data = (d.data ?? {}) as Row;
      const c = (data.candidate ?? {}) as Row;
      const h = (d.health ?? null) as { score: number | null; base: number | null; label: string; parts: Part[]; penalties: { label: string; points: number; reason: string }[]; rival: { id: string; name: string; party: string } | null } | null;
      const ls = (d.ledgerScore ?? null) as { score: number | null; grade: string; parts: { part: string; label: string; points: number; max: number }[]; deductions: { label: string; points: number; max: number; reasons: string[] }[]; credits: { label: string; points: number; reason: string }[]; notes: string[]; missing: string[]; record?: Row } | null;
      const name = String(c.name ?? id);
      const fc = c.office ? forecastHref(String(c.office), String(c.state ?? ""), String(c.district ?? "")) : null;
      const raceKey = c.office ? `${c.office}:${c.state}:${c.office === "H" ? String(c.district ?? "") : ""}` : null;
      const rec = (ls?.record ?? null) as { legislator?: Row | null; stats?: Row | null; recent?: Row[]; conflicts?: Row[] } | null;
      const watch = (d.watchdog ?? {}) as { cases?: Row[]; stocks?: Row[]; releases?: Row[] };
      const ieDaily = (data.ieDaily ?? []) as { day: string; support: number; oppose: number }[];
      const maxD = Math.max(1, ...ieDaily.map((x) => Number(x.support) + Number(x.oppose)));
      return (
        <>
          <Head eye={`Watchdog · Ledger · ${officeLabel(c.office, c.state, c.district)}`} title={name}
            lede={[partyShort(c.party), c.incumbent_challenge === "I" ? "Incumbent" : c.incumbent_challenge === "C" ? "Challenger" : c.incumbent_challenge === "O" ? "Open seat" : null, c.coverage_end ? `money through ${day(c.coverage_end)}` : null].filter(Boolean).join(", ")}
            right={<div className="lg-btns">
              <Link className="btn sm" href={href.web(`candidate:${id}`)}>Trace the money web</Link>
              {raceKey ? <Link className="btn sm" href={href.race(raceKey)}>The race</Link> : null}
              {fc ? <Link className="btn sm" href={fc}>On Point forecast</Link> : null}
              {/^[HSP]\d/.test(id) ? <a className="btn sm" href={`https://www.fec.gov/data/candidate/${encodeURIComponent(id)}/`} target="_blank" rel="noreferrer">FEC page</a> : null}
            </div>} />
          {d.briefing ? <div className="card lg-brief"><span className="eye gold">Read on air</span><p>{String(d.briefing)}</p></div> : null}
          <Kpis items={[
            { k: "Raised", v: usd(c.receipts), s: `${usd(c.disbursements)} spent` },
            { k: "Cash on hand", v: usd(c.cash_on_hand), s: c.prev_cash_on_hand != null ? `${Number(c.cash_on_hand) >= Number(c.prev_cash_on_hand) ? "up" : "down"} ${usd(Math.abs(Number(c.cash_on_hand) - Number(c.prev_cash_on_hand)))} since the last report` : "" },
            { k: "Outside for", v: usd(c.ie_support), s: "super PACs and groups helping" },
            { k: "Outside against", v: usd(c.ie_oppose), s: "groups attacking" },
          ]} />
          <div className="lg-grid2">
            <Card title="Campaign health" right={h?.rival ? <>Against <EntityLink kind="candidate" id={h.rival.id}>{h.rival.name}</EntityLink></> : null}>
              <div className="lg-scorehead"><Meter kind="health" score={h?.score} label={h?.label} /><p>Money and cash against the strongest rival, cash momentum, outside help against outside attacks, the early vote and recent activity. It describes position today, not a forecast.</p></div>
              <ul className="lg-parts">{(h?.parts ?? []).map((p) => {
                // parts come as 0 to 1 shares in Ledger; show them on the same 0 to 100 scale as the score
                const v = p.value == null ? null : Math.abs(p.value) <= 1 ? p.value * 100 : p.value;
                return <li key={p.key}><span><b>{p.label}</b><small>{p.reasons?.[0] ?? ""}</small></span><Bar v={Number(v ?? 0)} max={100} cls={Number(v ?? 0) >= 60 ? "ok" : Number(v ?? 0) >= 40 ? "mid" : "bad"} /><b className="mono">{v == null ? "n/a" : Math.round(v)}</b></li>;
              })}</ul>
              {h?.penalties?.length ? <ul className="lg-pen">{h.penalties.map((p, i) => <li key={i}><b>Minus {p.points}</b> {p.label}: {p.reason}</li>)}</ul> : null}
            </Card>
            <Card title="Ledger Score" right="Higher is cleaner">
              <div className="lg-scorehead"><Meter kind="ledger" score={ls?.score} label={ls?.grade} /><p>Starts at 100. Points come off for money from groups that hide their donors, reliance on PAC and lobbyist money, votes that followed PAC donors, and watchdog findings. A flag to check, not a finding of wrongdoing.</p></div>
              <ul className="lg-parts">{(ls?.deductions ?? []).map((x, i) => <li key={i}><span><b>{x.label}</b><small>{x.reasons?.[0] ?? ""}</small></span><Bar v={x.points} max={x.max || 1} cls="bad" /><b className="mono">-{x.points}</b></li>)}</ul>
              {ls?.credits?.length ? <ul className="lg-cred">{ls.credits.map((x, i) => <li key={i}><b>+{x.points}</b> {x.label}: {x.reason}</li>)}</ul> : null}
              {ls?.notes?.length ? <p className="wd-note">{ls.notes.join(" · ")}</p> : null}
              {ls?.missing?.length ? <p className="wd-note">Not enough data yet for: {ls.missing.join(", ")}.</p> : null}
            </Card>
          </div>
          <div className="lg-grid2">
            <Card title="Outside groups in the race" right="For and against">
              <Table rows={(data.ieBySpender ?? []) as Row[]} initial="support" limit={15} cols={[
                { key: "recipient_name", label: "Group", render: (x) => <EntityLink kind="committee" id={x.recipient_id as string}>{String(x.recipient_name)}</EntityLink> },
                { key: "support", label: "For", num: true, render: (x) => usd(x.support) },
                { key: "oppose", label: "Against", num: true, render: (x) => usd(x.oppose) },
                { key: "last", label: "Latest", render: (x) => day(x.last) },
              ]} />
              {ieDaily.length ? <div className="lg-days" aria-label="Outside money by day">{ieDaily.slice(-40).map((x, i) => <span key={i} title={`${x.day}: ${usd(x.support)} for, ${usd(x.oppose)} against`}><i className="s" style={{ height: `${(Number(x.support) / maxD) * 100}%` }} /><i className="o" style={{ height: `${(Number(x.oppose) / maxD) * 100}%` }} /></span>)}</div> : null}
            </Card>
            <Card title="Top donors">
              <Table rows={(data.topDonors ?? []) as Row[]} initial="total" limit={15} cols={[
                { key: "donor_name", label: "Donor", render: (x) => <EntityLink kind="donor" id={x.donor_id as string}>{String(x.donor_name)}</EntityLink> },
                { key: "employer", label: "Employer" },
                { key: "total", label: "Gave", num: true, render: (x) => usd(x.total) },
                { key: "n", label: "Gifts", num: true },
              ]} />
            </Card>
          </div>
          <div className="lg-grid2">
            <Card title="Timeline" right="Filings, firms hired, groups jumping in, ads, headlines">
              <ol className="lg-time">{((d.timeline ?? []) as Row[]).map((t, i) => <li key={i}><span className="mono">{day(t.date)}</span><p>{t.href ? <a href={String(t.href)} className="lg-link">{String(t.text)}</a> : String(t.text)}</p></li>)}</ol>
            </Card>
            <Card title="On the tape"><Tape items={(d.tape ?? []) as Row[]} limit={20} /></Card>
          </div>
          {rec?.legislator ? (
            <Card title="Voting record" right="Voteview roll calls">
              {rec.stats ? <AutoTable rows={[rec.stats]} /> : null}
              {rec.conflicts?.length ? <><h4 className="lg-h4">Votes that went the way PAC donors lobbied</h4><AutoTable rows={rec.conflicts} /></> : null}
              {rec.recent?.length ? <><h4 className="lg-h4">Recent votes</h4><AutoTable rows={rec.recent} limit={12} /></> : null}
            </Card>
          ) : null}
          {(watch.cases?.length || watch.stocks?.length || watch.releases?.length) ? (
            <Card title="Watchdog record" right="Leads to check, matched by name until confirmed">
              {watch.cases?.length ? <><h4 className="lg-h4">FEC enforcement</h4><AutoTable rows={watch.cases} /></> : null}
              {watch.releases?.length ? <><h4 className="lg-h4">Justice Department releases</h4><AutoTable rows={watch.releases} /></> : null}
              {watch.stocks?.length ? <><h4 className="lg-h4">Stock trade reports</h4><AutoTable rows={watch.stocks} /></> : null}
            </Card>
          ) : null}
          <Card title="Committees">
            <ul className="lg-chips">{((data.committees ?? []) as Row[]).map((x) => <li key={String(x.id)}><EntityLink kind="committee" id={String(x.id)}>{String(x.name)}</EntityLink><small>{String(x.kind ?? "").replace(/_/g, " ")}</small></li>)}</ul>
          </Card>
          <p className="wd-src">From Ledger&apos;s snapshot of FEC filings and the other feeds it reads. Party share uses each committee&apos;s filings; donor identity is matched on name and state, which can merge or split people with the same name.</p>
        </>
      );
    }}</Gate>
  );
}
export { Missing, int, pct };
