// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: TpsiPollV2 } = await import("./TpsiPollV2");
    return <TpsiPollV2 />;
  }
  const { default: TpsiPollV1 } = await import("./TpsiPollV1");
  return <TpsiPollV1 />;
}
