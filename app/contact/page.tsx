import type { Metadata } from "next";
import { seo } from "@/app/lib/seo";

export const metadata: Metadata = seo({"title": "Request a polling proposal from On Point Polling", "description": "Request a proposal and quote for a poll, a message test, a viability study, voter modeling or fieldwork from On Point Polling, the nonpartisan polling firm for candidates, party committees, PACs, ballot measures, advocacy groups, media and companies.", "path": "/contact"});

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
