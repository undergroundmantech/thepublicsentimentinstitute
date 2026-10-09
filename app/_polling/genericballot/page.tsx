// v2 = the unified Polling Averages page (old race routes redirect here — see
// next.config.ts); v1 = the original generic-ballot page.
// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: GenericBallotV2 } = await import("./GenericBallotV2");
    return <GenericBallotV2 />;
  }
  const { default: GenericBallotV1 } = await import("./GenericBallotV1");
  return <GenericBallotV1 />;
}
