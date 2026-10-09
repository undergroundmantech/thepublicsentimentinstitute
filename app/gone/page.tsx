import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Retired page", robots: { index: false } };

// Retired experiments (/v2, /polling/old/*) are rewritten here with a 410 status by middleware.ts.
export default function Gone() {
  return (
    <div className="opp">
      <section className="ph" style={{ padding: "64px 0 40px", maxWidth: 720 }}>
        <div className="eye mono">410 Gone</div>
        <h1 style={{ fontSize: "clamp(34px,5vw,56px)" }}>This page was <em>retired</em></h1>
        <p className="lede">It was an early experiment from tpsielections.com and is not coming back. What it showed now lives on the pages below.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <Link className="btn g" href="/polls">Polling averages</Link>
          <Link className="btn" href="/forecast">Forecast</Link>
          <Link className="btn" href="/results/tonight">Live results</Link>
        </div>
      </section>
    </div>
  );
}
