import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, pageLd, seo } from "@/app/lib/seo";
import { DESK_AGGREGATES } from "@/app/_polling/lib/aggregates";
import { SINGLES_2028 } from "@/app/_polling/2028/matchups";
import { avgSummary } from "../seo";
import { primaryBuilt } from "./build";
import "./p2028.css";

const R = primaryBuilt("republican-primary"), D = primaryBuilt("democratic-primary");
const GEN = DESK_AGGREGATES.filter((d) => d.category === "2028").map(avgSummary).sort((a, b) => b.polls - a.polls);
const DESC = `2028 presidential polling averages from On Point Politics: the Republican primary (${R.cands[0]?.key} leads), the Democratic primary (${D.cands[0]?.key} leads) and ${GEN.length} general election matchups, every one on the same weighted average.`;

export const metadata: Metadata = seo({ title: "2028 presidential polls: primary and general election polling averages", description: DESC, path: "/polls/2028", modified: [R.updated, D.updated].sort().pop() });

const day = (iso: string) => new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Field({ b, href }: { b: typeof R; href: string }) {
  const top = b.cands.filter((c) => c.now != null).slice(0, 6);
  const max = Math.max(...top.map((c) => c.now ?? 0), 1);
  return (
    <Link href={href} className="card p28-pc">
      <span className="eye g">{b.party === "R" ? "Republican" : "Democratic"} primary · national</span>
      <h2>{top[0]?.key} leads by {top[0] && top[1] ? (top[0].now! - top[1].now!).toFixed(1) : "0"}</h2>
      {top.map((c) => (
        <div className="p28-row" key={c.key}><span>{c.key}</span><i><s style={{ width: `${(c.now! / max) * 100}%`, background: c.color }} /></i><b>{c.now!.toFixed(1)}</b></div>
      ))}
      <span className="more">All {b.cands.length} candidates · {b.polls.length} polls · through {day(b.updated)}</span>
    </Link>
  );
}

export default function Page() {
  return (
    <div className="opp p28">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["Polls", "/polls"], ["2028", "/polls/2028"]]),
        pageLd({ name: "2028 presidential polling averages", description: DESC, path: "/polls/2028", about: "dataset" }),
      )} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/polls">Polls</Link><span className="sep">/</span><span aria-current="page">2028</span></nav>
      <header className="ph">
        <div className="eye g">2028 presidential election · polling averages</div>
        <h1>The road to <em>2028</em></h1>
        <p className="lede">Both nominating contests with every candidate the polls have named, and every general election matchup with at least two national polls. Each is an On Point average on the same method as the generic ballot and approval averages, weighted with the 2026 pollster ratings.</p>
      </header>

      <div className="p28-prim">
        <Field b={R} href="/polls/2028/republican-primary" />
        <Field b={D} href="/polls/2028/democratic-primary" />
      </div>

      <section className="card">
        <div className="card-h"><h3>General election matchups</h3><span className="eye" style={{ marginLeft: "auto" }}>National · two way</span></div>
        <div className="card-b">
          <div className="p28-grid">
            {GEN.map((s) => {
              const a = s.a ?? 0, b = s.b ?? 0;
              return (
                <Link key={s.def.id} href={s.path} className="card p28-m">
                  <span className="t">{s.def.seriesA.label} vs. {s.def.seriesB.label}</span>
                  <span className="v" style={{ color: a >= b ? s.def.seriesA.color : s.def.seriesB.color }}>{s.lead}</span>
                  <span className="p28-split" aria-label={`${s.def.seriesA.label} ${a.toFixed(1)}, ${s.def.seriesB.label} ${b.toFixed(1)}`}>
                    <i style={{ width: `${(a / Math.max(1, a + b)) * 100}%`, background: s.def.seriesA.color }} /><i style={{ width: `${(b / Math.max(1, a + b)) * 100}%`, background: s.def.seriesB.color }} />
                  </span>
                  <span className="s">{a.toFixed(1)} to {b.toFixed(1)} · {s.polls} polls{s.updated ? ` · through ${day(s.updated)}` : ""}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {SINGLES_2028.length ? (
        <section className="card" id="one-poll">
          <div className="card-h"><h3>Matchups with one poll so far</h3><span className="eye" style={{ marginLeft: "auto" }}>No average yet</span></div>
          <ul className="p28-one">
            {SINGLES_2028.map((m) => {
              const p = m.polls[0], a = Number(p.results[m.rep]), b = Number(p.results[m.dem]);
              return <li key={m.id}><b>{m.rep} vs. {m.dem}</b><span>{m.rep} {a}, {m.dem} {b}</span><span>{p.pollster}, {day(p.endDate)}, {p.sampleSize.toLocaleString("en-US")} {p.sampleType}</span></li>;
            })}
          </ul>
          <p className="p28-note">A matchup gets its own average once a second national poll asks it.</p>
        </section>
      ) : null}

      <aside className="callout">
        <div className="eye">Method</div>
        Every 2028 average weights each poll by recency, sample size, voter screen and pollster grade, discounts repeat releases, and fits a robust LOWESS line through them. Grades come from how each firm did in 2026; partisan and campaign polls are moved back by the lean measured against nonpartisan polls in the final month of 2026. State polls are kept out of these national averages. <Link href="/polls/ratings" style={{ textDecoration: "underline" }}>See the 2026 pollster ratings</Link>.
      </aside>
    </div>
  );
}
