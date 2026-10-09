import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Los Angeles mayor poll, TPSI",
  description: "The Public Sentiment Institute's Los Angeles mayoral survey: first choice, leaners allocated, the 2026 midterm mood and Trump approval among likely voters.",
  alternates: { canonical: "/tpsi/polls/la-mayor-2026" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
