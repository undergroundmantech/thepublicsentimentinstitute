import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SMS updates",
  description: "Sign up for survey invitations and polling updates by text from The Public Sentiment Institute, the polling arm behind OnPoint Politics.",
  alternates: { canonical: "/tpsi/sms" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
