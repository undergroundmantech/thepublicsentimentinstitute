import type { Metadata } from "next";
import OklahomaBoard from "../OklahomaBoard";

const TITLE = "Oklahoma governor Republican runoff results 2026: county map and forecast";
const DESC =
  "Live results and the OnPoint Politics county forecast for the August 25, 2026 Oklahoma " +
  "Republican gubernatorial runoff between Gentner Drummond and Mike Mazzei, with " +
  "all 77 counties, projected turnout and a statewide win probability updated as " +
  "votes are counted. Includes the South Carolina U.S. Senate special runoff.";

const CANONICAL = "/results/2026-08-25/oklahoma-governor-republican-runoff";

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: `${TITLE} | OnPoint Politics`,
    description: DESC,
    url: CANONICAL,
    type: "article",
    siteName: "OnPoint Politics",
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
            datePublished: "2026-08-25T00:00:00-05:00",
            about: {
              "@type": "Event",
              name: "Oklahoma Governor Republican Primary Runoff",
              startDate: "2026-08-25T07:00:00-05:00",
              endDate: "2026-08-25T19:00:00-05:00",
              eventStatus: "https://schema.org/EventScheduled",
              location: {
                "@type": "AdministrativeArea",
                name: "Oklahoma",
              },
            },
            publisher: {
              "@type": "Organization",
              name: "OnPoint Politics",
            },
          }),
        }}
      />
      <OklahomaBoard variant="race" />
    </>
  );
}
