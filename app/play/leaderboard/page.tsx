import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { seo } from "@/app/lib/seo";
import LeaderBoard from "../LeaderBoard";
import "../leaderboard.css";

export const metadata: Metadata = seo({ title: "Campaign 2028 weekly leaderboard", description: "The best Campaign 2028 runs this week: the biggest Republican and Democratic wins, the widest landslide and the cheapest win. The board starts fresh every Monday.", path: "/play/leaderboard" });

export default function Page() {
  return (
    <div className="opp lb-page">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/play">Campaign 2028</Link><span className="sep">/</span><span>Leaderboard</span></nav>
      <header className="ph"><div className="eye g">Campaign 2028</div><h1>This week&apos;s <em>leaderboard</em></h1><p className="lede">Win a race, then put your name on the board from the results screen. Every board starts fresh on Monday.</p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}><a className="btn g" href="/play">Play Campaign 2028</a><a className="btn" href="/play?daily=1">Today&apos;s daily challenge</a></div></header>
      <LeaderBoard />
    </div>
  );
}
