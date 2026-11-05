import { redirect } from "next/navigation";
import { stateCodes } from "../lib28";

export const dynamicParams = false;
export function generateStaticParams() { return stateCodes().map((s) => ({ st: s.toLowerCase() })); }

// /forecast/2028/oh opens the general election page for Ohio
export default async function Page({ params }: { params: Promise<{ st: string }> }) {
  const { st } = await params;
  redirect(`/forecast/2028/${st}/president`);
}
