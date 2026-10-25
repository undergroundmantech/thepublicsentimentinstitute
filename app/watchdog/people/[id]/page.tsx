import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPeople, getPerson, PARTY_NAME } from "../../data";
import PersonFile, { type PFileX } from "../PersonFile";
import { getWarIndex } from "../../war-room/data";
import "../people.css";

// The files researched in full are built ahead as their own pages; every other file opens in /watchdog/people/view.
export const dynamicParams = false;
export function generateStaticParams() { return getPeople().people.filter((p) => p.hand).map((p) => ({ id: p.id })); }

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const p = getPerson(id);
  if (!p) return {};
  return { title: `${p.name}: Watchdog file`, description: `${p.name}, ${PARTY_NAME[p.party] ?? ""}, ${p.office ? `running for ${p.office}` : p.current}. Who funds the campaign, the decisions on the desk and the sources, from the On Point Watchdog Database.` };
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const p = getPerson(id) as PFileX | null;
  if (!p) notFound();
  const wid = p.race === "nominee" ? (p.office.startsWith("U.S. Senate") ? `sen-${p.st}` : p.office === "Governor" ? `gov-${p.st}` : p.office === "U.S. House" && p.district ? `house-${p.st}-${String(p.district).padStart(2, "0")}` : null) : null;
  const war = wid && getWarIndex().races.some((r) => r.id === wid) ? wid : null;
  return <PersonFile p={p} war={war} />;
}
