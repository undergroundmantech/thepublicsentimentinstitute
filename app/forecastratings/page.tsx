// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: ForecastRatingsV2 } = await import("./ForecastRatingsV2");
    return <ForecastRatingsV2 />;
  }
  const { default: ForecastRatingsV1 } = await import("./ForecastRatingsV1");
  return <ForecastRatingsV1 />;
}
