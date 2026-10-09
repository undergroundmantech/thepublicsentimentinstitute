import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Situation room",
  description: "The OnPoint Politics live monitor: the latest polls, today's contests, the calendar ahead and the tightest Senate races.",
  alternates: { canonical: "/tpsi/situation-room" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
