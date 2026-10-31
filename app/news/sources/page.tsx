import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { LEAN_LABEL, OUTLETS, type Lean } from "../sources";
import { LeanTag } from "../ui";
import "../news.css";

export const metadata: Metadata = {
  title: "News outlets and how we rate them",
  description: "Every outlet the On Point Politics news desk reads, rated Left, Center or Right, with the reason for each rating and how the ratings are made.",
  alternates: { canonical: "https://onpointpolitics.com/news/sources" },
};

export default function SourcesPage() {
  return (
    <div className="opp nw nw-srcs">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/news">News</Link><span className="sep">/</span><span>Outlets and ratings</span></nav>
      <header className="nw-head"><div>
        <div className="eye gold">The news desk · method</div>
        <h1>How we rate <em>every outlet.</em></h1>
        <p className="lede">Each outlet gets one of three labels. A rating describes the outlet&apos;s news coverage as a whole, not any single story, and is reviewed whenever an outlet changes ownership, leadership or editorial line.</p>
      </div></header>
      <section className="card nw-method">
        <h2>What goes into a rating</h2>
        <ol>
          <li><b>Story selection.</b> Which stories an outlet chooses to cover, and which it leaves out, over months of coverage.</li>
          <li><b>Headline framing.</b> Word choice in headlines and the first paragraph, and whose account comes first.</li>
          <li><b>Sourcing.</b> Whether reporting quotes people across the spectrum and attributes contested claims.</li>
          <li><b>Stated positions.</b> The outlet&apos;s editorial board, mission statement and the views of its owners where public.</li>
        </ol>
        <p><b>Lean and full.</b> We record whether an outlet leans to one side or sits fully on it. The site shows both as Left or Right, so a Lean Left outlet is labeled Left. Opinion sections are rated with their outlet; individual opinion pieces are marked Opinion wherever we can tell.</p>
        <p><b>Wire copy.</b> Associated Press stories republished by a network are credited to the Associated Press and labeled Center.</p>
        <p><b>Not carried.</b> By house rule the desk does not carry The New York Times, Politico, Decision Desk HQ, X or the Star Tribune.</p>
        <p><b>Corrections.</b> If a summary gets a fact wrong we correct it and say so on the story. Disagree with a rating? <Link href="/contact">Write to us</Link> with examples and we will review it.</p>
      </section>
      {(["L", "C", "R"] as Lean[]).map((l) => (
        <section key={l} className="nw-src-sec">
          <h2><LeanTag lean={l} /> {OUTLETS.filter((o) => o.lean === l).length} outlets</h2>
          <div className="nw-src-g">{OUTLETS.filter((o) => o.lean === l).map((o) => (
            <div key={o.id} className="card nw-src">
              <div className="h"><b>{o.name}</b><span>{o.degree === "lean" ? `Lean ${LEAN_LABEL[l]}` : l === "C" ? "Center" : LEAN_LABEL[l]}</span></div>
              <p>{o.why}</p>
              <small>{o.domain ? o.domain + " · " : ""}{o.feeds.length ? `${o.feeds.length} ${o.feeds.length === 1 ? "feed" : "feeds"} on the live wire` : "Cited in written summaries"}{o.opinionHeavy ? " · mostly opinion" : ""}</small>
            </div>
          ))}</div>
        </section>
      ))}
    </div>
  );
}
