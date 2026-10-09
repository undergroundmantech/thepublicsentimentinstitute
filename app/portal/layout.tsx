import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Client portal",
  robots: { index: false, follow: false, nocache: true },
};

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return children;
}
