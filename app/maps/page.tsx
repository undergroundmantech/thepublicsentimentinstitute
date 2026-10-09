import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Interactive maps", description: "The electoral map, party registration, voter registration and the early vote tracker.", alternates: { canonical: "/maps" } };

const MAPS = [
  { href: "/maps/electoral", t: "Electoral map", s: "Flip the board: paint each state and build your own path to 270, or to Senate and governor control." },
  { href: "/maps/early-vote", t: "Early vote tracker", s: "Mail ballots requested and returned and in person early votes, by state and county, with a TPSI party estimate where states report none." },
  { href: "/maps/party-registration", t: "Party registration", s: "Which party leads the voter rolls in every state and county that registers by party." },
  { href: "/maps/voter-registration", t: "Voter registration", s: "Registered voter totals by state and county, from each state's own reports." },
  { href: "/forecast", t: "Forecast map", s: "The 2026 model for the Senate, House and governors, down to the county." },
];

export default function Page() {
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><span>Maps</span></nav>
      <header className="ph">
        <div className="eye g">Interactive maps</div>
        <h1>Every map, <em>one place</em></h1>
        <p className="lede">Explore the board, the voter rolls and the early vote, state by state and county by county.</p>
        <div className="pmeta">
          <span><b className="mono">{MAPS.length}</b> interactive maps</span>
          <span>Forecast data updated daily</span>
        </div>
      </header>
      <div className="tiles">
        {MAPS.map((m) => (
          <Link key={m.href} href={m.href} className="card tile" style={{ minHeight: 140 }}>
            <span className="eye">{m.href}</span>
            <span className="t" style={{ fontSize: 18 }}>{m.t}</span>
            <span className="s" style={{ fontSize: 13.5 }}>{m.s}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
