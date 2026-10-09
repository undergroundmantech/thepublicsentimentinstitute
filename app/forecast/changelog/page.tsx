import type { Metadata } from "next";
import Link from "next/link";
import { getModel } from "@/app/lib/forecastData";

export const metadata: Metadata = {
  title: "Forecast changelog",
  description: "Every change to the OnPoint Politics 2026 forecast: new polls, re-runs and model changes, by date.",
  alternates: { canonical: "/forecast/changelog" },
};

type Tag = "Polls" | "Model" | "Re-run" | "Site";
type Entry = { date: string; tag: Tag; title: string; text: string };

// Newest first. One line per entry: date (ISO), tag, title, then one or two sentences.
const ENTRIES: Entry[] = [
  { date: "2026-09-28", tag: "Site", title: "OnPoint Politics", text: "The site is now OnPoint Politics. TPSI polls are still fielded by The Public Sentiment Institute, and every forecast number carries over unchanged." },
  { date: "2026-09-28", tag: "Re-run", title: "House forecast re-run", text: "The House was re-run with every statewide change from today, so the district simulations share the same national and demographic shocks as the Senate and governor runs." },
  { date: "2026-09-28", tag: "Polls", title: "Kansas Senate and governor", text: "Both Kansas races were re-run with new polls from Wedgewood, GBAO and Tavern Research." },
  { date: "2026-09-28", tag: "Model", title: "Governor depolarization", text: "Governor races now respond to about 60 percent of the national swing and of the state's partisan lean, beta 0.6 and lambda 0.6, with the rest moved to state level uncertainty, because governor races are more local. Every governor race was re-run." },
  { date: "2026-09-28", tag: "Polls", title: "Nevada and Arizona governor", text: "Both races were re-run with new polls." },
  { date: "2026-09-28", tag: "Polls", title: "Georgia governor", text: "Re-run with InsiderAdvantage, 1,200 likely voters, 48 to 46, and YouGov, 3,299 likely voters, 46 to 44." },
  { date: "2026-09-28", tag: "Polls", title: "Vermont governor", text: "Re-run with the Braun Research poll: Scott 44, Janoo 34, among 817 likely voters." },
];

const fmtDate = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
const pct = (p: number) => `${+(p * 100).toFixed(2)}%`;

export default function Page() {
  const model = getModel();
  const ch = model.chambers;
  const days = [...new Set(ENTRIES.map((e) => e.date))];
  return (
    <div className="opp">
      <style>{CSS}</style>
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span><Link href="/forecast">Forecast</Link><span className="sep">/</span><span>Changelog</span>
      </nav>
      <header className="ph">
        <div className="eye g">Forecast changelog</div>
        <h1>What changed in the <em>forecast</em></h1>
        <p className="lede">Every new poll, re-run and model change, newest first. The headline odds below are read from the current forecast build.</p>
        <div className="pmeta">
          <span><b className="mono">{ENTRIES.length}</b> entries</span>
          <span>Updated <b>{fmtDate(model.meta.updated)}</b></span>
          <Link className="btn sm" href="/forecast">The forecast</Link>
          <Link className="btn sm" href="/forecast/methodology">Methodology</Link>
        </div>
      </header>

      <div className="layout">
        <div className="cl-stack">
          {days.map((d) => {
            const items = ENTRIES.filter((e) => e.date === d);
            return (
              <section key={d} className="card">
                <div className="card-h"><h3>{fmtDate(d)}</h3><span className="eye" style={{ marginLeft: "auto" }}>{items.length} {items.length === 1 ? "change" : "changes"}</span></div>
                <ol className="cl-list">
                  {items.map((e, i) => (
                    <li key={i}>
                      <span className="cl-tag">{e.tag}</span>
                      <div><b>{e.title}</b><p>{e.text}</p></div>
                    </li>
                  ))}
                </ol>
              </section>
            );
          })}
        </div>

        <aside className="side">
          <div className="card">
            <div className="card-h"><h3>Current odds</h3><span className="eye" style={{ marginLeft: "auto" }}>D control</span></div>
            <div className="stat"><div className="k">Senate, counting Osborn</div><div className="v d">{pct(ch.senate.demControl)}</div></div>
            <div className="stat"><div className="k">House</div><div className="v d">{pct(ch.house.demControl)}</div></div>
            <div className="stat"><div className="k">Governors</div><div className="v d">{pct(ch.governor.demControl)}</div></div>
          </div>
          <div className="callout">
            <div className="eye">How to read it</div>
            A re-run rebuilds the race from its poll file and runs all {model.meta.sims.toLocaleString()} simulations again. <Link href="/forecast/methodology" style={{ textDecoration: "underline" }}>How the model works</Link>.
          </div>
        </aside>
      </div>
    </div>
  );
}

const CSS = `
.opp .cl-stack { display: grid; gap: 16px; min-width: 0; }
.opp .cl-list { list-style: none; margin: 0; padding: 0; }
.opp .cl-list li { display: grid; grid-template-columns: 76px minmax(0,1fr); gap: 14px; padding: 14px 18px; border-top: 1px solid var(--line); }
.opp .cl-list li:first-child { border-top: 0; }
.opp .cl-list b { font: 700 15px/1.3 var(--font-d); letter-spacing: -.01em; color: #fff; }
.opp .cl-list p { margin: 4px 0 0; font-size: 14px; line-height: 1.6; color: var(--ink2); max-width: 70ch; }
.opp .cl-tag { align-self: start; justify-self: start; margin-top: 2px; padding: 3px 8px; border-radius: 999px; border: 1px solid var(--line2); background: var(--glass2);
  font: 700 10px var(--font-m); letter-spacing: .1em; text-transform: uppercase; color: var(--ink2); }
@media (max-width: 600px) { .opp .cl-list li { grid-template-columns: 1fr; gap: 6px; } }
`;
