import type { Metadata } from "next";

// No canonical here: each results page names its own, so none of them points at another.
export const metadata: Metadata = {
  title: { default: "2026 election results", template: "%s | On Point Politics" },
  description: "Live election night results and county maps for 2026 primaries, runoffs and the November 3 general election, from On Point Politics.",
  openGraph: { title: "2026 election results | On Point Politics", description: "Live election night results and county maps for 2026 primaries, runoffs and the November 3 general election.", siteName: "On Point Politics", type: "website", locale: "en_US" },
  twitter: { card: "summary_large_image", title: "2026 election results | On Point Politics", description: "Live election night results and county maps for 2026 primaries, runoffs and the November 3 general election." },
};

export default function ResultsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
