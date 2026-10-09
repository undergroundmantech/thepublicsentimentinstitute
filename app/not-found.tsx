import Link from "next/link";

export default function NotFound() {
  return (
    <div className="opp">
      <section className="ph" style={{ padding: "64px 0 40px", position: "relative", maxWidth: 720 }}>
        <div className="eye mono">Error 404</div>
        <h1 style={{ fontSize: "clamp(34px,5vw,56px)" }}>This page is off the <em>map</em></h1>
        <p className="lede">The address may have changed when tpsielections.com became OnPoint Politics. Old links redirect, so check the spelling or start from one of these.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <Link className="btn g" href="/polls">Polling averages</Link>
          <Link className="btn" href="/forecast">Forecast</Link>
          <Link className="btn" href="/results/live">Live results</Link>
          <Link className="btn" href="/search">Search</Link>
        </div>
      </section>
    </div>
  );
}
