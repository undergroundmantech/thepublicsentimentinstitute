import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Commission a poll, request data or reach the OnPoint Politics research desk. Fieldwork by The Public Sentiment Institute.",
  alternates: { canonical: "/contact" },
};

// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: ContactV2 } = await import("./ContactV2");
    return <ContactV2 />;
  }
  const { default: ContactV1 } = await import("./ContactV1");
  return <ContactV1 />;
}
