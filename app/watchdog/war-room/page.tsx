import type { Metadata } from "next";
import Link from "next/link";
import { getWarIndex, type WRow } from "./data";
import { OFFICE_NAME, lead, pct, raceLabel, surname, usd, warHref } from "./fmt";
import WarBoard from "./WarBoard";
import "../people/people.css";
import "./warroom.css";

export const metadata: Metadata = {
  title: "War Room: campaign health and paths to victory",
  description: "The On Point Politics War Room: a health score for both campaigns in every Senate, governor and contested House race, built from money, cash, outside spending, the early vote and campaign activity, plus how each side can win, written for a Democratic or Republican operative.",
  alternates: { canonical: "/watchdog/war-room" },
};

type Alert = { r: WRow; tag: string; t: string };

function alerts(rows: WRow[]): { head: string; sub: string; items: Alert[] }[] {
  const big = rows.filter((r) => r.office !== "house");
  const comp = rows.filter((r) => r.p > 0.15 && r.p < 0.85 && r.hD != null && r.hR != null);
  const split = comp.map((r) => {
    const favD = r.p < 0.5, hf = favD ? r.hD! : r.hR!, hu = favD ? r.hR! : r.hD!;
    return { r, d: hu - hf, fav: favD ? r.dem : r.gop, dog: favD ? r.gop : r.dem };
  }).filter((x) => x.d >= 15 && (x.r.office !== "house" || x.d <= 50)).sort((a, b) => (a.r.office === "house" ? 1 : 0) - (b.r.office === "house" ? 1 : 0) || b.d - a.d).slice(0, 6);
  const moved = big.filter((r) => r.d7 != null && Math.abs(r.d7) >= 1 && r.p > 0.03 && r.p < 0.97).sort((a, b) => Math.abs(b.d7!) - Math.abs(a.d7!)).slice(0, 6);
  const ballots = rows.filter((r) => r.ev != null && Math.abs(r.ev) >= 0.5 && r.p > 0.1 && r.p < 0.9).sort((a, b) => Math.abs(b.ev!) - Math.abs(a.ev!)).slice(0, 6);
  const crit = comp.filter((r) => r.office !== "house" && (r.hD! < 40 || r.hR! < 40)).sort((a, b) => Math.abs(a.p - 0.5) - Math.abs(b.p - 0.5)).slice(0, 6);
  return [
    { head: "Money and the polls disagree", sub: "The forecast favorite runs the weaker campaign by 15 points or more", items: split.map(({ r, d, fav, dog }) => ({ r, tag: `${d} pts`, t: `${surname(fav)} is favored, ${pct(r.p < 0.5 ? 1 - r.p : r.p)}, but ${surname(dog)}'s campaign is healthier.` })) },
    { head: "On the move", sub: "Biggest swing in the forecast over seven days", items: moved.map((r) => ({ r, tag: lead(r.d7, r.dP), t: `Moved toward ${r.d7! > 0 ? surname(r.gop) : surname(r.dem)}; now ${lead(r.m, r.dP)}.` })) },
    { head: "The ballots are talking", sub: "Where the early vote has moved the forecast most", items: ballots.map((r) => ({ r, tag: lead(r.ev, r.dP), t: `Early ballots pushed the race toward ${r.ev! > 0 ? surname(r.gop) : surname(r.dem)}.` })) },
    { head: "Critical in a close race", sub: "A campaign below 40 in a race the forecast still calls competitive", items: crit.map((r) => { const w = r.hD! < r.hR! ? "D" : "R"; return { r, tag: String(w === "D" ? r.hD : r.hR), t: `${surname(w === "D" ? r.dem : r.gop)} is short on money, cash or air cover with ${pct(w === "D" ? 1 - r.p : r.p)} odds.` }; }) },
  ].filter((g) => g.items.length);
}

export default function Page() {
  const d = getWarIndex();
  const rows = d.races;
  const toss = rows.filter((r) => r.p >= 0.35 && r.p <= 0.65).length;
  const comp = rows.filter((r) => r.p > 0.1 && r.p < 0.9).length;
  const scored = rows.filter((r) => r.hD != null && r.hR != null);
  const outside = rows.reduce((a, r) => a + (r.outside ?? 0), 0);
  const groups = alerts(rows);
  return (
    <>
      <header className="wd-hero">
        <div>
          <div className="eye gold">Watchdog · War Room</div>
          <h1>Every campaign&apos;s <em>vital signs.</em></h1>
          <p className="lede">A command center for campaign staff and the people who follow them. Both campaigns in every Senate, governor and contested House race get a health score from money, cash, outside spending, the early vote and campaign activity. Pick a side and the War Room briefs you like an operative: where the votes are, which groups move the race, and what the other side will hit you with.</p>
        </div>
      </header>

      <div className="wr-kpis">
        <div><span>Races tracked</span><b>{rows.length}</b><small>{OFFICE_NAME.senate}, governor and contested House</small></div>
        <div><span>Competitive</span><b>{comp}</b><small>{toss} within 35 to 65 percent</small></div>
        <div><span>Both sides scored</span><b>{scored.length}</b><small>The rest lack money reports</small></div>
        <div><span>Outside money tracked</span><b>{usd(outside)}</b><small>Senate and governor races</small></div>
      </div>

      <section className="wr-alerts" aria-label="Situation board">
        <div className="wr-sh"><h2>Situation board</h2><span className="pf-mute">Updated {d.asOf}{d.ev ? ` · early vote through ${d.ev}` : ""}</span></div>
        <div className="wr-agrid">
          {groups.map((g) => (
            <div key={g.head} className="wr-alert card">
              <div className="wr-alert-h"><b>{g.head}</b><small>{g.sub}</small></div>
              <ul>
                {g.items.map((a) => (
                  <li key={a.r.id}><Link href={warHref(a.r.id)} data-ev="War Room race opened" data-ev-d={JSON.stringify({ id: a.r.id, from: "alert" })}>
                    <span className="tag">{a.tag}</span><span><b>{raceLabel(a.r)}</b> {a.t}</span>
                  </Link></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <WarBoard rows={rows} />

      <section className="wr-how card" aria-label="How campaign health works">
        <div className="wr-sh"><h2>How campaign health works</h2><span className="pf-mute">The Ledger formula, from public records only</span></div>
        <div className="wr-how-g">
          <div>
            <p>Each campaign is scored on up to seven parts, each from 0 to 1 against its opponent, then weighted and put on a 100 point scale. A part with no data is left out rather than guessed, and a campaign with no money or cash report on file shows Not enough data.</p>
            <table className="pf-t">
              <thead><tr><th>Part</th><th className="n">Weight</th><th>What it measures</th></tr></thead>
              <tbody>
                <tr><td>Money</td><td className="n">25</td><td>Share of the two candidates&apos; combined receipts; spending stands in when one side has no receipts report</td></tr>
                <tr><td>Cash</td><td className="n">20</td><td>Share of combined cash on hand at the last report</td></tr>
                <tr><td>Momentum</td><td className="n">15</td><td>Change since the prior report; left out until two reports are on file</td></tr>
                <tr><td>Air cover</td><td className="n">15</td><td>Share of outside spending that helps this candidate</td></tr>
                <tr><td>Early vote</td><td className="n">15</td><td>The party&apos;s share of ballots cast where states report party, and the gap to what the forecast expected; 7 for House races</td></tr>
                <tr><td>National tide</td><td className="n">15</td><td>The Gallup party identification shift from Republicans 48 Democrats 45 in the third quarter of 2024 to Democrats 50 Republicans 39 in the third quarter of 2026, 14 points toward the Democrats, scaled by how far the race moves with the nation</td></tr>
                <tr><td>Activity</td><td className="n">10</td><td>Campaign stops, show and podcast mentions, Google ads and news desk stories in recent weeks</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p><b>Taken off the top:</b> 4 points for being outmatched five to one in cash, and 2 points for each contested item in the candidate&apos;s watchdog file, up to 8.</p>
            <p><b>Labels:</b> Strong at 70 and up, Stable 55 to 69, Strained 40 to 54, Critical under 40.</p>
            <p><b>What it is not:</b> a forecast. A well funded campaign can trail and a broke one can win. The score says which campaign has more to work with right now; the forecast says who is likely to win. When the two disagree, the Situation board flags it.</p>
            <p className="pf-mute">Sources: FEC and state filings as compiled for the forecast finance books, the Watchdog money, trail and media files, the On Point early vote tracker and the forecast model. Paths to victory are built from the forecast, its county map and its voter group estimates.</p>
          </div>
        </div>
      </section>
      <p className="wd-src">The War Room rebuilds after every forecast run. <Link href="/forecast">See the forecast</Link> · <Link href="/watchdog/people">People files</Link> · <Link href="/watchdog/money">Money flow</Link></p>
    </>
  );
}
