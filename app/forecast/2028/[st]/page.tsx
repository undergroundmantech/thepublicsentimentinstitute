import { permanentRedirect } from "next/navigation";
import { stateCodes } from "../lib28";

export const dynamicParams = false;
export function generateStaticParams() { return stateCodes().map((s) => ({ st: s.toLowerCase() })); }

// /forecast/2028/oh now opens Ohio's own 2028 page
export default async function Page({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params;
  permanentRedirect(`/2028/${st.toLowerCase().split("-")[0]}`);
}
