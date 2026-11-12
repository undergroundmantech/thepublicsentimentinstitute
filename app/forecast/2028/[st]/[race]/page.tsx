import { permanentRedirect } from "next/navigation";
import { RACES, stateCodes } from "../../lib28";

export const dynamicParams = false;
export function generateStaticParams() {
  return stateCodes().flatMap((s) => RACES.map((race) => ({ st: s.toLowerCase(), race })));
}

// The old state pages now open that state's counties on the /2028 maps
export default async function Page({ params }: { params: Promise<{ st: string; race: string }> }) {
  const { st, race } = await params;
  const S = st.toUpperCase();
  if (race === "democratic-primary") permanentRedirect(`/2028/primaries?st=${S}&party=D`);
  if (race === "republican-primary") permanentRedirect(`/2028/primaries?st=${S}&party=R`);
  permanentRedirect(`/2028/general?st=${S}`);
}
