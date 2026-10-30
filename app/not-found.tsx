import Link from "next/link";
import { Pointy } from "@/app/components/home/Mascot";

export default function NotFound() {
  return (
    <div className="opp">
      <section className="ph" style={{ padding: "64px 0 40px", position: "relative", maxWidth: 720 }}>
        <Pointy className="cam-404 keep essential" pose="think" prop="magnifier" size={170} look={-1} say={<>I have looked everywhere. This page is not on any map I have.</>} />
        <div className="eye mono">Error 404</div>
        <h1 style={{ fontSize: "clamp(34px,5vw,56px)" }}>This page is off the <em>map</em></h1>
        <p className="lede">The address may have changed when our old site became On Point Politics. Old links redirect, so check the spelling or start from one of these.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 22 }}>
          <Link className="btn g" href="/polls">Polling averages</Link>
          <Link className="btn" href="/forecast">Forecast</Link>
          <Link className="btn" href="/results/tonight">Live results</Link>
          <Link className="btn" href="/search">Search</Link>
        </div>
      </section>
    </div>
  );
}
