import type { Metadata } from "next";
import Link from "next/link";
import { getDesk } from "./data";
import { CATS, OUTLETS, type Lean } from "./sources";
import { LeanBar, LeanTag, outletLean, outletName } from "./ui";
import LiveWire from "./LiveWire";
import "./news.css";

export const metadata: Metadata = {
  title: "News from every side",
  description: "Headlines from dozens of outlets rated Left, Center and Right, grouped by story, with neutral summaries written by the On Point Politics news desk.",
  alternates: { canonical: "https://onpointpolitics.com/news" },
};

const fd = (iso: string) => new Date(iso + (iso.length === 10 ? "T12:00:00Z" : "")).toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });

export default function NewsPage() {
  const desk = getDesk();
  const [lead, ...rest] = desk.stories;
  const count = (cv: { o: string }[]) => { const n = { L: 0, C: 0, R: 0 } as Record<Lean, number>; const seen = new Set<string>(); for (const c of cv) { if (seen.has(c.o + (c as { n?: string }).n)) continue; seen.add(c.o + (c as { n?: string }).n); n[outletLean(c.o)]++; } return n; };
  const updated = new Date(desk.updated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return (
    <div className="opp nw">
      <header className="nw-head">
        <div>
          <div className="eye gold">On Point Politics · News</div>
          <h1>The news, <em>from every side.</em></h1>
          <p className="lede">Headlines from {OUTLETS.filter((o) => o.feeds.length).length} outlets we rate Left, Center or Right, grouped by story so you can see who is covering what and how. The biggest stories get a neutral summary written by our news desk, with every fact attributed and every source linked.</p>
        </div>
        <nav className="nw-sub" aria-label="News">
          <Link href="/news" aria-current="page">Front page</Link>
          <a href="#wire">The live wire</a>
          <Link href="/news/sources">Outlets and ratings</Link>
        </nav>
      </header>

      <section className="nw-top" aria-labelledby="nw-top-h">
        <div className="nw-sec-h"><h2 id="nw-top-h">Top stories, summarized</h2><span className="eye">Written by the news desk · updated {updated} ET</span></div>
        <div className="nw-grid">
          <Link href={`/news/story/${lead.id}`} className="card nw-lead">
            <span className="nw-cat">{CATS.find((c) => c.k === lead.cat)?.l} · {fd(lead.date)}</span>
            <h3>{lead.title}</h3>
            <p>{lead.dek}</p>
            <p className="nw-sum">{lead.summary[0]}</p>
            <LeanBar n={count(lead.coverage)} />
            <span className="nw-src">{lead.coverage.length} reports from {new Set(lead.coverage.map((c) => c.o + (c.n ?? ""))).size} outlets · Read the neutral summary</span>
          </Link>
          <div className="nw-side">
            {rest.map((s) => (
              <Link key={s.id} href={`/news/story/${s.id}`} className="card nw-card">
                <span className="nw-cat">{CATS.find((c) => c.k === s.cat)?.l} · {fd(s.date)}</span>
                <h3>{s.title}</h3>
                <LeanBar n={count(s.coverage)} label={false} />
                <span className="nw-src">{s.coverage.slice(0, 3).map((c) => outletName(c.o, c.n)).join(", ")}{s.coverage.length > 3 ? ` and ${s.coverage.length - 3} more` : ""}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div id="wire"><LiveWire /></div>

      <section className="nw-how card">
        <h2>How this works</h2>
        <div className="nw-how-g">
          <div><h3>Ratings are ours</h3><p>Every outlet carries an On Point Politics rating of Left, Center or Right, judged on story selection, headline framing, sourcing and the outlet&apos;s own stated positions. Wire copy that a network republishes is credited to the wire. <Link href="/news/sources">See every rating and why</Link>.</p></div>
          <div><h3>Headlines are theirs</h3><p>The live wire shows each outlet&apos;s own headline and links to its own page. We group headlines about the same event; we do not rewrite them. Opinion pieces are marked.</p></div>
          <div><h3>Summaries are attributed</h3><p>Each summary is written from the linked reporting and names the outlet behind every fact. Claims by candidates and officials are given as claims. See something wrong? <Link href="/contact">Tell us</Link> and we will correct it with a note.</p></div>
        </div>
        <div className="nw-legend"><LeanTag lean="L" /><LeanTag lean="C" /><LeanTag lean="R" /><span>The bar under each story is the share of outlets on each side carrying it.</span></div>
      </section>
    </div>
  );
}
