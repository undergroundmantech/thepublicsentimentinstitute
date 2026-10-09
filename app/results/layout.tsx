import type { Metadata } from "next";
import "./results.css";

export const metadata: Metadata = {
  title: "Election results",
  description:
    "The OnPoint Politics results desk: live election night returns, county maps and race projections for U.S. primary and general elections.",
  openGraph: {
    title: "Election results | OnPoint Politics",
    description:
      "Live election night returns, county maps and race projections for U.S. primary and general elections.",
    url: "/results",
    siteName: "OnPoint Politics",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Election results | OnPoint Politics",
    description:
      "Live election night returns, county maps and race projections for U.S. primary and general elections.",
  },
  alternates: { canonical: "/results" },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
