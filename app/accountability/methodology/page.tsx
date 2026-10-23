import type { Metadata } from "next";
import Link from "next/link";
import { getAx, GRADES } from "../data";
import { Grade } from "../AxTable";
import "../accountability.css";

export const metadata: Metadata = {
  title: "How the Accountability Index works",
  description: "The sources, formulas, weights, grade cutoffs and every known gap behind the On Point Politics Accountability Index.",
  alternates: { canonical: "https://onpointpolitics.com/accountability/methodology" },
};

export default function AxMethod() {
  const ax = getAx(); const M = ax.members;
  const n = (f: (m: (typeof M)[number]) => boolean) => M.filter(f).length;
  const cov = [
    { k: "Pro-Israel lobby money", s: ax.sources.lobby, have: n((m) => m.parts.lobby != null), gap: "TrackAIPAC's Congress page could not be read past Virginia, so the 29 members from Washington, West Virginia, Wisconsin and Wyoming are left out of this part for now. The six non-voting delegates are not listed by the site." },
    { k: "PAC money share", s: ax.sources.pac, have: n((m) => m.parts.pac != null), gap: "Two appointed senators have no FEC committee on file. Senators show their whole election period on the FEC page, six years for those up in 2026, so their totals are larger than the two year House totals; the share is a ratio, so it still compares fairly." },
    { k: "Stock trading", s: ax.sources.trading, have: n((m) => !m.trades.none), gap: "Members with no entry in Quiver's last year table are scored as not trading. That table can miss members: Jefferson Shreve was missing and is added from CurvedTrading's listing. Trading before the last year is not counted." },
    { k: "America First Foundation", s: ax.sources.aff, have: n((m) => !!m.aff), gap: "Shown beside the index only. Seven members are listed as Ungraded. Most values were read once from the site's listings and about a fifth were checked a second time." },
    { k: "League of Conservation Voters", s: ax.sources.lcv, have: n((m) => !!m.lcv), gap: "Shown beside the index only. Members seated after the 2025 scorecard have no score." },
    { k: "Heritage Action", s: ax.sources.heritage, have: n((m) => !!m.heritage), gap: "Shown beside the index only. The scorecard updates weekly while Congress sits, so this is a snapshot. Five delegate pages and a few others could not be read." },
  ];
  return (
    <div className="opp ax ax-meth">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/accountability">Accountability Index</Link><span className="sep">/</span><span>How it works</span></nav>
      <header className="ax-head"><div>
        <div className="eye gold">Accountability Index · method</div>
        <h1>How the index <em>is built.</em></h1>
        <p className="lede">The Accountability Index asks one question of every member of Congress: how free are they from special interest money and conflicts? It does not grade ideology, voting records or character. A member can score well and vote in ways you dislike, or score poorly and vote in ways you like.</p>
      </div></header>

      <section className="card ax-mcard">
        <h2>The three measured parts</h2>
        <p>Each part is turned into a score from 0 to 100, where 100 is the most independent. The index is the weighted average of the parts on file for a member: lobby money {ax.weights.lobby} percent, PAC share {ax.weights.pac} percent and trading {ax.weights.trading} percent. When a part is missing, the other two are reweighted to fill the whole, and the member is marked partial. A member is scored only when FEC campaign money is on file plus at least one more part.</p>
        <ol>
          <li><b>Pro-Israel lobby money.</b> TrackAIPAC&apos;s Israel Lobby Total, the career sum of money from pro-Israel PACs and their large donors plus their outside spending for the member, built from FEC records. The score falls on a log scale: $0 scores 100, $10,000 about 74, $100,000 about 50, $1 million about 25 and $10 million or more 0. Members TrackAIPAC marks as rejecting AIPAC, with no dollar figure shown, are counted as zero.</li>
          <li><b>PAC money share.</b> The money a member&apos;s campaign took from PACs and other non-party committees, as a share of everything it raised this cycle, from the FEC&apos;s candidate summary. The score falls in a straight line from 100 at no PAC money to 0 at a 70 percent share. Members who raised under $25,000 are left out of this part.</li>
          <li><b>Stock trading.</b> The trades a member reported in the last year and their estimated dollar volume, from Quiver Quantitative. The count and the volume each get a log scale score and the two are averaged: one trade scores about 93 on the count, ten about 77, a hundred about 56 and a thousand about 34; $100,000 in volume scores about 60 and $10 million about 20.</li>
        </ol>
      </section>

      <section className="card ax-mcard">
        <h2>Grades</h2>
        <div className="ax-gr">{GRADES.map((g) => <div key={g.g}><Grade g={g.g} big /><span>{g.note}</span></div>)}</div>
        <p>Grades are fixed cutoffs on the index, not a curve, so every member could in principle earn an A.</p>
      </section>

      <section className="card ax-mcard">
        <h2>Not scored yet: votes that helped donors</h2>
        <p>The fourth part we want is a test of whether a member&apos;s votes line up with the industries that fund them. That needs each donor&apos;s industry, which the public FEC pages do not give and which we cannot yet read from an industry coded source. Rather than guess, the index leaves this part out and every member page says so. It will be added once the data can be read in full.</p>
      </section>

      <section className="card ax-mcard">
        <h2>Scorecards beside the index</h2>
        <p>The America First Foundation, the League of Conservation Voters and Heritage Action each grade members against their own policy positions. They are shown on every member page and in the main table so readers can see where a member stands, and they never change the index. The America First Foundation grades immigration, trade and foreign policy bills from the 117th to the 119th Congress; LCV grades environmental votes; Heritage Action grades key votes and cosponsorships from a conservative view.</p>
      </section>

      <section className="ax-cov" aria-labelledby="ax-cov-h">
        <div className="ax-sec-h"><h2 id="ax-cov-h">Sources and coverage</h2><span className="eye">read October 22, 2026</span></div>
        <div className="ax-tw"><table className="ax-t">
          <thead><tr><th scope="col">Measure</th><th scope="col">Source</th><th scope="col">Members on file</th><th scope="col">As of</th><th scope="col">Known gaps</th></tr></thead>
          <tbody>{cov.map((c) => <tr key={c.k}><td className="nm"><b>{c.k}</b></td><td><a href={c.s.url} target="_blank" rel="noopener noreferrer">{c.s.name}</a></td><td className="num">{c.have} of {ax.count}</td><td>{c.s.asof}</td><td className="gap">{c.gap}</td></tr>)}</tbody>
        </table></div>
        <p className="ax-note">The list of members comes from the <a href={ax.sources.roster.url} target="_blank" rel="noopener noreferrer">congress-legislators project</a>. Every figure was read from the public page named and is stored as the source showed it, including figures that look odd. Corrections are welcome through the <Link href="/contact">contact page</Link>.</p>
      </section>
    </div>
  );
}
