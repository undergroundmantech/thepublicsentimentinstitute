// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: ResultsV2 } = await import("./ResultsV2");
    return <ResultsV2 />;
  }
  const { default: ResultsV1 } = await import("./ResultsV1");
  return <ResultsV1 />;
}
