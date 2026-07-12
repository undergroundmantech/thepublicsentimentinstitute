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
