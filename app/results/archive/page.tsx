import type { Metadata } from "next";
import Link from "next/link";
import { ELECTION_DATES, getRacesByDate, formatElectionDate, getRaceUrl } from "../_data/raceRegistry";
import { SITE_V2 } from "../../lib/flags";

export const metadata: Metadata = {
  title: "Election results archive",
  description: "Every election night the OnPoint Politics results desk has tracked, by date, with the reported and certified results.",
  openGraph: {
    title: "Election results archive | OnPoint Politics",
    description: "Every election night the OnPoint Politics results desk has tracked, by date.",
    url: "/results/archive",
    siteName: "OnPoint Politics",
    type: "website",
  },
  alternates: { canonical: "/results/archive" },
};

/** Nights that have a whole-board archive route, not just per-race pages. */
const NIGHT_BOARDS: Record<string, string> = {
  "2026-08-25": "/results/archive/2026-08-25",
  "2026-08-18": "/results/archive/2026-08-18",
  "2026-08-04": "/results/archive/2026-08-04",
};

/**
 * The only races with a page of their own. Every other /results/<date>/<slug>
 * URL rewrites to the night board for its date (see next.config.ts), so the
 * rest of the archive points at a night board, never at a bare slug.
 */
const RACE_PAGES = new Set([
  "oklahoma-governor-republican-runoff",
  "florida-governor-republican-primary",
]);

export default function ResultsArchive() {
  const total = ELECTION_DATES.reduce((a, d) => a + getRacesByDate(d).length, 0);
  return (
    <div className="opp">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link><span className="sep">/</span>
        <Link href="/results">Results</Link><span className="sep">/</span>
        <span>Archive</span>
      </nav>
      <header className="ph">
        <div className="eye g">OnPoint Politics results desk</div>
        <h1>Results <em>archive</em></h1>
        <p className="lede">Every election night the desk has tracked, newest first. Open a night board for the full slate, or a race for its own page.</p>
        <div className="pmeta">
          <span><b className="mono">{ELECTION_DATES.length}</b> election nights</span>
          <span><b className="mono">{total}</b> races</span>
          <span>Returns from AP through civicAPI</span>
          <Link className="btn sm" href="/results/live">Live desk</Link>
        </div>
      </header>

      <div style={{ display: "grid", gap: 16 }}>
        {ELECTION_DATES.map(date => {
          const races = getRacesByDate(date);
          const dayHref =
            NIGHT_BOARDS[date] ??
            (SITE_V2 ? `/results/archive/${date}` : getRaceUrl(races[0]?.id ?? 0) ?? "/results");
          // v1 serves every slug URL directly, so only v2 needs the fallback.
          const hrefFor = (r: { id: number; slug: string }) =>
            !SITE_V2 || RACE_PAGES.has(r.slug) ? getRaceUrl(r.id) ?? dayHref : dayHref;

          return (
            <section className="card" key={date} aria-labelledby={`night-${date}`}>
              <div className="card-h">
                <h3 id={`night-${date}`}>{formatElectionDate(date)}</h3>
                <span className="eye">{races.length} {races.length === 1 ? "race" : "races"}</span>
                <Link className="btn sm" href={dayHref} style={{ marginLeft: "auto" }}>
                  {NIGHT_BOARDS[date] ? "Open night board" : "Open results"}
                </Link>
              </div>
              <div className="card-b">
                <div className="rx-chips">
                  {races.map(race => {
                    const href = hrefFor(race);
                    const isRepublican = race.label.includes("Republican");
                    const isDemocratic = race.label.includes("Democratic");
                    const dotColor = isRepublican ? "var(--gop)" : isDemocratic ? "var(--dem)" : "var(--mute)";
                    return (
                      <Link key={race.id} href={href} className="rx-chip">
                        <i style={{ background: dotColor }} aria-hidden />
                        <span>{race.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
