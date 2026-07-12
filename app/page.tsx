// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: HomeV2 } = await import("./HomeV2");
    return <HomeV2 />;
  }
  const { default: HomeV1 } = await import("./HomeV1");
  return <HomeV1 />;
}
