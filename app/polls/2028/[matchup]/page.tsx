import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Average from "../../Average";
import { avgMeta, avgSummary } from "../../seo";
import { aggByHref } from "../../registry";
import { MATCHUPS_2028 } from "@/app/_polling/2028/matchups";

// One 2028 general election matchup: /polls/2028/{rep}-vs-{dem}
export const dynamicParams = false;
export function generateStaticParams() { return MATCHUPS_2028.map((m) => ({ matchup: m.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ matchup: string }> }): Promise<Metadata> {
  const { matchup } = await params;
  const def = aggByHref(`/polls/2028/${matchup}`);
  return def ? avgMeta(avgSummary(def), `2028 polls: ${def.seriesA.label} vs ${def.seriesB.label} polling average`) : {};
}

export default async function Page({ params }: { params: Promise<{ matchup: string }> }) {
  const { matchup } = await params;
  const def = aggByHref(`/polls/2028/${matchup}`);
  if (!def) notFound();
  return <Average id={def.id} />;
}
