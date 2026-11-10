// The frame every analysis piece shares: breadcrumbs, headline, byline, the article body and a list of other pieces.
import Link from "@/app/components/Link";
import JsonLd from "@/app/components/JsonLd";
import { SITE, ORG_ID } from "@/app/lib/seo";
import { ARTICLES, fmtDate, type ArticleMeta } from "./lib";
import "./analysis.css";

export default function Article({ a, children, sources }: { a: ArticleMeta; children: React.ReactNode; sources?: { label: string; href: string }[] }) {
  const more = ARTICLES.filter((x) => x.slug !== a.slug);
  return (
    <div className="opp an">
      <JsonLd data={{ "@context": "https://schema.org", "@type": "Article", "@id": `${SITE.url}/analysis/${a.slug}#article`, headline: a.title, description: a.dek,
        url: `${SITE.url}/analysis/${a.slug}`, datePublished: `${a.published}T08:00:00-05:00`, dateModified: `${a.modified}T08:00:00-05:00`,
        author: { "@id": ORG_ID }, publisher: { "@id": ORG_ID }, articleSection: "Analysis", image: `${SITE.url}/opengraph-image.png` }} />
      <nav className="crumbs" aria-label="Breadcrumb"><Link href="/">Home</Link><span className="sep">/</span><Link href="/analysis">Analysis</Link><span className="sep">/</span><span>{a.tag}</span></nav>
      <article className="an-art">
        <header className="ph">
          <div className="eye g">Analysis · {a.tag}</div>
          <h1>{a.title}</h1>
          <p className="lede">{a.dek}</p>
          <div className="pmeta"><span>By <b>the On Point Politics desk</b></span><span>Published <b>{fmtDate(a.published)}</b></span>{a.modified !== a.published ? <span>Updated <b>{fmtDate(a.modified)}</b></span> : null}<span><b>{a.read}</b> minute read</span></div>
        </header>
        <div className="an-prose">{children}</div>
        {sources?.length ? (
          <aside className="an-src"><h2>Data behind this piece</h2><ul>{sources.map((s) => <li key={s.href}><Link href={s.href}>{s.label}</Link></li>)}</ul></aside>
        ) : null}
        <p className="an-note">On Point Politics is nonpartisan and is published by On Point Polling. We correct errors in the open: if you spot one, write to <a href="mailto:onpointpoliticscontact@gmail.com">onpointpoliticscontact@gmail.com</a> and the fix is noted on the page. Read our <Link href="/about#standards">editorial standards</Link>.</p>
      </article>
      <section className="an-more" aria-label="More analysis">
        <h2>More analysis</h2>
        <div className="an-grid">{more.map((x) => (
          <Link key={x.slug} href={`/analysis/${x.slug}`} className="card an-card"><span className="eye">{x.tag} · {fmtDate(x.published)}</span><b>{x.title}</b><small>{x.dek}</small></Link>
        ))}</div>
      </section>
    </div>
  );
}

/** A figure as a small table, so the numbers in a piece are readable without a chart library. */
export function Fig({ title, head, rows, note }: { title: string; head: string[]; rows: (string | number)[][]; note?: string }) {
  return (
    <figure className="an-fig">
      <figcaption>{title}</figcaption>
      <div className="an-tw"><table><thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => j === 0 ? <th key={j} scope="row">{c}</th> : <td key={j}>{c}</td>)}</tr>)}</tbody></table></div>
      {note ? <p className="an-fn">{note}</p> : null}
    </figure>
  );
}
