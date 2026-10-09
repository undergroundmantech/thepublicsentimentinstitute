import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Party registration",
  description: "Which party leads the voter rolls in every state and county that registers by party.",
  alternates: { canonical: "/maps/party-registration" },
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
