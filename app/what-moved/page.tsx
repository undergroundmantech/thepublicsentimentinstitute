import type { Metadata } from "next";
import Link from "@/app/components/Link";
import StayConnected from "@/app/components/StayConnected";
import { seo } from "@/app/lib/seo";
import { entries } from "./data";
import Entry from "./Entry";

export const revalidate = 3600;
export const metadata: Metadata = seo({ title: "What moved: the 2028 forecast, week by week", description: "Every week, every change to the On Point 2028 forecast: which states moved, how the nomination odds shifted, and why.", path: "/what-moved" });

export default function Page() {
  const E = entries();
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/2028">2028</Link><span className="sep">/</span><span>What moved</span></nav>
      <header className="ph"><div className="eye g">Every week</div><h1>What <em>moved</em></h1><p className="lede">Each week the 2028 forecast is rebuilt. Here is what changed, state by state, and the reasons, in plain language.</p></header>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "grid", gap: 28 }}>
        {E.length ? <Entry e={E[0]} /> : <p>The first week is on its way.</p>}
        {E.length > 1 ? <><h2 style={{ fontSize: 22, margin: 0 }}>Earlier weeks</h2>{E.slice(1).map((e) => <Entry key={e.slug} e={e} full={false} />)}</> : null}
      </div>
      <StayConnected from="what-moved" title="Get what moved in your inbox every week" pick={["forecast", "videos"]} />
    </div>
  );
}
