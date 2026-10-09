import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy policy and terms",
  description: "The privacy policy, terms and conditions and mobile terms of service for OnPoint Politics and The Public Sentiment Institute.",
  alternates: { canonical: "/terms" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
