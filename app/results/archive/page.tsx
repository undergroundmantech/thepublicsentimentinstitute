import type { Metadata } from "next";
import Link from "next/link";
import { ELECTION_DATES, getRacesByDate, formatElectionDate, getRaceUrl } from "../_data/raceRegistry";
import { SITE_V2 } from "../../lib/flags";

export const metadata: Metadata = {
  title: "Election Results Archive · TPSI",
  description: "Browse all election night results by date — primary and general elections tracked by The Public Sentiment Institute.",
  openGraph: {
    title: "Election Results Archive · TPSI",
    description: "Browse all election night results by date — primary and general elections tracked by The Public Sentiment Institute.",
    url: "https://thepublicsentimentinstitute.com/results/archive",
    siteName: "The Public Sentiment Institute",
    type: "website",
  },
  alternates: { canonical: "https://thepublicsentimentinstitute.com/results/archive" },
};

/** Nights that have a whole-board archive route, not just per-race pages. */
const NIGHT_BOARDS: Record<string, string> = {
  "2026-08-25": "/results/archive/2026-08-25",
  "2026-08-18": "/results/archive/2026-08-18",
  "2026-08-04": "/results/archive/2026-08-04",
};

/**
 * The only races with a page of their own. Every other /results/<date>/<slug>
 * URL rewrites to /results, and v2 answers that with the elections landing page
 * unless a ?date= comes with it — so the rest of the archive has to point at a
 * night board or at the hub for its date, never at a bare slug.
 */
const RACE_PAGES = new Set([
  "oklahoma-governor-republican-runoff",
  "florida-governor-republican-primary",
]);

export default function ResultsArchive() {
  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "40px 16px 80px", fontFamily: "var(--font-body)" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", color: "var(--muted2)", textTransform: "uppercase", marginBottom: 8 }}>
          THE PUBLIC SENTIMENT INSTITUTE
        </div>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: "clamp(22px,4vw,36px)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--foreground)", margin: 0 }}>
          Election Results Archive
        </h1>
        <p style={{ fontSize: 12, color: "var(--muted2)", marginTop: 8, lineHeight: 1.6 }}>
          All tracked elections, organized by date. Click any race to view live results and forecast model.
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        {ELECTION_DATES.map(date => {
          const races = getRacesByDate(date);
          const dayHref =
            NIGHT_BOARDS[date] ??
            (SITE_V2 ? `/results?date=${date}` : getRaceUrl(races[0]?.id ?? 0) ?? "/results");
          // v1 serves every slug URL directly, so only v2 needs the fallback.
          const hrefFor = (r: { id: number; slug: string }) =>
            !SITE_V2 || RACE_PAGES.has(r.slug) ? getRaceUrl(r.id) ?? dayHref : dayHref;
          // Group by state
          const byState: Record<string, typeof races> = {};
          races.forEach(r => {
            const state = r.label.split(" ")[0];
            if (!byState[state]) byState[state] = [];
            byState[state].push(r);
          });

          return (
            <section key={date}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <h2 style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--foreground)", margin: 0 }}>
                  {formatElectionDate(date)}
                </h2>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <Link href={dayHref} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", color: "var(--purple-soft)", textTransform: "uppercase", textDecoration: "none" }}>
                  {NIGHT_BOARDS[date] ? "Open Night Board →" : "Open Dashboard →"}
                </Link>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                {races.map(race => {
                  const href = hrefFor(race);
                  const isRepublican = race.label.includes("Republican");
                  const isDemocratic = race.label.includes("Democratic");
                  const dotColor = isRepublican ? "var(--rep)" : isDemocratic ? "var(--dem)" : "var(--purple)";
                  return (
                    <Link
                      key={race.id}
                      href={href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 14px",
                        background: "var(--panel)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-sm)",
                        textDecoration: "none",
                        transition: "border-color 120ms ease",
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--foreground)", lineHeight: 1.4 }}>
                        {race.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
