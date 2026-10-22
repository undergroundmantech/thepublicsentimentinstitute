import type { Metadata } from "next";
import Link from "next/link";
import MoneyFlow from "./MoneyFlow";
import MoneyRoom from "./MoneyRoom";
import { getMoney, usd } from "../data";
import "./money.css";

export const metadata: Metadata = { title: "Money flow", description: "Where the outside money in the 2026 midterms comes from and where it goes: the biggest donors, the super PACs they fund, and the Senate races those groups spend in." };

export default function Page() {
  const m = getMoney();
  const total = m.races.reduce((a, r) => a + (r.total ?? 0), 0);
  const groups = m.groups.filter((g) => g.raised || g.spent).sort((a, b) => (b.spent ?? 0) - (a.spent ?? 0)).slice(0, 18);
  const maxAd = Math.max(...m.ads.map((a) => a.d90));
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · Money flow</div>
          <h1>{usd(total)} in outside money, <em>followed to the dollar.</em></h1>
          <p className="lede">Super PACs and outside groups have spent {usd(total)} in the {m.races.length} closest Senate and governor races this fall. Here is who funds them, where the money lands, and which side it helps.</p>
        </div>
      </header>

      <section className="wd-sec">
        <h2>The river</h2>
        <p>The biggest donors on the left, the groups they fund in the middle, the races those groups spend in on the right. Hover any band.</p>
        <div className="card"><div className="card-b"><MoneyFlow flow={m.flow} /></div></div>
      </section>

      <section className="wd-sec">
        <h2>Race by race</h2>
        <MoneyRoom races={m.races} />
      </section>

      <section className="wd-sec wd-grid2">
        <div className="card">
          <div className="card-h"><h3>The biggest outside groups</h3><span className="eye" style={{ marginLeft: "auto" }}>This cycle</span></div>
          <div className="tblwrap">
            <table className="tbl mo-tbl">
              <thead><tr><th>Group</th><th className="n">Raised</th><th className="n">Spent</th><th className="n">Cash</th><th>Biggest donor</th></tr></thead>
              <tbody>
                {groups.map((g) => (
                  <tr key={g.name}>
                    <td><Link href={`/watchdog/connections?name=${encodeURIComponent("g:" + g.name)}`}><span className={`wd-pill ${g.side === "D" ? "d" : g.side === "R" ? "r" : "g"}`}>{g.side === "D" ? "D" : g.side === "R" ? "R" : "Both"}</span> <b>{g.name}</b></Link></td>
                    <td className="n mono">{usd(g.raised)}</td><td className="n mono">{usd(g.spent)}</td><td className="n mono">{usd(g.cash)}</td>
                    <td>{g.donors[0] ? <>{g.donors[0][0]} <span className="g mono">{usd(g.donors[0][1])}</span></> : <span style={{ opacity: .5 }}>n/a</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Biggest Google political ad buyers</h3><span className="eye" style={{ marginLeft: "auto" }}>Last 90 days, per Ledger</span></div>
          <div className="wd-list">
            {m.ads.map((a, i) => (
              <div key={a.buyer} className="mo-ad">
                <span><b>{a.buyer}</b><small>{a.ads.toLocaleString()} ads · {usd(a.all)} all time</small></span>
                <span className="wd-bar"><i style={{ width: `${(a.d90 / maxAd) * 100}%`, background: "linear-gradient(90deg,#e7b341,#ffd98a)", animationDelay: `${i * 0.08}s` }} /></span>
                <span className="wd-amt">{usd(a.d90)}</span>
              </div>
            ))}
          </div>
          <div className="card-h" style={{ borderTop: "1px solid var(--line)" }}><h3>Fresh outside spending</h3><span className="eye" style={{ marginLeft: "auto" }}>From the Ledger tape</span></div>
          <div className="wd-list">
            {m.tape.map((t, i) => (
              <div key={i} className="mo-tape"><span><b>{t.group}</b><small>{t.what} against {t.against}, paid to {t.vendor}</small></span><span className="wd-amt">{usd(t.amount)}</span></div>
            ))}
          </div>
        </div>
      </section>
      <p className="wd-src">Race totals count independent expenditures in the general election that help each side: spending for a candidate plus spending against the opponent. Figures come from public compilations of FEC filings as of {m.asOf}, and from Ledger, On Point&apos;s FEC tracker. Sources can differ by a few days of filings.</p>
    </>
  );
}
