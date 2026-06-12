import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Election Results & Forecast · TPSI",
  description:
    "Live election night results, precinct-level maps, and AI-driven forecast models for U.S. primary and general elections — powered by The Public Sentiment Institute.",
  openGraph: {
    title: "Election Results & Forecast · TPSI",
    description:
      "Live election night results, precinct-level maps, and AI-driven forecast models for U.S. primary and general elections.",
    url: "https://thepublicsentimentinstitute.com/results",
    siteName: "The Public Sentiment Institute",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Election Results & Forecast · TPSI",
    description:
      "Live election night results, precinct-level maps, and AI-driven forecast models for U.S. primary and general elections.",
  },
  alternates: {
    canonical: "https://thepublicsentimentinstitute.com/results",
  },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
