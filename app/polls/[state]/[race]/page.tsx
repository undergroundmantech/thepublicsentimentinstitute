import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { STATE_NAME } from "@/app/lib/opp";
import { aggByHref, stateRaceParams, PRIMARIES } from "../../registry";
import Average from "../../Average";

export const dynamicParams = false;
export function generateStaticParams() { return stateRaceParams(); }

function raceLabel(race: string) {
  if (race === "senate") return "Senate";
  if (race === "governor") return "governor";
  return race.replace(/-/g, " ");
}

export async function generateMetadata({ params }: { params: Promise<{ state: string; race: string }> }): Promise<Metadata> {
  const { state, race } = await params;
  const prim = PRIMARIES[`${state}/${race}`];
  const name = STATE_NAME[state.toUpperCase()] ?? state.toUpperCase();
  return {
    title: prim ? prim.title : `${name} ${raceLabel(race)} polling average`,
    alternates: { canonical: `/polls/${state}/${race}` },
  };
}

export default async function Page({ params }: { params: Promise<{ state: string; race: string }> }) {
  const { state, race } = await params;
  const key = `${state}/${race}`;
  // primaries predate the averages engine and keep their own pages
  if (key === "fl/governor-gop-primary") { const { default: P } = await import("@/app/_polling/floridarepublicanprimary/page"); return <P />; }
  if (key === "tx/senate-gop-primary") { const { default: P } = await import("@/app/_polling/texasrepublicanprimary/page"); return <P />; }
  if (key === "tx/senate-dem-primary") { const { default: P } = await import("@/app/_polling/texasdemocratprimary/page"); return <P />; }
  if (key === "me/senate-dem-primary") { const { default: P } = await import("@/app/_polling/mainedemocratprimary/page"); return <P />; }
  const def = aggByHref(`/polls/${state}/${race}`);
  if (!def) notFound();
  return <Average id={def.id} />;
}
