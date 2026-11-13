import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { STATE_NAME } from "@/app/lib/opp";
import { aggByHref, stateRaceParams, retiredRaceParams, RETIRED_ROUTES } from "../../registry";
import Average from "../../Average";
import { avgMeta, avgSummary } from "../../seo";
import { seo } from "@/app/lib/seo";

// The 2025 governor averages, and the old 2026 race and primary addresses, which now send readers on: a 2026 race to
// its forecast page, where its final average stays with the result, and a 2026 primary to the polls desk.
export const dynamicParams = false;
export function generateStaticParams() { return [...stateRaceParams(), ...retiredRaceParams()]; }

function raceLabel(race: string) {
  if (race === "senate") return "Senate";
  if (race === "governor") return "governor";
  return race.replace(/-/g, " ");
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; race: string }> }): Promise<Metadata> {
  const { state, race } = await params;
  const name = STATE_NAME[state.toUpperCase()] ?? state.toUpperCase();
  const path = `/polls/${state}/${race}`;
  const def = aggByHref(path);
  if (!def) return seo({ title: `${name} ${raceLabel(race)} polling average`, description: `The ${name} ${raceLabel(race)} polling average from On Point Politics.`, path: RETIRED_ROUTES[path] ?? path });
  return avgMeta(avgSummary(def));
}

export default async function Page({ params }: { params: Promise<{ state: string; race: string }> }) {
  const { state, race } = await params;
  const path = `/polls/${state}/${race}`;
  if (RETIRED_ROUTES[path]) permanentRedirect(RETIRED_ROUTES[path]);
  const def = aggByHref(path);
  if (!def) notFound();
  return <Average id={def.id} />;
}
