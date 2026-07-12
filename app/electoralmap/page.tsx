// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function Page() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: ElectoralMapV2 } = await import("./ElectoralMapV2");
    return <ElectoralMapV2 />;
  }
  const { default: ElectoralMapV1 } = await import("./ElectoralMapV1");
  return <ElectoralMapV1 />;
}
