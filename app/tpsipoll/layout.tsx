import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "TPSI Polling — Survey Results & Analysis",
  description:
    "Explore polling data, voter sentiment analysis, and survey results from The Public Sentiment Institute's Meridian Coalition Voter model — covering national, state, and primary election polls.",
  openGraph: {
    title: "TPSI Polling — Survey Results & Analysis",
    description:
      "Polling data, voter sentiment analysis, and survey results from The Public Sentiment Institute's Meridian Coalition Voter model.",
    url: "https://thepublicsentimentinstitute.com/tpsipoll",
    siteName: "The Public Sentiment Institute",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "TPSI Polling — Survey Results & Analysis",
    description:
      "Polling data, voter sentiment analysis, and survey results from The Public Sentiment Institute's Meridian Coalition Voter model.",
  },
  alternates: {
    canonical: "https://thepublicsentimentinstitute.com/tpsipoll",
  },
};

export default function TPSIPollLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
