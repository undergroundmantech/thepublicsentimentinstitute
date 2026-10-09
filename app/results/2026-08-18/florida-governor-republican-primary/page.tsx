import type { Metadata } from "next";
import FloridaBoard from "../FloridaBoard";

const TITLE = "Florida Governor Republican Primary Results 2026 — Live County Map & Forecast";
const DESC =
  "Live results and TPSI county-level forecast for the August 18, 2026 Florida " +
  "Republican gubernatorial primary. Byron Donalds, James Fishback, Jay Collins " +
  "and Paul Renner, with all 67 counties, projected turnout and a statewide " +
  "win probability updated as votes are counted.";

const CANONICAL = "/results/2026-08-18/florida-governor-republican-primary";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: CANONICAL,
    type: "article",
    siteName: "The Public Sentiment Institute",
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        // Search engines will not run the client board, so the race is described here too.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: TITLE,
            description: DESC,
            datePublished: "2026-08-18T00:00:00-04:00",
            about: {
              "@type": "Event",
              name: "Florida Governor Republican Primary",
              startDate: "2026-08-18T07:00:00-04:00",
              endDate: "2026-08-18T20:00:00-04:00",
              eventStatus: "https://schema.org/EventScheduled",
              location: {
                "@type": "AdministrativeArea",
                name: "Florida",
              },
            },
            publisher: {
              "@type": "Organization",
              name: "The Public Sentiment Institute",
            },
          }),
        }}
      />
      <FloridaBoard variant="race" />
    </>
  );
}
