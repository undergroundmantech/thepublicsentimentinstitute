// Inline env check + dynamic import so the bundler drops the unrendered
// site version from the client graph entirely — see app/lib/flags.ts.
export default async function NotFound() {
  if (process.env.NEXT_PUBLIC_SITE_V2 === "on") {
    const { default: NotFoundV2 } = await import("./NotFoundV2");
    return <NotFoundV2 />;
  }
  const { default: NotFoundV1 } = await import("./NotFoundV1");
  return <NotFoundV1 />;
}
