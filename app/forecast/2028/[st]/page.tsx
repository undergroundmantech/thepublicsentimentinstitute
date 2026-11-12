import { permanentRedirect } from "next/navigation";
import { stateCodes } from "../lib28";

export const dynamicParams = false;
export function generateStaticParams() { return stateCodes().map((s) => ({ st: s.toLowerCase() })); }

// /forecast/2028/oh now opens Ohio's counties on the /2028 general election map
export default async function Page({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params;
  permanentRedirect(`/2028/general?st=${st.toUpperCase()}`);
}
