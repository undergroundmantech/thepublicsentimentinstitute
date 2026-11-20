import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import Home28 from "./Home28";
import Method from "./Method";
import { ELECTION_DAY, featured, geo, nomination, primStates } from "./data28";
import { STATE_NAME, fmtMg, fmtPct, last } from "./lib";
import { getDefault, getGenNames } from "./server";
import "@/onpoint-sketchbook/styles/sketchbook.css";
import "./h28.css";
import AdUnit from "@/app/components/AdUnit";
import PlayCta from "@/app/2028/PlayCta";

export const revalidate = 3600;
const DESC = "The On Point 2028 presidential forecast: the electoral map for every likely matchup, both primaries and every state's chance, forecast county by county and added up to every state.";
export const metadata: Metadata = seo({
  title: "2028 election forecast and electoral map",
  description: DESC,
  path: "/2028",
  keywords: ["2028 election forecast", "2028 electoral map", "2028 presidential election predictions", "2028 presidential forecast", "Vance vs Harris", "2028 polls", "who will win 2028", "2028 primary forecast"],
});

export default function Page2028() {
  const pairs = featured(8); const nom = nomination(); const prim = primStates(); const g = geo(); const def = getDefault();
  const ev: Record<string, number> = {};
  for (const [k, v] of Object.entries(def.summary.states)) ev[k] = v.ev;
  const days = Math.max(0, Math.ceil((new Date(ELECTION_DAY + "T12:00:00Z").getTime() - Date.now()) / 864e5));
  const top = pairs[0];
  const states = Object.keys(g.states).filter((s) => STATE_NAME[s]).sort((a, b) => STATE_NAME[a].localeCompare(STATE_NAME[b]));
  return (
    <main className="h28-page">
      <JsonLd data={graph(crumbsLd([["Home", "/"], ["2028 forecast", "/2028"]]), pageLd({ name: "2028 election forecast", description: DESC, path: "/2028", about: "2028 United States presidential election" }))} />
      <Home28 pairs={pairs} nom={nom} prim={prim} ev={ev} days={days} a24={g.a24} names={getGenNames()} />

      <PlayCta title="Run for president on this map" note="Pick any of 54 candidates, win the primaries and fight county by county to 270, on the same forecast." />
      <AdUnit />
      <section className="h28-read" aria-labelledby="h28-read">
        <h2 id="h28-read">The 2028 forecast in brief</h2>
        <p>The likeliest general election is {top.d} against {top.r}, a {fmtPct(top.odds ?? 0)} chance from both parties&apos; nomination odds. In it, {top.pD >= 0.5 ? top.d : top.r} wins {fmtPct(Math.max(top.pD, 1 - top.pD))} of 20,000 simulations, leading in states worth {top.pD >= 0.5 ? top.evMap : 538 - top.evMap} electoral votes, and a popular vote margin of {fmtMg(top.nat)}. {STATE_NAME[top.tip]} is the tipping point state.</p>
        <p>For the nominations, {nom.D[0].name} leads the Democratic field at {fmtPct(nom.D[0].p)}, ahead of {nom.D.slice(1, 3).map((x) => `${x.name} at ${fmtPct(x.p)}`).join(" and ")}. {nom.R[0].name} leads the Republican field at {fmtPct(nom.R[0].p)}, ahead of {last(nom.R[1].name)} at {fmtPct(nom.R[1].p)}. See <Link href="/2028-presidential-candidates">who is running in 2028</Link> for where every possible candidate stands.</p>
        <nav className="h28-states" aria-label="2028 forecast by state">
          <h3>Every state&apos;s 2028 forecast</h3>
          <ul>{states.map((s) => <li key={s}><Link href={`/2028/${s.toLowerCase()}`}>{STATE_NAME[s]}</Link></li>)}</ul>
        </nav>
      </section>
      <Method />
      <AdUnit kind="multiplex" />
    </main>
  );
}
