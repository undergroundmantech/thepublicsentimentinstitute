import Link from "@/app/components/Link";
import { calledSeats, getAcc, type Office } from "@/app/accuracy/data";
import { getBench } from "@/app/accuracy/bench";

// The home page's first word after Election Day: the final forecast against the count, from public/accuracy/2026.json.
export default function ResultsBand() {
  const A = getAcc();
  const B = getBench();
  const H = A.headline.all, C = A.chambers, L = A.legislatures;
  const allRight = (["senate", "house", "governor"] as Office[]).every((o) => C[o].right);
  const tile = (o: Office, label: string) => {
    const c = C[o];
    return (
      <Link href={`/accuracy#chambers`} className="rb-t" key={o}>
        <span className="l">{label}</span>
        <span className={`v ${c.control === "D" ? "d" : c.control === "R" ? "r" : ""}`}>{c.actualD} D · {c.actualR} R</span>
        <span className="s">Forecast called {calledSeats(c)} · control {c.right ? "called right" : "missed"}</span>
      </Link>
    );
  };
  return (
    <section className="sec rb">
      <div className="sec-h">
        <div><div className="eye g">The 2026 midterms, scored</div>
          <h2>We called {H.called_right} of {H.races} races{allRight ? " and all three chambers" : ""}.</h2>
          <p><b>On Point Polling was the most accurate pollster in America:</b> D +13.1 on the final generic ballot against a D +13.0 result, first of 42 final national polls. The final forecast, frozen on November 3 before the first polls closed, is graded against the count in every race, county and state legislative district.</p></div>
        <div className="rb-cta"><Link className="btn white" href="/accuracy">Read the accuracy report</Link><Link className="btn" href="/most-accurate-pollster">Most accurate pollster</Link><Link className="btn" href="/forecast/2026">The forecast as published</Link></div>
      </div>
      <div className="rb-grid">
        <Link href="/most-accurate-pollster" className="rb-t rb-lead">
          <span className="l">Most accurate poll</span>
          <span className="v">D +{B.generic.us.margin.toFixed(1)}</span>
          <span className="s">Our final national poll. The result: D +{B.generic.result.margin.toFixed(1)}</span>
        </Link>
        {tile("senate", "Senate")}
        {tile("house", "House")}
        {tile("governor", "Governors")}
        <Link href="/accuracy#legislatures" className="rb-t">
          <span className="l">State legislatures</span>
          <span className="v">{L.chambers.right} of {L.chambers.settled}</span>
          <span className="s">Settled chambers called right · {L.scored.share.toFixed(0)}% of contested districts</span>
        </Link>
      </div>
    </section>
  );
}
