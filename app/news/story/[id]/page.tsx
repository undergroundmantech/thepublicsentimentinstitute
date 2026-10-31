import type { Metadata } from "next";
import Link from "@/app/components/Link";
import { notFound } from "next/navigation";
import { getDesk } from "../../data";
import { CATS, LEAN_LABEL, OUTLET, type Lean } from "../../sources";
import { LeanBar, LeanTag, outletLean, outletName } from "../../ui";
import LiveWire from "../../LiveWire";
import { RumpleDefs, ScrollFx } from "../../NewsFront";
import "../../news.css";
import "../../paper.css";

export function generateStaticParams() { return getDesk().stories.map((s) => ({ id: s.id })); }
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params; const s = getDesk().stories.find((x) => x.id === id);
  return s ? { title: s.title, description: s.dek, alternates: { canonical: `https://onpointpolitics.com/news/story/${s.id}` } } : {};
}
const fd = (iso: string) => new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const desk = getDesk(); const s = desk.stories.find((x) => x.id === id); if (!s) notFound();
  const by = (l: Lean) => s.coverage.filter((c) => outletLean(c.o) === l);
  const n = { L: 0, C: 0, R: 0 }; const seen = new Set<string>(); for (const c of s.coverage) { const k = c.o + (c.n ?? ""); if (!seen.has(k)) { seen.add(k); n[outletLean(c.o)]++; } }
  const updated = new Date(desk.updated).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York" });
  return (
    <div className="opp nw nw-story nwp-desk">
      <ScrollFx font="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;0,800;0,900;1,700&family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600;1,6..72,400&display=swap" />
      <RumpleDefs />
      <div className="nwp np-storyp">
      <div className="np-fold np-sheet">
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/news">News</Link><span className="sep">/</span><span>{CATS.find((c) => c.k === s.cat)?.l}</span></nav>
      <article>
        <header className="nw-st-h">
          <div className="eye gold">Neutral summary · {fd(s.date)}</div>
          <h1>{s.title}</h1>
          <p className="dek">{s.dek}</p>
          <div className="nw-st-meta"><LeanBar n={n} /><span>{s.coverage.length} reports from {seen.size} outlets · updated {updated} ET</span></div>
        </header>
        <div className="nw-st-g">
          <div className="nw-st-main">
            <section className="nw-prose" aria-label="Summary">{s.summary.map((p, i) => <p key={i}>{p}</p>)}</section>
            {s.facts.length ? <section className="card nw-facts"><h2>What is established</h2><ul>{s.facts.map((f, i) => <li key={i}>{f}</li>)}</ul></section> : null}
            {s.sides.length ? <section className="nw-sides"><h2>What each side says</h2>{s.sides.map((x, i) => <div key={i} className="card"><b>{x.who}</b><p>{x.says}</p></div>)}</section> : null}
            <section className="nw-frame"><h2>How it was covered</h2>
              <div className="nw-frame-g">{(["L", "C", "R"] as Lean[]).map((l) => (
                <div key={l} className={`card nw-col l-${l}`}>
                  <h3><LeanTag lean={l} /> {by(l).length ? `${by(l).length} ${by(l).length === 1 ? "report" : "reports"}` : "No reports"}</h3>
                  {s.framing[l] ? <p className="nw-fr">{s.framing[l]}</p> : null}
                  <ul>{by(l).map((c) => <li key={c.u}><a href={c.u} target="_blank" rel="noopener noreferrer"><b>{outletName(c.o, c.n)}</b>{c.op ? <em>Opinion</em> : null}<span>{c.t}</span></a><time>{new Date(c.d + "T12:00:00Z").toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })}</time></li>)}</ul>
                </div>
              ))}</div>
            </section>
          </div>
          <aside className="nw-st-side">
            {s.related.length ? <div className="card nw-rel"><h3>On Point Politics</h3>{s.related.map((r) => <Link key={r.href} href={r.href}>{r.label}</Link>)}</div> : null}
            <div className="card nw-rel"><h3>About this summary</h3><p>{desk.note}</p><p>Outlet ratings are ours. <Link href="/news/sources">How we rate</Link>. Spot an error? <Link href="/contact">Tell us</Link>.</p>
              <p className="nw-outs">{[...new Set(s.coverage.map((c) => c.o))].map((o) => <span key={o}>{OUTLET[o]?.name ?? o} <i className={`l-${OUTLET[o]?.lean ?? "C"}`}>{LEAN_LABEL[OUTLET[o]?.lean ?? "C"]}</i></span>)}</p></div>
          </aside>
        </div>
      </article>
      </div>
      <div className="np-body np-sheet"><div data-rv><LiveWire keys={s.keys} limit={10} title="New headlines on this story" compact /></div></div>
      </div>
    </div>
  );
}
