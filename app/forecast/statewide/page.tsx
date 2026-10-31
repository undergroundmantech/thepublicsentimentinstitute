import type { Metadata } from "next";
import Link from "@/app/components/Link";
import ForecastNav from "@/app/components/opp/ForecastNav";
import { RATING_LABEL, fmtM, lastName, rating, ratingPill } from "@/app/lib/opp";
import { OFFICE_ORDER, dbHref, getDownballot, type DBRace } from "./data";
import { seo } from "@/app/lib/seo";
import JsonLd from "@/app/components/JsonLd";
import { statewideLd } from "../seo";

export const metadata: Metadata = seo({"title": "2026 statewide offices forecast: attorney general, secretary of state and more", "description": "County by county On Point Politics forecasts for every 2026 partisan statewide race: lieutenant governor, attorney general, secretary of state, treasurer, auditor, comptroller, superintendent, insurance, labor, land and agriculture commissioners, utility commissions, education boards and partisan supreme court seats.", "path": "/forecast/statewide"});

function Row({ r }: { r: DBRace }) {
  const m = r.est.margin;
  if (r.uncontested) {
    const who = r.uncontested === "D" ? r.dem : r.gop;
    return (
      <tr>
        <td><Link href={dbHref(r)}>{r.state}{r.slug && r.slug !== r.office ? <span style={{ color: "var(--mute)", fontSize: 12 }}> · {r.seat ?? r.officeLabel}</span> : null}</Link></td>
        <td style={{ color: "var(--ink2)" }}>{who} runs without a {r.uncontested === "D" ? "Republican" : "Democratic"} opponent</td>
        <td><span className={`pill ${r.uncontested === "D" ? "d" : "r"}`}>Uncontested</span></td>
        <td className="n" /><td className="n" /><td className="n" />
      </tr>
    );
  }
  const rt = rating(m);
  const dWin = 1 - r.est.prob;
  return (
    <tr>
      <td><Link href={dbHref(r)}>{r.state}{r.slug && r.slug !== r.office ? <span style={{ color: "var(--mute)", fontSize: 12 }}> · {r.seat ?? r.officeLabel}</span> : null}</Link></td>
      <td><span className="d">{r.dem}</span> <span style={{ color: "var(--mute)" }}>vs</span> <span className="r">{r.gop}</span>{r.incRunning && r.incumbent ? <span style={{ color: "var(--mute)", fontSize: 12 }}> · {lastName(r.incumbent)} is the incumbent</span> : null}</td>
      <td><span className={`pill ${ratingPill(rt)}`}>{RATING_LABEL[rt]}</span></td>
      <td className={`n ${m < 0 ? "d" : "r"}`}>{fmtM(m)}</td>
      <td className="n">{Math.round(dWin * 100)}%</td>
      <td className="n">{r.polls.length || ""}</td>
    </tr>
  );
}

export default function StatewidePage() {
  const data = getDownballot();
  const updated = new Date(data.meta.updated + "T00:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const byOffice = OFFICE_ORDER.map((o) => ({
    office: o, label: data.meta.offices[o],
    races: data.races.filter((r) => r.office === o).sort((a, b) => (a.uncontested ? 1 : 0) - (b.uncontested ? 1 : 0) || Math.abs(a.est.margin) - Math.abs(b.est.margin)),
  })).filter((g) => g.races.length);
  const modeled = data.races.filter((r) => !r.uncontested);
  const dFav = modeled.filter((r) => r.est.margin < 0).length;
  const close = modeled.filter((r) => Math.abs(r.est.margin) < 6).length;
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Statewide offices</span>
      </nav>
      <ForecastNav />
      <JsonLd data={statewideLd()} />
      <header className="ph">
        <div className="eye g">2026 forecast</div>
        <h1>Statewide offices <em>forecast</em></h1>
        <p className="lede">
          Every 2026 partisan statewide race below the top of the ticket: lieutenant governor, attorney general, secretary of state,
          treasurer, auditor, comptroller, schools superintendent, insurance, labor, land and agriculture commissioners, utility
          commissions, the elected education boards, the partisan supreme court seats and Texas railroad commissioner, {data.races.length} in all, forecast county by county. Democrats are favored in {dFav} of the {modeled.length} contested
          races and {close} are within 6 points.
        </p>
        <div className="pmeta"><span>Updated <b>{updated}</b></span><span>Races <b className="mono">{data.races.length}</b></span><span>Contested <b className="mono">{modeled.length}</b></span></div>
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        {byOffice.map((g) => (
          <div className="card" key={g.office} id={g.office}>
            <div className="card-h"><h3>{g.label}</h3><span className="eye" style={{ marginLeft: "auto" }}>{g.races.length} {g.races.length === 1 ? "race" : "races"}</span></div>
            <div className="tblwrap">
              <table className="tbl">
                <thead><tr><th>State</th><th>Nominees</th><th>Rating</th><th style={{ textAlign: "right" }}>Model</th><th style={{ textAlign: "right" }}>Dem win</th><th style={{ textAlign: "right" }}>Polls</th></tr></thead>
                <tbody>{g.races.map((r) => <Row key={r.id} r={r} />)}</tbody>
              </table>
            </div>
          </div>
        ))}
        <div className="callout">
          <div className="eye">How these are built</div>
          Each race starts from the state&apos;s own 2026 Senate and governor county forecasts, the ticket it shares a ballot with,
          and adds the approval fundamentals, a relaxed Gallup party identification leg, the state&apos;s down ballot results from
          2014, 2018 and 2022, and this year&apos;s primary vote for the office. Incumbency, primary unity and polls move each county
          by how loose its voters are in the ticket splitting model. Few of these races are polled, so primaries count for more
          than they do for the Senate and governor. <Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>Methodology</Link>.
        </div>
      </div>
    </div>
  );
}
