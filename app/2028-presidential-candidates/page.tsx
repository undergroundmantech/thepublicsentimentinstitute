import type { Metadata } from "next";
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { crumbsLd, graph, isoDay, pageLd, seo } from "@/app/lib/seo";
import { CANDS, ELECTION, ORDER, STATUS, UPDATED, type Cand } from "./data";
import { slugOf } from "./slug";
import "./candidates.css";
import AdUnit from "@/app/components/AdUnit";

export const revalidate = 3600;

const day = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const PARTY = { D: "Democrats", R: "Republicans", I: "Independents and third parties" } as const;
const n = (p: Cand["party"], s?: Cand["status"]) => CANDS.filter((c) => c.party === p && (!s || c.status === s)).length;
const DESC = `Who is running for president in 2028? Every Democrat and Republican in the conversation, sorted by who has declared, who is likely, who is considering it and who has ruled it out, with what each has said. Updated ${day(UPDATED)}.`;

export const metadata: Metadata = seo({
  title: "2028 presidential candidates: who is running for president in 2028",
  description: DESC,
  path: "/2028-presidential-candidates",
  type: "article",
  modified: isoDay(UPDATED),
  keywords: ["2028 presidential candidates", "who is running for president in 2028", "2028 Democratic candidates", "2028 Republican candidates", "is JD Vance running in 2028", "is Gavin Newsom running in 2028", "is AOC running for president", "is Kamala Harris running in 2028", "2028 election", "2028 primary"],
});

const FAQ: [string, string][] = [
  ["Who is running for president in 2028?", `No major candidate has formally declared. Among Democrats, ${CANDS.filter((c) => c.party === "D" && c.status === "likely").map((c) => c.name).join(", ")} are the likeliest to run. Among Republicans, ${CANDS.filter((c) => c.party === "R" && c.status === "likely").map((c) => c.name).join(" and ")} are the likeliest, and ${CANDS.filter((c) => c.party === "R" && c.status === "declared").map((c) => c.name).join(", ")} have announced long shot campaigns.`],
  ["When is the 2028 presidential election?", `Tuesday, ${day(ELECTION)}. The primaries and caucuses run from early 2028 through June.`],
  ...CANDS.filter((c) => c.q).map((c) => [c.q!, `${STATUS[c.status].label}. ${c.note}`] as [string, string]),
];

export default function CandidatesPage() {
  return (
    <div className="opp pc28">
      <JsonLd data={graph(
        crumbsLd([["Home", "/"], ["2028", "/2028"], ["2028 presidential candidates", "/2028-presidential-candidates"]]),
        pageLd({ name: "2028 presidential candidates", description: DESC, path: "/2028-presidential-candidates", modified: isoDay(UPDATED), about: "2028 United States presidential election" }),
      )} />
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/2028">2028</Link><span className="sep">/</span><span aria-current="page">Candidates</span></nav>

      <header className="pc28-head">
        <p className="eye">The 2028 field · updated {day(UPDATED)}</p>
        <h1>Who is running for president in <em>2028</em></h1>
        <p className="lede">Every Democrat and Republican in the conversation, sorted by how real the candidacy is, with what each has said. No major candidate has formally declared yet, so this page moves as they do. For the odds, see the <Link href="/forecast/2028">2028 forecast</Link> and the <Link href="/polls/2028">2028 primary polls</Link>.</p>
        <div className="pc28-chips">
          {(["D", "R"] as const).map((p) => (
            <a key={p} href={`#${p === "D" ? "democrats" : "republicans"}`} className={`pc28-chip p-${p}`}>
              <b>{PARTY[p]}</b><span>{n(p, "declared")} declared · {n(p, "likely")} likely · {n(p, "possible")} possible · {n(p, "out")} out</span>
            </a>
          ))}
        </div>
      </header>

      {(["D", "R", "I"] as const).map((p) => (
        <section key={p} id={p === "D" ? "democrats" : p === "R" ? "republicans" : "independents"} className={`pc28-party p-${p}`} aria-labelledby={`pc28-${p}`}>
          <h2 id={`pc28-${p}`}>{PARTY[p]}</h2>
          {ORDER.filter((s) => n(p, s)).map((s) => (
            <div key={s} className="pc28-group">
              <h3><span className={`pc28-st s-${s}`}>{STATUS[s].label}</span><em>{STATUS[s].blurb}</em></h3>
              <ul>
                {CANDS.filter((c) => c.party === p && c.status === s).map((c) => (
                  <li key={c.name} className={`s-${s}`}>
                    <span className="pc28-av" aria-hidden="true">{c.name.split(" ").filter((w) => /^[A-Z]/.test(w)).slice(0, 2).map((w) => w[0]).join("")}</span>
                    <div><b><Link href={`/2028-presidential-candidates/${slugOf(c.name)}`}>{c.name}</Link></b><span className="r">{c.role}</span><p>{c.note}</p></div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <AdUnit />
      <section className="pc28-faq" aria-labelledby="pc28-faq">
        <h2 id="pc28-faq">2028 questions, answered</h2>
        {FAQ.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
      </section>

      <p className="pc28-foot">Statuses follow what each person has said in public, as reported by news outlets through {day(UPDATED)}. A name moves to Declared only with a formal announcement or FEC filing. Also on On Point Politics: the <Link href="/majority-tracker">Senate Democratic leader whip count</Link>, the <Link href="/polls/approval">Trump approval average</Link> and the <Link href="/polls/generic-ballot">generic ballot</Link>.</p>
    </div>
  );
}
