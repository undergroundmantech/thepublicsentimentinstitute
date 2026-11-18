import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import AdUnit from "@/app/components/AdUnit";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import Prim28 from "../Prim28";
import Method from "../Method";
import { getPrimSummary, top } from "../server";
import { fmtPct } from "../lib";
import "../h28.css";

const DESC = "The 2028 Democratic and Republican primary forecast: every candidate's chance at the nomination, who leads every state from the early states to June, and every county. Take any candidate out and the race reruns.";
export const metadata: Metadata = seo({
  title: "2028 primary forecast: Democratic and Republican nomination odds",
  description: DESC,
  path: "/2028/primaries",
  keywords: ["2028 Democratic primary", "2028 Republican primary", "2028 primary forecast", "2028 primary polls", "who will win the 2028 Democratic nomination", "who will win the 2028 Republican nomination", "2028 nomination odds"],
});

export default function Primaries28() {
  const sum = getPrimSummary(); const d = top(sum.D, 3), r = top(sum.R, 3);
  const qa: [string, string][] = [
    ["Who will win the 2028 Democratic nomination?", `The On Point forecast gives ${d[0].name} a ${fmtPct(d[0].p)} chance, ahead of ${d[1].name} at ${fmtPct(d[1].p)} and ${d[2].name} at ${fmtPct(d[2].p)}, with every candidate on every state's ballot.`],
    ["Who will win the 2028 Republican nomination?", `The On Point forecast gives ${r[0].name} a ${fmtPct(r[0].p)} chance, ahead of ${r[1].name} at ${fmtPct(r[1].p)}${r[2] ? ` and ${r[2].name} at ${fmtPct(r[2].p)}` : ""}.`],
    ["How does the On Point primary forecast work?", "Every candidate runs in every state at the same time with no dropouts. Each state is simulated 4,000 times and is the sum of its county forecasts. Take a candidate out and their voters move to the candidates most like them, county by county."],
  ];
  return (
    <main className="h28-page">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["2028 forecast", "/2028"], ["Primaries", "/2028/primaries"]]),
        pageLd({ name: "2028 primary forecast", description: DESC, path: "/2028/primaries", about: "2028 United States presidential primaries" }),
        { "@type": "FAQPage", mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      )} />
      <Prim28 sum={sum} />
      <AdUnit />
      <section className="h28-read" aria-labelledby="p28-read">
        <h2 id="p28-read">The 2028 primaries in brief</h2>
        {qa.map(([q, a]) => <p key={q}><b>{q}</b> {a}</p>)}
        <p>See the <Link href="/2028">2028 general election forecast</Link>, <Link href="/2028-presidential-candidates">who is running in 2028</Link> and the <Link href="/polls/2028">2028 primary polling averages</Link>.</p>
      </section>
      <Method />
      <AdUnit kind="multiplex" />
    </main>
  );
}
