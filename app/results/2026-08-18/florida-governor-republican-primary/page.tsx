import type { Metadata } from "next";
import FloridaBoard from "../FloridaBoard";

const TITLE = "Florida governor Republican primary results 2026: county map and forecast";
const DESC =
  "Results and the On Point Politics county level forecast for the August 18, 2026 Florida " +
  "Republican gubernatorial primary. Byron Donalds, James Fishback, Jay Collins " +
  "and Paul Renner, with all 67 counties, projected turnout and a statewide " +
  "win probability updated as votes are counted.";

const CANONICAL = "/results/2026-08-18/florida-governor-republican-primary";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | On Point Politics` },
  description: DESC,
  alternates: { canonical: CANONICAL },
  openGraph: {
    title: TITLE,
    description: DESC,
    url: CANONICAL,
    type: "article",
    siteName: "On Point Politics",
    images: [{ url: "/opengraph-image.png", width: 1200, height: 630, alt: "On Point Politics" }],
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
              eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
              location: {
                "@type": "AdministrativeArea",
                name: "Florida",
              },
            },
            author: { "@type": "Organization", name: "On Point Politics", url: "https://onpointpolitics.com" },
            publisher: {
              "@type": "NewsMediaOrganization",
              "@id": "https://onpointpolitics.com/#organization",
              name: "On Point Politics",
              logo: { "@type": "ImageObject", url: "https://onpointpolitics.com/icon.png" },
            },
            mainEntityOfPage: "https://onpointpolitics.com" + CANONICAL,
            image: ["https://onpointpolitics.com/opengraph-image.png"],
          }),
        }}
      />
      <FloridaBoard variant="race" />
    </>
  );
}
