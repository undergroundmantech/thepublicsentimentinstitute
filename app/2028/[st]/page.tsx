import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import State28 from "../State28";
import { featured, primStates, stateCodes, stateData } from "../data28";
import { STATE_NAME, fmtMg, fmtPct } from "../lib";
import "@/onpoint-sketchbook/styles/sketchbook.css";
import "../h28.css";
import AdUnit from "@/app/components/AdUnit";
import PlayCta from "@/app/2028/PlayCta";

export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return stateCodes().map((s) => ({ st: s.toLowerCase() })); }

export async function generateMetadata({ params }: { params: Promise<{ st: string }> }): Promise<Metadata> {
  const { st } = await params; const S = st.toUpperCase(); const name = STATE_NAME[S]; if (!name) return {};
  const p = featured(8)[0]; const v = p.st[S];
  return seo({
    title: `${name} 2028 presidential forecast`,
    description: `Who wins ${name} in 2028? The On Point forecast for ${name}'s electoral votes in every likely matchup${v ? `, led by ${p.d} against ${p.r}: ${fmtMg(v[0])}, ${fmtPct(Math.max(v[1], 1 - v[1]))} to ${v[1] >= 0.5 ? p.d : p.r}` : ""}, county by county, with both primaries.`,
    path: `/2028/${st}`,
    ownImage: true,
    keywords: [`${name} 2028 election`, `${name} 2028 forecast`, `${name} 2028 polls`, `${name} presidential election 2028`, `who will win ${name} 2028`, `${name} primary 2028`],
  });
}

export default async function StatePage({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params; const S = st.toUpperCase();
  if (!STATE_NAME[S]) notFound();
  const pairs = featured(8); const data = stateData(S); const prim = primStates();
  const p = pairs[0]; const v = p.st[S];
  const all = stateCodes().filter((s) => s !== S).sort((a, b) => STATE_NAME[a].localeCompare(STATE_NAME[b]));
  return (
    <main className="h28-page">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["2028 forecast", "/2028"], [`${data.name}`, `/2028/${st}`]]),
        pageLd({ name: `${data.name} 2028 presidential forecast`, description: `The On Point 2028 forecast for ${data.name}.`, path: `/2028/${st}`, about: `2028 presidential election in ${data.name}` }),
        { "@type": "FAQPage", mainEntity: ([
          [`Who will win ${data.name} in 2028?`, v ? `In the likeliest matchup, ${p.d} against ${p.r}, the On Point forecast has ${data.name} at ${fmtMg(v[0])}, with ${v[1] >= 0.5 ? p.d : p.r} carrying it in ${fmtPct(Math.max(v[1], 1 - v[1]))} of 20,000 simulations.` : `The On Point forecast models ${data.name} in every likely 2028 matchup.`],
          [`How many electoral votes does ${data.name} have in 2028?`, `${data.name} has ${data.ev} electoral votes in the 2028 presidential election.`],
          [`How did ${data.name} vote in 2024?`, data.m24 != null ? `${data.name} voted ${fmtMg(data.m24)} in the 2024 presidential election.` : `See the 2024 result on the On Point results pages.`],
          ...(prim.D[S] && prim.R[S] ? [[`Who leads the 2028 primaries in ${data.name}?`, `${prim.D[S].lead} leads the Democratic primary with ${(prim.D[S].share * 100).toFixed(1)}% and ${prim.R[S].lead} leads the Republican primary with ${(prim.R[S].share * 100).toFixed(1)}% in the On Point forecast.`] as [string, string]] : []),
        ] as [string, string][]).map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) },
      )} />
      <State28 data={data} pairs={pairs} prim={{ D: prim.D[S] ?? null, R: prim.R[S] ?? null }} distRes={Object.fromEntries(pairs.map((x) => [x.id, Object.fromEntries(data.dists.map((d) => [d.k, x.st[d.k] ?? null]))]))} />
      <PlayCta title={`Win ${data.name} county by county`} note={`Campaign 2028 runs on this forecast. Rally, open field offices and knock doors in every ${data.name} county.`} />
      <AdUnit />
      <section className="h28-read" aria-labelledby="h28-sread">
        <h2 id="h28-sread">{data.name} in 2028</h2>
        {v ? <p>In the likeliest matchup, {p.d} against {p.r}, the forecast has {data.name} at {fmtMg(v[0])}, and {v[1] >= 0.5 ? p.d : p.r} carries its {data.ev} electoral votes in {fmtPct(Math.max(v[1], 1 - v[1]))} of 20,000 simulations.{data.m24 != null ? ` In 2024 it voted ${fmtMg(data.m24)}.` : ""}</p> : null}
        {prim.D[S] && prim.R[S] ? <p>In the primaries, {prim.D[S].lead} leads the Democratic field here with {(prim.D[S].share * 100).toFixed(1)}% and {prim.R[S].lead} leads the Republican field with {(prim.R[S].share * 100).toFixed(1)}%. Every county is forecast for both, then added up.</p> : null}
        <nav className="h28-states" aria-label="Other states"><h3>Other states</h3><ul>{all.map((s) => <li key={s}><Link href={`/2028/${s.toLowerCase()}`}>{STATE_NAME[s]}</Link></li>)}</ul></nav>
      </section>
      <AdUnit kind="multiplex" />
    </main>
  );
}
