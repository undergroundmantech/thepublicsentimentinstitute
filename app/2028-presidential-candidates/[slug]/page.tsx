import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, isoDay, pageLd, seo } from "@/app/lib/seo";
import Toon from "@/app/majority-tracker/Toon";
import { hasLook } from "@/app/majority-tracker/looks";
import { modelName, nomination, pairFor } from "@/app/2028/data28";
import { fmtMg, fmtPct, last } from "@/app/2028/lib";
import { CANDS, STATUS, UPDATED, type Cand } from "../data";
import { slugOf } from "../slug";
import "../candidates.css";
import AdUnit from "@/app/components/AdUnit";

export const dynamicParams = false;
export const revalidate = 3600;
export function generateStaticParams() { return CANDS.map((c) => ({ slug: slugOf(c.name) })); }
const find = (slug: string) => CANDS.find((c) => slugOf(c.name) === slug);
const PARTY = { D: "Democrat", R: "Republican", I: "Independent" } as const;
const answer = (c: Cand) => c.status === "declared" ? "Yes." : c.status === "out" ? "No." : c.status === "likely" ? "Not yet, but likely." : "Not yet. Considering it.";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params; const c = find(slug); if (!c) return {};
  return seo({
    title: `Is ${c.name} running for president in 2028?`,
    description: `${answer(c)} ${c.note} Where ${c.name} stands in the 2028 race, with the On Point forecast.`,
    path: `/2028-presidential-candidates/${slug}`,
    ownImage: true,
    type: "article",
    modified: isoDay(UPDATED),
    keywords: [`is ${c.name} running for president`, `${c.name} 2028`, `${c.name} president 2028`, `${last(c.name)} 2028`, "2028 presidential candidates"],
  });
}

export default async function CandPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const c = find(slug); if (!c) notFound();
  const party = c.party === "I" ? null : c.party;
  const mn = party ? modelName(c.name, party) : null;
  const nom = nomination(); const odds = party && mn ? nom[party].find((x) => x.name === mn)?.p ?? null : null;
  const opp = party === "D" ? nom.R[0].name : party === "R" ? nom.D[0].name : null;
  const pr = mn && opp ? (party === "D" ? pairFor(mn, opp) : pairFor(opp, mn)) : null;
  const win = pr ? (party === "D" ? pr.pD : 1 - pr.pD) : null;
  const ev = pr ? (party === "D" ? pr.evMap : 538 - pr.evMap) : null;
  const peers = CANDS.filter((x) => x.party === c.party && x.name !== c.name && x.status !== "out").slice(0, 12);
  const qa: [string, string][] = [
    [`Is ${c.name} running for president in 2028?`, `${answer(c)} ${c.note}`],
    ...(odds != null && party ? [[`What are ${c.name}'s chances of winning the ${party === "D" ? "Democratic" : "Republican"} nomination?`, `The On Point forecast gives ${last(c.name)} a ${fmtPct(odds)} chance of the nomination with the full field on every ballot.`] as [string, string]] : []),
    ...(pr && opp && win != null ? [[`Could ${c.name} win the 2028 general election?`, `Against ${opp}, the On Point forecast has ${last(c.name)} winning ${fmtPct(win)} of simulations leading in states worth ${ev} electoral votes, and a national margin of ${fmtMg(pr.nat)}.`] as [string, string]] : []),
  ];
  return (
    <div className="opp pc28">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["2028 candidates", "/2028-presidential-candidates"], [c.name, `/2028-presidential-candidates/${slug}`]]),
        pageLd({ name: `Is ${c.name} running for president in 2028?`, description: c.note, path: `/2028-presidential-candidates/${slug}`, modified: isoDay(UPDATED), about: c.name }),
      )} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: qa.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/2028-presidential-candidates">2028 candidates</Link><span className="sep">/</span><span aria-current="page">{c.name}</span></nav>
      <header className="pc28-one">
        {party && (mn || hasLook(c.name)) ? <Toon name={mn ?? c.name} side={party} size={150} className="pc28-face" uid="c" /> : <span className="pc28-av pc28-big" aria-hidden="true">{c.name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}</span>}
        <div>
          <p className="eye">{PARTY[c.party]} · {c.role}</p>
          <h1>Is {c.name} running for president in <em>2028</em>?</h1>
          <p className="pc28-ans"><span className={`pc28-st s-${c.status}`}>{STATUS[c.status].label}</span> <b>{answer(c)}</b> {c.note}</p>
        </div>
      </header>
      {odds != null || pr ? (
        <div className="pc28-stats">
          {odds != null ? <div><span>Chance of the {party === "D" ? "Democratic" : "Republican"} nomination</span><b>{fmtPct(odds)}</b><Link href="/2028/primaries">The primary forecast</Link></div> : null}
          {pr && win != null ? <div><span>If nominated, against {opp}</span><b>{fmtPct(win)}</b><em>{Math.round(ev!)} electoral votes · {fmtMg(pr.nat)}</em><Link href="/2028/general">Every matchup</Link></div> : null}
        </div>
      ) : null}
      <AdUnit />
      <section className="pc28-faq" aria-label="Questions">
        {qa.map(([q, a]) => <details key={q} open><summary>{q}</summary><p>{a}</p></details>)}
      </section>
      {peers.length ? <section className="pc28-group" aria-labelledby="pc28-peers">
        <h3 id="pc28-peers"><span className="pc28-st">Also in the {PARTY[c.party]} conversation</span></h3>
        <ul>{peers.map((x) => <li key={x.name} className={`s-${x.status}`}><span className="pc28-av" aria-hidden="true">{x.name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}</span><div><b><Link href={`/2028-presidential-candidates/${slugOf(x.name)}`}>{x.name}</Link></b><span className="r">{STATUS[x.status].label} · {x.role}</span></div></li>)}</ul>
      </section> : null}
      <p className="pc28-foot">Updated {new Date(UPDATED + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}. See <Link href="/2028-presidential-candidates">every 2028 candidate</Link> and the <Link href="/2028">2028 forecast</Link>.</p>
    </div>
  );
}
