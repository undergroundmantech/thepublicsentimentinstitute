import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Voter registration",
  description: "Registered voter totals by state and county, from each state's own election authority.",
  alternates: { canonical: "/maps/voter-registration" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
